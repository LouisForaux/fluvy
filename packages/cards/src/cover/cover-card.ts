import { coverClassLabel } from './class-label.js';
import {
  formatNumber,
  isUsable,
  numberAttr,
  sliderStill,
  sliderStyleOf,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  actions,
  clamp,
  head,
  label,
  readout,
  sheetStyles,
  stepper,
  type ActionItem,
  type ChipItem,
  type RulerChangeDetail,
  type RulerWindowDetail,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card, type CardEditor } from '../shared/base.js';

import { iconOf } from '../shared/domain.js';
import {
  actionGap,
  actionsThatFit,
  Burst,
  headSub,
  Hold,
  motionStyles,
  releasePresses,
  shownStateText,
  StableTemplate,
} from './common.js';
import { ITEM_ALIASES, type AliasSpec, type RowStyle } from '../shared/config.js';
import { chipRow } from '../shared/chips.js';
import { HeadFit } from '../energy/head.js';
import { COMPACT, drawnAs, listLength } from '../shared/heights.js';
import {
  fitValueRow,
  STEPPER,
  STEPPER_HALVES,
  valueRowClass,
  type Reading,
  type RowLayout,
} from '../shared/value-row.js';

const coverStrings = strings('cover');

/** One saved place for a cover: "Morning · 60 %". `position` and `tilt` are percentages, 100 = open. */
export interface CoverFavorite {
  name?: string;
  position?: number;
  tilt?: number;
}

/** `full` (default): the position ruler, tilt, the actions and the favourites. `compact`: the head and the actions. */
export type CoverVariant = 'full' | 'compact';

export interface CoverCardConfig extends FluvyCardConfig {
  subtitle?: string;
  variant?: CoverVariant;
  favorites?: readonly CoverFavorite[];
  /** Favourites as chips filling the row (default) or content-sized. */
  favorites_style?: RowStyle;
  show_tilt?: boolean;
  show_favorites?: boolean;
  /** The slats' angle at 100 % tilt. When set, tilt reads and steps in degrees (15°) instead of percent. */
  tilt_angle?: number;
}

/* cover / valve supported_features */
const OPEN = 1;
const CLOSE = 2;
const SET_POSITION = 4;
const STOP = 8;
const OPEN_TILT = 16;
const CLOSE_TILT = 32;
const SET_TILT_POSITION = 128;
/** What a cover draws where the house is not there to say (`layoutHeight`; one never read): position, commands. */
const USUAL = OPEN | CLOSE | SET_POSITION | STOP;

/**
 * The card's height at a 360 column, for the automatic dashboard's columns, for what the cover does (`features`, as
 * the house describes it: `house-heights.ts`): the ruler with its side column where it takes a position (the whole
 * card where the house is not there to say); else the tilt's readout and stepper over the commands; else the head
 * and the commands.
 */
export function coverHeight(config: CoverCardConfig, features = USUAL): number {
  if (config.variant === 'compact') return COMPACT;
  const tilt =
    config.show_tilt !== false && (features & (SET_TILT_POSITION | OPEN_TILT | CLOSE_TILT)) !== 0;
  const positioned = (features & SET_POSITION) !== 0;
  const favorites = config.show_favorites !== false && listLength(config, ['favorites']) ? 88 : 0;
  return positioned ? 328 + favorites : tilt ? 224 : COMPACT;
}

/** The ruler's band, and its words (56) with the 8 before the band: what the side column beside them does not get. */
const RULER_BAND = 44;
const RULER_WORDS = 64;
/** The side column's room, best first: 24 from the ruler and its words, 16 from them, 16 from the band alone. */
const SIDE_ROOM = [
  { gap: 24, words: true },
  { gap: 16, words: true },
  { gap: 16, words: false },
] as const;

type Percent = number | null;

/** Positions are whole percents; a device that answers 59 for 60 has arrived. */
const near = (a: Percent, b: Percent): boolean => a !== null && b !== null && Math.abs(a - b) <= 1;

