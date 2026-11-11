// @vitest-environment happy-dom
import { afterAll, describe, expect, it } from 'vitest';
import { THEME_SENTINEL } from '@fluvy/tokens/config';
import { FACES_ADDED } from '../fonts.js';
import { startLook } from '../look/start.js';

/*
 * Inter is registered by the look once Fluvy is in use on the page, never before: a page on another theme asks for
 * no face of ours, and the moment Home Assistant applies the Fluvy theme (its sentinel inline on <html>) both faces
 * are registered, once.
 */

/** The faces the page asked for, as `FontFace` stood in: their family and source, their load answered at once. */
const asked: string[] = [];
const added: FakeFace[] = [];
/** What the page's faces were told as ours were added (`FACES_ADDED`, for what measures text). */
const said: string[] = [];
class FakeFace {
  constructor(family: string, source: string) {
    asked.push(`${family}: ${source}`);
  }
  load(): Promise<FakeFace> {
    return Promise.resolve(this);
  }
}

/** The style mutation observed, the faces loaded and added. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('the look registers Inter', () => {
  Object.assign(window, { FontFace: FakeFace });
  Object.defineProperty(document, 'fonts', {
    value: {
      add: (face: FakeFace) => added.push(face),
      dispatchEvent: (event: Event) => said.push(event.type),
    },
    configurable: true,
  });
  const look = startLook();
  afterAll(() => look?.stop());

  it('asks for no face on a page where Fluvy is not in use', async () => {
    expect(look).toBeDefined();
    await settle();
    expect(asked).toEqual([]);
  });

  it('registers both faces once Home Assistant applies the theme, and never twice', async () => {
    document.documentElement.style.setProperty(THEME_SENTINEL, '1');
    await settle();
    expect(asked).toEqual([
      expect.stringMatching(/^Inter: url\(.*inter-variable\.woff2\) format\("woff2"\)$/),
      expect.stringMatching(/^Inter: url\(.*inter-italic-variable\.woff2\) format\("woff2"\)$/),
    ]);
    expect(added).toHaveLength(2);
    expect(said).toEqual([FACES_ADDED, FACES_ADDED]);
    // the theme applied again (dark mode): nothing more is asked for
    document.documentElement.style.setProperty('--primary-color', '#856529');
    await settle();
    expect(asked).toHaveLength(2);
  });
});
