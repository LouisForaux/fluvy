import { CLIMATE, speakingAttributes } from '../attribute-words.js';
import type { SheetSpec } from '../scenes.js';

const THERMO = {
  min_temp: 15,
  max_temp: 30,
  target_temp_step: 0.5,
  hvac_modes: ['heat', 'cool', 'heat_cool'],
};
const HOMEMATIC = {
  min_temp: 5,
  max_temp: 30.5,
  target_temp_step: 0.5,
  hvac_modes: ['auto', 'heat', 'off'],
};
/**
 * A wall air conditioner's product picture (#99), as an integration's image entity or a person's own address would
 * give one: a data URI, so the playground never reaches out to the network.
 */
const AIR_CONDITIONER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e3e6e4"/></linearGradient></defs><ellipse cx="32" cy="47" rx="24" ry="2.5" fill="#000" opacity="0.14"/><rect x="5" y="20" width="54" height="23" rx="7" fill="url(#b)" stroke="#c8cdca"/><rect x="11" y="36" width="42" height="3" rx="1.5" fill="#b9bfbc"/><rect x="44" y="25" width="9" height="4" rx="2" fill="#5fa8cf"/><circle cx="14" cy="27" r="1.5" fill="#9aa19d"/></svg>`,
  );

/** A compact thermostat in half a section, as #46's reporter has them. */
const half = (entity: string, more: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-thermostat-card',
  entity,
  variant: 'compact',
  cols: 6,
  ...more,
});

