import { MATTER_FAN, ROBOROCK, speakingAttributes } from '../attribute-words.js';
import type { SheetSpec } from '../scenes.js';
import { FluvyCoverCard } from '../../../../packages/cards/src/cover/cover-card.js';
import { FluvyFanCard } from '../../../../packages/cards/src/fan/fan-card.js';
import { FluvyVacuumCard } from '../../../../packages/cards/src/vacuum/vacuum-card.js';

/**
 * Devices, first half: what moves — covers and valves, fans, vacuums and lawn mowers.
 * The "Blinds", "Ceiling fan" and "Vacuum" frames mirror `apps/design-lab/devices.js`; the rest are
 * the states a real instance serves all day. An unavailable entity keeps what Home Assistant keeps
 * for it — its supported features and capability lists — and loses every live attribute.
 */
if (!customElements.get('fluvy-cover-card'))
  customElements.define('fluvy-cover-card', FluvyCoverCard);
if (!customElements.get('fluvy-fan-card')) customElements.define('fluvy-fan-card', FluvyFanCard);
if (!customElements.get('fluvy-vacuum-card'))
  customElements.define('fluvy-vacuum-card', FluvyVacuumCard);

/* cover: OPEN 1 · CLOSE 2 · SET_POSITION 4 · STOP 8 · OPEN_TILT 16 · CLOSE_TILT 32 · STOP_TILT 64 · SET_TILT_POSITION 128 */
const COVER_ALL = 255;
const COVER_POSITION = 1 + 2 + 4 + 8;
const COVER_BUTTONS = 1 + 2 + 8;
const COVER_SLATS = COVER_BUTTONS + 16 + 32 + 64 + 128;
/* fan: SET_SPEED 1 · OSCILLATE 2 · DIRECTION 4 · PRESET_MODE 8 · TURN_OFF 16 · TURN_ON 32 */
const FAN_POWER = 16 + 32;
const FAN_ALL = 1 + 2 + 4 + 8 + FAN_POWER;
/* vacuum: PAUSE 4 · STOP 8 · RETURN_HOME 16 · FAN_SPEED 32 · BATTERY 64 · LOCATE 512 · START 8192 */
const VACUUM_PLAIN = 4 + 8 + 16 + 64 + 512 + 8192;
const VACUUM_ALL = VACUUM_PLAIN + 32;
const SUCTION = ['quiet', 'standard', 'turbo', 'max'];

