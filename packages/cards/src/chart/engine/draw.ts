import { html, nothing, svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import { AXIS_GAP } from './axis.js';
import { columns, type Column } from './bars.js';
import { chartBubble, cursorLine, dot, knob, nowLine, point, shadowCopy } from './decor.js';
import type { ChartSeries, Curve, Stretch, Threshold } from './model.js';
import { seriesPaint, type SeriesPaint } from './palette.js';
import { areaPath, bandPath, linePath, splitAt, yAt, type Pt } from './path.js';
import { isBars, type ResolvedStyle } from './presets.js';
import {
  airScale,
  niceTicks,
  tightScale,
  yOf,
  type PlotBox,
  type Scale,
  type Ticks,
} from './scale.js';

/**
 * One chart, composed: the frame (the plot's box, its headroom and its scale's column) → the scales (the series' own
 * ends, a tenth of air, one per series, or nice ticks) → the layers (bands, fills, soft copies, lines, the forecast,
 * bars), every one clipped to the plot → the cursor → the marks on the lines (the classic dot, Fluvy's knob) and now.
 * Only the dot, the knob and the bubble stand proud of the plot, by their radius, inside the headroom. The knobs and
 * the bubble are boxes of the page in the chart's wrapper (`chartBubble`, placed on what `readAt` reads, is the
 * card's); everything else is the drawing.
 *
 * `classic` is drawn as 1.10 drew it, path for path: the lone curve on its own ends with its area down to the
 * drawing's floor, several curves each on its own aired scale, the dashed cursor at rest on the end of the line.
 */

export interface ChartFrame {
  /** The drawing's width: the plot's, plus `left` where a scale's tick labels take a column. */
  readonly width: number;
  readonly height: number;
  /** The room above the plot (the bubble's): the plot's top. */
  readonly headroom: number;
  /** The room under the plot's floor (8 by default): the line's stroke and the soft copy have it. */
  readonly pad?: number;
  /** The scale's column at the plot's start; none: its widest tick label and 8 (`measure`), on the 4 grid, where drawn. */
  readonly left?: number;
}

export interface ChartSpec {
  readonly frame: ChartFrame;
  readonly series: readonly ChartSeries[];
  readonly style: ResolvedStyle;
  /** Lines or bars; none: as the style draws (bars for `bars` and `columns`). A card of slots draws bars in any style. */
  readonly kind?: 'line' | 'bars';
  /**
   * The scale, where the style leaves it open (a nice one under a horizontal grid or bars): a lone series' own ends
   * (`tight`, the default), every series on one scale with a tenth of air (`air`, the default for several), each
   * series on its own aired scale (`own`: units differ, each line is read against its readout), or the ends given.
   */
  readonly scale?: 'tight' | 'air' | 'own' | Scale;
  /**
   * The quantity starts at zero (a counter, power, rain, a price, a percentage from nothing): its scale holds zero. A
   * measurement (a temperature, a humidity, a pressure) keeps to its own range unless its readings reach zero; bars
   * always stand on it.
   */
  readonly zero?: boolean;
  /**
   * What else a nice scale must reach: what the card draws on the same scale beside the series (the readings of lines
   * drawn over these bars, the period before as ghost columns under them).
   */
  readonly reach?: readonly number[];
  /** A nice scale a card lays itself (the usage card's, hugging its stacks on both sides of zero): drawn as given. */
  readonly ticks?: Ticks;
  /** The fraction of the plot's width the series covers: a day's axis at 21:47 → 0.908. */
  readonly extent?: number;
  /** Where now falls, as a fraction of the series: beyond it the forecast is drawn as the style says, now marked. */
  readonly now?: number | null | undefined;
  /** Where the chart is read (a fraction of the plot's width); none: at the end of what has happened. */
  readonly cursor?: number | null | undefined;
  /**
   * The scale's lines the readings are coloured from (each from its value up to the next): every line drawn again in
   * each one's ink, clipped to its stretch of the scale — split where it crosses one — and every bar in its value's.
   */
  readonly thresholds?: readonly Threshold[];
  /** Stretches of the plot marked behind everything (a window of the cheapest hours), in their tone's fill. */
  readonly stretches?: readonly Stretch[];
  /** A tick label's words, where the style draws a scale. */
  readonly tick?: (value: number, decimals: number) => string;
  /** A text's width as the card's ruler measures it at the ticks' face (11/500): the scale's column is sized by it. */
  readonly measure?: (text: string) => number;
  /** A bar's value over it, where the style writes one. */
  readonly value?: (value: number) => string;
  /** The word on the highest bar's line ("MAX"), where the style draws one. */
  readonly maxWord?: string;
  /** The ids' prefix, unique in the card's shadow root: `fv` draws the classic lone curve's `fv-fill`. */
  readonly id: string;
  /** Classes of the card's own on the drawing (`am-multi`). */
  readonly className?: string;
}

interface Laid {
  readonly bars: boolean;
  /** The scale the lines are on: nice ticks, the series' own ends, a shared one with air, one each, or given. */
  readonly scale: 'nice' | 'tight' | 'air' | 'own' | 'given';
  readonly left: number;
  readonly plotWidth: number;
  /** What the series covers of the plot's width (`extent`). */
  readonly span: number;
  readonly box: PlotBox;
  readonly scales: readonly Scale[];
  readonly ticks: Ticks | null;
  readonly count: number;
  /** A reading's slot (bars, steps), or the distance between two readings (lines). */
  readonly slot: number;
  /** A series' slot whatever the style: what a stepped one holds each of its readings across. */
  readonly heldOf: (index: number) => number;
  readonly points: ReadonlyArray<ReadonlyArray<Pt | null>>;
  /** The index of the last reading that has happened; null when the chart has no now of its own. */
  readonly nowIndex: number | null;
  /** The same for a series of its own curve and length: a stepped one counts its slots, a line its points. */
  readonly nowOf: (stepped: boolean, length?: number) => number | null;
  /** Where the chart reads at rest: the end of what has happened (a step's in its slot's middle). */
  readonly restX: number;
  readonly cursorX: number;
}

const px = (n: number): string => n.toFixed(2);
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const given = (n: number | null | undefined): n is number =>
  n !== null && n !== undefined && Number.isFinite(n);
const finite = (values: ReadonlyArray<number | null>): number[] =>
  values.filter((v): v is number => v !== null && Number.isFinite(v));

/** How a series joins its readings, and what lies under it: its own, else the style's. */
const curveOf = (spec: ChartSpec, index: number): Curve =>
  spec.series[index]?.curve ?? spec.style.curve;
const fillOf = (spec: ChartSpec, index: number): NonNullable<ChartSeries['fill']> =>
  spec.series[index]?.fill ?? spec.style.fill;
/** Whether a series holds each reading across an even slot: a step, where its readings do not stand at their own times. */
const slotted = (spec: ChartSpec, index: number): boolean =>
  curveOf(spec, index) === 'step' && !spec.series[index]?.at;

/** The lows and highs of every band the chart draws: a band is in the scale only where it is drawn. */
const bandsOf = (spec: ChartSpec, bars: boolean): number[][] =>
  bars
    ? []
    : spec.series.flatMap((s, index) =>
        s.band && fillOf(spec, index) === 'band' ? [[...s.band.low], [...s.band.high]] : [],
      );

/** The ends a nice scale must reach: every reading and band drawn, or the stacks' rises and falls for stacked columns. */
function reach(spec: ChartSpec, bars: boolean, stacked: boolean): number[] {
  const all = spec.series.map((s) => s.values);
  if (!stacked) return [...finite(all.flat()), ...bandsOf(spec, bars).flat()];
  const count = Math.max(0, ...all.map((values) => values.length));
  return Array.from({ length: count }, (_unused, i) => {
    let up = 0;
    let down = 0;
    for (const values of all) {
      const v = values[i];
      if (v === null || v === undefined || !Number.isFinite(v)) continue;
      if (v > 0) up += v;
      else down += v;
    }
    return [up, down];
  }).flat();
}

/** The frame, the scales and every series' points, as the layers and `readAt` read them. */
function layout(spec: ChartSpec, cursor: number | null | undefined): Laid {
  const { frame, style } = spec;
  const bars = spec.kind ? spec.kind === 'bars' : isBars(style.preset);
  const step = !bars && style.curve === 'step';
  const all = spec.series.map((s) => s.values);
  const count = Math.max(0, ...all.map((values) => values.length));
  // the scale: nice under a horizontal grid and under bars, else what the card asks (a lone curve on its own ends)
  let ticks: Ticks | null = null;
  let scales: Scale[];
  // bars stand on a nice scale; a scale the card names wins over the style's (several sensors keep one each)
  const wanted = bars
    ? 'nice'
    : (spec.scale ?? (style.scale === 'nice' ? 'nice' : all.length > 1 ? 'air' : 'tight'));
  if (wanted === 'nice') {
    const ends = [
      ...reach(spec, bars, bars && style.preset === 'columns' && all.length > 1),
      ...(spec.reach ?? []),
    ];
    ticks =
      spec.ticks ?? niceTicks(Math.min(...ends), Math.max(...ends), 4, bars || spec.zero === true);
    scales = all.map(() => ticks as Ticks);
  } else if (typeof wanted === 'object') scales = all.map(() => wanted);
  else if (wanted === 'own') scales = all.map((values) => airScale([values], spec.zero));
  else if (wanted === 'air') {
    const shared = airScale([...all, ...bandsOf(spec, bars)], spec.zero);
    scales = all.map(() => shared);
  } else {
    const shared = tightScale(finite(all.flat()));
    scales = all.map(() => shared);
  }
  // the scale's column: its widest label and the gap to the plot, on the 4 grid (the axis row starts where it ends)
  const measured = (t: Ticks): number => {
    const { tick, measure } = spec;
    if (!tick || !measure) return 0;
    const widest = Math.max(...t.ticks.map((value) => measure(tick(value, t.decimals))));
    return Math.ceil((widest + AXIS_GAP) / 4) * 4;
  };
  const left = frame.left ?? (ticks && style.axis && ticks.ticks.length > 1 ? measured(ticks) : 0);
  const plotWidth = Math.max(1, frame.width - left);
  const extent = spec.extent !== undefined && spec.extent > 0 ? Math.min(1, spec.extent) : 1;
  const span = Math.max(1, plotWidth * extent);
  const box: PlotBox = { top: frame.headroom, bottom: frame.height - (frame.pad ?? 8) };
  // bars and steps hold a slot each; a line's readings are its points, end to end
  const slot = count > 0 ? span / (bars || step ? count : Math.max(1, count - 1)) : span;
  // a stepped series holds each of its readings across its own slot (a day's 24 prices beside a line's 25 points)
  const heldOf = (index: number): number => span / Math.max(1, all[index]?.length ?? count);
  const points = bars
    ? all.map(() => [])
    : all.map((values, index) => {
        const scale = scales[index] as Scale;
        const last = Math.max(1, values.length - 1);
        const at = spec.series[index]?.at;
        // a step holds each reading across its slot, or until the next one where they stand at their own times
        const stepped = slotted(spec, index);
        const held = heldOf(index);
        const pts: Array<Pt | null> = values.map((v, i) =>
          v === null || !Number.isFinite(v)
            ? null
            : [
                left + (stepped ? i * held : (at ? (at[i] ?? 1) : i / last) * span),
                yOf(v, scale, box),
              ],
        );
        // a step holds its last reading across its slot: the line runs on to the slot's end
        if (stepped && pts.length) {
          const end = pts[pts.length - 1];
          pts.push(end ? [left + values.length * held, end[1]] : null);
        }
        return pts;
      });
  const f = spec.now;
  const nowOf = (stepped: boolean, length = count): number | null =>
    !given(f)
      ? null
      : stepped
        ? Math.min(length - 1, Math.max(0, Math.ceil(clamp01(f) * length) - 1))
        : Math.round(clamp01(f) * Math.max(0, length - 1));
  const nowIndex = nowOf(bars || step);
  const lastIndex = nowIndex ?? count - 1;
  // what has happened ends on the first series' last reading: one of its own times may stop short of the plot's end
  const lead = spec.series[0];
  const restAt = lead?.at
    ? lead.at.filter((_at, i) => lead.values[i] !== null && lead.values[i] !== undefined).pop()
    : undefined;
  const restX =
    bars || step
      ? left + (lastIndex + 0.5) * slot
      : nowIndex === null
        ? left + (restAt ?? 1) * span
        : left + (lastIndex / Math.max(1, count - 1)) * span;
  const cursorX = given(cursor) ? left + clamp01(cursor) * plotWidth : restX;
  return {
    bars,
    scale: typeof wanted === 'object' ? 'given' : wanted,
    left,
    plotWidth,
    span,
    box,
    scales,
    ticks,
    count,
    slot,
    heldOf,
    points,
    nowIndex,
    nowOf,
    restX,
    cursorX,
  };
}

/** Where the plot is in the drawing (its start after the scale's column, its width) and the scale it is drawn on. */
export function plotOf(spec: ChartSpec): {
  readonly left: number;
  readonly width: number;
  readonly ticks: Ticks | null;
} {
  const laid = layout(spec, null);
  return { left: laid.left, width: laid.plotWidth, ticks: laid.ticks };
}

/**
 * What a chart reads at a fraction of its plot's width (none: where it rests, at the end of what has happened): the x,
 * where each line is there (null off a line, and for bars), and the reading's index there — a bar's or a step's slot,
 * an evenly spaced line's nearest reading (a line at its own times is read by its card, `timeLine`'s `read`).
 */
export function readAt(
  spec: ChartSpec,
  fraction: number | null,
): { readonly x: number; readonly ys: ReadonlyArray<number | null>; readonly index: number } {
  const laid = layout(spec, fraction);
  // bars are read whole: the cursor snaps to its slot's middle
  const whole = laid.bars || slotted(spec, 0);
  const index = Math.min(
    Math.max(0, laid.count - 1),
    Math.max(
      0,
      whole
        ? Math.floor((laid.cursorX - laid.left) / laid.slot)
        : Math.round((laid.cursorX - laid.left) / laid.slot),
    ),
  );
  const x = laid.bars ? laid.left + (index + 0.5) * laid.slot : laid.cursorX;
  return {
    x,
    ys: laid.points.map((pts, i) => (laid.bars ? null : yAt(pts, curveOf(spec, i), x))),
    index,
  };
}

const extreme = (values: ReadonlyArray<number | null>, pick: 'min' | 'max'): number => {
  let at = -1;
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    const best = values[at];
    if (at < 0 || best === null || best === undefined || (pick === 'max' ? v > best : v < best))
      at = i;
  });
  return at;
};

