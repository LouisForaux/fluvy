import { formatNumber, type HomeAssistant } from '@fluvy/core';
import { svg, type SVGTemplateResult } from 'lit';

/**
 * A chart's scales and its time axis: the gridlines across the plot, the tick labels right-aligned on one column 8
 * from it, the unit rotated in a 16 column beyond them (one look since 1.8, the history bars' and the energy card's),
 * and the one labeller of a window's clock — the quarters of a rolling window ending in "Now", or the round marks of
 * a window with two fixed ends.
 */

/** The rotated unit's column beside the scale, and the gap between the tick labels and the plot. */
export const UNIT_COLUMN = 16;
export const AXIS_GAP = 8;

/** A tick as a scale writes it: the house's number format, a true minus before a negative one. */
export const tickText = (
  hass: HomeAssistant | undefined,
  value: number,
  decimals: number,
): string =>
  formatNumber(hass, value, { digits: decimals, minDigits: decimals }).replace(/^-/, '−');

/**
 * A gridline at each `y` from `x1` to `x2`, on the pixel grid (a 1 px line on a half pixel is one pixel): the classic
 * dashes (`ax-grid`), or a style's hairlines (`fc-grid`, dashed with `fc-grid--dashed`).
 */
export const gridLines = (
  ys: readonly number[],
  x1: number,
  x2: number,
  className = 'ax-grid',
): SVGTemplateResult =>
  svg`${ys.map((y) => {
    const at = Math.round(y) + 0.5;
    return svg`<line class=${className} x1=${x1} x2=${x2} y1=${at} y2=${at}></line>`;
  })}`;

/** A card's own gridlines in its style: classic's dashes, a style's hairlines, dashed where the house says so. */
export const gridClass = (style: {
  readonly preset: string;
  readonly grid: { readonly kind: string };
}): string =>
  style.preset === 'classic'
    ? 'ax-grid'
    : style.grid.kind === 'dashed'
      ? 'fc-grid fc-grid--dashed'
      : 'fc-grid';

/** Tick labels ending at `x`, each centred on its `y`: a scale on the plot's start, or one ending on the card's edge. */
export const tickLabels = (
  marks: ReadonlyArray<readonly [y: number, text: string]>,
  x: number,
): SVGTemplateResult =>
  svg`${marks.map(([y, text]) => svg`<text class="ax-tick" x=${x} y=${Math.round(y) + 4} text-anchor="end">${text}</text>`)}`;

/** The unit, rotated, centred on the plot between `top` and `bottom`, in the column at the scale's outer side. */
export const unitLabel = (unit: string, top: number, bottom: number): SVGTemplateResult =>
  svg`<text class="ax-unit" transform="rotate(-90)" x=${-(top + bottom) / 2} y="11" text-anchor="middle">${unit}</text>`;

/** A label of the time axis: where it sits (a fraction of the plot's width) and what it says. */
export type TimeTick = readonly [fraction: number, text: string];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface QuartersOptions {
  /** The window's length in hours; it ends at now. */
  readonly hours: number;
  readonly now: number;
  /** The clock at an instant ("21:47"), and how long ago a day was ("2 days ago"). */
  readonly time: (t: number) => string;
  readonly daysAgo: (days: number) => string;
  readonly nowWord: string;
  /** Whether a set of labels keeps 12 between every two, as the axis places them. */
  readonly holds: (items: readonly TimeTick[]) => boolean;
}

/**
 * A rolling window's clock: the times at its quarters, ending in "Now", as many as keep 12 apart (a 12 h clock or a
 * long "Now" may leave three, or the two ends); from two days on, the days back at its ends and its middle, three
 * where they hold, else the two ends.
 */
export function quarterTicks(o: QuartersOptions): readonly TimeTick[] {
  if (o.hours >= 48) {
    const days: readonly TimeTick[] = [
      [0, o.daysAgo(o.hours / 24)],
      [0.5, o.daysAgo(o.hours / 48)],
      [1, o.nowWord],
    ];
    return o.holds(days) ? days : [days[0] as TimeTick, days[2] as TimeTick];
  }
  const at = (fraction: number): string => o.time(o.now - (1 - fraction) * o.hours * HOUR);
  const five: readonly TimeTick[] = [
    [0, at(0)],
    [0.25, at(0.25)],
    [0.5, at(0.5)],
    [0.75, at(0.75)],
    [1, o.nowWord],
  ];
  const three = [five[0], five[2], five[4]] as TimeTick[];
  const two = [five[0], five[4]] as TimeTick[];
  return [five, three, two].find((items) => o.holds(items)) ?? two;
}

