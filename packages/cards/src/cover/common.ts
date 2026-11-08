import { stateText, type EntityView, type HomeAssistant } from '@fluvy/core';
import { css, type TemplateResult } from 'lit';

/* What the cover, fan and vacuum cards share: optimistic attributes, coalesced steps, a press-safe stepper, the action row's gap. */

interface Host {
  requestUpdate(): void;
}

/**
 * What the user just chose, drawn until Home Assistant reports it back — or for a few seconds at
 * most, after which the reported value wins, whatever it is. `expect()` on the base card does this
 * for an entity's state; this does it for an attribute (a fan's speed, a blind's tilt, a suction level).
 *
 * `keep` lets a slow device hold longer: a blind keeps its target while it says it is travelling.
 */
export class Hold<T> {
  private chosen: { readonly value: T } | null = null;
  private timer = 0;
  private born = 0;

  constructor(
    private readonly host: Host,
    private readonly keep?: () => boolean,
    private readonly ms = 4000,
    private readonly limit = 120_000,
  ) {}

  set(value: T): void {
    this.clear();
    this.chosen = { value };
    this.born = performance.now();
    this.timer = window.setTimeout(this.expire, this.ms);
    this.host.requestUpdate();
  }

  /** The value to draw for the reported one. Lets go as soon as the two agree. */
  read(reported: T, same: (a: T, b: T) => boolean = Object.is): T {
    if (!this.chosen) return reported;
    if (same(reported, this.chosen.value)) {
      this.clear();
      return reported;
    }
    return this.chosen.value;
  }

  clear(): void {
    clearTimeout(this.timer);
    this.timer = 0;
    this.chosen = null;
  }

  private readonly expire = (): void => {
    if (this.keep?.() && performance.now() - this.born < this.limit) {
      this.timer = window.setTimeout(this.expire, this.ms);
      return;
    }
    this.clear();
    this.host.requestUpdate();
  };
}

/** Quick taps on a stepper make one service call: the last value, once the taps stop. */
export class Burst {
  private timer = 0;
  private job: (() => void) | null = null;

  constructor(private readonly ms = 650) {} // longer than the 530 ms a held stepper takes to repeat

  push(job: () => void): void {
    clearTimeout(this.timer);
    this.job = job;
    this.timer = window.setTimeout(() => this.flush(), this.ms);
  }

  /** Sends what is waiting right now (the card is going away: the user still asked for it). */
  flush(): void {
    clearTimeout(this.timer);
    this.timer = 0;
    const job = this.job;
    this.job = null;
    job?.();
  }
}

/**
 * `stepper()` arms its press-and-hold repeat inside the template it returns. A card that re-renders
 * while the finger is down — it does, the moment the value answers — would swap the listeners and
 * leave the first repeat running for good. Building the template once per `key` keeps one repeat
 * for the whole press; when the key does change, any press in flight is released first.
 */
export class StableTemplate {
  private key = '';
  private template: TemplateResult | null = null;

  constructor(private readonly host: { readonly renderRoot: ParentNode }) {}

  get(key: string, build: () => TemplateResult): TemplateResult {
    if (key !== this.key || !this.template) {
      releasePresses(this.host.renderRoot);
      this.key = key;
      this.template = build();
    }
    return this.template;
  }
}

/** Ends a press-and-hold that is still repeating (the card is leaving the page, or its stepper is about to be rebuilt). */
export function releasePresses(root: ParentNode): void {
  root
    .querySelectorAll('.fv-stepper__half')
    .forEach((half) => half.dispatchEvent(new PointerEvent('pointercancel')));
}

/** State text for the state being drawn, which may be the one we asked for rather than the reported one. */
export function shownStateText(
  hass: HomeAssistant | undefined,
  view: EntityView,
  shown: string,
): string {
  if (shown === view.state || !view.stateObj) return stateText(hass, view);
  return stateText(hass, { ...view, state: shown, stateObj: { ...view.stateObj, state: shown } });
}

/**
 * The head's sub line on a narrow card keeps its first segment ("Living room · window" → "Living room"):
 * beside a state badge there is no room for two, and a whole word reads better than a cut one.
 */
export const headSub = (sub: string, contentWidth: number): string =>
  contentWidth < 300 ? (sub.split(' · ')[0] ?? sub) : sub;

