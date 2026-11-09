// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  setSliderDefaults,
  sliderDefaults,
  sliderStill,
  sliderStyleOf,
  sliderWordsOf,
  setChartDefaults,
} from '../card.js';
import { CHART_DEFAULTS } from '../settings/charts.js';
import { SLIDER_DEFAULTS } from '../settings/sliders.js';

/**
 * The style a card's sliders are drawn in (1.18, #144): its own `slider_style` › the house's › the ruler, as before.
 * The fill is a tile's: a card asked for it draws the ruler. The words under a bar or a liquid are the ends and the
 * middle, or none, the card's own `slider_words` first; the ruler keeps its own.
 */
const WORDS = [
  [0, '0'],
  [0.25, '25'],
  [0.5, '50'],
  [0.75, '75'],
  [1, '100'],
] as const;

afterEach(() => {
  setSliderDefaults(SLIDER_DEFAULTS);
  setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
});

describe('the slider style a card draws', () => {
  it('is the ruler where nothing says otherwise, as before 1.18', () => {
    expect(sliderDefaults()).toEqual({ style: 'ruler', words: 'ends' });
    expect(sliderStyleOf(undefined)).toBe('ruler');
    expect(sliderStyleOf({})).toBe('ruler');
    expect(sliderStyleOf({ slider_style: 'house' })).toBe('ruler');
    expect(sliderWordsOf({}, WORDS, 'ruler')).toBe(WORDS);
  });

  it('is the house’s where a card says none or says `house`, and the card’s own over it', () => {
    setSliderDefaults({ style: 'bar', words: 'ends' });
    expect(sliderStyleOf({})).toBe('bar');
    expect(sliderStyleOf({ slider_style: 'house' })).toBe('bar');
    expect(sliderStyleOf({ slider_style: 'liquid' })).toBe('liquid');
    expect(sliderStyleOf({ slider_style: 'ruler' })).toBe('ruler');
    // a word it does not know is the house's
    expect(sliderStyleOf({ slider_style: 'knob' as never })).toBe('bar');
  });

  it('draws the fill on a tile alone: a card asked for it draws the ruler', () => {
    expect(sliderStyleOf({ slider_style: 'fill' }, true)).toBe('fill');
    expect(sliderStyleOf({ slider_style: 'fill' })).toBe('ruler');
    setSliderDefaults({ style: 'fill', words: 'ends' });
    expect(sliderStyleOf({}, true)).toBe('fill');
    expect(sliderStyleOf({})).toBe('ruler');
    expect(sliderStyleOf({ slider_style: 'bar' }, true)).toBe('bar');
  });

  it('says the ends and the middle under a bar or a liquid, or none, the row kept either way', () => {
    expect(sliderWordsOf({}, WORDS, 'bar')).toEqual([WORDS[0], WORDS[2], WORDS[4]]);
    expect(sliderWordsOf({}, WORDS, 'liquid')).toEqual([WORDS[0], WORDS[2], WORDS[4]]);
    // two or three words stand as they are (a temperature's warm and cool)
    const ends = [WORDS[0], WORDS[4]];
    expect(sliderWordsOf({}, ends, 'bar')).toEqual(ends);
    expect(sliderWordsOf({}, [WORDS[0], WORDS[2], WORDS[4]], 'bar')).toHaveLength(3);
    // none: the card's own, else the house's
    expect(sliderWordsOf({ slider_words: 'none' }, WORDS, 'bar')).toEqual([]);
    setSliderDefaults({ style: 'bar', words: 'none' });
    expect(sliderWordsOf({}, WORDS, 'bar')).toEqual([]);
    expect(sliderWordsOf({ slider_words: 'ends' }, WORDS, 'bar')).toHaveLength(3);
    // the ruler keeps its own words whatever the house says
    expect(sliderWordsOf({}, WORDS, 'ruler')).toBe(WORDS);
  });

  it('rests a liquid while the house’s motion is off', () => {
    expect(sliderStill()).toBe(false);
    setChartDefaults({ settings: { ...CHART_DEFAULTS, animate: false }, sets: [] });
    expect(sliderStill()).toBe(true);
  });
});
