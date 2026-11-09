// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  areaContents,
  areaEntities,
  LANGUAGE_CODES,
  plural,
  preloadLanguages,
  type HomeAssistant,
} from '@fluvy/core';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, listTitles, shownNames } from '../shared/fixtures/editor.js';
import { FluvyRoomCard, loadQuickActions, roomHeight, type RoomCardConfig } from './room-card.js';
import * as roomEditor from './room-editor.js';

// the index fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);

/*
 * #39: a room finds what is in it. The reporter's four areas, each one temperature and one humidity sensor and nothing
 * else: two plain, one whose sensors are diagnostic and named by the area, one whose sensors are hidden; and the
 * shapes around them — a thermostat alone, a dead sensor first, entries the registry has and the house has no state
 * for, a sensor whose state comes after the first draw.
 */

type Seed = readonly [id: string, state: string, attributes?: Record<string, unknown>];
const STAMP = '2026-10-17T19:00:00+00:00';
const states = (seeds: readonly Seed[]) =>
  Object.fromEntries(
    seeds.map(([entity_id, state, attributes]) => [
      entity_id,
      { entity_id, state, attributes: attributes ?? {}, last_changed: STAMP, last_updated: STAMP },
    ]),
  );
const temperature = (id: string, value: string): Seed => [
  id,
  value,
  { device_class: 'temperature', unit_of_measurement: '°C' },
];
const humidity = (id: string, value: string): Seed => [
  id,
  value,
  { device_class: 'humidity', unit_of_measurement: '%' },
];

const SEEDS: readonly Seed[] = [
  temperature('sensor.garten_t', '16.4'),
  humidity('sensor.garten_h', '92'),
  temperature('sensor.kuche_t', '21.4'),
  humidity('sensor.kuche_h', '48'),
  temperature('sensor.wohnzimmer_t', '20.5'),
  humidity('sensor.wohnzimmer_h', '45'),
  ['climate.buero', 'heat', { current_temperature: 20.5, current_humidity: 44, temperature: 21 }],
  temperature('sensor.flur_a', 'unavailable'),
  temperature('sensor.flur_b', '19.8'),
  ['light.keller', 'off', {}],
];

/** Registry entries: the area each is in, and how dashboards treat it. */
const ENTRIES: Record<string, Record<string, unknown>> = {
  'sensor.garten_t': { area_id: 'garten' },
  'sensor.garten_h': { area_id: 'garten' },
  'sensor.kuche_t': { area_id: 'kuche', entity_category: 'diagnostic' },
  'sensor.kuche_h': { area_id: 'kuche', entity_category: 'diagnostic' },
  'sensor.wohnzimmer_t': { area_id: 'wohnzimmer', hidden: true },
  'sensor.wohnzimmer_h': { area_id: 'wohnzimmer', hidden: true },
  'climate.buero': { area_id: 'buero' },
  'sensor.flur_a': { area_id: 'flur' },
  'sensor.flur_b': { area_id: 'flur' },
  // entries the house has no state for: neither shown nor counted
  'sensor.speicher_t': { area_id: 'speicher' },
  'sensor.speicher_h': { area_id: 'speicher', hidden: true },
  // a sensor that comes late
  'sensor.spaet_t': { area_id: 'spaet' },
  'light.keller': { area_id: 'keller' },
};

const area = (area_id: string, name: string, more: Record<string, unknown> = {}) => ({
  area_id,
  name,
  picture: null,
  icon: null,
  ...more,
});

const registries = {
  entities: Object.fromEntries(
    Object.entries(ENTRIES).map(([entity_id, entry]) => [entity_id, { entity_id, ...entry }]),
  ),
  devices: {},
  areas: {
    garten: area('garten', 'Garten'),
    kuche: area('kuche', 'Küche', {
      temperature_entity_id: 'sensor.kuche_t',
      humidity_entity_id: 'sensor.kuche_h',
    }),
    wohnzimmer: area('wohnzimmer', 'Wohnzimmer'),
    buero: area('buero', 'Büro'),
    flur: area('flur', 'Flur'),
    speicher: area('speicher', 'Speicher'),
    spaet: area('spaet', 'Später'),
    leer: area('leer', 'Leer'),
    keller: area('keller', 'Keller'),
  },
};

const house = (seeds: readonly Seed[] = SEEDS, admin = true): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: states(seeds),
    ...registries,
    user: { id: 'u1', name: 'Marta', is_admin: admin },
    config: { unit_system: { temperature: '°C', length: 'km' } },
    themes: { darkMode: false, themes: {} },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
  }) as unknown as HomeAssistant;

