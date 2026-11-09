import { describe, expect, it } from 'vitest';
import type { EntityView, HomeAssistant } from '@fluvy/core';
import { allocate, lowCarbon, scores } from './allocate.js';
import {
  allocatePeriod,
  clearPeriodCache,
  fetchRange,
  forgetStale,
  fullDays,
  houseMidnight,
  rangeOf,
  stepFor,
} from './period.js';
import { fetchMeanSeries } from './power-day.js';
import { readPrefs, type EnergyPrefs } from './prefs.js';
import { readMeasure, net } from './reading.js';
import { bothWays, legacySources, measureOfSource, prefSources } from './sources.js';

/** A sensor as the cards see it: a number in a unit, or a status. */
const view = (value: number | null, unit = 'W', status: EntityView['status'] = 'ok'): EntityView =>
  ({
    status,
    number: value,
    unit,
    deviceClass: 'power',
    state: String(value),
  }) as unknown as EntityView;
const states = (map: Record<string, EntityView>) => (id: string) =>
  map[id] ?? view(null, 'W', 'missing');

describe('readMeasure', () => {
  it('splits a signed sensor into what comes in and what goes out', () => {
    expect(readMeasure({ power: ['a'] }, states({ a: view(1900) }))).toEqual({ in: 1900, out: 0 });
    expect(readMeasure({ power: ['a'] }, states({ a: view(-400) }))).toEqual({ in: 0, out: 400 });
    expect(readMeasure({ power: ['a'], invert: true }, states({ a: view(-400) }))).toEqual({
      in: 400,
      out: 0,
    });
  });

  it('sums the phases per sign: the #19 house imports and exports at the same moment', () => {
    const phases = states({ l1: view(-0.4, 'kW'), l2: view(1000), l3: view(0.9, 'kW') });
    const d = readMeasure({ power: ['l1', 'l2', 'l3'] }, phases);
    expect(d.in).toBeCloseTo(1900);
    expect(d.out).toBeCloseTo(400);
    expect(net(d)).toBeCloseTo(1500);
  });

  it('reads two sensors, both positive, and a dead one blanks only its own direction', () => {
    expect(
      readMeasure({ import: 'i', export: 'e' }, states({ i: view(1.9, 'kW'), e: view(400) })),
    ).toEqual({
      in: 1900,
      out: 400,
    });
    expect(
      readMeasure(
        { import: 'i', export: 'e' },
        states({ i: view(1900), e: view(null, 'W', 'unavailable') }),
      ),
    ).toEqual({ in: 1900, out: null });
  });

  it('never sums past a dead phase', () => {
    const d = readMeasure(
      { power: ['l1', 'l2'] },
      states({ l1: view(800), l2: view(null, 'W', 'unavailable') }),
    );
    expect(d).toEqual({ in: null, out: null });
    expect(net(d)).toBeNull();
  });

  it('refuses a unit that is not power', () => {
    expect(readMeasure({ power: ['a'] }, states({ a: view(12, 'kWh') }))).toEqual({
      in: null,
      out: null,
    });
  });
});

