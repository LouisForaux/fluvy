#!/usr/bin/env node
/**
 * The chart engine (1.11) on the playground's `chart-styles` sheet, in a real Chromium, and once on the built bundle.
 * Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5199/ node interactions-chart.mjs     (the bundle's check needs `pnpm build` first)
 * What it proves:
 * - classic's look: the sensor's curve and area drawn by 1.10's maths (`classic.test.ts` holds them byte for byte to
 *   `chart/engine/__fixtures__/classic-1.10.json`) through its line through time (1.18): calm, its points 5 px apart at
 *   least, two sensors' at the same places; and their fills 1.10's paint (one sensor's at 28 %, two sharing the plot
 *   at 16 %);
 * - nothing leaves the plot, in every style and both modes: every line, area, copy and bar inside the chart's clip box,
 *   the dot, the knob and the bubble whole inside the chart's room and the card;
 * - text placement, in every style and both modes: the axis's first label flush with the plot's start and its last
 *   with its end, the scale's ticks right-aligned on one column 8 before the plot, a style's bubble inside the plot;
 * - the forecast: Fluvy's knob on now's hairline, the forecast dashed from it;
 * - a measurement's scale keeps to its range (a temperature is not drawn from zero), a meter's day in bars is 24 of an
 *   hour from zero, the gridlines a card asks for are drawn (the horizontal ones at the ticks), every gauge's knob is
 *   Fluvy's whole knob, and the read dial in a tile holds its reading;
 * - reading: a pointer moves the cursor and the bubble says when; the keys move it (← Home), Escape lets it go;
 * - the moving gauges (the `animated` sheet) in both modes: each runs, on transform, opacity and the dash offset only
 *   and unfiltered; nothing leaves its box; its reading inside it, never across the waterline or any sweep of the
 *   weather, a mark's centred under it; out of reach, told not to move, under the house's motion off and under reduced
 *   motion every one rests on its first frame (the liquid still a wave); in a half card (152, 172) each as tall as
 *   its twin out of reach; and from 211 to a phone (211, 266, 328, 360), in English, German, Japanese and Portugal's
 *   Portuguese, every gauge of the sheet — moving, and on the plain ring, the bar and the signed ring — one height at
 *   its low, middle and high values and out of reach, unrecorded;
 * - the cards that take the styles, on their own sheets under the house's soft in both modes: every rule above held
 *   (the energy line, a production day), a stacked chart's hairlines and lighter fills, the distribution's pills and
 *   the bars' deepening ink, the history bars and the arrays classic (soft is not theirs), the house's ring on the
 *   gauge card and its ruler on the humidity, and the History page drawn by the engine;
 * - a house's own set of series colours, worn fitted to each mode's card: the arrays' columns and their legend's
 *   squares, a navy as picked on the light card and lifted on the dark one, a cream the other way round;
 * - a house's set that names the palette's colours follows the palette: the arrays wear Sage's on Sage and Volt's on
 *   Volt (`?palette=`), the columns and their squares;
 * - no flash, on the built bundle with the engine's chunk 1.5 s late: one skeleton, then the curve, drawn once.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frame, settle, startSuite } from './lib/suite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtures = JSON.parse(
  await readFile(
    join(ROOT, 'packages/cards/src/chart/engine/__fixtures__/classic-1.10.json'),
    'utf8',
  ),
);

const suite = await startSuite();
const { check } = suite;

/** The paths of a card's chart by class, through its shadow root. */
const paths = (locator, selector) =>
  locator.evaluate(
    (card, sel) => [...card.shadowRoot.querySelectorAll(sel)].map((el) => el.getAttribute('d')),
    selector,
  );

/** Where a path's points stand across the plot: its start and the end of each of its curves. */
const places = (d) =>
  [...(d ?? '').matchAll(/(?:^M| )(-?[\d.]+),[\d.]+(?= C|$)/g)].map((m) => +m[1]);
/** The least distance between two of its points, its two ends aside (the window's ends stand where they fall). */
const closest = (xs) => Math.min(...xs.slice(2, -1).map((x, i) => x - xs[i + 1]));

/* ---------- classic's look ---------- */
{
  const page = await suite.sheet('chart-styles');
  const one = frame(page, 'Style · classic').locator('fluvy-sensor-card').first();
  const [line] = await paths(one, '.am-chart .curve-line');
  check(
    'classic, one sensor: one curve and its area, its points 5 px apart at least (the house’s 2.5 line)',
    (await paths(one, '.am-chart .curve-area')).length === 1 && closest(places(line)) >= 5 - 1e-6,
    JSON.stringify(places(line).slice(0, 6)),
  );
  const two = frame(page, 'Several · classic').locator('fluvy-sensor-card').first();
  const lines = await paths(two, '.am-chart .curve-line');
  check(
    'classic, two sensors: a curve each, their points at the same places, an area under each',
    lines.length === 2 &&
      JSON.stringify(places(lines[0])) === JSON.stringify(places(lines[1])) &&
      (await paths(two, '.am-chart .curve-area')).length === 2,
  );
  // the paint as 1.10 drew it, not the paths alone: one sensor's fill at 28 %, two sharing the plot at 16 %
  const fills = (card) =>
    card.evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.am-chart .curve-fill-a')].map((stop) =>
        Number(getComputedStyle(stop).stopOpacity),
      ),
    );
  const [lone, shared] = [await fills(one), await fills(two)];
  check(
    'classic: one sensor’s fill at 28 %, two sensors’ at 16 %, as 1.10 painted them',
    lone.length === 1 && lone[0] === 0.28 && shared.length === 2 && shared.every((o) => o === 0.16),
    JSON.stringify({ lone, shared }),
  );
  await page.close();
}

/**
 * Every chart of the page, read where it is drawn: what leaves its clip box, a mark outside its room, the axis's
 * ends, the ticks' column and the bubble — one line per chart that breaks a rule.
 */
