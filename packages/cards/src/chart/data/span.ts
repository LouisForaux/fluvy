import { chartDefaults, type HomeAssistant } from '@fluvy/core';
import type { Window } from '../engine/model.js';
import { midnightOf } from '../engine/timeline.js';
import type { Reading } from './attribute.js';

/*
 * The time a Chart card covers (`span`): a rolling window ending at now — the house's (12 hours from the factory), the
 * last 24 hours, 7 days, any `<N>h` or `<N>d` — or the house's calendar day, alone or with the next one, which runs past now: what has happened, now, and
 * what is forecast or already published (tomorrow's prices) — and how readings in time lie on its equal slots, which
 * the chart engine draws. Pure, so the card and its tests share it.
 */

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** The longest rolling window a card reads: 90 days (the recorder's statistics keep years; a plot holds 192 slots). */
const LONGEST = 90 * 24;

/** A span as a card says it: rolling hours, or the house's day (`today`), or today and tomorrow. */
export interface Span {
  readonly kind: 'rolling' | 'today' | 'today+tomorrow';
  /** The rolling window's hours; a calendar span's whole length (24, 48). */
  readonly hours: number;
}

/** The span every card reads where its config names none or one it cannot read: the house's window (Charts). */
export const houseSpan = (): Span => ({ kind: 'rolling', hours: chartDefaults().settings.window });

const ROLLING = /^\s*(\d+(?:\.\d+)?)\s*([hd])\s*$/i;

/** A config's `span` read: `today`, `today+tomorrow`, `<N>h` or `<N>d` (`24h`, `7d`); anything else the house's. */
export function spanOf(raw: unknown): Span {
  if (typeof raw !== 'string') return houseSpan();
  const word = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (word === 'today') return { kind: 'today', hours: 24 };
  if (word === 'today+tomorrow') return { kind: 'today+tomorrow', hours: 48 };
  const match = ROLLING.exec(word);
  if (!match) return houseSpan();
  const hours = Number(match[1]) * ((match[2] ?? 'h').toLowerCase() === 'd' ? 24 : 1);
  return Number.isFinite(hours) && hours > 0
    ? { kind: 'rolling', hours: Math.min(LONGEST, Math.max(1, Math.round(hours))) }
    : houseSpan();
}

/** The house's midnight on the day of `at` (the clock Home Assistant shows), `days` later (or earlier). */
export function dayStart(hass: HomeAssistant | undefined, at: Date, days = 0): number {
  const midnight = midnightOf(hass, at.getTime());
  if (!days) return midnight;
  // a whole day on from midnight's noon lands in the right day whatever the clock changes do; then its midnight
  return dayStart(hass, new Date(midnight + DAY / 2 + days * DAY));
}

/**
 * The window a span covers at `now`: a rolling one ends at now; a calendar one runs from the house's midnight to the
 * end of its last day. Today and tomorrow is today alone until something reads past today's end (`latest`, the last
 * reading the series hold): before the prices of tomorrow are published, the plot is the day there is.
 */
export function windowOf(
  span: Span,
  now: Date,
  hass: HomeAssistant | undefined,
  latest?: number,
): Window {
  const at = now.getTime();
  if (span.kind === 'rolling') return { start: at - span.hours * HOUR, end: at, now: at };
  const start = dayStart(hass, now);
  const today = dayStart(hass, now, 1);
  const end =
    span.kind === 'today+tomorrow' && latest !== undefined && latest >= today
      ? dayStart(hass, now, 2)
      : today;
  return { start, end, now: at };
}

/**
 * How far back the period a card compares with lies (its head's change): a rolling window's own length, the day
 * before for the calendar's.
 */
export const previousOf = (span: Span): number =>
  span.kind === 'rolling' ? span.hours * HOUR : DAY;

/**
 * Where now falls in a window, as a fraction of it; null where the window ends at now (nothing after it), or where now
 * is in its last round slot, still running (`running`): to a chart that is the window's end.
 */
export const nowFraction = (window: Window): number | null =>
  window.now < window.end && !window.running
    ? Math.min(1, Math.max(0, (window.now - window.start) / (window.end - window.start)))
    : null;

/** The most slots a plot is read in: two days of quarter hours. */
export const MOST_SLOTS = 192;

/**
 * How long a list's readings usually last: the most common distance between two of them (a price's hour, a quarter),
 * where they say no end of their own.
 */
export function stepOf(readings: readonly Reading[]): number {
  const own = readings.find((r) => r.end !== undefined);
  if (own) return (own.end as number) - own.t;
  const gaps = readings.slice(1).map((r, i) => r.t - (readings[i] as Reading).t);
  if (!gaps.length) return HOUR;
  const counts = new Map<number, number>();
  for (const gap of gaps) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? HOUR;
}

/** How the readings of a series hold: a list's each for its own end, or its step; the recorder's until the next, never past `until` (now). */
export interface Holding {
  readonly hold: number;
  readonly until?: number;
}

/** The edges of a window's `count` equal slots: a slot is `edges[k]` to `edges[k + 1]`. */
export const evenEdges = (window: Pick<Window, 'start' | 'end'>, count: number): number[] => {
  const span = (window.end - window.start) / Math.max(1, count);
  return Array.from({ length: count + 1 }, (_unused, k) => window.start + k * span);
};

/**
 * How a slot's readings make one value: their mean, weighted by how long each held (a measurement's), their lowest or
 * their highest, a statistic's changes added up (`sum`), or the last one (a meter's running total).
 */
export type SlotRule = 'mean' | 'min' | 'max' | 'sum' | 'last';

/**
 * Readings laid on the slots between `edges`: each slot reads what was in force across it, each reading held from its
 * moment to its end, else to the next one, at most `hold` past it, never past `until`. By `rule`: their weighted mean
 * (an hour of four quarter prices reads their mean; a slot inside one reading reads it whole), their lowest, their
 * highest, the last, or what they add up to, a part of a reading where a slot takes only part of it. A slot nothing is
 * in force across is a gap. `pick` reads another figure of a reading (its low, its high).
 */
export function readSlots(
  readings: readonly Reading[],
  edges: readonly number[],
  holding: Holding,
  rule: SlotRule = 'mean',
  pick: (reading: Reading) => number | undefined = (reading) => reading.v,
): (number | null)[] {
  const count = edges.length - 1;
  const sums = new Array<number>(count).fill(0);
  const weights = new Array<number>(count).fill(0);
  const out = new Array<number | null>(count).fill(null);
  let first = 0;
  readings.forEach((reading, i) => {
    const value = pick(reading);
    if (value === undefined || !Number.isFinite(value)) return;
    const next = readings[i + 1]?.t ?? Infinity;
    const held = reading.end ?? Math.min(next, reading.t + holding.hold);
    const end = Math.min(held, holding.until ?? Infinity, edges[count] as number);
    const from = Math.max(reading.t, edges[0] as number);
    if (!(end > from)) return;
    while (first < count - 1 && (edges[first + 1] as number) <= from) first++;
    // the slots it lies across, each weighted by the time it holds there
    for (let k = first; k < count && (edges[k] as number) < end; k++) {
      const weight = Math.min(end, edges[k + 1] as number) - Math.max(from, edges[k] as number);
      if (weight <= 0) continue;
      if (rule === 'mean') {
        sums[k] = (sums[k] as number) + value * weight;
        weights[k] = (weights[k] as number) + weight;
      } else if (rule === 'sum') {
        out[k] = (out[k] ?? 0) + (value * weight) / Math.max(1, held - reading.t);
      } else if (rule === 'last') {
        out[k] = value;
      } else {
        const known = out[k] as number | null;
        out[k] = known === null ? value : (rule === 'min' ? Math.min : Math.max)(known, value);
      }
    }
  });
  return rule === 'mean'
    ? sums.map((sum, k) => ((weights[k] as number) > 0 ? sum / (weights[k] as number) : null))
    : out;
}

/**
 * Readings laid on a window's `count` equal slots (`readSlots`): each slot reads what was in force across it, weighted
 * by how long.
 */
export function slotted(
  readings: readonly Reading[],
  window: Pick<Window, 'start' | 'end'>,
  count: number,
  holding: Holding,
  pick: (reading: Reading) => number | undefined = (reading) => reading.v,
): (number | null)[] {
  return readSlots(readings, evenEdges(window, count), holding, 'mean', pick);
}

/**
 * What a meter gained across each slot between `edges`: its reading at the slot's end less its reading at its start (a
 * fall is a reset where it only grows, `increase`: what it shows since is the gain), an end read no later than `latest`
 * (what has happened). A slot without both ends is a gap.
 */
export function gains(
  readings: readonly Reading[],
  edges: readonly number[],
  holding: Holding,
  increase: boolean,
  latest: number,
): (number | null)[] {
  const at = (t: number): number | null =>
    slotted(readings, { start: t, end: t + 1 }, 1, holding)[0] ?? null;
  const ends = edges.map((edge) => at(Math.min(edge, latest - 1)));
  return ends.slice(1).map((end, k) => {
    const start = ends[k] ?? null;
    if (end === null || start === null) return null;
    return increase && end < start ? end : end - start;
  });
}
