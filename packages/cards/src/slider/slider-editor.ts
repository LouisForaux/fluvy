import { strings, type HaFormSchemaItem, type LovelaceConfigForm } from '@fluvy/core';
import { HEAD_BASE, SLIDER_BASE } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  actionFields,
  boolField,
  colourFields,
  editorLabels,
  editorLanguage,
  entityField,
  fieldRow,
  nameIconFields,
  onlyWhen,
  selectField,
  showIconField,
  sliderFields,
  textField,
  tintField,
} from '../shared/form.js';
import type { EditorDefaults } from '../shared/rows-editor.js';
import { CONTROLS, DOMAINS, VARIANTS, type SliderCardConfig } from './slider-card.js';

/** The Slider card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const s = strings('slider');

type Data = Readonly<Record<string, unknown>>;

/** The house's large tile: no head of the card's, no circle to show or hide. */
const tile = (data: Data): boolean => data['variant'] === 'tile';
/** The ends are a range's — a number's or a helper's, a player's volume — where a fan stops at its speeds. */
const ranged = (data: Data): boolean => !String(data['entity'] ?? '').startsWith('fan.');
/** A switch in the head, by the entity or another's: where the control may be one. */
const switches = ({ control }: Data): boolean =>
  !control || control === 'auto' || control === 'switch';

/** One of the ruler's own ends: any number, within the entity's range. */
const end = (name: string): HaFormSchemaItem => ({
  name,
  selector: { number: { mode: 'box', step: 'any' } },
});

export const base = [...HEAD_BASE, ...SLIDER_BASE];

export const keys = configKeys<SliderCardConfig>()([
  'variant',
  'control',
  'toggle_entity',
  'show_stepper',
  'live_update',
  'min',
  'max',
  'label',
  'tint',
]);

/** What the editor shows where the config says nothing: what the card does then (a tile shows its colour when on). */
export const defaults: EditorDefaults = (config) => ({
  variant: 'full',
  control: 'auto',
  show_stepper: true,
  live_update: false,
  tint: tile(config) ? 'on' : 'off',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(DOMAINS),
      nameIconFields(),
      onlyWhen((data) => !tile(data), showIconField()),
      fieldRow(
        selectField('variant', VARIANTS),
        // the − and + are the full card's
        onlyWhen(
          (data) => !data['variant'] || data['variant'] === 'full',
          boolField('show_stepper'),
        ),
      ),
      selectField('control', CONTROLS),
      onlyWhen(
        switches,
        entityField(
          ['switch', 'input_boolean', 'light', 'fan', 'media_player'],
          'toggle_entity',
          false,
        ),
      ),
      onlyWhen(ranged, fieldRow(end('min'), end('max'))),
      fieldRow(textField('label'), boolField('live_update')),
      // the slider's style: the fill is the tile's
      ...sliderFields(tile),
      ...colourFields(),
      tintField(['off', 'on', 'always']),
      actionFields(),
    ],
    ...editorLabels(s, { control: 'editor.control', toggle_entity: 'editor.toggle_entity' }),
    computeHelper: (schema) =>
      schema.name === 'control'
        ? s(editorLanguage(), 'editor.control_helper')
        : schema.name === 'toggle_entity'
          ? s(editorLanguage(), 'editor.toggle_entity_helper')
          : undefined,
  };
}
