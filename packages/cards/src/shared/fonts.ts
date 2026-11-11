import { FACES_ADDED } from '@fluvy/core';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * `document.fonts.ready`, read once until faces start loading again: the browser lays the page out to answer it (13 ms
 * a read in a dashboard's editor), so cards attached one by one would each lay the page out before they are drawn —
 * Home Assistant's card picker attaches its previews each in a microtask of its own, which a cache of one microtask
 * did not cover. The promise is the same one until faces start loading (`loading`), when it is read again.
 */
let ready: Promise<FontFaceSet> | undefined;
function fontsReady(): Promise<FontFaceSet> {
  return (ready ??= document.fonts.ready);
}

/**
 * What tells a card the faces it measured on changed: faces finished loading (`loadingdone`), or one of ours, loaded
 * first, was added (`FACES_ADDED`: that fires no `loadingdone`). Told by events, not read off `document.fonts` as a
 * card attaches: its `size`, like its `ready`, recomputes the page's styles (42 ms for the card picker's previews).
 */
const CHANGED = ['loadingdone', FACES_ADDED] as const;

/** How many times the faces changed (`CHANGED`) since the first card listened: what a card that settled measured on. */
let changes = 0;
let watching = false;
function watchFaces(): void {
  if (watching) return;
  watching = true;
  document.fonts.addEventListener('loading', () => (ready = undefined));
  for (const type of CHANGED) document.fonts.addEventListener(type, () => changes++);
}

/**
 * Re-runs a card's text fitting when a web font may have changed its layout. A card measures laid-out
 * text (a greeting's size tier, a readout's label, a head's pills), so it measures again when a font
 * finishes loading — one frame later, because a face becomes usable for layout a frame after the event
 * says so — at `document.fonts.ready`, and once 1.2 s after the card connects as a safety net for a
 * face that loaded before the card listened (or one of ours added, `FACES_ADDED`). Create it once, in the card's constructor: it registers
 * itself with the card and lives as long as the card.
 *
 * A card that settled (its safety net ran) and is only put back in the page, with no face loaded since, measures
 * nothing again: Home Assistant's card picker moves every preview it lists at each keystroke of its search, and two
 * draws of each preview at every move made the search crawl.
 */
export class FontsSettled implements ReactiveController {
  private timer = 0;
  private frame = 0;
  /** The faces' changes (`changes`) the card last settled at with its safety net; -1 until it has. */
  private settledAt = -1;
  /** Whether the frame waiting is the safety net's. */
  private net = false;

  /** `onSettle` measures afresh; by default the card simply draws again (its fitting runs in its render). */
  constructor(
    host: ReactiveControllerHost,
    private readonly onSettle: () => void = () => host.requestUpdate(),
  ) {
    host.addController(this);
  }

  private settle(net: boolean): void {
    cancelAnimationFrame(this.frame);
    this.net ||= net;
    this.frame = requestAnimationFrame(() => {
      if (this.net) this.settledAt = changes;
      this.net = false;
      this.onSettle();
    });
  }

  private readonly run = (): void => this.settle(false);

  private readonly safetyNet = (): void => this.settle(true);

  hostConnected(): void {
    if (typeof document === 'undefined' || !document.fonts) return;
    watchFaces();
    for (const type of CHANGED) document.fonts.addEventListener(type, this.run);
    // only moved: the faces are the ones it settled on, its text measures the same (a face still loading says so when
    // it is done, `run`)
    if (this.settledAt === changes) return;
    void fontsReady().then(this.run);
    this.timer = window.setTimeout(this.safetyNet, 1200);
  }

  hostDisconnected(): void {
    for (const type of CHANGED) document.fonts?.removeEventListener(type, this.run);
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
    this.net = false;
  }
}
