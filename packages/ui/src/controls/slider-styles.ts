import { html, nothing, svg, type TemplateResult } from 'lit';
import { sliderStylesCss } from '../styles/slider-styles.js';

/*
 * The styles a slider is drawn in besides the ruler (1.18, #144): the bar (Home Assistant's idea in the ruler's
 * slot), the liquid (the bar's slot, the fill water with two slow waves at its edge) and a tile's fill (the whole tile
 * is the slider). Each is drawn by the ruler itself in its own band (`look`), with the ruler's gestures but the fine
 * scale. A module of its own, fetched by the first ruler asked for one (`fetchSliderStyles`), so a house of rulers
 * never pays for it.
 */

/** The sheet every ruler drawn in one of the styles adopts beside its own. */
export const sliderStylesSheet = new CSSStyleSheet();
sliderStylesSheet.replaceSync(sliderStylesCss);

/** What a style is drawn from: the band, the level as the ruler shows it, and the state the ruler is in. */
export interface StyleDrawing {
  /** The scale's length and the band's thickness, in CSS px. */
  readonly len: number;
  readonly band: number;
  readonly vertical: boolean;
  /** Where the level stands, 0..1 of the length (the ruler's `shown`: the finger's while it drags). */
  readonly fraction: number;
  /** A tinted scale (`warm-cool`, `hue`): the gradient is the track itself and nothing fills it. */
  readonly tint: string;
  /** The colour under the level on a tinted scale (the knob's dot): what a liquid's water takes. */
  readonly dot: string;
  /** No level shown: the device is off and no finger moves it. */
  readonly inactive: boolean;
  readonly disabled: boolean;
  readonly dragging: boolean;
}

const state = (o: StyleDrawing): string =>
  `${o.vertical ? ' sb-bar--vertical' : ''}${o.disabled ? ' is-disabled' : ''}`;

/**
 * The bar: the track the inset ground, the fill the tone's ink to the level, the handle a 4 × 20 pill of the card's
 * colour 8 inside the fill's end (18 on a tile's 40 band; on a tinted bar, at the level itself, on the gradient).
 * Vertical, lit from the foot. Asleep, the track alone.
 */
export function drawBar(o: StyleDrawing): TemplateResult {
  const x = Math.round(o.fraction * o.len);
  const long = Math.round((o.band * 0.45) / 2) * 2;
  // from the origin: 8 inside the fill's end, never nearer the ends than 8
  const along = o.tint
    ? Math.min(Math.max(x - 2, 8), o.len - 8 - 4)
    : Math.min(Math.max(x - 8 - 4, 8), o.len - 8 - 4);
  const across = (o.band - long) / 2;
  const fill =
    o.tint || o.inactive
      ? nothing
      : html`<span
          class="sb-bar__fill"
          style=${o.vertical ? `height:${x}px` : `width:${x}px`}
        ></span>`;
  const handle = o.inactive
    ? nothing
    : html`<span
        class="sb-bar__handle"
        style=${
          o.vertical
            ? `left:${across}px;top:${o.len - 4 - along}px;width:${long}px;height:4px`
            : `left:${along}px;top:${across}px;width:4px;height:${long}px`
        }
      ></span>`;
  return html`<span class="sb-bar${o.tint ? ` sb-bar--${o.tint}` : ''}${state(o)}"
    >${fill}${handle}</span
  >`;
}

/** The water's edge: a sine along the band's thickness, two wavelengths longer than it so it can travel one. */
function edge(o: StyleDrawing, amplitude: number, wavelength: number, phase: number): string {
  const span = o.band + wavelength * 2;
  let d = '';
  for (let t = -wavelength; t <= span; t += 2) {
    const s = Math.sin(((t + phase) / wavelength) * Math.PI * 2) * amplitude;
    d += `${d ? 'L' : 'M'}${o.vertical ? `${t} ${(-s).toFixed(1)}` : `${s.toFixed(1)} ${t}`}`;
  }
  return d;
}

/**
 * The liquid: the bar's slot, the fill water — two waves at its edge (amplitudes 3 and 2.5, wavelengths 26 and 20),
 * translucent over the ground, each travelling one wavelength along the edge and repeating (the sheet's 9 s and 14 s;
 * at rest on its first frame without motion). A tinted liquid's water takes the colour under its edge. Asleep, the
 * ground alone. The level is the group's; the path inside it travels.
 */
export function drawLiquid(o: StyleDrawing): TemplateResult {
  const w = o.vertical ? o.band : o.len;
  const h = o.vertical ? o.len : o.band;
  const level = o.vertical ? Math.round((1 - o.fraction) * h) : Math.round(o.fraction * w);
  const layer = (amplitude: number, wavelength: number, phase: number, cls: string) =>
    o.vertical
      ? svg`<g style="transform:translate(0px,${level}px)"><path class="${cls} lq-x${wavelength}" d="${edge(o, amplitude, wavelength, phase)} L${w + wavelength} ${h + 40} L${-wavelength} ${h + 40} Z" /></g>`
      : svg`<g style="transform:translate(${level}px,0px)"><path class="${cls} lq-y${wavelength}" d="${edge(o, amplitude, wavelength, phase)} L${-w - 40} ${h + wavelength} L${-w - 40} ${-wavelength} Z" /></g>`;
  return html`<span
    class="sb-liq${o.disabled ? ' is-disabled' : ''}"
    style=${o.tint ? `--tone-ink:${o.dot}` : nothing}
  >
    <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}" aria-hidden="true">
      ${o.inactive ? nothing : [layer(3, 26, 0, 'lq-b'), layer(2.5, 20, 7, 'lq-a')]}
    </svg>
  </span>`;
}

/**
 * A tile's fill: the lit wash from the tile's start to the level, stopping on a 2 px edge of the fill's hairline (the
 * tone's ink under a finger); the tile's words stand over it (tiles.css). Asleep, nothing: the tile is its plain self.
 */
export function drawFill(o: StyleDrawing): TemplateResult | typeof nothing {
  if (o.inactive) return nothing;
  const x = Math.round(o.fraction * o.len);
  return html`<span class="sb-fill" style="width:${x}px"></span
    ><span class="sb-fill__edge" style="translate:${x - 1}px 0"></span>`;
}
