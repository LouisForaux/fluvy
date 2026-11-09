import { FluvyLightsCard } from '../../../../packages/cards/src/lights/lights-card.js';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-lights-card'))
  customElements.define('fluvy-lights-card', FluvyLightsCard);

type Attributes = Record<string, unknown>;

/**
 * Home Assistant's colour for a white at `kelvin` (its `color_temperature_to_rgb`): what it reports as a light's
 * `rgb_color` while the light is in `color_temp`.
 */
const whiteRgb = (kelvin: number): number[] => {
  const t = kelvin / 100;
  const channel = (value: number): number => Math.round(Math.min(255, Math.max(0, value)));
  return [
    t <= 66 ? 255 : channel(329.698727446 * (t - 60) ** -0.1332047592),
    channel(
      t <= 66
        ? 99.4708025861 * Math.log(t) - 161.1195681661
        : 288.1221695283 * (t - 60) ** -0.0755148492,
    ),
    t >= 66 ? 255 : t <= 19 ? 0 : channel(138.5177312231 * Math.log(t - 10) - 305.0447927307),
  ];
};
/** A white lamp that dims (its level in %), at `kelvin` (2700 K unless said). */
const white = (name: string, level?: number, kelvin = 2700): Attributes => ({
  friendly_name: name,
  supported_color_modes: ['color_temp'],
  color_mode: 'color_temp',
  // lit, its colour as Home Assistant reports it beside its temperature
  ...(level !== undefined
    ? { brightness: Math.round((level / 100) * 255), rgb_color: whiteRgb(kelvin) }
    : {}),
  color_temp_kelvin: kelvin,
});
/** A coloured bulb, on in `rgb`. */
const colour = (name: string, rgb: readonly number[], level: number): Attributes => ({
  friendly_name: name,
  supported_color_modes: ['hs', 'color_temp'],
  color_mode: 'hs',
  brightness: Math.round((level / 100) * 255),
  rgb_color: rgb,
});
/** A lamp that only dims, lit at `level` %: no colour of its own. */
const dimmer = (name: string, level: number): Attributes => ({
  friendly_name: name,
  supported_color_modes: ['brightness'],
  color_mode: 'brightness',
  brightness: Math.round((level / 100) * 255),
});
/** A lamp that only switches. */
const plain = (name: string): Attributes => ({
  friendly_name: name,
  supported_color_modes: ['onoff'],
});

const lights = (config: Record<string, unknown>) => ({
  type: 'custom:fluvy-lights-card',
  ...config,
});

const LIVING = ['light.lt_ceiling', 'light.lt_floor', 'light.lt_reading'];
/** A warm white, a cool one, a group of two colours and a lamp that only dims: each in its own colour, or none (#58). */
const WHITES = ['light.lt_ceiling', 'light.lt_cool', 'light.lt_group', 'light.lt_dimmer'];
const LADDER = [2200, 2700, 3000, 4000, 5000, 6500, 8000].map((kelvin) => `light.lt_k${kelvin}`);
const SIX = [
  'light.lt_ceiling',
  'light.lt_floor',
  'light.lt_reading',
  'light.lt_shelf',
  'light.lt_strip',
  'light.lt_sconce',
];

