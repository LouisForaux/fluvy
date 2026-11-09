// every part of English first: the sheets define the families' cards themselves
import './english.js';
import { catalogue } from '@fluvy/cards';
import {
  ensureLanguage,
  fallbackCss,
  LIGHT_TINTS,
  lookRule,
  parseChartSettings,
  parseSavedSeries,
  parseSliderSettings,
  resolveLanguage,
  setCardDefaults,
  setChartDefaults,
  setLightDefaults,
  setSliderDefaults,
  type HomeAssistant,
  type Look,
} from '@fluvy/core';
import {
  DEFAULT_PALETTE,
  DEFAULT_PILL,
  DEFAULT_SHAPE,
  isPaletteName,
  isPillName,
  isShapeName,
  parseStatuses,
  STATUS_NAMES,
  statusesKey,
  type CustomBase,
  type FillStyle,
  type PillName,
  type PaletteCharacter,
} from '@fluvy/tokens/runtime';
import { setFallbackTokens, textWidth } from '@fluvy/ui';
import { pinClock } from './clock.js';
import { automaticFrames, automaticViews } from './automatic.js';
import { dashboardOptions, mountDashboard } from './dashboard.js';
import { defineIconStubs } from './ha-icons.js';
import { createHouse, mountFrame, type MountedCard } from './house.js';
import { mountActivity, type ActivityMoment } from './activity.js';
import { MOCK_PERIODS } from './collection.js';
import { mountHistory, type HistoryMoment } from './history.js';
import { mountPanel, PANEL_WS, type PanelState } from './panel.js';
import { cardsFor, mountWall, wallSettingsFor, type WallMoment } from './wall.js';
import { mountViewTheme } from './themes.js';
import { outOfReachView } from './out-of-reach.js';
import { loadFixture, SHEETS, type FrameSpec, type SheetSpec } from './scenes.js';

/**
 * ?sheet=home            which design sheet to mount (default: all; `measurer` the measurer's fixtures)
 * ?mode=dark             Home Assistant's dark mode + the dark token block
 * ?width=392             a frame's width: the section's, which a full card fills (a half card is (width − 16) / 2);
 *                        a frame with a width of its own keeps it
 * ?lang=es               UI language
 * ?clock=12             Home Assistant's 12-hour clock ("9:50 PM"; the house's time format)
 * ?theme=off             drop the theme tokens: the cards must fall back to their own
 * &fallback=mist           …and those are this palette's, the page wearing none (a dashboard without the look, #40)
 * ?palette=volt          a preset, applied by the live palette engine (the one the bundle runs)
 * ?shape=round           soft | round | crisp
 * ?accent=%23ff4a1a      a custom palette instead: &character=vivid &base=cool &fill=solid &highlight=%23e2ff3d
 * ?compare=linen,volt    the sheet once per palette, side by side (each column scoped to its palette)
 * ?template_delay=3000   how long the mock takes to answer a row's template, in ms (default 30: before the first paint)
 * ?period=week           the range the Energy date pickers' collections start on (today | yesterday | week | month)
 * ?lights=on            the house's defaults for lights (fluvy's settings → Look): a light card's tint (off | on |
 *                        always) where it says none; &bulbs=1 a lit light in its bulb's colour on tiles, rows, rooms
 * ?charts={"style":"soft"} the house's chart settings (fluvy's settings → Charts), as JSON: any of their fields, each
 *                        read as the settings read it (an unknown word is its default), and `sets` the saved series
 *                        colours (`[{"id":"warm","name":"Warm","colours":[six hexes]}]`, chosen by `series`)
 * ?opacity=80           the house's cards' surface (fluvy's settings → Appearance → Cards): how opaque every card is
 *                        that says none of its own, in 5 % steps; &blur=0 what shows through it unblurred
 * ?sliders={"style":"bar"} the house's slider settings (fluvy's settings → Appearance → Sliders), as JSON: the
 *                        style every slider is drawn in where a card says none (ruler | bar | liquid | fill) and the
 *                        words under a bar or a liquid (`"words":"none"`), each read as the settings read it
 * ?warning=%23dc630b     the house's status colours (fluvy's settings → Appearance), over the page's look (Linen where
 *                        it asks none): &danger= &success= &notice= the same; a frame may name its own (`statuses`)
 * ?panel=appearance      fluvy's settings panel (appearance | charts | scope | dashboard | wall | preferences);
 *                        &sheet= keeps a sheet's house beside it (&frames=none: a suite mounts its own cards in it)
 * &state=pending,guest     …at a moment of its own (see `PanelState` in panel.ts)
 * &nopopover=1             …in a browser without the Popover API (the dropdown's fixed fallback)
 * ?history=1             Fluvy's History page on a made-up house (&moment=week|month|states|many|empty|loading|sources|dates)
 * ?activity=1            Fluvy's Activity page on a made-up house (&live=0 without live entries,
 *                        &at=2026-09-17T21:47 the clock set to that moment, still running,
 *                        &card=1 its timeline on a card,
 *                        &moment=detail|burst|dates|sources|lights|week|nomatch|fresh|drop|loading|empty)
 * ?dashboard=home        a sheet's frames as a dashboard's view, under Home Assistant's header and its view tabs
 *                        (&tabs= &content= &tabtitle= &views= &icons= &edit= &subview= &scope= — see dashboard.ts)
 * ?dashboard=auto        the automatic dashboard's view (&view=home, its path), built by its own strategy from the
 *                        house of every sheet; `fluvyAutomaticView(path)` draws another in its place, as a tab does
 *                        (`fluvyAutomaticViews()` lists them)
 * ?frames=none           the house of the sheets asked for (every sheet's without `sheet`), none of their frames drawn:
 *                        a suite mounts its own cards in it (`fluvyCatalogue`, `fluvySheets`, `fluvyOutOfReach`)
 * ?viewtheme=Fluvy       the frames in a view Home Assistant themed (a dashboard's view, else the stage, as a section):
 *                        the look by the bundle's engine and its watch, Fluvy's theme file written on the view as Home
 *                        Assistant writes it (#72); &viewtheme=Sandstone the same file under another name;
 *                        &lookscope=dashboards the look on the dashboard alone (see themes.ts)
 */
