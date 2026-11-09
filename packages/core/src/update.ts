import { fireEvent } from './actions.js';
import type { HomeAssistant } from './ha/types.js';
import { ensureLanguage, rememberedLanguage, resolveLanguage, wordsIn } from './i18n/index.js';
import { appHass, connected } from './look/start.js';
import { isLovelace, urlPathOf, USE_EVENTS } from './pages.js';
import { safeSession } from './storage.js';

/*
 * After an update, a page still running the Fluvy it loaded. The integration serves each build from a folder of its
 * own (`/fluvy-frontend/<version>-<stamp>/`), and once Home Assistant restarts on a new one the old folder is gone:
 * whatever this copy has not fetched yet (an editor, a sheet, the settings panel, a language) cannot load any more.
 * The page asks which build the server serves (the folder of the settings panel's module, which the integration
 * registers at the build's URL) as it connects, when the connection comes back (the restart an update takes), when
 * Home Assistant's panels change and when a file of its own fails to load. Another build: it says so in Home
 * Assistant's own toast, "Fluvy was updated · Reload", and reloads by itself once, when nothing on the page can be
 * lost and nobody has touched it for a minute.
 */

/**
 * What a page that reloads for an update adds to its address, so a page Home Assistant's service worker holds is not
 * answered from its cache; the next copy takes it off.
 */
const RELOAD_PARAM = 'fluvy_reload';
/** The update this tab last reloaded for (`<the page's build>><the server's>`): it is never tried twice. */
const RELOADED_KEY = 'fluvy:reloaded';
/** Home Assistant shows one toast of an id: the running copy's and the new copy's are one. */
const TOAST_ID = 'fluvy-update';
/** How long nobody touches the page before it reloads by itself. */
const UNTOUCHED_MS = 60_000;
/** How often a page waiting to reload looks again. */
const LOOK_MS = 5_000;

/** A failed fetch of a module, as Chromium, Firefox and Safari word it. */
const FAILED_IMPORT = /dynamically imported module|importing a module script failed/i;

