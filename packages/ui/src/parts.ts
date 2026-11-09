import { html, noChange, nothing, svg, type TemplateResult } from 'lit';
import { Directive, directive, type ElementPart } from 'lit/directive.js';
import {
  clickPress,
  holdKey,
  preventMenu,
  startPress,
  startStepRepeat,
  stopStepRepeat,
  type PressTarget,
} from './controls/pointer.js';
import { glyph, isGlyph, isLogo, logo, type GlyphName } from './glyphs.js';

/**
 * Template functions for the fluvy primitives — the same markup and class names as the approved
 * design sheets (`apps/design-lab/fluvy.js`), rendered by Lit so the DOM is stable and transitions run.
 * Nothing here knows about Home Assistant but the icon elements a reference names: values in, callbacks out.
 */

export type { Tone } from './tones.js';
import type { Tone } from './tones.js';

/**
 * A fluvy glyph name, a Home Assistant icon id (`mdi:…`), which `<ha-icon>` draws, or `ha-state:<entity id>=<state>`:
 * Home Assistant's own icon for that entity in that state (`stateIcon`).
 */
export type IconRef = GlyphName | `${string}:${string}`;

const HA_STATE = 'ha-state:';
/** A platform's logo by its id (`app:netflix`), from the chunk that holds them. */
const APP = 'app:';

/**
 * Home Assistant's own icon for an entity in a state — its device class, the state, its integration's icons — drawn
 * by `<ha-state-icon>`, which reads the rest of the house from Home Assistant's page itself. The state is the one the
 * circle draws: the entity's now, or one it had (an activity's row).
 */
export const stateIcon = (entityId: string, state: string): IconRef =>
  `${HA_STATE}${entityId}=${state}`;

/**
 * Hands `<ha-state-icon>` the entity's state from the element whose render draws it: a card or a sheet holds the
 * `hass` it was given, so no card threads the state through its circles. An entity id has no `=`: the state follows
 * the first.
 */
class StateOf extends Directive {
  /** Nothing to draw: the state is set in `update`. */
  render(ref: string): typeof noChange {
    void ref;
    return noChange;
  }

  override update(part: ElementPart, [ref]: [string]): typeof noChange {
    const host = part.options?.host as { hass?: { states?: Record<string, unknown> } } | undefined;
    const at = ref.indexOf('=');
    Object.assign(part.element, {
      stateObj: host?.hass?.states?.[ref.slice(0, at)],
      stateValue: ref.slice(at + 1),
    });
    return noChange;
  }
}
const stateOf = directive(StateOf);

/** `fluvy:cloud-sun` → the glyph name `cloudSun`. */
const glyphOf = (ref: string): string =>
  ref.slice(ref.indexOf(':') + 1).replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

export function icon(
  ref: IconRef | string | undefined,
  fallback: GlyphName = 'dots',
): TemplateResult {
  if (ref && ref.startsWith('fluvy:')) {
    const name = glyphOf(ref);
    if (isGlyph(name)) return glyph(name);
  }
  // a platform's logo (`app:netflix`), once its chunk has landed; the fallback glyph until then
  if (ref && ref.startsWith(APP))
    return isLogo(ref.slice(APP.length)) ? logo(ref.slice(APP.length)) : glyph(fallback);
  if (ref && ref.startsWith(HA_STATE))
    return html`<ha-state-icon
      class="fv-haicon"
      ${stateOf(ref.slice(HA_STATE.length))}
    ></ha-state-icon>`;
  if (ref && ref.includes(':')) return html`<ha-icon class="fv-haicon" .icon=${ref}></ha-icon>`;
  return glyph(isGlyph(ref) ? ref : fallback);
}

export interface IcoOptions {
  readonly hero?: boolean;
  /** The head's smaller circle (a compact row's 40, a 16 glyph): a name must keep its floor beside it and its control. */
  readonly small?: boolean;
  readonly onTap?: ((event: Event) => void) | undefined;
  /** A still press of 500 ms on the circle (a card's hold action); the click that follows is swallowed. */
  readonly onHold?: (() => void) | undefined;
  readonly label?: string;
  /** The circle is itself a switch in this state (a tile too narrow for one beside it): role switch, aria-checked. */
  readonly checked?: boolean;
}

export function ico(
  ref: IconRef | string | undefined,
  tone: Tone = 'accent',
  options: IcoOptions = {},
): TemplateResult {
  const cls = `fv-ico fv-ico--${tone}${options.hero ? ' fv-ico--hero' : ''}${options.small ? ' fv-ico--small' : ''}${options.onTap ? ' fv-ico--tap' : ''}`;
  if (options.onTap)
    return html`<button
      class=${cls}
      data-icon
      data-target
      role=${options.checked === undefined ? nothing : 'switch'}
      aria-checked=${options.checked === undefined ? nothing : String(options.checked)}
      aria-label=${options.label ?? nothing}
      .fvTap=${(options.onHold ? options.onTap : undefined) as PressTarget['fvTap']}
      .fvHold=${options.onHold as PressTarget['fvHold']}
      @pointerdown=${options.onHold ? startPress : nothing}
      @contextmenu=${options.onHold ? preventMenu : nothing}
      @click=${options.onHold ? clickPress : options.onTap}
    >
      ${icon(ref)}
    </button>`;
  return html`<span class=${cls} data-icon>${icon(ref)}</span>`;
}

