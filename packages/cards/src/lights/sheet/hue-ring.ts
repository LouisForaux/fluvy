import { baseStyles, glyph, keyValue, localPoint, trackDrag } from '@fluvy/ui';
import { LitElement, css, html, nothing, svg, type TemplateResult } from 'lit';

/** The ring's box where the column holds it (the dial's: its ticks on R 84), and the least it draws at. */
export const BOX = 216;
const LEAST = 160;
/** What the box keeps outside the ring on each side: the longer ticks and the knob's halo past them. */
const MARGIN = 24;
const KNOB = 36;
/** A tick every 5°, a longer one every 30°; those the knob's halo would bite are left out (whole or absent). */
const STEP = 5;
const MAJOR = 30;
const HALO = KNOB / 2 + 7;
/** The colour in the middle: the hero circle. */
const HERO = 64;

export interface HueRingChangeDetail {
  readonly value: number;
}

/** The ring's box for a column of `room`: the whole 216 where it holds it, else the column on the 4 grid, 160 at the least. */
export const ringSize = (room: number): number =>
  Math.max(LEAST, Math.min(BOX, Math.floor(room / 4) * 4));

/** The radius the ticks stand on in a box of `size`: 84 at 216, down with the column. */
const ringRadius = (size: number): number => size / 2 - MARGIN;

const rad = (deg: number): number => (deg * Math.PI) / 180;
/** A point at `deg`, `r` from the middle of a box of `size`: red at three o'clock, the hues clockwise, as the picker round's conic. */
const at = (size: number, deg: number, r: number): readonly [number, number] => [
  size / 2 + r * Math.cos(rad(deg)),
  size / 2 + r * Math.sin(rad(deg)),
];

/** The hue (0–359) a point of a box of `size` stands at, from its middle. */
export function hueAt(x: number, y: number, size = BOX): number {
  const deg = (Math.atan2(y - size / 2, x - size / 2) * 180) / Math.PI;
  return Math.round(deg + 360) % 360;
}

/**
 * The hue wheel (#137): the dial's geometry bent round the hue circle — a tick every 5° in its own hue, the knob
 * riding the ring on the hue the room glows, its dot that hue, and the room's colour in the middle. A drag or a tap
 * on the ring takes the knob to the finger (`fluvy-input` as it moves, `fluvy-change` on release); the keyboard
 * walks the hues (the slider's keys, round the ring). It sets the hue as the hue ruler does, never a pastel.
 */
export class FluvyHueRing extends LitElement {
  static override styles = [
    ...baseStyles,
    css`
      :host {
        display: block;
      }
      .hr {
        position: relative;
        margin: 0 auto;
        touch-action: none;
      }
      .hr svg {
        display: block;
        overflow: visible;
      }
      .hr line {
        stroke-width: 2;
        stroke-linecap: round;
        opacity: 0.85;
      }
      .hr__disc {
        fill: var(--fluvy-inset, var(--fluvy-page));
      }
      .hr .fv-knob {
        top: 0;
        left: 0;
        cursor: grab;
      }
      .hr.is-dragging .fv-knob {
        cursor: grabbing;
      }
      .hr__colour {
        position: absolute;
        pointer-events: none;
      }
    `,
  ];

  static override properties = {
    value: { type: Number },
    size: { type: Number },
    color: { type: String },
    ink: { type: String },
    label: { type: String },
    disabled: { type: Boolean },
    inactive: { type: Boolean },
    format: { attribute: false },
    dragging: { state: true },
  };

  /** The hue, 0–360. */
  declare value: number;
  /** The box, on the 4 grid (`ringSize`). */
  declare size: number;
  /** The colour in the middle (`#rrggbb`), and the ink its glyph takes; none: the neutral circle. */
  declare color: string;
  declare ink: string;
  /** What a reader calls the knob ("Living room · Colour"). */
  declare label: string;
  declare disabled: boolean;
  /** The room is off: no knob until the finger moves it. */
  declare inactive: boolean;
  declare format: ((value: number) => string) | undefined;
  declare dragging: boolean;

  private untrack: (() => void) | undefined;

