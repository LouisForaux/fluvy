import {
  formatNumber,
  formatTime,
  isUsable,
  numberAttr,
  strings,
  valueParts,
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
  rulerLabels,
  sheetStyles,
  type ActionItem,
  type ChipItem,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { batteryOf } from '../shared/battery.js';
import { Card, type CardEditor } from '../shared/base.js';

import { iconOf } from '../shared/domain.js';
import {
  actionGap,
  actionsThatFit,
  headSub,
  Hold,
  motionStyles,
  shownStateText,
} from '../cover/common.js';
import type { RowStyle } from '../shared/config.js';
import { chipRow } from '../shared/chips.js';
import { modeWord, pretty } from '../shared/mode-words.js';
import { HeadFit } from '../energy/head.js';
import { chipBlock, chipRows, COMPACT, drawnAs } from '../shared/heights.js';
import { statsRow, type StatText } from '../shared/readouts.js';

const vacuumStrings = strings('vacuum');

/** `full` (default): the readouts, the battery, the commands and the suction. `compact`: the head and the commands. */
export type VacuumVariant = 'full' | 'compact';

export interface VacuumCardConfig extends FluvyCardConfig {
  subtitle?: string;
  variant?: VacuumVariant;
  show_battery?: boolean;
  /** Sensors the integration exposes beside the robot itself. A column exists only for what is configured. */
  area_entity?: string;
  duration_entity?: string;
  remaining_entity?: string;
  /** The battery sensor. Left out, the card looks for one on the robot's own device. */
  battery_entity?: string;
  /** Suction speeds: chips that fill the row (default) or content-sized chips. */
  suction_style?: RowStyle;
}

type Command = 'start' | 'pause' | 'stop' | 'dock' | 'locate';

interface Robot {
  readonly running: string;
  readonly bits: Readonly<Record<Command | 'suction' | 'battery', number>>;
  /** Command → the service to call and the state to show until Home Assistant answers. */
  readonly services: Readonly<
    Partial<Record<Command, readonly [service: string, expect: string | null]>>
  >;
}

const VACUUM: Robot = {
  running: 'cleaning',
  bits: { pause: 4, stop: 8, dock: 16, suction: 32, battery: 64, locate: 512, start: 8192 },
  services: {
    start: ['start', 'cleaning'],
    pause: ['pause', 'paused'],
    stop: ['stop', 'idle'],
    dock: ['return_to_base', 'returning'],
    locate: ['locate', null],
  },
};

/** A lawn mower is the same machine outdoors, with three features of its own. */
const MOWER: Robot = {
  running: 'mowing',
  bits: { start: 1, pause: 2, dock: 4, stop: 0, locate: 0, suction: 0, battery: 0 },
  services: {
    start: ['start_mowing', 'mowing'],
    pause: ['pause', 'paused'],
    dock: ['dock', 'returning'],
  },
};

/**
 * What a robot draws where the house is not there to say (`layoutHeight`; one never read): Start, Stop and Dock, its
 * battery and its suction.
 */
const usual = ({ bits }: Robot): number =>
  bits.start | bits.stop | bits.dock | bits.battery | bits.suction;

/**
 * What the house says of a robot: what it does (`supported_features`; its kind's usual where the house has not read
 * it), whether it reports its own battery (`battery_level`), its suction's speeds.
 */
export interface RobotDoes {
  readonly features: number | undefined;
  readonly level: boolean;
  readonly speeds: readonly string[];
}

/**
 * The card's height at a 360 column, for the automatic dashboard's columns: the head; the readouts' row (16 + 44)
 * where the config names a sensor; the battery (a label, the gauge and its marks: 112) where the robot has one; the
 * commands (16 + 44) it takes; its suction as a row of chips under a label — what it does as the house describes it
 * (`house-heights.ts`); where the house is not there to say, every part, and two rows of suction chips.
 */
export function vacuumHeight(config: VacuumCardConfig, does?: RobotDoes): number {
  if (config.variant === 'compact') return COMPACT;
  const id = config.entity;
  const robot = typeof id === 'string' && id.startsWith('lawn_mower.') ? MOWER : VACUUM;
  const features = does?.features ?? usual(robot);
  const has = (key: Command | 'suction' | 'battery'): boolean =>
    robot.bits[key] !== 0 && (features & robot.bits[key]) !== 0;
  const readouts = config.area_entity || config.duration_entity || config.remaining_entity ? 60 : 0;
  const battery =
    config.show_battery !== false && (config.battery_entity || does?.level || has('battery'))
      ? 112
      : 0;
  const commands =
    has('start') || has('pause') || has('stop') || has('dock') || has('locate') ? 60 : 0;
  const style = config.suction_style === 'chips' ? 'chips' : 'full';
  const suction = has('suction')
    ? chipBlock(does ? chipRows(does.speeds.map(pretty), style) : 2)
    : 0;
  return 64 + readouts + battery + commands + suction + 20;
}

const GAUGE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.25, 25],
  [0.5, 50],
  [0.75, 75],
  [1, 100],
];

