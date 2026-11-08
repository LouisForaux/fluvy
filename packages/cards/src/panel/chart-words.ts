import {
  CHART_WINDOWS,
  localize,
  POINT_EVERY,
  type BarCaps,
  type BubbleLook,
  type ChartEndpoint,
  type ChartFill,
  type ChartGrid,
  type ChartLine,
  type ChartSettings,
  type ChartWindow,
  type GlowOffset,
  type GlowOpacity,
  type NowMarker,
  type PointEvery,
  type SavedSeries,
  type WaveHeight,
} from '@fluvy/core';
import { everyWord, windowWord, type HouseKey } from '../chart/engine/index.js';
import type { PanelContext, StringKey } from './model.js';
import { chosenSet } from './series.js';

/*
 * The house's chart settings in words: what the Charts tab's fine rows offer, each value as its chip says it, and the
 * apply bar's line for every setting that changed. One table, so a chip and the bar never name a value two ways. A
 * row's values are the keys of its words, typed by the setting: the compiler holds them to the settings' own (none
 * missing, none more), in the order they read.
 */

type Word = (ctx: PanelContext) => string;

/** A value of a fine setting: its key as the chip carries it, and its words. */
interface Choice {
  readonly key: string;
  readonly word: Word;
}

/**
 * A fine setting as a row of chips: the style must act on it (`HOUSE_ACTS`), or a gauge must move (the waves); every
 * chart of the past takes the time's.
 */
export interface FineRow<A extends string = HouseKey | 'wave'> {
  readonly acts: A;
  readonly label: StringKey;
  readonly choices: readonly Choice[];
  /** The chip chosen for these settings. */
  chosen(charts: ChartSettings): string;
  /** The settings a chip asks for. */
  patch(charts: ChartSettings, key: string): Partial<ChartSettings>;
}

const say =
  (key: StringKey, values?: Record<string, string | number>): Word =>
  (ctx) =>
    ctx.t(key, values);
const option =
  (value: ChartLine): Word =>
  (ctx) =>
    localize(ctx.hass, `option.${value}`);
const px = (n: GlowOffset): Word => say('charts.px', { n });
const percent = (share: number): Word => say('wall.percent', { count: Math.round(share * 100) });

/** A chip's key as the setting holds it: a figure, or a word. */
const valueOf = (key: string): string | number => (Number.isNaN(Number(key)) ? key : Number(key));

/** A row over a setting: its words by value, where it reads the value and how a chip changes it. */
function row<V extends string | number, A extends string = FineRow['acts']>(
  acts: A,
  label: StringKey,
  words: Readonly<Record<V, Word>>,
  get: (charts: ChartSettings) => V,
  set: (charts: ChartSettings, value: V) => Partial<ChartSettings>,
): FineRow<A> {
  return {
    acts,
    label,
    choices: Object.entries<Word>(words).map(([key, word]) => ({ key, word })),
    chosen: (charts) => String(get(charts)),
    patch: (charts, chosen) => set(charts, valueOf(chosen) as V),
  };
}

