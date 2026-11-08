import {
  chartDefaults,
  type ChartPreset,
  type ChartSettings,
  type GaugePreset,
  type PointEvery,
} from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import {
  type ChartCaps,
  type ChartKeys,
  type Curve,
  type FineKey,
  type Highlight,
} from '../../shared/chart-config.js';

/**
 * The named styles (the approved design, 2026-10-26): what each draws, and one rule that resolves a card's style —
 * the card's own key › the house's chart settings › the style's own default. A card with no `chart` key draws the
 * house's style; one that says `chart: classic` keeps classic whatever the house says. `classic` is 1.10's chart and
 * takes nothing from the house but its colours: a house that never chose a style changes nothing on any dashboard.
 */

export interface PresetSpec {
  readonly curve: Curve;
  readonly fill: 'gradient' | 'flat' | 'band' | 'none';
  /** The line's width: the house's (`regular`, 2.5), or one step thinner. */
  readonly line: 'regular' | 'thin';
  readonly glow: 'none' | 'soft' | 'blur';
  /** The end of the line: the classic dot, the house's end (Fluvy's knob, or the dot), or nothing. */
  readonly end: 'dot' | 'house' | 'none';
  /** The gridlines it draws; a horizontal one puts the chart on a nice scale (zero a tick). */
  readonly grid: 'none' | 'x' | 'y' | 'both';
  /** Whether it marks now where the window runs past it. */
  readonly now: boolean;
  /** How the forecast is drawn beyond now. */
  readonly future: 'dashed' | 'faint' | 'hollow';
  /** The cursor while the chart is read: the classic dashes (drawn at rest too), a hairline, none, a bar's slot. */
  readonly cursor: 'dashed' | 'hairline' | 'none' | 'snap';
  /** Whether the value's bubble stands over the line at rest (every style shows it while the chart is read). */
  readonly label: boolean;
  readonly highlight: Highlight;
  /** How bars are filled: the classic gradient, the ink with the highest in ink and the rest quiet, or the ink alone. */
  readonly bars: 'gradient' | 'max' | 'ink';
}

export const CHART_PRESETS: Readonly<Record<ChartPreset, PresetSpec>> = {
  classic: {
    curve: 'smooth',
    fill: 'gradient',
    line: 'regular',
    glow: 'none',
    end: 'dot',
    grid: 'none',
    now: false,
    future: 'dashed',
    cursor: 'dashed',
    label: true,
    highlight: 'none',
    bars: 'gradient',
  },
  soft: {
    curve: 'smooth',
    fill: 'gradient',
    line: 'regular',
    glow: 'soft',
    end: 'house',
    grid: 'x',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'none',
    bars: 'max',
  },
  glow: {
    curve: 'smooth',
    fill: 'none',
    line: 'regular',
    glow: 'blur',
    end: 'house',
    grid: 'none',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'none',
    bars: 'ink',
  },
  minimal: {
    curve: 'smooth',
    fill: 'none',
    line: 'thin',
    glow: 'none',
    end: 'dot',
    grid: 'none',
    now: false,
    future: 'faint',
    cursor: 'none',
    label: false,
    highlight: 'none',
    bars: 'ink',
  },
  step: {
    curve: 'step',
    fill: 'flat',
    line: 'regular',
    glow: 'none',
    end: 'none',
    grid: 'y',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'both',
    bars: 'ink',
  },
  bars: {
    curve: 'straight',
    fill: 'none',
    line: 'regular',
    glow: 'none',
    end: 'none',
    grid: 'y',
    now: true,
    future: 'hollow',
    cursor: 'snap',
    label: false,
    highlight: 'none',
    bars: 'ink',
  },
  columns: {
    curve: 'straight',
    fill: 'none',
    line: 'regular',
    glow: 'none',
    end: 'none',
    grid: 'y',
    now: true,
    future: 'hollow',
    cursor: 'snap',
    label: false,
    highlight: 'none',
    bars: 'ink',
  },
  band: {
    curve: 'straight',
    fill: 'band',
    line: 'regular',
    glow: 'none',
    end: 'dot',
    grid: 'y',
    now: true,
    future: 'dashed',
    cursor: 'hairline',
    label: true,
    highlight: 'none',
    bars: 'ink',
  },
};

/** Every chart key, in the editor's order. */
export const CHART_KEYS = [
  'chart',
  'curve',
  'fill',
  'line_width',
  'glow',
  'show_points',
  'show_grid',
  'show_axis',
  'show_now',
  'highlight',
  'animate',
  'points',
] as const satisfies readonly (keyof ChartKeys)[];

/** The chart keys of a config, as given. */
export function chartKeysOf(config: Readonly<Record<string, unknown>> | undefined): ChartKeys {
  const out: Record<string, unknown> = {};
  if (config) for (const key of CHART_KEYS) if (config[key] !== undefined) out[key] = config[key];
  return out as ChartKeys;
}

