import {
  isUsable,
  PALETTE_ACCENT,
  relativeTime,
  sliderStill,
  sliderStyleOf,
  sliderWordsOf,
  stateText,
  strings,
  textAttr,
  TOGGLE_DOMAINS,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LightTint,
  type LovelaceCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  clamp,
  head,
  round,
  rulerLabels,
  sheetStyles,
  toggle,
  type RulerChangeDetail,
  type RulerWindowDetail,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Hold } from '../cover/common.js';
import { HeadFit, SWITCH_SLOT, type FittedHead } from '../energy/head.js';
import { speedCount, speedScale } from '../fan/fan-card.js';
import type { CardEditor } from '../shared/base.js';
import { heldLabels, type Labels } from '../shared/axis.js';
import { iconOf, stateWord, toneFor } from '../shared/domain.js';
import { Level } from '../shared/level.js';
import {
  digitsOf,
  fanPercentage,
  numberScale,
  PERCENT,
  playerOff,
  readingOf,
  scaleText,
  setCall,
  ticksOf,
  type OwnRange,
  type Scale,
  type Ticks,
} from '../shared/scale.js';
import { changedAt } from '../shared/since.js';
import { levelRow } from '../shared/value-row.js';
import { sliderHeight } from '../slider-family.js';
import {
  FluvyTileCard,
  type TileCardConfig,
  type TileItem,
  type TileLevel,
  type TileLook,
  type TileSize,
} from '../tile/tile-card.js';

const s = strings('slider');

/** The full card (the light's: the value with its stepper over the ruler), the compact one, or the house's large tile. */
export type SliderVariant = 'full' | 'compact' | 'tile';
export const VARIANTS: readonly SliderVariant[] = ['full', 'compact', 'tile'];

/** What ends the head: a player's mute or a switch by the entity (`auto`), either asked for, or nothing. */
export type SliderControl = 'auto' | 'mute' | 'switch' | 'none';
export const CONTROLS: readonly SliderControl[] = ['auto', 'mute', 'switch', 'none'];

export interface SliderCardConfig extends FluvyCardConfig {
  variant?: SliderVariant;
  control?: SliderControl;
  /** Another entity's switch in the head (a soundbar's power beside its volume). */
  toggle_entity?: string;
  /** The − and + beside the full card's value (default). Off: the value is set on its ruler, and the readout is the card's tap. */
  show_stepper?: boolean;
  /** Send the value while dragging (throttled), as a volume is heard, instead of only on release. */
  live_update?: boolean;
  /** The ruler's own ends, within the entity's (a soundbar kept under 60 %): a number's, a helper's, a player's volume. */
  min?: number;
  max?: number;
  /** The value's name over its figure: Volume, Speed or Value where it says none. */
  label?: string;
  /**
   * The card shows its tone on its surface, as the light card does: never (`off`, the full and compact cards'
   * default), while something is on (`on`, the tile's), or at rest too (`always`: a quiet wash).
   */
  tint?: LightTint;
}

/** What the card sets, by its entity: a player's volume, a fan's speed, a number's or a helper's value. */
type Kind = 'volume' | 'speed' | 'value';
const kindOf = (view: EntityView): Kind =>
  view.domain === 'media_player' ? 'volume' : view.domain === 'fan' ? 'speed' : 'value';

/** The domains the card sets a value on. */
export const DOMAINS = ['media_player', 'number', 'input_number', 'fan'] as const;

/** Under this content width a scale's figures under the ruler keep its ends and its middle (the light card's rule). */
const ALL_LABELS_FROM = 260;

/** The scale as the card draws it: its range and step, its ticks on a card and on a tile, the words under its ruler. */
interface Drawn {
  readonly scale: Scale;
  readonly card: Ticks;
  readonly tile: Ticks;
  /** Its figure at each major tick, or a fan's named speeds. */
  readonly labels: Labels;
  /** The words are a fan's speeds, each one a stop: never thinned to the ends and the middle by their count. */
  readonly named: boolean;
}

/* media_player supported_features: the volume can be muted */
const VOLUME_MUTE = 8;

