import {
  localize,
  ownLanguage,
  type EntityView,
  type HomeAssistant,
  type MessageKey,
} from '@fluvy/core';

/*
 * The words for what an entity lists to choose from: a climate's modes, fan speeds and presets, a fan's presets, a
 * vacuum's suction.
 */

/** A raw key in words: its underscores as spaces, its first letter capitalised ("fan_only" is "Fan only"). */
export const pretty = (raw: string): string => {
  const text = raw.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Home Assistant's own word for `value` (`say` asks its formatter), capitalised, where Fluvy speaks the page's
 * language and Home Assistant has a word for it: one it has none for comes back exactly as it is, and its English
 * word may be the value capitalised ("medium" is "Medium"). `hass` is the page's, as Home Assistant handed it over
 * (a card's `rawHass`): where a person chose a language of their own for Fluvy, Home Assistant's formatters speak
 * another one, and are not asked.
 */
export function haWord(
  hass: HomeAssistant | undefined,
  value: string,
  say: (hass: HomeAssistant) => string | undefined,
): string | undefined {
  if (!hass || ownLanguage(hass.language)) return undefined;
  try {
    const text = say(hass);
    if (text && text !== value) return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    /* no word of Home Assistant's */
  }
  return undefined;
}

/**
 * An entity's mode in words, as its attribute (`fan_mode`, `preset_mode`, `fan_speed`) holds it: Home Assistant's own
 * (the integration's translation, standard or its own) where Fluvy speaks the page's language (`haWord`); else
 * Fluvy's word for it where it has one (`own`); else the mode, tidied.
 */
export function modeWord(
  hass: HomeAssistant | undefined,
  view: EntityView,
  attribute: string,
  mode: string,
  own?: MessageKey,
): string {
  const stateObj = view.stateObj;
  return (
    (stateObj &&
      haWord(hass, mode, (h) => h.formatEntityAttributeValue?.(stateObj, attribute, mode))) ||
    (own ? localize(hass, own) : pretty(mode))
  );
}