/**
 * An action row is equal cells that fill the content column — never a left-hugging strip. For the
 * cells to land on the 4 px grid at any card width the gap gives way before the cells do: 16 at the
 * design widths (3 × 96 and 4 × 68 in a 320 column), otherwise the nearest gap that makes them whole
 * (down to 4: three 44 cells in a half-section card). Where not even 4 keeps every cell a finger's 44,
 * the row wraps into two full rows (3 + 2, 2 + 2, 2 + 1 with the last cell across) rather than go under it.
 * The columns stay `minmax(0, 1fr)`; the card hands the gap to CSS (`--dv-action-gap`) and the columns to
 * `actions()`.
 */
const GAPS = [16, 12, 20, 24, 8, 4] as const;

/** Rows of equal cells laid out: the gap between them, and how many cells each row takes. */
export interface Cells {
  readonly gap: number;
  /** A row's columns: its count, or fewer where its count would leave a cell under 44 (it wraps into full rows). */
  readonly columns: readonly number[];
}

export function actionGap(
  contentWidth: number,
  count: number,
): { readonly gap: number; readonly columns: number } {
  const { gap, columns } = sharedGap(contentWidth, [count]);
  return { gap, columns: columns[0] ?? count };
}

/**
 * One gap for rows of equal cells that stand one over another (a printer's trays over its buttons): the first of
 * `gaps` that lands every row's cells on whole 4 px and keeps them touchable; else the one nearest 16, within `gaps`'
 * range, that lands them on whole pixels; else the design's 16 where it keeps them touchable, else the narrowest of
 * `gaps` (which does). A row whose cells stay under 44 even at the narrowest gap wraps, half its cells a row, and the
 * rows are laid out again.
 */
export function sharedGap(
  contentWidth: number,
  counts: readonly number[],
  gaps: readonly number[] = GAPS,
): Cells {
  const cell = (gap: number, count: number): number => (contentWidth - gap * (count - 1)) / count;
  for (const gap of gaps)
    if (counts.every((n) => cell(gap, n) >= 44 && cell(gap, n) % 4 === 0))
      return { gap, columns: counts };
  // no gap of the grid lands them on the 4 grid (an odd wide column): the nearest to 16 that lands them on whole pixels
  const low = Math.min(...gaps);
  const high = Math.max(...gaps);
  for (let step = 0; step <= 12; step++)
    for (const gap of [16 - step, 16 + step])
      if (
        gap >= low &&
        gap <= high &&
        counts.every((n) => cell(gap, n) >= 44 && Number.isInteger(cell(gap, n)))
      )
        return { gap, columns: counts };
  // not one gap keeps a row's cells a finger's: it takes two rows (or more, in a column under two cells)
  const wrapped = counts.map((n) => (cell(low, n) < 44 ? Math.ceil(n / 2) : n));
  if (wrapped.some((n, index) => n !== counts[index]))
    return sharedGap(contentWidth, wrapped, gaps);
  // a finger's, but on whole pixels at no gap of the range: the design's 16 where it keeps them so (a caller with a
  // range of its own reads it as "none of mine": the printer then tries its narrow one), else the narrowest
  return { gap: counts.every((n) => cell(16, n) >= 44) ? 16 : low, columns: counts };
}

/**
 * How many 44 cells a column holds with 4 between them: a compact card keeps the commands that fit, and none
 * where not one fits (its head alone).
 */
export const actionsThatFit = (contentWidth: number): number =>
  Math.max(0, Math.floor((contentWidth + 4) / 48));

/** The CSS the three cards add on top of the sheet: the fluid action row and its unavailable skin. Tokens only. */
export const motionStyles = css`
  /* equal cells that fill the column, in two rows where one would go under 44; the card hands over the gap that keeps
     them on the 4 px grid (actionGap), between the rows too */
  .fv-actions {
    gap: var(--dv-action-gap, 16px);
  }

  /* unavailable: cells and chips would vanish into the card's page fill, so they wear the dashed outline the card, the icon ring and the badge wear */
  .is-off .fv-action,
  .is-off .fv-chip__pill {
    background: transparent;
    outline: 1px dashed var(--fluvy-unavailable-border);
    outline-offset: -1px;
    color: var(--fluvy-unavailable);
  }
  .is-off .fv-action:disabled {
    opacity: 1;
  }
`;
