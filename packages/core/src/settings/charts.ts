import type { Hex } from '@fluvy/tokens/runtime';

/**
 * The house's chart settings (1.11): how every chart and gauge is drawn where a card says nothing of its own —
 * chosen once, globally, in the settings panel's Charts tab, as the theme is. A card's own key (`chart`, `gauge`,
 * a fine key, a colour) wins over them; a preset's own defaults come last. The words are the chart engine's
 * (`packages/cards/src/chart/engine/presets.ts`); the model lives here so the settings can hold it.
 */

/** The named styles a chart may be drawn in. */
export const CHART_PRESET_NAMES = [
  'classic',
  'soft',
  'glow',
  'minimal',
  'step',
  'bars',
  'columns',
  'band',
] as const;
export type ChartPreset = (typeof CHART_PRESET_NAMES)[number];

/**
 * The named styles a gauge may be drawn in: Fluvy's own controls read-only — the dial's ticks (`ticks`, the gauge
 * card's ring since 1.0), the thermostat's dial with its disc and its knob (`dial`), a ring lit to the value with the
 * knob at its end (`ring`), the ruler with its marker (`ruler`) — and the gauges that move with what they read, each
 * where it reads the sensor: a liquid (`liquid`, a percentage), the sky over the ground (`thermo`, a temperature), a
 * tank (`tank`, a level or a volume), a battery (`battery`), a pulse (`pulse`, power), the air (`air`, wind) and the
 * sun (`sun`, what the sun gives).
 */
export const GAUGE_PRESET_NAMES = [
  'ticks',
  'dial',
  'ring',
  'ruler',
  'liquid',
  'thermo',
  'tank',
  'battery',
  'pulse',
  'air',
  'sun',
] as const;
export type GaugePreset = (typeof GAUGE_PRESET_NAMES)[number];

export const CHART_LINES = ['thin', 'regular', 'bold'] as const;
export type ChartLine = (typeof CHART_LINES)[number];
export const GLOW_OFFSETS = [3, 5, 7] as const;
export type GlowOffset = (typeof GLOW_OFFSETS)[number];
export const GLOW_OPACITIES = [0.25, 0.35, 0.45] as const;
export type GlowOpacity = (typeof GLOW_OPACITIES)[number];
export const CHART_FILLS = [12, 18, 24] as const;
export type ChartFill = (typeof CHART_FILLS)[number];
export const CHART_GRIDS = ['hairline', 'dashed', 'none'] as const;
export type ChartGrid = (typeof CHART_GRIDS)[number];
export const CHART_ENDPOINTS = ['knob', 'dot'] as const;
export type ChartEndpoint = (typeof CHART_ENDPOINTS)[number];
export const BAR_CAPS = ['top', 'both'] as const;
export type BarCaps = (typeof BAR_CAPS)[number];
export const NOW_MARKERS = ['knob', 'line'] as const;
export type NowMarker = (typeof NOW_MARKERS)[number];
export const WAVE_HEIGHTS = ['low', 'mid', 'high'] as const;
export type WaveHeight = (typeof WAVE_HEIGHTS)[number];
export const BUBBLE_LOOKS = ['dark', 'tone'] as const;
export type BubbleLook = (typeof BUBBLE_LOOKS)[number];
/** How many hours of the past a chart shows (1.18): four, twelve, a day, two, a week. */
export const CHART_WINDOWS = [4, 12, 24, 48, 168] as const;
export type ChartWindow = (typeof CHART_WINDOWS)[number];
/** How far apart a line's points stand: as its width draws it calmly (`auto`), or every 5, 15 or 30 minutes or hour. */
export const POINT_EVERY = ['auto', '5m', '15m', '30m', '1h'] as const;
export type PointEvery = (typeof POINT_EVERY)[number];
/** The series colours: the palette's six derived ones, or one of the house's saved sets by its id. */
export const PALETTE_SERIES = 'palette';

export interface ChartSettings {
  readonly style: ChartPreset;
  readonly gauge: GaugePreset;
  readonly line: ChartLine;
  /** The soft style's offset copy of the line: how far under it, how strong. */
  readonly glow: { readonly offset: GlowOffset; readonly opacity: GlowOpacity };
  /** The fill under a curve, in percent of its ink at the top (`classic` keeps its own 28). */
  readonly fill: ChartFill;
  readonly grid: ChartGrid;
  /** The end of a line: Fluvy's knob (the thermostat's ball), or the classic dot. */
  readonly endpoint: ChartEndpoint;
  /** A bar rounded at its end away from the axis, or at both ends. */
  readonly caps: BarCaps;
  /** Now, where the past meets the forecast: Fluvy's knob on the line (one ball with the line's end), or a hairline. */
  readonly now: NowMarker;
  /** How tall the waves of the gauges that hold a liquid are (4, 7 or 10 px): the moving gauges' own. */
  readonly wave: WaveHeight;
  /** The value's bubble: dark (the text's ink, as 1.0 drew it) or in the series' tone. */
  readonly bubble: BubbleLook;
  /** The series colours: `palette` (the palette's six), or a saved set's id. */
  readonly series: string;
  /** Whether charts draw themselves in and the gauges that move do; off, every chart is its resting frame. */
  readonly animate: boolean;
  /** The hours a chart of the past shows where a card says none (`hours`, a Chart card's `span`). */
  readonly window: ChartWindow;
  /** How far apart a line's points stand where a card says nothing (`points`). */
  readonly points: PointEvery;
}

