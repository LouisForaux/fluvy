import { strings, type LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  cardOpacityField,
  unavailableField,
  editorLabels,
  entitiesField,
  entityField,
  fieldRow,
  nameField,
  numberField,
  onlyWhen,
  optionChoices,
  selectField,
  showIconField,
  textField,
  toneField,
} from '../shared/form.js';
import { VIEWS, type CalendarView } from '../calendar-family.js';
import type { CalendarCardConfig } from './config.js';
import { WEEKDAYS } from '../shared/dates.js';
import { configKeys } from '../shared/config.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';

/** The calendar card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('calendar');

const EDITOR_LABELS = {
  tile: 'editor_tile',
  first_weekday: 'editor_first_weekday',
  start_hour: 'editor_start_hour',
  end_hour: 'editor_end_hour',
} as const;

/* ---------- Lovelace ---------- */

/** A calendar card has no entity of its own: its calendars are its list, its colour the accent (today, the selection). */
export const base: readonly BaseKey[] = [
  'entities',
  'color',
  'card_color',
  'card_opacity',
  'unavailable',
  'show_icon',
];

export const keys = configKeys<CalendarCardConfig>()([
  'calendars',
  'variant',
  'tile',
  'title',
  'first_weekday',
  'days',
  'start_hour',
  'end_hour',
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'calendars',
    alias: 'entities',
    title: 'editor.rows',
    domains: ['calendar'],
    keys: ['entity', 'name', 'tone', 'color'],
    schema: [
      entityField(['calendar']),
      nameField(),
      fieldRow(toneField(), accentField('color', { item: 'own' })),
    ],
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'agenda',
  tile: 'date',
  first_weekday: 'language',
});

/** Whether the view is one of these: what a field acts on. */
const viewIs =
  (...views: readonly CalendarView[]) =>
  ({ variant }: Readonly<Record<string, unknown>>): boolean =>
    views.includes(variant as CalendarView);

/**
 * Where the week rolls (`first_weekday: today`, #111), a month starts on the house's first day, as with Language: the
 * month's select says Language for the `today` the config keeps (the week rolls again when it is back), until a
 * weekday is picked.
 */
export const choices: EditorChoices = (config) =>
  config['first_weekday'] === 'today' && viewIs('month', 'month-day')(config)
    ? {
        first_weekday: optionChoices(['language', ...WEEKDAYS]).map((option) =>
          option.value === 'language' ? { ...option, value: 'today' } : option,
        ),
      }
    : {};

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entitiesField('entities', ['calendar'], true),
      fieldRow(selectField('variant', VIEWS), textField('title')),
      showIconField(),
      // what each view reads, shown with it: the tile which of its two, the week and the month their first day — the
      // week's may be today's, a rolling week (#111) — the upcoming list its days, the timeline its hours
      onlyWhen(viewIs('tile'), selectField('tile', ['date', 'next'])),
      onlyWhen(viewIs('week'), selectField('first_weekday', ['language', 'today', ...WEEKDAYS])),
      onlyWhen(
        viewIs('month', 'month-day'),
        selectField('first_weekday', ['language', ...WEEKDAYS]),
      ),
      onlyWhen(viewIs('upcoming'), numberField('days', 1, 31)),
      onlyWhen(
        viewIs('timeline'),
        fieldRow(numberField('start_hour', 0, 23), numberField('end_hour', 1, 24)),
      ),
      fieldRow(accentField(), accentField('card_color', { none: true })),
      cardOpacityField(),
      unavailableField(),
    ],
    ...editorLabels(s, EDITOR_LABELS, { days: 'editor.days' }),
  };
}