export interface HeadOptions {
  /** `null`: no icon circle at all — a chart card in a column too narrow for the circle and its title. */
  readonly icon?: IconRef | string | null | undefined;
  /** The head's smaller circle (`HeadFit`'s `small`): the full one would leave the name under its floor. */
  readonly small?: boolean;
  /** The person's own picture in the circle's place (`image`: an address the card has made safe), drawn whole. */
  readonly picture?: string | undefined;
  /** The picture would not load: the card draws its circle in its place (`BrokenPictures.failed`). */
  readonly pictureFailed?: (event: Event) => void;
  /** A picture of the card's own in the circle's place (a car's), part of the head's button as the circle is. */
  readonly lead?: TemplateResult;
  readonly tone?: Tone;
  readonly title: string;
  readonly sub?: string;
  readonly trailing?: TemplateResult | typeof nothing;
  /**
   * The card's tap: the head is then the card's button — the title is a button whose overlay is stretched over the
   * whole row (the circle, the name, the line under it, the room up to what trails them, a passive badge); the
   * controls in the row keep their own tap, beside it and above it, never inside it.
   */
  readonly onTap?: (() => void) | undefined;
  /** What a reader hears for the head's button where the title alone says less; the title by default. */
  readonly label?: string | undefined;
  /** The title is a name (a device's, a person's): it may end in an ellipsis in a narrow column, as names do. */
  readonly name?: boolean;
  /** The title still ends in an ellipsis where it stands: the button carries it whole (read on hover). */
  readonly cut?: boolean;
  /** The title is a sentence (a note's): it takes the lines it needs, and the head grows with it. */
  readonly wrap?: boolean;
  /** A still press of 500 ms anywhere on the head (a card's hold action); the click that follows is swallowed. */
  readonly onHold?: (() => void) | undefined;
}

/** The click of a pressed head, seen before its button's own: a hold, or a mouse's drag, never also taps. */
export const clickHead = { handleEvent: clickPress, capture: true };

/**
 * The button a head is: the title's own words (they name it), its overlay stretched over the positioned row that
 * holds it (`.fv-card__head--tap`) — `head()`'s, and a custom head's (a player's art and words). The row binds the
 * press (`startPress`, `clickHead`) and the hold; the button taps, and the keyboard's menu key holds.
 */
export function headTap(
  title: string,
  o: Pick<HeadOptions, 'onHold' | 'label' | 'name' | 'cut'> & { readonly onTap: () => void },
): TemplateResult {
  return html`<button
    class="fv-card__tap"
    data-name=${o.name ? '' : nothing}
    aria-label=${o.label ?? nothing}
    title=${o.cut ? title : nothing}
    @click=${o.onTap}
    @keydown=${holdKey(o.onHold)}
  >
    ${title}
  </button>`;
}

export function head(o: HeadOptions): TemplateResult {
  const press = Boolean(o.onTap ?? o.onHold);
  const titleClass = `fv-card__title ${o.wrap ? 'fv-card__title--wrap' : ''}`;
  const title = o.onTap ? headTap(o.title, { ...o, onTap: o.onTap }) : o.title;
  return html`<div
    class="fv-card__head ${o.onTap ? 'fv-card__head--tap' : ''} ${o.onHold ? 'fv-card__head--hold' : ''} ${o.wrap ? 'fv-card__head--wrap' : ''}"
    .fvHold=${o.onHold as PressTarget['fvHold']}
    @pointerdown=${press ? startPress : nothing}
    @contextmenu=${o.onHold ? preventMenu : nothing}
    @click=${press ? clickHead : nothing}
  >
    ${
      o.lead ??
      (o.icon === null
        ? nothing
        : o.picture
          ? html`<span class="fv-ico fv-ico--picture ${o.small ? 'fv-ico--small' : ''}" data-icon
              ><img src=${o.picture} alt="" @error=${o.pictureFailed ?? nothing}
            /></span>`
          : ico(o.icon, o.tone ?? 'accent', { small: o.small ?? false }))
    }
    <div class="fv-card__titles">
      <h3 class=${titleClass} data-name=${o.name ? '' : nothing}>${title}</h3>
      ${o.sub ? html`<p class="fv-card__sub">${o.sub}</p>` : nothing}
    </div>
    ${o.trailing ?? nothing}
  </div>`;
}

export const label = (text: string): TemplateResult => html`<p class="fv-label">${text}</p>`;

/** Badges size to their text: 14 px sides, rounded up to the 4 grid by `fitPills()` after render. */
export const badge = (text: string, tone: Tone = 'accent'): TemplateResult =>
  html`<span class="fv-badge fv-badge--${tone}" data-control data-fit="28">${text}</span>`;

export interface ReadoutOptions {
  /** Words, or a name with what goes beside it (a curve's key) when the label lays out its own parts. */
  readonly label: string | TemplateResult;
  /** A figure, or one with what goes before it (a filament's swatch). */
  readonly value: string | TemplateResult;
  readonly unit?: string;
  readonly size?: 'xs' | 's' | 'm' | 'l';
  readonly trend?: 'up' | 'down' | undefined;
  /** The label is a name (a sensor's, a device's): it may end in an ellipsis in a narrow column, as names do. */
  readonly name?: boolean;
}

