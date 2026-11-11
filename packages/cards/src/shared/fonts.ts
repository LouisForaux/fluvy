import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * `document.fonts.ready`, read once for every card attached in one go: the browser lays the page out to answer it, so a
 * view that opens many cards at once (a wall's) would be laid out again for every one before it is drawn.
 */
let ready: Promise<FontFaceSet> | undefined;
function fontsReady(): Promise<FontFaceSet> {
  if (!ready) {
    ready = document.fonts.ready;
    queueMicrotask(() => (ready = undefined));
  }
  return ready;
}

/**
 * How many times faces finished loading in the page since the first card listened: with the number of faces the page
 * has, what a card that settled has measured on. A face loaded first and added after (`addFonts`, Inter) fires no
 * `loadingdone`, so the faces' number counts too.
 */
let loads = 0;
let counting = false;
function countLoads(): void {
  if (counting) return;
  counting = true;
  document.fonts.addEventListener('loadingdone', () => loads++);
}
const facesNow = (): string => `${loads}/${document.fonts.size}`;

/**
 * Re-runs a card's text fitting when a web font may have changed its layout. A card measures laid-out
 * text (a greeting's size tier, a readout's label, a head's pills), so it measures again when a font
 * finishes loading — one frame later, because a face becomes usable for layout a frame after the event
 * says so — at `document.fonts.ready`, and once 1.2 s after the card connects as a safety net for a
 * face that loaded before the card listened. Create it once, in the card's constructor: it registers
 * itself with the card and lives as long as the card.
 *
 * A card that settled (its safety net ran) and is only put back in the page, with no face loaded since, measures
 * nothing again: Home Assistant's card picker moves every preview it lists at each keystroke of its search, and two
 * draws of each preview at every move made the search crawl.
 */
export class FontsSettled implements ReactiveController {
  private timer = 0;
  private frame = 0;
  /** The faces (`facesNow`) the card last settled on with its safety net; empty until it has. */
  private settledAt = '';
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
      if (this.net) this.settledAt = facesNow();
      this.net = false;
      this.onSettle();
    });
  }

  private readonly run = (): void => this.settle(false);

  private readonly safetyNet = (): void => this.settle(true);

  hostConnected(): void {
    if (typeof document === 'undefined' || !document.fonts) return;
    countLoads();
    document.fonts.addEventListener('loadingdone', this.run);
    // only moved: the faces are the ones it settled on, its text measures the same
    if (this.settledAt === facesNow() && document.fonts.status === 'loaded') return;
    void fontsReady().then(this.run);
    this.timer = window.setTimeout(this.safetyNet, 1200);
  }

  hostDisconnected(): void {
    document.fonts?.removeEventListener('loadingdone', this.run);
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
    this.net = false;
  }
}
