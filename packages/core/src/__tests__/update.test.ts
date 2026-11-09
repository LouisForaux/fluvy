// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HomeAssistant } from '../ha/types.js';

/*
 * A page still running the Fluvy it loaded after the server moved to another build (#132): what tells it, what it
 * says, and when it reloads by itself.
 */

const OLD = '1.17.0-aaaaaaaa';
const NEW = '1.17.1-bbbbbbbb';
const panels = {
  lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
  fluvy: { component_name: 'custom', url_path: 'fluvy', title: 'Fluvy', icon: null },
};

/** The update module afresh (its page-wide state is the page's), with a stand-in Home Assistant serving `served` (none: no panel yet). */
async function setup(served: string | null) {
  vi.resetModules();
  const update = await import('../update.js');
  const ready = new Set<() => void>();
  const panelEvents = new Set<() => void>();
  const state: { served: string | null } = { served };
  const asked = { count: 0 };
  const hass = {
    language: 'en',
    panels,
    connection: {
      subscribeMessage: () => Promise.resolve(() => undefined),
      addEventListener: (_event: string, listener: () => void) => ready.add(listener),
      removeEventListener: (_event: string, listener: () => void) => ready.delete(listener),
      subscribeEvents: (callback: () => void, type?: string) => {
        if (type === 'panels_updated') panelEvents.add(callback);
        return Promise.resolve(() => undefined);
      },
    },
    callWS: (message: { type: string }) => {
      asked.count++;
      expect(message.type).toBe('get_panels');
      return Promise.resolve(
        state.served
          ? {
              ...panels,
              fluvy: {
                ...panels.fluvy,
                config: {
                  _panel_custom: { module_url: `/fluvy-frontend/${state.served}/loader.js` },
                },
              },
            }
          : { lovelace: panels.lovelace },
      );
    },
  } as unknown as HomeAssistant;
  const toasts: Record<string, unknown>[] = [];
  const app = document.createElement('home-assistant');
  app.addEventListener('hass-notification', (event) =>
    toasts.push((event as CustomEvent<Record<string, unknown>>).detail),
  );
  document.body.append(app);
  const replace = vi.fn();
  vi.spyOn(window.location, 'replace').mockImplementation(replace);
  return {
    update,
    hass: () => hass,
    toasts,
    replace,
    asked,
    serve: (build: string | null) => (state.served = build),
    reconnect: () => ready.forEach((listener) => listener()),
    panelsChanged: () => panelEvents.forEach((listener) => listener()),
  };
}

