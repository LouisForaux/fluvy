import {
  formatDate,
  formatNumber,
  formatTime,
  isPaletteRef,
  isUsable,
  plural,
  stateText,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';
import {
  axis,
  clickPress,
  glyph,
  head,
  ico,
  preventMenu,
  readout,
  round,
  startPress,
  type Tone,
} from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { chartHeight } from '../chart-family.js';
import { HeadFit } from '../energy/head.js';
import { axisHolds } from '../shared/axis.js';
import { Card, type BaseKey, type HeadConfig } from '../shared/base.js';
import type { ChartKeys, Curve } from '../shared/chart-config.js';
import { toneOf } from '../shared/colour.js';
import { configKeys } from '../shared/config.js';
import { iconOf, stateWord } from '../shared/domain.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  editorLanguage,
  fieldRow,
  iconField,
  numberField,
  onlyWhen,
  pickFields,
  selectField,
  showIconField,
  titleFields,
} from '../shared/form.js';
import type { EditorDefaults, FormHelper, RowsListSpec } from '../shared/rows-editor.js';
import { decimalsOf, figure, precisionOf, scaleNamed, type Scale } from '../shared/units.js';
import { attributeSeries, timedAttributes, type Day, type Reading } from './data/attribute.js';
import {
  ForecastFeed,
  forecastReadings,
  forecastUnit,
  historyReadings,
  periodOf,
  PERIOD_MS,
  sourceOf,
  statisticsReadings,
  statOf,
  type ForecastType,
  type Source,
} from './data/sources.js';
import {
  dayStart,
  DAY,
  gains,
  HOUR,
  MOST_SLOTS,
  nowFraction,
  previousOf,
  slotted,
  spanOf,
  stepOf,
  windowOf,
  type Holding,
  type Span,
} from './data/span.js';
import {
  capsFor,
  capsIn,
  CHART_CAPS,
  defaultWindows,
  houseSpanValue,
  isPrice,
  SERIES_LIST,
  seriesOf,
  spanField,
  THRESHOLDS_LIST,
  thresholdsOf,
  windowAt,
  type ChartSeriesConfig,
  type SeriesKind,
  type Windows,
} from './config.js';
import {
  chartKeysOf,
  chartDefaultsFor,
  chartSection,
  chartStyles,
  drawChart,
  drawRead,
  isBars,
  legend,
  niceTicks,
  plotOf,
  quarterTicks,
  readAt,
  readingsOf,
  refInk,
  resolveStyle,
  roundTicks,
  scrub,
  ScrubController,
  seriesPaint,
  tickText,
  timeLine,
  type ChartFrame,
  type ChartSeries,
  type ChartSpec,
  type TimeLine,
  type Reading as Said,
  type ResolvedStyle,
  type SeriesColour,
  type Stretch,
  type Window,
} from './engine/index.js';

const s = strings('chart-card');

/** A colour a series writes on itself as its ink — a series colour, or one of the palette's by its token — not a tone. */
const ownInk = (colour: SeriesColour): boolean =>
  colour.startsWith('series-') || colour.startsWith('var(');

export type ChartVariant = 'full' | 'compact' | 'tile';
export type { ChartSeriesConfig, SeriesKind, Windows } from './config.js';

/** A threshold: from `value` up, to the next one, the line wears `tone`. */
export interface ThresholdConfig {
  tone?: Tone;
  value?: number;
}

export interface ChartCardConfig extends FluvyCardConfig, HeadConfig, Omit<ChartKeys, 'highlight'> {
  title?: string;
  subtitle?: string;
  /** The series, six at most: an entity id, or the series with what it says of itself. */
  series?: ReadonlyArray<string | ChartSeriesConfig>;
  /** `24h` (the default), `today`, `today+tomorrow`, `7d`, or any `<N>h` / `<N>d`. */
  span?: string;
  thresholds?: readonly ThresholdConfig[];
  /** The windows marked, of what is to come: the cheapest (lowest), the dearest (highest), or both. */
  highlight?: Windows;
  /** How long a marked window is: one hour by default. */
  highlight_hours?: number;
  show_legend?: boolean;
  /** The value now, big, over the chart, with its change on the period before. */
  show_head?: boolean;
  variant?: ChartVariant;
  /** Test hook: an ISO date that freezes "now". Undocumented. */
  _now?: string;
}

/** The chart's room (the energy card's): its 120 with the bubble's 44 above the plot; the value row's 16 and 64. */
const CHART = 120;
const HEADROOM = 44;
const ROW = 80;
/**
 * Under a value row that says the reading, the plot rises to 12 under the chart's top — the knob's room, whole: the
 * row reads the chart with it, so no bubble is drawn over the plot and none needs its room.
 */
const TIGHT = 12;
/** A stepped line's least slot: under it the steps of a line 2.5 wide read as beads (a phone's card reads a day by the hour). */
const STEP_MIN = 5;
/** The most a scale's column takes of a plot's width ("−0.10" and its gap): a step is counted on what is left. */
const SCALE_MOST = 48;
/** The round lengths of time a stepped line's slots take, finest first: quarters, half hours, hours … days. */
const ROUND_STEPS = [5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 720, 1440].map((m) => m * 60_000);
/** The tile's spark: 24 tall, 4 around it. */
const SPARK = 24;
/** The most bars a window is read in: an hour each over two days. */
const MOST_BARS = 48;
/** A legend line (12/500 on 16), and the 4 between two. */
const LEGEND_LINE = 16;
const LEGEND_GAP = 4;
/**
 * A legend item's least room in a column beside others: its swatch and a name's first letters (12, 8 and 48), and the
 * reading after them where it says one (8 and 56, "21.4 °C" and room to spare).
 */
const LEGEND_NAME = 68;
const LEGEND_READING = 64;
/** The value row's height: the reading now, or a legend's lines (`TOP`); and the 8 over a legend under the axis. */
const TOP = 64;
const UNDER = 8;
/** A marked window's pill's sides (`.fc-pill`: 10 each, its dot 6 and the 6 after it); the change's (its glyph). */
const PILL_SIDES = 32;
const DELTA_SIDES = 30;
const GAP = 12;
/** The least a plot keeps beside its scale's column: under it the column folds. */
const PLOT_MIN = 120;
/** The readout sizes the value row may take, largest first. */
const SIZES = ['l', 'm', 's', 'xs'] as const;

const down4 = (n: number): number => Math.max(4, Math.floor(n / 4) * 4);
/** How tall `lines` legend lines stand. */
const linesTall = (lines: number): number => lines * (LEGEND_LINE + LEGEND_GAP) - LEGEND_GAP;

/**
 * How many a row a legend of four series or more lays under the axis, by their count and the card's width alone: three
 * (five or six) or two where each column holds an item; none (0) where two would not, and the legend's lines go in the
 * value row, one a row, as two or three series' do. Never by the names themselves: the card's height never waits on
 * its words.
 */
export function legendColumns(count: number, width: number, reading: boolean): number {
  const item = LEGEND_NAME + (reading ? LEGEND_READING : 0);
  return [count > 4 ? 3 : 2, 2].find((cols) => (width - (cols - 1) * 16) / cols >= item) ?? 0;
}
const capitalise = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** One series as this render draws it. */
interface Drawn {
  readonly item: ChartSeriesConfig;
  readonly view: EntityView;
  readonly source: Source;
  readonly name: string;
  /** The unit its figures are written in (its readings already divided for it), and their decimals. */
  readonly scale: Scale;
  readonly digits: number | undefined;
  readonly colour: SeriesColour;
  readonly accent: string | undefined;
  readonly kind: SeriesKind;
  readonly curve: Curve;
  /** Its readings; undefined while they are asked for. */
  readonly readings: readonly Reading[] | undefined;
  readonly holding: Holding;
  /** Its readings on the window's slots, in its unit: the slots' (steps, bars) and the points between them (lines). */
  readonly slots: ReadonlyArray<number | null>;
  readonly points: ReadonlyArray<number | null>;
  /**
   * A line of the recorder's through time (`timeLine`, the points in its place): drawn on the house's round times and
   * read at them; `cover` the part of the window it runs (to now on a calendar day).
   */
  readonly line: TimeLine | null;
  readonly cover: number;
  readonly band: ChartSeries['band'];
  /** Its reading now, in its unit; null where it has none. */
  readonly now: number | null;
  /** A price: its windows are the cheapest and the dearest. */
  readonly price: boolean;
}