/** The fine settings in the order the Details card lists them (each shown only where the style acts on it). */
export const FINE_ROWS: readonly FineRow[] = [
  row<ChartLine>(
    'line',
    'charts.line',
    { thin: option('thin'), regular: option('regular'), bold: option('bold') },
    (charts) => charts.line,
    (_charts, line) => ({ line }),
  ),
  row<GlowOffset>(
    'glow',
    'charts.glow',
    { 3: px(3), 5: px(5), 7: px(7) },
    (charts) => charts.glow.offset,
    (charts, offset) => ({ glow: { ...charts.glow, offset } }),
  ),
  row<GlowOpacity>(
    'glow',
    'charts.glow_opacity',
    { 0.25: percent(0.25), 0.35: percent(0.35), 0.45: percent(0.45) },
    (charts) => charts.glow.opacity,
    (charts, opacity) => ({ glow: { ...charts.glow, opacity } }),
  ),
  row<ChartFill>(
    'fill',
    'charts.fill',
    { 12: percent(0.12), 18: percent(0.18), 24: percent(0.24) },
    (charts) => charts.fill,
    (_charts, fill) => ({ fill }),
  ),
  row<ChartGrid>(
    'grid',
    'charts.grid',
    {
      hairline: say('charts.grid_hairline'),
      dashed: say('charts.grid_dashed'),
      none: say('charts.grid_none'),
    },
    (charts) => charts.grid,
    (_charts, grid) => ({ grid }),
  ),
  row<ChartEndpoint>(
    'endpoint',
    'charts.endpoint',
    { knob: say('charts.knob'), dot: say('charts.dot') },
    (charts) => charts.endpoint,
    (_charts, endpoint) => ({ endpoint }),
  ),
  row<NowMarker>(
    'now',
    'charts.now',
    { knob: say('charts.knob'), line: say('charts.now_line') },
    (charts) => charts.now,
    (_charts, now) => ({ now }),
  ),
  row<BarCaps>(
    'caps',
    'charts.caps',
    { top: say('charts.caps_top'), both: say('charts.caps_both') },
    (charts) => charts.caps,
    (_charts, caps) => ({ caps }),
  ),
  row<BubbleLook>(
    'bubble',
    'charts.bubble',
    { dark: say('charts.bubble_dark'), tone: say('charts.bubble_tone') },
    (charts) => charts.bubble,
    (_charts, bubble) => ({ bubble }),
  ),
  row<WaveHeight>(
    'wave',
    'charts.wave',
    { low: say('charts.wave_low'), mid: say('charts.wave_mid'), high: say('charts.wave_high') },
    (charts) => charts.wave,
    (_charts, wave) => ({ wave }),
  ),
];

/** A setting's values with their words, from its list of values. */
const wordsOf = <V extends string | number>(
  values: readonly V[],
  word: (ctx: PanelContext, value: V) => string,
): Readonly<Record<V, Word>> =>
  Object.fromEntries(
    values.map((value) => [value, (ctx: PanelContext) => word(ctx, value)]),
  ) as Record<V, Word>;

/** The time every chart of the past shows and how far apart its line's points stand: the Time card's rows (1.18). */
export const TIME_ROWS: readonly FineRow<'time'>[] = [
  row<ChartWindow, 'time'>(
    'time',
    'charts.window',
    wordsOf(CHART_WINDOWS, (ctx, hours) => windowWord(ctx.hass, hours)),
    (charts) => charts.window,
    (_charts, window) => ({ window }),
  ),
  row<PointEvery, 'time'>(
    'time',
    'charts.points',
    wordsOf(POINT_EVERY, (ctx, every) => everyWord(ctx.hass, every)),
    (charts) => charts.points,
    (_charts, points) => ({ points }),
  ),
];

/** The series colours chosen, by name: a saved set's, else the palette's (a set removed elsewhere is the palette's). */
export const seriesName = (
  ctx: PanelContext,
  series: string,
  sets: readonly SavedSeries[],
): string => chosenSet(sets, series)?.name ?? ctx.t('charts.palette');

/** Every chart setting that differs from what is saved, as a line of the apply bar ("Charts · Style · Soft"). */
export function chartLines(ctx: PanelContext): string[] {
  const edited = ctx.houseEdit.charts;
  if (!edited) return [];
  const saved = ctx.settings.charts;
  const line = (label: StringKey, value: string): string =>
    `${ctx.t('tab.charts')} · ${ctx.t(label)} · ${value}`;
  const lines: string[] = [];
  if (edited.style !== saved.style)
    lines.push(line('charts.style', localize(ctx.hass, `option.${edited.style}`)));
  if (edited.gauge !== saved.gauge)
    lines.push(line('charts.gauge', localize(ctx.hass, `option.${edited.gauge}`)));
  for (const row of [...FINE_ROWS, ...TIME_ROWS]) {
    const chosen = row.chosen(edited);
    if (chosen !== row.chosen(saved))
      lines.push(line(row.label, row.choices.find((c) => c.key === chosen)?.word(ctx) ?? chosen));
  }
  if (edited.series !== saved.series)
    lines.push(line('charts.series', seriesName(ctx, edited.series, ctx.settings.chartSets)));
  if (edited.animate !== saved.animate)
    lines.push(line('charts.motion', ctx.t(edited.animate ? 'change.on' : 'change.off')));
  return lines;
}
