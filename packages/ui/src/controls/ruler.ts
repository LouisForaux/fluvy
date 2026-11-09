import { LitElement, css, html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { baseStyles } from '../styles/index.js';
import {
  clamp,
  keyValue,
  precisionGain,
  preventMenu,
  saneRange,
  snap,
  stepOf,
  trackDrag,
} from './pointer.js';
import { MotionMark, Pending, spring, type SpringHandle } from '../motion.js';
import { haptic } from '../haptics.js';

export interface RulerChangeDetail {
  readonly value: number;
}

/** The range the scale currently shows: the full range, or a tenth of it while the fine scale is up. */
export interface RulerWindowDetail {
  readonly min: number;
  readonly max: number;
  readonly fine: boolean;
  /** Major ticks of the fine scale as [fraction of the ruler, value]: what a card should label. Empty on the full scale. */
  readonly marks: ReadonlyArray<readonly [number, number]>;
}

const HOLD_MS = 450;
/** A still press on a tile's fill is the tile's hold (the press cover's 500 ms), never the fine scale. */
const FILL_HOLD_MS = 500;

/**
 * The styles a slider is drawn in (1.18, #144): the ruler (ticks and knob, the fine scale on a hold), the bar, the
 * liquid, or a tile's fill — the last three drawn by `controls/slider-styles.ts`, fetched by the first ruler asked
 * for one; they keep the relative drag, the slowing away from the axis, the bubble and the keys, and give up the
 * fine scale (a bar cannot zoom without lying about the level).
 */
export type SliderLook = 'ruler' | 'bar' | 'liquid' | 'fill';

let styles: typeof import('./slider-styles.js') | undefined;
let fetchingStyles: Promise<void> | undefined;
/** Whether the fetch is over, landed or failed: a ruler never waits on one that cannot land, and draws the ruler then. */
let stylesSettled = false;

/** Fetches the styles once (a house of bars asks before its rulers draw); one that cannot be fetched leaves the rulers rulers. */
export function fetchSliderStyles(): Promise<void> {
  fetchingStyles ??= import('./slider-styles.js')
    .then(
      (module) => {
        styles = module;
      },
      () => undefined,
    )
    .finally(() => {
      stylesSettled = true;
    });
  return fetchingStyles;
}

/** The hue circle along the axis: a stop every 60°, red to red, each the full-saturation hue itself (no token has it). */
const HUE_STOPS = [0, 1, 2, 3, 4, 5, 6].map(
  (k) => svg`<stop offset=${k / 6} stop-color="hsl(${k * 60} 100% 50%)" />`,
);

/**
 * The fluvy ruler: a linear scale of ticks with the one knob riding it. Ticks are placed by VALUE on
 * whole CSS pixels (crisp at every DPR), lit from the origin up to the knob, and the ticks the knob's
 * halo would bite are omitted, never clipped.
 *
 * Interaction is built for an exact value, not a rough one: the drag is relative (grabbing never
 * jumps), drifting the finger away from the axis slows the drag down to 10×, ticks rise around the
 * knob while it moves, a bubble carries the value, and the keyboard covers step / 10 % / ends.
 *
 * Holding still for 450 ms raises the FINE scale: the ruler zooms to a tenth of its range around the
 * value (1 % ticks on a 0–100 scale), so 97 is as easy to hit as 50. Releasing returns to the full scale.
 *
 * Drawn in another style (`look`, 1.18: a bar, a liquid, a tile's fill), the same band keeps every gesture but the
 * fine scale; a tile's fill covers its tile, so a still press on it is the tile's tap (`fluvy-tap`) or hold
 * (`fluvy-hold`), never a jump to the value.
 *
 * Events: `fluvy-input` while dragging (preview), `fluvy-change` on release, key or tap,
 * `fluvy-window` when the fine scale comes up or goes away (so a card can relabel its axis).
 */
export class FluvyRuler extends LitElement {
  static override styles = [
    ...baseStyles,
    css`
      :host {
        display: block;
        position: relative;
        direction: ltr;
      }
      .fv-ruler {
        outline: none;
      }
      .fv-knob {
        left: 0;
        top: 0;
      }
      .fv-bubble {
        top: auto;
        bottom: calc(100% - 2px);
      }
    `,
  ];

  static override properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    origin: { type: Number },
    tone: { type: String },
    tint: { type: String },
    length: { type: Number },
    band: { type: Number },
    knob: { type: Number },
    minor: { type: Number },
    major: { type: Number },
    vertical: { type: Boolean },
    marker: { type: Boolean },
    readonly: { type: Boolean },
    inactive: { type: Boolean },
    wake: { type: Boolean },
    disabled: { type: Boolean },
    unit: { type: String },
    label: { type: String },
    format: { attribute: false },
    look: { type: String, reflect: true },
    still: { type: Boolean, reflect: true },
    dragging: { state: true },
    shown: { state: true },
    lift: { state: true },
    fine: { state: true },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  /**
   * The value the lit ticks start from: a signed range's zero (an offset of −2…+2 lit from 0 to the knob, either way);
   * NaN, the default, lights from the range's start (left, or bottom), as every ruler does.
   */
  declare origin: number;
  declare tone: string;
  /**
   * The ticks take a gradient along the axis instead of lighting up to the knob, and the knob's dot the colour under
   * it: 'warm-cool' a faint warm → cool one (colour temperature), 'hue' the whole hue circle (a colour's hue, 0–360).
   */
  declare tint: string;
  /** Length of the scale in CSS px (the card passes its measured content width). */
  declare length: number;
  /** Thickness of the hit band: 44 everywhere. */
  declare band: number;
  declare knob: number;
  /** Tick spacing as fractions of the range. */
  declare minor: number;
  declare major: number;
  declare vertical: boolean;
  /** Read-only gauge: a ring marker, no lift, no interaction. */
  declare marker: boolean;
  /** Read-only, its knob whole (the thermostat's ball, lifted on its halo): a chart's ruler gauge. */
  declare readonly: boolean;
  /** No knob and no lit ticks (the device is off). */
  declare inactive: boolean;
  /** An inactive ruler that still answers: dragging or tapping it wakes the device at that value. */
  declare wake: boolean;
  declare disabled: boolean;
  declare unit: string;
  declare label: string;
  declare format: ((value: number) => string) | undefined;
  /** The style it is drawn in (1.18): the ruler, or one of `slider-styles.ts` once fetched (the ruler until then, or for good where the fetch failed). */
  declare look: SliderLook;
  /** A liquid rests on its first frame: the house's motion is off (the charts' `animate`). */
  declare still: boolean;
  declare dragging: boolean;
  /** The fraction currently drawn; follows `value` on a spring, follows the finger while dragging. */
  declare shown: number;
  /** 0..1: how far the ticks around the knob have risen. */
  declare lift: number;
  /** The fine window [lo, hi] while it is up. */
  declare fine: readonly [number, number] | null;

  private follow: SpringHandle | undefined;
  private rise: SpringHandle | undefined;
  private release: (() => void) | undefined;
  /** Continuous position of the drag, 0..1 of the scale currently shown. */
  private cursor = 0;
  private lastAlong = 0;
  private holdTimer = 0;
  private lastPreview = Number.NaN;
  private readonly pending = new Pending(() => {
    this.follow?.set(this.fraction(this.value));
  });

  constructor() {
    super();
    // the person's reduced motion reaches inside this control's own shadow root
    new MotionMark(this);
    this.value = 0;
    this.min = 0;
    this.max = 100;
    this.step = 1;
    this.origin = Number.NaN;
    this.tone = 'accent';
    this.tint = '';
    this.length = 320;
    this.band = 44;
    this.knob = 36;
    this.minor = 0.05;
    this.major = 0.25;
    this.vertical = false;
    this.marker = false;
    this.readonly = false;
    this.inactive = false;
    this.wake = false;
    this.disabled = false;
    this.unit = '';
    this.label = '';
    this.look = 'ruler';
    this.still = false;
    this.dragging = false;
    this.shown = 0;
    this.lift = 0;
    this.fine = null;
  }

  /* The range the card asked for, made safe: NaN falls back to 0–100, a reversed pair is swapped. */
  private get range(): readonly [number, number] {
    return saneRange(this.min, this.max);
  }
  private get rangeMin(): number {
    return this.range[0];
  }
  private get rangeMax(): number {
    return this.range[1];
  }
  /** The step, or a hundredth of the range when the card passed none (0, NaN, negative). */
  private get inc(): number {
    return stepOf(this.step, this.rangeMin, this.rangeMax);
  }
  private get lo(): number {
    return this.fine ? this.fine[0] : this.rangeMin;
  }
  private get hi(): number {
    return this.fine ? this.fine[1] : this.rangeMax;
  }

  private get interactive(): boolean {
    return !this.marker && !this.readonly && !this.disabled && (!this.inactive || this.wake);
  }

  /** The style drawn: the one asked for once its module has landed; the ruler until then, or where it never does. */
  private get drawn(): SliderLook {
    return styles && this.look !== 'ruler' ? this.look : 'ruler';
  }

  /** A tile's fill: the band is the tile, and a still press on it is the tile's. */
  private get fill(): boolean {
    return this.look === 'fill';
  }

  /** The colour under the knob at `f` (0..1) of a tinted ruler: the hue there, or the warm → cool mix there. */
  private dotAt(f: number): string {
    return this.tint === 'hue'
      ? `hsl(${Math.round(f * 360)} 100% 50%)`
      : `color-mix(in oklab, var(--fluvy-tint-warm, #d1a24c) ${Math.round((1 - f) * 100)}%, var(--fluvy-tint-cool, #a9bdd0))`;
  }

  /** 0..1 along the scale currently shown; an empty range or a non-finite value sits at the origin. */
  private fraction(value: number): number {
    return this.hi > this.lo && Number.isFinite(value)
      ? clamp((value - this.lo) / (this.hi - this.lo), 0, 1)
      : 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.shown = this.fraction(this.value);
    this.follow = spring(
      this.shown,
      (v) => {
        this.shown = v;
      },
      { stiffness: 320, damping: 0.9 },
    );
    this.rise = spring(
      0,
      (v) => {
        this.lift = v;
      },
      { stiffness: 260, damping: 1 },
    );
    // Home Assistant moves cards in the DOM (edit mode, reordering): the drag is re-armed on every connect.
    if (this.hasUpdated) this.bind();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.follow?.stop();
    this.rise?.stop();
    this.release?.();
    this.pending.clear();
    clearTimeout(this.holdTimer);
    this.follow = this.rise = this.release = undefined;
    this.dragging = false;
    this.lift = 0;
    if (this.fine) this.dropFine();
  }

  protected override firstUpdated(): void {
    this.bind();
  }

  /**
   * A style besides the ruler's is drawn from its module: the first frame waits for the fetch (never a ruler a moment
   * before the bar), and no frame waits once it is over, landed or failed.
   */
  protected override scheduleUpdate(): void | Promise<unknown> {
    if (this.look !== 'ruler' && !stylesSettled)
      return fetchSliderStyles().then(() => this.scheduleUpdate());
    return super.scheduleUpdate();
  }

  /** Whether a still press was the tile's hold: its release is then nothing, never the tap as well. */
  private held = false;

  private bind(): void {
    this.release?.();
    this.release = undefined;
    const el = this.renderRoot.querySelector<HTMLElement>('.fv-ruler');
    if (!el) return;
    this.release = trackDrag(el, {
      start: () => {
        // a tile's fill takes every press, the slide being only the interactive one's: the rest is the tile's
        if (!this.interactive && !this.fill) return false;
        // Start from what the user SEES (the optimistic value), not from the last state Home Assistant
        // confirmed: a slow lamp may still report the old brightness when the next drag begins.
        this.cursor = this.shown;
        this.lastAlong = 0;
        this.held = false;
        this.follow?.stop();
        // The fine scale is a deliberate press-and-hold BEFORE moving. It never arms mid-drag:
        // a pause while sliding must not change the scale under the finger. Only the ruler has one; a still press
        // on a tile's fill is the tile's hold.
        clearTimeout(this.holdTimer);
        if (this.fill) this.holdTimer = window.setTimeout(() => this.holdTile(), FILL_HOLD_MS);
        else if (this.look === 'ruler')
          this.holdTimer = window.setTimeout(() => this.raiseFine(), HOLD_MS);
        return true;
      },
      move: (s) => {
        clearTimeout(this.holdTimer);
        if (!this.interactive) return;
        if (!this.dragging) {
          this.dragging = true;
          this.rise?.set(1);
        }
        const along = this.vertical ? -s.dy : s.dx;
        const across = this.vertical ? s.dx : s.dy;
        // Integrate step by step: the precision gain applies to THIS movement only. Scaling the whole
        // displacement by the current gain would make the value leap whenever the finger drifts
        // towards or away from the axis — which a thumb always does.
        // the stops are the real range: inside a fine window they may sit short of the ruler's ends
        this.cursor = clamp(
          this.cursor + ((along - this.lastAlong) * precisionGain(across)) / this.len,
          this.fraction(this.rangeMin),
          this.fraction(this.rangeMax),
        );
        this.lastAlong = along;
        this.preview(this.cursor);
      },
      end: (s, moved) => {
        clearTimeout(this.holdTimer);
        const wasFine = this.fine !== null;
        if (moved || wasFine) {
          if (!this.interactive) return;
          const value = this.valueAt(this.cursor);
          this.dragging = false;
          this.rise?.set(0);
          if (wasFine) this.dropFine();
          this.commit(value);
          return;
        }
        // a still press on a tile's fill is the tile's: its tap, unless its hold already ran
        if (this.fill) {
          if (!this.held) this.say('fluvy-tap');
          return;
        }
        // a tap on the scale: go there, on the spring
        const rect = el.getBoundingClientRect();
        const extent = this.vertical ? rect.height : rect.width;
        if (!(extent > 0)) return;
        const f = this.vertical ? 1 - (s.y - rect.top) / extent : (s.x - rect.left) / extent;
        this.commit(this.valueAt(clamp(f, 0, 1)));
      },
    });
  }

  /** A still press of 500 ms on a tile's fill: the tile's hold, said once; the release that follows is nothing. */
  private holdTile(): void {
    this.held = true;
    this.say('fluvy-hold');
  }

  /** The tile's tap or hold, for the tile the fill covers to run (the press cover under it never sees a pointer). */
  private say(event: 'fluvy-tap' | 'fluvy-hold'): void {
    this.dispatchEvent(new CustomEvent(event, { bubbles: true, composed: true }));
  }

  protected override willUpdate(changed: PropertyValues): void {
    // drawn in a style, the ruler wears the styles' sheet beside its own (once, as the module has landed)
    const root = this.renderRoot;
    if (
      styles &&
      this.drawn !== 'ruler' &&
      root instanceof ShadowRoot &&
      !root.adoptedStyleSheets.includes(styles.sliderStylesSheet)
    )
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, styles.sliderStylesSheet];
    if ((changed.has('value') || changed.has('min') || changed.has('max')) && !this.dragging) {
      const target = this.fraction(this.pending.resolve(this.value, this.inc / 2));
      if (changed.get('value') === undefined || !this.follow) {
        this.shown = target;
        this.follow?.jump(target);
      } else this.follow.set(target);
    }
  }

  /** The real value at a fraction of the scale shown, on the step grid and inside the real range. */
  private valueAt(fraction: number): number {
    return snap(this.lo + fraction * (this.hi - this.lo), this.rangeMin, this.rangeMax, this.step);
  }

  /** Scale length in whole CSS px; a card that passed nothing usable gets the design width. */
  private get len(): number {
    return Number.isFinite(this.length) && this.length > 0
      ? Math.max(40, Math.round(this.length))
      : 320;
  }

  /**
   * Zooms the scale to a tenth of the range, ANCHORED on the knob: the window is placed so the current
   * value stays exactly where the knob already is (value 97 at 70 % of the ruler → the scale reads
   * 90…100). Nothing moves under the finger; only the ticks and labels change.
   */
  private raiseFine(): void {
    if (this.fine || !this.interactive || this.look !== 'ruler') return;
    const width = (this.rangeMax - this.rangeMin) / 10;
    if (!(width > this.inc)) return; // nothing finer to show (min = max, or the step already spans a tenth)
    const value = this.valueAt(this.cursor);
    const lo = value - this.cursor * width;
    this.fine = [lo, lo + width];
    this.dragging = true;
    this.rise?.set(1);
    this.buzz('medium');
    this.dispatchEvent(
      new CustomEvent<RulerWindowDetail>('fluvy-window', {
        detail: {
          min: Math.max(this.rangeMin, lo),
          max: Math.min(this.rangeMax, lo + width),
          fine: true,
          marks: this.fineGrid()
            .filter(([, , major]) => major)
            .map(([f, v]) => [f, v] as const),
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Ticks of the fine window on the ABSOLUTE value grid: [fraction, value, major]. The grid unit is a tenth
   * of the window, raised to the nearest multiple of the step so every tick is a value the ruler can
   * actually settle on (0–100 step 1 → 1 % ticks, 5–35 step 0.5 → 0.5 ° ticks); majors every second tick.
   * Values outside the real range are never drawn: the window may overhang the ends of the scale.
   */
  private fineGrid(): Array<readonly [number, number, boolean]> {
    if (!this.fine) return [];
    const [lo, hi] = this.fine;
    const tenth = (hi - lo) / 10;
    const step = this.step > 0 ? this.step : 0;
    const unit = step > 0 ? Math.max(step, Math.ceil(tenth / step - 1e-9) * step) : tenth;
    if (!(unit > 0)) return [];
    const out: Array<readonly [number, number, boolean]> = [];
    const first = Math.ceil(Math.max(lo, this.rangeMin) / unit - 1e-9);
    const last = Math.floor(Math.min(hi, this.rangeMax) / unit + 1e-9);
    for (let k = first; k <= last && out.length < 64; k++) {
      const value = Number((k * unit).toFixed(6));
      out.push([(value - lo) / (hi - lo), value, k % 2 === 0]);
    }
    return out;
  }

  /** Back to the full scale: the knob keeps its pixel position and then glides to where the value lives. */
  private dropFine(): void {
    const visual = this.shown;
    this.fine = null;
    this.shown = visual;
    this.follow?.jump(visual);
    this.dispatchEvent(
      new CustomEvent<RulerWindowDetail>('fluvy-window', {
        detail: { min: this.rangeMin, max: this.rangeMax, fine: false, marks: [] },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private buzz(kind: 'selection' | 'medium'): void {
    haptic(this, kind);
  }

  /** The knob glides with the finger; the VALUE snaps to the step. */
  private preview(fraction: number): void {
    const value = this.valueAt(fraction);
    // inside a fine window the ends of the real range may fall inside the ruler: the knob stops there
    this.shown = clamp(fraction, this.fraction(this.rangeMin), this.fraction(this.rangeMax));
    if (value === this.lastPreview) return;
    this.lastPreview = value;
    this.buzz('selection');
    this.dispatchEvent(
      new CustomEvent<RulerChangeDetail>('fluvy-input', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private commit(value: number): void {
    this.lastPreview = Number.NaN;
    this.pending.hold(value);
    this.follow?.jump(this.shown);
    this.follow?.set(this.fraction(value));
    this.dispatchEvent(
      new CustomEvent<RulerChangeDetail>('fluvy-change', {
        detail: { value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** The value the user is at: the one just committed while it is pending, otherwise the property. */
  private get settled(): number {
    const held = this.pending.held;
    if (held !== null) return held;
    return Number.isFinite(this.value)
      ? clamp(this.value, this.rangeMin, this.rangeMax)
      : this.rangeMin;
  }

  private onKey = (event: KeyboardEvent): void => {
    if (!this.interactive) return;
    const [min, max] = this.range;
    // keys count from the committed value, never from the knob mid-glide: five quick presses are five steps
    const next = keyValue(event, snap(this.settled, min, max, this.step), min, max, this.inc);
    if (next === undefined) return;
    event.preventDefault();
    if (this.fine) this.dropFine();
    this.commit(snap(next, min, max, this.step));
  };

  private text(value: number): string {
    if (!Number.isFinite(value)) return '—';
    return this.format ? this.format(value) : String(value);
  }

  /**
   * The scale in a style besides the ruler's (`slider-styles.ts`): the band's size, the level as shown, the state;
   * a tinted one's gradient and the colour under its level.
   */
  private drawStyle(
    look: Exclude<SliderLook, 'ruler'>,
    len: number,
    band: number,
    active: boolean,
  ) {
    const fraction = Number.isFinite(this.shown) ? clamp(this.shown, 0, 1) : 0;
    const drawing = {
      len,
      band,
      vertical: this.vertical,
      fraction,
      tint: this.tint,
      dot: this.tint ? this.dotAt(fraction) : '',
      inactive: !active,
      disabled: this.disabled,
      dragging: this.dragging,
    };
    const draw = styles!;
    return look === 'bar'
      ? draw.drawBar(drawing)
      : look === 'liquid'
        ? draw.drawLiquid(drawing)
        : draw.drawFill(drawing);
  }

  protected override render(): TemplateResult {
    const len = this.len;
    const band = Number.isFinite(this.band) && this.band > 0 ? this.band : 44;
    const size = Number.isFinite(this.knob) && this.knob > 0 ? this.knob : 36;
    const w = this.vertical ? band : len;
    const h = this.vertical ? len : band;
    const active = !this.inactive || this.dragging; // a sleeping ruler shows its knob once the finger moves it
    const pos = (Number.isFinite(this.shown) ? clamp(this.shown, 0, 1) : 0) * len;
    const drawn = this.drawn;
    // At the ends the knob would hang half its width outside the content column. It stops with a 4 px
    // overhang instead — the optical overshoot a circle needs to look flush with the text above it.
    const inset = Math.max(0, size / 2 - 4);
    const centre = clamp(pos, inset, len - inset);
    const haloR = size / 2 + 7; // ring + 4 px halo + half a stroke
    const lines: TemplateResult[] = [];
    // Full scale: ticks by fraction. Fine scale: ticks on the ABSOLUTE value grid (whole percents),
    // so they keep meaning real values even though the window is anchored wherever the knob was.
    const marks: Array<readonly [fraction: number, major: boolean]> = [];
    if (this.fine) {
      for (const [f, , isMajor] of this.fineGrid()) marks.push([f, isMajor]);
    } else {
      const minor = this.minor > 0 && this.minor <= 1 ? this.minor : 0.05;
      const major = this.major > 0 && this.major <= 1 ? this.major : 0.25;
      const steps = Math.min(Math.max(1, Math.round(1 / minor)), Math.max(1, Math.floor(len / 4))); // never denser than one tick per 4 px
      for (let i = 0; i <= steps; i++) {
        const f = i / steps;
        marks.push([f, Math.abs(f / major - Math.round(f / major)) < 1e-6]);
      }
    }
    // lit from the origin to the knob, whichever side of it the knob stands (a signed range's zero), else from the start
    const from = Number.isFinite(this.origin) ? this.fraction(this.origin) * len : 0;
    const [litLo, litHi] = [Math.min(from, pos), Math.max(from, pos)];
    for (const [f, isMajor] of marks) {
      const p = Math.round(f * len);
      if (active && Math.abs(p - centre) < haloR) continue; // whole or absent, never bitten by the halo (measured from where the knob is drawn)
      let tick = isMajor ? 20 : 10;
      if (this.lift > 0.001) tick += 10 * this.lift * Math.exp(-((p - pos) ** 2) / (2 * 22 * 22));
      const on = active && p >= litLo - 0.5 && p <= litHi + 0.5;
      if (this.vertical) {
        const y = len - p;
        const x1 = w / 2 - tick / 2;
        lines.push(
          svg`<line x1=${x1.toFixed(2)} y1=${y} x2=${(x1 + tick).toFixed(2)} y2=${y} class=${this.tint ? 'tk-tint' : on ? 'tk-on' : 'tk-off'} stroke=${this.tint ? 'url(#fv-tint)' : nothing} />`,
        );
      } else {
        const y1 = h / 2 - tick / 2;
        lines.push(
          svg`<line x1=${p} y1=${y1.toFixed(2)} x2=${p} y2=${(y1 + tick).toFixed(2)} class=${this.tint ? 'tk-tint' : on ? 'tk-on' : 'tk-off'} stroke=${this.tint ? 'url(#fv-tint)' : nothing} />`,
        );
      }
    }
    const kx = this.vertical ? w / 2 - size / 2 : centre - size / 2;
    const ky = this.vertical ? len - centre - size / 2 : (h - size) / 2;
    // at rest the knob sits on whole pixels (a crisp 2 px ring); in flight it may sit between them
    const settle = (n: number): number => (this.dragging ? n : Math.round(n));
    const current = this.valueAt(this.shown);
    const bubbleW = 72;
    const bubbleLeft = clamp(pos - bubbleW / 2, 0, Math.max(0, len - bubbleW));
    const classes = `fv-ruler fv-ruler--${this.tone}${this.vertical ? ' fv-ruler--vertical' : ''}${this.dragging ? ' is-dragging' : ''}`;
    const valueText = `${this.text(current)}${this.unit ? ` ${this.unit}` : ''}`;
    const [min, max] = this.range;
    // A read-only ruler (marker, readonly, disabled, inactive without wake) is an image whose name carries the value.
    // A tile's fill reads its level on the tile's line: no bubble over it.
    return html`<div
      class=${classes}
      style="width:${w}px;height:${h}px"
      data-control
      data-target
      ?data-interactive=${this.interactive}
      role=${this.interactive ? 'slider' : 'img'}
      tabindex=${this.interactive ? 0 : -1}
      aria-label=${this.interactive ? this.label || nothing : this.label ? `${this.label} · ${valueText}` : valueText}
      aria-orientation=${this.interactive ? (this.vertical ? 'vertical' : 'horizontal') : nothing}
      aria-valuemin=${this.interactive ? min : nothing}
      aria-valuemax=${this.interactive ? max : nothing}
      aria-valuenow=${this.interactive ? current : nothing}
      aria-valuetext=${this.interactive ? valueText : nothing}
      aria-disabled=${this.disabled ? 'true' : nothing}
      @keydown=${this.onKey}
      @contextmenu=${this.fill ? preventMenu : nothing}
    >
      ${
        drawn !== 'ruler'
          ? this.drawStyle(drawn, len, band, active)
          : html`<svg width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true">
                ${this.tint ? svg`<defs><linearGradient id="fv-tint" gradientUnits="userSpaceOnUse" x1="0" y1=${this.vertical ? len : 0} x2=${this.vertical ? 0 : len} y2="0">${this.tint === 'hue' ? HUE_STOPS : svg`<stop offset="0" class="tint-a" /><stop offset="1" class="tint-b" />`}</linearGradient></defs>` : nothing}${lines}
              </svg>
              ${active ? html`<span class="fv-knob fv-knob--${this.tone}${this.marker ? ' fv-knob--marker' : ''}${this.tint ? ' fv-knob--tinted' : ''}" data-measure="value" style="translate:${settle(kx)}px ${settle(ky)}px;width:${size}px;height:${size}px${this.tint ? `;--knob-dot:${this.dotAt(pos / Math.max(1, len))}` : ''}"></span>` : nothing}`
      }
      ${this.interactive && !this.vertical && drawn !== 'fill' ? html`<span class="fv-bubble" data-measure="value" style="left:${bubbleLeft.toFixed(1)}px;width:${bubbleW}px;--tail:${Math.round(pos - bubbleLeft - 6)}px"><b>${this.text(current)}</b>${this.unit}</span>` : nothing}
    </div>`;
  }
}
