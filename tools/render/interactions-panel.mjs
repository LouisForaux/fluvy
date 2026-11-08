#!/usr/bin/env node
/**
 * Interaction tests for the settings panel's dropdown (`<fluvy-select>`, the language field of the Preferences
 * tab) in a real Chromium against the playground. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-panel.mjs
 * What it proves: the field opens its menu in the top layer on a click and on ↓, on the chosen row; ↓ ↓ ↓ Enter
 * chooses and the apply bar names the change; Escape closes with nothing changed, the focus still on the field and
 * the key kept from the window (Home Assistant's dialogs); a tap outside and a scroll close it; at 360 the menu is
 * as wide as the field; in a short viewport it opens over the field, as tall as the room there; letters find a
 * name; Tab chooses and moves on to the next control; a language chosen that is not the page's marks the panel and its
 * cards with its `lang`, and Automatic (or a page in it) takes the mark off; a browser without the Popover API draws
 * the same box; the help row opens the translating guide in a new tab; under reduced motion the menu shows and hides
 * without an animation. The Charts tab (1.11): it opens after Appearance with every style and gauge drawn as a tile and the
 * preview in both modes; a style tile applies at once and a card on the page that names no style redraws in it; the
 * fine settings show and hide with the style, the waves with a gauge that moves; motion off freezes the preview, the
 * tiles (the moving gauges' too) and the card; a new set of series colours starts on the palette's six, followed, and
 * is picked from the palette's colours (the picker's groups, each swatch in its token's colour, on one set of columns;
 * a swatch follows the palette, a hex typed under Custom is fixed, each with its mark), checked (two a breath apart are
 * said, by name), saved and worn, renamed in its place and let go; a palette chosen recolours a set that follows it
 * and leaves a set of hexes as it was; at a 320 phone, in every language, the sets and the editor's dots stay in their
 * cards and the page does not scroll sideways; the moving gauges' tiles say their words in the panel's language; the
 * tab logs no console error (a drawing never comes out at a size below 0), light and dark, at 320, 360, 412 and 1400,
 * with motion and under reduced motion, nor when the panel is hidden and shown again. The Cards group (1.15, #121), at
 * 360 and 1400: solid until chosen; its ruler holds in its card's column; four steps down on the keys make 80 %, said in
 * the bar, the preview's cards see-through and blurred on a picture; the blur off leaves them see-through, unblurred.
 * The house ticking (1.17, #135): twenty ticks of an entity no card watches draw none of the Appearance, Dashboard or
 * night wall previews again, nor the cards of a page that speak a language of the person's own.
 */
import { everyLanguage } from './lib.mjs';
import { BASE, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const PREFERENCES = 'panel=preferences';

/** The dropdown's parts on a page of the panel. */
const dropdown = (page) => {
  const select = page.locator('fluvy-panel fluvy-select');
  return {
    select,
    field: select.locator('.fv-select'),
    menu: select.locator('.fv-menu'),
    rows: select.locator('.fv-menu__item'),
    active: select.locator('.fv-menu__item.is-active .fv-menu__name'),
    expanded: async () =>
      (await select.locator('.fv-select').getAttribute('aria-expanded')) === 'true',
    inTopLayer: () => select.locator('.fv-menu').evaluate((menu) => menu.matches(':popover-open')),
  };
};
const barText = async (page) => {
  const bar = page.locator('fluvy-panel .pn-bar__text');
  return (await bar.count()) ? (await bar.textContent()).trim() : '';
};
/** The element that has the focus, through every shadow root: its role and accessible name. */
const focused = (page) =>
  page.evaluate(() => {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return node
      ? { role: node.getAttribute('role'), label: node.getAttribute('aria-label') }
      : null;
  });
/** Keys that reach the window (what Home Assistant's own shortcuts and dialogs would see). */
const watchKeys = (page) =>
  page.evaluate(() => {
    window.__keys = [];
    window.addEventListener('keydown', (e) => window.__keys.push(e.key));
  });
const keysSeen = (page) => page.evaluate(() => window.__keys.splice(0));

/* ---------- opening: a click, ↓, the chosen row, the top layer ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  check(
    'the language field is closed at rest',
    !(await d.expanded()) && (await d.menu.count()) === 0,
  );
  await d.field.click();
  await settle(page, 300);
  check('a click opens the menu', (await d.expanded()) && (await d.menu.count()) === 1);
  check('the menu floats in the top layer', await d.inTopLayer());
  const languages = await everyLanguage();
  check(
    `it holds Automatic and the ${languages.length} languages`,
    (await d.rows.count()) === languages.length + 1,
  );
  const chosen = d.select.locator('.fv-menu__item[aria-selected="true"]');
  check(
    'the chosen row is marked, once',
    (await chosen.count()) === 1 && (await d.rows.nth(0).getAttribute('aria-selected')) === 'true',
  );
  check(
    'the chosen row is the one the keys start from',
    (await d.active.textContent()).trim() === 'Automatic',
  );
  await d.field.click();
  await settle(page, 300);
  check(
    'a click on the field again closes it',
    !(await d.expanded()) && (await d.menu.count()) === 0,
  );
  await d.field.focus();
  await page.keyboard.press('ArrowDown');
  await settle(page, 300);
  check('↓ opens it too', (await d.expanded()) && (await d.menu.count()) === 1);
  check('nothing to apply yet', (await barText(page)) === '');
  await page.close();
}

/* ---------- choosing: ↓ ↓ ↓ Enter, the apply bar ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  await d.field.focus();
  await page.keyboard.press('ArrowDown');
  await settle(page, 200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  check('↓ moves the active row', (await d.active.textContent()).trim() === 'Español');
  await page.keyboard.press('Enter');
  await settle(page, 300);
  check('Enter chooses and closes', !(await d.expanded()) && (await d.menu.count()) === 0);
  check('the field shows the choice', (await d.field.textContent()).trim() === 'Español');
  // the panel speaks the chosen language at once, before it is applied: the bar and the field's name follow
  check(
    'the apply bar names the change, in the chosen language',
    (await barText(page)) === 'Idioma · Español',
    await barText(page),
  );
  check(
    'the focus stays on the field',
    (await focused(page))?.label === 'Idioma',
    JSON.stringify(await focused(page)),
  );
  await page.close();
}

/* ---------- Escape: nothing changes, the focus stays, the key stays inside ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  await d.field.focus();
  await page.keyboard.press('ArrowDown');
  await settle(page, 200);
  await page.keyboard.press('ArrowDown');
  await watchKeys(page);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check('Escape closes the menu', !(await d.expanded()) && (await d.menu.count()) === 0);
  check(
    'with nothing changed',
    (await d.field.textContent()).trim() === 'Automatic' && (await barText(page)) === '',
  );
  check('and the focus on the field', (await focused(page))?.label === 'Language');
  check('Escape never reaches the window', (await keysSeen(page)).length === 0);
  await page.close();
}

/* ---------- a tap outside, a scroll (a viewport the tab overflows: a page that cannot scroll closes nothing) ---------- */
{
  const page = await suite.page(PREFERENCES, { viewport: { width: 360, height: 560 } });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 300);
  check('open at 360', await d.expanded());
  await page.locator('fluvy-panel .pn-label').first().click();
  await settle(page, 300);
  check('a tap outside closes it', !(await d.expanded()) && (await d.menu.count()) === 0);
  await d.field.click();
  await settle(page, 300);
  await page.mouse.wheel(0, 120);
  await settle(page, 300);
  check('a scroll of the page closes it', !(await d.expanded()) && (await d.menu.count()) === 0);
  await page.close();
}

