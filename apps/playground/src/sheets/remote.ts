import { FluvyRemoteCard } from '../../../../packages/cards/src/remote/remote-card.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the slider sheet does
if (!customElements.get('fluvy-remote-card'))
  customElements.define('fluvy-remote-card', FluvyRemoteCard);

const REMOTE = 'custom:fluvy-remote-card';

/* media_player supported_features */
const PAUSE = 1;
const VOLUME_SET = 4;
const VOLUME_MUTE = 8;
const PREVIOUS = 16;
const NEXT = 32;
const TURN_ON = 128;
const TURN_OFF = 256;
const VOLUME_STEP = 1024;
const SELECT_SOURCE = 2048;
const STOP = 4096;
const PLAY = 16384;
/** A television that reports its volume and takes a source. */
const TV =
  PAUSE |
  VOLUME_SET |
  VOLUME_MUTE |
  PREVIOUS |
  NEXT |
  TURN_ON |
  TURN_OFF |
  SELECT_SOURCE |
  STOP |
  PLAY;
/** A television that steps its volume but reports no level (an Android TV Remote's player). */
const TV_NO_LEVEL = PAUSE | VOLUME_STEP | VOLUME_MUTE | TURN_ON | TURN_OFF | SELECT_SOURCE | PLAY;
/** A receiver: its volume, its mute, its power, its inputs. */
const RECEIVER = VOLUME_SET | VOLUME_MUTE | TURN_ON | TURN_OFF | SELECT_SOURCE;

const SOURCES = [
  'HDMI 1',
  'HDMI 2',
  'Apple TV',
  'Live TV',
  'Netflix',
  'YouTube',
  'Spotify',
  'Disney+',
  'Prime Video',
];

const tv = (name: string, extra: Record<string, unknown> = {}) => ({
  friendly_name: name,
  device_class: 'tv',
  source_list: SOURCES,
  volume_level: 0.32,
  is_volume_muted: false,
  supported_features: TV,
  ...extra,
});

const entry = (entity: string, platform: string, area = 'rm_living') =>
  [entity, { entity_id: entity, area_id: area, platform }] as const;

/**
 * The TV remote card (#143) as its approved design page draws it: the living room's Android TV with its receiver,
 * full in every shape the page drew (the ring and the reference's grid, the keys beside the pad and in a row, OK with
 * its word and plain), compact, pad and row; the volume as the ruler routed to the receiver, as keys on a television
 * that reports no level, as the stepper, with the receiver off and out of reach; the apps as circles from the
 * player's sources, in their colours, as chips, as the person's own list; the groups reordered, the channel and the
 * custom keys; the television off (every key alive, then power alone) and out of reach; an Apple TV, a Roku and an LG
 * webOS television, each with its integration's keys.
 */