/** A window marked: its ends (fractions of the window), its tone, its words in their forms, longest first. */
interface Marked {
  readonly from: number;
  readonly to: number;
  readonly tone: Tone;
  readonly forms: readonly string[];
}

/** The chart's drawings: the lines (or the columns), and the lines over columns where both are drawn. */
interface Specs {
  readonly main: ChartSpec;
  readonly over: ChartSpec | null;
}

/** Where the chart is read: the cursor (a line through time's snaps to its round time), its x, the moment, each value. */
interface Read {
  readonly cursor: number;
  readonly x: number;
  readonly time: string;
  readonly values: ReadonlyArray<number | null>;
}

/** What a series' history or statistics answered: what it asked for (its entity, source, keys and span), its readings. */
interface Answer {
  readonly id: string;
  readonly readings: readonly Reading[];
}

/** What a series' history or statistics answer is for: its entity, its source and keys, and its span. */
const answerId = (item: ChartSeriesConfig, source: Source, span: Span): string =>
  [
    item.entity,
    source,
    item.stat ?? '',
    item.period ?? '',
    item.kind === 'band' ? 'band' : '',
    span.kind,
    span.hours,
  ].join('|');

/** The decimals a series' readings carry (a price's three, a temperature's one), up to three; none where they say none. */
function carried(readings: readonly Reading[] | undefined, state: string): number | undefined {
  const digits = (n: number | string): number => String(n).split('.')[1]?.length ?? 0;
  if (/^-?\d+(\.\d+)?$/.test(state)) return Math.min(3, digits(state));
  if (!readings?.length) return undefined;
  return Math.min(3, Math.max(...readings.slice(0, 48).map((r) => digits(r.v))));
}

