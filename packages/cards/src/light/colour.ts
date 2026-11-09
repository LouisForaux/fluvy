import type { EntityView, MessageKey, SliderStyle } from '@fluvy/core';
import { icon, label, rulerLabels, textWidth, type RulerChangeDetail } from '@fluvy/ui';
import { css, html, nothing, type TemplateResult } from 'lit';
import { COLOURED, hexOf } from '../shared/light.js';
import {
  clamp255,
  defaultSwatches,
  rgbOf,
  tripletOf,
  type Rgb,
  type SwatchEntry,
} from './swatches.js';

/*
 * A colour bulb's controls, fetched the first time the light card draws one (`import('./colour.js')`): the hue ruler
 * that takes the temperature ruler's slot while the bulb is in a colour, the row of quick colours under it, and the
 * matching that says which of them the bulb is on. The card keeps the wiring (what to send, the hold); this keeps the
 * tables, the maths and the row's sheet, and lands with the grammar it shares with the editor (`swatches.ts`: what an
 * entry may be, the editor's rows).
 */

export type { Rgb, SwatchEntry, SwatchObject } from './swatches.js';

/**
 * A quick colour, resolved: a white at a temperature, a colour, or the picker; `hex` is what its round shows (the
 * picker's is empty: its round is a ring of the hues, and holds the bulb's colour while the bulb is on one of its
 * own); `label` is the name the config gave it, when it gave one.
 */
export type Swatch =
  | {
      readonly kind: 'white';
      readonly word: 'warm' | 'cool';
      readonly kelvin: number;
      readonly hex: string;
      readonly label?: string;
    }
  | {
      readonly kind: 'colour';
      readonly name: string;
      readonly rgb: Rgb;
      readonly hex: string;
      readonly label?: string;
    }
  | { readonly kind: 'picker'; readonly hex: string; readonly label?: string };

/** The colour the finger chose: a colour (with its hue, so the ruler holds still) or a white's temperature. */
export type HeldColour = { readonly rgb: Rgb; readonly hue: number } | { readonly kelvin: number };

/** What the bulb shows, as the swatches are matched against it: a colour, a white at a temperature, or nothing (off). */
export interface Shown {
  readonly rgb?: Rgb | undefined;
  readonly kelvin?: number | undefined;
}

/**
 * What a bulb glows when asked for one of Home Assistant's colour names: Home Assistant's own `THEME_COLORS` (the
 * colours its colour picker lists), not the palette's tones — a bulb wears no palette, and "red" must be red on it.
 */
export const BULB_COLORS: Readonly<Record<string, string>> = {
  red: '#f44336',
  pink: '#e91e63',
  purple: '#926bc7',
  'deep-purple': '#6e41ab',
  indigo: '#3f51b5',
  blue: '#2196f3',
  'light-blue': '#03a9f4',
  cyan: '#00bcd4',
  teal: '#009688',
  green: '#4caf50',
  'light-green': '#8bc34a',
  lime: '#cddc39',
  yellow: '#ffeb3b',
  amber: '#ffc107',
  orange: '#ff9800',
  'deep-orange': '#ff5722',
  brown: '#795548',
  'light-grey': '#bdbdbd',
  grey: '#9e9e9e',
  'dark-grey': '#606060',
  'blue-grey': '#607d8b',
  white: '#ffffff',
};

/** The colour names the catalogue has a word for (`option.red` …); any other name reads as words of its own. */
const WORDED: ReadonlySet<string> = new Set([
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
]);
/** A Home Assistant colour name as words: `deep-purple` reads "Deep purple". */
const wordsOf = (name: string): string => {
  const words = name.replace(/-/g, ' ');
  return words.charAt(0).toLocaleUpperCase() + words.slice(1);
};

/** A colour counts as a swatch's within this much a channel; a white within this share of the bulb's range. */
const RGB_TOLERANCE = 12;
const KELVIN_SHARE = 0.15;

/** The picker's opening colour where the bulb is on none of its own: Home Assistant's orange. */
const PICKER_OPENS_ON = '#ff9800';
/** A colour chosen in the picker goes to the bulb this long after the last change: a drag in it is not a call a move. */
const PICK_DEBOUNCE = 250;
const pickTimers = new WeakMap<HTMLInputElement, number>();

/** A black body at `kelvin` as the colour a white bulb shows (Tanner Helland's fit; 1000–40000 K). */
export function kelvinRgb(kelvin: number): Rgb {
  const t = kelvin / 100;
  const r = t <= 66 ? 255 : 329.698727446 * (t - 60) ** -0.1332047592;
  const g =
    t <= 66
      ? 99.4708025861 * Math.log(t) - 161.1195681661
      : 288.1221695283 * (t - 60) ** -0.0755148492;
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp255(r), clamp255(g), clamp255(b)];
}

