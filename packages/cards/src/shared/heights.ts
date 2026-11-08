import { capabilitiesOf, entriesOf, type EntityView, type LovelaceCardConfig } from '@fluvy/core';
import { optionColumns } from '@fluvy/ui';

/*
 * What every card's `layoutHeight` counts with: the card's padding (20 above and below) and head (44, with 16
 * under it), a list's rows, and how many rows a set of things takes. Heights are measured at a 360 column.
 *
 * A row that lays itself out by measure (chips that fill a row, option tiles, a row of readouts) is counted with the
 * same rule the card applies, its words estimated letter by letter (`textWidth`: Inter's widths by the kind of
 * letter, calibrated on the rows as they draw), so the automatic dashboard plans a row of four short presets as one
 * line and a row of seven sources as two.
 */

/** The padding and the head: 20 + 44 + 16 + … + 20. */
export const HEAD = 100;
/** A 60 px row (`listRow`), a 48 px compact one, a 76 px bar row. */
export const ROW = 60;
export const ROW_COMPACT = 48;
export const ROW_BAR = 76;
/** A compact device card: the head and one 44 row. */
export const COMPACT = 144;
/** The empty panel a list with nothing to show draws where its rows would be (#48). */
export const EMPTY = 120;
/** A card's content column at a 360 column. */
export const COLUMN = 320;

/**
 * A small tile's name in two lines where one would end it in an ellipsis (`name_lines: 2`, #100; the editor writes
 * it as the word `'2'`): the tile is a line of its name taller whatever its name says — a compact tile 12 (76 → 88,
 * 84 → 96 inside a card: its name's 20 less the 8 its words had to spare), a mini 16 (108 → 124).
 */
export const twoLines = (config: LovelaceCardConfig | undefined): boolean =>
  Number(config?.['name_lines']) === 2;
export const NAME_LINE = { compact: 12, mini: 16 } as const;

/** The first of `keys` a config holds a list under. */
const firstList = (config: LovelaceCardConfig, keys: readonly string[]): unknown[] | undefined =>
  keys.map((key) => config[key]).find(Array.isArray);

/** How many things a config lists, under the first of `keys` that is an array. */
export const listLength = (config: LovelaceCardConfig, keys: readonly string[]): number =>
  firstList(config, keys)?.length ?? 0;

/** How many entities it lists there: a section's title or a divider among them is no row. */
export const entryCount = (config: LovelaceCardConfig, keys: readonly string[]): number =>
  entriesOf(firstList(config, keys)).length;

/** Rows a set of `count` things takes, `perRow` a row. */
export const rowsOf = (count: number, perRow: number): number => Math.ceil(count / perRow);

/* ---------- the house ---------- */

/*
 * A card declares its height from its config (`static layoutHeight`); what the house says of its entities — their
 * capabilities, their options, their names — `house-heights.ts` reads for the automatic dashboard and hands to the
 * card's height function, so no page but that dashboard's carries the reading.
 */

/** An entity's name as the house writes it (its `friendly_name`), for a row laid out by its words. */
export type NameOf = (id: unknown) => unknown;

/**
 * An entity as its card draws it: one this page has never read (missing since it opened: an integration still
 * starting, an id renamed) takes its domain's `usual` features, those `layoutHeight` counts where the house is not
 * there to say, so its card keeps that anatomy, its controls disabled and its values "—" (1.9: a card out of reach
 * keeps its size); one it has read keeps what Home Assistant last wrote of it (`resolveEntity`).
 */
export const drawnAs = (view: EntityView, usual: number): EntityView =>
  view.stateObj || capabilitiesOf(view.id)
    ? view
    : { ...view, supports: (bit) => (usual & bit) !== 0 };

/* ---------- words, letter by letter ---------- */

/** The kinds of text a row is laid out by: its size, its weight's extra width, its letter spacing. */
export type TextKind = 'chip' | 'option' | 'label' | 'legend' | 'title';
const KINDS: Readonly<Record<TextKind, readonly [size: number, weight: number, spacing: number]>> =
  {
    /** A chip's label, 13/500 (its letters run narrow: four of "Comfort" hold a row, four of "Standard" fold). */
    chip: [13, 0.93, 0],
    /** An option tile's label, 12/500. */
    option: [12, 1, 0],
    /** A readout's label, 11/600 at 0.06 em. */
    label: [11, 1.17, 0.66],
    /** A legend's name, 14/500. */
    legend: [14, 1, 0],
    /** A tile's or a card's title, 16/600. */
    title: [16, 1.06, 0],
  };

