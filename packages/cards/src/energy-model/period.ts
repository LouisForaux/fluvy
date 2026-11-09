import { houseZone, wallClock, type HomeAssistant } from '@fluvy/core';
import { allocate, sumAllocations, type Allocation, type Totals } from './allocate.js';
import type { PrefSource } from './prefs.js';

/**
 * A period's energy from Home Assistant's long-term statistics: the change of every meter per hour (a day) or per day
 * (a week, a month), allocated bucket by bucket and summed — the Energy dashboard's arithmetic, so the figures match.
 * A range is any span of time with a start and, when it is not open until now, an end: a card's own period, or the
 * one an Energy date picker holds (`collection.ts`).
 */

export type Period = 'day' | 'week' | 'month';
export const PERIODS: readonly Period[] = ['day', 'week', 'month'];

/** A span of time: from `start`, to `end` or — without one — until now. */
export interface Range {
  readonly start: Date;
  readonly end?: Date | undefined;
}

/** The buckets statistics are asked in: Home Assistant's `getSuggestedPeriod` picks among the last three. */
export type Step = '5minute' | 'hour' | 'day' | 'month';

export interface StatRow {
  readonly start: number;
  readonly change?: number | null;
}

const DAY = 86_400_000;

/** Midnight in the house's time zone (the clock Home Assistant shows), `days` ago. */
export function houseMidnight(hass: HomeAssistant | undefined, now: Date, days = 0): Date {
  const wall = wallClock(now, houseZone(hass));
  const since = ((wall.hour * 60 + wall.minute) * 60 + wall.second) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - since - days * DAY);
}

/** Where a period starts: today's midnight, a week of days, this calendar month's first day. */
export function periodStart(hass: HomeAssistant | undefined, now: Date, period: Period): Date {
  if (period === 'day') return houseMidnight(hass, now);
  if (period === 'week') return houseMidnight(hass, now, 6);
  const wall = wallClock(now, houseZone(hass));
  return houseMidnight(hass, now, wall.day - 1);
}

/** A period's range, open until now; `year`: since this calendar year's first day (the house's clock). */
export function rangeOf(
  hass: HomeAssistant | undefined,
  now: Date,
  period: Period | 'year',
): Range {
  if (period !== 'year') return { start: periodStart(hass, now, period) };
  const wall = wallClock(now, houseZone(hass));
  const days = (Date.UTC(wall.year, wall.month - 1, wall.day) - Date.UTC(wall.year, 0, 1)) / DAY;
  // from the house's noon, `days` back lands on the year's first day whatever the clock changes did; then its midnight
  const noon = houseMidnight(hass, now).getTime() + DAY / 2;
  return { start: houseMidnight(hass, new Date(noon - days * DAY)) };
}

/** The calendar day an instant falls on, as a day count (the browser's clock, as Home Assistant counts it). */
const calendarDay = (date: Date): number =>
  Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY);

/** Whole days between two instants (date-fns's `differenceInDays`: calendar days, one less when the last is not full). */
export function fullDays(start: Date, end: Date): number {
  const days = calendarDay(end) - calendarDay(start);
  const timeOfDay = (date: Date): number => date.getTime() - new Date(date).setHours(0, 0, 0, 0);
  return Math.max(0, days - (timeOfDay(end) < timeOfDay(start) ? 1 : 0));
}

/**
 * The buckets a range is read in, as the Energy dashboard reads it (`getSuggestedPeriod`): months over whole months
 * of more than 35 days, days over more than two, else hours.
 */
export function stepFor(range: Range, now = new Date()): Exclude<Step, '5minute'> {
  const end = range.end ?? now;
  const days = fullDays(range.start, end);
  const lastOfMonth = (date: Date): boolean =>
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() === date.getDate();
  if (range.start.getDate() === 1 && (!range.end || lastOfMonth(range.end)) && days > 35)
    return 'month';
  return days > 2 ? 'day' : 'hour';
}

export interface PeriodEnergy {
  readonly totals: Totals;
  readonly allocation: Allocation;
  /** kWh per statistic over the period (a device, a meter). */
  readonly byStat: ReadonlyMap<string, number>;
  /** Per bucket, oldest first: the chart's bars. */
  readonly buckets: ReadonlyArray<{ readonly start: number; readonly totals: Totals }>;
}

const cache = new Map<string, { at: number; promise: Promise<PeriodEnergy | null> }>();
const TTL = 5 * 60_000;

/** Forgets what a cache keyed on the time holds past `ttl`: a page stays open for weeks, a new key comes every five minutes. */
export function forgetStale<V>(
  entries: Map<string, { readonly at: number; readonly promise: V }>,
  ttl = TTL,
): void {
  const now = Date.now();
  for (const [key, entry] of entries) if (now - entry.at >= ttl) entries.delete(key);
}

