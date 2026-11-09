import { FluvySliderCard } from '../../../../packages/cards/src/slider/slider-card.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the Slider card from its module, as its own sheet does
if (!customElements.get('fluvy-slider-card'))
  customElements.define('fluvy-slider-card', FluvySliderCard);

/*
 * The slider styles (1.18, #144), the design page's frames on real cards: today's ruler beside the bar and the liquid
 * on the same value, on every surface that draws one — the light card (compact and full, its brightness and its
 * colour temperature), the Slider card, the large tile and the tiles group (the fill among them), the media card's
 * volume row, the room's brightness, the cover's vertical ruler — and the words under a bar or a liquid, none at a
 * card's word. Each frame at the widths the gates read: a tile's 152 and 172, a column's 211 and 266, a phone's 360 and
 * 412 and a desktop's. Light and dark are the page's (`&mode=dark`); the house's style comes from the page too
 * (`&sliders={"style":"bar"}`), the frames here each naming their own.
 */

const LIGHT = 'custom:fluvy-light-card';
const TILE = 'custom:fluvy-tile-card';
const TILES = 'custom:fluvy-tiles-card';
const SLIDER = 'custom:fluvy-slider-card';
const MEDIA = 'custom:fluvy-media-card';
const LIGHTS = 'custom:fluvy-lights-card';
const COVER = 'custom:fluvy-cover-card';

/** The styles a card draws in its slot; the fill is a tile's and stands in the tiles' frames. */
const STYLES = ['ruler', 'bar', 'liquid'] as const;
type Style = (typeof STYLES)[number] | 'fill';
const WORD: Record<Style, string> = { ruler: 'Ruler', bar: 'Bar', liquid: 'Liquid', fill: 'Fill' };

/** A dimmable white bulb at 65 %, as Home Assistant reports it. */
const DIMMER = { brightness: 166, supported_color_modes: ['brightness'], color_mode: 'brightness' };
/** A bulb of whites, warm at 3,200 K: the full light card draws its colour temperature too. */
const WARM = {
  brightness: 166,
  supported_color_modes: ['color_temp'],
  color_mode: 'color_temp',
  color_temp_kelvin: 3200,
  min_color_temp_kelvin: 2700,
  max_color_temp_kelvin: 6500,
  hs_color: [27.5, 51.7],
  rgb_color: [255, 184, 123],
};
/** A speaker: its transport (pause, previous, next, play) and its volume (set and muted). */
const PLAYER = 1 | 4 | 8 | 16 | 32 | 16384;
/** A cover set to a position. */
const COVER_FEATURES = 1 | 2 | 4 | 8;

const area = (entity: string, id: string) => [entity, { entity_id: entity, area_id: id }] as const;

const light = (style: Style, more: Record<string, unknown> = {}) => ({
  type: LIGHT,
  entity: 'light.ss_kitchen',
  variant: 'compact',
  slider_style: style,
  ...more,
});
const tile = (style: Style, entity = 'light.ss_kitchen', more: Record<string, unknown> = {}) => ({
  type: TILE,
  entity,
  slider_style: style,
  cols: 6,
  ...more,
});

/** One frame per style at a width: the compact light card and the Slider card, each a full card. */
const columnFrames = (width: number) =>
  STYLES.map((style) => ({
    title: `${width} · ${WORD[style]}`,
    width,
    cards: [
      light(style),
      { type: SLIDER, entity: 'media_player.ss_soundbar', variant: 'compact', slider_style: style },
    ],
  }));

/** One frame per style at a tile's width: the large tile beside its fill, each half a section. */
const tileFrames = (width: number) =>
  STYLES.map((style) => ({
    title: `${width} · tiles · ${WORD[style]}`,
    width: width * 2 + 16,
    cards: [tile(style), tile('fill', 'light.ss_desk')],
  }));

