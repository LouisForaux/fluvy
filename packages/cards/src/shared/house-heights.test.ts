// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { beforeAll, describe, expect, it } from 'vitest';
import { printerHeight } from '../devices-family.js';
import { devicesHeight, legendFold, legendRows } from '../energy-family.js';
import { appliancesHeight } from '../appliances-family.js';
import { alertsHeight } from '../alerts-family.js';
import { houseHeightOf } from '../house-heights.js';
import { familiesDefined } from '../index.js';
import { chipBlock, chipRows, optionRows, statsRows, textWidth } from './heights.js';

// the cards declare their heights from their configs as they register; the families' chunks land before the tests go
beforeAll(() => familiesDefined);

/*
 * Every height the automatic dashboard plans counts what the house draws (`houseHeightOf`): the capabilities and
 * options the house writes, on the 4 px grid, against the anatomies measured in the playground at a 360 column
 * (tools/render/heights.mjs); without the house, the documented default the card declares from its config.
 */

const entity = (entity_id: string, state: string, attributes = {}): HassEntity => ({
  entity_id,
  state,
  attributes,
  last_changed: '2026-10-19T08:00:00Z',
  last_updated: '2026-10-19T08:00:00Z',
});

const house = (entities: readonly HassEntity[], more: Partial<HomeAssistant> = {}): HomeAssistant =>
  ({
    language: 'en',
    states: Object.fromEntries(entities.map((e) => [e.entity_id, e])),
    ...more,
  }) as unknown as HomeAssistant;

/** A card's height as the automatic dashboard plans it, with the house where there is one. */
const declare =
  (tag: string) =>
  (config: Omit<LovelaceCardConfig, 'type'>, hass?: HomeAssistant): number =>
    houseHeightOf({ ...config, type: `custom:${tag}` }, -1, hass);

/** The families' cards, by the names of their heights. */
const lockHeight = declare('fluvy-lock-card');
const alarmHeight = declare('fluvy-alarm-card');
const mediaHeight = declare('fluvy-media-card');
const weatherHeight = declare('fluvy-weather-card');
const gridHeight = declare('fluvy-grid-card');
const flowHeight = declare('fluvy-energy-flow-card');
const productionHeight = declare('fluvy-production-card');
const batteriesHeight = declare('fluvy-batteries-card');
const chargerHeight = declare('fluvy-ev-charger-card');

const onGrid = (height: number): number => {
  expect(height % 4).toBe(0);
  return height;
};

describe('words, letter by letter', () => {
  it('runs close to Inter: a wide word over a narrow one of the same count', () => {
    expect(textWidth('Performance', 'option')).toBeGreaterThanOrEqual(80);
    expect(textWidth('Solar output', 'option')).toBeLessThan(80);
    expect(textWidth('Comfort', 'chip')).toBeLessThan(textWidth('Standard', 'chip'));
  });

  it('lays filled chips out as the rows draw: four short presets one line, six sources two, three long words two', () => {
    expect(chipRows(['Eco', 'Comfort', 'Away', 'Boost'])).toBe(1);
    expect(chipRows(['Quiet', 'Standard', 'Turbo', 'Max'])).toBe(2);
    expect(chipRows(['TV', 'Netflix', 'Spotify', 'HDMI 1', 'HDMI 2', 'AirPlay'])).toBe(2);
    expect(chipRows(['Self use', 'Backup', 'Force charge'])).toBe(2);
    expect(chipRows(['Day', 'Week', 'Month'])).toBe(1);
    expect(chipRows([])).toBe(0);
    // content-sized chips wrap as their pills run
    expect(chipRows(['A', 'B', 'C'], 'chips')).toBe(1);
    expect(
      chipRows(
        Array.from({ length: 12 }, () => 'Reading lamp'),
        'chips',
      ),
    ).toBeGreaterThan(3);
    // a filled row's rows touch; content-sized chips that wrap are 8 apart, as the row's gap sets them
    expect(chipBlock(2)).toBe(36 + 8 + 2 * 44);
    expect(chipBlock(2, 'chips')).toBe(36 + 8 + 2 * 44 + 8);
    expect(chipBlock(1, 'chips')).toBe(chipBlock(1));
    expect(chipBlock(0, 'chips')).toBe(0);
  });

  it('lays option tiles out as the rows draw: three a row, two where a word is long, four as two by two', () => {
    expect(optionRows(['Heat', 'Cool', 'Auto'])).toBe(1);
    expect(optionRows(['Off', 'Eco', 'Performance'])).toBe(2);
    expect(optionRows(['Disarmed', 'Home', 'Away', 'Night'])).toBe(2);
    expect(optionRows(['Disarmed', 'Home', 'Away', 'Night', 'Vacation', 'Custom'])).toBe(2);
  });

  it('lays readouts out as the rows draw: "Self-powered" folds three into two and one', () => {
    expect(statsRows(['Imported', 'Exported', 'Net cost'])).toBe(1);
    expect(statsRows(['Self-powered', 'Exported', 'Imported'])).toBe(2);
    // a label a pixel from its column's edge may fold either way: the estimate is not held to it
  });
});