const audit = (page) =>
  page.evaluate(() => {
    const cards = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          if (el.shadowRoot.querySelector('svg.fc-chart')) cards.push(el);
          walk(el.shadowRoot);
        }
      }
    };
    walk(document);
    const wrong = [];
    let charts = 0;
    for (const card of cards) {
      const name = `${card.closest('[data-frame]')?.getAttribute('data-frame') ?? '?'} ${card.localName}`;
      const shell = card.shadowRoot.querySelector('[data-card]')?.getBoundingClientRect();
      for (const svg of card.shadowRoot.querySelectorAll('svg.fc-chart')) {
        charts++;
        const box = svg.getBoundingClientRect();
        const clip = svg.querySelector('clipPath rect');
        const cx = box.left + Number(clip.getAttribute('x'));
        const cw = Number(clip.getAttribute('width'));
        const cy = box.top + Number(clip.getAttribute('y'));
        const ch = Number(clip.getAttribute('height'));
        for (const path of svg.querySelectorAll('path')) {
          if (!path.closest('g[clip-path]'))
            wrong.push(`${name}: a path outside the clipped layers`);
          const r = path.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (
            r.left < cx - 0.5 ||
            r.right > cx + cw + 0.5 ||
            r.top < cy - 0.5 ||
            r.bottom > cy + ch + 0.5
          )
            wrong.push(
              `${name}: ${path.getAttribute('class')} at ${r.left.toFixed(1)}…${r.right.toFixed(1)} × ${r.top.toFixed(1)}…${r.bottom.toFixed(1)} leaves ${cx.toFixed(1)}…${(cx + cw).toFixed(1)} × ${cy.toFixed(1)}…${(cy + ch).toFixed(1)}`,
            );
        }
        // the marks stand proud by their radius at most: whole inside the drawing's height, and the card
        const wrapper = svg.parentElement;
        const marks = [
          ...svg.querySelectorAll('.curve-dot'),
          ...wrapper.querySelectorAll(':scope > .fv-knob'),
          ...wrapper.querySelectorAll(':scope > .fv-bubble'),
        ];
        for (const mark of marks) {
          const r = mark.getBoundingClientRect();
          // a mark the card does not show (out of reach, its reading at now is not real) stands nowhere
          if (r.width === 0 && r.height === 0) continue;
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 8.5)
            wrong.push(
              `${name}: ${mark.getAttribute('class')} leaves the chart's room (${r.top.toFixed(1)}…${r.bottom.toFixed(1)} of ${box.top.toFixed(1)}…${box.bottom.toFixed(1)})`,
            );
          if (shell && (r.left < shell.left - 0.5 || r.right > shell.right + 0.5))
            wrong.push(`${name}: ${mark.getAttribute('class')} leaves the card`);
        }
        // the scale: its labels right-aligned on one column, 8 before the plot
        const ticks = [...svg.querySelectorAll('.fc-tick')].map(
          (t) => t.getBoundingClientRect().right,
        );
        if (ticks.length && Math.max(...ticks) - Math.min(...ticks) > 0.75)
          wrong.push(
            `${name}: the ticks are not on one column (${ticks.map((t) => t.toFixed(1)).join(' ')})`,
          );
        const left = ticks.length ? Number(svg.querySelector('.fc-tick').getAttribute('x')) + 8 : 0;
        // a style's bubble stays inside the plot; the classic one leans into the card's padding, inside the card
        const classic =
          !svg.classList.contains('fc-chart') ||
          ![...svg.classList].some((c) => c.startsWith('fc-chart--'));
        for (const bubble of wrapper.querySelectorAll(':scope > .fv-bubble')) {
          const r = bubble.getBoundingClientRect();
          const from = classic ? (shell?.left ?? box.left) : box.left + left;
          const to = classic ? (shell?.right ?? box.right) : box.right;
          if (r.left < from - 0.5 || r.right > to + 0.5)
            wrong.push(
              `${name}: the bubble ${r.left.toFixed(1)}…${r.right.toFixed(1)} leaves ${from.toFixed(1)}…${to.toFixed(1)}`,
            );
        }
        // the axis under it: the first label on the plot's start, the last ending on its end
        const axis = wrapper.parentElement?.querySelector(':scope .fv-axis');
        if (axis && axis.children.length) {
          const a = axis.getBoundingClientRect();
          const first = axis.firstElementChild.getBoundingClientRect();
          const last = axis.lastElementChild.getBoundingClientRect();
          if (Math.abs(a.left - (box.left + left)) > 0.75)
            wrong.push(
              `${name}: the axis starts at ${a.left.toFixed(1)}, the plot at ${(box.left + left).toFixed(1)}`,
            );
          if (Math.abs(first.left - a.left) > 0.75 || Math.abs(last.right - a.right) > 0.75)
            wrong.push(`${name}: the axis's ends are not flush`);
        }
      }
    }
    return { charts, wrong };
  });

/* ---------- every style, both modes: nothing leaves the plot, text placed by rule ---------- */
for (const mode of ['light', 'dark']) {
  const page = await suite.sheet('chart-styles', { extra: mode === 'dark' ? '&mode=dark' : '' });
  const { charts, wrong } = await audit(page);
  check(
    `${mode}: ${charts} charts — nothing leaves its plot, every mark whole, every word placed by rule`,
    charts >= 30 && wrong.length === 0,
    wrong.slice(0, 6).join(' | '),
  );
  // the house's soft style over every card that says none: the same rules hold
  await page.close();
  const soft = await suite.sheet('chart-styles', {
    extra: `${mode === 'dark' ? '&mode=dark' : ''}&charts=${encodeURIComponent('{"style":"soft","grid":"dashed","endpoint":"dot","bubble":"tone"}')}`,
  });
  const house = await audit(soft);
  const tiles = await frame(soft, 'Tiles · classic and minimal')
    .locator('fluvy-sensor-card')
    .first()
    .evaluate((card) => card.shadowRoot.querySelectorAll('.am-spark .curve-line').length);
  check(
    `${mode}, the house in soft: every rule holds, and a card that says classic keeps it`,
    house.wrong.length === 0 && tiles === 1,
    house.wrong.slice(0, 4).join(' | '),
  );
  await soft.close();
}