const LINE: readonly FineKey[] = [
  'curve',
  'fill',
  'line_width',
  'show_points',
  'show_grid',
  'show_axis',
  'animate',
  'points',
];

/** The fine keys each style acts on: a key a style cannot draw is not offered in it, and does nothing in it. */
export const ACTS: Readonly<Record<ChartPreset, readonly FineKey[]>> = {
  classic: LINE,
  soft: [...LINE, 'glow', 'show_now', 'highlight'],
  glow: [...LINE, 'glow', 'show_now', 'highlight'],
  minimal: [...LINE, 'show_now'],
  step: [
    'fill',
    'line_width',
    'show_points',
    'show_grid',
    'show_axis',
    'show_now',
    'highlight',
    'animate',
    'points',
  ],
  bars: ['show_grid', 'show_axis', 'show_now', 'highlight', 'animate'],
  columns: ['show_grid', 'show_axis', 'show_now', 'animate'],
  band: ['line_width', 'show_points', 'show_grid', 'show_axis', 'show_now', 'animate', 'points'],
};

/** A house chart setting a style draws with (fluvy's settings → Charts): motion and the gauges' waves aside. */
export type HouseKey = 'line' | 'glow' | 'fill' | 'grid' | 'endpoint' | 'now' | 'caps' | 'bubble';

/**
 * The house's chart settings each style draws with, as `resolveStyle` reads them: the panel offers only these for the
 * style chosen. `classic` takes none (it is 1.10's chart); every other style takes the bars' ends (a card of slots
 * draws bars in it) and the bubble (every style shows it while the chart is read); the line where one is drawn, the
 * soft shadow where the style has one, the fill where it is a gradient or flat, the gridlines where it draws some, the
 * line's end where the style marks it with the house's, now where a knob can stand on the line.
 */
export const HOUSE_ACTS: Readonly<Record<ChartPreset, readonly HouseKey[]>> = {
  classic: [],
  soft: ['line', 'glow', 'fill', 'grid', 'endpoint', 'now', 'caps', 'bubble'],
  glow: ['line', 'glow', 'endpoint', 'now', 'caps', 'bubble'],
  minimal: ['line', 'caps', 'bubble'],
  step: ['line', 'fill', 'grid', 'now', 'caps', 'bubble'],
  bars: ['grid', 'caps', 'bubble'],
  columns: ['grid', 'caps', 'bubble'],
  band: ['line', 'grid', 'now', 'caps', 'bubble'],
};

/**
 * The styles a card can draw with what it has: the line styles, bars and columns with slots, the band with a band —
 * of the ones it lists, where it lists them.
 */
export function presetsFor(caps: ChartCaps): ChartPreset[] {
  const out: ChartPreset[] = ['classic', 'soft', 'glow', 'minimal', 'step'];
  if (caps.bars) out.push('bars', 'columns');
  if (caps.band) out.push('band');
  return caps.styles ? out.filter((preset) => caps.styles?.includes(preset)) : out;
}

/** Whether a fine key acts in a style on a card that can draw it. */
export function acts(key: FineKey, preset: ChartPreset, caps: ChartCaps): boolean {
  if (!ACTS[preset].includes(key) || (caps.keys && !caps.keys.includes(key))) return false;
  if (key === 'show_now') return caps.now === true;
  if (key === 'show_axis') return caps.axis !== false;
  if (key === 'highlight') return !caps.several;
  if (key === 'points') return caps.time === true;
  return true;
}

/** The styles drawn as bars: a value per slot, never a line. */
export const isBars = (preset: ChartPreset): boolean => preset === 'bars' || preset === 'columns';

/** What a sensor's readings are, as a gauge asks: its device class (Home Assistant's) and the unit its value is in. */
export interface Reads {
  readonly deviceClass?: string | undefined;
  readonly unit?: string | undefined;
}

/** A sensor of one of these device classes, or one whose value comes in one of these units. */
const of =
  (classes: readonly string[], units: readonly string[] = []) =>
  (reads: Reads): boolean =>
    classes.includes(reads.deviceClass ?? '') || units.includes(reads.unit ?? '');

/**
 * A gauge style. Fluvy's own controls read-only — the dial's ticks (`<fluvy-dial gauge>`, 54 over 270° lit to the
 * value), the thermostat's dial with its disc and its knob (`<fluvy-dial readonly>`), a ring lit to the value with the
 * knob at its end, the ruler with its marker (`<fluvy-ruler marker>`) — read anything. The gauges that move with what
 * they read (`motion`, drawn in `scenes.ts`) each read one kind of sensor (`reads`): the liquid a percentage (a
 * humidity, a moisture), the sky over the ground a temperature, the tank a volume or a level, the battery its charge,
 * the pulse power, the air the wind (or a ventilation's flow), the sun what the sun gives (power, irradiance).
 */
