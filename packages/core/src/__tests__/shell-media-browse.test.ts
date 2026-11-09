// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mediaBrowseCss, mediaThumbnailCss } from '../shell/css/panels.js';

/** A tile of Home Assistant's media browser: `.child ha-card .thumbnail`, then the class its picture is drawn with. */
const tile = (classes: string): Element => {
  const child = document.createElement('div');
  child.className = 'child';
  child.innerHTML = `<ha-card><div class="thumbnail"><div class="${classes}"></div></div></ha-card>`;
  return child.querySelector('.thumbnail > div') as Element;
};

/** What `ha-media-browser-thumbnail` draws in its own shadow root. */
const thumbnail = (classes: string): Element => {
  const root = document.createElement('div');
  root.innerHTML = `<div class="${classes}"></div>`;
  return root.firstElementChild as Element;
};

const selectorOf = (css: string): string => css.slice(0, css.indexOf('{')).trim();

describe('the media browser', () => {
  const browse = selectorOf(mediaBrowseCss);
  const picture = selectorOf(mediaThumbnailCss);

  it('greys the icon of a tile with no picture', () => {
    expect(tile('icon-holder image').matches(browse)).toBe(true);
  });

  it('greys a brand’s logo', () => {
    expect(thumbnail('image brand').matches(picture)).toBe(true);
  });

  // #147: a photo, a video, an album's or a folder's cover keeps its colours, to be told apart and compared
  it('leaves a picture of the media itself alone', () => {
    expect(tile('image').matches(browse)).toBe(false);
    expect(thumbnail('image').matches(picture)).toBe(false);
  });

  it('leaves a folder or an app with a cover of its own alone', () => {
    expect(tile('centered-image image').matches(browse)).toBe(false);
  });
});
