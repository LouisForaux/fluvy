import {
  DEFAULT_PALETTE,
  DEFAULT_PILL,
  DEFAULT_SHAPE,
  isPaletteName,
  isPillName,
  isShapeName,
  parseCustomPalette,
  parsePaletteFile,
  parseStatuses,
  type PaletteChoice,
  type PaletteFile,
  type PillName,
  type ShapeName,
  type StatusColours,
} from '@fluvy/tokens/runtime';
import { THEME_NAME } from '@fluvy/tokens/config';
import type { Look } from '../look/css.js';
import {
  CHROME_DEFAULTS,
  parseChrome,
  parseTabs,
  TABS_DEFAULTS,
  type Chrome,
  type ViewTabs,
} from '../look/tabs.js';
import { isCardLanguage, type CardLanguage } from '../i18n/languages.js';
import {
  CHART_DEFAULTS,
  parseChartSettings,
  parseSavedSeries,
  type ChartSettings,
  type SavedSeries,
} from './charts.js';
import { parseSliderSettings, SLIDER_DEFAULTS, type SliderSettings } from './sliders.js';

/**
 * fluvy's settings, kept where Home Assistant keeps its own frontend settings: the house's in its system
 * data (written by an admin, read by everyone) and each person's in their user data, both under the key
 * `fluvy`. What is stored is parsed, never trusted: an unknown or broken field falls back to its default,
 * so a stored value from another version can never break the page.
 */

/** Where the look applies: the chosen dashboards only, or all of Home Assistant. */
export type Scope = 'dashboards' | 'everywhere';
export type Motion = 'system' | 'reduced';
export type { CardLanguage };

export const SETTINGS_KEY = 'fluvy';
/**
 * 3 since 1.11: the house keeps its chart settings and its saved sets of series colours (a 2 is read field by
 * field, each missing field its factory default — `classic` everywhere, so nothing on a dashboard changes). 2 since
 * 1.3: the house keeps its shared palettes and its wall settings. A 1.2 bundle reads a 2 as its own (it parses field
 * by field and ignores the rest) but a save from it drops what it does not know; from 2 on a save keeps every field
 * it does not know (`SettingsStore.saveHouse`). A field added since with a default that draws as before (1.15's
 * `cards`, 1.18's `sliders`) moves no version: a bundle without it draws its default and keeps it on save. Nor does
 * one added inside such a field (1.16's `cards.unavailable`): a 1.15 bundle draws it as its default, and a save of
 * the cards from it writes the default back.
 */
export const SETTINGS_VERSION = 3;

/** A palette saved to the house: a palette file as it was shared. */
export type SavedPalette = PaletteFile;
export const MAX_SAVED_PALETTES = 12;

/** When a wall is dark: always, as Home Assistant is, by the sun, or between two hours. */
export type WallTheme = 'dark' | 'follow' | 'sun' | 'hours';
/** The way out of a wall: a small button in the corner (a tap leaves), or a hidden hold of the corner (it pauses). */
export type WallExit = 'button' | 'hold';
/** The way back from a subview on a wall: a floating button with the view's title, or Home Assistant's header. */
export type WallSubview = 'button' | 'header';
export const WALL_AFTER = [0, 2, 5, 10, 30] as const;
export const WALL_NIGHT_DIM = [0, 20, 40, 60] as const;

/** When a light card shows its light's colour on its surface: never, while the light is on, or at rest too. */
export const LIGHT_TINTS = ['off', 'on', 'always'] as const;
export type LightTint = (typeof LIGHT_TINTS)[number];

/**
 * How a card looks while what it shows is out of reach (1.16, #126): `dashed`, the unavailable skin (the page's fill,
 * a dashed hairline, faded words, the ban glyph), as before; `quiet`, as it draws while off, its words saying so.
 */
export const UNAVAILABLE_LOOKS = ['dashed', 'quiet'] as const;
export type UnavailableLook = (typeof UNAVAILABLE_LOOKS)[number];

/**
 * The cards' surface, the house's for every card that says none of its own (1.15, #121): how opaque it is, in percent
 * (0 to 100 in steps of 5; 100 solid, as before), whether what shows through a see-through card is blurred, and how a
 * card out of reach looks (1.16, #126; dashed, as before).
 */
export interface CardSurface {
  readonly opacity: number;
  readonly blur: boolean;
  readonly unavailable: UnavailableLook;
}

