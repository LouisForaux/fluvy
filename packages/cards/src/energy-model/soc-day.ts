import { fetchHistory, type HomeAssistant } from '@fluvy/core';
import { stateOfCharge } from '../batteries/pack.js';
import type { ChargePoint } from '../energy/stack.js';
import { forgetStale, houseMidnight } from './period.js';
import type { PrefSource } from './prefs.js';

/**
 * The batteries' state of charge over today, from the sensors the Energy dashboard names (`stat_soc`): the recorder's
 * five-minute means, or, for a sensor without long-term statistics, its history. Several batteries are one charge
 * weighted by capacity (the batteries card's rule): when two or more do not all state theirs, the group's charge is not
 * known and there is no line.
 */

interface MeanRow {
  readonly start: number;
  readonly mean?: number | null;
}

/** Each battery's readings: when (ms) and its level (%). */
export type ChargeRows = Readonly<Record<string, ReadonlyArray<readonly [number, number]>>>;

const STEP = 5 * 60_000;
const cache = new Map<string, { at: number; promise: Promise<ChargeRows | null> }>();
const TTL = 5 * 60_000;

/** The batteries that state a charge. */
export const chargedBatteries = (sources: readonly PrefSource[]): PrefSource[] =>
  sources.filter((s) => s.kind === 'battery' && s.soc);

/**
 * Today's readings of every battery's charge from the house's midnight: one request, shared by the cards that ask
 * within the same five minutes. `null` when the statistics cannot be read.
 */
export function fetchChargeDay(
  hass: HomeAssistant,
  batteries: readonly PrefSource[],
  now: Date,
): Promise<ChargeRows | null> {
  const ids = [...new Set(batteries.map((b) => b.soc).filter((id): id is string => !!id))];
  if (!ids.length) return Promise.resolve(null);
  const start = houseMidnight(hass, now);
  const key = `soc|${Math.floor(now.getTime() / STEP)}|${ids.join(',')}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const promise = hass
    .callWS<Record<string, MeanRow[]>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      statistic_ids: ids,
      period: '5minute',
      types: ['mean'],
    })
    .then(async (result) => {
      const rows: Record<string, ReadonlyArray<readonly [number, number]>> = {};
      for (const id of ids) {
        const means = (result?.[id] ?? []).flatMap((r) =>
          typeof r.mean === 'number' && Number.isFinite(r.mean)
            ? [[r.start + STEP / 2, r.mean] as const]
            : [],
        );
        rows[id] = means.length ? means : await fromHistory(hass, id, start.getTime(), now);
      }
      return rows;
    })
    .catch(() => null);
  forgetStale(cache);
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** A sensor the recorder keeps no statistics for (no `state_class`): its history, one mean per five minutes. */
async function fromHistory(
  hass: HomeAssistant,
  id: string,
  start: number,
  now: Date,
): Promise<ReadonlyArray<readonly [number, number]>> {
  const span = now.getTime() - start;
  const count = Math.max(2, Math.floor(span / STEP));
  const series = await fetchHistory(hass, id, span / 3_600_000, count);
  const values = series?.values ?? [];
  // each value is the level's mean over its own five minutes, at their middle as a statistic's is
  return values.map((level, i) => [start + ((i + 0.5) / values.length) * span, level] as const);
}

/**
 * The group's charge at each five minutes of the day (0..1 of the day): weighted by capacity, missing where any
 * battery was not read (a gap, never a guess).
 */
export function chargePoints(
  rows: ChargeRows,
  batteries: readonly PrefSource[],
  dayStart: number,
): ChargePoint[] {
  const slots = new Map<number, Map<string, number>>();
  for (const b of batteries) {
    for (const [at, level] of rows[b.soc ?? ''] ?? []) {
      const slot = Math.floor((at - dayStart) / STEP);
      if (slot < 0) continue;
      const levels = slots.get(slot) ?? new Map<string, number>();
      levels.set(b.soc ?? '', level);
      slots.set(slot, levels);
    }
  }
  return [...slots.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([slot, levels]) => {
      const level = stateOfCharge(
        batteries.map((b) => ({
          level: levels.get(b.soc ?? '') ?? null,
          capacity: b.capacity,
          charge: undefined,
        })),
      );
      return typeof level === 'number' ? [{ at: (slot + 0.5) / 288, level }] : [];
    });
}

/** The group's charge right now from the live sensors, or `null` when it cannot be known. */
export function chargeNow(
  batteries: readonly PrefSource[],
  level: (id: string) => number | null,
): number | null {
  const value = stateOfCharge(
    batteries.map((b) => ({ level: level(b.soc ?? ''), capacity: b.capacity, charge: undefined })),
  );
  return typeof value === 'number' ? value : null;
}

export const clearChargeCache = (): void => cache.clear();