/* ---------- the forecast: the knob at now, the forecast dashed ---------- */
{
  const page = await suite.sheet('chart-styles');
  const sample = frame(page, 'Forecast · soft').locator('pg-chart-sample').first();
  const now = await sample.evaluate((card) => {
    const svg = card.shadowRoot.querySelector('svg.fc-chart');
    const box = svg.getBoundingClientRect();
    const line = svg.querySelector('.fc-now');
    const knob = card.shadowRoot.querySelector('.fv-knob').getBoundingClientRect();
    const future = svg.querySelector('.fc-future');
    return {
      line: box.left + Number(line.getAttribute('x1')),
      knob: knob.left + knob.width / 2,
      knobs: card.shadowRoot.querySelectorAll('.fv-knob').length,
      starts: Number(/^M([\d.]+)/.exec(future.getAttribute('d'))?.[1]) + box.left,
      dashes: getComputedStyle(future).strokeDasharray,
    };
  });
  check(
    'soft: one knob, Fluvy’s, centred on now’s hairline',
    now.knobs === 1 && Math.abs(now.knob - now.line) < 0.6,
    JSON.stringify(now),
  );
  check(
    'soft: the forecast starts at now, dashed 4 · 5',
    Math.abs(now.starts - now.line) < 0.6 && /^4(px)?,?\s*5(px)?$/.test(now.dashes),
    JSON.stringify(now),
  );
  const hollow = await frame(page, 'Forecast · bars')
    .locator('pg-chart-sample')
    .first()
    .evaluate((card) => card.shadowRoot.querySelectorAll('.fc-bar--hollow').length);
  check(
    'bars: the day’s energy an hour a bar, the forecast’s eight hollow',
    hollow === 8,
    String(hollow),
  );

  // the bars and columns samples are the day's energy: their scale is its own (about 2 kWh), not a temperature's
  for (const chart of ['bars', 'columns']) {
    const top = await frame(page, `Forecast · ${chart}`)
      .locator('pg-chart-sample')
      .first()
      .evaluate((card) =>
        Math.max(
          ...[...card.shadowRoot.querySelectorAll('.fc-tick')].map((t) => Number(t.textContent)),
        ),
      );
    check(
      `${chart}: the day’s energy on its own scale (top tick ${top} kWh)`,
      top > 1 && top <= 3,
      String(top),
    );
  }
  // the step sample: whole ticks of its own range, and no mark past now — the knob is the only ball there
  const stepped = await frame(page, 'Forecast · step')
    .locator('pg-chart-sample')
    .first()
    .evaluate((card) => {
      const svg = card.shadowRoot.querySelector('svg.fc-chart');
      const now = Number(svg.querySelector('.fc-now').getAttribute('x1'));
      return {
        ticks: [...svg.querySelectorAll('.fc-tick')].map((t) => t.textContent),
        past: [...svg.querySelectorAll('.curve-dot')].every(
          (dot) => Number(dot.getAttribute('cx')) <= now + 0.5,
        ),
      };
    });
  check(
    'step: its scale whole (16 · 18 · 20 · 22 · 24), no mark on the forecast',
    stepped.ticks.join(' ') === '16 18 20 22 24' && stepped.past,
    JSON.stringify(stepped),
  );

  /* ---------- reading by pointing, then by keys ---------- */
  const chart = sample.locator('.pg-chart');
  // a pointer reaches what is on screen: the frame is brought into view first
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + 80);
  await settle(page, 150);
  const read = await sample.evaluate((card) => {
    const bubble = card.shadowRoot.querySelector('.fv-bubble');
    const cursor = card.shadowRoot.querySelector('.fc-cursor');
    const svg = card.shadowRoot.querySelector('svg.fc-chart').getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    return {
      time: bubble.querySelector('.fv-bubble__time')?.textContent ?? '',
      cursor: cursor ? svg.left + Number(cursor.getAttribute('x1')) : null,
      centre: b.left + b.width / 2,
    };
  });
  check(
    'pointing at a quarter of the day: the cursor is there, the bubble centred on it says when',
    read.time === '06:00' &&
      read.cursor !== null &&
      Math.abs(read.cursor - (box.x + box.width * 0.25)) < 1 &&
      Math.abs(read.centre - read.cursor) < 1,
    JSON.stringify(read),
  );
  await page.mouse.move(0, 0);
  await chart.focus();
  const cursorAt = () =>
    sample.evaluate((card) => {
      const cursor = card.shadowRoot.querySelector('.fc-cursor');
      return cursor ? Number(cursor.getAttribute('x1')) : null;
    });
  await page.keyboard.press('ArrowLeft');
  await settle(page, 100);
  const left = await cursorAt();
  await page.keyboard.press('Home');
  await settle(page, 100);
  const home = await cursorAt();
  await page.keyboard.press('Escape');
  await settle(page, 100);
  const gone = await cursorAt();
  check(
    'the keys read it: ← a step back from now’s end, Home its start, Escape lets it go',
    left !== null && Math.abs(left - box.width * 0.98) < 1 && home === 0 && gone === null,
    JSON.stringify({ left, home, gone, width: box.width }),
  );

  /* the sensor reads the same way: its knob and its bubble follow the pointer */
  const soft = frame(page, 'Style · soft').locator('fluvy-sensor-card').first();
  await soft.locator('.am-chart').scrollIntoViewIfNeeded();
  const plot = await soft.locator('.am-chart').boundingBox();
  await page.mouse.move(plot.x + plot.width / 2, plot.y + 80);
  await settle(page, 150);
  const sensor = await soft.evaluate((card) => {
    const knob = card.shadowRoot.querySelector('.am-chart .fv-knob').getBoundingClientRect();
    return {
      knob: knob.left + knob.width / 2,
      time: card.shadowRoot.querySelector('.am-chart .fv-bubble__time')?.textContent ?? '',
    };
  });
  check(
    'the sensor in soft: read at its middle, the knob moves there and the bubble says when',
    Math.abs(sensor.knob - (plot.x + plot.width / 2)) < 1 && /\d{2}:\d{2}/.test(sensor.time),
    JSON.stringify(sensor),
  );
  await page.close();
}