/** How the house's wall panels behave (a device says it is one: `DeviceSettings`). */
export interface WallSettings {
  /** Dashboards (url paths) that are walls; empty: any dashboard that wears the look. */
  readonly dashboards: readonly string[];
  /** Minutes before the screensaver; 0 never. */
  readonly after: (typeof WALL_AFTER)[number];
  /** The clock on the screensaver. */
  readonly clock: boolean;
  /** The screensaver dims to black. */
  readonly dim: boolean;
  /** A `binary_sensor.` (motion, occupancy) that wakes the wall; '' none. */
  readonly wakeEntity: string;
  readonly theme: WallTheme;
  /** `hours`: when the night starts and ends, as `HH:MM`. */
  readonly from: string;
  readonly to: string;
  /** How much the wall darkens at night, in percent of black over it. */
  readonly nightDim: (typeof WALL_NIGHT_DIM)[number];
  /** The page colour alone, or the wall mesh. */
  readonly background: 'plain' | 'wall';
  /** How a person leaves the wall on the device. */
  readonly exit: WallExit;
  /** How a person comes back from a subview (Home Assistant's header is gone on a wall). */
  readonly subview: WallSubview;
}

/** What the house decides (an admin). */
export interface HouseSettings {
  readonly version: typeof SETTINGS_VERSION;
  readonly palette: PaletteChoice;
  readonly shape: ShapeName;
  readonly pills: PillName;
  /** How the dashboards that wear the look draw their view tabs. */
  readonly tabs: ViewTabs;
  /** The corner of every page: the sidebar's head, the hairlines, the header's surface. */
  readonly chrome: Chrome;
  readonly scope: Scope;
  /** Dashboards (url paths) that wear the look in the `dashboards` scope; empty: every `fluvy-…` dashboard. */
  readonly dashboards: readonly string[];
  /** The floating frame around the app on wide screens (`everywhere`). */
  readonly frame: boolean;
  /** Our icons in Home Assistant's own menus (the sidebar, Settings); false keeps Home Assistant's. */
  readonly icons: boolean;
  /** Our Activity view in place of Home Assistant's logbook page (where the look reaches it); false keeps Home Assistant's. */
  readonly activity: boolean;
  /** Our History view in place of Home Assistant's history page (where the look reaches it); false keeps Home Assistant's. */
  readonly history: boolean;
  /** The palettes the house keeps (shared files), up to twelve. */
  readonly palettes: readonly SavedPalette[];
  readonly wall: WallSettings;
  /** A light card's `tint` where the card says none (1.9). */
  readonly lightTint: LightTint;
  /** `light_colors` where a tile, a group of tiles, a room or a row of lights says none (1.9). */
  readonly lightColors: boolean;
  /** The statuses in colours of the house's own, over every palette (1.9); one left out is the palette's (Auto). */
  readonly statuses: StatusColours;
  /** How every chart and gauge is drawn where a card says nothing of its own (1.11). */
  readonly charts: ChartSettings;
  /** The house's own sets of six series colours, chosen in `charts.series` like a palette (1.11). */
  readonly chartSets: readonly SavedSeries[];
  /** Every card's surface where a card says none of its own (1.15). */
  readonly cards: CardSurface;
  /** How every slider is drawn where a card says nothing of its own (1.18, #144). */
  readonly sliders: SliderSettings;
}

/** What each person may choose for themselves. */
export interface PersonalSettings {
  readonly version: typeof SETTINGS_VERSION;
  /** Their own look instead of the house's; absent: the house's. */
  readonly palette?: PaletteChoice;
  readonly shape?: ShapeName;
  readonly pills?: PillName;
  readonly tabs?: ViewTabs;
  readonly chrome?: Chrome;
  readonly language: CardLanguage;
  readonly motion: Motion;
  readonly haptics: boolean;
  /** The Activity page's timeline on a card (like a dashboard's); false: on the page itself. */
  readonly activityCard: boolean;
}

/** The two layers resolved: what this person sees. */
export interface EffectiveSettings {
  readonly look: Look;
  /** Whether the look is this person's own rather than the house's. */
  readonly personalLook: boolean;
  readonly scope: Scope;
  readonly dashboards: readonly string[];
  readonly frame: boolean;
  readonly icons: boolean;
  readonly activity: boolean;
  readonly history: boolean;
  readonly language: CardLanguage;
  readonly motion: Motion;
  readonly haptics: boolean;
  readonly activityCard: boolean;
  /** How the house's walls behave (the device says whether this page is one). */
  readonly wall: WallSettings;
  readonly lightTint: LightTint;
  readonly lightColors: boolean;
  /** The house's status colours, worn over this person's palette too. */
  readonly statuses: StatusColours;
  readonly charts: ChartSettings;
  readonly chartSets: readonly SavedSeries[];
  readonly cards: CardSurface;
  readonly sliders: SliderSettings;
}

