import {
  fetchHistory,
  houseZone,
  wallClock,
  type HomeAssistant,
  type StatisticsRow,
} from '@fluvy/core';
import { houseMidnight } from '../energy-model/period.js';

/**
 * One day of a growing meter, hour by hour, on the house's clock: "today" begins at the midnight Home Assistant
 * shows (its zone when the user reads the server's time), whatever zone the browser is in.
 *
 * Long-term statistics first. They are read here rather than through core's `fetchStatistics`,
 * which returns the rows as a bare list: an inverter that sleeps at night leaves no row for those
 * hours, so a row belongs to the hour its `start` says — never to its position in the list.
 * Without statistics the recorder's history gives the same picture from the meter's readings.
 */

const HOUR = 3_600_000;
const BUCKET = 300_000; // history is read in five-minute steps: fine enough to find the hour boundaries

export interface DayRecord {
  /** What the meter gained in each finished hour, in the sensor's unit; null where nothing was recorded. */
  readonly hours: ReadonlyArray<number | null>;
  /** The meter's reading when the last recorded hour ended — what the hour in progress is measured from. */
  readonly baseline: number | null;
}

const ENERGY_UNITS = new Set(['Wh', 'kWh', 'MWh', 'GJ']);

/** The hour of the house's day an instant falls in (0–23). */
export const houseHour = (hass: HomeAssistant | undefined, at: Date): number =>
  wallClock(at, houseZone(hass)).hour;

/** The house's date of an instant, as a key ("2026-9-17"): a new one is a new day to read. */
export function houseDay(hass: HomeAssistant | undefined, at: Date): string {
  const wall = wallClock(at, houseZone(hass));
  return `${wall.year}-${wall.month}-${wall.day}`;
}

const finite = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) ? raw : null;

async function fromStatistics(
  hass: HomeAssistant,
  entityId: string,
  unit: string,
  now: Date,
): Promise<DayRecord | null> {
  const midnight = houseMidnight(hass, now).getTime();
  // one hour early: the last row of yesterday carries the reading the first hour of today starts from
  const result = await hass.callWS<Record<string, StatisticsRow[]>>({
    type: 'recorder/statistics_during_period',
    start_time: new Date(midnight - HOUR).toISOString(),
    end_time: now.toISOString(),
    statistic_ids: [entityId],
    period: 'hour',
    types: ['change', 'state'],
    ...(ENERGY_UNITS.has(unit) ? { units: { energy: unit } } : {}),
  });
  const rows = result[entityId] ?? [];
  if (rows.length === 0) return null;
  const hours = new Array<number | null>(24).fill(null);
  let baseline: number | null = null;
  for (const row of rows) {
    const start = finite(row.start);
    if (start === null) continue;
    if (start >= midnight) {
      const hour = houseHour(hass, new Date(start));
      const change = finite(row.change);
      if (change !== null) hours[hour] = (hours[hour] ?? 0) + Math.max(0, change); // a 25-hour day folds its repeated hour
    }
    baseline = finite(row.state) ?? baseline;
  }
  return { hours, baseline };
}

async function fromHistory(
  hass: HomeAssistant,
  entityId: string,
  now: Date,
): Promise<DayRecord | null> {
  const midnight = houseMidnight(hass, now).getTime();
  const elapsed = Math.max(BUCKET, now.getTime() - midnight);
  const count = Math.max(1, Math.round(elapsed / BUCKET));
  // a meter's reading at each step's end, never a mean: an hour is what it gained between two readings
  const series = await fetchHistory(hass, entityId, elapsed / HOUR, count, true);
  if (!series || series.values.length === 0) return null;
  const values = series.values;
  const step = elapsed / count;
  /** The reading at an instant: the last sample at or before it. */
  const at = (time: number): number =>
    values[
      Math.min(values.length - 1, Math.max(0, Math.round((time - midnight) / step) - 1))
    ] as number;
  const hours = new Array<number | null>(24).fill(null);
  const current = Math.floor(elapsed / HOUR);
  for (let hour = 0; hour < Math.min(24, current); hour++) {
    const from = at(midnight + hour * HOUR);
    const to = at(midnight + (hour + 1) * HOUR);
    hours[hour] = to >= from ? to - from : to; // a meter that reset counts again from zero
  }
  return { hours, baseline: at(midnight + current * HOUR) };
}

/**
 * The day so far — up to `now`: the clock, or the end of a day a date picker holds — or null when neither the
 * statistics nor the history know the sensor.
 */
export async function loadDay(
  hass: HomeAssistant,
  entityId: string,
  unit: string,
  now: Date,
): Promise<DayRecord | null> {
  const recorded = await fromStatistics(hass, entityId, unit, now).catch(() => null);
  return recorded ?? fromHistory(hass, entityId, now);
}

/**
 * A power sensor's day, in Wh per hour of the house's day: each compiled hour's mean power (the recorder's
 * time-weighted mean) over its hour, and the hour in progress from the five-minute statistics compiled since.
 * `null` without statistics: a power sensor's history is not integrated here.
 */
export async function loadPowerDay(
  hass: HomeAssistant,
  entityId: string,
  now: Date,
): Promise<DayRecord | null> {
  const midnight = houseMidnight(hass, now).getTime();
  const ask = (period: 'hour' | '5minute', from: number) =>
    hass.callWS<Record<string, StatisticsRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: new Date(from).toISOString(),
      end_time: now.toISOString(),
      statistic_ids: [entityId],
      period,
      types: ['mean'],
      units: { power: 'W' },
    });
  const hourly = (await ask('hour', midnight))[entityId] ?? [];
  const lastEnd = hourly.reduce(
    (end, row) => Math.max(end, finite(row.end) ?? (finite(row.start) ?? 0) + HOUR),
    midnight,
  );
  const fine = (await ask('5minute', lastEnd))[entityId] ?? [];
  if (!hourly.length && !fine.length) return null;
  const hours = new Array<number | null>(24).fill(null);
  const add = (rows: readonly StatisticsRow[], length: number): void => {
    for (const row of rows) {
      const start = finite(row.start);
      const mean = finite(row.mean);
      if (start === null || mean === null || start < midnight) continue;
      const span = ((finite(row.end) ?? start + length) - start) / HOUR;
      const hour = houseHour(hass, new Date(start));
      hours[hour] = (hours[hour] ?? 0) + Math.max(0, mean) * span;
    }
  };
  add(hourly, HOUR);
  add(fine, BUCKET);
  return { hours, baseline: null };
}
