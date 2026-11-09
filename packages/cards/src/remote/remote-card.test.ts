// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { familiesDefined } from '../index.js';
import { remoteHeight } from '../remote-family.js';
import { cardForm, drawEditor, listTitles, shownNames } from '../shared/fixtures/editor.js';
import { FluvyRemoteCard } from './remote-card.js';

// the index fetches the lazy families, this card's among them: they land before this file's page goes
beforeAll(() => familiesDefined);

const STAMP = '2026-11-09T20:00:00+00:00';
type Seed = readonly [id: string, state: string, attributes?: Record<string, unknown>];

/* media_player supported_features */
const TV = 1 | 4 | 8 | 16 | 32 | 128 | 256 | 2048 | 4096 | 16384;
const RECEIVER = 4 | 8 | 128 | 256;

interface Call {
  readonly service: string;
  readonly data: Record<string, unknown>;
  readonly target: { entity_id?: string } | undefined;
}

/** A house with the entities given, their integrations, and the services each card call sends. */
function house(
  seeds: readonly Seed[],
  platforms: Readonly<Record<string, string>> = {},
): { readonly hass: HomeAssistant; readonly calls: Call[] } {
  const calls: Call[] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: Object.fromEntries(
      seeds.map(([entity_id, state, attributes]) => [
        entity_id,
        {
          entity_id,
          state,
          attributes: { ...attributes },
          last_changed: STAMP,
          last_updated: STAMP,
        },
      ]),
    ),
    entities: Object.fromEntries(
      Object.entries(platforms).map(([entity_id, platform]) => [
        entity_id,
        { entity_id, platform },
      ]),
    ),
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callService: (
      domain: string,
      service: string,
      data: Record<string, unknown>,
      target: unknown,
    ) => {
      calls.push({ service: `${domain}.${service}`, data, target: target as Call['target'] });
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { hass, calls };
}

const LIVING: readonly Seed[] = [
  [
    'media_player.tv',
    'playing',
    {
      friendly_name: 'Living room TV',
      device_class: 'tv',
      app_name: 'Netflix',
      source: 'Netflix',
      source_list: ['HDMI 1', 'Netflix', 'YouTube', 'Disney+'],
      volume_level: 0.32,
      is_volume_muted: false,
      supported_features: TV,
    },
  ],
  ['remote.tv', 'on', { friendly_name: 'Living room TV' }],
  [
    'media_player.receiver',
    'on',
    {
      friendly_name: 'Receiver',
      volume_level: 0.4,
      is_volume_muted: false,
      supported_features: RECEIVER,
    },
  ],
  [
    'media_player.tv_off',
    'off',
    { friendly_name: 'Bedroom TV', supported_features: TV, volume_level: 0.2 },
  ],
  ['remote.tv_off', 'off', { friendly_name: 'Bedroom TV' }],
  [
    'media_player.lg',
    'on',
    { friendly_name: 'LG', source_list: ['HDMI 1'], volume_level: 0.2, supported_features: TV },
  ],
  ['media_player.gone', 'unavailable', { friendly_name: 'Den TV', supported_features: TV }],
  ['remote.gone', 'unavailable', { friendly_name: 'Den TV' }],
];
const ANDROID = {
  'media_player.tv': 'androidtv_remote',
  'remote.tv': 'androidtv_remote',
  'media_player.lg': 'webostv',
};

/** The card drawn in the page: its shadow root. */
async function draw(config: Record<string, unknown>, hass: HomeAssistant): Promise<ShadowRoot> {
  const card = document.createElement('fluvy-remote-card') as FluvyRemoteCard;
  card.setConfig({ ...config, type: 'custom:fluvy-remote-card' } as LovelaceCardConfig);
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve));
  await card.updateComplete;
  return card.shadowRoot!;
}

