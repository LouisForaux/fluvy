import {
  fetchHistory,
  stateText,
  strings,
  type ActionConfig,
  type EntityName,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { glyph, sheetStyles } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { contentWidth } from '../hello/fit.js';
import { Card, type CardEditor } from '../shared/base.js';
import { FontsSettled } from '../shared/fonts.js';
import { askedParts, type NumberKeys } from '../shared/units.js';
import { ITEM_ALIASES, type AliasSpec } from '../shared/config.js';
import { EMPTY, entryCount, rowsOf } from '../shared/heights.js';
import { emptyPanel, itemsOf, listOf, type EmptyList } from '../shared/lists.js';

const s = strings('readouts');

export interface ReadoutConfig extends NumberKeys {
  entity: string;
  name?: EntityName;
  tap_action?: ActionConfig;
}

export interface ReadoutsCardConfig extends FluvyCardConfig, EmptyList, NumberKeys {
  /** The object form, for a per-readout `name` (same shape as the `rows` of `fluvy-entities-card`). Wins over `entities`. */
  rows?: ReadonlyArray<string | ReadoutConfig>;
  /** Window the trend is read from. Default 6 h. */
  hours?: number;
  /** `grid` (default): two columns where four readouts are. `row`: as many across as fit. */
  variant?: 'grid' | 'row';
}

/** What the recorder said about the window: the mean of its first quarter, and how far the value travelled. */
interface Baseline {
  readonly base: number;
  readonly range: number;
}

const MAX = 4;
const GAP = 16;
/** Narrower than this a column cannot hold an 11/600 uppercase label ("TEMPERATURE" is 90 px): the strip drops a column instead of clipping one. */
const MIN_CELL = 88;
const POINTS = 48;
const REFRESH = 5 * 60_000; // `fetchHistory` caches for five minutes; asking sooner is a map lookup
const TIERS = ['fv-readout--m', 'fv-readout--s', 'fv-readout--xs'] as const;

function baselineOf(values: readonly number[], min: number, max: number): Baseline | null {
  if (values.length < 4) return null;
  const quarter = values.slice(0, Math.max(1, Math.round(values.length / 4)));
  return {
    base: quarter.reduce((sum, value) => sum + value, 0) / quarter.length,
    range: max - min,
  };
}

/**
 * The stats strip: one card, up to four readouts — label, tabular value, unit and a trend arrow.
 * The arrow is earned: it compares the value now with the mean of the first quarter of the last
 * `hours`, a move under 1 % of the window's range is no move, and a sensor without recorded history
 * gets no arrow at all.
 *
 * Three readouts are the design (3 × 96 in a 320 column); one and two share the column, four make a
 * 2 × 2, and a column too narrow for a label (under 88) gives one up, so three wrap to 2 + 1 in a 260
 * column. Columns start on the 4 px grid at any width. After each render `fit()` picks the largest
 * readout size (m → s → xs) at which every value fits its column — a value is never clipped.
 */
export class FluvyReadoutsCard extends Card<ReadoutsCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: ReadoutsCardConfig): number {
    const n = entryCount(config, ['rows', 'entities']);
    // none: the empty panel alone in the card (20 + 120 + 20)
    if (!n) return 40 + EMPTY;
    // rows of 48 readouts in the card's 20, 16 between rows: as many a row as 88 cells 16 apart hold in a 320 column
    // (three), four as two by two in the grid
    const fit = Math.floor((320 + GAP) / (MIN_CELL + GAP));
    const columns = Math.max(1, Math.min(n === 4 && config.variant !== 'row' ? 2 : n, fit));
    return 40 + rowsOf(n, columns) * 64 - 16;
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.home,
    css`
      .hm-stats .is-orphan {
        grid-column: 1 / -1;
      }
    `,
    css`
      .hm-stat {
        min-width: 0;
        border-radius: 8px;
        cursor: pointer;
        transform-origin: 0 50%;
        transition: transform var(--fv-fast) var(--fv-ease);
        -webkit-user-select: none;
        user-select: none;
      }
      .hm-stat:active {
        transform: scale(0.97);
      }
      .fv-readout__label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color var(--fv-base) var(--fv-ease);
      }
      .fv-readout__value {
        white-space: nowrap;
      }
      /* the fit measures right after it flips a size: nothing in the value may be mid-transition (a measurement
         taken inside one reads the previous size) */
      .fv-readout__value,
      .fv-readout__value * {
        transition-property: none;
      }
      /* a state that is a word, not a number, may ellipsize; a number never gets here (see fit) */
      .fv-readout__value > :first-child {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .is-off .fv-readout__value {
        color: var(--fluvy-unavailable);
      }
      /* the arrow follows its value down the sizes and stays on the grid: 20 in 28, 16 in 24, 12 in 20 */
      .fv-readout--s .fv-trend svg {
        width: 16px;
        height: 16px;
      }
      /* a readout is a button: at xs (16 + 4 + 20) it would be 40 tall, so the value sits 8 under its label → 44 */
      .hm-stat.fv-readout--xs .fv-readout__value {
        margin-top: 8px;
      }
      .fv-readout--xs .fv-trend {
        margin-left: 4px;
      }
      .fv-readout--xs .fv-trend svg {
        width: 12px;
        height: 12px;
        stroke-width: 2.5;
      }
      .is-bare .fv-trend {
        display: none;
      }
      @media (hover: hover) {
        .hm-stat:hover .fv-readout__label {
          color: var(--fluvy-text);
        }
      }
    `,
  ];

  constructor() {
    super();
    // the fit measures laid-out text: it runs again once a web font is in use
    new FontsSettled(this);
  }

  static override editor(): Promise<CardEditor> {
    return import('./readouts-editor.js');
  }
  static override aliases: AliasSpec = { items: { rows: ITEM_ALIASES } };

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): ReadoutsCardConfig {
    const numeric = entities.filter(
      (id) => id.startsWith('sensor.') && Number.isFinite(Number(hass?.states[id]?.state)),
    );
    return { type: 'custom:fluvy-readouts-card', entities: numeric.slice(0, 3) };
  }

  /**
   * Both spellings end up in `rows`, and `entities` keeps the ids: `- sensor.x` and `- entity: sensor.x` are the same
   * thing; four at most.
   */
  protected override prepare(config: ReadoutsCardConfig): ReadoutsCardConfig {
    const rows = itemsOf<ReadoutConfig>(listOf(config, 'rows', ['entities'])).slice(0, MAX);
    const hours = typeof config.hours === 'number' && config.hours > 0 ? config.hours : 6;
    return { ...config, rows, entities: rows.map((row) => row.entity), hours };
  }

  override getCardSize(): number {
    return this.items().length > 3 ? 3 : 2;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private items(): readonly ReadoutConfig[] {
    return (this.config?.rows ?? []).filter((row): row is ReadoutConfig => typeof row !== 'string');
  }

  /* ---------- trend ---------- */

  private readonly baselines = new Map<string, { at: number; baseline: Baseline | null }>();
  private readonly loading = new Set<string>();

  private async loadBaseline(hass: HomeAssistant, entityId: string, hours: number): Promise<void> {
    const key = `${entityId}|${hours}`;
    const known = this.baselines.get(key);
    if (this.loading.has(key) || (known && Date.now() - known.at < REFRESH)) return;
    this.loading.add(key);
    const series = await fetchHistory(hass, entityId, hours, POINTS); // resolves to null on any failure
    this.loading.delete(key);
    const baseline = series ? baselineOf(series.values, series.min, series.max) : null;
    this.baselines.set(key, { at: Date.now(), baseline });
    const moved =
      baseline?.base !== known?.baseline?.base || baseline?.range !== known?.baseline?.range;
    if (moved && this.isConnected) this.requestUpdate();
  }

  private trend(entityId: string, value: number | null): 'up' | 'down' | null {
    const baseline = this.baselines.get(`${entityId}|${this.config?.hours ?? 6}`)?.baseline;
    if (!baseline || value === null || baseline.range <= 0) return null;
    const delta = value - baseline.base;
    if (Math.abs(delta) < baseline.range / 100) return null;
    return delta > 0 ? 'up' : 'down';
  }

  /* ---------- fit ---------- */

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.fit();
    if (!this.hass) return;
    for (const { entity } of this.items()) {
      if (this.entity(entity).number !== null)
        void this.loadBaseline(this.hass, entity, this.config?.hours ?? 6);
    }
  }

  /**
   * The largest size at which every value (with unit and arrow) fits its column; when even `xs` is
   * too wide the arrows go and the sizes are tried again, before anything is clipped. Classes are
   * set on the elements outside Lit's bindings, like `fitPills`: no second render, nothing painted
   * in between.
   */
  private fit(): void {
    const card = this.renderRoot.querySelector<HTMLElement>('.hm-stats');
    if (!card) return;
    const cells = [...card.querySelectorAll<HTMLElement>('.fv-readout')];
    // the figure is the one part the row may squeeze, so its width is read from its text, the rest from the layout
    const fits = (): boolean =>
      cells.every((cell) => {
        const figure = cell.querySelector('.fv-readout__value > :first-child');
        const last = cell.querySelector('.fv-readout__value > :last-child');
        if (!figure || !last) return true;
        const tail = last.getBoundingClientRect().right - figure.getBoundingClientRect().right;
        return contentWidth(figure) + tail <= cell.getBoundingClientRect().width + 0.01;
      });
    for (const bare of [false, true]) {
      card.classList.toggle('is-bare', bare);
      for (const tier of TIERS) {
        for (const cell of cells) {
          cell.classList.remove(...TIERS);
          cell.classList.add(tier);
        }
        if (fits()) return;
      }
    }
  }

  /* ---------- render ---------- */

  /** Equal cells: the readouts are centred in them, so the row reads as one evenly distributed set at any width. */
  private columns(count: number): string {
    return `repeat(${count}, minmax(0, 1fr))`;
  }

  protected renderCard(): TemplateResult {
    const items = this.items();
    const panel = emptyPanel(this, !items.length, 'chart', 'common.no_readings');
    const fit = Math.max(1, Math.floor((this.contentWidth + GAP) / (MIN_CELL + GAP)));
    // the panel takes the strip's one column
    const columns = Math.max(
      1,
      Math.min(items.length === 4 && this.config?.variant !== 'row' ? 2 : items.length, fit),
    );
    // three readouts in two columns: the third is centred under the pair, not left under one of them
    const orphan = columns > 1 && items.length % columns === 1 ? items[items.length - 1] : null;

    return html`<article
      class="fv-card hm-stats"
      data-card
      style="grid-template-columns:${this.columns(columns)}"
    >
      ${panel}
      ${items.map((item) => {
        const view = this.entity(item.entity);
        const label = this.nameFor(view, item.name);
        const parts = askedParts(this.hass, view, { ...this.config, ...item });
        const trend = view.status === 'ok' ? this.trend(item.entity, view.number) : null;
        const said =
          view.status === 'ok'
            ? `${parts.value}${parts.unit ? ` ${parts.unit}` : ''}`
            : stateText(this.hass, view);
        const open = (): void => this.tap(item.entity, item.tap_action);
        const key = (event: KeyboardEvent): void => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        };
        return html`<div
          class="fv-readout hm-stat ${view.status === 'ok' ? '' : 'is-off'} ${orphan === item ? 'is-orphan' : ''}"
          role="button"
          tabindex="0"
          data-target
          aria-label=${`${label}: ${said}${trend ? `, ${s(this.hass, trend === 'up' ? 'rising' : 'falling')}` : ''}`}
          @click=${open}
          @keydown=${key}
        >
          <p class="fv-readout__label">${label}</p>
          <p class="fv-readout__value">
            <span>${parts.value}</span
            >${parts.unit ? html`<span class="fv-unit">${parts.unit}</span>` : nothing}${
              trend
                ? html`<span class="fv-trend ${trend === 'down' ? 'fv-trend--down' : ''}"
                    >${glyph(trend === 'down' ? 'trendDown' : 'trendUp')}</span
                  >`
                : nothing
            }
          </p>
        </div>`;
      })}
    </article>`;
  }
}
