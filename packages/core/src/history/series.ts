import type { HomeAssistant } from '../ha/types.js';

/**
 * Numeric history for the curves. One WebSocket call per entity and window, cached for five
 * minutes and shared between cards, downsampled to the points a 320 px curve can show.
 */

interface RawState {
  s: string;
  lu: number;
}

export interface Series {
  readonly values: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly average: number;
  /** What the recorder read, each from its moment until the next (`fetchHistory`): what a chart draws and reads. */
  readonly readings?: readonly { readonly t: number; readonly v: number }[];
}

const TTL = 5 * 60_000;
const cache = new Map<string, { at: number; promise: Promise<Series | null> }>();

/** Remembers a fetch for the TTL — unless it fails: a dropped connection must not blank a curve for five minutes. */
function remember(key: string, promise: Promise<Series | null>): Promise<Series | null> {
  const entry = { at: Date.now(), promise };
  if (cache.size >= 200) for (const [k, v] of cache) if (entry.at - v.at >= TTL) cache.delete(k); // stale keys pile up on a wall panel (one per hour per entity)
  cache.set(key, entry);
  promise.then(
    (series) => {
      if (series === null && cache.get(key) === entry) cache.delete(key);
    },
    () => cache.delete(key),
  );
  return promise;
}

export function summarise(values: readonly number[]): Series | null {
  if (values.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { values, min, max, average: sum / values.length };
}

/**
 * Readings as `count` evenly spaced points: each the mean of what was read across its slot, a reading holding until
 * the next (the first back to the window's start), so a spike between two points is neither lost nor taken for its
 * whole slot — or, `last`, the reading at each slot's end (a meter's).
 */
export function resample(
  points: readonly { t: number; v: number }[],
  start: number,
  end: number,
  count: number,
  last = false,
): number[] {
  if (points.length === 0) return [];
  const out: number[] = [];
  const step = (end - start) / count;
  let index = 0;
  let held = points[0]!.v;
  for (let i = 1; i <= count; i++) {
    const to = start + i * step;
    let at = to - step;
    let area = 0;
    while (index < points.length && points[index]!.t <= to) {
      const { t, v } = points[index++]!;
      if (t > at) {
        area += held * (t - at);
        at = t;
      }
      held = v;
    }
    out.push(last ? held : (area + held * (to - at)) / step);
  }
  return out;
}

/**
 * A sensor's history over the last `hours` as `count` points (`resample`: means, or a meter's readings, `last`), its
 * extremes the window's own: a peak between two points is still the window's peak; and its readings as they were.
 * `at` ends it at a card's frozen now (its `_now`, a test's), where it ends now.
 */
export function fetchHistory(
  hass: HomeAssistant,
  entityId: string,
  hours = 24,
  count = 48,
  last = false,
  at?: string,
): Promise<Series | null> {
  const key = `${entityId}|${hours}|${count}|${last}|${at}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const end = at ? new Date(at) : new Date();
  const start = new Date(end.getTime() - hours * 3_600_000);
  const promise = hass
    .callWS<Record<string, RawState[]>>({
      type: 'history/history_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: [entityId],
      minimal_response: true,
      no_attributes: true,
      significant_changes_only: false,
    })
    .then((result) => {
      const points = (result?.[entityId] ?? [])
        .map((row) => ({ t: row.lu * 1000, v: /\d/.test(row.s) ? Number(row.s) : NaN })) // `Number('')` is 0: an empty state is a hole, not a zero
        .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
      const series = summarise(resample(points, start.getTime(), end.getTime(), count, last));
      const read = summarise(points.map((p) => p.v));
      return series && read && { ...series, min: read.min, max: read.max, readings: points };
    })
    .catch(() => null);
  return remember(key, promise);
}

export interface StatisticsRow {
  start: number;
  end: number;
  change?: number | null;
  mean?: number | null;
  sum?: number | null;
  state?: number | null;
}

/** Long-term statistics (hourly change for energy bars). Returns one number per period, oldest first. */
export function fetchStatistics(
  hass: HomeAssistant,
  entityId: string,
  start: Date,
  period: 'hour' | 'day' = 'hour',
  type: 'change' | 'mean' = 'change',
): Promise<readonly number[] | null> {
  const key = `stat|${entityId}|${start.toISOString().slice(0, 13)}|${period}|${type}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise.then((s) => s?.values ?? null);
  const promise = hass
    .callWS<Record<string, StatisticsRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: [entityId],
      period,
      types: [type],
    })
    .then((result) =>
      summarise(
        (result?.[entityId] ?? [])
          .map((row) => Number(row[type] ?? 0))
          .map((v) => (Number.isFinite(v) ? v : 0)),
      ),
    )
    .catch(() => null);
  return remember(key, promise).then((s) => s?.values ?? null);
}

export const clearHistoryCache = (): void => cache.clear();