const params = new URLSearchParams(location.search);
const dark = params.get('mode') === 'dark';
const width = Number(params.get('width') ?? 360);
const dashboard = params.get('dashboard');
/** The automatic dashboard: the house of every sheet, its views drawn in place of a sheet's frames. */
const automatic = dashboard === 'auto';
const only = automatic ? null : (dashboard ?? params.get('sheet'));
const language = params.get('lang') ?? 'en';
const clock = params.get('clock') === '12' ? '12' : undefined;
/** The house's status colours the URL asks for (none: every status the palette's). */
const statuses = parseStatuses(
  Object.fromEntries(STATUS_NAMES.map((name) => [name, params.get(name)])),
);
const tinted = statusesKey(statuses) !== '';

// a WebView without the top layer: the dropdown must place its menu itself
if (params.get('nopopover') === '1')
  Object.defineProperty(HTMLElement.prototype, 'showPopover', {
    value: undefined,
    configurable: true,
  });
document.documentElement.dataset['mode'] = dark ? 'dark' : 'light';
document.documentElement.lang = language;
// the language's words before anything is drawn: a screenshot never catches the English fallback
await ensureLanguage(resolveLanguage(language));
if (params.get('theme') === 'off') {
  delete document.documentElement.dataset['palette'];
  document.documentElement.style.setProperty('--fluvy-theme', 'initial');
  // a dashboard that does not wear the look, as Home Assistant draws it: no palette of ours on the page, and the cards'
  // own tokens the look of the house (the look engine puts it there) — not the generated Linen
  const fallback = params.get('fallback');
  if (fallback) {
    document.documentElement.style.setProperty('--fluvy-palette', 'initial');
    setFallbackTokens(
      fallbackCss(
        {
          palette: isPaletteName(fallback) ? fallback : 'linen',
          shape: 'soft',
          pills: 'round',
        },
        statuses,
      ),
    );
  }
} // 'initial' beats the stylesheet's :root value; '' would only drop the inline one

/** The look the URL asks for, or null to keep the generated lab tokens (Linen, Soft). */
function requestedLook(): Look | null {
  const palette = params.get('palette');
  const shape = params.get('shape');
  const pills = params.get('pills');
  const accent = params.get('accent');
  if (!palette && !shape && !pills && !accent && !tinted) return null;
  const custom = accent
    ? {
        character: (params.get('character') ?? 'vivid') as PaletteCharacter,
        base: (params.get('base') ?? 'neutral') as CustomBase,
        accent,
        fill: (params.get('fill') ?? 'tint') as FillStyle,
        ...(params.get('highlight') ? { highlight: params.get('highlight') as string } : {}),
      }
    : null;
  return {
    palette: custom ?? (isPaletteName(palette) ? palette : 'linen'),
    shape: isShapeName(shape) ? shape : 'soft',
    pills: isPillName(pills) ? pills : 'round',
  };
}
const look = requestedLook();
const viewTheme = params.get('viewtheme');
// a themed view's page wears the look by the bundle's engine (themes.ts)
if (look && !viewTheme) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(lookRule(look, dark ? 'dark' : 'light', ':root', true, statuses));
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  document.documentElement.dataset['look'] = '1';
}