/** A unit written in kana or kanji (時間, 分, 本): Japanese attaches a counter to its figure, where English keeps a space. */
const CJK_UNIT = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]/u;

/** Whether a unit attaches to its figure with no gap ("5.2時間", "12本"), as a kana or kanji word does. */
export const attachedUnit = (unit: string): boolean => CJK_UNIT.test(unit);

/** A readout's unit in its slot: 4 px from its figure, or attached when it is a kana or kanji word. */
export const unitSpan = (unit: string): TemplateResult =>
  html`<span class="fv-unit${attachedUnit(unit) ? ' fv-unit--tight' : ''}">${unit}</span>`;

export function readout(o: ReadoutOptions): TemplateResult {
  return html`<div class="fv-readout fv-readout--${o.size ?? 'm'}">
    <p class="fv-readout__label" data-name=${o.name ? '' : nothing}>${o.label}</p>
    <p class="fv-readout__value">
      <span>${o.value}</span
      >${o.unit ? unitSpan(o.unit) : nothing}${o.trend ? html`<span class="fv-trend ${o.trend === 'down' ? 'fv-trend--down' : ''}">${glyph(o.trend === 'down' ? 'trendDown' : 'trendUp')}</span>` : nothing}
    </p>
  </div>`;
}

/**
 * 48×28 switch inside a 56×44 hit area. `disabled`: it cannot be moved here — out of reach (`true`, drawn disabled, as a
 * disabled stepper or round is), or shown to someone who may only look (`'readonly'`, at full strength).
 */
export function toggle(
  on: boolean,
  tone: Tone,
  onToggle: (next: boolean) => void,
  ariaLabel = '',
  disabled: boolean | 'readonly' = false,
): TemplateResult {
  const flip = (event: Event): void => {
    event.stopPropagation();
    if (!disabled) onToggle(!on);
  };
  const key = (event: KeyboardEvent): void => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      flip(event);
    }
  };
  return html`<span class="fv-hit ${disabled ? 'is-fixed' : ''}" data-target @click=${flip}
    ><span
      data-control
      class="fv-switch fv-switch--${tone} ${on ? 'is-on' : ''}"
      role="switch"
      tabindex=${disabled ? -1 : 0}
      aria-checked=${on ? 'true' : 'false'}
      aria-disabled=${disabled === true ? 'true' : 'false'}
      aria-readonly=${disabled === 'readonly' ? 'true' : nothing}
      aria-label=${ariaLabel || nothing}
      @keydown=${key}
      ><span class="fv-switch__thumb"></span></span
  ></span>`;
}

/** − | + pill (96 × 44). Holding a half repeats the step, always through the latest `onStep`. */
export function stepper(
  onStep: (direction: 1 | -1) => void,
  options: { disabled?: boolean; className?: string; decrease?: string; increase?: string } = {},
): TemplateResult {
  const keyClick =
    (direction: 1 | -1) =>
    (event: MouseEvent): void => {
      if (event.detail === 0) onStep(direction);
    }; // keyboard activation only
  const half = (direction: 1 | -1, name: string, icon: 'minus' | 'plus'): TemplateResult =>
    html`<button
      class="fv-stepper__half"
      data-target
      aria-label=${name}
      ?disabled=${options.disabled ?? false}
      .fvStep=${onStep}
      @pointerdown=${(event: PointerEvent) => startStepRepeat(event, direction)}
      @pointerup=${stopStepRepeat}
      @pointerleave=${stopStepRepeat}
      @pointercancel=${stopStepRepeat}
      @click=${keyClick(direction)}
    >
      ${glyph(icon)}
    </button>`;
  return html`<div class="fv-stepper ${options.className ?? ''}" data-control>
    ${half(-1, options.decrease ?? '−', 'minus')}${half(1, options.increase ?? '+', 'plus')}
  </div>`;
}

export interface OptionItem {
  readonly key: string;
  readonly label: string;
  /** The label is a name (an entity's): it may end in an ellipsis in a narrow tile, as names do. */
  readonly name?: boolean;
  readonly value?: string;
  /** The value is a word that describes (a sensor, a list of days), not a figure: the label's ink, a lighter weight. */
  readonly word?: boolean;
  readonly glyph?: IconRef | string;
  readonly tone?: Tone;
  readonly active?: boolean;
  /** What it stands for cannot be read: the Unavailable surface (the dashed hairline, the off ink), no tap. */
  readonly unavailable?: boolean;
  /** A figure's own tap (tiles with no choice to make): a button laid over its tile, named by its label and value. */
  readonly onTap?: (() => void) | undefined;
  /** A figure's still press of 500 ms (or the keyboard's menu key); the click that follows is swallowed. */
  readonly onHold?: (() => void) | undefined;
}

