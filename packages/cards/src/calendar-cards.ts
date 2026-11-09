import { registerCard } from '@fluvy/core';
import { CALENDAR_FAMILY } from './calendar-family.js';
import { FluvyCalendarCard } from './calendar/calendar-card.js';

/**
 * The calendar card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands.
 * Its name, description and height live in `calendar-family.ts`, which every page carries.
 */
export const CARDS = CALENDAR_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyCalendarCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
