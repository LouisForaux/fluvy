import {
  formatNumber,
  isUsable,
  localize,
  numberAttr,
  stateText,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  clamp,
  head,
  label,
  listRow,
  readout,
  rulerLabels,
  sheetStyles,
  stepper,
  toggle,
  type ChipItem,
  type RulerChangeDetail,
  type RulerWindowDetail,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card, type CardEditor } from '../shared/base.js';

import { iconOf } from '../shared/domain.js';
import { Burst, Hold, motionStyles, releasePresses, StableTemplate } from '../cover/common.js';
import type { RowStyle, WhenOff } from '../shared/config.js';
import { chipRow } from '../shared/chips.js';
import { modeWord, pretty } from '../shared/mode-words.js';
import { HeadFit, SWITCH_SLOT } from '../energy/head.js';
import { heldLabels, type Labels } from '../shared/axis.js';
import { chipBlock, chipRows, COMPACT, drawnAs, ROW } from '../shared/heights.js';
import { fanPercentage } from '../shared/scale.js';
import { fitValueRow, STEPPER, STEPPER_HALVES, valueRowClass } from '../shared/value-row.js';

const fanStrings = strings('fan');

/** `full` (default): the speed with its stepper and ruler, the rows and the presets. `compact`: the head and the ruler. */
export type FanVariant = 'full' | 'compact';

export interface FanCardConfig extends FluvyCardConfig {
  subtitle?: string;
  variant?: FanVariant;
  /** The − and + beside the full card's speed (default). Off: the speed is set on its ruler, and the readout is the card's tap. */
  show_stepper?: boolean;
  show_presets?: boolean;
  /** Presets as chips filling the row (default) or content-sized. */
  preset_style?: RowStyle;
  show_oscillation?: boolean;
  show_direction?: boolean;
  /** While the fan is off: everything (default), or `essentials` — the switch and the speed ruler; presets, oscillation and direction wait for it to run. */
  when_off?: WhenOff;
}

/* fan supported_features */
const SET_SPEED = 1;
const OSCILLATE = 2;
const DIRECTION = 4;
const PRESET_MODE = 8;
/** What a fan draws where the house is not there to say (`layoutHeight`; one never read): its speed and both rows. */
const USUAL = SET_SPEED | OSCILLATE | DIRECTION;

type Direction = 'forward' | 'reverse';

/**
 * The card's height at a 360 column, for the automatic dashboard's columns: the head, the speed with its stepper and
 * its ruler (228), then the oscillation and direction rows (16 + 60 each) the fan has, and its presets as a row of
 * chips under their label — what it does (`features`) and its presets as the house describes them
 * (`house-heights.ts`), its speed and both rows where it is not there to say. A card that keeps to the essentials
 * while off is reserved its height when on.
 */
export function fanHeight(
  config: FanCardConfig,
  features = USUAL,
  presets: readonly string[] = [],
): number {
  if (config.variant === 'compact') return COMPACT;
  const rows =
    (config.show_oscillation !== false && features & OSCILLATE ? 1 : 0) +
    (config.show_direction !== false && features & DIRECTION ? 1 : 0);
  const shown = config.show_presets === false || !(features & PRESET_MODE) ? [] : presets;
  return (
    228 +
    (rows ? 16 + ROW * rows : 0) +
    chipBlock(chipRows(shown.map(pretty), config.preset_style === 'chips' ? 'chips' : 'full'))
  );
}

/** How many speeds the fan has: `percentage_step` is 100 / speed_count, and 1 on a continuous fan. */
export function speedCount(view: EntityView): number {
  const step = numberAttr(view, 'percentage_step');
  return step !== null && step > 0 && step <= 100 ? Math.max(1, Math.round(100 / step)) : 100;
}

/**
 * A fan's ticks and words for its ruler, in its own speeds: two and three speeds are named stops (Low · Mid · High under
 * the ruler, its majors on them); anything finer is a plain 0–100 scale. The Slider card draws a fan's speed with it.
 */