describe('allocate', () => {
  it('the #19 house: the sun feeds the battery and the grid first, the house keeps 54 % of its power from it', () => {
    const a = allocate({ solar: 3.2, fromGrid: 1.9, toGrid: 0.4, fromBattery: 0, toBattery: 0.6 });
    expect(a.usedTotal).toBeCloseTo(4.1);
    expect(a.solarToBattery).toBeCloseTo(0.6);
    expect(a.solarToGrid).toBeCloseTo(0.4);
    expect(a.usedSolar).toBeCloseTo(2.2);
    expect(a.usedGrid).toBeCloseTo(1.9);
    expect(Math.round((a.usedSolar / a.usedTotal) * 100)).toBe(54);
  });

  it('a net meter would have said 100 %: the export hid behind the import', () => {
    const netOnly = allocate({
      solar: 3.2,
      fromGrid: 1.5,
      toGrid: 0,
      fromBattery: 0,
      toBattery: 0.6,
    });
    expect(netOnly.usedSolar / netOnly.usedTotal).toBeGreaterThan(0.6);
  });

  it('cheap hours: grid energy the house did not use went into the battery', () => {
    const a = allocate({ solar: 0, fromGrid: 4.2, toGrid: 0, fromBattery: 0, toBattery: 3.6 });
    expect(a.usedTotal).toBeCloseTo(0.6);
    expect(a.gridToBattery).toBeCloseTo(3.6);
    expect(a.usedGrid).toBeCloseTo(0.6);
  });

  it('peak price: the battery sells to the grid and runs the house', () => {
    const a = allocate({ solar: 0, fromGrid: 0, toGrid: 2.1, fromBattery: 3.0, toBattery: 0 });
    expect(a.batteryToGrid).toBeCloseTo(2.1);
    expect(a.usedBattery).toBeCloseTo(0.9);
    expect(a.usedGrid).toBe(0);
  });

  it('a car charging takes the sun before the grid does', () => {
    const a = allocate({
      solar: 2,
      fromGrid: 5,
      toGrid: 0,
      fromBattery: 0,
      toBattery: 0,
      toVehicle: 6,
    });
    expect(a.usedTotal).toBeCloseTo(1);
    expect(a.solarToVehicle).toBeCloseTo(2);
    expect(a.gridToVehicle).toBeCloseTo(4);
    expect(a.usedGrid).toBeCloseTo(1);
  });

  it('a generator and a car feed the house after the battery, before the grid', () => {
    const a = allocate({
      solar: 0.8,
      fromGrid: 0.2,
      toGrid: 0,
      fromBattery: 1.4,
      toBattery: 0,
      generator: 2.0,
      fromVehicle: 0.5,
    });
    expect(a.usedTotal).toBeCloseTo(4.9);
    expect(a.usedGenerator).toBeCloseTo(2.0);
    expect(a.usedVehicle).toBeCloseTo(0.5);
    expect(a.usedGrid).toBeCloseTo(0.2);
  });
});

/** A period as Home Assistant's gauge tests write it: per-timestamp maps of each meter, into our buckets. */
type Series = Partial<
  Record<'solar' | 'from_grid' | 'to_grid' | 'from_battery' | 'to_battery', Record<string, number>>
>;
function period(series: Series, timestamps: readonly number[], battery: boolean, exported = true) {
  const at = (key: keyof Series, t: number): number => series[key]?.[String(t)] ?? 0;
  const buckets = timestamps.map((t) => ({
    totals: {
      solar: at('solar', t),
      fromGrid: at('from_grid', t),
      toGrid: at('to_grid', t),
      fromBattery: at('from_battery', t),
      toBattery: at('to_battery', t),
    },
  }));
  const totals = buckets.reduce(
    (acc, b) => ({
      solar: acc.solar + b.totals.solar,
      fromGrid: acc.fromGrid + b.totals.fromGrid,
      toGrid: acc.toGrid + b.totals.toGrid,
      fromBattery: acc.fromBattery + b.totals.fromBattery,
      toBattery: acc.toBattery + b.totals.toBattery,
    }),
    { solar: 0, fromGrid: 0, toGrid: 0, fromBattery: 0, toBattery: 0 },
  );
  return { totals, buckets, battery, exported };
}
const percent = (v: number | null): number | null => (v === null ? null : Math.round(v * 100));

