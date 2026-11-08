import { chartDefaults, houseZone, wallClock, type HomeAssistant } from '@fluvy/core';
import type { Window } from '../engine/model.js';
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
  const wall = wallClock(at, houseZone(hass));
  const since = ((wall.hour * 60 + wall.minute) * 60 + wall.second) * 1000 + at.getMilliseconds();
  const midnight = at.getTime() - since;
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

/** Where now falls in a window, as a fraction of it; null where the window ends at now (nothing after it). */
export const nowFraction = (window: Window): number | null =>
  window.now < window.end
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

/**
 * Readings laid on a window's `count` equal slots: each slot reads what was in force across it, weighted by how long
 * (an hour of four quarter prices reads their mean; a slot inside one reading reads it whole) — a reading in force
 * from its moment to its end, else to the next one, at most `hold` past it, never past `until`. A slot nothing is in
 * force across is a gap. `pick` reads another figure of a reading (its low, its high).
 */
export function slotted(
  readings: readonly Reading[],
  window: Pick<Window, 'start' | 'end'>,
  count: number,
  holding: Holding,
  pick: (reading: Reading) => number | undefined = (reading) => reading.v,
): (number | null)[] {
  const span = (window.end - window.start) / Math.max(1, count);
  const sums = new Array<number>(count).fill(0);
  const weights = new Array<number>(count).fill(0);
  readings.forEach((reading, i) => {
    const value = pick(reading);
    if (value === undefined || !Number.isFinite(value)) return;
    const next = readings[i + 1]?.t ?? Infinity;
    const end = Math.min(
      reading.end ?? Math.min(next, reading.t + holding.hold),
      holding.until ?? Infinity,
      window.end,
    );
    const from = Math.max(reading.t, window.start);
    if (!(end > from)) return;
    // the slots it lies across, each weighted by the time it holds there
    for (let k = Math.floor((from - window.start) / span); k < count; k++) {
      const a = window.start + k * span;
      if (a >= end) break;
      const weight = Math.min(end, a + span) - Math.max(from, a);
      if (weight <= 0) continue;
      sums[k] = (sums[k] as number) + value * weight;
      weights[k] = (weights[k] as number) + weight;
    }
  });
  return sums.map((sum, k) => ((weights[k] as number) > 0 ? sum / (weights[k] as number) : null));
}

/**
 * What a meter gained in each of a window's `count` slots: its reading at the slot's end less its reading at its
 * start (a fall is a reset where it only grows, `increase`: what it shows since is the gain). A slot without both
 * ends is a gap.
 */
export function gains(
  readings: readonly Reading[],
  window: Pick<Window, 'start' | 'end'>,
  count: number,
  holding: Holding,
  increase: boolean,
): (number | null)[] {
  const span = (window.end - window.start) / Math.max(1, count);
  const at = (t: number): number | null =>
    slotted(readings, { start: t, end: t + 1 }, 1, holding)[0] ?? null;
  const ends = Array.from({ length: count + 1 }, (_unused, k) =>
    at(Math.min(window.start + k * span, window.end - 1)),
  );
  return ends.slice(1).map((end, k) => {
    const start = ends[k] ?? null;
    if (end === null || start === null) return null;
    return increase && end < start ? end : end - start;
  });
}
