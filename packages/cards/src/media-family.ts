import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';
import { chipBlock, chipRows } from './shared/heights.js';

/**
 * The media family, announced at start and defined when its chunk lands (`media-cards.ts`), as the energy family
 * is: what the card picker lists, how tall each card is at a 360 column and the rounds a compact row names, without
 * the cards themselves — so the pages that show no player (Settings, the Activity page) never carry them.
 */

/** The rounds a compact row can carry (`controls`), in the order they are named. */
export const MEDIA_CONTROLS = ['power', 'previous', 'play', 'next', 'volume'] as const;
export type MediaControl = (typeof MEDIA_CONTROLS)[number];

/** The now-playing strip's rounds when `controls` is left out: today's strip. */
export const NOW_PLAYING_CONTROLS: readonly MediaControl[] = ['previous', 'play', 'next', 'volume'];

const isControl = (value: unknown): value is MediaControl =>
  typeof value === 'string' && (MEDIA_CONTROLS as readonly string[]).includes(value);

/**
 * The `controls` a card was given, as it draws them: in the order written, each once, only names it knows;
 * `fallback` when the key is left out (or is not a list). An empty list is an empty list.
 */
export function mediaControls(
  raw: unknown,
  fallback: readonly MediaControl[],
): readonly MediaControl[] {
  if (!Array.isArray(raw)) return fallback;
  return [...new Set(raw.filter(isControl))];
}

/** The sources a card lists at most (its own `MAX_SOURCES`). */
const MAX_SOURCES = 6;

/**
 * The player: artwork, title and controls (264), the volume under them (88), the sources as chips under their label
 * where the player has some (six at most, filled rows: the house lists them, `house-heights.ts`; none where it is not
 * there to say); a hero and a row their own. A player that is off draws "Turn on" in place of its transport: the on
 * height is the one reserved.
 */
export function mediaHeight(config: LovelaceCardConfig, sources: readonly string[] = []): number {
  if (config['variant'] === 'hero') return 600;
  if (config['variant'] === 'mini') return 76;
  const shown = config['show_source'] === false ? [] : sources.slice(0, MAX_SOURCES);
  const style = config['source_style'] === 'chips' ? 'chips' : 'full';
  return (config['show_volume'] === false ? 264 : 352) + chipBlock(chipRows(shown, style), style);
}

/**
 * The strip: the artwork, its progress line (at rest while nothing has a length) and its rounds' row, none when
 * `controls` is empty.
 */
export const nowPlayingHeight = (config: LovelaceCardConfig): number =>
  mediaControls(config['controls'], NOW_PLAYING_CONTROLS).length ? 212 : 148;

export const MEDIA_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-media-card',
    'Fluvy · Media',
    'A media player: artwork, seek bar, transport and volume — full, compact row or hero.',
    mediaHeight,
  ],
  [
    'fluvy-now-playing-card',
    'Fluvy · Now playing',
    'The compact player of the home screen: artwork, thin progress, transport and volume.',
    nowPlayingHeight,
  ],
];