describe('scores: Home Assistant’s gauges, to their numbers', () => {
  // the cases of Home Assistant's own tests (test/data/energy.test.ts, "Self-consumed solar gauge tests")
  it('the sun used, no battery', () => {
    expect(scores(period({}, [0], false)).sunUsed).toBeNull();
    expect(scores(period({ solar: { 0: 0 } }, [0], false)).sunUsed).toBeNull();
    expect(scores(period({ solar: { 0: 1, 1: 3 } }, [0, 1], false)).sunUsed).toBe(1);
    expect(
      scores(period({ solar: { 0: 1, 1: 3 }, to_grid: { 1: 1 } }, [0, 1], false)).sunUsed,
    ).toBe(0.75);
    expect(
      scores(period({ solar: { 0: 1, 1: 3 }, to_grid: { 0: 1, 1: 3 } }, [0, 1], false)).sunUsed,
    ).toBe(0);
  });

  it('the sun used, followed through the battery last in, first out', () => {
    expect(scores(period({ solar: { 0: 1, 1: 3 } }, [0, 1], true)).sunUsed).toBe(1);
    expect(scores(period({ solar: { 0: 1, 1: 3 }, to_grid: { 1: 1 } }, [0, 1], true)).sunUsed).toBe(
      0.75,
    );
    // a battery discharged from an unknown charge does not touch the sun's number
    expect(
      scores(
        period(
          {
            solar: { 10: 1 },
            to_grid: { 0: 1, 1: 1, 2: 1, 3: 1 },
            from_battery: { 0: 1, 1: 1, 2: 1, 3: 1 },
          },
          [0, 1, 2, 3, 10],
          true,
        ),
      ).sunUsed,
    ).toBe(1);
    expect(
      scores(
        period(
          {
            solar: { 0: 10 },
            to_battery: { 0: 10 },
            to_grid: { 1: 3, 3: 1 },
            from_battery: { 1: 3, 2: 2, 3: 2, 4: 3, 5: 100 },
          },
          [0, 1, 2, 3, 4, 5],
          true,
        ),
      ).sunUsed,
    ).toBeCloseTo(0.6, 10);
  });

  it('the sun used: Home Assistant’s complex cases', () => {
    const one = scores(
      period(
        {
          solar: { 1: 6, 2: 0, 3: 7 },
          to_battery: { 1: 5, 2: 5, 3: 7 },
          to_grid: { 0: 5, 10: 1, 11: 1, 12: 5, 13: 3 },
          from_grid: { 2: 5 },
          from_battery: { 0: 5, 10: 3, 11: 4, 12: 5, 13: 5 },
        },
        [0, 1, 2, 3, 10, 11, 12, 13],
        true,
      ),
    );
    expect(percent(one.sunUsed)).toBe(Math.round((8 / 13) * 100));
    const two = scores(
      period(
        {
          solar: { 0: 100, 2: 100 },
          to_battery: { 0: 100, 1: 100, 2: 100 },
          to_grid: { 10: 50 },
          from_grid: { 1: 100 },
          from_battery: { 10: 300 },
        },
        [0, 1, 2, 10],
        true,
      ),
    );
    expect(percent(two.sunUsed)).toBe(Math.round((150 / 200) * 100));
  });

  it('no export meter, no sun used: Home Assistant cannot calculate it either', () => {
    expect(scores(period({ solar: { 0: 4 } }, [0], false, false)).sunUsed).toBeNull();
  });

  it('self-powered: 1 − imported ÷ the hours’ use, the grid → battery counted as the grid’s', () => {
    // the approved figure's day: 4.1 in, 1.3 out, 11.2 of sun, 2.4 discharged, 3.0 charged
    const day = period(
      {
        solar: { 0: 11.2 },
        from_grid: { 0: 4.1 },
        to_grid: { 0: 1.3 },
        from_battery: { 0: 2.4 },
        to_battery: { 0: 3.0 },
      },
      [0],
      true,
    );
    const s = scores(day);
    expect(s.selfPowered).toBeCloseTo(1 - 4.1 / 13.4, 10);
    expect(s.net).toBeCloseTo(2.8, 10);
    // the sun: 6.9 to the house, 1.3 exported, 3.0 stored of which 2.4 came back to the house
    expect(s.sunUsed).toBeCloseTo(9.3 / 10.6, 10);
    expect(percent(s.sunUsed)).toBe(88);
    // a night on the grid charging the battery: imported beyond use still counts against self-sufficiency
    const night = scores(period({ from_grid: { 0: 5 }, to_battery: { 0: 3 } }, [0], true));
    expect(night.selfPowered).toBe(0);
    expect(scores(period({}, [0], false)).selfPowered).toBeNull();
  });

  it('low-carbon: 1 − fossil ÷ (imported + the sun not exported), the battery left out', () => {
    const t = { solar: 11.2, fromGrid: 4.1, toGrid: 1.3, fromBattery: 2.4, toBattery: 3.0 };
    expect(lowCarbon(t, 1.2)).toBeCloseTo(1 - 1.2 / (4.1 + 9.9), 10);
    expect(Math.round((lowCarbon(t, 1.2) ?? 0) * 100)).toBe(91);
    expect(lowCarbon({ ...t, solar: 0, fromGrid: 0 }, 0)).toBeNull();
  });
});

