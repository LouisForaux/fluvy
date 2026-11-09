import {
  clock12,
  dateFormat,
  formatNumber,
  houseZone,
  isUsable,
  languageOf,
  speaks,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  firstFit,
  glyph,
  head,
  ico,
  listRow,
  sheetStyles,
  textWidth,
  type GlyphName,
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

import { Card, type BaseKey } from '../shared/base.js';
import { stateWord } from '../shared/domain.js';
import { fitLine } from '../shared/fit.js';

import {
  accentField,
  actionFields,
  boolField,
  cardOpacityField,
  unavailableField,
  editorLabels,
  entityField,
  fieldRow,
  iconField,
  nameField,
  numberField,
  onlyWhen,
  selectField,
  showIconField,
} from '../shared/form.js';
import { HeadFit } from '../energy/head.js';
import type { EditorDefaults } from '../shared/rows-editor.js';

import { CONDITIONS, compassKey, conditionGlyph, isCondition } from '../shared/weather.js';
import { configKeys, type AliasSpec } from '../shared/config.js';
import {
  forecastDaysOf,
  forecastModeOf,
  WEATHER_COMPACT_HEAD,
  WEATHER_ROW,
  weatherHeight,
} from '../weather-family.js';
import { release, type Subscription } from '../shared/subscription.js';

const s = strings('weather');

type ForecastType = 'daily' | 'hourly';
export type ForecastMode = ForecastType | 'both';
/** What the card draws under the hero: a mode, or nothing when the forecast is not shown. */
type Drawn = ForecastMode | 'none';
export type WeatherVariant = 'full' | 'compact';
const VARIANTS: readonly WeatherVariant[] = ['full', 'compact'];

export interface WeatherCardConfig extends FluvyCardConfig {
  /**
   * `full` (default): the hero — the 64 condition circle, the temperature at readout l, a line of context — over
   * day rows or hour columns. `compact`: one head row (the condition circle, the name, "condition · high / low"
   * and the temperature) over hour columns and day columns.
   */
  variant?: WeatherVariant;
  /** What to draw under the hero: day rows (default), hour columns, or both as the design sheet shows them. */
  forecast?: ForecastMode;
  /** Day rows (1–10, default 5); in the compact card, the day columns at most. Hour columns are decided by the card's width. */
  days?: number;
  /** The forecast under the hero (default); `false` keeps the hero alone. */
  show_forecast?: boolean;
  /** The entity's name (default); `false` leaves the condition to say what the card is, in either variant. */
  show_name?: boolean;
  /** Test hook: an ISO date that freezes "now" (day labels, the hours ahead). Undocumented. */
  _now?: string;
}

/** One column of a forecast strip: its label (an hour, a day), the condition's glyph and its figure. */
interface StripCell {
  readonly label: string;
  /** null: nothing forecast (a weather out of reach), the glyph's place kept. */
  readonly glyph: GlyphName | null;
  readonly value: TemplateResult | string;
  readonly title: string;
}

/** One entry of `weather/subscribe_forecast`; every field but `datetime` may be absent or null. */
interface ForecastItem {
  readonly datetime: string;
  readonly condition?: string | null;
  readonly temperature?: number | null;
  readonly templow?: number | null;
  readonly precipitation_probability?: number | null;
  readonly precipitation?: number | null;
}

/** `undefined` = asked, not answered yet (the strip keeps its room); `null` = this entity has no such forecast. */
type Forecasts = Partial<Record<ForecastType, readonly ForecastItem[] | null>>;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const HOUR_COLUMN = 64; // the sheet's hour column: five of them in a 320 column
const ROW = WEATHER_ROW;
const COMPACT_HEAD = WEATHER_COMPACT_HEAD;
const modeOf = (config: WeatherCardConfig | undefined): Drawn => forecastModeOf(config);
const dayCountOf = forecastDaysOf;
/** Whether a config shows the entity's name: all but `show_name: false`. */
const namesItself = (config: { readonly show_name?: unknown } | undefined): boolean =>
  config?.show_name !== false;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const dayOf = (date: Date): number =>
  date.getFullYear() * 10_000 + date.getMonth() * 100 + date.getDate();
const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The weather hero: the condition as a 64 icon circle, the temperature at readout `l`, one line of
 * context, and the forecast underneath — hour columns, day rows, or both as the sheet draws them. The
 * compact card is one head row (the 44 condition circle, the name, "condition · high / low" and the
 * temperature) over the hour columns and the days ahead as columns, as many as the width holds.
 *
 * The forecast is not an attribute any more: the card subscribes to `weather/subscribe_forecast`
 * once per type and releases every subscription on disconnect and whenever the entity or the mode
 * changes. An entity that does not offer a type answers with an error, and that strip stays away.
 */
export class FluvyWeatherCard extends Card<WeatherCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: WeatherCardConfig): number {
    return weatherHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.ambient,
    css`
      /* the lab fixes the sheet at 360; a dashboard column decides here */
      .am-card {
        width: 100%;
      }
      /* same 88 box as the sheet (readout 64 beside the 64 circle, then 4 + the 20 sub; 64 without the sub), but the
         sub runs under the circle too: "Sensación 16° · Viento 12 km/h NO" has to fit a 260 column */
      .am-weather__hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 64px;
        column-gap: 12px;
        align-content: start;
        height: auto;
      }
      .am-weather__now {
        min-width: 0;
      }
      .am-weather__hero > .fv-card__sub {
        grid-column: 1 / -1;
        margin-top: 4px;
      }
      /* "Barcelona El Prat · Partly cloudy": the name may ellipsize, the condition never (and a name with no room left steps aside: see renderCard) */
      .am-weather__label {
        display: flex;
        height: auto;
        min-width: 0;
        white-space: pre;
      }
      .am-weather__name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .am-weather__condition {
        flex: none;
      }
      /* …and a condition too long for the label even alone (a narrow column) takes a second line at its words, which
         the hero grows by, rather than run into the circle */
      .am-weather__condition:only-child {
        flex: 0 1 auto;
        min-width: 0;
        white-space: normal;
      }
      /* a word the label may say wider than its column beside the circle (de's "AUSSERGEWÖHNLICH" at 211): the label
         takes the hero's width, over the figure and the circle, rather than break inside a word */
      .am-weather__hero--wide .am-weather__now,
      .am-weather__hero--wide .fv-readout {
        display: contents;
      }
      .am-weather__hero--wide .am-weather__label {
        grid-column: 1 / -1;
        margin-bottom: 4px;
      }
      .am-weather__hero--wide .fv-readout__value {
        align-self: center;
        margin-top: 0;
      }
      /* a day's condition the language may say wider than its room beside the figures (fr's "Partiellement nuageux" at
         266) runs under them, across the row: the figures stay on the day's line */
      .am-days--stack > .fv-row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        gap: 0 12px;
        align-content: center;
      }
      .am-days--stack > .fv-row--bare {
        grid-template-columns: minmax(0, 1fr) auto;
      }
      .am-days--stack .fv-row__text {
        display: contents;
      }
      .am-days--stack .fv-ico {
        grid-row: span 2;
      }
      .am-days--stack .fv-row__sub {
        grid-column: -3 / -1;
      }
      /* the figures end the day's line (beside the 15/600 day: Blink's floored half-leading, § Readouts and text) */
      .am-days--stack .fv-row__value {
        grid-area: 1 / -2;
        margin-top: -1px;
        text-align: end;
      }
      .am-hours {
        grid-template-columns: repeat(var(--am-hours, 5), var(--am-hour-w, minmax(0, 1fr)));
        justify-content: center;
      } /* cells on the 4 grid: every glyph on a whole pixel */
      .am-days > .fv-skeleton {
        border-radius: var(--fluvy-radius-control);
      }
      /* a strip while its forecast is asked: its own box, shimmering as a skeleton does */
      .am-hours.is-loading {
        animation: fv-shimmer 900ms ease-in-out infinite;
      }
      /* an hour with nothing forecast keeps its glyph's place */
      .am-hour__none {
        width: 24px;
        height: 24px;
      }
    `,
  ];

  static override properties = { ...Card.properties, forecasts_: { state: true } };

  declare forecasts_: Forecasts;

  /** Fits the compact card's head to its column (measured in the card's own classes, again when a font lands). */
  private readonly head = new HeadFit(this);

  private subscriptions: Subscription[] = [];
  /** What the live subscriptions are for, and what `forecasts_` was answered for: `entity|types`. */
  private subscribedKey = '';
  private dataKey = '';

  constructor() {
    super();
    this.forecasts_ = {};
  }

  /** The hero's icon is the condition, tinted by the day: of the base it honours the entity, name, icon, colour and actions. */
  static override base: readonly BaseKey[] = [
    'entity',
    'name',
    'icon',
    'color',
    'card_color',
    'card_opacity',
    'unavailable',
    'tap_action',
    'hold_action',
    'show_icon',
  ];
  static override keys = configKeys<WeatherCardConfig>()([
    'variant',
    'forecast',
    'days',
    'show_forecast',
    'show_name',
  ]);
  /** `forecast: none` was the way to keep the hero alone: it reads as `show_forecast: false`. */
  static override aliases: AliasSpec = {
    keys: [
      {
        from: 'forecast',
        to: 'show_forecast',
        when: (value) => value === 'none',
        map: () => false,
      },
    ],
  };
  static override defaults: EditorDefaults = () => ({
    forecast: 'daily',
    show_forecast: true,
    show_name: true,
    variant: 'full',
  });
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['weather']),
        fieldRow(onlyWhen(namesItself, nameField()), iconField()),
        fieldRow(boolField('show_name'), showIconField()),
        fieldRow(
          selectField('variant', VARIANTS),
          selectField('forecast', ['daily', 'hourly', 'both']),
        ),
        fieldRow(numberField('days', 1, 10), boolField('show_forecast')),
        accentField(),
        accentField('card_color', { none: true }),
        cardOpacityField(),
        unavailableField(),
        actionFields(),
      ],
      ...editorLabels(
        s,
        { forecast: 'editor.forecast' },
        { entity: 'editor.weather', days: 'editor.days' },
      ),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): WeatherCardConfig {
    return {
      type: 'custom:fluvy-weather-card',
      entity: entities.find((id) => id.startsWith('weather.')) ?? '',
    };
  }

  protected override prepare(config: WeatherCardConfig): WeatherCardConfig {
    if (!config.entity) throw new Error('fluvy-weather-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return Math.ceil(
      (this.config ? FluvyWeatherCard.layoutHeight(this.config) : COMPACT_HEAD) / 50,
    );
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /** The sun tells day from night for the whole instance; the condition is the fallback. */
  protected override watched(): readonly string[] {
    return [this.config?.entity ?? '', 'sun.sun'];
  }

  private mode(): Drawn {
    return modeOf(this.config);
  }

  private compact(): boolean {
    return this.config?.variant === 'compact';
  }

  private dayCount(): number {
    return dayCountOf(this.config);
  }

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  /* ---------- forecast subscriptions ---------- */

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate(); // moved in the DOM: `willUpdate` subscribes again
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribeAll();
  }

  /** Runs before every render — the one place where state may still change without costing a second render. */
  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const entityId = this.config?.entity ?? '';
    const mode = this.mode();
    const types: readonly ForecastType[] =
      mode === 'both' ? ['hourly', 'daily'] : mode === 'none' ? [] : [mode];
    const live = this.isConnected && this.hass !== undefined && this.entity().status !== 'missing';
    const key = live && types.length > 0 ? `${entityId}|${types.join('+')}` : '';
    if (key === this.subscribedKey) return;

    this.unsubscribeAll();
    this.subscribedKey = key;
    if (key !== this.dataKey) {
      this.forecasts_ = {};
      this.dataKey = key;
    } // a reconnect keeps what it was showing
    for (const type of types) if (key) this.subscribe(entityId, type);
  }

  private subscribe(entityId: string, type: ForecastType): void {
    const connection = this.hass?.connection;
    if (!connection) return;
    const subscription: Subscription = { cancelled: false };
    this.subscriptions.push(subscription);
    const answer = (items: readonly ForecastItem[] | null): void => {
      if (!subscription.cancelled) this.forecasts_ = { ...this.forecasts_, [type]: items };
    };
    connection
      .subscribeMessage<{ forecast?: readonly ForecastItem[] | null }>(
        (message) => answer(Array.isArray(message?.forecast) ? message.forecast : null),
        { type: 'weather/subscribe_forecast', forecast_type: type, entity_id: entityId },
      )
      .then((unsubscribe) => {
        subscription.unsubscribe = unsubscribe;
        if (subscription.cancelled) release(subscription); // the card left, or changed entity, while the socket was answering
      })
      .catch(() => answer(null)); // the entity does not offer this forecast: no strip, no noise
  }

  private unsubscribeAll(): void {
    for (const subscription of this.subscriptions) release(subscription);
    this.subscriptions = [];
    this.subscribedKey = '';
  }

  /* ---------- facts ---------- */

  /**
   * Never a sun at night. `sun.sun` decides when the instance has it — and dates the hours ahead from
   * its next rising and setting, each taken back a day at a time to the latest one before `at`.
   * Without it, only the condition itself (`clear-night`) can say so.
   */
  private nightAt(at: number, now: number): boolean {
    const sun = this.hass?.states['sun.sun'];
    if (!sun || (sun.state !== 'below_horizon' && sun.state !== 'above_horizon')) return false;
    const rising = Date.parse(String(sun.attributes['next_rising'] ?? ''));
    const setting = Date.parse(String(sun.attributes['next_setting'] ?? ''));
    if (at <= now || !Number.isFinite(rising) || !Number.isFinite(setting))
      return sun.state === 'below_horizon';
    const latest = (event: number): number => event - Math.ceil((event - at) / DAY_MS) * DAY_MS;
    return latest(setting) > latest(rising);
  }

  /**
   * fluvy's wording in the languages it ships; Home Assistant's own translation elsewhere; and for a
   * condition outside the fifteen (a custom integration), the raw word made presentable. A clear sky
   * after dark is "Clear" beside its moon, whatever the integration calls it.
   */
  private conditionText(condition: string | null | undefined, night = false): string {
    const key = condition === 'sunny' && night ? 'clear-night' : (condition ?? '');
    if (!key) return '';
    const stateObj = this.entity().stateObj;
    if (!speaks(languageOf(this.hass)) && stateObj && this.hass?.formatEntityState) {
      try {
        return capitalise(this.hass.formatEntityState(stateObj, key));
      } catch {
        /* fall through */
      }
    }
    return isCondition(key) ? s(this.hass, key) : capitalise(key.replace(/[-_]/g, ' '));
  }

  private unit(): string {
    return (
      this.entity().attr<string | null>('temperature_unit') ??
      this.hass?.config?.unit_system?.temperature ??
      '°C'
    );
  }

  /** Whole degrees for anything forecast or felt; the measured temperature keeps its decimal. */
  private degrees(value: unknown, digits = 0): string | null {
    return isNumber(value) ? formatNumber(this.hass, value, { digits }) : null;
  }

  private bearing(value: unknown): string {
    if (typeof value === 'string' && value.trim() && Number.isNaN(Number(value)))
      return value.trim().toUpperCase();
    const degrees = Number(value);
    if (value === null || value === undefined || value === '' || !Number.isFinite(degrees))
      return '';
    return s(this.hass, compassKey(degrees));
  }

  /**
   * "Feels 16°", "Wind 12 km/h NW" — humidity stands in for whichever of the two the entity does not report; a weather
   * that cannot be read keeps the line, "Feels — · Wind —".
   */
  private contextParts(): string[] {
    const view = this.entity();
    if (view.status !== 'ok')
      return [s(this.hass, 'feels', { value: '—' }), `${this.t('weather.wind')} —`];
    const parts: string[] = [];
    const feels = this.degrees(view.attr('apparent_temperature'));
    if (feels !== null) parts.push(s(this.hass, 'feels', { value: `${feels}°` }));
    const speed = view.attr('wind_speed');
    if (isNumber(speed)) {
      const direction = this.bearing(view.attr('wind_bearing'));
      const unit = view.attr<string | null>('wind_speed_unit') ?? 'km/h';
      parts.push(
        `${this.t('weather.wind')} ${formatNumber(this.hass, speed, { digits: 0 })} ${unit}${direction ? ` ${direction}` : ''}`,
      );
    }
    const humidity = view.attr('humidity');
    if (parts.length < 2 && isNumber(humidity))
      parts.push(
        `${this.t('weather.humidity')} ${formatNumber(this.hass, humidity, { digits: 0 })} %`,
      );
    return parts;
  }

  /** The hero's one line of context: "Feels 16° · Wind 12 km/h NW". */
  private contextLine(): string {
    return this.contextParts().join(' · ');
  }

  /** "23° / 13°": a day's high and low as the rows write them; the high alone without a low; nothing without a high. */
  private highLow(item: ForecastItem): string {
    const high = this.degrees(item.temperature);
    const low = this.degrees(item.templow);
    return high === null ? '' : low === null ? `${high}°` : `${high}° / ${low}°`;
  }

  /**
   * What a strip draws: the forecast as answered; for a weather that cannot be read, the hours and days ahead with
   * nothing forecast in them, so the card keeps its columns and rows ("—" in each) while the entity is away.
   */
  private forecast(type: ForecastType): readonly ForecastItem[] | null | undefined {
    const view = this.entity();
    const items = this.forecasts_[type];
    // unknown is a weather that answers: its forecast is waited for, and drawn when it has one
    if (
      view.status === 'ok' ||
      (view.status === 'unknown' && (items === undefined || items?.length))
    )
      return items;
    const step = type === 'hourly' ? HOUR_MS : DAY_MS;
    const now = this.now().getTime();
    const start = type === 'hourly' ? Math.floor(now / HOUR_MS) * HOUR_MS : now;
    return Array.from({ length: type === 'hourly' ? 6 : this.dayCount() + 1 }, (_unused, i) => ({
      datetime: new Date(start + i * step).toISOString(),
    }));
  }

  /** Today's entry of the daily forecast, when it has been answered and has one. */
  private todayForecast(): ForecastItem | undefined {
    const today = dayOf(this.now());
    return (this.forecasts_.daily ?? []).find((item) => {
      const date = new Date(item.datetime);
      return !Number.isNaN(date.getTime()) && dayOf(date) === today;
    });
  }

  /* ---------- forecast strips ---------- */

  private dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const zone = houseZone(this.hass);
    return dateFormat(this.hass?.language ?? 'en', zone ? { ...options, timeZone: zone } : options);
  }

  /** The hour alone — "22" on a 24 h clock, "10 PM" on a 12 h one: a 64 column has no room for "22:00". */
  private hourLabel(date: Date): string {
    const twelve = clock12(this.hass);
    return this.dateFormat(
      twelve ? { hour: 'numeric', hourCycle: 'h12' } : { hour: '2-digit', hourCycle: 'h23' },
    ).format(date);
  }

  /** A column's width in a strip of `columns`: whole multiples of 4, so every glyph lands on a whole pixel. */
  private cellWidth(columns: number): number {
    return Math.floor(this.contentWidth / columns / 4) * 4;
  }

  /** The sheet's strip: equal columns of a label, the condition's glyph and a figure, centred in the content column. */
  private renderStrip(kind: ForecastType, cells: readonly StripCell[]): TemplateResult {
    const columns = cells.length;
    return html`<div
      class="am-hours"
      data-forecast=${kind}
      style="--am-hours:${columns};--am-hour-w:${this.cellWidth(columns)}px"
    >
      ${cells.map(
        (cell) =>
          html`<div class="am-hour" title=${cell.title || nothing}>
            <span class="am-hour__t">${cell.label}</span>
            ${cell.glyph ? glyph(cell.glyph) : html`<i class="am-hour__none"></i>`}
            <span class="am-hour__v">${cell.value}</span>
          </div>`,
      )}
    </div>`;
  }

  /**
   * The hours ahead as columns: as many as the width holds (64 px each, three to six), fewer while the widest hour or
   * figure would not keep 4 px clear in its cell; the first says "Now" where the word fits its column, else its hour.
   */
  private renderHours(
    items: readonly ForecastItem[] | null | undefined,
  ): TemplateResult | typeof nothing {
    if (items === undefined) return html`<div class="am-hours is-loading"></div>`;
    const now = this.now().getTime();
    const ahead = (items ?? [])
      .map((item) => ({ item, at: Date.parse(item.datetime) }))
      .filter(({ at }) => Number.isFinite(at) && at > now - HOUR_MS)
      .slice(0, Math.max(3, Math.min(6, Math.floor(this.contentWidth / HOUR_COLUMN))));
    if (ahead.length === 0) return nothing;
    const family = getComputedStyle(this).fontFamily;
    const hours = ahead.map(({ item, at }) => {
      const value = this.degrees(item.temperature);
      return {
        item,
        at,
        hour: this.hourLabel(new Date(at)),
        value: value === null ? '—' : `${value}°`,
      };
    });
    const widest = Math.max(
      ...hours.map(({ hour }) => textWidth(hour, `500 12px ${family}`)),
      ...hours.map(({ value }) => textWidth(value, `600 15px ${family}`)),
    );
    let columns = hours.length;
    while (columns > 1 && widest > this.cellWidth(columns) - 8) columns -= 1;
    const cell = this.cellWidth(columns);
    return this.renderStrip(
      'hourly',
      hours.slice(0, columns).map(({ item, at, hour, value }, index) => {
        const dark = this.nightAt(at, now);
        return {
          label:
            index === 0 && at <= now + HOUR_MS
              ? firstFit([this.t('common.now'), hour], cell - 8, `500 12px ${family}`)
              : hour,
          glyph: item.condition ? conditionGlyph(item.condition, dark) : null,
          value,
          title: this.conditionText(item.condition, dark),
        };
      }),
    );
  }

  /**
   * The compact card's days as columns: the days after today (the head says today's), as many as the width holds —
   * 64 px each, fewer while the widest "high low" pair would not keep 4 px clear in its cell — up to `days`.
   */
  private renderDayColumns(
    items: readonly ForecastItem[] | null | undefined,
  ): TemplateResult | typeof nothing {
    if (items === undefined) return html`<div class="am-hours is-loading"></div>`;
    const today = dayOf(this.now());
    const dated = (items ?? [])
      .map((item) => ({ item, date: new Date(item.datetime) }))
      .filter(({ date }) => !Number.isNaN(date.getTime()) && dayOf(date) >= today);
    const later = dated.filter(({ date }) => dayOf(date) > today);
    const days = (later.length > 0 ? later : dated).slice(0, this.dayCount());
    if (days.length === 0) return nothing;
    const family = getComputedStyle(this).fontFamily;
    const pairs = days.map(({ item }) => {
      const high = this.degrees(item.temperature);
      const low = this.degrees(item.templow);
      return {
        high,
        low,
        measure: high === null ? '—' : `${high}°${low === null ? '' : ` ${low}°`}`,
      };
    });
    const widest = Math.max(...pairs.map((pair) => textWidth(pair.measure, `600 15px ${family}`)));
    let columns = Math.max(1, Math.min(days.length, Math.floor(this.contentWidth / HOUR_COLUMN)));
    while (columns > 1 && widest > this.cellWidth(columns) - 8) columns -= 1;
    const cell = this.cellWidth(columns);
    const weekday = this.dateFormat({ weekday: 'short' });
    return this.renderStrip(
      'daily',
      days.slice(0, columns).map(({ item, date }, index) => {
        const { high, low } = pairs[index] as (typeof pairs)[number];
        const short = capitalise(weekday.format(date));
        return {
          // the day's weekday, "Today" when the forecast has no day after it (and the word fits the column)
          label:
            dayOf(date) === today
              ? firstFit([this.t('common.today'), short], cell - 8, `500 12px ${family}`)
              : short,
          // a day is the day's weather: never the night face
          glyph: item.condition ? conditionGlyph(item.condition, false) : null,
          value:
            high === null
              ? '—'
              : low === null
                ? `${high}°`
                : html`${high}° <span class="am-hour__low">${low}°</span>`,
          title: this.conditionText(item.condition),
        };
      }),
    );
  }

  /** Every condition's word in the card's language: what a label or a day's line may have to hold, whatever the sky. */
  private conditionWords(): string[] {
    return CONDITIONS.map((condition) => this.conditionText(condition));
  }

  /**
   * "Showers · 60 %", or the amount when the integration forecasts millimetres instead of a chance, measured in the
   * row's own class. The chance is the optional half: in a row too narrow for both it leaves whole, never cut to a
   * digit ("Schauer · 6…").
   */
  private dayDetail(item: ForecastItem, room: number): string {
    const condition = this.conditionText(item.condition);
    const chance = item.precipitation_probability;
    const amount = item.precipitation;
    const rain = isNumber(chance)
      ? chance >= 10
        ? `${formatNumber(this.hass, chance, { digits: 0 })} %`
        : ''
      : isNumber(amount) && amount > 0
        ? `${formatNumber(this.hass, amount, { digits: 1 })} ${this.entity().attr<string | null>('precipitation_unit') ?? 'mm'}`
        : '';
    return this.head.fitRowSegments([{ text: condition }, { text: rain, optional: true }], room);
  }

  /** Beside the hour columns the rows start tomorrow (the hours are today), as the sheet draws them. */
  private renderDays(
    items: readonly ForecastItem[] | null | undefined,
    afterToday: boolean,
  ): TemplateResult | typeof nothing {
    const count = this.dayCount();
    if (items === undefined)
      return html`<div class="am-days">
        <div class="fv-skeleton" style="height:${count * ROW}px"></div>
      </div>`;
    const today = dayOf(this.now());
    const dated = (items ?? [])
      .map((item) => ({ item, date: new Date(item.datetime) }))
      .filter(({ date }) => !Number.isNaN(date.getTime()) && dayOf(date) >= today);
    const later = dated.filter(({ date }) => dayOf(date) > today);
    const days = (afterToday && later.length > 0 ? later : dated).slice(0, count);
    if (days.length === 0) return nothing;
    // the weekdays in their long form while every row's name holds beside its figures even without its circle
    // (pt-BR's "Segunda-feira" in a 211 column does not): else the short form, every row alike, as a date line does
    const namedAs = (form: 'long' | 'short') => {
      const weekday = this.dateFormat({ weekday: form });
      return days.map(({ item, date }) => ({
        item,
        title: dayOf(date) === today ? this.t('common.today') : capitalise(weekday.format(date)),
        value: this.highLow(item) || '—',
      }));
    };
    const long = namedAs('long');
    const named = long.every(
      ({ title, value }) =>
        this.head.rowRoom(this.contentWidth, value, { icon: false }) >=
        this.head.ruler.width('fv-row__title', title),
    )
      ? long
      : namedAs('short');
    // a column too narrow for a day's name beside its figures: the rows give their circles to the names; days with
    // nothing forecast (a weather out of reach) have no weather to draw in them
    const keepIcon =
      days.some(({ item }) => item.condition) && this.head.rowsKeepIcon(this.contentWidth, named);
    // the conditions run under the figures, every row alike, where one the language may say would not hold beside them
    const room = (value: string): number =>
      this.head.rowRoom(this.contentWidth, value, { icon: keepIcon });
    const beside = Math.min(...named.map(({ value }) => room(value)));
    const stack = this.conditionWords().some(
      (word) => this.head.ruler.width('fv-row__sub', word) > beside,
    );
    return html`<div class="am-days ${stack ? 'am-days--stack' : ''}">
      ${named.map(({ item, title, value }) =>
        listRow({
          icon: keepIcon ? conditionGlyph(item.condition ?? '', false) : null, // a day row is the day's weather: neutral, never the night face
          tone: 'neutral',
          title,
          // the row: 44 circle + 12 (when kept), the text, 12 + the value — or the whole row under the figures
          sub: this.dayDetail(item, stack ? room('') + 12 : room(value)),
          trailing: 'value',
          value,
        }),
      )}
    </div>`;
  }

  /* ---------- render ---------- */

  /**
   * Unavailable, unknown or missing, the weather is the live card in the off skin (the owner's rule, 1.9): the hero
   * with its line of context, the hours and the days ahead, every figure "—".
   */
  protected renderCard(): TemplateResult {
    const view = this.entity();
    // unknown is a live card whose word is "Unknown"
    const usable = isUsable(view);
    const known = view.status === 'ok';
    const now = this.now().getTime();
    const night = known && (view.state === 'clear-night' || this.nightAt(now, now));
    // in the condition's slot a weather that is not there is "Not found": the slot is a word's
    const condition = known ? this.conditionText(view.state, night) : stateWord(this.hass, view);
    const tone: Tone = !usable ? 'off' : !known ? 'neutral' : night ? 'accent' : 'solar';
    const value = usable ? this.degrees(view.attr('temperature'), 1) : null;
    const mode = this.mode();
    const hours = mode === 'hourly' || mode === 'both';
    const days = mode === 'daily' || mode === 'both';
    // out of reach the ban glyph, or quiet (`unavailable`) the sky's own at rest
    const icon =
      this.config?.icon ??
      (usable || this.looksQuiet ? conditionGlyph(known ? view.state : '', night) : 'ban');
    const name = this.nameFor(view, this.config?.name);

    if (this.compact())
      return html`<article class="fv-card am-card ${usable ? '' : 'is-off'}" data-card>
        ${this.renderCompactHead(view, { icon, tone, name, condition, value, usable })}
        ${hours ? this.renderHours(this.forecast('hourly')) : nothing}
        ${days ? this.renderDayColumns(this.forecast('daily')) : nothing}
      </article>`;

    // "Feels 16° · Wind 12 km/h NW": the wind goes first where the line would not hold both (a 211 column)
    const context = this.head.fitSub(this.contextLine(), this.contentWidth);
    // the label is 11/600 uppercase at 0.06 em; the name keeps its place while at least 64 px of it would show
    const font = `600 11px ${getComputedStyle(this).fontFamily}`;
    const labelWidth = (text: string): number =>
      textWidth(text.toLocaleUpperCase(), font) + text.length * 0.66;
    // a word the label may say wider than its column beside the circle (de's "Außergewöhnlich", tr's "Kullanılamıyor"
    // at 211): the label takes the hero's width — read on every word it may say, so the hero never changes with the sky
    const column = this.contentWidth - 76;
    const wide = [
      ...this.conditionWords(),
      this.t('state.unavailable'),
      this.t('state.unknown'),
      this.t('state.not_found'),
      condition,
    ]
      .flatMap((text) => text.split(' '))
      .some((word) => this.head.ruler.width('fv-readout__label', word) > column);
    const nameRoom = (wide ? this.contentWidth : column) - labelWidth(` · ${condition}`);
    const named = namesItself(this.config) && nameRoom >= Math.min(64, labelWidth(name) + 2);
    // the figure at the hero's 40 while it holds its column beside the 64 circle (a 211 column does not hold
    // "17.6 °C"): else at the readout's 24, a step down before its unit is cut
    const unit = value === null ? '' : this.unit();
    const large =
      this.head.ruler.width(
        'fv-readout fv-readout--l > fv-readout__value',
        value ?? '—',
        'fv-unit',
        unit,
      ) <=
      this.contentWidth - 64 - 12;

    return html`<article class="fv-card am-card ${usable ? '' : 'is-off'}" data-card>
      <div class="am-weather__hero ${wide ? 'am-weather__hero--wide' : ''}">
        <div class="am-weather__now">
          <div class="fv-readout ${large ? 'fv-readout--l' : ''}">
            <p class="fv-readout__label am-weather__label">
              ${named ? html`<span class="am-weather__name">${name}</span>` : nothing}<span
                class="am-weather__condition"
                >${named ? ' · ' : ''}${condition}</span
              >
            </p>
            <p class="fv-readout__value">
              <span>${value ?? '—'}</span
              >${value === null ? nothing : html`<span class="fv-unit">${this.unit()}</span>`}
            </p>
          </div>
        </div>
        ${ico(icon, tone, {
          hero: true,
          label: condition,
          onTap: () => this.tap(view.id),
          onHold: () => this.hold(view.id),
        })}
        ${context ? html`<p class="fv-card__sub">${context}</p>` : nothing}
      </div>
      ${hours ? this.renderHours(this.forecast('hourly')) : nothing}
      ${days ? this.renderDays(this.forecast('daily'), mode === 'both') : nothing}
    </article>`;
  }

  /**
   * The compact card's head: the condition circle, the name (which may end in an ellipsis, as names do), the
   * temperature at the end as the compact family writes it ("18.0°"), and a second line fitted to the room between
   * them — the condition, then today's "high / low" and the hero's context while they fit, whole segments only
   * (`HeadFit`: the circle gives way before a name or the condition would).
   */
  private renderCompactHead(
    view: EntityView,
    o: {
      readonly icon: string;
      readonly tone: Tone;
      readonly name: string;
      readonly condition: string;
      readonly value: string | null;
      readonly usable: boolean;
    },
  ): TemplateResult {
    const temperature = o.value === null ? '—' : `${o.value}°`;
    const today = o.usable ? this.todayForecast() : undefined;
    const trailing = this.head.ruler.width('am-weather__temp', temperature);
    // a condition the line cannot hold even in the circle's room (fr's "Partiellement nuageux" at 211) is said by the
    // circle's glyph, which stays: the line then begins with the day's figures — never a condition cut
    const width = (text: string): number => this.head.ruler.width('fv-card__sub', text);
    const said =
      this.showIcon === 'never' || width(o.condition) <= this.contentWidth - trailing - 12;
    const segments = [
      said ? o.condition : '',
      today ? this.highLow(today) : '',
      // the line is the condition's: a reading that cannot be had says nothing more ("Feels —" is the hero's slot)
      ...(view.status === 'ok' ? this.contextParts() : []),
    ].filter(Boolean);
    const title = namesItself(this.config) ? o.name : '';
    const fitted = this.head.fit({
      width: this.contentWidth,
      title,
      // what follows a condition left to the glyph leaves whole too, from the end, beside the circle
      sub: said
        ? segments.join(' · ')
        : fitLine(
            segments.map((text) => ({ text, optional: true })),
            this.contentWidth - 56 - trailing - 12,
            width,
          ),
      trailing,
      ...(said ? {} : { icon: 'always' as const }),
    });
    return head({
      icon: fitted.icon ? o.icon : null,
      small: fitted.small,
      tone: o.tone,
      title,
      name: true,
      sub: fitted.sub,
      trailing: html`<span class="am-weather__temp">${temperature}</span>`,
      cut: fitted.cut,
      // the button reads what the circle said: the place, and the sky over it
      ...this.headActions(view.id, `${o.name} · ${o.condition}`),
    });
  }
}
