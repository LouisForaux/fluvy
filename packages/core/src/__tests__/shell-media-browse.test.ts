// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mediaBrowseCss } from '../shell/css/panels.js';

/** A tile of Home Assistant's media browser: `.child ha-card .thumbnail`, then the class its picture is drawn with. */
const tile = (classes: string): Element => {
  const child = document.createElement('div');
  child.className = 'child';
  child.innerHTML = `<ha-card><div class="thumbnail"><div class="${classes}"></div></div></ha-card>`;
  return child.querySelector('.thumbnail > div') as Element;
};

describe('the media browser', () => {
  const selector = mediaBrowseCss.slice(0, mediaBrowseCss.indexOf('{')).trim();

  it('greys the sources’ logos and icons', () => {
    expect(tile('centered-image image').matches(selector)).toBe(true);
    expect(tile('icon-holder image').matches(selector)).toBe(true);
  });

  // #147: a photo or a video keeps its colours, to be told apart and compared
  it('leaves a picture of the media itself alone', () => {
    expect(tile('image').matches(selector)).toBe(false);
  });
});