/**
 * A set of six series colours of the house's own, chosen like a palette. Each is a colour of the palette's
 * (`isPaletteRef`: worn as the palette and the mode have it, so the set follows them) or a hex of its own (fixed: its
 * hue kept, fitted to each mode's card).
 */
export interface SavedSeries {
  readonly id: string;
  readonly name: string;
  readonly colours: readonly (Hex | PaletteRef)[];
}
/**
 * A colour of the palette's a set or a series may name (1.11): its accent, its twelve series colours (`graph-1`…), the
 * statuses and the lit light, the energy states — the chart engine's `refInk` says which token each one is.
 */
export type PaletteRef = string;
const REF =
  /^(accent|graph-([1-9]|1[0-2])|ok|warning|danger|notice|light|solar|grid|battery|water|gas|home)$/;
export const isPaletteRef = (colour: string): boolean => REF.test(colour);
export const SERIES_COUNT = 6;
export const MAX_SAVED_SERIES = 12;

/**
 * The factory settings: `classic` everywhere, so nobody's charts change style on upgrade; the design page's knobs
 * otherwise; the last 12 hours (24 before 1.18), the points as the width draws them calmly.
 */
export const CHART_DEFAULTS: ChartSettings = {
  style: 'classic',
  gauge: 'ticks',
  line: 'regular',
  glow: { offset: 5, opacity: 0.35 },
  fill: 18,
  grid: 'hairline',
  endpoint: 'knob',
  caps: 'both',
  now: 'knob',
  wave: 'mid',
  bubble: 'dark',
  series: PALETTE_SERIES,
  animate: true,
  window: 12,
  points: 'auto',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);
const oneOfNumbers = <T extends number>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'number' && (options as readonly number[]).includes(value);
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[\w-]{1,64}$/;

/** The chart settings, field by field: anything missing, broken or unknown is the default. */
export function parseChartSettings(raw: unknown): ChartSettings {
  const value = isRecord(raw) ? raw : {};
  const glow = isRecord(value['glow']) ? value['glow'] : {};
  const d = CHART_DEFAULTS;
  return {
    style: oneOf(value['style'], CHART_PRESET_NAMES) ? value['style'] : d.style,
    gauge: oneOf(value['gauge'], GAUGE_PRESET_NAMES) ? value['gauge'] : d.gauge,
    line: oneOf(value['line'], CHART_LINES) ? value['line'] : d.line,
    glow: {
      offset: oneOfNumbers(glow['offset'], GLOW_OFFSETS) ? glow['offset'] : d.glow.offset,
      opacity: oneOfNumbers(glow['opacity'], GLOW_OPACITIES) ? glow['opacity'] : d.glow.opacity,
    },
    fill: oneOfNumbers(value['fill'], CHART_FILLS) ? value['fill'] : d.fill,
    grid: oneOf(value['grid'], CHART_GRIDS) ? value['grid'] : d.grid,
    endpoint: oneOf(value['endpoint'], CHART_ENDPOINTS) ? value['endpoint'] : d.endpoint,
    caps: oneOf(value['caps'], BAR_CAPS) ? value['caps'] : d.caps,
    now: oneOf(value['now'], NOW_MARKERS) ? value['now'] : d.now,
    wave: oneOf(value['wave'], WAVE_HEIGHTS) ? value['wave'] : d.wave,
    bubble: oneOf(value['bubble'], BUBBLE_LOOKS) ? value['bubble'] : d.bubble,
    series:
      typeof value['series'] === 'string' && ID.test(value['series']) ? value['series'] : d.series,
    animate: typeof value['animate'] === 'boolean' ? value['animate'] : d.animate,
    window: oneOfNumbers(value['window'], CHART_WINDOWS) ? value['window'] : d.window,
    points: oneOf(value['points'], POINT_EVERY) ? value['points'] : d.points,
  };
}

/**
 * A saved set of series colours: an id, a name and six colours, or nothing. A colour is a hex or a colour of the
 * palette's; anything else is the palette's own series colour in its place.
 */
export function parseSavedSeriesSet(raw: unknown): SavedSeries | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, name, colours } = raw;
  if (typeof id !== 'string' || !ID.test(id) || typeof name !== 'string' || !name.trim())
    return undefined;
  if (!Array.isArray(colours) || colours.length !== SERIES_COUNT) return undefined;
  return {
    id,
    name: name.trim(),
    colours: colours.map((c: unknown, n) =>
      typeof c === 'string' && (HEX.test(c) || isPaletteRef(c))
        ? c.toLowerCase()
        : `graph-${n + 1}`,
    ),
  };
}

/** The house's saved series sets: the well-formed ones, the first of each id, twelve at most. */
export function parseSavedSeries(raw: unknown): SavedSeries[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedSeries[] = [];
  for (const entry of raw) {
    const set = parseSavedSeriesSet(entry);
    if (set && !out.some((kept) => kept.id === set.id)) out.push(set);
    if (out.length === MAX_SAVED_SERIES) break;
  }
  return out;
}