/** Up to three tiles share a row; four make a 2 × 2; more wrap in threes — a tile never gets too narrow for its value. */
export const optionColumns = (count: number): number =>
  count <= 3 ? Math.max(1, count) : count === 4 ? 2 : 3;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * How option tiles share their rows: every row is filled edge to edge. Full rows split the column into
 * `columns` equal cells; a shorter last row splits it into as many equal cells as it holds (5 modes on
 * 3 columns: 3 + 2 wider). Returns the grid's track count and each tile's span.
 */
export function optionGrid(
  count: number,
  columns: number,
): { readonly tracks: number; readonly spans: readonly number[] } {
  const perRow = Math.max(1, Math.min(columns, count));
  const last = count % perRow;
  if (last === 0) return { tracks: perRow, spans: Array.from({ length: count }, () => 1) };
  const tracks = (perRow * last) / gcd(perRow, last);
  return {
    tracks,
    spans: Array.from({ length: count }, (_, index) =>
      index >= count - last ? tracks / last : tracks / perRow,
    ),
  };
}

/**
 * Option tiles: glyph top-left, label, value; active = tone fill only. They share the column in equal cells and
 * every row is full. `compact`: the 64 tile without its glyph row — the label over the value (`height` is then 64).
 * Without `onSelect` they are figures: still, or pressed as a tile is where one has a tap or a hold of its own.
 */
export function options(
  items: readonly OptionItem[],
  onSelect: ((key: string) => void) | null,
  gap = 4,
  height = 84,
  columns = optionColumns(items.length),
  compact = false,
): TemplateResult {
  const stat = onSelect === null;
  const grid = optionGrid(items.length, columns);
  return html`<div
    class="fv-options"
    style="grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr));gap:${gap}px"
  >
    ${items.map((o, index) => {
      // a figure that can be read and has a tap or a hold of its own is pressed as a tile is: a button laid over it,
      // read as what it says ("Output · 3.2 kW")
      const cover =
        stat && !o.unavailable && (o.onTap ?? o.onHold)
          ? pressCover(`${o.label} · ${o.value ?? ''}`, o.onTap, o.onHold)
          : nothing;
      const cls = `fv-option ${stat ? 'fv-option--stat ' : ''}${cover === nothing ? '' : 'fv-tile--tap '}${compact ? 'fv-option--compact ' : ''}${o.unavailable ? 'is-unavailable ' : ''}${o.active ? `is-active fv-option--${o.tone ?? 'accent'}` : ''}`;
      const body = html`${compact ? nothing : html`<span class="fv-option__glyph">${icon(o.glyph)}</span>`}<span
          class="fv-option__label"
          data-name=${o.name ? '' : nothing}
          >${o.label}</span
        ><span class="fv-option__value ${o.word ? 'fv-option__value--word' : ''}"
          >${o.value ?? ''}</span
        >`;
      // a minimum, not a height: a tile whose value takes two lines grows, and its row grows with it
      const style = `min-height:${height}px${grid.spans[index] === 1 ? '' : `;grid-column:span ${grid.spans[index]}`}`;
      return stat
        ? html`<div class=${cls} data-card style=${style}>${body}${cover}</div>`
        : html`<button
            class=${cls}
            data-target
            style=${style}
            aria-pressed=${o.active ? 'true' : 'false'}
            aria-disabled=${o.unavailable ? 'true' : nothing}
            @click=${o.unavailable ? nothing : () => onSelect(o.key)}
          >
            ${body}
          </button>`;
    })}
  </div>`;
}

export interface ChipItem {
  readonly key: string;
  readonly label: string;
  readonly glyph?: IconRef | string;
  readonly active?: boolean;
  /** The glyph alone, the label as the chip's accessible name: a row too narrow for its words keeps its one line. */
  readonly short?: boolean;
  /** Chosen, it fills in this tone instead of the accent (a mode's own: the sun's for a solar mode). */
  readonly tone?: Tone;
  /** Its own colour (`data-accent`, derived by the card's accent sheet), drawn with `tone: 'accent'`. */
  readonly accent?: string;
  /** A still press of 500 ms (a light's details); the click that follows is swallowed. */
  readonly onHold?: () => void;
  /** The label is a name (a device's): in a column too narrow for it, it ends in an ellipsis, as names do. */
  readonly name?: boolean;
  /** What it stands for cannot be read: the dashed ring, no tap (a hold still opens it). */
  readonly unavailable?: boolean;
  readonly disabled?: boolean;
}

/**
 * The columns of a full chip row: one row while the labels fit in equal cells of a card's column
 * (four short words do, "Silent · Basic · Strong · Full Speed" does not), else two or three per row;
 * a label is never cut to make a row.
 */
export function chipColumns(labels: readonly string[]): number {
  const count = labels.length;
  const longest = Math.max(0, ...labels.map((label) => label.length));
  if (count <= 3) return Math.max(1, count);
  if (count === 4) return longest <= 7 ? 4 : 2;
  return longest <= 6 && count <= 5 ? count : 3;
}

/**
 * Chips. Content-sized by default (14 px sides, the row does not stretch); `fill` = equal chips that
 * fill the whole row — every row, the last one splitting the width among its own chips, in `columns`
 * (measured by the card) or as many as the labels' lengths suggest.
 */