const press = async (root: ShadowRoot, label: string): Promise<void> => {
  const button = root.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  expect(button, label).not.toBeNull();
  button!.click();
  await new Promise((resolve) => setTimeout(resolve));
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('the TV remote card (#143)', () => {
  it('declares its heights by the config alone: 572 full, 144 compact, 276 pad, 76 row', () => {
    expect(remoteHeight({ type: 'x' })).toBe(572);
    expect(remoteHeight({ type: 'x', variant: 'compact' })).toBe(144);
    expect(remoteHeight({ type: 'x', variant: 'pad' })).toBe(276);
    expect(remoteHeight({ type: 'x', variant: 'row' })).toBe(76);
    expect(remoteHeight({ type: 'x', groups: ['dpad'] })).toBe(276);
    expect(remoteHeight({ type: 'x', groups: ['volume', 'channel'] })).toBe(64 + 88 + 88 + 20);
    // seven apps are two rows of six; six custom keys one row of 50 cells 4 apart, seven two rows
    expect(
      remoteHeight({ type: 'x', groups: ['apps'], apps: Array(7).fill({ app: 'netflix' }) }),
    ).toBe(64 + 16 + 68 + 76 + 20);
    expect(
      remoteHeight({ type: 'x', groups: ['custom'], custom: Array(6).fill({ name: 'k' }) }),
    ).toBe(64 + 16 + 44 + 20);
    expect(
      remoteHeight({ type: 'x', groups: ['custom'], custom: Array(7).fill({ name: 'k' }) }),
    ).toBe(64 + 16 + 44 + 16 + 44 + 20);
    expect(FluvyRemoteCard.layoutHeight({ type: 'x', variant: 'pad' })).toBe(276);
  });

  it('its stub takes the house’s first player and its first remote', () => {
    expect(FluvyRemoteCard.getStubConfig({}, ['light.a', 'remote.tv', 'media_player.tv'])).toEqual({
      type: 'custom:fluvy-remote-card',
      entity: 'media_player.tv',
      remote: 'remote.tv',
    });
  });

  it('draws the full anatomy: the power round, the sources, the ring with its four keys and OK, the transport, the volume, the apps', async () => {
    const { hass } = house(LIVING, ANDROID);
    const root = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', volume_entity: 'media_player.receiver' },
      hass,
    );
    expect(root.querySelector('.fv-card__head [aria-label="Turn off"]')).not.toBeNull();
    expect(root.querySelector('.fv-card__sub')?.textContent?.trim()).toBe('Netflix · Netflix');
    // the platforms among the sources go to the apps row; the inputs stay chips
    expect([...root.querySelectorAll('.fv-chip__pill')].map((c) => c.textContent?.trim())).toEqual([
      'HDMI 1',
    ]);
    expect(root.querySelectorAll('.rm-arrow').length).toBe(4);
    expect(root.querySelector('.rm-ok')?.textContent?.trim()).toBe('OK');
    expect(root.querySelectorAll('.rm-pad__key').length).toBe(4);
    expect(root.querySelectorAll('.rm-transport .fv-round').length).toBe(3);
    expect(
      [...root.querySelectorAll('.rm-label span')].map((span) => span.textContent?.trim()),
    ).toEqual(['Volume · Receiver', '40 %']);
    expect(root.querySelector('fluvy-ruler')).not.toBeNull();
    expect([...root.querySelectorAll('.rm-app__name')].map((n) => n.textContent)).toEqual([
      'Netflix',
      'YouTube',
      'Disney+',
    ]);
    expect(root.querySelector('.rm-app.is-active .rm-app__name')?.textContent).toBe('Netflix');
  });

  it('a key goes to the remote as its integration takes it; the power and the volume to the players’ own services', async () => {
    const { hass, calls } = house(LIVING, ANDROID);
    const root = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', volume_entity: 'media_player.receiver' },
      hass,
    );
    await press(root, 'OK');
    await press(root, 'Home');
    await press(root, 'Turn off');
    await press(root, 'Mute');
    expect(calls.map((c) => c.service)).toEqual([
      'remote.send_command',
      'remote.send_command',
      'media_player.turn_off',
      'media_player.volume_mute',
    ]);
    expect(calls[0]!.data).toEqual({ command: 'DPAD_CENTER' });
    expect(calls[0]!.target).toEqual({ entity_id: 'remote.tv' });
    expect(calls[1]!.data).toEqual({ command: 'HOME' });
    expect(calls[3]!.target).toEqual({ entity_id: 'media_player.receiver' });
    // an app opens its source on the player
    root.querySelector<HTMLButtonElement>('.rm-app__circle')!.click();
    expect(calls.at(-1)).toMatchObject({
      service: 'media_player.select_source',
      data: { source: 'Netflix' },
    });
  });

  it('a webOS television takes its buttons on the player itself; a command of the config’s wins over the table', async () => {
    const { hass, calls } = house(LIVING, ANDROID);
    const root = await draw({ entity: 'media_player.lg', commands: { back: 'EXIT' } }, hass);
    await press(root, 'OK');
    await press(root, 'Back');
    expect(calls.map((c) => `${c.service}:${c.data['button']}`)).toEqual([
      'webostv.button:ENTER',
      'webostv.button:EXIT',
    ]);
    expect(calls[0]!.target).toEqual({ entity_id: 'media_player.lg' });
  });

  it('a television that is off: the power round on the primary fill, every key alive, or power alone', async () => {
    const { hass, calls } = house(LIVING, { 'remote.tv_off': 'samsungtv' });
    const live = await draw({ entity: 'media_player.tv_off', remote: 'remote.tv_off' }, hass);
    expect(
      live.querySelector('[aria-label="Turn on"]')?.classList.contains('fv-round--accent'),
    ).toBe(true);
    expect(live.querySelector<HTMLButtonElement>('[aria-label="Home"]')?.disabled).toBe(false);
    await press(live, 'Home');
    expect(calls.at(-1)).toMatchObject({
      service: 'remote.send_command',
      data: { command: 'KEY_HOME' },
    });
    await press(live, 'Turn on');
    expect(calls.at(-1)?.service).toBe('media_player.turn_on');
    document.body.replaceChildren();
    const power = await draw(
      { entity: 'media_player.tv_off', remote: 'remote.tv_off', off_keys: 'power' },
      hass,
    );
    expect(power.querySelector<HTMLButtonElement>('[aria-label="Home"]')?.disabled).toBe(true);
    expect(power.querySelector<HTMLButtonElement>('[aria-label="Turn on"]')?.disabled).toBe(false);
  });

  it('out of reach it keeps its anatomy in the dashed skin and answers nothing', async () => {
    const { hass, calls } = house(LIVING, { 'remote.gone': 'androidtv_remote' });
    const root = await draw(
      {
        entity: 'media_player.gone',
        remote: 'remote.gone',
        volume_entity: 'media_player.receiver',
      },
      hass,
    );
    expect(root.querySelector('.fv-card')?.classList.contains('is-off')).toBe(true);
    expect(root.querySelectorAll('.rm-arrow').length).toBe(4);
    expect(root.querySelector('fluvy-ruler')).not.toBeNull();
    root.querySelector<HTMLButtonElement>('.rm-ok')!.click();
    expect(calls).toEqual([]);
  });

  it('the compact row, the pad and the row: their keys, and the row’s rounds', async () => {
    const { hass } = house(LIVING, ANDROID);
    const compact = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', variant: 'compact' },
      hass,
    );
    expect(
      [...compact.querySelectorAll('.rm-cells .fv-action')].map((b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['Back', 'Home', 'Play or pause', 'Volume down', 'Volume up']);
    document.body.replaceChildren();
    const pad = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', variant: 'pad' },
      hass,
    );
    expect(pad.querySelectorAll('.rm-ring').length).toBe(1);
    expect(pad.querySelector('.rm-transport')).toBeNull();
    document.body.replaceChildren();
    const row = await draw(
      { entity: 'media_player.tv', remote: 'remote.tv', variant: 'row' },
      hass,
    );
    expect(
      [...row.querySelectorAll('.rm-row__rounds .fv-round')].map((b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['Back', 'Home', 'Turn off']);
  });

  describe('the editor', () => {
    const shown = async (config: Record<string, unknown>): Promise<string[]> => {
      const editor = await FluvyRemoteCard.getConfigElement();
      const drawn = await drawEditor(editor, {
        ...config,
        type: 'custom:fluvy-remote-card',
      } as LovelaceCardConfig);
      return shownNames(cardForm(drawn).schema);
    };

    it('the full card offers its groups, its pad, its volume and its apps; the compact its keys, the row its rounds', async () => {
      const full = await shown({ entity: 'media_player.tv' });
      for (const name of [
        'groups',
        'dpad',
        'ok_label',
        'side_keys',
        'nav',
        'transport',
        'volume',
        'apps_style',
        'apps_tint',
        'off_keys',
        'commands',
      ])
        expect(full, name).toContain(name);
      expect(full).not.toContain('keys');
      const compact = await shown({ entity: 'media_player.tv', variant: 'compact' });
      expect(compact).toContain('keys');
      expect(compact).not.toContain('dpad');
      const row = await shown({ entity: 'media_player.tv', variant: 'row' });
      expect(row).toContain('controls');
      // the keys round a grid are no "sides": the field goes
      const grid = await shown({ entity: 'media_player.tv', dpad: 'grid' });
      expect(grid).not.toContain('side_keys');
    });

    it('lists the apps and the custom keys while their groups are drawn', async () => {
      const editor = await FluvyRemoteCard.getConfigElement();
      const drawn = await drawEditor(editor, {
        type: 'custom:fluvy-remote-card',
        entity: 'media_player.tv',
        groups: ['dpad', 'apps', 'custom'],
      });
      expect(listTitles(drawn)).toEqual(['Apps', 'Custom keys']);
      const padOnly = await drawEditor(await FluvyRemoteCard.getConfigElement(), {
        type: 'custom:fluvy-remote-card',
        entity: 'media_player.tv',
        groups: ['dpad'],
      });
      expect(listTitles(padOnly)).toEqual([]);
    });
  });
});
