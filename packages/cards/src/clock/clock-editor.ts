import { strings, type LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  accentField,
  actionField,
  boolField,
  cardOpacityField,
  onlyWhen,
  unavailableField,
  entityField,
  fieldRow,
  formLabels,
  selectField,
  textField,
} from '../shared/form.js';
import { resolveHour12 } from './time.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import type { ClockCardConfig } from './clock-card.js';

/** The clock card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('clock', 'weather');

const CORE_LABELS = {
  weather: 'editor.weather',
  show_seconds: 'editor.seconds',
} as const;

const OWN_LABELS = {
  numerals: 'editor.numerals',
  show_week: 'editor.week',
  hour12: 'editor.hour12',
  time_zone: 'editor.time_zone',
} as const;

const isOwnLabel = (name: string): name is keyof typeof OWN_LABELS => name in OWN_LABELS;

/** A clock has no entity: it honours a tap and the card's colour (the face's accent). */
export const base: readonly BaseKey[] = [
  'tap_action',
  'color',
  'card_color',
  'card_opacity',
  'unavailable',
];

export const keys = configKeys<ClockCardConfig>()([
  'face',
  'variant',
  'numerals',
  'show_seconds',
  'hour12',
  'weather',
  'show_forecast',
  'show_week',
  'time_zone',
  'title',
  'show_date',
]);

export const defaults: EditorDefaults = (config, hass) => {
  const analog = config['face'] !== 'digital';
  const hero = config['variant'] !== 'side' && config['variant'] !== 'tile';
  return {
    face: 'analog',
    variant: 'hero',
    numerals: 'none',
    show_seconds: analog && hero,
    hour12: resolveHour12(hass, undefined),
    show_date: true,
    show_week: false,
    show_forecast: Boolean(config['weather']),
  };
};

export function getConfigForm(): LovelaceConfigForm {
  const core = formLabels(CORE_LABELS);
  return {
    schema: [
      fieldRow(
        selectField('face', ['analog', 'digital']),
        selectField('variant', ['hero', 'side', 'tile']),
      ),
      fieldRow(selectField('numerals', ['none', 'quarters', 'all']), textField('title')),
      boolField('show_seconds'),
      boolField('hour12'),
      boolField('show_date'),
      boolField('show_week'),
      entityField(['weather'], 'weather', false),
      boolField('show_forecast'),
      textField('time_zone'),
      accentField(),
      accentField('card_color', { none: true }),
      cardOpacityField(),
      // what is out of reach on a clock is its weather
      onlyWhen(({ weather }) => Boolean(weather), unavailableField()),
      actionField(),
    ],
    computeLabel: (schema, localize) =>
      core.computeLabel?.(schema, localize) ??
      (isOwnLabel(schema.name)
        ? s({ language: document.documentElement.lang || 'en' }, OWN_LABELS[schema.name])
        : undefined),
  };
}
