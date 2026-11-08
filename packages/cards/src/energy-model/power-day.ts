import { summarise, type EntityView, type HomeAssistant, type Series } from '@fluvy/core';
import type { Totals } from './allocate.js';
import { fullDays, houseMidnight, type Range } from './period.js';
import { measureIds, type PowerMeasure, type PrefSource } from './prefs.js';
import { net, readMeasure, together } from './reading.js';

/**
 * The house's day from its POWER sensors (the ones the Energy dashboard's power section names): the recorder's
 * five-minute means of every source's sensors, read the way the live diagram reads them — a signed sensor split by
 * its own sign, two sensors as in and out, the sun one way. Home Assistant draws its own "Power sources" graph from the
 * same means; energy meters that tick in coarse steps, or a hybrid inverter's AC meter counted as the sun, cannot
 * make the curve lie.
 */

interface MeanRow {
  readonly start: number;
  readonly end?: number;
  readonly mean?: number | null;
}

export type PowerRows = Readonly<Record<string, readonly MeanRow[]>>;

/** One flow of a source, toward the house (`in`) and away from it (`out`), added into the house's totals. */
export function addFlow(
  totals: Record<keyof Totals, number>,
  kind: PrefSource['kind'],
  into: number,
  out: number,
): void {
  switch (kind) {
    case 'solar':
      totals.solar += into; // the sun only gives: a negative reading at night is an inverter's own draw
      break;
    case 'grid':
      totals.fromGrid += into;
      totals.toGrid += out;
      break;
    case 'battery':
      totals.fromBattery += into;
      totals.toBattery += out;
      break;
    case 'generator':
      totals.generator += into;
      break;
    case 'vehicle':
      totals.fromVehicle += into;
      totals.toVehicle += out;
      break;
  }
}

export const zeroTotals = (): Record<keyof Totals, number> => ({
  solar: 0,
  fromGrid: 0,
  toGrid: 0,
  fromBattery: 0,
  toBattery: 0,
  generator: 0,
  fromVehicle: 0,
  toVehicle: 0,
});

/** What can flow both ways: a bucket without it is not a bucket (a gap), never a zero. */
const twoWay = (kind: PrefSource['kind']): boolean =>
  kind === 'grid' || kind === 'battery' || kind === 'vehicle';

/** Whether every source of the house says its power (the power path), and so its means can draw the day. */
export const powered = (sources: readonly PrefSource[]): boolean =>
  sources.length > 0 && sources.every((s) => measureIds(s.measure).length > 0);

/**
 * One source's flow in a bucket, from its sensors' means (kW): `null` when a sensor has no mean there. A signed sensor
 * is split by its own sign (one phase can import while another exports), `invert` flips it, two sensors are in and
 * out.
 */
function flowAt(
  measure: PowerMeasure,
  mean: (id: string) => number | null,
): { into: number; out: number } | null {
  let into = 0;
  let out = 0;
  for (const id of measure.power ?? []) {
    const m = mean(id);
    if (m === null) return null;
    const signed = measure.invert ? -m : m;
    if (signed > 0) into += signed;
    else out -= signed;
  }
  if (measure.import) {
    const m = mean(measure.import);
    if (m === null) return null;
    into += Math.max(0, m);
  }
  if (measure.export) {
    const m = mean(measure.export);
    if (m === null) return null;
    out += Math.max(0, m);
  }
  return { into, out };
}

/**
 * The day's buckets in kW, oldest first. A bucket exists only where every kind that flows both ways (the grid, a
 * battery, a car) has its means: none of a kind is a gap in the curve, one of several missing counts as nothing (a
 * battery away). The sun without a row is the sun at rest.
 */
export function powerBuckets(
  rows: PowerRows,
  sources: readonly PrefSource[],
): { start: number; totals: Totals }[] {
  const means = new Map<string, Map<number, number>>();
  for (const [id, list] of Object.entries(rows)) {
    const byStart = new Map<number, number>();
    for (const row of list) {
      const v = Number(row.mean);
      if (row.mean !== null && row.mean !== undefined && Number.isFinite(v))
        byStart.set(row.start, v);
    }
    means.set(id, byStart);
  }
  const starts = [...new Set(Object.values(rows).flatMap((list) => list.map((r) => r.start)))].sort(
    (a, b) => a - b,
  );
  const measured = sources.filter((s) => s.measure);
  const out: { start: number; totals: Totals }[] = [];
  for (const start of starts) {
    const flows = measured.map((source) => ({
      kind: source.kind,
      flow: flowAt(source.measure as PowerMeasure, (id) => means.get(id)?.get(start) ?? null),
    }));
    if (flows.some((f) => twoWay(f.kind) && !flows.some((o) => o.kind === f.kind && o.flow)))
      continue;
    const totals = zeroTotals();
    for (const { kind, flow } of flows) if (flow) addFlow(totals, kind, flow.into, flow.out);
    out.push({ start, totals });
  }
  return out;
}

