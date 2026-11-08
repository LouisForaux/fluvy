import type { HomeAssistant } from '@fluvy/core';

/** One hour of a power sensor's long-term statistics. */
export interface HourMean {
  readonly start: number;
  readonly mean?: number | null;
}

/**
 * Whether a grid power meter counts what the house imports as negative (and exports as positive) — the
 * opposite of the flow card's convention. The energy dashboard's preferences say so when they carry the
 * grid's power sensor; when the strategy found the meter by its name instead, the last day answers it:
 * in the hours without production a house can only import, so a meter that reads mostly negative then is
 * signed the other way. Without a single dark hour (or with a battery, which can export at night) it cannot
 * tell, and keeps the card's convention.
 */
export function exportPositive(
  grid: readonly HourMean[],
  solar: readonly HourMean[] | undefined,
): boolean {
  // every array's hours: what the sun made in an hour is all of them together
  const production = new Map<number, number>();
  for (const hour of solar ?? [])
    production.set(hour.start, (production.get(hour.start) ?? 0) + Math.abs(hour.mean ?? 0));
  const peak = Math.max(0, ...production.values());
  const dark = grid.filter(
    (hour): hour is HourMean & { mean: number } =>
      typeof hour.mean === 'number' && (production.get(hour.start) ?? 0) <= peak * 0.01,
  );
  if (dark.length < 3) return false;
  return dark.filter((hour) => hour.mean < 0).length > dark.length / 2;
}

/**
 * `exportPositive` on the last 24 hours of the recorder's hourly statistics, the sun every array's; false when they
 * cannot be read.
 */
export async function gridExportPositive(
  hass: HomeAssistant,
  grid: string,
  solar: readonly string[],
): Promise<boolean> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  try {
    const stats = await hass.callWS<Record<string, readonly HourMean[] | undefined>>({
      type: 'recorder/statistics_during_period',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: [grid, ...solar],
      period: 'hour',
      types: ['mean'],
    });
    const hours = stats?.[grid];
    return Array.isArray(hours)
      ? exportPositive(hours, solar.length ? solar.flatMap((id) => stats[id] ?? []) : undefined)
      : false;
  } catch {
    return false;
  }
}
