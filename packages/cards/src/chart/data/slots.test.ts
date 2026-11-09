import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import type { Reading } from './attribute.js';
import { bucketGrid, roundGrid, roundStep } from './slots.js';
import { dayStart, gains, readSlots, windowOf } from './span.js';

/*
 * A Chart card's slots on the house's clock (1.18): whole round periods, in the house's time zone, on the days a clock
 * changes and in the zones whose offset is not whole hours; a statistic's hours are the recorder's own; and how each
 * reading makes its slot's value.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const hassIn = (time_zone: string): HomeAssistant =>
  ({
    config: { time_zone },
    locale: { language: 'en', time_zone: 'server', time_format: '24' },
  }) as unknown as HomeAssistant;

const clock = (t: number, zone: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(t);

const hours = (n: number, t: number): number => t + n * HOUR;

describe('the round step of a card’s slots', () => {
  const step = (
    hoursOf: number,
    width: number,
    more: Partial<Parameters<typeof roundStep>[0]> = {},
  ) =>
    roundStep({
      length: hoursOf * HOUR,
      width,
      finest: 5 * MINUTE,
      every: 'auto',
      most: 192,
      gap: 5,
      ...more,
    }) / MINUTE;

  it('is the finest round length its width draws calmly and its readings come in', () => {
    expect(step(12, 288)).toBe(15);
    expect(step(24, 288)).toBe(30);
    expect(step(48, 288)).toBe(60);
    expect(step(168, 288)).toBe(180);
    expect(step(4, 288)).toBe(5);
    // a narrow column's day
    expect(step(24, 120)).toBe(60);
    // never finer than the readings come: an hour's statistics
    expect(step(4, 1360, { finest: HOUR })).toBe(60);
    // bars: 48 at most
    expect(step(168, 1360, { most: 48 })).toBe(240);
  });

  it('keeps a step asked where its width holds it, else the next round one, a whole number of it', () => {
    expect(step(12, 288, { every: '30m' })).toBe(30);
    expect(step(4, 288, { every: '5m' })).toBe(5);
    expect(step(12, 288, { every: '5m' })).toBe(15);
    expect(step(168, 288, { every: '15m' })).toBe(180);
    expect(step(12, 288, { every: '1h' })).toBe(60);
    // never finer than the statistics come
    expect(step(12, 1360, { every: '5m', finest: HOUR })).toBe(60);
  });

  it('never draws slots closer than its gap, in every window and width', () => {
    for (const width of [112, 171, 280, 1360])
      for (const hoursOf of [4, 12, 24, 48, 168]) {
        const got = step(hoursOf, width);
        expect((hoursOf * 60) / got).toBeLessThanOrEqual(Math.ceil(width / 5) + 1);
      }
  });
});

describe('a rolling window’s round slots', () => {
  const utc = hassIn('UTC');
  const at = (hour: number, minute: number) => Date.UTC(2026, 8, 17, hour, minute);

  it('are whole round periods, the last the one now is in, still running', () => {
    const now = at(14, 37);
    const grid = roundGrid({
      window: { start: now - 12 * HOUR, end: now, now },
      step: HOUR,
      hass: utc,
    });
    expect(grid.edges).toHaveLength(13);
    expect(new Date(grid.edges[0]!).toISOString()).toBe('2026-09-17T03:00:00.000Z');
    expect(new Date(grid.edges[12]!).toISOString()).toBe('2026-09-17T15:00:00.000Z');
    expect(grid.running).toBe(true);
  });

  it('end on now where now is round: every slot is whole, none running', () => {
    const now = at(14, 0);
    const grid = roundGrid({
      window: { start: now - 4 * HOUR, end: now, now },
      step: HOUR,
      hass: utc,
    });
    expect(grid.edges[grid.edges.length - 1]).toBe(now);
    expect(grid.running).toBe(false);
    expect(grid.edges).toHaveLength(5);
  });

  it('end on the last whole hour where a statistic’s running one is not compiled', () => {
    const now = at(14, 37);
    const grid = roundGrid({
      window: { start: now - 12 * HOUR, end: now, now },
      step: HOUR,
      hass: utc,
      hours: true,
      whole: true,
    });
    expect(new Date(grid.edges[12]!).toISOString()).toBe('2026-09-17T14:00:00.000Z');
    expect(grid.running).toBe(false);
    expect(new Date(grid.edges[0]!).toISOString()).toBe('2026-09-17T02:00:00.000Z');
  });

  it('stay as they are as the window moves on inside the step', () => {
    const edgesAt = (minute: number) => {
      const now = at(14, minute);
      return roundGrid({ window: { start: now - 12 * HOUR, end: now, now }, step: HOUR, hass: utc })
        .edges;
    };
    expect(edgesAt(5)).toEqual(edgesAt(55));
    expect(edgesAt(55)).not.toEqual(
      roundGrid({
        window: { start: at(15, 5) - 12 * HOUR, end: at(15, 5), now: at(15, 5) },
        step: HOUR,
        hass: utc,
      }).edges,
    );
  });

  it('every window and step, the slot edges on the step from the house’s midnight, in the house’s zone', () => {
    const zones = ['UTC', 'Europe/Madrid', 'Asia/Kolkata', 'America/New_York'];
    const now = Date.parse('2026-09-17T21:47:00Z');
    for (const zone of zones) {
      const hass = hassIn(zone);
      for (const hoursOf of [4, 12, 24, 48, 168])
        for (const step of [5, 15, 30, 60, 120, 240].map((m) => m * MINUTE)) {
          if ((hoursOf * HOUR) / step > 200) continue;
          const { edges } = roundGrid({
            window: { start: now - hoursOf * HOUR, end: now, now },
            step,
            hass,
          });
          for (const edge of edges) {
            const [h, m] = clock(edge, zone).split(':').map(Number) as [number, number];
            expect(((h * 60 + m) * MINUTE) % step).toBe(0);
          }
          expect(edges.every((e, k) => k === 0 || e > edges[k - 1]!)).toBe(true);
        }
    }
  });

  it('a half-hour zone: the house’s round hours, but a statistic’s hours are the recorder’s (00:30, 01:30 …)', () => {
    const india = hassIn('Asia/Kolkata');
    const now = Date.parse('2026-09-17T09:17:00Z');
    const round = roundGrid({
      window: { start: now - 4 * HOUR, end: now, now },
      step: HOUR,
      hass: india,
    });
    expect(round.edges.map((e) => clock(e, 'Asia/Kolkata'))).toEqual([
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
    ]);
    const statistics = roundGrid({
      window: { start: now - 4 * HOUR, end: now, now },
      step: HOUR,
      hass: india,
      hours: true,
      whole: true,
    });
    expect(statistics.edges.map((e) => clock(e, 'Asia/Kolkata'))).toEqual([
      '10:30',
      '11:30',
      '12:30',
      '13:30',
      '14:30',
    ]);
  });

  it('a clock change: the day’s slots keep their round times, across an hour lost and an hour won', () => {
    const madrid = hassIn('Europe/Madrid');
    // the last Sunday of March 2026: 02:00 goes to 03:00; a 6-hour step keeps 00, 06, 12, 18
    const spring = Date.parse('2026-03-29T18:30:00Z');
    const spun = roundGrid({
      window: { start: spring - 48 * HOUR, end: spring, now: spring },
      step: 6 * HOUR,
      hass: madrid,
    });
    expect(spun.edges.map((e) => clock(e, 'Europe/Madrid'))).toEqual([
      '00:00',
      '06:00',
      '12:00',
      '18:00',
      '00:00',
      '06:00',
      '12:00',
      '18:00',
      '00:00',
    ]);
    // the last Sunday of October: 03:00 goes to 02:00; every edge keeps its round hour
    const autumn = Date.parse('2026-10-25T18:30:00Z');
    const fell = roundGrid({
      window: { start: autumn - 48 * HOUR, end: autumn, now: autumn },
      step: HOUR,
      hass: madrid,
    });
    expect(fell.edges).toHaveLength(49);
    for (const e of fell.edges) expect(clock(e, 'Europe/Madrid').endsWith(':00')).toBe(true);
  });

  it('Lord Howe’s half-hour clock change: the edges stay in order, on the hour but where the change itself falls', () => {
    const howe = hassIn('Australia/Lord_Howe');
    const now = Date.parse('2026-04-05T12:10:00Z');
    const { edges } = roundGrid({
      window: { start: now - 24 * HOUR, end: now, now },
      step: HOUR,
      hass: howe,
    });
    expect(edges.every((e, k) => k === 0 || e > edges[k - 1]!)).toBe(true);
    const off = edges.filter((e) => !clock(e, 'Australia/Lord_Howe').endsWith(':00'));
    expect(off.length).toBeLessThanOrEqual(1);
  });

  it('a window of days: on the house’s midnights, through a clock change', () => {
    const madrid = hassIn('Europe/Madrid');
    const now = Date.parse('2026-03-31T10:00:00Z');
    const grid = roundGrid({
      window: { start: now - 7 * 24 * HOUR, end: now, now },
      step: 24 * HOUR,
      hass: madrid,
    });
    expect(grid.edges).toHaveLength(8);
    expect(grid.running).toBe(true);
    for (const edge of grid.edges) expect(clock(edge, 'Europe/Madrid')).toBe('00:00');
    expect(new Date(grid.edges[7]!).toISOString()).toBe('2026-03-31T22:00:00.000Z');
  });

  it('a calendar window runs from its start to its end, none running, however long the day', () => {
    const madrid = hassIn('Europe/Madrid');
    const now = new Date('2026-03-29T10:15:00Z');
    const start = dayStart(madrid, now);
    const end = dayStart(madrid, now, 1);
    expect(end - start).toBe(23 * HOUR);
    const grid = roundGrid({
      window: { start, end, now: now.getTime() },
      step: HOUR,
      hass: madrid,
    });
    expect(grid.edges).toHaveLength(24);
    expect(grid.edges[0]).toBe(start);
    expect(grid.edges[23]).toBe(end);
    expect(grid.running).toBe(false);
  });

  it('the house’s midnight is right on a day its clock changes', () => {
    const madrid = hassIn('Europe/Madrid');
    const spring = new Date('2026-03-29T20:00:00Z');
    expect(clock(dayStart(madrid, spring), 'Europe/Madrid')).toBe('00:00');
    expect(dayStart(madrid, spring, 1) - dayStart(madrid, spring)).toBe(23 * HOUR);
    const autumn = new Date('2026-10-25T20:00:00Z');
    expect(clock(dayStart(madrid, autumn), 'Europe/Madrid')).toBe('00:00');
    expect(dayStart(madrid, autumn, 1) - dayStart(madrid, autumn)).toBe(25 * HOUR);
  });
});

describe('a statistic’s long buckets', () => {
  it('are the slots themselves: those that start in the window, the last running where it has not ended', () => {
    const days = (d: number) => Date.UTC(2026, 8, d);
    const window = { start: days(5), end: days(26), now: days(26) };
    const readings: Reading[] = [1, 8, 15, 22].map((d) => ({
      t: days(d),
      v: d,
      end: days(d + 7),
    }));
    const grid = bucketGrid(readings, window);
    expect(grid?.edges).toEqual([days(8), days(15), days(22), days(29)]);
    expect(grid?.running).toBe(true);
    expect(bucketGrid([], window)).toBeNull();
  });
});

describe('how a slot reads its readings', () => {
  const at = (h: number) => Date.UTC(2026, 8, 17, h);
  const edges = [at(0), at(1), at(2)];
  const buckets: Reading[] = [
    { t: at(0), v: 2, end: at(1) },
    { t: at(1), v: 3, end: at(2) },
  ];

  it('a whole bucket a slot reads its own figure, where a blended slot read neither', () => {
    expect(readSlots(buckets, edges, { hold: HOUR })).toEqual([2, 3]);
  });

  it('adds up a statistic’s changes, keeps a running total’s last, its lowest and its highest', () => {
    const six = Array.from({ length: 6 }, (_u, h) => ({
      t: at(h),
      v: h + 1,
      end: at(h + 1),
    }));
    expect(readSlots(six, [at(0), at(3), at(6)], { hold: HOUR }, 'sum')).toEqual([6, 15]);
    expect(readSlots(six, [at(0), at(3), at(6)], { hold: HOUR }, 'last')).toEqual([3, 6]);
    expect(readSlots(six, [at(0), at(3), at(6)], { hold: HOUR }, 'min')).toEqual([1, 4]);
    expect(readSlots(six, [at(0), at(3), at(6)], { hold: HOUR }, 'max')).toEqual([3, 6]);
    expect(readSlots(six, [at(0), at(3), at(6)], { hold: HOUR }, 'mean')).toEqual([2, 5]);
  });

  it('a bucket a slot takes part of adds up that part', () => {
    expect(readSlots(buckets, [at(0), at(0) + 30 * MINUTE, at(1)], { hold: HOUR }, 'sum')).toEqual([
      1, 1,
    ]);
  });

  it('a slot still running reads so far: a sensor’s mean until now, a meter’s gain until now', () => {
    const now = at(1) + 15 * MINUTE;
    const states: Reading[] = [
      { t: at(0), v: 10 },
      { t: at(1), v: 20 },
    ];
    const holding = { hold: Infinity, until: now };
    expect(readSlots(states, [at(0), at(1), at(2)], holding)).toEqual([10, 20]);
    const meter: Reading[] = [
      { t: at(0), v: 100 },
      { t: at(1), v: 104 },
      { t: now - 1, v: 106 },
    ];
    expect(gains(meter, [at(0), at(1), at(2)], holding, true, now)).toEqual([4, 2]);
  });

  it('a window’s words: `windowOf` rolling ends at now, a grid’s last slot holds it', () => {
    const utc = hassIn('UTC');
    const now = new Date(Date.UTC(2026, 8, 17, 14, 37));
    const window = windowOf({ kind: 'rolling', hours: 12 }, now, utc);
    expect(window.end).toBe(now.getTime());
    expect(hours(1, roundGrid({ window, step: HOUR, hass: utc }).edges[0]!)).toBe(
      Date.UTC(2026, 8, 17, 4),
    );
  });
});
