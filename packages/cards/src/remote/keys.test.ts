import { describe, expect, it } from 'vitest';
import { buttonService, commandFor, isKey, KEY_GLYPHS, KEYS } from './keys.js';

describe('the remote’s keys and the integrations’ commands (#143)', () => {
  it('every key has a glyph, and only the table’s names are keys', () => {
    for (const key of KEYS) expect(KEY_GLYPHS[key], key).toBeTruthy();
    expect(isKey('home')).toBe(true);
    expect(isKey('HOME')).toBe(false);
    expect(isKey(3)).toBe(false);
  });

  it('Android TV Remote takes Android key names without their prefix', () => {
    expect(commandFor('androidtv_remote', 'ok')).toBe('DPAD_CENTER');
    expect(commandFor('androidtv_remote', 'back')).toBe('BACK');
    expect(commandFor('androidtv_remote', 'mute')).toBe('VOLUME_MUTE');
    expect(commandFor('androidtv_remote', 'play_pause')).toBe('MEDIA_PLAY_PAUSE');
  });

  it('Apple TV takes pyatv’s names: the Siri remote’s back is menu, its TV button home; no subtitles key', () => {
    expect(commandFor('apple_tv', 'back')).toBe('menu');
    expect(commandFor('apple_tv', 'home')).toBe('home');
    expect(commandFor('apple_tv', 'ok')).toBe('select');
    expect(commandFor('apple_tv', 'rewind')).toBe('skip_backward');
    expect(commandFor('apple_tv', 'captions')).toBeUndefined();
  });

  it('Roku takes rokuecp’s names: reverse and forward, the options button as info', () => {
    expect(commandFor('roku', 'rewind')).toBe('reverse');
    expect(commandFor('roku', 'forward')).toBe('forward');
    expect(commandFor('roku', 'menu')).toBe('info');
    expect(commandFor('roku', 'mute')).toBe('volume_mute');
  });

  it('LG webOS takes aiowebostv’s buttons on the player itself', () => {
    expect(commandFor('webostv', 'captions')).toBe('CC');
    expect(commandFor('webostv', 'ok')).toBe('ENTER');
    expect(buttonService('webostv')).toBe(true);
    expect(buttonService('samsungtv')).toBe(false);
  });

  it('Samsung takes KEY_ codes, Fire TV python-androidtv’s names', () => {
    expect(commandFor('samsungtv', 'volume_up')).toBe('KEY_VOLUP');
    expect(commandFor('samsungtv', 'back')).toBe('KEY_RETURN');
    expect(commandFor('androidtv', 'ok')).toBe('CENTER');
    expect(commandFor('androidtv', 'forward')).toBe('FAST_FORWARD');
  });

  it('an integration the table does not know is sent Android TV Remote’s names', () => {
    expect(commandFor('philips_js', 'home')).toBe('HOME');
    expect(commandFor(undefined, 'up')).toBe('DPAD_UP');
  });
});
