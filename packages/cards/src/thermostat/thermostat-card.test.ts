// @vitest-environment happy-dom
import {
  ensureLanguage,
  resolveEntity,
  setLanguageOverride,
  type HassEntity,
  type HomeAssistant,
  type LovelaceCardConfig,
} from '@fluvy/core';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import {
  FluvyThermostatCard,
  modeLabel,
  modeOrder,
  stepTarget,
  type ThermostatCardConfig,
} from './thermostat-card.js';
import * as thermostatEditor from './thermostat-editor.js';

// the index fetches the families: they land before this file's page goes
afterAll(() => familiesDefined);

const entity = (
  entity_id: string,
  state: string,
  attributes: Record<string, unknown>,
): HassEntity => ({
  entity_id,
  state,
  attributes: { friendly_name: 'Garderobe', ...attributes },
  last_changed: '2026-10-17T08:00:00Z',
  last_updated: '2026-10-17T08:00:00Z',
});

/** The #46 thermostat: a HomeMatic entity, whose modes come as Auto, Heat, Off. */
const homematic = entity('climate.garderobe', 'heat', {
  hvac_modes: ['auto', 'heat', 'off'],
  min_temp: 5,
  max_temp: 30.5,
  target_temp_step: 0.5,
  temperature: 19.5,
  current_temperature: 20.6,
});
const range = entity('climate.range', 'heat_cool', {
  hvac_modes: ['off', 'heat_cool'],
  supported_features: 2,
  min_temp: 15,
  max_temp: 30,
  target_temp_step: 0.5,
  target_temp_low: 20,
  target_temp_high: 24,
  hvac_action: 'idle',
});
const humidifier = entity('humidifier.bedroom', 'on', {
  available_modes: ['normal', 'sleep', 'off', 'auto', 'baby', 'comfort', 'boost'],
  mode: 'sleep',
  humidity: 50,
});
const tank = entity('water_heater.tank', 'eco', {
  operation_list: ['eco', 'heat_pump', 'off', 'electric', 'gas', 'performance', 'high_demand'],
  temperature: 50,
});

const house = (...states: HassEntity[]): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
    entities: {},
    devices: {},
    areas: {},
    callService: vi.fn(async () => undefined),
  }) as unknown as HomeAssistant;

/** An entity as the card reads it. */
const viewOf = (state: HassEntity) => resolveEntity(house(state), state.entity_id);

const config = (more: Partial<ThermostatCardConfig> = {}): ThermostatCardConfig => ({
  type: 'custom:fluvy-thermostat-card',
  entity: 'climate.garderobe',
  ...more,
});

describe('the modes, in one order for the card and its editor (#46)', () => {
  it('draws a climate’s in Home Assistant’s order, Off first, whatever order the entity lists them in', () => {
    expect(modeOrder(viewOf(homematic))).toEqual(['off', 'heat', 'auto']);
    // a mode it has no word for goes after the ones it knows, in the entity's own order
    expect(
      modeOrder(
        viewOf(entity('climate.x', 'heat', { hvac_modes: ['boost', 'heat', 'eco', 'off'] })),
      ),
    ).toEqual(['off', 'heat', 'boost', 'eco']);
    expect(modeOrder(resolveEntity(house(), 'climate.none'))).toEqual([]);
  });

  it('lists a water heater’s operations as it does, and a humidifier’s Off before its modes', () => {
    expect(modeOrder(viewOf(tank))).toEqual(tank.attributes['operation_list']);
    expect(modeOrder(viewOf(humidifier))).toEqual([
      'off',
      'normal',
      'sleep',
      'auto',
      'baby',
      'comfort',
      'boost',
    ]);
  });

  it('shows the editor the order the card draws, so taking one out never turns the rest round', () => {
    const defaults = (state: HassEntity): unknown =>
      thermostatEditor.defaults(
        { type: 'custom:fluvy-thermostat-card', entity: state.entity_id },
        house(state),
      )['modes'];
    // the HomeMatic default drew Off · Heat · Auto but offered Auto · Heat · Off: unticking Heat wrote Auto · Off
    expect(defaults(homematic)).toEqual(['off', 'heat', 'auto']);
    // a humidifier and a water heater show their first six where the config lists none
    expect(defaults(humidifier)).toEqual(['off', 'normal', 'sleep', 'auto', 'baby', 'comfort']);
    expect(defaults(tank)).toHaveLength(6);
  });

  it('offers the entity’s own modes in the editor, worded as the card words them, dragged into order', () => {
    const hass = house(homematic);
    const choices = thermostatEditor.choices(config(), hass);
    expect(choices['modes']).toEqual([
      { value: 'off', label: 'Off' },
      { value: 'heat', label: 'Heat' },
      { value: 'auto', label: 'Auto' },
    ]);
    expect(thermostatEditor.choices(config({ entity: 'climate.none' }), hass)).toEqual({});
    const field = thermostatEditor.getConfigForm().schema.find((item) => item.name === 'modes');
    expect(field?.selector?.['select']).toMatchObject({ multiple: true, reorder: true });
  });

  it('words a mode as Fluvy does, else as Home Assistant does, else tidies it', () => {
    const hass = {
      ...house(),
      formatEntityState: (stateObj: HassEntity) =>
        stateObj.state === 'heat_pump' ? 'Wärmepumpe' : stateObj.state,
      formatEntityAttributeValue: (_: HassEntity, attribute: string, value: unknown) =>
        attribute === 'mode' && value === 'sleep' ? 'Schlafen' : String(value),
    } as unknown as HomeAssistant;
    expect(modeLabel(hass, viewOf(homematic), 'heat')).toBe('Heat');
    expect(modeLabel(hass, viewOf(tank), 'heat_pump')).toBe('Wärmepumpe');
    expect(modeLabel(hass, viewOf(tank), 'high_demand')).toBe('High demand');
    expect(modeLabel(hass, viewOf(tank), 'off')).toBe('Off');
    expect(modeLabel(hass, viewOf(humidifier), 'sleep')).toBe('Schlafen');
    expect(modeLabel(hass, viewOf(humidifier), 'baby')).toBe('Baby');
  });
});

