// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  paletteOf,
  SettingsStore,
  type EffectiveSettings,
  type HomeAssistant,
  type LookHandle,
  type SettingsHass,
  TABS_DEFAULTS,
  CHROME_DEFAULTS,
  CHART_DEFAULTS,
} from '@fluvy/core';
import { exportSettings, importPalette, importSettings } from './actions.js';
import { COMMUNITY_PALETTES } from '@fluvy/tokens/community';
import type { PanelContext } from './model.js';
import type { FluvyPanel } from './panel.js';

/** A Home Assistant that keeps fluvy's settings in memory and answers the panel's dashboard questions. */
function fixture(admin = true, extra: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { system: null, user: null };
  const subscribers: Record<string, Set<(message: { value: unknown }) => void>> = {
    system: new Set(),
    user: new Set(),
  };
  const layer = (type: string) => (type.includes('system') ? 'system' : 'user');
  const written: { type: string; value: unknown }[] = [];
  const storage = {
    connection: {
      subscribeMessage: async (
        callback: (m: { value: unknown }) => void,
        message: { type: string },
      ) => {
        subscribers[layer(message.type)]!.add(callback);
        callback({ value: data[layer(message.type)] });
        return () => undefined;
      },
    },
    callWS: async (message: { type: string; value: unknown }) => {
      written.push(message);
      data[layer(message.type)] = message.value;
      for (const listener of subscribers[layer(message.type)]!) listener({ value: message.value });
    },
  } as unknown as SettingsHass;
  const store = new SettingsStore(() => storage, undefined);
  const listeners = new Set<(settings: EffectiveSettings) => void>();
  const previews: unknown[] = [];
  const handle: LookHandle = {
    store,
    settings: () => store.effective,
    preview: (look) => void previews.push(look),
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setWall: () => undefined,
    stop: () => undefined,
  };
  store.start((settings) => listeners.forEach((listener) => listener(settings)));
  const hass = {
    language: 'en',
    locale: { language: 'en' },
    themes: { darkMode: false },
    states: {},
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', name: 'U', is_admin: admin },
    config: { unit_system: { temperature: '°C', length: 'km' }, time_zone: 'Europe/Madrid' },
    callService: async () => undefined,
    panels: {
      lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
      'fluvy-auto': {
        component_name: 'lovelace',
        url_path: 'fluvy-auto',
        title: 'Fluvy auto',
        icon: 'fluvy:sun',
      },
    },
    localize: (key: string) => key,
    callWS: async (message: { type: string; url_path?: string | null }) =>
      message.type === 'lovelace/config' && message.url_path === 'fluvy-auto'
        ? { strategy: { type: 'custom:fluvy-home' } }
        : { views: [] },
    formatEntityState: (s: { state: string }) => s.state,
    ...extra,
  } as unknown as HomeAssistant;
  return { handle, hass, written, previews };
}

async function mount(admin = true, extra: Record<string, unknown> = {}) {
  await import('./define.js');
  const f = fixture(admin, extra);
  const panel = document.createElement('fluvy-panel') as HTMLElement & {
    hass: HomeAssistant;
    handle: LookHandle;
    tab: string;
    updateComplete: Promise<boolean>;
  };
  panel.handle = f.handle;
  panel.hass = f.hass;
  document.body.append(panel);
  await panel.updateComplete;
  const root = panel.shadowRoot!;
  const swatch = (name: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('.pn-swatch')].find(
      (b) => b.querySelector('.pn-swatch__name')?.textContent?.trim() === name,
    )!;
  const button = (text: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('.pn-bar button')].find(
      (b) => b.textContent?.trim() === text,
    );
  const row = (title: string) =>
    [...root.querySelectorAll<HTMLElement>('.fv-row')].find(
      (r) => r.querySelector('.fv-row__title')?.textContent?.trim() === title,
    );
  const chip = (text: string) =>
    [...root.querySelectorAll<HTMLElement>('.fv-chip')].find((c) => c.textContent?.trim() === text);
  /** Opens the tab's dropdown and chooses the row with this name, as a finger would. */
  const pick = async (name: string) => {
    const select = root.querySelector('fluvy-select')!;
    const inside = select.shadowRoot!;
    inside.querySelector<HTMLButtonElement>('.fv-select')!.click();
    await select.updateComplete;
    [...inside.querySelectorAll<HTMLElement>('.fv-menu__item')]
      .find((r) => r.querySelector('.fv-menu__name')?.textContent?.trim() === name)!
      .click();
    await select.updateComplete;
  };
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
  };
  return { ...f, panel, root, swatch, button, row, chip, pick, settle };
}

