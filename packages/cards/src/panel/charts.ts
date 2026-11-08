import {
  formatNumber,
  isPaletteRef,
  localize,
  PALETTE_SERIES,
  paletteOf,
  SERIES_COUNT,
  type ChartPreset,
  type GaugePreset,
} from '@fluvy/core';
import type { PaletteMode, PaletteModeColors } from '@fluvy/tokens/runtime';
import { head, icon, listRow, type ChoosableTone } from '@fluvy/ui';
import { html, nothing, svg, type TemplateResult } from 'lit';
import {
  CHART_PRESETS,
  fitSet,
  GAUGE_PRESETS,
  HOUSE_ACTS,
  PALETTE_REFS,
  PREVIEW_LEAST,
  previewChart,
  previewGauge,
  previewSeries,
  previewStyle,
  refHex,
  refInk,
  seriesCheck,
  setInks,
  type FittedSet,
} from '../chart/engine/index.js';
import { FINE_ROWS, TIME_ROWS, type FineRow } from './chart-words.js';
import type { PanelContext, StringKey } from './model.js';
import { choice, gap, hexField, inkOn, swatches } from './sections.js';
import { chosenSet, roomForSet, SET_NAME_MAX, type SeriesDraft } from './series.js';

/*
 * The Charts tab (1.11): how every chart and gauge of the house is drawn where a card says nothing of its own, chosen
 * once like the look — the style and the gauge as tiles the engine draws, the fine settings the style acts on, the
 * series colours (the palette's six or a set of the house's own, made here and checked), and a preview of a chart, its
 * bars and a gauge in both modes. Every choice is an edit of the house's settings, shown on the page at once and saved
 * from the bar; the sets are kept at once, as the house's palettes are. An administrator's to change, read by anyone.
 */

export interface ChartActions {
  saveSet(draft: SeriesDraft): void;
  removeSet(id: string): void;
}

/** A reading as the panel's language writes it (the previews' figures). */
const formatter =
  (ctx: PanelContext) =>
  (value: number): string =>
    formatNumber(ctx.hass, value);

/* ---------- the tiles ---------- */

/**
 * The tiles' rows: two a row on a phone, four on a wide panel, and a last row short of them shares the card's width
 * among its own, so no row is left part empty — the eight styles fill theirs; of the eleven gauges the last takes a
 * phone's row whole (an odd last tile, as a room's) and the last three share a wide panel's.
 */
function tileRows<T>(ctx: PanelContext, items: readonly T[]): T[][] {
  const n = ctx.wide ? 4 : 2;
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += n) rows.push(items.slice(i, i + n));
  return rows;
}

/**
 * A drawing's width where the engine's drawings hold it (`PREVIEW_LEAST`); none narrower, nor before the column is laid
 * out: the drawing waits, never drawn inside out.
 */
const drawable = (width: number | undefined): number | undefined =>
  width !== undefined && width >= PREVIEW_LEAST ? width : undefined;

/** A tile's drawing room across in a row of `n`: its share of the card less its 8 and its picture's 8 on each side. */
function artWidth(ctx: PanelContext, n: number): number | undefined {
  if (!ctx.fit) return undefined;
  return drawable(Math.floor((ctx.fit.width - (n - 1) * gap(ctx)) / n + 0.01) - 32);
}

/** The engine's styles and gauges, in the order the settings know them. */
const STYLES = Object.keys(CHART_PRESETS) as ChartPreset[];
const GAUGES = Object.keys(GAUGE_PRESETS) as GaugePreset[];

/** A style's drawing room down: the picture's 72 on a phone (96 on a wide panel) less its 8 above and below. */
const STYLE_ART = { phone: 56, wide: 80 } as const;
/** The largest a gauge is drawn in its tile: a dial 96 across and 100 down, its picture's room (styles.ts). */
const GAUGE_SIZE = 96;

interface Tile {
  readonly key: string;
  readonly label: string;
  readonly active: boolean;
  /** Its picture, drawn `width` across (its row's share). */
  readonly art: (width: number) => TemplateResult;
}