/** The statistics of `ids` over a range, in `step` buckets: one request, kept five minutes. */
function askRange(
  hass: HomeAssistant,
  ids: readonly string[],
  range: Range,
  step: Step,
): Promise<Readonly<Record<string, readonly StatRow[]>>> {
  return hass
    .callWS<Record<string, StatRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: range.start.toISOString(),
      ...(range.end ? { end_time: range.end.toISOString() } : {}),
      statistic_ids: [...ids],
      period: step,
      types: ['change'],
      units: { energy: 'kWh' },
    })
    .then((result) => result ?? {});
}

/**
 * Fetches and allocates a range. Every source's meters (`energyIn` / `energyOut`) take part; `extra` are further
 * statistics to total (devices, gas, water). Resolves `null` when the statistics cannot be read.
 */
export function fetchRange(
  hass: HomeAssistant,
  sources: readonly PrefSource[],
  range: Range,
  extra: readonly string[] = [],
  /** The buckets: the Energy dashboard's for the range, or five minutes for a day's curve. */
  step: Step = stepFor(range),
): Promise<PeriodEnergy | null> {
  const ids = [...new Set([...sources.flatMap((s) => [...s.energyIn, ...s.energyOut]), ...extra])];
  // an open range's five-minute buckets move every five minutes: the cache keys on the bucket, not the hour
  const beat = step === '5minute' && !range.end ? `|${Math.floor(Date.now() / 300_000)}` : '';
  const key = `${range.start.toISOString()}|${range.end?.toISOString() ?? ''}|${step}${beat}|${ids.join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  if (!ids.length) return Promise.resolve(null);
  const promise = askRange(hass, ids, range, step)
    .then((rows) => allocatePeriod(rows, sources, extra))
    .catch(() => null);
  forgetStale(cache);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** A period up to now, allocated: `fetchRange` over `rangeOf`, in an hour's buckets for a day and a day's otherwise. */
export const fetchPeriod = (
  hass: HomeAssistant,
  sources: readonly PrefSource[],
  period: Period,
  now: Date,
  extra: readonly string[] = [],
  step: Step = period === 'day' ? 'hour' : 'day',
): Promise<PeriodEnergy | null> =>
  fetchRange(hass, sources, rangeOf(hass, now, period), extra, step);

/**
 * Home Assistant's own figures for a followed range (`allocatePeriod` over the collection's statistics, which carry
 * every meter the Energy dashboard knows) — and, for the statistics it did not ask for (a card's own meters), one
 * request of our own over the same range, merged in.
 */
export async function allocateFollowed(
  hass: HomeAssistant,
  stats: Readonly<Record<string, readonly StatRow[]>>,
  sources: readonly PrefSource[],
  extra: readonly string[],
  range: Range,
): Promise<PeriodEnergy> {
  const missing = extra.filter((id) => !(id in stats));
  const own = allocatePeriod(
    stats,
    sources,
    extra.filter((id) => id in stats),
  );
  if (!missing.length) return own;
  const more = await fetchRange(hass, [], range, missing);
  return more ? { ...own, byStat: new Map([...own.byStat, ...more.byStat]) } : own;
}

/** The bucket-by-bucket allocation (exported for the tests). */
export function allocatePeriod(
  rows: Readonly<Record<string, readonly StatRow[]>>,
  sources: readonly PrefSource[],
  extra: readonly string[] = [],
): PeriodEnergy {
  const starts = [...new Set(Object.values(rows).flatMap((list) => list.map((r) => r.start)))].sort(
    (a, b) => a - b,
  );
  const at = (id: string, start: number): number => {
    const row = rows[id]?.find((r) => r.start === start);
    const v = Number(row?.change ?? 0);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  };
  const sum = (ids: readonly string[], start: number): number =>
    ids.reduce((s, id) => s + at(id, start), 0);
  const of = (kind: PrefSource['kind'], side: 'energyIn' | 'energyOut'): string[] =>
    sources.filter((s) => s.kind === kind).flatMap((s) => s[side]);
  const buckets = starts.map((start) => ({
    start,
    totals: {
      solar: sum(of('solar', 'energyIn'), start),
      fromGrid: sum(of('grid', 'energyIn'), start),
      toGrid: sum(of('grid', 'energyOut'), start),
      fromBattery: sum(of('battery', 'energyIn'), start),
      toBattery: sum(of('battery', 'energyOut'), start),
    },
  }));
  const totals: Totals = buckets.reduce(
    (acc, b) => ({
      solar: acc.solar + b.totals.solar,
      fromGrid: acc.fromGrid + b.totals.fromGrid,
      toGrid: acc.toGrid + b.totals.toGrid,
      fromBattery: acc.fromBattery + b.totals.fromBattery,
      toBattery: acc.toBattery + b.totals.toBattery,
    }),
    { solar: 0, fromGrid: 0, toGrid: 0, fromBattery: 0, toBattery: 0 },
  );
  const byStat = new Map<string, number>();
  for (const id of [...new Set([...Object.keys(rows), ...extra])])
    byStat.set(
      id,
      starts.reduce((s, start) => s + at(id, start), 0),
    );
  return {
    totals,
    allocation: sumAllocations(buckets.map((b) => allocate(b.totals))),
    byStat,
    buckets,
  };
}

export const clearPeriodCache = (): void => cache.clear();