describe('the settings panel', () => {
  it('shows the house’s look chosen, and a picked palette as pending until it is applied', async () => {
    const { panel, root, swatch, written } = await mount();
    expect(swatch('Linen').classList.contains('is-active')).toBe(true);
    expect(root.querySelector('.pn-bar')).toBeNull();
    swatch('Volt').click();
    await panel.updateComplete;
    expect(swatch('Volt').classList.contains('is-active')).toBe(true);
    expect(root.querySelector('.pn-bar')).not.toBeNull();
    expect(written).toEqual([]);
    panel.remove();
  });

  it('applies the chosen look to the house', async () => {
    const { panel, swatch, button, written, handle } = await mount();
    swatch('Blaze').click();
    await panel.updateComplete;
    button('Apply to the house')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(written.at(-1)?.type).toBe('frontend/set_system_data');
    expect(handle.settings().look.palette).toBe('blaze');
    panel.remove();
  });

  it('names the change it would apply, and keeps offering it on every tab', async () => {
    const { panel, root, swatch } = await mount();
    swatch('Volt').click();
    await panel.updateComplete;
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Linen → Volt');
    panel.tab = 'preferences';
    await panel.updateComplete;
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Linen → Volt');
    panel.remove();
  });

  it('wears the look being chosen on the whole panel', async () => {
    const { panel, root, swatch } = await mount();
    const accent = () =>
      [...(root as ShadowRoot).adoptedStyleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .map((rule) => rule.cssText)
        .find((text) => /^:host\s*\{/.test(text) && text.includes('--fluvy-accent:'));
    const before = accent();
    swatch('Blaze').click();
    await panel.updateComplete;
    expect(accent()).toBeDefined();
    expect(accent()).not.toBe(before);
    panel.remove();
  });

  it('offers a person who is not an admin one way to apply: for themselves', async () => {
    const { panel, swatch, button } = await mount(false);
    swatch('Mint').click();
    await panel.updateComplete;
    expect(button('Apply to the house')).toBeUndefined();
    expect(button('Only for me')).toBeUndefined();
    expect(button('Apply for me')?.classList.contains('fv-btn--accent')).toBe(true);
    panel.remove();
  });

  it('tells someone who is not an admin the truth about the dashboards', async () => {
    const { panel, root, row } = await mount(false);
    panel.tab = 'dashboard';
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
    // the house's home dashboard as it is; the templates it does not have, said plainly and without a button
    expect(row('Fluvy auto')?.textContent).not.toContain('Not created yet');
    expect(row('Rooms')?.textContent).toContain('Not created yet');
    expect(row('Rooms')?.querySelector('.fv-row__btn')).toBeNull();
    expect(root.textContent).not.toContain('Create');
    panel.tab = 'scope';
    await panel.updateComplete;
    // their own Overview under its Home Assistant name, and the automatic dashboard, as they are: a switch they may
    // only look at, read-only at full strength (not the disabled skin of one out of reach)
    expect(row('Overview')).toBeDefined();
    const fixed = row('Fluvy auto')?.querySelector('.fv-switch');
    expect(fixed?.getAttribute('aria-readonly')).toBe('true');
    expect(fixed?.getAttribute('aria-disabled')).toBe('false');
    expect(fixed?.closest('.fv-hit')?.classList.contains('is-fixed')).toBe(true);
    panel.tab = 'dashboard';
    await panel.updateComplete;
    // the sidebar switch is an administrator's
    expect(row('Show in the sidebar')).toBeUndefined();
    panel.remove();
  });

  it('lists the automatic dashboard in the sidebar, or takes its entry out', async () => {
    const updates: Record<string, unknown>[] = [];
    const { panel, row, settle } = await mount(true, {
      callWS: async (message: { type: string; url_path?: string | null }) => {
        if (message.type === 'lovelace/dashboards/update') {
          updates.push(message);
          return {};
        }
        if (message.type === 'lovelace/dashboards/list') {
          return [
            {
              id: 'fluvy_auto',
              url_path: 'fluvy-auto',
              title: 'Fluvy auto',
              icon: 'fluvy:sun',
              show_in_sidebar: updates.length === 0,
            },
          ];
        }
        return message.type === 'lovelace/config' && message.url_path === 'fluvy-auto'
          ? { strategy: { type: 'custom:fluvy-home' } }
          : { views: [] };
      },
    });
    panel.tab = 'dashboard';
    await settle();
    const sidebar = row('Show in the sidebar')!;
    expect(sidebar.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    sidebar.querySelector<HTMLElement>('.fv-hit')!.click();
    await settle();
    await settle();
    expect(updates).toEqual([
      { type: 'lovelace/dashboards/update', dashboard_id: 'fluvy_auto', show_in_sidebar: false },
    ]);
    // the list answers again, and the row shows it
    expect(
      row('Show in the sidebar')?.querySelector('.fv-switch')?.getAttribute('aria-checked'),
    ).toBe('false');
    panel.remove();
  });

  it('creates a template’s dashboard with one tap: the dashboard, then its bare strategy, then the list again', async () => {
    const calls: Record<string, unknown>[] = [];
    let made = false;
    const { panel, row, settle } = await mount(true, {
      callWS: async (message: { type: string; url_path?: string | null }) => {
        if (
          message.type === 'lovelace/dashboards/create' ||
          message.type === 'lovelace/config/save'
        ) {
          calls.push(message);
          if (message.type === 'lovelace/config/save') made = true;
          return {};
        }
        if (message.type === 'lovelace/dashboards/list') return [];
        if (message.type === 'lovelace/config')
          return message.url_path === 'fluvy-auto'
            ? { strategy: { type: 'custom:fluvy-home' } }
            : message.url_path === 'fluvy-energy' && made
              ? { strategy: { type: 'custom:fluvy-energy' } }
              : { views: [] };
        return { views: [] };
      },
    });
    panel.tab = 'dashboard';
    await settle();
    const energy = row('Energy')!;
    expect(energy.querySelector('.fv-row__btn')?.textContent?.trim()).toBe('Create');
    energy.click();
    await settle();
    await settle();
    expect(calls).toEqual([
      {
        type: 'lovelace/dashboards/create',
        url_path: 'fluvy-energy',
        title: 'Fluvy · Energy',
        icon: 'fluvy:bolt',
        show_in_sidebar: true,
        require_admin: false,
        mode: 'storage',
      },
      {
        type: 'lovelace/config/save',
        url_path: 'fluvy-energy',
        config: { strategy: { type: 'custom:fluvy-energy' } },
      },
    ]);
    // once Home Assistant lists it, the row opens it and its options card appears
    panel.hass = {
      ...panel.hass,
      panels: {
        ...panel.hass.panels,
        'fluvy-energy': {
          component_name: 'lovelace',
          url_path: 'fluvy-energy',
          title: 'Fluvy · Energy',
          icon: 'fluvy:bolt',
        },
      },
    } as HomeAssistant;
    await settle();
    await settle();
    expect(row('Fluvy · Energy')?.querySelector('.fv-row__chevron')).not.toBeNull();
    expect(row('Production')?.querySelector('.fv-switch')).not.toBeNull();
    panel.remove();
  });

  it('edits each dashboard’s options apart and saves them with one Apply; Recreate takes two taps', async () => {
    const saved: { type: string; url_path?: string; config?: unknown }[] = [];
    const { panel, root, row, chip, button, settle } = await mount(true, {
      panels: {
        lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
        'fluvy-auto': {
          component_name: 'lovelace',
          url_path: 'fluvy-auto',
          title: 'Fluvy auto',
          icon: 'fluvy:sun',
        },
        'fluvy-security': {
          component_name: 'lovelace',
          url_path: 'fluvy-security',
          title: 'Fluvy · Security',
          icon: 'fluvy:shield',
        },
      },
      callWS: async (message: { type: string; url_path?: string | null; config?: unknown }) => {
        if (message.type === 'lovelace/config/save') {
          saved.push(message as never);
          return {};
        }
        if (message.type === 'lovelace/dashboards/list') return [];
        if (message.type === 'lovelace/config')
          return message.url_path === 'fluvy-auto'
            ? { strategy: { type: 'custom:fluvy-home' } }
            : message.url_path === 'fluvy-security'
              ? { strategy: { type: 'custom:fluvy-security', camera_refresh: 30 } }
              : { views: [] };
        return { views: [] };
      },
    });
    panel.tab = 'dashboard';
    await settle();
    // the security dashboard's own chips: 30 s chosen as saved; the home's thermostats untouched
    expect(chip('30 s')?.classList.contains('is-active')).toBe(true);
    chip('Ruler')!.click();
    chip('5 s')!.click();
    await settle();
    // two dashboards edited: the bar counts them and saves both
    expect(root.querySelector('.pn-bar')?.textContent).toContain('2 changes');
    button('Save')!.click();
    await settle();
    await settle();
    expect(saved).toEqual([
      {
        type: 'lovelace/config/save',
        url_path: 'fluvy-auto',
        config: { strategy: { type: 'custom:fluvy-home', thermostat_variant: 'ruler' } },
      },
      {
        type: 'lovelace/config/save',
        url_path: 'fluvy-security',
        config: { strategy: { type: 'custom:fluvy-security' } },
      },
    ]);
    // Recreate: the first tap arms the row, the second writes the bare strategy
    const recreate = [...root.querySelectorAll<HTMLElement>('.fv-row')].filter(
      (r) => r.querySelector('.fv-row__title')?.textContent?.trim() === 'Start over',
    );
    expect(recreate.length).toBe(2);
    recreate[1]!.click();
    await settle();
    expect(row('Tap again')).toBeDefined();
    expect(saved.length).toBe(2);
    row('Tap again')!.click();
    await settle();
    await settle();
    expect(saved.at(-1)).toEqual({
      type: 'lovelace/config/save',
      url_path: 'fluvy-security',
      config: { strategy: { type: 'custom:fluvy-security' } },
    });
    panel.remove();
  });

  it('offers a dashboard’s long lists shortened or in full, its own caps kept until in full is chosen (#78)', async () => {
    const saved: { type: string; url_path?: string; config?: unknown }[] = [];
    const { panel, root, chip, button, settle } = await mount(true, {
      panels: {
        'fluvy-auto': {
          component_name: 'lovelace',
          url_path: 'fluvy-auto',
          title: 'Fluvy auto',
          icon: 'fluvy:sun',
        },
      },
      callWS: async (message: { type: string; url_path?: string | null; config?: unknown }) => {
        if (message.type === 'lovelace/config/save') {
          saved.push(message as never);
          return {};
        }
        if (message.type === 'lovelace/dashboards/list') return [];
        if (message.type === 'lovelace/config' && message.url_path === 'fluvy-auto')
          return { strategy: { type: 'custom:fluvy-home', caps: { lights: 12 } } };
        return { views: [] };
      },
    });
    panel.tab = 'dashboard';
    await settle();
    // a list's own cap reads as shortened, and a tap on it changes nothing
    expect(chip('Shortened')?.classList.contains('is-active')).toBe(true);
    chip('Shortened')!.click();
    await settle();
    expect(root.querySelector('.pn-bar')?.textContent ?? '').not.toContain('1 change');
    chip('In full')!.click();
    await settle();
    button('Save')!.click();
    await settle();
    await settle();
    expect(saved.at(-1)).toEqual({
      type: 'lovelace/config/save',
      url_path: 'fluvy-auto',
      config: { strategy: { type: 'custom:fluvy-home', caps: 'none' } },
    });
    panel.remove();
  });

  it('lists what a dashboard leaves out in Home Assistant’s entity picker, and saves the list it changes to (#141)', async () => {
    const saved: { type: string; url_path?: string; config?: unknown }[] = [];
    const strategy = {
      type: 'custom:fluvy-home',
      exclude: ['climate.water_heater', 'sensor.debug_*'],
    };
    const { panel, root, button, settle } = await mount(true, {
      panels: {
        'fluvy-auto': {
          component_name: 'lovelace',
          url_path: 'fluvy-auto',
          title: 'Fluvy auto',
          icon: 'fluvy:sun',
        },
      },
      callWS: async (message: { type: string; url_path?: string | null; config?: unknown }) => {
        if (message.type === 'lovelace/config/save') {
          saved.push(message as never);
          return {};
        }
        if (message.type === 'lovelace/dashboards/list') return [];
        if (message.type === 'lovelace/config' && message.url_path === 'fluvy-auto')
          return { strategy };
        return { views: [] };
      },
    });
    panel.tab = 'dashboard';
    await settle();
    const picker = root.querySelector('ha-selector') as HTMLElement & {
      selector: unknown;
      value: unknown;
      disabled: boolean;
    };
    // under its words, the list as written, a pattern too
    expect(picker.previousElementSibling?.textContent).toBe(
      'Shown on no view and counted nowhere, as if the house had none',
    );
    expect(picker.selector).toEqual({ entity: { multiple: true } });
    expect(picker.value).toEqual(strategy.exclude);
    expect(picker.disabled).toBe(false);
    const choose = async (value: unknown) => {
      picker.dispatchEvent(new CustomEvent('value-changed', { detail: { value } }));
      await settle();
    };
    await choose(['sensor.debug_*']);
    expect(root.querySelector('.pn-bar')?.textContent).toContain('Fluvy auto · Entities left out');
    button('Save')!.click();
    await settle();
    await settle();
    expect(saved.at(-1)?.config).toEqual({
      strategy: { type: 'custom:fluvy-home', exclude: ['sensor.debug_*'] },
    });
    // none left takes the key away
    await choose([]);
    button('Save')!.click();
    await settle();
    await settle();
    expect(saved.at(-1)?.config).toEqual({ strategy: { type: 'custom:fluvy-home' } });
    panel.remove();
  });

  it('edits the wall whole and this device apart: the screensaver minutes saved with the house, the device on Save', async () => {
    localStorage.removeItem('fluvy:device');
    const { panel, root, row, chip, button, handle, settle } = await mount();
    panel.tab = 'wall';
    await settle();
    // this device is not a wall; the house's wall waits ten minutes
    expect(row('Wall panel')?.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe(
      'false',
    );
    expect(chip('10 min')?.classList.contains('is-active')).toBe(true);
    chip('5 min')!.click();
    await settle();
    expect(root.querySelector('.pn-bar')?.textContent).toContain('Wall · Screensaver after');
    row('Wall panel')!.querySelector<HTMLElement>('.fv-hit')!.click();
    await settle();
    expect(root.querySelector('.pn-bar')?.textContent).toContain('2 changes');
    button('Save')!.click();
    // the house's write, the store's echo and the device's memory take a few ticks
    await new Promise((resolve) => setTimeout(resolve, 200));
    await settle();
    // the house keeps every other wall setting as it was; the device remembers itself
    expect(handle.settings().wall).toMatchObject({
      after: 5,
      clock: true,
      theme: 'follow',
      background: 'plain',
    });
    expect(JSON.parse(localStorage.getItem('fluvy:device') ?? '{}')).toMatchObject({ wall: true });
    expect(root.querySelector('.pn-bar')).toBeNull();
    panel.remove();
    localStorage.removeItem('fluvy:device');
  });

  it('copies the wall\u2019s address and says so, or says what to do when it cannot', async () => {
    const { panel, root, settle } = await mount();
    panel.tab = 'wall';
    await settle();
    expect(root.querySelector('.pn-address__url')?.textContent?.trim().endsWith('?kiosk')).toBe(
      true,
    );
    const address = root.querySelector<HTMLElement>('.pn-address button')!;
    address.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle();
    expect(root.querySelector('.pn-notice')?.textContent).toContain('Address copied');
    // a plain-HTTP page has no Clipboard API, and a browser may refuse the selection command too: honest words
    const clipboard = Object.getOwnPropertyDescriptor(Navigator.prototype, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const exec = document.execCommand;
    document.execCommand = () => false;
    address.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await settle();
    expect(root.querySelector('.pn-notice')?.textContent).toContain('Could not copy');
    document.execCommand = exec;
    if (clipboard) Object.defineProperty(Navigator.prototype, 'clipboard', clipboard);
    else delete (navigator as { clipboard?: unknown }).clipboard;
    panel.remove();
  });

  it('lets the house choose the wall\u2019s way out: the button by default, or the long press', async () => {
    const { panel, root, chip, button, handle, settle } = await mount();
    panel.tab = 'wall';
    await settle();
    expect(chip('Button')?.classList.contains('is-active')).toBe(true);
    chip('Long press')!.click();
    await settle();
    expect(root.querySelector('.pn-bar')?.textContent).toContain('Wall · Way out');
    button('Save')!.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await settle();
    expect(handle.settings().wall.exit).toBe('hold');
    panel.remove();
  });

  it('offers every motion sensor in a dropdown to wake the wall, its room as the hint', async () => {
    const sensor = (id: string, device_class: string, friendly_name: string) => ({
      entity_id: id,
      state: 'off',
      attributes: { device_class, friendly_name },
      last_changed: '',
      last_updated: '',
    });
    const { panel, root, settle } = await mount(true, {
      states: {
        'binary_sensor.porch': sensor('binary_sensor.porch', 'occupancy', 'Porch'),
        'binary_sensor.hall': sensor('binary_sensor.hall', 'motion', 'Hall motion'),
        'binary_sensor.door': sensor('binary_sensor.door', 'door', 'Front door'),
      },
      entities: { 'binary_sensor.hall': { entity_id: 'binary_sensor.hall', area_id: 'hall' } },
      areas: { hall: { area_id: 'hall', name: 'Hall' } },
    });
    panel.tab = 'wall';
    await settle();
    const select = root.querySelector('fluvy-select') as HTMLElement & {
      value: string;
      options: readonly { value: string; label: string; hint?: string }[];
    };
    expect(select.value).toBe('');
    // None first, then the sensors that see a person by name (a door is not one), each with its room
    expect(select.options.map((o) => [o.value, o.label, o.hint ?? ''])).toEqual([
      ['', 'None', ''],
      ['binary_sensor.hall', 'Hall motion', 'Hall'],
      ['binary_sensor.porch', 'Porch', ''],
    ]);
    select.dispatchEvent(
      new CustomEvent('fluvy-change', { detail: { value: 'binary_sensor.porch' }, bubbles: true }),
    );
    await settle();
    expect(root.querySelector('.pn-bar')?.textContent).toContain('Wake on motion');
    panel.remove();
  });

  it('shows the screensaver as the wall would, over the panel, until a tap', async () => {
    const { panel, root, row, settle } = await mount();
    panel.tab = 'wall';
    await settle();
    row('See the screensaver')!.click();
    // the wall's pieces are fetched (a chunk of their own): as long as that takes, up to two seconds on a slow runner
    for (
      let waited = 0;
      waited < 2000 && !root.querySelector('fluvy-wall-screensaver');
      waited += 20
    )
      await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    const saver = root.querySelector('fluvy-wall-screensaver') as HTMLElement & {
      clock: boolean;
      dim: boolean;
    };
    expect(saver).not.toBeNull();
    expect(saver.hasAttribute('preview')).toBe(true); // a desktop keeps its pointer
    expect(saver.clock).toBe(true);
    expect(saver.dim).toBe(false);
    saver.shadowRoot!.querySelector('dialog')!.dispatchEvent(new MouseEvent('click'));
    await new Promise((resolve) => setTimeout(resolve, 260)); // its fade
    expect(root.querySelector('fluvy-wall-screensaver')).toBeNull();
    panel.remove();
  });

  it('draws the wall preview in the night the settings give, veiled as the night darkens it', async () => {
    const { panel, root, chip, settle } = await mount();
    panel.tab = 'wall';
    await settle();
    const preview = () => root.querySelector('.pn-preview--wall')!;
    expect(preview().classList.contains('pn-night')).toBe(false); // Follow: the app's mode, which is light
    const option = [...root.querySelectorAll<HTMLElement>('.fv-option')].find((o) =>
      o.textContent?.includes('Always'),
    )!;
    option.click();
    chip('40 %')!.click();
    await settle();
    expect(preview().classList.contains('pn-night')).toBe(true);
    expect(preview().querySelector<HTMLElement>('.pn-preview__veil')?.style.opacity).toBe('0.4');
    // the preview's cards are told the night too
    const tile = preview().querySelector('fluvy-tile-card') as HTMLElement & {
      hass?: { themes: { darkMode: boolean } };
    };
    expect(tile.hass?.themes.darkMode).toBe(true);
    chip('Off')!.click();
    await settle();
    expect(preview().querySelector('.pn-preview__veil')).toBeNull();
    panel.remove();
  });

  it('lists the house’s palettes under Yours and the community’s with their authors; a matching draft is that palette', async () => {
    const { panel, root, swatch, handle, settle } = await mount();
    const moss = COMMUNITY_PALETTES.find((file) => file.name === 'moss')!;
    // the house's own copy of the community's moss, under the same name: it stands in for it
    await handle.store.saveHouse({ palettes: [{ ...moss, title: 'My moss', author: 'Marta' }] });
    await settle();
    expect(root.textContent).toContain('Yours');
    expect(swatch('My moss')).toBeDefined();
    expect(swatch('My moss').querySelector('.pn-swatch__by')?.textContent?.trim()).toBe('by Marta');
    expect(swatch('Citrus').querySelector('.pn-swatch__by')?.textContent?.trim()).toBe('by Fluvy');
    // the house's copy of moss stands in for the community's
    expect(swatch('Moss')).toBeUndefined();
    swatch('My moss').click();
    await panel.updateComplete;
    expect(swatch('My moss').classList.contains('is-active')).toBe(true);
    expect(root.querySelector('.pn-custom.is-active')).toBeNull();
    expect(root.querySelector('.pn-bar')?.textContent).toContain('Linen → My moss');
    panel.remove();
  });

  it('shares a custom palette as a file named after its title, and reads one back', async () => {
    const { panel, root, settle } = await mount();
    (panel as unknown as { draft: unknown }).draft = {
      palette: { character: 'vivid', base: 'cool', accent: '#ff4a1a', fill: 'tint' },
      shape: 'soft',
      pills: 'round',
    };
    await settle();
    const inputs = [...root.querySelectorAll<HTMLInputElement>('.pn-text input')];
    expect(inputs).toHaveLength(2);
    const type = (input: HTMLInputElement, value: string): void => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    type(inputs[0]!, 'Warm Sand');
    type(inputs[1]!, 'Marta');
    await settle();
    let file: Blob | undefined;
    let name = '';
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => ((file = blob), 'blob:fluvy');
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      name = this.download;
    };
    [...root.querySelectorAll<HTMLButtonElement>('.fv-btn')]
      .find((b) => b.textContent?.trim() === 'Share this palette')!
      .click();
    URL.createObjectURL = create;
    HTMLAnchorElement.prototype.click = click;
    expect(name).toBe('warm-sand.fluvy-palette.json');
    const shared = JSON.parse(await file!.text()) as Record<string, unknown>;
    expect(shared).toMatchObject({
      fluvy_palette: 1,
      name: 'warm-sand',
      title: 'Warm Sand',
      author: 'Marta',
      palette: { character: 'vivid', base: 'cool', accent: '#ff4a1a', fill: 'tint' },
    });
    // a file back in: its palette is the draft and its words are the card's; a foreign file is refused
    const ops = panel as unknown as { context(): PanelContext };
    const citrus = COMMUNITY_PALETTES.find((f) => f.name === 'citrus')!;
    importPalette(
      panel as unknown as FluvyPanel,
      ops.context(),
      new File(
        [JSON.stringify({ ...citrus, name: 'sunny', title: 'Sunny' })],
        'sunny.fluvy-palette.json',
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    expect((panel as unknown as { draft: { palette: unknown } }).draft.palette).toEqual(
      citrus.palette,
    );
    expect(root.querySelector<HTMLInputElement>('.pn-text input')?.value).toBe('Sunny');
    importPalette(
      panel as unknown as FluvyPanel,
      ops.context(),
      new File([JSON.stringify({ hello: 1 })], 'x.json'),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    expect(root.textContent).toContain('That file holds no Fluvy palette');
    panel.remove();
  });

  it('saves a palette to the house and removes it (an administrator), stops at twelve, and shows a guest no such row', async () => {
    const { panel, root, row, handle, settle } = await mount();
    const draft = {
      palette: { character: 'soft', base: 'warm', accent: '#6b5a3c' },
      shape: 'soft',
      pills: 'round',
    };
    (panel as unknown as { draft: unknown }).draft = draft;
    await settle();
    const inputs = root.querySelectorAll<HTMLInputElement>('.pn-text input');
    inputs[0]!.value = 'Garden';
    inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    row('Save to the house’s palettes')!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    expect(handle.store.house.palettes.map((f) => f.name)).toEqual(['garden']);
    expect(row('Remove from the house’s palettes')).toBeDefined();
    row('Remove from the house’s palettes')!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    expect(handle.store.house.palettes).toEqual([]);
    // twelve kept: a thirteenth has no row, only the reason
    const moss = COMMUNITY_PALETTES.find((file) => file.name === 'moss')!;
    await handle.store.saveHouse({
      palettes: Array.from({ length: 12 }, (_, i) => ({ ...moss, name: `p${i}`, title: `P${i}` })),
    });
    await settle();
    expect(row('Save to the house’s palettes')).toBeUndefined();
    expect(root.textContent).toContain('The house keeps twelve palettes');
    panel.remove();
    const guest = await mount(false);
    (guest.panel as unknown as { draft: unknown }).draft = draft;
    await guest.settle();
    // a guest may still share and import (a palette for their own look), never save for the house
    expect(guest.row('Save to the house’s palettes')).toBeUndefined();
    expect(guest.root.querySelector('.pn-file')).not.toBeNull();
    guest.panel.remove();
  });

  it('lets the house keep Home Assistant’s own icons in its menus, shown before it is saved', async () => {
    const { panel, root, row, button, written, handle, previews, settle } = await mount();
    await handle.store.saveHouse({ scope: 'everywhere' });
    panel.tab = 'scope';
    await panel.updateComplete;
    const icons = row('Our icons in the menus');
    expect(icons?.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    const saves = written.length;
    icons?.querySelector<HTMLElement>('.fv-hit')?.click();
    await settle();
    // an edit: on the screen at once, saved only from the bar
    expect(written.length).toBe(saves);
    expect(previews.at(-1)).toEqual({ icons: false });
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Our icons in the menus · Off',
    );
    button('Save')!.click();
    await settle();
    expect(written.at(-1)?.type).toBe('frontend/set_system_data');
    expect(handle.settings().icons).toBe(false);
    // Home Assistant handed the saved value back: nothing is pending (the bar is on its way out), nothing previewed
    expect(root.querySelector('.pn-foot:not(.is-leaving) .pn-bar')).toBeNull();
    expect(previews.at(-1)).toBeNull();
    panel.remove();
  });

  it('lets the house draw a line in the sidebar after the items it chooses, each named as the sidebar names it', async () => {
    const { panel, root, row, button, handle, settle } = await mount(true, {
      panels: {
        lovelace: { component_name: 'lovelace', url_path: 'lovelace', title: null, icon: null },
        'fluvy-auto': {
          component_name: 'lovelace',
          url_path: 'fluvy-auto',
          title: 'Fluvy auto',
          icon: 'fluvy:sun',
        },
        history: {
          component_name: 'history',
          url_path: 'history',
          title: 'history',
          icon: 'mdi:chart-box',
        },
        // never in the sidebar, or drawn at its foot by Home Assistant itself: no line to choose
        light: {
          component_name: 'light',
          url_path: 'light',
          title: 'light',
          icon: 'mdi:lamps',
          show_in_sidebar: false,
        },
        config: { component_name: 'config', url_path: 'config', title: 'config', icon: null },
      },
      localize: (key: string) => (key === 'panel.history' ? 'History' : key),
    });
    const listed = (): string[] =>
      [...root.querySelectorAll('.fv-row__sub')]
        .map((sub) => sub.textContent?.trim() ?? '')
        .filter((sub) => sub.startsWith('/'));
    // the sidebar is Home Assistant's own until the look covers the whole app
    expect(listed()).toEqual([]);
    await handle.store.saveHouse({ scope: 'everywhere' });
    await settle();
    expect(listed()).toEqual(['/lovelace', '/fluvy-auto', '/history']);
    expect(row('Overview')).toBeDefined();
    row('History')?.querySelector<HTMLElement>('.fv-hit')?.click();
    await settle();
    button('Apply to the house')!.click();
    await settle();
    expect(handle.settings().look.chrome?.separators).toEqual(['history']);
    panel.remove();
  });

  it('lets the house say how lights show their colour where a card says nothing (#41)', async () => {
    const { panel, root, row, chip, button, handle, previews, settle } = await mount();
    // on the Look tab: never, by default, so nothing changes on upgrade
    expect(chip('Never')?.classList.contains('is-active')).toBe(true);
    const colours = row('In their bulb’s colour');
    expect(colours?.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('false');
    chip('When on')!.click();
    await settle();
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Lights · Show their colour · When on',
    );
    colours?.querySelector<HTMLElement>('.fv-hit')?.click();
    await settle();
    // shown on every card at once, saved only from the bar
    expect(previews.at(-1)).toEqual({ lightTint: 'on', lightColors: true });
    button('Save')!.click();
    await settle();
    expect([handle.settings().lightTint, handle.settings().lightColors]).toEqual(['on', true]);
    panel.remove();
    // someone who is not an administrator reads them, and changes nothing
    const guest = await mount(false);
    expect(guest.root.textContent).toContain('Lights');
    guest.chip('Always')?.click();
    await guest.settle();
    expect(guest.previews.at(-1)).not.toEqual(expect.objectContaining({ lightTint: 'always' }));
    guest.panel.remove();
  });

  it('lets the house make every card see-through, and blur what shows through (#121)', async () => {
    const { panel, root, row, button, handle, previews, settle } = await mount();
    // the column laid out: the opacity's ruler is drawn to its width
    (panel as unknown as { content: number }).content = 400;
    await settle();
    const card = [...root.querySelectorAll<HTMLElement>('.pn-card')].find(
      (c) => c.querySelector('.fv-card__title')?.textContent?.trim() === 'Cards',
    )!;
    // solid, by default: nothing changes on upgrade; the blur is on, said for every see-through card
    expect(row('Opacity')?.querySelector('.fv-row__value')?.textContent?.trim()).toBe('100 %');
    const ruler = card.querySelector('fluvy-ruler') as HTMLElement & { value: number };
    expect(ruler.value).toBe(100);
    const blur = row('Blur what shows through');
    expect(blur?.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    ruler.dispatchEvent(new CustomEvent('fluvy-change', { detail: { value: 80 } }));
    await settle();
    expect(row('Opacity')?.querySelector('.fv-row__value')?.textContent?.trim()).toBe('80 %');
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Cards · Opacity · 80 %');
    // the preview's cards stand on a picture while they are see-through
    expect(root.querySelector('.pn-preview--glass')).not.toBeNull();
    blur?.querySelector<HTMLElement>('.fv-hit')?.click();
    await settle();
    // shown on every card at once, saved only from the bar
    expect(previews.at(-1)).toEqual({
      cards: { opacity: 80, blur: false, unavailable: 'dashed' },
    });
    button('Save')!.click();
    await settle();
    expect(handle.settings().cards).toEqual({ opacity: 80, blur: false, unavailable: 'dashed' });
    panel.remove();
    // someone who is not an administrator reads them, and changes nothing
    const guest = await mount(false);
    (guest.panel as unknown as { content: number }).content = 400;
    await guest.settle();
    const read = guest.root.querySelector('fluvy-ruler')!;
    expect(read.hasAttribute('readonly')).toBe(true);
    guest.row('Blur what shows through')?.querySelector<HTMLElement>('.fv-hit')?.click();
    await guest.settle();
    expect(guest.previews.at(-1)).not.toEqual(
      expect.objectContaining({ cards: expect.anything() }),
    );
    guest.panel.remove();
  });

  it('lets the house draw a card out of reach as when off, dashed until chosen (#126)', async () => {
    const { panel, root, button, handle, previews, settle } = await mount();
    const card = [...root.querySelectorAll<HTMLElement>('.pn-card')].find(
      (c) => c.querySelector('.fv-card__title')?.textContent?.trim() === 'Cards',
    )!;
    const chip = (words: string) =>
      [...card.querySelectorAll<HTMLElement>('.fv-chip')].find(
        (c) => c.textContent?.trim() === words,
      );
    // dashed, by default: nothing changes on upgrade
    expect(card.querySelector('.pn-label')?.textContent?.trim()).toBe('When unavailable');
    expect(chip('Dashed')?.classList.contains('is-active')).toBe(true);
    expect(chip('As when off')?.classList.contains('is-active')).toBe(false);
    chip('As when off')?.click();
    await settle();
    expect(chip('As when off')?.classList.contains('is-active')).toBe(true);
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Cards · When unavailable · As when off',
    );
    // shown on every card at once, saved only from the bar
    expect(previews.at(-1)).toEqual({ cards: { opacity: 100, blur: true, unavailable: 'quiet' } });
    button('Save')!.click();
    await settle();
    expect(handle.settings().cards.unavailable).toBe('quiet');
    panel.remove();
    // someone who is not an administrator reads it, and changes nothing
    const guest = await mount(false);
    const theirs = [...guest.root.querySelectorAll<HTMLElement>('.pn-card')].find(
      (c) => c.querySelector('.fv-card__title')?.textContent?.trim() === 'Cards',
    )!;
    expect(theirs.querySelector('.pn-chips--static')).not.toBeNull();
    [...theirs.querySelectorAll<HTMLElement>('.fv-chip')].at(-1)?.click();
    await guest.settle();
    expect(guest.previews.at(-1)).not.toEqual(
      expect.objectContaining({ cards: expect.anything() }),
    );
    guest.panel.remove();
  });

  it('lets the house give each status a colour of its own, the palette’s until then (1.9)', async () => {
    const { panel, root, button, handle, previews, settle } = await mount();
    const card = () =>
      [...root.querySelectorAll<HTMLElement>('.pn-card')].find(
        (c) => c.querySelector('.fv-card__title')?.textContent?.trim() === 'Status colours',
      )!;
    /** A status's block: its label, its Auto · Custom chips, and (Custom) its dots, its field, its line. */
    const block = (status: string) => {
      const label = [...card().querySelectorAll<HTMLElement>('.pn-label')].find(
        (p) => p.textContent?.trim() === status,
      )!;
      const parts: HTMLElement[] = [];
      for (let el = label.nextElementSibling; el && !el.classList.contains('pn-label');)
        el = (parts.push(el as HTMLElement), el.nextElementSibling);
      const find = (selector: string) => parts.find((part) => part.matches(selector));
      return {
        chip: (text: string) =>
          [...(find('.fv-chips')?.querySelectorAll<HTMLElement>('.fv-chip') ?? [])].find(
            (c) => c.textContent?.trim() === text,
          )!,
        dots: find('.pn-dots'),
        hex: find('.pn-hex')?.querySelector<HTMLInputElement>('.pn-hex__input'),
        line: find('.pn-hint')?.textContent?.trim(),
      };
    };
    const worn = () =>
      [...((panel.shadowRoot as ShadowRoot).adoptedStyleSheets ?? [])]
        .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
        .join('');
    // four statuses, each the palette's: nothing changes on upgrade
    for (const status of ['Warning', 'Danger', 'Success', 'Notice']) {
      expect(block(status).chip('Auto').classList.contains('is-active'), status).toBe(true);
      expect(block(status).dots, status).toBeUndefined();
    }
    // Custom: the warning starts on #47's orange, shown on the panel and the page at once, saved from the bar
    block('Warning').chip('Custom').click();
    await settle();
    expect(previews.at(-1)).toEqual({ statuses: { warning: '#dc630b' } });
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Status colours · Warning · #dc630b',
    );
    expect(block('Warning').dots?.querySelectorAll('.pn-dot').length).toBe(6);
    expect(block('Warning').hex?.value).toBe('#dc630b');
    const orange = paletteOf('linen', { warning: '#dc630b' }).light.semantic.warning;
    expect(worn()).toMatch(new RegExp(`--fluvy-warning: ?${orange.ink}`));
    // a swatch, then any colour typed
    block('Warning').dots!.querySelectorAll<HTMLElement>('.pn-dot')[5]!.click();
    await settle();
    expect(previews.at(-1)).toEqual({ statuses: { warning: '#7048e8' } });
    const field = block('Warning').hex!;
    field.value = '#E8590C';
    field.dispatchEvent(new Event('change'));
    await settle();
    expect(previews.at(-1)).toEqual({ statuses: { warning: '#e8590c' } });
    // a danger in the warning's very colour: the panel says so under both, and turns nothing aside
    block('Danger').chip('Custom').click();
    await settle();
    expect(block('Danger').line).toBeUndefined();
    const danger = block('Danger').hex!;
    danger.value = '#e8590c';
    danger.dispatchEvent(new Event('change'));
    await settle();
    expect(previews.at(-1)).toEqual({ statuses: { warning: '#e8590c', danger: '#e8590c' } });
    expect(block('Danger').line).toBe('Close to Warning: the two may be mistaken for each other');
    expect(block('Warning').line).toBe('Close to Danger: the two may be mistaken for each other');
    expect(block('Success').line).toBeUndefined();
    block('Danger').chip('Auto').click();
    await settle();
    expect(block('Warning').line).toBeUndefined();
    button('Save')!.click();
    await settle();
    expect(handle.settings().statuses).toEqual({ warning: '#e8590c' });
    expect(root.querySelector('.pn-foot:not(.is-leaving) .pn-bar')).toBeNull();
    // back to the palette's: an edit, and the panel wears the palette's own again
    block('Warning').chip('Auto').click();
    await settle();
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Status colours · Warning · Auto',
    );
    expect(worn()).toMatch(
      new RegExp(`--fluvy-warning: ?${paletteOf('linen').light.semantic.warning.ink}`),
    );
    panel.remove();
    // someone who is not an administrator sees them, and changes nothing
    const guest = await mount(false);
    const guestCard = [...guest.root.querySelectorAll<HTMLElement>('.pn-card')].find(
      (c) => c.querySelector('.fv-card__title')?.textContent?.trim() === 'Status colours',
    )!;
    expect(guestCard.textContent).toContain('Only an administrator can change this');
    [...guestCard.querySelectorAll<HTMLElement>('.fv-chip')]
      .find((c) => c.textContent?.trim() === 'Custom')!
      .click();
    await guest.settle();
    expect(guest.previews.at(-1)).not.toEqual(
      expect.objectContaining({ statuses: expect.anything() }),
    );
    guest.panel.remove();
  });

  it('chooses the house’s charts like its look: a style and a gauge as tiles, what the style tunes, motion (1.11)', async () => {
    const { panel, root, chip, row, button, handle, previews, settle } = await mount();
    const host = panel as unknown as { content: number };
    panel.tab = 'charts';
    host.content = 288;
    await settle();
    const tile = (name: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('.pn-tile')].find(
        (b) => b.querySelector('.pn-swatch__label')?.textContent?.trim() === name,
      )!;
    // the Details card's rows (the Time card's are every style's)
    const labels = () =>
      [...root.querySelectorAll('.pn-card')]
        .filter((card) => card.querySelector('.fv-card__title')?.textContent?.trim() === 'Details')
        .flatMap((card) => [...card.querySelectorAll('.pn-label')])
        .map((p) => p.textContent?.trim());
    // eight styles and eleven gauges (Fluvy's four controls, the seven that move, each on a reading of its kind), each
    // drawn by the engine; classic and ticks from the factory
    expect(root.querySelectorAll('.pn-art--style svg.fc-chart').length).toBe(8);
    expect(root.querySelectorAll('.pn-art--gauge').length).toBe(11);
    expect(root.querySelectorAll('.pn-art--gauge .fc-scene').length).toBe(7);
    // every row full: two a row on a phone, the eleventh gauge's row its own; four on a wide panel, the last three
    // gauges sharing theirs
    const rows = (kind: 'style' | 'gauge') =>
      [...root.querySelector(`.pn-art--${kind}`)!.closest('.pn-tiles')!.children].map(
        (line) => line.querySelectorAll('.pn-tile').length,
      );
    expect([rows('style'), rows('gauge')]).toEqual([
      [2, 2, 2, 2],
      [2, 2, 2, 2, 2, 1],
    ]);
    const wide = panel as unknown as { wide: boolean };
    wide.wide = true;
    host.content = 600;
    await settle();
    expect([rows('style'), rows('gauge')]).toEqual([
      [4, 4],
      [4, 4, 3],
    ]);
    wide.wide = false;
    host.content = 288;
    await settle();
    expect(tile('Classic').getAttribute('aria-pressed')).toBe('true');
    expect(tile('Ticks').getAttribute('aria-pressed')).toBe('true');
    // classic tunes nothing but motion: it says so, and offers no row
    expect(labels()).toEqual([]);
    expect(root.textContent).toContain('Classic is the chart as Fluvy has always drawn it');
    expect(row('Motion')).toBeDefined();
    // a style: on the panel's preview and every card of the page at once, saved from the bar
    tile('Soft').click();
    await settle();
    expect(previews.at(-1)).toEqual({ charts: { ...handle.settings().charts, style: 'soft' } });
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Charts · Style · Soft');
    expect(root.querySelector('.fc-preview svg.fc-chart--soft')).not.toBeNull();
    // the rows the soft style draws with, none it does not (the waves are a moving gauge's)
    expect(labels()).toEqual([
      'Line',
      'Soft shadow',
      'Shadow strength',
      'Fill',
      'Gridlines',
      'Line’s end',
      'Now',
      'Bars’ ends',
      'Bubble',
    ]);
    tile('Bars').click();
    await settle();
    expect(labels()).toEqual(['Gridlines', 'Bars’ ends', 'Bubble']);
    tile('Soft').click();
    await settle();
    chip('Bold')!.click();
    await settle();
    chip('7 px')!.click();
    await settle();
    // a gauge that moves: its waves are the house's to tune
    tile('Liquid').click();
    await settle();
    expect(labels().at(-1)).toBe('Waves');
    tile('Ring').click();
    await settle();
    expect(labels()).not.toContain('Waves');
    expect(handle.settings().charts.style).toBe('classic');
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('4 changes');
    // motion off: the previews draw their resting frame
    row('Motion')!.querySelector<HTMLElement>('.fv-hit')!.click();
    await settle();
    expect(root.querySelectorAll('.fc-preview svg.fc-chart:not(.is-still)').length).toBe(0);
    expect(root.querySelectorAll('.pn-art--style svg.fc-chart.is-still').length).toBe(8);
    button('Save')!.click();
    await settle();
    expect(handle.settings().charts).toMatchObject({
      style: 'soft',
      gauge: 'ring',
      line: 'bold',
      glow: { offset: 7, opacity: 0.35 },
      animate: false,
    });
    expect(root.querySelector('.pn-foot:not(.is-leaving) .pn-bar')).toBeNull();
    panel.remove();
    // someone who is not an administrator reads them, and changes nothing
    const guest = await mount(false);
    guest.panel.tab = 'charts';
    await guest.settle();
    expect(guest.root.textContent).toContain('Only an administrator can change this');
    [...guest.root.querySelectorAll<HTMLButtonElement>('.pn-tile')]
      .find((b) => b.textContent?.includes('Glow'))!
      .click();
    await guest.settle();
    expect(guest.previews.at(-1)).not.toEqual(
      expect.objectContaining({ charts: expect.anything() }),
    );
    expect(guest.row('New set…')).toBeUndefined();
    guest.panel.remove();
  });

  it('chooses how much of the past every chart shows and how far apart its points stand, in every style (1.18)', async () => {
    const { panel, root, chip, button, handle, previews, settle } = await mount();
    panel.tab = 'charts';
    (panel as unknown as { content: number }).content = 288;
    await settle();
    const card = [...root.querySelectorAll('.pn-card')].find(
      (c) => c.querySelector('.fv-card__title')?.textContent?.trim() === 'Time',
    )!;
    const chips = () =>
      [...card.querySelectorAll('.fv-chip')].map(
        (c) => `${c.textContent?.trim()}${c.getAttribute('aria-pressed') === 'true' ? ' ✓' : ''}`,
      );
    expect([...card.querySelectorAll('.pn-label')].map((p) => p.textContent?.trim())).toEqual([
      'Time shown',
      'A point every',
    ]);
    // the last 12 hours, the points as each card's width draws them calmly: from the factory, classic or not
    expect(chips()).toEqual([
      '4 h',
      '12 h ✓',
      '24 h',
      '48 h',
      '7 d',
      'Automatic ✓',
      '5 min',
      '15 min',
      '30 min',
      '1 h',
    ]);
    expect(card.querySelector('.pn-hint')?.textContent).toContain('Home Assistant’s reading');
    chip('24 h')!.click();
    await settle();
    expect(previews.at(-1)).toEqual({ charts: { ...handle.settings().charts, window: 24 } });
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Charts · Time shown · 24 h',
    );
    chip('30 min')!.click();
    await settle();
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('2 changes');
    button('Save')!.click();
    await settle();
    expect(handle.settings().charts).toMatchObject({ window: 24, points: '30m' });
    panel.remove();
  });

  it('makes, checks, keeps, renames and lets go of the house’s own series colours (1.11)', async () => {
    const { panel, root, row, handle, settle } = await mount();
    panel.tab = 'charts';
    (panel as unknown as { content: number }).content = 288;
    await settle();
    const editor = () => root.querySelector<HTMLElement>('.pn-editor');
    const slots = () => [...editor()!.querySelectorAll<HTMLButtonElement>('.pn-slot')];
    const swatch = (name: string) =>
      editor()!.querySelector<HTMLButtonElement>(`.pn-dot[aria-label="${name}"]`)!;
    const custom = () => editor()!.querySelector<HTMLInputElement>('.pn-hex__input')!;
    const mark = () => editor()!.querySelector('.pn-mark')?.textContent?.trim();
    const set = (name: string) =>
      [...root.querySelectorAll<HTMLButtonElement>('.pn-set')].find(
        (b) => b.querySelector('.pn-custom__title')?.textContent?.trim() === name,
      );
    const saveButton = () =>
      [...editor()!.querySelectorAll<HTMLButtonElement>('.fv-btn')].find(
        (b) => b.textContent?.trim() === 'Save set',
      )!;
    // the palette's six, worn from the factory
    expect(set('From the palette')?.getAttribute('aria-pressed')).toBe('true');
    row('New set…')!.click();
    await settle();
    // the palette's own six, each following the palette, the first being picked; no name yet: nothing to save
    expect(slots().map((slot) => slot.getAttribute('aria-label'))).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => `Colour ${n}: Series ${n} · Follows the palette`),
    );
    expect(slots()[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(editor()!.querySelector('.pn-slot-head__title')?.textContent).toBe('Colour 1');
    expect(mark()).toBe('Follows the palette');
    expect(swatch('Series 1').getAttribute('aria-pressed')).toBe('true');
    // the picker: the palette's twelve, its accent with the statuses and the lit light, the energy states, each by its
    // token; Custom starts on the colour's hex here
    expect(
      [...editor()!.querySelectorAll('.pn-label')].map((label) => label.textContent?.trim()),
    ).toEqual(['Name', 'Colours', 'Series', 'Tones', 'Energy', 'Custom']);
    expect(
      [...editor()!.querySelectorAll('.pn-dot')].map((dot) => dot.getAttribute('aria-label')),
    ).toEqual([
      ...Array.from({ length: 12 }, (_u, n) => `Series ${n + 1}`),
      'Accent',
      'Success',
      'Warning',
      'Danger',
      'Notice',
      'Light',
      'Solar',
      'Grid',
      'Battery',
      'Water',
      'Gas',
      'House',
    ]);
    expect(swatch('Solar').getAttribute('style')).toContain(
      '--dot:var(--fluvy-state-energy-solar)',
    );
    expect(custom().value).toBe(paletteOf('linen').light.graph[0]);
    expect(saveButton().disabled).toBe(true);
    // picking a swatch names the palette's colour: the second follows the palette's solar
    slots()[1]!.click();
    await settle();
    swatch('Solar').click();
    await settle();
    expect(slots()[1]!.getAttribute('aria-label')).toBe('Colour 2: Solar · Follows the palette');
    // two of the palette's own that sit together are said by their words
    swatch('Accent').click();
    await settle();
    expect(editor()!.querySelector('.pn-status')?.textContent?.trim()).toBe(
      'Series 1 and Accent are too close to tell apart',
    );
    // six that read on either card and stand apart pass: a hex typed under Custom is fixed
    const type = async (n: number, colour: string) => {
      slots()[n]!.click();
      await settle();
      custom().value = colour;
      custom().dispatchEvent(new Event('change'));
      await settle();
    };
    await type(0, '#2563eb');
    expect(slots()[0]!.getAttribute('aria-label')).toBe('Colour 1: #2563eb · Fixed');
    expect(mark()).toBe('Fixed');
    expect(editor()!.querySelector('.pn-dot.is-active')).toBeNull();
    const both = ['#2563eb', '#d97706', '#16a34a', '#dc2626', '#9333ea', '#0891b2'];
    for (const [n, colour] of both.entries()) await type(n, colour);
    expect(editor()!.querySelector('.pn-status')).toBeNull();
    expect(editor()!.textContent).toContain('Every colour stands apart and reads on either card');
    // the lines each mode draws: the set as that mode's card wears it
    const inks = (mode: 'light' | 'dark') =>
      [...editor()!.querySelectorAll(`.pn-mode[data-mode="${mode}"] g[style]`)].map((g) =>
        g.getAttribute('style'),
      );
    // a colour too pale for the light card, or too deep for the dark one, is worn fitted there: nothing to say
    await type(4, '#f4e9d0');
    expect(editor()!.querySelector('.pn-status')).toBeNull();
    expect(inks('dark')[4]).toBe('--tone-ink:#f4e9d0');
    expect(inks('light')[4]).not.toBe('--tone-ink:#f4e9d0');
    await type(4, '#3b2a1a');
    expect(editor()!.querySelector('.pn-status')).toBeNull();
    expect(inks('light')[4]).toBe('--tone-ink:#3b2a1a');
    expect(inks('dark')[4]).not.toBe('--tone-ink:#3b2a1a');
    // two colours a breath apart: it says which, and why
    await type(1, '#2463ea');
    expect(editor()!.querySelector('.pn-status')?.textContent?.trim()).toBe(
      '#2563eb and #2463ea are too close to tell apart',
    );
    // two pale blues deepened to read on the light card meet there: it says where
    await type(1, '#d97706');
    await type(0, '#93c5fd');
    await type(5, '#60a5fa');
    expect(editor()!.querySelector('.pn-status')?.textContent?.trim()).toBe(
      '#93c5fd and #60a5fa are too close to tell apart on a light card',
    );
    // a fixed colour made the palette's again: both modes draw it by its token, as each mode's look has it
    slots()[2]!.click();
    await settle();
    swatch('Series 3').click();
    await settle();
    expect([inks('light')[2], inks('dark')[2]]).toEqual([
      '--tone-ink:var(--fluvy-graph-3)',
      '--tone-ink:var(--fluvy-graph-3)',
    ]);
    // both modes drawn side by side, six lines each
    expect(editor()!.querySelectorAll('.pn-mode svg.fc-chart').length).toBe(2);
    expect([inks('light').length, inks('dark').length]).toEqual([6, 6]);
    const name = editor()!.querySelector<HTMLInputElement>('.pn-text input')!;
    name.value = 'Dusk';
    name.dispatchEvent(new Event('input'));
    await settle();
    saveButton().click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    // kept by the house at once — its hexes as typed, the palette's colour by its name — the editor closed, the charts
    // wearing it from the bar
    expect(handle.store.house.chartSets).toEqual([
      {
        id: 'dusk',
        name: 'Dusk',
        colours: ['#93c5fd', '#d97706', 'graph-3', '#dc2626', '#3b2a1a', '#60a5fa'],
      },
    ]);
    expect(editor()).toBeNull();
    expect(set('Dusk')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Charts · Series colours · Dusk',
    );
    // renamed in its place
    row('Edit this set')!.click();
    await settle();
    const rename = editor()!.querySelector<HTMLInputElement>('.pn-text input')!;
    rename.value = 'Evening';
    rename.dispatchEvent(new Event('input'));
    await settle();
    saveButton().click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    expect(handle.store.house.chartSets.map((s) => [s.id, s.name])).toEqual([['dusk', 'Evening']]);
    // let go: the charts wear the palette's again, and nothing waits in the bar
    row('Edit this set')!.click();
    await settle();
    row('Delete this set')!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await settle();
    expect(handle.store.house.chartSets).toEqual([]);
    expect(set('From the palette')?.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.pn-foot:not(.is-leaving) .pn-bar')).toBeNull();
    panel.remove();
  });

  it('lays a row of choices out by measure: three while every word holds its third, else two and one', async () => {
    const { panel, chip } = await mount();
    const host = panel as unknown as {
      content: number;
      ruler: { width: (c: string, t: string) => number };
    };
    const tracks = (): string | undefined =>
      chip('When on')
        ?.parentElement?.getAttribute('style')
        ?.match(/repeat\((\d+),/)?.[1];
    // a phone's card (288 of content, 8 apart: thirds of 90.7): "When on" at 70 + its sides holds a third
    host.ruler.width = (_class, text) => (text === 'When on' ? 70 : 40);
    host.content = 288;
    await panel.updateComplete;
    expect(tracks()).toBe('3');
    // a word too long for its third (pt-BR's "Quando ligado" at 94 + its 16): two and one, the third across both
    host.ruler.width = (_class, text) => (text === 'When on' ? 94 : 40);
    host.content = 289;
    await panel.updateComplete;
    expect(tracks()).toBe('2');
    expect(chip('Always')?.getAttribute('style')).toContain('span 2');
    panel.remove();
  });

  it('lets the house keep Home Assistant’s own Activity page', async () => {
    const { panel, root, row, button, handle, previews, settle } = await mount();
    await handle.store.saveHouse({ scope: 'everywhere' });
    panel.tab = 'scope';
    await panel.updateComplete;
    const activity = row('Our Activity view');
    expect(activity?.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    activity?.querySelector<HTMLElement>('.fv-hit')?.click();
    await settle();
    expect(previews.at(-1)).toEqual({ activity: false });
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe(
      'Our Activity view · Off',
    );
    button('Save')!.click();
    await settle();
    expect(handle.settings().activity).toBe(false);
    panel.remove();
  });

  it('shows a language on the panel before it is saved, and discards it back', async () => {
    const { panel, root, pick, button, written, previews, settle } = await mount();
    panel.tab = 'preferences';
    await panel.updateComplete;
    const shown = () =>
      root
        .querySelector('fluvy-select')
        ?.shadowRoot?.querySelector('.fv-select__value')
        ?.textContent?.trim();
    expect(shown()).toBe('Automatic');
    await pick('Español');
    await settle();
    expect(written).toEqual([]);
    expect(previews.at(-1)).toEqual({ language: 'es' });
    // the panel speaks the chosen language as soon as its words arrive (a chunk of their own)
    expect(shown()).toBe('Español');
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toMatch(
      /^(Language|Idioma) · Español$/,
    );
    (button('Descartar') ?? button('Discard'))!.click();
    await settle();
    expect(previews.at(-1)).toBeNull();
    expect(shown()).toBe('Automatic');
    panel.remove();
  });

  it('sizes this device from Preferences: the chips, the bar’s line, saved to the device and shown at once', async () => {
    localStorage.removeItem('fluvy:device');
    document.documentElement.style.removeProperty('--fluvy-zoom');
    const { panel, root, chip, button, written, settle } = await mount(false); // everyone's, not an administrator's
    panel.tab = 'preferences';
    await settle();
    const sizes = () =>
      [...root.querySelectorAll<HTMLElement>('.fv-chip')]
        .filter((c) => /%/.test(c.textContent ?? ''))
        .map((c) => `${c.textContent?.trim()}${c.classList.contains('is-active') ? '*' : ''}`);
    expect(sizes()).toEqual(['90 %', '100 %*', '110 %', '125 %', '150 %']);
    chip('125 %')!.click();
    await settle();
    expect(sizes()).toContain('125 %*');
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Size · 125 %');
    // nothing is saved or applied before the bar says so
    expect(localStorage.getItem('fluvy:device')).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--fluvy-zoom')).toBe('');
    chip('100 %')!.click();
    await new Promise((resolve) => setTimeout(resolve, 200)); // the bar leaves in 160
    await settle();
    expect(root.querySelector('.pn-bar')).toBeNull(); // back to what is saved: no edit
    chip('125 %')!.click();
    await settle();
    button('Save')!.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await settle();
    // the device's own memory, nothing of the house's or the person's; the view's size is on the page already
    expect(written).toEqual([]);
    expect(JSON.parse(localStorage.getItem('fluvy:device') ?? '{}')).toMatchObject({ zoom: 125 });
    expect(document.documentElement.style.getPropertyValue('--fluvy-zoom')).toBe('1.25');
    expect(root.querySelector('.pn-bar')).toBeNull();
    expect(sizes()).toContain('125 %*');
    panel.remove();
    // the Wall tab's device card offers the same choice, remembered
    const again = await mount();
    again.panel.tab = 'wall';
    await again.settle();
    expect(
      [...again.root.querySelectorAll<HTMLElement>('.fv-chip.is-active')].some(
        (c) => c.textContent?.trim() === '125 %',
      ),
    ).toBe(true);
    again.panel.remove();
    localStorage.removeItem('fluvy:device');
    document.documentElement.style.removeProperty('--fluvy-zoom');
  });

  it('says why only on dashboards cannot hold while the profile wears the Fluvy theme', async () => {
    const { panel, root, settle } = await mount(true, {
      selectedTheme: { theme: 'Fluvy' },
      themes: { darkMode: false, theme: 'Fluvy', default_theme: 'default', themes: {} },
    });
    panel.tab = 'scope';
    await settle();
    expect(root.querySelector('.pn-status')?.textContent).toContain(
      'Your profile uses the Fluvy theme',
    );
    const asked: unknown[] = [];
    panel.addEventListener('settheme', (event) => asked.push((event as CustomEvent).detail));
    root.querySelector<HTMLButtonElement>('.pn-status .fv-btn')!.click();
    expect(asked).toEqual([{ theme: '' }]);
    panel.remove();
  });

  it('says a theme of their own keeps Home Assistant, and offers the Fluvy theme', async () => {
    const { panel, root, handle, settle } = await mount(true, {
      selectedTheme: { theme: 'default' },
      themes: { darkMode: false, theme: 'default', default_theme: 'default', themes: {} },
    });
    await handle.store.saveHouse({ scope: 'everywhere' });
    panel.tab = 'scope';
    await settle();
    expect(root.querySelector('.pn-status')?.textContent).toContain('Your theme is Home Assistant');
    const asked: unknown[] = [];
    panel.addEventListener('settheme', (event) => asked.push((event as CustomEvent).detail));
    root.querySelector<HTMLButtonElement>('.pn-status .fv-btn')!.click();
    expect(asked).toEqual([{ theme: 'Fluvy' }]);
    panel.remove();
  });

  it('offers the accents of the style chosen, and keeps a listed one’s place when the style changes', async () => {
    const { panel, root, settle } = await mount();
    (panel as unknown as { draft: unknown }).draft = {
      palette: { character: 'vivid', base: 'cool', accent: '#ff4a1a', fill: 'tint' },
      shape: 'soft',
      pills: 'round',
    };
    await settle();
    const dots = () =>
      [...root.querySelectorAll<HTMLElement>('.pn-card .pn-dots')][0]!.querySelectorAll('.pn-dot');
    expect(dots()[2]?.getAttribute('aria-label')).toBe('#ff4a1a');
    expect(dots()[2]?.getAttribute('aria-pressed')).toBe('true');
    [...root.querySelectorAll<HTMLElement>('.fv-chip')]
      .find((c) => c.textContent?.trim() === 'Pastel')!
      .click();
    await settle();
    expect(dots()[2]?.getAttribute('aria-label')).toBe('#f9c09e');
    expect(dots()[2]?.getAttribute('aria-pressed')).toBe('true');
    panel.remove();
  });

  it('saves the buttons’ roundness with the look', async () => {
    const { panel, root, button, handle, settle } = await mount();
    [...root.querySelectorAll<HTMLElement>('.fv-option')]
      .find((o) => o.textContent?.includes('Crisp') && o.textContent.includes('6'))!
      .click();
    await settle();
    expect(root.querySelector('.pn-bar__text')?.textContent?.trim()).toBe('Pill → Crisp');
    button('Apply to the house')!.click();
    await settle();
    expect(handle.settings().look.pills).toBe('crisp');
    panel.remove();
  });

  it('resets the house only on a second tap, and says so after the first', async () => {
    const { panel, row, written } = await mount();
    panel.tab = 'preferences';
    await panel.updateComplete;
    row('House settings')!.click();
    await panel.updateComplete;
    expect(row('Tap again')).toBeDefined();
    expect(written).toEqual([]);
    row('Tap again')!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(written.at(-1)?.type).toBe('frontend/set_system_data');
    panel.remove();
  });

  it('exports every setting and the automatic dashboard’s options, and imports them back — the charts and their sets too (1.11), the cards’ surface (1.15) and their look out of reach (1.16)', async () => {
    const saved: { type: string; url_path?: string; config?: unknown }[] = [];
    // the long lists' caps travel too, list by list (#78)
    const caps = { lights: 12, humidity: 'none' };
    const strategy = {
      type: 'custom:fluvy-home',
      thermostat_variant: 'ruler',
      hide: ['media'],
      caps,
    };
    const { panel, handle, settle } = await mount(true, {
      callWS: async (message: { type: string; url_path?: string | null; config?: unknown }) => {
        if (message.type === 'lovelace/config/save') saved.push(message as never);
        return message.type === 'lovelace/config' && message.url_path === 'fluvy-auto'
          ? { strategy }
          : { views: [] };
      },
    });
    // the Charts tab's choices and a set of the house's own colours travel with the rest (1.11): every one off its
    // default, so a key lost on the way would come back as the default and be seen
    const charts = {
      ...CHART_DEFAULTS,
      style: 'soft',
      gauge: 'dial',
      line: 'bold',
      glow: { offset: 7, opacity: 0.45 },
      fill: 24,
      grid: 'dashed',
      endpoint: 'dot',
      caps: 'top',
      now: 'line',
      wave: 'high',
      bubble: 'tone',
      series: 'sea',
      animate: false,
      // how much of the past, and how far apart a line's points (1.18)
      window: 4,
      points: '30m',
    } as const;
    expect(
      Object.entries(charts).filter(
        ([key, value]) =>
          JSON.stringify(value) === JSON.stringify(CHART_DEFAULTS[key as keyof typeof charts]),
      ),
    ).toEqual([]);
    const sea = {
      id: 'sea',
      name: 'Sea',
      colours: ['#1f5fbf', '#2a9d8f', '#6a4c93', '#e76f51', '#264653', '#8ab17d'],
    } as const;
    // a set that follows the palette: its colours named, a hex of its own among them
    const garden = {
      id: 'garden',
      name: 'Garden',
      colours: ['graph-1', 'accent', 'ok', 'solar', '#1f5fbf', 'graph-12'],
    } as const;
    await handle.store.saveHouse({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
      frame: false,
      charts,
      chartSets: [sea, garden],
      // the cards' surface travels too (1.15), and how one out of reach looks (1.16)
      cards: { opacity: 75, blur: false, unavailable: 'quiet' },
    });
    await handle.store.savePersonal({ language: 'es', haptics: false });
    await settle();
    // the file the browser would download
    let file: Blob | undefined;
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => ((file = blob), 'blob:fluvy');
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => undefined;
    const ops = panel as unknown as { context(): PanelContext };
    exportSettings(panel as unknown as FluvyPanel, ops.context());
    URL.createObjectURL = create;
    HTMLAnchorElement.prototype.click = click;
    const exported = JSON.parse(await file!.text()) as Record<string, Record<string, unknown>>;
    expect(exported['fluvy']).toBe(1);
    expect(exported['house']).toMatchObject({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
      frame: false,
      charts,
      chartSets: [sea, garden],
      cards: { opacity: 75, blur: false, unavailable: 'quiet' },
    });
    expect(exported['personal']).toMatchObject({ language: 'es', haptics: false });
    expect(exported['dashboards']).toEqual({
      'fluvy-auto': { thermostat_variant: 'ruler', hide: ['media'], caps },
    });
    // another house, reset; the file brings it all back
    await handle.store.saveHouse({
      palette: 'linen',
      shape: 'soft',
      pills: 'round',
      frame: true,
      charts: CHART_DEFAULTS,
      chartSets: [],
      cards: { opacity: 100, blur: true, unavailable: 'dashed' },
    });
    await handle.store.savePersonal({ language: 'auto', haptics: true });
    importSettings(
      panel as unknown as FluvyPanel,
      new File([JSON.stringify(exported)], 'fluvy-settings.json'),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handle.settings().look).toEqual({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
      tabs: TABS_DEFAULTS,
      chrome: CHROME_DEFAULTS,
    });
    expect(handle.settings().frame).toBe(false);
    expect(handle.settings().language).toBe('es');
    expect(handle.settings().charts).toEqual(charts);
    expect(handle.store.house.chartSets).toEqual([sea, garden]);
    expect(handle.settings().cards).toEqual({ opacity: 75, blur: false, unavailable: 'quiet' });
    expect(saved.at(-1)?.config).toEqual({
      strategy: { type: 'custom:fluvy-home', thermostat_variant: 'ruler', hide: ['media'], caps },
    });
    // a 1.2 file names only the home dashboard's options: they land on it too
    importSettings(
      panel as unknown as FluvyPanel,
      new File(
        [JSON.stringify({ fluvy: 1, dashboard: { tile_size: 'compact', flow_style: 'legs' } })],
        'fluvy-settings.json',
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(saved.at(-1)?.config).toEqual({
      strategy: { type: 'custom:fluvy-home', tile_size: 'compact', flow_style: 'legs' },
    });
    panel.remove();
  });

  it('attaches to the look when it starts after the panel is made (Home Assistant makes it first)', async () => {
    await import('./define.js');
    const f = fixture();
    const panel = document.createElement('fluvy-panel') as HTMLElement & {
      hass: HomeAssistant;
      handle: LookHandle;
      updateComplete: Promise<boolean>;
    };
    document.body.append(panel);
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector('.pn-card')).toBeNull();
    panel.handle = f.handle;
    panel.hass = f.hass;
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector('.pn-card')).not.toBeNull();
    panel.remove();
  });

  it('ends a look tried on the whole app when the panel closes', async () => {
    const { panel, root, previews } = await mount();
    // the preview's switch: "Try it on the whole app"
    const toggle = root.querySelector<HTMLElement>(
      '.pn-card--preview :is(.fv-switch, [role="switch"])',
    );
    toggle?.click();
    await panel.updateComplete;
    expect(previews.at(-1)).toEqual({
      look: {
        palette: 'linen',
        shape: 'soft',
        pills: 'round',
        tabs: TABS_DEFAULTS,
        chrome: CHROME_DEFAULTS,
      },
    });
    panel.remove();
    expect(previews.at(-1)).toBeNull();
  });
});
