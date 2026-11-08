// @vitest-environment happy-dom
import { CHART_DEFAULTS, type HomeAssistant, type PointEvery } from '@fluvy/core';
import { render } from 'lit';
import { describe, expect, it } from 'vitest';

import { drawChart } from './draw.js';
import { resolveStyle } from './presets.js';
import {
  everyWord,
  grainOf,
  layLine,
  leastGap,
  midnightOf,
  readLine,
  stepOf,
  strokeFor,
  timeLine,
  windowWord,
  type Timed,
} from './timeline.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** The house's clock: Madrid, as the server keeps it (the page's own zone does not matter). */
const hass = {
  language: 'en',
  config: { time_zone: 'Europe/Madrid' },
  locale: { language: 'en', time_zone: 'server' },
} as unknown as HomeAssistant;
/** 17 September 2026 at midnight in Madrid (UTC+2). */
const MIDNIGHT = Date.UTC(2026, 8, 16, 22);
const at = (h: number, m = 0): number => MIDNIGHT + h * HOUR + m * MINUTE;

/** A cloudy day's five-minute means (kW), each at its bucket's start: 2.61 at 12:00 between two dips. */
const CLOUDY: Timed[] = Array.from({ length: 288 }, (_unused, i) => ({
  t: MIDNIGHT + i * 5 * MINUTE,
  v:
    i === 144
      ? 2.61
      : i === 143 || i === 145
        ? 0.9
        : Math.max(0, Math.sin(((i - 84) / 120) * Math.PI)) * 2,
}));

const style = (line: number, every: PointEvery = 'auto', glow: 'none' | 'blur' = 'none') => ({
  line,
  every,
  glow: { kind: glow, offset: 5, opacity: 0.35 },
});

describe('how far apart a line’s points stand', () => {
  it('automatic: the finest round step that keeps them apart by what the stroke needs', () => {
    expect(leastGap(1.5)).toBe(4);
    expect(leastGap(2.5)).toBe(5);
    expect(leastGap(2.5, true)).toBe(6);
    const step = (hours: number, width: number): number =>
      stepOf('auto', hours * HOUR, width, leastGap(2.5)) / MINUTE;
    expect(step(4, 320)).toBe(5);
    expect(step(12, 320)).toBe(15);
    expect(step(24, 320)).toBe(30);
    expect(step(48, 320)).toBe(60);
    expect(step(168, 320)).toBe(180);
    expect(step(12, 112)).toBe(60);
    expect(step(12, 1360)).toBe(5);
  });

  it('asked: as asked down to a pixel apart, then the next round one that holds, a whole number of it', () => {
    const step = (every: PointEvery, hours: number, width: number, finest?: number): number =>
      stepOf(every, hours * HOUR, width, leastGap(2.5), finest) / MINUTE;
    expect(step('30m', 24, 320)).toBe(30);
    expect(step('5m', 24, 320)).toBe(5);
    expect(step('1h', 4, 1360)).toBe(60);
    // a week of five minutes is six to a pixel: the hour holds, and is twelve of them
    expect(step('5m', 168, 320)).toBe(60);
    expect(step('15m', 168, 1360)).toBe(15);
    expect(step('15m', 168, 320)).toBe(60);
    // never finer than the readings: an hour's statistics are drawn by the hour
    expect(step('5m', 24, 1360, HOUR)).toBe(60);
    expect(step('auto', 4, 1360, 5 * MINUTE)).toBe(5);
  });

  it('draws a line asked closer than its stroke reads thinner, down to a hairline', () => {
    expect(strokeFor(2.5, 6.67)).toBe(2.5);
    expect(strokeFor(2.5, 4.44)).toBeCloseTo(1.94);
    expect(strokeFor(2.5, 1.11)).toBe(1);
    expect(strokeFor(1.5, 20)).toBe(1.5);
  });

  it('never crowds a line: at every width, window and stroke, its points stand at least what its stroke needs apart', () => {
    for (const width of [112, 171, 280, 1360])
      for (const hours of [4, 12, 24, 48, 168])
        for (const [line, glow] of [
          [1.5, 'none'],
          [2.5, 'none'],
          [3, 'none'],
          [2.5, 'blur'],
        ] as const) {
          const end = at(18);
          const laid = timeLine({
            readings: CLOUDY.map((r) => ({ t: r.t - 7 * 24 * HOUR, v: r.v })).concat(CLOUDY),
            start: end - hours * HOUR,
            end,
            width,
            style: style(line, 'auto', glow),
            hass,
          });
          const xs = laid.at.map((f) => f * width);
          // the points between the window's two ends: no two closer than the stroke needs, none more than a width holds
          const inner = xs.slice(1, -1);
          const gaps = inner.slice(1).map((x, i) => x - (inner[i] as number));
          const label = `${width} px, ${hours} h, ${line} px ${glow}`;
          expect(Math.min(...gaps), label).toBeGreaterThanOrEqual(
            leastGap(line, glow === 'blur') - 1e-9,
          );
          expect(inner.length, label).toBeLessThanOrEqual(
            width / leastGap(line, glow === 'blur') + 1,
          );
          expect(laid.style.line, label).toBe(line);
        }
  });
});

describe('a line through a window', () => {
  it('stands its points on the house’s round times, and one on each of the window’s ends', () => {
    const laid = layLine(
      CLOUDY,
      { start: at(9, 47), end: at(21, 47) },
      30 * MINUTE,
      MIDNIGHT,
      true,
    );
    const times = laid.at.map((f) => at(9, 47) + f * 12 * HOUR);
    expect(times[0]).toBe(at(9, 47));
    expect(times[1]).toBe(at(10));
    expect(times[2]).toBe(at(10, 30));
    expect(times.at(-2)).toBe(at(21, 30));
    expect(times.at(-1)).toBe(at(21, 47));
    expect(laid.values).toHaveLength(26);
  });

  it('automatic: each point the mean of the readings within half a step of its time', () => {
    const readings = [
      { t: at(11), v: 0 },
      { t: at(12), v: 10 },
      { t: at(13), v: 0 },
    ];
    const laid = layLine(readings, { start: at(11), end: at(13) }, 30 * MINUTE, MIDNIGHT, true);
    // 11:45 → 12:15: a quarter of nothing, a quarter of ten
    expect(laid.values[laid.at.findIndex((f) => f === 0.5)]).toBe(5);
    expect(laid.values[laid.at.findIndex((f) => f === 0.75)]).toBe(10);
  });

  it('asked: each point Home Assistant’s reading at its time — 12:00 is the bucket from 12:00', () => {
    const laid = layLine(CLOUDY, { start: at(0), end: at(23, 55) }, 30 * MINUTE, MIDNIGHT, false);
    const noon = laid.at.findIndex((f) => Math.abs(f * (at(23, 55) - at(0)) - 12 * HOUR) < 1);
    expect(laid.values[noon]).toBe(2.61);
    expect(laid.values).toHaveLength(49);
  });

  it('starts where its readings do: nothing is drawn before the first', () => {
    const laid = layLine(
      [{ t: at(12), v: 4 }],
      { start: at(10), end: at(14) },
      HOUR,
      MIDNIGHT,
      true,
    );
    expect(laid.values).toEqual([null, null, 4, 4, 4]);
  });
});

describe('a line read where it is pointed at', () => {
  it('reads Home Assistant’s reading at the round time nearest the pointer: the five-minute bucket, never a mean', () => {
    const day = { start: at(0), end: at(24) };
    const grain = grainOf(24 * HOUR, 320, 5 * MINUTE);
    expect(grain).toBe(5 * MINUTE);
    // pointed at 12:02, it reads 12:00 and the bucket from 12:00 to 12:05
    const read = readLine(CLOUDY, day, (12 * HOUR + 2 * MINUTE) / (24 * HOUR), grain, MIDNIGHT);
    expect(read?.t).toBe(at(12));
    expect(read?.v).toBe(2.61);
    expect(read?.fraction).toBe(0.5);
    // pointed at 12:03, the next bucket
    expect(readLine(CLOUDY, day, (12 * HOUR + 3 * MINUTE) / (24 * HOUR), grain, MIDNIGHT)?.v).toBe(
      0.9,
    );
  });

  it('snaps a sensor’s history to what a pixel holds, on the house’s clock, inside the window', () => {
    expect(grainOf(12 * HOUR, 280)).toBe(5 * MINUTE);
    expect(grainOf(4 * HOUR, 1360)).toBe(MINUTE);
    expect(grainOf(168 * HOUR, 280)).toBe(HOUR);
    const window = { start: at(9, 47), end: at(21, 47) };
    expect(readLine(CLOUDY, window, 0, 5 * MINUTE, MIDNIGHT)?.t).toBe(at(9, 50));
    expect(readLine(CLOUDY, window, 1, 5 * MINUTE, MIDNIGHT)?.t).toBe(at(21, 45));
  });

  it('reads the same at 12:00 whatever the line draws there, automatic or a point every 30 minutes', () => {
    for (const every of ['auto', '30m', '5m'] as const) {
      const line = timeLine({
        readings: CLOUDY,
        start: at(0),
        end: at(23, 55),
        width: 320,
        style: style(2.5, every),
        hass,
        finest: 5 * MINUTE,
      });
      expect(line.read((12 * HOUR) / (at(23, 55) - at(0)))?.v, every).toBe(2.61);
    }
  });
});

describe('the house’s clock and the words', () => {
  it('counts the round times from the house’s midnight', () => {
    expect(midnightOf(hass, at(15, 12))).toBe(MIDNIGHT);
  });

  it('says a step and a window as the language writes a figure and its unit', () => {
    expect(everyWord(hass, 'auto')).toBe('Automatic');
    expect(everyWord(hass, '5m')).toBe('5 min');
    expect(everyWord(hass, '1h')).toBe('1 h');
    expect(windowWord(hass, 12)).toBe('12 h');
    expect(windowWord(hass, 48)).toBe('48 h');
    expect(windowWord(hass, 168)).toBe('7 d');
    expect(everyWord({ language: 'ja' }, '30m')).toBe('30分');
  });
});

describe('a series at its own times', () => {
  it('is drawn where each reading stands, not evenly', () => {
    const element = document.createElement('div');
    render(
      drawChart({
        frame: { width: 100, height: 60, headroom: 10 },
        series: [{ values: [1, 2, 3], at: [0, 0.1, 1] }],
        style: resolveStyle('classic', {}, {}, CHART_DEFAULTS),
        id: 'c',
      }),
      element,
    );
    const d = element.querySelector('.curve-line')?.getAttribute('d') ?? '';
    expect(d.startsWith('M0.00,')).toBe(true);
    expect(d).toMatch(/ 10\.00,[\d.]+ C/);
    expect(d).toMatch(/ 100\.00,[\d.]+$/);
  });
});
