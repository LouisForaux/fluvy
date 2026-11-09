import { houseZone, localize, wallClock, type HomeAssistant, type PointEvery } from '@fluvy/core';
import { withUnit } from '../../shared/duration.js';
import type { ResolvedStyle } from './presets.js';

/**
 * A line through time (1.18): what the recorder read, laid on a window as a calm line and read back where it is
 * pointed at. The line's points stand on the house's round times (12:00, 12:30 …: its midnight and every step from
 * it), so they stay put as the window moves on; the step is the finest round one the plot draws calmly (`auto`: a few
 * pixels apart, which a thicker stroke needs more of), or the one asked (`points`), down to a pixel apart, its line
 * thinner where its points stand closer than its stroke reads. `auto` draws each point as the mean of the readings
 * around its time, a calm line; a step asked draws Home Assistant's reading at each of its times, so the line passes
 * through what Home Assistant says at 12:00. Read where it is pointed at, the line says the reading itself: the time
 * snapped to the readings' own grain (a statistic's five minutes, or what a pixel holds), and the reading in force
 * then — 12:00 is Home Assistant's 12:00, whatever the line draws there; the card's dot stands on the line.
 */

/** A reading of the recorder's: its value from `t` until the next (a state; a statistic's mean, at its bucket's start). */
export interface Timed {
  readonly t: number;
  readonly v: number;
}

const MINUTE = 60_000;
/** The round lengths a line's points stand apart, finest first: five minutes … a day. */
const STEPS = [5, 10, 15, 30, 60, 120, 180, 360, 720, 1440].map((m) => m * MINUTE);
/** The round lengths a reading's time is snapped to: a minute, then the points' own. */
const GRAINS = [MINUTE, ...STEPS];

/** A step asked, in ms. */
export const EVERY: Readonly<Record<Exclude<PointEvery, 'auto'>, number>> = {
  '5m': 5 * MINUTE,
  '15m': 15 * MINUTE,
  '30m': 30 * MINUTE,
  '1h': 60 * MINUTE,
};

/** A step as a chip or an option says it: "Automatic", "5 min", "1 h" (5分, 1時間). */
export function everyWord(
  hass: Pick<HomeAssistant, 'language'> | undefined,
  every: PointEvery,
): string {
  if (every === 'auto') return localize(hass, 'option.auto');
  const minutes = EVERY[every] / MINUTE;
  return minutes < 60
    ? withUnit(minutes, localize(hass, 'time.unit_min'))
    : withUnit(minutes / 60, localize(hass, 'time.unit_h'));
}

/** A window of hours as a chip or an option says it: "12 h", a week and longer in days ("7 d"). */
export function windowWord(
  hass: Pick<HomeAssistant, 'language'> | undefined,
  hours: number,
): string {
  const days = hours > 48 && hours % 24 === 0;
  return withUnit(days ? hours / 24 : hours, localize(hass, days ? 'time.unit_d' : 'time.unit_h'));
}

/** The air a line's points need beyond its stroke to read calm (2.5, chosen by eye), one more for a blurred glow. */
const spread = (blurred: boolean): number => 2.5 + (blurred ? 1 : 0);

/**
 * The least room between two points of a line `line` px wide, so that it reads as a calm line and not a ribbon: 4 px
 * for a thin one (1.5: minimal), 5 for the house's (2.5: classic, soft, step), 5.5 for a bold one, 6 under a blurred
 * glow — at 4 a steady temperature's tenths still shiver on a 320 card's 12 hours.
 */
export const leastGap = (line: number, blurred = false): number => line + spread(blurred);

/**
 * The stroke a line's points `gap` px apart bear: its own where they stand as far apart as it needs (`leastGap`), else
 * thinner, down to Home Assistant's own hairline of 1 px — the line of a step asked closer than the style draws calmly.
 */
export const strokeFor = (line: number, gap: number, blurred = false): number =>
  Math.min(line, Math.max(1, gap - spread(blurred)));

/**
 * How far apart a line's points stand (ms) over `length` ms drawn `width` px wide: the finest round step `gap` px apart
 * at least (`auto`), or the step asked, down to a pixel apart — never finer than the readings themselves (`finest`: a
 * statistic's bucket); where a pixel cannot hold the step asked, the next round one that it can, a whole number of
 * it, so its points stay on the times asked.
 */