export interface SlotTicksOptions {
  /** The slots' edges, the plot's two ends the first and the last. */
  readonly edges: readonly number[];
  /** The window's length in hours, as its card names it. */
  readonly hours: number;
  /** Whether its last slot holds now: the plot's end says so. */
  readonly running: boolean;
  /** The clock at an instant, how long ago a day was, the word for now. */
  readonly time: (t: number) => string;
  readonly daysAgo: (days: number) => string;
  readonly nowWord: string;
  /** Whether a set of labels keeps 12 between every two, as the axis places them. */
  readonly holds: (items: readonly TimeTick[]) => boolean;
}

/**
 * The clock of a window cut into round slots: each label on one of the slots' own edges, the times of its quarters (or
 * its days back from two days on, as `quarterTicks` writes them) ending in "Now" where the last slot holds it, else in
 * the time its last slot ends.
 */
export function slotTicks(o: SlotTicksOptions): readonly TimeTick[] {
  const count = o.edges.length - 1;
  const edge = (fraction: number): number => Math.round(fraction * count);
  const at = (index: number): TimeTick => [index / count, o.time(o.edges[index] as number)];
  const end: TimeTick = [1, o.running ? o.nowWord : o.time(o.edges[count] as number)];
  if (o.hours >= 48) {
    const days: readonly TimeTick[] = [
      [0, o.daysAgo(o.hours / 24)],
      [edge(0.5) / count, o.daysAgo(o.hours / 48)],
      end,
    ];
    return o.holds(days) ? days : [days[0] as TimeTick, end];
  }
  const five = [at(0), at(edge(0.25)), at(edge(0.5)), at(edge(0.75)), end];
  const three = [five[0], five[2], five[4]] as TimeTick[];
  const two = [five[0], five[4]] as TimeTick[];
  return [five, three, two].find((items) => o.holds(items)) ?? two;
}

export interface MarksOptions {
  readonly start: number;
  readonly end: number;
  readonly width: number;
  /** A label's width as the axis draws it. */
  readonly labelWidth: (text: string) => number;
  /** The clock, the weekday, the day and the date at an instant, in the house's words. */
  readonly time: (t: number) => string;
  readonly weekday: (t: number) => string;
  readonly day: (t: number) => string;
  readonly date: (t: number) => string;
  readonly dateYear: (t: number) => string;
}

/**
 * A window with two fixed ends: the ends first — a reader must always know where it starts and where it stops —
 * and the round marks between them (hours through a day, whole days beyond) wherever there is room for one. A mark
 * too near an end, or near the mark before it, is not drawn: two labels on top of each other read as one smudge.
 * The ends say more of themselves when the plain name would print the same words twice (a 24 h window's two
 * clocks, a year's two Septembers): the day through a short window, the year through a long one.
 */
export function roundTicks(o: MarksOptions): TimeTick[] {
  const { start, end, width } = o;
  const span = end - start;
  if (!(span > 0) || !(width > 0)) return [];
  const longWindow = span > 8 * DAY;
  const name = (t: number): string =>
    span <= 2 * DAY ? o.time(t) : longWindow ? o.date(t) : o.day(t);
  // a window of whole days ends on the last of them: the axis says what the title says
  const lastNamed = span > 2 * DAY && new Date(end).getHours() === 0 ? end - 1 : end;
  const same = name(start) === name(lastNamed);
  const endName = (t: number): string =>
    !same ? name(t) : span <= 2 * DAY ? `${o.weekday(t)} ${o.time(t)}` : o.dateYear(t);
  // a mark costs its own ink and a gap; how many read well is the width's business (one per 200 or so)
  const need = o.labelWidth(endName(end)) + 24;
  const want = Math.max(2, Math.min(6, Math.round(width / 200)));
  const marks = Math.max(1, Math.min(want, Math.floor(width / need)));
  const hours = [1, 2, 3, 4, 6, 8, 12, 24];
  const step =
    span <= 2 * DAY
      ? (hours.find((h) => span / (h * HOUR) <= marks) ?? 24) * HOUR
      : Math.max(DAY, Math.ceil(span / marks / DAY) * DAY);
  // the marks are evenly spaced by construction; only the two nearest the window's own ends give way to them
  const keep = need / width;
  const labels: TimeTick[] = [[0, endName(start)]];
  const first = new Date(start);
  if (step >= DAY) first.setHours(0, 0, 0, 0);
  else first.setMinutes(0, 0, 0);
  const lastLabel = span > 2 * DAY ? endName(lastNamed) : endName(end);
  for (let t = first.getTime(); t <= end; t += step) {
    const fraction = (t - start) / span;
    if (fraction <= keep) continue;
    if (fraction >= 1 - keep) break;
    const mark = name(t);
    // a mark that reads like one of the window's ends is that end said twice: a smudge, not a scale
    if (mark === labels[0]?.[1] || mark === lastLabel) continue;
    labels.push([fraction, mark]);
  }
  labels.push([1, lastLabel]);
  return labels;
}