describe('the thermostat', () => {
  const height = declare('fluvy-thermostat-card');
  const living = entity('climate.living', 'heat', {
    hvac_modes: ['heat', 'cool', 'heat_cool'],
    preset_modes: ['eco', 'comfort', 'away', 'boost'],
    fan_modes: ['auto', 'low', 'mid', 'high'],
  });
  const tank = entity('water_heater.tank', 'eco', {
    operation_list: ['off', 'eco', 'performance'],
  });
  const range = entity('climate.range', 'heat_cool', {
    hvac_modes: ['heat', 'cool', 'heat_cool'],
    target_temp_low: 20,
    target_temp_high: 24,
  });
  const us = entity('climate.us', 'heat', { hvac_modes: ['off', 'heat', 'cool', 'heat_cool'] });
  const hass = house([living, tank, range, us]);

  it('counts the presets and the fan speeds as rows of chips under their labels (88 each)', () => {
    expect(onGrid(height({ entity: 'climate.living' }, hass))).toBe(660);
    expect(height({ entity: 'climate.living', show_presets: false }, hass)).toBe(572);
    expect(height({ entity: 'climate.living', show_fan: false, show_presets: false }, hass)).toBe(
      484,
    );
    expect(height({ entity: 'climate.living', variant: 'compact' }, hass)).toBe(468);
    expect(height({ entity: 'climate.living', show_stepper: false }, hass)).toBe(604);
    // the essentials while off are reserved the on height
    expect(height({ entity: 'climate.living', when_off: 'essentials' }, hass)).toBe(660);
  });

  it('counts the modes in the rows their words take: four modes two rows, a water heater’s long word too', () => {
    expect(height({ entity: 'climate.us' }, hass)).toBe(572);
    expect(height({ entity: 'water_heater.tank' }, hass)).toBe(572);
    expect(height({ entity: 'climate.living', modes: ['off', 'heat', 'cool'] }, hass)).toBe(660);
  });

  it('draws the ruler twice for a range', () => {
    expect(height({ entity: 'climate.range', variant: 'ruler', modes_style: 'full' }, hass)).toBe(
      452,
    );
    expect(
      height(
        {
          entity: 'climate.living',
          variant: 'ruler',
          modes_style: 'full',
          show_presets: false,
          show_fan: false,
        },
        hass,
      ),
    ).toBe(356);
  });

  it('declares Off · Heat · Cool and no presets without the house, or for an entity it has not described', () => {
    expect(height({ entity: 'climate.living' })).toBe(484);
    expect(
      height({ entity: 'climate.nulls' }, house([entity('climate.nulls', 'unavailable')])),
    ).toBe(356);
  });
});