export function stepOf(
  every: PointEvery,
  length: number,
  width: number,
  gap: number,
  finest = 0,
): number {
  const asked = every === 'auto' ? 0 : EVERY[every];
  const least = Math.max(asked, finest, (length * (asked ? 1 : gap)) / Math.max(1, width));
  return (
    STEPS.find((step) => step >= least && (!asked || step % asked === 0)) ??
    (STEPS[STEPS.length - 1] as number)
  );
}

/** The round length a reading's time is snapped to: the readings' own grain, or what a pixel of the plot holds. */
export const grainOf = (length: number, width: number, finest = 0): number =>
  GRAINS.find((grain) => grain >= Math.max(finest, length / Math.max(1, width))) ??
  (GRAINS[GRAINS.length - 1] as number);

/** The house's midnight on the day of `at` (the clock Home Assistant shows): where the round times are counted from. */
export function midnightOf(hass: HomeAssistant | undefined, at: number): number {
  const wall = wallClock(new Date(at), houseZone(hass));
  return at - ((wall.hour * 60 + wall.minute) * 60 + wall.second) * 1000 - (at % 1000);
}

/** The index of the last reading at or before `t`; -1 before the first. */
function indexAt(readings: readonly Timed[], t: number): number {
  let low = 0;
  let high = readings.length - 1;
  if (high < 0 || t < (readings[0] as Timed).t) return -1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if ((readings[middle] as Timed).t <= t) low = middle;
    else high = middle - 1;
  }
  return low;
}

/** The reading in force at `t` (a reading holds until the next one); none before the first. */
export const valueAt = (readings: readonly Timed[], t: number): number | null =>
  readings[indexAt(readings, t)]?.v ?? null;

/**
 * Whether the recorder has nothing at `t`: a statistic's reading is its bucket (`finest`) and no longer, so past it, with
 * a later one still to come, the line breaks as Home Assistant's does. The stretch after the last reading is no gap: its
 * buckets are not compiled yet.
 */
function inGap(readings: readonly Timed[], t: number, finest: number): boolean {
  const i = indexAt(readings, t);
  return finest > 0 && i >= 0 && i < readings.length - 1 && t - (readings[i] as Timed).t >= finest;
}

/** The mean of the readings across a stretch, each held until the next: two lookups of their running area. */
function meanOf(readings: readonly Timed[]): (from: number, to: number) => number | null {
  const area = [0];
  for (let i = 1; i < readings.length; i++) {
    const a = readings[i - 1] as Timed;
    area.push((area[i - 1] as number) + a.v * ((readings[i] as Timed).t - a.t));
  }
  const areaAt = (t: number): number => {
    const i = indexAt(readings, t);
    const r = readings[i] as Timed;
    return (area[i] as number) + r.v * (t - r.t);
  };
  return (from, to) => {
    // the stretch from the first reading on: nothing is known before it
    const a = Math.max(from, readings[0]?.t ?? Infinity);
    return to > a ? (areaAt(to) - areaAt(a)) / (to - a) : to === a ? valueAt(readings, a) : null;
  };
}

/** A line laid on a window: its values, and where each stands (a fraction of the window from its start). */
export interface Laid {
  readonly values: (number | null)[];
  readonly at: number[];
}

/**
 * The line of `readings` over a window: a point on each round time `step` apart from `origin` (the house's midnight)
 * and one on each of the window's ends — the mean of the readings within half a step of it (`mean`), else the reading
 * in force at its time. Before the first reading there is none: the line starts where its readings do; in a gap of the
 * recorder's (`inGap`) it breaks.
 */
export function layLine(
  readings: readonly Timed[],
  window: { readonly start: number; readonly end: number },
  step: number,
  origin: number,
  mean: boolean,
  finest = 0,
): Laid {
  const { start, end } = window;
  const times = [start];
  for (let t = origin + Math.ceil((start - origin) / step) * step; t < end; t += step)
    if (t > start) times.push(t);
  times.push(end);
  const around = mean ? meanOf(readings) : null;
  // a stretch that reaches into a gap stops at its edge: what the gap would hold is no reading
  const reading = (t: number, forward: boolean): number => {
    if (!inGap(readings, t, finest)) return t;
    const i = indexAt(readings, t);
    return forward ? (readings[i + 1] as Timed).t : (readings[i] as Timed).t + finest;
  };
  return {
    values: times.map((t) =>
      inGap(readings, t, finest)
        ? null
        : around
          ? around(
              reading(Math.max(start, t - step / 2), true),
              reading(Math.min(end, t + step / 2), false),
            )
          : valueAt(readings, t),
    ),
    at: times.map((t) => (t - start) / Math.max(1, end - start)),
  };
}