/**
 * The Apple-like tiles of the house (the palettes' swatches): each a drawing on the card's surface over its name, the
 * chosen one in the accent's fill with a check; `onPick` null: shown to someone who may not change them.
 */
function tiles(
  ctx: PanelContext,
  items: readonly Tile[],
  onPick: ((key: string) => void) | null,
  kind: 'style' | 'gauge',
): TemplateResult {
  return html`<div class="pn-tiles ${onPick ? '' : 'pn-tiles--static'}">
    ${tileRows(ctx, items).map((row) => {
      const width = artWidth(ctx, row.length);
      return html`<div class="pn-tiles__row" style="--n:${row.length}" data-fill-row>
        ${row.map(
          (item) =>
            html`<button
              class="pn-swatch pn-tile ${item.active ? 'is-active' : ''}"
              data-target
              aria-pressed=${item.active ? 'true' : 'false'}
              tabindex=${onPick ? nothing : '-1'}
              @click=${() => onPick?.(item.key)}
            >
              <span class="pn-art pn-art--chart pn-art--${kind} fv-tone--accent"
                >${width ? item.art(width) : nothing}</span
              >
              <span class="pn-swatch__name"
                ><span class="pn-swatch__label">${item.label}</span>${
                  item.active ? icon('check') : nothing
                }</span
              >
            </button>`,
        )}
      </div>`;
    })}
  </div>`;
}

function styleCard(ctx: PanelContext): TemplateResult {
  const charts = ctx.shown.charts;
  const height = ctx.wide ? STYLE_ART.wide : STYLE_ART.phone;
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'chart', title: ctx.t('charts.style'), sub: ctx.t(ctx.admin ? 'charts.style_sub' : 'scope.admin_only') })}
    ${tiles(
      ctx,
      STYLES.map((preset) => ({
        key: preset,
        label: localize(ctx.hass, `option.${preset}`),
        active: charts.style === preset,
        art: (width) => previewStyle(preset, charts, width, height),
      })),
      ctx.admin ? (key) => ctx.editCharts({ style: key as ChartPreset }) : null,
      'style',
    )}
  </section>`;
}

function gaugeCard(ctx: PanelContext): TemplateResult {
  const charts = ctx.shown.charts;
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'thermo', title: ctx.t('charts.gauge'), sub: ctx.t(ctx.admin ? 'charts.gauge_sub' : 'scope.admin_only') })}
    ${tiles(
      ctx,
      GAUGES.map((preset) => ({
        key: preset,
        label: localize(ctx.hass, `option.${preset}`),
        active: charts.gauge === preset,
        art: (width) =>
          previewGauge(preset, charts, {
            size: preset === 'ruler' ? width : Math.min(width, GAUGE_SIZE),
            format: formatter(ctx),
            small: true,
            hass: ctx.hass,
          }),
      })),
      ctx.admin ? (key) => ctx.editCharts({ gauge: key as GaugePreset }) : null,
      'gauge',
    )}
  </section>`;
}

/* ---------- the fine settings ---------- */

/** A fine setting: its label and its row of chips, the chosen one lit; shown to someone who may not change it, still. */
function fineRow(ctx: PanelContext, row: FineRow<string>): TemplateResult {
  const charts = ctx.shown.charts;
  return html`<p class="fv-label pn-label">${ctx.t(row.label)}</p>
    ${choice(
      ctx,
      row.choices.map((c) => ({
        key: c.key,
        label: c.word(ctx),
        active: row.chosen(charts) === c.key,
      })),
      ctx.admin ? (key) => ctx.editCharts(row.patch(charts, key)) : null,
    )}`;
}

/**
 * What the chosen style lets the house tune, a row of chips each (the engine's `HOUSE_ACTS`: a setting the style does
 * not draw with is not offered), the waves where the gauge moves, and motion, which every chart has.
 */
