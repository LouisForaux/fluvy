#!/usr/bin/env node
/**
 * Interaction and lifecycle tests for the inputs / ambient / home-extras cards (helpers, to-do, timer,
 * actions, updates, weather, openings, scenes, chips, hello). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5184/ node interactions-inputs.mjs
 * What it proves: a text field commits on Enter and on leaving, Escape puts the state back, a key typed
 * in it never reaches the window (Home Assistant's shortcuts); chips and steppers are optimistic and send
 * one call; a tick and an add on the to-do list answer at once; the timer's one timeout and the greeting's
 * hour timer are released on disconnect, and so are the weather forecast and to-do subscriptions; a tab
 * row tracks the open view; a double tap on an action is one run.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, calls, frame, reset, startSuite } from './lib/suite.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const suite = await startSuite();
const { browser, check } = suite;

async function open(sheet, width = 360, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.addInitScript(() => {
    // every timer is tracked, so a card that leaves the page can be asked what it left behind
    const active = new Map();
    const st = window.setTimeout.bind(window);
    const ct = window.clearTimeout.bind(window);
    window.setTimeout = (fn, ms, ...rest) => {
      const id = st(() => {
        active.delete(id);
        if (typeof fn === 'function') fn(...rest);
      }, ms);
      active.set(id, new Error().stack ?? '');
      return id;
    };
    window.clearTimeout = (id) => {
      active.delete(id);
      ct(id);
    };
    window.__timers = active;
    // keys that reach the window are what Home Assistant's shortcuts would see
    window.__keys = [];
    window.addEventListener('keydown', (e) => window.__keys.push(e.key));
  });
  await page.goto(`${BASE}?sheet=${sheet}&width=${width}${extra}`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  return page;
}
const keysSeen = (page) => page.evaluate(() => window.__keys.splice(0));

/* ---------- helpers: the text field ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-helpers-card').first();
  const field = card.locator('input.fv-field__input').first();
  check('text field shows the state', (await field.inputValue()) === 'Welcome home, Marta');

  await field.click();
  await keysSeen(page);
  await page.keyboard.type('e');
  const leaked = await keysSeen(page);
  check(
    'a key typed in the field never reaches the window (HA shortcuts)',
    leaked.length === 0,
    JSON.stringify(leaked),
  );

  await field.fill('Hola, Marta');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  let c = await calls(page);
  check(
    'Enter commits once and leaves the field',
    c.length === 1 &&
      c[0].s === 'input_text.set_value' &&
      c[0].d.value === 'Hola, Marta' &&
      (await page.evaluate(() => document.activeElement?.tagName)) !== 'INPUT',
    JSON.stringify(c.map((x) => x.d)),
  );
  await page.waitForTimeout(400);
  check(
    '…and the field keeps the new value after the report',
    (await field.inputValue()) === 'Hola, Marta',
  );
  await reset(page);

  await field.click();
  await field.fill('typo');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  c = await calls(page);
  check(
    'Escape restores the state and sends nothing',
    c.length === 0 && (await field.inputValue()) === 'Hola, Marta',
    `${await field.inputValue()} · ${c.length} calls`,
  );

  await field.click();
  await field.fill('Bon dia');
  // leaving the field for the page (the head is the card's button: a tap there would go to the helpers' page)
  await page.mouse.click(4, 4);
  await page.waitForTimeout(80);
  c = await calls(page);
  check(
    'leaving the field commits it',
    c.length === 1 && c[0].d.value === 'Bon dia',
    JSON.stringify(c.map((x) => x.d)),
  );
  await reset(page);

  await field.click();
  await field.fill('Bon dia');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  check('an unchanged value is not sent again', (await calls(page)).length === 0);

  // the select chips: optimistic, one call
  const chip = card.locator('.fv-chip').nth(1);
  await chip.click();
  const pressed = await chip.getAttribute('aria-pressed');
  await page.waitForTimeout(80);
  c = await calls(page);
  check(
    'a select chip fills at once and sends one call',
    pressed === 'true' &&
      c.length === 1 &&
      c[0].s === 'input_select.select_option' &&
      c[0].d.option === 'Away',
    JSON.stringify(c.map((x) => x.d)),
  );
  await chip.click();
  await page.waitForTimeout(80);
  check('tapping the active chip sends nothing', (await calls(page)).length === 1);
  await reset(page);

  // the number stepper: optimistic, then the ruler follows
  const plus = card.locator('.fv-stepper__half').nth(1);
  await plus.dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' });
  await plus.dispatchEvent('pointerup');
  const shown = (await card.locator('.in-field__value span').first().textContent()).trim();
  await page.waitForTimeout(700);
  c = await calls(page);
  check(
    'the stepper shows 66 at once and sends one set_value',
    shown === '66' && c.length === 1 && c[0].s === 'input_number.set_value' && c[0].d.value === 66,
    `${shown} · ${JSON.stringify(c.map((x) => x.d))}`,
  );
  await reset(page);

  // the switch row
  await card.locator('.fv-hit').first().click();
  const on = await card.locator('.fv-switch').first().getAttribute('aria-checked');
  await page.waitForTimeout(80);
  c = await calls(page);
  check(
    'the switch row flips before the answer',
    on === 'true' && c.length === 1 && c[0].s === 'input_boolean.turn_on',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);

  // hard states: unavailable helpers are inert, a long select is a row that opens more-info
  const edge = frame(page, 'Helpers · hard states').locator('fluvy-helpers-card').first();
  const zone = edge.locator('.in-value').first();
  check(
    'a 12-option select is one row with its value',
    (await zone.textContent()).trim() === 'Kitchen',
  );
  await page.close();
}

/* ---------- helpers: a long select opens Fluvy's dropdown from its value (#96) ---------- */
{
  const page = await open('inputs');
  const card = frame(page, 'Helpers · selects as dropdowns').locator('fluvy-helpers-card');
  const oven = card.locator('.in-value[aria-haspopup]').first();
  const list = card.locator('fluvy-select').first().locator('.fv-menu');
  check(
    'a 30-option select is a row whose value says it opens a list',
    (await oven.textContent()).trim() === 'Hot air' &&
      (await oven.getAttribute('aria-expanded')) === 'false',
  );
  await oven.click();
  await list.waitFor();
  await page.waitForTimeout(250);
  const opened = await list.evaluate((menu) => ({
    top: menu.matches(':popover-open'),
    focused: menu.getRootNode().activeElement === menu,
    rows: menu.querySelectorAll('.fv-menu__item').length,
    chosen: menu.querySelector('[aria-selected="true"]')?.textContent.trim(),
  }));
  check(
    'a tap opens the list in the top layer, with the keys, its option checked',
    opened.top &&
      opened.focused &&
      opened.rows === 30 &&
      opened.chosen === 'Hot air' &&
      (await oven.getAttribute('aria-expanded')) === 'true',
    JSON.stringify(opened),
  );
  const box = await list.boundingBox();
  const pill = await oven.boundingBox();
  check(
    'the list unfolds 4 under its value and ends where the value ends',
    Math.abs(box.y - (pill.y + pill.height + 4)) <= 1 &&
      Math.abs(box.x + box.width - (pill.x + pill.width)) <= 1,
    `${JSON.stringify(box)} ${JSON.stringify(pill)}`,
  );
  await keysSeen(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('h');
  const leaked = await keysSeen(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  let c = await calls(page);
  check(
    'the keys choose (a letter finds the next name), one select_option, and never reach the window',
    leaked.length === 0 &&
      c.length === 1 &&
      c[0].s === 'select.select_option' &&
      c[0].d.option === 'hot_air_grilling',
    `${JSON.stringify(leaked)} ${JSON.stringify(c.map((x) => x.d))}`,
  );
  check(
    '…the value says it at once, and the focus is back on it',
    (await oven.textContent()).trim() === 'Hot air grilling' &&
      (await oven.evaluate((el) => el.getRootNode().activeElement === el)),
  );
  await reset(page);

  await oven.click();
  await list.waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check(
    'Escape closes it with nothing sent',
    (await calls(page)).length === 0 && (await list.count()) === 0,
  );
  await oven.click();
  await list.waitFor();
  await oven.click();
  await page.waitForTimeout(250);
  check('a second tap on the value closes it', (await list.count()) === 0);
  await oven.click();
  await list.waitFor();
  await page.mouse.click(4, 4);
  await page.waitForTimeout(250);
  check('a tap elsewhere closes it', (await list.count()) === 0);

  // a part of the options, in the row's order: chips that send its option
  const zone = card.locator('.fv-chip').filter({ hasText: 'Pizza setting' });
  await zone.click();
  await page.waitForTimeout(80);
  c = await calls(page);
  check(
    "a row's own options are chips in its order, sending their option",
    c.length === 1 && c[0].d.option === 'pizza_setting',
    JSON.stringify(c.map((x) => x.d)),
  );
  await reset(page);

  // the dropdown in the row's words: a click on an option chooses it
  const picture = card.locator('.in-value[aria-haspopup]').nth(1);
  check("the value is said in the row's words", (await picture.textContent()).trim() === 'AI Mode');
  await picture.click();
  const menu = card.locator('fluvy-select').nth(1).locator('.fv-menu');
  await menu.waitFor();
  await page.waitForTimeout(250);
  await menu.locator('.fv-menu__item').filter({ hasText: 'Movie' }).click();
  await page.waitForTimeout(250);
  c = await calls(page);
  check(
    'a tap on an option chooses it',
    c.length === 1 && c[0].s === 'select.select_option' && c[0].d.option === 'movie',
    JSON.stringify(c.map((x) => x.d)),
  );
  await page.close();
}

/* ---------- an entities row and a lock's row open the same dropdown from a select's value (#96) ---------- */
{
  const page = await open('lists');
  await page.evaluate(() => {
    window.__more = [];
    window.addEventListener('hass-more-info', (e) => window.__more.push(e.detail.entityId));
  });
  for (const { title, tag, value, rows, next, service, option } of [
    {
      title: 'Entities · a select’s dropdown',
      tag: 'fluvy-entities-card',
      value: 'Hot air',
      rows: 30,
      next: 'Hot air eco',
      service: 'select.select_option',
      option: 'hot_air_eco',
    },
    {
      title: 'Lock · a select’s dropdown',
      tag: 'fluvy-lock-card',
      value: '2 minutes',
      rows: 12,
      next: '3 minutes',
      service: 'input_select.select_option',
      option: '3 minutes',
    },
  ]) {
    const card = frame(page, title).locator(tag);
    const pill = card.locator('.in-value[aria-haspopup]').first();
    const list = card.locator('fluvy-select').first().locator('.fv-menu');
    check(
      `${tag}: a select's row ends in its value, which says it opens a list`,
      (await pill.textContent()).trim() === value &&
        (await pill.getAttribute('aria-expanded')) === 'false',
    );
    await pill.click();
    await list.waitFor();
    await page.waitForTimeout(250);
    const opened = await list.evaluate((menu) => ({
      top: menu.matches(':popover-open'),
      focused: menu.getRootNode().activeElement === menu,
      rows: menu.querySelectorAll('.fv-menu__item').length,
      chosen: menu.querySelector('[aria-selected="true"]')?.textContent.trim(),
    }));
    check(
      `${tag}: a tap opens the list in the top layer, with the keys, its option checked`,
      opened.top &&
        opened.focused &&
        opened.rows === rows &&
        opened.chosen === value &&
        (await pill.getAttribute('aria-expanded')) === 'true',
      JSON.stringify(opened),
    );
    const box = await list.boundingBox();
    const at = await pill.boundingBox();
    check(
      `${tag}: the list unfolds 4 from the value (under it, over it near the page's foot), ending where it ends`,
      (Math.abs(box.y - (at.y + at.height + 4)) <= 1 ||
        Math.abs(box.y + box.height + 4 - at.y) <= 1) &&
        Math.abs(box.x + box.width - (at.x + at.width)) <= 1,
      `${JSON.stringify(box)} ${JSON.stringify(at)}`,
    );
    await keysSeen(page);
    await page.keyboard.press('ArrowDown');
    const leaked = await keysSeen(page);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const c = await calls(page);
    check(
      `${tag}: ↓ and Enter choose the next option, one select_option of its domain, no key reaching the window`,
      leaked.length === 0 && c.length === 1 && c[0].s === service && c[0].d.option === option,
      `${JSON.stringify(leaked)} ${JSON.stringify(c)}`,
    );
    check(
      `${tag}: …the value says it at once, and the focus is back on it`,
      (await pill.textContent()).trim() === next &&
        (await pill.evaluate((el) => el.getRootNode().activeElement === el)),
    );
    await reset(page);
    await pill.click();
    await list.waitFor();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    check(
      `${tag}: Escape closes it with nothing sent`,
      (await calls(page)).length === 0 && (await list.count()) === 0,
    );
  }

  // a row with a tap of its own keeps it; one gone from the house says "—" on a button that does nothing
  const kitchen = frame(page, 'Entities · a select’s dropdown').locator('fluvy-entities-card');
  const mode = kitchen.locator('.fv-row').filter({ hasText: 'Oven mode' });
  await mode.click();
  await page.waitForTimeout(150);
  check(
    'a select row with a tap of its own shows its value and opens its details',
    (await mode.locator('.in-value').count()) === 0 &&
      (await mode.locator('.fv-row__value').textContent()).trim() === 'Hot air eco' &&
      JSON.stringify(await page.evaluate(() => window.__more)) === '["select.oven_mode"]',
    JSON.stringify(await page.evaluate(() => window.__more)),
  );
  const ghost = kitchen.locator('.fv-row').filter({ hasText: 'Lower zone' }).locator('.in-value');
  check(
    'a select row out of reach says "—" on a button that does nothing',
    (await ghost.textContent()).trim() === '—' && (await ghost.isDisabled()),
  );
  await page.close();
}

/* ---------- to-do ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-todo-card').first();
  await page.waitForTimeout(200);
  check(
    'the list arrives with its five items',
    (await card.locator('.in-todo__row').count()) === 5,
  );
  const oat = card.locator('.in-check-hit[aria-label="Oat milk"]');
  await oat.click();
  const ticked = await oat.getAttribute('aria-checked');
  const order = (await card.locator('.in-todo__text').allTextContents()).map((r) => r.trim());
  await page.waitForTimeout(80);
  let c = await calls(page);
  check(
    'a tick answers under the finger and sends one update_item',
    ticked === 'true' &&
      c.length === 1 &&
      c[0].s === 'todo.update_item' &&
      c[0].d.status === 'completed',
    JSON.stringify(c.map((x) => x.d)),
  );
  check(
    '…and the ticked item joins the completed group at once',
    order.indexOf('Oat milk') === 2,
    JSON.stringify(order),
  );
  await page.waitForTimeout(500);
  check(
    '…and the head counts it',
    (await card.locator('.fv-card__sub').textContent()).trim() === '2 of 5 left',
    await card.locator('.fv-card__sub').textContent(),
  );
  await reset(page);

  await card.locator('.in-add').click();
  await page.waitForTimeout(100);
  const composer = card.locator('input.fv-field__input');
  check(
    '"+" opens the composer with the focus in it',
    (await composer.count()) === 1 &&
      (await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.tagName)) ===
        'INPUT',
  );
  await page.keyboard.type('Butter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  c = await calls(page);
  const rows = await card.locator('.in-todo__text').allTextContents();
  check(
    'Enter adds the item at once, keeps the composer open and empty',
    c.length === 1 &&
      c[0].s === 'todo.add_item' &&
      c[0].d.item === 'Butter' &&
      rows.some((r) => r.trim() === 'Butter') &&
      (await composer.inputValue()) === '' &&
      (await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.tagName)) ===
        'INPUT',
    JSON.stringify(rows),
  );
  await page.waitForTimeout(500);
  check(
    "…and the server's list keeps it",
    (await card.locator('.in-todo__text').allTextContents()).some((r) => r.trim() === 'Butter'),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check('Escape closes the composer', (await composer.count()) === 0);

  const hard = frame(page, 'To-do · hard states');
  const empty = hard.locator('fluvy-todo-card').nth(0);
  check(
    'an empty list says so, in the empty-state idiom (the ring and one line)',
    (await empty.locator('.fv-empty-state__text').textContent()).trim() === 'Nothing left' &&
      (await empty.locator('.fv-empty-state__ring').count()) === 1,
  );
  const readonly = hard.locator('fluvy-todo-card').nth(1);
  check(
    'a read-only list has no "+" and no checkboxes',
    (await readonly.locator('.in-add').count()) === 0 &&
      (await readonly.locator('button.in-check-hit').count()) === 0,
  );
  await page.close();
}

/* ---------- timer: the one timeout ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-timer-card').first();
  const value = card.locator('.fv-readout__value span').first();
  const a = (await value.textContent()).trim();
  await page.waitForTimeout(1100);
  const b = (await value.textContent()).trim();
  check('the countdown moves one second at a time', a !== b && /^\d+:\d\d$/.test(b), `${a} → ${b}`);

  await card.locator('.fv-round--accent').click(); // pause
  const badge = (await card.locator('.fv-badge').textContent()).trim();
  await page.waitForTimeout(80);
  let c = await calls(page);
  check(
    'pause answers at once and sends timer.pause',
    badge === 'Paused' && c.length === 1 && c[0].s === 'timer.pause',
    `${badge} · ${JSON.stringify(c.map((x) => x.s))}`,
  );
  await page.waitForTimeout(300); // the mock has answered (its `remaining` is the seeded one; Home Assistant sends the real one)
  const held = (await value.textContent()).trim();
  await page.waitForTimeout(1300);
  check(
    'a paused timer stands still',
    (await value.textContent()).trim() === held,
    `${held} → ${(await value.textContent()).trim()}`,
  );
  await reset(page);

  // lifecycle: remove the card → nothing of its own keeps ticking
  const before = await page.evaluate(() => window.__timers.size);
  await page.evaluate(() => {
    const el = document.querySelector('fluvy-timer-card');
    window.__held = el;
    el.remove();
  });
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => window.__timers.size);
  check(
    'removing the timer card leaves no timer of its own',
    after <= before,
    `${before} → ${after}`,
  );
  await page.evaluate(() => {
    document.querySelector('.pg-frame').prepend(window.__held);
  });
  await page.waitForTimeout(300);
  check(
    '…and it comes back showing the present',
    /^\d+:\d\d$/.test(
      (
        await page
          .locator('fluvy-timer-card')
          .first()
          .locator('.fv-readout__value span')
          .first()
          .textContent()
      ).trim(),
    ),
  );
  await page.close();
}

/* ---------- actions: one gesture, one run ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-actions-card').first();
  const action = card.locator('.in-action').first();
  await action.click();
  await action.click(); // the double tap
  await page.waitForTimeout(80);
  const c = await calls(page);
  const sub = (await action.locator('.fv-row__sub').textContent()).trim();
  check(
    'a double tap on an action is one scene.turn_on',
    c.length === 1 && c[0].s === 'scene.turn_on',
    JSON.stringify(c.map((x) => x.s)),
  );
  check('…and the row says Done for a beat', sub === 'Done', sub);
  await page.waitForTimeout(1400);
  check(
    '…then goes back to when it ran',
    /ran \d\d:\d\d/.test((await action.locator('.fv-row__sub').textContent()).trim()),
    await action.locator('.fv-row__sub').textContent(),
  );
  await reset(page);

  // updates: Install turns the row into its progress bar
  const updates = page.locator('fluvy-updates-card').first();
  await updates.locator('.in-value').first().click();
  const bars = await updates.locator('.in-progress').count();
  await page.waitForTimeout(80);
  const u = await calls(page);
  check(
    'Install becomes a progress row at once and sends update.install',
    bars === 2 && u.length === 1 && u[0].s === 'update.install',
    `${bars} bars · ${JSON.stringify(u.map((x) => x.s))}`,
  );
  await page.close();
}

/* ---------- weather: subscriptions released and re-made ---------- */
{
  const page = await open('ambient');
  const count = await page.evaluate(async () => {
    const hass = window.fluvyMock.hass();
    const live = new Set();
    let opened = 0;
    const original = hass.connection.subscribeMessage;
    hass.connection.subscribeMessage = async (cb, msg) => {
      const unsub = await original(cb, msg);
      const token = { msg };
      live.add(token);
      opened += 1;
      return () => {
        live.delete(token);
        unsub();
      };
    };
    const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
    const card = document.createElement('fluvy-weather-card');
    card.setConfig({
      type: 'custom:fluvy-weather-card',
      entity: 'weather.am_home',
      forecast: 'both',
    });
    card.hass = hass;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterMount = live.size;
    card.setConfig({
      type: 'custom:fluvy-weather-card',
      entity: 'weather.am_evening',
      forecast: 'hourly',
    });
    await wait(300);
    const afterSwitch = { live: live.size, opened };
    card.remove();
    await wait(100);
    const afterRemove = live.size;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterReturn = live.size;
    card.remove();
    await wait(100);
    return { afterMount, afterSwitch, afterRemove, afterReturn, final: live.size };
  });
  check(
    'weather: "both" opens two forecast subscriptions',
    count.afterMount === 2,
    JSON.stringify(count),
  );
  check(
    'weather: changing entity/mode releases them and opens the new one',
    count.afterSwitch.live === 1 && count.afterSwitch.opened === 3,
    JSON.stringify(count),
  );
  check(
    'weather: disconnect releases, reconnect re-subscribes, disconnect releases again',
    count.afterRemove === 0 && count.afterReturn === 1 && count.final === 0,
    JSON.stringify(count),
  );

  // openings: the "All sensors" row opens the rest in place
  const openings = page.locator('[data-frame$="/Openings & motion"] fluvy-openings-card').first();
  check(
    'openings: four rows and the "2 more" row',
    (await openings.locator('.fv-row').count()) === 5,
  );
  await openings.locator('.fv-row').last().click();
  await page.waitForTimeout(100);
  check(
    '…tapping it shows every sensor',
    (await openings.locator('.fv-row').count()) === 7 &&
      (await openings.locator('.fv-row').last().locator('.fv-row__sub').textContent()).trim() ===
        'Show less',
  );

  // openings with names of their own (issue #26): the entry's name and icon, a bare id keeps its own
  const named = page
    .locator('[data-frame$="/Openings · each its own name"] fluvy-openings-card')
    .first();
  const titles = await named.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.fv-row__title')].map((t) => t.textContent.trim()),
  );
  check(
    'openings: an entry’s own name, a bare id its sensor’s',
    titles.join('|') === 'Front door|Kitchen|Garage|Hallway motion',
    titles.join('|'),
  );

  // openings as tiles (issue #26's layouts): two a row, each its name, its state and its time; an open one in the warning
  const tiles = await page
    .locator('[data-frame$="/Openings · tiles"] fluvy-openings-card')
    .first()
    .evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.op-tiles .fv-tile')].map((t) => ({
        name: t.querySelector('.fv-tile__name')?.textContent.trim(),
        state: t.querySelector('.fv-tile__state')?.textContent.trim(),
        warn: t.classList.contains('is-on'),
        cut: [...t.querySelectorAll('.fv-tile__name, .fv-tile__state')].some(
          (el) => el.scrollWidth > el.clientWidth + 1,
        ),
      })),
    );
  check(
    'openings tiles: a tile each, the open window in the warning tone; a time beside its state where the tile holds both, else the state alone (never cut)',
    tiles.length === 4 &&
      tiles.map((t) => t.name).join('|') === 'Front door|Kitchen|Garage|Kitchen leak' &&
      tiles[1]?.warn === true &&
      tiles[1]?.state === 'Open · 2 h' &&
      /^Closed( · 2 h ago)?$/.test(tiles[0]?.state ?? '') &&
      /^Dry( · 2 h ago)?$/.test(tiles[3]?.state ?? '') &&
      tiles.every((t) => !t.cut),
    JSON.stringify(tiles),
  );
  // a coloured tile wears its colour at rest (its rest wash), a plain one the page's fill
  const rest = await page
    .locator('[data-frame$="/Openings · tiles"] fluvy-openings-card')
    .first()
    .evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.op-tiles .fv-tile')].map((t) => ({
        tinted: t.classList.contains('is-tinted'),
        bg: getComputedStyle(t).backgroundColor,
      })),
    );
  check(
    'openings tiles: a coloured one wears its colour at rest, a plain one does not',
    rest[0]?.tinted === true &&
      rest[2]?.tinted === true &&
      rest[3]?.tinted === false &&
      rest[0].bg !== rest[3].bg &&
      rest[0].bg !== rest[2].bg,
    JSON.stringify(rest),
  );
  // compact, a sensor gone, folded: one line a value (a dash for the gone one), "+2" to unfold, "−" to fold
  const folded = page
    .locator('[data-frame$="/Openings · compact, one gone, folded"] fluvy-openings-card')
    .first();
  const readFolded = () =>
    folded.evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.fv-row')].map((r) => ({
        value: r.querySelector('.fv-row__value')?.textContent.trim() ?? '',
        open: r.getAttribute('aria-expanded'),
        tall: Math.round(r.getBoundingClientRect().height),
      })),
    );
  const before = await readFolded();
  await folded.locator('.fv-row').last().click();
  await page.waitForTimeout(100);
  const after = await readFolded();
  check(
    'openings compact: a gone sensor is a dash, every row 48 on one line, "+2" unfolds, and open its chevron folds (expanded)',
    before.length === 3 &&
      before[0]?.value === '—' &&
      before[2]?.value === '+2' &&
      after.length === 5 &&
      after[4]?.open === 'true' &&
      [...before, ...after].every((r) => r.tall === 48),
    JSON.stringify({ before, after }),
  );

  // scenes: a press fills its tile at once; the automation is triggered, not toggled
  const scenes = page.locator('fluvy-scenes-card').first();
  await scenes.locator('.am-scene').nth(1).click();
  const filled = (await scenes.locator('.am-scene').nth(1).getAttribute('class')).includes('is-on');
  await page.waitForTimeout(80);
  const s = await calls(page);
  check(
    'scenes: the pressed tile takes the fill at once and one scene.turn_on goes out',
    filled && s.length === 1 && s[0].s === 'scene.turn_on',
    `${filled} · ${JSON.stringify(s.map((x) => x.s))}`,
  );
  await page.close();
}