describe('the card’s height and its grid', () => {
  const height = (more: Partial<ThermostatCardConfig>): number =>
    FluvyThermostatCard.layoutHeight(config(more));

  it('counts its modes by how they are drawn: tiles 128, chips or a full row 88, none hidden', () => {
    expect(height({ variant: 'compact' })).toBe(292);
    expect(height({ variant: 'compact', modes_style: 'chips' })).toBe(252);
    expect(height({ variant: 'compact', show_modes: false })).toBe(164);
    expect(height({ variant: 'compact', modes_style: 'full', show_modes: false })).toBe(164);
    expect(height({ variant: 'ruler' })).toBe(396);
    expect(height({ variant: 'ruler', modes_style: 'chips' })).toBe(356);
    expect(height({ variant: 'ruler', modes_style: 'chips', show_modes: false })).toBe(268);
    expect(height({})).toBe(484);
    expect(height({ modes_style: 'full' })).toBe(444);
  });

  it('is 56 shorter as a dial without its stepper, and the same as a readout without it', () => {
    expect(height({ show_stepper: false })).toBe(428);
    expect(height({ show_stepper: false, show_modes: false })).toBe(300);
    expect(height({ variant: 'compact', show_stepper: false })).toBe(292);
  });

  it('asks for half a section at the least as a compact card, as Home Assistant’s thermostat does', () => {
    const card = document.createElement('fluvy-thermostat-card') as FluvyThermostatCard;
    card.setConfig(config({ variant: 'compact' }) as LovelaceCardConfig);
    expect(card.getGridOptions()).toEqual({ columns: 6, rows: 'auto', min_columns: 6 });
    card.setConfig(config({ variant: 'ruler' }) as LovelaceCardConfig);
    expect(card.getGridOptions().min_columns).toBe(6);
    card.setConfig(config() as LovelaceCardConfig);
    expect(card.getGridOptions().min_columns).toBe(8);
  });
});

describe('a step from the stepper', () => {
  const limits = { min: 5, max: 30.5, step: 0.5 };

  it('moves a target one step on its grid, inside its range', () => {
    expect(stepTarget({ value: 9.5 }, 1, limits)).toEqual({ value: 10 });
    expect(stepTarget({ value: 30.5 }, 1, limits)).toEqual({ value: 30.5 });
    expect(stepTarget({ value: 5.2 }, -1, limits)).toEqual({ value: 5 });
  });

  it('moves the end of a range it was given, a step clear of the other, which stays', () => {
    expect(stepTarget({ low: 20, high: 24 }, 1, limits, 1)).toEqual({ low: 20, high: 24.5 });
    expect(stepTarget({ low: 20, high: 24 }, 1, limits, 0)).toEqual({ low: 20.5, high: 24 });
    // the low end stops a step under the high one; the high one a step over the low one
    expect(stepTarget({ low: 23.5, high: 24 }, 1, limits, 0)).toEqual({ low: 23.5, high: 24 });
    expect(stepTarget({ low: 20, high: 20.5 }, -1, limits, 1)).toEqual({ low: 20, high: 20.5 });
  });
});