export const HOUSE_DEFAULTS: HouseSettings = {
  version: SETTINGS_VERSION,
  palette: DEFAULT_PALETTE,
  shape: DEFAULT_SHAPE,
  pills: DEFAULT_PILL,
  tabs: TABS_DEFAULTS,
  chrome: CHROME_DEFAULTS,
  scope: 'dashboards',
  dashboards: [],
  frame: true,
  icons: true,
  activity: true,
  history: true,
  palettes: [],
  wall: {
    dashboards: [],
    after: 10,
    clock: true,
    dim: false,
    wakeEntity: '',
    theme: 'follow',
    from: '22:00',
    to: '07:00',
    nightDim: 0,
    background: 'plain',
    exit: 'button',
    subview: 'button',
  },
  // the cards' keys new in 1.9 start where 1.8 drew them: no dashboard changes on upgrade
  lightTint: 'off',
  lightColors: false,
  // every status the palette's own, as before 1.9
  statuses: {},
  // every chart as 1.10 drew it (`classic`), until the house chooses a style
  charts: CHART_DEFAULTS,
  chartSets: [],
  // every card solid, as before 1.15; a see-through one blurs what shows through; one out of reach dashed, as before 1.16
  cards: { opacity: 100, blur: true, unavailable: 'dashed' },
  // every slider the ruler, as before 1.18, until the house chooses a style
  sliders: SLIDER_DEFAULTS,
};
export const WALL_DEFAULTS: WallSettings = HOUSE_DEFAULTS.wall;