describe('allocatePeriod', () => {
  it('allocates hour by hour and sums, per statistic too', () => {
    const rows = {
      'sensor.grid_in': [
        { start: 0, change: 2 },
        { start: 1, change: 0 },
      ],
      'sensor.grid_out': [
        { start: 0, change: 0 },
        { start: 1, change: 1 },
      ],
      'sensor.pv': [
        { start: 0, change: 0 },
        { start: 1, change: 3 },
      ],
    };
    const p = allocatePeriod(rows, [
      { kind: 'grid', measure: null, energyIn: ['sensor.grid_in'], energyOut: ['sensor.grid_out'] },
      { kind: 'solar', measure: null, energyIn: ['sensor.pv'], energyOut: [] },
    ]);
    expect(p.totals).toMatchObject({ solar: 3, fromGrid: 2, toGrid: 1 });
    expect(p.allocation.usedTotal).toBeCloseTo(4);
    expect(p.allocation.solarToGrid).toBeCloseTo(1);
    expect(p.byStat.get('sensor.pv')).toBe(3);
    expect(p.buckets).toHaveLength(2);
  });
});

describe('readPrefs', () => {
  it('2026.3+: every grid connection on its own, two sensors kept as two', () => {
    const prefs: EnergyPrefs = {
      energy_sources: [
        {
          type: 'grid',
          name: 'Main',
          stat_energy_from: 'sensor.import',
          stat_energy_to: 'sensor.export',
          stat_rate: 'sensor.energy_grid_a_b_net_power',
          power_config: { stat_rate_from: 'sensor.p_in', stat_rate_to: 'sensor.p_out' },
        },
        {
          type: 'grid',
          stat_energy_from: null,
          stat_energy_to: 'sensor.pv_export',
          power_config: { stat_rate_inverted: 'sensor.pv_meter' },
        },
        { type: 'solar', stat_energy_from: 'sensor.pv_total', stat_rate: 'sensor.pv_power' },
        {
          type: 'battery',
          stat_energy_from: 'sensor.b_out',
          stat_energy_to: 'sensor.b_in',
          power_config: { stat_rate: 'sensor.b_power' },
          stat_soc: 'sensor.b_soc',
          capacity: 10,
        },
        { type: 'gas', stat_energy_from: 'sensor.gas' },
        { type: 'water', stat_energy_from: 'sensor.water' },
      ],
      device_consumption: [
        { stat_consumption: 'sensor.kitchen' },
        { stat_consumption: 'sensor.oven', name: 'Oven', included_in_stat: 'sensor.kitchen' },
      ],
    };
    const house = readPrefs(prefs);
    // the sun first, whatever order the dashboard keeps them in; within a kind, the dashboard's
    expect(house.sources.map((s) => s.kind)).toEqual(['solar', 'grid', 'grid', 'battery']);
    expect(house.sources[1]?.measure).toEqual({ import: 'sensor.p_in', export: 'sensor.p_out' });
    expect(house.sources[2]?.measure).toEqual({ power: ['sensor.pv_meter'], invert: true });
    expect(house.sources[3]).toMatchObject({ soc: 'sensor.b_soc', capacity: 10 });
    expect(house.devices[1]).toEqual({
      stat: 'sensor.oven',
      name: 'Oven',
      parent: 'sensor.kitchen',
    });
    expect(house.gas).toEqual(['sensor.gas']);
    expect(house.water).toEqual(['sensor.water']);
  });

  it('2025.12 – 2026.2: one grid entry, its arrays paired by index into connections', () => {
    const house = readPrefs({
      energy_sources: [
        {
          type: 'grid',
          flow_from: [{ stat_energy_from: 'sensor.in_1' }, { stat_energy_from: 'sensor.in_2' }],
          flow_to: [{ stat_energy_to: 'sensor.out_1' }],
          power: [
            { stat_rate: 'sensor.p1', power_config: { stat_rate_inverted: 'sensor.p1' } },
            { stat_rate: 'sensor.p2' },
          ],
        },
      ],
    });
    expect(house.sources).toHaveLength(2);
    expect(house.sources[0]).toMatchObject({
      energyIn: ['sensor.in_1'],
      energyOut: ['sensor.out_1'],
      measure: { power: ['sensor.p1'], invert: true },
    });
    expect(house.sources[1]).toMatchObject({
      energyIn: ['sensor.in_2'],
      energyOut: [],
      measure: { power: ['sensor.p2'] },
    });
  });

  it('before 2025.12: energy only, no power', () => {
    const house = readPrefs({
      energy_sources: [
        { type: 'grid', flow_from: [{ stat_energy_from: 'sensor.in' }], flow_to: [] },
      ],
    });
    expect(house.sources[0]).toMatchObject({ measure: null, energyIn: ['sensor.in'] });
    expect(
      prefSources({
        energy_sources: [{ type: 'grid', flow_from: [{ stat_energy_from: 'sensor.in' }] }],
      }),
    ).toEqual([]);
  });

  it('nothing configured', () => {
    expect(readPrefs(null)).toEqual({ sources: [], devices: [], gas: [], water: [] });
  });
});

