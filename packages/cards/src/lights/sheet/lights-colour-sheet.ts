import {
  formatNumber,
  localize,
  plural,
  type EntityView,
  type HomeAssistant,
  type SliderStyle,
} from '@fluvy/core';
import { baseStyles, toggle, type Tone } from '@fluvy/ui';
import {
  LitElement,
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import {
  colourControls,
  hsToRgb,
  hueOf,
  inkOn,
  kelvinRgb,
  near,
  styles as swatchStyles,
  type BulbState,
  type HeldColour,
  type Shown,
  type SwatchEntry,
} from '../../light/colour.js';
import { clamp255, tripletOf, type Rgb } from '../../light/swatches.js';
import { COLOURED, hexOf } from '../../shared/light.js';
import { FontsSettled } from '../../shared/fonts.js';
import { LaidWidth } from '../../shared/laid.js';
import { ringSize, type HueRingChangeDetail } from './hue-ring.js';

/** A light of the room as the sheet reads it. */
export interface SheetLamp {
  readonly view: EntityView;
  readonly name: string;
  readonly usable: boolean;
  readonly on: boolean;
  /** It takes a colour (`hs`, `rgb`, `rgbw`, `rgbww` or `xy`). */
  readonly colours: boolean;
}

/** What the sheet asks of the card that opened it. */
export interface LightsColourHost {
  /** The room's name, and the card's line under it fitted to a head that wide ("2 of 3 on · 63 %", "2/3 on"). */
  title(): string;
  line(width: number): string;
  /** The tone the room's switch is drawn in while a light is on. */
  tone(): Tone;
  lamps(): readonly SheetLamp[];
  /** The room's switch: every light off when one is on, else every light on. */
  flip(): void;
  /** The quick colours as the card lists them (none: the room's six), and the control the sheet draws. */
  colors(): readonly SwatchEntry[] | undefined;
  control(): 'ruler' | 'wheel';
  /** The style the card's sliders are drawn in, whether a liquid rests, and the words under one in that style. */
  look(): SliderStyle;
  still(): boolean;
  words<T>(items: readonly T[]): readonly T[];
  /** What the finger chose, sent to every light of the room that can be read (`light.turn_on`). */
  pick(data: Record<string, unknown>): void;
  /** The card's colours, adopted into the sheet's own root. */
  adopt(root: ShadowRoot): void;
}

/** The room's bulbs as the controls draw them together, and the whites they take. */
export interface RoomBulb extends BulbState {
  readonly minK: number;
  readonly maxK: number;
}

const mode = (view: EntityView): string => view.attr<string | null>('color_mode') ?? '';
const isNumber = (value: unknown): value is number => typeof value === 'number';

/** The mean of what `pick` reads off each bulb that has it, each weighed by its brightness; nothing where none has. */
function meanOf(
  views: readonly EntityView[],
  pick: (view: EntityView) => readonly number[] | undefined,
): number[] | undefined {
  const sum: number[] = [];
  let weight = 0;
  for (const view of views) {
    const values = pick(view);
    if (!values) continue;
    const share = view.attr<number>('brightness') || 255;
    values.forEach((value, i) => {
      sum[i] = (sum[i] ?? 0) + value * share;
    });
    weight += share;
  }
  return weight ? sum.map((value) => value / weight) : undefined;
}

/**
 * The room as one bulb: what it shows is the finger's choice while held, else the lit colour bulbs' mean colour by
 * their brightness (a white among them adds nothing: a red lamp and a white one glow red), else the lit whites' mean
 * temperature; the hue the ruler stands on is that colour's, the saturation the colour bulbs' mean (the full one
 * where they report none); its modes are every readable bulb's together, its whites the warmest and the coolest any
 * takes (2000–6500 K where none says).
 */
export function roomBulb(lamps: readonly SheetLamp[], held: HeldColour | null): RoomBulb {
  const views = lamps.filter((lamp) => lamp.usable).map((lamp) => lamp.view);
  const lit = lamps.filter((lamp) => lamp.on).map((lamp) => lamp.view);
  const warm = views
    .map((view) => view.attr<number | null>('min_color_temp_kelvin'))
    .filter(isNumber);
  const cool = views
    .map((view) => view.attr<number | null>('max_color_temp_kelvin'))
    .filter(isNumber);
  const mean = meanOf(lit, (view) =>
    COLOURED.has(mode(view)) ? tripletOf(view.attr<number[] | null>('rgb_color')) : undefined,
  );
  const rgb = mean ? (mean.map(clamp255) as unknown as Rgb) : undefined;
  const saturation = meanOf(lit, (view) =>
    COLOURED.has(mode(view))
      ? (view.attr<number[] | null>('hs_color')?.slice(1, 2) ?? undefined)
      : undefined,
  );
  const kelvin = meanOf(lit, (view) => {
    const k = view.attr<number | null>('color_temp_kelvin');
    return mode(view) === 'color_temp' && isNumber(k) ? [k] : undefined;
  });
  const reported: Shown = rgb ? { rgb } : kelvin ? { kelvin: Math.round(kelvin[0] ?? 0) } : {};
  return {
    shown: held ?? reported,
    hue: held && 'rgb' in held ? held.hue : rgb ? hueOf(rgb) : 0,
    saturation: Math.round(saturation?.[0] ?? 0) || 100,
    modes: [
      ...new Set(views.flatMap((view) => view.attr<string[]>('supported_color_modes') ?? [])),
    ],
    minK: warm.length ? Math.min(...warm) : 2000,
    maxK: cool.length ? Math.max(...cool) : 6500,
  };
}

/** Names as a list in the house's language ("Ceiling and Reading lamp"); commas where the engine has no list words. */
function namesOf(hass: HomeAssistant | undefined, names: readonly string[]): string {
  try {
    return new Intl.ListFormat(hass?.language ?? 'en', { type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

/** A tap must clear the scrim's own opening tap; how long the sheet takes to leave; how long a choice is held. */
const GUARD_MS = 350;
const LEAVE_MS = 200;
const HOLD_MS = 5000;

/**
 * What the dialog keeps to itself, sitting in a popup (Bubble Card's) that closes on a window's Escape and slides closed
 * from a touch on itself: Escape closes the sheet alone, and a touch that starts in the sheet is the sheet's.
 */
const keepEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') event.stopPropagation();
};
const keepTouch = { handleEvent: (event: Event): void => event.stopPropagation(), passive: true };

/**
 * The room's colour sheet (#137), a modal bottom sheet fetched the first time a room lights card's colour round is
 * tapped: the room's name over the card's line and its switch, then the light card's own colour controls for the
 * whole room — the hue ruler (or the hue wheel) and the quick colours — and Close. A colour chosen goes to every light
 * of the room that can be read in one call, and wakes a room that is off; the sheet says which lights take none.
 * Escape, the scrim and Close close it, the focus going back where it came from. `docked` draws it in the flow (the
 * playground).
 */
export class FluvyLightsColourSheet extends LitElement {
  static override styles: CSSResultGroup = [
    ...baseStyles,
    swatchStyles,
    css`
      :host(:not([docked])) {
        display: contents;
      }
      dialog {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        flex-direction: column;
        justify-content: flex-end;
        align-items: center;
        overflow: hidden;
        padding: 0;
        border: 0;
        background: color-mix(in srgb, var(--fluvy-neutral-05) 48%, transparent);
        color: inherit;
        touch-action: none;
        overscroll-behavior: contain;
        animation: fv-fade 240ms var(--fv-ease) both;
      }
      dialog[open] {
        display: flex;
      }
      dialog::backdrop {
        background: none;
      }
      @keyframes ls-up {
        from {
          transform: translateY(100%);
        }
        to {
          transform: none;
        }
      }
      @keyframes ls-down {
        to {
          transform: translateY(100%);
        }
      }
      @keyframes ls-out {
        to {
          opacity: 0;
        }
      }
      dialog .fv-sheet {
        max-width: 392px;
        max-height: 100%;
        overflow-y: auto;
        touch-action: pan-y;
        overscroll-behavior: contain;
        padding-bottom: max(16px, env(safe-area-inset-bottom));
        animation: ls-up 320ms var(--fv-ease-out) both;
      }
      dialog.is-leaving {
        animation: ls-out 200ms var(--fv-ease) both;
      }
      dialog.is-leaving .fv-sheet {
        animation: ls-down 200ms var(--fv-ease) both;
      }
      .fv-sheet {
        position: relative;
        width: 100%;
      }
      .fv-sheet__head > .fv-card__titles {
        flex: 1 1 auto;
        min-width: 0;
      }
      .fv-sheet__title {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      /* the wheel takes the ruler's slot: 16 under its label, as the ruler stands */
      fluvy-hue-ring {
        margin-top: 16px;
      }
      /* which lights take no colour: one line under the quick colours */
      .ls-hint {
        margin: 12px 0 0;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
      }
      .ls-actions {
        display: grid;
        margin-top: 24px;
      }
      .ls-actions .fv-btn {
        width: 100%;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    card: { attribute: false },
    docked: { type: Boolean, reflect: true },
    open_: { state: true },
    leaving_: { state: true },
  };

  declare hass?: HomeAssistant;
  declare card: LightsColourHost | undefined;
  /** Draws the sheet in the flow instead of in a modal dialog (the playground). */
  declare docked: boolean;
  declare open_: boolean;
  declare leaving_: boolean;

  /** The colour the finger chose, shown (the check, the ruler, the wheel) until the room reports it or 5 s pass. */
  private held: { choice: HeldColour; expires: number } | null = null;
  private holdTimer = 0;
  private openedBy: HTMLElement | undefined;
  private openedAt = 0;
  private leaveTimer = 0;

  constructor() {
    super();
    this.docked = false;
    this.open_ = false;
    this.leaving_ = false;
    new FontsSettled(this, () => this.requestUpdate());
    // drawn for the design's 360 before it is laid out: drawn again for the width it was given
    new LaidWidth(
      this,
      () => this.renderRoot.querySelector('.fv-sheet'),
      () => this.room,
    );
  }

  /** Opens the sheet; `openedBy` gets the focus back. */
  open(openedBy?: HTMLElement): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    this.openedBy = openedBy;
    this.leaving_ = false;
    this.open_ = true;
    this.openedAt = performance.now();
  }

  /** Leaves; safe to call at any time. */
  close(): void {
    if (!this.open_ || this.leaving_ || this.docked) return;
    this.leaving_ = true;
    this.leaveTimer = window.setTimeout(() => this.finishClose(), LEAVE_MS);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.renderRoot instanceof ShadowRoot) this.card?.adopt(this.renderRoot);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.holdTimer);
    this.finishClose();
  }

  /** The end of every way out: no dialog, the focus back where it came from. */
  private finishClose(): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    const wasOpen = this.open_;
    const opener = this.openedBy;
    this.openedBy = undefined;
    this.leaving_ = false;
    this.open_ = false;
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
    if (wasOpen && opener?.isConnected) opener.focus();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('card') && this.renderRoot instanceof ShadowRoot)
      this.card?.adopt(this.renderRoot);
  }

  protected override updated(changed: PropertyValues): void {
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog && !dialog.open && this.open_ && !this.leaving_) dialog.showModal();
    if (changed.has('open_') && this.open_ && !this.docked)
      requestAnimationFrame(() =>
        this.renderRoot.querySelector<HTMLElement>('.fv-sheet [role="switch"]')?.focus(),
      );
  }

  private onDialogClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return; // only the scrim closes
    if (performance.now() - this.openedAt >= GUARD_MS) this.close();
  }

  /** The sheet's content width (its 16 sides off), the design's 360 before it is laid out. */
  private get room(): number {
    const sheet = this.renderRoot.querySelector<HTMLElement>('.fv-sheet');
    const laid = sheet?.clientWidth ?? 0;
    return laid > 0 ? laid - 32 : 360;
  }

  /** A swatch, the ruler or the wheel: the colour is held for five seconds, as a level is, and the room wakes to it. */
  private pick(choice: HeldColour, data: Record<string, unknown>): void {
    this.held = { choice, expires: Date.now() + HOLD_MS };
    clearTimeout(this.holdTimer);
    this.holdTimer = window.setTimeout(() => {
      this.held = null;
      this.requestUpdate();
    }, HOLD_MS);
    this.card?.pick(data);
    this.requestUpdate();
  }

  /* ---------- render ---------- */

  private renderSheet(): TemplateResult {
    const hass = this.hass;
    const card = this.card;
    const t = (key: Parameters<typeof localize>[1]): string => localize(hass, key);
    const lamps = card?.lamps() ?? [];
    const usable = lamps.some((lamp) => lamp.usable);
    const on = lamps.some((lamp) => lamp.on);
    const title = card?.title() ?? '';
    const label = `${title} · ${t('light.color')}`;
    // the held colour lets go when the room reports it, or when its time is up
    const reported = roomBulb(lamps, null);
    if (
      this.held &&
      (Date.now() > this.held.expires ||
        near(this.held.choice, reported.shown, reported.maxK - reported.minK))
    )
      this.held = null;
    const bulb = this.held ? roomBulb(lamps, this.held.choice) : reported;
    const hex = bulb.shown.rgb
      ? hexOf(bulb.shown.rgb)
      : bulb.shown.kelvin
        ? hexOf(kelvinRgb(bulb.shown.kelvin))
        : '';
    const format = (v: number): string => formatNumber(hass, v, { digits: 0 });
    // which lights take no colour, where some do (a room where none does has no sheet to open)
    const dumb = lamps.filter((lamp) => lamp.usable && !lamp.colours).map((lamp) => lamp.name);
    return html`<div class="fv-sheet ls-sheet" data-card>
      <div class="fv-sheet__grabber"><span></span></div>
      <div class="fv-sheet__head">
        <div class="fv-card__titles">
          <h2 class="fv-sheet__title" id="ls-title">${title}</h2>
          <p class="fv-card__sub">${card?.line(this.room) ?? ''}</p>
        </div>
        ${toggle(
          on,
          card?.tone() ?? 'light',
          () => {
            card?.flip();
            this.requestUpdate();
          },
          title,
          !usable,
        )}
      </div>
      ${colourControls({
        bulb,
        t,
        name: title,
        width: this.room,
        on,
        colors: card?.colors(),
        minK: bulb.minK,
        maxK: bulb.maxK,
        format,
        temperature: undefined,
        disabled: !usable,
        look: card?.look() ?? 'ruler',
        still: card?.still() ?? true,
        words: (items) => card?.words(items) ?? items,
        host: this,
        pick: (choice, data) => this.pick(choice, data),
        wheel:
          card?.control() === 'wheel'
            ? (hue, saturation) =>
                html`<fluvy-hue-ring
                  .value=${hue}
                  .size=${ringSize(this.room)}
                  .color=${hex}
                  .ink=${hex ? inkOn(hex) : ''}
                  .label=${label}
                  ?inactive=${!on}
                  ?disabled=${!usable}
                  .format=${format}
                  @fluvy-change=${(e: CustomEvent<HueRingChangeDetail>) => {
                    const h = e.detail.value;
                    this.pick(
                      { rgb: hsToRgb(h, saturation), hue: h },
                      { hs_color: [h, saturation] },
                    );
                  }}
                ></fluvy-hue-ring>`
            : undefined,
      })}
      ${
        dumb.length
          ? html`<p class="ls-hint">
              ${plural(hass, 'lights.no_colour', dumb.length, { names: namesOf(hass, dumb) })}
            </p>`
          : nothing
      }
      <div class="ls-actions">
        <button class="fv-btn fv-btn--quiet" data-control data-target @click=${() => this.close()}>
          ${t('keypad.close')}
        </button>
      </div>
    </div>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.open_) return nothing;
    if (this.docked) return this.renderSheet();
    return html`<dialog
      class=${this.leaving_ ? 'is-leaving' : ''}
      aria-labelledby="ls-title"
      @cancel=${(event: Event) => {
        event.preventDefault();
        this.close();
      }}
      @close=${() => this.finishClose()}
      @click=${(event: MouseEvent) => this.onDialogClick(event)}
      @keydown=${keepEscape}
      @touchstart=${keepTouch}
    >
      ${this.renderSheet()}
    </dialog>`;
  }
}

if (!customElements.get('fluvy-lights-colour-sheet'))
  customElements.define('fluvy-lights-colour-sheet', FluvyLightsColourSheet);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-lights-colour-sheet': FluvyLightsColourSheet;
  }
}
