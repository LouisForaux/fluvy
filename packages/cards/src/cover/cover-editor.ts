import { strings, type LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE, SLIDER_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  entityField,
  fieldRow,
  nameIconFields,
  numberField,
  onlyWhen,
  selectField,
  showIconField,
  sliderFields,
  textField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import type { CoverCardConfig } from './cover-card.js';

/** The cover card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const coverStrings = strings('cover');

export const base = [...HEAD_BASE, ...SLIDER_BASE];

export const keys = configKeys<CoverCardConfig>()([
  'subtitle',
  'variant',
  'favorites',
  'favorites_style',
  'show_tilt',
  'show_favorites',
  'tilt_angle',
]);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'favorites',
    idKey: 'name',
    title: 'editor.favorites',
    keys: ['name', 'position', 'tilt'],
    schema: [
      textField('name'),
      fieldRow(numberField('position', 0, 100), numberField('tilt', 0, 100)),
    ],
  },
];

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  favorites_style: 'full',
  show_tilt: true,
  show_favorites: true,
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['cover', 'valve']),
      nameIconFields(),
      showIconField(),
      fieldRow(textField('subtitle'), numberField('tilt_angle', 0, 360)),
      fieldRow(
        selectField('variant', ['full', 'compact']),
        selectField('favorites_style', ['full', 'chips']),
      ),
      fieldRow(boolField('show_tilt'), boolField('show_favorites')),
      { name: 'favorites', selector: { object: {} } },
      // its position ruler's style, where the full card draws one
      ...sliderFields().map((row) =>
        onlyWhen(({ variant }) => variant === undefined || variant === 'full', row),
      ),
      ...colourFields(),
      actionFields(),
    ],
    ...editorLabels(coverStrings, { tilt_angle: 'tilt_angle' }, {}),
  };
}
