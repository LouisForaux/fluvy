import {
  areaContents,
  areaEntities,
  entriesOf,
  idsOf,
  layoutHeightOf,
  textName,
  type HomeAssistant,
  type LovelaceCardConfig,
} from '@fluvy/core';
import { applianceHouseHeight } from './appliance/appliance-card.js';
import { appliancesHouseHeight } from './appliance/appliances-card.js';
import { clockHeight, type ClockCardConfig } from './clock/clock-card.js';
import { offersDaily } from './clock/sky.js';
import { coverHeight, type CoverCardConfig } from './cover/cover-card.js';
import { alarmHeight, camerasHeight, lockHeight } from './devices-family.js';
import {
  batteriesHeight,
  chargerHeight,
  flowHeight,
  gridHeight,
  productionHeight,
} from './energy-family.js';
import { fanHeight, type FanCardConfig } from './fan/fan-card.js';
import { helpersHeight, type HelpersCardConfig } from './helpers/helpers-card.js';
import { lightHeight, type LightCardConfig } from './light/light-card.js';
import { lightsHeight, type LightsCardConfig } from './lights/lights-card.js';
import { mediaHeight } from './media-family.js';
import { remoteGroups, remoteHeight } from './remote-family.js';
import { buttonService } from './remote/keys.js';
import { appSaid, platformOf, type AppSaid } from './remote/platforms.js';
import { roomHeight, type RoomCardConfig } from './room/room-card.js';
import { isWord, sensorHeight, type SensorCardConfig } from './sensor/sensor-card.js';
import { normaliseExtras } from './sensor/series.js';
import { COLOURED, dims } from './shared/light.js';
import type { NameOf } from './shared/heights.js';
import { statTilesHeight, type StatTilesCardConfig } from './stat-tiles/stat-tiles-card.js';
import { thermostatHeight, type ThermostatCardConfig } from './thermostat/thermostat-card.js';
import { updatesHeight, type UpdatesCardConfig } from './updates/updates-card.js';
import { vacuumHeight, type VacuumCardConfig } from './vacuum/vacuum-card.js';
import { weatherHeight } from './weather-family.js';

/*
 * The heights the automatic dashboard plans with, counted with the house: what an entity's capabilities draw (a
 * thermostat's presets, a fan's oscillation row, a cover's tilt), the options and names a row of chips is laid out
 * by, what a room holds. Each card declares its height from its config alone (`static layoutHeight`, which every
 * page carries); what the house says of it is read here and handed to the card's height function, in a chunk of its
 * own the strategy imports, so only the automatic dashboard pays for the reading.
 */

/* ---------- the house ---------- */

/** An entity's attribute as the house has it, when the entity is there. */
const attrOf = (hass: HomeAssistant, id: unknown, key: string): unknown =>
  typeof id === 'string' ? hass.states?.[id]?.attributes?.[key] : undefined;

/** An entity's list attribute (its modes, its sources): the strings in it, none without. */
const listAttr = (hass: HomeAssistant, id: unknown, key: string): string[] => {
  const value = attrOf(hass, id, key);
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
};

/** An entity's `supported_features`, 0 where it writes none. */
const featuresOf = (hass: HomeAssistant, id: unknown): number =>
  Number(attrOf(hass, id, 'supported_features')) || 0;

/** Whether the house holds the entity at all. */
const known = (hass: HomeAssistant, id: unknown): boolean =>
  typeof id === 'string' && hass.states?.[id] !== undefined;

/** An entity's name as the house writes it. */
const namesIn =
  (hass: HomeAssistant): NameOf =>
  (id) =>
    attrOf(hass, id, 'friendly_name');

/* ---------- what each card's entity draws ---------- */

/**
 * What the bulb does: a colour bulb draws its ruler and swatches, a white one its temperature ruler, a dimmer (or one
 * the house has not described) neither; one that only switches is its head alone.
 */
function light(config: LightCardConfig, hass: HomeAssistant): number {
  const modes = listAttr(hass, config.entity, 'supported_color_modes');
  const colour = modes.some((mode) => COLOURED.has(mode));
  return lightHeight(config, {
    colour,
    temperature: colour || modes.includes('color_temp'),
    dimmable: dims(modes),
  });
}

/**
 * The room's lights where the card lists none, their names, who reads the empty panel's hint, and whether one of
 * its lights takes a colour (the colour round, #137; one the house has not described does).
 */
function lights(config: LightsCardConfig, hass: HomeAssistant): number {
  const area =
    hass.states && config.area
      ? areaEntities(hass, config.area, { domains: ['light'] })
      : undefined;
  const ids = idsOf(entriesOf(config.lights ?? config.entities));
  return lightsHeight(config, {
    area,
    nameOf: namesIn(hass),
    admin: Boolean(hass.user?.is_admin),
    colour: (ids.length ? ids : (area ?? [])).some(
      (id) =>
        !known(hass, id) ||
        listAttr(hass, id, 'supported_color_modes').some((mode) => COLOURED.has(mode)),
    ),
  });
}