/** A player's volume as the card draws it: 0–100 %, its own `min` and `max` within it where they make a range. */
function volumeScale(own: OwnRange): Scale {
  const min = clamp(Number(own.min ?? 0), 0, 100);
  const max = clamp(Number(own.max ?? 100), 0, 100);
  return max > min ? { ...PERCENT, min, max } : PERCENT;
}

/** The words under a ruler: the scale's figure at each of its major ticks. */
function scaleLabels(hass: HomeAssistant | undefined, scale: Scale, ticks: Ticks): Labels {
  const count = Math.round(1 / ticks.major);
  return Array.from({ length: count + 1 }, (_, i) => {
    const f = i / count;
    return [f, scaleText(hass, scale, scale.min + f * (scale.max - scale.min), true)] as const;
  });
}

/** How the card stands now. */
interface Stance {
  readonly usable: boolean;
  /** Switched off: a fan that does not run, a player that is off — the figure is the word for off. */
  readonly off: boolean;
  /**
   * The knob is up: a number's always, a player's volume while the player is on (muted too), a fan's while it runs —
   * each while it says its value.
   */
  readonly awake: boolean;
  /** Drawn in its tone: awake, and neither muted nor switched off. */
  readonly live: boolean;
  /** Something is on — a player sounding, a fan running, a number's switch — what fills a tile and tints a card. */
  readonly on: boolean;
  readonly muted: boolean;
}

/**
 * The Slider card (#77): the light card's anatomy for any value — its head, its big figure with the − and + over
 * Fluvy's ruler (relative drag, slide away to slow down, hold for the fine scale, the keyboard), its words under it —
 * for a media player's volume (its mute as the head's round; the line says what plays, else its source), a `number` or
 * an `input_number` (its range, step and unit, the card's own `min` and `max`, lit from zero where it is signed) and a
 * fan's speed (its switch, its speeds' stops). `toggle_entity` puts another entity's switch in the head: a soundbar
 * whose volume is a `number` and whose power is a switch. Compact, it keeps the head with the figure on its line and
 * the ruler; as a tile it is the house's large tile, with its ruler at its foot.
 */
export class FluvySliderCard extends FluvyTileCard {
  /** The card's height at a 360 column from its config alone (`sliderHeight`). */
  static override layoutHeight(config: LovelaceCardConfig): number {
    return sliderHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(FluvyTileCard.styles as CSSResultGroup[]),
    sheetStyles.slider,
    css`
      /* the sheet fixes 256 so the design sheet's five states line up: the card is as tall as its anatomy */
      .sl-card {
        height: auto;
      }
    `,
  ];

  static override editor(): Promise<CardEditor> {
    return import('./slider-editor.js');
  }

  static override getStubConfig(
    _hass: unknown,
    entities: readonly string[],
  ): LovelaceCardConfig & { entity: string } {
    const entity =
      DOMAINS.map((domain) => entities.find((id) => id.startsWith(`${domain}.`))).find(Boolean) ??
      '';
    return { type: 'custom:fluvy-slider-card', entity };
  }

  /** The head, measured: what gives way in a narrow column is the sub, then the circle — never the control. */
  private readonly head = new HeadFit(this);
  /** The value the finger sets: held until the entity reports it, a stepper's taps sent as one call. */
  private readonly setting = new Level(this, (value) => this.send(value));
  /** A player's mute as the round was last tapped, until the player says so. */
  private readonly mutedHold = new Hold<boolean>(this);

  protected override prepare(config: TileCardConfig): TileCardConfig {
    if (!config.entity) throw new Error('fluvy-slider-card: "entity" is required');
    return config;
  }

  private get slider(): SliderCardConfig {
    return this.config as SliderCardConfig;
  }

  private get variant(): SliderVariant {
    const asked = this.slider.variant;
    return asked && VARIANTS.includes(asked) ? asked : 'full';
  }

  protected override size(): TileSize {
    return 'large';
  }

  /** The entity, and the one whose switch the head carries. */
  protected override watched(): readonly string[] {
    return [this.config?.entity ?? '', this.slider.toggle_entity ?? ''].filter(Boolean);
  }

  override getCardSize(): number {
    return this.variant === 'full' ? 4 : this.variant === 'compact' ? 2 : 3;
  }

