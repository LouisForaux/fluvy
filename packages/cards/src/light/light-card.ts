import {
  formatNumber,
  isUsable,
  lightDefaults,
  PALETTE_ACCENT,
  sliderStill,
  sliderStyleOf,
  sliderWordsOf,
  stateText,
  type FluvyCardConfig,
  type LightTint,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { LIT_FLOOR } from '@fluvy/tokens/runtime';

import {
  head,
  label,
  rulerLabels,
  sheetStyles,
  toggle,
  type RulerChangeDetail,
  type RulerWindowDetail,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card, type CardEditor } from '../shared/base.js';
import { HeadFit, SWITCH_SLOT } from '../energy/head.js';

import { iconOf, stateWord } from '../shared/domain.js';
import { rowsOf } from '../shared/heights.js';
import {
  COLOURED,
  dims,
  hexOf,
  litColour,
  withMembers,
  type LightWhites,
} from '../shared/light.js';
import { Level } from '../shared/level.js';
import { levelRow } from '../shared/value-row.js';
import type { HeldColour } from './colour.js';
import type { SwatchEntry } from './swatches.js';

/** How the card is drawn: the full dimmer, or the compact one (its level in the head, the ruler alone); `auto` picks by width. */
export type LightVariant = 'auto' | 'full' | 'compact';

/**
 * How much of its colour a lit card shows: a gentle wash, alone or as strong as the lamp is bright, or a lit tile's
 * whole fill, alone or as much of it as the lamp is bright (#131).
 */
export type TintStrength = 'soft' | 'brightness' | 'full' | 'full_brightness';

/** When the card shows its light's brightness: always (`true`), never (`false`), or while the light is on (#124). */
export type ShowBrightness = boolean | 'when_on';

export interface LightCardConfig extends FluvyCardConfig {
  variant?: LightVariant;
  /**
   * The brightness and, with it, the stepper and the temperature and colour rows (#124): always (`true`, the default);
   * never (`false`: the card is its head alone, as a bulb that only switches); or while the light is on (`when_on`:
   * its head alone while it is off or cannot be read, the card easing open to the rest as it turns on).
   */
  show_brightness?: ShowBrightness;
  /** The − and + beside the full card's level (default). Off: the level is set on its ruler, and the readout is the card's tap. */
  show_stepper?: boolean;
  /** Send brightness while dragging (throttled) instead of only on release. */
  live_update?: boolean;
  show_temperature?: boolean;
  /** The colour-temperature ruler's ticks take a faint warm → cool tint (default). Off = neutral ticks like the brightness ruler. */
  temperature_tint?: boolean;
  /** A colour bulb's hue ruler and quick colours (default). Off: the card of a white bulb. */
  show_color?: boolean;
  /**
   * The quick colours, in order, any number: `warm`, `cool`, a Home Assistant colour name, `#rrggbb`, `[r, g, b]`,
   * `picker`, or any of those with a name (`{ color, name }`).
   */
  colors?: readonly SwatchEntry[];
  /**
   * The card shows its light's colour on its surface (1.9): never (`off`), while the light is on (`on`), or at rest
   * too (`always`: a quiet wash) — the house's choice (fluvy's settings) where the card says none.
   */
  tint?: LightTint;
  /**
   * How much: a lit tile's whole fill (`full`, the default), a gentle wash (`soft`), the wash as strong as the lamp is
   * bright (`brightness`), or the fill as much as the lamp is bright (`full_brightness`, #131: from the soft wash to the
   * whole fill at 100 %, in the fill's words where they read and the card's where they do not).
   */
  tint_strength?: TintStrength;
  /** A lit white: by its temperature (`temperature`, the default since 1.10), or as the palette's lit light (`palette`). */
  light_whites?: LightWhites;
}

/** The colour controls' module: fetched the first time a colour bulb is drawn, once for every light card. */
type ColourModule = typeof import('./colour.js');
let colourModule: Promise<ColourModule> | undefined;

/**
 * What a bulb does: a colour bulb draws its hue ruler and quick colours, a white one its temperature ruler, a dimmer
 * neither; one that only switches draws its head alone (#65).
 */
export interface BulbDoes {
  readonly colour: boolean;
  readonly temperature: boolean;
  readonly dimmable: boolean;
}
/** Where the house is not there to say: a colour bulb. */
const COLOUR_BULB: BulbDoes = { colour: true, temperature: true, dimmable: true };

/**
 * The card's height at a 360 column, for the automatic dashboard's columns: the ruler slot (a label, the ruler and
 * its labels: 100) when a temperature or a hue ruler may show, and the quick colours (16 above, 44 rounds, six a row,
 * as many rows as the count takes; a named entry counts one) when they may — for what the bulb does, as the house
 * describes it (`house-heights.ts`), a colour bulb's where it is not there to say; a list of none draws no row. A
 * bulb that only switches is its head alone, 84, whatever the config asks, as a card that never shows the brightness
 * is; one that shows it while the light is on declares its head, which it is while off, and grows from it as the light
 * turns on, its grid row following (`getGridOptions`).
 */
export function lightHeight(config: LightCardConfig, bulb: BulbDoes = COLOUR_BULB): number {
  if (!bulb.dimmable || config.show_brightness === false || config.show_brightness === 'when_on')
    return 84;
  if (config.variant === 'compact') return 188;
  const slot =
    (config.show_temperature !== false && bulb.temperature) ||
    (config.show_color !== false && bulb.colour)
      ? 100
      : 0;
  const rows =
    config.show_color !== false && bulb.colour ? rowsOf(config.colors?.length ?? 6, 6) : 0;
  const swatches = rows ? 8 + rows * 52 : 0;
  return 268 + slot + swatches;
}

/** Under this content width the full layout has no room for its value and stepper: the compact one takes over. */
const COMPACT_BELOW = 260;

/**
 * The precision dimmer: a big tabular value with its stepper, the ruler underneath (relative drag,
 * slide away to slow down, hold for the 1 % scale), and a second ruler for colour temperature. A colour bulb gets a
 * row of quick colours under that ruler's slot, and the slot holds a hue ruler while the bulb is in a colour; the
 * card wears the bulb's colour as its accent. Half a section wide (or `variant: compact`) it keeps the head, with
 * the level in its state line, and the brightness ruler alone: two lamps share a line. A bulb that only switches
 * (#65) draws its head alone — the circle, the name, the state line, the switch — in every style, 84 tall. The
 * switch is never what a narrow column costs: the head is fitted round it (the sub steps aside, then the icon
 * circle), as the fan's is.
 */
export class FluvyLightCard extends Card<LightCardConfig> {
  /** The head, measured: what gives way in a narrow column is the sub, then the icon — never the switch. */
  private readonly head = new HeadFit(this);

  /** The card's height at a 360 column from its config alone: a colour bulb's (`lightHeight`). */
  static override layoutHeight(config: LightCardConfig): number {
    return lightHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.slider,
    css`
      .sl-card {
        height: auto;
        min-height: 256px;
      } /* the sheet fixes 256 so its five states line up; a colour-temperature ruler makes the card taller */
      /* the compact card, the head alone of a bulb that only switches (#65) and a card that folds its brightness
         away (#124) are as tall as they draw */
      .sl-card--compact,
      .sl-card--switch,
      .sl-card--fold {
        min-height: 0;
      }
      /* the brightness shown while the light is on (#124): folded under the head while it is off. Turned on, the card
         eases to its size and what it holds fades in once it has the room; turned off, it fades out, then the card
         eases back. What it holds is laid out at its own size throughout, so nothing in it moves. */
      .sl-fold {
        display: grid;
        grid-template-rows: 0fr;
        transition: grid-template-rows var(--fv-slow) var(--fv-ease) var(--fv-fast);
      }
      .sl-fold.is-open {
        grid-template-rows: 1fr;
        transition-delay: 0s;
      }
      /* out to the card's edges (its padding given back inside), so what reaches past the column is never cut: the
         ruler's knob at its ends, a focus ring; folded, it is not there at all once it has faded */
      .sl-fold__body {
        min-height: 0;
        margin: 0 -20px -20px;
        padding: 0 20px 20px;
        overflow: clip;
        opacity: 0;
        visibility: hidden;
        transition:
          opacity var(--fv-fast) var(--fv-ease),
          visibility 0s linear var(--fv-fast);
      }
      .sl-fold.is-open > .sl-fold__body {
        opacity: 1;
        visibility: visible;
        transition:
          opacity var(--fv-base) var(--fv-ease) var(--fv-slow),
          visibility 0s;
      }
      /* reduced motion (the system's, or the person's in Fluvy's settings): the new size at once, waiting for nothing */
      @media (prefers-reduced-motion: reduce) {
        .sl-fold,
        .sl-fold__body {
          transition: none !important;
        }
      }
      :host([reduced-motion]) :is(.sl-fold, .sl-fold__body) {
        transition: none !important;
      }
    `,
  ];

  /** The brightness the finger sets: held until the lamp reports it, a stepper's taps sent as one call. */
  private readonly level = new Level(this, (value) => this.send(value));
  /** The colour the finger chose, shown (the check, the ruler, the accent) until the bulb reports it or 5 s pass. */
  private heldColour: { choice: HeldColour; expires: number } | null = null;
  private colourTimer = 0;
  /** The colour controls, once their module has landed; asked for on the first render of a colour bulb. */
  private colour: ColourModule | undefined;
  private colourAsked = false;

  static override editor(): Promise<CardEditor> {
    return import('./light-editor.js');
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): LightCardConfig {
    return {
      type: 'custom:fluvy-light-card',
      entity: entities.find((id) => id.startsWith('light.')) ?? '',
    };
  }

  protected override prepare(config: LightCardConfig): LightCardConfig {
    if (!config.entity) throw new Error('fluvy-light-card: "entity" is required');
    return {
      ...config,
      variant: config.variant ?? 'auto',
      show_temperature: config.show_temperature ?? true,
      show_color: config.show_color ?? true,
      temperature_tint: config.temperature_tint ?? true,
      live_update: config.live_update ?? false,
    };
  }

  /** A light group's members are watched too: its colour is theirs. */
  protected override watched(): readonly string[] {
    return withMembers(super.watched(), this.hass);
  }

  override getCardSize(): number {
    // a bulb that only switches is its head alone, once the house has said so; so is a card that never shows the
    // brightness, and one that shows it while the light is on while it is off (Home Assistant's masonry places a card
    // once, by this: its column then grows and shrinks with it)
    const view = this.entity();
    const shows = this.config?.show_brightness;
    if (
      !dims(view.attr<string[]>('supported_color_modes') ?? []) ||
      shows === false ||
      (shows === 'when_on' && view.state !== 'on')
    )
      return 2;
    return this.config?.variant === 'compact' ? 2 : 4;
  }
  /**
   * Half a section is enough (two lamps on a line); a card asked to be compact starts there, and never goes under it:
   * in a third, the switch left its name no room. Its rows are `auto`: Home Assistant's sections size the row to the
   * card, so one that shows its brightness while on grows and shrinks in it, the cards under it moving with it (a
   * number of rows would cut it or leave a hole under it).
   */
  override getGridOptions(): LovelaceGridOptions {
    return this.config?.variant === 'compact'
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private send(value: number): void {
    if (value <= 0) this.call('light', 'turn_off');
    else this.call('light', 'turn_on', { brightness_pct: value });
  }

  /** A swatch or the hue ruler: the colour is held for five seconds, as a level is, and the bulb wakes to it. */
  private pickColour(choice: HeldColour, data: Record<string, unknown>): void {
    this.heldColour = { choice, expires: Date.now() + 5000 };
    clearTimeout(this.colourTimer);
    this.colourTimer = window.setTimeout(() => {
      this.heldColour = null;
      this.requestUpdate();
    }, 5000);
    this.expect(this.config?.entity ?? '', 'on');
    this.call('light', 'turn_on', data);
  }

  /** The colour controls' module, fetched once; its sheet adopted as it lands, and the card drawn again. */
  private loadColour(): void {
    if (this.colourAsked) return;
    this.colourAsked = true;
    void (colourModule ??= import('./colour.js')).then((module) => {
      if (this.renderRoot instanceof ShadowRoot) module.adopt(this.renderRoot);
      this.colour = module;
      this.requestUpdate();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.colourTimer);
  }

  /** The colour-temperature ruler under its label, warm to cool, inactive while the lamp is off. */
  private temperatureRuler(
    name: string,
    width: number,
    on: boolean,
    kelvin: number,
    minK: number,
    maxK: number,
    unusable: boolean,
    onFill: boolean,
  ): TemplateResult {
    // its label on one line: the short form where the column does not hold "Température de couleur" (half a section)
    const words = this.t('light.temperature');
    const look = sliderStyleOf(this.config);
    return html`${label(this.head.ruler.width('fv-label', words) <= width ? words : this.t('light.temperature_short'))}
      <fluvy-ruler
        .value=${kelvin}
        .min=${minK}
        .max=${maxK}
        .step=${50}
        .length=${width}
        tone="accent"
        .minor=${0.1}
        .major=${0.5}
        ?inactive=${!on}
        ?disabled=${unusable}
        ?on-fill=${onFill}
        .look=${look}
        ?still=${sliderStill()}
        .tint=${this.config?.temperature_tint === false ? '' : 'warm-cool'}
        unit="K"
        .label=${`${name} · ${this.t('light.temperature')}`}
        .format=${(v: number) => formatNumber(this.hass, v, { digits: 0 })}
        @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) => this.call('light', 'turn_on', { color_temp_kelvin: e.detail.value })}
      ></fluvy-ruler>
      ${rulerLabels(
        sliderWordsOf(
          this.config,
          [
            [0, this.t('light.warm')],
            [1, this.t('light.cool')],
          ],
          look,
        ),
      )}`;
  }

  /**
   * The full card's level and its stepper (`levelRow`), laid out from every figure it can show (100 %, the word for
   * off); the stepper stays, still, while the lamp cannot be reached.
   */
  private renderLevel(
    entityId: string,
    name: string,
    on: boolean,
    unusable: boolean,
    level: number,
  ): TemplateResult {
    const label = this.t('light.brightness');
    const off = this.t('common.off');
    const lit = on || this.level.preview !== null;
    const value = unusable ? '—' : lit ? formatNumber(this.hass, level, { digits: 0 }) : off;
    const unit = unusable || !lit ? '' : '%';
    return levelRow(this.head.ruler, {
      width: this.contentWidth,
      label,
      figures: [{ value: formatNumber(this.hass, 100, { digits: 0 }), unit: '%' }, { value: off }],
      value,
      unit,
      stepper: this.config?.show_stepper !== false,
      disabled: unusable,
      decrease: this.t('common.decrease'),
      increase: this.t('common.increase'),
      onStep: (d) => this.level.step(Math.min(100, Math.max(0, this.level.current + d))),
      tap: () => this.readoutTap(entityId, `${name} · ${label} ${value} ${unit}`),
    });
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.nameFor(view, this.config?.name);
    // a light that cannot be read keeps the card's whole anatomy, still: its switch, its level ("—"), its rulers
    const unusable = !isUsable(view);
    const on = !unusable && (this.stateOf(view) === 'on' || (this.level.chosen ?? 0) > 0);
    const modes = view.attr<string[]>('supported_color_modes') ?? [];
    const shows = this.config?.show_brightness;
    // a light Home Assistant has not described (gone, or unavailable since it started) draws as a dimmer; one that
    // only switches, described as such (its attributes kept while it cannot be read), is its head alone (#65), as a card
    // that never shows the brightness is (#124)
    const dimmable = dims(modes) && shows !== false;
    // one that shows it while the light is on folds it under its head while it is off or cannot be read (#124)
    const folds = dimmable && shows === 'when_on';
    const raw = view.attr<number | null>('brightness');
    const reported = on && typeof raw === 'number' ? Math.max(1, Math.round((raw / 255) * 100)) : 0;
    const level = this.level.read(reported);
    const shownLevel = this.level.preview ?? level;
    const w = this.contentWidth;
    const look = sliderStyleOf(this.config);
    const variant = this.config?.variant ?? 'auto';
    // the compact layout is the dimmer's: a bulb that only switches has one anatomy, its head
    const compact =
      dimmable && (variant === 'compact' || (variant === 'auto' && w < COMPACT_BELOW));
    // on the fine scale the labels are the major ticks themselves (whole values); the ones too close to an end are left out
    const ticks =
      this.level.fineLabels((v) => formatNumber(this.hass, v, { digits: 0 })) ??
      (compact || w < COMPACT_BELOW
        ? [
            [0, '0'],
            [0.5, '50'],
            [1, '100'],
          ]
        : [
            [0, '0'],
            [0.25, '25'],
            [0.5, '50'],
            [0.75, '75'],
            [1, '100'],
          ]);
    // the compact head says the level where the full card has its big value ("On · 70 %")
    const state = stateText(this.hass, view);
    const figure = `${formatNumber(this.hass, shownLevel, { digits: 0 })} %`;
    const sub = compact
      ? on && dimmable
        ? `${state} · ${figure}`
        : state
      : (!unusable && view.areaName) || state;
    // where the state's words would not hold beside the switch (es "Encendida" in half a section), the line says the
    // level, or the state's one word ("Not found"), else keeps its place, empty (the switch says on or off) — never a
    // word cut; an area's name ends in its ellipsis, as names do
    const short =
      compact || sub === state
        ? [
            ...(compact && on && dimmable
              ? [figure]
              : unusable
                ? [stateWord(this.hass, view)]
                : []),
            '\u00a0',
          ]
        : [];

    // a colour bulb: its controls come with their module (the first colour bulb fetches it); until then, the white bulb's card
    const coloured =
      dimmable && modes.some((m) => COLOURED.has(m)) && this.config?.show_color !== false;
    if (coloured && !this.colour) this.loadColour();
    const colour = coloured ? this.colour : undefined;
    const kelvin = view.attr<number | null>('color_temp_kelvin');
    const minK = view.attr<number>('min_color_temp_kelvin') ?? 2000;
    const maxK = view.attr<number>('max_color_temp_kelvin') ?? 6500;
    // the held colour lets go when the bulb reports it, or when its time is up
    if (
      this.heldColour &&
      (Date.now() > this.heldColour.expires ||
        this.colour?.reported(view, this.heldColour.choice, maxK - minK))
    )
      this.heldColour = null;
    const choice = this.heldColour?.choice ?? null;

    // its colour: the one it is given (a name, a hex; Primary: the palette's accent), else a tone it is given, else
    // the light's own — the finger's choice while held, what it glows (a group: its lit members', by brightness), the
    // colour it last glowed while a flip waits for Home Assistant — and, glowing none, the palette's lit light
    const own = this.accents.pick(this.config?.color);
    const tone: Tone = own ? 'accent' : (this.config?.tone ?? 'light');
    const live =
      own || this.config?.tone
        ? undefined
        : choice
          ? 'rgb' in choice
            ? hexOf(choice.rgb)
            : undefined
          : litColour(view, on, this.config?.light_whites, this.hass);
    // the icon, the switch and the rulers take it through the light-active family `data-accent` remaps
    const accent = live ? this.accents.item(live) : undefined;

    // its surface (`tint`): lit, a lit tile's whole fill or a wash as strong as asked, or as much of the fill as the
    // lamp is bright; at rest (`always`) a quiet wash where no `card_color` is; a light that cannot be read keeps the
    // unavailable skin
    const tint = this.config?.tint ?? lightDefaults().tint;
    const strength = this.config?.tint_strength ?? 'full';
    // a word the card does not know is never lit
    const lit = on && (tint === 'on' || tint === 'always');
    const source = live ?? (own && own !== PALETTE_ACCENT ? own : tone);
    // as bright as the lamp is, where the strength follows it (the finger's level while it drags); a bulb that does not
    // dim, at its brightest
    const bright = dims(modes) ? shownLevel / 100 : 1;
    // the fill as much as the lamp is bright: a step of it, in the fill's inks (a lit tile's skin) or the card's
    const step =
      lit && strength === 'full_brightness' ? this.accents.litFull(source, bright) : undefined;
    const full = lit && (step ? step.onFill : strength === 'full');
    const surface = lit
      ? step
        ? step.surface
        : full
          ? undefined
          : this.accents.lit(source, strength === 'soft' ? LIT_FLOOR : Math.max(LIT_FLOOR, bright))
      : tint === 'always' && !unusable && !this.config?.card_color
        ? this.accents.lit(source, 0)
        : undefined;

    // the head fitted to its column round its switch: the sub steps aside, then the icon — never the switch (half
    // a phone's section leaves 136: the name and the switch, and the ruler under them)
    const fitted = this.head.fit({
      width: w,
      title: name,
      sub,
      shorter: short,
      trailing: SWITCH_SLOT,
    });
    const temperature =
      modes.includes('color_temp') && this.config?.show_temperature !== false
        ? () => this.temperatureRuler(name, w, on, kelvin ?? minK, minK, maxK, unusable, full)
        : undefined;

    // what the head is over: the level, its ruler, the colours (folded under the head while the light is off, where the
    // card shows them while it is on)
    const body = html`${
      dimmable
        ? html` ${compact ? nothing : this.renderLevel(view.id, name, on, unusable, shownLevel)}
            <div class="sl-bubble-row"></div>
            <fluvy-ruler
              .value=${level}
              .min=${0}
              .max=${100}
              .step=${1}
              .length=${w}
              .tone=${on ? tone : 'neutral'}
              ?disabled=${unusable}
              ?inactive=${!on}
              ?wake=${!unusable}
              ?on-fill=${full}
              .look=${look}
              ?still=${sliderStill()}
              unit="%"
              .label=${`${name} · ${this.t('light.brightness')}`}
              .format=${(v: number) => formatNumber(this.hass, v, { digits: 0 })}
              @fluvy-input=${(e: CustomEvent<RulerChangeDetail>) =>
                this.level.input(e.detail.value, this.config?.live_update === true)}
              @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) => this.level.set(e.detail.value)}
              @fluvy-window=${(e: CustomEvent<RulerWindowDetail>) => this.level.zoom(e.detail)}
            ></fluvy-ruler>
            ${rulerLabels(sliderWordsOf(this.config, ticks, look))}`
        : nothing
    }
    ${
      // the compact layout asked for keeps the head and the ruler; one of a colour bulb by its width (a zoomed phone)
      // keeps a row of its quick colours too
      variant === 'compact' || !dimmable
        ? nothing
        : colour
          ? colour.colourControls({
              view,
              t: (key) => this.t(key),
              name,
              width: w,
              on,
              held: choice,
              colors: this.config?.colors,
              minK,
              maxK,
              format: (v) => formatNumber(this.hass, v, { digits: 0 }),
              temperature,
              disabled: unusable,
              onFill: full,
              look,
              still: sliderStill(),
              words: (items) => sliderWordsOf(this.config, items, look),
              row: compact,
              host: this,
              pick: (picked, data) => this.pickColour(picked, data),
            })
          : compact
            ? nothing
            : (temperature?.() ?? nothing)
    }`;

    return html`<article
      class="fv-card sl-card ${unusable ? 'is-unavailable is-off' : ''} ${compact ? 'sl-card--compact' : dimmable ? '' : 'sl-card--switch'} ${folds ? 'sl-card--fold' : ''} ${full ? `is-lit fv-tone--${tone}` : lit && surface ? 'is-glow' : ''}"
      data-card
      data-accent=${accent ?? nothing}
      data-surface=${surface ?? nothing}
    >
      ${head({
        icon: fitted.icon ? iconOf(view, this.config?.icon) : null,
        small: fitted.small,
        tone: unusable ? 'off' : on ? tone : 'neutral',
        title: name,
        name: true,
        sub: fitted.sub,
        trailing: toggle(
          on,
          tone,
          (next) => {
            this.expect(view.id, next ? 'on' : 'off');
            this.call('light', next ? 'turn_on' : 'turn_off');
          },
          name,
          unusable,
        ),
        cut: fitted.cut,
        ...this.headActions(view.id),
      })}
      ${
        folds
          ? html`<div class="sl-fold ${on ? 'is-open' : ''}" ?inert=${!on}>
              <div class="sl-fold__body">${body}</div>
            </div>`
          : body
      }
    </article>`;
  }
}