export const PERSONAL_DEFAULTS: PersonalSettings = {
  version: SETTINGS_VERSION,
  language: 'auto',
  motion: 'system',
  haptics: true,
  activityCard: false,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const oneOf = <T extends string>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'string' && (options as readonly string[]).includes(value);
const oneOfNumbers = <T extends number>(value: unknown, options: readonly T[]): value is T =>
  typeof value === 'number' && (options as readonly number[]).includes(value);
const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A preset's name, or a well-formed custom palette; anything else is undefined. */
export function parsePalette(value: unknown): PaletteChoice | undefined {
  return isPaletteName(value) ? value : parseCustomPalette(value);
}

/** The house's saved palettes: the well-formed ones, the first of each name, twelve at most. */
export function parseSavedPalettes(value: unknown): SavedPalette[] {
  if (!Array.isArray(value)) return [];
  const out: SavedPalette[] = [];
  for (const raw of value) {
    const file = parsePaletteFile(raw);
    if (file && !out.some((kept) => kept.name === file.name)) out.push(file);
    if (out.length === MAX_SAVED_PALETTES) break;
  }
  return out;
}

/** The wall settings, field by field: anything missing or broken is the default. */
export function parseWall(raw: unknown): WallSettings {
  const value = isRecord(raw) ? raw : {};
  const d = WALL_DEFAULTS;
  const wake = value['wakeEntity'];
  return {
    dashboards: Array.isArray(value['dashboards'])
      ? value['dashboards'].filter((path): path is string => typeof path === 'string')
      : d.dashboards,
    after: oneOfNumbers(value['after'], WALL_AFTER) ? value['after'] : d.after,
    clock: typeof value['clock'] === 'boolean' ? value['clock'] : d.clock,
    dim: typeof value['dim'] === 'boolean' ? value['dim'] : d.dim,
    wakeEntity: typeof wake === 'string' && wake.startsWith('binary_sensor.') ? wake : d.wakeEntity,
    theme: oneOf(value['theme'], ['dark', 'follow', 'sun', 'hours'] as const)
      ? value['theme']
      : d.theme,
    from:
      typeof value['from'] === 'string' && CLOCK_TIME.test(value['from']) ? value['from'] : d.from,
    to: typeof value['to'] === 'string' && CLOCK_TIME.test(value['to']) ? value['to'] : d.to,
    nightDim: oneOfNumbers(value['nightDim'], WALL_NIGHT_DIM) ? value['nightDim'] : d.nightDim,
    background: oneOf(value['background'], ['plain', 'wall'] as const)
      ? value['background']
      : d.background,
    exit: oneOf(value['exit'], ['button', 'hold'] as const) ? value['exit'] : d.exit,
    subview: oneOf(value['subview'], ['button', 'header'] as const) ? value['subview'] : d.subview,
  };
}

/** The cards' surface, field by field: an opacity out of 0 to 100 or off its 5 % steps, or anything broken, is the default. */
export function parseCards(raw: unknown): CardSurface {
  const value = isRecord(raw) ? raw : {};
  const d = HOUSE_DEFAULTS.cards;
  const opacity = value['opacity'];
  return {
    opacity:
      typeof opacity === 'number' && opacity >= 0 && opacity <= 100 && opacity % 5 === 0
        ? opacity
        : d.opacity,
    blur: typeof value['blur'] === 'boolean' ? value['blur'] : d.blur,
    unavailable: oneOf(value['unavailable'], UNAVAILABLE_LOOKS)
      ? value['unavailable']
      : d.unavailable,
  };
}

export function parseHouse(raw: unknown): HouseSettings {
  const value = isRecord(raw) ? raw : {};
  const d = HOUSE_DEFAULTS;
  return {
    version: SETTINGS_VERSION,
    palette: parsePalette(value['palette']) ?? d.palette,
    shape: isShapeName(value['shape']) ? value['shape'] : d.shape,
    pills: isPillName(value['pills']) ? value['pills'] : d.pills,
    tabs: parseTabs(value['tabs']) ?? d.tabs,
    chrome: parseChrome(value['chrome']) ?? d.chrome,
    scope: oneOf(value['scope'], ['dashboards', 'everywhere'] as const) ? value['scope'] : d.scope,
    dashboards: Array.isArray(value['dashboards'])
      ? value['dashboards'].filter((path): path is string => typeof path === 'string')
      : d.dashboards,
    frame: typeof value['frame'] === 'boolean' ? value['frame'] : d.frame,
    icons: typeof value['icons'] === 'boolean' ? value['icons'] : d.icons,
    activity: typeof value['activity'] === 'boolean' ? value['activity'] : d.activity,
    history: typeof value['history'] === 'boolean' ? value['history'] : d.history,
    palettes: parseSavedPalettes(value['palettes']),
    wall: parseWall(value['wall']),
    lightTint: oneOf(value['lightTint'], LIGHT_TINTS) ? value['lightTint'] : d.lightTint,
    lightColors: typeof value['lightColors'] === 'boolean' ? value['lightColors'] : d.lightColors,
    statuses: parseStatuses(value['statuses']),
    charts: parseChartSettings(value['charts']),
    chartSets: parseSavedSeries(value['chartSets']),
    cards: parseCards(value['cards']),
    sliders: parseSliderSettings(value['sliders']),
  };
}

export function parsePersonal(raw: unknown): PersonalSettings {
  const value = isRecord(raw) ? raw : {};
  const d = PERSONAL_DEFAULTS;
  const palette = parsePalette(value['palette']);
  const tabs = parseTabs(value['tabs']);
  const chrome = parseChrome(value['chrome']);
  return {
    version: SETTINGS_VERSION,
    ...(palette ? { palette } : {}),
    ...(isShapeName(value['shape']) ? { shape: value['shape'] } : {}),
    ...(isPillName(value['pills']) ? { pills: value['pills'] } : {}),
    ...(tabs ? { tabs } : {}),
    ...(chrome ? { chrome } : {}),
    language: isCardLanguage(value['language']) ? value['language'] : d.language,
    motion: oneOf(value['motion'], ['system', 'reduced'] as const) ? value['motion'] : d.motion,
    haptics: typeof value['haptics'] === 'boolean' ? value['haptics'] : d.haptics,
    activityCard:
      typeof value['activityCard'] === 'boolean' ? value['activityCard'] : d.activityCard,
  };
}

/** The house's settings with this person's on top: their own look replaces the house's as a whole. */
export function resolveSettings(
  house: HouseSettings,
  personal: PersonalSettings,
): EffectiveSettings {
  const own = personal.palette !== undefined;
  return {
    look: {
      palette: personal.palette ?? house.palette,
      shape: own ? (personal.shape ?? house.shape) : house.shape,
      pills: own ? (personal.pills ?? house.pills) : house.pills,
      tabs: own ? (personal.tabs ?? house.tabs) : house.tabs,
      chrome: own ? (personal.chrome ?? house.chrome) : house.chrome,
    },
    personalLook: own,
    scope: house.scope,
    dashboards: house.dashboards,
    frame: house.frame,
    icons: house.icons,
    activity: house.activity,
    history: house.history,
    language: personal.language,
    motion: personal.motion,
    haptics: personal.haptics,
    activityCard: personal.activityCard,
    wall: house.wall,
    lightTint: house.lightTint,
    lightColors: house.lightColors,
    statuses: house.statuses,
    charts: house.charts,
    chartSets: house.chartSets,
    cards: house.cards,
    sliders: house.sliders,
  };
}

/** Whether a dashboard wears the look in the `dashboards` scope. */
export function wearsLook(
  settings: Pick<EffectiveSettings, 'dashboards'>,
  urlPath: string | undefined,
): boolean {
  if (!urlPath) return false;
  return settings.dashboards.length
    ? settings.dashboards.includes(urlPath)
    : urlPath.startsWith('fluvy');
}

/**
 * The scope a page applies. "Everywhere" holds while Home Assistant's own theme for this person is Fluvy (their
 * profile's, or the house's default): a person who picks another theme keeps it on every Home Assistant page, and the
 * look stays on Fluvy's dashboards, as with "only dashboards". Before Home Assistant says which theme it wears (the
 * first paint), the setting is taken as it is.
 */
export function pageScope(scope: Scope, theme: string | undefined): Scope {
  return scope === 'everywhere' && theme && theme !== THEME_NAME ? 'dashboards' : scope;
}