export function speedScale(
  hass: HomeAssistant | undefined,
  count: number,
): { minor: number; major: number; labels: Labels } {
  const off = localize(hass, 'common.off');
  const low = fanStrings(hass, 'low');
  const mid = fanStrings(hass, 'mid');
  const high = fanStrings(hass, 'high');
  if (count === 2)
    return {
      minor: 0.05,
      major: 0.5,
      labels: [
        [0, off],
        [0.5, low],
        [1, high],
      ],
    };
  if (count === 3)
    return {
      minor: 1 / 18,
      major: 1 / 3,
      labels: [
        [0, off],
        [1 / 3, low],
        [2 / 3, mid],
        [1, high],
      ],
    };
  return {
    minor: 0.05,
    major: 0.25,
    labels: [
      [0, off],
      [0.25, low],
      [0.5, mid],
      [0.75, high],
      [1, localize(hass, 'common.max')],
    ],
  };
}

/**
 * The fan: the speed as the card's one big number with its stepper and ruler, then oscillation and
 * direction as rows and the integration's presets as chips. Everything moves in the fan's own
 * speeds — a three-speed fan has three stops, named Low · Mid · High under the ruler, and the
 * percentage sent is the one Home Assistant maps back onto that speed. The head glyph turns while it runs.
 */