describe('the value row of a range', () => {
  it('gives the stepper to the end pressed: its high end, then + sends the high end a step up', async () => {
    vi.useFakeTimers();
    const hass = house(range);
    const card = document.createElement('fluvy-thermostat-card') as FluvyThermostatCard;
    card.setConfig(config({ entity: 'climate.range', variant: 'compact' }) as LovelaceCardConfig);
    card.hass = hass;
    document.body.append(card);
    await card.updateComplete;
    const ends = (): HTMLButtonElement[] => [
      ...card.renderRoot.querySelectorAll<HTMLButtonElement>('.cl-end'),
    ];
    expect(ends().map((end) => end.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    ends()[1]!.click();
    await card.updateComplete;
    expect(ends().map((end) => end.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
    const plus = card.renderRoot.querySelectorAll<HTMLButtonElement>('.fv-stepper__half')[1]!;
    plus.dispatchEvent(new MouseEvent('click', { detail: 0, bubbles: true }));
    vi.advanceTimersByTime(700);
    expect(hass.callService).toHaveBeenCalledWith(
      'climate',
      'set_temperature',
      { target_temp_low: 20, target_temp_high: 24.5 },
      { entity_id: 'climate.range' },
    );
    card.remove();
    vi.useRealTimers();
  });

  it('keeps the stepper in its place, still, while the device is off', async () => {
    const card = document.createElement('fluvy-thermostat-card') as FluvyThermostatCard;
    card.setConfig(config({ variant: 'compact' }) as LovelaceCardConfig);
    card.hass = house({ ...homematic, state: 'off' });
    document.body.append(card);
    await card.updateComplete;
    const halves = card.renderRoot.querySelectorAll<HTMLButtonElement>('.fv-stepper__half');
    expect(halves).toHaveLength(2);
    expect([...halves].every((half) => half.disabled)).toBe(true);
    card.remove();
  });

  it('is the card’s tap without a stepper, the readout with its words', async () => {
    const card = document.createElement('fluvy-thermostat-card') as FluvyThermostatCard;
    card.setConfig(config({ variant: 'compact', show_stepper: false }) as LovelaceCardConfig);
    card.hass = house(homematic);
    document.body.append(card);
    await card.updateComplete;
    expect(card.renderRoot.querySelector('.fv-stepper')).toBeNull();
    const tap = card.renderRoot.querySelector<HTMLButtonElement>('.cl-value .fv-tile__tap');
    expect(tap?.getAttribute('aria-label')).toBe('Garderobe · Target · Now 20.6° 19.5 °C');
    card.remove();
  });
});

describe('a picture of the person’s own in the head (#99)', () => {
  const ac = entity('image.living_ac', '2026-11-04T08:00:00+00:00', {
    entity_picture: 'https://example.com/ac.png',
  });
  const draw = async (
    more: Partial<ThermostatCardConfig>,
    states = [homematic, ac],
  ): Promise<FluvyThermostatCard> => {
    const card = document.createElement('fluvy-thermostat-card') as FluvyThermostatCard;
    card.setConfig(config(more) as LovelaceCardConfig);
    card.hass = house(...states);
    document.body.append(card);
    await card.updateComplete;
    return card;
  };
  const picture = (card: FluvyThermostatCard): string | null | undefined =>
    card.renderRoot
      .querySelector<HTMLImageElement>('.fv-card__head .fv-ico--picture > img')
      ?.getAttribute('src');

  it('stands in the circle’s place: an address, or an entity’s picture', async () => {
    let card = await draw({ image: 'image.living_ac' });
    expect(picture(card)).toBe('https://example.com/ac.png');
    expect(
      card.renderRoot.querySelector('.fv-card__head .fv-ico:not(.fv-ico--picture)'),
    ).toBeNull();
    card.remove();
    card = await draw({ image: 'https://example.com/daikin.png', variant: 'compact' });
    expect(picture(card)).toBe('https://example.com/daikin.png');
    card.remove();
  });

  it('leaves the circle where there is nothing to show, and stays out of reach, greyed with the card', async () => {
    let card = await draw({ image: 'javascript:alert(1)' });
    expect(picture(card)).toBeUndefined();
    expect(card.renderRoot.querySelector('.fv-card__head .fv-ico')).not.toBeNull();
    card.remove();
    card = await draw({ image: 'image.living_ac' }, [{ ...homematic, state: 'unavailable' }, ac]);
    expect(picture(card)).toBe('https://example.com/ac.png');
    expect(card.renderRoot.querySelector('.is-unavailable .fv-ico--picture')).not.toBeNull();
    card.remove();
  });

  it('gives way to the circle where it would not load, never a broken picture', async () => {
    const card = await draw({ image: 'https://example.com/gone.png' });
    card.renderRoot
      .querySelector('.fv-card__head .fv-ico--picture > img')
      ?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    expect(picture(card)).toBeUndefined();
    expect(card.renderRoot.querySelector('.fv-card__head .fv-ico')).not.toBeNull();
    card.remove();
  });

  it('draws its entity’s new picture: the image entity is watched', async () => {
    const card = await draw({ image: 'image.living_ac' });
    const hass = card.hass!;
    const next = { ...ac, attributes: { entity_picture: 'https://example.com/ac-2.png' } };
    card.hass = { ...hass, states: { ...hass.states, 'image.living_ac': next } };
    await card.updateComplete;
    expect(picture(card)).toBe('https://example.com/ac-2.png');
    card.remove();
  });

  it('comes back once it loads again (Home Assistant restarted), the circle kept until then', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // the picture as the house serves it, tried out of sight: not there while it restarts, then back
    let serving = false;
    vi.stubGlobal(
      'Image',
      class {
        src = '';
        decode = (): Promise<void> => (serving ? Promise.resolve() : Promise.reject(new Error()));
      },
    );
    try {
      const card = await draw({ image: '/local/ac.png' });
      card.renderRoot
        .querySelector('.fv-card__head .fv-ico--picture > img')
        ?.dispatchEvent(new Event('error'));
      await card.updateComplete;
      await vi.advanceTimersByTimeAsync(10_000);
      await card.updateComplete;
      expect(picture(card)).toBeUndefined();
      serving = true;
      await vi.advanceTimersByTimeAsync(20_000);
      await card.updateComplete;
      expect(picture(card)).toBe('/local/ac.png');
      card.remove();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});

describe('the fan speeds and presets, in the page’s words (#142)', () => {
  /** An air conditioner whose integration sends Home Assistant's standard speeds, Fluvy's `mid` and one of its own. */
  const aircon = entity('climate.living_ac', 'cool', {
    hvac_modes: ['off', 'cool'],
    temperature: 23,
    fan_modes: ['auto', 'low', 'mid', 'high', 'quiet'],
    fan_mode: 'auto',
    preset_modes: ['eco', 'boost'],
    preset_mode: 'eco',
  });
  /** Home Assistant's own German, as its formatter says an attribute's value (else the value as it is). */
  const GERMAN: Record<string, string> = {
    'fan_mode.low': 'Niedrig',
    'fan_mode.high': 'Hoch',
    'preset_mode.boost': 'Boost',
    'preset_mode.eco': 'Eco',
  };
  const chips = async (): Promise<string[]> => {
    const card = document.createElement('fluvy-thermostat-card') as FluvyThermostatCard;
    card.setConfig(config({ entity: aircon.entity_id }) as LovelaceCardConfig);
    card.hass = {
      ...house(aircon),
      language: 'de',
      locale: { language: 'de', number_format: 'language', time_format: '24' },
      formatEntityAttributeValue: (_: HassEntity, attribute: string, value: unknown) =>
        GERMAN[`${attribute}.${String(value)}`] ?? String(value),
    } as unknown as HomeAssistant;
    document.body.append(card);
    await card.updateComplete;
    const words = [...card.renderRoot.querySelectorAll('.fv-chip')].map(
      (chip) => chip.textContent?.trim() ?? '',
    );
    card.remove();
    return words;
  };

  afterAll(() => setLanguageOverride(undefined));

  it('says Home Assistant’s word first, then Fluvy’s for a standard speed, then the word as sent', async () => {
    await ensureLanguage('de');
    // the presets, then the speeds: Home Assistant has no word for `mid`, nor for the integration's `quiet`
    expect(await chips()).toEqual(['Eco', 'Boost', 'Auto', 'Niedrig', 'Mittel', 'Hoch', 'Quiet']);
  });

  it('says Fluvy’s own where a person chose a language of their own, Home Assistant’s being the page’s', async () => {
    setLanguageOverride('en');
    expect(await chips()).toEqual(['Eco', 'Boost', 'Auto', 'Low', 'Mid', 'High', 'Quiet']);
  });
});
