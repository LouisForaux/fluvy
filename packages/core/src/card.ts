import { LitElement, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { PALETTE_TOKEN, THEME_SENTINEL } from '@fluvy/tokens/config';
import { fetchSliderStyles, motionPreference, type Tone } from '@fluvy/ui';
import { runAction, type ActionConfig } from './actions.js';
import { resolveEntity, type EntityView } from './entity.js';
import { ensureFonts } from './fonts.js';
import type {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceGridOptions,
} from './ha/types.js';
import {
  languageOverride,
  localize,
  markLanguage,
  onWords,
  type MessageKey,
} from './i18n/index.js';
import { layoutHeightOf } from './layout-heights.js';
import { idsOf, type EntityEntry } from './lists.js';
import { AccentSheet } from './look/accent.js';
import { entityName, type EntityName } from './names.js';
import { remember } from './remember.js';
import { CHART_DEFAULTS, type ChartSettings, type SavedSeries } from './settings/charts.js';
import {
  UNAVAILABLE_LOOKS,
  type CardSurface,
  type LightTint,
  type UnavailableLook,
} from './settings/schema.js';
import {
  isSliderStyle,
  isSliderWords,
  SLIDER_DEFAULTS,
  type SliderSettings,
  type SliderStyle,
  type SliderWords,
} from './settings/sliders.js';

/**
 * What every card's config may carry. `tone` is the role a card's parts are drawn in (a palette tone); `color` is
 * the card's own colour — a Home Assistant colour name or `#rrggbb` — standing in for the palette's accent inside
 * it. `tap_action` answers the head (the card's button), `hold_action` a still press on it; both default to more-info.
 */
export interface FluvyCardConfig extends LovelaceCardConfig {
  entity?: string;
  /** Ids, or objects naming one (auto-entities hands its matches over so); read through `idsOf` / `entriesOf`. */
  entities?: readonly EntityEntry[];
  /** Words, or Home Assistant's parts of a name (`entityName`): its entity's own name where none is given. */
  name?: EntityName;
  icon?: string;
  tone?: Tone;
  color?: string;
  /** The card's own surface: a quiet wash of this colour as its fill, its edge and dividers in the colour (1.7). */
  card_color?: string;
  /** How opaque its surface is, in percent (1.15); unset, the house's (`cardOpacity`). */
  card_opacity?: number;
  /** How it looks while what it shows is out of reach (1.16, #126); unset, the house's (`unavailableLook`). */
  unavailable?: UnavailableLook;
  /** The style its sliders are drawn in (1.18, #144); unset or `house`, the house's (`sliderStyleOf`). */
  slider_style?: 'house' | SliderStyle;
  /** The words under a bar or a liquid of its (1.18); unset, the house's (`sliderWordsOf`). */
  slider_words?: SliderWords;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
}

/** One `hass` per Home Assistant update, in the language fluvy's settings chose (shared by every card). */
const inLanguage = new WeakMap<HomeAssistant, HomeAssistant>();
/**
 * Home Assistant's `locale` in the language chosen: one object while neither changes, so an update of the house
 * that changed only states leaves it as it was (a card draws again when the locale is another object).
 */
const localeIn = remember(
  (locale: HomeAssistant['locale'], language: string): HomeAssistant['locale'] => ({
    ...locale,
    language,
  }),
);
/** Cards on the page, to hand the language change to at once. */
const live = new Set<FluvyCard>();

/**
 * `hass` as the person's language choice sees it: the same object with `language` (the words) and `locale.language`
 * (dates, months, numbers) replaced; Home Assistant's explicit choices (number and date formats, the first weekday,
 * the time zone) stay. Nested objects are shared.
 */
function withLanguage(hass: HomeAssistant | undefined): HomeAssistant | undefined {
  const language = languageOverride();
  if (!hass || !language || hass.language === language) return hass;
  let view = inLanguage.get(hass);
  if (view?.language !== language) {
    view = { ...hass, language, locale: localeIn(hass.locale, language) };
    inLanguage.set(hass, view);
  }
  return view;
}

/** Said on the window when a person's preferences change: what is not a card (a page of ours) follows too. */
export const PREFERENCES_EVENT = 'fluvy-preferences';

/** A mode forced on every card (a wall at night); undefined lets Home Assistant's own mode through. */
let darkOverride: boolean | undefined;
export function setDarkOverride(dark: boolean | undefined): void {
  darkOverride = dark;
}

/** Hands every card on the page the person's preferences now chosen (fluvy's settings changed): language, motion. */
export function refreshCards(): void {
  for (const card of live) {
    card.hass = card.rawHass;
    card.toggleAttribute('reduced-motion', motionPreference() === 'reduced');
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(PREFERENCES_EVENT));
}
// a language's words arriving are a preference change too: every card says them at once
onWords(refreshCards);

/**
 * What the house says of lights where a card says nothing (fluvy's settings → Look, 1.9): a light card's `tint`, and
 * `light_colors` on tiles, rows and rooms — keys new in 1.9 only, so a card of 1.8 draws as it did.
 */
export interface HouseLights {
  readonly tint: LightTint;
  readonly colors: boolean;
}
let houseLights: HouseLights = { tint: 'off', colors: false };

/** The house's defaults for lights, as the settings last said (a card's own key wins). */
export const lightDefaults = (): HouseLights => houseLights;

/** The house's defaults for lights changed (saved, or previewed in the panel): every card draws again with them. */
export function setLightDefaults(next: HouseLights): void {
  if (next.tint === houseLights.tint && next.colors === houseLights.colors) return;
  houseLights = { tint: next.tint, colors: next.colors };
  for (const card of live) card.requestUpdate();
}

/**
 * What the house says of charts where a card says nothing (fluvy's settings → Charts, 1.11): the style every chart
 * and gauge is drawn in, its fine settings, and the house's saved sets of series colours. A card's own key wins.
 */
export interface HouseCharts {
  readonly settings: ChartSettings;
  readonly sets: readonly SavedSeries[];
}
let houseCharts: HouseCharts = { settings: CHART_DEFAULTS, sets: [] };

/** The house's chart settings, as the settings last said (a card's own key wins). */
export const chartDefaults = (): HouseCharts => houseCharts;

/** The house's chart settings changed (saved, or previewed in the panel): every card draws again with them. */
export function setChartDefaults(next: HouseCharts): void {
  if (JSON.stringify(next) === JSON.stringify(houseCharts)) return;
  houseCharts = { settings: { ...next.settings }, sets: [...next.sets] };
  for (const card of live) card.requestUpdate();
}

/** What the house says of every card's surface where a card says nothing (fluvy's settings → Appearance, 1.15). */
let houseCards: CardSurface = { opacity: 100, blur: true, unavailable: 'dashed' };

/** The house's cards' surface, as the settings last said (a card's own `card_opacity` and `unavailable` win). */
export const cardDefaults = (): CardSurface => houseCards;

/** The house's cards' surface changed (saved, or previewed in the panel): every card wears it at once. */
export function setCardDefaults(next: CardSurface): void {
  if (
    next.opacity === houseCards.opacity &&
    next.blur === houseCards.blur &&
    next.unavailable === houseCards.unavailable
  )
    return;
  houseCards = { opacity: next.opacity, blur: next.blur, unavailable: next.unavailable };
  // a house of see-through or quiet cards fetches what they wear before they draw (a card's first frame waits for it)
  if (next.opacity < 100) void fetchGlass();
  if (next.unavailable === 'quiet') void fetchQuiet();
  wearSurfaces();
}

/**
 * What the house says of sliders where a card says nothing (fluvy's settings → Appearance › Sliders, 1.18, #144):
 * the style every slider is drawn in, and the words under a bar or a liquid. A card's own key wins.
 */
let houseSliders: SliderSettings = SLIDER_DEFAULTS;

/** The house's slider settings, as the settings last said (a card's own `slider_style` and `slider_words` win). */
export const sliderDefaults = (): SliderSettings => houseSliders;

/** Whether a liquid rests on its first frame: the house's motion is off (fluvy's settings → Charts › Motion). */
export const sliderStill = (): boolean => !houseCharts.settings.animate;

/** The house's slider settings changed (saved, or previewed in the panel): every card draws again with them. */
export function setSliderDefaults(next: SliderSettings): void {
  if (next.style === houseSliders.style && next.words === houseSliders.words) return;
  houseSliders = { style: next.style, words: next.words };
  // a house of bars, liquids or fills fetches what they are drawn with before the rulers draw again
  if (next.style !== 'ruler') void fetchSliderStyles();
  for (const card of live) card.requestUpdate();
}

/**
 * The style a card's sliders are drawn in (1.18, #144): its own `slider_style`, else the house's (`house` says so out
 * loud). Fill is a tile's, the whole tile being the slider: a card asked for it draws the ruler (`tile`: the card
 * draws a tile).
 */
export function sliderStyleOf(
  config: Pick<FluvyCardConfig, 'slider_style'> | undefined,
  tile = false,
): SliderStyle {
  const own = config?.slider_style;
  const style = isSliderStyle(own) ? own : houseSliders.style;
  return style === 'fill' && !tile ? 'ruler' : style;
}

/**
 * The words under a card's slider in its style (`items`: the ruler's, by fraction): the ruler's own; under a bar or a
 * liquid the ends and the middle, or none (the card's `slider_words`, else the house's), the row kept either way.
 */
export function sliderWordsOf<T>(
  config: Pick<FluvyCardConfig, 'slider_words'> | undefined,
  items: readonly T[],
  style: SliderStyle,
): readonly T[] {
  if (style === 'ruler') return items;
  const own = config?.slider_words;
  if ((isSliderWords(own) ? own : houseSliders.words) === 'none') return [];
  return items.length > 3
    ? [items[0]!, items[(items.length - 1) >> 1]!, items[items.length - 1]!]
    : items;
}

/** Every card on the page wears its surface again; a card not drawn yet wears it with its first frame. */
const wearSurfaces = (): void => {
  for (const card of live) if (card.hasUpdated) card.wearSurface();
};

/**
 * What a see-through card wears (`look/glass.ts`), once the first one (or the house) has fetched it; one that cannot
 * be fetched leaves the cards solid.
 */
let glass: typeof import('./look/glass.js') | undefined;
let fetchingGlass: Promise<void> | undefined;
/** Whether the fetch is over, landed or failed: a first frame never waits on one that cannot land. */
let glassSettled = false;
function fetchGlass(): Promise<void> {
  fetchingGlass ??= import('./look/glass.js')
    .then(
      (module) => {
        glass = module;
        wearSurfaces();
      },
      () => undefined,
    )
    .finally(() => {
      glassSettled = true;
    });
  return fetchingGlass;
}

/**
 * What a card quiet out of reach wears (`look/quiet.ts`: one sheet every such card adopts), once the first one (or the
 * house) has fetched it; one that cannot be fetched leaves them dashed.
 */
let quietSheet: CSSStyleSheet | undefined;
let fetchingQuiet: Promise<void> | undefined;
/** Whether the fetch is over, landed or failed: a first frame never waits on one that cannot land. */
let quietSettled = false;
function fetchQuiet(): Promise<void> {
  fetchingQuiet ??= import('./look/quiet.js')
    .then(
      (module) => {
        quietSheet = module.quietSheet;
        wearSurfaces();
      },
      () => undefined,
    )
    .finally(() => {
      quietSettled = true;
    });
  return fetchingQuiet;
}

const isUnavailableLook = (value: unknown): value is UnavailableLook =>
  (UNAVAILABLE_LOOKS as readonly unknown[]).includes(value);

/**
 * How a card or an item of it looks out of reach (1.16, #126): the first of `own` that is one of the words (an item's
 * own, then its card's), else the house's.
 */
export function unavailableLook(...own: readonly unknown[]): UnavailableLook {
  return own.find(isUnavailableLook) ?? houseCards.unavailable;
}

/**
 * How opaque a card's surface is, in percent: its own `card_opacity` where it is a number (held to 0 to 100, whole),
 * else the house's.
 */
export function cardOpacity(config: FluvyCardConfig | undefined): number {
  const own = config?.card_opacity;
  return typeof own === 'number' && Number.isFinite(own)
    ? Math.min(100, Math.max(0, Math.round(own)))
    : houseCards.opacity;
}

/** Every card on the page looks again for the theme: the look arrived, moved or left. */
export function resyncCardThemes(): void {
  FluvyCard.readLooks([...live]);
}

/**
 * Cards attached and not drawn yet: what each reads off the page before its first frame, its look (#40) and its width
 * (#104), is read for all of them as the first of them draws, so a view that opens many cards at once (a wall's)
 * forces one style and one layout pass for them, not one or two each.
 */
const unread = new Set<FluvyCard>();

/** What Home Assistant's card wrapper listens for: a card that hid or showed itself is laid out again. */
export const VISIBILITY_EVENT = 'card-visibility-changed';

/**
 * A card that hides itself (a list asked to hide while empty, alerts while all is clear), as Home Assistant's own
 * updates and repairs cards do: the `hidden` attribute (the wrapper reads it, and `:host([hidden])` takes the card out
 * of a stack's or any other wrapper's flow), said with `card-visibility-changed` whichever way it goes and only when
 * it changes. The card stays connected while hidden (`connectedWhileHidden`), so it keeps reading the house and can
 * show itself again. In the editor's preview it is never hidden: a card nobody can see cannot be edited. Called from
 * the card's update, it follows the preview as it comes and goes.
 */
export function selfHide(card: FluvyCard, hidden: boolean): void {
  card.connectedWhileHidden = true;
  const hide = hidden && !card.preview;
  if (card.hidden === hide) return;
  card.hidden = hide;
  card.dispatchEvent(
    new CustomEvent(VISIBILITY_EVENT, { detail: { value: !hide }, bubbles: true, composed: true }),
  );
}

/** Whether a card is one of the previews Home Assistant's card picker lists ("Add card", "By card"). */
function inCardPicker(card: HTMLElement): boolean {
  const root = card.getRootNode();
  return root instanceof ShadowRoot && root.host.localName === 'hui-card-picker';
}

/** Cards that connect within the same beat enter in sequence (30 ms apart, capped) instead of all at once. */
let enterBeat = 0;
let enterIndex = 0;
function nextEnterDelay(): number {
  const now = performance.now();
  if (now - enterBeat > 120) {
    enterBeat = now;
    enterIndex = 0;
  }
  return Math.min(enterIndex++ * 30, 240);
}

/**
 * Base class of every fluvy card.
 *
 * - `hass` arrives on every state change of the whole instance; a card re-renders only when one of
 *   the entities it watches (or the theme, the locale) actually changed.
 * - `dark` mirrors Home Assistant's dark mode on the host; `no-theme` switches the token fallback on
 *   when the fluvy theme is not active on this view, so a card never renders unstyled.
 * - `width` is the host's measured width (ResizeObserver): controls are drawn to it, not to a constant.
 */
export abstract class FluvyCard<C extends FluvyCardConfig = FluvyCardConfig>
  extends LitElement
  implements LovelaceCard
{
  /** Cards that are the dashboard's chrome (the greeting and the tabs) draw at once, without the entrance, so they read as fixed while the views below them change. */
  static still = false;

  /**
   * A group whose items each say how they look out of reach (the tiles card's tiles, `unavailableOf`) marks them, its
   * root never: a dashed tile in a quiet group stays dashed.
   */
  static markedItems = false;

  /**
   * The card's height at a 360 column for this config, for whoever lays cards out before they are drawn: the
   * config's say and the documented default. What the house adds (the entity's capabilities) the automatic dashboard
   * counts with the cards' `house-heights.ts`.
   */
  static layoutHeight?(config: LovelaceCardConfig): number;

  static override properties = {
    hass: { attribute: false, noAccessor: true },
    config: { state: true },
    width: { state: true },
    // on the host as attributes, but written by `syncTheme` itself (`wear`), never by Lit's later reflection
    dark: { attribute: false },
    noTheme: { attribute: false },
    preview: { type: Boolean },
    layout: { type: String, reflect: true },
  };

  /** The `hass` Home Assistant handed over; `hass` is it in the language fluvy's settings chose. */
  rawHass: HomeAssistant | undefined;
  private viewHass: HomeAssistant | undefined;

  get hass(): HomeAssistant | undefined {
    return this.viewHass;
  }

  set hass(value: HomeAssistant | undefined) {
    const previous = this.viewHass;
    this.rawHass = value;
    this.viewHass = withLanguage(value);
    // its sheets and dialogs are its own: the mark covers them
    markLanguage(this, value?.language);
    this.requestUpdate('hass', previous);
  }
  declare config?: C;
  declare width: number;
  declare dark: boolean;
  declare noTheme: boolean;
  declare preview: boolean;
  declare layout?: string;
  /** Kept in the page while it hides itself (Home Assistant's wrapper reads it): `selfHide` sets it. */
  declare connectedWhileHidden?: boolean;

  private resizeObserver: ResizeObserver | undefined;
  /** In the card picker, a card's first frame waits until it comes near the list's view: one observer for them all. */
  private static sightline: IntersectionObserver | undefined;
  private sighted: { readonly promise: Promise<void>; readonly resolve: () => void } | undefined;
  /** The card's own colour and its items', derived on the palette the card wears. */
  protected readonly accents = new AccentSheet();

  constructor() {
    super();
    this.width = 360;
    this.dark = false;
    this.noTheme = false;
    this.preview = false;
  }

  /* ---------- Lovelace contract ---------- */

  setConfig(config: LovelaceCardConfig): void {
    this.config = this.prepare({ ...config } as C);
  }

  /** Validate and fill defaults. Throw an Error with a readable message on a bad config. */
  protected prepare(config: C): C {
    return config;
  }

  getCardSize(): number {
    return 3;
  }

  getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /* ---------- lifecycle ---------- */

  override connectedCallback(): void {
    super.connectedCallback();
    live.add(this);
    this.toggleAttribute('reduced-motion', motionPreference() === 'reduced');
    ensureFonts();
    this.style.setProperty('--fv-enter-delay', `${nextEnterDelay()}ms`);
    if ((this.constructor as typeof FluvyCard).still) this.setAttribute('still', '');
    this.resizeObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) this.takeWidth(box.width);
    });
    this.resizeObserver.observe(this);
    if (this.renderRoot instanceof ShadowRoot) this.accents.adopt(this.renderRoot);
    // attached again (moved), it reads its look at once; not drawn yet, with the cards attached beside it (`unread`)
    if (this.hasUpdated) this.syncTheme();
    else unread.add(this);
    if (!this.hasUpdated && (this.sighted || inCardPicker(this))) this.waitForSight();
  }

  /**
   * Home Assistant's card picker builds a live preview of every card it lists, all at once, Fluvy's at the
   * foot of the list (#117): a preview not yet drawn keeps its declared height and draws, and reads the house, only as
   * it comes within a screen of the list's view.
   */
  private waitForSight(): void {
    if (typeof IntersectionObserver !== 'function' || !this.config) return;
    // one wait for the card's life: taken away and put back (the picker's search), it waits on
    if (!this.sighted) {
      let resolve = (): void => undefined;
      const promise = new Promise<void>((done) => (resolve = done));
      this.sighted = { promise, resolve };
    }
    this.style.minHeight = `${layoutHeightOf(this.config, 0)}px`;
    FluvyCard.sightline ??= new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries)
          if (isIntersecting) (target as FluvyCard).cameIntoSight();
      },
      // the picker scrolls its own list, which clips its cards: the margin reaches into that list too (`scrollMargin`)
      { rootMargin: '600px 0px', scrollMargin: '600px 0px' },
    );
    FluvyCard.sightline.observe(this);
  }

  /** Come near the picker's view: the card draws, the one update it waited for taking every ask since. */
  private cameIntoSight(): void {
    this.stopWaiting();
    this.style.minHeight = '';
    const sighted = this.sighted;
    this.sighted = undefined;
    sighted?.resolve();
  }

  private stopWaiting(): void {
    FluvyCard.sightline?.unobserve(this);
  }

  /**
   * The first frame is drawn on the card's look and to its own width, read off its box before it is drawn (with every
   * card not drawn yet: `unread`): the 360 it starts at stands in only while it has none. Drawn 360 wide in a narrower
   * column, its controls would reach past the page's edge until the observer first reports, and a phone's page would
   * scroll sideways meanwhile (#104).
   */
  protected override scheduleUpdate(): void | Promise<unknown> {
    // a picker's preview out of sight: its first update waits (`waitForSight`), later asks joining it
    const sighted = this.sighted;
    if (sighted) return sighted.promise.then(() => this.scheduleUpdate());
    // see-through or quiet, the first frame is drawn in what it wears, never solid or dashed a moment before
    const wearing = this.hasUpdated ? undefined : this.wearing();
    if (wearing) return wearing.then(() => this.scheduleUpdate());
    if (unread.has(this)) {
      const cards = [...unread];
      unread.clear();
      FluvyCard.readLooks(cards, true);
    }
    return super.scheduleUpdate();
  }

  /** The card's width off its box, in whole pixels; a card without a box (hidden, not laid out) keeps the one it had. */
  private takeWidth(width: number): void {
    const next = Math.round(width);
    if (next > 0 && next !== this.width) this.width = next;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    live.delete(this);
    unread.delete(this);
    this.stopWaiting();
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    for (const entry of this.optimistic.values()) clearTimeout(entry.timer);
    this.optimistic.clear();
  }

  /** Entities whose changes re-render the card. Defaults to `entity` + `entities` of the config. */
  protected watched(): readonly string[] {
    const ids: string[] = [];
    if (this.config?.entity) ids.push(this.config.entity);
    ids.push(...idsOf(this.config?.entities));
    return ids;
  }

  /**
   * A `hass` that only changed elsewhere in the house is ignored. Anything that can change what this
   * card draws lets it through: a watched entity, the theme (dark mode), the locale or language, the
   * translations (`localize` is replaced when a resource pack loads), and the registries (names, areas).
   */
  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size > 1 || !changed.has('hass')) return true;
    const previous = changed.get('hass') as HomeAssistant | undefined;
    const next = this.hass;
    if (!previous || !next) return true;
    if (
      previous.themes !== next.themes ||
      previous.locale !== next.locale ||
      previous.language !== next.language
    )
      return true;
    if (
      previous.localize !== next.localize ||
      previous.formatEntityState !== next.formatEntityState ||
      previous.formatEntityName !== next.formatEntityName
    )
      return true;
    if (
      previous.entities !== next.entities ||
      previous.devices !== next.devices ||
      previous.areas !== next.areas
    )
      return true;
    if (previous.config !== next.config) return true;
    for (const id of this.watched()) if (previous.states[id] !== next.states[id]) return true;
    return false;
  }

  protected override willUpdate(changed: PropertyValues): void {
    // the first frame's look was read as it was scheduled, with the `hass` it is drawn with
    if (changed.has('hass') && this.hasUpdated) {
      const previous = changed.get('hass') as HomeAssistant | undefined;
      if (previous?.themes !== this.hass?.themes) this.syncTheme();
    }
  }

  /**
   * Reads dark mode, whether a fluvy look reaches this card (its sentinel; the fallback tokens apply where none
   * does) and which palette it wears (its own colours are derived on it).
   */
  syncTheme(): void {
    FluvyCard.readLooks([this]);
  }

  /**
   * The look of `cards` (`syncTheme`), and with `width` their width off their boxes: every read before any write, so
   * cards read together force one style pass (and one layout) between them. The theme carries a sentinel the fallback
   * never defines, so its read cannot feed back on itself; the rest is read live (`getComputedStyle`) once the
   * fallback's attributes are on each host: the palette a card is drawn in from its first frame (#40), never the
   * default's until it is attached again.
   */
  static readLooks(cards: readonly FluvyCard[], width = false): void {
    const computed = cards.map((card) => getComputedStyle(card));
    const bare = computed.map((style) => style.getPropertyValue(THEME_SENTINEL).trim() === '');
    cards.forEach((card, i) => card.wear(bare[i] ?? false));
    cards.forEach((card, i) => {
      const style = computed[i] as CSSStyleDeclaration;
      card.readLook(style);
      if (width) card.takeWidth(parseFloat(style.width));
    });
  }

  /** What the card reads of the look it is drawn in, the fallback's attributes on it: the palette it wears. */
  protected readLook(computed: CSSStyleDeclaration): void {
    const palette = computed.getPropertyValue(PALETTE_TOKEN).trim();
    if (this.accents.wears(palette, this.dark ? 'dark' : 'light')) this.requestUpdate();
  }

  /**
   * `no-theme` and `dark` pick the token fallback (`:host([no-theme])`, `[dark]`): written at once, not at the next
   * update as a reflected property would be, so the tokens read after them are those the card is drawn in.
   */
  private wear(noTheme: boolean): void {
    const dark = darkOverride ?? this.hass?.themes?.darkMode ?? false;
    this.noTheme = noTheme;
    this.dark = dark;
    this.toggleAttribute('no-theme', noTheme);
    this.toggleAttribute('dark', dark);
  }

  /** The card's colour and its items' are written once the render has asked for them, and its surface worn. */
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.accents.host(this.config?.color);
    this.accents.surface(this.config?.card_color);
    this.wearSurface();
  }

  /**
   * What the card's first frame waits for: what a see-through or a quiet card wears, until its fetch is over (one that
   * failed leaves the card solid or dashed, never waiting).
   */
  private wearing(): Promise<void> | undefined {
    if (this.surface && cardOpacity(this.config) < 100 && !glassSettled) return fetchGlass();
    if (this.asksQuiet() && !quietSettled) return fetchQuiet();
    return undefined;
  }

  /** Whether the card looks quiet out of reach (1.16, #126): its own `unavailable`, else the house's. */
  protected get looksQuiet(): boolean {
    return unavailableLook(this.config?.unavailable) === 'quiet';
  }

  /** Whether the card, or an item its config names, looks quiet out of reach (a group's tiles say so in `asksQuiet`). */
  protected asksQuiet(): boolean {
    return this.looksQuiet;
  }

  /** Whether an item drawn this render looks quiet out of reach (`unavailableOf`): the card wears the quiet sheet. */
  private quietItems = false;

  /**
   * How an item of the card looks out of reach (a tile, a group's or the card's own): the card's, else the house's —
   * an item's own `unavailable` first in a group whose items say their own (`markedItems`), the rest following their
   * card, whose root is marked. The card marks the item with it (`data-unavailable="quiet"` where it is quiet: what the
   * quiet sheet reads).
   */
  protected unavailableOf(item: { readonly unavailable?: unknown }): UnavailableLook {
    const own = (this.constructor as typeof FluvyCard).markedItems ? item.unavailable : undefined;
    const look = unavailableLook(own, this.config?.unavailable);
    if (look === 'quiet') this.quietItems = true;
    return look;
  }

  /** Whether the card draws a surface of its own (a greeting, a heading draw none): what may be see-through. */
  protected get surface(): boolean {
    return true;
  }

  /**
   * Its surface as its config and the house say (1.15): under 100 the host is marked `glass` (`blur` while what shows
   * through is blurred) with its opacity in `--fv-glass`, and its sheet is written see-through (`look/glass.ts`, fetched
   * by the first card that is one); solid, or without a surface, the host carries neither. Its sheet is written in
   * either case. Quiet out of reach (1.16), what it draws at its root is marked `data-unavailable="quiet"` (a group
   * whose items each say their own marks them instead: `markedItems`), and it adopts the quiet sheet (`look/quiet.ts`,
   * fetched by the first card that is quiet) where it or an item is.
   */
  wearSurface(): void {
    const quiet = this.looksQuiet;
    if (!(this.constructor as typeof FluvyCard).markedItems)
      for (const root of this.renderRoot.children)
        if (quiet) root.setAttribute('data-unavailable', 'quiet');
        else root.removeAttribute('data-unavailable');
    if (quiet || this.quietItems) this.wearQuiet();
    const level = this.surface ? cardOpacity(this.config) : 100;
    const see = level < 100;
    if (see) {
      const blur = houseCards.blur ? 'blur' : '';
      if (this.getAttribute('glass') !== blur) this.setAttribute('glass', blur);
      this.style.setProperty('--fv-glass', `${level}%`);
      if (!glass) void fetchGlass();
    } else if (this.hasAttribute('glass')) {
      this.removeAttribute('glass');
      this.style.removeProperty('--fv-glass');
    }
    this.accents.glass(see ? glass?.seeThrough : undefined);
    this.accents.commit();
  }

  /** The quiet sheet adopted after the card's own, once it has landed (fetched by the first card that wears it). */
  private wearQuiet(): void {
    const root = this.renderRoot;
    if (!quietSheet) void fetchQuiet();
    else if (root instanceof ShadowRoot && !root.adoptedStyleSheets.includes(quietSheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, quietSheet];
  }

  /* ---------- optimistic state ---------- */

  private readonly optimistic = new Map<string, { state: string; timer: number }>();

  /**
   * Shows `state` for an entity right away (a switch flips under the finger) until Home Assistant
   * reports it — or for 3 s at most, after which the real state wins, whatever it is.
   */
  protected expect(entityId: string, state: string): void {
    const previous = this.optimistic.get(entityId);
    if (previous) clearTimeout(previous.timer);
    const timer = window.setTimeout(() => {
      // only the entry this timer belongs to: a newer expectation on the same entity keeps its own clock
      if (this.optimistic.get(entityId)?.timer === timer) {
        this.optimistic.delete(entityId);
        this.requestUpdate();
      }
    }, 3000);
    this.optimistic.set(entityId, { state, timer });
    this.requestUpdate();
  }

  /** The state to draw: the expected one while it is pending, otherwise the reported one. */
  protected stateOf(view: EntityView): string {
    const pending = this.optimistic.get(view.id);
    if (!pending) return view.state;
    if (pending.state === view.state) {
      clearTimeout(pending.timer);
      this.optimistic.delete(view.id);
    }
    return pending.state;
  }

  /* ---------- helpers ---------- */

  protected entity(id: string | undefined = this.config?.entity): EntityView {
    return resolveEntity(this.hass, id);
  }

  /**
   * The name an entity is shown by: the `name` configured for it (the card's for its own entity, an item's for its),
   * else its own (`entityName`).
   */
  protected nameFor(view: EntityView, name: EntityName | undefined): string {
    return entityName(this.hass, view, name);
  }

  protected t(key: MessageKey, values?: Record<string, string | number>): string {
    return localize(this.hass, key, values);
  }

  /** Content width of a padded card (20 px sides): the measured width less the padding, whole pixels, so ticks land crisp. */
  protected get contentWidth(): number {
    return Math.max(0, this.width - 40);
  }

  protected call(
    domain: string,
    service: string,
    data: Record<string, unknown> = {},
    entityId: string | undefined = this.config?.entity,
  ): void {
    if (!this.hass) return;
    // a rejected call (offline, a bad entity) is Home Assistant's toast to show; the card must never throw
    this.hass
      .callService(domain, service, data, entityId ? { entity_id: entityId } : undefined)
      .catch(() => undefined);
  }

  protected tap(
    entityId: string | undefined = this.config?.entity,
    action: ActionConfig | undefined = this.config?.tap_action,
  ): void {
    if (this.hass) void runAction(this, this.hass, action, entityId);
  }

  /** A still press of 500 ms on the head: the `hold_action` (more-info by default), as a tap is the `tap_action`. */
  protected hold(
    entityId: string | undefined = this.config?.entity,
    action: ActionConfig | undefined = this.config?.hold_action,
  ): void {
    if (this.hass) void runAction(this, this.hass, action, entityId);
  }

  /** Rendered when the card has no config or no entity to show: one line and one glyph, never a blank box. */
  protected renderEmpty(message: string = this.t('common.no_entity')): TemplateResult {
    return html`<article class="fv-card fv-card--empty">
      <p class="fv-empty">${message}</p>
    </article>`;
  }

  protected abstract renderCard(): TemplateResult | typeof nothing;

  protected override render(): TemplateResult | typeof nothing {
    if (!this.config) return nothing;
    this.accents.begin();
    this.quietItems = false;
    return this.renderCard();
  }
}