/**
 * What the thermostat offers: a climate's modes, a water heater's operations, a humidifier's Off and modes; its
 * presets and fan speeds; a range. An entity the house has not described is counted as none is.
 */
function thermostat(config: ThermostatCardConfig, hass: HomeAssistant): number {
  const id = config.entity ?? '';
  const state = hass.states?.[id];
  if (!state) return thermostatHeight(config);
  const list = (key: string): string[] => listAttr(hass, id, key);
  const domain = id.slice(0, id.indexOf('.'));
  return thermostatHeight(config, {
    modes:
      domain === 'water_heater'
        ? list('operation_list')
        : domain === 'humidifier'
          ? ['off', ...list('available_modes').filter((m) => m !== 'off')]
          : list('hvac_modes'),
    presets: list('preset_modes'),
    fans: list('fan_modes'),
    range:
      typeof state.attributes['target_temp_low'] === 'number' &&
      typeof state.attributes['target_temp_high'] === 'number',
  });
}

/** What the fan does and its presets; a fan the house has not read, its usual. */
const fan = (config: FanCardConfig, hass: HomeAssistant): number =>
  fanHeight(
    config,
    known(hass, config.entity) ? featuresOf(hass, config.entity) : undefined,
    listAttr(hass, config.entity, 'preset_modes'),
  );

/** What the cover does; a cover the house has not read, its usual. */
const cover = (config: CoverCardConfig, hass: HomeAssistant): number =>
  coverHeight(config, known(hass, config.entity) ? featuresOf(hass, config.entity) : undefined);

/** What the robot does, whether it reports its battery, its suction's speeds. */
function vacuum(config: VacuumCardConfig, hass: HomeAssistant): number {
  const id = config.entity;
  return vacuumHeight(config, {
    features: known(hass, id) ? featuresOf(hass, id) : undefined,
    level: attrOf(hass, id, 'battery_level') !== undefined,
    speeds: listAttr(hass, id, 'fan_speed_list'),
  });
}

/**
 * A sensor whose state is a word; two sensors beside the card's own that read a line each where a name with its key
 * would not hold its third (`pairFit`): the card's label, a sensor's name, else its measure's word ("Temperature") —
 * past ten letters.
 */
function sensor(config: SensorCardConfig, hass: HomeAssistant): number {
  const state = typeof config.entity === 'string' ? hass.states?.[config.entity] : undefined;
  const extras = normaliseExtras(config['entities']);
  const wordOf = (id: string, name: string | undefined): string =>
    name ?? String(attrOf(hass, id, 'device_class') ?? attrOf(hass, id, 'friendly_name') ?? '');
  const labels = [
    wordOf(config.entity ?? '', config.label),
    ...extras.map((item) => wordOf(item.entity, textName(item.name))),
  ];
  return sensorHeight(config, {
    word: state !== undefined && isWord(state.state),
    stacked: extras.length === 2 && labels.some((label) => label.length > 10),
  });
}

/** Whether the clock's weather offers a daily forecast. */
const clock = (config: ClockCardConfig, hass: HomeAssistant): number =>
  clockHeight(config, !config.weather || offersDaily(hass.states[config.weather]));

/** What the room holds, its picture, and who reads the empty panel's hint; a room the registry does not know, none. */
function room(config: RoomCardConfig, hass: HomeAssistant): number {
  const areaId = typeof config.area === 'string' ? config.area : '';
  const area = areaId && hass.states ? hass.areas?.[areaId] : undefined;
  return roomHeight(
    config,
    area
      ? {
          found: areaContents(hass, areaId, config),
          picture: Boolean(area.picture),
          admin: Boolean(hass.user?.is_admin),
        }
      : undefined,
  );
}

/**
 * A number's range (a counter's minimum and maximum; any other unless boxed, or written with no bounds), a select's
 * options, a moment's date.
 */
const helpers = (config: HelpersCardConfig, hass: HomeAssistant): number =>
  helpersHeight(config, (id, domain) => {
    const attr = (key: string): unknown => attrOf(hass, id, key);
    const counter = domain === 'counter';
    const min = attr(counter ? 'minimum' : 'min');
    const max = attr(counter ? 'maximum' : 'max');
    return {
      ranged: counter
        ? typeof min === 'number' && typeof max === 'number'
        : attr('mode') !== 'box' && !(known(hass, id) && (min === null || max === null)),
      options: listAttr(hass, id, 'options'),
      dated: Boolean(attr('has_date')),
    };
  });

/** The updates that wait (or cannot be read; every one with `show_up_to_date`), and those installing. */
function updates(config: UpdatesCardConfig, hass: HomeAssistant): number {
  const waiting = idsOf(config.entities).filter((id) => {
    const state = hass.states?.[id];
    return (
      config.show_up_to_date === true ||
      !state ||
      state.state === 'on' ||
      state.state === 'unavailable' ||
      state.state === 'unknown'
    );
  });
  return updatesHeight(
    config,
    waiting.length,
    waiting.filter((id) => attrOf(hass, id, 'in_progress') === true).length,
  );
}

/** The tiles' names, which `auto` columns are laid out by. */
const statTiles = (config: StatTilesCardConfig, hass: HomeAssistant): number =>
  statTilesHeight(config, namesIn(hass));