export const sheet: SheetSpec = {
  states: [
    [
      'climate.living',
      'heat',
      {
        friendly_name: 'Thermostat',
        ...THERMO,
        temperature: 21.5,
        current_temperature: 20.8,
        current_humidity: 46,
        hvac_action: 'heating',
        preset_modes: ['eco', 'comfort', 'away', 'boost'],
        preset_mode: 'comfort',
        fan_modes: ['auto', 'low', 'mid', 'high'],
        fan_mode: 'auto',
      },
    ],
    [
      'climate.cooling',
      'cool',
      {
        friendly_name: 'Thermostat',
        ...THERMO,
        temperature: 24,
        current_temperature: 26.1,
        hvac_action: 'cooling',
      },
    ],
    [
      'climate.range',
      'heat_cool',
      {
        friendly_name: 'Thermostat',
        ...THERMO,
        temperature: null,
        target_temp_low: 20,
        target_temp_high: 24,
        current_temperature: 21.8,
        hvac_action: 'idle',
      },
    ],
    [
      'climate.off',
      'off',
      {
        friendly_name: 'Thermostat',
        ...THERMO,
        hvac_modes: ['off', 'heat', 'cool'],
        temperature: null,
        current_temperature: 20.8,
        hvac_action: 'off',
      },
    ],
    // the device of #31: off, with presets and seven fan speeds that would otherwise fill the card
    [
      'climate.standby',
      'off',
      {
        friendly_name: 'Thermostat',
        ...THERMO,
        hvac_modes: ['off', 'heat', 'cool'],
        temperature: 22,
        current_temperature: 19.6,
        hvac_action: 'off',
        preset_modes: ['none', 'away', 'eco', 'boost'],
        preset_mode: 'none',
        fan_modes: ['auto', 'silence', '1', '2', '3', '4', '5'],
        fan_mode: 'auto',
      },
    ],
    [
      'water_heater.tank',
      'eco',
      {
        friendly_name: 'Water heater',
        min_temp: 40,
        max_temp: 65,
        temperature: 50,
        current_temperature: 48,
        operation_list: ['off', 'eco', 'performance'],
      },
    ],
    [
      'humidifier.bedroom',
      'on',
      {
        friendly_name: 'Humidifier',
        min_humidity: 30,
        max_humidity: 70,
        humidity: 50,
        current_humidity: 46,
        available_modes: ['auto', 'sleep'],
        mode: 'auto',
      },
    ],
    ['climate.nulls', 'unavailable', { friendly_name: 'Bedroom AC' }],
    // #99: an air conditioner pictured, its product picture an image entity's
    [
      'climate.living_ac',
      'cool',
      {
        friendly_name: 'Living room AC',
        ...THERMO,
        hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only'],
        temperature: 23,
        current_temperature: 25.4,
        hvac_action: 'cooling',
        fan_modes: ['auto', 'low', 'high'],
        fan_mode: 'auto',
      },
    ],
    ['image.living_ac', '2026-11-04T08:00:00+00:00', { entity_picture: AIR_CONDITIONER }],
    // #142: an air conditioner sending Home Assistant's standard fan speeds and presets, and a quiet speed of its own
    [
      'climate.bedroom_ac',
      'cool',
      {
        friendly_name: 'Bedroom AC',
        ...THERMO,
        hvac_modes: ['off', 'cool', 'heat', 'dry', 'fan_only'],
        temperature: 24,
        current_temperature: 26.2,
        hvac_action: 'cooling',
        fan_modes: ['auto', 'quiet', 'low', 'medium', 'high'],
        fan_mode: 'medium',
        preset_modes: ['none', 'eco', 'comfort', 'boost', 'sleep'],
        preset_mode: 'none',
      },
    ],
    // the thermostats of #46: HomeMatic radiator valves, whose modes come as Auto, Heat, Off, from 5 to 30.5 by 0.5
    [
      'climate.garderobe',
      'heat',
      {
        friendly_name: 'Garderobe',
        ...HOMEMATIC,
        temperature: 19.5,
        current_temperature: 20.6,
        current_humidity: 74,
        hvac_action: 'heating',
      },
    ],
    [
      'climate.atelier',
      'heat',
      {
        friendly_name: 'Atelier',
        ...HOMEMATIC,
        temperature: 9.5,
        current_temperature: 12.1,
        hvac_action: 'idle',
      },
    ],
  ],
  frames: [
    { title: 'Heat', cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.living' }] },
    { title: 'Cool', cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.cooling' }] },
    { title: 'Range', cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.range' }] },
    { title: 'Off', cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.off' }] },
    {
      title: 'Water heater',
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'water_heater.tank' }],
    },
    {
      title: 'Humidifier',
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'humidifier.bedroom' }],
    },
    {
      title: 'Unavailable',
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.nulls' }],
    },
    {
      title: 'Compact · off, heat, cool · fan full width',
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.living',
          variant: 'compact',
          modes: ['off', 'heat', 'cool'],
          fan_style: 'full',
          preset_style: 'full',
        },
      ],
    },
    {
      title: 'Ruler · modes as chips',
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.cooling',
          variant: 'ruler',
          modes_style: 'chips',
        },
      ],
    },
    {
      title: 'Ruler · range',
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.range',
          variant: 'ruler',
          modes_style: 'full',
        },
      ],
    },
    {
      title: 'Compact · off',
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.off', variant: 'compact' }],
    },
    // off: everything (the default) against the essentials; on, `when_off` changes nothing
    {
      title: 'Off · presets and fan',
      measure: false,
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.standby' }],
    },
    {
      title: 'Off · essentials',
      measure: false,
      cards: [
        { type: 'custom:fluvy-thermostat-card', entity: 'climate.standby', when_off: 'essentials' },
      ],
    },
    {
      title: 'Heat · essentials',
      cards: [
        { type: 'custom:fluvy-thermostat-card', entity: 'climate.living', when_off: 'essentials' },
      ],
    },
    // the compact layout at its own size: half a section (#46 was never drawn at it)
    {
      title: 'Compact · half a section',
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.living',
          variant: 'compact',
          cols: 6,
        },
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.cooling',
          variant: 'compact',
          cols: 6,
        },
      ],
    },
    // #46 as its reporter has it: two to a 402 section at Home Assistant's 8 px gaps (157 of content), each named as
    // its room (the line under the name leaves the room out), the modes in the order each config lists them
    {
      title: 'Compact · half a section (#46)',
      width: 402,
      gap: 8,
      cards: [
        half('climate.garderobe', { modes: ['off', 'auto'], modes_style: 'full' }),
        half('climate.atelier', { modes: ['auto', 'off'], modes_style: 'full' }),
      ],
    },
    // the narrowest half a section: a 320 one at Fluvy's 16 (112 of content), a target and a range
    {
      title: 'Compact · half a section at the floor',
      width: 320,
      cards: [half('climate.garderobe'), half('climate.range')],
    },
    {
      title: 'Compact · without − and +',
      cards: [
        half('climate.garderobe', { show_stepper: false }),
        half('climate.off', { show_stepper: false, show_modes: false }),
      ],
    },
    {
      title: 'Ruler · half a section',
      cards: [
        half('climate.garderobe', { variant: 'ruler' }),
        half('climate.range', { variant: 'ruler' }),
      ],
    },
    {
      title: 'Dial · without − and +',
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.living',
          show_stepper: false,
          show_current: false,
        },
      ],
    },
    // #99: the person's own picture in the circle's place — an image entity's, an address — and out of reach, greyed
    {
      title: 'Own picture (#99)',
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.living_ac',
          image: 'image.living_ac',
          variant: 'compact',
        },
      ],
    },
    // a short name keeps the picture beside it in half a section; a long one takes its room, as the circle gives it
    {
      title: 'Own picture · half a section',
      cards: [
        half('climate.living_ac', { image: AIR_CONDITIONER, name: 'Lounge' }),
        half('climate.nulls', { image: 'image.living_ac', name: 'Bedroom' }),
      ],
    },
    {
      title: 'Own picture · dial, long name',
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.living_ac',
          image: 'image.living_ac',
          cols: 6,
        },
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.living_ac',
          image: 'image.living_ac',
          name: 'AC',
          cols: 6,
        },
      ],
    },
    // #142: the fan speeds and presets in Home Assistant's own words, in every language
    {
      title: 'Fan speeds and presets in Home Assistant’s words',
      hass: speakingAttributes(CLIMATE),
      cards: [{ type: 'custom:fluvy-thermostat-card', entity: 'climate.bedroom_ac' }],
    },
    {
      title: 'Fan speeds and presets as chips, in Home Assistant’s words',
      hass: speakingAttributes(CLIMATE),
      cards: [
        {
          type: 'custom:fluvy-thermostat-card',
          entity: 'climate.bedroom_ac',
          variant: 'compact',
          fan_style: 'chips',
          preset_style: 'chips',
        },
      ],
    },
    {
      title: 'Fan speeds · compact, half a section, in Home Assistant’s words',
      hass: speakingAttributes(CLIMATE),
      cards: [
        half('climate.bedroom_ac', { modes: ['off', 'cool'], show_presets: false }),
        half('climate.bedroom_ac', {
          modes: ['off', 'cool'],
          show_presets: false,
          fan_style: 'chips',
        }),
      ],
    },
  ],
  registry: {
    areas: { garderobe: { area_id: 'garderobe', name: 'Garderobe' } },
    entities: {
      'climate.garderobe': { entity_id: 'climate.garderobe', area_id: 'garderobe' },
      'climate.atelier': { entity_id: 'climate.atelier', area_id: 'garderobe' },
    },
  },
};