/* ---------- the scale of a measurement, a meter's bars, the gauges' knobs ---------- */
{
  const page = await suite.sheet('chart-styles');
  const ticks = (title, tag = 'fluvy-sensor-card') =>
    frame(page, title)
      .locator(tag)
      .first()
      .evaluate((card) =>
        [...card.shadowRoot.querySelectorAll('.fc-tick')].map((t) => t.textContent),
      );
  const step = await ticks('Style · step');
  check(
    'a stepped temperature reads on its own range, not from zero (16 · 18 · 20 · 22 · 24)',
    step.join(' ') === '16 18 20 22 24',
    step.join(' '),
  );
  const bars = await frame(page, 'Style · bars')
    .locator('fluvy-sensor-card')
    .first()
    .evaluate((card) => ({
      bars: card.shadowRoot.querySelectorAll('.am-chart .fc-bar').length,
      floor: Number(card.shadowRoot.querySelector('.fc-tick')?.textContent),
    }));
  check(
    'a meter’s day in bars: 24, an hour each, on a scale from zero',
    bars.bars === 24 && bars.floor === 0,
    JSON.stringify(bars),
  );
  // the gridlines a card asks for, on a style whose own are vertical: the quarters, the ticks, or both
  const grids = await frame(page, 'Grid · vertical, horizontal, both')
    .locator('fluvy-sensor-card')
    .evaluateAll((cards) =>
      cards.map((card) => {
        const lines = [...card.shadowRoot.querySelectorAll('.am-chart .fc-grid')];
        const down = lines.filter((l) => l.getAttribute('x1') === l.getAttribute('x2')).length;
        const ticks = card.shadowRoot.querySelectorAll('.am-chart .fc-tick').length;
        return [down, lines.length - down, ticks];
      }),
    );
  const [x, y, both] = grids;
  check(
    'soft’s gridlines as asked: x the five quarters, y a line at every tick, both the two',
    grids.length === 3 &&
      x[0] === 5 &&
      x[1] === 0 &&
      y[0] === 0 &&
      y[1] > 1 &&
      y[1] === y[2] &&
      both[0] === 5 &&
      both[1] === both[2],
    JSON.stringify(grids),
  );
  // every gauge's knob is the thermostat's ball: its dot, its lift — never the read-only marker
  const knobs = await page.evaluate(() => {
    const out = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.matches('.fv-knob')) out.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    for (const gauge of document.querySelectorAll('pg-chart-gauge')) walk(gauge.shadowRoot);
    return out.map((knob) => ({
      marker: knob.classList.contains('fv-knob--marker'),
      dot: getComputedStyle(knob, '::after').display !== 'none',
      // its ring, its lift and its halo: three shadows
      lift: (getComputedStyle(knob).boxShadow.match(/(rgba?|color|oklch)\(/g) ?? []).length >= 3,
    }));
  });
  check(
    `every gauge’s knob (${knobs.length}) is Fluvy’s whole knob: its dot and its lift, no marker`,
    knobs.length >= 6 && knobs.every((k) => !k.marker && k.dot && k.lift),
    JSON.stringify(knobs.filter((k) => k.marker || !k.dot || !k.lift)),
  );
  // the read dial in a tile: the reading whole inside the disc, the knob only touching its rim
  const tile = await frame(page, 'Gauge · dial')
    .locator('pg-chart-gauge')
    .first()
    .evaluate((card) => {
      const dial = card.shadowRoot.querySelector('fluvy-dial').shadowRoot;
      const disc = dial.querySelector('.fv-dial__disc').getBoundingClientRect();
      const value = dial.querySelector('.fv-dial__value').getBoundingClientRect();
      const knob = dial.querySelector('.fv-knob').getBoundingClientRect();
      const centre = (r) => [r.left + r.width / 2, r.top + r.height / 2];
      const [dx, dy] = centre(disc);
      const [kx, ky] = centre(knob);
      const r = disc.width / 2;
      // every corner of the reading's line inside the disc's circle
      const inside = [
        [value.left, value.top],
        [value.right, value.top],
        [value.left, value.bottom],
        [value.right, value.bottom],
      ].every(([x, y]) => Math.hypot(x - dx, y - dy) <= r + 0.5);
      return {
        inside,
        apart: Math.hypot(kx - dx, ky - dy) - r - knob.width / 2,
        disc: disc.width,
        knob: knob.width,
      };
    });
  check(
    'the read dial in a tile: its reading whole inside the disc, its knob touching the rim and no more',
    tile.inside && tile.apart >= -2,
    JSON.stringify(tile),
  );
  await page.close();
}

