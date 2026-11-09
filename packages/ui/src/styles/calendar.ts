import { unsafeCSS } from 'lit';
import { calendarCss } from './generated/calendar.js';

/** The calendar's sheet: a module of its own, so it travels in the calendar card's chunk. */
export const calendarSheet = unsafeCSS(calendarCss);
