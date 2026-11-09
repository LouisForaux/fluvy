import type { EntityName, FluvyCardConfig } from '@fluvy/core';
import type { HeadConfig } from '../shared/base.js';
import type { FirstWeekday } from '../shared/dates.js';
import { type Tone } from '@fluvy/ui';
import type { CalendarView } from '../calendar-family.js';

/**
 * The tones a calendar may take, in the order they are handed out. The accent is not among them and
 * never will be: on a calendar the accent means today, the selection, now and the primary action.
 */
export const CALENDAR_TONES = [
  'cool',
  'heat',
  'water',
  'media',
  'grid',
  'fan',
  'dry',
  'solar',
] as const;
export type CalendarTone = (typeof CALENDAR_TONES)[number];

/** One calendar of the card: its entity, and a name, a tone or a colour of its own. */
export interface CalendarItem {
  entity: string;
  name?: EntityName;
  /** One of the calendar tones; anything else (the accent included) is ignored: the accent means today. */
  tone?: string;
  /** Its own colour instead: the palette's family of it paints its events. */
  color?: string;
}

export interface CalendarCardConfig extends FluvyCardConfig, HeadConfig {
  /** One or more `calendar.*` entities, as ids or with a name, a tone or a colour each. */
  calendars?: ReadonlyArray<string | CalendarItem>;
  variant?: CalendarView;
  /** Which of the two tiles the `tile` view draws. */
  tile?: 'date' | 'next';
  title?: string;
  /** The weekday the week and the month start on; `today` (#111): the week view's strip starts on today, rolling. */
  first_weekday?: FirstWeekday | 'today';
  /** `upcoming`: how many days ahead (default 7). */
  days?: number;
  /** `timeline`: the hours drawn (default 8 – 23), widened when the day's events need it. */
  start_hour?: number;
  end_hour?: number;
  /** Test hook: an ISO instant that freezes "now", so a render can be held against the design sheet. */
  _now?: string;
  /** Test hook: an ISO date picked as if tapped (a sheet shows the selected day apart from today). */
  _picked?: string;
}

/** The card's calendars as items, in order; a bare id is an item with nothing of its own. */
export const calendarsOf = (config: CalendarCardConfig | undefined): CalendarItem[] =>
  (config?.calendars ?? [])
    .map((item) => (typeof item === 'string' ? { entity: item } : item))
    .filter((item) => typeof item.entity === 'string' && item.entity !== '');

/** The ids of the card's calendars, in order. */
export const idsOf = (config: CalendarCardConfig | undefined): string[] =>
  calendarsOf(config).map((item) => item.entity);

const whole = (value: unknown, fallback: number, min: number, max: number): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export const daysOf = (config: CalendarCardConfig | undefined): number =>
  whole(config?.days ?? 7, 7, 1, 31);

/** The configured timeline hours, always a window of at least one hour inside 0 – 24. */
export function hoursOf(config: CalendarCardConfig | undefined): {
  readonly start: number;
  readonly end: number;
} {
  const start = whole(config?.start_hour ?? 8, 8, 0, 23);
  const end = whole(config?.end_hour ?? 23, 23, 1, 24);
  return { start, end: Math.max(start + 1, end) };
}

/** A calendar's tone: its own, else the accent when it has a colour of its own, else the next of the cycle. */
export function toneOf(config: CalendarCardConfig | undefined, entityId: string): Tone {
  const items = calendarsOf(config);
  const index = Math.max(
    0,
    items.findIndex((item) => item.entity === entityId),
  );
  const item = items[index];
  const known = CALENDAR_TONES.find((tone) => tone === item?.tone);
  if (known) return known;
  if (item?.color) return 'accent';
  return CALENDAR_TONES[index % CALENDAR_TONES.length] ?? 'cool';
}