/** The white the others are shown beside: a neutral 4000 K (the middle of a bulb's range) reads as white. */
const NEUTRAL = kelvinRgb(4000);

/**
 * A white's round as the eye reads it beside the other (#41): its colour relative to a neutral 4000 K, so the cool
 * one reads as a cool white and the warm one as a warm one — a black body's own 5000 K is a peach cream on a screen.
 */
export function whiteHex(kelvin: number): string {
  const rgb = kelvinRgb(kelvin).map((c, i) => c / (NEUTRAL[i] || 1));
  const top = Math.max(...rgb);
  return hexOf(rgb.map((c) => (c / top) * 255));
}

/** A hue (0–360) and a saturation (0–100) at full value as `[r, g, b]`: what the ruler sends is what the bulb glows. */
export function hsToRgb(hue: number, saturation: number): Rgb {
  const c = saturation / 100;
  const channel = (n: number): number => {
    const k = (n + hue / 60) % 6;
    return clamp255(255 * (1 - c * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [channel(5), channel(3), channel(1)];
}

/** The hue (0–360) of `[r, g, b]`; a grey has none and reads 0. */
export function hueOf([r, g, b]: Rgb): number {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60 + 360) % 360;
}

/**
 * A quick colour as configured, resolved for a bulb whose temperatures run `minK`–`maxK`; nothing for what is not
 * one. A named entry (`{ color, name }`) is its colour with the name as its label; a hex is named by its canonical
 * `#rrggbb`, a Home Assistant colour by its name.
 */
export function resolveSwatch(entry: SwatchEntry, minK: number, maxK: number): Swatch | undefined {
  if (Array.isArray(entry)) {
    const rgb = tripletOf(entry);
    return rgb ? { kind: 'colour', name: hexOf(rgb), rgb, hex: hexOf(rgb) } : undefined;
  }
  if (typeof entry === 'object' && entry !== null && 'color' in entry) {
    const swatch = resolveSwatch(entry.color, minK, maxK);
    const label = typeof entry.name === 'string' ? entry.name.trim() : '';
    return swatch && label ? { ...swatch, label } : swatch;
  }
  if (typeof entry !== 'string') return undefined;
  const text = entry.trim().toLowerCase();
  if (text === 'picker') return { kind: 'picker', hex: '' };
  if (text === 'warm' || text === 'cool') {
    const kelvin = Math.max(minK, Math.min(maxK, text === 'warm' ? 2700 : 5000));
    return { kind: 'white', word: text, kelvin, hex: whiteHex(kelvin) };
  }
  const known = Object.hasOwn(BULB_COLORS, text);
  const rgb = rgbOf(known ? (BULB_COLORS[text] ?? '') : text);
  return rgb
    ? { kind: 'colour', name: known ? text : hexOf(rgb), rgb, hex: hexOf(rgb) }
    : undefined;
}

/**
 * What a swatch's round says (its title, its accessible name, the picker's input): the name the config gave it,
 * else a white's word, the picker's, a colour's word where the catalogue has one, a hex as itself, and any other
 * Home Assistant colour as words ("Deep purple").
 */
export function swatchWord(swatch: Swatch, t: (key: MessageKey) => string): string {
  if (swatch.label) return swatch.label;
  if (swatch.kind === 'white') return t(`light.${swatch.word}`);
  if (swatch.kind === 'picker') return t('option.picker');
  if (WORDED.has(swatch.name)) return t(`option.${swatch.name}` as MessageKey);
  return swatch.name.startsWith('#') ? swatch.name : wordsOf(swatch.name);
}

/**
 * How far `target` is from what the bulb shows when it is within tolerance — a colour ±12 a channel, a white within
 * 15 % of the bulb's range — and infinite otherwise, or across kinds (a white is never a colour's match).
 */
function gap(target: Shown, shown: Shown, range: number): number {
  if (target.rgb && shown.rgb) {
    const gaps = target.rgb.map((v, k) => Math.abs(v - (shown.rgb?.[k] ?? 0)));
    return Math.max(...gaps) <= RGB_TOLERANCE ? gaps.reduce((a, b) => a + b, 0) : Infinity;
  }
  if (target.kelvin !== undefined && shown.kelvin !== undefined) {
    const d = Math.abs(target.kelvin - shown.kelvin);
    return d <= KELVIN_SHARE * range ? d : Infinity;
  }
  return Infinity;
}

/**
 * The swatch the bulb is on: the nearest within tolerance, else the picker's round when the bulb glows a colour none
 * of them has (a white is never the picker's), or −1 (off, a colour of its own and no picker).
 */
export function activeSwatch(swatches: readonly Swatch[], shown: Shown, range: number): number {
  let best = -1;
  let nearest = Infinity;
  swatches.forEach((swatch, i) => {
    const d = swatch.kind === 'picker' ? Infinity : gap(swatch, shown, range);
    if (d < nearest) {
      nearest = d;
      best = i;
    }
  });
  if (best === -1 && shown.rgb) return swatches.findIndex((swatch) => swatch.kind === 'picker');
  return best;
}

/** What the bulb shows: the finger's choice while it is held, else what the bulb reports while it is on. */
export function shownOf(view: EntityView, on: boolean, held: HeldColour | null): Shown {
  if (held) return held;
  if (!on) return {};
  const mode = view.attr<string | null>('color_mode') ?? '';
  const rgb = view.attr<number[] | null>('rgb_color');
  const kelvin = view.attr<number | null>('color_temp_kelvin');
  if (COLOURED.has(mode) && Array.isArray(rgb) && rgb.length >= 3)
    return { rgb: [rgb[0] ?? 0, rgb[1] ?? 0, rgb[2] ?? 0] };
  if (mode === 'color_temp' && typeof kelvin === 'number') return { kelvin };
  return {};
}

/** Whether what is shown is the colour the finger chose (within the swatches' tolerances): the hold can let go. */
export const near = (held: HeldColour, shown: Shown, range: number): boolean =>
  gap(held, shown, range) < Infinity;

/** Whether the bulb reports the colour the finger chose: the hold can let go. */
export const reported = (view: EntityView, held: HeldColour, range: number): boolean =>
  near(held, shownOf(view, true, null), range);

/**
 * What the controls draw of a bulb, or of a room's bulbs together (the room lights' sheet): what it shows, the hue
 * the ruler stands on and the saturation a hue is sent at, and what it can do.
 */
export interface BulbState {
  readonly shown: Shown;
  /** The finger's hue while held, else the bulb's, else red. */
  readonly hue: number;
  /** The bulb's; the full one where it reports none: the ruler is for colours, not for whites. */
  readonly saturation: number;
  readonly modes: readonly string[];
}

/** A bulb as its controls draw it: the finger's choice while it is held, else what the bulb reports while it is on. */
export function bulbOf(view: EntityView, on: boolean, held: HeldColour | null): BulbState {
  const shown = shownOf(view, on, held);
  const hs = view.attr<number[] | null>('hs_color');
  return {
    shown,
    hue: held && 'rgb' in held ? held.hue : (hs?.[0] ?? (shown.rgb ? hueOf(shown.rgb) : 0)),
    saturation: hs?.[1] || 100,
    modes: view.attr<string[]>('supported_color_modes') ?? [],
  };
}

/** Black or white, whichever reads better on a colour (WCAG luminance): the check on the swatch the bulb is on. */
export function inkOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const linear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? '#111111' : '#ffffff';
}

export interface ColourOptions {
  /** The bulb as it is drawn (`bulbOf`), or a room's bulbs together. */
  readonly bulb: BulbState;
  readonly t: (key: MessageKey) => string;
  readonly name: string;
  readonly width: number;
  readonly on: boolean;
  readonly colors: readonly SwatchEntry[] | undefined;
  readonly minK: number;
  readonly maxK: number;
  readonly format: (value: number) => string;
  /** The temperature ruler, when the bulb has one and the card shows it: the slot's ruler while the bulb is white. */
  readonly temperature: (() => TemplateResult) | undefined;
  /** The finger's choice: the card holds it and sends `data` with `light.turn_on`. */
  readonly pick: (choice: HeldColour, data: Record<string, unknown>) => void;
  /** The light cannot be read: every control in its place, still. */
  readonly disabled?: boolean;
  /** The card is lit as a lit tile (`tint_strength: full`): the hue ruler on its fill. */
  readonly onFill?: boolean;
  /** The style the card's sliders are drawn in (1.18), whether a liquid rests, and the words under one in that style. */
  readonly look: SliderStyle;
  readonly still: boolean;
  readonly words: <T>(items: readonly T[]) => readonly T[];
  /** The quick colours alone, one row of as many as the column holds (a colour bulb's compact layout by width). */
  readonly row?: boolean;
  /** The hue wheel in the hue ruler's slot (the room lights' sheet), in place of the ruler and its words. */
  readonly wheel?: ((hue: number, saturation: number) => TemplateResult) | undefined;
  /** The card: its face lays the ruler's words out. */
  readonly host: Element;
}

/**
 * The hue ruler's words by value — red, green and blue where it holds them (0°, 120°, 240°) — as many as its column
 * keeps 8 apart: green gives way first (a narrow column in Portuguese), then the others (the row stays, empty).
 */
function hueWords(o: ColourOptions): [number, string][] {
  const [red, green, blue] = [o.t('option.red'), o.t('option.green'), o.t('option.blue')];
  const font = `500 11px ${getComputedStyle(o.host).fontFamily}`;
  const [r, g, b] = [textWidth(red, font), textWidth(green, font), textWidth(blue, font)];
  const third = o.width / 3;
  if (r + g / 2 + 8 <= third && (g + b) / 2 + 8 <= third)
    return [
      [0, red],
      [1 / 3, green],
      [2 / 3, blue],
    ];
  return r + b / 2 + 8 <= 2 * third
    ? [
        [0, red],
        [2 / 3, blue],
      ]
    : [];
}

/** A quick colour's round and the gap after it. */
const SWATCH = 44 + 8;

/**
 * The colour bulb's controls: one ruler slot — the hue ruler while the bulb is in a colour (or has no temperature
 * ruler), the temperature ruler while it is white — and the quick colours under it, the one the bulb is on checked.
 * A white swatch leads to the temperature ruler, a colour to the hue ruler: the swatches are the mode's switch.
 */
export function colourControls(o: ColourOptions): TemplateResult {
  const { shown, hue, saturation, modes } = o.bulb;
  const range = o.maxK - o.minK;
  const entries = o.colors ?? defaultSwatches(modes);
  const all = entries.flatMap((entry) => resolveSwatch(entry, o.minK, o.maxK) ?? []);
  // one row: as many as fit, the picker kept last where the list has one
  const fit = Math.max(1, Math.floor((o.width + 8) / SWATCH));
  const picker = all.find((swatch) => swatch.kind === 'picker');
  const swatches =
    !o.row || all.length <= fit
      ? all
      : picker
        ? [...all.filter((swatch) => swatch !== picker).slice(0, fit - 1), picker]
        : all.slice(0, fit);
  const active = activeSwatch(swatches, shown, range);
  const word = (swatch: Swatch): string => swatchWord(swatch, o.t);
  const pickSwatch = (swatch: Swatch): void => {
    if (swatch.kind === 'white')
      o.pick({ kelvin: swatch.kelvin }, { color_temp_kelvin: swatch.kelvin });
    else if (swatch.kind === 'colour')
      o.pick({ rgb: swatch.rgb, hue: hueOf(swatch.rgb) }, { rgb_color: [...swatch.rgb] });
  };
  // the picker's choice, 250 ms after its last change (a drag in it fires `input` a move); `change` too, for the
  // browsers that fire it alone when the picker closes
  const picked = (e: Event): void => {
    const input = e.currentTarget as HTMLInputElement;
    clearTimeout(pickTimers.get(input));
    pickTimers.set(
      input,
      window.setTimeout(() => {
        const rgb = rgbOf(input.value);
        if (rgb) o.pick({ rgb, hue: hueOf(rgb) }, { rgb_color: [...rgb] });
      }, PICK_DEBOUNCE),
    );
  };
  // the slot's hue control: the ruler and its words, or the wheel where the sheet asks for one
  const hueControl = o.wheel
    ? o.wheel(hue, saturation)
    : html`<fluvy-ruler
          .value=${hue}
          .min=${0}
          .max=${360}
          .step=${1}
          .length=${o.width}
          tone="accent"
          .minor=${1 / 12}
          .major=${0.25}
          ?inactive=${!o.on}
          ?disabled=${o.disabled}
          ?on-fill=${o.onFill}
          .look=${o.look}
          ?still=${o.still}
          tint="hue"
          .label=${`${o.name} · ${o.t('light.color')}`}
          .format=${(v: number) => `${o.format(v)}°`}
          @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) => {
            const h = e.detail.value;
            o.pick({ rgb: hsToRgb(h, saturation), hue: h }, { hs_color: [h, saturation] });
          }}
        ></fluvy-ruler>
        ${rulerLabels(o.words(hueWords(o)))}`;
  const slot =
    shown.rgb || !o.temperature
      ? html`${label(o.t('light.color'))} ${hueControl}`
      : o.temperature();
  // a list of none (`colors: []`) draws no row at all, not an empty one with its 16 above
  if (!swatches.length) return o.row ? html`` : html`${slot}`;
  return html`${o.row ? nothing : slot}
    <div class="lc-swatches">
      ${swatches.map((swatch, i) => {
        const current = i === active;
        if (swatch.kind === 'picker') {
          // the bulb's colour while the round holds it; the input fills the round unseen, and a tap on the round is
          // a tap on it (the label's), so the browser's own picker opens with the bulb's colour
          const hex = current && shown.rgb ? hexOf(shown.rgb) : PICKER_OPENS_ON;
          return html`<label
            class="lc-swatch lc-swatch--picker ${current ? 'is-active' : ''}"
            data-target
            style="--swatch:${hex};--swatch-ink:${inkOn(hex)}"
            title=${word(swatch)}
            aria-label=${word(swatch)}
          >
            ${current ? icon('check') : nothing}
            <input
              class="lc-swatch__input"
              type="color"
              data-measure="skip"
              ?disabled=${o.disabled}
              .value=${hex}
              aria-label=${word(swatch)}
              @input=${picked}
              @change=${picked}
            />
          </label>`;
        }
        return html`<button
          class="lc-swatch ${current ? 'is-active' : ''}"
          data-target
          style="--swatch:${swatch.hex};--swatch-ink:${inkOn(swatch.hex)}"
          title=${word(swatch)}
          aria-label=${word(swatch)}
          aria-pressed=${current ? 'true' : 'false'}
          ?disabled=${o.disabled}
          @click=${() => pickSwatch(swatch)}
        >
          ${current ? icon('check') : nothing}
        </button>`;
      })}
    </div>`;
}

/**
 * The quick colours' row: 16 above, 44 rounds 8 apart from the left, wrapping by count (six fill a phone's column:
 * three make one short row, twelve two full ones; a wider column holds more a row). The list has no cap and no
 * minimum. A round is its colour, its edge that colour a shade deeper (a grey ring stair-stepped round a saturated
 * round; a pale one still stands off the card by it), the check in black or white by luminance.
 */
export const styles = css`
  .lc-swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  /* on a lit card a round's edge is the surface's own ink over it, whatever the round's colour: a round as pale as
     the fill, or of the fill's own colour, still stands off it */
  .is-lit .lc-swatch {
    border-color: color-mix(in srgb, var(--tone-on) 40%, var(--tone-fill));
  }
  .is-glow .lc-swatch {
    border-color: color-mix(in srgb, var(--fluvy-text) 40%, var(--fluvy-card));
  }
  /* the picker of a light that cannot be read: in its place, faded, no tap, as a disabled round is */
  .lc-swatch--picker:has(.lc-swatch__input:disabled) {
    opacity: 0.4;
    pointer-events: none;
  }
  .lc-swatch {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid color-mix(in oklab, var(--swatch) 86%, var(--fluvy-text));
    border-radius: 50%;
    background: var(--swatch);
    color: var(--swatch-ink);
    cursor: pointer;
  }
  .lc-swatch svg {
    width: 20px;
    height: 20px;
  }
  /* the picker's round: a ring of the hues (the colour wheel's), its edge the text ink faint; holding the bulb's
     colour, the colour fills it inside a 3 px ring of the hues, the check on the colour */
  .lc-swatch--picker {
    position: relative;
    overflow: hidden;
    border-color: color-mix(in oklab, var(--fluvy-text) 24%, transparent);
    background: conic-gradient(
      from 90deg,
      #f44336,
      #ffeb3b,
      #4caf50,
      #00bcd4,
      #2196f3,
      #926bc7,
      #f44336
    );
  }
  .lc-swatch--picker.is-active {
    border: 3px solid transparent;
    background:
      linear-gradient(var(--swatch), var(--swatch)) padding-box,
      conic-gradient(from 90deg, #f44336, #ffeb3b, #4caf50, #00bcd4, #2196f3, #926bc7, #f44336)
        border-box;
  }
  /* the browser's colour input, the whole round and unseen: the tap and the keyboard reach it, the eye does not */
  .lc-swatch__input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    opacity: 0;
    cursor: pointer;
  }
  .lc-swatch--picker:has(.lc-swatch__input:focus-visible) {
    outline: 2px solid var(--fluvy-accent);
    outline-offset: 2px;
  }
`;

/** The row's sheet into a card's shadow root, once, beside the card's own (as `AccentSheet.adopt` does). */
export function adopt(root: ShadowRoot): void {
  const sheet = styles.styleSheet;
  if (sheet) {
    if (!root.adoptedStyleSheets.includes(sheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else if (!root.querySelector('style[data-fluvy-colour]')) {
    // no constructible sheets: a style element ahead of what Lit renders, where its own fallback puts them
    const element = document.createElement('style');
    element.dataset['fluvyColour'] = '';
    element.textContent = styles.cssText;
    root.prepend(element);
  }
}