/** `lock.open`: the latch some locks can pull back. */
const LOCK_OPEN = 1;

/** Whether the lock has a latch to pull back. */
const lock = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  lockHeight(config, (featuresOf(hass, config['entity']) & LOCK_OPEN) !== 0);

/** The ways the panel arms. */
const alarm = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  alarmHeight(config, featuresOf(hass, config['entity']));

/** The area's cameras, where the card lists none. */
const cameras = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  camerasHeight(
    config,
    typeof config['area'] === 'string' && hass.states
      ? areaEntities(hass, config['area'], { domains: ['camera'] }).length
      : undefined,
  );

/** `media_player` SELECT_SOURCE: a player that takes a source. */
const SELECT_SOURCE = 2048;

/** The player's sources, where it takes one. */
const sourcesOf = (hass: HomeAssistant, id: unknown): string[] =>
  featuresOf(hass, id) & SELECT_SOURCE ? listAttr(hass, id, 'source_list') : [];

const media = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  mediaHeight(config, sourcesOf(hass, config['entity']));

/**
 * What the remote draws of the house: the sources as chips (the inputs, where the apps row draws the platforms among
 * them), the apps by the names the row says under them (the person's list, else the platforms among the sources), and
 * whether anything takes the D-pad's and the channel's keys (a remote, or a webOS television's own buttons).
 */
const remote = (config: LovelaceCardConfig, hass: HomeAssistant): number => {
  const sources = sourcesOf(hass, config['entity']);
  const own = Array.isArray(config['apps']) ? (config['apps'] as AppSaid[]) : [];
  const appsDrawn = remoteGroups(config['groups']).includes('apps') && !own.length;
  const entity = typeof config['entity'] === 'string' ? config['entity'] : '';
  return remoteHeight(config, {
    sources: appsDrawn ? sources.filter((source) => !platformOf(source)) : sources,
    apps: own.length
      ? own.map(appSaid)
      : sources.flatMap((source) => {
          const p = platformOf(source);
          return p ? [p.short ?? p.title] : [];
        }),
    keyed: Boolean(config['remote']) || buttonService(hass.entities?.[entity]?.platform),
  });
};

/** The forecasts the weather offers (its features; every one where it writes none). */
function weather(config: LovelaceCardConfig, hass: HomeAssistant): number {
  const features = attrOf(hass, config['entity'], 'supported_features');
  return weatherHeight(config, typeof features === 'number' ? features : undefined);
}

/** The readouts' names, which their rows are laid out by. */
const flow = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  flowHeight(config, namesIn(hass));
const grid = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  gridHeight(config, namesIn(hass));

/** The arrays' names, which the legend is laid out by. */
const production = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  productionHeight(config, namesIn(hass));

/** The mode's options, as many rows as they take. */
const batteries = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  batteriesHeight(config, listAttr(hass, config['mode'], 'options'));
const charger = (config: LovelaceCardConfig, hass: HomeAssistant): number =>
  chargerHeight(config, listAttr(hass, config['mode'], 'options'));

/** A card's height counted with the house; its config is the card's own. */
type HouseHeight = (config: never, hass: HomeAssistant) => number;

/** The cards whose height the house changes, by tag (the appliances' is read in their own chunk). */
const HOUSE: ReadonlyMap<string, HouseHeight> = new Map<string, HouseHeight>([
  ['fluvy-light-card', light],
  ['fluvy-lights-card', lights],
  ['fluvy-thermostat-card', thermostat],
  ['fluvy-fan-card', fan],
  ['fluvy-cover-card', cover],
  ['fluvy-vacuum-card', vacuum],
  ['fluvy-sensor-card', sensor],
  ['fluvy-clock-card', clock],
  ['fluvy-room-card', room],
  ['fluvy-helpers-card', helpers],
  ['fluvy-updates-card', updates],
  ['fluvy-stat-tiles-card', statTiles],
  ['fluvy-lock-card', lock],
  ['fluvy-alarm-card', alarm],
  ['fluvy-cameras-card', cameras],
  ['fluvy-media-card', media],
  ['fluvy-remote-card', remote],
  ['fluvy-weather-card', weather],
  ['fluvy-energy-flow-card', flow],
  ['fluvy-grid-card', grid],
  ['fluvy-production-card', production],
  ['fluvy-batteries-card', batteries],
  ['fluvy-ev-charger-card', charger],
  ['fluvy-appliance-card', applianceHouseHeight],
  ['fluvy-appliances-card', appliancesHouseHeight],
]);

/**
 * A card's height at a 360 column as the automatic dashboard plans it: counted with the house where the house changes
 * it, else as the card declares it from its config (`layoutHeightOf`), else `fallback` (a card of another maker).
 */
export function houseHeightOf(
  config: LovelaceCardConfig,
  fallback: number,
  hass?: HomeAssistant,
): number {
  const tag = config.type.startsWith('custom:') ? config.type.slice('custom:'.length) : '';
  const house = HOUSE.get(tag);
  return house && hass ? house(config as never, hass) : layoutHeightOf(config, fallback);
}