function detailsCard(ctx: PanelContext): TemplateResult {
  const { admin } = ctx;
  const charts = ctx.shown.charts;
  const acts = HOUSE_ACTS[charts.style];
  const rows = FINE_ROWS.filter((row) =>
    row.acts === 'wave' ? GAUGE_PRESETS[charts.gauge].motion : acts.includes(row.acts),
  );
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'sliders', title: ctx.t('charts.details'), sub: ctx.t(admin ? 'charts.details_sub' : 'scope.admin_only') })}
    ${acts.length ? nothing : html`<p class="pn-note">${ctx.t('charts.classic_hint')}</p>`}
    ${rows.map((row) => fineRow(ctx, row))}
    <div class="pn-rows">
      ${listRow({
        icon: 'motion',
        title: ctx.t('charts.motion'),
        sub: ctx.t('charts.motion_sub'),
        trailing: 'switch',
        on: charts.animate,
        readonly: !admin,
        onToggle: (on) => ctx.editCharts({ animate: on }),
      })}
    </div>
  </section>`;
}

/* ---------- the time ---------- */

/**
 * How much of the past every chart shows (its `hours`, a Chart card's `span`, where a card says none) and how far apart
 * a line's points stand (its `points`): every style's, a row of chips each, and what the two kinds of points draw.
 */
function timeCard(ctx: PanelContext): TemplateResult {
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'clock', title: ctx.t('charts.time'), sub: ctx.t(ctx.admin ? 'charts.time_sub' : 'scope.admin_only') })}
    ${TIME_ROWS.map((row) => fineRow(ctx, row))}
    <p class="pn-hint pn-hint--after">${ctx.t('charts.points_hint')}</p>
  </section>`;
}

/* ---------- the series colours ---------- */

/** The palette's own six series colours: what the charts wear from the factory, and what a new set starts from. */
const PALETTE_SIX = PALETTE_REFS.series.slice(0, SERIES_COUNT);
/** The palette's six, as the look being chosen derives them in the mode on screen. */
const PALETTE_INKS = PALETTE_SIX.map(refInk);

/** The look being chosen in the house's status colours being shown: what the panel wears, and its sets with it. */
const fitOf = (ctx: PanelContext, colours: readonly string[]): FittedSet =>
  fitSet(colours, ctx.draft.palette, ctx.shown.statuses);

/** The look being chosen in the mode on screen: what a colour of the palette's is here. */
const onScreen = (ctx: PanelContext): PaletteModeColors =>
  paletteOf(ctx.draft.palette, ctx.shown.statuses)[ctx.mode];

/**
 * A colour as the set editor names it: a colour of the palette's by its word (the statuses as the status colours call
 * them, the others as the tones do), a hex as typed.
 */
function colourName(ctx: PanelContext, colour: string): string {
  if (!isPaletteRef(colour)) return colour;
  if (colour.startsWith('graph-'))
    return ctx.t('charts.series_n', { n: colour.slice('graph-'.length) });
  if (colour === 'ok') return ctx.t('statuses.success');
  if (colour === 'warning' || colour === 'danger' || colour === 'notice')
    return ctx.t(`statuses.${colour}`);
  return localize(ctx.hass, `tone.${(colour === 'home' ? 'house' : colour) as ChoosableTone}`);
}
/** The six columns of a set's picture, as tall as a chart's series might stand. */
const COLUMNS = [24, 34, 18, 30, 22, 36] as const;

/** A set of six colours as one picture: six rounded columns on the card's surface, scaled whole with its box. */
const setArt = (inks: readonly string[]): TemplateResult =>
  html`<span class="pn-art pn-art--chart pn-art--series"
    ><svg viewBox="0 0 80 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${inks.map(
        (ink, n) =>
          svg`<rect x=${n * 14} y=${40 - (COLUMNS[n] ?? 24)} width="10" height=${COLUMNS[n] ?? 24} rx="3" style=${`fill:${ink}`} />`,
      )}
    </svg></span
  >`;

/**
 * A set as a row to choose it by: its picture, its name, a check when it is the one worn. A set's name is the house's
 * own words, which may end in their ellipsis (`data-name`); the palette's row is said in ours, whole, with its line.
 */
