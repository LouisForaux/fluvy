import {
  ensureLanguage,
  resolveEntity,
  setLanguageOverride,
  type HassEntity,
  type HomeAssistant,
} from '@fluvy/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { haWord, modeWord, pretty } from './mode-words.js';

/** Home Assistant's own German words for a climate's fan speeds (`common::state`), as its formatter says them. */
const GERMAN: Record<string, string> = { low: 'Niedrig', medium: 'Mittel', high: 'Hoch' };

const ac: HassEntity = {
  entity_id: 'climate.living_ac',
  state: 'cool',
  attributes: { fan_modes: ['auto', 'low', 'mid', 'medium', 'high', 'quiet'] },
  last_changed: '2026-11-08T08:00:00Z',
  last_updated: '2026-11-08T08:00:00Z',
};

/** A page in `language`, its formatter saying what Home Assistant has a word for, else the value as it is. */
const page = (language: string, words: Record<string, string> = {}): HomeAssistant =>
  ({
    language,
    states: { [ac.entity_id]: ac },
    formatEntityAttributeValue: (_: HassEntity, attribute: string, value: unknown) =>
      attribute === 'fan_mode' ? (words[String(value)] ?? String(value)) : String(value),
  }) as unknown as HomeAssistant;

const view = (hass: HomeAssistant) => resolveEntity(hass, ac.entity_id);
const speed = (hass: HomeAssistant, mode: string) =>
  modeWord(hass, view(hass), 'fan_mode', mode, mode === 'mid' ? 'fan.mid' : undefined);

beforeAll(() => ensureLanguage('de'));
afterEach(() => setLanguageOverride(undefined));

describe('the words for what an entity lists to choose from (#142)', () => {
  it('are Home Assistant’s own where Fluvy speaks the page’s language, else Fluvy’s, else the mode tidied', () => {
    const german = page('de', GERMAN);
    expect(['low', 'medium', 'high'].map((mode) => speed(german, mode))).toEqual([
      'Niedrig',
      'Mittel',
      'Hoch',
    ]);
    // Home Assistant has no word for `mid`: Fluvy's; nor for a vendor's own: as it is sent, tidied
    expect(speed(german, 'mid')).toBe('Mittel');
    expect(speed(german, 'quiet')).toBe('Quiet');
    expect(speed(german, 'super_silent')).toBe('Super silent');
  });

  it('never ask Home Assistant where a person chose a language of their own: its formatter speaks the page’s', () => {
    setLanguageOverride('en');
    const german = page('de', GERMAN);
    expect(haWord(german, 'low', () => 'Niedrig')).toBeUndefined();
    expect(speed(german, 'low')).toBe('Low');
    expect(speed(german, 'mid')).toBe('Mid');
    // the page's own language chosen is no language of their own
    setLanguageOverride('de');
    expect(speed(german, 'high')).toBe('Hoch');
  });

  it('take Home Assistant’s word capitalised, and none where it says the value back as it is or cannot say it', () => {
    const polish = page('pl');
    expect(haWord(polish, 'low', () => 'niski')).toBe('Niski');
    expect(haWord(polish, 'low', () => 'low')).toBeUndefined();
    // English's own word is the value capitalised: Home Assistant's all the same
    expect(haWord(page('en'), 'medium', () => 'Medium')).toBe('Medium');
    expect(haWord(polish, 'low', () => undefined)).toBeUndefined();
    expect(
      haWord(polish, 'low', () => {
        throw new Error('no translations yet');
      }),
    ).toBeUndefined();
    expect(haWord(undefined, 'low', () => 'Low')).toBeUndefined();
    expect(pretty('fan_only')).toBe('Fan only');
  });
});