/* ---------- geometry: as wide as the field at 360; above the field in a short viewport ---------- */
{
  const page = await suite.page(PREFERENCES, { viewport: { width: 360, height: 800 } });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 300);
  const field = await d.field.boundingBox();
  const menu = await d.menu.boundingBox();
  check(
    'the menu is as wide as the field, 4 under it',
    Math.abs(menu.width - field.width) < 1 &&
      Math.abs(menu.x - field.x) < 1 &&
      Math.abs(menu.y - (field.y + field.height + 4)) < 1,
    `field ${field.x},${field.width} menu ${menu.x},${menu.width} gap ${menu.y - field.y - field.height}`,
  );
  check(
    'ten rows: eight whole and 24 of the ninth, 8 + 8 × 44 + 24 tall',
    Math.abs(menu.height - 384) < 1 && (await d.menu.getAttribute('data-placement')) === 'below',
    `${menu.height}`,
  );
  await page.close();
}
{
  const page = await suite.page(PREFERENCES, { viewport: { width: 740, height: 400 } });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 300);
  const field = await d.field.boundingBox();
  const menu = await d.menu.boundingBox();
  const placement = await d.menu.getAttribute('data-placement');
  check(
    'in a short viewport it opens over the field, as tall as the room there',
    placement === 'above' &&
      menu.y >= 15 &&
      Math.abs(menu.y + menu.height - (field.y - 4)) < 1 &&
      menu.height < 360,
    `${placement} top ${menu.y} height ${menu.height} field ${field.y}`,
  );
  check(
    'the rows beyond scroll inside the menu',
    await d.menu.evaluate((m) => m.scrollHeight > m.clientHeight),
  );
  await page.close();
}

/* ---------- letters, Tab ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  await d.field.focus();
  await page.keyboard.press('p');
  await settle(page, 200);
  check(
    'a letter opens on the first name starting with it',
    (await d.active.textContent()).trim() === 'Polski',
  );
  await page.keyboard.type('es'); // "pes": no such name, the row stays
  await settle(page, 100);
  check(
    'letters that spell no name leave the row',
    (await d.active.textContent()).trim() === 'Polski',
  );
  await settle(page, 600); // a pause starts a new word
  await page.keyboard.type('es');
  await settle(page, 100);
  check('more letters spell a word', (await d.active.textContent()).trim() === 'Español');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.keyboard.press('ArrowDown');
  await settle(page, 200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await settle(page, 300);
  const next = await focused(page);
  check(
    'Tab chooses the row and moves on to the next control',
    (await barText(page)) === 'Language · English' &&
      next?.role === 'switch' &&
      next?.label === 'Reduce motion',
    JSON.stringify(next),
  );
  await page.close();
}

/* ---------- the language's mark: `lang` on what speaks Fluvy's words, where it is not the page's ---------- */
{
  /** The `lang` of the page, of the panel and of every card it draws. */
  const marks = (page) =>
    page.evaluate(() => {
      const panel = document.querySelector('fluvy-panel');
      const cards = [...panel.shadowRoot.querySelectorAll('*')].filter((el) =>
        /^fluvy-.*-card$/.test(el.localName),
      );
      return {
        page: document.documentElement.lang,
        panel: panel.getAttribute('lang'),
        cards: [...new Set(cards.map((card) => card.getAttribute('lang')))],
      };
    });
  /** Chooses a language by its own name; Automatic, the first row, by none. */
  const choose = async (page, name) => {
    const d = dropdown(page);
    await d.field.click();
    await settle(page, 300);
    await (name ? d.rows.filter({ hasText: name }) : d.rows).first().click();
    await settle(page, 400);
  };
  const page = await suite.page(PREFERENCES);
  const before = await marks(page);
  await choose(page, '日本語');
  const chosen = await marks(page);
  await choose(page);
  const back = await marks(page);
  await page.close();
  // a page already in the language chosen: no mark
  const same = await suite.page(`${PREFERENCES}&lang=ja`);
  await choose(same, '日本語');
  const already = await marks(same);
  await same.close();
  check(
    'Japanese chosen on an English page: the panel and its cards say lang="ja"; Automatic, or a Japanese page, none',
    before.panel === null &&
      before.cards.join() === '' &&
      chosen.page === 'en' &&
      chosen.panel === 'ja' &&
      chosen.cards.join() === 'ja' &&
      back.panel === null &&
      back.cards.join() === '' &&
      already.page === 'ja' &&
      already.panel === null &&
      already.cards.join() === '',
    JSON.stringify({ before, chosen, back, already }),
  );
}