describe('the devices', () => {
  const fan = declare('fluvy-fan-card');
  const cover = declare('fluvy-cover-card');
  const vacuum = declare('fluvy-vacuum-card');
  const hass = house([
    entity('fan.bedroom', 'off', {
      supported_features: 63,
      preset_modes: ['eco', 'sleep', 'boost'],
    }),
    entity('fan.tower', 'on', { supported_features: 51 }),
    entity('fan.purifier', 'on', {
      supported_features: 57,
      preset_modes: ['auto', 'night', 'turbo'],
    }),
    entity('cover.garage', 'closed', { supported_features: 11 }),
    entity('cover.slats', 'open', { supported_features: 251, current_tilt_position: 30 }),
    entity('cover.blind', 'open', { supported_features: 15, current_position: 60 }),
    entity('vacuum.dock', 'docked', {
      supported_features: 8828,
      battery_level: 100,
      fan_speed_list: ['quiet', 'standard', 'turbo', 'max'],
    }),
    entity('vacuum.basic', 'idle', { supported_features: 8796, battery_level: 16 }),
    entity('lawn_mower.garden', 'mowing', { supported_features: 7 }),
    entity('lock.back_door', 'unlocked', { supported_features: 1 }),
    entity('lock.front_door', 'locked', { supported_features: 0 }),
    entity('alarm_control_panel.house', 'armed_home', { supported_features: 3 }),
    entity('alarm_control_panel.night', 'disarmed', { supported_features: 7 }),
    entity('alarm_control_panel.all', 'disarmed', { supported_features: 55 }),
  ]);

  it('fan: the rows the fan has, its presets as chips; both rows without the house', () => {
    expect(onGrid(fan({ entity: 'fan.bedroom' }, hass))).toBe(452);
    expect(fan({ entity: 'fan.tower' }, hass)).toBe(304);
    expect(fan({ entity: 'fan.purifier' }, hass)).toBe(316);
    expect(fan({ entity: 'fan.bedroom', show_presets: false }, hass)).toBe(364);
    expect(fan({ entity: 'fan.bedroom' })).toBe(364);
    expect(fan({ entity: 'fan.bedroom', variant: 'compact' }, hass)).toBe(144);
  });

  it('cover: the ruler where it takes a position, the tilt alone, else the head and the commands', () => {
    expect(cover({ entity: 'cover.blind' }, hass)).toBe(328);
    expect(cover({ entity: 'cover.slats' }, hass)).toBe(224);
    expect(cover({ entity: 'cover.slats', show_tilt: false }, hass)).toBe(144);
    expect(cover({ entity: 'cover.garage' }, hass)).toBe(144);
    expect(cover({ entity: 'cover.garage' })).toBe(328);
    expect(
      cover({ entity: 'cover.blind', favorites: [{ name: 'Morning', position: 60 }] }, hass),
    ).toBe(416);
  });

  it('vacuum: its readouts, battery, commands and suction; a mower its battery and commands', () => {
    expect(onGrid(vacuum({ entity: 'vacuum.dock' }, hass))).toBe(388);
    expect(vacuum({ entity: 'vacuum.basic', remaining_entity: 'sensor.left' }, hass)).toBe(316);
    expect(vacuum({ entity: 'lawn_mower.garden', battery_entity: 'sensor.b' }, hass)).toBe(256);
    expect(vacuum({ entity: 'vacuum.dock', show_battery: false }, hass)).toBe(276);
    // without the house: the battery, the commands and two rows of suction chips (the readouts are the config's)
    expect(vacuum({ entity: 'vacuum.dock' })).toBe(388);
  });

  it('lock: the latch’s row where the lock has one', () => {
    expect(
      lockHeight({ type: 'x', entity: 'lock.back_door', rows: ['binary_sensor.a'] }, hass),
    ).toBe(280);
    expect(
      lockHeight({ type: 'x', entity: 'lock.front_door', rows: ['binary_sensor.a'] }, hass),
    ).toBe(220);
    expect(lockHeight({ type: 'x', entity: 'lock.back_door' })).toBe(144);
  });

  it('alarm: the modes its panel has, in the rows their tiles take', () => {
    expect(alarmHeight({ type: 'x', entity: 'alarm_control_panel.house' }, hass)).toBe(212);
    expect(alarmHeight({ type: 'x', entity: 'alarm_control_panel.night' }, hass)).toBe(300);
    expect(alarmHeight({ type: 'x', entity: 'alarm_control_panel.all' }, hass)).toBe(300);
    expect(
      alarmHeight({ type: 'x', entity: 'alarm_control_panel.house', rows: ['a', 'b'] }, hass),
    ).toBe(348);
    expect(
      alarmHeight(
        {
          type: 'x',
          entity: 'alarm_control_panel.house',
          modes: ['arm_away', 'disarm', 'arm_night'],
        },
        hass,
      ),
    ).toBe(212);
    expect(alarmHeight({ type: 'x', entity: 'alarm_control_panel.gone' })).toBe(212);
  });
});