type RoomElement = HTMLElement & {
  setConfig(config: RoomCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

/** The reporter's card: the photo variant, tiles under it, no count. */
const REPORTER = { variant: 'photo', controls: 'tiles', show_count: false } as const;

async function room(
  config: Partial<RoomCardConfig> & { area: string },
  hass: HomeAssistant = house(),
): Promise<RoomElement> {
  const card = document.createElement('fluvy-room-card') as RoomElement;
  card.setConfig({ type: 'custom:fluvy-room-card', ...config });
  card.hass = hass;
  (card as unknown as { width: number }).width = 360;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const root = (card: RoomElement): ShadowRoot => card.shadowRoot!;
const readouts = (card: RoomElement): string[] =>
  [...root(card).querySelectorAll('.am-area__stats .fv-readout__value')].map((el) =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
const hint = (card: RoomElement): string | undefined =>
  root(card).querySelector('.fv-empty-state__hint')?.textContent?.trim();

describe('a room finds what is in it (#39)', () => {
  afterEach(() => document.body.replaceChildren());

  it('reads a plain room: its photo and its two readings', async () => {
    const card = await room({ area: 'garten', ...REPORTER });
    expect(root(card).querySelector('.rm-hero')).not.toBeNull();
    expect(readouts(card)).toEqual(['16.4°C', '92%']);
    expect(root(card).querySelector('.fv-empty-state')).toBeNull();
  });

  it('reads the sensors the area names, even diagnostic ones', async () => {
    const card = await room({ area: 'kuche', ...REPORTER });
    expect(readouts(card)).toEqual(['21.4°C', '48%']);
  });

  it('keeps a room whose sensors are hidden as a room: its photo, then why it is empty', async () => {
    const card = await room({ area: 'wohnzimmer', ...REPORTER });
    expect(root(card).querySelector('.rm-hero')).not.toBeNull();
    expect(root(card).querySelector('.fv-empty-state__text')?.textContent?.trim()).toBe(
      'Nothing in this room yet',
    );
    expect(hint(card)).toBe(
      '2 hidden or diagnostic entities · choose its sensors in the area’s settings',
    );
  });

  it('tells only an administrator why', async () => {
    const card = await room({ area: 'wohnzimmer', ...REPORTER }, house(SEEDS, false));
    expect(root(card).querySelector('.fv-empty-state')).not.toBeNull();
    expect(hint(card)).toBeUndefined();
  });

  it('never counts what the registry has and the house has no state for', async () => {
    const card = await room({ area: 'speicher', ...REPORTER });
    expect(root(card).querySelector('.fv-empty-state')).not.toBeNull();
    expect(hint(card)).toBeUndefined();
    const bare = await room({ area: 'leer' });
    expect(hint(bare)).toBeUndefined();
  });

  it('draws the readings its config names, in a room that shows nothing', async () => {
    const card = await room({
      area: 'wohnzimmer',
      ...REPORTER,
      temperature_entity: 'sensor.garten_t',
    });
    expect(readouts(card)).toEqual(['16.4°C']);
    expect(root(card).querySelector('.fv-empty-state')).toBeNull();
  });

  it('draws the tiles asked for in an empty room, only where its controls are tiles', async () => {
    const tiles = [{ entity: 'light.keller' }];
    const asked = await room({ area: 'leer', controls: 'tiles', tiles });
    expect(root(asked).querySelectorAll('.rm-controls .fv-tile').length).toBe(1);
    expect(root(asked).querySelector('.fv-empty-state')).toBeNull();
    const rows = await room({ area: 'leer', tiles });
    expect(root(rows).querySelector('.rm-controls')).toBeNull();
    expect(root(rows).querySelector('.fv-empty-state')).not.toBeNull();
  });

  it('declares the tiles it draws: an empty list of them is its controls, as no list is', async () => {
    const hass = house();
    const holds = (area: string) => ({
      found: areaContents(hass, area),
      picture: false,
      admin: true,
    });
    for (const area of ['keller', 'leer'])
      for (const variant of ['photo', 'tile'] as const) {
        const config = { type: 'x', area, variant, controls: 'tiles' } as const;
        const says = `${area} ${variant}`;
        expect(roomHeight({ ...config, tiles: [] }, holds(area)), says).toBe(
          roomHeight(config, holds(area)),
        );
        expect(roomHeight({ ...config, tiles: [] }), says).toBe(roomHeight(config));
      }
    // the cellar's one light, a tile under its head (20 + 44 + 16 + 84 + 20); the empty room's panel
    expect(
      roomHeight(
        { type: 'x', area: 'keller', variant: 'tile', controls: 'tiles', tiles: [] },
        holds('keller'),
      ),
    ).toBe(184);
    const cellar = await room({ area: 'keller', variant: 'tile', controls: 'tiles', tiles: [] });
    expect(root(cellar).querySelectorAll('.rm-controls .fv-tile').length).toBe(1);
    const empty = await room({ area: 'leer', variant: 'tile', controls: 'tiles', tiles: [] });
    expect(root(empty).querySelector('.fv-empty-state')).not.toBeNull();
  });

  it('reads a thermostat-only room from the thermostat', async () => {
    const card = await room({ area: 'buero', ...REPORTER });
    expect(readouts(card)).toEqual(['20.5°C', '44%']);
    const tile = await room({ area: 'buero', variant: 'tile', show_count: false });
    expect(root(tile).querySelector('.fv-card__sub')?.textContent?.trim()).toBe('20.5°');
  });

  it('counts what is on as its rows do: a heating thermostat is on in the readout, the line and the rows alike', async () => {
    // the readout once counted the lights, switches, covers and fans that were on over everything it showed ("Devices
    // on 0 of 1") above the rows' "All devices · 1 of 1 on"
    const card = await room({ area: 'buero', variant: 'photo' });
    expect(readouts(card)).toEqual(['20.5°C', '44%', '1of 1']);
    const all = [...root(card).querySelectorAll('.am-rows .fv-row')].at(-1)!;
    expect(all.querySelector('.fv-row__sub')?.textContent?.trim()).toBe('1 of 1 on');
    const tile = await room({ area: 'buero', variant: 'tile' });
    expect(root(tile).querySelector('.fv-card__sub')?.textContent?.trim()).toBe(
      '1 of 1 on · 20.5°',
    );
    // nothing on is nothing on, in both
    const off = await room({ area: 'keller', variant: 'photo' });
    expect(readouts(off)).toEqual(['0of 1']);
    expect(
      [...root(off).querySelectorAll('.am-rows .fv-row__sub')].map((el) => el.textContent?.trim()),
    ).toEqual(['1 device', '1 device']);
  });

  it('reads the sensor that works when the first one is dead', async () => {
    const card = await room({ area: 'flur', ...REPORTER });
    expect(readouts(card)).toEqual(['19.8°C']);
  });

  it('carries the climate in the line of a row and a tile', async () => {
    const row = await room({ area: 'kuche', variant: 'row' });
    expect(root(row).querySelector('.fv-tile__state')?.textContent?.trim()).toBe('21.4°');
    const tile = await room({ area: 'kuche', variant: 'tile' });
    expect(root(tile).querySelector('.fv-card__sub')?.textContent?.trim()).toBe('21.4°');
    expect(root(tile).querySelector('.fv-empty-state')).toBeNull();
  });

  it('hides its arrows where asked, a tap still opening the room (#151)', async () => {
    const went: string[] = [];
    const listen = (): void => void went.push(window.location.pathname);
    window.addEventListener('location-changed', listen);
    try {
      const path = '/fluvy-home/room-leer';
      const shown = await room({ area: 'leer', variant: 'tile', path });
      expect(root(shown).querySelector('.fv-head__open')).not.toBeNull();
      const hidden = await room({ area: 'leer', variant: 'tile', path, show_arrow: false });
      expect(root(hidden).querySelector('.fv-head__open')).toBeNull();
      root(hidden).querySelector<HTMLElement>('.fv-card__tap')!.click();
      expect(went.at(-1)).toBe(path);
    } finally {
      window.removeEventListener('location-changed', listen);
    }
  });

  it('keeps an empty card’s way in: its tap, its hold and its chevron', async () => {
    const went: string[] = [];
    const listen = (): void => void went.push(window.location.pathname);
    window.addEventListener('location-changed', listen);
    try {
      const actions = {
        path: '/fluvy-home/room-leer',
        hold_action: { action: 'navigate', navigation_path: '/hold' },
      } as const;
      const tile = await room({ area: 'leer', variant: 'tile', ...actions });
      const head = root(tile).querySelector('.fv-card__head')!;
      expect(head.classList.contains('fv-card__head--hold')).toBe(true);
      expect(root(tile).querySelector('.fv-head__open')).not.toBeNull();
      root(tile).querySelector<HTMLElement>('.fv-card__tap')!.click();
      expect(went.at(-1)).toBe('/fluvy-home/room-leer');
      const photo = await room({ area: 'leer', variant: 'photo', ...actions });
      const cover = root(photo).querySelector<HTMLElement & { fvHold?: () => void }>(
        '.rm-hero .fv-tile__tap',
      )!;
      expect(cover.fvHold).toBeTypeOf('function');
      expect(root(photo).querySelector('.rm-hero + .fv-empty-state')).not.toBeNull();
    } finally {
      window.removeEventListener('location-changed', listen);
    }
  });

  it('fills the room when a sensor comes late, with the same registries', async () => {
    const early = house();
    const card = await room({ area: 'spaet', ...REPORTER }, early);
    expect(root(card).querySelector('.fv-empty-state')).not.toBeNull();
    card.hass = house([...SEEDS, temperature('sensor.spaet_t', '18.2')]);
    await card.updateComplete;
    expect(readouts(card)).toEqual(['18.2°C']);
  });

  it('is never starved by an earlier reader that saw fewer states (the automatic dashboard while Home Assistant starts)', async () => {
    const partial = house(SEEDS.filter(([id]) => !id.startsWith('sensor.garten')));
    expect(areaEntities(partial, 'garten')).toEqual([]);
    const card = await room({ area: 'garten', ...REPORTER });
    expect(readouts(card)).toEqual(['16.4°C', '92%']);
  });

  it('shows in the editor the variant it draws and the readings it found', () => {
    const defaults = roomEditor.defaults(
      { type: 'custom:fluvy-room-card', area: 'kuche' },
      house(),
    );
    expect(defaults).toMatchObject({
      variant: 'tile',
      temperature_entity: 'sensor.kuche_t',
      humidity_entity: 'sensor.kuche_h',
    });
    const pictured = roomEditor.defaults(
      { type: 'custom:fluvy-room-card', area: 'garten', picture: '/local/garten.jpg' },
      house(),
    );
    expect(pictured['variant']).toBe('photo');
  });

  it('is offered with a room that holds something', () => {
    expect(FluvyRoomCard.getStubConfig(house(), []).area).toBe('buero');
  });
});

describe('a room counts its devices, never an appliance’s controls (#95)', () => {
  afterEach(() => document.body.replaceChildren());

  /**
   * The reporter's kitchen: two lights, and a dishwasher of an integration the appliance card does not read
   * (an ESPHome build), whose options are switches beside its programme, its delay and its start.
   */
  const KITCHEN: readonly Seed[] = [
    ['light.kitchen_ceiling', 'on'],
    ['light.kitchen_counter', 'off'],
    ['switch.dishwasher_power', 'on'],
    ['switch.dishwasher_extra_dry', 'on'],
    ['switch.dishwasher_sanitize', 'off'],
    ['select.dishwasher_course', 'eco', { options: ['eco', 'auto'] }],
    ['number.dishwasher_delay_start', '0', { min: 0, max: 24 }],
    ['button.dishwasher_start', 'unknown'],
    ['sensor.dishwasher_remaining', '42', { unit_of_measurement: 'min' }],
    ['binary_sensor.dishwasher_door', 'on', { device_class: 'door' }],
  ];
  const kitchen = (ceiling = 'on'): HomeAssistant => {
    const seeds = KITCHEN.map((seed): Seed =>
      seed[0] === 'light.kitchen_ceiling' ? [seed[0], ceiling] : seed,
    );
    const hass = house([...SEEDS, ...seeds]);
    const entries = KITCHEN.map(([entity_id]) => [
      entity_id,
      entity_id.includes('dishwasher')
        ? { entity_id, device_id: 'dishwasher', platform: 'esphome' }
        : { entity_id, area_id: 'kitchen' },
    ]);
    return {
      ...hass,
      entities: { ...hass.entities, ...Object.fromEntries(entries) },
      devices: {
        dishwasher: {
          id: 'dishwasher',
          area_id: 'kitchen',
          name: 'Dishwasher',
          name_by_user: null,
        },
      },
      areas: { ...hass.areas, kitchen: area('kitchen', 'Kitchen') },
    } as HomeAssistant;
  };

  it('counts its lights: the readout, the line and the rows say "1 of 2 on" where they said "5 of 10"', async () => {
    const card = await room({ area: 'kitchen', variant: 'photo' }, kitchen());
    expect(readouts(card)).toEqual(['1of 2']);
    const all = [...root(card).querySelectorAll('.am-rows .fv-row')].at(-1)!;
    expect(all.querySelector('.fv-row__sub')?.textContent?.trim()).toBe('1 of 2 on');
    const row = await room({ area: 'kitchen', variant: 'row' }, kitchen());
    expect(root(row).querySelector('.fv-tile__state')?.textContent?.trim()).toBe('1 of 2 on');
    // its tiles are its lights, never a dishwasher's option
    const tiles = await room({ area: 'kitchen', variant: 'tile', controls: 'tiles' }, kitchen());
    expect(root(tiles).querySelectorAll('.rm-controls .fv-tile')).toHaveLength(2);
  });

  it('is off while its lights are, whatever the dishwasher’s options and door say', async () => {
    const row = await room({ area: 'kitchen', variant: 'row' }, kitchen('off'));
    expect(root(row).querySelector('.rm-tile')?.classList.contains('is-on')).toBe(false);
    expect(root(row).querySelector('.fv-tile__state')?.textContent?.trim()).toBe('2 devices');
  });
});

describe('a room of sensors alone', () => {
  afterEach(() => document.body.replaceChildren());

  it('shows its readings and no row of the devices it has none of, and declares as much', async () => {
    for (const variant of ['photo', 'tile'] as const) {
      const card = await room({ area: 'garten', variant });
      expect(root(card).querySelector('.am-rows'), variant).toBeNull();
      expect(root(card).querySelector('.fv-empty-state'), variant).toBeNull();
    }
    const hass = house();
    const found = areaContents(hass, 'garten');
    // the house's height: the photo's hero and its readouts, the tile's head, and nothing under them
    expect(
      roomHeight(
        { type: 'x', area: 'garten', variant: 'photo' },
        { found, picture: false, admin: true },
      ),
    ).toBe(160 + 64 + 20);
    expect(
      roomHeight(
        { type: 'x', area: 'garten', variant: 'tile' },
        { found, picture: false, admin: true },
      ),
    ).toBe(20 + 44 + 20);
  });
});

/** A room drawn at `width` on a stub ruler: what happy-dom cannot lay out. */
async function roomAt(
  config: Partial<RoomCardConfig> & { area: string },
  width: number,
  ruler: { width: (cls: string, text: string) => number },
  hass: HomeAssistant = house(),
): Promise<RoomElement> {
  const card = document.createElement('fluvy-room-card') as RoomElement;
  Object.assign((card as unknown as { headFit: object }).headFit, {
    ruler: {
      ...ruler,
      pill: (_cls: string, text: string, pad: number) => text.length * 8 + pad,
      clear() {},
    },
  });
  card.setConfig({ type: 'custom:fluvy-room-card', ...config });
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

describe('a room in a narrow column', () => {
  afterEach(() => document.body.replaceChildren());

  it('gives its tile head’s circle to a name that would be cut beside it, as every head does', async () => {
    // 8 px a glyph: "Wohnzimmer" (80) beside the circle and the chevron at 211 has 171 − 56 − 48 = 67; without the
    // circle, 123
    const ruler = { width: (_cls: string, text: string) => text.length * 8 };
    const narrow = await roomAt({ area: 'wohnzimmer', variant: 'tile' }, 211, ruler);
    const head = root(narrow).querySelector('.fv-card__head')!;
    expect(head.querySelector('.fv-ico')).toBeNull();
    expect(head.querySelector('.fv-card__title')?.textContent?.trim()).toBe('Wohnzimmer');
    expect(head.querySelector('.fv-card__tap')?.hasAttribute('title')).toBe(false);
    // a name that holds beside it keeps the circle, and so does every name in a wide column
    const short = await roomAt({ area: 'flur', variant: 'tile' }, 211, ruler);
    expect(root(short).querySelector('.fv-card__head .fv-ico')).not.toBeNull();
    const wide = await roomAt({ area: 'wohnzimmer', variant: 'tile' }, 360, ruler);
    expect(root(wide).querySelector('.fv-card__head .fv-ico')).not.toBeNull();
    // never asked for, never drawn
    const none = await roomAt({ area: 'flur', variant: 'tile', show_icon: 'never' }, 360, ruler);
    expect(root(none).querySelector('.fv-card__head .fv-ico')).toBeNull();
  });

  it('keeps an administrator’s hint to three lines at 211 in every language: the why, the way out left out where the whole runs past them', async () => {
    await preloadLanguages();
    // the ruler as a browser's: a class's measure caps its probe, as the hint's 380 does — the room measures the hint's
    // whole line (7 px a glyph, 14 a kana or kanji), so a long one is never taken for three lines it would run past
    const glyphs = (text: string): number =>
      [...text].reduce((sum, ch) => sum + (/[\u3000-\u9fff]/u.test(ch) ? 14 : 7), 0);
    const ruler = {
      width: (cls: string, text: string) =>
        (cls === 'fv-empty-state__hint' ? Math.min(glyphs(text), 380) : glyphs(text)) + 1,
    };
    for (const language of LANGUAGE_CODES) {
      const hass = { ...house(), language, locale: { language, number_format: 'language' } };
      const full = plural(hass as HomeAssistant, 'room.kept_out', 2);
      const why = full.split(' · ')[0]!;
      const narrow = await roomAt(
        { area: 'wohnzimmer', ...REPORTER },
        211,
        ruler,
        hass as HomeAssistant,
      );
      // three lines of 211's 139 less what wrapping by words loses: 389 — Chinese says the whole in that
      expect(hint(narrow), language).toBe(glyphs(full) + 1 <= 389 ? full : why);
      expect(glyphs(why) + 1, language).toBeLessThanOrEqual(389);
      const wide = await roomAt(
        { area: 'wohnzimmer', ...REPORTER },
        360,
        ruler,
        hass as HomeAssistant,
      );
      expect(hint(wide), language).toBe(full);
      document.body.replaceChildren();
    }
  });
});

describe('the room card’s editor offers what acts in the room’s style (#58)', () => {
  const editor = async (config: Record<string, unknown>) => {
    const element = await FluvyRoomCard.getConfigElement();
    (element as HTMLElement & { hass: HomeAssistant }).hass = house();
    return drawEditor(element, { type: 'custom:fluvy-room-card', area: 'garten', ...config });
  };
  const shown = async (config: Record<string, unknown>): Promise<string[]> =>
    shownNames(cardForm(await editor(config)).schema);
  afterEach(() => document.body.replaceChildren());

  it('a row draws neither controls, tiles, a picture nor the lights’ colours: none of them is offered', async () => {
    const photo = await shown({ variant: 'photo', controls: 'tiles' });
    for (const name of ['controls', 'picture', 'tint', 'light_colors'])
      expect(photo).toContain(name);
    const row = await shown({ variant: 'row', controls: 'tiles', light_colors: true });
    for (const name of ['controls', 'picture', 'tint', 'light_colors', 'light_whites'])
      expect(row).not.toContain(name);
    // what a row does draw stays: its line, its way in
    for (const name of ['show_climate', 'show_count', 'path']) expect(row).toContain(name);
    // its quick actions it draws in every variant, unless it hides them
    expect(listTitles(await editor({ variant: 'row', controls: 'tiles' }))).toEqual([
      'Quick actions',
    ]);
    expect(listTitles(await editor({ variant: 'row', show_quick_actions: false }))).toEqual([]);
  });

  it('the tiles and their colour at rest with tiles alone; the lights’ colours wherever lights are drawn', async () => {
    const rows = await editor({ variant: 'tile' });
    expect(shownNames(cardForm(rows).schema)).not.toContain('tint');
    expect(shownNames(cardForm(rows).schema)).toContain('light_colors');
    expect(listTitles(rows)).toEqual(['Quick actions']);
    const tiles = await editor({ variant: 'tile', controls: 'tiles' });
    expect(shownNames(cardForm(tiles).schema)).toContain('tint');
    expect(listTitles(tiles)).toEqual(['Tiles', 'Quick actions']);
    expect(await shown({ variant: 'tile', controls: 'none' })).not.toContain('light_colors');
  });

  it('a picture for the photo alone: its default where the room has one or the card names one', async () => {
    expect(await shown({ variant: 'tile', controls: 'tiles' })).not.toContain('picture');
    expect(await shown({ variant: 'tile', picture: '/local/garden.jpg' })).not.toContain('picture');
    expect(await shown({ variant: 'photo' })).toContain('picture');
    // no variant: the photo where the card names a picture, the tile where nothing does
    expect(await shown({ picture: '/local/garden.jpg' })).toContain('picture');
    expect(await shown({})).not.toContain('picture');
  });

  it('a name in two lines where a compact tile is drawn: its tiles, or the row (#100)', async () => {
    expect(await shown({ variant: 'tile', controls: 'tiles' })).toContain('name_lines');
    expect(await shown({ variant: 'row' })).toContain('name_lines');
    expect(await shown({ variant: 'tile' })).not.toContain('name_lines');
    expect(await shown({ variant: 'photo', controls: 'none' })).not.toContain('name_lines');
    // each tile, and the row, a line taller, from the config alone
    const tiles: RoomCardConfig = {
      type: 'custom:fluvy-room-card',
      area: 'garten',
      variant: 'tile',
      controls: 'tiles',
    };
    expect(
      FluvyRoomCard.layoutHeight({ ...tiles, name_lines: 2 }) - FluvyRoomCard.layoutHeight(tiles),
    ).toBe(2 * 12);
    expect(FluvyRoomCard.layoutHeight({ ...tiles, variant: 'row', name_lines: '2' })).toBe(88);
  });

  it('never the size and the readouts it never read (their YAML keys stay, ignored)', async () => {
    const names = await shown({ variant: 'tile', size: 'mini', readouts: ['sensor.garten_t'] });
    expect(names).not.toContain('size');
    expect(names).not.toContain('readouts');
    expect(roomEditor.keys).not.toContain('size');
    expect(roomEditor.keys).not.toContain('readouts');
  });
});

describe('a room’s quick actions (#113)', () => {
  beforeAll(() => loadQuickActions());
  afterEach(() => document.body.replaceChildren());

  /** A player's `supported_features`: pause, volume, on, off, stop, play. */
  const PLAYER = 1 | 4 | 128 | 256 | 4096 | 16384;
  /** A lounge: three lights (one dims at 70 %, one only switches, one off), blinds at 40 %, a fan, a speaker, a door. */
  const LOUNGE: readonly Seed[] = [
    ['light.lounge_ceiling', 'on', { brightness: 178, supported_color_modes: ['brightness'] }],
    ['light.lounge_shelf', 'on', { supported_color_modes: ['onoff'] }],
    ['light.lounge_reading', 'off', { supported_color_modes: ['brightness'] }],
    ['cover.lounge_blinds', 'open', { current_position: 40, supported_features: 15 }],
    ['cover.lounge_door', 'closed', { device_class: 'door', supported_features: 3 }],
    ['fan.lounge', 'off', { percentage: 0, supported_features: 1 }],
    ['media_player.lounge', 'playing', { volume_level: 0.3, supported_features: PLAYER }],
    ['switch.kettle', 'off', { device_class: 'outlet', friendly_name: 'Kettle' }],
    ['lock.front', 'locked', { friendly_name: 'Front door' }],
    ['switch.porch', 'unavailable', { friendly_name: 'Porch' }],
  ];
  const sent: { domain: string; service: string; data: Record<string, unknown> }[] = [];
  /** The lounge, with more of its own (`more`: its ids name it). */
  const lounge = (more: readonly Seed[] = []): HomeAssistant => {
    const seeds = [...LOUNGE, ...more];
    const hass = house([...SEEDS, ...seeds]);
    return {
      ...hass,
      entities: {
        ...hass.entities,
        ...Object.fromEntries(
          seeds
            .filter(([id]) => id.includes('lounge'))
            .map(([entity_id]) => [entity_id, { entity_id, area_id: 'lounge' }]),
        ),
      },
      areas: { ...hass.areas, lounge: area('lounge', 'Lounge') },
      callService: (domain: string, service: string, data: Record<string, unknown>) => {
        sent.push({ domain, service, data });
        return Promise.resolve();
      },
    } as unknown as HomeAssistant;
  };
  type Round = HTMLElement & { fvHold?: () => void };
  const rounds = (card: RoomElement): Round[] => [
    ...root(card).querySelectorAll<Round>('.rm-quick .lt-bulb'),
  ];
  const names = (card: RoomElement): string[] =>
    rounds(card).map((round) => round.getAttribute('aria-label') ?? '');
  /** A round's ring as a share of its circle, in %; none while it is off. */
  const ring = (round: Round): number | undefined => {
    const dash = round.querySelector('.lt-ring circle')?.getAttribute('stroke-dasharray');
    if (!dash) return undefined;
    const [lit = 0, whole = 1] = dash.split(' ').map(Number);
    return Math.round((lit / whole) * 100);
  };

  it('hides the arrows of its rows where asked (#151)', async () => {
    const path = '/fluvy-home/room-lounge';
    const shown = await room({ area: 'lounge', path }, lounge());
    expect(root(shown).querySelector('.fv-row__chevron')).not.toBeNull();
    const hidden = await room({ area: 'lounge', path, show_arrow: false }, lounge());
    expect(root(hidden).querySelector('.fv-row__chevron')).toBeNull();
  });

  it('stands for the room’s lights, then its blinds, at the end of its picture, its head and its row', async () => {
    const parts = { photo: '.rm-hero', tile: '.fv-card__head', row: '.rm-tile' } as const;
    for (const [variant, part] of Object.entries(parts)) {
      const card = await room({ area: 'lounge', variant: variant as never }, lounge());
      expect(names(card), variant).toEqual(['Lights', 'Blinds']);
      expect(root(card).querySelectorAll(`${part} .rm-quick`), variant).toHaveLength(1);
    }
    // none where the card hides them; a room of neither has none
    const hidden = await room({ area: 'lounge', show_quick_actions: false }, lounge());
    expect(rounds(hidden)).toHaveLength(0);
    expect(rounds(await room({ area: 'garten' }))).toHaveLength(0);
  });

  it('says how much of the room is lit and how far its blinds are open: off counts as nothing, a door never', async () => {
    const card = await room({ area: 'lounge', variant: 'tile' }, lounge());
    const [lights, blinds] = rounds(card);
    // (70 + 100 + 0) / 3 lit; the blinds at 40, the door not one of them
    expect(ring(lights!)).toBe(57);
    expect(ring(blinds!)).toBe(40);
    expect(lights?.getAttribute('aria-checked')).toBe('true');
    expect(lights?.classList.contains('is-on')).toBe(true);
  });

  it('draws the ones asked for, in their order: a set, an entity of one’s own, one that cannot be read, never a set it has none of', async () => {
    const card = await room(
      {
        area: 'lounge',
        quick_actions: [
          'media',
          { entity: 'switch.kettle', name: 'Tea', color: '#e2725b' },
          'switch.porch',
          { group: 'fans', icon: 'mdi:ceiling-fan' },
          'nonsense',
          { group: 'entity' },
        ],
      },
      lounge(),
    );
    expect(names(card)).toEqual(['Media', 'Tea', 'Porch', 'Fans']);
    const [media, , porch] = rounds(card);
    // the speaker at 30 % while it plays
    expect(ring(media!)).toBe(30);
    expect(porch?.getAttribute('aria-disabled')).toBe('true');
    expect(porch?.classList.contains('fv-ico--off')).toBe(true);
  });

  it('turns the room’s lights off in one call while one is on, and on again', async () => {
    sent.length = 0;
    const card = await room({ area: 'lounge', variant: 'tile' }, lounge());
    rounds(card)[0]!.click();
    await card.updateComplete;
    expect(sent).toEqual([
      {
        domain: 'light',
        service: 'turn_off',
        data: { entity_id: ['light.lounge_ceiling', 'light.lounge_reading', 'light.lounge_shelf'] },
      },
    ]);
    // the round answers under the finger
    expect(rounds(card)[0]?.getAttribute('aria-checked')).toBe('false');
    rounds(card)[0]!.click();
    expect(sent.at(-1)?.service).toBe('turn_on');
  });

  it('closes open blinds, opens closed ones, and stops them while they move', async () => {
    const at = async (state: string): Promise<string | undefined> => {
      sent.length = 0;
      const hass = lounge();
      hass.states['cover.lounge_blinds'] = { ...hass.states['cover.lounge_blinds']!, state };
      const card = await room({ area: 'lounge', quick_actions: ['covers'] }, hass);
      rounds(card)[0]!.click();
      expect(sent[0]?.data).toEqual({ entity_id: ['cover.lounge_blinds'] });
      return sent[0]?.service;
    };
    expect(await at('open')).toBe('close_cover');
    expect(await at('closed')).toBe('open_cover');
    expect(await at('opening')).toBe('stop_cover');
  });

  /** What a tap on the round of `group` sends in a lounge with `more`: each call as `domain.service ids`. */
  const tapped = async (group: string, more: readonly Seed[]): Promise<string[]> => {
    sent.length = 0;
    const card = await room({ area: 'lounge', quick_actions: [group] }, lounge(more));
    rounds(card)[0]!.click();
    return sent.map(
      ({ domain, service, data }) => `${domain}.${service} ${String(data['entity_id'])}`,
    );
  };
  /** One of the lounge's own in another state. */
  const at = (id: string, state: string): Seed => [
    id,
    state,
    LOUNGE.find(([own]) => own === id)?.[2] ?? {},
  ];
  /** An entity of the lounge in `state` that supports `features`. */
  const of = (id: string, state: string, features: number): Seed => [
    id,
    state,
    { supported_features: features },
  ];

  it('sends each blind what it takes, one call a service: one that only tilts by its slats, one that does neither none', async () => {
    // a louvre that only tilts, and a screen that only takes a position: Home Assistant refuses a whole call to either
    const louvre = (state: string): Seed => of('cover.lounge_louvre', state, 16 | 32 | 64 | 128);
    const screen = (state: string): Seed => of('cover.lounge_screen', state, 4);
    expect(await tapped('covers', [louvre('open'), screen('open')])).toEqual([
      'cover.close_cover cover.lounge_blinds',
      'cover.close_cover_tilt cover.lounge_louvre',
    ]);
    expect(
      await tapped('covers', [
        louvre('closed'),
        screen('closed'),
        at('cover.lounge_blinds', 'closed'),
      ]),
    ).toEqual([
      'cover.open_cover cover.lounge_blinds',
      'cover.open_cover_tilt cover.lounge_louvre',
    ]);
    // the louvre stops by its slats while it moves
    expect(await tapped('covers', [louvre('closing')])).toEqual([
      'cover.stop_cover_tilt cover.lounge_louvre',
    ]);
  });

  it('sends each player what it takes: one that cannot pause stops, then goes off; one that takes none is left out', async () => {
    expect(
      await tapped('media', [
        of('media_player.lounge_radio', 'playing', 4096),
        of('media_player.lounge_tv', 'playing', 128 | 256),
        of('media_player.lounge_display', 'playing', 0),
      ]),
    ).toEqual([
      'media_player.media_pause media_player.lounge',
      'media_player.media_stop media_player.lounge_radio',
      'media_player.turn_off media_player.lounge_tv',
    ]);
    // none plays: those on play where they can; none on: those that can come on
    expect(
      await tapped('media', [
        at('media_player.lounge', 'paused'),
        of('media_player.lounge_tv', 'idle', 128 | 256),
      ]),
    ).toEqual(['media_player.media_play media_player.lounge']);
    expect(
      await tapped('media', [
        at('media_player.lounge', 'off'),
        of('media_player.lounge_radio', 'off', 4096 | 16384),
      ]),
    ).toEqual(['media_player.turn_on media_player.lounge']);
  });

  it('takes no tap where none of its members can act, and is drawn as it reads', async () => {
    // a speaker that plays and can only have its volume set: on, in its colour, its tap off
    const hass = lounge([of('media_player.lounge', 'playing', 4)]);
    sent.length = 0;
    const card = await room({ area: 'lounge', quick_actions: ['media', 'lights'] }, hass);
    const [media, lights] = rounds(card);
    expect(media?.getAttribute('aria-disabled')).toBe('true');
    expect(media?.classList.contains('is-on')).toBe(true);
    expect(media?.classList.contains('fv-ico--off')).toBe(false);
    expect(lights?.getAttribute('aria-disabled')).toBeNull();
    media!.click();
    expect(sent).toEqual([]);
  });

  it('reads one quick action written without its dash as a list of one, says what is wrong with a number', async () => {
    const card = document.createElement('fluvy-room-card') as RoomElement;
    for (const quick_actions of [3, true])
      expect(() =>
        card.setConfig({
          type: 'custom:fluvy-room-card',
          area: 'lounge',
          quick_actions: quick_actions as never,
        }),
      ).toThrow('fluvy-room-card: "quick_actions" must be a list');
    expect(
      names(await room({ area: 'lounge', quick_actions: 'lights' as never }, lounge())),
    ).toEqual(['Lights']);
    expect(
      names(await room({ area: 'lounge', quick_actions: { group: 'covers' } as never }, lounge())),
    ).toEqual(['Blinds']);
    // `quick_actions:` with nothing after it: the room's lights and blinds, as with none
    const bare = await room({ area: 'lounge', quick_actions: null as never }, lounge());
    expect(names(bare)).toEqual(['Lights', 'Blinds']);
  });

  it('pauses what plays, toggles a lock as Home Assistant does, and runs an action of its own', async () => {
    sent.length = 0;
    const card = await room(
      {
        area: 'lounge',
        quick_actions: [
          'media',
          'lock.front',
          {
            entity: 'switch.kettle',
            tap_action: { action: 'perform-action', perform_action: 'script.tea' },
          },
        ],
      },
      lounge(),
    );
    for (const round of rounds(card)) round.click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(sent.map(({ domain, service }) => `${domain}.${service}`)).toEqual([
      'media_player.media_pause',
      'lock.unlock',
      'script.tea',
    ]);
  });

  it('holds: an entity’s details, a set of one’s too; a set of several opens where the room opens', async () => {
    const opened: string[] = [];
    const went: string[] = [];
    const more = (event: Event): void =>
      void opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    const moved = (): void => void went.push(window.location.pathname);
    window.addEventListener('location-changed', moved);
    document.addEventListener('hass-more-info', more);
    try {
      const card = await room(
        { area: 'lounge', path: '/lounge', quick_actions: ['lights', 'covers', 'switch.kettle'] },
        lounge(),
      );
      for (const round of rounds(card)) round.fvHold?.();
      expect(went).toEqual(['/lounge']);
      expect(opened).toEqual(['cover.lounge_blinds', 'switch.kettle']);
      // nowhere to open (no path, no administrator): a set of several holds nothing
      const guest = await room({ area: 'lounge', quick_actions: ['lights'] }, {
        ...lounge(),
        user: { id: 'u2', name: 'Guest', is_admin: false },
      } as HomeAssistant);
      expect(rounds(guest)[0]?.fvHold).toBeUndefined();
    } finally {
      window.removeEventListener('location-changed', moved);
      document.removeEventListener('hass-more-info', more);
    }
  });

  /**
   * Home Assistant's root as it answers a tap asked about first: the action from the element that asked
   * (`composedPath()[0]`), its yes handed back from that element as `ll-custom`.
   */
  const homeAssistant = () => {
    const asked: { node: EventTarget; action: Record<string, unknown> }[] = [];
    const ask = (event: Event): void =>
      void asked.push({
        node: event.composedPath()[0]!,
        action: (event as CustomEvent<{ config: { tap_action: Record<string, unknown> } }>).detail
          .config.tap_action,
      });
    document.addEventListener('hass-action', ask);
    const yes = (question: (typeof asked)[number] | undefined): void =>
      void question?.node.dispatchEvent(
        new CustomEvent('ll-custom', { detail: question.action, bubbles: true, composed: true }),
      );
    return { asked, yes, done: () => document.removeEventListener('hass-action', ask) };
  };
  const moved = (): string[] =>
    sent.map(({ service, data }) => `${service} ${String(data['entity_id'])}`);

  it('asks first where its tap says so, in Home Assistant’s own dialog, then turns the set off: nothing moves before', async () => {
    const { asked, yes, done } = homeAssistant();
    try {
      sent.length = 0;
      const confirmation = { text: 'Every light off?' };
      const quick_actions = [
        { group: 'lights', tap_action: { action: 'toggle', confirmation } },
        { group: 'covers', tap_action: { action: 'toggle', confirmation: true } },
        { group: 'media', tap_action: { action: 'toggle', confirmation: { title: 'Music' } } },
      ] as const;
      const house = lounge([
        ['cover.lounge_louvre', 'open', { supported_features: 16 | 32 }],
        ['media_player.lounge_radio', 'playing', { supported_features: 4096 }],
      ]);
      // Home Assistant's own words where the tap says none
      const localize = (key: string, values?: Record<string, unknown>): string =>
        key === 'ui.panel.lovelace.cards.actions.action_confirmation'
          ? `Are you sure you want to run action "${String(values?.['action'])}"?`
          : key;
      const card = await room({ area: 'lounge', quick_actions }, { ...house, localize });
      const [lights, blinds, media] = rounds(card);
      lights!.click();
      blinds!.click();
      media!.click();
      await card.updateComplete;
      expect(sent).toEqual([]);
      expect(asked.map(({ action }) => action)).toEqual([
        // one call: handed to Home Assistant whole, which names its service where the tap says no words
        {
          action: 'perform-action',
          perform_action: 'light.turn_off',
          target: {
            entity_id: ['light.lounge_ceiling', 'light.lounge_reading', 'light.lounge_shelf'],
          },
          confirmation,
        },
        // several (the louvre only tilts, the radio only stops): asked once for all of the set, which Home Assistant
        // hands back once answered yes
        {
          action: 'fire-dom-event',
          confirmation: { text: 'Are you sure you want to run action "Blinds"?' },
        },
        {
          action: 'fire-dom-event',
          confirmation: { title: 'Music', text: 'Are you sure you want to run action "Media"?' },
        },
      ]);
      // still on until Home Assistant has asked
      expect(lights?.getAttribute('aria-checked')).toBe('true');
      // a yes moves the set it answers, and only it
      yes(asked[2]);
      expect(moved()).toEqual([
        'media_pause media_player.lounge',
        'media_stop media_player.lounge_radio',
      ]);
      // asked again, every blind moves at the answer, drawn as it will be
      sent.length = 0;
      blinds!.click();
      yes(asked[3]);
      await card.updateComplete;
      expect(moved()).toEqual([
        'close_cover cover.lounge_blinds',
        'close_cover_tilt cover.lounge_louvre',
      ]);
      expect(blinds?.getAttribute('aria-checked')).toBe('false');
      // answered once, a set does not move again on the same answer
      yes(asked[3]);
      expect(sent).toHaveLength(2);
    } finally {
      done();
    }
  });

  it('moves a set at the yes Home Assistant 2026.9 fires from its root, which bubbles to the window and never through the card', async () => {
    const { asked, done } = homeAssistant();
    try {
      sent.length = 0;
      const config = {
        area: 'lounge',
        quick_actions: [{ group: 'covers', tap_action: { action: 'toggle', confirmation: true } }],
      } as const;
      const house = lounge([['cover.lounge_louvre', 'open', { supported_features: 16 | 32 }]]);
      const card = await room(config, house);
      rounds(card)[0]!.click();
      expect(sent).toEqual([]);
      const action = asked[0]!.action;
      document.body.dispatchEvent(
        new CustomEvent('ll-custom', { detail: action, bubbles: true, composed: true }),
      );
      expect(moved()).toEqual([
        'close_cover cover.lounge_blinds',
        'close_cover_tilt cover.lounge_louvre',
      ]);
      // once: the same yes again, or a foreign one, moves nothing
      document.body.dispatchEvent(
        new CustomEvent('ll-custom', { detail: action, bubbles: true, composed: true }),
      );
      window.dispatchEvent(new CustomEvent('ll-custom', { detail: { ...action } }));
      expect(sent).toHaveLength(2);
    } finally {
      done();
    }
  });

  it('moves a set at its yes where the card was drawn anew while Home Assistant asked, and keeps nothing of a question answered no', async () => {
    const { asked, yes, done } = homeAssistant();
    const listening: string[] = [];
    const add = window.addEventListener;
    window.addEventListener = function (
      this: Window,
      ...args: Parameters<Window['addEventListener']>
    ) {
      listening.push(args[0]);
      return add.apply(this, args);
    } as Window['addEventListener'];
    try {
      sent.length = 0;
      const config = {
        area: 'lounge',
        quick_actions: [{ group: 'covers', tap_action: { action: 'toggle', confirmation: true } }],
      } as const;
      const house = lounge([['cover.lounge_louvre', 'open', { supported_features: 16 | 32 }]]);
      const first = await room(config, house);
      rounds(first)[0]!.click();
      // the dashboard draws the card anew while the dialog is open: the yes comes from the card that asked, out of the page
      first.remove();
      const again = await room(config, house);
      expect(asked[0]?.node).toBe(first);
      yes(asked[0]);
      expect(moved()).toEqual([
        'close_cover cover.lounge_blinds',
        'close_cover_tilt cover.lounge_louvre',
      ]);
      // only its own question moves it, and once: a replayed yes, or one like it, does nothing
      yes(asked[0]);
      yes({ node: again, action: { ...asked[0]!.action } });
      expect(sent).toHaveLength(2);
      // a question answered no (Home Assistant says nothing) moves nothing, and the window hears the yes once at most
      rounds(again)[0]!.click();
      expect(asked).toHaveLength(2);
      expect(listening.filter((type) => type === 'll-custom').length).toBeLessThanOrEqual(1);
      expect(sent).toHaveLength(2);
    } finally {
      window.addEventListener = add;
      done();
    }
  });

  it('opens a set’s details where its tap or hold says so: its one member’s, else where the room opens, else none', async () => {
    const opened: string[] = [];
    const went: string[] = [];
    const more = (event: Event): void =>
      void opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId);
    const moved = (): void => void went.push(window.location.pathname);
    window.addEventListener('location-changed', moved);
    document.addEventListener('hass-more-info', more);
    try {
      const details = { action: 'more-info' } as const;
      const quick_actions = [
        { group: 'covers', tap_action: details },
        { group: 'lights', tap_action: details },
        { group: 'fans', tap_action: { action: 'toggle' }, hold_action: details },
      ] as const;
      const card = await room({ area: 'lounge', path: '/lounge', quick_actions }, lounge());
      const [blinds, lights, fans] = rounds(card);
      blinds!.click();
      lights!.click();
      fans!.fvHold?.();
      expect(opened).toEqual(['cover.lounge_blinds', 'fan.lounge']);
      expect(went).toEqual(['/lounge']);
      // nowhere to open (no path, no administrator): the lights’ round takes no tap
      const guest = await room({ area: 'lounge', quick_actions }, {
        ...lounge(),
        user: { id: 'u2', name: 'Guest', is_admin: false },
      } as HomeAssistant);
      expect((rounds(guest)[1] as Round & { fvTap?: () => void }).fvTap).toBeUndefined();
    } finally {
      window.removeEventListener('location-changed', moved);
      document.removeEventListener('hass-more-info', more);
    }
  });

  it('takes as many as the width holds once the name has what it needs: none in half a section, the name whole', async () => {
    // 8 px a glyph: "Lounge" (48)
    const ruler = { width: (_cls: string, text: string) => text.length * 8 };
    const count = async (variant: string, width: number): Promise<number> =>
      rounds(
        await roomAt(
          { area: 'lounge', variant: variant as never, path: '/l' },
          width,
          ruler,
          lounge(),
        ),
      ).length;
    // a head at 360: 320 − 48 (the chevron) − 56 (the circle) − 48 = 168 → two rounds and their 12 (108)
    expect(await count('tile', 360)).toBe(2);
    // at 211: 171 − 48 − 56 − 48 = 19, none; at 266: 74, one
    expect(await count('tile', 211)).toBe(0);
    expect(await count('tile', 266)).toBe(1);
    // the picture's pill keeps its glyph: 320 − 56 − 48 = 216; half a section's 132 − 56 − 48 = 28, none
    expect(await count('photo', 360)).toBe(2);
    expect(await count('photo', 172)).toBe(0);
    // a row: 360 − 32 − 56 − 48 = 224; 172 − 32 − 56 − 48 = 36, none
    expect(await count('row', 360)).toBe(2);
    expect(await count('row', 172)).toBe(0);
  });
});

describe('a room’s own include and exclude (#95)', () => {
  afterEach(() => document.body.replaceChildren());

  it('counts what it includes and leaves out what it excludes, in its readout and its line alike', async () => {
    const hass = house([...SEEDS, ['light.flur', 'on'], ['switch.flur_heater', 'on']]);
    const tuned = {
      ...hass,
      entities: {
        ...hass.entities,
        'light.flur': { entity_id: 'light.flur', area_id: 'flur' },
        'switch.flur_heater': { entity_id: 'switch.flur_heater', area_id: 'flur' },
      },
    } as HomeAssistant;
    const card = await room({ area: 'flur', variant: 'photo', exclude: ['switch'] }, tuned);
    expect(readouts(card).at(-1)).toBe('1of 1');
    const row = await room(
      { area: 'flur', variant: 'row', exclude: ['switch'], include: ['light.keller'] },
      tuned,
    );
    expect(root(row).querySelector('.fv-tile__state')?.textContent?.trim()).toBe(
      '1 of 2 on · 19.8°',
    );
  });

  it('offers its entities, devices and domains to choose, and a pattern typed', async () => {
    const element = await FluvyRoomCard.getConfigElement();
    (element as HTMLElement & { hass: HomeAssistant }).hass = house();
    const editor = await drawEditor(element, { type: 'custom:fluvy-room-card', area: 'flur' });
    const selects = [...editor.shadowRoot!.querySelectorAll('ha-form')]
      .flatMap(
        (form) => (form as unknown as { schema: { name: string; selector?: unknown }[] }).schema,
      )
      .filter((item) => item.name === 'include' || item.name === 'exclude')
      .map(
        (item) =>
          (item.selector as { select: { options: { value: string }[]; custom_value: boolean } })
            .select,
      );
    expect(selects).toHaveLength(2);
    for (const select of selects) {
      expect(select.custom_value).toBe(true);
      expect(select.options.map((option) => option.value)).toEqual([
        'sensor.flur_a',
        'sensor.flur_b',
        'sensor',
      ]);
    }
  });
});