describe('sources', () => {
  it("reads 1.3's flat keys as sources", () => {
    expect(
      legacySources({
        solar_power: 'sensor.pv',
        grid_power: 'sensor.grid',
        grid_invert: true,
        battery_power: 'sensor.b',
        battery_level: 'sensor.soc',
      }),
    ).toEqual([
      { type: 'solar', power: 'sensor.pv' },
      { type: 'grid', power: 'sensor.grid', invert: true },
      { type: 'battery', power: 'sensor.b', level: 'sensor.soc' },
    ]);
  });

  it('phases are summed per sign; two sensors stay two', () => {
    expect(measureOfSource({ type: 'grid', phases: ['a', 'b', 'c'] })).toEqual({
      power: ['a', 'b', 'c'],
    });
    expect(bothWays({ type: 'grid', phases: ['a', 'b', 'c'] })).toBe(true);
    expect(bothWays({ type: 'grid', import: 'i', export: 'e' })).toBe(true);
    expect(bothWays({ type: 'grid', power: 'net' })).toBe(false);
    expect(measureOfSource({ type: 'grid', import: 'i', export: 'e' })).toEqual({
      import: 'i',
      export: 'e',
    });
    expect(measureOfSource({ type: 'grid' })).toBeNull();
  });
});

describe('houseMidnight', () => {
  it("is midnight on the house's clock when Home Assistant shows the server's zone", () => {
    const hass = {
      config: { time_zone: 'Europe/Madrid' },
      locale: { time_zone: 'server' },
    } as unknown as HomeAssistant;
    const now = new Date('2026-09-30T10:30:00Z'); // 12:30 in Madrid
    expect(houseMidnight(hass, now).toISOString()).toBe('2026-09-29T22:00:00.000Z');
    expect(houseMidnight(hass, now, 6).toISOString()).toBe('2026-09-23T22:00:00.000Z');
  });
});

