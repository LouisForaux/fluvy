import { balanceHeight } from '../energy-family.js';
import {
  formatNumber,
  strings,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { head, type Tone } from '@fluvy/ui';
import { energyStyles } from '@fluvy/ui/styles/energy';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import {
  CollectionFollower,
  collectionKeyOf,
  followPeriod,
  type EnergyDataLike,
} from '../energy-model/collection.js';
import {
  costStats,
  currencySymbol,
  fetchInfo,
  fetchMoney,
  moneyFromStats,
  moneyOf,
  type EnergyInfo,
  type Money,
} from '../energy-model/costs.js';
import { fetchPrefs } from '../energy-model/house.js';
import { downLine } from '../energy-model/outage.js';
import {
  allocatePeriod,
  fetchPeriod,
  PERIODS,
  type Period,
  type PeriodEnergy,
} from '../energy-model/period.js';
import { rangeWords } from '../energy-model/range-words.js';
import {
  COLLECTION_LABEL,
  collectionChoices,
  collectionField,
  collectionHelper,
  following,
  periodic,
} from '../energy/collection-field.js';
import { readPrefs, type EnergyPrefs, type SourceKind } from '../energy-model/prefs.js';
import { readMeasure, type Directed } from '../energy-model/reading.js';
import {
  DEFAULT_THRESHOLD,
  measureOfSource,
  prefSources,
  SOURCE_KEYS,
  sourceIds,
  type SourceConfig,
} from '../energy-model/sources.js';
import { KIND_INK, oneWay } from '../energy-flow/scene.js';
import {
  bucketOf,
  isStale,
  LIVE_TICK,
  liveWords,
  newestReport,
  staleShorter,
} from '../energy/freshness.js';
import { HeadFit } from '../energy/head.js';
import { phaseBlock, phaseStyles, phaseWatts } from '../energy/phases.js';
import { scaled, scaleOf, shortName, WATT_LADDERS, type Scale } from '../energy/power.js';
import { kindField, MEASURE_WORDS, measureFields, PHASES_ALIAS } from '../energy/sources-editor.js';
import { statsCols, statsStyles } from '../energy/stats.js';
import { Card, type BaseKey } from '../shared/base.js';
import { chipRow } from '../shared/chips.js';
import { toneOf } from '../shared/colour.js';
import { configKeys, type AliasSpec } from '../shared/config.js';
import {
  accentField,
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  fieldRow,
  iconField,
  NUMBER_DEFAULTS,
  numberField,
  numberFields,
  onlyWhen,
  selectField,
  showIconField,
  textField,
  titleFields,
} from '../shared/form.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import type { NumberKeys } from '../shared/units.js';
import { Ticker } from '../shared/ticker.js';
import { gridWay, type GridWay } from '../grid/grid.js';
import {
  balanceOf,
  legendColumns,
  rested,
  rowsOf,
  type Balance,
  type Flow,
  type Item,
} from './balance.js';

const s = strings('energy-balance');
const f = strings('energy-flow');

export type BalancePeriod = 'live' | Period;
export const BALANCE_PERIODS: readonly BalancePeriod[] = ['live', ...PERIODS];

export interface EnergyBalanceCardConfig extends FluvyCardConfig, NumberKeys {
  title?: string;
  subtitle?: string;
  /** Where the energy comes from, the flow's way. Empty: the Energy dashboard's own. */
  sources?: readonly SourceConfig[];
  /** `live` (power) or a period's totals (energy, from the Energy dashboard's meters). */
  period?: BalancePeriod;
  /** Day · Week · Month chips over a period's balance. */
  show_period?: boolean;
  /** A grid read per phase gets a row per phase (live). */
  show_phases?: boolean;
  /** Over a period: what the grid cost, what feeding it paid, and the difference. */
  show_cost?: boolean;
  /** An Energy date picker's key (`energy_…`): the balance follows its range, with Home Assistant's own figures, and the chips go. */
  collection_key?: string;
  /** The tests' clock: "now" for the freshness words and the period. */
  _now?: string;
}

/** What a balance reads of a source: how its power is read, its name and colour, when it rests. */
const BALANCE_SOURCE_KEYS = SOURCE_KEYS.filter((key) =>
  ['type', 'power', 'phases', 'import', 'export', 'invert', 'name', 'color', 'threshold'].includes(
    key,
  ),
);

/** The least room between a block's title and its total. */
const HEAD_GAP = 12;

interface Dead {
  readonly label: string;
  readonly entity: string | undefined;
}

interface Model {
  readonly period: Period | null;
  readonly empty: 'sources' | 'period' | null;
  readonly balance: Balance;
  readonly scale: Scale;
  /** The first source that cannot be read. */
  readonly dead: Dead | null;
  readonly stale: boolean;
  /** The grid's way right now (live): both, in, out. */
  readonly way: GridWay | null;
  /** A grid read per phase: each phase's signed watts (live). */
  readonly phases: readonly (number | null)[] | null;
  /** The period's money, when the grid has money statistics; null while it loads or cannot be read. */
  readonly money: Money | null;
  readonly hasMoney: boolean;
}

/**
 * The energy balance: what comes in against what goes out, live or over a period. The two totals agree because
 * the house is the remainder — everything that came in less what charged a battery or a car and what was exported.
 * A grid read per phase shows each phase centred on zero; over a period, the money the grid cost and paid.
 */
export class FluvyEnergyBalanceCard extends Card<EnergyBalanceCardConfig> {
  static override layoutHeight(config: EnergyBalanceCardConfig): number {
    return balanceHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    energyStyles,
    phaseStyles,
    statsStyles,
    css`
      .ef-card {
        width: 100%;
      }
      /* a figure that cannot be read draws no proportions: the bar's track alone */
      .en-bar12 > .en-bar12__track {
        flex: 1;
        background: var(--fluvy-page-alt);
      }
      /* the dark page's alt fill is the card's own: the hairline's ink, as every energy track takes */
      :host([dark]) .en-bar12 > .en-bar12__track {
        background: var(--fluvy-border);
      }
      /* a narrow column: the total under its title, both on the column's start; a title longer than the column takes a
         second line ("Komt / binnen"), and the head grows by it */
      .en-block__head--stack {
        flex-direction: column;
        align-items: flex-start;
        height: auto;
        min-height: 36px;
      }
      .en-block__head--stack > .en-block__title {
        max-width: 100%;
      }
    `,
  ];

  /** A balance of many sensors has no entity of its own: its head's icon, tone and colour, and its actions on the head. */
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
  static override keys = configKeys<EnergyBalanceCardConfig>()([
    'title',
    'subtitle',
    'sources',
    'period',
    'show_period',
    'collection_key',
    'show_phases',
    'show_cost',
    'unit',
    'decimals',
  ]);
  static override lists: readonly RowsListSpec[] = [
    {
      key: 'sources',
      title: 'energy-flow.editor_sources',
      idKey: 'type',
      picker: kindField(),
      keys: BALANCE_SOURCE_KEYS,
      schema: [
        kindField(),
        ...measureFields(),
        fieldRow(textField('name'), accentField('color', { item: 'own' })),
        numberField('threshold', 0, 10000, 1),
      ],
      computeLabel: editorLabels(f, MEASURE_WORDS).computeLabel,
    },
  ];
  static override aliases: AliasSpec = { items: { sources: [PHASES_ALIAS] } };
  static override defaults: EditorDefaults = () => ({
    period: 'live',
    show_period: true,
    collection_key: '',
    show_phases: true,
    show_cost: true,
    ...NUMBER_DEFAULTS,
  });
  /** The date pickers on the dashboard, for the key. */
  static override choices: EditorChoices = (_config, hass) => ({
    collection_key: collectionChoices(hass),
  });
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        fieldRow(iconField(), selectField('period', BALANCE_PERIODS)),
        showIconField(),
        // over a period, a date picker to follow; the chips while none is followed
        fieldRow(
          onlyWhen(periodic, collectionField()),
          onlyWhen((data) => !following(data), boolField('show_period')),
        ),
        fieldRow(boolField('show_phases'), boolField('show_cost')),
        ...colourFields(),
        numberFields({ units: WATT_LADDERS }),
        actionFields(),
      ],
      ...editorLabels(
        s,
        { show_phases: 'editor_show_phases', show_cost: 'editor_show_cost' },
        {
          period: 'energy-flow.editor_period',
          show_period: 'energy-flow.editor_show_period',
          ...COLLECTION_LABEL,
        },
      ),
      computeHelper: collectionHelper,
    };
  }

  protected override prepare(config: EnergyBalanceCardConfig): EnergyBalanceCardConfig {
    collectionKeyOf(config, 'fluvy-energy-balance-card');
    return config;
  }

  static getStubConfig(): EnergyBalanceCardConfig {
    // the Energy dashboard's own sources: every house that has set it up sees its balance at once
    return { type: 'custom:fluvy-energy-balance-card' };
  }

  private readonly head = new HeadFit(this);
  private readonly follower = new CollectionFollower(this);
  private prefs: EnergyPrefs | null | undefined;
  private prefsAsked = false;
  private info: EnergyInfo | null | undefined;
  private infoAsked = false;
  private chosen: Period | undefined;
  private periodData: PeriodEnergy | null | undefined;
  private periodKey = '';
  /** The picker's answer the totals and the money were last read from. */
  private followed: EnergyDataLike | undefined;
  /** The five minutes the period's totals were last asked for in. */
  private asked = 0;
  private money: Map<string, number> | null | undefined;
  private moneyKey = '';
  private shownSub = '';
  private model: Model | undefined;

  constructor() {
    super();
    // "Live · 5 s ago" is a claim about the clock; a period's totals are asked for again when their cache runs out
    new Ticker(
      this,
      () =>
        !!this.config &&
        (this.periodOf() !== null
          ? bucketOf(this.now()) !== this.asked
          : this.config.subtitle === undefined && this.freshness() !== this.shownSub),
      LIVE_TICK,
    );
  }

  override getCardSize(): number {
    return Math.ceil(FluvyEnergyBalanceCard.layoutHeight(this.config ?? { type: '' }) / 50);
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /* ---------- configuration ---------- */

  private sourceList(): readonly SourceConfig[] {
    const own = this.config?.sources ?? [];
    return own.length ? own : prefSources(this.prefs);
  }

  private periodOf(): Period | null {
    const period = this.config?.period;
    if (!period || period === 'live' || !PERIODS.includes(period)) return null;
    return followPeriod(this.follower, this.chosen ?? period);
  }

  /** The Energy dashboard's cost sensors: the picker's answer carries them, else they are asked for. */
  private costInfo(): EnergyInfo | null | undefined {
    return this.followed?.info ?? this.info;
  }

  private costShown(): boolean {
    return this.periodOf() !== null && this.config?.show_cost !== false;
  }

  protected override watched(): readonly string[] {
    return this.periodOf() ? [] : this.sourceList().flatMap(sourceIds);
  }

  private now(): number {
    const pinned = this.config?._now ? Date.parse(this.config._now) : NaN;
    return Number.isFinite(pinned) ? pinned : Date.now();
  }

  /* ---------- lifecycle ---------- */

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.config || !this.hass) return;
    this.follower.attach(this.hass, this.config.collection_key || undefined);
    this.ask(this.hass);
    this.model = this.build();
  }

  /** What the Energy dashboard knows: its sources (a card without its own, or a period), its cost sensors. */
  private ask(hass: HomeAssistant): void {
    const period = this.periodOf();
    if (!this.prefsAsked && (!(this.config?.sources ?? []).length || period)) {
      this.prefsAsked = true;
      void fetchPrefs(hass).then((prefs) => {
        this.prefs = prefs;
        this.requestUpdate();
      });
    }
    if (!this.infoAsked && this.costShown() && !this.follower.following) {
      this.infoAsked = true;
      void fetchInfo(hass).then((info) => {
        this.info = info;
        this.requestUpdate();
      });
    }
    if (!period || this.prefs === undefined) return;
    const house = readPrefs(this.prefs);
    // a picker on the view: its figures and its money, read once per answer, and nothing asked of our own
    if (this.follower.range()) {
      const data = this.follower.data();
      if (data && data !== this.followed) {
        this.followed = data;
        this.periodData = allocatePeriod(data.stats, house.sources);
        this.money = moneyFromStats(costStats(house.sources, data.info), data.stats);
      }
      return;
    }
    const now = new Date(this.now());
    this.asked = bucketOf(now.getTime());
    const bucket = `${period}|${this.asked}|${this.prefs ? 'p' : ''}`;
    if (bucket !== this.periodKey) {
      this.periodKey = bucket;
      void fetchPeriod(hass, house.sources, period, now).then((data) => {
        this.periodData = data;
        this.requestUpdate();
      });
    }
    if (!this.costShown() || this.info === undefined) return;
    const stats = costStats(house.sources, this.info);
    const key = `${bucket}|${[...stats.cost, ...stats.compensation].join(',')}`;
    if (key === this.moneyKey) return;
    this.moneyKey = key;
    void fetchMoney(hass, stats, period, now).then((money) => {
      this.money = money;
      this.requestUpdate();
    });
  }

  /* ---------- the model ---------- */

  private build(): Model {
    const period = this.periodOf();
    let flows: Flow[];
    let empty: Model['empty'] = null;
    let dead: Dead | null = null;
    let phases: (number | null)[] | null = null;

    if (period) {
      const house = readPrefs(this.prefs);
      const data = this.periodData;
      const sources = house.sources.filter((p) => p.energyIn.length || p.energyOut.length);
      const sum = (ids: readonly string[]): number | null =>
        data ? ids.reduce((acc, id) => acc + (data.byStat.get(id) ?? 0), 0) * 1000 : null;
      flows = sources.map((p) => {
        const into = sum(p.energyIn);
        return {
          kind: p.kind,
          reading: {
            in: into,
            out: oneWay(p.kind) ? (into === null ? null : 0) : sum(p.energyOut),
          },
          name: p.name,
        };
      });
      if (!sources.length && this.prefs !== undefined) empty = 'period';
    } else {
      const configs = this.sourceList();
      flows = configs.map((c) => {
        const reading = this.read(c);
        if (!dead && (reading.in === null || reading.out === null)) {
          // one of several of its kind (two arrays) is named by its sensor, as the flow names it
          const entity = sourceIds(c)[0];
          const several = configs.filter((o) => o.type === c.type).length > 1;
          dead = {
            label:
              c.name ??
              (several && entity ? shortName(this.entity(entity)) : f(this.hass, `kind_${c.type}`)),
            entity,
          };
        }
        return {
          kind: c.type,
          reading: rested(reading, c.threshold ?? DEFAULT_THRESHOLD),
          name: c.name,
          color: c.color,
        };
      });
      if (!configs.length && (this.config?.sources?.length || this.prefs !== undefined))
        empty = 'sources';
      const grid = configs.find((c) => c.type === 'grid' && (c.phases?.length ?? 0) > 1);
      if (grid && this.config?.show_phases !== false)
        phases = phaseWatts(grid.phases ?? [], grid.invert ?? false, (id) => this.entity(id));
    }

    const balance = balanceOf(flows);
    // every grid connection's way at once (each rested at its own threshold already)
    const grids = flows.filter((g) => g.kind === 'grid');
    const gridReading: Directed = {
      in: grids.reduce((sum, g) => sum + (g.reading.in ?? 0), 0),
      out: grids.reduce((sum, g) => sum + (g.reading.out ?? 0), 0),
    };
    const stats = costStats(readPrefs(this.prefs).sources, this.costInfo());
    const hasMoney = this.costShown() && (stats.cost.length > 0 || stats.compensation.length > 0);
    return {
      period,
      empty,
      balance,
      scale: scaleOf(
        [
          ...balance.coming.map((i) => i.value),
          ...balance.going.map((i) => i.value),
          balance.inTotal,
          balance.outTotal,
          ...(phases ?? []),
        ],
        period ? 'Wh' : 'W',
        this.config,
      ),
      dead,
      stale: !period && isStale(this.newest(), this.now()),
      way: period ? null : gridWay(gridReading, Number.MIN_VALUE),
      phases,
      // the money while it loads is undefined, unreadable null: both say "—"
      money: hasMoney && this.money ? moneyOf(stats, this.money) : null,
      hasMoney,
    };
  }

  /** A source's live power both ways; what only produces has no way out. */
  private read(c: SourceConfig): Directed {
    const measure = measureOfSource(c);
    const reading = measure
      ? readMeasure(measure, (id) => this.entity(id))
      : { in: null, out: null };
    return oneWay(c.type) ? { in: reading.in, out: reading.in === null ? null : 0 } : reading;
  }

  private newest(): number {
    return newestReport(this.hass, this.sourceList().flatMap(sourceIds));
  }

  private freshness(): string {
    const period = this.periodOf();
    const range = this.follower.range();
    if (range) return rangeWords(this.hass, range, new Date(this.now()));
    if (period === 'day') return s(this.hass, 'sub_day');
    if (period) return f(this.hass, `period_${period}`);
    return liveWords(this.hass, this.newest(), this.now());
  }

  /** The head's second line: the card's own, which source cannot be read and since when, or how fresh it is. */
  private sub(m: Model): string {
    if (this.config?.subtitle !== undefined) return this.config.subtitle;
    if (m.empty) return ''; // nothing to be fresh about
    if (m.dead) return downLine(this.hass, m.dead.label, m.dead.entity);
    return this.freshness();
  }

  /** The head's badge: the grid's way right now; none over a period. */
  private badge(m: Model): { text: string; tone: Tone } | null {
    if (m.dead) return { text: this.t('state.unavailable'), tone: 'warning' };
    if (m.stale || m.period) return null;
    if (m.way === 'both') return { text: f(this.hass, 'import_export'), tone: 'grid' };
    if (m.way === 'in') return { text: this.t('energy.importing'), tone: 'grid' };
    if (m.way === 'out') return { text: this.t('energy.exporting'), tone: 'grid' };
    return null;
  }

  /* ---------- render ---------- */

  protected renderCard(): TemplateResult {
    const m = this.model ?? this.build();
    const w = this.contentWidth;
    const title = this.config?.title ?? s(this.hass, 'title');
    const said = this.sub(m);
    // a title that already says the day ("Today") is not said again: the period's own words follow it
    const sub =
      this.config?.subtitle === undefined &&
      m.period === 'day' &&
      said.split(' · ')[0]?.toLocaleLowerCase() === title.toLocaleLowerCase()
        ? f(this.hass, 'period_day')
        : said;
    this.shownSub = this.config?.subtitle === undefined ? this.freshness() : '';
    const fitted = this.head.fit({
      width: w,
      title,
      sub,
      badge: this.badge(m),
      // stale, "Updated 32 days ago" says its age alone where the column cannot hold it
      shorter:
        sub === this.shownSub && m.stale && !m.period
          ? staleShorter(this.hass, this.newest(), this.now())
          : [],
    });
    const period = m.period;
    const body =
      m.empty === 'sources'
        ? this.head.empty(
            'swap',
            f(this.hass, 'no_sources'),
            f(this.hass, 'no_sources_hint'),
            this.contentWidth,
          )
        : m.empty === 'period'
          ? this.head.empty(
              'swap',
              f(this.hass, 'no_period'),
              f(this.hass, 'no_period_hint'),
              this.contentWidth,
            )
          : html`${this.blocks(m, w)} ${this.renderPhases(m, w)} ${this.renderMoney(m, w)}`;
    return html`<article class="fv-card ef-card en-card" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'swap') : null,
        tone: toneOf(this.config, 'accent'),
        title,
        sub: fitted.sub,
        trailing: fitted.badge,
        name: true,
        cut: fitted.cut,
        ...this.headActions(),
      })}
      ${
        period && this.config?.show_period !== false && !this.follower.following
          ? html`<div class="en-period">
              ${chipRow(
                PERIODS.map((p) => ({
                  key: p,
                  label: f(this.hass, `chip_${p}`),
                  active: p === period,
                })),
                (key) => {
                  this.chosen = key as Period;
                  this.periodKey = '';
                  this.moneyKey = '';
                  this.requestUpdate();
                },
                'full',
                { ruler: this.head.ruler, width: w },
              )}
            </div>`
          : nothing
      }
      ${body}
    </article>`;
  }

  private label(item: Item): string {
    return item.kind === 'house'
      ? f(this.hass, 'house')
      : (item.name ?? f(this.hass, `kind_${item.kind}`));
  }

  /**
   * What comes in and what goes out, one block each. A total leaves its title's line when both would not hold on
   * it — and then every block's does, so their bars start at one offset under their titles.
   */
  private blocks(m: Model, w: number): TemplateResult {
    const sides = [
      [m.period ? 'came_in' : 'coming_in', m.balance.coming, m.balance.inTotal],
      [m.period ? 'went_out' : 'going_out', m.balance.going, m.balance.outTotal],
    ] as const;
    const stacked = sides.some(([title, , total]) => {
      const t = this.figure(total, m.scale);
      return (
        this.head.ruler.width('en-block__title', s(this.hass, title)) +
          HEAD_GAP +
          this.head.ruler.width('en-block__total', t.value, 'en-unit', t.unit) >
        w
      );
    });
    return html`${sides.map(([title, items, total]) =>
      this.block(title, items, total, m.scale, w, stacked),
    )}`;
  }

  private figure(v: number | null, scale: Scale): { value: string; unit: string } {
    return v === null
      ? { value: '—', unit: '' }
      : { value: scaled(this.hass, v, scale), unit: scale.unit };
  }

  /** "LABEL · total", the one bar of the side's parts, and its legend (as many columns as the names hold whole). */
  private block(
    title: 'coming_in' | 'going_out' | 'came_in' | 'went_out',
    items: readonly Item[],
    total: number | null,
    scale: Scale,
    w: number,
    stacked: boolean,
  ): TemplateResult {
    const fig = (v: number | null): { value: string; unit: string } => this.figure(v, scale);
    const parts = items.map((item) => {
      const accent =
        item.kind !== 'house' && item.color ? this.accents.item(item.color) : undefined;
      const ink =
        item.kind === 'house' ? 'home' : accent ? 'accent' : KIND_INK[item.kind as SourceKind];
      return { item, accent, ink, label: this.label(item), ...fig(item.value) };
    });
    const drawn = total !== null && total > 0 && parts.every((p) => p.item.value !== null);
    const widest = Math.max(
      0,
      ...parts.map((p) =>
        Math.max(
          20 + this.head.ruler.width('en-legend__name', p.label),
          this.head.ruler.width('en-legend__value', p.value, 'en-unit', p.unit),
        ),
      ),
    );
    const columns = legendColumns(parts.length, widest, w);
    const t = fig(total);
    const heading = s(this.hass, title);
    return html`<div class="en-block">
      <div class="en-block__head ${stacked ? 'en-block__head--stack' : ''}">
        <span class="en-block__title">${heading}</span
        ><span class="en-block__total"
          >${t.value}${t.unit ? html`<span class="en-unit">${t.unit}</span>` : nothing}</span
        >
      </div>
      <div class="en-bar12" data-measure="drawn">
        ${
          drawn
            ? parts
                .filter((p) => (p.item.value ?? 0) > 0)
                .map(
                  (p) =>
                    html`<span
                      class="en-ink--${p.ink}"
                      data-accent=${p.accent ?? nothing}
                      style="flex:${((p.item.value ?? 0) / (total ?? 1)).toFixed(4)}"
                    ></span>`,
                )
            : html`<span class="en-bar12__track"></span>`
        }
      </div>
      ${rowsOf(parts, columns).map(
        (row) =>
          html`<div class="en-legend" data-align="center">
            ${row.map(
              (p) =>
                html`<span class="en-legend__item" data-accent=${p.accent ?? nothing}
                  ><span class="en-legend__name"
                    ><i class="en-sq en-ink--${p.ink}"></i
                    ><span class="en-legend__text" data-name>${p.label}</span></span
                  ><span class="en-legend__value"
                    >${p.value}${p.unit ? html`<span class="en-unit">${p.unit}</span>` : nothing}</span
                  ></span
                >`,
            )}
          </div>`,
      )}
    </div>`;
  }

  private renderPhases(m: Model, w: number): TemplateResult | typeof nothing {
    if (!m.phases) return nothing;
    return html`<div class="en-block">
      <div class="en-block__head">
        <span class="en-block__title">${s(this.hass, 'per_phase')}</span>
      </div>
      ${phaseBlock({
        hass: this.hass,
        rows: m.phases.map((value, i) => ({ label: s(this.hass, 'phase', { n: i + 1 }), value })),
        scale: m.scale,
        ways: { in: f(this.hass, 'way_in'), out: f(this.hass, 'way_out') },
        width: w,
        ruler: this.head.ruler,
      })}
    </div>`;
  }

  /** Over a period: Cost · Feed-in · Net, in the house's currency. */
  private renderMoney(m: Model, w: number): TemplateResult | typeof nothing {
    if (!m.hasMoney) return nothing;
    const unit = currencySymbol(this.hass);
    const money = (v: number | undefined): { value: string; unit: string } =>
      v === undefined
        ? { value: '—', unit: '' }
        : {
            value: formatNumber(this.hass, v, { digits: 2, minDigits: 2 }).replace(/^-/, '−'),
            unit,
          };
    const stats = [
      { label: this.t('energy.cost'), ...money(m.money?.cost) },
      { label: s(this.hass, 'feed_in'), ...money(m.money?.feedIn) },
      { label: s(this.hass, 'net'), ...money(m.money?.net) },
    ];
    return statsCols(this.head.ruler, w, stats);
  }
}