export function chips(
  items: readonly ChipItem[],
  onSelect: (key: string) => void,
  className = '',
  fill = false,
  columns?: number,
): TemplateResult {
  const grid = fill
    ? optionGrid(items.length, columns ?? chipColumns(items.map((c) => c.label)))
    : undefined;
  return html`<div
    class="fv-chips ${className} ${fill ? 'fv-chips--fill' : ''}"
    style=${grid ? `grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr))` : nothing}
  >
    ${items.map((c, index) => html`<button class="fv-chip ${c.active ? 'is-active' : ''} ${c.tone ? `fv-chip--toned fv-tone--${c.tone}` : ''} ${c.unavailable ? 'is-unavailable' : ''}" data-target data-fit=${fill ? nothing : '28'} data-accent=${c.accent ?? nothing} style=${grid && grid.spans[index] !== 1 ? `grid-column:span ${grid.spans[index]}` : nothing} aria-pressed=${c.active ? 'true' : 'false'} aria-disabled=${c.unavailable ? 'true' : nothing} aria-label=${c.short ? c.label : nothing} title=${c.short ? c.label : nothing} ?disabled=${c.disabled ?? false} .fvTap=${c.onHold && !c.unavailable ? () => onSelect(c.key) : undefined} .fvHold=${c.onHold} @pointerdown=${c.onHold ? startPress : nothing} @contextmenu=${c.onHold ? preventMenu : nothing} @click=${c.onHold ? clickPress : c.unavailable ? nothing : () => onSelect(c.key)}><span class="fv-chip__pill" data-control>${c.glyph ? icon(c.glyph) : nothing}${c.short ? nothing : c.name ? html`<span class="fv-chip__name" data-name>${c.label}</span>` : c.glyph ? c.label : html`<span class="fv-chip__label">${c.label}</span>`}</span></button>`)}
  </div>`;
}

export interface ActionItem {
  readonly key: string;
  readonly glyph: IconRef | string;
  readonly label: string;
  readonly primary?: boolean;
  readonly disabled?: boolean;
}

/**
 * Action row: glyph buttons in equal cells that fill the column (16 gap, 44 tall, radius 12) — a row whose cells share
 * its width; in `columns` (measured by the card) its cells wrap into full rows, a shorter last row splitting it among
 * its own cells, as chips do.
 */
export function actions(
  items: readonly ActionItem[],
  onAction: (key: string) => void,
  columns = items.length,
): TemplateResult {
  const grid = optionGrid(items.length, columns);
  return html`<div
    class="fv-actions"
    data-fill-row
    style="grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr))"
  >
    ${items.map((a, index) => html`<button class="fv-action ${a.primary ? 'fv-action--accent' : ''}" data-control data-target aria-label=${a.label} title=${a.label} style=${grid.spans[index] === 1 ? nothing : `grid-column:span ${grid.spans[index]}`} ?disabled=${a.disabled ?? false} @click=${() => onAction(a.key)}>${icon(a.glyph)}</button>`)}
  </div>`;
}

/** A round button (the language's 44 circle); `on-page` on the page's ground, `bare` with no fill of its own. */
export function round(
  ref: IconRef | string,
  kind: 'quiet' | 'accent' | 'on-page' | 'bare' | '',
  ariaLabel: string,
  onClick: (event: Event) => void,
  disabled = false,
  extra = '',
): TemplateResult {
  return html`<button
    class="fv-round ${kind ? `fv-round--${kind}` : ''} ${extra}"
    data-control
    data-target
    aria-label=${ariaLabel}
    title=${ariaLabel}
    ?disabled=${disabled}
    @click=${onClick}
  >
    ${icon(ref)}
  </button>`;
}

export function button(
  text: string,
  kind: 'quiet' | 'accent' | 'link',
  onClick: (event: Event) => void,
  fill = false,
  disabled = false,
): TemplateResult {
  return html`<button
    class="fv-btn fv-btn--${kind}"
    data-control
    data-target
    style=${fill ? 'width:100%' : nothing}
    data-fit=${fill ? nothing : '32'}
    ?disabled=${disabled}
    @click=${onClick}
  >
    ${text}
  </button>`;
}

