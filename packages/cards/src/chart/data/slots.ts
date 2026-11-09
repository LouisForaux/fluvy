import { houseZone, wallClock, type HomeAssistant, type PointEvery } from '@fluvy/core';
import type { Window } from '../engine/model.js';
import { EVERY, midnightOf } from '../engine/timeline.js';
import type { Reading } from './attribute.js';
import { DAY, dayStart, HOUR } from './span.js';

/*
 * A Chart card's slots on the house's clock (1.18): bars, columns, a band and a stepped line cut time into whole round
 * periods — from the house's midnight, a step apart — so a slot labelled 12:00 reads what Home Assistant says of that
 * period, where slots counted back from now blended two of its buckets. Pure, so the card and its tests share it.
 */

const MINUTE = 60_000;
/** The round lengths a slot takes, finest first: five minutes … a week. */
const ROUND_STEPS = [5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720, 1440, 2880, 4320, 10080].map(
  (m) => m * MINUTE,
);

/** A card's slots: their edges (a slot is `edges[k]` to `edges[k + 1]`) and whether they stand on the house's round times. */
export interface Grid {
  readonly edges: readonly number[];
  /** The last slot is still running: what it reads is so far. */
  readonly running: boolean;
  /** Whole round periods of the house's clock (bars, columns, a band, a step); else the window cut evenly (a line's). */
  readonly round: boolean;
}

export interface StepOptions {
  /** The window's length (ms) and the px it is drawn across. */
  readonly length: number;
  readonly width: number;
  /** The finest the readings come (ms): a statistic's bucket, a list's step, five minutes for a sensor's history. */
  readonly finest: number;
  readonly every: PointEvery;
  /** The most slots the plot shows. */
  readonly most: number;
  /** The least px a slot takes: dense data stays calm. */
  readonly gap: number;
}

/**
 * The round step of a card's slots: the finest round length the plot draws calmly (`gap` px at least) and its readings
 * come in, at most `most` of them; a step asked (`every`) wherever that holds it, else the next round one that does, a
 * whole number of it.
 */
export function roundStep(o: StepOptions): number {
  const asked = o.every === 'auto' ? 0 : EVERY[o.every];
  const least = Math.max(
    o.finest,
    asked,
    o.length / o.most,
    (o.length * o.gap) / Math.max(1, o.width),
  );
  return (
    ROUND_STEPS.find((step) => step >= least && (!asked || step % asked === 0)) ??
    (ROUND_STEPS[ROUND_STEPS.length - 1] as number)
  );
}

export interface GridOptions {
  readonly window: Window;
  readonly step: number;
  readonly hass: HomeAssistant | undefined;
  /** A statistic's hours run on the recorder's own hours: the round times are theirs (a half-hour zone's 00:30). */
  readonly hours?: boolean;
  /** A statistic's running hour is not compiled yet, so the last slot is the last whole one, none running. */
  readonly whole?: boolean;
}

/** How far along the house's clock a time is, in minutes of its day. */
function minutesOf(t: number, hass: HomeAssistant | undefined): number {
  const wall = wallClock(new Date(t), houseZone(hass));
  return wall.hour * 60 + wall.minute;
}

/**
 * The slots of a window a round `step` long, whole periods from the house's midnight: a calendar window's run from its
 * start to its end; a rolling window's as many as it holds back from the slot it ends in, which is a whole period too,
 * only still running (none running where the last whole slot ends it: `whole`). From an hour up a slot is put back on
 * its round time where a clock change moved it (the day's 25 hours keep 18:00 at 18:00), a day's on its midnight.
 */
export function roundGrid(o: GridOptions): Grid {
  const { window, step, hass } = o;
  const rolling = window.end === window.now;
  const midnight = midnightOf(hass, window.now);
  const origin = o.hours ? Math.ceil(midnight / HOUR) * HOUR : midnight;
  const count = Math.max(1, Math.round((window.end - window.start) / step));
  let end = window.end;
  if (step >= DAY) {
    const today = dayStart(hass, new Date(window.now));
    end = rolling ? (today === window.now ? today : dayStart(hass, new Date(window.now), 1)) : end;
    const days = Math.round(step / DAY);
    const edges = Array.from({ length: count + 1 }, (_unused, k) =>
      k === count ? end : dayStart(hass, new Date(end - 1), 1 - days * (count - k)),
    );
    return { edges, running: rolling && end > window.now, round: true };
  }
  const base = step >= HOUR ? minutesOf(origin, hass) : 0;
  const size = step / MINUTE;
  // a whole-hour clock change leaves a step under an hour round; one of an hour or more wants putting back
  const onClock = (t: number): number => {
    if (step < HOUR) return t;
    const over = (((minutesOf(t, hass) - base) % size) + size) % size;
    return over === 0 ? t : t + (over < size / 2 ? -over : size - over) * MINUTE;
  };
  if (rolling) {
    const ahead = (window.now - origin) / step;
    end = onClock(origin + (o.whole ? Math.floor(ahead) : Math.ceil(ahead)) * step);
    // put back on its round time, a slot may fall short of now: the one that holds it is the next
    if (!o.whole && end < window.now) end = onClock(end + step);
  }
  const edges = Array.from({ length: count + 1 }, (_unused, k) =>
    k === 0 && !rolling
      ? window.start
      : k === count
        ? end
        : onClock(rolling ? end - (count - k) * step : window.start + k * step),
  );
  return { edges, running: rolling && !o.whole && end > window.now, round: true };
}

/**
 * The slots of a statistic's own long buckets (its weeks, its months: Home Assistant's calendar, longer than a step
 * can name): those that start inside the window, the last of them running where its end is still to come.
 */
export function bucketGrid(readings: readonly Reading[], window: Window): Grid | null {
  const starts = readings.filter((r) => r.t >= window.start && r.t < window.end);
  const last = starts[starts.length - 1];
  if (!last || last.end === undefined) return null;
  return {
    edges: [...starts.map((r) => r.t), last.end],
    running: last.end > window.now,
    round: true,
  };
}