/**
 * The robot: what it is doing, the numbers the integration exposes (area, elapsed, remaining — only
 * the ones that are configured), the battery as a read-only marker gauge, the command row, and
 * suction as chips. Lawn mowers are served by the same card.
 */
export class FluvyVacuumCard extends Card<VacuumCardConfig> {
  /** The card's height at a 360 column from its config alone: every part (`vacuumHeight`). */
  static override layoutHeight(config: VacuumCardConfig): number {
    return vacuumHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    motionStyles,
    css`
      /* the sheet's 3 × 96 + 2 × 16 at 320, fluid: as many columns as hold every label and figure (\`statsRow\`), a
         shorter last row's one readout across the row */
      .dv-cols {
        grid-template-columns: repeat(var(--dv-cols, 3), minmax(0, 1fr));
      }
    `,
  ];

  private readonly suctionHold = new Hold<string | null>(this);
  private readonly head = new HeadFit(this);

  static override editor(): Promise<CardEditor> {
    return import('./vacuum-editor.js');
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): VacuumCardConfig {
    return {
      type: 'custom:fluvy-vacuum-card',
      entity: entities.find((id) => /^(vacuum|lawn_mower)\./.test(id)) ?? '',
    };
  }

  protected override prepare(config: VacuumCardConfig): VacuumCardConfig {
    if (!config.entity) throw new Error('fluvy-vacuum-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return this.config?.variant === 'compact' ? 3 : 6;
  }
  /** The full card needs its ruler's width; the compact one — the head and the commands — half a section at least. */
  override getGridOptions(): LovelaceGridOptions {
    return this.config?.variant === 'compact'
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 8 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.suctionHold.clear();
  }

  protected override watched(): readonly string[] {
    const c = this.config;
    return [
      c?.entity,
      c?.area_entity,
      c?.duration_entity,
      c?.remaining_entity,
      this.batteryId(),
    ].filter((id): id is string => Boolean(id));
  }

  /**
   * The battery sensor: the configured one, or the `battery` sensor on the robot's own device — Home Assistant moved
   * the battery out of the vacuum's attributes into a sensor of its own.
   */
  private batteryId(): string | undefined {
    return this.config?.battery_entity || batteryOf(this.hass, this.config?.entity ?? '');
  }

  private command(view: EntityView, robot: Robot, key: Command): void {
    const entry = robot.services[key];
    if (!entry) return;
    const [service, expected] = entry;
    if (expected) this.expect(view.id, expected);
    this.call(view.domain, service);
  }

  /** A configured sensor's statistic, "—" while it cannot be read; nothing when it is not configured. */
  private column(id: string | undefined, label: string): StatText | null {
    if (!id) return null;
    const parts = valueParts(this.hass, this.entity(id));
    return { label, value: parts.value, unit: parts.unit };
  }

  /**
   * The readouts (the area, the time, the time left) in as many equal columns as hold every label and figure at the
   * size the widest fits (`statsRow`, measured): three in a phone's column, two and one in a 211 column, never cut.
   */
  private renderColumns(stats: readonly StatText[], w: number): TemplateResult {
    const row = statsRow(this.head.ruler, w, stats);
    return html`<div
      class="dv-cols fv-cols ${row.odd ? 'fv-cols--odd' : ''}"
      style="--dv-cols:${row.columns}"
    >
      ${stats.map((stat) => readout({ label: stat.label, value: stat.value, unit: stat.unit ?? '', size: row.size }))}
    </div>`;
  }

  protected renderCard(): TemplateResult {
    // out of reach (unavailable, missing; never read: its usual parts) it keeps its anatomy and its size, its controls
    // disabled: only the colours change (1.9)
    const found = this.entity();
    const robot = found.domain === 'lawn_mower' ? MOWER : VACUUM;
    const view = drawnAs(found, usual(robot));
    const name = this.nameFor(view, this.config?.name);
    const unusable = !isUsable(view);
    const compact = this.config?.variant === 'compact';
    const shown = this.stateOf(view);
    const running = shown === robot.running;
    const tone: Tone = unusable
      ? 'off'
      : shown === 'error'
        ? 'warning'
        : running || shown === 'returning'
          ? 'accent'
          : 'neutral';
    const w = this.contentWidth;
    const has = (key: Command | 'suction' | 'battery'): boolean =>
      robot.bits[key] !== 0 && view.supports(robot.bits[key]);

    const columns = [
      this.column(this.config?.area_entity, vacuumStrings(this.hass, 'area')),
      this.column(this.config?.duration_entity, vacuumStrings(this.hass, 'elapsed')),
      this.column(this.config?.remaining_entity, this.t('timer.remaining')),
    ].filter((column): column is StatText => column !== null);

    // the battery: its own sensor where there is one, the legacy attribute otherwise; the gauge is there for a robot
    // that says it has one, at rest while it cannot be read (unknown, out of reach, its sensor gone)
    const batteryId = this.batteryId();
    const sensor = batteryId ? this.entity(batteryId) : undefined;
    const level =
      sensor && sensor.status !== 'missing' ? sensor.number : numberAttr(view, 'battery_level');
    const hasBattery =
      !compact &&
      this.config?.show_battery !== false &&
      (level !== null || sensor !== undefined || has('battery'));
    const battery = level === null || unusable ? null : clamp(Math.round(level), 0, 100);

    const row: ActionItem[] = [];
    if (has('start') || has('pause')) {
      row.push(
        running
          ? {
              key: 'pause',
              glyph: 'pause',
              label: this.t('vacuum.pause'),
              primary: !unusable,
              disabled: unusable || !has('pause'),
            }
          : {
              key: 'start',
              glyph: 'play',
              label: this.t('vacuum.start'),
              primary: !unusable,
              disabled: unusable || !has('start'),
            },
      );
    }
    if (has('stop'))
      row.push({ key: 'stop', glyph: 'stop', label: this.t('vacuum.stop'), disabled: unusable });
    if (has('dock'))
      row.push({
        key: 'dock',
        glyph: 'dock',
        label: this.t('vacuum.dock'),
        disabled: unusable || shown === 'docked' || shown === 'returning',
      });
    if (has('locate'))
      row.push({
        key: 'locate',
        glyph: 'locate',
        label: this.t('vacuum.locate'),
        disabled: unusable,
      });

    if (compact) {
      // a compact card keeps the commands that fit: start or pause and dock first, then stop and locate
      const rank = { start: 0, pause: 0, dock: 1, stop: 2, locate: 3 } as const;
      row.sort((a, b) => rank[a.key as Command] - rank[b.key as Command]);
      row.splice(actionsThatFit(this.contentWidth));
    }
    const speeds = has('suction')
      ? ((view.attr<unknown>('fan_speed_list') as unknown[] | undefined) ?? []).filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    const speed = this.suctionHold.read(view.attr<string | null>('fan_speed') ?? null);
    const chipItems: ChipItem[] = speeds.map((item) => ({
      key: item,
      label: modeWord(this.rawHass, view, 'fan_speed', item),
      active: !unusable && item === speed,
    }));

    const started =
      running && view.stateObj
        ? vacuumStrings(this.hass, 'started', {
            time: formatTime(this.hass, new Date(view.stateObj.last_changed)),
          })
        : '';
    const sub =
      this.config?.subtitle ??
      (view.areaName && started
        ? `${view.areaName} · ${started}`
        : view.areaName || started.charAt(0).toUpperCase() + started.slice(1));
    const batteryText = `${this.t('vacuum.battery')} · ${battery === null ? '—' : `${formatNumber(this.hass, battery, { digits: 0 })} %`}`;
    // the head fitted to its column: the badge steps aside before the name is cut, then the sub, then the icon
    const fitted = this.head.fit({
      width: w,
      title: name,
      sub: headSub(sub, w),
      badge: { text: shownStateText(this.hass, view, shown), tone },
    });
    // the commands in equal cells, two rows where one would leave a cell under a finger's 44
    const cells = actionGap(w, row.length);

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
      ${columns.length && !compact ? this.renderColumns(columns, w) : nothing}
      ${
        hasBattery
          ? html` ${label(batteryText)}
              <div class="dv-gauge">
                <fluvy-ruler
                  marker
                  ?inactive=${battery === null}
                  .value=${battery ?? 0}
                  .min=${0}
                  .max=${100}
                  .step=${1}
                  .length=${w}
                  .tone=${battery !== null && battery <= 20 ? 'warning' : 'accent'}
                  unit="%"
                  .label=${`${name} · ${this.t('vacuum.battery')}`}
                  .format=${(value: number) => formatNumber(this.hass, value, { digits: 0 })}
                ></fluvy-ruler>
              </div>
              ${rulerLabels(GAUGE.map(([fraction, value]) => [fraction, formatNumber(this.hass, value, { digits: 0 })] as const))}`
          : nothing
      }
      ${row.length ? actions(row, (key) => this.command(view, robot, key as Command), cells.columns) : nothing}
      ${
        chipItems.length && !compact
          ? html`${label(this.t('vacuum.suction'))}${chipRow(
              chipItems,
              (key) => {
                if (unusable) return;
                this.suctionHold.set(key);
                this.call('vacuum', 'set_fan_speed', { fan_speed: key });
              },
              this.config?.suction_style,
              { ruler: this.head.ruler, width: this.contentWidth },
            )}`
          : nothing
      }
    </article>`;
  }
}
