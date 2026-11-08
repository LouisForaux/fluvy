import { describe, expect, it } from 'vitest';
import type { EntityView, HomeAssistant } from '@fluvy/core';
import { bucket } from '../chart/engine/model.js';
import { fetchMeanSeries, liveTotals, powerBuckets, powered } from './power-day.js';
import type { PrefSource } from './prefs.js';

const source = (kind: PrefSource['kind'], measure: PrefSource['measure']): PrefSource => ({
  kind,
  measure,
  energyIn: [],
  energyOut: [],
});
const rows = (means: Record<string, Array<number | null>>) =>
  Object.fromEntries(
    Object.entries(means).map(([id, list]) => [
      id,
      list.flatMap((mean, i) => (mean === undefined ? [] : [{ start: i * 300_000, mean }])),
    ]),
  );

describe('the day from the power sensors', () => {
  it('splits a signed sensor by its own sign: one phase imports while another exports', () => {
    const sources = [
      source('grid', { power: ['sensor.l1', 'sensor.l2', 'sensor.l3'] }),
      source('solar', { power: ['sensor.pv'] }),
    ];
    const [b] = powerBuckets(
      rows({ 'sensor.l1': [-0.4], 'sensor.l2': [1], 'sensor.l3': [0.9], 'sensor.pv': [3.2] }),
      sources,
    );
    expect(b?.totals.fromGrid).toBeCloseTo(1.9);
    expect(b?.totals.toGrid).toBeCloseTo(0.4);
    expect(b?.totals.solar).toBeCloseTo(3.2);
  });

  it('reads an inverted battery and a pair of grid sensors', () => {
    const sources = [
      source('battery', { power: ['sensor.bat'], invert: true }),
      source('grid', { import: 'sensor.in', export: 'sensor.out' }),
    ];
    const [b] = powerBuckets(
      rows({ 'sensor.bat': [-0.6], 'sensor.in': [1.9], 'sensor.out': [0.4] }),
      sources,
    );
    // a meter that counts charging as positive, inverted: −0.6 is 0.6 kW of discharge
    expect(b?.totals.fromBattery).toBeCloseTo(0.6);
    expect(b?.totals.toBattery).toBe(0);
    expect(b?.totals.fromGrid).toBeCloseTo(1.9);
    expect(b?.totals.toGrid).toBeCloseTo(0.4);
  });

  it('keeps the sun one way: an inverter’s night draw is not negative sun', () => {
    const [b] = powerBuckets(rows({ 'sensor.pv': [-0.01], 'sensor.grid': [0.5] }), [
      source('solar', { power: ['sensor.pv'] }),
      source('grid', { power: ['sensor.grid'] }),
    ]);
    expect(b?.totals.solar).toBe(0);
  });

  it('a bucket without the grid or the battery is a gap; without the sun, the sun at rest', () => {
    const sources = [
      source('grid', { power: ['sensor.grid'] }),
      source('solar', { power: ['sensor.pv'] }),
    ];
    const buckets = powerBuckets(
      rows({ 'sensor.grid': [0.5, null, 0.4], 'sensor.pv': [null, 1, null] }),
      sources,
    );
    expect(buckets.map((b) => b.start / 300_000)).toEqual([0, 2]);
    expect(buckets[0]?.totals.solar).toBe(0);
  });

  it('draws from power only when every source says its power', () => {
    expect(powered([source('grid', { power: ['sensor.g'] }), source('solar', null)])).toBe(false);
    expect(powered([source('grid', { power: ['sensor.g'] })])).toBe(true);
    expect(powered([])).toBe(false);
  });
});