export const sheet: SheetSpec = {
  states: [
    [
      'media_player.rm_tv',
      'playing',
      tv('Living room TV', { app_name: 'Netflix', source: 'Netflix', media_title: 'Braciole' }),
    ],
    ['remote.rm_tv', 'on', { friendly_name: 'Living room TV' }],
    ['media_player.rm_tv_off', 'off', tv('Living room TV')],
    ['remote.rm_tv_off', 'off', { friendly_name: 'Living room TV' }],
    // out of reach as Home Assistant leaves a television: its features and its sources kept, its reading gone
    [
      'media_player.rm_tv_gone',
      'unavailable',
      {
        friendly_name: 'Living room TV',
        device_class: 'tv',
        source_list: SOURCES,
        supported_features: TV,
      },
    ],
    ['remote.rm_tv_gone', 'unavailable', { friendly_name: 'Living room TV' }],
    [
      'media_player.rm_receiver',
      'on',
      {
        friendly_name: 'Receiver',
        device_class: 'receiver',
        volume_level: 0.32,
        is_volume_muted: false,
        source: 'TV',
        source_list: ['TV', 'Bluetooth'],
        supported_features: RECEIVER,
      },
    ],
    [
      'media_player.rm_receiver_off',
      'off',
      {
        friendly_name: 'Receiver',
        device_class: 'receiver',
        volume_level: 0.32,
        supported_features: RECEIVER,
      },
    ],
    [
      'media_player.rm_receiver_gone',
      'unavailable',
      { friendly_name: 'Receiver', device_class: 'receiver', supported_features: RECEIVER },
    ],
    // an Android TV whose player steps the volume but reports no level
    [
      'media_player.rm_bedroom',
      'on',
      {
        friendly_name: 'Bedroom TV',
        device_class: 'tv',
        app_name: 'YouTube',
        source_list: ['HDMI 1', 'Netflix', 'YouTube', 'Twitch'],
        supported_features: TV_NO_LEVEL,
      },
    ],
    ['remote.rm_bedroom', 'on', { friendly_name: 'Bedroom TV' }],
    // an Apple TV: no sources, its keys pyatv's
    [
      'media_player.rm_appletv',
      'paused',
      {
        friendly_name: 'Apple TV',
        app_name: 'Apple TV+',
        media_title: 'Severance',
        supported_features: PAUSE | PLAY | NEXT | PREVIOUS | TURN_ON | TURN_OFF | VOLUME_STEP,
      },
    ],
    ['remote.rm_appletv', 'on', { friendly_name: 'Apple TV' }],
    // a Roku: its channels as sources, its keys rokuecp's
    [
      'media_player.rm_roku',
      'idle',
      {
        friendly_name: 'Roku',
        source: 'Home',
        source_list: ['Home', 'Netflix', 'YouTube', 'Plex', 'Twitch', 'Hulu'],
        supported_features:
          PAUSE | PLAY | SELECT_SOURCE | VOLUME_STEP | VOLUME_MUTE | TURN_ON | TURN_OFF,
      },
    ],
    ['remote.rm_roku', 'on', { friendly_name: 'Roku' }],
    // an LG webOS television: no remote entity, its buttons on the player itself
    [
      'media_player.rm_lg',
      'on',
      tv('LG webOS TV', {
        source: 'HDMI 1',
        source_list: ['Live TV', 'HDMI 1', 'HDMI 2', 'Netflix', 'YouTube', 'Disney+'],
        volume_level: 0.18,
      }),
    ],
  ],
  registry: {
    areas: {
      rm_living: { area_id: 'rm_living', name: 'Living room' },
      rm_bedroom: { area_id: 'rm_bedroom', name: 'Bedroom' },
    },
    entities: Object.fromEntries([
      entry('media_player.rm_tv', 'androidtv_remote'),
      entry('remote.rm_tv', 'androidtv_remote'),
      entry('media_player.rm_tv_off', 'androidtv_remote'),
      entry('remote.rm_tv_off', 'androidtv_remote'),
      entry('media_player.rm_tv_gone', 'androidtv_remote'),
      entry('remote.rm_tv_gone', 'androidtv_remote'),
      entry('media_player.rm_receiver', 'denonavr'),
      entry('media_player.rm_bedroom', 'androidtv_remote', 'rm_bedroom'),
      entry('remote.rm_bedroom', 'androidtv_remote', 'rm_bedroom'),
      entry('media_player.rm_appletv', 'apple_tv'),
      entry('remote.rm_appletv', 'apple_tv'),
      entry('media_player.rm_roku', 'roku'),
      entry('remote.rm_roku', 'roku'),
      entry('media_player.rm_lg', 'webostv'),
    ]),
  },
  frames: [
    {
      title: 'Full',
      heights: [211, 266],
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          volume_entity: 'media_player.rm_receiver',
        },
      ],
    },
    {
      title: 'Full · grid',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          volume_entity: 'media_player.rm_receiver',
          dpad: 'grid',
        },
      ],
    },
    {
      title: 'Full · keys in a row',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          volume_entity: 'media_player.rm_receiver',
          side_keys: 'row',
        },
      ],
    },
    {
      title: 'Full · plain OK',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          volume_entity: 'media_player.rm_receiver',
          ok_label: 'plain',
        },
      ],
    },
    {
      title: 'Compact',
      cards: [
        { type: REMOTE, entity: 'media_player.rm_tv', remote: 'remote.rm_tv', variant: 'compact' },
      ],
    },
    {
      title: 'Compact · two',
      heights: [152, 172],
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          variant: 'compact',
          cols: 6,
          grid_options: { columns: 6 },
        },
        {
          type: REMOTE,
          entity: 'media_player.rm_bedroom',
          remote: 'remote.rm_bedroom',
          variant: 'compact',
          cols: 6,
          grid_options: { columns: 6 },
        },
      ],
    },
    {
      title: 'Pad',
      cards: [
        { type: REMOTE, entity: 'media_player.rm_tv', remote: 'remote.rm_tv', variant: 'pad' },
      ],
    },
    {
      title: 'Row',
      cards: [
        { type: REMOTE, entity: 'media_player.rm_tv', remote: 'remote.rm_tv', variant: 'row' },
      ],
    },
    {
      title: 'Row · two',
      heights: [152, 172],
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          variant: 'row',
          cols: 6,
        },
        {
          type: REMOTE,
          entity: 'media_player.rm_tv_off',
          remote: 'remote.rm_tv_off',
          variant: 'row',
          cols: 6,
        },
      ],
    },
    // the volume: keys on a television that reports no level, the stepper, the receiver off and out of reach
    {
      title: 'Volume · keys',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_bedroom',
          remote: 'remote.rm_bedroom',
          groups: ['volume', 'apps'],
        },
      ],
    },
    {
      title: 'Volume · stepper',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          volume_entity: 'media_player.rm_receiver',
          volume: 'stepper',
          groups: ['volume'],
        },
      ],
    },
    {
      title: 'Volume · receiver off',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          volume_entity: 'media_player.rm_receiver_off',
          groups: ['volume'],
        },
      ],
    },
    {
      title: 'Volume · receiver unavailable',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          volume_entity: 'media_player.rm_receiver_gone',
          groups: ['volume'],
        },
      ],
    },
    // the apps: from the sources, in their colours, as chips, the person's own list
    {
      title: 'Apps · always',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          apps_tint: 'always',
          groups: ['apps'],
        },
      ],
    },
    {
      title: 'Apps · chips',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          apps_style: 'chips',
          groups: ['apps'],
        },
      ],
    },
    {
      title: 'Apps · own list',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          groups: ['apps'],
          apps: [
            { app: 'netflix' },
            { app: 'disneyplus' },
            { app: 'primevideo' },
            { app: 'hbomax' },
            { app: 'movistarplus' },
            { app: 'plex', name: 'Plex' },
            { name: 'Radio', icon: 'mdi:radio', source: 'Live TV' },
          ],
        },
      ],
    },
    // the groups reordered, two more of them
    {
      title: 'Groups · apps first',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_bedroom',
          remote: 'remote.rm_bedroom',
          groups: ['apps', 'dpad', 'volume'],
        },
      ],
    },
    {
      title: 'Groups · channel and custom',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_lg',
          groups: ['dpad', 'transport', 'channel', 'custom'],
          custom: [
            { name: 'Guide', key: 'guide' },
            { name: 'Info', key: 'info' },
            { name: 'Settings', key: 'settings' },
            {
              name: 'Sleep',
              icon: 'moon',
              tap_action: {
                action: 'perform-action',
                perform_action: 'media_player.turn_off',
                target: { entity_id: 'media_player.rm_lg' },
              },
            },
          ],
        },
      ],
    },
    // off: every key alive, the power on the primary fill; or power alone
    {
      title: 'Off',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv_off',
          remote: 'remote.rm_tv_off',
          volume_entity: 'media_player.rm_receiver',
        },
      ],
    },
    {
      title: 'Off · power alone',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv_off',
          remote: 'remote.rm_tv_off',
          volume_entity: 'media_player.rm_receiver',
          off_keys: 'power',
        },
      ],
    },
    // out of reach: the same size and anatomy, still
    {
      title: 'Out of reach',
      heights: [211, 266],
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv_gone',
          remote: 'remote.rm_tv_gone',
          volume_entity: 'media_player.rm_receiver',
        },
      ],
    },
    {
      title: 'Out of reach · quiet',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv_gone',
          remote: 'remote.rm_tv_gone',
          volume_entity: 'media_player.rm_receiver_gone',
          unavailable: 'quiet',
        },
      ],
    },
    // other integrations: their own keys
    {
      title: 'Apple TV',
      cards: [{ type: REMOTE, entity: 'media_player.rm_appletv', remote: 'remote.rm_appletv' }],
    },
    {
      title: 'Roku',
      cards: [{ type: REMOTE, entity: 'media_player.rm_roku', remote: 'remote.rm_roku' }],
    },
    {
      title: 'LG webOS',
      cards: [{ type: REMOTE, entity: 'media_player.rm_lg' }],
    },
    // what the height declared has to say of each: the pad's shapes, and a player with no remote takes no keys
    {
      title: 'Pad · grid',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          variant: 'pad',
          dpad: 'grid',
        },
      ],
    },
    {
      title: 'Pad · keys in a row',
      cards: [
        {
          type: REMOTE,
          entity: 'media_player.rm_tv',
          remote: 'remote.rm_tv',
          variant: 'pad',
          side_keys: 'row',
        },
      ],
    },
    {
      title: 'No remote',
      cards: [{ type: REMOTE, entity: 'media_player.rm_roku' }],
    },
  ],
};