/* ---------- without the Popover API: the same box ---------- */
{
  const withTopLayer = await suite.page(`${PREFERENCES}&state=menu`, {
    viewport: { width: 360, height: 800 },
  });
  const without = await suite.page(`${PREFERENCES}&state=menu&nopopover=1`, {
    viewport: { width: 360, height: 800 },
  });
  const a = dropdown(withTopLayer);
  const b = dropdown(without);
  check(
    'the page opens the menu on its own (?state=menu)',
    (await a.expanded()) && (await b.expanded()),
  );
  check(
    'no Popover API on the second page, so no popover attribute either',
    await b.menu.evaluate(
      (m) => typeof m.showPopover === 'undefined' && !m.hasAttribute('popover'),
    ),
  );
  const boxA = await a.menu.boundingBox();
  const boxB = await b.menu.boundingBox();
  check(
    'a browser without the Popover API draws the menu in the same box',
    ['x', 'y', 'width', 'height'].every((k) => Math.abs(boxA[k] - boxB[k]) < 1),
    `${JSON.stringify(boxA)} vs ${JSON.stringify(boxB)}`,
  );
  // the last row lies over the panel's own rows: a tap there must reach the menu, not the switch under it
  const lastRow = b.rows.nth(7);
  const lastName = (await lastRow.locator('.fv-menu__name').textContent()).trim();
  const last = await lastRow.boundingBox();
  await without.mouse.click(last.x + last.width / 2, last.y + last.height / 2);
  await settle(without, 300);
  check(
    'and over what follows: a tap on its last row chooses',
    (await b.field.textContent()).trim() === lastName && !(await b.expanded()),
    `${(await b.field.textContent()).trim()} (tapped ${lastName})`,
  );
  await withTopLayer.close();
  await without.close();
}

/* ---------- the help row ---------- */
{
  const page = await suite.page(PREFERENCES);
  await page.evaluate(() => {
    window.__opened = [];
    window.open = (url, target, features) => {
      window.__opened.push({ url, target, features });
      return null;
    };
  });
  await page.locator('fluvy-panel .fv-row--tap', { hasText: 'Translations' }).click();
  const opened = await page.evaluate(() => window.__opened);
  check(
    'the help row opens the translating guide in a new tab',
    opened.length === 1 &&
      opened[0].url.endsWith('/docs/translating.md') &&
      opened[0].target === '_blank' &&
      opened[0].features === 'noopener',
    JSON.stringify(opened),
  );
  await page.close();
}

/* ---------- the Charts tab (1.11) ---------- */

/** The Charts tab's parts on a page of the panel. */
const chartsTab = (page) => ({
  tile: (name) =>
    page.locator('fluvy-panel .pn-tile').filter({
      has: page.locator('.pn-swatch__label', { hasText: new RegExp(`^${name}$`) }),
    }),
  /** The rows of a card of the tab, by its title: the Details card's from the factory. */
  labels: (title = 'Details') =>
    page
      .locator('fluvy-panel .pn-card', {
        has: page.locator('.fv-card__title', { hasText: new RegExp(`^${title}$`) }),
      })
      .locator('.pn-label')
      .evaluateAll((all) => all.map((label) => label.textContent.trim())),
  chip: (name) => page.locator('fluvy-panel .fv-chip', { hasText: new RegExp(`^${name}$`) }),
  row: (title) => page.locator('fluvy-panel .fv-row', { hasText: title }),
  set: (name) => page.locator('fluvy-panel .pn-set', { hasText: name }),
  editor: page.locator('fluvy-panel .pn-editor'),
});