/* ---------- the cards that take the styles, under the house's soft ---------- */
{
  /** A sheet under a house whose chart settings are `charts`: its cards say no style, so they draw the house's. */
  const housed = (name, charts, extra = '') =>
    suite.sheet(name, { extra: `${extra}&charts=${encodeURIComponent(JSON.stringify(charts))}` });
  /** What a card of a frame holds, by selector: how many there are of each. */
  const count = (page, title, tag, selectors) =>
    frame(page, title)
      .locator(tag)
      .first()
      .evaluate(
        (card, sels) => sels.map((sel) => card.shadowRoot.querySelectorAll(sel).length),
        selectors,
      );
  const SOFT = { style: 'soft' };
  for (const mode of ['light', 'dark']) {
    const dark = mode === 'dark' ? '&mode=dark' : '';
    // the energy card's line, the production card's day: the engine's drawing, every rule held
    for (const name of ['energy', 'flow', 'solar', 'arrays', 'history-bars']) {
      const page = await housed(name, SOFT, dark);
      const { charts, wrong } = await audit(page);
      check(
        `${mode}, ${name} under the house's soft: ${charts} charts — nothing leaves its plot, every word placed by rule`,
        wrong.length === 0,
        wrong.slice(0, 4).join(' | '),
      );
      await page.close();
    }
  }
  const energy = await housed('energy', SOFT);
  const [line, glow, knob] = await count(energy, 'Energy', 'fluvy-energy-card', [
    '.ef-chart .fc-line',
    '.ef-chart .fc-glow',
    '.ef-chart .fv-knob',
  ]);
  check(
    'energy under the house’s soft: its line soft, its copy under it, Fluvy’s knob at now',
    line === 1 && glow === 1 && knob === 1,
    JSON.stringify({ line, glow, knob }),
  );
  await energy.close();
  const flow = await housed('flow', SOFT);
  const [soft, hairlines, dashes] = await count(
    flow,
    'Issue #49 · the whole house, scaled',
    'fluvy-energy-card',
    ['.en-chart.is-soft', '.en-chart .fc-grid', '.en-chart .ax-grid'],
  );
  check(
    'a stacked chart under the house’s soft: lighter fills, hairlines in place of the dashes',
    soft === 1 && hairlines > 0 && dashes === 0,
    JSON.stringify({ soft, hairlines, dashes }),
  );
  await flow.close();
  const solar = await housed('solar', SOFT);
  const [bars, quiet, hollow, so] = await count(solar, 'Production', 'fluvy-production-card', [
    '.pr-chart .fc-bar',
    '.pr-chart .fc-bar--quiet',
    '.pr-chart .fc-bar--hollow',
    '.so-bars',
  ]);
  const [stack] = await count(solar, 'Distribution', 'fluvy-distribution-card', [
    '.fv-stack.is-soft',
  ]);
  const [rows] = await count(solar, 'Strings & inverter', 'fluvy-bars-card', ['.so-rows.is-soft']);
  check(
    'production, the distribution and the bars under the house’s soft: an hour a bar, the best lit and the forecast hollow; pills; deepening bars',
    hollow > 0 && quiet === bars - hollow - 1 && so === 0 && stack === 1 && rows === 1,
    JSON.stringify({ bars, quiet, hollow, so, stack, rows }),
  );
  await solar.close();
  // a style a card does not draw is its classic: soft is neither the history bars' nor the arrays'
  const history = await housed('history-bars', SOFT);
  const [gradient] = await count(history, 'Solar production', 'fluvy-history-bars-card', [
    'linearGradient',
  ]);
  await history.close();
  const arrays = await housed('arrays', SOFT);
  const [ramp] = await count(arrays, 'Two arrays', 'fluvy-production-card', ['rect.en-bar']);
  await arrays.close();
  check(
    'under the house’s soft the history bars and the arrays keep their classic: soft is not theirs',
    gradient > 0 && ramp > 0,
    JSON.stringify({ gradient, ramp }),
  );
  // the gauges: the house's ring on the gauge card, the house's ruler on the humidity
  const gauges = await housed('solar', { gauge: 'ring' });
  const [lit, ticks] = await count(gauges, 'Solar power', 'fluvy-gauge-card', [
    '.fc-ring__lit',
    'fluvy-dial[gauge]',
  ]);
  // seen and still: no moving gauge's rule reaches the ring (the pulse's rings once shared its name and hid it)
  const ring = await frame(gauges, 'Solar power')
    .locator('fluvy-gauge-card')
    .first()
    .evaluate((card) => {
      const look = getComputedStyle(card.shadowRoot.querySelector('.fc-gauge.fc-ring'));
      return `${look.opacity} ${look.animationName}`;
    });
  await gauges.close();
  const ruler = await housed('solar', { gauge: 'ruler' });
  const [read, marker] = await count(ruler, 'Humidity', 'fluvy-humidity-card', [
    'fluvy-ruler[readonly]',
    'fluvy-ruler[marker]',
  ]);
  await ruler.close();
  check(
    'the house’s ring on the gauge card, seen and still, its ruler read lit on the humidity',
    lit === 1 && ticks === 0 && ring === '1 none' && read === 1 && marker === 0,
    JSON.stringify({ lit, ticks, ring, read, marker }),
  );
  // the History page follows the house: its lines the engine's, every rule held
  const page = await suite.page(
    `history=1&live=0&at=2026-09-17T21:47:12&charts=${encodeURIComponent(JSON.stringify(SOFT))}`,
  );
  await page.waitForFunction(
    () => document.querySelector('fluvy-history')?.shadowRoot?.querySelector('.fc-chart') !== null,
  );
  const drawn = await audit(page);
  const classic = await page.evaluate(
    () => document.querySelector('fluvy-history').shadowRoot.querySelectorAll('.hs-line').length,
  );
  check(
    `the History page follows the house’s soft: ${drawn.charts} charts the engine’s, every rule held`,
    drawn.charts > 0 && classic === 0 && drawn.wrong.length === 0,
    drawn.wrong.slice(0, 4).join(' | '),
  );
  await page.close();
}