/** A letter's width in ems (Inter at 500): the narrow ones, the wide ones, the capitals, the rest. */
const em = (ch: string): number =>
  ch === ' '
    ? 0.27
    : "ilj|'.,:;!".includes(ch)
      ? 0.3
      : 'ftr'.includes(ch)
        ? 0.4
        : 'mMW'.includes(ch)
          ? 1
          : ch === 'w'
            ? 0.9
            : ch === '-'
              ? 0.38
              : ch >= 'A' && ch <= 'Z'
                ? 0.74
                : ch >= '0' && ch <= '9'
                  ? 0.63
                  : 0.64;

/** What `text` runs to in pixels as a row of `kind` draws it. */
export function textWidth(text: string, kind: TextKind): number {
  const [size, weight, spacing] = KINDS[kind];
  let ems = 0;
  for (const ch of text) ems += em(ch);
  return ems * size * weight + spacing * text.length;
}

/** A row's gap between its chips or tiles. */
const CHIP_GAP = 8;
/** A filled chip's pill round its label as the rows wrap (calibrated: four of "Standard" fold, four of "Comfort" hold); a content-sized chip's 14 a side. */
const CHIP_SIDES = 20;
const PILL_SIDES = 28;
/** An option tile's two sides (12 px of padding each). */
const TILE_SIDES = 24;

/**
 * The rows a row of chips takes at `width`: filled (`full`, the default) as `fittedColumns` lays it out — every
 * chip, else three, else two a row, the widest label deciding — or content-sized (`chips`), wrapping as its pills run.
 */
export function chipRows(
  labels: readonly string[],
  style: 'full' | 'chips' = 'full',
  width = COLUMN,
  candidates?: readonly number[],
): number {
  const count = labels.length;
  if (!count) return 0;
  if (style === 'chips') {
    let rows = 1;
    let used = 0;
    for (const label of labels) {
      const pill = textWidth(label, 'chip') + PILL_SIDES;
      if (used && used + CHIP_GAP + pill > width) {
        rows += 1;
        used = pill;
      } else used += (used ? CHIP_GAP : 0) + pill;
    }
    return rows;
  }
  const widest = Math.max(0, ...labels.map((label) => textWidth(label, 'chip') + CHIP_SIDES));
  const tried =
    candidates ??
    (count < 3 ? [count] : count === 3 ? [3, 2] : count === 4 ? [4, 2] : [count, 3, 2]);
  const columns = tried.find((n) => (width - CHIP_GAP * (n - 1)) / n >= widest) ?? 1;
  return rowsOf(count, Math.max(1, columns));
}

/**
 * A row of chips under its label: 16 above, the 20 label, 8, then its rows of 44 — a filled row's touch (the grid's),
 * content-sized chips (`chips`) that wrap are 8 apart (the row's gap).
 */
export const chipBlock = (rows: number, style?: string): number =>
  rows ? 36 + 8 + rows * 44 + (style === 'chips' ? (rows - 1) * CHIP_GAP : 0) : 0;

/**
 * The rows a set of option tiles takes at `width`, `gap` apart: as many columns as the count suggests
 * (`optionColumns`), one fewer while the longest label would not hold a cell, never under two (`optionColumnsFor`).
 */
export function optionRows(labels: readonly string[], width = COLUMN, gap = 4): number {
  const count = labels.length;
  if (!count) return 0;
  const widest = Math.max(0, ...labels.map((label) => textWidth(label, 'option')));
  let columns = optionColumns(count);
  while (columns > 2 && (width - gap * (columns - 1)) / columns - TILE_SIDES < widest) columns -= 1;
  return rowsOf(count, columns);
}

/** Option tiles under their label: 16 above, the 20 label, 8, then rows of 84 tiles 4 apart. */
export const optionBlock = (rows: number): number =>
  rows ? 36 + 8 + rows * 84 + (rows - 1) * 4 : 0;

/**
 * The rows a set of readouts takes in equal columns 16 apart (`statsColumns`): one for each while every label holds
 * its column, else fewer — a shorter last row takes the whole row. Figures are short; the labels decide.
 */
export function statsRows(labels: readonly string[], width = COLUMN): number {
  const count = labels.length;
  if (!count) return 0;
  const widths = labels.map((label) => textWidth(label, 'label'));
  let columns = count;
  while (columns > 1) {
    const room = (width - 16 * (columns - 1)) / columns;
    if (widths.every((wide, index) => (count % columns && index === count - 1) || wide <= room))
      break;
    columns -= 1;
  }
  return rowsOf(count, columns);
}

/** A row of readouts (44) 16 under what is above it, its rows 16 apart. */
export const statsBlock = (rows: number): number => (rows ? 16 + rows * 44 + (rows - 1) * 16 : 0);