describe('the player, the weather and the clock', () => {
  const clock = declare('fluvy-clock-card');
  const hass = house([
    entity('media_player.tv', 'playing', {
      supported_features: 22973,
      source_list: ['TV', 'Netflix', 'Spotify', 'HDMI 1', 'HDMI 2', 'AirPlay', 'Radio'],
    }),
    entity('media_player.patio', 'off', { supported_features: 20925 }),
    entity('weather.home', 'cloudy', { supported_features: 3 }),
    entity('weather.hourly', 'cloudy', { supported_features: 2 }),
    entity('weather.plain', 'cloudy', {}),
  ]);

  it('media: the sources as filled chips (six at most) under their label', () => {
    expect(onGrid(mediaHeight({ type: 'x', entity: 'media_player.tv' }, hass))).toBe(484);
    expect(mediaHeight({ type: 'x', entity: 'media_player.tv', show_source: false }, hass)).toBe(
      352,
    );
    expect(mediaHeight({ type: 'x', entity: 'media_player.patio' }, hass)).toBe(352);
    expect(mediaHeight({ type: 'x', entity: 'media_player.tv' })).toBe(352);
  });

  it('weather: a forecast the entity does not offer counts nothing; one that writes no features is asked', () => {
    expect(weatherHeight({ type: 'x', entity: 'weather.home', forecast: 'both' }, hass)).toBe(544);
    expect(weatherHeight({ type: 'x', entity: 'weather.hourly', forecast: 'both' }, hass)).toBe(
      228,
    );
    expect(weatherHeight({ type: 'x', entity: 'weather.hourly' }, hass)).toBe(128);
    expect(weatherHeight({ type: 'x', entity: 'weather.plain' }, hass)).toBe(444);
    expect(weatherHeight({ type: 'x', entity: 'weather.hourly', variant: 'compact' }, hass)).toBe(
      84,
    );
  });

  it('clock: the side card by its face, the forecast row where the weather offers a daily one', () => {
    expect(clock({ variant: 'side', face: 'analog' })).toBe(208);
    expect(clock({ variant: 'side', face: 'digital' })).toBe(132);
    expect(clock({ variant: 'side', face: 'analog', weather: 'weather.home' }, hass)).toBe(268);
    expect(clock({ variant: 'side', face: 'analog', weather: 'weather.hourly' }, hass)).toBe(208);
    expect(clock({ face: 'digital', weather: 'weather.hourly' }, hass)).toBe(136);
    expect(clock({ face: 'digital', weather: 'weather.home' }, hass)).toBe(196);
    expect(clock({ face: 'analog', weather: 'weather.hourly' }, hass)).toBe(292);
  });
});

