import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { chipRows, COLUMN, rowsOf, textWidth } from './shared/heights.js';

/**
 * The TV remote card (#143), announced at start and defined when its chunk lands (`remote-cards.ts`), as the Slider
 * card is: what the card picker lists and how tall the card is at a 360 column, without the card itself. Every page
 * carries this file: it stays tiny.
 */

/** The groups the full card draws, in the order the config names them. */
export const REMOTE_GROUPS = [
  'source',
  'dpad',
  'transport',
  'volume',
  'channel',
  'apps',
  'custom',
] as const;
export type RemoteGroup = (typeof REMOTE_GROUPS)[number];
/** The groups drawn where the config names none. */
export const DEFAULT_GROUPS: readonly RemoteGroup[] = [
  'source',
  'dpad',
  'transport',
  'volume',
  'apps',
];

const isGroup = (value: unknown): value is RemoteGroup =>
  typeof value === 'string' && (REMOTE_GROUPS as readonly string[]).includes(value);

/** The groups a config names, each once, only names the card knows; the default where it names none. */
export function remoteGroups(raw: unknown): readonly RemoteGroup[] {
  if (!Array.isArray(raw)) return DEFAULT_GROUPS;
  return [...new Set(raw.filter(isGroup))];
}

/** The compact row's keys and the row's rounds where the config names none. */
export const DEFAULT_KEYS: readonly string[] = [
  'back',
  'home',
  'play_pause',
  'volume_down',
  'volume_up',
];
export const DEFAULT_CONTROLS: readonly string[] = ['back', 'home', 'power'];

/** An app circle with its name under it (44 + 8 + 16), and the rows 8 apart; circles alone are 44. */
const APP_ROW = 68;
/** The cells an app row holds at most: as many as hold 50 (a 44 circle and 6), 4 apart. */
export const appsPerRow = (width: number): number => Math.max(1, Math.floor((width + 4) / 54));

/** How an apps row lays its circles out: so many a row, their names under them or not. */
export interface AppsLayout {
  readonly perRow: number;
  readonly names: boolean;
}

/**
 * The apps' cells across `width`: as many as hold 50 while every name holds its cell (4 inside it), fewer a row down to
 * three where that keeps the names, else the most with the circles alone — the names all or none, as option tiles.
 * The card measures its names in their class (`measure`); the heights estimate them letter by letter. The same rows
 * share the apps evenly, so none is left alone on the last (six at five a row: 3 + 3).
 */
export function appsLayout(
  names: readonly string[],
  width: number,
  measure: (text: string) => number = (text) => textWidth(text, 'name'),
): AppsLayout {
  const count = Math.max(1, names.length);
  const shared = (perRow: number): number => Math.ceil(count / rowsOf(count, perRow));
  const most = Math.min(count, appsPerRow(width));
  const widest = Math.max(0, ...names.map(measure));
  for (let n = most; n >= Math.min(3, most); n--) {
    const perRow = shared(n);
    if (widest <= (width - 4 * (perRow - 1)) / perRow - 4) return { perRow, names: true };
  }
  return { perRow: shared(most), names: false };
}

/** The rows of an apps row laid out so, and their height: 68 a row with names (8 apart), 44 without. */
export const appsBlock = (count: number, layout: AppsLayout): number => {
  const rows = Math.max(1, rowsOf(count, layout.perRow));
  const row = layout.names ? APP_ROW : 44;
  return rows * row + (rows - 1) * 8;
};

/**
 * The rows a row of equal action cells takes at `width`: one while every cell keeps a finger's 44 at the design's 16
 * gap, else at 4; past that, as many rows as five cells a row need (the cover's rule).
 */
export function actionRows(count: number, width = COLUMN): number {
  if (count <= 0) return 0;
  const fits = (gap: number): boolean => (width - gap * (count - 1)) / count >= 44;
  if (fits(16) || fits(4)) return 1;
  return rowsOf(count, Math.max(1, Math.floor((width + 16) / 60)));
}

/** What the house says of the device, where it is there to say: its sources, and the apps the row shows, by name. */
export interface RemoteHouse {
  readonly sources?: readonly string[];
  readonly apps?: readonly string[];
}

/** The names an apps row says for a config's own list: the person's, else the platform's id as it stands in for its title. */
const appNames = (apps: readonly unknown[]): string[] =>
  apps.map((app) => {
    const item = app as Readonly<Record<string, unknown>> | null;
    return String(item?.['name'] ?? item?.['app'] ?? item?.['source'] ?? '');
  });

/**
 * The remote's height at a 360 column from its config alone: the head (64 with the card's padding), 16 before each
 * group — the sources as one filled row of chips (the house counts their rows), the pad 176 between its keys, the
 * transport 48, the volume and the channel each a label over a 44 row (88 with their 16), the apps a row of 68 and
 * 76 for each more (as many a row as keep their names, six at most; one row of five by default), the custom keys a
 * row of 44 — and the card's 20 below. Compact: the head and its row of keys (144 with five); pad: the head and the
 * pad (276); row: 76. Unavailable, off or never read, the same.
 */
export function remoteHeight(config: LovelaceCardConfig, house: RemoteHouse = {}): number {
  const variant = config['variant'];
  if (variant === 'row') return 76;
  const count = (key: string, fallback: readonly string[]): number =>
    Array.isArray(config[key]) ? (config[key] as unknown[]).length : fallback.length;
  const rows = (n: number): number => (n ? n * 44 + (n - 1) * 16 : 0);
  if (variant === 'compact') return 64 + 16 + rows(actionRows(count('keys', DEFAULT_KEYS))) + 20;
  if (variant === 'pad') return 64 + 16 + 176 + 20;
  let height = 64 + 20;
  for (const group of remoteGroups(config['groups'])) {
    switch (group) {
      case 'source':
        height += 16 + 44 * (house.sources ? chipRows(house.sources) : 1);
        break;
      case 'dpad':
        height += 16 + 176;
        break;
      case 'transport':
        height += 16 + 48;
        break;
      case 'volume':
      case 'channel':
        height += 88;
        break;
      case 'apps': {
        // the person's list, else the platforms the house found among the sources, else a row of five short names
        const names = Array.isArray(config['apps'])
          ? appNames(config['apps'] as unknown[])
          : (house.apps ?? ['Netflix', 'YouTube', 'Spotify', 'Disney+', 'Prime']);
        height += 16 + appsBlock(names.length, appsLayout(names, COLUMN));
        break;
      }
      case 'custom':
        height += 16 + rows(actionRows(count('custom', [])));
        break;
    }
  }
  return height;
}

export const REMOTE_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-remote-card',
    'Fluvy · Remote',
    'A TV remote in Fluvy’s hand: power, sources, a D-pad with OK, playback, volume routed where you like, channels, the apps with their logos, keys of your own.',
    remoteHeight,
  ],
];