export class FluvyFanCard extends Card<FanCardConfig> {
  /** The card's height at a 360 column from its config alone: its speed and both rows (`fanHeight`). */
  static override layoutHeight(config: FanCardConfig): number {
    return fanHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    motionStyles,
    css`
      /* the sheet's own 12 px above the ruler: in a card the ruler is a custom element */
      .dv-card > fluvy-ruler {
        display: block;
        margin-top: 12px;
      }
      /* the compact card's one row: the 40 ruler centred in a 44 row, as every row of the language */
      .dv-fan__row {
        display: flex;
        align-items: center;
        height: 44px;
        margin-top: 16px;
      }
      .dv-fan__row > fluvy-ruler {
        display: block;
        margin-top: 0;
      }
      /* an unavailable card already dims as a whole: its rows do not dim a second time */
      .is-unavailable .is-unavailable {
        opacity: 1;
      }

      /*
       * The blades turn while the fan runs, on the compositor and in CSS alone. Two turns are stacked —
       * the circle and the glyph inside it — and the speed is which of them run (slow, fast, both), so a
       * change of speed pauses or resumes a turn and the blades never jump; off pauses both where they are.
       */
      @keyframes dv-fan-turn {
        to {
          rotate: 360deg;
        }
      }
      .dv-fan .fv-card__head .fv-ico {
        animation: dv-fan-turn 7.2s linear infinite;
        animation-play-state: var(--dv-fan-slow, paused);
      }
      .dv-fan .fv-card__head .fv-ico > * {
        animation: dv-fan-turn 3.6s linear infinite;
        animation-play-state: var(--dv-fan-fast, paused);
      }

      @media (prefers-reduced-motion: reduce) {
        .dv-fan .fv-card__head .fv-ico,
        .dv-fan .fv-card__head .fv-ico > * {
          animation: none !important;
        }
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    dragged: { state: true },
    fine: { state: true },
  };

  /** Speed under the finger while the ruler is being dragged. */
  declare dragged: number | null;
  /** The tenth of the range the ruler shows while its fine scale is up. */
  declare fine: RulerWindowDetail | null;

  private readonly speedHold = new Hold<number | null>(this);
  private readonly oscillatingHold = new Hold<boolean>(this);
  private readonly directionHold = new Hold<Direction | null>(this);
  private readonly head = new HeadFit(this);
  private readonly presetHold = new Hold<string | null>(this);
  private readonly speedBurst = new Burst();
  private readonly speedStepper = new StableTemplate(this);

  constructor() {
    super();
    this.dragged = null;
    this.fine = null;
  }

  static override editor(): Promise<CardEditor> {
    return import('./fan-editor.js');
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): FanCardConfig {
    return {
      type: 'custom:fluvy-fan-card',
      entity: entities.find((id) => id.startsWith('fan.')) ?? '',
    };
  }

  protected override prepare(config: FanCardConfig): FanCardConfig {
    if (!config.entity) throw new Error('fluvy-fan-card: "entity" is required');
    return config;
  }

  private get compact(): boolean {
    return this.config?.variant === 'compact';
  }

  override getCardSize(): number {
    if (this.compact) return 3;
    const view = drawnAs(this.entity(), USUAL);
    return (
      2 +
      (view.supports(SET_SPEED) ? 3 : 0) +
      (view.supports(OSCILLATE) ? 1 : 0) +
      (view.supports(DIRECTION) ? 1 : 0) +
      (view.supports(PRESET_MODE) ? 2 : 0)
    );
  }

  /**
   * The full card needs its ruler's width; the compact one — the head and the ruler — half a section (a third left its
   * name no room beside the switch).
   */
  override getGridOptions(): LovelaceGridOptions {
    return this.compact
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 8 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    releasePresses(this.renderRoot);
    this.speedBurst.flush();
    for (const hold of [this.speedHold, this.oscillatingHold, this.directionHold, this.presetHold])
      hold.clear();
  }

  /** The speed to draw: null when the fan cannot say (unknown, or a preset that runs its own speed). */
  private speedOf(view: EntityView, on: boolean): number | null {
    const reported = numberAttr(view, 'percentage');
    const speed =
      view.status !== 'ok' ? null : !on ? 0 : reported === null ? null : clamp(reported, 0, 100);
    const tolerance = 50 / speedCount(view);
    return this.speedHold.read(
      speed,
      (a, b) => a !== null && b !== null && Math.abs(a - b) <= tolerance,
    );
  }

  /** The speed set, held until the fan reports it; a stepper's taps coalesce into one call (`fanPercentage`). */
  private setSpeed(view: EntityView, value: number, coalesce: boolean): void {
    const percentage = fanPercentage(value);
    this.dragged = null;
    this.speedHold.set(percentage);
    this.expect(view.id, percentage > 0 ? 'on' : 'off');
    const send = (): void => this.call('fan', 'set_percentage', { percentage });
    if (coalesce) this.speedBurst.push(send);
    else {
      this.speedBurst.flush();
      send();
    }
  }

  /** One stop up or down from the nearest one — read at the moment of the step, so a held button keeps walking. */
  private stepSpeed(direction: 1 | -1): void {
    const view = this.entity();
    if (view.status === 'unavailable' || view.status === 'missing') return;
    const count = speedCount(view);
    const current = this.speedOf(view, this.stateOf(view) === 'on') ?? 0;
    const index = clamp(Math.round((current * count) / 100) + direction, 0, count);
    this.setSpeed(view, (index * 100) / count, true);
  }

  private power(view: EntityView, next: boolean): void {
    this.speedBurst.flush();
    this.speedHold.clear();
    this.expect(view.id, next ? 'on' : 'off');
    this.call('fan', next ? 'turn_on' : 'turn_off');
  }

  /**
   * The full card's speed and its stepper, laid out for the column from the widest speed (100 %), never from the
   * state (`fitValueRow`): beside, else the stepper centred under the speed ("Geschwindigkeit" in half a column); the
   * stepper stays, still, while the fan cannot be reached. Without it the readout is the card's tap.
   */
  private renderSpeed(
    entityId: string,
    name: string,
    speed: number | null,
    unusable: boolean,
  ): TemplateResult {
    const label = this.t('fan.speed');
    const fit = fitValueRow(this.head.ruler, {
      width: this.contentWidth,
      control: this.config?.show_stepper === false ? 0 : STEPPER,
      narrow: STEPPER_HALVES,
      labels: [label],
      figures: [{ value: formatNumber(this.hass, 100, { digits: 0 }), unit: '%' }],
    });
    const value = speed === null ? '—' : formatNumber(this.hass, speed, { digits: 0 });
    const unit = speed === null ? '' : '%';
    return html`<div class="dv-value ${valueRowClass(fit.layout)}">
      ${readout({ label, value, unit, size: fit.size })}
      ${
        fit.layout !== 'alone'
          ? this.speedStepper.get(`${label}|${unusable}`, () =>
              stepper((nudge) => this.stepSpeed(nudge), {
                disabled: unusable,
                decrease: `${label} · ${this.t('common.decrease')}`,
                increase: `${label} · ${this.t('common.increase')}`,
              }),
            )
          : this.readoutTap(entityId, `${name} · ${label} ${value} ${unit}`)
      }
    </div>`;
  }

  protected renderCard(): TemplateResult {
    // out of reach (unavailable, missing; never read: its usual parts) it keeps its anatomy and its size, its controls
    // disabled: only the colours change (1.9)
    const view = drawnAs(this.entity(), USUAL);
    const name = this.nameFor(view, this.config?.name);
    const unusable = !isUsable(view);
    const compact = this.compact;
    const state = this.stateOf(view);
    const on = state === 'on';
    const count = speedCount(view);
    const step = 100 / count;
    const speed = this.speedOf(view, on);
    const figure = this.dragged ?? speed;
    const tone: Tone = unusable ? 'off' : on ? 'fan' : 'neutral';
    // the compact card is the head and the ruler; so is the full one while off with `when_off: essentials` —
    // presets, oscillation and direction wait for the fan to run
    const bare = compact || (state === 'off' && this.config?.when_off === 'essentials');

    const oscillating = this.oscillatingHold.read(
      view.attr<boolean | null>('oscillating') === true,
    );
    const rawDirection = view.attr<string | null>('direction');
    const direction = this.directionHold.read(
      rawDirection === 'forward' || rawDirection === 'reverse' ? rawDirection : null,
    );
    const flipped: Direction = direction === 'reverse' ? 'forward' : 'reverse';
    const presets = ((view.attr<unknown>('preset_modes') as unknown[] | undefined) ?? []).filter(
      (item): item is string => typeof item === 'string',
    );
    const preset = this.presetHold.read(view.attr<string | null>('preset_mode') ?? null);
    const chipItems: ChipItem[] = presets.map((item) => ({
      key: item,
      label: modeWord(this.rawHass, view, 'preset_mode', item),
      active: !unusable && item === preset,
    }));
    const showPresets =
      !bare &&
      chipItems.length > 0 &&
      view.supports(PRESET_MODE) &&
      this.config?.show_presets !== false;

    const oscillation =
      !bare && view.supports(OSCILLATE) && this.config?.show_oscillation !== false;
    const turning = !bare && view.supports(DIRECTION) && this.config?.show_direction !== false;
    // a column too narrow for a row's word beside its switch or its chevron (44) gives the circles to the words, as
    // every list does
    const keep = this.head.rowsKeepIcon(this.contentWidth, [
      ...(oscillation ? [{ title: this.t('fan.oscillate'), value: '', end: SWITCH_SLOT }] : []),
      ...(turning ? [{ title: this.t('fan.direction'), value: '', end: 44 }] : []),
    ]);
    const rows: TemplateResult[] = [];
    if (oscillation) {
      rows.push(
        listRow({
          icon: keep ? 'swing' : null,
          tone: unusable ? 'off' : oscillating ? 'fan' : 'neutral',
          title: this.t('fan.oscillate'),
          trailing: 'switch',
          on: oscillating,
          switchTone: 'fan',
          unavailable: unusable,
          onToggle: (next) => {
            if (unusable) return;
            this.oscillatingHold.set(next);
            this.call('fan', 'oscillate', { oscillating: next });
          },
        }),
      );
    }
    if (turning) {
      rows.push(
        listRow({
          icon: keep ? 'auto' : null,
          tone: unusable ? 'off' : 'neutral',
          title: this.t('fan.direction'),
          sub: direction ? fanStrings(this.hass, direction) : '',
          trailing: 'chevron',
          onTap: unusable
            ? undefined
            : () => {
                this.directionHold.set(flipped);
                this.call('fan', 'set_direction', { direction: flipped });
              },
        }),
      );
    }

    // the blades: slow up to a third, fast up to two thirds, both above; a fan that cannot say its speed turns at the middle one.
    // Only blades turn: an icon the user chose for an air purifier stays still.
    const iconRef = iconOf(view, this.config?.icon);
    const blades = iconRef === 'fan' || iconRef === 'mdi:fan' || iconRef === 'mdi:ceiling-fan';
    const level =
      !on || unusable || !blades
        ? 0
        : speed === null
          ? 2
          : speed <= 0
            ? 0
            : speed <= 34
              ? 1
              : speed <= 67
                ? 2
                : 3;
    const turn = `--dv-fan-slow:${level === 1 || level === 3 ? 'running' : 'paused'};--dv-fan-fast:${level >= 2 ? 'running' : 'paused'}`;

    const fine = this.fine;
    const scale = speedScale(this.hass, count);
    const labels = heldLabels(
      this.head.ruler,
      this.contentWidth,
      fine
        ? [0, 0.2, 0.4, 0.6, 0.8, 1].map(
            (f) =>
              [
                f,
                formatNumber(this.hass, fine.min + f * (fine.max - fine.min), { digits: 0 }),
              ] as const,
          )
        : scale.labels,
    );
    const speedLabel = this.t('fan.speed');

    // the head fitted to its column round its switch (a badge when unreachable): the sub steps aside, then the
    // icon; the compact head says the speed where the full card has its big number ("On · 66 %")
    const percent = figure === null ? '' : `${formatNumber(this.hass, figure, { digits: 0 })} %`;
    const stated = compact && on && figure !== null;
    // where the state's words would not hold beside the switch (es "Encendido" in half a section), the compact line
    // says the speed, else keeps its place, empty — never a word cut
    const short =
      compact && this.config?.subtitle === undefined && (stated || !view.areaName)
        ? [...(stated ? [percent] : []), '\u00a0']
        : [];
    const fitted = this.head.fit({
      width: this.contentWidth,
      title: name,
      sub:
        this.config?.subtitle ??
        (stated
          ? `${stateText(this.hass, view)} · ${percent}`
          : view.areaName || (unusable ? '' : stateText(this.hass, view))),
      shorter: short,
      ...(unusable
        ? { badge: { text: stateText(this.hass, view), tone: 'off' as const } }
        : { trailing: SWITCH_SLOT }),
    });
    return html`<article
      class="fv-card dv-card dv-fan ${unusable ? 'is-unavailable is-off' : ''}"
      style=${turn}
      data-card
    >
      ${head({
        icon: fitted.icon ? iconRef : null,
        small: fitted.small,
        tone,
        title: name,
        name: true,
        sub: fitted.sub,
        trailing: unusable
          ? fitted.badge
          : toggle(on, 'fan', (next) => this.power(view, next), name),
        cut: fitted.cut,
        ...this.headActions(view.id),
      })}
      ${
        view.supports(SET_SPEED)
          ? html` ${compact ? nothing : this.renderSpeed(view.id, name, figure, unusable)}
              <div class="${compact ? 'dv-fan__row' : ''}">
                <fluvy-ruler
                  .value=${Math.round((speed ?? 0) / step) * step}
                  .min=${0}
                  .max=${100}
                  .step=${step}
                  .length=${this.contentWidth}
                  .minor=${scale.minor}
                  .major=${scale.major}
                  .tone=${on && !unusable ? 'fan' : 'neutral'}
                  ?inactive=${speed === null || !on}
                  ?wake=${!unusable && speed !== null}
                  ?disabled=${unusable}
                  unit="%"
                  .label=${`${name} · ${speedLabel}`}
                  .format=${(value: number) => formatNumber(this.hass, value, { digits: 0 })}
                  @fluvy-input=${(event: CustomEvent<RulerChangeDetail>) => {
                    this.dragged = event.detail.value;
                  }}
                  @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.setSpeed(view, event.detail.value, false)}
                  @fluvy-window=${(event: CustomEvent<RulerWindowDetail>) => {
                    this.fine = event.detail.fine ? event.detail : null;
                  }}
                ></fluvy-ruler>
              </div>
              ${compact ? nothing : rulerLabels(labels)}`
          : nothing
      }
      ${rows.length ? html`<div class="dv-rows">${rows}</div>` : nothing}
      ${
        showPresets
          ? html`${label(this.t('fan.preset'))}${chipRow(
              chipItems,
              (key) => {
                if (unusable) return;
                this.presetHold.set(key);
                this.call('fan', 'set_preset_mode', { preset_mode: key });
              },
              this.config?.preset_style,
              { ruler: this.head.ruler, width: this.contentWidth },
            )}`
          : nothing
      }
    </article>`;
  }
}