describe('lights and sensors', () => {
  const light = declare('fluvy-light-card');
  const lights = declare('fluvy-lights-card');
  const sensor = declare('fluvy-sensor-card');
  const registries = {
    entities: {
      'light.a': { entity_id: 'light.a', area_id: 'kitchen' },
      'light.b': { entity_id: 'light.b', area_id: 'kitchen' },
    },
    devices: {},
    areas: {
      kitchen: { area_id: 'kitchen', name: 'Kitchen' },
      attic: { area_id: 'attic', name: 'Attic' },
    },
  } as unknown as Partial<HomeAssistant>;
  const hass = house(
    [
      entity('light.colour', 'on', { supported_color_modes: ['hs', 'color_temp'] }),
      entity('light.white', 'on', { supported_color_modes: ['color_temp'] }),
      entity('light.dimmer', 'off', { supported_color_modes: ['brightness'] }),
      entity('light.onoff', 'on', { supported_color_modes: ['onoff'] }),
      entity('light.a', 'on', { friendly_name: 'Ceiling' }),
      entity('light.b', 'off', { friendly_name: 'Floor lamp' }),
      entity('sensor.temp', '21.4', { device_class: 'temperature', unit_of_measurement: '°C' }),
      entity('sensor.washer', 'Rinsing', { friendly_name: 'Washer' }),
      entity('sensor.power', '505', { device_class: 'power', unit_of_measurement: 'W' }),
    ],
    registries,
  );

  it('light: a colour bulb its ruler and swatches, a white one its ruler, a dimmer neither, a switch its head', () => {
    expect(light({ entity: 'light.colour' }, hass)).toBe(428);
    expect(light({ entity: 'light.white' }, hass)).toBe(368);
    expect(light({ entity: 'light.dimmer' }, hass)).toBe(268);
    expect(light({ entity: 'light.onoff' }, hass)).toBe(84);
    expect(light({ entity: 'light.onoff', variant: 'compact' }, hass)).toBe(84);
    expect(light({ entity: 'light.gone' }, hass)).toBe(268);
    expect(light({ entity: 'light.colour' })).toBe(428);
  });

  it('lights: the room’s lights as the house lists them, chips in the rows their names take, the empty panel', () => {
    expect(lights({ area: 'kitchen', variant: 'tiles' }, hass)).toBe(64 + 16 + 84 + 20);
    expect(lights({ area: 'kitchen', variant: 'chips' }, hass)).toBe(64 + 16 + 44 + 20);
    expect(lights({ area: 'attic' }, hass)).toBe(220);
    expect(lights({ area: 'kitchen', variant: 'tiles' })).toBe(64 + 16 + 176 + 20);
    expect(
      lights(
        {
          variant: 'chips',
          lights: [
            { entity: 'light.a', name: 'The big paper lantern over the dining table' },
            'light.b',
            { entity: 'light.c', name: 'Reading lamp' },
          ],
        },
        hass,
      ),
    ).toBe(64 + 16 + 132 + 20);
  });

  it('sensor: a word keeps its state and draws no chart; several sensors a row, or a line each', () => {
    expect(sensor({ entity: 'sensor.washer' }, hass)).toBe(164);
    expect(sensor({ entity: 'sensor.temp' }, hass)).toBe(304);
    expect(
      sensor(
        {
          entity: 'sensor.temp',
          label: 'Inside',
          entities: [{ entity: 'sensor.power', name: 'Power' }, 'sensor.washer'],
        },
        hass,
      ),
    ).toBe(276);
    expect(
      sensor(
        {
          entity: 'sensor.temp',
          entities: [{ entity: 'sensor.power', name: 'Power' }, 'sensor.washer'],
        },
        hass,
      ),
    ).toBe(348);
    expect(sensor({ entity: 'sensor.temp', entities: ['sensor.power'] })).toBe(276);
  });
});