export interface GaugeSpec {
  readonly motion: boolean;
  readonly reads?: (reads: Reads) => boolean;
  /** The tone a moving gauge wears where its card names none (the sky's is the comfort's, whatever the card says). */
  readonly tone?: Tone;
}

export const GAUGE_PRESETS: Readonly<Record<GaugePreset, GaugeSpec>> = {
  ticks: { motion: false },
  dial: { motion: false },
  ring: { motion: false },
  ruler: { motion: false },
  liquid: { motion: true, reads: of(['humidity', 'moisture'], ['%']), tone: 'water' },
  thermo: { motion: true, reads: of(['temperature'], ['°C', '°F', 'K']) },
  tank: {
    motion: true,
    reads: of(['volume', 'volume_storage', 'water', 'distance'], ['L', 'm³', 'gal', 'ft³']),
    tone: 'water',
  },
  battery: { motion: true, reads: of(['battery']), tone: 'battery' },
  pulse: { motion: true, reads: of(['power'], ['W']), tone: 'accent' },
  air: {
    motion: true,
    reads: of(['wind_speed', 'speed', 'volume_flow_rate'], ['km/h', 'm/s']),
    tone: 'cool',
  },
  sun: { motion: true, reads: of(['power', 'irradiance'], ['W', 'W/m²']), tone: 'solar' },
};

/** Whether a gauge style draws a sensor's readings: every control does; a moving gauge, the ones it reads. */
export const gaugeReads = (preset: GaugePreset, reads: Reads): boolean =>
  GAUGE_PRESETS[preset].reads?.(reads) ?? true;

/** The gauges that move, in the settings' order. */
export const MOVING: readonly GaugePreset[] = (Object.keys(GAUGE_PRESETS) as GaugePreset[]).filter(
  (preset) => GAUGE_PRESETS[preset].motion,
);

/** The moving gauges that read a sensor: what an editor offers beside a card's controls. */
export const movingFor = (reads: Reads): GaugePreset[] =>
  MOVING.filter((preset) => gaugeReads(preset, reads));

/** The line widths in px: the house's `regular` is 2.5; a thin style draws one step thinner, never under 1.5. */
const LINE_PX = { thin: 1.5, regular: 2.5, bold: 3 } as const;

export interface ResolvedStyle {
  readonly preset: ChartPreset;
  readonly curve: Curve;
  readonly fill: PresetSpec['fill'];
  /** The fill's opacity at the top of the gradient (or of a flat fill); dark mode adds six points in the sheet. */
  readonly fillOpacity: number;
  readonly line: number;
  readonly glow: {
    readonly kind: PresetSpec['glow'];
    readonly offset: number;
    readonly opacity: number;
  };
  /** The points drawn on the line: none, its end, or every reading. */
  readonly points: 'none' | 'end' | 'all';
  /** How the end of the line is drawn: the classic dot, or Fluvy's knob. */
  readonly end: 'dot' | 'knob';
  /** The gridlines drawn, and how. */
  readonly grid: { readonly axes: PresetSpec['grid']; readonly kind: 'hairline' | 'dashed' };
  /** A nice scale (zero a tick) under a horizontal grid and under bars; the series' own ends otherwise. */
  readonly scale: 'nice' | 'tight';
  /** The scale's tick labels in a column before the plot, where the style draws a scale. */
  readonly axis: boolean;
  /** Now, where the window runs past it: Fluvy's knob on the line, a hairline, or nothing. */
  readonly now: 'none' | 'knob' | 'line';
  readonly future: PresetSpec['future'];
  readonly cursor: PresetSpec['cursor'];
  /** The bubble's look, and whether it stands at rest. */
  readonly bubble: 'dark' | 'tone';
  readonly label: boolean;
  readonly highlight: Highlight;
  readonly caps: 'top' | 'both';
  readonly bars: PresetSpec['bars'];
  /** Whether the chart draws itself in (off: its resting frame at once). */
  readonly animate: boolean;
  /** How far apart a line through time draws its points (`timeline.ts`). */
  readonly every: PointEvery;
}

/**
 * A card's style, resolved: its own keys first, the house's settings next, the style's own defaults last. A fine key
 * the style does not act on (or the card cannot draw) is ignored, as the editor never offers it, and a style the card
 * cannot draw (bars over several sensors) is drawn `classic`. `classic` reads nothing of the house's but motion and
 * how far apart a line's points stand: it is the chart every card drew before 1.11.
 */