  /** The full card needs its value row's width; the compact card and the tile take half a section. */
  override getGridOptions(): LovelaceGridOptions {
    return this.variant === 'full'
      ? { columns: 12, rows: 'auto', min_columns: 6 }
      : { columns: 6, rows: 'auto', min_columns: 6 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mutedHold.clear();
  }

  /** The scale the card draws: a fan's in its speeds, a player's volume in %, a number's own; the card's ends over it. */
  private drawn(view: EntityView): Drawn {
    const own = { min: this.slider.min, max: this.slider.max };
    const kind = kindOf(view);
    if (kind === 'speed') {
      const count = speedCount(view);
      const { minor, major, labels } = speedScale(this.hass, count);
      return {
        scale: { ...PERCENT, step: 100 / count, digits: 0 },
        card: { minor, major },
        tile: { minor: 1 / 12, major },
        labels,
        named: true,
      };
    }
    // a number Home Assistant has not described (gone) draws on 0–100 in its unit
    const scale =
      kind === 'volume'
        ? volumeScale(own)
        : (numberScale(view, own) ?? { ...PERCENT, unit: view.unit });
    const card = ticksOf(scale, 20);
    return {
      scale,
      card,
      tile: ticksOf(scale, 12),
      labels: scaleLabels(this.hass, scale, card),
      named: false,
    };
  }

  /** The switch the head carries: `toggle_entity`'s, else the entity's own where it switches (a fan, a player). */
  private switchId(view: EntityView): string | undefined {
    return this.slider.toggle_entity || (TOGGLE_DOMAINS.has(view.domain) ? view.id : undefined);
  }

  /** What ends the head: as asked, `auto` by the entity — another entity's switch, a player's mute, a fan's switch. */
  private controlOf(view: EntityView): 'mute' | 'switch' | 'none' {
    const asked = this.slider.control ?? 'auto';
    const kind = kindOf(view);
    // a player out of reach keeps its mute where its features say it has one, and where they are not known
    const mutes = kind === 'volume' && (view.supports(VOLUME_MUTE) || view.status === 'missing');
    if (asked === 'none') return 'none';
    if (asked === 'mute') return mutes ? 'mute' : 'none';
    if (asked === 'switch') return this.switchId(view) ? 'switch' : 'none';
    if (this.slider.toggle_entity) return 'switch';
    return mutes ? 'mute' : kind === 'speed' ? 'switch' : 'none';
  }

  /** Whether the switch's entity is on: a player while it is not off, anything else while it says on. */
  private switchedOn(id: string): boolean {
    const sw = this.entity(id);
    const state = this.stateOf(sw);
    return isUsable(sw) && (sw.domain === 'media_player' ? !playerOff(state) : state === 'on');
  }

  private stance(view: EntityView, reading: number | null): Stance {
    const usable = isUsable(view);
    const kind = kindOf(view);
    const muted =
      usable &&
      kind === 'volume' &&
      this.mutedHold.read(view.attr<boolean | null>('is_volume_muted') === true);
    const state = this.stateOf(view);
    const off =
      usable && (kind === 'volume' ? playerOff(state) : kind === 'speed' && state !== 'on');
    const awake = usable && !off && reading !== null;
    // a number is set whatever its switch says; the switch says whether what it sets is on
    const id =
      kind === 'value' && this.controlOf(view) === 'switch' ? this.switchId(view) : undefined;
    const live = awake && !muted && (!id || this.switchedOn(id));
    return { usable, off, awake, live, on: live && (kind !== 'value' || id !== undefined), muted };
  }

  /**
   * The figure as the card says it: its value with its unit ("30 %", "−1.0 °C") — under the finger while a drag is in
   * flight — the word for off for a fan or a player switched off, "—" for what cannot be read or says no value.
   */
  private said(stance: Stance, scale: Scale, reading: number | null, shown: number): string {
    if (stance.off && this.setting.preview === null) return this.t('common.off');
    if (!stance.usable || (reading === null && this.setting.preview === null)) return '—';
    return [scaleText(this.hass, scale, shown), scale.unit].filter(Boolean).join(' ');
  }

  /** A value as the entity takes it: a fan's speed on its floor (`fanPercentage`), a number on its step's decimals. */
  private settle(view: EntityView, scale: Scale, value: number): number {
    return view.domain === 'fan' ? fanPercentage(value) : Number(value.toFixed(digitsOf(scale)));
  }

  private send(value: number): void {
    const view = this.entity();
    const [domain, service, data] = setCall(view, value);
    // a fan set to a speed is on, set to none it is off
    if (view.domain === 'fan') this.expect(view.id, value > 0 ? 'on' : 'off');
    this.call(domain, service, data);
  }

  /** One step up or down from the nearest one on the scale, kept to its ends. */
  private stepped(view: EntityView, scale: Scale, direction: 1 | -1): number {
    const index = Math.round((this.setting.current - scale.min) / scale.step) + direction;
    const next = Math.min(scale.max, Math.max(scale.min, scale.min + index * scale.step));
    return this.settle(view, scale, next);
  }

  /** The value's name: the card's own, else Volume, Speed or Value. */
  private labelOf(view: EntityView): string {
    const kind = kindOf(view);
    return (
      this.slider.label ||
      this.t(kind === 'volume' ? 'common.volume' : kind === 'speed' ? 'fan.speed' : 'helpers.value')
    );
  }

  /**
   * What the line under the name says beside the figure: what a player plays, else its source; a room's name; a
   * number's switch's state while it is off.
   */
  private context(view: EntityView): string {
    if (view.domain === 'media_player')
      return (
        textAttr(view, 'media_title') ||
        textAttr(view, 'source') ||
        view.areaName ||
        stateText(this.hass, view)
      );
    const id = kindOf(view) === 'value' ? this.slider.toggle_entity : undefined;
    if (id && !this.switchedOn(id)) return stateText(this.hass, this.entity(id));
    return view.areaName;
  }

  /** The line of the compact card and the tile: what plays, the room, "Muted", with the figure after; or "Off". */
  private line(view: EntityView, stance: Stance, figure: string): string {
    if (!stance.usable) return this.outOfReach(view);
    if (stance.muted) return `${this.t('common.muted')} · ${figure}`;
    if (stance.off && this.setting.preview === null) return stateText(this.hass, view);
    return [this.context(view), figure].filter(Boolean).join(' · ');
  }

  /** "Unavailable · 2 h ago": the state, and when it last changed where the line holds it. */
  private outOfReach(view: EntityView): string {
    const changed = changedAt(this.hass, view);
    return [stateText(this.hass, view), changed ? relativeTime(this.hass, changed) : '']
      .filter(Boolean)
      .join(' · ');
  }

  /** The head's control: a player's mute as a 44 round, a switch (the entity's own, or another's), or nothing. */
  private renderControl(
    view: EntityView,
    stance: Stance,
    tone: Tone,
    name: string,
  ): TemplateResult | typeof nothing {
    const control = this.controlOf(view);
    if (control === 'mute') {
      const muted = stance.muted;
      return round(
        muted ? 'volumeOff' : 'volume',
        'quiet',
        s(this.hass, muted ? 'unmute' : 'mute'),
        (event) => {
          event.stopPropagation();
          this.mutedHold.set(!muted);
          this.call('media_player', 'volume_mute', { is_volume_muted: !muted });
        },
        !stance.usable || !stance.awake,
      );
    }
    const id = control === 'switch' ? this.switchId(view) : undefined;
    if (!id) return nothing;
    const sw = this.entity(id);
    const on = this.switchedOn(id);
    return toggle(
      on,
      tone,
      (next) => {
        this.expect(id, next ? (sw.domain === 'media_player' ? 'idle' : 'on') : 'off');
        this.call(sw.domain, next ? 'turn_on' : 'turn_off', {}, id);
      },
      name,
      !isUsable(sw) || !stance.usable,
    );
  }

  /** The card's tone: its colour's (`color`, as the accent), its own `tone`, else its entity's (a player's, a fan's). */
  private tone(view: EntityView): Tone {
    return this.accents.pick(this.config?.color) ? 'accent' : (this.config?.tone ?? toneFor(view));
  }

  /* ---------- the tile: the house's large tile, its ruler at its foot ---------- */

  protected override look(item: TileItem, view: EntityView): TileLook {
    const name = this.nameFor(view, item.name);
    const stance = this.stance(view, readingOf(view));
    return {
      name,
      label: name,
      glyph: iconOf(view, item.icon),
      usable: isUsable(view),
      on: stance.on && this.slider.tint !== 'off',
      tone: this.tone(view),
    };
  }

  protected override headControl(
    view: EntityView,
    _lit: boolean,
    tone: Tone,
    label: string,
  ): TemplateResult | typeof nothing {
    return this.renderControl(view, this.stance(view, readingOf(view)), tone, label);
  }

  protected override level(view: EntityView): TileLevel {
    const { scale, tile } = this.drawn(view);
    const reading = readingOf(view);
    const stance = this.stance(view, reading);
    const value = this.setting.read(reading ?? scale.min);
    return {
      value,
      scale,
      ticks: tile,
      label: this.labelOf(view),
      text: this.said(stance, scale, reading, this.setting.preview ?? value),
      awake: stance.awake,
      quiet: !stance.live,
      wakes: view.domain === 'fan',
      commit: (v) => this.setting.set(this.settle(view, scale, v)),
      input: (v) =>
        this.setting.input(this.settle(view, scale, v), this.slider.live_update === true),
    };
  }

  protected override tileLine(
    _item: TileItem,
    view: EntityView,
    _on: boolean,
    level: TileLevel | null,
  ): string {
    const stance = this.stance(view, readingOf(view));
    return this.line(view, stance, level?.text ?? '');
  }

  /** Its tile's line keeps its figure as its compact card's does: where "Muted · 30 %" does not hold, "30 %". */
  protected override keepsFigure(): boolean {
    return true;
  }

  /* ---------- the full card and the compact one: the light card's anatomy ---------- */

  protected override renderCard(): TemplateResult {
    if (this.variant === 'tile')
      return this.renderTile(this.config as TileItem & SliderCardConfig, 'large');
    const config = this.slider;
    const view = this.entity();
    const name = this.nameFor(view, config.name);
    const kind = kindOf(view);
    const reading = readingOf(view);
    const stance = this.stance(view, reading);
    const { usable, awake } = stance;
    const { scale, card: ticks, labels: words, named } = this.drawn(view);
    const level = this.setting.read(reading ?? scale.min);
    const shown = this.setting.preview ?? level;
    const w = this.contentWidth;
    const compact = this.variant === 'compact';
    const label = this.labelOf(view);
    // a fan or a player that is off says so where its figure stands; a drag that wakes a fan shows the speed under it
    const figure = this.said(stance, scale, reading, shown);
    const worded = stance.off && this.setting.preview === null;

    // the line: the compact card says the figure where the full card has its big value ("Bluetooth · 30 %"); the
    // full card says what plays, the room — muted after it — or, out of reach, the state and when it changed
    const sub = compact
      ? this.line(view, stance, figure)
      : !usable
        ? this.outOfReach(view)
        : [
            this.context(view) || (kind === 'value' ? '' : stateText(this.hass, view)),
            stance.muted ? s(this.hass, 'muted_after') : '',
          ]
            .filter(Boolean)
            .join(' · ');
    // where the state's words would not hold beside the control (half a section), the line says the state's one word
    // ("Not found"), else keeps its place, empty — never a word cut; a room's or a source's name ends in its ellipsis,
    // as names do. The compact line keeps its figure first: where it does not hold whole, the figure alone ("45 %")
    const control = this.controlOf(view);
    const fit = (line: string, shorter: readonly string[]): FittedHead =>
      this.head.fit({
        width: w,
        title: name,
        sub: line,
        shorter,
        trailing: control === 'switch' ? SWITCH_SLOT : control === 'mute' ? 44 : 0,
      });
    const whole = fit(sub, usable ? [] : [stateWord(this.hass, view), '\u00a0']);
    const fitted = compact && usable && whole.sub !== sub ? fit(figure, ['\u00a0']) : whole;

    // its tone on its surface, as the light card's (`tint`): lit while something is on, a quiet wash at rest
    const tone = this.tone(view);
    const own = this.accents.pick(config.color);
    const tint = config.tint ?? 'off';
    const lit = stance.on && (tint === 'on' || tint === 'always');
    const surface =
      !lit && tint === 'always' && usable && !config.card_color
        ? this.accents.lit(own && own !== PALETTE_ACCENT ? own : tone, 0)
        : undefined;

    // the words under the ruler: the fine scale's while it is up; a fan's speeds that stand apart; a scale's figures,
    // its ends and its middle in a compact card or a narrow column — and under a bar or a liquid, as the config says
    const look = sliderStyleOf(this.config);
    const styled = sliderWordsOf(this.config, words, look);
    const thinned =
      !named && (compact || w < ALL_LABELS_FROM) && styled.length > 3
        ? [styled[0]!, styled[(styled.length - 1) / 2]!, styled[styled.length - 1]!]
        : styled;
    const ticksWords =
      this.setting.fineLabels((v) => scaleText(this.hass, scale, v, true)) ??
      heldLabels(this.head.ruler, w, thinned);

    return html`<article
      class="fv-card sl-card ${usable ? '' : 'is-unavailable is-off'} ${compact ? 'sl-card--compact' : ''} ${lit ? `is-lit fv-tone--${tone}` : ''}"
      data-card
      data-surface=${surface ?? nothing}
    >
      ${head({
        icon: fitted.icon ? (usable || this.looksQuiet ? iconOf(view, config.icon) : 'ban') : null,
        small: fitted.small,
        tone: usable ? (stance.live ? tone : 'neutral') : 'off',
        title: name,
        name: true,
        sub: fitted.sub,
        trailing: this.renderControl(view, stance, tone, name),
        cut: fitted.cut,
        ...this.headActions(view.id),
      })}
      ${
        compact
          ? nothing
          : levelRow(this.head.ruler, {
              width: w,
              label,
              figures: [
                { value: scaleText(this.hass, scale, scale.min), unit: scale.unit },
                { value: scaleText(this.hass, scale, scale.max), unit: scale.unit },
                ...(kind === 'value' ? [] : [{ value: this.t('common.off') }]),
              ],
              value: worded || figure === '—' ? figure : scaleText(this.hass, scale, shown),
              unit: worded || figure === '—' ? '' : scale.unit,
              stepper: config.show_stepper !== false,
              // a player that is off has no volume to step; a fan's stepper wakes it
              disabled: !usable || (kind === 'volume' && !awake),
              quiet: usable && !stance.live,
              decrease: `${label} · ${this.t('common.decrease')}`,
              increase: `${label} · ${this.t('common.increase')}`,
              onStep: (d) => this.setting.step(this.stepped(view, scale, d)),
              tap: () => this.readoutTap(view.id, `${name} · ${label} ${figure}`),
            })
      }
      <div class="sl-bubble-row"></div>
      <fluvy-ruler
        .value=${awake ? Math.round((level - scale.min) / scale.step) * scale.step + scale.min : scale.min}
        .min=${scale.min}
        .max=${scale.max}
        .step=${scale.step}
        .origin=${scale.origin}
        .length=${w}
        .minor=${ticks.minor}
        .major=${ticks.major}
        .tone=${stance.live ? tone : 'neutral'}
        ?disabled=${!usable}
        ?inactive=${!awake}
        ?wake=${usable && kind === 'speed'}
        ?on-fill=${lit}
        .look=${look}
        ?still=${sliderStill()}
        unit=${scale.unit}
        .label=${`${name} · ${label}`}
        .format=${(v: number) => scaleText(this.hass, scale, v)}
        @fluvy-input=${(e: CustomEvent<RulerChangeDetail>) =>
          this.setting.input(this.settle(view, scale, e.detail.value), config.live_update === true)}
        @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) =>
          this.setting.set(this.settle(view, scale, e.detail.value))}
        @fluvy-window=${(e: CustomEvent<RulerWindowDetail>) => this.setting.zoom(e.detail)}
      ></fluvy-ruler>
      ${rulerLabels(ticksWords)}
    </article>`;
  }
}
