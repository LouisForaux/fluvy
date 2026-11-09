import type { GlyphName } from '@fluvy/ui';

/**
 * The remote's keys (1.18, #143) and what each integration takes for them, read from Home Assistant core's sources
 * (`homeassistant/components/<integration>/remote.py`, dev, 2026-11) and the libraries they call (androidtvremote2,
 * pyatv, rokuecp, aiowebostv, samsungtvws, python-androidtv), none tried on a device: Fluvy has no television to try
 * them on, and the table is the reader's to correct (`commands` in the config overrides a key).
 */
export const KEYS = [
  'power',
  'up',
  'down',
  'left',
  'right',
  'ok',
  'back',
  'home',
  'menu',
  'info',
  'guide',
  'captions',
  'settings',
  'input',
  'assistant',
  'exit',
  'play_pause',
  'play',
  'pause',
  'stop',
  'rewind',
  'forward',
  'previous',
  'next',
  'record',
  'volume_up',
  'volume_down',
  'mute',
  'channel_up',
  'channel_down',
] as const;
export type Key = (typeof KEYS)[number];

export const isKey = (value: unknown): value is Key =>
  typeof value === 'string' && (KEYS as readonly string[]).includes(value);

/** The glyph each key is drawn with. */
export const KEY_GLYPHS: Readonly<Record<Key, GlyphName>> = {
  power: 'power',
  up: 'up',
  down: 'down',
  left: 'chevronLeft',
  right: 'chevron',
  ok: 'check',
  back: 'undo',
  home: 'home',
  menu: 'menu',
  info: 'info',
  guide: 'list',
  captions: 'captions',
  settings: 'gear',
  input: 'swap',
  assistant: 'mic',
  exit: 'close',
  play_pause: 'play',
  play: 'play',
  pause: 'pause',
  stop: 'stop',
  rewind: 'rewind',
  forward: 'forward',
  previous: 'prev',
  next: 'next',
  record: 'snapshot',
  volume_up: 'plus',
  volume_down: 'minus',
  mute: 'volumeOff',
  channel_up: 'plus',
  channel_down: 'minus',
};

/** The integrations whose keys the table knows, by the `platform` of the entity's registry entry. */
export const PLATFORMS = [
  'androidtv_remote',
  'apple_tv',
  'roku',
  'webostv',
  'samsungtv',
  'androidtv',
] as const;
export type Integration = (typeof PLATFORMS)[number];

type Commands = Readonly<Partial<Record<Key, string>>>;

/**
 * Android TV Remote: `remote.send_command` with an Android key code's name without its `KEYCODE_` (androidtvremote2);
 * an app is launched with `remote.turn_on` and its package as the `activity`.
 */
const ANDROID_TV_REMOTE: Commands = {
  power: 'POWER',
  up: 'DPAD_UP',
  down: 'DPAD_DOWN',
  left: 'DPAD_LEFT',
  right: 'DPAD_RIGHT',
  ok: 'DPAD_CENTER',
  back: 'BACK',
  home: 'HOME',
  menu: 'MENU',
  info: 'INFO',
  guide: 'GUIDE',
  captions: 'CAPTIONS',
  settings: 'SETTINGS',
  input: 'TV_INPUT',
  assistant: 'ASSIST',
  exit: 'BACK',
  play_pause: 'MEDIA_PLAY_PAUSE',
  play: 'MEDIA_PLAY',
  pause: 'MEDIA_PAUSE',
  stop: 'MEDIA_STOP',
  rewind: 'MEDIA_REWIND',
  forward: 'MEDIA_FAST_FORWARD',
  previous: 'MEDIA_PREVIOUS',
  next: 'MEDIA_NEXT',
  record: 'MEDIA_RECORD',
  volume_up: 'VOLUME_UP',
  volume_down: 'VOLUME_DOWN',
  mute: 'VOLUME_MUTE',
  channel_up: 'CHANNEL_UP',
  channel_down: 'CHANNEL_DOWN',
};

/**
 * Apple TV: `remote.send_command` with pyatv's remote control names (any attribute of `RemoteControl`); the Siri
 * remote's back is `menu`, its TV button `home`; power through `wakeup` and `suspend`; no mute, no subtitles key.
 */
const APPLE_TV: Commands = {
  power: 'wakeup',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  ok: 'select',
  back: 'menu',
  home: 'home',
  menu: 'top_menu',
  exit: 'home',
  play_pause: 'play_pause',
  play: 'play',
  pause: 'pause',
  stop: 'stop',
  rewind: 'skip_backward',
  forward: 'skip_forward',
  previous: 'previous',
  next: 'next',
  volume_up: 'volume_up',
  volume_down: 'volume_down',
  channel_up: 'channel_up',
  channel_down: 'channel_down',
};

