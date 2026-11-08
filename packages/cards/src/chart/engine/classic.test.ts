// @vitest-environment happy-dom
import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import { RING, ringRadius } from '../../score/rings.js';
import fixtures from './__fixtures__/classic-1.10.json' with { type: 'json' };
import { barGeometry, barPath } from './bars.js';
import { drawChart, type ChartSpec } from './draw.js';
import { areaPath, bandPath, linePath, yAt, type Pt } from './path.js';
import { resolveStyle } from './presets.js';
import { arcDash, signedTicks } from './ring.js';
import { airScale, niceStep, niceTicks, yOf, type PlotBox, type Scale } from './scale.js';

/**
 * The classic chart is 1.10's, string for string: what `ui/src/chart.ts`, `history-bars/scale.ts`, `score/rings.ts`
 * and `gauge/signed.ts` drew on fixed inputs (`__fixtures__/classic-1.10.json`, recorded before the engine replaced
 * them), drawn again by the engine as the cards now draw it. A card that says `chart: classic`, and every card while
 * the house keeps its factory style, draws exactly what it drew.
 */

const { TEMP, HUM, POWER, SPARK, low, high } = fixtures.inputs;
const classic = resolveStyle('classic', {}, {});

/** The drawing as a card renders it: every path's `d` by class, the dot, the cursor. */
function drawn(spec: Omit<ChartSpec, 'style'>): {
  lines: string[];
  areas: string[];
  dot: { cx: number; cy: number } | null;
  cursor: { x: number; y1: number; y2: number } | null;
} {
  const host = document.createElement('div');
  render(drawChart({ ...spec, style: classic }), host);
  const all = (selector: string): Element[] => [...host.querySelectorAll(selector)];
  const dot = host.querySelector('.curve-dot');
  const cursor = host.querySelector('.curve-cursor');
  return {
    lines: all('.curve-line').map((el) => el.getAttribute('d') ?? ''),
    areas: all('.curve-area').map((el) => el.getAttribute('d') ?? ''),
    dot: dot ? { cx: Number(dot.getAttribute('cx')), cy: Number(dot.getAttribute('cy')) } : null,
    cursor: cursor
      ? {
          x: Number(cursor.getAttribute('x1')),
          y1: Number(cursor.getAttribute('y1')),
          y2: Number(cursor.getAttribute('y2')),
        }
      : null,
  };
}

describe('the lone classic curve (the sensor, the energy card, the tile’s spark)', () => {
  const cases = [
    ['sensor', TEMP, { width: 320, height: 120, headroom: 44 }, {}],
    ['energy', POWER, { width: 320, height: 120, headroom: 44 }, { extent: 0.908, cursor: 0.5 }],
    ['spark', SPARK, { width: 132, height: 24, headroom: 4, pad: 4 }, {}],
    ['flat', [5, 5, 5], { width: 300, height: 100, headroom: 10, pad: 10 }, {}],
    ['two', [0, 10], { width: 320, height: 120, headroom: 8, pad: 8 }, { extent: 0.5 }],
  ] as const;

  it.each(cases)(
    '%s: its line and its area are 1.10’s, byte for byte',
    (name, values, frame, more) => {
      const want = fixtures.curveGeometry[name];
      const got = drawn({ frame, series: [{ values }], id: 'fv', ...more });
      expect(got.lines).toEqual([want.line]);
      expect(got.areas).toEqual([want.area]);
    },
  );

  it.each(cases)(
    '%s: its cursor and its dot stand where 1.10 put them',
    (name, values, frame, more) => {
      const want = fixtures.curveGeometry[name];
      const got = drawn({ frame, series: [{ values }], id: 'fv', ...more });
      expect(got.cursor?.x).toBeCloseTo(want.cursorX, 9);
      expect(got.cursor?.y2).toBe(frame.height);
      expect(got.dot?.cx).toBeCloseTo(want.cursorX, 2);
      // at rest the dot is the line's end; read, it stands on the drawn curve, within a pixel of the chord between two
      // samples that 1.10 read (where the curve swells past them, the dot now stays on it)
      const near = 'cursor' in more ? 1 : 0.005;
      expect(Math.abs((got.dot?.cy ?? 0) - want.cursorY)).toBeLessThan(near);
      expect(Math.abs((got.cursor?.y1 ?? 0) - Math.max(want.top, want.cursorY + 7))).toBeLessThan(
        near,
      );
    },
  );
});

describe('several classic curves, each on its own scale (the sensor and the sensors beside it)', () => {
  const frame = { width: 320, height: 88, headroom: 12 };
  const got = drawn({
    frame,
    series: [{ values: TEMP }, { values: HUM }],
    scale: 'own',
    id: 'am',
    className: 'am-multi',
  });

  it('draws each line as 1.10 did', () => {
    expect(got.lines).toEqual([fixtures.seriesPath.sensorSmooth, fixtures.seriesPath.humSmooth]);
  });

  it('closes the first one’s area as 1.10 did', () => {
    expect(got.areas[0]).toBe(fixtures.areaUnder.sensor);
  });

  it('puts each line on the scale 1.10 gave it', () => {
    expect(airScale([TEMP])).toEqual(fixtures.plotScale.several);
    expect(airScale([HUM])).toEqual(fixtures.plotScale.severalHum);
  });
});

