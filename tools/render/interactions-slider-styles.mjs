#!/usr/bin/env node
/**
 * Interaction tests for the slider styles (1.18, #144) on the playground's `slider-styles` sheet: in every style a
 * drag on a light's slider lands on its value and sends it once (`light.turn_on` with `brightness_pct`), the drag is
 * relative (grabbing away from the level never jumps it) and the keyboard walks a step; a press held still before
 * moving raises the ruler's fine scale (its words relabelled) and leaves a bar's and a liquid's alone; the fill is
 * the tile itself — a drag sets the level, a still press is the tile's tap (`light.turn_off`), a still press of 500 ms
 * its hold (the details); a card asked for the fill draws the ruler; the heights never move with the style.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-slider-styles.mjs
 */
import { dragTo, mousePointer, relativeDrag, rulerGeometry } from './lib/gestures.mjs';
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;
const page = await suite.sheet('slider-styles');
const pointer = mousePointer(page);

/** The card of a frame (its `n`th), by its tag. */
const card = (title, n = 0, tag = 'fluvy-light-card') => frame(page, title).locator(tag).nth(n);
/** A card's slider and its geometry (the knob is the ruler's alone: a style's level is read, never found). */
const slider = async (of) => {
  const box = of.locator('fluvy-ruler .fv-ruler').first();
  await box.scrollIntoViewIfNeeded();
  return rulerGeometry(box, box);
};
/** The level a slider stands at, as it says it: the frames share one light, so every gesture starts from it. */
const level = async (of) =>
  Number(await of.locator('fluvy-ruler .fv-ruler').first().getAttribute('aria-valuenow'));
const words = (of) =>
  of.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.fv-ruler-labels span')].map((s) => s.textContent.trim()),
  );
const height = (of) => of.evaluate((el) => Math.round(el.getBoundingClientRect().height));
/** What the ruler draws: its ticks (`svg`), a bar, a liquid or a fill. */
const drawn = (of) =>
  of.evaluate((el) => {
    const root = el.shadowRoot.querySelector('fluvy-ruler').shadowRoot;
    return root.querySelector('.sb-bar')
      ? 'bar'
      : root.querySelector('.sb-liq')
        ? 'liquid'
        : root.querySelector('.sb-fill')
          ? 'fill'
          : root.querySelector('svg line')
            ? 'ruler'
            : 'nothing';
  });

/* ---------- each style is drawn, and no height moves with it ---------- */
{
  const heights = [];
  for (const style of ['Ruler', 'Bar', 'Liquid']) {
    const light = card(`Slider card · ${style}`, 0, 'fluvy-slider-card');
    check(`the Slider card draws its ${style}`, (await drawn(light)) === style.toLowerCase());
    heights.push(await height(light));
  }
  check(
    'the compact Slider card is 188 in every style',
    heights.join(' ') === '188 188 188',
    heights.join(' '),
  );
  const tiles = ['Tiles · Ruler and Bar', 'Tiles · Liquid and Fill'];
  const tileHeights = [];
  for (const title of tiles)
    for (const n of [0, 1]) tileHeights.push(await height(card(title, n, 'fluvy-tile-card')));
  check(
    'the large tile is 168 in every style, the fill too',
    tileHeights.join(' ') === '168 168 168 168',
    tileHeights.join(' '),
  );
  check(
    'the fill tile draws the wash',
    (await drawn(card('Tiles · Liquid and Fill', 1, 'fluvy-tile-card'))) === 'fill',
  );
  check(
    'a card asked for the fill draws the ruler',
    (await drawn(card('A card asked for Fill'))) === 'ruler' &&
      (await drawn(card('A card asked for Fill', 0, 'fluvy-slider-card'))) === 'ruler',
  );
}

/* ---------- a drag lands on its value in every style, sent once ---------- */
for (const style of ['Ruler', 'Bar', 'Liquid']) {
  await reset(page);
  const light = card(`360 · ${style}`);
  const geo = await slider(light);
  // grabbed at the level, released 30 away (towards the middle): the value lands exactly there
  const from = await level(light);
  const to = from >= 50 ? from - 30 : from + 30;
  await dragTo(pointer, geo, { from, via: (from + to) / 2, to });
  await settle(page, 120);
  const sent = await calls(page);
  check(
    `${style}: a drag sends the brightness once, on release: light.turn_on ${to} %`,
    sent.length === 1 && sent[0].s === 'light.turn_on' && sent[0].d.brightness_pct === to,
    JSON.stringify(sent),
  );
  await settle(page, 600);

  // relative: grabbing 40 % away from the level (towards the middle) and sliding 10 on moves it by 10, never to
  // where the finger is
  await reset(page);
  const at = await level(light);
  const away = at >= 50 ? -40 : 40;
  const step = at >= 50 ? -10 : 10;
  await relativeDrag(pointer, geo, { grab: at + away, to: at + away + step });
  await settle(page, 120);
  const moved = await calls(page);
  check(
    `${style}: the drag is relative, grabbing never jumps (${at} → ${at + step})`,
    moved.length === 1 && moved[0].d.brightness_pct === at + step,
    JSON.stringify(moved),
  );
  await settle(page, 600);

  // the keys walk a step
  await reset(page);
  const now = await level(light);
  await light.locator('fluvy-ruler .fv-ruler').first().focus();
  await page.keyboard.press('ArrowRight');
  await settle(page, 100);
  const keyed = await calls(page);
  check(
    `${style}: a key takes the level one step: light.turn_on ${now + 1} %`,
    keyed.length === 1 && keyed[0].d.brightness_pct === now + 1,
    JSON.stringify(keyed),
  );
  await settle(page, 600);
}

