import { chartDefaults, strings, type HomeAssistant, type LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import type { ChartCaps } from '../shared/chart-config.js';
import { chartEngine } from '../shared/chart-load.js';
import {
  accentField,
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  editorWord,
  entityField,
  fieldRow,
  hasLadder,
  iconField,
  nameField,
  nameIconFields,
  NUMBER_DEFAULTS,
  numberField,
  numberFields,
  selectField,
  showIconField,
  textField,
  unitChoicesOf,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { normaliseExtras } from './series.js';
import type { SensorCardConfig } from './sensor-card.js';

/** The sensor card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('sensor');

/**
 * What the sensor's chart can draw: a rolling window that ends at now (no now of its own, no forecast), its line
 * through it, a scale, and bars where it is alone and its readings add up (several sensors each keep their own scale:
 * lines only). `CHART_CAPS` is all of it, what the editor's keys are drawn from; `capsIn` what a config (and its
 * sensor) allows.
 */
const CHART_CAPS: ChartCaps = { bars: true, axis: true, time: true };

const severalIn = (data: Readonly<Record<string, unknown>>): boolean =>
  normaliseExtras(data['entities']).length > 0;

const capsIn = (data: Readonly<Record<string, unknown>>, hass?: HomeAssistant): ChartCaps => {
  if (severalIn(data)) return { axis: true, several: true, time: true };
  // whether its readings add up is the engine's to say: it lands with the bundle, long before an editor opens
  const attributes = hass?.states[String(data['entity'] ?? '')]?.attributes ?? {};
  const readings = chartEngine()?.readingsOf(
    attributes['device_class'],
    attributes['state_class'],
    attributes['unit_of_measurement'],
  );
  return { axis: true, bars: readings?.bars ?? false, time: true };
};

/** The card's own sensor and, in `entities`, up to two more drawn beside it. */
export const base: readonly BaseKey[] = [
  'entity',
  'entities',
  'name',
  'icon',
  'tap_action',
  'hold_action',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'unavailable',
  'show_icon',
];

export const keys = configKeys<SensorCardConfig>()([
  'subtitle',
  'label',
  'hours',
  'show_stats',
  'variant',
  'unit',
  'decimals',
  'chart',
  'curve',
  'fill',
  'line_width',
  'glow',
  'show_points',
  'show_grid',
  'show_axis',
  'highlight',
  'animate',
  'points',
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'entities',
    title: 'editor.also_sensors',
    domains: ['sensor', 'number', 'input_number', 'counter'],
    keys: ['entity', 'name', 'icon', 'color'],
    schema: [
      entityField(['sensor', 'number', 'input_number', 'counter']),
      nameIconFields(),
      accentField('color', { item: 'own' }),
    ],
    computeHelper: (schema) =>
      schema.name === 'name' ? editorWord('editor.extra_name_helper') : undefined,
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = (config, hass) => ({
  variant: 'chart',
  hours: chartDefaults().settings.window,
  show_stats: true,
  ...NUMBER_DEFAULTS,
  ...chartEngine()?.chartDefaultsFor(config, capsIn(config, hass)),
});

/** The units the editor offers are the sensor's class's. */
export const choices = unitChoicesOf;

export function getConfigForm(): LovelaceConfigForm {
  // the Chart section is the engine's, here as an editor opens (it waits for the engine)
  const chart = chartEngine()?.chartSection(CHART_CAPS, capsIn);
  return {
    schema: [
      entityField(['sensor', 'number', 'input_number', 'counter']),
      fieldRow(nameField(), textField('subtitle')),
      fieldRow(iconField(), showIconField()),
      ...colourFields(),
      fieldRow(selectField('variant', ['chart', 'tile']), numberField('hours', 1, 168)),
      boolField('show_stats'),
      textField('label'),
      ...(chart ? [chart] : []),
      numberFields({ when: hasLadder }),
      actionFields(),
    ],
    ...editorLabels(s, { show_stats: 'editor.show_stats' }, { label: 'editor.chart_label' }),
    computeHelper: (schema) =>
      schema.name === 'label' ? editorWord('editor.chart_label_helper') : undefined,
  };
}