/** A number an entity holds in an attribute (a weather's temperature now). */
function numberAttr(view: EntityView, key: string): number | null {
  const raw = view.attr(key);
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** What lies under a series: its own fill, an area's where the style has none, its band where it has lows and highs. */
function fillFor(d: Drawn, style: ResolvedStyle): Pick<ChartSeries, 'fill'> {
  if (d.item.fill) return { fill: d.item.fill };
  if (d.kind === 'area')
    return { fill: style.fill === 'none' || style.fill === 'band' ? 'gradient' : style.fill };
  if (d.kind === 'band') return { fill: d.band ? 'band' : 'none' };
  return {};
}

/** The value at a fraction of a line's points, between the two nearest; a gap's neighbour where one side is a gap. */
function between(points: ReadonlyArray<number | null>, fraction: number): number | null {
  const at = Math.min(1, Math.max(0, fraction)) * (points.length - 1);
  const a = points[Math.floor(at)] ?? null;
  const b = points[Math.ceil(at)] ?? null;
  return a === null || b === null ? (a ?? b) : a + (b - a) * (at - Math.floor(at));
}

/**
 * The Chart card (#68): any time series on one chart — a sensor's history or its long-term statistics, a list in its
 * attributes (Nordpool's prices today and tomorrow, Tibber's, ENTSO-E's, Frank Energie's, a solar forecast), a
 * weather's forecast — across a window (`span`) from what has happened to what is to come, now marked and the future
 * dashed; each series a line, an area, columns or its band, in its own colour, unit and decimals; thresholds that
 * colour the line where it crosses them; the cheapest and the dearest windows marked and named; the value now big
 * with its change on the period before; a legend; read by pointing at it or from the keyboard. Its style is the
 * house's or its own (`chart`, and every fine key of the engine). Full (320; 364 with a legend of four series or
 * more), compact (240) or a tile (168): its height is its variant's and its series count's alone — loading, empty or
 * out of reach, it keeps it.
 */
export class FluvyChartCard extends Card<ChartCardConfig> {
  static override layoutHeight(config: ChartCardConfig): number {
    return chartHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    chartStyles,
    css`
      .ch-chart {
        position: relative;
        margin-top: 12px;
        outline: none;
      }
      .ch-chart:focus-visible {
        border-radius: var(--fluvy-radius-control);
        box-shadow: 0 0 0 2px var(--fluvy-focus-ring, var(--fluvy-accent));
      }
      .ch-chart > svg {
        display: block;
        overflow: visible;
      }
      /* the lines over the columns: the same frame, drawn over them */
      .ch-chart > svg + svg {
        position: absolute;
        top: 0;
        left: 0;
      }
      .ch-chart > .fv-skeleton {
        height: 100%;
        border-radius: var(--fluvy-radius-control);
      }
      /* the bubble arrives with the mark it belongs to, once the line has drawn itself */
      .ch-chart > .fv-bubble {
        animation: fv-fade 500ms var(--fv-ease) both;
        animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
      }
      /* several series: each one's forecast keeps its colour, dashed, so the legend still says whose it is */
      .ch-several .fc-future {
        stroke: var(--tone-ink, var(--fluvy-accent));
        stroke-opacity: 0.6;
      }
      /* the axis under the plot starts where the plot does (after a scale's column) */
      .ch-axis {
        position: relative;
        margin-top: 8px;
      }
      .ch-axis > .fv-axis {
        margin-top: 0;
        transition: opacity var(--fluvy-duration-fast, 120ms) ease;
      }
      /* while the legend's lines in the row read the chart, the axis says when: a pill in the bubble's colours under
         the cursor, over the hours, which give way to it (the several sensors' card's) */
      .ch-axis.is-reading > .fv-axis {
        opacity: 0;
      }
      .ch-when {
        position: absolute;
        top: -2px;
        z-index: 1;
        height: 20px;
        border-radius: 10px;
        background: var(--fluvy-text);
        color: var(--fluvy-page);
        font-size: 12px;
        font-weight: 600;
        line-height: 20px;
        text-align: center;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        pointer-events: none;
      }
      /* the value row: the reading now (and its change) at the start, the marked windows at the end */
      .ch-top {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: ${GAP}px;
        height: ${TOP}px;
        margin-top: 16px;
      }
      .ch-now {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        min-width: 0;
      }
      .ch-now .fv-readout__value {
        white-space: nowrap;
      }
      /* the change on the period before: a pill on the value's foot */
      .ch-delta {
        flex: none;
        gap: 2px;
        margin-bottom: 10px;
        padding: 0 8px 0 4px;
      }
      .ch-delta svg {
        width: 16px;
        height: 16px;
      }
      .ch-side {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        min-width: 0;
      }
      .ch-top.is-side-only .ch-side {
        align-items: flex-start;
      }
      /* a legend of two or three series as lines in the row, each reading at its line's end */
      .ch-lines {
        flex: 1;
        min-width: 0;
      }
      .ch-lines > .fc-legend {
        flex-direction: column;
        flex-wrap: nowrap;
        gap: 4px;
        margin: 0;
      }
      .ch-lines .fc-legend__item {
        display: flex;
        height: ${LEGEND_LINE}px;
      }
      .ch-lines .fc-legend__name {
        flex: 1;
      }
      /* a legend of four series or more under the axis: two or three equal columns where each holds its item (in the
         value row's lines where they would not: \`legendColumns\`) */
      .ch-legend > .fc-legend {
        display: grid;
        grid-template-columns: repeat(var(--ch-cols, 3), minmax(0, 1fr));
        gap: ${LEGEND_GAP}px 16px;
        margin: ${UNDER}px 0 0;
      }
      .ch-legend .fc-legend__item {
        height: ${LEGEND_LINE}px;
      }
      /* nothing to chart: a 44 ring on the card fill and one line, centred in the plot's room on the page's fill */
      .ch-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 100%;
        padding: 0 16px;
        border-radius: var(--fluvy-radius-control);
        background: var(--fluvy-page);
        text-align: center;
      }
      .ch-empty .fv-ico {
        background: var(--fluvy-card);
      }
      .ch-empty .fv-empty {
        color: var(--fluvy-text-secondary);
      }
      /* the tile: the reading over its spark, as the sensor's tile */
      .fv-tile .fv-readout {
        margin-top: 12px;
      }
      .fv-tile .fv-readout__label {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .ch-spark {
        position: relative;
        height: ${SPARK}px;
        padding: 0 4px;
      }
      .ch-spark > svg {
        overflow: visible;
      }
      .ch-spark > .fv-skeleton {
        height: ${SPARK}px;
      }
      .fv-tile.is-off {
        background: var(--fluvy-page);
        box-shadow: none;
        outline: 1px dashed var(--fluvy-unavailable-border);
        outline-offset: -1px;
      }
      .fv-tile.is-off .fv-readout__label,
      .fv-tile.is-off .fv-readout__value {
        color: var(--fluvy-unavailable);
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    answers_: { state: true },
  };

  /** What each series' history or statistics answered, by its index: kept while a newer read is asked. */
  declare answers_: ReadonlyArray<Answer | undefined>;
  /** What each series asked last, and when: asked again once the key moves or five minutes pass. */
  private readonly reads: Array<{ key: string; at: number } | undefined> = [];
  /** Where the chart is read (a fraction of its width); null: at rest. */
  private readonly scrubber = new ScrubController(this);
  private readonly forecasts = new ForecastFeed(this);
  private readonly headFit = new HeadFit(this);

  constructor() {
    super();
    this.answers_ = [];
  }

  /* ---------- the editor (on the class: the card's chunk is fetched as the bundle starts) ---------- */

  /** The head's icon, colours and actions are the base fields it honours; its entities are its series'. */
  static override base: readonly BaseKey[] = [
    'icon',
    'tone',
    'color',
    'card_color',
    'card_opacity',
    'unavailable',
    'tap_action',
    'hold_action',
    'show_icon',
  ];
  static override keys = configKeys<ChartCardConfig>()([
    'title',
    'subtitle',
    'series',
    'span',
    'variant',
    'show_head',
    'show_legend',
    'highlight',
    'highlight_hours',
    'thresholds',
    'chart',
    'curve',
    'fill',
    'line_width',
    'glow',
    'show_points',
    'show_grid',
    'show_axis',
    'show_now',
    'animate',
    'points',
  ]);
  static override lists: readonly RowsListSpec[] = [SERIES_LIST, THRESHOLDS_LIST];
  /** What the editor shows where the config says nothing: what the card does then. */
  static override defaults: EditorDefaults = (config, hass) => {
    // the Chart section's, the engine's — but the highlight, which marks this card's windows
    const { highlight: _style, ...chart } = chartDefaultsFor(config, {
      ...capsIn(config, hass),
      now: true,
      time: true,
    });
    void _style;
    return {
      span: houseSpanValue(),
      variant: 'full',
      show_head: true,
      show_legend: true,
      highlight: defaultWindows(config['chart']),
      highlight_hours: 1,
      ...chart,
    };
  };
  static override getConfigForm(): LovelaceConfigForm {
    const lone = (data: Readonly<Record<string, unknown>>): boolean => seriesOf(data).length < 2;
    const marked = (data: Readonly<Record<string, unknown>>): boolean =>
      lone(data) && (data['highlight'] ?? defaultWindows(data['chart'])) !== 'none';
    // a legend names several series, on the full card alone (the compact one and the tile draw none)
    const legended = (data: Readonly<Record<string, unknown>>): boolean =>
      !lone(data) && (data['variant'] ?? 'full') === 'full';
    const helper: FormHelper = (schema) =>
      schema.name === 'span' ? s(editorLanguage(), 'editor.span_helper') : undefined;
    // the Chart section is the engine's, but for the highlight: this card marks its windows with it, in every style
    const section = chartSection(CHART_CAPS, capsIn);
    const chart = {
      ...section,
      schema: pickFields(section.schema ?? [], (item) => item.name !== 'highlight'),
    };
    return {
      schema: [
        titleFields(),
        fieldRow(iconField(), showIconField()),
        ...colourFields(),
        // the lists are edited item by item (the rows editor takes these fields out of the form)
        { name: 'series', selector: { object: {} } },
        fieldRow(spanField(), selectField('variant', ['full', 'compact', 'tile'])),
        fieldRow(boolField('show_head'), onlyWhen(legended, boolField('show_legend'))),
        fieldRow(
          onlyWhen(
            lone,
            choiceField('highlight', [
              ['none', 'option.none'],
              ['min', 'option.min'],
              ['max', 'option.max'],
              ['both', 'option.min_max'],
            ]),
          ),
          onlyWhen(marked, numberField('highlight_hours', 1, 12)),
        ),
        { name: 'thresholds', selector: { object: {} } },
        chart,
        actionFields(),
      ],
      ...editorLabels(s, {
        series: 'editor.series',
        span: 'editor.span',
        thresholds: 'editor.thresholds',
        highlight_hours: 'editor.highlight_hours',
        show_legend: 'editor.show_legend',
        show_head: 'editor.show_head',
      }),
      computeHelper: helper,
    };
  }

  /** A sensor that holds a list of moments and values (a price's), else the first sensor; a list's day and tomorrow. */
  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): ChartCardConfig {
    const day: Day = { start: 0, length: DAY };
    const listed = entities.find(
      (id) =>
        id.startsWith('sensor.') &&
        timedAttributes(hass?.states[id]?.attributes ?? {}, day).length > 0,
    );
    const entity = listed ?? entities.find((id) => id.startsWith('sensor.'));
    return {
      type: 'custom:fluvy-chart-card',
      series: entity ? [entity] : [],
      ...(listed ? { span: 'today+tomorrow' } : {}),
    };
  }

  /* ---------- size ---------- */

  override getCardSize(): number {
    return Math.round(chartHeight(this.config ?? { type: '' }) / 50);
  }

  override getGridOptions(): LovelaceGridOptions {
    return this.variant === 'tile'
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private get variant(): ChartVariant {
    const variant = this.config?.variant;
    return variant === 'compact' || variant === 'tile' ? variant : 'full';
  }

  /** Watched: every series' entity. */
  protected override watched(): readonly string[] {
    return seriesOf(this.config).map((item) => item.entity);
  }

  /* ---------- time ---------- */

  /** "Now": the frozen moment of a test, else the clock. */
  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  private get span(): Span {
    return spanOf(this.config?.span);
  }

  /** Today and tomorrow as the house's calendar has them: what a plain list of a day's values counts from. */
  private days(now: Date): readonly [Day, Day] {
    const start = dayStart(this.hass, now);
    const next = dayStart(this.hass, now, 1);
    return [
      { start, length: next - start },
      { start: next, length: dayStart(this.hass, now, 2) - next },
    ];
  }

  /** What a forecast is subscribed as: by the hour through two days, by the day beyond. */
  private get forecastType(): ForecastType {
    return this.span.hours > 48 ? 'daily' : 'hourly';
  }

  /* ---------- the readings ---------- */

  /** Where a series is read from, as its entity has it (a sensor that holds a usual list reads it). */
  private sourceFor(item: ChartSeriesConfig): Source {
    return sourceOf(item, this.entity(item.entity).stateObj?.attributes);
  }

  /**
   * Each series that reads the recorder asks it once a key (its entity, source, keys and span, and its window's start
   * to the five minutes) and again once five minutes have passed — the first series from as far before its window as
   * the period it is compared with, for its change; the forecasts subscribed, as the weathers push them.
   */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const hass = this.hass;
    if (!hass) return;
    const now = this.now().getTime();
    const span = this.span;
    const window = windowOf(span, new Date(now), hass, Infinity);
    const forecasts: Array<readonly [string, ForecastType]> = [];
    seriesOf(this.config).forEach((item, index) => {
      const source = this.sourceFor(item);
      if (source === 'forecast') forecasts.push([item.entity, this.forecastType]);
      if (source !== 'history' && source !== 'statistics') return;
      const id = answerId(item, source, span);
      const from = window.start - (index === 0 ? previousOf(span) : 0);
      const to = Math.min(window.end, now);
      const key = `${id}|${Math.floor(from / 300_000)}`;
      const read = this.reads[index];
      if (read?.key === key && Date.now() - read.at < 300_000) return;
      this.reads[index] = { key, at: Date.now() };
      const asked =
        source === 'statistics'
          ? statisticsReadings(
              hass,
              item.entity,
              { start: from, end: to },
              item.period ?? periodOf(span.hours),
              item.stat ?? statOf(this.entity(item.entity).attr('state_class')),
              item.kind === 'band',
            )
          : historyReadings(hass, item.entity, from, to);
      void asked
        .catch((): Reading[] => [])
        .then((readings) => {
          if (this.reads[index]?.key !== key) return;
          const next = [...this.answers_];
          next[index] = { id, readings };
          this.answers_ = next;
        });
    });
    this.forecasts.sync(hass, forecasts);
  }

  /** A series' readings as this render has them: the recorder's answer, its attribute's list, its weather's forecast. */
  private readingsOf(
    item: ChartSeriesConfig,
    index: number,
    source: Source,
    view: EntityView,
    days: readonly [Day, Day],
  ): readonly Reading[] | undefined {
    if (source === 'attribute')
      return view.stateObj
        ? attributeSeries(view.stateObj.attributes, item.attribute, item, days[0], days[1]).readings
        : [];
    if (source === 'forecast') {
      const entries = this.forecasts.get(item.entity, this.forecastType);
      // a weather out of reach forecasts nothing: there is nothing to wait for
      if (entries === undefined) return view.stateObj ? undefined : [];
      return forecastReadings(entries ?? [], item);
    }
    const answer = this.answers_[index];
    return answer?.id === answerId(item, source, this.span) ? answer.readings : undefined;
  }

  /** The last moment a list or a forecast reads (what tomorrow's prices reach): the window runs to the day it falls in. */
  private latest(
    items: readonly ChartSeriesConfig[],
    days: readonly [Day, Day],
  ): number | undefined {
    let latest: number | undefined;
    items.forEach((item, index) => {
      const source = this.sourceFor(item);
      if (source !== 'attribute' && source !== 'forecast') return;
      const readings = this.readingsOf(item, index, source, this.entity(item.entity), days);
      const last = readings?.[readings.length - 1];
      if (last) latest = Math.max(latest ?? -Infinity, last.t);
    });
    return latest;
  }

  /**
   * The slots a window is read in: as fine as its finest series (a list's quarter, a statistic's hour, the recorder's
   * window in 48), never finer than 192 — columns an hour at the finest, 48 at most.
   */
  private slotCount(
    window: Window,
    items: readonly ChartSeriesConfig[],
    days: readonly [Day, Day],
    columns: boolean,
    stepped: boolean,
  ): number {
    const length = window.end - window.start;
    const steps = items.map((item, index) => {
      const source = this.sourceFor(item);
      if (source === 'statistics') return PERIOD_MS[item.period ?? periodOf(this.span.hours)];
      if (source === 'history') return Math.max(5 * 60_000, length / 48);
      const readings = this.readingsOf(item, index, source, this.entity(item.entity), days);
      return readings?.length ? stepOf(readings) : HOUR;
    });
    let step = Math.max(length / MOST_SLOTS, Math.min(...steps, length / 2));
    // a step narrower than its line is a bead, not a step: a stepped line holds each slot at least STEP_MIN across, on
    // a round length of time (a narrow card reads a day's quarters as half hours or hours, a wide one as quarters)
    if (stepped) {
      const least = (length * STEP_MIN) / Math.max(1, this.contentWidth - SCALE_MOST);
      step = ROUND_STEPS.find((round) => round >= Math.max(step, least)) ?? step;
    }
    const count = Math.min(MOST_SLOTS, Math.max(2, Math.round(length / step)));
    return columns ? Math.min(count, MOST_BARS, Math.max(2, Math.round(length / HOUR))) : count;
  }

  /**
   * The series as this render draws them, laid on the window: each slot what was in force across it (an hour's mean
   * of four quarter prices), a line's points between the slots, its band, its reading now, its unit, its decimals and
   * its colour — a lone series its card's colour, several each a series colour of the palette, a colour of its own
   * over either; one out of reach in the off skin.
   */
  private drawn(
    window: Window,
    count: number,
    items: readonly ChartSeriesConfig[],
    days: readonly [Day, Day],
    style: ResolvedStyle,
  ): Drawn[] {
    const several = items.length > 1;
    const bars = isBars(style.preset);
    const half = (window.end - window.start) / count / 2;
    // a line's points sit between the slots: the first on the window's start, the last on its end
    const edges = { start: window.start - half, end: window.end + half };
    return items.map((item, index) => {
      const view = this.entity(item.entity);
      const source = this.sourceFor(item);
      const readings = this.readingsOf(item, index, source, view, days);
      const base = source === 'forecast' ? forecastUnit(view, item.value_key) : view.unit;
      const asked = typeof item.unit === 'string' && item.unit !== 'auto' ? item.unit.trim() : '';
      // a unit its sensor's converts to scales its figures; any other names the unit its list is written in
      const scale: Scale = asked
        ? (scaleNamed(asked, base) ?? { unit: asked, divisor: 1 })
        : { unit: base, divisor: 1 };
      const recorded = source === 'history' || source === 'statistics';
      // the decimals its reading now is written with: the sensor's state, the weather's own figure, else its list's
      const written = recorded
        ? view.state
        : source === 'forecast'
          ? String(view.attr(item.value_key ?? 'temperature') ?? '')
          : '';
      const digits =
        decimalsOf(item.decimals) ??
        (scale.unit === view.unit ? precisionOf(this.hass, view) : undefined) ??
        (scale.divisor === 1 ? carried(readings, written) : undefined);
      const usable = isUsable(view) || (view.status === 'missing' && !several);
      // a colour of its own: a name or a hex as the card's accent sheet derives it, or one of the palette's by its
      // token (it follows the palette and the mode)
      const accent = usable ? this.accents.item(item.color) : undefined;
      const colour: SeriesColour = !isUsable(view)
        ? 'off'
        : accent
          ? 'accent'
          : item.color && isPaletteRef(item.color)
            ? (refInk(item.color) as SeriesColour)
            : (item.tone ??
              (several ? (`series-${index + 1}` as SeriesColour) : toneOf(this.config, 'accent')));
      const holding: Holding =
        recorded && source === 'history'
          ? { hold: Infinity, until: window.now }
          : { hold: readings?.length ? stepOf(readings) : HOUR };
      const shown = (values: Array<number | null>): Array<number | null> =>
        scale.divisor === 1 ? values : values.map((v) => (v === null ? null : v / scale.divisor));
      const lay = (
        span: Pick<Window, 'start' | 'end'>,
        n: number,
        pick?: (reading: Reading) => number | undefined,
      ): Array<number | null> => (readings ? shown(slotted(readings, span, n, holding, pick)) : []);
      const kind = item.kind ?? 'line';
      // a meter's history drawn as bars reads what it gained in each slot, not what it showed
      const rule = readingsOf(view.deviceClass, view.attr('state_class'), view.unit).rule;
      const gained =
        readings && source === 'history' && rule !== 'mean' && (bars || kind === 'columns')
          ? shown(gains(readings, window, count, holding, rule === 'increase'))
          : null;
      // a line of the recorder's runs through time: on the house's round times, as calmly as the card draws it (or
      // every `points`), read where Home Assistant reads it
      const timed =
        recorded &&
        !bars &&
        kind !== 'columns' &&
        kind !== 'band' &&
        (item.curve ?? style.curve) !== 'step';
      const line =
        timed && readings
          ? this.lineOf(
              readings,
              window,
              style,
              source === 'statistics'
                ? PERIOD_MS[item.period ?? periodOf(this.span.hours)]
                : undefined,
            )
          : null;
      const lows = kind === 'band' ? lay(edges, count + 1, (r) => r.low) : [];
      const highs = kind === 'band' ? lay(edges, count + 1, (r) => r.high) : [];
      const banded = lows.length > 1 && lows.every((v, i) => v !== null && highs[i] !== null);
      const live = recorded
        ? view.number
        : source === 'forecast'
          ? (numberAttr(view, item.value_key ?? 'temperature') ?? readings?.[0]?.v ?? null)
          : ((readings
              ? slotted(readings, { start: window.now, end: window.now + 1 }, 1, holding)[0]
              : null) ?? view.number);
      return {
        item,
        view,
        source,
        name: this.nameFor(view, item.name),
        scale,
        digits,
        colour,
        accent,
        kind,
        curve: item.curve ?? style.curve,
        readings,
        holding,
        slots: gained ?? lay(window, count),
        points: kind === 'columns' ? [] : line ? shown(line.values) : lay(edges, count + 1),
        line,
        cover: (Math.min(window.end, window.now) - window.start) / (window.end - window.start),
        band: banded ? { low: lows as number[], high: highs as number[] } : undefined,
        now: live === null || live === undefined ? null : live / scale.divisor,
        price: isPrice(scale.unit, view.deviceClass),
      };
    });
  }

  /**
   * A series' line through the window as far as it has happened (`timeLine`, as calmly as the card's width draws it in
   * its style, or every `points`; never finer than its statistics' bucket, `finest`); none where nothing has.
   */
  private lineOf(
    readings: readonly Reading[],
    window: Window,
    style: ResolvedStyle,
    finest: number | undefined,
  ): TimeLine | null {
    const end = Math.min(window.end, window.now);
    if (!(end > window.start) || !readings.length) return null;
    return timeLine({
      readings,
      start: window.start,
      end,
      width: (this.contentWidth * (end - window.start)) / (window.end - window.start),
      style,
      hass: this.hass,
      ...(finest ? { finest } : {}),
    });
  }

  /** A figure of a series, in its unit and decimals; "—" where there is none. */
  private figureOf(drawn: Drawn, value: number | null): { value: string; unit: string } {
    if (value === null || !Number.isFinite(value)) return { value: '—', unit: '' };
    return {
      value: figure(this.hass, value, { unit: drawn.scale.unit, divisor: 1 }, drawn.digits),
      unit: drawn.scale.unit,
    };
  }

  /* ---------- the window's words ---------- */

  /** What the window is, under the title: the last hours or days, today, today and tomorrow. */
  private spanWords(window: Window): string {
    const span = this.span;
    if (span.kind !== 'rolling')
      return window.end - window.start > DAY * 1.5
        ? s(this.hass, 'today_tomorrow')
        : this.t('common.today');
    const days = span.hours >= 48 && span.hours % 24 === 0;
    const count = days ? span.hours / 24 : span.hours;
    return capitalise(
      plural(this.hass, days ? 'sensor.window_days' : 'sensor.window_hours', count, { count }),
    );
  }

  /** When a moment was: its time, with its weekday where it is not today. */
  private when(t: number, window: Window): string {
    const time = formatTime(this.hass, new Date(t));
    return dayStart(this.hass, new Date(t)) === dayStart(this.hass, new Date(window.now))
      ? time
      : `${formatDate(this.hass, new Date(t), 'weekday')} ${time}`;
  }

  /**
   * The window's clock under the plot, by the engine's labellers: a rolling window's quarters ending in "Now", a
   * calendar window's ends and its round marks between — where its ends do not stand 12 apart (half a section), the
   * days they are (Thu · Fri), else their times, else its start alone.
   */
  private axisItems(window: Window, width: number): ReadonlyArray<readonly [number, string]> {
    const span = this.span;
    const ruler = this.headFit.ruler;
    const time = (t: number): string => formatTime(this.hass, new Date(t));
    const weekday = (t: number): string => formatDate(this.hass, new Date(t), 'weekday');
    if (span.kind === 'rolling')
      return quarterTicks({
        hours: span.hours,
        now: window.now,
        time,
        daysAgo: (days) =>
          this.t('sensor.days_ago', { count: formatNumber(this.hass, days, { digits: 1 }) }),
        nowWord: this.t('common.now'),
        holds: (items) => axisHolds(ruler, width, items),
      });
    type Items = ReadonlyArray<readonly [number, string]>;
    // every label 12 apart, the two ends too (the axis's rule holds three or more)
    const holds = (items: Items): boolean =>
      axisHolds(ruler, width, items) &&
      ruler.width('fv-axis', items[0]?.[1] ?? '') +
        ruler.width('fv-axis', items[items.length - 1]?.[1] ?? '') +
        12 <=
        width;
    const length = window.end - window.start;
    const at = (fraction: number): number => window.start + fraction * length;
    const midnight = (t: number): boolean => dayStart(this.hass, new Date(t)) === t;
    // a midnight between the ends says its day ("Fri 00:00"): a bare 00:00 could be either
    const marks: Items = roundTicks({
      start: window.start,
      end: window.end,
      width,
      labelWidth: (text) => ruler.width('fv-axis', text),
      time,
      weekday,
      day: (t) => formatDate(this.hass, new Date(t), 'day'),
      date: (t) => formatDate(this.hass, new Date(t), 'short'),
      dateYear: (t) => formatDate(this.hass, new Date(t), 'short'),
    }).map(([fraction, text], index, all) =>
      index > 0 && index < all.length - 1 && midnight(at(fraction))
        ? [fraction, `${weekday(at(fraction))} ${time(at(fraction))}`]
        : [fraction, text],
    );
    // where the times do not hold, the days its midnights begin (Thu · Fri · Sat), else its ends' alone
    const days: Items = Array.from({ length: Math.round(length / DAY) + 1 }, (_unused, n) =>
      dayStart(this.hass, new Date(window.start + DAY / 2), n),
    )
      .filter((t) => t <= window.end)
      .map((t) => [(t - window.start) / length, weekday(t)]);
    const ends: Items = [days[0], days[days.length - 1]].filter(
      (item): item is readonly [number, string] => item !== undefined,
    );
    return [marks, days, ends].find(holds) ?? ends.slice(0, 1);
  }

  /* ---------- the marked windows ---------- */

  /**
   * The windows a lone series marks (`highlight`): of `highlight_hours` (one by default), the lowest mean and the
   * highest of what is to come — from now's slot on, where the window runs past now and the series reads three
   * windows' worth there (two marks on what is left of an evening would be one), else across all of it. Each is a
   * stretch of the plot in its tone (a price's cheapest the `ok` tone, its dearest the danger's; any other series' its
   * own) and words in four forms, longest first: "Cheapest 13:00–15:00 · 0.078 €/kWh", without the unit, without the
   * figure, the hours alone.
   */
  private marked(drawn: Drawn, window: Window, count: number): Marked[] {
    const wanted = this.config?.highlight ?? defaultWindows(this.config?.chart);
    if (wanted === 'none' || drawn.readings === undefined) return [];
    const length = window.end - window.start;
    const hours = Math.min(12, Math.max(1, Math.round(this.config?.highlight_hours ?? 1)));
    const k = Math.max(1, Math.round((hours * HOUR * count) / length));
    const nowSlot = Math.min(count - 1, Math.floor(((window.now - window.start) / length) * count));
    const ahead =
      window.now < window.end &&
      drawn.slots.slice(nowSlot).filter((v) => v !== null).length >= 3 * k;
    const picks = wanted === 'both' ? (['min', 'max'] as const) : [wanted];
    return picks.flatMap((pick): Marked[] => {
      const found = windowAt(drawn.slots, k, pick, ahead ? nowSlot : 0);
      if (!found) return [];
      const from = window.start + (found.start / count) * length;
      const to = window.start + ((found.start + k) / count) * length;
      const range = `${this.when(from, window)}–${formatTime(this.hass, new Date(to))}`;
      const key = drawn.price
        ? pick === 'min'
          ? 'cheapest'
          : 'priciest'
        : pick === 'min'
          ? 'lowest'
          : 'highest';
      const word = s(this.hass, key, { window: range });
      const { value, unit } = this.figureOf(drawn, found.mean);
      const tone: Tone = drawn.price ? (pick === 'min' ? 'ok' : 'danger') : 'accent';
      return [
        {
          from: found.start / count,
          to: (found.start + k) / count,
          tone,
          forms: [
            unit ? `${word} · ${value} ${unit}` : `${word} · ${value}`,
            `${word} · ${value}`,
            word,
            range,
          ],
        },
      ];
    });
  }

  /* ---------- the change on the period before ---------- */

  /**
   * The first series' change on the period before (its head's pill, "+5 %"): what has happened of the window against
   * as long a stretch one period earlier (a rolling window's length back, the day before for a calendar one) — a
   * measurement's mean, what a meter gained — where the recorder holds both; none from a list or a forecast.
   */
  private change(drawn: Drawn, window: Window): number | null {
    const readings = drawn.readings;
    if (!readings?.length || (drawn.source !== 'history' && drawn.source !== 'statistics'))
      return null;
    const back = previousOf(this.span);
    const to = Math.min(window.now, window.end);
    const statistics = drawn.source === 'statistics';
    const stat = statistics ? (drawn.item.stat ?? statOf(drawn.view.attr('state_class'))) : null;
    const counter = statistics
      ? stat === 'change' || stat === 'sum'
      : readingsOf(drawn.view.deviceClass, drawn.view.attr('state_class'), drawn.view.unit).rule !==
        'mean';
    const at = (t: number): number | null =>
      slotted(readings, { start: t, end: t + 1 }, 1, drawn.holding)[0] ?? null;
    const of = (start: number, end: number): number | null => {
      if (stat === 'change')
        return readings
          .filter((r) => r.t >= start && r.t < end)
          .reduce<number | null>((sum, r) => (sum ?? 0) + r.v, null);
      if (counter) {
        const [a, b] = [at(start), at(end - 1)];
        return a === null || b === null ? null : b - a;
      }
      return slotted(readings, { start, end }, 1, drawn.holding)[0] ?? null;
    };
    const now = of(window.start, to);
    const before = of(window.start - back, to - back);
    if (now === null || before === null || before === 0) return null;
    return ((now - before) / Math.abs(before)) * 100;
  }

  /* ---------- render ---------- */

  protected renderCard(): TemplateResult {
    const items = seriesOf(this.config);
    if (!items.length) return this.renderEmpty();
    const now = this.now();
    const days = this.days(now);
    const span = this.span;
    // the window as far as the readings reach (today and tomorrow is today until tomorrow is published)
    const window = windowOf(span, now, this.hass, this.latest(items, days));
    // the windows it marks are its own: the style's lowest and highest marks stay off
    const style = resolveStyle(
      this.config?.chart,
      { ...chartKeysOf(this.config), highlight: 'none' },
      capsFor(items.length, window.now < window.end),
    );
    const columns = isBars(style.preset) || items.some((item) => item.kind === 'columns');
    const stepped = style.curve === 'step' || items.some((item) => item.curve === 'step');
    const count = this.slotCount(window, items, days, columns, stepped);
    const drawn = this.drawn(window, count, items, days, style);
    return this.variant === 'tile'
      ? this.renderTile(drawn, window)
      : this.renderChartCard(drawn, window, count, style);
  }

  private renderChartCard(
    drawn: readonly Drawn[],
    window: Window,
    count: number,
    style: ResolvedStyle,
  ): TemplateResult {
    const config = this.config;
    const lead = drawn[0] as Drawn;
    const view = lead.view;
    const several = drawn.length > 1;
    const off = !several && !isUsable(view);
    const full = this.variant === 'full';
    const width = down4(this.contentWidth);
    const title = config?.title ?? (several ? s(this.hass, 'title') : lead.name);
    // "Unavailable" is said once, under the title; several series each say theirs in the off skin
    const stated = !several && view.status !== 'ok';
    const sub = stated ? stateText(this.hass, view) : (config?.subtitle ?? this.spanWords(window));
    // a window's words give way before they are cut; a state never is ("Entity not found" is "Not found" where narrow)
    const fitted = this.headFit.fit({
      width: this.contentWidth,
      title,
      sub,
      trailing: 44,
      shorter: !stated ? [''] : view.status === 'missing' ? [stateWord(this.hass, view)] : [],
    });
    const tone: Tone = off ? 'off' : toneOf(config, 'accent');
    const loading = drawn.some((d) => d.readings === undefined);
    const empty = !loading && drawn.every((d) => !d.slots.some((v) => v !== null));
    const marks = !several && !loading && !empty ? this.marked(lead, window, count) : [];
    const showHead = config?.show_head !== false;
    const legendShown = several && config?.show_legend !== false;
    // a legend of four or more under the axis in the columns that hold its items; two or three series', and one whose
    // columns would cut its names (a narrow card), the value row's lines, one a row, each reading at its end
    const cols = legendColumns(drawn.length, width, showHead);
    const inRow = legendShown && (drawn.length <= 3 || cols === 0);
    const row = full && (showHead || marks.length > 0 || inRow);
    const under = full && legendShown && !inRow;
    // the card's height is its config's alone (`chartHeight`): its room for a legend of four or more (two lines under
    // the axis) is the plot's where the legend takes less, and what it takes more of — a third line under the axis,
    // lines past the value row's — the plot gives; the value row's room is the chart's where the row has nothing to say
    const room = full && legendShown && drawn.length > 3 ? UNDER + linesTall(2) : 0;
    const legendMore = under
      ? UNDER + linesTall(Math.ceil(drawn.length / cols))
      : row && inRow
        ? Math.max(0, linesTall(drawn.length) - TOP)
        : 0;
    const height = CHART + (full && !row ? ROW : 0) + room - legendMore;
    // a row that says the reading reads the chart with it — the value, the time its label, or the legend's lines, the
    // time on the axis — and no bubble is drawn: the plot takes the bubble's room. A row of the marked windows' pills
    // alone leaves the bubble its room, over the plot and under the pills.
    const rowReads = full && (showHead || inRow);
    const headroom = rowReads ? TIGHT : HEADROOM;
    // the scale's column folds first where it would leave the plot under its least (half a section)
    const scaled =
      loading || empty
        ? null
        : this.specs(drawn, window, style, marks, { width, height, headroom });
    const specs =
      scaled && width - plotOf(scaled.main).left < PLOT_MIN
        ? this.specs(drawn, window, { ...style, axis: false }, marks, { width, height, headroom })
        : scaled;
    const fraction = this.scrubber.value;
    const read =
      specs && fraction !== null ? this.readAt(specs, drawn, window, count, fraction) : null;
    const values = drawn.map((d, i) => (read ? (read.values[i] ?? null) : d.now));
    const left = specs ? plotOf(specs.main).left : 0;
    // the legend's lines in the row read each series: when that is goes on the axis, under the cursor
    const when = rowReads && inRow ? read : null;
    return html`<article class="fv-card ch-card ${off ? 'is-unavailable is-off' : ''}" data-card>
      ${head({
        icon: fitted.icon ? (config?.icon ?? (several ? 'chart' : iconOf(view))) : null,
        small: fitted.small,
        tone,
        title,
        name: true,
        sub: fitted.sub,
        cut: fitted.cut,
        ...this.headActions(view.id),
        trailing: round('dots', 'quiet', this.t('common.more'), () =>
          this.tap(view.id, { action: 'more-info' }),
        ),
      })}
      ${
        row
          ? this.valueRow(drawn, values, read?.time ?? null, marks, window, { showHead, inRow })
          : nothing
      }
      <div
        class="ch-chart fv-tone--${off ? 'off' : toneOf(config, 'accent')}"
        style="height:${height}px;width:${width}px"
        role="img"
        tabindex="0"
        aria-label=${this.spoken(drawn, values, read?.time ?? null)}
        @keydown=${(event: KeyboardEvent) => this.scrubber.key(event, 1 / count)}
        ${scrub(this.scrubber)}
      >
        ${
          loading
            ? html`<div class="fv-skeleton"></div>`
            : specs
              ? this.drawCharts(specs, drawn, read, values, rowReads)
              : html`<div class="ch-empty" data-align="center">
                  ${ico(config?.icon ?? iconOf(view), 'neutral')}
                  <p class="fv-empty">${s(this.hass, 'empty')}</p>
                </div>`
        }
      </div>
      <div
        class="ch-axis ${when ? 'is-reading' : ''}"
        style=${left > 0 ? `margin-inline-start:${left}px` : nothing}
      >
        ${axis(this.axisItems(window, width - left))}
        ${when ? this.whenPill(when.time, when.x - left, width - left) : nothing}
      </div>
      ${
        under
          ? html`<div class="ch-legend" style="--ch-cols:${cols}">
              ${this.legendOf(drawn, showHead ? values : null)}
            </div>`
          : nothing
      }
    </article>`;
  }

  /**
   * The chart's drawings: one for the lines, and — where some series are columns — the columns first, on a nice
   * scale that reaches every line's readings, the lines over them on the same scale (each on its own where the units
   * differ), with no grid or scale of their own. Thresholds colour every line and bar; a lone series' marked windows
   * stand behind them.
   */
  private specs(
    drawn: readonly Drawn[],
    window: Window,
    resolved: ResolvedStyle,
    marks: readonly Marked[],
    frame: ChartFrame,
  ): Specs {
    const lead = drawn[0] as Drawn;
    // a step asked closer than the style's line reads draws every line thinner (`timeLine`)
    const style = {
      ...resolved,
      line: Math.min(resolved.line, ...drawn.map((d) => d.line?.style.line ?? resolved.line)),
    };
    const bars = isBars(style.preset);
    const own = new Set(drawn.map((d) => d.scale.unit)).size > 1 ? ('own' as const) : undefined;
    const zero = drawn.some(
      (d) =>
        d.price || readingsOf(d.view.deviceClass, d.view.attr('state_class'), d.view.unit).zero,
    );
    const stretches: Stretch[] = marks.map((m) => ({ from: m.from, to: m.to, colour: m.tone }));
    const asSeries = (d: Drawn, slots: boolean): ChartSeries => ({
      values: slots || d.curve === 'step' ? d.slots : d.points,
      ...(d.line && !slots ? { at: d.line.at.map((f) => f * d.cover) } : {}),
      colour: d.colour,
      name: d.name,
      ...(d.accent ? { accent: d.accent } : {}),
      ...(d.item.curve ? { curve: d.item.curve } : {}),
      ...fillFor(d, style),
      ...(d.band ? { band: d.band } : {}),
    });
    const common = {
      frame,
      zero,
      now: nowFraction(window),
      thresholds: thresholdsOf(this.config),
      stretches,
      tick: (value: number, decimals: number) => tickText(this.hass, value, decimals),
      measure: (text: string) => this.headFit.ruler.width('fc-tick', text),
      value: (value: number) => this.figureOf(lead, value).value,
      id: 'ch',
      ...(drawn.length > 1 ? { className: 'ch-several' } : {}),
    };
    const columned = bars ? drawn : drawn.filter((d) => d.kind === 'columns');
    const lined = bars ? [] : drawn.filter((d) => d.kind !== 'columns');
    if (!columned.length)
      return {
        main: {
          ...common,
          series: lined.map((d) => asSeries(d, false)),
          style,
          ...(own ? { scale: own } : {}),
        },
        over: null,
      };
    const main: ChartSpec = {
      ...common,
      series: columned.map((d) => asSeries(d, true)),
      style,
      kind: 'bars',
      reach: lined
        .flatMap((d) => [...d.points, ...(d.band ? [...d.band.low, ...d.band.high] : [])])
        .filter((v): v is number => v !== null),
    };
    if (!lined.length) return { main, over: null };
    const plot = plotOf(main);
    const ticks = plot.ticks ?? niceTicks(0, 1, 4, true);
    return {
      main,
      over: {
        ...common,
        frame: { ...common.frame, left: plot.left },
        stretches: [],
        series: lined.map((d) => asSeries(d, false)),
        style: { ...style, grid: { ...style.grid, axes: 'none' }, axis: false },
        kind: 'line',
        scale: own ?? { min: ticks.min, max: ticks.max },
        id: 'ch-over',
      },
    };
  }

  /** Where the chart is read at a fraction of its plot: the cursor's x, when that was, and each series' value there. */
  private readAt(
    specs: Specs,
    drawn: readonly Drawn[],
    window: Window,
    count: number,
    fraction: number,
  ): Read {
    // a stepped series and columns are read by their slot, which began then; a line where the cursor is — a line
    // through time at the round time nearest it, as Home Assistant reads it (each line there, every reading its own)
    const slotwise = specs.main.kind === 'bars' || drawn.every((d) => d.curve === 'step');
    const timed = slotwise ? undefined : drawn.find((d) => d.line);
    // what has happened, that is: past now on a calendar day a list or a forecast is read where it is pointed at
    const hit = timed && fraction <= timed.cover ? timed.line?.read(fraction / timed.cover) : null;
    const cursor = hit && timed ? hit.fraction * timed.cover : fraction;
    const read = readAt(specs.main, cursor);
    const plot = plotOf(specs.main);
    const f = Math.min(1, Math.max(0, (read.x - plot.left) / plot.width));
    // a key's step lands on a slot's start: a hair of rounding must not leave it in the slot before
    const slot = Math.min(count - 1, Math.floor(f * count + 1e-6));
    const length = window.end - window.start;
    return {
      cursor,
      x: read.x,
      time: this.when(hit ? hit.t : window.start + (slotwise ? slot / count : f) * length, window),
      values: drawn.map((d) => {
        if (d.kind === 'columns' || d.curve === 'step' || !d.points.length)
          return d.slots[slot] ?? null;
        if (!d.line) return between(d.points, f);
        const v = cursor > d.cover ? undefined : d.line.read(cursor / d.cover)?.v;
        return v === undefined ? null : v / d.scale.divisor;
      }),
    };
  }

  /**
   * The drawings and the bubble (the engine's `drawRead`, on the lines where columns lie under them): what the chart
   * reads at the cursor — the lone series' figure and when, or when alone over several (their legend says each) —
   * else, at rest, the end of what has happened where the style labels it. Where the value row reads the chart, the
   * row says it and no bubble is drawn: the cursor and the marks on the lines alone.
   */
  private drawCharts(
    specs: Specs,
    drawn: readonly Drawn[],
    read: Read | null,
    values: ReadonlyArray<number | null>,
    rowReads: boolean,
  ): TemplateResult {
    const cursor = read?.cursor ?? null;
    const main = { ...specs.main, cursor };
    const over = specs.over ? { ...specs.over, cursor } : null;
    const several = drawn.length > 1;
    const figure = this.figureOf(drawn[0] as Drawn, values[0] ?? null);
    const now: Said = { value: figure.value, ...(figure.unit ? { unit: figure.unit } : {}) };
    const at: Said | null =
      !read || rowReads ? null : several ? { value: read.time } : { ...now, time: read.time };
    // at rest the bubble says the reading now where the style labels it — not where the row says it, nor a dash
    const rest = several || rowReads || figure.value === '—' ? null : now;
    return html`${over ? drawChart(main) : nothing}${drawRead(
      over ?? main,
      at,
      rest,
      getComputedStyle(this).fontFamily,
    )}`;
  }

  /**
   * The value row: the first series' reading now (or where the chart is read) at the largest readout size that holds
   * with what goes beside it — its change on the period before, the marked windows' pills at the row's end, each in
   * the longest of its forms the room holds, gone where none does — or, for two or three series, the legend's lines,
   * each reading at its end.
   */
  private valueRow(
    drawn: readonly Drawn[],
    values: ReadonlyArray<number | null>,
    time: string | null,
    marks: readonly Marked[],
    window: Window,
    shown: { readonly showHead: boolean; readonly inRow: boolean },
  ): TemplateResult {
    if (shown.inRow)
      return html`<div
        class="ch-top"
        style=${drawn.length > 3 ? `height:${Math.max(TOP, linesTall(drawn.length))}px` : nothing}
      >
        <div class="ch-lines">${this.legendOf(drawn, shown.showHead ? values : null)}</div>
      </div>`;
    const width = this.contentWidth;
    const ruler = this.headFit.ruler;
    const lead = drawn[0] as Drawn;
    const label = time ?? this.t('common.now');
    const parts = this.figureOf(lead, values[0] ?? null);
    const change = shown.showHead && time === null ? this.change(lead, window) : null;
    const delta =
      change === null
        ? ''
        : `${change > 0 ? '+' : change < 0 ? '−' : ''}${formatNumber(this.hass, Math.abs(change), { digits: 0 })} %`;
    const deltaWidth = delta ? ruler.pill('fc-pill', delta, DELTA_SIDES) + 8 : 0;
    const readoutWidth = (size: (typeof SIZES)[number]): number =>
      Math.max(
        ruler.width('fv-readout > fv-readout__label', label),
        ruler.width(
          `fv-readout fv-readout--${size} > fv-readout__value`,
          parts.value,
          'fv-unit',
          parts.unit,
        ),
      );
    const pill = (text: string): number => ruler.pill('fc-pill', text, PILL_SIDES);
    const beside = (size: (typeof SIZES)[number]): number =>
      readoutWidth(size) + (delta && readoutWidth(size) + deltaWidth <= width ? deltaWidth : 0);
    const roomOf = (size: (typeof SIZES)[number] | null): number =>
      size ? width - beside(size) - GAP : width;
    // the pills say as much as the room holds, every one in the same form: the longest that all of them hold
    const FORMS = 4;
    const depth = (room: number): number => {
      for (let d = 0; d < FORMS; d++)
        if (marks.every((m) => pill(m.forms[d] as string) <= room)) return d;
      return FORMS;
    };
    // the readout at l or m, whichever lets the pills say the most (the larger on a tie); else as large as it holds
    const size = !shown.showHead
      ? null
      : ((['l', 'm'] as const)
          .filter((sz) => beside(sz) <= width)
          .reduce<(typeof SIZES)[number] | null>(
            (best, sz) => (best === null || depth(roomOf(sz)) < depth(roomOf(best)) ? sz : best),
            null,
          ) ??
        SIZES.find((sz) => readoutWidth(sz) <= width) ??
        'xs');
    const withDelta = size !== null && delta !== '' && readoutWidth(size) + deltaWidth <= width;
    const form = depth(roomOf(size));
    const pills = marks.flatMap((m) => {
      const text = m.forms[form];
      return text
        ? [
            html`<span
              class="fc-pill fv-tone--${m.tone}"
              data-measure="value"
              aria-label=${m.forms[0] as string}
              ><i class="fc-pill__dot"></i>${text}</span
            >`,
          ]
        : [];
    });
    return html`<div class="ch-top ${size ? '' : 'is-side-only'}">
      ${
        size
          ? html`<div class="ch-now">
              ${readout({ label, value: parts.value, unit: parts.unit, size })}
              ${
                withDelta
                  ? html`<span
                      class="fc-pill fv-tone--neutral ch-delta"
                      data-measure="value"
                      aria-label=${s(this.hass, 'change', { change: delta })}
                      >${glyph((change ?? 0) < 0 ? 'trendDown' : 'trendUp')}${delta}</span
                    >`
                  : nothing
              }
            </div>`
          : nothing
      }
      ${pills.length ? html`<div class="ch-side">${pills}</div>` : nothing}
    </div>`;
  }

  /**
   * While the legend's lines in the row read the chart, when that is: a pill on the axis (the bubble's colours) under
   * the cursor at `x`, kept inside the axis's `width`, over the hours it covers — the several sensors' card's: one
   * bubble over the plot would say a value no series but one has.
   */
  private whenPill(time: string, x: number, width: number): TemplateResult {
    const pill = this.headFit.ruler.pill('ch-when', time, 16);
    const left = Math.min(Math.max(x - pill / 2, 0), width - pill);
    return html`<span
      class="ch-when"
      data-measure="value"
      style="left:${left.toFixed(2)}px;width:${pill}px"
      >${time}</span
    >`;
  }

  /** The legend: each series' swatch in its colour, its name, its reading where one is given. */
  private legendOf(
    drawn: readonly Drawn[],
    values: ReadonlyArray<number | null> | null,
  ): TemplateResult {
    return legend(
      drawn.map((d, i) => {
        const parts = values ? this.figureOf(d, values[i] ?? null) : null;
        const colour = d.colour;
        return {
          name: d.name,
          ...(d.accent ? { accent: d.accent } : {}),
          ...(ownInk(colour)
            ? { paint: seriesPaint(colour) }
            : d.accent
              ? {}
              : { tone: colour as Tone }),
          ...(parts ? { value: parts.unit ? `${parts.value} ${parts.unit}` : parts.value } : {}),
        };
      }),
    );
  }

  /** What the chart says to a reader who cannot see it: when, and each series' name and its reading then. */
  private spoken(
    drawn: readonly Drawn[],
    values: ReadonlyArray<number | null>,
    time: string | null,
  ): string {
    return [
      time ?? this.t('common.now'),
      ...drawn.map((d, i) => {
        const { value, unit } = this.figureOf(d, values[i] ?? null);
        return `${d.name}: ${value}${unit ? ` ${unit}` : ''}`;
      }),
    ].join(' · ');
  }

  /**
   * The tile: the first series' reading (with its change's arrow) over a spark of every series across the window —
   * classic, or minimal where the card's style is — the sensor tile's anatomy; out of reach in the off skin.
   */
  private renderTile(drawn: readonly Drawn[], window: Window): TemplateResult {
    const lead = drawn[0] as Drawn;
    const view = lead.view;
    const usable = isUsable(view);
    const tone: Tone = !usable
      ? 'off'
      : lead.accent || ownInk(lead.colour)
        ? 'accent'
        : (lead.colour as Tone);
    const parts = this.figureOf(lead, lead.now);
    // the reading at m, else as large as the tile holds it whole (a price and its unit in half a section)
    const size =
      (['m', 's', 'xs'] as const).find(
        (sz) =>
          this.headFit.ruler.width(
            `fv-readout fv-readout--${sz} > fv-readout__value`,
            parts.value,
            'fv-unit',
            parts.unit,
          ) <=
          this.width - 32,
      ) ?? 'xs';
    const change = this.change(lead, window);
    const loading = drawn.some((d) => d.readings === undefined);
    const fine = chartKeysOf(this.config);
    const minimal = resolveStyle(this.config?.chart, fine, {}).preset === 'minimal';
    const series = drawn.flatMap((d): ChartSeries[] =>
      d.slots.some((v) => v !== null)
        ? [
            {
              ...(d.curve === 'step' || !d.points.length
                ? { values: d.slots }
                : {
                    values: d.points,
                    ...(d.line ? { at: d.line.at.map((f) => f * d.cover) } : {}),
                  }),
              colour: d.colour,
              ...(d.accent ? { accent: d.accent } : {}),
              ...(d.item.curve ? { curve: d.item.curve } : {}),
            },
          ]
        : [],
    );
    const open = (): void => this.tap(view.id);
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    };
    return html`<article
      class="fv-tile fv-tile--tap ${usable ? '' : 'is-unavailable is-off'}"
      data-card
      role="button"
      tabindex="0"
      .fvTap=${open}
      .fvHold=${() => this.hold(view.id)}
      @pointerdown=${startPress}
      @contextmenu=${preventMenu}
      @click=${clickPress}
      @keydown=${key}
    >
      <div class="fv-tile__head">
        ${ico(this.config?.icon ?? iconOf(view), tone)}
        ${
          change !== null && Math.abs(change) >= 1
            ? html`<span class="fv-trend ${change < 0 ? 'fv-trend--down' : ''}"
                >${glyph(change < 0 ? 'trendDown' : 'trendUp')}</span
              >`
            : nothing
        }
      </div>
      ${readout({ label: this.config?.title ?? lead.name, value: parts.value, unit: parts.unit, size })}
      <div class="ch-spark fv-tone--${tone}">
        ${
          loading
            ? html`<div class="fv-skeleton"></div>`
            : series.length
              ? drawChart({
                  frame: { width: down4(this.width - 32 - 8), height: SPARK, headroom: 4, pad: 4 },
                  series,
                  style: resolveStyle(minimal ? 'minimal' : 'classic', fine, {}),
                  now: nowFraction(window),
                  ...(series.length > 1 ? { scale: 'air' as const } : {}),
                  thresholds: thresholdsOf(this.config),
                  id: 'ch-spark',
                })
              : nothing
        }
      </div>
    </article>`;
  }
}