/* ---------- a house's own set of series colours, worn fitted to each mode's card ---------- */
{
  // a navy, too deep for a dark card, and a cream, too pale for a light one: the arrays' columns wear them
  const SET = ['#1e3a8a', '#f4e9d0', '#15803d', '#b91c1c', '#7e22ce', '#0f766e'];
  const charts = {
    style: 'columns',
    series: 'mine',
    sets: [{ id: 'mine', name: 'Mine', colours: SET }],
  };
  const worn = {};
  for (const mode of ['light', 'dark']) {
    const page = await suite.sheet('arrays', {
      extra: `${mode === 'dark' ? '&mode=dark' : ''}&charts=${encodeURIComponent(JSON.stringify(charts))}`,
    });
    worn[mode] = await frame(page, 'Two arrays')
      .locator('fluvy-production-card')
      .first()
      .evaluate((card) => {
        const luminance = (css) => {
          const [r, g, b] = (
            css.startsWith('#')
              ? css
                  .slice(1)
                  .match(/../g)
                  .map((h) => parseInt(h, 16))
              : css.match(/\d+/g)
          ).map((v) => {
            const c = Number(v) / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ground = luminance(getComputedStyle(card).getPropertyValue('--fluvy-card').trim());
        const read = (el, property) => {
          const colour = getComputedStyle(el)[property];
          const [hi, lo] = [luminance(colour), ground].sort((a, b) => b - a);
          return { colour, contrast: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 };
        };
        const root = card.shadowRoot;
        // each hour's segments, an array's colour each: the arrays' colours in their order (the hollow forecast aside)
        const columns = new Map();
        for (const bar of root.querySelectorAll(
          '.pr-chart g.fc-set .fc-bar:not(.fc-bar--hollow)',
        )) {
          const seen = read(bar, 'fill');
          if (!columns.has(seen.colour)) columns.set(seen.colour, seen);
        }
        return {
          columns: [...columns.values()],
          squares: [...root.querySelectorAll('.pr-legend .en-sq.fc-set')].map((square) =>
            read(square, 'backgroundColor'),
          ),
        };
      });
    await page.close();
  }
  const [navy, cream] = ['rgb(30, 58, 138)', 'rgb(244, 233, 208)'];
  const { light, dark } = worn;
  check(
    'a house’s set worn fitted to each mode: the navy as picked on the light card and lifted to read on the dark one, the cream the other way round',
    light.columns.length === 2 &&
      light.columns[0].colour === navy &&
      light.columns[1].colour !== cream &&
      light.columns[1].contrast >= 3 &&
      dark.columns[0].colour !== navy &&
      dark.columns[0].contrast >= 3 &&
      dark.columns[1].colour === cream,
    JSON.stringify({ light: light.columns, dark: dark.columns }),
  );
  check(
    'the legend’s squares wear their columns’ colours, in each mode',
    ['light', 'dark'].every(
      (mode) =>
        JSON.stringify(worn[mode].squares.map((s) => s.colour)) ===
        JSON.stringify(worn[mode].columns.map((c) => c.colour)),
    ),
    JSON.stringify({ light: light.squares, dark: dark.squares }),
  );
}

/* ---------- a house's set that names the palette's colours follows the palette ---------- */
{
  // the two arrays wear the palette's third series colour and its solar, whatever the palette is
  const TOKENS = ['--fluvy-graph-3', '--fluvy-state-energy-solar'];
  const charts = {
    style: 'columns',
    series: 'ours',
    sets: [
      {
        id: 'ours',
        name: 'Ours',
        colours: ['graph-3', 'solar', 'graph-1', 'graph-2', 'graph-4', 'graph-5'],
      },
    ],
  };
  const worn = {};
  for (const palette of ['sage', 'volt']) {
    const page = await suite.sheet('arrays', {
      extra: `&palette=${palette}&charts=${encodeURIComponent(JSON.stringify(charts))}`,
    });
    worn[palette] = await frame(page, 'Two arrays')
      .locator('fluvy-production-card')
      .first()
      .evaluate((card, tokens) => {
        // the page's look says what each token is: its hex as the browser writes a colour
        const rgb = (hex) =>
          `rgb(${hex
            .trim()
            .slice(1)
            .match(/../g)
            .map((h) => parseInt(h, 16))
            .join(', ')})`;
        const style = getComputedStyle(card);
        const root = card.shadowRoot;
        const columns = [];
        for (const bar of root.querySelectorAll('.pr-chart .fc-bar:not(.fc-bar--hollow)')) {
          const fill = getComputedStyle(bar).fill;
          if (!columns.includes(fill)) columns.push(fill);
        }
        return {
          tokens: tokens.map((token) => rgb(style.getPropertyValue(token))),
          columns,
          squares: [...root.querySelectorAll('.pr-legend .en-sq')].map(
            (square) => getComputedStyle(square).backgroundColor,
          ),
        };
      }, TOKENS);
    await page.close();
  }
  check(
    'a house’s set that names the palette’s colours wears each palette’s own: Sage’s on Sage, Volt’s on Volt, the columns and their squares',
    ['sage', 'volt'].every(
      (palette) =>
        JSON.stringify(worn[palette].columns) === JSON.stringify(worn[palette].tokens) &&
        JSON.stringify(worn[palette].squares) === JSON.stringify(worn[palette].tokens),
    ) && worn.sage.tokens.every((colour, n) => colour !== worn.volt.tokens[n]),
    JSON.stringify(worn),
  );
}

/* ---------- the moving gauges: running when on, still when off, nothing out of its box, text placed ---------- */
{
  /**
   * Every moving gauge of the page, read where it is drawn: its box, what of it leaves the box, its reading's place
   * (a box's in its larger part, clear of the waves and of the weather's every sweep; a mark's centred under it) and
   * its running animations — what each moves, and whether it is filtered.
   */
  const scenes = (page) =>
    page.evaluate(() => {
      const out = [];
      const rect = (el) => el.getBoundingClientRect();
      const meets = (a, b) =>
        a.left < b.right - 0.5 &&
        b.left < a.right - 0.5 &&
        a.top < b.bottom - 0.5 &&
        b.top < a.bottom - 0.5;
      const inside = (a, b) =>
        a.left >= b.left - 0.5 &&
        a.right <= b.right + 0.5 &&
        a.top >= b.top - 0.5 &&
        a.bottom <= b.bottom + 0.5;
      const px = (el, name) => parseFloat(el.style.getPropertyValue(name)) || 0;
      for (const host of document.querySelectorAll('[data-frame] > *')) {
        const scene = host.shadowRoot?.querySelector('.fc-scene');
        if (!scene) continue;
        const box = rect(scene);
        const reading = scene.querySelector('.fc-reading');
        const read = reading ? rect(reading) : null;
        const wrong = [];
        if (read && !inside(read, box)) wrong.push('its reading leaves its box');
        // a mark's drawing inside the box, the reading centred under it
        if (scene.classList.contains('fc-scene--mark')) {
          const art = scene.firstElementChild;
          if (!inside(rect(art), box)) wrong.push('its drawing leaves its box');
          const centre = (r) => r.left + r.width / 2;
          if (read && Math.abs(centre(read) - centre(box)) > 1)
            wrong.push('its reading off centre');
          if (read && read.top < rect(art).bottom - 0.5) wrong.push('its reading over its drawing');
        }
        // the water: the reading clear of the waves' reach (the first wave's crest to its trough)
        const wave = scene.querySelector('.fc-water__back');
        if (wave && read) {
          const [, line] = /^M[-\d.]+,([-\d.]+)/.exec(wave.getAttribute('d'));
          const top = rect(scene.querySelector('svg')).top;
          const amp = Number(line) - wave.getBBox().y;
          const reach = {
            left: box.left,
            right: box.right,
            top: top + Number(line) - amp,
            bottom: top + Number(line) + amp,
          };
          if (meets(read, reach)) wrong.push('its reading across the waterline');
        }
        // the sky: the reading clear of every part of the weather, through all its motion
        if (scene.classList.contains('fc-sky') && read) {
          const parts = [
            ...[
              ...scene.querySelectorAll(
                '.fc-sky__halo, .fc-sky__rays, .fc-sky__sun, .fc-sky__cactus',
              ),
            ].map(rect),
            // a flake down its fall, the cloud across its drift, the haze up its rise
            ...[...scene.querySelectorAll('.fc-snow')].map((g) => {
              const r = rect(g);
              return {
                left: r.left - 6,
                right: r.right + 6,
                top: r.top,
                bottom: r.bottom + px(g, '--fall'),
              };
            }),
            ...[...scene.querySelectorAll('.fc-drift')].map((g) => {
              const r = rect(g);
              return {
                left: r.left,
                right: r.right + px(g, '--span'),
                top: r.top,
                bottom: r.bottom,
              };
            }),
            ...[...scene.querySelectorAll('.fc-haze')].map((p) => {
              const r = rect(p);
              return {
                left: r.left,
                right: r.right,
                top: r.top + px(p, '--rise'),
                bottom: r.bottom,
              };
            }),
          ];
          if (parts.some((part) => meets(read, part))) wrong.push('its reading across the weather');
        }
        const running = scene
          .getAnimations({ subtree: true })
          .filter((a) => a.playState === 'running');
        const moved = new Set(
          running.flatMap((a) =>
            a.effect
              .getKeyframes()
              .flatMap((k) =>
                Object.keys(k).filter(
                  (p) => !['offset', 'computedOffset', 'easing', 'composite'].includes(p),
                ),
              ),
          ),
        );
        const filtered = running.some(
          (a) =>
            a.effect.target.closest('[filter]') ||
            getComputedStyle(a.effect.target).filter !== 'none',
        );
        out.push({
          frame: host.closest('[data-frame]').dataset.frame,
          kind: [...scene.classList].find((c) => /^fc-(water|sky|battery|pulse|air|sun)$/.test(c)),
          running: running.length,
          moved: [...moved],
          filtered,
          wrong,
        });
      }
      return out;
    });
  const named = (list) =>
    list.map((s) => `${s.frame} ${s.kind}: ${s.wrong.join(', ') || s.moved.join(' ')}`);
  for (const mode of ['light', 'dark']) {
    const page = await suite.sheet('animated', { extra: mode === 'dark' ? '&mode=dark' : '' });
    const all = await scenes(page);
    const moving = all.filter((s) =>
      /\/Moving · (liquid|thermo|tank|battery|pulse|air|sun|tiles)$/.test(s.frame),
    );
    check(
      `${mode}: every moving gauge (${moving.length}) runs, moving only transform, opacity and the dash offset, unfiltered`,
      moving.length >= 28 &&
        moving.every((s) => s.running > 0 && !s.filtered) &&
        all.every((s) =>
          s.moved.every((p) => ['transform', 'opacity', 'strokeDashoffset'].includes(p)),
        ),
      named(moving.filter((s) => !s.running || s.filtered))
        .slice(0, 4)
        .join(' | '),
    );
    const wrong = all.filter((s) => s.wrong.length);
    check(
      `${mode}: nothing leaves its box, the reading placed by rule — never across the water or the weather (${all.length})`,
      all.length >= 40 && wrong.length === 0,
      named(wrong).slice(0, 4).join(' | '),
    );
    const resting = all.filter((s) => /out of reach|still$/.test(s.frame));
    check(
      `${mode}: told not to move, or out of reach, a gauge rests on its first frame (${resting.length})`,
      resting.length >= 14 && resting.every((s) => s.running === 0),
      named(resting.filter((s) => s.running))
        .slice(0, 4)
        .join(' | '),
    );
    await page.close();
  }
  // out of reach keeps its size in a half card (the owner's rule): each tile as tall as its twin out of reach and
  // unrecorded, its window's row one a row whatever its figures say
  const twins = [];
  for (const width of [152, 172]) {
    const page = await suite.sheet('animated', { width: 2 * width + 16 });
    const heights = (title) =>
      frame(page, title)
        .locator('fluvy-gauge-card')
        .evaluateAll((cards) =>
          cards.map((card) =>
            Math.round(card.shadowRoot.querySelector('[data-card]').getBoundingClientRect().height),
          ),
        );
    const live = await heights('Moving · tiles');
    const away = await heights('Moving · out of reach');
    if (live.length < 7 || live.some((h, i) => h !== away[i]))
      twins.push(`${width}: ${live.join(' ')} · out of reach ${away.join(' ')}`);
    await page.close();
  }
  check(
    'in a half card (152, 172) each moving gauge is as tall as its twin out of reach',
    twins.length === 0,
    twins.join(' | '),
  );
  // and from the full card's floor to a phone, where the window's row takes as many columns as hold it: every gauge of
  // the sheet, moving and on the plain ring, the bar and the signed ring, one height at its low, middle and high values
  // and out of reach and unrecorded — laid out by what it can write, never by what it writes now
  const apart = [];
  for (const lang of ['en', 'de', 'ja', 'pt-PT']) {
    const page = await suite.page(`sheet=animated&lang=${lang}&frames=none`, {
      viewport: { width: 1600, height: 1200 },
    });
    // measured at rest: a card mid-way through its entrance (a scale) is not its height
    await page.emulateMedia({ reducedMotion: 'reduce' });
    apart.push(
      ...(
        await page.evaluate(async () => {
          const cards = [];
          // each gauge's frame: its first card on the low value
          const gauges = window.fluvySheets.animated.frames
            .map((f) => f.cards[0])
            .filter((c) => c.type === 'custom:fluvy-gauge-card' && c.entity.endsWith('_low'));
          for (const width of [211, 266, 328, 360])
            for (const config of gauges)
              for (const [variant, gauge] of [
                ['ring', config.gauge],
                ['ring', 'ticks'],
                ['bar', 'ticks'],
                ['signed', 'ticks'],
              ])
                for (const level of ['low', 'mid', 'high', 'away']) {
                  const box = document.createElement('div');
                  box.style.width = `${width}px`;
                  const card = document.createElement('fluvy-gauge-card');
                  card.setConfig({
                    ...config,
                    entity: config.entity.replace(/_low$/, `_${level}`),
                    variant,
                    gauge,
                  });
                  card.hass = window.fluvyMock.hass();
                  box.append(card);
                  document.getElementById('stage').append(box);
                  cards.push({ card, key: `${width} ${variant}/${gauge} ${config.gauge}` });
                }
          await new Promise((done) => setTimeout(done, 1500));
          const by = new Map();
          for (const { card, key } of cards) {
            const h = card.shadowRoot.querySelector('[data-card]').getBoundingClientRect().height;
            by.set(key, [...(by.get(key) ?? []), Math.round(h)]);
          }
          return [...by]
            .filter(([, hs]) => new Set(hs).size > 1)
            .map(([k, hs]) => `${k}: ${hs.join('/')}`);
        })
      ).map((line) => `${lang} ${line}`),
    );
    await page.close();
  }
  check(
    'from 211 to a phone, in four languages, every gauge (moving and plain; ring, bar, signed) is one height low, mid, high and out of reach',
    apart.length === 0,
    apart.slice(0, 6).join(' | '),
  );
  // the house's motion off, and a system that asks for less: every gauge on its first frame
  const off = await suite.sheet('animated', {
    extra: `&charts=${encodeURIComponent(JSON.stringify({ animate: false }))}`,
  });
  const still = await scenes(off);
  check(
    `the house’s motion off: every gauge (${still.length}) rests on its first frame, its rules held`,
    still.length >= 40 && still.every((s) => s.running === 0 && !s.wrong.length),
    named(still.filter((s) => s.running || s.wrong.length))
      .slice(0, 4)
      .join(' | '),
  );
  await off.close();
  const reduced = await suite.sheet('animated');
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await settle(reduced);
  const calm = await scenes(reduced);
  check(
    `reduced motion: every gauge (${calm.length}) rests on its first frame`,
    calm.length >= 40 && calm.every((s) => s.running === 0),
    named(calm.filter((s) => s.running))
      .slice(0, 4)
      .join(' | '),
  );
  // the waves rest as waves, never a flat line: still a crest above the line
  const crest = await reduced.evaluate(() => {
    const card = [...document.querySelectorAll('[data-frame$="Moving · liquid"] > *')][1];
    const wave = card.shadowRoot.querySelector('.fc-water__back');
    const [, line] = /^M[-\d.]+,([-\d.]+)/.exec(wave.getAttribute('d'));
    return Number(line) - wave.getBBox().y;
  });
  check(
    'at rest the liquid is still a wave, its crests 7 over the line',
    Math.abs(crest - 7) < 0.5,
    String(crest),
  );
  await reduced.close();
}

/* ---------- no flash: the built bundle, the engine's chunk 1.5 s late ---------- */
{
  const FRONTEND = join(ROOT, 'custom_components', 'fluvy', 'frontend');
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div id="stage" style="width:360px"></div><script type="module" src="/fluvy.js"></script></body></html>',
      );
      return;
    }
    try {
      const body = await readFile(
        join(FRONTEND, normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')),
      );
      response.writeHead(200, {
        'content-type':
          extname(url.pathname) === '.js' ? 'text/javascript' : 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const page = await suite.browser.newPage({ viewport: { width: 600, height: 600 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.route(/\/chunks\/chart-[\w-]{8}\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.customElements.get('fluvy-sensor-card') !== undefined);
  const seen = await page.evaluate(
    (values) =>
      new Promise((resolve) => {
        const card = document.createElement('fluvy-sensor-card');
        card.setConfig({ type: 'custom:fluvy-sensor-card', entity: 'sensor.room' });
        card.hass = {
          language: 'en',
          locale: { language: 'en', number_format: 'language', time_format: '24' },
          config: {},
          themes: { darkMode: false },
          entities: {},
          devices: {},
          areas: {},
          localize: (key) => key,
          states: {
            'sensor.room': {
              entity_id: 'sensor.room',
              state: String(values[values.length - 1]),
              attributes: {
                friendly_name: 'Room',
                unit_of_measurement: '°C',
                device_class: 'temperature',
              },
              last_changed: '',
              last_updated: '',
            },
          },
          callWS: async (message) => {
            const start = Date.parse(message.start_time);
            const end = Date.parse(message.end_time);
            return {
              'sensor.room': values.map((v, i) => ({
                s: String(v),
                lu: (start + ((i + 0.5) / 48) * (end - start)) / 1000,
              })),
            };
          },
          callService: async () => undefined,
        };
        document.querySelector('#stage').append(card);
        // every state the chart's room passes through, and every curve drawn into it
        const states = [];
        let curves = 0;
        const look = () => {
          const room = card.shadowRoot?.querySelector('.am-chart');
          const state = !room
            ? 'none'
            : room.querySelector('.curve-line')
              ? 'curve'
              : room.querySelector('.fv-skeleton')
                ? 'skeleton'
                : 'empty';
          if (states[states.length - 1] !== state) states.push(state);
        };
        const watch = new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (
                node.nodeType === 1 &&
                (node.matches?.('.curve-line') || node.querySelector?.('.curve-line'))
              )
                curves++;
          look();
        });
        const begin = () => {
          if (!card.shadowRoot) return requestAnimationFrame(begin);
          look();
          watch.observe(card.shadowRoot, { childList: true, subtree: true });
        };
        begin();
        setTimeout(() => {
          watch.disconnect();
          resolve({ states, curves });
        }, 2600);
      }),
    fixtures.inputs.TEMP,
  );
  check(
    'no flash: the skeleton stands until the engine lands 1.5 s late, then the curve, drawn once',
    JSON.stringify(seen.states.filter((s) => s !== 'none')) === '["skeleton","curve"]' &&
      seen.curves === 1 &&
      errors.length === 0,
    JSON.stringify({ ...seen, errors }),
  );
  await page.close();
  server.close();
}

await suite.finish();
