// @vitest-environment happy-dom
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FontsSettled } from './fonts.js';

/** The page's faces: all loaded, `loadingdone` fired by the test when one more arrives, `size` grown when one is added. */
class Faces extends EventTarget {
  status: FontFaceSetLoadStatus = 'loaded';
  size = 2;
  get ready(): Promise<this> {
    return Promise.resolve(this);
  }
}

const faces = new Faces();
let original: PropertyDescriptor | undefined;

beforeAll(() => {
  original = Object.getOwnPropertyDescriptor(document, 'fonts');
  Object.defineProperty(document, 'fonts', { configurable: true, value: faces });
});

afterAll(() => {
  if (original) Object.defineProperty(document, 'fonts', original);
  else delete (document as { fonts?: unknown }).fonts;
});

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  return () => vi.useRealTimers();
});

/** A card as the controller sees it: it counts the draws it is asked for. */
function card(): { draws: () => number; connect: () => void; disconnect: () => void } {
  let controller: ReactiveController | undefined;
  const requestUpdate = vi.fn();
  const host = {
    addController: (added: ReactiveController) => (controller = added),
    requestUpdate,
  } as unknown as ReactiveControllerHost;
  new FontsSettled(host);
  return {
    draws: () => requestUpdate.mock.calls.length,
    connect: () => controller?.hostConnected?.(),
    disconnect: () => controller?.hostDisconnected?.(),
  };
}

/** `document.fonts.ready`, the frame after it, the safety net and the frame after that. */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  vi.advanceTimersToNextFrame();
  vi.advanceTimersByTime(1200);
  vi.advanceTimersToNextFrame();
}

describe('FontsSettled', () => {
  it('measures a card that connects for the first time at the faces being ready and with its safety net', async () => {
    const one = card();
    one.connect();
    await settle();
    expect(one.draws()).toBe(2);
  });

  it('draws a settled card that is only moved (the card picker’s search) no more', async () => {
    const one = card();
    one.connect();
    await settle();
    const before = one.draws();
    for (let move = 0; move < 5; move++) {
      one.disconnect();
      one.connect();
      await settle();
    }
    expect(one.draws()).toBe(before);
  });

  it('measures a moved card again when a face loaded while it was away', async () => {
    const one = card();
    one.connect();
    await settle();
    one.disconnect();
    // a card still in the page counts the load (the count is the page's)
    const other = card();
    other.connect();
    faces.dispatchEvent(new Event('loadingdone'));
    const before = one.draws();
    one.connect();
    await settle();
    expect(one.draws()).toBeGreaterThan(before);
  });

  it('measures a moved card again when a face loaded first was added while it was away (Inter, `addFonts`)', async () => {
    const one = card();
    one.connect();
    await settle();
    one.disconnect();
    // `FontFaceSet.add` of a face already loaded fires no `loadingdone`
    faces.size++;
    const before = one.draws();
    one.connect();
    await settle();
    expect(one.draws()).toBeGreaterThan(before);
  });

  it('measures a card moved before its safety net ran in full again', async () => {
    const one = card();
    one.connect();
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersToNextFrame();
    one.disconnect();
    const before = one.draws();
    one.connect();
    await settle();
    expect(one.draws()).toBe(before + 2);
  });

  it('follows a face that loads while the card is in the page', async () => {
    const one = card();
    one.connect();
    await settle();
    const before = one.draws();
    faces.dispatchEvent(new Event('loadingdone'));
    vi.advanceTimersToNextFrame();
    expect(one.draws()).toBe(before + 1);
  });
});