export const sheet: SheetSpec = {
  states: [
    ['light.lt_ceiling', 'on', white('Ceiling', 70)],
    ['light.lt_floor', 'on', colour('Floor lamp', [255, 140, 70], 55)],
    ['light.lt_reading', 'off', white('Reading lamp')],
    ['light.lt_shelf', 'on', plain('Shelf')],
    ['light.lt_strip', 'on', colour('TV strip', [110, 120, 255], 40)],
    ['light.lt_sconce', 'off', white('Sconce')],
    ['light.lt_island', 'on', white('Island', 90)],
    ['light.lt_pendants', 'off', white('Pendants')],
    ['light.lt_off_one', 'off', white('Ceiling')],
    ['light.lt_off_two', 'off', white('Floor lamp')],
    ['light.lt_gone', 'unavailable', { friendly_name: 'Garden string' }],
    ['light.lt_porch', 'on', white('Porch', 35)],
    ['light.lt_full', 'on', white('Desk lamp', 100)],
    ['light.lt_plug_a', 'on', plain('Fairy lights')],
    ['light.lt_plug_b', 'off', plain('Salt lamp')],
    ['light.lt_long', 'on', white('The big paper lantern over the dining table in the corner', 60)],
    // a cool white: Home Assistant's colour for 8000 K, a blue a shade off white (6500 K is daylight, neutral)
    ['light.lt_cool', 'on', white('Bathroom', 80, 8000)],
    // the whites from a candle to a cool one, each as Home Assistant reports it
    ...[2200, 2700, 3000, 4000, 5000, 6500, 8000].map((kelvin): StateSeed => [
      `light.lt_k${kelvin}`,
      'on',
      white(`${kelvin} K`, 80, kelvin),
    ]),
    ['light.lt_dimmer', 'on', dimmer('Hallway', 45)],
    // a colour bulb that is off: the colour round opens a sheet whose ruler sleeps (#137)
    [
      'light.lt_colour_off',
      'off',
      { friendly_name: 'Reading lamp', supported_color_modes: ['hs', 'color_temp'] },
    ],
    [
      'light.lt_group',
      'on',
      {
        // Home Assistant's own for a group: its members' plain mean, which Fluvy weighs by their brightness
        ...colour('Lamps', [183, 130, 163], 48),
        entity_id: ['light.lt_floor', 'light.lt_strip'],
      },
    ],
  ],
  registry: {
    entities: {
      'light.lt_island': { entity_id: 'light.lt_island', area_id: 'lt_kitchen' },
      'light.lt_pendants': { entity_id: 'light.lt_pendants', area_id: 'lt_kitchen' },
    },
    areas: {
      lt_kitchen: { area_id: 'lt_kitchen', name: 'Kitchen' },
      lt_attic: { area_id: 'lt_attic', name: 'Attic' },
    },
  },
  frames: [
    {
      title: 'Living room',
      cards: [lights({ name: 'Living room', lights: LIVING })],
    },
    {
      title: 'From the area',
      cards: [lights({ area: 'lt_kitchen' })],
    },
    {
      title: 'All off',
      cards: [
        lights({
          name: 'Bedroom',
          lights: ['light.lt_off_one', 'light.lt_off_two'],
        }),
      ],
    },
    {
      title: 'Four lights',
      cards: [
        lights({
          name: 'Living room',
          lights: ['light.lt_ceiling', 'light.lt_floor', 'light.lt_reading', 'light.lt_shelf'],
        }),
      ],
    },
    {
      title: 'Six lights',
      cards: [lights({ name: 'Living room', lights: SIX })],
    },
    {
      title: 'Their own colours and icons',
      cards: [
        lights({
          name: 'Living room',
          lights: [
            { entity: 'light.lt_ceiling', icon: 'fluvy:sun', color: 'amber' },
            { entity: 'light.lt_floor', icon: 'fluvy:moon' },
            { entity: 'light.lt_shelf', icon: 'fluvy:sparkle', color: 'teal' },
          ],
        }),
      ],
    },
    {
      title: 'Chips',
      cards: [
        lights({
          name: 'Living room',
          variant: 'chips',
          lights: ['light.lt_ceiling', 'light.lt_floor', 'light.lt_reading', 'light.lt_shelf'],
        }),
      ],
    },
    {
      title: 'Chips · one brightness',
      cards: [
        lights({
          name: 'Living room',
          variant: 'chips',
          show_brightness: true,
          lights: LIVING,
        }),
      ],
    },
    {
      title: 'Tiles',
      cards: [
        lights({
          name: 'Living room',
          variant: 'tiles',
          lights: ['light.lt_ceiling', 'light.lt_floor', 'light.lt_reading', 'light.lt_strip'],
        }),
      ],
    },
    {
      title: 'Tiles · one brightness',
      cards: [
        lights({
          name: 'Kitchen',
          variant: 'tiles',
          show_brightness: true,
          area: 'lt_kitchen',
        }),
      ],
    },
    {
      title: 'Whites by their warmth',
      cards: [
        lights({ name: 'Living room', lights: WHITES }),
        lights({ name: 'Living room', variant: 'chips', lights: WHITES }),
        lights({ name: 'Living room', variant: 'tiles', lights: WHITES }),
      ],
    },
    // a candle, warm, neutral, daylight and cool: each white a step of one scale (#58)
    {
      title: 'Whites from a candle to a cool one',
      cards: [
        lights({ name: 'Whites', variant: 'tiles', show_level: false, lights: LADDER }),
        lights({ name: 'Whites', variant: 'chips', lights: LADDER }),
      ],
    },
    {
      title: 'Whites as the theme’s light',
      cards: [
        lights({ name: 'Living room', light_whites: 'palette', lights: WHITES }),
        lights({ name: 'Living room', variant: 'tiles', light_whites: 'palette', lights: WHITES }),
      ],
    },
    {
      title: 'Tiles in the card’s tone, no level',
      cards: [
        lights({
          name: 'Living room',
          variant: 'tiles',
          tone: 'heat',
          light_colors: false,
          show_level: false,
          tint: 'always',
          lights: LIVING,
        }),
      ],
    },
    {
      title: 'A light unavailable',
      cards: [
        lights({ name: 'Garden', lights: ['light.lt_porch', 'light.lt_gone'] }),
        lights({
          name: 'Garden',
          variant: 'chips',
          lights: ['light.lt_porch', 'light.lt_gone'],
        }),
      ],
    },
    {
      title: 'Nothing can be read',
      cards: [lights({ name: 'Shed', lights: ['light.lt_gone'] })],
    },
    {
      title: 'Long names',
      cards: [
        lights({
          name: 'The living room with the long window on the garden side',
          lights: ['light.lt_long', 'light.lt_reading'],
        }),
        lights({
          name: 'Dining room',
          variant: 'chips',
          lights: ['light.lt_long', 'light.lt_reading', 'light.lt_floor'],
        }),
      ],
    },
    {
      title: 'Three tiles',
      cards: [lights({ name: 'Living room', variant: 'tiles', lights: LIVING })],
    },
    {
      title: 'Five chips',
      cards: [
        lights({
          name: 'Living room',
          variant: 'chips',
          lights: [
            'light.lt_ceiling',
            'light.lt_floor',
            'light.lt_reading',
            'light.lt_shelf',
            'light.lt_strip',
          ],
        }),
      ],
    },
    {
      title: 'No level shown',
      cards: [lights({ name: 'Living room', show_level: false, lights: LIVING })],
    },
    {
      title: 'Lights that only switch, one at full',
      cards: [
        lights({ name: 'Study', lights: ['light.lt_plug_a', 'light.lt_plug_b', 'light.lt_full'] }),
      ],
    },
    {
      title: 'One brightness on the row',
      cards: [lights({ name: 'Living room', show_brightness: true, lights: LIVING })],
    },
    {
      title: 'An area with no lights',
      cards: [lights({ area: 'lt_attic' })],
    },
    {
      title: 'A desktop column',
      width: 392,
      cards: [
        lights({ name: 'Living room', lights: LIVING }),
        lights({ name: 'Living room', variant: 'chips', lights: LIVING }),
      ],
    },
    {
      title: 'Half a column',
      cards: [
        lights({
          name: 'Bedroom',
          lights: ['light.lt_ceiling', 'light.lt_floor'],
          cols: 6,
        }),
        lights({ name: 'Hall', lights: ['light.lt_porch'], cols: 6 }),
        lights({ name: 'Kitchen', variant: 'chips', area: 'lt_kitchen', cols: 6 }),
        lights({ name: 'Living', variant: 'tiles', lights: LIVING.slice(0, 2), cols: 6 }),
      ],
    },
    // #137: the colour round before the lights' rounds or the switch, its own tap opening the room's colours; off
    // unless asked, so the frames above draw as they did
    {
      title: 'Colour round (#137)',
      cards: [
        lights({ name: 'Living room', show_color: true, lights: LIVING }),
        lights({ name: 'Living room', variant: 'chips', show_color: true, lights: LIVING }),
        lights({ name: 'Living room', variant: 'tiles', show_color: true, lights: LIVING }),
      ],
    },
    {
      title: 'Colour round · one brightness',
      cards: [
        lights({ name: 'Living room', show_color: true, show_brightness: true, lights: LIVING }),
      ],
    },
    // four lights and the round: the lights take their own line, the round stays the head's
    {
      title: 'Colour round · four lights',
      cards: [
        lights({
          name: 'Living room',
          show_color: true,
          lights: ['light.lt_ceiling', 'light.lt_floor', 'light.lt_reading', 'light.lt_shelf'],
        }),
      ],
    },
    // half a column: the round steps to a "Colour" row under the body, a control never goes
    {
      title: 'Colour round · half a column',
      cards: [
        lights({ name: 'Living room', show_color: true, lights: LIVING, cols: 6 }),
        lights({
          name: 'Living room',
          variant: 'chips',
          show_color: true,
          lights: LIVING,
          cols: 6,
        }),
        lights({
          name: 'Living room',
          variant: 'tiles',
          show_color: true,
          lights: LIVING,
          cols: 6,
        }),
        lights({ name: 'Hall', show_color: true, lights: ['light.lt_floor'], cols: 6 }),
      ],
    },
    // one light, or a group, may open Home Assistant's details instead; a room of whites draws no round at all
    {
      title: 'Colour round · one light, a group, whites only',
      cards: [
        lights({
          name: 'Hall',
          show_color: true,
          color_action: 'more-info',
          lights: ['light.lt_floor'],
        }),
        lights({ name: 'Lamps', show_color: true, lights: ['light.lt_group'] }),
        lights({ name: 'Bathroom', show_color: true, lights: WHITES.slice(0, 2) }),
      ],
    },
    {
      title: 'Colour sheet · the hue ruler',
      width: 392,
      cards: [lights({ name: 'Living room', show_color: true, lights: LIVING, _sheet: true })],
    },
    {
      title: 'Colour sheet · the hue wheel',
      width: 392,
      cards: [
        lights({
          name: 'Living room',
          show_color: true,
          color_control: 'wheel',
          lights: LIVING,
          _sheet: true,
        }),
      ],
    },
    {
      title: 'Colour sheet · the room off',
      width: 392,
      cards: [
        lights({
          name: 'Bedroom',
          show_color: true,
          lights: ['light.lt_colour_off', 'light.lt_off_one'],
          _sheet: true,
        }),
      ],
    },
    // #100: a light's long name in two lines where one would cut it, every tile a line taller
    {
      title: 'Tiles · names in two lines (#100)',
      cards: [
        lights({
          name: 'Living room',
          variant: 'tiles',
          name_lines: 2,
          lights: [
            'light.lt_long',
            'light.lt_reading',
            { entity: 'light.lt_floor', name: 'Floor lamp by the sofa' },
          ],
        }),
      ],
    },
  ],
};