// the house's defaults for lights, as fluvy's settings would hand them to every card
const houseTint = LIGHT_TINTS.find((tint) => tint === params.get('lights'));
if (houseTint || params.has('bulbs'))
  setLightDefaults({ tint: houseTint ?? 'off', colors: params.get('bulbs') === '1' });

// the house's chart settings, as fluvy's settings would hand them to every card
if (params.has('charts')) {
  const charts: unknown = (() => {
    try {
      return JSON.parse(params.get('charts') ?? '');
    } catch {
      return {};
    }
  })();
  setChartDefaults({
    settings: parseChartSettings(charts),
    sets: parseSavedSeries((charts as { sets?: unknown } | null)?.sets),
  });
}

// the house's cards' surface, as fluvy's settings would hand it to every card
if (params.has('opacity') || params.has('blur') || params.has('unavailable'))
  setCardDefaults(cardsFor(params));

// the house's slider settings, as fluvy's settings would hand them to every card
if (params.has('sliders'))
  setSliderDefaults(
    parseSliderSettings(
      (() => {
        try {
          return JSON.parse(params.get('sliders') ?? '') as unknown;
        } catch {
          return {};
        }
      })(),
    ),
  );

const activity = params.get('activity') === '1';
const history = params.get('history') === '1';
// the person's preference: the Activity page's timeline on a card
if (params.get('card') === '1') document.documentElement.setAttribute('fluvy-activity-card', '');
// the page's clock starts at `at` and runs on (screenshots of "today" that do not change with the day)
const at = params.get('at');
if (at) pinClock(at);
const panelTab = params.get('panel');
const panelStates = (params.get('state') ?? '').split(',').filter(Boolean) as PanelState[];
// the panel stands alone unless a sheet is named beside it; a fixture sheet is asked for by name
const fixture = only && !SHEETS[only] ? await loadFixture(only) : undefined;
const selected: Array<[string, SheetSpec]> =
  (panelTab && !only) || activity || history
    ? []
    : fixture && only
      ? [[only, fixture]]
      : Object.entries(SHEETS).filter(([name]) => !only || only === name);
const mock = createHouse(
  selected.map(([, sheet]) => sheet),
  {
    dark,
    language,
    clock,
    // the Energy date pickers' collections, on the range `?period=` names (today otherwise)
    period: MOCK_PERIODS.find((period) => period === params.get('period')),
    // &units=imperial (a sheet that stands alone in a house in °F and miles says so itself)
    units: params.get('units') === 'imperial' ? 'imperial' : undefined,
    templateDelay: params.has('template_delay') ? Number(params.get('template_delay')) : undefined,
    ws: panelTab ? PANEL_WS : undefined,
  },
);
/** Every card mounted, with the house its frame shows it. */
const cards: MountedCard[] = [];
mock.subscribe((hass: HomeAssistant) => {
  for (const { card, view } of cards) card.hass = view(hass);
});

const stage = document.getElementById('stage') as HTMLElement;
if (panelTab) mountPanel(stage, mock.hass(), panelTab, dark, panelStates);
if (history)
  mountHistory(
    stage,
    mock.hass(),
    language,
    params.get('live') !== '0',
    (params.get('moment') ?? undefined) as HistoryMoment | undefined,
  );
if (activity)
  mountActivity(
    stage,
    mock.hass(),
    language,
    params.get('live') !== '0',
    (params.get('moment') ?? undefined) as ActivityMoment | undefined,
  );
// the wall: this page as a wall panel over the sheet's frames (`?sheet=home&wall=1&moment=asleep`)
const wallMoment =
  params.get('wall') === '1' ? ((params.get('moment') ?? 'awake') as WallMoment) : undefined;
if (wallMoment)
  void mountWall(
    document,
    () => mock.hass(),
    dark,
    wallMoment,
    wallSettingsFor(params, wallMoment),
  );