{
  // the house of the chart styles' sheet beside the panel, and a sensor's card on the page that names no style
  const page = await suite.page('panel=charts&sheet=chart-styles&frames=none');
  const c = chartsTab(page);
  check(
    'the Charts tab opens after Appearance',
    (await page.locator('fluvy-panel [role="tab"]').nth(1).textContent()).trim() === 'Charts' &&
      (await page.locator('fluvy-panel #pn-tab-charts').getAttribute('aria-selected')) === 'true',
  );
  check(
    'eight styles and eleven gauges (four controls, seven that move) as tiles, each drawn by the engine; classic and ticks chosen',
    (await page.locator('fluvy-panel .pn-art--style svg.fc-chart').count()) === 8 &&
      (await page.locator('fluvy-panel .pn-art--gauge').count()) === 11 &&
      (await page.locator('fluvy-panel .pn-art--gauge .fc-scene').count()) === 7 &&
      (await c.tile('Classic').getAttribute('aria-pressed')) === 'true' &&
      (await c.tile('Ticks').getAttribute('aria-pressed')) === 'true',
  );
  check(
    'a chart, its bars and a gauge previewed in both modes side by side',
    (await page.locator('fluvy-panel .pn-card--preview .pn-mode').count()) === 2 &&
      (await page.locator('fluvy-panel .pn-mode.pn-night .fc-preview svg.fc-chart').count()) ===
        2 &&
      (await page.locator('fluvy-panel .pn-mode.pn-day .fc-preview svg.fc-chart').count()) === 2,
  );
  const sensor = await page.evaluateHandle(async () => {
    const card = document.createElement('fluvy-sensor-card');
    card.setConfig({
      type: 'custom:fluvy-sensor-card',
      entity: 'sensor.cs_temperature',
      _now: '2026-09-17T21:47:12',
    });
    card.hass = window.fluvyMock.hass();
    document.body.append(card);
    await new Promise((resolve) => setTimeout(resolve, 600));
    return card;
  });
  const drawn = () =>
    sensor.evaluate((card) => card.shadowRoot.querySelector('svg.fc-chart')?.getAttribute('class'));
  check(
    'a card that names no style draws the house’s: classic from the factory',
    !/fc-chart--/.test((await drawn()) ?? 'none'),
    await drawn(),
  );
  await c.tile('Soft').click();
  await settle(page, 400);
  check(
    'a style tile applies at once: the card on the page redraws in it, the bar names it',
    /fc-chart--soft/.test((await drawn()) ?? '') &&
      (await barText(page)) === 'Charts · Style · Soft' &&
      (await c.tile('Soft').getAttribute('aria-pressed')) === 'true',
    await drawn(),
  );
  check(
    'the preview draws the soft style in both modes, its line and its bars',
    (await page.locator('fluvy-panel .fc-preview svg.fc-chart--soft').count()) === 4,
  );
  check(
    'the soft style offers what it draws with: its soft shadow, its line’s end, now',
    JSON.stringify(await c.labels()) ===
      JSON.stringify([
        'Line',
        'Soft shadow',
        'Shadow strength',
        'Fill',
        'Gridlines',
        'Line’s end',
        'Now',
        'Bars’ ends',
        'Bubble',
      ]),
    JSON.stringify(await c.labels()),
  );
  await c.tile('Bars').click();
  await settle(page, 300);
  check(
    'bars hide what they do not draw with (the line, its shadow, its end, now)',
    JSON.stringify(await c.labels()) === JSON.stringify(['Gridlines', 'Bars’ ends', 'Bubble']),
    JSON.stringify(await c.labels()),
  );
  // a gauge that moves: its waves are the house's to tune; a control has none
  await c.tile('Liquid').click();
  await settle(page, 300);
  const waves = await c.labels();
  await c.tile('Ticks').click();
  await settle(page, 300);
  check(
    'a gauge that moves offers its waves, under the style’s rows; a control none',
    waves.at(-1) === 'Waves' && !(await c.labels()).includes('Waves'),
    JSON.stringify(waves),
  );
  await c.tile('Classic').click();
  await settle(page, 300);
  check(
    'classic offers nothing to tune but motion, and says why',
    (await c.labels()).length === 0 &&
      (await page.locator('fluvy-panel .pn-note').textContent()).includes('Classic is the chart') &&
      (await barText(page)) === '' &&
      !/fc-chart--/.test((await drawn()) ?? 'none'),
  );
  // the time every chart shows and how far apart its points stand (1.18): every style's, classic's too
  const window = () =>
    sensor.evaluate((card) => card.shadowRoot.querySelector('.fv-card__sub')?.textContent.trim());
  check(
    'the Time card offers the time shown and the points in classic, the last 12 hours and automatic chosen',
    JSON.stringify(await c.labels('Time')) === JSON.stringify(['Time shown', 'A point every']) &&
      (await c.chip('12 h').getAttribute('aria-pressed')) === 'true' &&
      (await c.chip('Automatic').getAttribute('aria-pressed')) === 'true' &&
      /last 12 h/.test((await window()) ?? ''),
    await window(),
  );
  await c.chip('24 h').click();
  await settle(page, 600);
  check(
    'a window chip applies at once: the card on the page that names none shows the last 24 hours, the bar names it',
    /last 24 h/.test((await window()) ?? '') &&
      (await barText(page)) === 'Charts · Time shown · 24 h',
    `${await window()} · ${await barText(page)}`,
  );
  await c.chip('12 h').click();
  await settle(page, 300);
  // motion off: the previews and the tiles draw their resting frame, nothing animates
  await c.tile('Soft').click();
  await settle(page, 200);
  await c.row('Motion').locator('.fv-hit').click();
  await settle(page, 300);
  const moving = await page.evaluate(() => {
    const root = document.querySelector('fluvy-panel').shadowRoot;
    const charts = [...root.querySelectorAll('.fc-preview svg.fc-chart, .pn-art--style svg')];
    return {
      charts: charts.length,
      still: charts.filter((svg) => svg.classList.contains('is-still')).length,
      animated: [
        ...root.querySelectorAll('.fc-preview .fc-line, .fc-preview .fc-bar, .fc-preview .fv-knob'),
      ]
        .map((el) => getComputedStyle(el).animationName)
        .filter((name) => name !== 'none').length,
      // the gauges that move, on their tiles
      scenes: root.querySelectorAll('.pn-art--gauge .fc-scene').length,
      running: [...root.querySelectorAll('.pn-art--gauge .fc-scene')].flatMap((scene) =>
        scene.getAnimations({ subtree: true }),
      ).length,
    };
  });
  check(
    'motion off freezes the preview: every drawing still, not one animation',
    moving.charts === 12 && moving.still === 12 && moving.animated === 0,
    JSON.stringify(moving),
  );
  check(
    'and the gauges that move rest on their tiles, on their first frame',
    moving.scenes === 7 && moving.running === 0,
    JSON.stringify(moving),
  );
  check('and the card on the page with it', /is-still/.test((await drawn()) ?? ''), await drawn());
  await page.close();
}

