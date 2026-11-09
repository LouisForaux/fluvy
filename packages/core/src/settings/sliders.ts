/**
 * The house's slider settings (1.18, #144): the style every slider is drawn in where a card says nothing of its own,
 * chosen once in the settings panel's Appearance tab, as the charts' style is. A card's own `slider_style` wins; the
 * ruler is the factory's, so nobody's card changes on upgrade. The drawing is the ruler's (`@fluvy/ui`, `look`); the
 * model lives here so the settings can hold it.
 */

/**
 * The styles a slider may be drawn in: the ruler (its ticks and knob), a bar (Home Assistant's idea in the ruler's
 * slot), a liquid (the bar's slot, the fill water with two slow waves at its edge), or the fill (a tile's: the whole
 * tile is the slider; a card asked for it draws the ruler).
 */
export const SLIDER_STYLES = ['ruler', 'bar', 'liquid', 'fill'] as const;
export type SliderStyle = (typeof SLIDER_STYLES)[number];

/** The words under a bar or a liquid: the ends and the middle, or none; the row stays either way, so no height moves. */
export const SLIDER_WORDS = ['ends', 'none'] as const;
export type SliderWords = (typeof SLIDER_WORDS)[number];

export interface SliderSettings {
  readonly style: SliderStyle;
  readonly words: SliderWords;
}

/** The factory settings: the ruler, with the ends and the middle said under a bar or a liquid. */
export const SLIDER_DEFAULTS: SliderSettings = { style: 'ruler', words: 'ends' };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isSliderStyle = (value: unknown): value is SliderStyle =>
  (SLIDER_STYLES as readonly unknown[]).includes(value);
export const isSliderWords = (value: unknown): value is SliderWords =>
  (SLIDER_WORDS as readonly unknown[]).includes(value);

/** The slider settings, field by field: anything missing, broken or unknown is the default. */
export function parseSliderSettings(raw: unknown): SliderSettings {
  const value = isRecord(raw) ? raw : {};
  const d = SLIDER_DEFAULTS;
  return {
    style: isSliderStyle(value['style']) ? value['style'] : d.style,
    words: isSliderWords(value['words']) ? value['words'] : d.words,
  };
}