describe('the History page’s plot, drawn from the engine’s paths', () => {
  const box: PlotBox = { top: 44, bottom: 156 };
  const pointsOf = (values: readonly number[], scale: Scale): Pt[] =>
    values.map((v, i) => [(i / (values.length - 1)) * 320, yOf(v, scale, box)]);
  const history = airScale([TEMP, HUM]);
  const points = pointsOf(TEMP, history);

  it('scales, smooths and steps its series as 1.10 did', () => {
    expect(history).toEqual(fixtures.plotScale.history);
    expect(linePath(points, 'smooth')).toBe(fixtures.seriesPath.historySmooth);
    expect(linePath(points, 'step')).toBe(fixtures.seriesPath.historyStep);
    expect(
      linePath(
        [
          [0, 50],
          [100, 0],
        ],
        'step',
      ),
    ).toBe(fixtures.seriesPath.twoStep);
  });

  it('closes its area on the drawing’s floor, and draws a summary’s band, as 1.10 did', () => {
    expect(areaPath(points, 'smooth', 168)).toBe(fixtures.areaUnder.history);
    const band = airScale([TEMP, low, high]);
    expect(band).toEqual(fixtures.plotScale.bandScale);
    expect(bandPath(pointsOf(low, band), pointsOf(high, band))).toBe(fixtures.bandPath);
  });

  it('reads its curve where 1.10 read it', () => {
    const sensor = airScale([TEMP]);
    const sensorPoints = TEMP.map((v, i): Pt => [
      (i / 47) * 320,
      yOf(v, sensor, { top: 12, bottom: 80 }),
    ]);
    [0, 37, 80, 160, 241.5, 320].forEach((x, i) =>
      expect(yAt(sensorPoints, 'smooth', x)).toBeCloseTo(
        fixtures.seriesY.sensorSmooth[i] as number,
        9,
      ),
    );
    [0, 37, 160, 320].forEach((x, i) =>
      expect(yAt(points, 'step', x)).toBeCloseTo(fixtures.seriesY.historyStep[i] as number, 9),
    );
  });

  it('keeps a reading past the scale on its edge, and the floor at zero for power', () => {
    [0, 5, 10, 99].forEach((v, i) =>
      expect(yOf(v, { min: 0, max: 10 }, { top: 0, bottom: 50 })).toBe(fixtures.plotY[i]),
    );
    expect(airScale([POWER], true)).toEqual(fixtures.plotScale.zero);
    expect(airScale([[5, 5]])).toEqual(fixtures.plotScale.flat);
  });
});

describe('the history bars’ scale and bars', () => {
  it('finds 1.10’s nice ticks and steps', () => {
    const { solar, signed, none, small, three } = fixtures.niceTicks;
    expect(niceTicks(0, 35.4)).toEqual(solar);
    expect(niceTicks(-5.05, 2.55)).toEqual(signed);
    expect(niceTicks(0, 0)).toEqual(none);
    expect(niceTicks(0.3, 16.8)).toEqual(small);
    expect(niceTicks(-5.05, 2.55, 3)).toEqual(three);
    expect([35.4, 16.8, 203, 0.42].map((span) => niceStep(span))).toEqual(fixtures.niceStep);
  });

  it('draws 1.10’s bars, string for string', () => {
    expect(
      [
        [7, 276],
        [30, 276],
        [96, 320],
      ].map(([count, width]) => barGeometry(count as number, width as number)),
    ).toEqual(fixtures.barGeometry);
    const want = fixtures.barPath;
    expect(barPath(10, 24.5, 14, 80, 4, 'top')).toBe(want.top);
    expect(barPath(10, 100, 14, 36, 4, 'bottom')).toBe(want.bottom);
    expect(barPath(0, 10, 2, 30, 4, 'top')).toBe(want.thin);
    expect(barPath(5, 20, 9, 3, 4, 'top')).toBe(want.short);
    expect(barPath(5, 20, 9, 3, 4, 'bottom')).toBe(want.shortBottom);
    expect(barPath(12.34, 56.78, 11.1, 42.2, 4, 'top')).toBe(want.tenths);
  });
});

describe('the rings and the signed gauge’s ticks', () => {
  it('lights a score ring’s share as 1.10 did', () => {
    const want = fixtures.arcDash;
    expect(arcDash(0.62, ringRadius(RING))).toBe(want.ring);
    expect(arcDash(0.62, ringRadius(64))).toBe(want.small);
    expect(arcDash(null, ringRadius(RING))).toBe(want.none);
    expect(arcDash(1.4, ringRadius(RING))).toBe(want.over);
    expect(arcDash(0, ringRadius(RING))).toBe(want.zero);
  });

  it('places the signed gauge’s 41 ticks and lights them as 1.10 did', () => {
    const cases = [
      [fixtures.ticksOf.geometry, 0.6, fixtures.ticksOf.up],
      [fixtures.ticksOf.geometry, -0.4, fixtures.ticksOf.down],
      [fixtures.ticksOf.geometry, null, fixtures.ticksOf.none],
      [fixtures.ticksOf.narrow, 1, fixtures.ticksOf.narrowUp],
    ] as const;
    for (const [g, fraction, want] of cases) {
      const ticks = signedTicks(g, fraction);
      expect(ticks.map((t) => t.lit)).toEqual(want.map((t) => t.lit));
      ticks.forEach((t, i) => {
        const w = want[i] as (typeof want)[number];
        for (const key of ['x1', 'y1', 'x2', 'y2'] as const) expect(t[key]).toBeCloseTo(w[key], 9);
      });
    }
  });
});