/* ---------- to-do subscription released on disconnect ---------- */
{
  const page = await open('inputs');
  const count = await page.evaluate(async () => {
    const hass = window.fluvyMock.hass();
    const live = new Set();
    const original = hass.connection.subscribeMessage;
    hass.connection.subscribeMessage = async (cb, msg) => {
      const unsub = await original(cb, msg);
      const token = { msg };
      live.add(token);
      return () => {
        live.delete(token);
        unsub();
      };
    };
    const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
    const card = document.createElement('fluvy-todo-card');
    card.setConfig({ type: 'custom:fluvy-todo-card', entity: 'todo.groceries' });
    card.hass = hass;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterMount = live.size;
    card.setConfig({ type: 'custom:fluvy-todo-card', entity: 'todo.chores' });
    await wait(300);
    const afterSwitch = live.size;
    card.remove();
    await wait(100);
    const afterRemove = live.size;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterReturn = live.size;
    card.remove();
    await wait(100);
    return { afterMount, afterSwitch, afterRemove, afterReturn, final: live.size };
  });
  check(
    'to-do: one subscription per list, released on entity change and on disconnect, re-made on reconnect',
    count.afterMount === 1 &&
      count.afterSwitch === 1 &&
      count.afterRemove === 0 &&
      count.afterReturn === 1 &&
      count.final === 0,
    JSON.stringify(count),
  );
  await page.close();
}

