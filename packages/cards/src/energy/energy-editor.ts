import { chartDefaults, strings, type LovelaceConfigForm } from '@fluvy/core';
import { chartDefaultsFor, chartSection } from '../chart/engine/index.js';
import { HEAD_BASE } from '../shared/base.js';
import type { ChartCaps } from '../shared/chart-config.js';
import { configKeys } from '../shared/config.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLabels,
  editorLanguage,
  entitiesField,
  entityField,
  fieldRow,
  hasLadder,
  iconField,
  nameField,
  NUMBER_DEFAULTS,
  numberField,
  numberFields,
  onlyWhen,
  selectField,
  showIconField,
  textField,
  unitChoicesOf,
} from '../shared/form.js';
import type {
  EditorChoices,
  EditorDefaults,
  FormHelper,
  RowsListSpec,
} from '../shared/rows-editor.js';
import {
  COLLECTION_LABEL,
  collectionChoices,
  collectionField,
  collectionHelper,
  following,
} from './collection-field.js';
import { LINE_CAPS, STACK_CAPS, type EnergyCardConfig } from './energy-card.js';
import { WATT_LADDERS } from './power.js';

/** The energy card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('energy');

/** What a config's variant draws: a stacked chart (`sources`, `overview`), or the line. */
const capsIn = (data: Readonly<Record<string, unknown>>): ChartCaps =>
  data['variant'] === 'sources' || data['variant'] === 'overview' ? STACK_CAPS : LINE_CAPS;

/**
 * Under a legend entry's period, while it reads its sensor's state: that a sensor which keeps counting (a total) reads
 * its day only so — a lifetime meter's state is all it ever counted.
 */
const countingHelper: FormHelper = (schema, _localize, item, hass) =>
  schema.name === 'period' &&
  !item?.['period'] &&
  String(hass?.states[String(item?.['entity'])]?.attributes['state_class']).startsWith('total')
    ? strings('energy-flow')(editorLanguage(), 'editor_period_total')
    : undefined;

export const base = HEAD_BASE;

export const keys = configKeys<EnergyCardConfig>()([
  'subtitle',
  'hours',
  'invert',
  'cost_entity',
  'show_cost',
  'legend',
  'variant',
  'show_soc',
  'show_house',
  'show_axis',
  'show_grid',
  'line_width',
  'stack',
  'collection_key',
  'unit',
  'decimals',
  'chart',
  'curve',
  'fill',
  'glow',
  'show_points',
  'highlight',
  'animate',
  'points',
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'legend',
    title: 'editor.rows',
    domains: ['sensor'],
    keys: ['entity', 'name', 'period', 'unit', 'decimals'],
    schema: [
      entityField(['sensor']),
      nameField(),
      // its state, or its change since midnight (a lifetime meter's day)
      choiceField('period', [['today', 'energy-flow.period_day']]),
      numberFields({ units: WATT_LADDERS }),
    ],
    // an entry's units are its own sensor's class, never the card's sensor's
    choices: unitChoicesOf,
    computeHelper: countingHelper,
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = (config) => ({
  variant: 'full',
  hours: chartDefaults().settings.window,
  invert: false,
  show_cost: true,
  show_soc: true,
  show_house: true,
  stack: true,
  collection_key: '',
  ...NUMBER_DEFAULTS,
  ...chartDefaultsFor(config, capsIn(config)),
});

/**
 * The date pickers on the dashboard, for the key; the units the editor offers are the sensor's class's (a chart of
 * the house's meters alone: every ladder).
 */
export const choices: EditorChoices = (config, hass) => ({
  collection_key: collectionChoices(hass),
  ...unitChoicesOf(config, hass),
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['sensor']),
      boolField('invert'),
      fieldRow(nameField(), textField('subtitle')),
      fieldRow(iconField(), showIconField()),
      ...colourFields(),
      // a date picker's range stands in for the window; a stacked chart draws today
      fieldRow(
        selectField('variant', ['full', 'compact', 'sources', 'overview']),
        onlyWhen(
          (data) => !following(data) && capsIn(data) === LINE_CAPS,
          numberField('hours', 1, 168),
        ),
      ),
      collectionField(),
      fieldRow(boolField('show_soc'), boolField('show_house')),
      boolField('stack'),
      fieldRow(entityField(['sensor'], 'cost_entity', false), boolField('show_cost')),
      entitiesField('legend', ['sensor']),
      // the line's styles, or a stacked chart's: what each variant draws
      chartSection([LINE_CAPS, STACK_CAPS], capsIn),
      numberFields({ when: hasLadder }),
      actionFields(),
    ],
    ...editorLabels(
      s,
      { cost_entity: 'cost', legend: 'editor_legend', stack: 'editor_stack' },
      {
        ...COLLECTION_LABEL,
        invert: 'energy-flow.editor_invert',
        period: 'energy-flow.editor_period',
      },
    ),
    computeHelper: collectionHelper,
  };
}
