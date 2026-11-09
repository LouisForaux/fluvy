import type { LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The calendar card, announced at start and defined when its chunk lands (`calendar-cards.ts`), as the weather card
 * is: what the picker lists and how tall it is at a 360 column, without the card itself.
 */

export const VIEWS = [
  'agenda',
  'month',
  'week',
  'month-day',
  'timeline',
  'upcoming',
  'tile',
] as const;
export type CalendarView = (typeof VIEWS)[number];

/** The view a config draws: its `variant`, the agenda when it names none. */
export const viewOf = (config: LovelaceCardConfig | undefined): CalendarView => {
  const variant = config?.['variant'] as CalendarView | undefined;
  return variant && VIEWS.includes(variant) ? variant : 'agenda';
};

/** The card at a 360 column, by the view it draws. */
const HEIGHTS: Readonly<Record<CalendarView, number>> = {
  agenda: 416,
  month: 360,
  week: 428,
  'month-day': 644,
  timeline: 476,
  upcoming: 340,
  tile: 168,
};

export const calendarHeight = (config: LovelaceCardConfig): number => HEIGHTS[viewOf(config)];

export const CALENDAR_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-calendar-card',
    'Fluvy · Calendar',
    'Agenda, month, week, month + day, timeline, upcoming or tile.',
    calendarHeight,
  ],
];