  constructor() {
    super();
    this.value = 0;
    this.size = BOX;
    this.color = '';
    this.ink = '';
    this.label = '';
    this.disabled = false;
    this.inactive = false;
    this.dragging = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void this.updateComplete.then(() => this.track());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.untrack?.();
    this.untrack = undefined;
  }

  /** The knob follows the finger round the ring from the press on: a tap is a step, a drag a turn. */
  private track(): void {
    const ring = this.renderRoot.querySelector<HTMLElement>('.hr');
    if (!ring || this.untrack) return;
    const hueOf = (event: PointerEvent): number => {
      const { x, y } = localPoint(ring, event);
      return hueAt(x, y, this.size);
    };
    this.untrack = trackDrag(ring, {
      start: (s) => {
        if (this.disabled) return false;
        this.dragging = true;
        this.turn(hueOf(s.event), 'fluvy-input');
        return true;
      },
      move: (s) => this.turn(hueOf(s.event), 'fluvy-input'),
      end: (s) => {
        this.dragging = false;
        this.turn(hueOf(s.event), 'fluvy-change');
      },
    });
  }

  private turn(hue: number, type: 'fluvy-input' | 'fluvy-change'): void {
    this.value = ((hue % 360) + 360) % 360;
    this.dispatchEvent(
      new CustomEvent<HueRingChangeDetail>(type, {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** The slider's keys, round the ring: a step past red comes back to red from the other side. */
  private onKey(event: KeyboardEvent): void {
    if (this.disabled) return;
    const next = keyValue(event, this.value, -1, 361, 1);
    if (next === undefined) return;
    event.preventDefault();
    this.turn(next === -1 ? 359 : next === 361 ? 1 : next, 'fluvy-change');
  }

  protected override render(): TemplateResult {
    const size = this.size;
    const R = ringRadius(size);
    const active = !this.inactive || this.dragging;
    const [kx, ky] = at(size, this.value, R);
    const ticks: TemplateResult[] = [];
    for (let deg = 0; deg < 360; deg += STEP) {
      const [px, py] = at(size, deg, R);
      if (active && Math.hypot(px - kx, py - ky) < HALO) continue;
      const half = deg % MAJOR === 0 ? 10 : 5;
      const [x1, y1] = at(size, deg, R - half);
      const [x2, y2] = at(size, deg, R + half);
      ticks.push(
        svg`<line x1=${x1.toFixed(1)} y1=${y1.toFixed(1)} x2=${x2.toFixed(1)} y2=${y2.toFixed(1)} stroke="hsl(${deg} 100% 50%)" />`,
      );
    }
    const text = `${this.format ? this.format(this.value) : String(this.value)}°`;
    const middle = (size - HERO) / 2;
    return html`<div
      class="hr fv-tone--accent ${this.dragging ? 'is-dragging' : ''}"
      style="width:${size}px;height:${size}px"
      aria-disabled=${this.disabled ? 'true' : nothing}
    >
      <svg width=${size} height=${size} viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="hr__disc" cx=${size / 2} cy=${size / 2} r=${R - 18} />
        ${ticks}
      </svg>
      <span
        class="fv-ico fv-ico--hero hr__colour ${this.color ? '' : 'fv-ico--neutral'}"
        style="left:${middle}px;top:${middle}px${this.color ? `;background:${this.color};color:${this.ink}` : ''}"
        >${glyph('bulb')}</span
      >
      ${
        active
          ? html`<span
              class="fv-knob fv-knob--accent fv-knob--tinted"
              data-measure="value"
              role="slider"
              tabindex=${this.disabled ? -1 : 0}
              aria-label=${this.label || nothing}
              aria-valuemin="0"
              aria-valuemax="360"
              aria-valuenow=${this.value}
              aria-valuetext=${text}
              aria-disabled=${this.disabled ? 'true' : nothing}
              style="translate:${Math.round(kx - KNOB / 2)}px ${Math.round(ky - KNOB / 2)}px;width:${KNOB}px;height:${KNOB}px;--knob-dot:hsl(${this.value} 100% 50%)"
              @keydown=${this.onKey}
            ></span>`
          : nothing
      }
    </div>`;
  }
}

if (!customElements.get('fluvy-hue-ring')) customElements.define('fluvy-hue-ring', FluvyHueRing);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-hue-ring': FluvyHueRing;
  }
}