/* ---------- hello: the hour timer, chips: the open view ---------- */
{
  const page = await open('home-extras');
  const timers = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
    await wait(1400); // the shared pill refit one-shot (1.2 s) has fired by now
    const before = window.__timers.size;
    const card = document.createElement('fluvy-hello-card');
    card.setConfig({ type: 'custom:fluvy-hello-card', name: 'Test' });
    card.hass = window.fluvyMock.hass();
    document.querySelector('.pg-frame').append(card);
    await wait(1400);
    const mounted = window.__timers.size;
    card.remove();
    await wait(50);
    const removed = window.__timers.size;
    return { before, mounted, removed };
  });
  check(
    'hello: one hour-aligned timer while mounted, none after removal',
    timers.mounted === timers.before + 1 && timers.removed === timers.before,
    JSON.stringify(timers),
  );

  const chips = page.locator('fluvy-chips-card').first();
  check(
    'chips: the open view is the active tab',
    (await chips.locator('.fv-chip.is-active').textContent()).trim() === 'All',
  );
  await chips.locator('.fv-chip').nth(2).click();
  await page.waitForTimeout(150);
  const active = (await chips.locator('.fv-chip.is-active').allTextContents()).map((t) => t.trim());
  check(
    'chips: tapping a tab navigates and the row follows the router',
    active.length === 1 &&
      active[0] === 'Kitchen' &&
      (await page.evaluate(() => window.location.pathname)) === '/fluvy-home/kitchen',
    JSON.stringify(active),
  );
  await page.goBack();
  await page.waitForTimeout(150);
  check(
    "chips: the browser's back button moves the active tab back",
    (await chips.locator('.fv-chip.is-active').textContent()).trim() === 'All',
  );

  // a mouse reaches a row wider than its column: the wheel turns it, a drag pulls it without opening a tab
  await page.evaluate(() => {
    const holder = document.createElement('div');
    holder.id = 'wide-row';
    holder.style.width = '300px';
    const card = document.createElement('fluvy-chips-card');
    card.setConfig({
      type: 'custom:fluvy-chips-card',
      chips: ['Home', 'Lights', 'Climate', 'Energy', 'Sensors', 'Security', 'Garden'].map(
        (label) => ({ label, path: `/fluvy-home/${label.toLowerCase()}` }),
      ),
    });
    card.hass = window.fluvyMock.hass();
    holder.append(card);
    document.querySelector('.pg-frame').prepend(holder);
  });
  await page.waitForTimeout(400);
  const row = page.locator('#wide-row fluvy-chips-card .fv-chips');
  const room = await row.evaluate((el) => el.scrollWidth - el.clientWidth);
  check(
    'chips: seven tabs in a 300 px column overflow it (the case under test)',
    room > 1,
    `${room}px`,
  );
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(500);
  const wheeled = await row.evaluate((el) => el.scrollLeft);
  check(
    'chips: a vertical mouse wheel scrolls the row sideways',
    wheeled > 1,
    `scrollLeft ${wheeled}`,
  );
  await row.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const path = await page.evaluate(() => window.location.pathname);
  await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 70, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width - 130, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const dragged = await row.evaluate((el) => el.scrollLeft);
  check('chips: a mouse drag pulls the row', dragged >= 90, `scrollLeft ${dragged}`);
  check(
    'chips: the click that ends a drag opens no tab',
    (await page.evaluate(() => window.location.pathname)) === path,
  );
  await page.evaluate(() => document.getElementById('wide-row')?.remove());

  const heading = page.locator('fluvy-heading-card').filter({ hasText: 'Hall' }).first(); // two lights, a switch and a blind
  check(
    'heading: the meta counts what is on',
    (await heading.locator('.hm-section__text').textContent()).trim() === '2 of 4 on',
  );
  const readouts = page.locator('fluvy-readouts-card').first();
  await page.waitForTimeout(300);
  const arrows = await readouts.locator('.fv-trend').count();
  const bare = page.locator('fluvy-readouts-card').nth(2);
  check(
    'readouts: three earned arrows, none for a flat or unrecorded sensor',
    arrows === 3 && (await bare.locator('.fv-trend').count()) === 0,
    `${arrows} · ${await bare.locator('.fv-trend').count()}`,
  );
  await page.close();
}

