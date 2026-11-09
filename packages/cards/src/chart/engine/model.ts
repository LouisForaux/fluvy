import type { Tone } from '@fluvy/ui';

/**
 * What a chart is drawn from: a series of readings evenly spaced across the plot (a `null` is a gap the line
 * breaks at), the window they cover and where "now" falls in it, and the colour each series wears.
 */

/** How a line joins its readings: Catmull-Rom curves, straight segments, or a value held across its slot. */
export type Curve = 'smooth' | 'straight' | 'step';

/** A reading at an instant; `null` is a gap (the recorder had nothing, the forecast ends). */
export interface ChartPoint {
  readonly t: number;
  readonly v: number | null;
}

/** The time a chart covers, and the instant it reads as now (the future begins after it). */
export interface Window {
  readonly start: number;
  readonly end: number;
  readonly now: number;
  /** A chart's slots end past now, on the round time of its last one, still running (`nowFraction`: the chart has no now of its own). */
  readonly running?: boolean;
}

/**
 * The colour of a series: one of the palette's tones, one of the six series colours the palette derives
 * (`series-1` … `series-6`, or the house's saved set's), the accent, a colour of the person's own, or one of the
 * palette's variables (the History page's graph colour of an entity, `var(--fluvy-graph-9)`).
 */
export type SeriesColour =
  Tone | `series-${1 | 2 | 3 | 4 | 5 | 6}` | 'accent' | `#${string}` | `var(--${string})`;

/** One series of a chart: its readings evenly spaced across the plot, and how it is drawn apart from the others. */
export interface ChartSeries {
  readonly values: ReadonlyArray<number | null>;
  /** Where each reading stands where they are not evenly spaced (a line through time): a fraction of what it covers. */
  readonly at?: readonly number[];
  /** Its colour; none: the chart's own (the tone its wrapper carries). */
  readonly colour?: SeriesColour;
  /** A colour of the person's, as the card's accent sheet keys it (`data-accent`): it wins over `colour`. */
  readonly accent?: string;
  readonly name?: string;
  /** What a summarised reading moved between, drawn as a band behind the line. */
  readonly band?: { readonly low: readonly number[]; readonly high: readonly number[] };
  /** How this series' line joins its readings, where it is not the style's (a price stepped beside a smooth forecast). */
  readonly curve?: Curve;
  /** Its last reading is a slot still running: what it reads is so far, drawn paler, dashed, never as a whole one. */
  readonly soFar?: boolean;
  /** What lies under this series' line, where it is not the style's: its gradient or flat fill, its band, nothing. */
  readonly fill?: 'gradient' | 'flat' | 'band' | 'none';
}

/**
 * A line of a chart's scale its readings are coloured from, upwards (a price from 0.25 in the danger's ink): what
 * runs above `value`, up to the next one, wears `colour` — the line split where it crosses it, a bar by its value.
 */
export interface Threshold {
  readonly value: number;
  readonly colour: SeriesColour;
}

/** A stretch of the plot marked behind the lines (the day's cheapest hours): its ends as fractions of what the series cover. */
export interface Stretch {
  readonly from: number;
  readonly to: number;
  readonly colour: SeriesColour;
}

/** How a slot's readings make one bar: their mean (a measurement), or what a counter gained (`change`; `increase` for
 * one that only grows, where a fall is a reset and what it shows since is the gain). */
export type BucketRule = 'mean' | 'change' | 'increase';

/**
 * Evenly spaced readings gathered into `count` bars (at most one a reading), each the slot's readings by `rule`: the
 * mean of a measurement's, or the counter's gain across its slot — from the slot before's last reading (the first
 * slot's from its own first) to its own last.
 */
export function bucket(values: readonly number[], count: number, rule: BucketRule): number[] {
  const n = values.length;
  const bars = Math.min(n, Math.max(0, Math.floor(count)));
  return Array.from({ length: bars }, (_unused, k) => {
    const from = Math.floor((k * n) / bars);
    const to = Math.floor(((k + 1) * n) / bars);
    if (rule === 'mean') {
      let sum = 0;
      for (let i = from; i < to; i++) sum += values[i] as number;
      return sum / (to - from);
    }
    const end = values[to - 1] as number;
    const gain = end - (values[Math.max(0, from - 1)] as number);
    return rule === 'increase' && gain < 0 ? end : gain;
  });
}

/** What a sensor's readings are, as its chart reads them. */
export interface Readings {
  /** They add up, so they may stand as bars: a counter, or a quantity (energy, power, rain, gas, water, a price). */
  readonly bars: boolean;
  /** The quantity starts at zero, so its scale holds it: what adds up, a battery, a bare percentage. */
  readonly zero: boolean;
  /** How a slot's readings make its bar: a counter's gain (`increase` where it only grows), else their mean. */
  readonly rule: BucketRule;
}

/** The measures that add up. A measurement of a state (a temperature, a humidity, a pressure) never does. */
const QUANTITIES = new Set([
  'energy',
  'power',
  'precipitation',
  'precipitation_intensity',
  'gas',
  'water',
  'volume',
  'monetary',
]);

/**
 * What a sensor's readings are by what Home Assistant says of it (its device and state classes, its unit): a counter
 * (`total`, `total_increasing`: a meter) reads as what it gained in each slot; a quantity adds up and starts at zero;
 * a measurement keeps to its own range, its bars would only be its line in pieces.
 */
export function readingsOf(deviceClass: unknown, stateClass: unknown, unit: unknown): Readings {
  const counter = stateClass === 'total' || stateClass === 'total_increasing';
  const bars = counter || QUANTITIES.has(String(deviceClass ?? ''));
  return {
    bars,
    zero: bars || deviceClass === 'battery' || (unit === '%' && !deviceClass),
    rule: !counter ? 'mean' : stateClass === 'total_increasing' ? 'increase' : 'change',
  };
}
