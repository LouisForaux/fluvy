import { energyHeight } from '../energy-family.js';
import {
  chartDefaults,
  clock12,
  dateFormat,
  fetchHistory,
  formatNumber,
  formatTime,
  houseZone,
  isUsable,
  plural,
  stateText,
  strings,
  wallClock,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
  type Series,
  type ValueParts,
} from '@fluvy/core';

import { axis, emptyState, head, readout, round, type Tone } from '@fluvy/ui';
import { energyStyles } from '@fluvy/ui/styles/energy';
import {
  AXIS_GAP,
  chartKeysOf,
  chartStyles,
  drawRead,
  gridClass,
  gridLines,
  plotOf,
  readingsOf,
  resolveStyle,
  styleOf,
  scrub,
  ScrubController,
  tickLabels,
  tickText,
  timeLine,
  UNIT_COLUMN,
  unitLabel,
  type ChartSpec,
  type ResolvedStyle,
  type TimeLine,
} from '../chart/engine/index.js';
import type { ChartCaps, ChartKeys, GridChoice, LineWidth } from '../shared/chart-config.js';

import {
  css,
  html,
  nothing,
  svg,
  type CSSResultGroup,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';

import { Card, type CardEditor } from '../shared/base.js';
import { stateWord } from '../shared/domain.js';

import { HeadFit } from './head.js';
import { axisHolds } from '../shared/axis.js';
import { powerScale, type PowerScale } from './axes.js';

import { legendStats } from './legend.js';
import { statsCols, statsStyles } from './stats.js';

import { costParts, family, readoutParts, scaled, scaleOf, type Scale } from './power.js';
import {
  CollectionFollower,
  collectionKeyOf,
  type EnergyDataLike,
  type FollowedRange,
} from '../energy-model/collection.js';
import { fetchPrefs } from '../energy-model/house.js';
import {
  allocatePeriod,
  fetchPeriod,
  fetchRange,
  fullDays,
  houseMidnight,
  type PeriodEnergy,
  type Range,
} from '../energy-model/period.js';
import { allocate } from '../energy-model/allocate.js';
import {
  bucketMinutes,
  fetchMeanSeries,
  fetchPowerDay,
  liveTotals,
  powerBuckets,
  powered,
  type MeanSeries,
} from '../energy-model/power-day.js';
import { measureIds, readPrefs, type EnergyPrefs, type PrefSource } from '../energy-model/prefs.js';
import { KIND } from '../energy-model/sources.js';
import { rangeWords } from '../energy-model/range-words.js';
import {
  chargedBatteries,
  chargeNow,
  chargePoints,
  fetchChargeDay,
} from '../energy-model/soc-day.js';
import {
  aggregate,
  bandEdges,
  chargeLine,
  crosses,
  flowExtent,
  flowShape,
  flowsOf,
  integrate,
  integrateFlows,
  LAYERS,
  meterBlock,
  OUTFLOWS,
  stackExtent,
  stackOf,
  stackShape,
  type Bucket,
  type ChargePoint,
  type FlowDay,
  type FlowPoint,
  type Layer,
  type Outflow,
  type StackPoint,
} from './stack.js';
import { energyLegend, type LegendEntry } from './legend-row.js';
import { figuresOf, toBase, type NumberKeys } from '../shared/units.js';
import { sideStacked } from '../shared/value-row.js';
import { ITEM_ALIASES, type AliasSpec } from '../shared/config.js';
import { toneOf } from '../shared/colour.js';

const s = strings('energy');
const flow = strings('energy-flow');

export interface EnergyLegendItem extends NumberKeys {
  entity: string;
  name?: EntityName;
  /**
   * `today`: the sensor's change since the house's midnight (over the range of a date picker the card follows), from
   * its statistics — a lifetime meter's day, where its state is all it ever counted. Without it, its state.
   */
  period?: 'today';
}

/**
 * The chart keys (`shared/chart-config.ts`): the line's style and its fine keys; on a stacked chart (`sources`,
 * `overview`) the style (classic, soft or step), the line's width, the gridlines and the scale.
 */
export interface EnergyCardConfig extends FluvyCardConfig, NumberKeys, Omit<ChartKeys, 'show_now'> {
  subtitle?: string;
  /**
   * Window of the curve: 24 draws today on a 00:00 … 24:00 axis, anything else rolls; none: the house's (Charts, 12 by
   * default, where it was 24 before 1.18).
   */
  hours?: number;
  /** The sensor read the other way round: a grid meter that reads negative while it imports reads "1.4 kW" now. */
  invert?: boolean;
  /** A price or running-cost sensor shown beside the big value (€/h, €/kWh, …). */
  cost_entity?: string;
  show_cost?: boolean;
  /** Up to three sensors under the chart (grid / solar / house energy today). */
  legend?: ReadonlyArray<string | EnergyLegendItem>;
  /**
   * `full` (default): the reading, the chart, its axis and the legend. `compact`: the head, the chart and its axis.
   * `sources`: the house's power today by where it came from, stacked, and what went to the grid below the line
   * (the Energy dashboard's meters; the entity, when given, is the reading at the top). `overview`: the whole house
   * today — every source's power above the line (the sun's whole production), the battery's charge and the export
   * below it, the house's use as a line and the batteries' state of charge on its own scale.
   */
  variant?: 'full' | 'compact' | 'sources' | 'overview';
  /** `overview`: the batteries' state of charge as a dashed line (on when the Energy dashboard names one). */
  show_soc?: boolean;
  /** `overview`: the house's use as a line over the sources. */
  show_house?: boolean;
  /**
   * The scale: on a stacked chart the power's at the chart's start (kW or W) and, under the charge's line, its own
   * 0–100 % at the end — each where the plot keeps its room (on by default); on the line, where its style draws one.
   */
  show_axis?: boolean;
  /**
   * The gridlines: on a stacked chart across it at the power's ticks (on by default; `false` or `none` takes them
   * away, as `x` does — a stacked chart draws none down it); on the line, as its style draws them.
   */
  show_grid?: GridChoice;
  /** The chart's lines: `regular` (2 px on a stacked chart, the default), `thin` (1 px) or `bold` (3 px). */
  line_width?: LineWidth;
  /** `sources` and `overview`: every source on the one before it (the default), or each drawn from zero on its own. */
  stack?: boolean;
  /**
   * An Energy date picker's key (`energy_…`): the chart draws its range in place of `hours` — a day's hours, a longer
   * range's days — from Home Assistant's own figures where it has them.
   */
  collection_key?: string;
  /** Test hook, as in the clock and calendar cards: an ISO instant the card takes for "now". */
  _now?: string;
}

const DAY = 86_400_000;

/**
 * What the card's charts draw: a sensor's line (`full`, `compact`) in the line styles, on a scale of its own where a
 * style draws one, its window ending at now; a stacked chart (`sources`, `overview`) classic, soft or stepped, its
 * stacks the house's own geometry (`stack.ts`), its line's width, gridlines and scale the keys that act on it.
 */
export const LINE_CAPS: ChartCaps = {
  axis: true,
  styles: ['classic', 'soft', 'glow', 'minimal', 'step'],
  time: true,
};
export const STACK_CAPS: ChartCaps = {
  axis: true,
  styles: ['classic', 'soft', 'step'],
  keys: ['line_width', 'show_grid', 'show_axis'],
};

/** Whether a stacked chart draws its gridlines: on, unless asked away (or asked down the chart only, which it draws none of). */
const gridOn = (choice: GridChoice | undefined): boolean =>
  choice !== false && choice !== 'none' && choice !== 'x';

/**
 * A range's length in ms (an open one's, until now). Its end is the last millisecond it holds (a day's 23:59:59.999,
 * as Home Assistant's pickers end it): a day is 24 hours, and the middle of its axis 12:00.
 */
const spanOf = (range: Range, now: Date): number =>
  (range.end ? range.end.getTime() + 1 : now.getTime()) - range.start.getTime();

/** Whether a range holds the moment: its "right now" reading is of the range. */
const holdsNow = (range: Range, now: Date): boolean =>
  now.getTime() >= range.start.getTime() && (!range.end || now.getTime() <= range.end.getTime());

const CHART_HEIGHT = 120;
/** The stacked chart of the `sources` variant: 160, the zero line where the day's use and export divide it. */
const SOURCES_CHART = 160;
/** The `overview` chart: 184, its tag's line (16) and 12 above the tallest stack and the charge's 100 %. */
const OVERVIEW_CHART = 184;
const OVERVIEW_TOP = 28;
/** The cursor starts under the chart's tag row (16) and 4 more, so it never runs into a tag's words. */
const CURSOR_TOP = 20;

/** A tag in a stacked chart: its words (or a figure, untracked), its box (16 tall), and the side it sits on. */
interface ChartTag {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly end: boolean;
  readonly figure: boolean;
}

/** A tag's classes: its side, and a figure's untracked set. */
const tagClass = (end: boolean, figure: boolean): string =>
  `en-chart__tag${end ? ' en-chart__tag--end' : ''}${figure ? ' en-chart__tag--figure' : ''}`;

/** The mask the lines and the cursor give way through, round each tag's box (4 round); the areas pass under them. */
const tagMask = (tags: readonly ChartTag[], w: number, h: number): SVGTemplateResult =>
  svg`<defs><mask id="en-tags" maskUnits="userSpaceOnUse" x="0" y="0" width=${w} height=${h}><rect width=${w} height=${h} fill="white"></rect>${tags.map((t) => svg`<rect x=${t.x - 4} y=${t.y - 4} width=${t.w + 8} height="24" rx="4" fill="black"></rect>`)}</mask></defs>`;

const tagSpan = (tag: ChartTag): TemplateResult =>
  html`<span class=${tagClass(tag.end, tag.figure)} style="top:${tag.y}px">${tag.text}</span>`;

/** The cursor's dots, drawn over the chart and its tags: a dot is never under a tag's words. */
const dotsOver = (w: number, h: number, dots: SVGTemplateResult | typeof nothing): TemplateResult =>
  html`<svg
    class="en-chart__dots"
    width=${w}
    height=${h}
    viewBox="0 0 ${w} ${h}"
    aria-hidden="true"
    data-measure="drawn"
  >
    ${dots}
  </svg>`;
/** The least plot a stacked chart's scales leave (px): with the power's alone, and with the charge's beside it. */
const PLOT_MIN = 120;
const PLOT_MIN_TWO = 200;

/**
 * A stacked chart's frame at the card's width: the plot's left edge and width (the scales stand outside it), the
 * power's scale (null: the chart as 1.6 drew it, no scale and no gridlines, on the day's own extremes), and what of it
 * is drawn — the power's ticks and unit at the plot's start, the charge's 0–100 % at the card's end, the gridlines.
 */
interface Frame {
  readonly left: number;
  readonly width: number;
  readonly scale: PowerScale | null;
  readonly axis: boolean;
  readonly charge: boolean;
  readonly grid: boolean;
}

/** A chart line's key beside a readout's label (energy.css): 12 wide, 8 from the words. */
const KEY = 20;
const HEADROOM = 44; // the bubble's room: the chart rule in design/language.md
/** The history's means over a window, 288: five minutes each over a day; the curve draws at most one a pixel. */
const FINE = 288;
const REFRESH = 5 * 60_000; // how long the shared history cache keeps an answer
const DAY_MINUTES = 24 * 60;
const DAY_FROM = 3; // hours into the day from which "24 h" means the calendar day (40 px of curve in a 320 column)

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** The point nearest `at` within one bucket (`step`), or none: nothing is read across a gap. */
function nearest<P extends { readonly at: number }>(
  points: readonly P[],
  at: number,
  step: number,
): P | undefined {
  const near = points.reduce<P | undefined>(
    (best, p) => (!best || Math.abs(p.at - at) < Math.abs(best.at - at) ? p : best),
    undefined,
  );
  return near && Math.abs(near.at - at) <= step ? near : undefined;
}

/** Minutes into the day on the clock Home Assistant shows (the server's zone when the user chose it). */
function minutesIntoDay(hass: HomeAssistant | undefined, now: Date): number {
  const wall = wallClock(now, houseZone(hass));
  return wall.hour * 60 + wall.minute + wall.second / 60;
}

/**
 * Today's buckets for the `sources` and `overview` variants — or a followed range's: the power sensors' means (kW)
 * or the meters' blocks (kWh), one bucket's length, where the day (or the range) starts and how long it is, and — from
 * the meters — the hours as the Energy dashboard allocates them, which the legend quotes so its figures match the
 * dashboard's.
 */
interface SourcesDay {
  readonly buckets: readonly Bucket[];
  readonly minutes: number;
  readonly unit: 'kW' | 'kWh';
  readonly midnight: number;
  /** The day's length (a day, or the followed range's). */
  readonly span: number;
  readonly hours: PeriodEnergy | null;
}

/** The by-source day's energy by origin (kWh): what its legend says. */
interface UsedDay {
  readonly used: Readonly<Record<Layer, number>>;
  readonly charged: number;
  readonly exported: number;
}

interface ChartWindow {
  /** The axis is the calendar day and the series covers midnight → now. */
  readonly day: boolean;
  /** Hours of history to ask for. */
  readonly hours: number;
  /** Fraction of the axis the series covers. */
  readonly extent: number;
  /** A date picker's range: the series is its means, and over more than a day the axis is its dates. */
  readonly range?: FollowedRange;
}

/**
 * Power now and today's curve: the big tabular figure with its running cost, the power sensor drawn
 * up to "now" with the value bubble on the cursor, the axis, and up to three totals as a legend row.
 *
 * On a 24 h card the axis IS the day: the series covers midnight → now and the curve stops at the
 * true fraction of the day elapsed (before 03:00 there is no day to draw yet, and the last 24 h roll).
 * Any other window rolls: the series spans the full width and the axis counts back in hours.
 */
export class FluvyEnergyCard extends Card<EnergyCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: EnergyCardConfig): number {
    return energyHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    energyStyles,
    statsStyles,
    chartStyles,
    css`
      .ef-card {
        width: 100%;
      } /* the sheet fixes 360; a card takes the column it is given */
      .ef-chart .fv-skeleton {
        height: ${CHART_HEIGHT}px;
      }
      .ef-chart .fv-curve {
        display: block;
        overflow: visible;
      } /* the dot at "now" stays whole when now is the edge of the axis */
      .is-unavailable .fv-curve .curve-dot,
      .is-unavailable .fv-curve .curve-cursor,
      .is-unavailable .ef-chart .fv-knob {
        display: none;
      } /* the history is real; a reading at "now" is not */
      .fv-axis span {
        white-space: nowrap;
      } /* "12 AM" on a 12-hour clock is one label */
      /* the bubble arrives with the dot it belongs to, after the line has drawn itself */
      .ef-chart .fv-bubble {
        animation: fv-fade 500ms var(--fv-ease) both;
        animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
      }
      /* a stacked chart's lowest tick label is centred on the foot: it reaches past the drawing's box */
      .en-chart > svg {
        overflow: visible;
      }
      /* under a scale the zero line is the plot's baseline: a solid hairline, the gridlines dashed beside it */
      .en-chart.is-scaled .en-zero {
        stroke: var(--fluvy-border-strong, var(--fluvy-text-disabled));
        stroke-dasharray: none;
      }
      /* unstacked, every band starts on zero and they overlap: lighter, and seen through */
      .en-area.is-own {
        fill: color-mix(in srgb, var(--ink) 24%, transparent);
      }
      /* each band's edge at the cursor while the chart is read: the charge's dot, in the band's ink */
      .en-band-dot {
        fill: var(--ink);
        stroke: var(--fluvy-card);
        stroke-width: 1.5;
      }
      /* one the charge's dot would cover: the house's ring, in the band's ink, round the charge's dot */
      .en-band-dot.is-ring {
        fill: var(--fluvy-card);
        stroke: var(--ink);
        stroke-width: 2;
      }
      /* thin lines (1 px): the bands' edges, the house's line, the charge's dashes, a lone curve */
      .is-thin .en-area-line,
      .is-thin .en-house,
      .is-thin .en-soc,
      .is-thin .fv-curve .curve-line {
        stroke-width: 1;
      }
      .is-thin .en-soc-halo {
        stroke-width: 3;
      }
      /* bold lines (3 px), a stacked chart's */
      .is-bold .en-area-line,
      .is-bold .en-house,
      .is-bold .en-soc {
        stroke-width: 3;
      }
      .is-bold .en-soc-halo {
        stroke-width: 5;
      }
      /* the soft style: lighter fills under the same edges, hairlines across */
      .is-soft .en-area {
        fill: color-mix(in srgb, var(--ink) 24%, var(--fluvy-card));
      }
      .is-soft .en-area.is-own {
        fill: color-mix(in srgb, var(--ink) 16%, transparent);
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    series_: { state: true },
    loaded_: { state: true },
    day_: { state: true },
    charge_: { state: true },
    counted_: { state: true },
  };

  /** The line's readings: the history's means over its window, or a picker's range bucket by bucket (`step`). */
  declare series_: (Series & Partial<Pick<MeanSeries, 'step'>>) | null;
  declare loaded_: boolean;
  /**
   * The `sources` and `overview` variants: today's buckets (from the power sensors' five-minute means when the Energy
   * dashboard names them, else from its meters in fifteen-minute blocks). Shaped when drawn, so a variant changed in
   * the editor draws from the same day at once.
   */
  declare day_: SourcesDay | null;
  /** `overview`: the batteries' state of charge through today (null: none stated, or not readable). */
  declare charge_: ChargePoint[] | null;
  /** The legend's `period: today` meters: each one's change over the card's day, in kWh for energy (null: not read yet). */
  declare counted_: ReadonlyMap<string, number> | null;
  /** Each day's shapes, made once per day fetched. */
  private readonly shaped = new WeakMap<
    SourcesDay,
    { stack?: StackPoint[]; flows?: FlowPoint[] }
  >();
  /** The charge request already made. */
  private askedCharge = '';
  /** The legend's day request already made. */
  private askedCount = '';
  private prefs: EnergyPrefs | null | undefined;
  /** The preferences asked (the line's tone reads them). */
  private prefsAsked = false;
  /** The plot's left edge and width under a stacked chart's scales; null: the chart is its whole width. */
  private plotSpan: readonly [left: number, width: number] | null = null;
  /**
   * Where the chart is being read, a fraction of its plot (a pointer over a scale reads the plot's end beside it);
   * null: it shows now.
   */
  private readonly scrubber = new ScrubController(this, (fraction) => {
    const span = this.plotSpan;
    return span && span[1] > 0
      ? clamp((fraction * this.contentWidth - span[0]) / span[1], 0, 1)
      : fraction;
  });

  /** The request already made, so a re-render does not repeat it. */
  private asked = '';
  private readonly head = new HeadFit(this);
  private readonly follower = new CollectionFollower(this);
  /** The picker's answer the day was last drawn from. */
  private followed: EnergyDataLike | undefined;

  constructor() {
    super();
    this.series_ = null;
    this.loaded_ = false;
    this.day_ = null;
    this.charge_ = null;
    this.counted_ = null;
  }

  /** The card's head is its sensor's name (`title` was the older word for it); a legend item's `label` is its name. */
  static override aliases: AliasSpec = {
    keys: [{ from: 'title', to: 'name' }],
    items: { legend: ITEM_ALIASES },
  };
  /** The card's editor: fetched the first time the card is edited, never by a dashboard. */
  static override editor(): Promise<CardEditor> {
    return import('./energy-editor.js');
  }

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): EnergyCardConfig {
    const sensors = entities.filter((id) => id.startsWith('sensor.'));
    const entity =
      sensors.find((id) => hass?.states[id]?.attributes.device_class === 'power') ??
      sensors[0] ??
      '';
    return { type: 'custom:fluvy-energy-card', entity };
  }

  protected override prepare(config: EnergyCardConfig): EnergyCardConfig {
    if (!config.entity && config.variant !== 'sources' && config.variant !== 'overview')
      throw new Error('fluvy-energy-card: "entity" is required');
    collectionKeyOf(config, 'fluvy-energy-card');
    return config;
  }

  private get bySource(): boolean {
    return this.config?.variant === 'sources';
  }

  private get wholeHouse(): boolean {
    return this.config?.variant === 'overview';
  }

  /** Drawn from the Energy dashboard's sources (by source, or the whole house). */
  private get fromSources(): boolean {
    return this.bySource || this.wholeHouse;
  }

  private get compact(): boolean {
    return this.config?.variant === 'compact';
  }

  override getCardSize(): number {
    return this.compact ? 4 : this.legend().length ? 7 : 6;
  }
  /** The full card takes a section, the compact one half of it: a chart still reads in a half. */
  override getGridOptions(): LovelaceGridOptions {
    return this.compact
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    const ids = this.legend().map((item) => item.entity);
    if (this.config?.entity) ids.push(this.config.entity);
    if (this.config?.cost_entity) ids.push(this.config.cost_entity);
    // by source, "right now" is the house's own use: every source's power sensor
    if (this.fromSources) ids.push(...this.prefSources().flatMap((p) => measureIds(p.measure)));
    // the whole house quotes its batteries' charge now
    if (this.wholeHouse) ids.push(...chargedBatteries(this.prefSources()).map((b) => b.soc ?? ''));
    return ids;
  }

  /** The Energy dashboard's sources (known once the preferences have been read). */
  private prefSources(): readonly PrefSource[] {
    return this.prefs ? readPrefs(this.prefs).sources : [];
  }

  /**
   * The tone of what the line shows, where the card names none: what the Energy dashboard says its sensor is — a
   * source's power or meter that source's (the sun's, the grid's, a battery's …), an individual device's the house's
   * — else the accent. Read from the house's settings, never from a reading, so it holds whatever the sensor says.
   */
  private lineTone(id: string): Tone {
    const house = readPrefs(this.prefs);
    const source = house.sources.find((p) =>
      [...measureIds(p.measure), ...p.energyIn, ...p.energyOut].includes(id),
    );
    if (source) return KIND[source.kind].tone;
    return house.devices.some((d) => d.stat === id || d.power === id) ? 'house' : 'accent';
  }

  private legend(): EnergyLegendItem[] {
    return (this.config?.legend ?? [])
      .slice(0, 3)
      .map((item) => (typeof item === 'string' ? { entity: item } : item));
  }

  /**
   * A legend entry's reading: its sensor's, or — `period: today` — its change over the card's day as a reading of
   * its own, in kWh for energy ("—" until it is read).
   */
  private legendView(id: string, item: EnergyLegendItem): EntityView {
    const view = this.entity(id);
    if (item.period !== 'today' || view.status === 'missing') return view;
    const change = this.counted_?.get(id);
    return change === undefined
      ? { ...view, status: 'unknown', number: null }
      : {
          ...view,
          status: 'ok',
          number: change,
          ...(family(view) === 'energy' ? { unit: 'kWh' } : {}),
        };
  }

  /** The sensor's number as the card reads it: its own, or the other way round (`invert`). */
  private signed(view: EntityView): number | null {
    return view.number !== null && this.config?.invert ? -view.number : view.number;
  }

  /** What the readouts print of the sensor now, read as the card reads it. */
  private reading(view: EntityView): ValueParts {
    const signed = this.config?.invert ? this.signed(view) : null;
    return readoutParts(this.hass, view, signed ?? undefined, this.config);
  }

  /* ---------- history ---------- */

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : undefined;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  private chartWindow(now: Date = this.now()): ChartWindow {
    // a date picker's range: a day on the day's axis (up to now while it holds it), a longer range on its dates
    const range = this.follower.range();
    if (range) {
      const span = spanOf(range, now);
      return {
        day: fullDays(range.start, range.end ?? now) < 1,
        hours: span / 3_600_000,
        extent: clamp((now.getTime() - range.start.getTime()) / span, 0, 1),
        range,
      };
    }
    const house = chartDefaults().settings.window;
    const asked = clamp(Math.round(Number(this.config?.hours ?? house)) || house, 1, 168);
    const minutes = minutesIntoDay(this.hass, now);
    // the first hours of a day are a few pixels of curve blown up to full height: until there is a day to draw, the last 24 h roll
    if (asked !== 24 || minutes < DAY_FROM * 60) return { day: false, hours: asked, extent: 1 };
    // asked in five-minute steps, so cards opened within the same beat share one cached answer
    const hours = Math.floor(minutes / 5) / 12;
    return {
      day: true,
      hours,
      extent: clamp(minutes / DAY_MINUTES, 0, 1),
    };
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.follower.attach(this.hass, this.config?.collection_key || undefined);
    const previous = changed.get('config') as EnergyCardConfig | undefined;
    if (
      previous &&
      (previous.entity !== this.config?.entity ||
        previous.hours !== this.config?.hours ||
        previous.invert !== this.config?.invert ||
        previous.collection_key !== this.config?.collection_key)
    ) {
      this.series_ = null; // another sensor or window: its curve is loading, the old one is not shown in its place
      this.loaded_ = false;
      this.asked = '';
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    void this.load();
  }

  private async load(): Promise<void> {
    if (this.wholeHouse) void this.loadCharge();
    if (this.fromSources) return this.loadSources();
    const id = this.config?.entity;
    const hass = this.hass;
    if (!hass) return;
    // what the Energy dashboard says the sensor is, for the line's tone: asked once (the connection keeps it)
    if (!this.prefsAsked) {
      this.prefsAsked = true;
      void fetchPrefs(hass).then((prefs) => {
        this.prefs = prefs;
        this.requestUpdate();
      });
    }
    void this.loadCounted(hass);
    if (!id || !hass.states[id]) return;
    const { hours, range } = this.chartWindow();
    const now = this.now();
    const beat = Math.floor(now.getTime() / REFRESH);
    // a picker's range: the sensor's means over it, from the recorder's statistics (again every five minutes while it
    // holds now)
    const key = range
      ? `${id}|${range.start.toISOString()}|${range.end?.toISOString() ?? ''}|${holdsNow(range, now) ? beat : ''}`
      : `${id}|${hours}|${beat}`;
    if (key === this.asked) return;
    this.asked = key;
    const series = await (range
      ? fetchMeanSeries(hass, id, range, now)
      : fetchHistory(hass, id, hours, FINE, false, this.config?._now));
    if (key !== this.asked) return; // a newer request owns the chart
    // read the other way round, the curve is too: its least is its greatest
    this.series_ =
      series && this.config?.invert
        ? {
            ...series,
            values: series.values.map((v) => -v),
            ...(series.readings
              ? { readings: series.readings.map((r) => ({ t: r.t, v: -r.v })) }
              : {}),
            min: -series.max,
            max: -series.min,
            average: -series.average,
          }
        : series;
    this.loaded_ = true;
  }

  /**
   * The legend's `period: today` meters over the card's day: their statistics' change since the house's midnight, or
   * over the range of the date picker the card follows — the Energy dashboard's arithmetic, asked every five minutes.
   */
  private async loadCounted(hass: HomeAssistant): Promise<void> {
    const ids = this.legend()
      .filter((item) => item.period === 'today')
      .map((item) => item.entity);
    const now = this.now();
    const range = this.follower.range() ?? { start: houseMidnight(hass, now) };
    const key = `${ids.join()}|${range.start.getTime()}|${range.end?.getTime() ?? ''}|${Math.floor(now.getTime() / REFRESH)}`;
    if (!ids.length || key === this.askedCount) return;
    this.askedCount = key;
    const counted = await fetchRange(hass, [], range, ids);
    if (key === this.askedCount) this.counted_ = counted?.byStat ?? new Map();
  }

  /**
   * Today's buckets. With the power sensors the Energy dashboard names for every source, they are their five-minute
   * means — what Home Assistant's own "Power sources" graph draws — and the legend their integral. Without them, the
   * meters: their five-minute changes summed into fifteen-minute blocks (coarse meters even out), and the legend the
   * hours as the dashboard allocates them.
   */
  private async loadSources(): Promise<void> {
    const hass = this.hass;
    if (!hass) return;
    const range = this.follower.range();
    if (range) return this.loadFollowed(hass, range);
    const now = this.now();
    const key = `sources|${Math.floor(now.getTime() / 300_000)}`;
    if (key === this.asked) return;
    this.asked = key;
    this.prefs ??= await fetchPrefs(hass);
    const all = readPrefs(this.prefs).sources;
    const midnight = houseMidnight(hass, now).getTime();
    if (powered(all)) {
      const rows = await fetchPowerDay(hass, all, now);
      if (key !== this.asked) return;
      const buckets = rows ? powerBuckets(rows, all) : [];
      if (buckets.length) {
        this.day_ = { buckets, minutes: 5, unit: 'kW', midnight, span: DAY, hours: null };
        this.loaded_ = true;
        return;
      }
    }
    const metered = all.filter((p) => p.energyIn.length || p.energyOut.length);
    if (!metered.length) {
      this.day_ = null;
      this.loaded_ = true;
      return;
    }
    const [fine, hours] = await Promise.all([
      fetchPeriod(hass, metered, 'day', now, [], '5minute'),
      fetchPeriod(hass, metered, 'day', now),
    ]);
    if (key !== this.asked) return;
    // a block over which the meters' own step does not show (15 minutes for a precise meter)
    const minutes = fine ? meterBlock(fine.buckets) : 15;
    this.day_ = fine
      ? {
          buckets: aggregate(fine.buckets, midnight, minutes),
          minutes,
          unit: 'kWh',
          midnight,
          span: DAY,
          hours,
        }
      : null;
    this.loaded_ = true;
  }

  /**
   * A date picker's range, once per answer: the power sensors' means as Home Assistant fetched them (its own "Power
   * sources" graph's rows), else the meters over the range — five-minute changes for a day, hours beyond — and the
   * legend's totals as Home Assistant allocated them.
   */
  private async loadFollowed(hass: HomeAssistant, range: Range): Promise<void> {
    const data = this.follower.data();
    if (!data || data === this.followed) return;
    this.followed = data;
    this.prefs ??= await fetchPrefs(hass);
    const all = readPrefs(this.prefs).sources;
    const midnight = range.start.getTime();
    const span = spanOf(range, this.now());
    if (powered(all)) {
      const buckets = powerBuckets(data.stats, all);
      if (buckets.length) {
        const minutes = bucketMinutes(data.stats);
        this.day_ = { buckets, minutes, unit: 'kW', midnight, span, hours: null };
        this.loaded_ = true;
        return;
      }
    }
    const metered = all.filter((p) => p.energyIn.length || p.energyOut.length);
    if (!metered.length) {
      this.day_ = null;
      this.loaded_ = true;
      return;
    }
    const step = span <= DAY ? '5minute' : 'hour';
    const fine = await fetchRange(hass, metered, range, [], step);
    if (this.followed !== data) return;
    const minutes = step === 'hour' ? 60 : fine ? meterBlock(fine.buckets) : 15;
    this.day_ = fine
      ? {
          buckets: aggregate(fine.buckets, midnight, minutes),
          minutes,
          unit: 'kWh',
          midnight,
          span,
          hours: allocatePeriod(data.stats, metered),
        }
      : null;
    this.loaded_ = true;
  }

  /** The batteries' state of charge through today (`overview`): today's alone, so not another day a picker holds. */
  private async loadCharge(): Promise<void> {
    const hass = this.hass;
    if (!hass || this.config?.show_soc === false || !this.chargeShown()) return;
    const now = this.now();
    const key = `charge|${Math.floor(now.getTime() / 300_000)}`;
    if (key === this.askedCharge) return;
    this.askedCharge = key;
    this.prefs ??= await fetchPrefs(hass);
    const batteries = chargedBatteries(readPrefs(this.prefs).sources);
    const rows = batteries.length ? await fetchChargeDay(hass, batteries, now) : null;
    if (key !== this.askedCharge) return;
    this.charge_ = rows ? chargePoints(rows, batteries, houseMidnight(hass, now).getTime()) : null;
  }

  /** Today's points by origin (`sources`), shaped once per day fetched. */
  private stackPoints(day: SourcesDay): StackPoint[] {
    const cached = this.shaped.get(day) ?? {};
    cached.stack ??= stackOf(day.buckets, day.midnight, day.minutes, day.unit, day.span);
    this.shaped.set(day, cached);
    return cached.stack;
  }

  /** Today's flows (`overview`), shaped once per day fetched. */
  private flowPoints(day: SourcesDay): FlowPoint[] {
    const cached = this.shaped.get(day) ?? {};
    cached.flows ??= flowsOf(day.buckets, day.midnight, day.minutes, day.unit, day.span);
    this.shaped.set(day, cached);
    return cached.flows;
  }

  /** Where now is on the day (or the range): 0 at its start, 1 at its end, never past either. */
  private nowAt(day: SourcesDay | null, now: Date): number {
    if (!day) return minutesIntoDay(this.hass, now) / DAY_MINUTES;
    return clamp((now.getTime() - day.midnight) / day.span, 0, 1);
  }

  /** The charge's line is today's: drawn while no picker is followed, or while the one followed holds today. */
  private chargeShown(): boolean {
    const range = this.follower.range();
    return !range || (holdsNow(range, this.now()) && spanOf(range, this.now()) <= DAY);
  }

  /** Whether the "right now" reading belongs on the chart: no picker, or one whose range holds now. */
  private live(): boolean {
    const range = this.follower.range();
    return !range || holdsNow(range, this.now());
  }

  /** A moment of a day (or a range `span` long from `start`), as the readouts write it: the time, with its date over more than a day. */
  private momentWords(start: number, span: number, fraction: number): string {
    const at = new Date(start + fraction * span);
    if (span <= DAY) return formatTime(this.hass, at);
    const zone = houseZone(this.hass);
    return dateFormat(this.hass?.language ?? 'en', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: clock12(this.hass) ? 'h12' : 'h23',
      ...(zone ? { timeZone: zone } : {}),
    }).format(at);
  }

  /** The dates under a chart of more than a day: its start, its middle and its end (the two ends where they do not hold). */
  private rangeMarks(
    range: Range,
    width = this.contentWidth,
  ): ReadonlyArray<readonly [number, string]> {
    const now = this.now();
    const span = spanOf(range, now);
    const zone = houseZone(this.hass);
    const format = dateFormat(this.hass?.language ?? 'en', {
      day: 'numeric',
      month: 'short',
      ...(zone ? { timeZone: zone } : {}),
    });
    const mark = (f: number): readonly [number, string] =>
      [f, format.format(new Date(range.start.getTime() + f * span - (f === 1 ? 1 : 0)))] as const;
    const three = [mark(0), mark(0.5), mark(1)];
    return axisHolds(this.head.ruler, width, three) ? three : [three[0]!, three[2]!];
  }

  /** The by-source legend's day: the power's integral, or the meters' hours as the dashboard allocates them. */
  private usedDay(day: SourcesDay, points: readonly StackPoint[]): UsedDay | null {
    if (day.unit === 'kW') return integrate(points, day.minutes);
    const a = day.hours?.allocation;
    return a
      ? {
          used: {
            solar: a.usedSolar,
            battery: a.usedBattery,
            gas: a.usedGenerator,
            vehicle: a.usedVehicle,
            grid: a.usedGrid,
          },
          charged: a.solarToBattery + a.gridToBattery,
          exported: a.solarToGrid + a.batteryToGrid,
        }
      : null;
  }

  /** The whole house's legend: the power's integral, or the meters' hours (their sums, the house as allocated). */
  private flowDay(day: SourcesDay, points: readonly FlowPoint[]): FlowDay | null {
    if (day.unit === 'kW') return integrateFlows(points, day.minutes);
    const h = day.hours;
    if (!h) return null;
    const t = h.totals;
    return {
      into: {
        solar: t.solar,
        battery: t.fromBattery,
        gas: t.generator ?? 0,
        vehicle: t.fromVehicle ?? 0,
        grid: t.fromGrid,
      },
      out: { battery: t.toBattery, vehicle: t.toVehicle ?? 0, grid: t.toGrid },
      house: h.allocation.usedTotal,
    };
  }

  /** A tag at `y`, at the chart's start or its end, measured as it is set. */
  private chartTag(text: string, y: number, end: boolean, width: number, figure = false): ChartTag {
    const w = this.head.ruler.width(tagClass(end, figure), text);
    return { text, x: end ? width - w : 0, y, w, end, figure };
  }

  /**
   * What the house uses right now, in watts: every source's live power allocated as the flow card does. `null` when the
   * sources do not say their power, or one cannot be read.
   */
  private houseNow(): number | null {
    const sources = this.prefSources();
    if (!powered(sources)) return null;
    const totals = liveTotals(sources, (id) => this.entity(id));
    return totals ? allocate(totals).usedTotal : null;
  }

  /* ---------- pieces ---------- */

  /** A power in watts as the readouts write it (W or kW, the house's precision). */
  private power(watts: number): { value: string; unit: string } {
    const scale = scaleOf([watts], 'W', this.config);
    return { value: scaled(this.hass, watts, scale), unit: scale.unit };
  }

  private dayAxis(width = this.contentWidth): ReadonlyArray<readonly [number, string]> {
    const five = this.dayMarks([0, 6, 12, 18, 24]);
    // five labels that cannot keep 12 apart in the chart's width (a narrow card) read as three: midnight, noon, midnight
    // (the first sits on the start, the next centred a quarter in: a quarter less one and a half labels is their gap)
    const room = (width / 4 - 12) / 1.5;
    const fits = five.every(([, text]) => this.head.ruler.width('fv-axis', text) <= room);
    return fits ? five : this.dayMarks([0, 12, 24]);
  }

  /* ---------- a stacked chart's scales ---------- */

  /**
   * A stacked chart's frame (see `Frame`) for the day's extremes `up` and `down` (kW): the power's scale where its
   * labels leave the plot PLOT_MIN, the charge's beside it where both leave PLOT_MIN_TWO (it folds first, into the
   * readout that says the charge), the gridlines across whatever plot is left. `charge`: the charge's line is drawn.
   */
  private frame(up: number, down: number, charge: boolean, style: ResolvedStyle): Frame {
    const w = this.contentWidth;
    const showAxis = this.config?.show_axis !== false;
    // a style's gridlines go with the house's (a house that draws none); classic keeps the card's own
    const grid =
      gridOn(this.config?.show_grid) && (style.preset === 'classic' || style.grid.axes !== 'none');
    const bare: Frame = { left: 0, width: w, scale: null, axis: false, charge: false, grid: false };
    if (!showAxis && !grid) return bare;
    const room = (scale: PowerScale): number =>
      UNIT_COLUMN +
      Math.max(0, ...this.powerMarks(scale).map((text) => this.head.ruler.width('ax-tick', text))) +
      AXIS_GAP;
    if (showAxis && charge) {
      const scale = powerScale(up, down, true, this.config?.unit);
      const left = room(scale);
      const width = w - left - AXIS_GAP - this.head.ruler.width('ax-tick', this.percent(100));
      if (width >= PLOT_MIN_TWO) return { left, width, scale, axis: true, charge: true, grid };
    }
    const scale = powerScale(up, down, false, this.config?.unit);
    const left = showAxis ? room(scale) : 0;
    if (showAxis && w - left >= PLOT_MIN)
      return { left, width: w - left, scale, axis: true, charge: false, grid };
    return grid ? { ...bare, scale, grid } : bare;
  }

  /** The power's tick labels, in its scale's unit. */
  private powerMarks(scale: PowerScale): string[] {
    return scale.ticks.map((t) => tickText(this.hass, (t * 1000) / scale.divisor, scale.decimals));
  }

  /** A charge as its scale writes it ("75 %"). */
  private percent(level: number): string {
    return `${formatNumber(this.hass, level, { digits: 0 })} %`;
  }

  /**
   * The gridlines under a scaled chart's areas: every tick's but zero's, whose line is the plot's solid baseline —
   * classic's dashes, a style's hairlines (dashed where the house says so).
   */
  private gridOf(
    frame: Frame,
    y: (kw: number) => number,
    style: ResolvedStyle,
  ): SVGTemplateResult | typeof nothing {
    return frame.scale && frame.grid
      ? gridLines(
          frame.scale.ticks.filter((t) => t !== 0).map(y),
          frame.left,
          frame.left + frame.width,
          gridClass(style),
        )
      : nothing;
  }

  /** A stacked chart's style: its own, else the house's — classic, soft or step. */
  private stackStyle(): ResolvedStyle {
    return styleOf(this.config, STACK_CAPS);
  }

  /** A stacked chart's classes: its scale, its lines' width, a soft style's lighter fills. */
  private stackClass(frame: Frame, style: ResolvedStyle): string {
    const width = this.config?.line_width;
    return [
      frame.scale ? 'is-scaled' : '',
      width === 'thin' ? 'is-thin' : width === 'bold' ? 'is-bold' : '',
      style.preset === 'soft' ? 'is-soft' : '',
    ].join(' ');
  }

  /**
   * A scaled chart's labels: the power's ticks and its unit (rotated) at the plot's start, and the charge's 0–100 %
   * on the same gridlines from zero up, ending on the card's edge.
   */
  private labelsOf(
    frame: Frame,
    y: (kw: number) => number,
    top: number,
    foot: number,
  ): SVGTemplateResult | typeof nothing {
    const scale = frame.scale;
    if (!scale || !frame.axis) return nothing;
    const marks = this.powerMarks(scale);
    const power = tickLabels(
      scale.ticks.map((t, i) => [y(t), marks[i] ?? ''] as const),
      frame.left - AXIS_GAP,
    );
    const charge = frame.charge
      ? tickLabels(
          scale.ticks
            .filter((t) => t >= 0)
            .map((t, i) => [y(t), this.percent((i / scale.above) * 100)] as const),
          this.contentWidth,
        )
      : nothing;
    return svg`${power}${unitLabel(scale.unit, top, foot)}${charge}`;
  }

  /** The zero line: a scaled chart's solid baseline, else the dashed line over what went out (only when something did). */
  private zeroLine(frame: Frame, zero: number, out: boolean): SVGTemplateResult | typeof nothing {
    if (!frame.scale && !out) return nothing;
    const y = frame.scale ? Math.round(zero) + 0.5 : zero;
    return svg`<line class="en-zero" x1=${frame.left} x2=${frame.left + frame.width} y1=${y} y2=${y}></line>`;
  }

  /**
   * The hours under a stacked chart's plot: each centred on its hour where the scales leave it the room, else flush
   * with the card's edge; five where they keep 12 apart so placed, else three (00:00 · 12:00 · 24:00).
   */
  private plotAxis(frame: Frame): TemplateResult {
    const w = this.contentWidth;
    const place = (marks: ReadonlyArray<readonly [number, string]>) =>
      marks.map(([f, text]) => {
        const width = this.head.ruler.width('fv-axis', text);
        const x = frame.left + f * frame.width;
        const start = Math.min(w - width, Math.max(0, x - width / 2));
        return {
          text,
          start,
          end: start + width,
          at: start <= 0 ? 0 : start + width >= w ? 1 : x / w,
        };
      });
    // a picker's range over more than a day: its dates
    const day = this.day_;
    if (day && day.span > DAY)
      return axis(
        place(
          this.rangeMarks({
            start: new Date(day.midnight),
            end: new Date(day.midnight + day.span),
          }),
        ).map((p) => [p.at, p.text] as const),
      );
    const five = place(this.dayMarks([0, 6, 12, 18, 24]));
    const apart = five.every((p, i) => i === 0 || p.start - (five[i - 1]?.end ?? 0) >= 12);
    return axis(
      (apart ? five : place(this.dayMarks([0, 12, 24]))).map((p) => [p.at, p.text] as const),
    );
  }

  /**
   * Each band's edge at the cursor while the chart is read: a dot in its ink, but where the house's ring already is.
   * Where the charge's dot (`charge`, its y) would cover one — its centre within the charge's 4.5 — the band's is a
   * ring of its ink round it, as the house's ring holds the charge's dot at now: the sun's 5.6 kW reads under a 56 %
   * charge.
   */
  private bandDots(
    x: number,
    y: (kw: number) => number,
    edges: ReadonlyArray<readonly [ink: string, kw: number]>,
    ring: number | null,
    charge: number | null = null,
  ): SVGTemplateResult {
    return svg`${edges
      .filter(([, kw]) => ring === null || Math.abs(y(kw) - y(ring)) > 4)
      .map(([ink, kw]) =>
        charge !== null && Math.abs(y(kw) - charge) < 4.5
          ? svg`<circle class="en-band-dot is-ring en-ink--${ink}" r="5" cx=${x} cy=${y(kw)}></circle>`
          : svg`<circle class="en-band-dot en-ink--${ink}" r="3" cx=${x} cy=${y(kw)}></circle>`,
      )}`;
  }

  /**
   * A legend entry's figure in the row's unit and decimals: the power under the cursor while the chart is read (none
   * where the cursor has none), else the day's energy.
   */
  private legendFigure(
    row: Scale,
    scrubbing: boolean,
    kw: number | undefined,
    kwhs: number | undefined,
  ): { value: string; unit: string } {
    if (!scrubbing) return { value: scaled(this.hass, (kwhs ?? 0) * 1000, row), unit: row.unit };
    if (kw === undefined) return { value: '—', unit: '' };
    return { value: scaled(this.hass, kw * 1000, row), unit: row.unit };
  }

  /** The card's own title where it fits its head (with its circle and what trails it), else a shorter one. */
  private houseTitle(trailing: number): string {
    const room = this.contentWidth - 56 - (trailing ? trailing + 12 : 0);
    const long = s(this.hass, 'house_power');
    return this.head.ruler.width('fv-card__title', long) <= room
      ? long
      : s(this.hass, 'house_power_short');
  }

  /** The chart's room with nothing to draw: "No history yet", or its short form where it would not hold two lines. */
  private noHistory(): TemplateResult {
    return emptyState(
      'bolt',
      this.head.emptyText(
        s(this.hass, 'no_history'),
        this.contentWidth,
        s(this.hass, 'no_history_short'),
      ),
    );
  }

  /**
   * The chart's own line ("Today · the whole house", "Last 12 h") lets go where not even "Aujourd'hui" holds beside the
   * round (half a column): the chart's axis says the day, or how far back it reaches. A line the person typed is theirs.
   */
  private daySubShorter(): string[] {
    return this.config?.subtitle === undefined ? [''] : [];
  }

  /** The stacked charts' own line ("Today · by source"): the range's words in place of today's while a picker is followed. */
  private daySub(word: string): string {
    const range = this.follower.range();
    if (!range) return word;
    const rest = word.split(' · ').slice(1).join(' · ');
    return `${rangeWords(this.hass, range, this.now())}${rest ? ` · ${rest}` : ''}`;
  }

  /**
   * "Right now" where it holds one line in `room` (a column, less the key beside it), else "Now" (it's "Adesso"): a
   * label never wraps onto its figure.
   */
  private rightNow(room = this.contentWidth): string {
    const long = s(this.hass, 'right_now');
    return this.head.ruler.width('fv-readout__label', long) <= room ? long : this.t('common.now');
  }

  /** The hours of the day axis, written as the house's clock writes them. */
  private dayMarks(marks: readonly number[]): ReadonlyArray<readonly [number, string]> {
    if (!clock12(this.hass))
      return marks.map((h) => [h / 24, `${String(h).padStart(2, '0')}:00`] as const);
    // "12 AM … 6 PM": the hour and a compact day period, which is all a 40 px label holds
    const clock = dateFormat(this.hass?.language ?? 'en', {
      hour: 'numeric',
      hour12: true,
      timeZone: 'UTC',
    });
    return marks.map((h) => {
      const parts = clock.formatToParts(new Date(Date.UTC(2026, 0, 1, h % 24)));
      const hour = parts.find((p) => p.type === 'hour')?.value ?? String(h % 12 || 12);
      const period = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').replace(/[.\s]/g, '');
      return [h / 24, period ? `${hour} ${period}` : hour] as const;
    });
  }

  private rollingAxis(
    hours: number,
    width = this.contentWidth,
  ): ReadonlyArray<readonly [number, string]> {
    const days = hours >= 48;
    const back = (h: number): string =>
      s(this.hass, days ? 'days_ago' : 'hours_ago', {
        count: formatNumber(this.hass, days ? h / 24 : h, { digits: 1 }),
      });
    // three where they stand apart, else the two ends (fr's "Maintenant" on a narrow column)
    const three = [
      [0, back(hours)],
      [0.5, back(hours / 2)],
      [1, this.t('common.now')],
    ] as const;
    return axisHolds(this.head.ruler, width, three) ? three : [three[0], three[2]];
  }

  /**
   * The reading under the pointer, as Home Assistant has it then (the line's `read`: the bucket or the state at the
   * round time the pointer is nearest): where the cursor goes, what it reads and when that was.
   */
  private scrubbed(
    line: TimeLine<ResolvedStyle> | null,
    extent: number,
    view: EntityView,
    range: FollowedRange | undefined,
  ): { cursor: number; parts: { value: string; unit: string }; time: string } | null {
    const fraction = this.scrubber.value;
    const read = fraction === null || !line ? null : line.read(Math.min(fraction, extent) / extent);
    if (!read) return null;
    return {
      cursor: read.fraction * extent,
      parts: readoutParts(this.hass, view, read.v, this.config),
      time: this.momentWords(read.t, range ? spanOf(range, this.now()) : 0, 0),
    };
  }

  /**
   * The line through the window (the engine's `timeLine`) and how much of the axis it covers: a picker's range bucket
   * by bucket to its last bucket's start, or the history from the window's start (the house's midnight on the day's
   * axis) to now, ending on the reading now where it is live (history is up to five minutes old); none until there
   * are readings to draw.
   */
  private line(
    window: ChartWindow,
    live: number | null,
  ): { line: TimeLine<ResolvedStyle> | null; extent: number } {
    const series = this.series_;
    const now = this.now();
    const { range } = window;
    const step = range ? series?.step : undefined;
    const start = range
      ? range.start.getTime()
      : window.day
        ? houseMidnight(this.hass, now).getTime()
        : now.getTime() - window.hours * 3_600_000;
    const end = step ? start + ((series?.values.length ?? 0) - 1) * step : now.getTime();
    const readings = series?.readings;
    const extent = range && step ? clamp((end - start) / spanOf(range, now), 0, 1) : window.extent;
    if (!readings?.length || !(end > start)) return { line: null, extent };
    const line = timeLine({
      readings,
      start,
      end,
      width: this.contentWidth * extent,
      style: this.lineStyle(),
      hass: this.hass,
      ...(step ? { finest: step } : {}),
    });
    if (live !== null) line.values[line.values.length - 1] = live;
    return { line, extent };
  }

  private renderChart(
    line: TimeLine<ResolvedStyle> | null,
    extent: number,
    live: number | null,
    value: string,
    unit: string,
    at: { cursor: number; parts: { value: string; unit: string }; time: string } | null,
    tone: Tone,
    missing: boolean,
  ): TemplateResult {
    // a sensor that is not there has no history to wait for: the chart's room says so, not a shimmer
    if (!this.loaded_ && !missing)
      return html`<div class="ef-chart"><div class="fv-skeleton"></div></div>`;
    if (missing || !line) {
      return html`<div class="ef-chart">${this.noHistory()}</div>`;
    }
    const spec = this.lineSpec(line, extent, at?.cursor);
    const thin = spec.style.preset === 'classic' && this.config?.line_width === 'thin';
    // the chart wears the card's tone: its curve is drawn in the same ink as the head; its bubble says what is read,
    // else now (a reading that is not there says nothing)
    return html`<div
      class="ef-chart fv-tone--${tone} ${thin ? 'is-thin' : ''}"
      ${scrub(this.scrubber)}
    >
      ${drawRead(
        spec,
        at ? { ...at.parts, time: at.time } : null,
        live === null ? null : { value, unit },
        getComputedStyle(this).fontFamily,
      )}
    </div>`;
  }

  /**
   * The line's style for the card's keys: its own, else the house's (classic from the factory). A classic line asked
   * thin keeps 1.10's 1 px (the card's own rule) where the engine's thin is 1.5.
   */
  private lineStyle(): ResolvedStyle {
    const fine = chartKeysOf(this.config);
    const style = resolveStyle(this.config?.chart, fine, LINE_CAPS);
    if (style.preset !== 'classic' || fine.line_width !== 'thin') return style;
    const own = { ...fine };
    delete own.line_width;
    return resolveStyle('classic', own, LINE_CAPS);
  }

  /**
   * The line's chart: the sensor's window across the card (or the plot after a style's scale, its column sized by the
   * card's ruler, in the unit the card's figures take for the window's peak: kW for a house that peaks at 3 kW), the
   * day's extent drawn so far, read at `cursor` (a fraction of the plot).
   */
  private lineSpec(
    line: TimeLine<ResolvedStyle>,
    extent: number,
    cursor: number | undefined,
  ): ChartSpec {
    const view = this.entity();
    // a step asked closer than the style's line reads is drawn thinner (`timeLine`)
    const style = line.style;
    const base = toBase(1, view.unit);
    const values = line.values;
    const peak = Math.max(0, ...values.map((v) => Math.abs(v ?? 0))) * base.value;
    const factor =
      style.scale === 'nice'
        ? base.value / figuresOf(this.hass, this.config, base.unit, peak, view).divisor
        : 1;
    const spec: ChartSpec = {
      frame: { width: this.contentWidth, height: CHART_HEIGHT, headroom: HEADROOM },
      series: [
        {
          values: factor === 1 ? values : values.map((v) => (v === null ? v : v * factor)),
          at: line.at,
        },
      ],
      style,
      extent,
      cursor,
      zero: readingsOf(view.deviceClass, view.attr('state_class'), view.unit).zero,
      tick: (value, decimals) => tickText(this.hass, value, decimals),
      measure: (text) => this.head.ruler.width('fc-tick', text),
      id: 'fv',
    };
    // a pointer over the scale's column reads the plot's start
    const { left, width } = plotOf(spec);
    this.plotSpan = left > 0 ? [left, width] : null;
    return spec;
  }

  protected renderCard(): TemplateResult {
    if (this.bySource) return this.renderSources();
    if (this.wholeHouse) return this.renderOverview();
    this.plotSpan = null;
    const view = this.entity();
    const missing = view.status === 'missing';
    const title =
      missing && this.config?.name == null
        ? s(this.hass, 'title')
        : this.nameFor(view, this.config?.name);
    // a sensor that is not there keeps the card's whole anatomy (its reading "—", the chart's room), as an unavailable
    // one does: only the colours and the line under the title say so
    const off = !isUsable(view);
    const compact = this.compact;
    // the line wears the tone of what it shows (the card's own, else what the Energy dashboard says its sensor is)
    const tone: Tone = off ? 'off' : toneOf(this.config, this.lineTone(view.id));
    const window = this.chartWindow();
    const { day, hours, range } = window;
    // a picker on a past range: the reading now is not the range's, and the readout says the range's last value
    const live = view.status === 'ok' && this.live() ? this.signed(view) : null;
    const { line, extent } = this.line(window, live);
    const last = this.series_?.values[this.series_.values.length - 1];
    const parts =
      live === null && range && last !== undefined
        ? readoutParts(this.hass, view, last, this.config)
        : this.reading(view);
    const sub = missing
      ? stateText(this.hass, view)
      : (this.config?.subtitle ??
        (range
          ? `${view.areaName || this.t('energy.home')} · ${rangeWords(this.hass, range, this.now())}`
          : day
            ? `${view.areaName || this.t('energy.home')} · ${this.t('common.today').toLowerCase()}`
            : plural(this.hass, 'energy.last_hours', hours, {
                hours: formatNumber(this.hass, hours, { digits: 0 }),
              })));
    const cost =
      this.config?.cost_entity && this.config.show_cost !== false
        ? costParts(this.hass, this.entity(this.config.cost_entity))
        : null;
    const legend = this.legend();
    // a state is never cut: "Entity not found", "Not found" in a narrower column, and in half a section beside the
    // round none — the dashed card and its "—" say it there
    const fitted = this.head.fit({
      width: this.contentWidth,
      title,
      sub,
      trailing: 44,
      shorter: missing
        ? [stateWord(this.hass, view), '']
        : range || day
          ? []
          : this.daySubShorter(),
    });
    const at = this.loaded_ ? this.scrubbed(line, extent, view, range) : null;
    // the cost beside the reading, or under it where the two do not hold the column: measured on what the reading
    // says now and while the curve is read (a time), at the curve's widest figures, so reading it never moves the row;
    // with no curve (a sensor that is not there), at the widest a house says, as an unavailable one keeps its curve's
    const curve = cost ? this.series_ : null;
    const figures = [
      parts,
      ...(curve
        ? [curve.max, curve.min].map((raw) => readoutParts(this.hass, view, raw, this.config))
        : missing
          ? [this.power(10_000)]
          : []),
    ];
    const stacked =
      cost !== null &&
      sideStacked(
        this.head.ruler,
        this.contentWidth,
        [this.rightNow(), formatTime(this.hass, houseMidnight(this.hass, this.now()))].flatMap(
          (label) => figures.map((figure) => ({ label, ...figure })),
        ),
        [{ label: s(this.hass, 'cost'), ...cost }],
      );
    // the chart, then its clock under the plot: after a style's scale where it draws one
    const chart = this.renderChart(
      line,
      extent,
      live,
      parts.value,
      parts.unit,
      at,
      off ? 'neutral' : tone,
      missing,
    );
    const left = this.plotSpan?.[0] ?? 0;
    const room = this.contentWidth - left;
    const times = axis(
      range && !day
        ? this.rangeMarks(range, room)
        : day
          ? this.dayAxis(room)
          : this.rollingAxis(hours, room),
    );

    return html`<article class="fv-card ef-card ${off ? 'is-unavailable is-off' : ''}" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'bolt') : null,
        small: fitted.small,
        tone,
        title,
        sub: fitted.sub,
        trailing: round('dots', 'quiet', this.t('common.more'), () =>
          this.tap(view.id, { action: 'more-info' }),
        ),
        cut: fitted.cut,
        ...this.headActions(view.id),
        name: true,
      })}
      ${
        compact
          ? nothing
          : html`<div class="ef-top fv-value-row ${stacked ? 'is-stacked' : ''}">
              ${readout({ label: at ? at.time : live === null && range ? this.momentWords(range.start.getTime(), spanOf(range, this.now()), extent) : this.rightNow(), value: at ? at.parts.value : parts.value, unit: at ? at.parts.unit : parts.unit, size: live === null && view.status === 'ok' && !range ? 'm' : 'l' })}
              ${cost ? html`<div class="ef-top__side">${readout({ label: s(this.hass, 'cost'), value: cost.value, unit: cost.unit, size: 's' })}</div>` : nothing}
            </div>`
      }
      ${chart} ${left > 0 ? html`<div style="margin-inline-start:${left}px">${times}</div>` : times}
      ${
        legend.length && !compact
          ? statsCols(
              this.head.ruler,
              this.contentWidth,
              legendStats(this.hass, legend, (id, item) => this.legendView(id, item), this.config),
            )
          : nothing
      }
    </article>`;
  }

  /* ---------- by source ---------- */

  private layerName(key: Layer): string {
    return key === 'gas'
      ? flow(this.hass, 'kind_generator')
      : key === 'vehicle'
        ? flow(this.hass, 'kind_vehicle')
        : flow(this.hass, `kind_${key}`);
  }

  /**
   * The house's power today by where it came from: stacked areas of its use, under the line what went into the battery
   * and out to the grid, the day's legend; "right now" is the house's own use. Scrubbed, the legend says each origin's
   * power then and a dot marks each band's edge.
   */
  private renderSources(): TemplateResult {
    const id = this.config?.entity;
    const view = id ? this.entity(id) : undefined;
    const title =
      this.config?.name == null
        ? this.houseTitle(view ? 44 : 0)
        : this.nameFor(this.entity(), this.config?.name);
    const sub = this.config?.subtitle ?? this.daySub(s(this.hass, 'by_source'));
    const fitted = this.head.fit({
      width: this.contentWidth,
      title,
      sub,
      trailing: view ? 44 : 0,
      shorter: this.daySubShorter(),
    });
    const tone: Tone = toneOf(this.config, 'accent');
    const sourcesDay = this.day_;
    const step = ((sourcesDay?.minutes ?? 5) * 60_000) / (sourcesDay?.span ?? DAY);
    const now = this.now();
    const nowAt = this.nowAt(sourcesDay, now);
    // meters only, as the whole house (and a picker's past range, whose "right now" is not its): the chart ends on
    // the last bucket whose meters have closed, and reads it at rest
    const live = this.live();
    const house = live ? this.houseNow() : null;
    const liveW = live && view && view.status === 'ok' ? this.reading(view) : null;
    const metersOnly = house === null && !liveW;
    const all = sourcesDay ? this.stackPoints(sourcesDay) : [];
    // a point sits at its bucket's middle: the bucket has closed half a step after it
    const closedOnly = metersOnly ? all.filter((p) => p.at + step / 2 <= nowAt + 1e-9) : all;
    const points = closedOnly.length ? closedOnly : all;
    const closed = metersOnly ? points[points.length - 1] : undefined;
    const end = closed?.at ?? nowAt;
    const w = this.contentWidth;
    const H = SOURCES_CHART;
    const stacked = this.config?.stack !== false;
    const { up, down } = stackExtent(points, stacked);
    const style = this.stackStyle();
    const frame = this.frame(up, down, false, style);
    // under a scale its top tick sits on the tag's line, as the whole house's does
    const top = frame.scale ? OVERVIEW_TOP : HEADROOM;
    const range = frame.scale
      ? ([frame.scale.ticks[0] ?? 0, frame.scale.ticks[frame.scale.ticks.length - 1] ?? 0] as const)
      : undefined;
    const shape = points.length
      ? stackShape(points, frame.width, H, top, step, {
          left: frame.left,
          range,
          stacked,
          held: style.preset === 'step',
        })
      : null;
    this.plotSpan = shape ? [frame.left, frame.width] : null;
    // the cursor: where the pointer reads, on the bucket it reads, never past the chart's end; nothing across a gap
    const fraction = this.scrubber.value;
    const scrubbing = fraction !== null;
    const asked = scrubbing ? Math.min(fraction, end) : end;
    const cursorPoint = scrubbing ? nearest(points, asked, step) : points[points.length - 1];
    const cursorAt = scrubbing && cursorPoint ? cursorPoint.at : asked;
    const used = (p: StackPoint | undefined): number | null =>
      p ? LAYERS.reduce((sum, k) => sum + p.used[k], 0) : null;
    const at = (moment: number): string =>
      this.momentWords(
        sourcesDay?.midnight ?? houseMidnight(this.hass, now).getTime(),
        sourcesDay?.span ?? DAY,
        moment,
      );
    // a reading is always there (a dash when nothing can be read), so the row never comes and goes under the chart
    const rightNow = this.rightNow();
    const reading = scrubbing
      ? {
          label: at(cursorAt),
          ...(cursorPoint ? this.power((used(cursorPoint) ?? 0) * 1000) : { value: '—', unit: '' }),
        }
      : house !== null
        ? { label: rightNow, ...this.power(house) }
        : liveW
          ? { label: rightNow, ...liveW }
          : closed
            ? { label: at(closed.at), ...this.power((used(closed) ?? 0) * 1000) }
            : { label: rightNow, value: '—', unit: '' };
    const day = sourcesDay ? this.usedDay(sourcesDay, points) : null;
    const below = new Set(shape?.below.map((b) => b.key) ?? []);
    // the legend: the origins above the line, then where the energy went below it (the battery's ink and the grid's,
    // at 60 %); the day's energy at rest, each one's power under the cursor while read — one unit for the row
    const row = scrubbing
      ? scaleOf(
          cursorPoint
            ? [
                ...LAYERS.map((k) => cursorPoint.used[k]),
                cursorPoint.charged,
                cursorPoint.exported,
              ].map((kw) => kw * 1000)
            : [],
          'W',
          this.config,
        )
      : scaleOf(
          day
            ? [...LAYERS.map((k) => day.used[k]), day.charged, day.exported].map(
                (kwh) => kwh * 1000,
              )
            : [],
          'Wh',
          this.config,
        );
    const legend: LegendEntry[] =
      shape && (day || scrubbing)
        ? [
            ...LAYERS.filter((k) => shape.layers.some((l) => l.key === k)).map((k) => ({
              ink: `en-ink--${k}`,
              name: this.layerName(k),
              ...this.legendFigure(row, scrubbing, cursorPoint?.used[k], day?.used[k]),
            })),
            ...(below.has('charged')
              ? [
                  {
                    ink: 'en-ink--battery',
                    name: s(this.hass, 'charged'),
                    square: 'out' as const,
                    ...this.legendFigure(row, scrubbing, cursorPoint?.charged, day?.charged),
                  },
                ]
              : []),
            ...(below.has('exported')
              ? [
                  {
                    ink: 'en-ink--grid',
                    name: s(this.hass, 'exported'),
                    square: 'out' as const,
                    ...this.legendFigure(row, scrubbing, cursorPoint?.exported, day?.exported),
                  },
                ]
              : []),
          ]
        : [];
    const BELOW_INK = { charged: 'battery', exported: 'grid' } as const;
    const belowTag =
      below.has('charged') && below.has('exported')
        ? s(this.hass, 'charged_exported')
        : below.has('charged')
          ? s(this.hass, 'charged')
          : s(this.hass, 'exported');
    const peak = used(cursorPoint);
    // the tag under the line goes with the scale: its numbers and the legend say what is below
    const tags: ChartTag[] = shape
      ? [
          this.chartTag(s(this.hass, 'used'), 0, false, w),
          ...(shape.below.length && !frame.scale
            ? [this.chartTag(belowTag, Math.round(shape.zero + 12), false, w)]
            : []),
        ]
      : [];
    const edges =
      scrubbing && shape && cursorPoint
        ? [
            ...bandEdges(cursorPoint.used, LAYERS, stacked, 1),
            ...bandEdges(cursorPoint, ['charged', 'exported'] as const, stacked, -1).map(
              ([key, kw]) => [BELOW_INK[key], kw] as const,
            ),
          ]
        : [];
    return html`<article class="fv-card ef-card" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'home') : null,
        small: fitted.small,
        tone,
        title,
        sub: fitted.sub,
        trailing: view
          ? round('dots', 'quiet', this.t('common.more'), () =>
              this.tap(view.id, { action: 'more-info' }),
            )
          : nothing,
        cut: fitted.cut,
        ...this.headActions(id),
        name: Boolean(this.config?.name),
      })}
      <div class="ef-top fv-value-row">
        ${readout({ label: reading.label, value: reading.value, unit: reading.unit, size: 'l' })}
      </div>
      ${
        !this.loaded_
          ? html`<div class="en-chart"><div class="fv-skeleton" style="height:${H}px"></div></div>`
          : !shape
            ? html`<div class="en-chart">
                ${
                  this.day_ === null
                    ? this.head.empty(
                        'bolt',
                        flow(this.hass, 'no_period'),
                        flow(this.hass, 'no_period_hint'),
                        this.contentWidth,
                      )
                    : this.noHistory()
                }
              </div>`
            : html`<div
                class="en-chart ${this.stackClass(frame, style)}"
                data-plot="${frame.left} ${frame.width}"
                ${scrub(this.scrubber)}
              >
                <svg
                  width=${w}
                  height=${H}
                  viewBox="0 0 ${w} ${H}"
                  aria-hidden="true"
                  data-measure="drawn"
                >
                  ${this.gridOf(frame, shape.y, style)}
                  ${[...shape.layers]
                    .reverse()
                    .map(
                      (l) =>
                        svg`<path class="en-area en-ink--${l.key} ${stacked ? '' : 'is-own'}" d=${l.area}></path>`,
                    )}
                  ${shape.below.map(
                    (b) =>
                      svg`<path class="en-area en-ink--${BELOW_INK[b.key]} is-out ${stacked ? '' : 'is-own'}" data-below=${b.key} d=${b.area}></path>`,
                  )}
                  ${this.zeroLine(frame, shape.zero, shape.below.length > 0)}
                  ${[...shape.layers]
                    .reverse()
                    .map(
                      (l) => svg`<path class="en-area-line en-ink--${l.key}" d=${l.line}></path>`,
                    )}
                  ${shape.below.map(
                    (b) =>
                      svg`<path class="en-area-line en-ink--${BELOW_INK[b.key]} is-out" d=${b.line}></path>`,
                  )}
                  ${tagMask(tags, w, H)}
                  <line
                    class="en-cursor"
                    mask="url(#en-tags)"
                    x1=${shape.x(cursorAt)}
                    x2=${shape.x(cursorAt)}
                    y1=${CURSOR_TOP}
                    y2=${H}
                  ></line>
                  ${this.labelsOf(frame, shape.y, top, H - 1)}
                </svg>
                ${tags.map(tagSpan)}
                ${dotsOver(
                  w,
                  H,
                  svg`${this.bandDots(shape.x(cursorAt), shape.y, edges, peak)}${peak !== null ? svg`<circle class="en-cursor-dot" r="5" cx=${shape.x(cursorAt)} cy=${shape.y(peak)}></circle>` : nothing}`,
                )}
              </div>`
      }
      ${shape ? this.plotAxis(frame) : axis(this.dayAxis())}
      ${energyLegend(legend, w, this.head.ruler)}
    </article>`;
  }

  /* ---------- the whole house ---------- */

  /** The name of what left the house's sources, under the line: the battery's charge, a car's, the export. */
  private outName(key: Outflow): string {
    return key === 'battery'
      ? s(this.hass, 'charged')
      : key === 'grid'
        ? s(this.hass, 'exported')
        : this.layerName('vehicle');
  }

  /**
   * The whole house today, Home Assistant's "Power sources" convention: every source's power stacked above the line
   * (the sun's whole production first, the grid last), what went into the battery and out to the grid below it, the
   * house's use as a line over them and the batteries' charge as a dashed line on its own scale (100 % on the tag's
   * line, 0 % on the zero line), the power's scale at the start and the charge's at the end, dashed gridlines across.
   * Scrubbed, the readouts and the legend say that moment and a dot marks each band's edge; at rest, now and the day.
   */
  private renderOverview(): TemplateResult {
    const id = this.config?.entity;
    const view = id ? this.entity(id) : undefined;
    const title =
      this.config?.name == null
        ? this.houseTitle(view ? 44 : 0)
        : this.nameFor(this.entity(), this.config?.name);
    const sub = this.config?.subtitle ?? this.daySub(s(this.hass, 'whole_house'));
    const fitted = this.head.fit({
      width: this.contentWidth,
      title,
      sub,
      trailing: view ? 44 : 0,
      shorter: this.daySubShorter(),
    });
    const tone: Tone = toneOf(this.config, 'accent');
    const day = this.day_;
    const step = ((day?.minutes ?? 5) * 60_000) / (day?.span ?? DAY);
    const now = this.now();
    const nowAt = this.nowAt(day, now);
    // no live power for the house (meters only, or a picker's past range): a bucket whose meters have not closed reads
    // low, so the chart ends on the last one that has, and that is the moment the top row and the cursor read at rest
    const live = this.live();
    const house = live ? this.houseNow() : null;
    const liveW = live && view && view.status === 'ok' ? this.reading(view) : null;
    const metersOnly = house === null && !liveW;
    const all = day ? this.flowPoints(day) : [];
    // a point sits at its bucket's middle: the bucket has closed half a step after it
    const closedOnly = metersOnly ? all.filter((p) => p.at + step / 2 <= nowAt + 1e-9) : all;
    const points = closedOnly.length ? closedOnly : all;
    const closed = metersOnly ? points[points.length - 1] : undefined;
    const restAt = closed?.at ?? nowAt;
    const w = this.contentWidth;
    const H = OVERVIEW_CHART;
    const showHouse = this.config?.show_house !== false;
    const stacking = this.config?.stack !== false;

    // the batteries' charge: through today from the recorder, ending on the live reading (today's alone)
    const batteries =
      this.config?.show_soc === false || !this.chargeShown()
        ? []
        : chargedBatteries(this.prefSources());
    const levelNow = batteries.length
      ? chargeNow(batteries, (soc) => {
          const v = this.entity(soc);
          return v.status === 'ok' ? v.number : null;
        })
      : null;
    const charge: ChargePoint[] = batteries.length
      ? [
          // the recorder's last five minutes may sit past now (their middle): the live reading takes their place
          ...(this.charge_ ?? []).filter((p) => levelNow === null || p.at < nowAt),
          ...(levelNow !== null ? [{ at: nowAt, level: levelNow }] : []),
        ]
      : [];

    const { up, down } = flowExtent(points, stacking);
    const style = this.stackStyle();
    const frame = this.frame(up, down, charge.length > 1, style);
    const range = frame.scale
      ? ([frame.scale.ticks[0] ?? 0, frame.scale.ticks[frame.scale.ticks.length - 1] ?? 0] as const)
      : undefined;
    const shape = points.length
      ? flowShape(points, frame.width, H, OVERVIEW_TOP, step, {
          left: frame.left,
          range,
          stacked: stacking,
          held: style.preset === 'step',
        })
      : null;
    this.plotSpan = shape ? [frame.left, frame.width] : null;
    // the recorder's last five minutes arrive late: a reading up to a quarter of an hour from the next is joined.
    // The charge keeps to the positive half: 100 % on the tag's line (the top tick), 0 % on the kW zero line (the foot
    // when nothing left the house), so a low battery never reads as an outflow (issue #28)
    const chargeStep = 10 / DAY_MINUTES;
    const soc =
      shape && charge.length > 1
        ? chargeLine(charge, frame.width, OVERVIEW_TOP, shape.zero, chargeStep, frame.left)
        : null;

    // the cursor: where the pointer reads, else now; nothing is read across a gap
    const fraction = this.scrubber.value;
    const scrubbing = fraction !== null;
    // the cursor: never past the chart's end (the last closed bucket on meters only), on the bucket it reads
    const asked = scrubbing ? Math.min(fraction, restAt) : restAt;
    const cursorPoint = scrubbing ? nearest(points, asked, step) : points[points.length - 1];
    const cursorAt = scrubbing && cursorPoint ? cursorPoint.at : asked;
    // the charge at the moment the row reads: now, or the closed bucket's time on meters only
    const cursorLevel =
      scrubbing || closed
        ? (nearest(charge, cursorAt, chargeStep)?.level ?? null)
        : (levelNow ?? charge[charge.length - 1]?.level ?? null);

    const at = (fraction: number): string =>
      this.momentWords(
        day?.midnight ?? houseMidnight(this.hass, now).getTime(),
        day?.span ?? DAY,
        fraction,
      );
    // a reading is always there (a dash when nothing can be read), so the row never comes and goes over the chart
    const rightNow = this.rightNow(this.contentWidth - KEY);
    const reading = scrubbing
      ? {
          label: at(cursorAt),
          ...(cursorPoint ? this.power(cursorPoint.house * 1000) : { value: '—', unit: '' }),
        }
      : house !== null
        ? { label: rightNow, ...this.power(house) }
        : liveW
          ? { label: rightNow, ...liveW }
          : closed
            ? { label: at(closed.at), ...this.power(closed.house * 1000) }
            : { label: rightNow, value: '—', unit: '' };
    const level = batteries.length
      ? {
          label: s(this.hass, 'battery'),
          value: cursorLevel === null ? '—' : formatNumber(this.hass, cursorLevel, { digits: 0 }),
          unit: cursorLevel === null ? '' : '%',
        }
      : null;

    // the legend: a square for each area drawn, the day's energy at rest and the power under the cursor while read —
    // one unit and one precision for the whole row ("1.3 kW" beside "0.9 kW", never "907 W")
    const total = day ? this.flowDay(day, points) : null;
    const row = scrubbing
      ? scaleOf(
          cursorPoint
            ? [
                ...LAYERS.map((k) => cursorPoint.into[k]),
                ...OUTFLOWS.map((k) => cursorPoint.out[k]),
              ].map((kw) => kw * 1000)
            : [],
          'W',
          this.config,
        )
      : scaleOf(
          total
            ? [...LAYERS.map((k) => total.into[k]), ...OUTFLOWS.map((k) => total.out[k])].map(
                (kwh) => kwh * 1000,
              )
            : [],
          'Wh',
          this.config,
        );
    const legend: LegendEntry[] =
      shape && (total || scrubbing)
        ? [
            ...shape.above.map((a) => ({
              ink: `en-ink--${a.key}`,
              name: this.layerName(a.key),
              ...this.legendFigure(row, scrubbing, cursorPoint?.into[a.key], total?.into[a.key]),
            })),
            ...shape.below.map((b) => ({
              ink: `en-ink--${b.key}`,
              name: this.outName(b.key),
              square: 'out' as const,
              ...this.legendFigure(row, scrubbing, cursorPoint?.out[b.key], total?.out[b.key]),
            })),
          ]
        : [];
    const belowKeys = new Set(shape?.below.map((b) => b.key) ?? []);
    const belowTag =
      belowKeys.has('battery') && belowKeys.has('grid')
        ? s(this.hass, 'charged_exported')
        : belowKeys.has('battery')
          ? s(this.hass, 'charged')
          : belowKeys.has('grid')
            ? s(this.hass, 'exported')
            : this.layerName('vehicle');
    const dotAt = cursorPoint
      ? showHouse
        ? cursorPoint.house
        : LAYERS.reduce((sum, k) => sum + cursorPoint.into[k], 0)
      : null;
    // the charge's dot at the cursor, drawn over the house's ring and the bands' dots
    const socAt = soc && cursorLevel !== null ? soc.y(cursorLevel) : null;
    // each band's edge at the cursor while it reads: the reader sees where the sun ends and the battery begins
    const edges =
      scrubbing && cursorPoint
        ? [
            ...bandEdges(cursorPoint.into, LAYERS, stacking, 1),
            ...bandEdges(cursorPoint.out, OUTFLOWS, stacking, -1),
          ]
        : [];
    // the charge goes under the reading where the two cannot stand side by side, measured on the widest each says
    // (tens of kilowatts, a full battery) with the keys beside their labels: reading the chart never moves the row
    const stacked =
      level !== null &&
      sideStacked(
        this.head.ruler,
        this.contentWidth,
        [rightNow, at(0.5)].map((label) => ({
          label,
          ...this.power(10_000),
          mark: KEY,
        })),
        [
          {
            label: level.label,
            value: formatNumber(this.hass, 100, { digits: 0 }),
            unit: '%',
            mark: KEY,
          },
        ],
      );
    // the tags: the lines and the cursor give way round them, the dots sit above them. The charge's "100 %" is its
    // scale's top label, or a tag where that scale has folded; the one under the line goes with the power's scale
    // (its numbers and the legend say what is below), else to the side the charge does not cross, and where it
    // crosses both, the legend names the areas alone
    const tags: ChartTag[] = [];
    if (shape) {
      tags.push(this.chartTag(s(this.hass, 'sources_tag'), 0, false, w));
      if (soc && !frame.charge) tags.push(this.chartTag(this.percent(100), 0, true, w, true));
      if (shape.below.length && !frame.scale) {
        const y = Math.round(shape.zero + 12);
        const free = (tag: ChartTag): boolean =>
          !soc || !crosses(soc.runs, { x: tag.x - 6, y: tag.y - 6, w: tag.w + 12, h: 28 });
        const side = [
          this.chartTag(belowTag, y, false, w),
          this.chartTag(belowTag, y, true, w),
        ].find(free);
        if (side) tags.push(side);
      }
    }
    const own = stacking ? '' : 'is-own';
    return html`<article class="fv-card ef-card ef-card--overview" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'home') : null,
        small: fitted.small,
        tone,
        title,
        sub: fitted.sub,
        trailing: view
          ? round('dots', 'quiet', this.t('common.more'), () =>
              this.tap(view.id, { action: 'more-info' }),
            )
          : nothing,
        cut: fitted.cut,
        ...this.headActions(id),
        name: Boolean(this.config?.name),
      })}
      <div class="ef-top fv-value-row ${stacked ? 'is-stacked' : ''}">
        <div class="ef-key ${showHouse && shape ? 'ef-key--house' : ''}">
          ${readout({ label: reading.label, value: reading.value, unit: reading.unit, size: 'l' })}
        </div>
        ${level ? html`<div class="ef-top__side ef-key ${soc ? 'ef-key--soc' : ''} en-ink--battery">${readout({ label: level.label, value: level.value, unit: level.unit, size: 's' })}</div>` : nothing}
      </div>
      ${
        !this.loaded_
          ? html`<div class="en-chart"><div class="fv-skeleton" style="height:${H}px"></div></div>`
          : !shape
            ? html`<div class="en-chart">
                ${
                  this.day_ === null
                    ? this.head.empty(
                        'bolt',
                        flow(this.hass, 'no_period'),
                        flow(this.hass, 'no_period_hint'),
                        this.contentWidth,
                      )
                    : this.noHistory()
                }
              </div>`
            : html`<div
                class="en-chart ${this.stackClass(frame, style)}"
                data-plot="${frame.left} ${frame.width}"
                ${scrub(this.scrubber)}
              >
                <svg
                  width=${w}
                  height=${H}
                  viewBox="0 0 ${w} ${H}"
                  aria-hidden="true"
                  data-measure="drawn"
                >
                  ${this.gridOf(frame, shape.y, style)}
                  ${[...shape.above]
                    .reverse()
                    .map(
                      (a) =>
                        svg`<path class="en-area en-ink--${a.key} ${own}" data-above=${a.key} d=${a.area}></path>`,
                    )}
                  ${shape.below.map(
                    (b) =>
                      svg`<path class="en-area en-ink--${b.key} is-out ${own}" data-below=${b.key} d=${b.area}></path>`,
                  )}
                  ${this.zeroLine(frame, shape.zero, shape.below.length > 0)} ${tagMask(tags, w, H)}
                  ${showHouse ? svg`<path class="en-house" mask="url(#en-tags)" d=${shape.house}></path>` : nothing}
                  ${[...shape.above]
                    .reverse()
                    .map(
                      (a) => svg`<path class="en-area-line en-ink--${a.key}" d=${a.line}></path>`,
                    )}
                  ${shape.below.map(
                    (b) =>
                      svg`<path class="en-area-line en-ink--${b.key} is-out" d=${b.line}></path>`,
                  )}
                  <g mask="url(#en-tags)">
                    ${soc ? svg`<path class="en-soc-halo" d=${soc.line}></path>${soc.runs.map((run) => svg`<path class="en-soc en-ink--battery" d=${run.d} pathLength=${run.dashes}></path>`)}` : nothing}
                    <line
                      class="en-cursor"
                      x1=${shape.x(cursorAt)}
                      x2=${shape.x(cursorAt)}
                      y1=${CURSOR_TOP}
                      y2=${H}
                    ></line>
                  </g>
                  ${this.labelsOf(frame, shape.y, OVERVIEW_TOP, H - 1)}
                </svg>
                ${tags.map(tagSpan)}
                ${dotsOver(
                  w,
                  H,
                  svg`${this.bandDots(shape.x(cursorAt), shape.y, edges, dotAt, socAt)}${dotAt !== null ? svg`<circle class="en-cursor-dot" r="5" cx=${shape.x(cursorAt)} cy=${shape.y(dotAt)}></circle>` : nothing}${socAt !== null ? svg`<circle class="en-soc-dot en-ink--battery" r="3.75" cx=${shape.x(cursorAt)} cy=${socAt}></circle>` : nothing}`,
                )}
              </div>`
      }
      ${shape ? this.plotAxis(frame) : axis(this.dayAxis())}
      ${energyLegend(legend, w, this.head.ruler)}
    </article>`;
  }
}