export function resolveStyle(
  preset: ChartPreset | undefined,
  fine: ChartKeys,
  caps: ChartCaps,
  house: ChartSettings = chartDefaults().settings,
): ResolvedStyle {
  const wanted = preset ?? house.style;
  const name = presetsFor(caps).includes(wanted) ? wanted : 'classic';
  const spec = CHART_PRESETS[name];
  const own = <K extends Exclude<keyof ChartKeys, 'chart'>>(key: K): ChartKeys[K] | undefined =>
    acts(key, name, caps) ? fine[key] : undefined;
  const classic = name === 'classic';
  const lineWord = own('line_width') ?? (classic ? 'regular' : house.line);
  const line = spec.line === 'thin' ? Math.max(1.5, LINE_PX[lineWord] - 1) : LINE_PX[lineWord];
  const glowOn = own('glow') ?? spec.glow !== 'none';
  const glowKind = glowOn ? (spec.glow === 'none' ? 'soft' : spec.glow) : 'none';
  const fill = own('fill') ?? spec.fill;
  const gridChoice = own('show_grid');
  const axes =
    gridChoice === false || gridChoice === 'none' || (!classic && house.grid === 'none')
      ? 'none'
      : gridChoice === 'x' || gridChoice === 'y' || gridChoice === 'both'
        ? gridChoice
        : spec.grid;
  const nowOn = (own('show_now') ?? spec.now) && caps.now === true;
  // horizontal lines stand on a nice scale (zero a tick): the ones drawn, or the style's own where they are turned off
  // (a step without its lines keeps its scale and its ticks)
  const across = (grid: PresetSpec['grid']): boolean => grid === 'y' || grid === 'both';
  return {
    preset: name,
    curve: own('curve') ?? spec.curve,
    fill,
    fillOpacity: classic ? 0.28 : fill === 'flat' ? house.fill / 150 : house.fill / 100,
    line,
    glow: {
      kind: glowKind,
      offset: house.glow.offset,
      // the blurred copy spreads its ink: a tenth more of it reads as strong as the offset one
      opacity:
        glowKind === 'blur'
          ? Math.min(0.6, Math.round((house.glow.opacity + 0.1) * 100) / 100)
          : house.glow.opacity,
    },
    points: own('show_points') ?? (spec.end === 'none' ? 'none' : 'end'),
    end: spec.end === 'house' ? house.endpoint : 'dot',
    grid: { axes, kind: !classic && house.grid === 'dashed' ? 'dashed' : 'hairline' },
    scale: across(axes) || across(spec.grid) || isBars(name) ? 'nice' : 'tight',
    axis: (own('show_axis') ?? true) && caps.axis !== false,
    now: nowOn ? house.now : 'none',
    future: spec.future,
    cursor: spec.cursor,
    bubble: classic ? 'dark' : house.bubble,
    label: spec.label,
    highlight: own('highlight') ?? spec.highlight,
    caps: classic ? 'top' : house.caps,
    bars: spec.bars,
    animate: fine.animate ?? house.animate,
    every: own('points') ?? house.points,
  };
}

/** A card's style from its config: its `chart` and its fine keys, for what it can draw (`resolveStyle`). */
export const styleOf = (
  config: Readonly<Record<string, unknown>> | undefined,
  caps: ChartCaps,
): ResolvedStyle =>
  resolveStyle(config?.['chart'] as ChartPreset | undefined, chartKeysOf(config), caps);

export interface ResolvedGauge {
  readonly preset: GaugePreset;
  /** How high the waves of a gauge that holds a liquid rise, in px (the moving gauges' own). */
  readonly wave: number;
  /** Whether the style is one that moves with what it reads: a scene in the gauge's room, not a control. */
  readonly motion: boolean;
  /** Whether the gauge moves: the card's (or the house's) `animate`, and a style that has motion to show. */
  readonly animate: boolean;
  /** The tone a moving gauge wears where its card names none. */
  readonly tone?: Tone;
}

const WAVE_PX = { low: 4, mid: 7, high: 10 } as const;

/**
 * A card's gauge style, resolved as a chart's is: its own key, the house's settings, the style's defaults. Told what
 * the card's sensor reads, a moving gauge that does not read it (the sky for a power) is the card's ticks.
 */
export function resolveGauge(
  preset: GaugePreset | undefined,
  fine: { readonly animate?: boolean | undefined },
  house: ChartSettings = chartDefaults().settings,
  reads?: Reads,
): ResolvedGauge {
  const wanted = preset ?? house.gauge;
  const name = !reads || gaugeReads(wanted, reads) ? wanted : 'ticks';
  return {
    preset: name,
    wave: WAVE_PX[house.wave],
    motion: GAUGE_PRESETS[name].motion,
    animate: (fine.animate ?? house.animate) && GAUGE_PRESETS[name].motion,
    ...(GAUGE_PRESETS[name].tone ? { tone: GAUGE_PRESETS[name].tone } : {}),
  };
}