/**
 * What the readings say at a fraction of a window, as Home Assistant says it: the time snapped to the nearest round
 * one of `grain` (inside the window) and the reading in force then. None before the first reading.
 */
export function readLine(
  readings: readonly Timed[],
  window: { readonly start: number; readonly end: number },
  fraction: number,
  grain: number,
  origin: number,
  finest = 0,
): { readonly t: number; readonly v: number; readonly fraction: number } | null {
  const { start, end } = window;
  const pointed = start + Math.min(1, Math.max(0, fraction)) * (end - start);
  let t = origin + Math.round((pointed - origin) / grain) * grain;
  if (t > end) t -= grain;
  if (t < start) t = t + grain > end ? pointed : t + grain;
  const v = inGap(readings, t, finest) ? null : valueAt(readings, t);
  return v === null ? null : { t, v, fraction: (t - start) / Math.max(1, end - start) };
}

/** What a line is drawn in, as far as its points go: its stroke, its glow, how far apart its points stand. */
export type LineStyle = Pick<ResolvedStyle, 'line' | 'glow' | 'every'>;

/** A line through time as a card draws it: laid for its plot, and read where it is pointed at. */
export interface TimeLine<S extends LineStyle = LineStyle> extends Laid {
  /** The style it is drawn in: the card's, its stroke thinner where a step asked stands closer (`strokeFor`). */
  readonly style: S;
  /** The reading at a fraction of the window: when (snapped to the readings' grain), what, and where that is. */
  read(
    fraction: number,
  ): { readonly t: number; readonly v: number; readonly fraction: number } | null;
}

export interface TimeLineOptions<S extends LineStyle> {
  readonly readings: readonly Timed[];
  readonly start: number;
  readonly end: number;
  /** The px the window is drawn across. */
  readonly width: number;
  /** The style it is drawn in: its stroke and glow decide how close its points may stand, `every` how far they do. */
  readonly style: S;
  /** The house, whose clock the round times are on. */
  readonly hass: HomeAssistant | undefined;
  /** The finest the readings come (ms): a statistic's bucket, where a gap in the recorder breaks the line; none for a sensor's own history. */
  readonly finest?: number;
}

/**
 * The line a card draws of `readings` over its window (`layLine`, on the step `stepOf` chooses for its width and its
 * style), and how it is read (`readLine`, on the grain a pixel of it holds): one call for every card.
 */
export function timeLine<S extends LineStyle>(o: TimeLineOptions<S>): TimeLine<S> {
  const window = { start: o.start, end: o.end };
  const length = o.end - o.start;
  const blurred = o.style.glow.kind === 'blur';
  const step = stepOf(o.style.every, length, o.width, leastGap(o.style.line, blurred), o.finest);
  const origin = midnightOf(o.hass, o.end);
  const grain = grainOf(length, o.width, o.finest);
  return {
    ...layLine(o.readings, window, step, origin, o.style.every === 'auto', o.finest),
    style: {
      ...o.style,
      line: strokeFor(o.style.line, (o.width * step) / Math.max(1, length), blurred),
    },
    read: (fraction) => readLine(o.readings, window, fraction, grain, origin, o.finest),
  };
}

/**
 * A sensor's history as its card draws it (`timeLine`): the last `hours` up to `now`, ending on its reading now
 * (`live`: history is up to five minutes old), in the unit the card asks (its values times `scale`, never its reading).
 */
export function pastLine<S extends LineStyle>(
  readings: readonly Timed[],
  hours: number,
  now: number,
  width: number,
  style: S,
  hass: HomeAssistant | undefined,
  live: number | null,
  scale = 1,
): TimeLine<S> {
  const line = timeLine({ readings, start: now - hours * 3_600_000, end: now, width, style, hass });
  if (live !== null) line.values[line.values.length - 1] = live;
  return { ...line, values: line.values.map((v) => (v === null ? v : v * scale)) };
}