/** Lets the stand-in's answers and the toast's words land. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(0);
};

describe('a page left open through an update (#132)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/lovelace/0');
    sessionStorage.clear();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.replaceChildren();
    delete (window as { isDirtyState?: boolean }).isDirtyState;
  });

  it('reads a build off its URLs, and nothing off another path', async () => {
    const { buildOf } = await import('../update.js');
    expect(buildOf(`http://ha.example:8123/fluvy-frontend/${OLD}/chunks/core-x1.js`)).toBe(OLD);
    expect(buildOf(`/fluvy-frontend/${NEW}/loader.js`)).toBe(NEW);
    expect(buildOf('http://ha.example/local/fluvy/fluvy.js')).toBeUndefined();
    expect(buildOf('http://localhost:5183/src/main.ts')).toBeUndefined();
    expect(buildOf(undefined)).toBeUndefined();
  });

  it('tells a module that did not load from any other error, and from another file that did not', async () => {
    const { isFailedImport } = await import('../update.js');
    const own = `http://ha.example/fluvy-frontend/${OLD}/chunks/panel-B1.js`;
    expect(
      isFailedImport(new TypeError(`Failed to fetch dynamically imported module: ${own}`)),
    ).toBe(true);
    expect(isFailedImport(new TypeError(`error loading dynamically imported module: ${own}`))).toBe(
      true,
    );
    // Safari names no file
    expect(isFailedImport(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(
      isFailedImport(
        new TypeError(
          'Failed to fetch dynamically imported module: http://ha.example/hacsfiles/other/x.js',
        ),
      ),
    ).toBe(false);
    expect(isFailedImport(new Error('e.model.trim is not a function'))).toBe(false);
    expect(isFailedImport(undefined)).toBe(false);
  });

  it('says nothing while the server serves the page’s own build, and nothing off the integration’s path', async () => {
    const page = await setup(OLD);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    expect(page.asked.count).toBe(1);
    page.update.watchUpdates(undefined, page.hass);
    await settle();
    expect(page.asked.count).toBe(1);
    expect(page.toasts).toEqual([]);
  });

  it('asks again when the connection comes back and when the panels change, and says it once in Home Assistant’s toast', async () => {
    const page = await setup(OLD);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    page.serve(NEW);
    page.reconnect();
    await settle();
    expect(page.toasts).toHaveLength(1);
    expect(page.toasts[0]).toMatchObject({
      id: 'fluvy-update',
      message: 'Fluvy was updated',
      action: { text: 'Reload' },
      duration: -1,
      dismissable: true,
    });
    page.panelsChanged();
    page.reconnect();
    await settle();
    expect(page.toasts).toHaveLength(1);
  });

  it('waits for the panel to come back where Home Assistant is still starting', async () => {
    const page = await setup(null);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    expect(page.toasts).toEqual([]);
    page.serve(NEW);
    page.panelsChanged();
    await settle();
    expect(page.toasts).toHaveLength(1);
  });

  it('asks when a file of its own fails to load, caught or not', async () => {
    const page = await setup(OLD);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    page.serve(NEW);
    const failed = new TypeError(
      `Failed to fetch dynamically imported module: http://ha.example/fluvy-frontend/${OLD}/chunks/editor-C2.js`,
    );
    page.update.failedToLoad(new Error('something else'));
    await settle();
    expect(page.asked.count).toBe(1);
    page.update.failedToLoad(failed);
    await settle();
    expect(page.asked.count).toBe(2);
    expect(page.toasts).toHaveLength(1);
  });

  it('asks on a rejection nobody caught', async () => {
    const page = await setup(OLD);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    page.serve(NEW);
    const event = new Event('unhandledrejection') as Event & { reason: unknown };
    event.reason = new TypeError('Importing a module script failed.');
    window.dispatchEvent(event);
    await settle();
    expect(page.toasts).toHaveLength(1);
  });

  it('speaks the language Fluvy last spoke here', async () => {
    localStorage.setItem('fluvy:language', 'de');
    const page = await setup(NEW);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    expect(page.toasts[0]).toMatchObject({
      message: 'Fluvy wurde aktualisiert',
      action: { text: 'Neu laden' },
    });
  });

  it('reloads on Reload, past a cached page, and remembers the update it reloaded for', async () => {
    history.replaceState(null, '', '/config/integrations');
    const page = await setup(NEW);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    (page.toasts[0] as { action: { action: () => void } }).action.action();
    expect(page.replace).toHaveBeenCalledTimes(1);
    const url = new URL(page.replace.mock.calls[0]![0] as string);
    expect(url.pathname).toBe('/config/integrations');
    expect(url.searchParams.has('fluvy_reload')).toBe(true);
    expect(sessionStorage.getItem('fluvy:reloaded')).toBe(`${OLD}>${NEW}`);
  });

  it('reloads by itself once a dashboard has been left untouched for a minute with nothing to lose', async () => {
    const page = await setup(NEW);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    await vi.advanceTimersByTimeAsync(40_000);
    document.dispatchEvent(new Event('pointerdown'));
    await vi.advanceTimersByTimeAsync(55_000);
    expect(page.replace).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(page.replace).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('fluvy:reloaded')).toBe(`${OLD}>${NEW}`);
  });

  it('never reloads by itself over an edit, a dialog, an unsaved change or a sheet, nor off a dashboard', async () => {
    const cases: [string, () => () => void][] = [
      [
        'edit mode',
        () => {
          history.replaceState(null, '', '/lovelace/0?edit=1');
          return () => history.replaceState(null, '', '/lovelace/0');
        },
      ],
      [
        'a dialog',
        () => {
          history.replaceState({ dialog: 'ha-more-info-dialog' }, '', '/lovelace/0');
          return () => history.replaceState(null, '', '/lovelace/0');
        },
      ],
      [
        'unsaved',
        () => {
          (window as { isDirtyState?: boolean }).isDirtyState = true;
          return () => delete (window as { isDirtyState?: boolean }).isDirtyState;
        },
      ],
      [
        'a sheet',
        () => {
          const host = document.createElement('div');
          const dialog = host
            .attachShadow({ mode: 'open' })
            .appendChild(document.createElement('dialog'));
          const field = dialog.appendChild(document.createElement('input'));
          document.body.append(host);
          dialog.setAttribute('open', '');
          field.focus();
          return () => host.remove();
        },
      ],
      [
        'the settings panel',
        () => {
          history.replaceState(null, '', '/fluvy');
          return () => history.replaceState(null, '', '/lovelace/0');
        },
      ],
    ];
    for (const [name, hold] of cases) {
      const page = await setup(NEW);
      const release = hold();
      page.update.watchUpdates(OLD, page.hass);
      await settle();
      await vi.advanceTimersByTimeAsync(5 * 60_000);
      expect(page.replace, name).not.toHaveBeenCalled();
      release();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(page.replace, name).toHaveBeenCalledTimes(1);
      sessionStorage.clear();
      document.body.replaceChildren();
    }
  });

  it('reloads a wall left in its screensaver, its dialog no dialog of the kind', async () => {
    const page = await setup(NEW);
    const host = document.createElement('div');
    const dialog = host
      .attachShadow({ mode: 'open' })
      .appendChild(document.createElement('dialog'));
    dialog.setAttribute('data-idle', '');
    dialog.tabIndex = -1;
    document.body.append(host);
    dialog.setAttribute('open', '');
    dialog.focus();
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    await vi.advanceTimersByTimeAsync(70_000);
    expect(page.replace).toHaveBeenCalledTimes(1);
    host.remove();
  });

  it('asks once more for what came in while an answer was on its way', async () => {
    const page = await setup(OLD);
    const watch = page.update.watchUpdates(OLD, page.hass);
    await settle();
    expect(page.asked.count).toBe(1);
    // asked before the answer: the build the first answer says is old, the question that follows finds the new one
    watch.check();
    page.serve(NEW);
    watch.check();
    watch.check();
    await settle();
    expect(page.asked.count).toBe(3);
    expect(page.toasts).toHaveLength(1);
  });

  it('reloads by itself once per update: a reload that brought the same copy back only says so', async () => {
    sessionStorage.setItem('fluvy:reloaded', `${OLD}>${NEW}`);
    const page = await setup(NEW);
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(page.toasts).toHaveLength(1);
    expect(page.replace).not.toHaveBeenCalled();
  });

  it('never reloads by itself where the tab cannot remember that it did', async () => {
    const page = await setup(NEW);
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('blocked');
    });
    page.update.watchUpdates(OLD, page.hass);
    await settle();
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(page.toasts).toHaveLength(1);
    expect(page.replace).not.toHaveBeenCalled();
  });

  it('takes the reload’s mark off the address as the next copy starts', async () => {
    history.replaceState({ root: true }, '', '/lovelace/0?fluvy_reload=1730000000000&tab=2');
    const page = await setup(OLD);
    page.update.watchUpdates(OLD, page.hass);
    expect(location.pathname + location.search).toBe('/lovelace/0?tab=2');
    expect(history.state).toEqual({ root: true });
  });

  it('a newer copy that stands down asks a watching copy to look, or says it itself for an older one', async () => {
    const page = await setup(NEW);
    const check = vi.fn();
    page.update.standDown({ version: '1.17.0', update: { check } }, NEW, page.hass);
    expect(check).toHaveBeenCalledTimes(1);
    await settle();
    expect(page.toasts).toEqual([]);

    page.update.standDown({ version: '1.16.0' }, NEW, page.hass);
    await settle();
    expect(page.toasts).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(65_000);
    expect(sessionStorage.getItem('fluvy:reloaded')).toBe(`v1.16.0>${NEW}`);
  });

  it('a copy that stands down where the server serves another build says nothing', async () => {
    const page = await setup(NEW);
    page.update.standDown({ version: '1.16.0' }, OLD, page.hass);
    await settle();
    expect(page.toasts).toEqual([]);
  });
});