/** A series' group: its tone's class, its ink, or the person's own colour as the card's accent sheet keys it. */
const paintOf = (spec: ChartSpec, index: number): SeriesPaint =>
  seriesPaint(spec.series[index]?.colour);
const painted = (
  paint: SeriesPaint,
  content: unknown,
  accent?: string,
  clip?: string,
): SVGTemplateResult =>
  svg`<g class=${paint.className || nothing} data-accent=${accent ?? nothing} style=${paint.style ?? nothing} clip-path=${clip ? `url(#${clip})` : nothing}>${content}</g>`;
const group = (spec: ChartSpec, index: number, content: unknown): SVGTemplateResult =>
  painted(paintOf(spec, index), content, spec.series[index]?.accent);

/** The thresholds from the lowest up, each with the value the next one starts at (none above the highest). */
const thresholdsOf = (spec: ChartSpec): Array<Threshold & { readonly next: number | null }> => {
  const sorted = [...(spec.thresholds ?? [])]
    .filter((t) => Number.isFinite(t.value))
    .sort((a, b) => a.value - b.value);
  return sorted.map((t, i) => ({ ...t, next: sorted[i + 1]?.value ?? null }));
};

/** The threshold a value falls in (the highest it reaches), none under the lowest: a bar's colour. */
const thresholdAt = (spec: ChartSpec, value: number): Threshold | undefined =>
  thresholdsOf(spec)
    .filter((t) => value >= t.value)
    .pop();

/**
 * A line again in each threshold's ink, clipped to its stretch of the scale (from its value up to the next one's):
 * where the readings cross a threshold the line changes colour, curve and all. The forecast keeps its dashes.
 */
function thresholdRuns(
  spec: ChartSpec,
  laid: Laid,
  index: number,
  paths: { readonly line: string; readonly forecast: string; readonly lineClass: string },
): SVGTemplateResult | typeof nothing {
  const thresholds = thresholdsOf(spec);
  if (!thresholds.length) return nothing;
  const scale = laid.scales[index] as Scale;
  const width = spec.style.line;
  return svg`${thresholds.map((t, k) => {
    const id = `${spec.id}-run-${index}-${k}`;
    // a higher value is higher on the plot: the stretch runs from the next threshold's y down to this one's
    const top = t.next === null ? 0 : Math.max(0, yOf(t.next, scale, laid.box));
    const bottom = Math.min(spec.frame.height, yOf(t.value, scale, laid.box));
    if (!(bottom > top)) return nothing;
    return svg`<defs><clipPath id=${id}><rect x="0" y=${px(top)} width=${spec.frame.width} height=${px(bottom - top)} /></clipPath></defs>${painted(
      seriesPaint(t.colour),
      svg`${paths.line ? svg`<path class="${paths.lineClass} fc-run" d=${paths.line} stroke-width=${width} pathLength="1" />` : nothing}${
        paths.forecast
          ? svg`<path class="fc-future fc-run" d=${paths.forecast} stroke-width=${width} />`
          : nothing
      }`,
      undefined,
      id,
    )}`;
  })}`;
}

/** The marked stretches of the plot (a window's cheapest hours), behind every layer, in their tone's fill. */
function stretches(spec: ChartSpec, laid: Laid): SVGTemplateResult | typeof nothing {
  if (!spec.stretches?.length) return nothing;
  return svg`${spec.stretches.map((s) => {
    const from = laid.left + clamp01(Math.min(s.from, s.to)) * laid.span;
    const to = laid.left + clamp01(Math.max(s.from, s.to)) * laid.span;
    if (!(to > from)) return nothing;
    return painted(
      seriesPaint(s.colour),
      svg`<rect class="fc-stretch" x=${px(from)} y=${laid.box.top} width=${px(to - from)} height=${laid.box.bottom - laid.box.top} />`,
    );
  })}`;
}

/** The vertical hairlines at the plot's quarters, and the horizontal ones at the ticks (the zero line strong). */
function grid(spec: ChartSpec, laid: Laid): SVGTemplateResult {
  const { style, frame } = spec;
  const axes = style.grid.axes;
  const dashed = style.grid.kind === 'dashed' ? 'fc-grid--dashed' : '';
  // a 1 px line on a half pixel is one pixel; the last one stays inside the drawing
  const at = (x: number): number => Math.min(frame.width - 0.5, Math.round(x) + 0.5);
  const x =
    axes === 'x' || axes === 'both'
      ? [0, 0.25, 0.5, 0.75, 1].map((f) => {
          const gx = at(laid.left + f * laid.plotWidth);
          return svg`<line class="fc-grid ${dashed}" x1=${gx} y1=${laid.box.top} x2=${gx} y2=${laid.box.bottom} />`;
        })
      : nothing;
  const ticks = laid.ticks;
  const y =
    ticks && ticks.ticks.length > 1
      ? ticks.ticks.flatMap((tick) => {
          // the zero line is the bars' floor: it stays when the gridlines go
          if (tick !== 0 && axes !== 'y' && axes !== 'both') return [];
          const gy = Math.round(yOf(tick, ticks, laid.box)) + 0.5;
          return [
            svg`<line class="fc-grid ${tick === 0 ? 'fc-grid--zero' : dashed}" x1=${laid.left} y1=${gy} x2=${frame.width} y2=${gy} />`,
          ];
        })
      : nothing;
  return svg`${x}${y}`;
}

/** The scale's tick labels, right-aligned on one column 8 before the plot, each centred on its tick. */
function tickColumn(spec: ChartSpec, laid: Laid): SVGTemplateResult | typeof nothing {
  const { ticks } = laid;
  const tick = spec.tick;
  if (!ticks || !tick || !(laid.left > 0) || !spec.style.axis || ticks.ticks.length < 2)
    return nothing;
  return svg`${ticks.ticks.map(
    (value) =>
      svg`<text class="fc-tick" x=${laid.left - AXIS_GAP} y=${Math.round(yOf(value, ticks, laid.box)) + 4} text-anchor="end">${tick(value, ticks.decimals)}</text>`,
  )}`;
}

/** Which bars stand out in a style that highlights (the rest go quiet): the highest, the lowest, both, or now's. */
function litBars(spec: ChartSpec, laid: Laid): (slot: number) => boolean {
  const { style } = spec;
  const first = spec.series[0]?.values ?? [];
  const maxAt = extreme(first, 'max');
  const minAt = extreme(first, 'min');
  const current = laid.nowIndex ?? laid.count - 1;
  const pick = style.bars === 'max' && style.highlight === 'none' ? 'max' : style.highlight;
  if (pick === 'none') return () => true;
  return (slot) =>
    ((pick === 'max' || pick === 'both') && slot === maxAt) ||
    ((pick === 'min' || pick === 'both') && slot === minAt) ||
    (pick === 'current' && slot === current);
}

/**
 * The bars of one or several series, clipped to the plot: the classic gradient, the ink, the quiet ones, the forecast
 * hollow. A bar that hangs from the zero line says so in its class (`fc-bar--hanging`), for a card that draws what went
 * out apart from what came in.
 */
function barsBody(spec: ChartSpec, laid: Laid, drawn: readonly Column[]): SVGTemplateResult {
  const { style } = spec;
  const lit = litBars(spec, laid);
  const highlights = style.bars === 'max' || style.highlight !== 'none';
  const gradient = `${spec.id}-bar`;
  return svg`${
    style.bars === 'gradient'
      ? svg`<defs><linearGradient id=${gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fc-bar-a" /><stop offset="1" class="fc-bar-b" /></linearGradient></defs>`
      : nothing
  }${drawn.map((c) => {
    const hollow = laid.nowIndex !== null && c.slot > laid.nowIndex;
    const quiet = !hollow && highlights && !lit(c.slot);
    // the slot still running reads so far: paler than a whole one, never hollow (it has readings)
    const soFar = spec.series[c.series]?.soFar === true && c.slot === laid.count - 1;
    const bar = svg`<path class="fc-bar ${hollow ? 'fc-bar--hollow' : quiet ? 'fc-bar--quiet' : ''} ${soFar ? 'fc-bar--sofar' : ''} ${c.sign < 0 ? 'fc-bar--hanging' : ''}" d=${c.d} fill=${style.bars === 'gradient' && !hollow ? `url(#${gradient})` : nothing} style=${`animation-delay:${c.slot * 18}ms`} />`;
    // a bar over a threshold wears its ink
    const over = thresholdAt(spec, c.value);
    return over ? painted(seriesPaint(over.colour), bar) : group(spec, c.series, bar);
  })}`;
}

/**
 * What is written over bars, outside the clip: the highest bar's dashed line and its word (the soft style), and a
 * bar's value centred over it (under a hanging one) — every bar's where a slot holds it, else only the lit ones.
 */
function barsWords(spec: ChartSpec, laid: Laid, drawn: readonly Column[]): SVGTemplateResult {
  const { style, frame } = spec;
  const lit = litBars(spec, laid);
  const first = spec.series[0]?.values ?? [];
  const maxAt = extreme(first, 'max');
  const scale = laid.scales[0] as Scale;
  const maxY =
    style.bars === 'max' && maxAt >= 0 ? yOf(first[maxAt] as number, scale, laid.box) : null;
  const highlights = style.bars === 'max' || style.highlight !== 'none';
  const shown = (c: Column): boolean => (highlights ? lit(c.slot) : laid.slot >= 30);
  const value = spec.value;
  return svg`${
    maxY === null
      ? nothing
      : svg`<line class="fc-max" x1=${laid.left} y1=${px(maxY)} x2=${frame.width} y2=${px(maxY)} />${
          spec.maxWord
            ? svg`<text class="fc-max__word" x=${frame.width} y=${px(Math.max(10, maxY - 6))} text-anchor="end">${spec.maxWord}</text>`
            : nothing
        }`
  }${
    value && spec.series.length === 1
      ? drawn
          .filter(shown)
          .map(
            (c) =>
              svg`<text class="fc-value ${highlights && lit(c.slot) ? 'is-lit' : ''}" x=${px(c.x + c.width / 2)} y=${px(c.sign > 0 ? c.y - 6 : c.y + c.height + 14)} text-anchor="middle">${value(c.value)}</text>`,
          )
      : nothing
  }`;
}

/**
 * One series' line and what lies under it (its group clips it to the plot): its band, its fill, its soft copy, the
 * line, its forecast. A series with fewer than two readings draws nothing (its readout says what there is).
 */
function lineBody(spec: ChartSpec, laid: Laid, index: number): SVGTemplateResult | typeof nothing {
  const { style, frame } = spec;
  const series = spec.series[index] as ChartSeries;
  const pts = laid.points[index] as ReadonlyArray<Pt | null>;
  const scale = laid.scales[index] as Scale;
  const several = spec.series.length > 1;
  const curve = curveOf(spec, index);
  const fill = fillOf(spec, index);
  // a slot still running reads so far: its last stretch is dashed, as what is to come, so it never reads as a whole one
  const nowIndex =
    laid.nowIndex !== null
      ? laid.nowOf(curve === 'step', series.values.length)
      : series.soFar
        ? series.values.length - 2
        : null;
  const { past, future } =
    nowIndex === null ? { past: pts, future: [] } : splitAt(pts, nowIndex, curve);
  const line = linePath(past, curve);
  const forecast = linePath(future, curve);
  if (!line && !forecast) return nothing;
  const fillId = several || spec.id !== 'fv' ? `${spec.id}-fill-${index}` : `${spec.id}-fill`;
  if (style.preset === 'classic' && (fill === 'gradient' || fill === 'none')) {
    // 1.10's curve: its area down to the drawing's floor — a lone curve's (on its own ends) written bare, as 1.0 did
    const area =
      fill === 'none'
        ? ''
        : areaPath(
            past,
            curve,
            frame.height,
            laid.scale === 'tight' ? String(frame.height) : px(frame.height),
          );
    return svg`${
      area
        ? svg`<defs><linearGradient id=${fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="curve-fill-a" /><stop offset="1" class="curve-fill-b" /></linearGradient></defs>
      <path class="curve-area" d=${area} fill=${`url(#${fillId})`} stroke="none" />`
        : nothing
    }
      <path class="curve-line" d=${line} pathLength="1" style=${style.line === 2.5 ? nothing : `stroke-width:${style.line}px`} />${
        forecast
          ? svg`<path class="fc-future" d=${forecast} stroke-width=${style.line} />`
          : nothing
      }${thresholdRuns(spec, laid, index, { line, forecast, lineClass: 'curve-line' })}`;
  }
  const xs = (pts as ReadonlyArray<Pt | null>).map((p) => p?.[0] ?? laid.left);
  const band =
    fill === 'band' && series.band
      ? bandPath(
          series.band.low.map((v, i): Pt => [xs[i] ?? laid.left, yOf(v, scale, laid.box)]),
          series.band.high.map((v, i): Pt => [xs[i] ?? laid.left, yOf(v, scale, laid.box)]),
        )
      : '';
  const filled = fill === 'gradient' || fill === 'flat';
  const area = filled ? areaPath(past, curve, laid.box.bottom) : '';
  const blurId = style.glow.kind === 'blur' ? `${spec.id}-blur-${index}` : undefined;
  return svg`${band ? svg`<path class="fc-band" d=${band} />` : nothing}${
    area && fill === 'gradient'
      ? svg`<defs><linearGradient id=${fillId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="fc-fill-a" /><stop offset="1" class="fc-fill-b" /></linearGradient></defs>
          <path class="fc-area" d=${area} fill=${`url(#${fillId})`} />`
      : area
        ? svg`<path class="fc-area fc-area--flat" d=${area} />`
        : nothing
  }${
    style.glow.kind !== 'none' && line
      ? svg`${
          blurId
            ? svg`<defs><filter id=${blurId} x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="3" /></filter></defs>`
            : nothing
        }${shadowCopy(line, {
          offset: style.glow.offset - (blurId ? 1 : 0),
          width: style.line + (blurId ? 3 : 4.5),
          opacity: style.glow.opacity,
          ...(blurId ? { blur: blurId } : {}),
        })}`
      : nothing
  }<path class="fc-line" d=${line} stroke-width=${style.line} pathLength="1" />${
    forecast
      ? svg`<path class="fc-future ${style.future === 'faint' ? 'fc-future--faint' : ''}" d=${forecast} stroke-width=${style.line} />`
      : nothing
  }${thresholdRuns(spec, laid, index, { line, forecast, lineClass: 'fc-line' })}${
    style.points === 'all'
      ? past.flatMap((p, i) =>
          p && i < series.values.length
            ? [point(slotted(spec, index) ? p[0] + laid.heldOf(index) / 2 : p[0], p[1])]
            : [],
        )
      : nothing
  }`;
}

/**
 * The chart: its drawing (`data-measure="drawn"` for the measurer) and the knobs on it. The cursor, given, draws the
 * mark of every line where it reads (the classic dot, or Fluvy's knob) and its line across the plot; at rest the
 * mark stands on the end of what has happened, the classic cursor under it. Now, where the window runs past it,
 * is a hairline with the knob on the line — one ball where the line ends.
 */
export function drawChart(spec: ChartSpec): TemplateResult {
  const { style, frame } = spec;
  const laid = layout(spec, spec.cursor);
  const clip = `${spec.id}-clip`;
  const scrubbed = given(spec.cursor);
  const several = spec.series.length > 1;
  // where each line is read: at the cursor, or at rest on the end of what has happened
  const at = scrubbed ? laid.cursorX : laid.restX;
  const ys = laid.bars ? [] : laid.points.map((pts, i) => yAt(pts, curveOf(spec, i), at));
  const marked = ys.filter((y): y is number => y !== null);
  const drawn = laid.bars
    ? columns({
        series: spec.series.map((s) => s.values),
        count: laid.count,
        left: laid.left,
        width: laid.span,
        y: (v) => yOf(v, laid.scales[0] as Scale, laid.box),
        stacked: style.preset === 'columns',
        caps: style.caps,
        least: 2,
      })
    : [];
  // now: a hairline over the plot, the knob on the first line where the style has one (and the line's end under it)
  const nowX = laid.nowIndex === null || style.now === 'none' ? null : laid.restX;
  const nowY = nowX === null || laid.bars ? null : (ys[0] ?? null);
  const knobAtNow = !scrubbed && style.now === 'knob' && nowY !== null;
  // the cursor hangs from the highest mark: under a lone dot (its stroke is the card's), from the marks of several
  const cursorTop = marked.length ? Math.min(...marked) + (several ? 0 : 7) : laid.box.top;
  const cursor =
    style.cursor === 'dashed' && !laid.bars
      ? cursorLine(laid.cursorX, Math.max(laid.box.top, cursorTop), frame.height, 'dashed')
      : scrubbed && style.cursor !== 'none'
        ? cursorLine(at, laid.box.top - 8, laid.box.bottom, 'hairline')
        : nothing;
  // each line's marks: its lowest and highest (a lone line's), and its end or its reading in its style's look
  const knobs: TemplateResult[] = [];
  const marksOf = (index: number, y: number | null): SVGTemplateResult[] => {
    const dots: SVGTemplateResult[] = [];
    if (
      !several &&
      (style.highlight === 'min' || style.highlight === 'max' || style.highlight === 'both')
    )
      for (const pick of ['min', 'max'] as const) {
        if (style.highlight !== pick && style.highlight !== 'both') continue;
        // the lowest and highest of what has happened: the forecast's are the Chart card's window to name
        const past = (spec.series[index]?.values ?? []).slice(
          0,
          (laid.nowIndex ?? laid.count - 1) + 1,
        );
        const p = laid.points[index]?.[extreme(past, pick)];
        if (p)
          dots.push(
            dot(
              slotted(spec, index) ? p[0] + laid.heldOf(index) / 2 : p[0],
              p[1],
              pick === 'min' ? 'ok' : 'danger',
            ),
          );
      }
    if (y === null || !(scrubbed || (style.points !== 'none' && !(knobAtNow && index === 0))))
      return dots;
    if (style.end === 'knob')
      knobs.push(knob(at, y, paintOf(spec, index), spec.series[index]?.accent));
    else dots.push(dot(at, y));
    return dots;
  };
  // a series is one group: its body clipped to the plot, then its marks; the cursor lies under them — inside a lone
  // line's group under its dot, before the groups of several (1.10's order, both)
  const clipped = (content: unknown): SVGTemplateResult =>
    svg`<g clip-path=${`url(#${clip})`}>${content}</g>`;
  const layers = laid.bars
    ? clipped(barsBody(spec, laid, drawn))
    : spec.series.map((_s, index) => {
        const body = lineBody(spec, laid, index);
        const marks = marksOf(index, ys[index] ?? null);
        if (body === nothing && !marks.length) return nothing;
        return group(
          spec,
          index,
          svg`${body === nothing ? nothing : clipped(body)}${several ? nothing : cursor}${marks}`,
        );
      });
  if (knobAtNow && nowX !== null && nowY !== null)
    knobs.push(knob(nowX, nowY, paintOf(spec, 0), spec.series[0]?.accent));
  return html`<svg
      class="fv-curve fc-chart ${style.preset === 'classic' ? '' : `fc-chart--${style.preset}`} ${style.animate ? '' : 'is-still'} ${spec.className ?? ''}"
      width=${frame.width}
      height=${frame.height}
      viewBox="0 0 ${frame.width} ${frame.height}"
      style=${style.preset === 'classic' ? nothing : `--fc-fill:${several && style.fill === 'gradient' ? 0.16 : style.fillOpacity}`}
      aria-hidden="true"
      data-measure="drawn"
    >
      <defs>
        <clipPath id=${clip}>
          <rect
            x=${px(laid.left - style.line / 2)}
            y="0"
            width=${px(laid.plotWidth + style.line)}
            height=${frame.height}
          />
        </clipPath>
      </defs>
      ${spec.stretches?.length ? clipped(stretches(spec, laid)) : nothing}${grid(spec, laid)}${tickColumn(spec, laid)}${several || laid.bars ? cursor : nothing}${layers}${
        laid.bars ? barsWords(spec, laid, drawn) : nothing
      }${nowX === null ? nothing : nowLine(nowX, laid.box.top - 8, laid.box.bottom)}</svg
    >${knobs}`;
}

/** What a chart's bubble says: a value, its unit and, while the chart is read, when that was. */
export interface Reading {
  readonly value: string;
  readonly unit?: string;
  readonly time?: string;
}

/**
 * A chart and its bubble: what it reads where it is read (`read`, at its cursor), else at rest what has happened
 * ends on (`rest`) where the style labels it. The bubble stands on its x: classic's leans 16 into the card's padding
 * as 1.0 drew it; a style's stays inside the plot, in the style's look.
 */
export function drawRead(
  spec: ChartSpec,
  read: Reading | null,
  rest: Reading | null,
  family?: string,
): TemplateResult {
  const { style } = spec;
  const shown = read ?? (style.label ? rest : null);
  return html`${drawChart(spec)}${
    shown
      ? chartBubble({
          x: readAt(spec, spec.cursor ?? null).x,
          width: spec.frame.width,
          value: shown.value,
          ...(shown.unit === undefined ? {} : { unit: shown.unit }),
          ...(shown.time === undefined ? {} : { time: shown.time }),
          ...(family === undefined ? {} : { family }),
          ...(style.preset === 'classic'
            ? {}
            : { lean: 0, start: plotOf(spec).left, look: style.bubble }),
        })
      : nothing
  }`;
}