/* ---------- openings and people at a phone's card and half a column, in five languages ---------- */
// a value, a state, a badge, a sub and a battery are never cut, nor anything outside the card; a name ends in an
// ellipsis (as names may, the language's rule) only with its 96 beside its circle, or 40 once the circle is given; a
// list gives its circles together (the "all sensors" row with them), and a row without one starts its hairline
for (const lang of ['de', 'fr', 'nl', 'pt-BR', 'es']) {
  for (const width of [264, 200]) {
    const page = await open('ambient', width, `&lang=${lang}`);
    const cut = await page.evaluate(() => {
      const out = [];
      // whole cards: a frame of half a column at these widths is a card under the house's floor of 152, and the
      // measurer reads those at 152 and 172
      for (const card of document.querySelectorAll(
        '[data-frame][data-span="12"] :is(fluvy-openings-card, fluvy-people-card)',
      )) {
        const where = card.closest('[data-frame]')?.dataset.frame ?? card.localName;
        const root = card.shadowRoot;
        const box = root.querySelector('article').getBoundingClientRect();
        for (const el of root.querySelectorAll(
          '.fv-card__title, .fv-card__sub, .fv-badge, .fv-row__title, .fv-row__sub, .fv-row__value, .fv-tile__name, .fv-tile__state, .am-person__name, .am-person__state, .fv-battery',
        )) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          const clipped =
            el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'hidden';
          const name = el.matches(
            '.fv-card__title, .fv-row__title, .fv-tile__name, .am-person__name',
          );
          const owner = el.closest('.fv-row, .fv-tile, .fv-card__head, .am-person');
          const bare =
            owner?.classList.contains('am-person') ||
            !owner?.querySelector(
              ':scope > .fv-ico, :scope > .am-avatar, :scope > button > .fv-ico',
            );
          // a name may end in an ellipsis beside its circle once it has its 96, without it once it has begun (40)
          const room = bare ? 40 : 95;
          const outside = r.right > box.right - 15 || r.left < box.left + 15;
          if (outside || (clipped && (!name || el.clientWidth < room)))
            out.push(`${where}: ${el.className.split(' ')[0]} "${el.textContent.trim()}"`);
        }
        const rows = [...root.querySelectorAll('.am-rows > .fv-row, .am-rows .fv-row')];
        const circles = rows.map((row) => !row.classList.contains('fv-row--bare'));
        if (new Set(circles).size > 1) out.push(`${where}: circles not given together`);
        for (const row of rows)
          if (
            row.classList.contains('fv-row--bare') !==
            !row.querySelector(':scope > .fv-ico, :scope > .am-avatar')
          )
            out.push(`${where}: a bare row's hairline`);
      }
      return out;
    });
    check(
      `openings and people (${lang}, ${width}): nothing cut but a name as names may, circles given together`,
      cut.length === 0,
      [...new Set(cut)].slice(0, 6).join(' · '),
    );
    await page.close();
  }
}