const cache = new Map<string, { at: number; promise: Promise<PowerRows | null> }>();
const TTL = 5 * 60_000;

/**
 * Today's five-minute means of every power sensor of the sources, in kW, from the house's midnight: one request,
 * shared by the cards that ask within the same five minutes. `null` when the statistics cannot be read.
 */
export function fetchPowerDay(
  hass: HomeAssistant,
  sources: readonly PrefSource[],
  now: Date,
): Promise<PowerRows | null> {
  const ids = [...new Set(sources.flatMap((s) => measureIds(s.measure)))];
  if (!ids.length) return Promise.resolve(null);
  const start = houseMidnight(hass, now);
  const key = `power|${Math.floor(now.getTime() / 300_000)}|${ids.join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = hass
    .callWS<Record<string, MeanRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: ids,
      period: '5minute',
      types: ['mean'],
      units: { power: 'kW' },
    })
    .then((result) => result ?? {})
    .catch(() => null);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** The rows' bucket in minutes (five when they do not say): the recorder's `end` less its `start`. */
export function bucketMinutes(rows: PowerRows): number {
  for (const list of Object.values(rows)) {
    const row = list[0];
    if (row?.end) return Math.max(1, Math.round((row.end - row.start) / 60_000));
  }
  return 5;
}

/** A sensor's means bucket by bucket, and a bucket's length (ms): the first value is the range's first bucket. */
export interface MeanSeries extends Series {
  readonly step: number;
}

const series = new Map<string, { at: number; promise: Promise<MeanSeries | null> }>();

/**
 * A sensor's means over a range, every bucket as Home Assistant's history draws it — at its start, so 12:00 reads the
 * bucket from 12:00 to 12:05: five-minute buckets over up to two days, hours beyond, up to the last one begun by `until`
 * (the range's end, or now while it runs). A bucket the recorder has no mean for (not compiled yet, the sensor away)
 * reads the last one before it. Kept five minutes; `null` when unreadable or empty.
 */
export function fetchMeanSeries(
  hass: HomeAssistant,
  id: string,
  range: Range,
  until: Date,
): Promise<MeanSeries | null> {
  const from = range.start.getTime();
  const end = Math.min(range.end?.getTime() ?? Infinity, until.getTime());
  const key = `${id}|${from}|${Math.floor(end / 300_000)}`;
  const hit = series.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const hourly = fullDays(range.start, new Date(end)) >= 2;
  const step = hourly ? 3_600_000 : 300_000;
  const promise = hass
    .callWS<Record<string, MeanRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: range.start.toISOString(),
      end_time: new Date(end).toISOString(),
      statistic_ids: [id],
      period: hourly ? 'hour' : '5minute',
      types: ['mean'],
    })
    .then((result) => {
      const rows = (result?.[id] ?? []).filter(
        (row) => row.mean !== null && row.mean !== undefined && Number.isFinite(Number(row.mean)),
      );
      if (!rows.length) return null;
      const values: number[] = [];
      let index = 0;
      let mean = Number(rows[0]?.mean);
      for (let t = from; t <= end; t += step) {
        while (index < rows.length && (rows[index] as MeanRow).start <= t)
          mean = Number(rows[index++]?.mean);
        values.push(mean);
      }
      const summary = summarise(values);
      return summary && { ...summary, step };
    })
    .catch(() => null);
  // a running range asks again every five minutes: what is older than that goes
  for (const [k, v] of series) if (Date.now() - v.at >= TTL) series.delete(k);
  series.set(key, { at: Date.now(), promise });
  return promise;
}

/**
 * The house's flows right now, in watts, from the sources' live sensors: `null` when a kind cannot be read (a total that
 * skipped a dead sensor would be a wrong number); one of several of a kind that cannot counts as nothing (`together`).
 */
export function liveTotals(
  sources: readonly PrefSource[],
  entity: (id: string) => EntityView,
): Totals | null {
  const read = sources.flatMap((s) =>
    s.measure ? [{ kind: s.kind, d: readMeasure(s.measure, entity) }] : [],
  );
  const known = (kind: PrefSource['kind']): boolean =>
    together(read.filter((r) => r.kind === kind).map((r) => net(r.d))) !== null;
  if (!read.length || !read.every((r) => known(r.kind))) return null;
  const totals = zeroTotals();
  for (const { kind, d } of read) addFlow(totals, kind, d.in ?? 0, d.out ?? 0);
  return totals;
}