export interface ListRowOptions {
  /**
   * `null`: no circle — a row squeezed so far that its name would be cut short gives the circle's room to the name. A
   * template: a circle of the row's own (a picture).
   */
  readonly icon?: IconRef | string | TemplateResult | null | undefined;
  readonly tone?: Tone;
  readonly title: string;
  /** The title is a name (a device's, a person's): it may end in an ellipsis in a narrow column, as names do. */
  readonly name?: boolean;
  readonly sub?: string;
  /** What ends the row; a template: an end of the row's own (a select's value and the list it opens). */
  readonly trailing?: 'switch' | 'chevron' | 'value' | 'button' | 'none' | TemplateResult;
  readonly on?: boolean;
  readonly value?: string;
  /** A 16 glyph before the value (a trend's arrow). */
  readonly valueGlyph?: IconRef | undefined;
  /** The value is a state in words, not a figure: the secondary ink (a person's zone, a view that is always shown). */
  readonly quiet?: boolean;
  /** The word on the small quiet button at the row's end (`trailing: 'button'`); the row's tap is the action. */
  readonly button?: string;
  /** The sub line in the warning ink: a fold that hides an alert says so in its tone. */
  readonly subTone?: 'warning' | '';
  readonly valueTone?: 'warning' | '';
  readonly switchTone?: Tone;
  readonly unavailable?: boolean;
  /** Shown as it is but not changeable here (someone who may only look): full strength, a switch that does not move. */
  readonly readonly?: boolean;
  readonly onTap?: (() => void) | undefined;
  /** A still press on the row (its tap then never runs for that press); a row without one taps on click alone. */
  readonly onHold?: (() => void) | undefined;
  readonly onToggle?: ((next: boolean) => void) | undefined;
  /** The row's own colour (`data-accent`, derived by the card's accent sheet): the accent inside the row. */
  readonly accent?: string | undefined;
  /** The 48 row: a 36 circle, the title alone (no sub). */
  readonly compact?: boolean;
  /** A row that unfolds more (`trailing: 'chevron'`): open, its chevron turns up and it says it is expanded. */
  readonly open?: boolean;
  /** What a reader hears for the row, where its words leave something out (a sensor gone, said only by its skin). */
  readonly label?: string;
  /** What ends the row goes under its words (`fv-row--stack`): a column too narrow for both, even without the circle. */
  readonly stack?: boolean;
  /** The sub is the owner's own words (a template's), a name that may end in its ellipsis. */
  readonly subName?: boolean;
}

/** A value that reads as words, not a figure: it may take two lines instead of one. */
const words = (value: string | undefined): boolean => /[a-zà-ÿ]{3}/i.test(value ?? '');
const wordy = (value: string | undefined): boolean => (value ?? '').length > 14 && words(value);
/**
 * A value in words: prose (`--text`, a smaller two-line style) or a short state of several words (`--words`, which a
 * card may let wrap between them; one word has no second line to take, and stays a value).
 */
const wordsClass = (value: string | undefined): string =>
  wordy(value)
    ? 'fv-row__value--text'
    : words(value) && /\S\s+\S/.test(value ?? '')
      ? 'fv-row__value--words'
      : '';

/** 60 px row: icon circle, title/sub, one trailing element. */
export function listRow(o: ListRowOptions): TemplateResult {
  const trailing = o.trailing ?? 'chevron';
  const tail =
    typeof trailing === 'object'
      ? trailing
      : trailing === 'switch'
        ? toggle(
            o.on ?? false,
            o.switchTone ?? 'accent',
            o.onToggle ?? (() => undefined),
            o.title,
            (o.unavailable ?? false) || (o.readonly ? 'readonly' : false),
          )
        : trailing === 'value'
          ? html`<span
              class="fv-row__value ${o.valueTone ? `fv-row__value--${o.valueTone}` : ''} ${o.quiet ? 'fv-row__value--quiet' : ''} ${o.valueGlyph ? 'fv-row__value--glyph' : ''} ${wordsClass(o.value)}"
              >${o.valueGlyph ? icon(o.valueGlyph) : nothing}${o.value ?? ''}</span
            >`
          : trailing === 'chevron'
            ? html`<span class="fv-row__chevron">${glyph('chevron')}</span>`
            : trailing === 'button'
              ? html`<span class="fv-btn fv-btn--quiet fv-row__btn" data-fit="28"
                  >${o.button ?? ''}</span
                >`
              : nothing;
  return html`<div
    class="fv-row ${o.onTap ? 'fv-row--tap' : ''} ${o.unavailable ? 'is-unavailable' : ''} ${o.compact ? 'fv-row--compact' : ''} ${o.icon === null ? 'fv-row--bare' : ''} ${o.stack ? 'fv-row--stack' : ''} ${o.open ? 'is-open' : ''}"
    data-accent=${o.accent ?? nothing}
    role=${o.onTap ? 'button' : nothing}
    aria-expanded=${o.open === undefined ? nothing : o.open ? 'true' : 'false'}
    aria-label=${o.label ?? nothing}
    tabindex=${o.onTap ? 0 : nothing}
    .fvTap=${o.onHold ? o.onTap : undefined}
    .fvHold=${o.onHold}
    @pointerdown=${o.onHold ? startPress : nothing}
    @contextmenu=${o.onHold ? preventMenu : nothing}
    @click=${o.onHold ? clickPress : (o.onTap ?? nothing)}
    @keydown=${activateKey(o.onTap)}
  >
    ${rowIcon(o.icon, o.tone)}
    <span class="fv-row__text"
      ><span class="fv-row__title" data-name=${o.name ? '' : nothing}>${o.title}</span
      >${o.sub && !o.compact ? html`<span class="fv-row__sub ${o.subTone ? `fv-row__sub--${o.subTone}` : ''}" data-name=${o.subName ? '' : nothing}>${o.sub}</span>` : nothing}</span
    >
    ${tail}
  </div>`;
}

/** A row's circle in its tone; none at all for `null` (the row has given its room to the name); a template as it is. */
const rowIcon = (
  ref: IconRef | string | TemplateResult | null | undefined,
  tone: Tone | undefined,
): TemplateResult | typeof nothing =>
  ref === null
    ? nothing
    : typeof ref === 'object'
      ? ref
      : html`<span class="fv-ico fv-ico--${tone ?? 'neutral'}" data-icon>${icon(ref)}</span>`;