export const sheet: SheetSpec = {
  states: [
    [
      'cover.blinds',
      'open',
      {
        friendly_name: 'Blinds',
        device_class: 'window',
        supported_features: COVER_ALL,
        current_position: 65,
        current_tilt_position: 17,
      },
    ],
    [
      'cover.garage',
      'closed',
      { friendly_name: 'Garage door', device_class: 'garage', supported_features: COVER_BUTTONS },
    ],
    [
      'cover.curtain',
      'closing',
      {
        friendly_name: 'Bedroom',
        device_class: 'curtain',
        supported_features: COVER_POSITION,
        current_position: 40,
      },
    ],
    [
      'cover.shade',
      'open',
      {
        friendly_name: 'Office shade',
        device_class: 'shade',
        supported_features: COVER_ALL,
        current_position: 100,
        current_tilt_position: 50,
      },
    ],
    [
      'cover.slats',
      'open',
      {
        friendly_name: 'Pergola',
        device_class: 'awning',
        supported_features: COVER_SLATS,
        current_tilt_position: 30,
      },
    ],
    [
      'cover.gone',
      'unavailable',
      { friendly_name: 'Terrace', device_class: 'awning', supported_features: COVER_ALL },
    ],
    [
      'valve.irrigation',
      'open',
      {
        friendly_name: 'Irrigation',
        device_class: 'water',
        supported_features: COVER_POSITION,
        current_position: 45,
      },
    ],

    [
      'fan.ceiling',
      'on',
      {
        friendly_name: 'Ceiling fan',
        supported_features: 1 + 2 + 4 + FAN_POWER,
        percentage: 60,
        percentage_step: 1,
        oscillating: true,
        direction: 'forward',
      },
    ],
    [
      'fan.bedroom',
      'off',
      {
        friendly_name: 'Bedroom fan',
        supported_features: FAN_ALL,
        percentage: 0,
        percentage_step: 1,
        oscillating: false,
        direction: 'reverse',
        preset_modes: ['eco', 'sleep', 'boost'],
        preset_mode: null,
      },
    ],
    [
      'fan.tower',
      'on',
      {
        friendly_name: 'Tower fan',
        supported_features: 1 + 2 + FAN_POWER,
        percentage: 66,
        percentage_step: 100 / 3,
        oscillating: false,
      },
    ],
    [
      'fan.purifier',
      'on',
      {
        friendly_name: 'Purifier',
        supported_features: 1 + 8 + FAN_POWER,
        percentage: null,
        percentage_step: 25,
        preset_modes: ['auto', 'night', 'turbo'],
        preset_mode: 'auto',
      },
    ],
    [
      'fan.gone',
      'unavailable',
      { friendly_name: 'Attic fan', supported_features: FAN_ALL, preset_modes: ['eco', 'sleep'] },
    ],
    [
      'fan.patio',
      'unknown',
      {
        friendly_name: 'Patio fan',
        supported_features: 1 + 2 + FAN_POWER,
        percentage: null,
        percentage_step: 1,
        oscillating: null,
      },
    ],

    // #142: a Matter fan and a Roborock, whose presets and suction Home Assistant words in the page's language
    [
      'fan.matter',
      'on',
      {
        friendly_name: 'Bedroom fan',
        supported_features: 1 + 2 + 8 + FAN_POWER,
        percentage: 40,
        percentage_step: 10,
        oscillating: false,
        preset_modes: ['auto', 'low', 'medium', 'high', 'natural_wind', 'sleep_wind'],
        preset_mode: 'natural_wind',
      },
    ],
    [
      'vacuum.roborock',
      'docked',
      {
        friendly_name: 'Roborock',
        supported_features: VACUUM_ALL,
        battery_level: 92,
        fan_speed: 'balanced',
        fan_speed_list: ['quiet', 'balanced', 'turbo', 'max', 'max_plus'],
      },
    ],
    [
      'vacuum.robot',
      'cleaning',
      {
        friendly_name: 'Vacuum',
        supported_features: VACUUM_ALL - 64,
        fan_speed: 'standard',
        fan_speed_list: SUCTION,
      },
    ],
    [
      'sensor.robot_battery',
      '78',
      { friendly_name: 'Vacuum battery', device_class: 'battery', unit_of_measurement: '%' },
    ],
    ['sensor.robot_area', '24', { friendly_name: 'Cleaned area', unit_of_measurement: 'm²' }],
    ['sensor.robot_elapsed', '18', { friendly_name: 'Cleaning time', unit_of_measurement: 'min' }],
    ['sensor.robot_remaining', '42', { friendly_name: 'Time left', unit_of_measurement: 'min' }],
    [
      'vacuum.dock',
      'docked',
      {
        friendly_name: 'Robot',
        supported_features: VACUUM_ALL,
        battery_level: 100,
        fan_speed: 'quiet',
        fan_speed_list: SUCTION,
      },
    ],
    [
      'vacuum.basic',
      'idle',
      { friendly_name: 'Sweeper', supported_features: VACUUM_PLAIN, battery_level: 16 },
    ],
    [
      'vacuum.stuck',
      'error',
      {
        friendly_name: 'Downstairs',
        supported_features: VACUUM_ALL,
        battery_level: 54,
        fan_speed: 'turbo',
        fan_speed_list: SUCTION,
      },
    ],
    [
      'vacuum.gone',
      'unavailable',
      { friendly_name: 'Upstairs', supported_features: VACUUM_ALL - 64, fan_speed_list: SUCTION },
    ],
    [
      'sensor.gone_battery',
      'unavailable',
      { friendly_name: 'Upstairs battery', device_class: 'battery', unit_of_measurement: '%' },
    ],
    [
      'sensor.gone_area',
      'unavailable',
      { friendly_name: 'Upstairs area', unit_of_measurement: 'm²' },
    ],
    ['vacuum.bare', 'unavailable', { friendly_name: 'Spare', restored: true }],
    ['vacuum.unknown', 'unknown', { friendly_name: 'Robot 2', supported_features: VACUUM_ALL }],
    ['lawn_mower.garden', 'mowing', { friendly_name: 'Mower', supported_features: 1 + 2 + 4 }],
    [
      'sensor.mower_battery',
      '62',
      { friendly_name: 'Mower battery', device_class: 'battery', unit_of_measurement: '%' },
    ],
  ],
  frames: [
    {
      title: 'Blinds',
      cards: [
        {
          type: 'custom:fluvy-cover-card',
          entity: 'cover.blinds',
          subtitle: 'Living room · window',
          tilt_angle: 90,
          favorites: [
            { label: 'Morning', position: 60 },
            { label: 'Night', position: 0, tilt: 0 },
          ],
        },
      ],
    },
    {
      title: 'Cover · no position, closed',
      cards: [{ type: 'custom:fluvy-cover-card', entity: 'cover.garage' }],
    },
    {
      title: 'Cover · closing',
      cards: [
        {
          type: 'custom:fluvy-cover-card',
          entity: 'cover.curtain',
          favorites: [{ position: 100 }, { position: 50 }, { position: 0 }],
        },
      ],
    },
    {
      title: 'Cover · fully open, tilt in %',
      cards: [{ type: 'custom:fluvy-cover-card', entity: 'cover.shade' }],
    },
    {
      title: 'Cover · tilt only',
      cards: [{ type: 'custom:fluvy-cover-card', entity: 'cover.slats' }],
    },
    {
      title: 'Cover · unavailable',
      cards: [
        {
          type: 'custom:fluvy-cover-card',
          entity: 'cover.gone',
          favorites: [{ label: 'Shade', position: 40 }],
        },
      ],
    },
    { title: 'Valve', cards: [{ type: 'custom:fluvy-cover-card', entity: 'valve.irrigation' }] },
    // the compact cover: the head and the actions, a quarter of a section
    {
      title: 'Cover · compact',
      width: 392,
      cards: [
        { type: 'custom:fluvy-cover-card', entity: 'cover.blinds', variant: 'compact', cols: 6 },
        { type: 'custom:fluvy-cover-card', entity: 'cover.garage', variant: 'compact', cols: 6 },
      ],
    },

    {
      title: 'Ceiling fan',
      cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.ceiling', subtitle: 'Bedroom' }],
    },
    {
      title: 'Fan · off, presets',
      cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.bedroom' }],
    },
    {
      title: 'Fan · off, essentials',
      measure: false,
      cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.bedroom', when_off: 'essentials' }],
    },
    {
      title: 'Fan · three speeds, no presets',
      cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.tower' }],
    },
    {
      title: 'Fan · preset runs the speed',
      cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.purifier' }],
    },
    { title: 'Fan · unavailable', cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.gone' }] },
    // the compact fan: the head says the speed, the ruler alone
    {
      title: 'Fan · compact',
      width: 392,
      cards: [
        { type: 'custom:fluvy-fan-card', entity: 'fan.ceiling', variant: 'compact', cols: 6 },
        { type: 'custom:fluvy-fan-card', entity: 'fan.gone', variant: 'compact', cols: 6 },
      ],
    },

    {
      title: 'Vacuum',
      cards: [
        {
          type: 'custom:fluvy-vacuum-card',
          entity: 'vacuum.robot',
          subtitle: 'Kitchen · started 21:29',
          battery_entity: 'sensor.robot_battery',
          area_entity: 'sensor.robot_area',
          duration_entity: 'sensor.robot_elapsed',
          remaining_entity: 'sensor.robot_remaining',
        },
      ],
    },
    {
      title: 'Vacuum · docked',
      cards: [{ type: 'custom:fluvy-vacuum-card', entity: 'vacuum.dock' }],
    },
    {
      title: 'Vacuum · no suction, one readout, low battery',
      cards: [
        {
          type: 'custom:fluvy-vacuum-card',
          entity: 'vacuum.basic',
          remaining_entity: 'sensor.robot_remaining',
        },
      ],
    },
    {
      title: 'Vacuum · error',
      cards: [{ type: 'custom:fluvy-vacuum-card', entity: 'vacuum.stuck' }],
    },
    {
      title: 'Vacuum · unavailable',
      cards: [
        {
          type: 'custom:fluvy-vacuum-card',
          entity: 'vacuum.gone',
          battery_entity: 'sensor.gone_battery',
          area_entity: 'sensor.gone_area',
        },
      ],
    },
    // the compact robot: the head and the commands
    {
      title: 'Vacuum · compact',
      width: 392,
      cards: [
        { type: 'custom:fluvy-vacuum-card', entity: 'vacuum.robot', variant: 'compact', cols: 6 },
        { type: 'custom:fluvy-vacuum-card', entity: 'vacuum.dock', variant: 'compact', cols: 6 },
      ],
    },
    {
      title: 'Lawn mower',
      cards: [
        {
          type: 'custom:fluvy-vacuum-card',
          entity: 'lawn_mower.garden',
          battery_entity: 'sensor.mower_battery',
        },
      ],
    },
    {
      title: 'Unknown, bare & missing',
      cards: [
        { type: 'custom:fluvy-fan-card', entity: 'fan.patio' },
        {
          type: 'custom:fluvy-vacuum-card',
          entity: 'vacuum.unknown',
          area_entity: 'sensor.nothing_here',
        },
        { type: 'custom:fluvy-vacuum-card', entity: 'vacuum.bare' },
        { type: 'custom:fluvy-cover-card', entity: 'cover.nothing_here' },
      ],
    },
    // the compact fan at its own size in the design's section: half of 360
    {
      title: 'Fan · compact · half a section',
      cards: [
        { type: 'custom:fluvy-fan-card', entity: 'fan.ceiling', variant: 'compact', cols: 6 },
        { type: 'custom:fluvy-fan-card', entity: 'fan.bedroom', variant: 'compact', cols: 6 },
      ],
    },
    // #142: a preset and a suction in Home Assistant's own words, in every language: its integration's translation
    {
      title: 'Fan · presets in Home Assistant’s words',
      hass: speakingAttributes(MATTER_FAN),
      cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.matter' }],
    },
    {
      title: 'Fan · presets as chips, in Home Assistant’s words',
      hass: speakingAttributes(MATTER_FAN),
      cards: [{ type: 'custom:fluvy-fan-card', entity: 'fan.matter', preset_style: 'chips' }],
    },
    {
      title: 'Vacuum · suction in Home Assistant’s words',
      hass: speakingAttributes(ROBOROCK),
      cards: [{ type: 'custom:fluvy-vacuum-card', entity: 'vacuum.roborock' }],
    },
  ],
};