describe('rooms, helpers, updates, tiles and readouts', () => {
  const room = declare('fluvy-room-card');
  const helpers = declare('fluvy-helpers-card');
  const updates = declare('fluvy-updates-card');
  const tiles = declare('fluvy-tiles-card');
  const readouts = declare('fluvy-readouts-card');
  const stats = declare('fluvy-stat-tiles-card');
  const registries = {
    entities: {
      'light.l': { entity_id: 'light.l', area_id: 'living' },
      'climate.c': { entity_id: 'climate.c', area_id: 'living' },
      'sensor.t': { entity_id: 'sensor.t', area_id: 'living' },
      'climate.s': { entity_id: 'climate.s', area_id: 'study' },
    },
    devices: {},
    areas: {
      living: { area_id: 'living', name: 'Living room', picture: '/local/living.jpg' },
      study: { area_id: 'study', name: 'Study' },
      empty: { area_id: 'empty', name: 'Store' },
    },
    user: { is_admin: false },
  } as unknown as Partial<HomeAssistant>;
  const hass = house(
    [
      entity('light.l', 'on'),
      entity('climate.c', 'heat', { current_temperature: 21 }),
      entity('sensor.t', '21.4', { device_class: 'temperature', unit_of_measurement: '°C' }),
      entity('climate.s', 'heat', { current_temperature: 20 }),
      entity('input_number.n', '5', { min: 0, max: 10, step: 1 }),
      entity('number.boxed', '5', { min: 0, max: 10, step: 1, mode: 'box' }),
      entity('counter.k', '3', {}),
      entity('input_select.s', 'Home', { options: ['Home', 'Away', 'Night', 'Guests'] }),
      entity('input_select.long', 'A', { options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }),
      entity('input_text.t', 'abc'),
      entity('input_datetime.w', '06:30:00', { has_date: false, has_time: true }),
      entity('input_boolean.b', 'on'),
      entity('update.a', 'on', {}),
      entity('update.b', 'off', {}),
      entity('update.c', 'on', { in_progress: true }),
    ],
    registries,
  );

  it('room: its rows, readouts, picture and empty panel as the house says', () => {
    expect(onGrid(room({ area: 'living' }, hass))).toBe(160 + 64 + 16 + 180 + 20);
    expect(room({ area: 'living', controls: 'tiles' }, hass)).toBe(160 + 64 + 16 + 84 + 20);
    expect(room({ area: 'study' }, hass)).toBe(64 + 16 + 120 + 20);
    expect(room({ area: 'study', variant: 'photo' }, hass)).toBe(160 + 64 + 16 + 120 + 20);
    expect(room({ area: 'empty' }, hass)).toBe(64 + 16 + 120 + 20);
    expect(room({ area: 'empty', variant: 'photo' }, hass)).toBe(160 + 20 + 120 + 20);
    expect(room({ area: 'living' })).toBe(160 + 64 + 16 + 240 + 20);
  });

  it('helpers: blocks by kind and groups of rows, a time’s presets under its row', () => {
    expect(helpers({ title: 'T', entities: ['input_number.n'] }, hass)).toBe(64 + 16 + 92 + 20);
    expect(helpers({ title: 'T', entities: ['number.boxed'] }, hass)).toBe(64 + 16 + 44 + 20);
    expect(helpers({ title: 'T', entities: ['counter.k'] }, hass)).toBe(64 + 16 + 44 + 20);
    expect(helpers({ title: 'T', entities: ['input_select.s'] }, hass)).toBe(64 + 16 + 72 + 20);
    expect(helpers({ title: 'T', entities: ['input_select.long'] }, hass)).toBe(64 + 16 + 60 + 20);
    expect(helpers({ title: 'T', entities: ['input_text.t'] }, hass)).toBe(64 + 16 + 76 + 20);
    expect(helpers({ title: 'T', entities: ['input_boolean.b', 'input_datetime.w'] }, hass)).toBe(
      64 + 16 + 120 + 20,
    );
    expect(
      helpers(
        { title: 'T', rows: [{ entity: 'input_datetime.w', presets: ['06:15', '07:15'] }] },
        hass,
      ),
    ).toBe(64 + 16 + 60 + 56 + 20);
    expect(helpers({ title: 'T', entities: ['input_number.n', 'input_boolean.b'] })).toBe(
      64 + 16 + 92 + 16 + 60 + 20,
    );
  });

  it('updates: the rows that wait, one installing, the quiet row, the switch', () => {
    expect(updates({ entities: ['update.a', 'update.b', 'update.c'] }, hass)).toBe(100 + 120 + 16);
    expect(updates({ entities: ['update.b'] }, hass)).toBe(160);
    expect(updates({ entities: ['update.a', 'update.b'], show_up_to_date: true }, hass)).toBe(220);
    expect(updates({ entities: ['update.a'], toggle: 'input_boolean.b' }, hass)).toBe(160 + 76);
    expect(updates({ entities: ['update.a', 'update.b'] })).toBe(220);
  });

  it('tiles: compact by default, the columns asked for as far as a 360 column holds them', () => {
    expect(tiles({ entities: ['a', 'b'] })).toBe(76);
    expect(tiles({ entities: ['a', 'b', 'c'] })).toBe(160);
    expect(tiles({ entities: ['a', 'b'], size: 'large' })).toBe(168);
    expect(tiles({ entities: ['a', 'b', 'c'], size: 'mini' })).toBe(108);
    expect(tiles({ entities: ['a', 'b', 'c', 'd'], size: 'mini', columns: 4 })).toBe(224);
    expect(tiles({ entities: ['a', 'b'], columns: 1 })).toBe(160);
  });

  it('readouts: three a row, four as two by two, five as three and two', () => {
    expect(readouts({ entities: ['a', 'b', 'c'] })).toBe(88);
    expect(readouts({ entities: ['a', 'b', 'c', 'd'] })).toBe(152);
    expect(readouts({ entities: ['a', 'b', 'c', 'd'], variant: 'row' })).toBe(152);
    expect(readouts({ entities: ['a', 'b', 'c', 'd', 'e'] })).toBe(152);
  });

  it('stat tiles: compact tiles in the columns their words take', () => {
    const short = house([
      entity('sensor.o', '3.2', { unit_of_measurement: 'kW', friendly_name: 'Output' }),
      entity('sensor.b', '64', { unit_of_measurement: '%', friendly_name: 'Battery' }),
      entity('sensor.c', '1.1', {
        unit_of_measurement: 'kW',
        friendly_name: 'Car charger in the garage',
      }),
    ]);
    expect(
      stats(
        {
          title: 'T',
          variant: 'compact',
          tiles: ['sensor.o', 'sensor.b', { entity: 'sensor.o', name: 'To battery' }],
        },
        short,
      ),
    ).toBe(164);
    expect(
      stats({ title: 'T', variant: 'compact', tiles: ['sensor.o', 'sensor.b', 'sensor.c'] }, short),
    ).toBe(236);
    expect(
      stats({ title: 'T', variant: 'compact', tiles: ['sensor.o', 'sensor.b', 'sensor.c'] }),
    ).toBe(164);
  });
});

