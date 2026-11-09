import type { LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE, SLIDER_BASE } from '../shared/base.js';
import {
  actionFields,
  boolField,
  colourFields,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  selectField,
  showIconField,
  sliderFields,
  textField,
  whenOffField,
} from '../shared/form.js';
import { configKeys } from '../shared/config.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import type { FanCardConfig } from './fan-card.js';

/** The fan card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

export const base = [...HEAD_BASE, ...SLIDER_BASE];

export const keys = configKeys<FanCardConfig>()([
  'subtitle',
  'variant',
  'show_stepper',
  'show_presets',
  'preset_style',
  'show_oscillation',
  'show_direction',
  'when_off',
]);

/** What the editor shows where the config says nothing: what the card does then. */
export const defaults: EditorDefaults = () => ({
  variant: 'full',
  show_stepper: true,
  preset_style: 'full',
  show_presets: true,
  show_oscillation: true,
  show_direction: true,
  when_off: 'all',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['fan']),
      nameIconFields(),
      showIconField(),
      fieldRow(textField('subtitle'), selectField('variant', ['full', 'compact'])),
      boolField('show_stepper'),
      fieldRow(boolField('show_presets'), selectField('preset_style', ['full', 'chips'])),
      fieldRow(boolField('show_oscillation'), boolField('show_direction')),
      whenOffField(),
      ...sliderFields(),
      ...colourFields(),
      actionFields(),
    ],
    ...formLabels({
      show_presets: 'fan.preset',
    }),
  };
}
