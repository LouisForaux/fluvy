import { lightDefaults, type LovelaceConfigForm } from '@fluvy/core';
import {
  accentField,
  actionFields,
  colourFields,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  holdsLight,
  lightColourFields,
  nameIconFields,
  nameLinesField,
  onlyWhen,
  selectField,
  sinceChoices,
  sinceField,
  sliderFields,
  tintField,
  toneField,
  unavailableField,
} from '../shared/form.js';
import type { BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import { SIZES, type TilesCardConfig } from './tiles-card.js';

/** The tiles card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const COLUMNS = ['1', '2', '3', '4', 'auto'] as const;

/** The group has no entity of its own: its tone and colour are its tiles' default. */
export const base: readonly BaseKey[] = [
  'entities',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'unavailable',
  'slider_style',
  'slider_words',
];

export const keys = configKeys<TilesCardConfig>()([
  'size',
  'name_lines',
  'readouts',
  'tiles',
  'columns',
  'tint',
  'light_colors',
  'light_whites',
  ...EMPTY_KEYS,
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'tiles',
    alias: 'entities',
    title: 'editor.tiles',
    keys: [
      'entity',
      'name',
      'icon',
      'tone',
      'color',
      'readouts',
      'since',
      'unavailable',
      'tap_action',
      'hold_action',
    ],
    schema: [
      entityField(),
      nameIconFields(),
      fieldRow(toneField(), accentField('color', { item: 'bulb' })),
      entitiesField('readouts', ['sensor']),
      sinceField(),
      unavailableField({ item: true }),
      actionFields(),
    ],
  },
];

/** A tile's `since` offers the house's timestamp sensors. */
export const choices: EditorChoices = sinceChoices;

// the columns a group takes when it names none: three minis a row, else two
export const defaults: EditorDefaults = (config) => ({
  size: 'compact',
  name_lines: '1',
  columns: config['size'] === 'mini' ? '3' : '2',
  tint: 'on',
  light_colors: lightDefaults().colors,
  light_whites: 'temperature',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entitiesField('entities', undefined, true),
      fieldRow(selectField('size', SIZES), selectField('columns', COLUMNS)),
      // a small tile's name may take two lines
      onlyWhen(({ size }) => size !== 'large', nameLinesField()),
      ...colourFields(),
      tintField(),
      // a light's colours where the group holds a light; its large tiles' sliders in a style (the fill is theirs)
      onlyWhen(holdsLight('tiles', 'entities'), lightColourFields()),
      ...sliderFields(true).map((row) => onlyWhen(({ size }) => size === 'large', row)),
      entitiesField('readouts', ['sensor']),
      emptyFields(),
    ],
    ...formLabels({ readouts: 'editor.readouts' }),
  };
}