export const sheet: SheetSpec = {
  states: [
    ['light.ss_kitchen', 'on', { friendly_name: 'Kitchen', ...DIMMER }],
    ['light.ss_desk', 'on', { friendly_name: 'Desk', ...DIMMER }],
    ['light.ss_hall', 'on', { friendly_name: 'Hall', ...WARM }],
    ['light.ss_off', 'off', { friendly_name: 'Bedroom', supported_color_modes: ['brightness'] }],
    [
      'light.ss_gone',
      'unavailable',
      { friendly_name: 'Garage', supported_color_modes: ['brightness'] },
    ],
    ['light.ss_lamp', 'on', { friendly_name: 'Lamp', ...DIMMER, brightness: 90 }],
    [
      'media_player.ss_soundbar',
      'on',
      {
        friendly_name: 'Soundbar',
        supported_features: PLAYER,
        volume_level: 0.65,
        is_volume_muted: false,
        source: 'Bluetooth',
      },
    ],
    [
      'cover.ss_blinds',
      'open',
      { friendly_name: 'Blinds', supported_features: COVER_FEATURES, current_position: 65 },
    ],
  ],
  registry: {
    areas: { ss_living: { area_id: 'ss_living', name: 'Living room' } },
    entities: Object.fromEntries([
      area('light.ss_kitchen', 'ss_living'),
      area('light.ss_desk', 'ss_living'),
      area('light.ss_lamp', 'ss_living'),
    ]),
  },
  frames: [
    // the Slider card, compact, at 65 %: today's ruler, then the two that share its slot
    ...STYLES.map((style) => ({
      title: `Slider card · ${WORD[style]}`,
      cards: [
        {
          type: SLIDER,
          entity: 'media_player.ss_soundbar',
          variant: 'compact',
          slider_style: style,
        },
      ],
    })),
    // the light card in full: the brightness and the colour temperature in each style
    ...STYLES.map((style) => ({
      title: `Light card · full · ${WORD[style]}`,
      cards: [{ type: LIGHT, entity: 'light.ss_hall', slider_style: style }],
    })),
    // the large tile's foot in each style, and the fill: the whole tile is the slider
    {
      title: 'Tiles · Ruler and Bar',
      cards: [tile('ruler'), tile('bar', 'light.ss_desk')],
    },
    // the fill tile's tap toggles (its hold the details), as Home Assistant's own tiles tap
    {
      title: 'Tiles · Liquid and Fill',
      cards: [tile('liquid'), tile('fill', 'light.ss_desk', { tap_action: { action: 'toggle' } })],
    },
    // a group of tiles asked for the fill, a tile out of reach and one off among them
    {
      title: 'Tiles group · Fill',
      cards: [
        {
          type: TILES,
          size: 'large',
          slider_style: 'fill',
          tiles: ['light.ss_kitchen', 'light.ss_lamp', 'light.ss_off', 'light.ss_gone'],
        },
      ],
    },
    // the media card's volume row in each style
    ...STYLES.map((style) => ({
      title: `Volume row · ${WORD[style]}`,
      cards: [
        {
          type: MEDIA,
          entity: 'media_player.ss_soundbar',
          show_source: false,
          slider_style: style,
        },
      ],
    })),
    // the room's brightness over its tiles in a style (its tiles are compact rows: no slider of theirs)
    ...STYLES.map((style) => ({
      title: `Room lights · ${WORD[style]}`,
      cards: [
        {
          type: LIGHTS,
          name: 'Living room',
          variant: 'tiles',
          show_brightness: true,
          lights: ['light.ss_kitchen', 'light.ss_desk'],
          slider_style: style,
        },
      ],
    })),
    // the cover's vertical ruler: a bar lit from the foot, a liquid filling
    ...STYLES.map((style) => ({
      title: `Cover · vertical · ${WORD[style]}`,
      cards: [
        { type: COVER, entity: 'cover.ss_blinds', show_favorites: false, slider_style: style },
      ],
    })),
    // the words under a bar: the ends and the middle, or none (the row stays)
    {
      title: 'Words · none',
      cards: [light('bar', { slider_words: 'none' }), light('liquid', { slider_words: 'none' })],
    },
    // off and out of reach keep their size and anatomy in every style
    ...STYLES.map((style) => ({
      title: `Off and unavailable · ${WORD[style]}`,
      cards: [
        light(style, { entity: 'light.ss_off' }),
        light(style, { entity: 'light.ss_gone' }),
        tile(style, 'light.ss_off'),
        tile(style, 'light.ss_gone'),
      ],
    })),
    {
      title: 'Off and unavailable · Fill',
      cards: [tile('fill', 'light.ss_off'), tile('fill', 'light.ss_gone')],
    },
    // a card asked for the fill draws the ruler: the fill is a tile's
    {
      title: 'A card asked for Fill',
      cards: [
        light('fill'),
        {
          type: SLIDER,
          entity: 'media_player.ss_soundbar',
          variant: 'compact',
          slider_style: 'fill',
        },
      ],
    },
    // the widths the gates read: half a section, a narrow column, a phone's, a desktop's
    ...tileFrames(152),
    ...tileFrames(172),
    ...columnFrames(211),
    ...columnFrames(266),
    ...columnFrames(360),
    ...columnFrames(412),
    ...columnFrames(1400),
  ],
};