/** Roku: `remote.send_command` with rokuecp's names; the `*` options button is `info`, there is no subtitles key. */
const ROKU: Commands = {
  power: 'power',
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
  ok: 'select',
  back: 'back',
  home: 'home',
  menu: 'info',
  info: 'info',
  input: 'input_tuner',
  assistant: 'search',
  exit: 'home',
  play_pause: 'play',
  play: 'play',
  pause: 'play',
  rewind: 'reverse',
  forward: 'forward',
  previous: 'replay',
  volume_up: 'volume_up',
  volume_down: 'volume_down',
  mute: 'volume_mute',
  channel_up: 'channel_up',
  channel_down: 'channel_down',
};

/** LG webOS: `webostv.button` on the player itself (the integration has no remote entity) with aiowebostv's names. */
const WEBOS: Commands = {
  power: 'POWER',
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  ok: 'ENTER',
  back: 'BACK',
  home: 'HOME',
  menu: 'MENU',
  info: 'INFO',
  guide: 'GUIDE',
  captions: 'CC',
  settings: 'QMENU',
  input: 'INPUT_HUB',
  exit: 'EXIT',
  play: 'PLAY',
  pause: 'PAUSE',
  stop: 'STOP',
  rewind: 'REWIND',
  forward: 'FASTFORWARD',
  record: 'RECORD',
  volume_up: 'VOLUMEUP',
  volume_down: 'VOLUMEDOWN',
  mute: 'MUTE',
  channel_up: 'CHANNELUP',
  channel_down: 'CHANNELDOWN',
};

/** Samsung: `remote.send_command` with the TV's `KEY_*` codes (samsungtvws). */
const SAMSUNG: Commands = {
  power: 'KEY_POWER',
  up: 'KEY_UP',
  down: 'KEY_DOWN',
  left: 'KEY_LEFT',
  right: 'KEY_RIGHT',
  ok: 'KEY_ENTER',
  back: 'KEY_RETURN',
  home: 'KEY_HOME',
  menu: 'KEY_MENU',
  info: 'KEY_INFO',
  guide: 'KEY_GUIDE',
  captions: 'KEY_CAPTION',
  settings: 'KEY_TOOLS',
  input: 'KEY_SOURCE',
  exit: 'KEY_EXIT',
  play: 'KEY_PLAY',
  pause: 'KEY_PAUSE',
  stop: 'KEY_STOP',
  rewind: 'KEY_REWIND',
  forward: 'KEY_FF',
  record: 'KEY_REC',
  volume_up: 'KEY_VOLUP',
  volume_down: 'KEY_VOLDOWN',
  mute: 'KEY_MUTE',
  channel_up: 'KEY_CHUP',
  channel_down: 'KEY_CHDOWN',
};

/** Fire TV and other ADB devices (androidtv): `remote.send_command` with python-androidtv's key names. */
const ANDROID_TV: Commands = {
  power: 'POWER',
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  ok: 'CENTER',
  back: 'BACK',
  home: 'HOME',
  menu: 'MENU',
  settings: 'SETTINGS',
  input: 'INPUT',
  assistant: 'SEARCH',
  exit: 'BACK',
  rewind: 'REWIND',
  forward: 'FAST_FORWARD',
  volume_up: 'VOLUME_UP',
  volume_down: 'VOLUME_DOWN',
  mute: 'MUTE',
};

const TABLE: Readonly<Record<Integration, Commands>> = {
  androidtv_remote: ANDROID_TV_REMOTE,
  apple_tv: APPLE_TV,
  roku: ROKU,
  webostv: WEBOS,
  samsungtv: SAMSUNG,
  androidtv: ANDROID_TV,
};

export const isIntegration = (value: unknown): value is Integration =>
  typeof value === 'string' && (PLATFORMS as readonly string[]).includes(value);

/**
 * The command an integration takes for a key, or none where it has no key for it; an integration the table does not
 * know is sent Android TV Remote's names, the most common in a house (`commands` in the config names its own).
 */
export const commandFor = (integration: string | undefined, key: Key): string | undefined =>
  (isIntegration(integration) ? TABLE[integration] : ANDROID_TV_REMOTE)[key];

/** webOS takes its keys as `webostv.button` on the player; every other integration as `remote.send_command`. */
export const buttonService = (integration: string | undefined): boolean =>
  integration === 'webostv';