/* ---------- the fine scale is the ruler's alone ---------- */
for (const style of ['Ruler', 'Bar', 'Liquid']) {
  await reset(page);
  const light = card(`360 · ${style}`);
  const geo = await slider(light);
  const before = await words(light);
  const x = geo.at(await level(light));
  await pointer.move(x, geo.y);
  await pointer.down();
  await pointer.wait(650);
  const held = await words(light);
  await pointer.up();
  await settle(page, 500);
  const fine = held.join(' ') !== before.join(' ');
  check(
    style === 'Ruler'
      ? 'Ruler: a still press of 450 ms raises the fine scale, its words relabelled'
      : `${style}: a still press raises no fine scale, the words stay (${before.join(' ')})`,
    style === 'Ruler' ? fine : !fine,
    `${before.join(' ')} → ${held.join(' ')}`,
  );
  await settle(page, 600);
}

/* ---------- the fill: the tile itself is the slider ---------- */
{
  const tile = card('Tiles · Liquid and Fill', 1, 'fluvy-tile-card');
  const box = tile.locator('fluvy-ruler .fv-ruler').first();
  await box.scrollIntoViewIfNeeded();
  const geo = await rulerGeometry(box, box);
  // a drag across the tile sets the level
  await reset(page);
  await pointer.move(geo.at(50), geo.y);
  await pointer.down();
  await pointer.move(geo.at(60), geo.y, 6);
  await pointer.move(geo.at(70), geo.y, 8);
  await pointer.up();
  await settle(page, 120);
  const slid = await calls(page);
  check(
    'Fill: a drag across the tile sets the brightness once: light.turn_on 85 %',
    slid.length === 1 && slid[0].s === 'light.turn_on' && slid[0].d.brightness_pct === 85,
    JSON.stringify(slid),
  );
  await settle(page, 600);
  // a still press is the tile's tap (the frame's tile toggles on it): the light toggles
  await reset(page);
  await pointer.move(geo.at(40), geo.y);
  await pointer.down();
  await pointer.up();
  await settle(page, 120);
  const tapped = await calls(page);
  check(
    'Fill: a still press is the tile’s tap: light.turn_off',
    tapped.length === 1 && tapped[0].s === 'light.turn_off',
    JSON.stringify(tapped),
  );
  await settle(page, 600);
  // a still press of 500 ms is the tile's hold: the details open, and no tap follows
  await reset(page);
  await pointer.move(geo.at(40), geo.y);
  await pointer.down();
  await pointer.wait(650);
  await pointer.up();
  await settle(page, 200);
  const opened = await moreInfo(page);
  const after = await calls(page);
  check(
    'Fill: a still press of 500 ms opens the details, and nothing toggles',
    opened.length === 1 && opened[0] === 'light.ss_desk' && after.length === 0,
    `${JSON.stringify(opened)} ${JSON.stringify(after)}`,
  );
  await settle(page, 600);
  // out of reach, the fill takes no slide and its tap still opens the details
  await reset(page);
  const gone = card('Off and unavailable · Fill', 1, 'fluvy-tile-card');
  const goneBox = gone.locator('fluvy-ruler .fv-ruler').first();
  await goneBox.scrollIntoViewIfNeeded();
  const goneGeo = await rulerGeometry(goneBox, goneBox);
  await pointer.move(goneGeo.at(40), goneGeo.y);
  await pointer.down();
  await pointer.move(goneGeo.at(60), goneGeo.y, 6);
  await pointer.up();
  await settle(page, 120);
  const dead = await calls(page);
  await pointer.move(goneGeo.at(40), goneGeo.y);
  await pointer.down();
  await pointer.up();
  await settle(page, 120);
  const asked = await moreInfo(page);
  check(
    'Fill out of reach: a drag sets nothing, a tap opens the details',
    dead.length === 0 && asked.length === 1 && asked[0] === 'light.ss_gone',
    `${JSON.stringify(dead)} ${JSON.stringify(asked)}`,
  );
}

/* ---------- the words under a bar: the ends and the middle, or none, the row kept ---------- */
{
  const bar = card('360 · Bar');
  const said = await words(bar);
  check(
    'Bar: the words say the ends and the middle',
    said.join(' ') === '0 50 100',
    said.join(' '),
  );
  const none = card('Words · none');
  const quiet = await words(none);
  check('slider_words: none says nothing under the bar', quiet.length === 0, quiet.join(' '));
  const rows = await none.evaluate(
    (el) => el.shadowRoot.querySelector('.fv-ruler-labels')?.getBoundingClientRect().height ?? 0,
  );
  check('and the row keeps its 16, so no height moves', rows === 16, String(rows));
}

await suite.finish();