function setRow(
  title: string,
  inks: readonly string[],
  active: boolean,
  onPick: (() => void) | null,
  sub?: string,
): TemplateResult {
  return html`<button
    class="pn-custom pn-set ${active ? 'is-active' : ''}"
    data-target
    aria-pressed=${active ? 'true' : 'false'}
    tabindex=${onPick ? nothing : '-1'}
    @click=${() => onPick?.()}
  >
    ${setArt(inks)}
    <span class="pn-custom__text">
      <span class="pn-custom__title" ?data-name=${!sub}>${title}</span>
      ${sub ? html`<span class="pn-custom__sub">${sub}</span>` : nothing}
    </span>
    ${active ? html`<span class="pn-custom__tail">${icon('check')}</span>` : nothing}
  </button>`;
}

/**
 * The colours of a chart's several series: the palette's six, or one of the house's sets — each pictured as the mode on
 * screen wears it, chosen with one tap; an administrator makes a new set (twelve at most) or changes the one chosen.
 */
function seriesCard(ctx: PanelContext): TemplateResult {
  const { admin } = ctx;
  const sets = ctx.settings.chartSets;
  const chosen = chosenSet(sets, ctx.shown.charts.series);
  const pick = (id: string) => (admin ? () => ctx.editCharts({ series: id }) : null);
  const editing = ctx.seriesDraft !== undefined;
  const room = roomForSet(sets);
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'palette', title: ctx.t('charts.series'), sub: ctx.t(admin ? 'charts.series_sub' : 'scope.admin_only') })}
    <div class="pn-sets ${admin ? '' : 'pn-sets--static'}">
      ${setRow(
        ctx.t('charts.palette'),
        PALETTE_INKS,
        !chosen,
        pick(PALETTE_SERIES),
        ctx.t('charts.palette_sub'),
      )}
      ${sets.map((set) =>
        setRow(
          set.name,
          setInks(set.colours, fitOf(ctx, set.colours), ctx.mode),
          chosen?.id === set.id,
          pick(set.id),
        ),
      )}
    </div>
    ${
      // the editor open is the one way on: no second draft over it
      admin && !editing
        ? html`<div class="pn-rows">
              ${
                chosen
                  ? listRow({
                      icon: 'pencil',
                      title: ctx.t('charts.edit'),
                      sub: chosen.name,
                      subName: true,
                      onTap: () =>
                        ctx.setSeriesDraft({
                          id: chosen.id,
                          name: chosen.name,
                          colours: chosen.colours,
                        }),
                    })
                  : nothing
              }
              ${
                room
                  ? listRow({
                      icon: 'plus',
                      tone: 'accent',
                      title: ctx.t('charts.new'),
                      sub: ctx.t('charts.new_sub'),
                      // the palette's six, named: a new set follows the palette until a colour is made fixed
                      onTap: () => ctx.setSeriesDraft({ name: '', colours: PALETTE_SIX }),
                    })
                  : nothing
              }
            </div>
            ${room ? nothing : html`<p class="pn-hint pn-hint--after">${ctx.t('charts.full')}</p>`}`
        : nothing
    }
  </section>`;
}

/**
 * What fitting leaves of a set, in words: each mode wears it fitted to its card (`fitSet`: every colour reads there), so
 * only two colours too close to tell apart are said (ΔE2000 under 8, once fitted) — on both cards, or on the one where
 * fitting brought them together — naming the colours as picked (a hex as typed), so the one to change is plain.
 */
function setWarnings(ctx: PanelContext, colours: readonly string[], fitted: FittedSet): string[] {
  return seriesCheck(fitted).map(({ a, b, mode }) =>
    ctx.t(mode ? `charts.close_${mode}` : 'charts.close', {
      a: colourName(ctx, colours[a] ?? ''),
      b: colourName(ctx, colours[b] ?? ''),
    }),
  );
}

/**
 * The two modes side by side, each a card of its own in that mode's colours (`pn-day`, `pn-night`: the look scoped to
 * it), its name over what it draws `width` across.
 */
function modes(
  ctx: PanelContext,
  width: number | undefined,
  draw: (mode: PaletteMode, width: number) => TemplateResult,
): TemplateResult {
  const inner = drawable(width && Math.floor((width - gap(ctx)) / 2 + 0.01) - 24);
  return html`<div class="pn-modes" data-fill-row>
    ${(['light', 'dark'] as const).map(
      (mode) =>
        html`<div
          class="pn-mode ${mode === 'dark' ? 'pn-night' : 'pn-day'} fv-tone--accent"
          data-mode=${mode}
        >
          <p class="fv-label pn-mode__name">${ctx.t(`charts.${mode}`)}</p>
          ${inner ? draw(mode, inner) : nothing}
        </div>`,
    )}
  </div>`;
}

/**
 * A set's six colours, each a dot as picked, the one being picked ringed in the accent; each carries its mark — the
 * palette's where it is a colour of the palette's (it follows the palette and the mode), a lock where it is a hex
 * (fixed). On the picker's columns: six a row on a phone, the first six of its twelve on a wide panel.
 */
function slots(
  ctx: PanelContext,
  draft: SeriesDraft,
  onSlot: (slot: number) => void,
): TemplateResult {
  const colors = onScreen(ctx);
  const picking = draft.slot ?? 0;
  return html`<div class="pn-dots">
    ${draft.colours.map((colour, n) => {
      const follows = isPaletteRef(colour);
      return html`<button
        class="pn-slot ${n === picking ? 'is-active' : ''}"
        data-target
        style=${`--dot:${follows ? refInk(colour) : colour};--dot-ink:${inkOn(follows ? refHex(colour, colors) : colour)}`}
        aria-label=${`${ctx.t('charts.colour', { n: n + 1 })}: ${colourName(ctx, colour)} · ${ctx.t(follows ? 'charts.follows' : 'charts.fixed')}`}
        aria-pressed=${n === picking ? 'true' : 'false'}
        @click=${() => onSlot(n)}
      >
        ${icon(follows ? 'palette' : 'lock')}
      </button>`;
    })}
  </div>`;
}

/**
 * The colour being picked: its number and its mark in words, then the palette's colours to pick from — its twelve series
 * colours, its accent with the statuses and the lit light, the energy states, each drawn as the look being chosen has it
 * in the mode on screen and named by its word, every group on the same columns — and Custom, a hex of one's own (on a
 * colour of the palette's: that colour's hex here, to start from).
 */
function picker(
  ctx: PanelContext,
  draft: SeriesDraft,
  onPick: (colour: string) => void,
): TemplateResult {
  const colors = onScreen(ctx);
  const picking = draft.slot ?? 0;
  const colour = draft.colours[picking] ?? '';
  const follows = isPaletteRef(colour);
  const group = (label: StringKey, refs: readonly string[]): TemplateResult =>
    html`<p class="fv-label pn-label">${ctx.t(label)}</p>
      ${swatches(
        refs.map((ref) => ({
          key: ref,
          label: colourName(ctx, ref),
          paint: refInk(ref),
          ink: inkOn(refHex(ref, colors)),
        })),
        colour,
        onPick,
      )}`;
  return html`<div class="pn-slot-head">
      <span class="pn-slot-head__title">${ctx.t('charts.colour', { n: picking + 1 })}</span>
      <span class="fv-badge pn-mark fv-tone--${follows ? 'accent' : 'neutral'}" data-fit="28"
        >${icon(follows ? 'palette' : 'lock')}${ctx.t(follows ? 'charts.follows' : 'charts.fixed')}</span
      >
    </div>
    ${group('charts.group_series', PALETTE_REFS.series)}
    ${group('charts.group_tones', PALETTE_REFS.tones)}
    ${group('charts.group_energy', PALETTE_REFS.energy)}
    <p class="fv-label pn-label">${ctx.t('charts.custom')}</p>
    ${hexField(
      follows ? refHex(colour, colors) : colour,
      ctx,
      onPick,
      ctx.t('charts.colour', { n: picking + 1 }),
    )}`;
}

/**
 * A set of series colours being made or changed: its name, its six colours (the palette's to start with, each followed
 * as the palette has it until a hex makes it fixed) and the picker of the one being picked, what fitting leaves of them
 * to say, how a light and a dark card wear them, and Save — the house keeps it and the charts wear it.
 */
function setEditor(ctx: PanelContext, draft: SeriesDraft, actions: ChartActions): TemplateResult {
  const set = (patch: Partial<SeriesDraft>): void => ctx.setSeriesDraft({ ...draft, ...patch });
  const room = roomForSet(ctx.settings.chartSets, draft.id);
  const whole = draft.name.trim() !== '' && room;
  const fitted = fitOf(ctx, draft.colours);
  const warnings = setWarnings(ctx, draft.colours, fitted);
  const picking = draft.slot ?? 0;
  const id = draft.id;
  return html`<section class="fv-card pn-card pn-editor">
    ${head({ icon: 'palette', title: ctx.t(id ? 'charts.editor_edit' : 'charts.editor_new'), sub: ctx.t('charts.editor_sub') })}
    <label class="pn-text">
      <span class="fv-label pn-label">${ctx.t('charts.name')}</span>
      <span class="fv-field"
        ><input
          class="fv-field__input"
          type="text"
          maxlength=${SET_NAME_MAX}
          .value=${draft.name}
          @input=${(event: Event) => set({ name: (event.target as HTMLInputElement).value })}
      /></span>
    </label>
    <p class="fv-label pn-label">${ctx.t('charts.colours')}</p>
    ${slots(ctx, draft, (slot) => set({ slot }))}
    ${picker(ctx, draft, (picked) =>
      set({ colours: draft.colours.map((own, n) => (n === picking ? picked : own)) }),
    )}
    ${
      warnings.length
        ? html`<div class="pn-status pn-status--warning pn-check" role="status">
            ${warnings.map((warning) => html`<p class="pn-status__text">${warning}</p>`)}
          </div>`
        : html`<p class="pn-hint pn-hint--after pn-check">${ctx.t('charts.check_ok')}</p>`
    }
    ${modes(ctx, ctx.fit?.width, (mode, width) =>
      previewSeries(setInks(draft.colours, fitted, mode), ctx.shown.charts, {
        mode,
        width,
        height: 64,
      }),
    )}
    ${room ? nothing : html`<p class="pn-hint pn-hint--after">${ctx.t('charts.full')}</p>`}
    <div class="pn-pair" data-fill-row>
      <button
        class="fv-btn fv-btn--quiet"
        data-target
        @click=${() => ctx.setSeriesDraft(undefined)}
      >
        ${ctx.t('charts.cancel')}
      </button>
      <button
        class="fv-btn fv-btn--accent"
        data-target
        ?disabled=${!whole}
        @click=${() => whole && actions.saveSet(draft)}
      >
        ${ctx.t('charts.save')}
      </button>
    </div>
    ${
      id
        ? html`<div class="pn-rows">
            ${listRow({
              icon: 'trash',
              title: ctx.t('charts.delete'),
              sub: draft.name,
              subName: true,
              trailing: 'none',
              onTap: () => actions.removeSet(id),
            })}
          </div>`
        : nothing
    }
  </section>`;
}

/** The Charts tab's cards (its preview apart: it goes under them, or beside them in the side column). */
export function charts(ctx: PanelContext, actions: ChartActions): TemplateResult {
  return html`${styleCard(ctx)} ${gaugeCard(ctx)} ${detailsCard(ctx)} ${timeCard(ctx)}
  ${seriesCard(ctx)} ${ctx.seriesDraft ? setEditor(ctx, ctx.seriesDraft, actions) : nothing}`;
}

/**
 * The charts as these settings draw them, in both modes side by side: a sensor's day with its bubble, the day's energy
 * as bars and a gauge — `width` the card's content (none until it is laid out).
 */
export function chartsPreview(ctx: PanelContext, width: number | undefined): TemplateResult {
  return html`<section class="fv-card pn-card pn-card--preview">
    ${head({ icon: 'eye', title: ctx.t('preview.title'), sub: ctx.t('charts.preview_sub') })}
    ${modes(ctx, width, (mode, inner) =>
      previewChart(ctx.shown.charts, {
        mode,
        width: inner,
        format: formatter(ctx),
        hass: ctx.hass,
      }),
    )}
  </section>`;
}