/**
 * The language's empty state: a 44 ring with a glyph over one secondary line, centred in a 120 panel — in the page's
 * fill inside a card, in its other fill where the panel stands on the page itself (`page`: a group of tiles, the tabs).
 */
export function emptyState(
  ref: IconRef | string,
  text: string,
  hint = '',
  page = false,
): TemplateResult {
  return html`<div class="fv-empty-state ${page ? 'fv-empty-state--page' : ''}" role="status">
    <span class="fv-empty-state__ring">${icon(ref)}</span
    ><span class="fv-empty-state__text">${text}</span>
    ${hint ? html`<span class="fv-empty-state__hint">${hint}</span>` : nothing}
  </div>`;
}

export interface BarRowOptions {
  /**
   * `null`: no circle — a row squeezed so far that its name would be cut short gives the circle's room to the name. A
   * template: a circle of the row's own (a picture).
   */
  readonly icon?: IconRef | string | TemplateResult | null | undefined;
  readonly tone?: Tone;
  readonly title: string;
  /** The title is a name (a device's, a plant's): it may end in an ellipsis in a narrow column, as names do. */
  readonly name?: boolean;
  /** The row's own colour (`#rrggbb`): its accent inside this row, as `AccentSheet` reads `data-accent`. */
  readonly accent?: string | undefined;
  readonly sub?: string;
  readonly value?: string;
  readonly fraction: number;
  /** The bar's colour: a tone, or `ink` (a destination's, no colour of its own). */
  readonly barTone?: Tone | 'ink';
  readonly valueTone?: 'warning' | '';
  /** What it measures cannot be read: the row fades, its circle the dashed ring (`tone: 'off'`). */
  readonly unavailable?: boolean;
  readonly onTap?: (() => void) | undefined;
  /** The 48 row: a 40 circle, the title and the value on one line (no sub), the bar 4 under the title. */
  readonly compact?: boolean;
  /** The sub is the owner's own words ("Watered 3 days ago"), a name that may end in its ellipsis. */
  readonly subName?: boolean;
}

/** Enter / Space on an element that plays a button (`role="button"`), ignoring keys bubbling up from a control inside it. */
export const activateKey =
  (run: (() => void) | undefined) =>
  (event: KeyboardEvent): void => {
    if (
      run &&
      (event.key === 'Enter' || event.key === ' ') &&
      event.target === event.currentTarget
    ) {
      event.preventDefault();
      run();
    }
  };

/**
 * A button stretched over the surface that holds it (`.fv-tile__tap`): a large tile's, a room's photo and row, a
 * greeting's words. It taps and holds (a still press, or the keyboard's menu key) and reads `label`.
 */
export const pressCover = (
  label: string,
  onTap: (() => void) | undefined,
  onHold: (() => void) | undefined,
): TemplateResult =>
  html`<button
    class="fv-tile__tap"
    aria-label=${label}
    .fvTap=${onTap}
    .fvHold=${onHold}
    @pointerdown=${startPress}
    @click=${clickPress}
    @contextmenu=${onHold ? preventMenu : nothing}
    @keydown=${holdKey(onHold)}
  ></button>`;

/** 76 px row with a 4 px bar under the text (plants, strings, batteries, meters); 48 compact, the title alone over the bar. */
export function barRow(o: BarRowOptions): TemplateResult {
  const pct = Number.isFinite(o.fraction)
    ? Math.round(Math.min(1, Math.max(0, o.fraction)) * 100)
    : 0;
  return html`<div
    class="fv-row fv-row--bar ${o.onTap ? 'fv-row--tap' : ''} ${o.unavailable ? 'is-unavailable' : ''} ${o.compact ? 'fv-row--compact' : ''} ${o.icon === null ? 'fv-row--bare' : ''}"
    data-accent=${o.accent ?? nothing}
    role=${o.onTap ? 'button' : nothing}
    tabindex=${o.onTap ? 0 : nothing}
    @click=${o.onTap ?? nothing}
    @keydown=${activateKey(o.onTap)}
  >
    ${rowIcon(o.icon, o.tone)}
    <span class="fv-row__text"
      ><span class="fv-row__title" data-name=${o.name ? '' : nothing}>${o.title}</span
      >${o.sub && !o.compact ? html`<span class="fv-row__sub" data-name=${o.subName ? '' : nothing}>${o.sub}</span>` : nothing}</span
    >
    <span
      class="fv-row__value ${o.valueTone ? `fv-row__value--${o.valueTone}` : ''} ${wordsClass(o.value)}"
      >${o.value ?? ''}</span
    >
    <span class="fv-bar"
      ><span
        class="fv-bar__fill fv-bar--${o.barTone ?? o.tone ?? 'neutral'}"
        data-measure="value"
        style="width:${pct}%"
      ></span
    ></span>
  </div>`;
}

/** Axis / ruler labels placed by value; the ends hug the edges. */
function placed(
  cls: string,
  items: readonly (readonly [fraction: number, text: string])[],
): TemplateResult {
  return html`<div class=${cls}>
    ${items.map(([f, text]) =>
      !(f > 0)
        ? html`<span class="is-first" style="left:0">${text}</span>`
        : f >= 1
          ? html`<span class="is-last" style="right:0">${text}</span>`
          : html`<span style="left:${(f * 100).toFixed(3)}%">${text}</span>`,
    )}
  </div>`;
}