/* ---------- a phone's battery is said whole, whatever the state beside it ---------- */
// a long state ("Abwesend", "Afwezig", "Dışarıda") beside a narrow row: the avatars give way, then the state is a dash,
// before the battery's figure would lose its "%"
{
  const cut = [];
  for (const lang of ['de', 'nl', 'tr']) {
    for (const width of [204, 212, 218, 222, 226, 230, 236, 240, 264, 296]) {
      const page = await open('ambient', width, `&lang=${lang}`);
      const found = await page.evaluate(() => {
        const out = [];
        for (const card of document.querySelectorAll('fluvy-people-card')) {
          for (const sub of card.shadowRoot.querySelectorAll('.fv-row__sub')) {
            const battery = sub.querySelector('.fv-battery');
            if (!battery) continue;
            const s = sub.getBoundingClientRect();
            const b = battery.getBoundingClientRect();
            if (sub.scrollWidth > sub.clientWidth + 1 || b.right > s.right + 0.5)
              out.push(`"${battery.textContent.trim()}"`);
          }
        }
        return out;
      });
      for (const f of found) cut.push(`${lang} ${width} ${f}`);
      await page.close();
    }
  }
  check(
    'a phone’s battery is said whole beside any state (de, nl, tr, 204–296)',
    cut.length === 0,
    cut.slice(0, 8).join(' · '),
  );
}