describe('a sensor’s means over a picker’s range', () => {
  const MIDNIGHT = Date.parse('2026-11-07T00:00:00Z');
  const FIVE = 300_000;
  /**
   * A cloudy day of an array's five-minute means (kW): a hill from 07:00 to 17:00 that clouds cut into, 2.61 at
   * 12:00 between two dips, its peak 2.94 at 11:35.
   */
  const CLOUDY = Array.from({ length: 288 }, (_unused, i) => {
    const sun = Math.max(0, Math.sin(((i - 84) / 120) * Math.PI)) * 1.6;
    return i === 139 ? 2.94 : i === 144 ? 2.61 : i % 7 === 3 ? sun * 0.3 : sun;
  });
  const house = (means: readonly number[], asked: Record<string, unknown>[] = []) =>
    ({
      callWS: async (message: Record<string, unknown>) => {
        asked.push(message);
        const from = Date.parse(String(message['start_time']));
        const to = Date.parse(String(message['end_time']));
        return {
          'sensor.pv': means
            .map((mean, i) => ({
              start: MIDNIGHT + i * FIVE,
              end: MIDNIGHT + (i + 1) * FIVE,
              mean,
            }))
            .filter((row) => row.start >= from && row.end <= to + 1),
        };
      },
    }) as unknown as HomeAssistant;
  const day = { start: new Date(MIDNIGHT), end: new Date(MIDNIGHT + 86_400_000 - 1) };

  it('keeps every bucket, each at its start: 12:00 reads the bucket from 12:00, the peak is whole', async () => {
    const series = await fetchMeanSeries(
      house(CLOUDY),
      'sensor.pv',
      day,
      new Date(MIDNIGHT + 2 * 86_400_000),
    );
    expect(series?.values).toHaveLength(288);
    expect(series?.step).toBe(FIVE);
    expect(series?.values[144]).toBe(2.61);
    expect(series?.max).toBe(Math.max(...CLOUDY));
    // the old curve: 48 points, each the last mean known at its half hour — the noon spike and the peak are gone
    const sampled = Array.from({ length: 48 }, (_unused, i) => CLOUDY[i * 6 + 5] as number);
    expect(Math.max(...sampled)).toBeLessThan(2);
  });

  it('draws fewer points as the mean of the buckets each stands for, never a sample of them', () => {
    const drawn = bucket(CLOUDY, 96, 'mean');
    expect(drawn[48]).toBeCloseTo(((CLOUDY[144] as number) + CLOUDY[145]! + CLOUDY[146]!) / 3, 9);
    const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);
    // a mean keeps the day's energy: the area under the curve is the same
    expect(sum(drawn) * 3).toBeCloseTo(sum(CLOUDY), 9);
  });

  it('runs to the last bucket begun while the range holds now, one not compiled yet reading the one before', async () => {
    const asked: Record<string, unknown>[] = [];
    // 14:03, the 14:00 bucket not compiled
    const now = new Date(MIDNIGHT + (14 * 60 + 3) * 60_000);
    const series = await fetchMeanSeries(house(CLOUDY.slice(0, 168), asked), 'sensor.pv', day, now);
    expect(asked[0]?.['end_time']).toBe(now.toISOString());
    expect(series?.values).toHaveLength(169);
    expect(series?.values[168]).toBe(CLOUDY[167]);
  });
});

describe('the house right now', () => {
  const view = (state: string, unit = 'W'): EntityView =>
    ({
      status: 'ok',
      state,
      number: Number(state),
      unit,
      deviceClass: 'power',
      attr: () => undefined,
    }) as unknown as EntityView;
  const missing = {
    status: 'missing',
    state: 'unavailable',
    number: null,
  } as unknown as EntityView;

  it('adds every source live, in watts', () => {
    const states: Record<string, EntityView> = {
      'sensor.grid': view('1500'),
      'sensor.pv': view('3200'),
      'sensor.bat': view('-600'),
    };
    const totals = liveTotals(
      [
        source('grid', { power: ['sensor.grid'] }),
        source('solar', { power: ['sensor.pv'] }),
        source('battery', { power: ['sensor.bat'] }),
      ],
      (id) => states[id] ?? missing,
    );
    expect(totals?.fromGrid).toBe(1500);
    expect(totals?.solar).toBe(3200);
    expect(totals?.toBattery).toBe(600);
  });

  it('says nothing when a sensor cannot be read', () => {
    expect(liveTotals([source('grid', { power: ['sensor.gone'] })], () => missing)).toBeNull();
  });
});