/** The folder a build is served from (`1.17.0-ab12cd34`), read off one of its URLs; none off the integration's path. */
export const buildOf = (url: string | undefined): string | undefined =>
  url ? /\/fluvy-frontend\/([^/?#]+)\//.exec(url)?.[1] : undefined;

/** A module that did not load, Fluvy's own or one the browser does not name (never another file it names). */
export function isFailedImport(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return (
    FAILED_IMPORT.test(message) &&
    (!message.includes('://') || message.includes('/fluvy-frontend/'))
  );
}

type Panels = Record<string, { config?: { _panel_custom?: { module_url?: unknown } } | null }>;

/** The build the server serves now, by its settings panel's module; undefined where it cannot be asked. */
async function servedBuild(hass: HomeAssistant): Promise<string | undefined> {
  try {
    const panels = await hass.callWS<Panels>({ type: 'get_panels' });
    const url = panels.fluvy?.config?._panel_custom?.module_url;
    return typeof url === 'string' ? buildOf(url) : undefined;
  } catch {
    return undefined;
  }
}

/** Whether this tab already reloaded for `update`; undefined where it cannot remember (then it never reloads by itself). */
function reloadedFor(update: string): boolean | undefined {
  try {
    const session = safeSession();
    return session ? session.getItem(RELOADED_KEY) === update : undefined;
  } catch {
    return undefined;
  }
}

/** Loads the page again for `update`, past a cached copy of the page, remembering it did. */
function reload(update: string): void {
  try {
    safeSession()?.setItem(RELOADED_KEY, update);
  } catch {
    // not remembered: a person's own tap reloads all the same
  }
  const url = new URL(location.href);
  url.searchParams.set(RELOAD_PARAM, String(Date.now()));
  location.replace(url.href);
}

/**
 * Nothing on the page can be lost to a reload: a dashboard out of edit mode, no dialog of Home Assistant's open (its
 * dialogs mark the history entry they open on), no change unsaved (its editors say so on the window), no dialog or
 * sheet of a card's holding the focus. A wall's own screensaver is no dialog of the kind (`data-idle`): a wall left in
 * it comes back on the new build overnight, where it would wait for a first touch.
 */
function nothingToLose(hass: HomeAssistant | undefined): boolean {
  if (!isLovelace(hass?.panels, urlPathOf(location.pathname))) return false;
  if (new URLSearchParams(location.search).has('edit')) return false;
  if ((history.state as { dialog?: unknown } | null)?.dialog) return false;
  if ((window as { isDirtyState?: boolean }).isDirtyState) return false;
  for (let at = document.activeElement; at; at = at.shadowRoot?.activeElement ?? null)
    if (at.closest('dialog[open]:not([data-idle])')) return false;
  return true;
}

/** The update this page has offered: one toast, one wait to reload. */
let offered: string | undefined;

/**
 * Says that the page runs `running` where the server serves `served`: Home Assistant's toast, in the language Fluvy
 * last spoke here, with Reload; and, once per update and tab, the page reloads by itself when nothing can be lost and
 * nobody has touched it for a minute.
 */
function offer(running: string, served: string, hass: () => HomeAssistant | undefined): void {
  const update = `${running}>${served}`;
  if (offered === update) return;
  offered = update;
  const code = rememberedLanguage() ?? resolveLanguage(hass()?.language);
  void ensureLanguage(code).then(() => {
    const app = document.querySelector('home-assistant');
    if (!app) return;
    const say = wordsIn(code);
    fireEvent(app, 'hass-notification', {
      id: TOAST_ID,
      message: say('common.fluvy_updated'),
      action: { text: say('common.reload'), action: () => reload(update) },
      duration: -1,
      dismissable: true,
    });
  });
  if (reloadedFor(update) !== false) return;
  let touched = Date.now();
  const touch = (): void => {
    touched = Date.now();
  };
  for (const type of USE_EVENTS)
    document.addEventListener(type, touch, { capture: true, passive: true });
  const timer = setInterval(() => {
    if (Date.now() - touched < UNTOUCHED_MS || !nothingToLose(hass())) return;
    clearInterval(timer);
    reload(update);
  }, LOOK_MS);
}

/** The page's watch for another build on the server: what a newer copy that stands down asks. */
export interface UpdateWatch {
  /** Asks which build the server serves; another than the page's, the page says so. */
  check(): void;
}

let watch: UpdateWatch | undefined;

/**
 * Watches for the server to serve another build than `own`, the page's (the folder its files came from): asked as the
 * page connects, when the connection comes back, when Home Assistant's panels change and when a file of its own fails
 * to load. Off the integration's path (the playground, a test page) there is nothing to watch. A page reloaded for an
 * update drops the address's mark at once.
 */
export function watchUpdates(
  own: string | undefined,
  hass: () => HomeAssistant | undefined = appHass,
): UpdateWatch {
  const url = new URL(location.href);
  if (url.searchParams.has(RELOAD_PARAM)) {
    url.searchParams.delete(RELOAD_PARAM);
    history.replaceState(history.state, '', url.href);
  }
  let asking = false;
  // what is asked while another answer is on its way may be what changed it (`panels_updated` beside a `get_panels`
  // from before the new panel): one more question follows the answer
  let again = false;
  const check = (): void => {
    const app = hass();
    if (!own || offered || !app) return;
    if (asking) {
      again = true;
      return;
    }
    asking = true;
    void servedBuild(app).then((served) => {
      asking = false;
      if (served && served !== own) offer(own, served, hass);
      if (again) {
        again = false;
        check();
      }
    });
  };
  watch = { check };
  if (own) {
    window.addEventListener('unhandledrejection', (event) => {
      if (isFailedImport(event.reason)) check();
    });
    void connected(hass).then((app) => {
      if (!app) return;
      app.connection.addEventListener?.('ready', check);
      // Home Assistant's own frontend subscribes to it for every person; refused, the other moments still ask
      app.connection.subscribeEvents?.(check, 'panels_updated').catch(() => undefined);
      check();
    });
  }
  return watch;
}

/** A file of the page's own that did not load where something caught it (Home Assistant awaits a card's editor). */
export function failedToLoad(error: unknown): void {
  if (isFailedImport(error)) watch?.check();
}

/**
 * A newer copy that found an older one running: one that watches (1.17 on) is asked to look; an older one cannot,
 * and this copy says so itself where the server serves it, `own`.
 */
export function standDown(
  running: { readonly version: string; readonly update?: UpdateWatch },
  own: string | undefined,
  hass: () => HomeAssistant | undefined = appHass,
): void {
  if (running.update) {
    running.update.check();
    return;
  }
  if (!own) return;
  void connected(hass).then(async (app) => {
    if (app && (await servedBuild(app)) === own) offer(`v${running.version}`, own, hass);
  });
}