describe('the energy family and the lists', () => {
  const distribution = declare('fluvy-distribution-card');
  const hass = house([
    entity('sensor.self', '72', { friendly_name: 'Self-powered', unit_of_measurement: '%' }),
    entity('sensor.exp', '1.3', { friendly_name: 'Exported', unit_of_measurement: 'kWh' }),
    entity('sensor.imp', '4.1', { friendly_name: 'Imported', unit_of_measurement: 'kWh' }),
    entity('sensor.speaker', '0.4', {
      friendly_name: 'Kitchen speaker',
      unit_of_measurement: 'kWh',
    }),
    entity('sensor.east_a', '1', { friendly_name: 'East, upper', unit_of_measurement: 'kWh' }),
    entity('sensor.east_b', '1', { friendly_name: 'East, lower', unit_of_measurement: 'kWh' }),
    entity('sensor.west_a', '1', { friendly_name: 'West, upper', unit_of_measurement: 'kWh' }),
    entity('sensor.west_b', '1', { friendly_name: 'Garage roof', unit_of_measurement: 'kWh' }),
    entity('sensor.dish', '1.4', { device_class: 'energy', unit_of_measurement: 'kWh' }),
    entity('sensor.heat', '13.7', { device_class: 'energy', unit_of_measurement: 'MJ' }),
    entity('sensor.water', '120', { device_class: 'water', unit_of_measurement: 'L' }),
    entity('sensor.dead', 'unavailable', { device_class: 'water', unit_of_measurement: 'L' }),
    entity('select.mode', 'Backup', { options: ['Self use', 'Backup', 'Force charge'] }),
    entity('select.evcc', 'Solar', { options: ['Off', 'Solar', 'Fast', 'Min'] }),
  ]);
  const sources = [{ type: 'solar', power: 'sensor.s' }];

  it('grid and flow: the readouts named, in the rows their labels take; the energy cards’ short names', () => {
    expect(gridHeight({ type: 'x', power: 'sensor.g' })).toBe(224);
    const readouts = ['sensor.self', 'sensor.exp', 'sensor.imp'];
    expect(gridHeight({ type: 'x', power: 'sensor.g', readouts }, hass)).toBe(284);
    expect(
      gridHeight({ type: 'x', power: 'sensor.g', readouts: ['sensor.exp', 'sensor.imp'] }, hass),
    ).toBe(224);
    expect(flowHeight({ type: 'x', sources, readouts }, hass)).toBe(
      flowHeight({ type: 'x', sources }) + 120,
    );
    expect(
      flowHeight(
        { type: 'x', sources, readouts: ['sensor.speaker', 'sensor.exp', 'sensor.imp'] },
        hass,
      ),
    ).toBe(flowHeight({ type: 'x', sources }) + 60);
  });

  it('a legend folds where two neighbours’ names would stand closer than 8, not only where one overhangs', () => {
    // Solar · Other · Charged · Exported in a 360 card: Charged and Exported fill their 80 columns and would touch
    expect(legendFold([58, 68, 79, 81], 320)).toBe(2);
    expect(legendFold([58, 72, 50, 58], 320)).toBe(4);
    // a name two pixels over its column holds it where its neighbours leave it the room
    expect(legendFold([50, 82, 50], 240)).toBe(3);
    expect(legendFold([76, 82, 50], 240)).toBe(1);
    // the room between columns counts between neighbours too
    expect(legendFold([90, 90, 90], 320, 0, 12)).toBe(3);
    // a house with a battery and the grid and no sun: four names, two rows of two
    expect(legendRows(['Battery', 'Grid', 'Charged', 'Exported'])).toBe(2);
  });

  it('production: the legend in the rows the arrays’ names take', () => {
    expect(legendRows(['East', 'West'])).toBe(1);
    expect(legendRows(['East, upper', 'East, lower', 'West, upper', 'Garage roof'])).toBe(2);
    expect(
      legendRows(['East-facing roof over the kitchen', 'West-facing roof over the garage', 'West']),
    ).toBe(3);
    expect(
      productionHeight(
        { type: 'x', entity: 'sensor.p', arrays: ['sensor.east_a', 'sensor.west_a'] },
        hass,
      ),
    ).toBe(368);
    expect(
      productionHeight(
        {
          type: 'x',
          entity: 'sensor.p',
          arrays: ['sensor.east_a', 'sensor.east_b', 'sensor.west_a', 'sensor.west_b'],
        },
        hass,
      ),
    ).toBe(416);
    expect(productionHeight({ type: 'x', entity: 'sensor.p' })).toBe(344);
  });

  it('devices: a bar row each, one more under a parent, one for the rest of the house', () => {
    const rows = ['sensor.dish', 'sensor.heat', 'sensor.water', 'sensor.dead'];
    expect(devicesHeight({ type: 'x', rows })).toBe(100 + 4 * 76);
    expect(devicesHeight({ type: 'x', rows, total: 'sensor.house' })).toBe(100 + 5 * 76);
  });

  it('batteries and the charger: the mode’s options as the house lists them', () => {
    const one = [{ power: 'sensor.a', level: 'sensor.l' }];
    expect(batteriesHeight({ type: 'x', batteries: one })).toBe(240);
    expect(batteriesHeight({ type: 'x', batteries: one, mode: 'select.mode' }, hass)).toBe(
      240 + 132,
    );
    expect(batteriesHeight({ type: 'x', batteries: one, mode: 'select.mode' })).toBe(240 + 88);
    expect(
      chargerHeight(
        { type: 'x', entity: 'sensor.p', level: 'sensor.l', mode: 'select.evcc' },
        hass,
      ),
    ).toBe(240 + 216);
    expect(
      chargerHeight({ type: 'x', entity: 'sensor.p', level: 'sensor.l', mode: 'select.evcc' }),
    ).toBe(240 + 128);
  });

  it('distribution: the rest of the house is one more legend row when the total is given', () => {
    expect(distribution({ entities: ['a', 'b'] })).toBe(196);
    expect(distribution({ entities: ['a', 'b'], total: 'sensor.house' })).toBe(232);
    expect(distribution({ entities: ['a', 'b'], total: 'sensor.house', variant: 'rows' })).toBe(
      280,
    );
  });

  it('the lists: alerts rows 4 under the head, the appliances the house has, the printer’s readouts', () => {
    expect(alertsHeight({ type: 'x', variant: 'rows', alerts: ['a', 'b', 'c'] })).toBe(88 + 180);
    expect(alertsHeight({ type: 'x', variant: 'rows', compact: true, alerts: ['a', 'b'] })).toBe(
      88 + 96,
    );
    expect(appliancesHeight({ type: 'x', variant: 'tiles' })).toBe(100 + 3 * 88 + 16 + 52);
    expect(printerHeight({ type: 'x', variant: 'compact', device: 'd' })).toBe(192);
    expect(
      printerHeight({
        type: 'x',
        variant: 'compact',
        readouts: ['nozzle', 'bed', 'layer', 'speed'],
      }),
    ).toBe(248);
    expect(printerHeight({ type: 'x', device: 'd' })).toBe(528);
    expect(printerHeight({ type: 'x', device: 'd', aspect_ratio: '4:3' })).toBe(588);
    expect(
      printerHeight({
        type: 'x',
        device: 'd',
        show_image: false,
        show_controls: false,
        readouts: ['a', 'b', 'c', 'd'],
      }),
    ).toBe(328);
  });
});