const percentAttr = (view: EntityView, key: string): Percent => {
  const value = numberAttr(view, key);
  return value === null ? null : clamp(Math.round(value), 0, 100);
};

/**
 * Blinds, shades, garage doors, gates — and valves, which Home Assistant models the same way.
 * The vertical ruler is the position (open at the top, closed at the bottom), the side column
 * carries the two numbers, and the open / stop / close row runs the full width under them.
 *
 * A blind takes its time: the knob and the number hold the position that was asked for while the
 * cover says it is travelling, instead of snapping back to where the motor happens to be.
 */
export class FluvyCoverCard extends Card<CoverCardConfig> {
  /** The card's height at a 360 column from its config alone: the whole card (`coverHeight`). */
  static override layoutHeight(config: CoverCardConfig): number {
    return coverHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    motionStyles,
    css`
      /* the sheet drew 65 %: at 0 % and 100 % the 36 px knob needs 18 px past the scale's ends, clear of the head and of the action row */
      .dv-cover {
        margin-top: 24px;
        margin-bottom: 8px;
      }
      /* a side column too narrow for the tilt's stepper beside its readout: the stepper under it (its halves at 44
         under 96), the 24 from the ruler closed to 16, then the ruler's words given way (sideFit) */
      .dv-cover--tight .dv-cover__side {
        gap: 8px;
      }
      .dv-cover--tight .dv-cover__tilt {
        display: block;
        height: auto;
      }
      .dv-cover--tight .dv-cover__tilt .fv-stepper {
        margin-top: 8px;
      }
      .dv-cover--narrow {
        gap: 16px;
      }
      .dv-cover--bare .dv-vlabels {
        display: none;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    dragged: { state: true },
    fine: { state: true },
  };

  /** Position under the finger while the ruler is being dragged. */
  declare dragged: Percent;
  /** The tenth of the range the ruler shows while its fine scale is up: the end labels become numbers. */
  declare fine: RulerWindowDetail | null;

  private travelling = false;
  private readonly target = new Hold<Percent>(this, () => this.travelling);
  private readonly tiltHold = new Hold<Percent>(this);
  private readonly tiltBurst = new Burst();
  private readonly tiltStepper = new StableTemplate(this);

  constructor() {
    super();
    this.dragged = null;
    this.fine = null;
  }

  static override editor(): Promise<CardEditor> {
    return import('./cover-editor.js');
  }
  static override aliases: AliasSpec = { items: { favorites: ITEM_ALIASES } };

  static getStubConfig(_hass: unknown, entities: readonly string[]): CoverCardConfig {
    return {
      type: 'custom:fluvy-cover-card',
      entity: entities.find((id) => /^(cover|valve)\./.test(id)) ?? '',
    };
  }

  protected override prepare(config: CoverCardConfig): CoverCardConfig {
    if (!config.entity) throw new Error('fluvy-cover-card: "entity" is required');
    if (config.favorites !== undefined && !Array.isArray(config.favorites))
      throw new Error('fluvy-cover-card: "favorites" must be a list of { name, position, tilt }');
    return config;
  }

  private readonly head = new HeadFit(this);

  private get compact(): boolean {
    return this.config?.variant === 'compact';
  }

  override getCardSize(): number {
    if (this.compact) return 3;
    const view = drawnAs(this.entity(), USUAL);
    return 3 + (view.supports(SET_POSITION) ? 4 : 0) + (this.favoritesFor(view).length ? 2 : 0);
  }

  /** The full card needs its ruler's width; the compact one — the head and the actions — half a section at least. */
  override getGridOptions(): LovelaceGridOptions {
    return this.compact
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 8 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    releasePresses(this.renderRoot);
    this.tiltBurst.flush();
    this.target.clear();
    this.tiltHold.clear();
  }

  /** The favourites this cover can actually reach: a position needs SET_POSITION, a tilt needs SET_TILT_POSITION. */
  private favoritesFor(view: EntityView): readonly CoverFavorite[] {
    const position = view.supports(SET_POSITION);
    const tilt = view.domain === 'cover' && view.supports(SET_TILT_POSITION);
    return (this.config?.favorites ?? []).filter(
      (f) =>
        f !== null &&
        typeof f === 'object' &&
        ((position && typeof f.position === 'number') || (tilt && typeof f.tilt === 'number')),
    );
  }

  /** Degrees at 100 % tilt, or 0 when tilt reads in percent. */
  private get tiltAngle(): number {
    const angle = this.config?.tilt_angle;
    return typeof angle === 'number' && angle > 0 ? angle : 0;
  }

  private tiltOf(view: EntityView): Percent {
    return this.tiltHold.read(percentAttr(view, 'current_tilt_position'), near);
  }

  private command(view: EntityView, key: string): void {
    const valve = view.domain === 'valve';
    const positioned =
      view.supports(SET_POSITION) && percentAttr(view, 'current_position') !== null;
    if (key === 'stop') {
      this.target.clear();
      this.expect(view.id, view.state); // drops an "Opening" we were still expecting
      this.call(view.domain, valve ? 'stop_valve' : 'stop_cover');
      return;
    }
    const open = key === 'open';
    if (positioned) this.target.set(open ? 100 : 0);
    this.expect(view.id, open ? 'opening' : 'closing');
    this.call(
      view.domain,
      valve ? (open ? 'open_valve' : 'close_valve') : open ? 'open_cover' : 'close_cover',
    );
  }

  private moveTo(view: EntityView, position: number): void {
    const value = clamp(Math.round(position), 0, 100);
    this.dragged = null;
    this.target.set(value);
    this.expect(view.id, view.state); // a new destination: drops an "Opening" still expected from the row
    this.call(view.domain, view.domain === 'valve' ? 'set_valve_position' : 'set_cover_position', {
      position: value,
    });
  }

  /** One step of the tilt stepper: 10 % at a time, or 5° when the card reads in degrees. Quick steps make one call. */
  private stepTilt(direction: 1 | -1): void {
    const view = this.entity();
    if (view.status === 'unavailable' || view.status === 'missing') return;
    if (!view.supports(SET_TILT_POSITION)) {
      this.call('cover', direction > 0 ? 'open_cover_tilt' : 'close_cover_tilt');
      return;
    }
    const angle = this.tiltAngle;
    const perPercent = angle ? angle / 100 : 1;
    const grid = angle ? 5 : 10;
    const shown = Math.round((this.tiltOf(view) ?? 0) * perPercent);
    const next =
      direction > 0
        ? Math.floor(shown / grid) * grid + grid
        : Math.ceil(shown / grid) * grid - grid;
    const tilt = clamp(Math.round(next / perPercent), 0, 100);
    this.tiltHold.set(tilt);
    this.tiltBurst.push(() =>
      this.call('cover', 'set_cover_tilt_position', { tilt_position: tilt }),
    );
  }

  private applyFavorite(view: EntityView, favorite: CoverFavorite): void {
    if (typeof favorite.position === 'number' && view.supports(SET_POSITION))
      this.moveTo(view, favorite.position);
    if (typeof favorite.tilt === 'number' && view.supports(SET_TILT_POSITION)) {
      const tilt = clamp(Math.round(favorite.tilt), 0, 100);
      this.tiltHold.set(tilt);
      this.call('cover', 'set_cover_tilt_position', { tilt_position: tilt });
    }
  }

  private percent(value: number): string {
    return `${formatNumber(this.hass, value, { digits: 0 })} %`;
  }

  /** "Morning · 60 %", "Night · closed", or just "60 %" when the favourite has no name. */
  private favoriteLabel(favorite: CoverFavorite): string {
    const position = favorite.position;
    const value =
      typeof position === 'number'
        ? position >= 100
          ? this.t('common.open')
          : position <= 0
            ? this.t('common.closed')
            : this.percent(position)
        : `${this.t('cover.tilt')} ${this.percent(favorite.tilt ?? 0)}`;
    return favorite.name ? `${favorite.name} · ${value.toLowerCase()}` : value;
  }

  /**
   * The side column beside the ruler, measured, never a width threshold: its readouts at m (the position, fully open;
   * the tilt, fully tilted) and the tilt's stepper beside its readout, else under it (its halves at 44 under 96).
   * Where the column cannot hold them with the ruler's words and 24 between, the 24 closes to 16, then the ruler's
   * words give way: its knob and the position say where the cover is, the commands under them which way it opens.
   */
  private sideFit(
    tilt: { readonly label: string; readonly figure: Reading; readonly canTilt: boolean } | null,
  ): { readonly gap: number; readonly words: boolean; readonly tilt: RowLayout } {
    const ruler = this.head.ruler;
    const width = (label: string, figure: Reading): number =>
      Math.max(
        ruler.width('fv-readout > fv-readout__label', label),
        ruler.width(
          'fv-readout fv-readout--m > fv-readout__value',
          figure.value,
          'fv-unit',
          figure.unit ?? '',
        ),
      );
    // the column holds the readouts and, under the tilt's readout at the least, its whole stepper
    const need = Math.max(
      width(this.t('cover.position'), {
        value: formatNumber(this.hass, 100, { digits: 0 }),
        unit: '%',
      }),
      tilt ? width(tilt.label, tilt.figure) : 0,
      tilt?.canTilt ? STEPPER : 0,
    );
    const column = (room: (typeof SIDE_ROOM)[number]): number =>
      this.contentWidth - RULER_BAND - room.gap - (room.words ? RULER_WORDS : 0);
    const room = SIDE_ROOM.find((room) => column(room) >= need) ?? SIDE_ROOM[2];
    return {
      ...room,
      tilt: tilt
        ? fitValueRow(ruler, {
            width: column(room),
            control: tilt.canTilt ? STEPPER : 0,
            narrow: STEPPER_HALVES,
            labels: [tilt.label],
            figures: [tilt.figure],
            sizes: ['m'],
          }).layout
        : 'alone',
    };
  }

  protected renderCard(): TemplateResult {
    // out of reach (unavailable, missing; never read: its usual parts) it keeps its anatomy and its size, its controls
    // disabled: only the colours change (1.9)
    const view = drawnAs(this.entity(), USUAL);
    const name = this.nameFor(view, this.config?.name);
    const valve = view.domain === 'valve';
    const unusable = !isUsable(view);
    const compact = this.compact;
    const reported = percentAttr(view, 'current_position');
    // Home Assistant's own rule for the ends: the position when there is one, the state otherwise
    const fullyOpen = reported !== null ? reported >= 100 : view.state === 'open';
    const fullyClosed = reported !== null ? reported <= 0 : view.state === 'closed';
    // the travel is over once the cover says so, even if the "Opening" we expected never came
    const expected = this.stateOf(view);
    const shown =
      (expected === 'opening' && fullyOpen) || (expected === 'closing' && fullyClosed)
        ? view.state
        : expected;
    const moving = shown === 'opening' || shown === 'closing';
    this.travelling = moving;

    const position = reported === null ? null : (this.dragged ?? this.target.read(reported, near));
    const tilt = this.tiltOf(view);
    const open = view.status === 'ok' && (position !== null ? position > 0 : shown !== 'closed');
    const active: Tone = valve ? 'water' : 'accent';
    const tone: Tone = unusable ? 'off' : open || moving ? active : 'neutral';

    const canPosition = view.supports(SET_POSITION);
    const canTilt =
      !valve &&
      (view.supports(SET_TILT_POSITION) || view.supports(OPEN_TILT) || view.supports(CLOSE_TILT));
    const showTilt =
      !valve && !compact && this.config?.show_tilt !== false && (canTilt || tilt !== null);

    // a cover whose state is only assumed (one-way radio) keeps both directions live, as Home Assistant does
    const assumed = view.attr<boolean>('assumed_state') === true;
    const row: ActionItem[] = [];
    if (view.supports(OPEN))
      row.push({
        key: 'open',
        glyph: 'up',
        label: this.t('cover.open'),
        disabled: unusable || (!assumed && (fullyOpen || shown === 'opening')),
      });
    if (view.supports(STOP))
      row.push({ key: 'stop', glyph: 'stop', label: this.t('cover.stop'), disabled: unusable });
    if (view.supports(CLOSE))
      row.push({
        key: 'close',
        glyph: 'down',
        label: this.t('cover.close'),
        disabled: unusable || (!assumed && (fullyClosed || shown === 'closing')),
      });

    const favorites =
      compact || this.config?.show_favorites === false ? [] : this.favoritesFor(view);
    // a compact card narrower than three cells keeps open and close (stop steps aside); one too narrow for
    // those keeps its head alone — the card's real width decides, not the drawing floor
    if (compact) {
      const fit = actionsThatFit(this.contentWidth);
      if (row.length > fit && row.some((item) => item.key === 'stop'))
        row.splice(
          row.findIndex((item) => item.key === 'stop'),
          1,
        );
      if (row.length > fit) row.splice(fit);
    }
    const chipItems: ChipItem[] = favorites.map((favorite, index) => ({
      key: String(index),
      label: this.favoriteLabel(favorite),
      active:
        !unusable &&
        (typeof favorite.position !== 'number' || near(position, Math.round(favorite.position))) &&
        (typeof favorite.tilt !== 'number' || near(tilt, Math.round(favorite.tilt))),
    }));

    const fine = this.fine;
    const angle = this.tiltAngle;
    const tiltLabel = this.t('cover.tilt');
    const tiltUnit = angle ? '°' : '%';
    const tiltValue =
      tilt === null
        ? '—'
        : formatNumber(this.hass, angle ? (tilt * angle) / 100 : tilt, { digits: 0 });
    // the tilt's row laid out for its widest figure (fully tilted), never for the one it shows now: beside the
    // ruler in the side column, or across the card where the cover has no position
    const tiltFigure = {
      value: formatNumber(this.hass, angle || 100, { digits: 0 }),
      unit: tiltUnit,
    };
    const side =
      canPosition && !compact
        ? this.sideFit(showTilt ? { label: tiltLabel, figure: tiltFigure, canTilt } : null)
        : null;
    const tiltFit =
      !canPosition && showTilt
        ? fitValueRow(this.head.ruler, {
            width: this.contentWidth,
            control: canTilt ? STEPPER : 0,
            narrow: STEPPER_HALVES,
            labels: [tiltLabel],
            figures: [tiltFigure],
          })
        : null;
    const tiltLayout = side?.tilt ?? tiltFit?.layout ?? 'alone';
    const tiltReadout = readout({
      label: tiltLabel,
      size: tiltFit?.size ?? 'm',
      value: tiltValue,
      unit: tilt === null ? '' : tiltUnit,
    });
    const tiltStepper =
      canTilt && tiltLayout !== 'alone'
        ? this.tiltStepper.get(`${tiltLabel}|${unusable}`, () =>
            stepper((direction) => this.stepTilt(direction), {
              disabled: unusable,
              decrease: `${tiltLabel} · ${this.t('common.decrease')}`,
              increase: `${tiltLabel} · ${this.t('common.increase')}`,
            }),
          )
        : nothing;

    const classLabel = coverClassLabel(this.hass, view.domain, view.deviceClass);
    const sub =
      this.config?.subtitle ??
      (view.areaName
        ? [view.areaName, classLabel].filter(Boolean).join(' · ')
        : classLabel.charAt(0).toUpperCase() + classLabel.slice(1));

    // the head fitted to its column: the badge steps aside before the name is cut, then the sub, then the icon
    const fitted = this.head.fit({
      width: this.contentWidth,
      title: name,
      sub: headSub(sub, this.contentWidth),
      badge: { text: shownStateText(this.hass, view, shown), tone },
    });
    // the commands in equal cells, two rows where one would leave a cell under a finger's 44
    const cells = actionGap(this.contentWidth, row.length);
    return html`<article
      class="fv-card dv-card ${unusable ? 'is-unavailable is-off' : ''}"
      style="--dv-action-gap:${cells.gap}px"
      data-card
    >
      ${head({
        icon: fitted.icon ? iconOf(view, this.config?.icon) : null,
        tone,
        title: name,
        name: true,
        sub: fitted.sub,
        trailing: fitted.badge,
        cut: fitted.cut,
        ...this.headActions(view.id),
      })}
      ${
        side
          ? html` <div
              class="dv-cover ${tiltLayout === 'stack' || tiltLayout === 'halves' ? 'dv-cover--tight' : ''} ${side.gap === 16 ? 'dv-cover--narrow' : ''} ${side.words ? '' : 'dv-cover--bare'}"
            >
              <div class="dv-cover__ruler">
                <div class="dv-vlabels" style="height:160px">
                  <span style="top:0">${fine ? this.percent(fine.max) : this.t('common.open')}</span
                  ><span style="top:160px"
                    >${fine ? this.percent(fine.min) : this.t('common.closed')}</span
                  >
                </div>
                <fluvy-ruler
                  vertical
                  .value=${position ?? 0}
                  .min=${0}
                  .max=${100}
                  .step=${1}
                  .length=${160}
                  .band=${44}
                  .tone=${open || moving ? active : 'neutral'}
                  ?inactive=${unusable || position === null}
                  ?disabled=${unusable}
                  .look=${sliderStyleOf(this.config)}
                  ?still=${sliderStill()}
                  unit="%"
                  .label=${`${name} · ${this.t('cover.position')}`}
                  .format=${(value: number) => formatNumber(this.hass, value, { digits: 0 })}
                  @fluvy-input=${(event: CustomEvent<RulerChangeDetail>) => {
                    this.dragged = event.detail.value;
                  }}
                  @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.moveTo(view, event.detail.value)}
                  @fluvy-window=${(event: CustomEvent<RulerWindowDetail>) => {
                    this.fine = event.detail.fine ? event.detail : null;
                  }}
                ></fluvy-ruler>
              </div>
              <div class="dv-cover__side">
                ${readout({ label: this.t('cover.position'), value: position === null ? '—' : formatNumber(this.hass, position, { digits: 0 }), unit: position === null ? '' : '%' })}
                ${showTilt ? html`<div class="dv-cover__tilt ${tiltLayout === 'halves' ? 'fv-value-row--halves' : ''}">${tiltReadout}${tiltStepper}</div>` : nothing}
              </div>
            </div>`
          : tiltFit
            ? html`<div class="dv-value ${valueRowClass(tiltFit.layout)}">
                ${tiltReadout}${tiltStepper}${canTilt && tiltFit.layout === 'alone' ? this.readoutTap(view.id, `${name} · ${tiltLabel} ${tiltValue} ${tilt === null ? '' : tiltUnit}`) : nothing}
              </div>`
            : nothing
      }
      ${row.length ? actions(row, (key) => this.command(view, key), cells.columns) : nothing}
      ${
        chipItems.length
          ? html`${label(coverStrings(this.hass, 'favourites'))}${chipRow(
              chipItems,
              (key) => {
                const favorite = favorites[Number(key)];
                if (favorite && !unusable) this.applyFavorite(view, favorite);
              },
              this.config?.favorites_style,
              { ruler: this.head.ruler, width: this.contentWidth },
            )}`
          : nothing
      }
    </article>`;
  }
}
