import { chartDefaults, type ChartPreset, type GaugePreset, type PointEvery } from '@fluvy/core';

/**
 * What a card says of its chart: the named style (`chart`) and the fine keys that override the style's own and the
 * house's chart settings, each a key of its own at the top level of the config, never written unless chosen. Which
 * fine keys a style acts on (the engine's `ACTS`) and which the card can draw at all (its `ChartCaps`) decide what the
 * editor offers. Every page carries this file (a card's config is typed by its keys): reading them (`CHART_KEYS`,
 * `chartKeysOf`, `styleOf`), what they do and the editor's Chart section are the chart chunk's.
 */

export type { ChartPreset, GaugePreset, PointEvery };

export type Curve = 'smooth' | 'straight' | 'step';
export type FillKind = 'gradient' | 'flat' | 'none';
export type LineWidth = 'thin' | 'regular' | 'bold';
export type Points = 'none' | 'end' | 'all';
/** The gridlines: the style's own (`auto`, or `true`), none (`false`), or which: vertical, horizontal, both. */
export type GridChoice = 'auto' | 'none' | 'x' | 'y' | 'both' | boolean;
export type Highlight = 'none' | 'min' | 'max' | 'both' | 'current';

export interface ChartKeys {
  /** The chart's style; none: the house's. */
  chart?: ChartPreset;
  curve?: Curve;
  fill?: FillKind;
  /** The line's width: `thin` (1.5), `regular` (2.5, the default) or `bold` (3). */
  line_width?: LineWidth;
  /** The soft shadow under the line (`soft` and `glow` draw one; a style without one cannot be given it). */
  glow?: boolean;
  /** The points on the line: none, the one at its end, or every reading. */
  show_points?: Points;
  show_grid?: GridChoice;
  /** The scale's tick labels beside the plot, where the style draws one. */
  show_axis?: boolean;
  /** The marker at "now", where the window runs past it. */
  show_now?: boolean;
  /** The readings marked out: the lowest, the highest, both, or the current one. */
  highlight?: Highlight;
  /** Whether this chart draws itself in and moves; none: the house's. */
  animate?: boolean;
  /** How far apart a line through time draws its points: calmly for its width (`auto`), or every 5, 15, 30 min or 1 h; none: the house's. */
  points?: PointEvery;
}

export type FineKey = Exclude<keyof ChartKeys, 'chart'>;

/** What a card (in a variant) can draw: the styles and keys it is offered follow from it. */
export interface ChartCaps {
  /** The window runs past now (a forecast, a day): a now marker and a dashed future can be drawn. */
  readonly now?: boolean;
  /** The card can draw bars and columns (it has slots, not a continuous line). */
  readonly bars?: boolean;
  /** The card has a low/high band to draw (summarised readings). */
  readonly band?: boolean;
  /** Several series share the plot: a highlight would claim to be every one of them. */
  readonly several?: boolean;
  /** The card has room for a scale's tick labels. */
  readonly axis?: boolean;
  /**
   * The styles a card draws where they are not every line style (with bars, columns and a band as the caps above
   * allow): the history bars draw classic, bars and columns; a stacked chart classic, soft and step. A style it does
   * not list is drawn classic.
   */
  readonly styles?: readonly ChartPreset[];
  /** The fine keys its chart acts on where they are not every one a style acts on: a stacked chart's line, grid and scale. */
  readonly keys?: readonly FineKey[];
  /** Its line runs through time read from the recorder: how far apart its points stand can be chosen (`points`). */
  readonly time?: boolean;
  /** The finest its readings come (ms): an hour's statistics cannot be drawn every five minutes. */
  readonly finest?: number;
}

/**
 * Whether a card drawn classic or soft alone (a distribution's stack, a list of bars) is soft: its own `chart`, else the
 * house's style — every other style draws it classic.
 */
export const softIn = (config: Readonly<Record<string, unknown>> | undefined): boolean =>
  ((config?.['chart'] as ChartPreset | undefined) ?? chartDefaults().settings.style) === 'soft';