/* ---------- an alert under the fold is always said ---------- */
// the smoke folded under "all sensors": its row says it before its count ("2 more · 1 alert", "+2 · 1 alert", the alert
// alone), and its label says everything
{
  const unsaid = [];
  for (const lang of ['en', 'de', 'fr', 'nl', 'tr']) {
    for (const width of [264, 200]) {
      const page = await open('ambient', width, `&lang=${lang}`);
      const rows = await page
        .locator('[data-frame$="/Openings · smoke under the fold"] fluvy-openings-card')
        .evaluateAll((els) =>
          els.map((el) => {
            const rows = [...el.shadowRoot.querySelectorAll('.fv-row')];
            const fold = rows[rows.length - 1];
            return {
              sub: fold?.querySelector('.fv-row__sub')?.textContent.trim() ?? '',
              label: fold?.getAttribute('aria-label') ?? '',
            };
          }),
        );
      for (const r of rows) {
        const alert = r.label.split(' · ').pop() ?? '';
        if (!alert || !r.sub.endsWith(alert))
          unsaid.push(`${lang} ${width}: "${r.sub}" (${r.label})`);
      }
      if (!rows.length) unsaid.push(`${lang} ${width}: no card`);
      await page.close();
    }
  }
  check(
    'an alert under the fold is said on its row at 264 and 200 in five languages, before its count',
    unsaid.length === 0,
    unsaid.join(' · '),
  );
}