describe('the five-minute caches', () => {
  it('forget what is past its time, a day of keys never piling up on an open page', () => {
    const now = Date.now();
    const entries = new Map([
      ['old', { at: now - 10 * 60_000, promise: 1 }],
      ['fresh', { at: now - 60_000, promise: 2 }],
    ]);
    forgetStale(entries);
    expect([...entries.keys()]).toEqual(['fresh']);
  });

  it('a range’s readings leave out what the recorder has no mean for, its figures hold the last', async () => {
    const base = 1_700_000_000_000 - (1_700_000_000_000 % 3_600_000);
    const hass = {
      callWS: () =>
        Promise.resolve({
          'sensor.power': [
            { start: base, mean: 1 },
            { start: base + 300_000, mean: null },
            { start: base + 900_000, mean: 3 },
          ],
        }),
    } as unknown as HomeAssistant;
    const series = await fetchMeanSeries(
      hass,
      'sensor.power',
      { start: new Date(base), end: new Date(base + 1_500_000) },
      new Date(base + 1_500_000),
    );
    expect(series?.readings).toEqual([
      { t: base, v: 1 },
      { t: base + 900_000, v: 3 },
    ]);
    expect(series?.values).toEqual([1, 1, 1, 3, 3, 3]);
  });
});

describe('a range', () => {
  const sources = readPrefs({
    energy_sources: [{ type: 'grid', stat_energy_from: 'sensor.in', stat_energy_to: 'sensor.out' }],
  }).sources;
  /** Whole days on the browser's clock, ending as Home Assistant ends a range (the last day's last moment). */
  const days = (from: string, to = from): { start: Date; end: Date } => ({
    start: new Date(`${from}T00:00:00`),
    end: new Date(new Date(`${to}T00:00:00`).getTime() + 86_400_000 - 1),
  });

  it('is read in the buckets the Energy dashboard reads it in (getSuggestedPeriod)', () => {
    expect(stepFor(days('2026-09-17'))).toBe('hour');
    expect(stepFor(days('2026-09-15', '2026-09-17'))).toBe('hour'); // two full days
    expect(stepFor(days('2026-09-14', '2026-09-17'))).toBe('day');
    expect(stepFor(days('2026-09-01', '2026-09-30'))).toBe('day'); // one month: 29 days
    expect(stepFor(days('2026-08-01', '2026-09-30'))).toBe('month'); // whole months over 35 days
    expect(stepFor(days('2026-01-01', '2026-12-31'))).toBe('month');
    expect(stepFor(days('2026-08-02', '2026-09-30'))).toBe('day'); // not from the first
    expect(fullDays(days('2026-09-17').start, days('2026-09-17').end)).toBe(0);
    expect(
      fullDays(days('2026-09-14', '2026-09-20').start, days('2026-09-14', '2026-09-20').end),
    ).toBe(6);
  });

  it('opens from a period’s start and from the year’s first day', () => {
    const hass = {
      config: { time_zone: 'Europe/Madrid' },
      locale: { time_zone: 'server' },
    } as unknown as HomeAssistant;
    const now = new Date('2026-09-30T10:30:00Z');
    expect(rangeOf(hass, now, 'day')).toEqual({ start: houseMidnight(hass, now) });
    expect(rangeOf(hass, now, 'year').start.toISOString()).toBe('2025-12-31T23:00:00.000Z');
  });

  it('fetchRange sends the end when the range has one, and keeps an answer per range', async () => {
    clearPeriodCache();
    const asked: Record<string, unknown>[] = [];
    const hass = {
      callWS: async (message: Record<string, unknown>) => {
        asked.push(message);
        return {
          'sensor.in': [{ start: 1, change: 2 }],
          'sensor.out': [{ start: 1, change: 0.5 }],
        };
      },
    } as unknown as HomeAssistant;
    const week = days('2026-09-14', '2026-09-20');
    const first = await fetchRange(hass, sources, week);
    expect(first?.totals.fromGrid).toBe(2);
    expect(asked[0]).toMatchObject({
      type: 'recorder/statistics_during_period',
      start_time: week.start.toISOString(),
      end_time: week.end.toISOString(),
      period: 'day',
      statistic_ids: ['sensor.in', 'sensor.out'],
    });
    await fetchRange(hass, sources, week);
    expect(asked).toHaveLength(1);
    await fetchRange(hass, sources, days('2026-09-21', '2026-09-27'));
    expect(asked).toHaveLength(2);
    // an open range sends no end
    await fetchRange(hass, sources, { start: week.start }, [], 'day');
    expect(asked[2]).not.toHaveProperty('end_time');
  });
});
