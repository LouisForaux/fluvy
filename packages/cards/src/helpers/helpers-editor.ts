import type { HaFormSchemaItem, LovelaceConfigForm } from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import {
  actionFields,
  colourFields,
  emptyFields,
  entitiesField,
  entityField,
  fieldRow,
  formLabels,
  iconField,
  isSelectRow,
  nameIconFields,
  selectField,
  selectRowChoices,
  selectRowFields,
  showIconField,
  sinceChoices,
  sinceField,
  sliderFields,
  textField,
  titleFields,
} from '../shared/form.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { configKeys } from '../shared/config.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { HelpersCardConfig } from './helpers-card.js';

/** The helpers card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** A card of many helpers has no entity of its own: its head's icon, tone and colour, its tap ("…") and its hold. */
export const base: readonly BaseKey[] = [
  'entities',
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

export const keys = configKeys<HelpersCardConfig>()([
  'title',
  'subtitle',
  'rows',
  'options_style',
  ...EMPTY_KEYS,
]);

/** What every row shows: its entity, name and icon, its line and where its last change is read from. */
const ROW = [entityField(), nameIconFields(), textField('secondary'), sinceField()];
/** A time's quick-set times. */
const PRESETS: HaFormSchemaItem = {
  name: 'presets',
  selector: { select: { multiple: true, custom_value: true, options: [] } },
};
/** A select's (#96): the options it offers in their order (of those it lists), chips or a dropdown, and its words. */
const [OPTIONS, LABELS] = selectRowFields();
const SELECT = [OPTIONS, selectField('display', ['auto', 'chips', 'dropdown']), LABELS];
const OTHER_ROW = [...ROW, PRESETS];
const SELECT_ROW = [...ROW, ...SELECT];

export const lists: readonly RowsListSpec[] = [
  {
    key: 'rows',
    alias: 'entities',
    title: 'editor.rows',
    keys: [
      'entity',
      'name',
      'icon',
      'secondary',
      'since',
      'presets',
      'options',
      'display',
      'labels',
    ],
    schema: [...ROW, PRESETS, ...SELECT],
    schemaOf: (item) => (isSelectRow(item) ? SELECT_ROW : OTHER_ROW),
    choices: selectRowChoices,
  },
];

/** A row's `since` offers the house's timestamp sensors. */
export const choices: EditorChoices = sinceChoices;

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({ options_style: 'full' });

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      titleFields(),
      fieldRow(iconField(), selectField('options_style', ['full', 'chips'])),
      showIconField(),
      // its numbers' rulers in a style
      ...sliderFields(),
      ...colourFields(),
      entitiesField('entities', undefined, true),
      emptyFields(),
      actionFields(),
    ],
    // a select row's `display` is the card's `options_style` said of one select: its options as chips or a dropdown
    ...formLabels({ options_style: 'editor.options_style', display: 'editor.options_style' }),
  };
}
