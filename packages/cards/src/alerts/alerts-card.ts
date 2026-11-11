import {
  actionRuns,
  plural,
  runAction,
  selfHide,
  strings,
  type ActionConfig,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';
import {
  clickPress,
  head,
  holdKey,
  icon,
  optionGrid,
  pressCover,
  preventMenu,
  reducedMotion,
  startPress,
  type PressTarget,
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
import { keyed } from 'lit/directives/keyed.js';
import {
  ALERTS_VARIANTS,
  alertsColumns,
  alertsHeight,
  type AlertsVariant,
} from '../alerts-family.js';
import { HeadFit, type FittedHead } from '../energy/head.js';
import { Card, type BaseKey, type HeadConfig } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  emptyFields,
  fieldRow,
  iconField,
  numberField,
  selectField,
  showIconField,
  titleFields,
} from '../shared/form.js';
import { EMPTY_KEYS, type EmptyList } from '../shared/lists.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { Ticker } from '../shared/ticker.js';
import { bindAction } from './actions.js';
import { AlertEngine, type AlertResult, type AlertsState } from './engine.js';
import { ALERTS_LIST, cardLabels } from './form.js';
import {
  alertIcon,
  alertName,
  countWords,
  culpritText,
  culprits,
  lasted,
  mostNames,
  rowState,
  type LookContext,
} from './look.js';
import { memoryFor, MEMORY_SCOPES, OFF, type AlertMemory, type MemoryScope } from './memory.js';
import {
  definitionsOf,
  type AlertAction,
  type AlertConfig,
  type AlertDefinition,
} from './model.js';
import { repairsFor, type RepairsStore } from './repairs.js';
import type { FluvyAlertsSheet, SheetHost } from './sheet/alerts-sheet.js';

const s = strings('alerts');

export interface AlertsCardConfig extends FluvyCardConfig, HeadConfig, EmptyList {
  /** The head's title (rows), and the overview's: "Needs attention" unless said. */
  title?: string;
  subtitle?: string;
  /** The alerts, in order: a preset (`preset: low_battery`), or a matcher of the person's own. */
  alerts?: readonly AlertConfig[];
  /** `tiles` (compact tiles, two a row), `mini` (three a row), `chips`, `rows` (under a head) or `banner` (one at a time). */
  variant?: AlertsVariant;
  /** The tiles a row: 1 to 4, or `auto` (as many as fit). */
  columns?: 1 | 2 | 3 | 4 | 'auto' | `${1 | 2 | 3 | 4}`;
  /** Rows of 48, the culprits left out. */
  compact?: boolean;
  /** How many: the tile's badge, the chip's figure, the row's value (an alert with one match names it instead). */
  show_count?: boolean;
  /** Who is at fault: "Hall sensor, Porch +1". */
  show_culprit?: boolean;
  /** How long: "Front door · 6 min". */
  show_duration?: boolean;
  /** At most this many shown; a fold ("+2") opens the overview. */
  max_alerts?: number;
  /** By severity, then as listed (default); or as listed only. */
  order?: 'severity' | 'config';
  /** The banner turns to the next alert every this many seconds (6); 0 holds the gravest. */
  rotate?: number;
  /** Where snoozes are kept: each person's (default), this device's, the house's, or none. */
  snooze?: MemoryScope;
  /** Test hook: an ISO instant the card takes for "now". Undocumented. */
  _now?: string;
  /**
   * Test hook: the sheet in the card's place, docked and open — an alert's (its `id`), the same choosing how long to
   * snooze (`<id>:snooze`), or the overview (`overview`). Undocumented.
   */
  _sheet?: string;
}

type TileSize = 'compact' | 'mini';

/** The least a tile is wide: a compact one keeps its name beside its circle, a mini its circle over its name. */
const MIN_TILE: Readonly<Record<TileSize, number>> = { compact: 128, mini: 84 };
/** What `columns: auto` lays a tile out at, as a group of tiles does (`.fv-tiles--auto`). */
const AUTO_TILE: Readonly<Record<TileSize, number>> = { compact: 148, mini: 84 };
/** A compact tile's sides (16) and its circle with the gap after it (44 + 12); a mini's sides (12). */
const SIDES = 32;
const CIRCLE = 56;
const MINI_SIDES = 24;
/** A tile's state line and name, measured as the tile sets them. */
const LINE: Readonly<Record<TileSize, string>> = {
  compact: 'fv-tile fv-tile--compact > fv-tile__state',
  mini: 'fv-tile fv-tile--mini > fv-tile__state',
};
const NAME: Readonly<Record<TileSize, string>> = {
  compact: 'fv-tile fv-tile--compact > fv-tile__name',
  mini: 'fv-tile fv-tile--mini > fv-tile__name',
};
/** A badge's sides, as `fitPills()` gives them; the gap before it. */
const BADGE_SIDES = 28;
const BADGE_GAP = 12;
/** The least a name keeps beside its circle before the circles give way (as a list's rows). */
const NAME_MIN = 96;
/** The least of a culprit's name a line keeps before it says how long or how many alone (a few letters and "…"). */
const WHO_MIN = 56;
/** A row's chevron. */
const CHEVRON = 44;
/** A filled chip's pill as measured: its words' class, its sides (8 each), its glyph and the gap after it, the gap before its count. */
const CHIP = 'fv-chips fv-chips--fill > fv-chip > fv-chip__pill';
const CHIP_SIDES = 16;
const CHIP_GLYPH = 20 + 6;
const CHIP_GAP = 6;
/** A chip's name keeps this much before the strip goes to glyphs alone; the chips' gap; a finger's least. */
const CHIP_NAME_MIN = 56;
const CHIP_SPACE = 8;
const TOUCH = 44;

/** What a line under an alert's name says: who, a name that may end in its ellipsis, then what stays whole. */
interface Line {
  readonly who: string;
  readonly what: string;
}

/** What an alert is drawn as: its words, glyph, tone and own colour. */
interface Drawn {
  readonly result: AlertResult;
  readonly name: string;
  readonly glyph: string;
  readonly tone: Tone;
  readonly accent: string | undefined;
}

/**
 * What needs a look, from one definition per alert: the count, the list and the actions all read it, so they never
 * drift apart (#48). Each alert is a preset (`low_battery`, `unavailable`, `open`, `unlocked`, `hazards`, `errors`,
 * `updates`, `lights_on`, Home Assistant's own alerts and repairs) or the person's own matcher; it shows while it
 * matches — ordered and toned by its severity — as a compact or mini tile, a chip, a row under a head, or one at a time
 * in a banner, and the card steps aside while all is clear. A tap opens the alert's sheet (its rows with their state
 * and how long, a row's button, the alert's actions, snooze and acknowledge); a hold, the overview of every alert,
 * snoozed ones included. The house is watched at the cost of what changed (`engine.ts`).
 */
export class FluvyAlertsCard extends Card<AlertsCardConfig> {
  static override layoutHeight(config: AlertsCardConfig): number {
    return alertsHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    css`
      /* the tiles stand on the page as a group's do: rows 8 apart, the section's gap between columns */
      .al-tile .fv-tile__text {
        min-width: 0;
      }
      /* a line under a name: who is at fault ends in its ellipsis, what follows it stays whole */
      .al-line {
        display: flex;
        min-width: 0;
      }
      .fv-tile--mini .al-line {
        justify-content: center;
      }
      .al-who {
        min-width: 0;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .al-what {
        flex: none;
        white-space: pre;
      }
      /* the count, on an alert's fill: the card's fill and the tone's ink, as the tile's circle */
      .al-count {
        margin-left: auto;
      }
      .fv-tile.is-on .al-count {
        background: var(--fluvy-card);
        color: var(--tone-ink);
      }
      /* an alert's own colour is its identity: its circle's glyph, never the severity's fill */
      .fv-tile.is-on .fv-ico[data-accent] {
        color: var(--fluvy-accent);
      }
      /* chips: equal pills, as many rows as their words need, each filled in its alert's tone; no card under them, so
         the strip enters as one, as the chips card's row does */
      .al-chips {
        margin-top: 0;
        animation: fv-enter 420ms var(--fv-ease-out) both;
        animation-delay: var(--fv-enter-delay, 0ms);
      }
      .al-chips .fv-chip__pill {
        gap: 6px;
      }
      .al-chip__count {
        flex: 0 0 auto;
        font-variant-numeric: tabular-nums;
      }
      .al-rows {
        margin-top: 4px;
      }
      .al-value {
        color: var(--tone-ink);
      }
      .al-empty {
        margin-top: 16px;
      }
      /* the banner's words cross-fade as it turns to the next alert */
      .al-banner .fv-tile__text {
        animation: fv-swap 220ms var(--fv-ease-out) both;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    sheetReady_: { state: true },
    sheetOpen_: { state: true },
    turn_: { state: true },
  };

  /** The head's fitting and the words' (what gives way, in its order), measured as the card sets them. */
  private readonly headFit = new HeadFit(this);
  private definitions: readonly AlertDefinition[] = [];
  private engine: AlertEngine | undefined;
  private alerts: AlertsState = { alerts: [], shown: [] };
  private memory: AlertMemory = OFF;
  private repairs: RepairsStore | undefined;
  /** What the card listens to (the memory's scope, the repairs) on which connection, and how it stops. */
  private wired: { readonly key: string; readonly stop: () => void } | undefined;
  private wiredTo: unknown;
  /** The screen's media queries the alerts' conditions ask, each listened to. */
  private screens: Array<readonly [MediaQueryList, () => void]> = [];
  /** The banner is held: a pointer on it, the focus in it. */
  private held = false;
  private turnedAt = 0;
  private rotation: Ticker | undefined;

  /** The sheet's chunk has landed; the sheet is open (the card stays in sight until it closes). */
  declare sheetReady_: boolean;
  declare sheetOpen_: boolean;
  /** Which alert the banner shows: its place among those shown. */
  declare turn_: number;

  constructor() {
    super();
    this.sheetReady_ = false;
    this.sheetOpen_ = false;
    this.turn_ = 0;
    // a minute's clock while a tile says how long ("Front door · 6 min")
    new Ticker(this, () => this.timed());
  }

  /** The alerts have no entity of their own: the head's (rows), each alert's default tap and hold, the look. */
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
  static override keys = configKeys<AlertsCardConfig>()([
    'title',
    'subtitle',
    'alerts',
    'variant',
    'columns',
    'compact',
    'show_count',
    'show_culprit',
    'show_duration',
    'max_alerts',
    'order',
    'rotate',
    'snooze',
    ...EMPTY_KEYS,
  ]);
  static override lists: readonly RowsListSpec[] = [ALERTS_LIST];
  /** What the editor shows where the config says nothing: what the card does then. */
  static override defaults: EditorDefaults = (config) => ({
    variant: 'tiles',
    columns: config['variant'] === 'mini' ? '3' : '2',
    compact: false,
    show_count: true,
    show_culprit: true,
    show_duration: true,
    order: 'severity',
    rotate: 6,
    snooze: 'user',
    hide_empty: true,
  });
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        fieldRow(
          choiceField('variant', [
            ['tiles', 'option.tiles'],
            ['mini', 'option.mini'],
            ['chips', 'option.chips'],
            ['rows', 'option.rows'],
            ['banner', 'alerts.o_banner'],
          ]),
          selectField('columns', ['1', '2', '3', '4', 'auto']),
        ),
        fieldRow(iconField(), showIconField()),
        fieldRow(boolField('show_count'), boolField('show_culprit')),
        fieldRow(boolField('show_duration'), boolField('compact')),
        fieldRow(
          choiceField('order', [
            ['severity', 'alerts.o_severity'],
            ['config', 'alerts.o_config'],
          ]),
          numberField('rotate', 0, 60),
        ),
        fieldRow(
          choiceField('snooze', [
            ['user', 'alerts.o_person'],
            ['device', 'alerts.o_this_device'],
            ['house', 'alerts.o_house'],
            ['off', 'option.off'],
          ]),
          numberField('max_alerts', 1, 30),
        ),
        emptyFields(),
        ...colourFields(),
        actionFields(),
      ],
      ...cardLabels(),
    };
  }

  /** A new card watches what a house usually wants seen to. */
  static getStubConfig(): AlertsCardConfig {
    return {
      type: 'custom:fluvy-alerts-card',
      alerts: [
        { preset: 'low_battery' },
        { preset: 'unavailable' },
        { preset: 'open' },
        { preset: 'updates' },
      ],
    };
  }

  /** Every alert read once: one readable error for a mistake, an empty list is a list. */
  protected override prepare(config: AlertsCardConfig): AlertsCardConfig {
    this.definitions = definitionsOf(config);
    return config;
  }

  override getCardSize(): number {
    return this.config ? Math.max(1, Math.round(alertsHeight(this.config) / 50)) : 2;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private get variant(): AlertsVariant {
    const variant = this.config?.variant;
    return variant && ALERTS_VARIANTS.includes(variant) ? variant : 'tiles';
  }

  private get scope(): MemoryScope {
    const scope = this.config?.snooze;
    return scope && MEMORY_SCOPES.includes(scope) ? scope : 'user';
  }

  /** The card's clock: a test's frozen one, else the browser's. */
  private now(): number {
    const frozen = this.config?._now ? Date.parse(this.config._now) : Number.NaN;
    return Number.isFinite(frozen) ? frozen : Date.now();
  }

  /** What an alert's words read besides the house. */
  private context(): LookContext {
    return { hass: this.hass, repairs: this.repairs, now: this.now() };
  }

  /* ---------- watching ---------- */

  /** Back on the page (a view shown again): a new engine and what it listens to, at the next update. */
  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate();
  }

  /** Off the page: no timer, no subscription, no media query listened to. */
  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.engine?.dispose();
    this.engine = undefined;
    this.unwire();
    this.unlisten();
  }

  /**
   * The engine for the alerts as configured, the memory of the scope asked for and the repairs while an alert reads
   * them, listened to while the card is on the page.
   */
  private wire(): void {
    const hass = this.hass;
    if (!hass || !this.isConnected) return;
    const repairs = this.definitions.some(
      (definition) =>
        definition.source === 'repairs' && (!definition.adminOnly || hass.user?.is_admin === true),
    );
    this.memory = memoryFor(hass, this.scope);
    this.repairs = repairs ? repairsFor(hass) : undefined;
    const key = `${this.scope}|${repairs}`;
    if (this.wired?.key === key && this.wiredTo === hass.connection) return;
    this.unwire();
    this.wiredTo = hass.connection;
    const stops = [this.memory.subscribe(() => this.requestUpdate())];
    const store = this.repairs;
    if (store) {
      const feed = (): void => {
        this.engine?.feed('repairs', store.rows());
        this.requestUpdate();
      };
      stops.push(store.subscribe(feed));
      this.engine?.feed('repairs', store.rows());
    }
    this.wired = { key, stop: () => stops.forEach((stop) => stop()) };
  }

  private unwire(): void {
    this.wired?.stop();
    this.wired = undefined;
    this.wiredTo = undefined;
  }

  private unlisten(): void {
    for (const [query, listener] of this.screens) query.removeEventListener('change', listener);
    this.screens = [];
  }

  /** A new engine for a new config: the timer of the old one stopped, the screen's queries listened to. */
  private build(): void {
    this.engine?.dispose();
    this.unlisten();
    const engine = new AlertEngine(this.definitions, {
      order: this.config?.order === 'config' ? 'config' : 'severity',
      now: () => this.now(),
      due: () => this.requestUpdate(),
    });
    if (this.repairs) engine.feed('repairs', this.repairs.rows());
    if (typeof matchMedia === 'function')
      for (const text of engine.queries) {
        const query = matchMedia(text);
        const listener = (): void => this.requestUpdate();
        query.addEventListener('change', listener);
        this.screens.push([query, listener]);
      }
    this.engine = engine;
  }

  /** The alerts as they stand: the same object while nothing they say changed. */
  private evaluate(): AlertsState {
    if (this.hass && this.engine) this.alerts = this.engine.evaluate(this.hass, this.memory);
    return this.alerts;
  }

  /** The whole house arrives on every change: the card draws again only when what its alerts say changed. */
  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size === 1 && changed.has('hass')) {
      // no engine yet (a config just given, a card back on the page): the update makes one, on the page only
      if (!this.engine) return this.isConnected;
      const before = this.alerts;
      this.wire();
      if (this.evaluate() !== before) return true;
    }
    return super.shouldUpdate(changed);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    // the engine and its one timer live while the card is on the page
    if (this.isConnected && (changed.has('config') || !this.engine)) this.build();
    this.wire();
    this.evaluate();
    // hidden while all is clear (unless asked to stay, never in the editor), never while its sheet is open
    selfHide(
      this,
      !this.alerts.shown.length && this.config?.hide_empty !== false && !this.sheetOpen_,
    );
  }

  /** Whether the minute's clock has anything to say: a tile that says how long. */
  private timed(): boolean {
    return this.config?.show_duration !== false && this.alerts.shown.length > 0;
  }

  /* ---------- what a tap does ---------- */

  /** Whether the card has no head: its own tap and hold are then each alert's. */
  private get headless(): boolean {
    return this.variant !== 'rows';
  }

  /** An alert's tap: its own action, else (without a head) the card's, else its sheet. */
  private tapOf(result: AlertResult): (() => void) | undefined {
    const action =
      result.definition.tapAction ?? (this.headless ? this.config?.tap_action : undefined);
    if (!action) return () => void this.openSheet(result.key);
    return actionRuns(action as ActionConfig, result.rows[0]?.id)
      ? () => this.runFor(result, action as AlertAction)
      : undefined;
  }

  /** An alert's hold: its own action, else (without a head) the card's, else the overview of every alert. */
  private holdOf(result: AlertResult): (() => void) | undefined {
    const action =
      result.definition.holdAction ?? (this.headless ? this.config?.hold_action : undefined);
    if (!action) return () => void this.openSheet();
    return actionRuns(action as ActionConfig, result.rows[0]?.id)
      ? () => this.runFor(result, action as AlertAction)
      : undefined;
  }

  /** An action run for an alert: `matched` its entities, `row` (and more-info) its one match. */
  private runFor(result: AlertResult, action: AlertAction): void {
    const hass = this.hass;
    if (!hass) return;
    const matched = result.rows.map((row) => row.id).filter((id) => id in hass.states);
    const one = matched.length === 1 ? matched[0] : undefined;
    const bound = bindAction(action, { matched, ...(one ? { row: one } : {}) });
    if (bound) void runAction(this, hass, bound, one ?? matched[0]);
  }

  /** The sheet, its chunk fetched the first time: a dashboard that only shows its alerts never pays for it. */
  private async openSheet(key?: string): Promise<void> {
    const openedBy = (this.renderRoot as ShadowRoot).activeElement as HTMLElement | null;
    if (!this.sheetReady_) {
      await import('./sheet/alerts-sheet.js');
      this.sheetReady_ = true;
    }
    await this.updateComplete;
    const sheet = this.renderRoot.querySelector<FluvyAlertsSheet>('fluvy-alerts-sheet');
    if (!sheet) return;
    this.sheetOpen_ = true;
    sheet.open(key, openedBy ?? this);
  }

  /** What the sheet asks of the card: the words, the memory, the actions, its colours. */
  private readonly sheetHost: SheetHost = {
    title: () => this.config?.title ?? s(this.hass, 'title'),
    look: (result) => this.drawn(result),
    context: () => this.context(),
    memory: () => this.memory,
    run: (action, entity) => {
      if (this.hass) void runAction(this, this.hass, action, entity);
    },
    adopt: (root) => this.accents.adopt(root),
    closed: () => {
      this.sheetOpen_ = false;
    },
  };

  /* ---------- render ---------- */

  /** An alert as it is drawn: its name, glyph, tone (its own by name, the card's, its severity's) and own colour. */
  private drawn(result: AlertResult): Drawn {
    const context = this.context();
    return {
      result,
      name: alertName(context, result),
      glyph: alertIcon(context, result),
      tone: result.definition.tone ?? this.config?.tone ?? result.tone,
      accent: this.accents.item(result.color),
    };
  }

  /**
   * What a tile, a row or the banner says under an alert's name, in `room` of the class `cls`: who is at fault — a
   * name, which may end in its ellipsis — and what stays whole after it. One match: its name with how much or how long
   * ("Front door · 6 min", "Hall sensor · 12 %"), else its name alone (the name says more than the time). Several: as
   * many names as hold whole (a name several share with how many, "Window ×4"), and how many more ("Hall sensor, Porch
   * motion +2") — unless the count is said beside the line (`counted`: a badge, a row's value), when the names alone are
   * said, the first ending in its ellipsis where it must. Else how long or how many alone ("4 devices"). `more` stays at
   * the end (the still banner's "6 more").
   */
  private line(result: AlertResult, room: number, cls: string, counted: boolean, more = ''): Line {
    const config = this.config;
    const context = this.context();
    const width = (text: string): number => this.headFit.ruler.width(cls, text);
    // a split alert is its one entity, already its name: its line says how long
    const who = config?.show_culprit === false || result.entity ? [] : culprits(context, result);
    const names = who.map((one) => culpritText(context, one));
    const tail = more ? ` · ${more}` : '';
    const lead = result.rows[0];
    let fallback: string;
    if (result.count <= 1 && lead && names.length <= 1) {
      // a number is how much (a battery's 12 %); anything else, how long
      const detail =
        lead.value !== undefined && lead.state
          ? rowState(context, lead)
          : config?.show_duration === false
            ? ''
            : lasted(context, lead.since);
      const [name] = names;
      if (name && detail && width(`${name} · ${detail}${tail}`) <= room)
        return { who: name, what: ` · ${detail}${tail}` };
      if (name && room - width(tail) >= WHO_MIN) return { who: name, what: tail };
      fallback = [detail, more].filter(Boolean).join(' · ');
    } else {
      // how many the names left out stand for ("Front door +4": a culprit "Window ×4" is four)
      const left = (k: number): number => who.slice(k).reduce((sum, { n }) => sum + n, 0);
      const rest = (k: number): string =>
        `${counted || k === names.length ? '' : ` +${left(k)}`}${tail}`;
      for (let k = mostNames(names, room, width); k >= 1; k--) {
        const said = names.slice(0, k).join(', ');
        if (width(`${said}${rest(k)}`) <= room) return { who: said, what: rest(k) };
      }
      // the count said beside it, the first name may end in its ellipsis (never one with its count, "Window ×4"); else
      // the count says it ("4 devices")
      const [first] = who;
      if (first?.n === 1 && counted && room - width(tail) >= WHO_MIN)
        return { who: first.name, what: tail };
      fallback = [countWords(context, result), more].filter(Boolean).join(' · ');
    }
    return { who: '', what: width(fallback) <= room ? fallback : '' };
  }

  /** A line as drawn: who, ending in an ellipsis where it must, then what stays whole. */
  private renderLine({ who, what }: Line, cls: string): TemplateResult {
    return html`<p class="${cls} al-line">
      ${who ? html`<span class="al-who" data-name>${who}</span>` : nothing}${
        what ? html`<span class="al-what">${what}</span>` : nothing
      }
    </p>`;
  }

  /** The count a tile or a row says: none for a single match (it names it), none when asked. */
  private countOf(result: AlertResult): string {
    return this.config?.show_count === false || result.count <= 1 ? '' : String(result.count);
  }

  /** The tiles' column gap: the laid-out grid's, else the dashboard's in pixels, else the theme's 16. */
  private gridGap(): number {
    const grid = this.renderRoot.querySelector<HTMLElement>('.al-tiles');
    const laid = grid ? Number.parseFloat(getComputedStyle(grid).columnGap) : Number.NaN;
    if (Number.isFinite(laid)) return laid;
    const raw = getComputedStyle(this).getPropertyValue('--ha-section-grid-column-gap').trim();
    return raw.endsWith('px') ? Number.parseFloat(raw) : 16;
  }

  /**
   * The tiles a row: as asked (two compact, three minis), never more than the width holds at their least; `auto`, as
   * many as hold the tiles group's own (148 compact, 84 mini).
   */
  private columns(size: TileSize, count: number): number {
    const gap = this.gridGap();
    const fit = (least: number): number =>
      Math.max(1, Math.floor((this.width + gap) / (least + gap)));
    const asked =
      this.config?.columns === 'auto'
        ? fit(AUTO_TILE[size])
        : alertsColumns({
            type: '',
            columns: this.config?.columns,
            variant: size === 'mini' ? 'mini' : 'tiles',
          });
    return Math.max(1, Math.min(asked, fit(MIN_TILE[size]), count));
  }

  /** The alerts a card shows (a fold, "+2", takes the rest to the overview). */
  private visible(): { readonly shown: readonly AlertResult[]; readonly more: number } {
    const all = this.alerts.shown;
    const max = Math.round(Number(this.config?.max_alerts));
    if (!Number.isFinite(max) || max < 1 || all.length <= max) return { shown: all, more: 0 };
    return { shown: all.slice(0, max), more: all.length - max };
  }

  /** The playground's docked sheet (`_sheet`), opened once its chunk is here. */
  private demo = '';

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const demo = this.config?._sheet ?? '';
    if (demo && demo !== this.demo) {
      this.demo = demo;
      void import('./sheet/alerts-sheet.js').then(async () => {
        await this.updateComplete;
        const sheet = this.renderRoot.querySelector<FluvyAlertsSheet>('fluvy-alerts-sheet');
        if (!sheet) return;
        const [key, mode] = demo.split(':');
        this.sheetOpen_ = true;
        sheet.open(key === 'overview' ? undefined : key);
        sheet.snoozing_ = mode === 'snooze';
      });
    }
  }

  protected renderCard(): TemplateResult {
    // every alert's own colour is derived now: the sheet draws the snoozed and the clear ones too
    for (const result of this.alerts.alerts) this.accents.item(result.color);
    if (this.config?._sheet)
      return html`<fluvy-alerts-sheet
        docked
        ?dark=${this.dark}
        ?no-theme=${this.noTheme}
        .hass=${this.hass}
        .state=${this.alerts}
        .card=${this.sheetHost}
      ></fluvy-alerts-sheet>`;
    const { shown, more } = this.visible();
    const variant = this.variant;
    const body = !shown.length
      ? this.renderClear(variant)
      : variant === 'rows'
        ? this.renderRows(shown, more)
        : variant === 'chips'
          ? this.renderChips(shown, more)
          : variant === 'banner'
            ? this.renderBanner(shown)
            : this.renderTiles(shown, more, variant === 'mini' ? 'mini' : 'compact');
    return html`${body}${
      this.sheetReady_
        ? html`<fluvy-alerts-sheet
            ?dark=${this.dark}
            ?no-theme=${this.noTheme}
            .hass=${this.hass}
            .state=${this.alerts}
            .card=${this.sheetHost}
          ></fluvy-alerts-sheet>`
        : nothing
    }`;
  }

  /** A circle: the alert's glyph in its tone, or in its own colour (its identity). */
  private circle(drawn: Drawn): TemplateResult {
    return html`<span
      class="fv-ico fv-ico--${drawn.accent ? 'accent' : drawn.tone}"
      data-icon
      data-accent=${drawn.accent ?? nothing}
      >${icon(drawn.glyph)}</span
    >`;
  }

  /** The press over a tile, a row or a chip: the alert's tap and hold, named by what it says. */
  private press(result: AlertResult, label: string): TemplateResult | typeof nothing {
    const tap = this.tapOf(result);
    const hold = this.holdOf(result);
    return tap || hold ? pressCover(label, tap, hold) : nothing;
  }

  /** A tile's count where its name stays whole beside it (it gives way first, as a head's badge does). */
  private tileCount(drawn: Drawn, room: number): { readonly text: string; readonly width: number } {
    const text = this.countOf(drawn.result);
    const width = text ? this.headFit.ruler.pill('fv-badge', text, BADGE_SIDES) + BADGE_GAP : 0;
    return text && this.headFit.ruler.width(NAME.compact, drawn.name) <= room - width
      ? { text, width }
      : { text: '', width: 0 };
  }

  /** One tile: the alert filled in its tone, its circle, its name over its line, its count. */
  private renderTile(
    one: Drawn,
    size: TileSize,
    circle: boolean,
    inner: number,
    more = '',
  ): TemplateResult {
    const count = size === 'mini' ? { text: '', width: 0 } : this.tileCount(one, inner);
    const line = this.line(one.result, inner - count.width, LINE[size], Boolean(count.text), more);
    const banner = Boolean(more) || this.variant === 'banner';
    return html`<article
      class="fv-tile fv-tile--${size} fv-tile--tap is-on fv-tile--${one.tone} al-tile ${banner ? 'al-banner' : ''}"
      data-card
    >
      ${circle ? this.circle(one) : nothing}
      ${keyed(
        one.result.key,
        html`<div class="fv-tile__text">
          <h3 class="fv-tile__name" data-name>${one.name}</h3>
          ${this.renderLine(line, 'fv-tile__state')}
        </div>`,
      )}
      ${count.text ? html`<span class="fv-badge al-count" data-fit="28">${count.text}</span>` : nothing}
      ${this.press(one.result, [one.name, `${line.who}${line.what}`, count.text].filter(Boolean).join(' · '))}
    </article>`;
  }

  /**
   * The tiles, on the page as a group's: each alert filled in its tone — its circle, its name over its line, its count
   * at the end (a mini tile: the circle over the name and the line). The circles give way together, as a head's
   * does: where that makes a name whole, or where a name would end before it had begun beside one.
   */
  private renderTiles(
    results: readonly AlertResult[],
    more: number,
    size: TileSize,
  ): TemplateResult {
    const columns = this.columns(size, results.length + (more ? 1 : 0));
    const gap = this.gridGap();
    const width = Math.floor((this.width - (columns - 1) * gap) / columns);
    const drawn = results.map((result) => this.drawn(result));
    const mini = size === 'mini';
    const beside = width - SIDES - CIRCLE;
    // a compact tile under 128 hides its circle (tiles.css)
    const circles =
      mini ||
      (width >= MIN_TILE.compact &&
        drawn.every(({ name }) => {
          const own = this.headFit.ruler.width(NAME.compact, name);
          return beside >= Math.min(NAME_MIN, own) && (own <= beside || own > beside + CIRCLE);
        }));
    const inner = mini ? width - MINI_SIDES : width - SIDES - (circles ? CIRCLE : 0);
    return html`<div
      class="fv-tiles al-tiles"
      style="grid-template-columns:repeat(${columns}, minmax(0, 1fr))"
      data-card
    >
      ${drawn.map((one) => this.renderTile(one, size, circles, inner))}
      ${more ? this.renderFoldTile(more, size, circles, inner) : nothing}
    </div>`;
  }

  /** The fold as a tile: "2 more" over "See every alert" (where it holds whole), the overview of every alert. */
  private renderFoldTile(
    more: number,
    size: TileSize,
    circle: boolean,
    inner: number,
  ): TemplateResult {
    const text = s(this.hass, 'more', { n: more });
    const see = s(this.hass, 'see_all');
    const open = (): void => void this.openSheet();
    return html`<article class="fv-tile fv-tile--${size} fv-tile--tap al-tile" data-card>
      ${circle ? html`<span class="fv-ico fv-ico--neutral" data-icon>${icon('dots')}</span>` : nothing}
      <div class="fv-tile__text">
        <h3 class="fv-tile__name" data-name>${text}</h3>
        <p class="fv-tile__state">
          ${this.headFit.ruler.width(LINE[size], see) <= inner ? see : ''}
        </p>
      </div>
      ${pressCover(text, open, open)}
    </article>`;
  }

  /**
   * The chips, a strip of filled pills — one an alert, its glyph, its name and how many — in equal cells over as many
   * rows as they need: as many a row as hold every name whole, else two a row, a long name ending in its ellipsis; where
   * not even that holds, every pill its glyph and its count alone (the name its label).
   */
  private renderChips(results: readonly AlertResult[], more: number): TemplateResult {
    const drawn = results.map((result) => this.drawn(result));
    const counts = results.map((result) =>
      this.config?.show_count === false ? '' : String(result.count),
    );
    const measure = (text: string): number => this.headFit.ruler.width(CHIP, text);
    const fold = more ? `+${more}` : '';
    const own = (i: number, name: number): number =>
      CHIP_SIDES + CHIP_GLYPH + name + (counts[i] ? CHIP_GAP + measure(counts[i] ?? '') : 0);
    const foldWidth = fold ? CHIP_SIDES + measure(fold) : 0;
    const whole = [...drawn.map(({ name }, i) => own(i, measure(name))), foldWidth];
    const least = [
      ...drawn.map(({ name }, i) => own(i, Math.min(CHIP_NAME_MIN, measure(name)))),
      foldWidth,
    ];
    const short = [...drawn.map((_, i) => own(i, 0) - CHIP_GAP), foldWidth];
    const count = drawn.length + (fold ? 1 : 0);
    const candidates = count < 3 ? [count] : count === 4 ? [4, 2] : [count, 3, 2];
    const holds = (columns: number, widths: readonly number[]): boolean =>
      (this.width - CHIP_SPACE * (columns - 1)) / columns >= Math.max(TOUCH, ...widths);
    const fewest = candidates[candidates.length - 1] ?? 1;
    const named =
      candidates.find((columns) => holds(columns, whole)) ??
      (holds(fewest, least) ? fewest : undefined);
    const columns = named ?? candidates.find((n) => holds(n, short)) ?? 1;
    const glyphs = named === undefined;
    const grid = optionGrid(count, columns);
    const span = (i: number): string | typeof nothing =>
      grid.spans[i] === 1 ? nothing : `grid-column:span ${grid.spans[i]}`;
    const open = (): void => void this.openSheet();
    return html`<div
      class="fv-chips fv-chips--fill al-chips"
      style="grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr))"
      data-card
    >
      ${drawn.map((one, i) => {
        const tap = this.tapOf(one.result);
        const hold = this.holdOf(one.result);
        const label = `${one.name} · ${countWords(this.context(), one.result)}`;
        return html`<button
          class="fv-chip fv-chip--toned fv-tone--${one.tone} is-active"
          data-target
          aria-label=${label}
          title=${glyphs ? label : nothing}
          style=${span(i)}
          .fvTap=${tap as PressTarget['fvTap']}
          .fvHold=${hold as PressTarget['fvHold']}
          @pointerdown=${startPress}
          @click=${clickPress}
          @contextmenu=${hold ? preventMenu : nothing}
          @keydown=${holdKey(hold)}
        >
          <span class="fv-chip__pill" data-control
            >${icon(one.glyph)}${
              glyphs ? nothing : html`<span class="fv-chip__name" data-name>${one.name}</span>`
            }${counts[i] ? html`<span class="al-chip__count">${counts[i]}</span>` : nothing}</span
          >
        </button>`;
      })}
      ${
        fold
          ? html`<button
              class="fv-chip fv-chip--toned fv-tone--neutral is-active"
              data-target
              aria-label=${s(this.hass, 'more', { n: more })}
              style=${span(drawn.length)}
              @click=${open}
            >
              <span class="fv-chip__pill" data-control>${fold}</span>
            </button>`
          : nothing
      }
    </div>`;
  }

  /**
   * The rows: a head (the title, how many alerts in the gravest one's tone; the head the overview's button), then a
   * row an alert — its circle in its tone, its name over its line, how many in its tone's ink, the chevron of what
   * opens; compact rows say the name alone. A narrow column gives way in an order, every row together: the circles, as
   * every list's; then, where a name would still end before it had begun beside its count and the chevron (half a
   * section), the row's end — the count moves into the line ("Hall spots +1", "4 devices"), as a tile's badge does, and
   * the chevron goes (the whole row is still the press), so the name has the row.
   */
  private renderRows(results: readonly AlertResult[], more: number): TemplateResult {
    const compact = this.config?.compact === true;
    const drawn = results.map((result) => this.drawn(result));
    const top = drawn[0]?.tone ?? 'neutral';
    const counts = drawn.map(({ result }) => this.countOf(result));
    // the row's end: its count (12 before it) and the chevron's 44
    const ends = counts.map(
      (value) => CHEVRON + (value ? 12 + this.headFit.ruler.width('fv-row__value', value) : 0),
    );
    const keep = this.headFit.rowsKeepIcon(
      this.contentWidth,
      drawn.map(({ name }, i) => ({ title: name, value: '', end: ends[i] ?? CHEVRON })),
      compact,
    );
    const bare =
      !keep &&
      drawn.some(
        ({ name }, i) =>
          this.headFit.rowRoom(this.contentWidth, '', {
            compact,
            icon: false,
            end: ends[i] ?? CHEVRON,
          }) < this.headFit.rowNameRoom(name),
      );
    const values = bare ? counts.map(() => '') : counts;
    const chevron = bare ? nothing : html`<span class="fv-row__chevron">${icon('chevron')}</span>`;
    const label = s(this.hass, 'more', { n: more });
    return html`<article class="fv-card" data-card>
      ${this.renderHead(
        top,
        this.config?.show_count === false
          ? null
          : { text: plural(this.hass, 'alerts.alerts', this.alerts.shown.length), tone: top },
      )}
      <div class="al-rows">
        ${drawn.map((one, i) => {
          const value = values[i] ?? '';
          const room = this.headFit.rowRoom(this.contentWidth, '', {
            compact,
            icon: keep,
            end: bare ? 0 : (ends[i] ?? CHEVRON),
          });
          const line = compact
            ? undefined
            : this.line(one.result, room, 'fv-row__sub', Boolean(value));
          return html`<div
            class="fv-row fv-row--tap ${compact ? 'fv-row--compact' : ''} ${keep ? '' : 'fv-row--bare'}"
          >
            ${keep ? this.circle(one) : nothing}
            <span class="fv-row__text"
              ><span class="fv-row__title" data-name>${one.name}</span>${
                line && (line.who || line.what)
                  ? html`<span class="fv-row__sub al-line"
                      >${line.who ? html`<span class="al-who" data-name>${line.who}</span>` : nothing}${
                        line.what ? html`<span class="al-what">${line.what}</span>` : nothing
                      }</span
                    >`
                  : nothing
              }</span
            >
            ${value ? html`<span class="fv-row__value al-value fv-tone--${one.tone}">${value}</span>` : nothing}
            ${chevron}
            ${this.press(
              one.result,
              [one.name, line ? `${line.who}${line.what}` : '', value].filter(Boolean).join(' · '),
            )}
          </div>`;
        })}
        ${
          more
            ? html`<div class="fv-row fv-row--tap fv-row--compact ${keep ? '' : 'fv-row--bare'}">
                ${keep ? html`<span class="fv-ico fv-ico--neutral" data-icon>${icon('dots')}</span>` : nothing}
                <span class="fv-row__text"><span class="fv-row__title">${label}</span></span>
                ${chevron} ${pressCover(label, () => void this.openSheet(), undefined)}
              </div>`
            : nothing
        }
      </div>
    </article>`;
  }

  /**
   * The head (rows): the title (the card's own, a name, or "Needs attention") and its line, how many alerts in the
   * gravest one's tone; what gives way does so in the head's order — the badge, the line's tail, the circle.
   */
  private renderHead(
    tone: Tone,
    badge: { readonly text: string; readonly tone: Tone } | null,
  ): TemplateResult {
    const fit = (title: string): FittedHead =>
      this.headFit.fit({
        width: this.contentWidth,
        title,
        sub: this.config?.subtitle ?? '',
        badge,
        badgeFirst: true,
      });
    let title = this.config?.title ?? s(this.hass, 'title');
    let fitted = fit(title);
    // the card's own title where it holds whole with its circle and its badge, else its short one; a typed title is
    // the person's
    if (this.config?.title === undefined && (fitted.cut || (badge && fitted.badge === nothing))) {
      title = s(this.hass, 'title_short');
      fitted = fit(title);
    }
    return head({
      icon: fitted.icon ? (this.config?.icon ?? 'bell') : null,
      tone,
      title,
      name: this.config?.title !== undefined,
      sub: fitted.sub,
      trailing: fitted.badge,
      cut: fitted.cut,
      ...this.headPress(),
    });
  }

  /** The head's press (rows): the card's tap and hold, else the overview of every alert. */
  private headPress(): { onTap?: () => void; onHold?: () => void } {
    const press = (action: ActionConfig | undefined): (() => void) | undefined =>
      !action
        ? () => void this.openSheet()
        : actionRuns(action)
          ? () => {
              if (this.hass) void runAction(this, this.hass, action);
            }
          : undefined;
    const onTap = press(this.config?.tap_action);
    const onHold = press(this.config?.hold_action);
    return { ...(onTap ? { onTap } : {}), ...(onHold ? { onHold } : {}) };
  }

  /** Whether the banner turns by itself: asked to, more than one to show, motion allowed. */
  private get turning(): boolean {
    const rotate = Number(this.config?.rotate ?? 6);
    return (
      this.variant === 'banner' && rotate > 0 && this.alerts.shown.length > 1 && !reducedMotion()
    );
  }

  /** The banner's turn, asked every second: the next alert once its time is up, unless it is held. */
  private turn(): boolean {
    if (!this.turning || this.held) return false;
    const now = Date.now();
    if (now - this.turnedAt < Number(this.config?.rotate ?? 6) * 1000) return false;
    this.turnedAt = now;
    this.turn_ = (this.turn_ + 1) % Math.max(1, this.alerts.shown.length);
    return true;
  }

  /**
   * The banner: one tile, the gravest alert first, turning to the next every few seconds (its words cross-fade); a
   * pointer on it, the focus in it or a tab not shown holds it. Held still (no motion, `rotate: 0`), it shows the
   * gravest and says how many more there are.
   */
  private renderBanner(results: readonly AlertResult[]): TemplateResult {
    if (!this.rotation) {
      this.turnedAt = Date.now();
      this.rotation = new Ticker(this, () => this.turn(), 1000);
    }
    const turning = this.turning;
    const one = this.drawn(results[turning ? this.turn_ % results.length : 0] as AlertResult);
    const circle = this.width >= MIN_TILE.compact;
    const inner = this.width - SIDES - (circle ? CIRCLE : 0);
    const others = results.length - 1;
    const hold = (on: boolean): void => {
      this.held = on;
    };
    return html`<div
      class="fv-tiles fv-tiles--1 al-tiles"
      data-card
      @pointerenter=${() => hold(true)}
      @pointerleave=${() => hold(false)}
      @focusin=${() => hold(true)}
      @focusout=${() => hold(false)}
    >
      ${this.renderTile(
        one,
        'compact',
        circle,
        inner,
        !turning && others > 0 ? s(this.hass, 'more', { n: others }) : '',
      )}
    </div>`;
  }

  /**
   * All clear: nothing at all on a dashboard (the card steps aside); asked to stay (`hide_empty: false`), or in the
   * editor, the quiet "All clear" in the variant's own shape — a neutral tile or chip, the head over the empty panel —
   * the editor saying it hides on the dashboard.
   */
  private renderClear(variant: AlertsVariant): TemplateResult {
    const text = this.config?.empty_text ?? s(this.hass, 'all_clear');
    const hint =
      this.preview && this.config?.hide_empty !== false
        ? s(this.hass, 'hidden_hint')
        : s(this.hass, 'nothing');
    const open = (): void => void this.openSheet();
    if (variant === 'rows')
      return html`<article class="fv-card" data-card>
        ${this.renderHead('neutral', null)}
        <div class="al-empty">${this.headFit.empty('check', text, hint, this.contentWidth)}</div>
      </article>`;
    if (variant === 'chips')
      return html`<div class="fv-chips fv-chips--fill al-chips" data-card>
        <button
          class="fv-chip fv-chip--toned fv-tone--neutral is-active"
          data-target
          aria-label=${`${text} · ${hint}`}
          @click=${open}
        >
          <span class="fv-chip__pill" data-control>${icon('check')}${text}</span>
        </button>
      </div>`;
    const room = this.width - SIDES - CIRCLE;
    const line = this.headFit.ruler.width(LINE.compact, hint) <= room ? hint : '';
    return html`<div class="fv-tiles fv-tiles--1 al-tiles" data-card>
      <article class="fv-tile fv-tile--compact fv-tile--tap al-tile" data-card>
        <span class="fv-ico fv-ico--neutral" data-icon>${icon('check')}</span>
        <div class="fv-tile__text">
          <h3 class="fv-tile__name">${text}</h3>
          <p class="fv-tile__state">${line}</p>
        </div>
        ${pressCover(`${text} · ${hint}`, open, open)}
      </article>
    </div>`;
  }
}