const compare = (params.get('compare') ?? '').split(',').filter(isPaletteName);
const shape = params.get('shape');
/** Where the frames go: the stage, or one column per compared palette with its look scoped to it. */
const columns = dashboard
  ? [mountDashboard(stage, dashboardOptions(params), mock.hass())]
  : compare.length
    ? compare.map((palette) => {
        const column = document.createElement('div');
        column.className = 'pg-look';
        column.dataset['look'] = palette;
        const label = document.createElement('p');
        label.className = 'pg-look__name';
        label.textContent = palette;
        column.append(label);
        stage.append(column);
        return column;
      })
    : [stage];
if (compare.length) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    compare
      .map((palette) =>
        lookRule(
          {
            palette,
            shape: isShapeName(shape) ? shape : 'soft',
            pills: isPillName(params.get('pills')) ? (params.get('pills') as PillName) : 'round',
          },
          dark ? 'dark' : 'light',
          `[data-look="${palette}"]`,
          false,
          statuses,
        ),
      )
      .join(''),
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
/**
 * A frame in status colours of its own (`FrameSpec.statuses`): the look its column wears — a compared palette, the
 * URL's, else the generated Linen — in them, on the frame alone.
 */
const framesInStatuses = new CSSStyleSheet();
document.adoptedStyleSheets = [...document.adoptedStyleSheets, framesInStatuses];
const statusRules = new Set<string>();
function wearStatuses(
  frame: HTMLElement,
  own: NonNullable<FrameSpec['statuses']>,
  column: HTMLElement,
): void {
  const worn = parseStatuses({ ...statuses, ...own });
  const key = statusesKey(worn);
  frame.dataset['statuses'] = key;
  const palette = column.dataset['look'];
  const base = look ?? { palette: DEFAULT_PALETTE, shape: DEFAULT_SHAPE, pills: DEFAULT_PILL };
  const scope = palette ? `[data-look="${palette}"] ` : '';
  const rule = lookRule(
    isPaletteName(palette) ? { ...base, palette } : base,
    dark ? 'dark' : 'light',
    `${scope}[data-statuses="${key}"]`,
    false,
    worn,
  );
  if (statusRules.has(rule)) return;
  statusRules.add(rule);
  framesInStatuses.replaceSync([...statusRules].join(''));
}
const framed = params.get('frames') !== 'none' && !automatic;
for (const column of columns)
  for (const [name, sheet] of selected)
    for (const frame of framed ? sheet.frames : []) {
      const mounted = mountFrame(name, frame, mock.hass(), {
        width,
        wearStatuses: (el, own) => wearStatuses(el, own, column),
      });
      cards.push(...mounted.cards);
      column.append(mounted.el);
    }
if (viewTheme)
  await mountViewTheme(columns[0] ?? stage, {
    theme: viewTheme,
    look: look ?? { palette: DEFAULT_PALETTE, shape: DEFAULT_SHAPE, pills: DEFAULT_PILL },
    dark,
    statuses,
    dashboards: params.get('lookscope') === 'dashboards',
  });

/** Draws a view of the automatic dashboard in place of the one shown, its cards new, as a phone opens another tab. */
async function showAutomatic(path: string): Promise<void> {
  const column = columns[0] ?? stage;
  for (const frame of column.querySelectorAll(':scope > .pg-frame')) frame.remove();
  cards.length = 0;
  for (const frame of await automaticFrames(mock.hass(), path)) {
    const mounted = mountFrame('auto', frame, mock.hass(), { width });
    cards.push(...mounted.cards);
    column.append(mounted.el);
  }
}
if (automatic) await showAutomatic(params.get('view') ?? 'home');

// the mock and the shared text measurer, for the interaction tests; the cards, the sheets and a house with entities out
// of reach, for a suite that mounts its own; the automatic dashboard's views
Object.assign(window, {
  fluvyMock: mock,
  fluvyTextWidth: textWidth,
  // the house's defaults for lights changed in fluvy's settings: every card on the page draws again
  fluvyLightDefaults: setLightDefaults,
  // the house's cards' surface changed: every card wears it at once
  fluvyCardDefaults: setCardDefaults,
  fluvyCatalogue: catalogue,
  fluvySheets: SHEETS,
  fluvyOutOfReach: outOfReachView,
  fluvyAutomaticView: showAutomatic,
  fluvyAutomaticViews: () => automaticViews(mock.hass()),
});

defineIconStubs();
void document.fonts.ready.then(() =>
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.documentElement.dataset['ready'] = '1';
    }),
  ),
);