/* ---------- the openings head keeps its badge at a phone's card ---------- */
// the badge is the card's alert: it stays before the sub's last part, and the long title only where both still hold
{
  const lost = [];
  for (const lang of ['en', 'de', 'es', 'fr', 'pt-BR']) {
    const page = await open('ambient', 328, `&lang=${lang}`);
    const heads = await page
      .locator('[data-frame$="/Openings & motion"] fluvy-openings-card')
      .evaluateAll((els) =>
        els.map((el) => ({
          badge: el.shadowRoot.querySelector('.fv-card__head .fv-badge')?.textContent.trim() ?? '',
          title: el.shadowRoot.querySelector('.fv-card__title')?.textContent.trim() ?? '',
        })),
      );
    for (const h of heads) if (!h.badge) lost.push(`${lang}: "${h.title}" without its badge`);
    if (!heads.length) lost.push(`${lang}: no card`);
    await page.close();
  }
  check(
    'the openings head keeps its badge at 328 in five languages (the long title only beside it)',
    lost.length === 0,
    lost.join(' · '),
  );
}

/* ---------- a date in a helper's row holds whole at a third of a section, whatever its month's name ---------- */
// a value's pill is capped at 68 % of the row (`valueCap` mirrors the sheet's CSS: less 68 beside a circle, less 12
// once the row gave it to the name, on the 4 grid), under the name it has the row; a date takes its figures where its
// month's name would not hold ("10 de nov." in Portuguese at 211), and nothing in a pill is ever cut
{
  const ROWS = `/@fs${join(here, '..', '..', 'packages', 'cards', 'src', 'shared', 'row-end.ts')}`;
  const schedules = (page) => frame(page, 'Schedules').locator('fluvy-helpers-card').first();
  // the cap: the button forced wide takes exactly its max-width, which the function must say
  const off = [];
  for (const width of [211, 266, 320]) {
    const page = await open('inputs', width);
    const caps = await schedules(page).evaluate(async (card, rows) => {
      const { valueCap } = await import(rows);
      const out = [];
      for (const row of card.shadowRoot.querySelectorAll('.fv-row:not(.fv-row--stack)')) {
        const button = row.querySelector('.in-value:not(.in-value--action)');
        if (!button) continue;
        const kept = button.style.cssText;
        button.style.cssText = 'width:9999px;flex:none';
        const drawn = button.getBoundingClientRect().width;
        button.style.cssText = kept;
        const bare = row.classList.contains('fv-row--bare');
        out.push({ drawn, said: valueCap(row.getBoundingClientRect().width, bare), bare });
      }
      return out;
    }, ROWS);
    if (!caps.length) off.push(`${width}: no capped button on one line`);
    for (const cap of caps)
      if (cap.drawn !== cap.said)
        off.push(`${width}${cap.bare ? ' bare' : ''}: drawn ${cap.drawn}, said ${cap.said}`);
    await page.close();
  }
  check(
    'valueCap says what the sheet draws: the capped button’s max-width at 211, 266 and 320',
    off.length === 0,
    off.join(' · '),
  );

  // the pills: the three dates (September, November, December) in six languages, a clock pinned to each month
  const cut = [];
  const shown = [];
  for (const lang of ['de', 'fr', 'es', 'pt-BR', 'ja', 'en']) {
    for (const at of ['2026-09-10', '2026-11-10', '2026-12-10']) {
      const page = await open('inputs', 211, `&lang=${lang}&at=${at}`);
      const rows = await schedules(page).evaluate((card) =>
        [...card.shadowRoot.querySelectorAll('.fv-row')].map((row) => {
          const button = row.querySelector('.in-value');
          const text = button?.querySelector('.in-value__text');
          const edge =
            row.getBoundingClientRect().right - (button?.getBoundingClientRect().right ?? 0);
          return {
            name: row.querySelector('.fv-row__title')?.textContent.trim() ?? '',
            value: text?.textContent.trim() ?? '',
            stacked: row.classList.contains('fv-row--stack'),
            cut: !!text && (text.scrollWidth > text.clientWidth || edge < -0.5),
          };
        }),
      );
      for (const row of rows)
        if (row.cut) cut.push(`${lang} ${at}: "${row.value}" under "${row.name}"`);
      if (rows.length !== 5) cut.push(`${lang} ${at}: ${rows.length} rows`);
      if (at === '2026-11-10')
        shown.push(
          `${lang}: ${rows
            .filter((row) => row.value && !/:/.test(row.value))
            .map((row) => `${row.value}${row.stacked ? ' (stacked)' : ''}`)
            .join(' · ')}`,
        );
      await page.close();
    }
  }
  check(
    'a date’s pill is never cut at 211: September, November and December in de, fr, es, pt-BR, ja and en',
    cut.length === 0,
    cut.length ? cut.slice(0, 8).join(' · ') : shown.join(' | '),
  );
}

await suite.finish();