export const axis = (items: readonly (readonly [number, string])[]): TemplateResult =>
  placed('fv-axis', items);
/**
 * The labels along a ruler, each at its fraction. Given the ruler's width, one under 240 px keeps only its first,
 * its middle and its last label, so none crowds another.
 */
export const rulerLabels = (
  items: readonly (readonly [number, string])[],
  width?: number,
): TemplateResult =>
  placed(
    'fv-ruler-labels',
    width !== undefined && width < 240 && items.length > 3
      ? [items[0]!, items[Math.floor((items.length - 1) / 2)]!, items[items.length - 1]!]
      : items,
  );

const up4 = (n: number): number => Math.ceil(n / 4) * 4;

/**
 * Sizes every `[data-fit]` pill from its text plus the declared side padding, rounded up to the 4 px
 * grid — the rule the design sheets are measured by. The text is measured with layout metrics (the used
 * `width` under `max-content`), not client rects: a card that is still scaling in would otherwise measure
 * 1.5 % short. The used width keeps its fraction and is rounded up — `offsetWidth` rounds to the nearest
 * pixel, and a 68.4 px label given a 68 px box breaks onto a second line. A pill is measured again when what it
 * holds changes: its words, or what stands beside them (a room's glyph comes with the room for it, where the pill
 * fitted to its name alone squeezed the glyph and cut the name). `force` re-measures pills whose content did not
 * change (a web font arrived).
 */
export function fitPills(root: ParentNode, force = false): void {
  root.querySelectorAll<HTMLElement>('[data-fit]').forEach((el) => {
    const pad = Number(el.dataset['fit']);
    if (!pad) return;
    // the box that lays the content out: a chip's pill, otherwise the pill itself
    const box = el.querySelector<HTMLElement>('.fv-chip__pill') ?? el;
    const held = `${box.childElementCount} ${el.textContent ?? ''}`;
    if (!force && el.dataset['fitKey'] === held) return;
    const previous = el.style.width;
    box.style.paddingLeft = ''; // measured without last time's lead-in and tail
    box.style.paddingRight = '';
    el.style.width = 'max-content';
    // the content itself — the text and a glyph beside it — never the box around it: a tab in a row that fills
    // has grown and lost its lead, and a pill measured by its box there came out 12 wider, which unfilled the row,
    // whose next fitting filled it again (the row flickered between the two every time a font settled)
    const range = document.createRange();
    range.selectNodeContents(box);
    // a range's rect is visual pixels: under a zoomed view it is divided back into the element's own — by the
    // element's own two widths, both fractional (a rounded `offsetWidth` would put a pixel on a pill at 1×)
    const visual = el.getBoundingClientRect().width;
    const local = parseFloat(getComputedStyle(el).width);
    const zoom = visual > 0 && local > 0 ? visual / local : 1;
    const natural = Math.ceil(
      range.getBoundingClientRect().width / zoom || local || el.offsetWidth,
    );
    const width = up4(natural + pad);
    const next = `${width}px`;
    el.style.width = next === previous ? previous : next;
    // content starts on a whole pixel (an icon on a half pixel blurs at 1×); the fractional remainder is air on the right.
    // The right side is padded too, never more than what is left, so the content box is at least the text: a pill capped
    // by a max-width ellipsises inside its padding, an uncapped one never does.
    const lead = Math.round((width - natural) / 2);
    box.style.justifyContent = 'flex-start';
    box.style.paddingLeft = `${lead}px`;
    box.style.paddingRight = `${Math.max(0, width - natural - lead)}px`;
    el.dataset['fitKey'] = held;
  });
}

/** A charging battery's bolt, across the glyph. */
const BOLT = 'M12.5 6.5 9 12.5h4l-1.5 5';
/** At this charge and under, a battery is low: the warning ink, its glyph and its figure both. */
export const LOW_BATTERY = 20;

/**
 * A battery's charge (a phone's beside its person): the set's battery glyph filled to its level — 12 wide inside, never
 * under 3 so a low one shows — a bolt across it while it charges, and the figure ("78 %", "—" unread). Low and not
 * charging, glyph and figure take the warning ink.
 */
export function batteryLevel(
  level: number | null,
  figure: string,
  charging = false,
): TemplateResult {
  const low = level !== null && level <= LOW_BATTERY && !charging;
  const fill = level === null || level <= 0 ? 0 : Math.max(3, (12 * level) / 100);
  return html`<span class="fv-battery ${low ? 'is-low' : ''} ${charging ? 'is-charging' : ''}"
    >${svg`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2"/>${fill > 0 ? svg`<rect class="fv-battery__level" x="5" y="10" width=${fill.toFixed(2)} height="4" rx="1"/>` : nothing}${charging ? svg`<path class="fv-battery__halo" d=${BOLT}/><path class="fv-battery__bolt" d=${BOLT}/>` : nothing}</svg>`}<span
      >${figure}</span
    ></span
  >`;
}