{
  // the house's own series colours: picked from the palette's (they follow it) or typed (fixed), checked, kept,
  // renamed, let go
  const page = await suite.page('panel=charts');
  const c = chartsTab(page);
  await c.row('New set…').click();
  await settle(page, 300);
  const slots = c.editor.locator('.pn-slot');
  const swatch = (name) => c.editor.locator(`.pn-dot[aria-label="${name}"]`);
  const custom = c.editor.locator('.pn-hex__input');
  const mark = async () => (await c.editor.locator('.pn-mark').textContent()).trim();
  const slotWords = () => slots.evaluateAll((all) => all.map((s) => s.getAttribute('aria-label')));
  check(
    'a new set opens on the palette’s six, each following the palette, the first being picked; both modes drawn',
    JSON.stringify(await slotWords()) ===
      JSON.stringify(
        [1, 2, 3, 4, 5, 6].map((n) => `Colour ${n}: Series ${n} · Follows the palette`),
      ) &&
      (await slots.first().getAttribute('aria-pressed')) === 'true' &&
      (await mark()) === 'Follows the palette' &&
      (await swatch('Series 1').getAttribute('aria-pressed')) === 'true' &&
      (await c.editor.locator('.pn-mode svg.fc-chart').count()) === 2 &&
      (await c.editor.locator('.fv-btn', { hasText: 'Save set' }).isDisabled()),
    JSON.stringify(await slotWords()),
  );
  // the picker: the palette's twelve series colours, its accent with the statuses and the lit light, the energy states,
  // each drawn as the panel's look has it in the mode on screen, every group on the same columns
  const picker = await c.editor.evaluate((editor) => {
    const rgb = (hex) =>
      `rgb(${hex
        .trim()
        .slice(1)
        .match(/../g)
        .map((h) => parseInt(h, 16))
        .join(', ')})`;
    const dots = [...editor.querySelectorAll('.pn-dot')];
    const token = (dot) => /var\((--fluvy-[\w-]+)\)/.exec(dot.getAttribute('style'))?.[1] ?? '';
    return {
      groups: [...editor.querySelectorAll('.pn-label')].map((label) => label.textContent.trim()),
      count: dots.length,
      wrong: dots
        .filter(
          (dot) =>
            getComputedStyle(dot).backgroundColor !==
            rgb(getComputedStyle(dot).getPropertyValue(token(dot))),
        )
        .map((dot) => dot.getAttribute('aria-label')),
      // the columns: a slot, a series colour, a tone and an energy state in the same place
      columns: [editor.querySelector('.pn-slot'), dots[0], dots[12], dots[18]].map((dot) =>
        Math.round(dot.getBoundingClientRect().left + dot.offsetWidth / 2),
      ),
    };
  });
  check(
    'the picker: twenty-four of the palette’s colours in three groups and Custom, each in its token’s colour, on one set of columns',
    picker.groups.join() === 'Name,Colours,Series,Tones,Energy,Custom' &&
      picker.count === 24 &&
      picker.wrong.length === 0 &&
      new Set(picker.columns).size === 1,
    JSON.stringify(picker),
  );
  // a swatch picked names the palette's colour; two of the palette's own that sit together are said by their words
  await slots.nth(1).click();
  await swatch('Solar').click();
  await settle(page, 200);
  const solar = (await slotWords())[1];
  await swatch('Accent').click();
  await settle(page, 200);
  check(
    'a swatch picked follows the palette, by its name; two of the palette’s own that sit together are said by their words',
    solar === 'Colour 2: Solar · Follows the palette' &&
      (await c.editor.locator('.pn-status').textContent()).trim() ===
        'Series 1 and Accent are too close to tell apart',
    `${solar} | ${await c.editor.locator('.pn-status').textContent()}`,
  );
  // a hex typed under Custom is fixed: its mark says so, and no swatch is picked
  const type = async (n, colour) => {
    await slots.nth(n).click();
    await custom.fill(colour);
    await custom.press('Enter');
  };
  await type(0, '#2563eb');
  await settle(page, 200);
  check(
    'a hex typed under Custom is fixed: its slot carries the lock, its mark says Fixed, no swatch is picked',
    (await slotWords())[0] === 'Colour 1: #2563eb · Fixed' &&
      (await mark()) === 'Fixed' &&
      (await c.editor.locator('.pn-dot.is-active').count()) === 0,
    `${(await slotWords())[0]} | ${await mark()}`,
  );
  const both = ['#2563eb', '#d97706', '#16a34a', '#dc2626', '#9333ea', '#0891b2'];
  for (const [n, colour] of both.entries()) await type(n, colour);
  await settle(page, 200);
  check(
    'six that stand apart and read on either card pass',
    (await c.editor.locator('.pn-status').count()) === 0 &&
      (await c.editor.locator('.pn-check').textContent()).includes('Every colour stands apart'),
  );
  // each mode's lines as its card wears them: the colour drawn, and its contrast on that mode's card
  const worn = () =>
    c.editor.evaluate((editor) => {
      const luminance = (css) => {
        const [r, g, b] = css.match(/\d+/g).map((v) => {
          const c = Number(v) / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const read = (mode) => {
        const card = luminance(
          getComputedStyle(editor.querySelector(`.pn-mode[data-mode="${mode}"]`)).backgroundColor,
        );
        return [...editor.querySelectorAll(`.pn-mode[data-mode="${mode}"] .fc-line`)].map(
          (line) => {
            const colour = getComputedStyle(line).stroke;
            const [hi, lo] = [luminance(colour), card].sort((a, b) => b - a);
            return { colour, contrast: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 };
          },
        );
      };
      return { light: read('light'), dark: read('dark') };
    });
  await type(3, '#1e3a8a');
  await type(4, '#f4e9d0');
  await settle(page, 200);
  const fitted = await worn();
  check(
    'a navy is lifted to read on the dark card and a cream deepened on the light one; each drawn as typed on the other',
    fitted.dark[3].contrast >= 3 &&
      fitted.dark[3].colour !== 'rgb(30, 58, 138)' &&
      fitted.light[3].colour === 'rgb(30, 58, 138)' &&
      fitted.light[4].contrast >= 3 &&
      fitted.light[4].colour !== 'rgb(244, 233, 208)' &&
      fitted.dark[4].colour === 'rgb(244, 233, 208)',
    JSON.stringify({ navy: fitted.dark[3], cream: fitted.light[4] }),
  );
  check(
    'nothing is said of a colour fitting fixes; the navy lifted beside the blue is, on the dark card',
    (await c.editor.locator('.pn-status').textContent()).trim() ===
      '#2563eb and #1e3a8a are too close to tell apart on a dark card',
    await c.editor.locator('.pn-status').textContent(),
  );
  await type(3, '#dc2626');
  await type(4, '#9333ea');
  await settle(page, 200);
  await type(1, '#2463ea');
  await settle(page, 200);
  check(
    'two colours a breath apart (ΔE under 8): the check says which, and why',
    (await c.editor.locator('.pn-status').textContent()).includes(
      '#2563eb and #2463ea are too close to tell apart',
    ),
  );
  await type(1, '#d97706');
  await c.editor.locator('.pn-text input').fill('Dusk');
  await settle(page, 200);
  await c.editor.locator('.fv-btn', { hasText: 'Save set' }).click();
  await settle(page, 400);
  check(
    'saved: the house keeps it, the editor closes, the charts wear it from the bar',
    (await c.editor.count()) === 0 &&
      (await c.set('Dusk').getAttribute('aria-pressed')) === 'true' &&
      (await barText(page)) === 'Charts · Series colours · Dusk',
    await barText(page),
  );
  await c.row('Edit this set').click();
  await settle(page, 300);
  await c.editor.locator('.pn-text input').fill('Evening');
  await c.editor.locator('.fv-btn', { hasText: 'Save set' }).click();
  await settle(page, 400);
  check(
    'renamed in its place, still worn',
    (await c.set('Evening').count()) === 1 &&
      (await c.set('Dusk').count()) === 0 &&
      (await c.set('Evening').getAttribute('aria-pressed')) === 'true',
  );
  await c.row('Edit this set').click();
  await settle(page, 300);
  await c.row('Delete this set').click();
  await settle(page, 400);
  check(
    'let go: the palette’s six worn again, nothing left waiting in the bar',
    (await c.set('Evening').count()) === 0 &&
      (await c.set('From the palette').getAttribute('aria-pressed')) === 'true' &&
      (await barText(page)) === '',
    await barText(page),
  );
  await page.close();
}

{
  // the house's sets as a palette is chosen: Garden names the palette's colours, Sea is hexes of its own
  const page = await suite.page('panel=charts&state=sets');
  /** A set's picture as drawn, and the colours its tokens are in the look the panel wears. */
  const pictures = () =>
    page.locator('fluvy-panel').evaluate((panel) => {
      const rgb = (hex) =>
        `rgb(${hex
          .trim()
          .slice(1)
          .match(/../g)
          .map((h) => parseInt(h, 16))
          .join(', ')})`;
      const row = (name) =>
        [...panel.shadowRoot.querySelectorAll('.pn-set')].find(
          (set) => set.querySelector('.pn-custom__title').textContent.trim() === name,
        );
      const fills = (name) =>
        [...row(name).querySelectorAll('rect')].map((rect) => getComputedStyle(rect).fill);
      const style = getComputedStyle(row('Garden'));
      return {
        garden: fills('Garden'),
        sea: fills('Sea'),
        tokens: [
          '--fluvy-graph-4',
          '--fluvy-state-energy-solar',
          '--fluvy-graph-6',
          '--fluvy-success',
          '--fluvy-state-energy-water',
          '--fluvy-graph-2',
        ].map((token) => rgb(style.getPropertyValue(token))),
      };
    });
  const linen = await pictures();
  await page.locator('fluvy-panel #pn-tab-appearance').click();
  await settle(page, 300);
  await page
    .locator('fluvy-panel .pn-swatch')
    .filter({ has: page.locator('.pn-swatch__label', { hasText: /^Volt$/ }) })
    .click();
  await settle(page, 300);
  await page.locator('fluvy-panel #pn-tab-charts').click();
  await settle(page, 400);
  const volt = await pictures();
  check(
    'a palette chosen recolours a set that follows it, in that palette’s own colours, and leaves a set of hexes as it was',
    JSON.stringify(linen.garden) === JSON.stringify(linen.tokens) &&
      JSON.stringify(volt.garden) === JSON.stringify(volt.tokens) &&
      linen.garden.every((colour, n) => colour !== volt.garden[n]) &&
      JSON.stringify(volt.sea) === JSON.stringify(linen.sea),
    JSON.stringify({ linen, volt }),
  );
  await page.close();
}

{
  // a 320 phone, in every language: the sets as wide as their card, the set editor's dots inside it (three a row where
  // six 44s do not fit, never smaller), and the page not scrolled sideways
  const wrong = [];
  for (const lang of await everyLanguage()) {
    const page = await suite.page(`panel=charts&state=sets,editor&lang=${lang}`, {
      viewport: { width: 320, height: 1000 },
    });
    const fit = await page.locator('fluvy-panel').evaluate((panel) => {
      const root = panel.shadowRoot;
      /** Whether a box stays inside its card's padding box, edge to edge. */
      const inside = (el) => {
        const card = el.closest('.fv-card');
        const c = card.getBoundingClientRect();
        const pad = getComputedStyle(card);
        const r = el.getBoundingClientRect();
        return (
          r.left >= c.left + parseFloat(pad.paddingLeft) - 0.5 &&
          r.right <= c.right - parseFloat(pad.paddingRight) + 0.5
        );
      };
      const rows = [...root.querySelectorAll('.pn-set')];
      const dots = [...root.querySelectorAll('.pn-dots > *')];
      return {
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rows: rows.length,
        rowsOut: rows.filter((row) => !inside(row)).length,
        dots: dots.length,
        dotsOut: dots.filter((dot) => !inside(dot)).length,
        small: dots.filter((dot) => dot.getBoundingClientRect().width < 44).length,
      };
    });
    if (fit.sideways || fit.rows < 2 || fit.rowsOut || fit.dots < 30 || fit.dotsOut || fit.small)
      wrong.push(`${lang} ${JSON.stringify(fit)}`);
    await page.close();
  }
  check(
    'at a 320 phone in every language the sets and the set editor’s dots stay in their cards, no sideways scroll',
    wrong.length === 0,
    wrong.join(' | '),
  );
}

{
  // the gauges that move say their words on their tiles in the panel's language, never English under another
  const said = async (lang) => {
    const page = await suite.page(`panel=charts&lang=${lang}`);
    const words = await page
      .locator('fluvy-panel .pn-art--gauge .fc-reading__word')
      .evaluateAll((all) => all.map((word) => word.textContent.trim()));
    await page.close();
    return words;
  };
  const english = await said('en');
  for (const lang of ['de', 'ja']) {
    const words = await said(lang);
    check(
      `the moving gauges’ tiles speak ${lang}: ${words.join(' · ')}`,
      english.length >= 2 &&
        words.length >= english.length &&
        words.every((word) => !english.includes(word)),
      `${JSON.stringify(english)} → ${JSON.stringify(words)}`,
    );
  }
}

{
  // not one console error on the Charts tab: every drawing is drawn once its column is laid out, at a width it holds —
  // never at the side column's grid caught on the phone's for a frame (under reduced motion), nor for a hidden panel's
  // column of no width; each page the tab's every drawing (the tiles, the preview, a set being made)
  const wrong = [];
  const look = async (width, mode, reducedMotion) => {
    const page = await suite.browser.newPage({ viewport: { width, height: 1000 }, reducedMotion });
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`${BASE}?panel=charts&state=styled,sets,editor&mode=${mode}`);
    await page.waitForSelector('html[data-ready="1"]');
    await settle(page, 900);
    const panel = page.locator('fluvy-panel');
    await panel.evaluate((element) => (element.style.display = 'none'));
    await settle(page, 200);
    await panel.evaluate((element) => (element.style.display = ''));
    await settle(page, 400);
    if (errors.length)
      wrong.push(`${width} ${mode} ${reducedMotion}: ${[...new Set(errors)].join(' · ')}`);
    await page.close();
  };
  for (const width of [320, 360, 412, 1400])
    await Promise.all(
      ['light', 'dark'].flatMap((mode) =>
        ['no-preference', 'reduce'].map((motion) => look(width, mode, motion)),
      ),
    );
  check(
    'the Charts tab logs no console error, light and dark, at 320, 360, 412 and 1400, under reduced motion, hidden and shown again',
    wrong.length === 0,
    wrong.join(' | ').slice(0, 600),
  );
}

/* ---------- the cards' surface (1.15, #121) ---------- */
{
  for (const width of [360, 1400]) {
    const page = await suite.page('panel=appearance', { viewport: { width, height: 900 } });
    const group = page
      .locator('fluvy-panel .pn-card')
      .filter({ has: page.locator('.fv-card__title', { hasText: /^Cards$/ }) });
    const figure = group.locator('.fv-row__value').first();
    const band = group.locator('fluvy-ruler [role="slider"]');
    const preview = page.locator('fluvy-panel .pn-preview').first();
    const glassy = () => page.locator('fluvy-panel .pn-preview [glass]').count();
    await group.scrollIntoViewIfNeeded();
    check(
      `${width}: the Cards group is solid until chosen: its figure 100 %, the preview's cards on the page`,
      (await figure.textContent()).trim() === '100 %' &&
        !(await preview.evaluate((el) => el.classList.contains('pn-preview--glass'))) &&
        (await glassy()) === 0,
    );
    // its ruler holds in the card's column
    const inside = await group.evaluate((card) => {
      const ruler = card.querySelector('fluvy-ruler').getBoundingClientRect();
      const box = card.getBoundingClientRect();
      return ruler.left >= box.left && ruler.right <= box.right;
    });
    check(`${width}: the opacity's ruler holds in the card's column`, inside);
    await band.focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
    await settle(page, 300);
    const worn = await page.evaluate(() => {
      const panel = document.querySelector('fluvy-panel');
      const card = panel.shadowRoot.querySelector('.pn-preview [glass]');
      return card ? [card.getAttribute('glass'), card.style.getPropertyValue('--fv-glass')] : null;
    });
    check(
      `${width}: four steps down: 80 %, said in the bar, the preview's cards see-through and blurred on a picture`,
      (await figure.textContent()).trim() === '80 %' &&
        (await barText(page)) === 'Cards · Opacity · 80 %' &&
        (await preview.evaluate((el) => el.classList.contains('pn-preview--glass'))) &&
        JSON.stringify(worn) === JSON.stringify(['blur', '80%']),
      JSON.stringify(worn),
    );
    await group
      .locator('.fv-row')
      .filter({ hasText: 'Blur what shows through' })
      .locator('.fv-hit')
      .click();
    await settle(page, 200);
    check(
      `${width}: the blur off, the cards stay see-through, unblurred`,
      (await page.locator('fluvy-panel .pn-preview [glass="blur"]').count()) === 0 &&
        (await glassy()) > 0,
    );
    await page.close();
  }
}

/* ---------- the house ticking (#135) ---------- */
// a large house changes some twenty states a second, each a new `hass` with its registries and themes the same objects:
// a preview card is drawn again only for an entity it watches (the wall's night tells the cards their own mode), and so
// is a card on a page whose cards speak a language of the person's own
for (const [name, query, language] of [
  ['the Appearance tab', 'panel=appearance&sheet=home&frames=none'],
  ['the Dashboard tab', 'panel=dashboard&sheet=home&frames=none'],
  ['the wall at night', 'panel=wall&state=night&sheet=home&frames=none'],
  ['a page whose cards speak Spanish', 'panel=preferences&sheet=home', 'es'],
]) {
  const page = await suite.page(query, { wait: 1500 });
  const drawn = await page.evaluate(async (language) => {
    const panel = document.querySelector('fluvy-panel');
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    if (language) {
      await panel.handle.store.savePersonal({ language });
      await wait(800); // its words land, and every card says them
    }
    // what draws for a tick: the panel's previews, else the sheet's own cards
    const cards = language
      ? [...document.querySelectorAll('#stage *')].filter(
          (el) => 'rawHass' in el && el.rawHass && !el.closest('fluvy-panel'),
        )
      : [...panel.shadowRoot.querySelectorAll('[preview]')].filter((el) => 'hass' in el);
    let hass = window.fluvyMock.hass();
    const tick = async (state) => {
      const states = {
        ...hass.states,
        'sensor.pg_tick': { entity_id: 'sensor.pg_tick', state, attributes: {} },
      };
      hass = { ...hass, states };
      panel.hass = hass;
      if (language) for (const card of cards) card.hass = hass;
      await wait(50);
    };
    await tick('0');
    // a draw the tick asked for (`hass` among its changes); a card's own timer (a clock's minute, the wall's half
    // minute) is no tick's, and on a slow runner one can land inside the twenty
    let count = 0;
    for (const card of cards) {
      const update = Object.getPrototypeOf(card).update;
      card.update = function (changed) {
        if (changed.has('hass')) count++;
        return update.call(this, changed);
      };
    }
    for (let i = 1; i <= 20; i++) await tick(String(i));
    return { cards: cards.length, count };
  }, language);
  check(
    `${name}: twenty ticks of an entity no card watches draw none of its ${drawn.cards} cards again`,
    drawn.cards > 0 && drawn.count === 0,
    `${drawn.count} redraws`,
  );
  await page.close();
}

/* ---------- reduced motion ---------- */
{
  const page = await suite.page(PREFERENCES);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 100);
  check(
    'under reduced motion the menu appears without an animation',
    (await d.select.getAttribute('reduced-motion')) !== null &&
      (await d.menu.evaluate((m) => getComputedStyle(m).animationName)) === 'none',
  );
  await page.keyboard.press('Escape');
  await settle(page, 50);
  check('and goes at once', (await d.menu.count()) === 0);
  await page.close();
}

await suite.finish();
