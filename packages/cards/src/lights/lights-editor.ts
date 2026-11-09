import type { LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionFields,
  areaField,
  boolField,
  colourFields,
  emptyFields,
  entityField,
  fieldRow,
  formLabels,
  iconField,
  lightColourFields,
  nameIconFields,
  nameLinesField,
  onlyWhen,
  selectField,
  showIconField,
  sliderFields,
  textField,
  tintField,
} from '../shared/form.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { LIGHTS_VARIANTS, type LightsCardConfig } from './lights-card.js';

/** The lights card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

export const base: readonly BaseKey[] = [
  'name',
  'icon',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'unavailable',
  'tap_action',
  'hold_action',
  'show_icon',
  'slider_style',
  'slider_words',
];

export const keys = configKeys<LightsCardConfig>()([
  'area',
  'lights',
  'variant',
  'name_lines',
  'show_count',
  'show_level',
  'show_brightness',
  'light_colors',
  'light_whites',
  'tint',
  ...EMPTY_KEYS,
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'lights',
    title: 'lights.editor_lights',
    domains: ['light'],
    keys: ['entity', 'name', 'icon', 'color'],
    schema: [entityField(['light']), nameIconFields(), accentField('color', { item: 'bulb' })],
  },
];

export const defaults: EditorDefaults = () => ({
  variant: 'row',
  name_lines: '1',
  show_count: true,
  show_level: true,
  show_brightness: false,
  light_colors: true,
  light_whites: 'temperature',
  tint: 'on',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      areaField(),
      fieldRow(textField('name'), iconField()),
      showIconField(),
      fieldRow(selectField('variant', LIGHTS_VARIANTS), boolField('show_brightness')),
      fieldRow(boolField('show_count'), boolField('show_level')),
      lightColourFields(),
      // the room's brightness in a style, where the card draws it (its tiles are compact: no slider of theirs)
      ...sliderFields().map((row) =>
        onlyWhen(({ show_brightness }) => show_brightness === true, row),
      ),
      ...colourFields(),
      // the tiles' colour at rest and their names' lines: the row and the chips have no surface to wash, no tile
      onlyWhen(({ variant }) => variant === 'tiles', fieldRow(tintField(), nameLinesField())),
      emptyFields(),
      actionFields(),
    ],
    ...formLabels({
      show_level: 'lights.editor_show_level',
      show_brightness: 'lights.editor_show_brightness',
      tint: 'lights.editor_tint',
    }),
  };
}
