import {
  lightDefaults,
  type HaFormSchemaItem,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import { HEAD_BASE, SLIDER_BASE } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLanguage,
  editorWord,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  onlyWhen,
  selectField,
  showIconField,
  sliderFields,
  textField,
  tintField,
} from '../shared/form.js';
import { COLOURED, dims } from '../shared/light.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { CUSTOM, defaultSwatches, SWATCH_WORDS, swatchEntry, swatchItem } from './swatches.js';
import type { LightCardConfig, TintStrength } from './light-card.js';

/** The light card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

const STRENGTHS: readonly TintStrength[] = ['soft', 'brightness', 'full', 'full_brightness'];

/** A row's fields in one language: the select and the name on one line, the well under them while the row is Custom. */
interface SwatchFields {
  readonly color: HaFormSchemaItem;
  readonly word: readonly HaFormSchemaItem[];
  readonly custom: readonly HaFormSchemaItem[];
}
/**
 * The editor's `when`s, from what the bulb does as the house reports it (`modesOf`; an entity the house has not
 * described is a colour bulb, so every option shows): the dimmer's options while it dims, the temperature's with a
 * white, the colours' with a colour.
 */
type BulbWhen = NonNullable<HaFormSchemaItem['when']>;

/**
 * The quick colour a row of the editor is: the words, the picker, or Custom colour — one of your own, picked in the
 * well the row then shows (Home Assistant's select with a typed value says the value, not the word, so none is
 * typed here: a name or a hex still reads from YAML). Worded when the editor first asks, in its language: a select
 * worded as its module lands could say its raw values ("warm", "custom") in a house whose catalogue had not yet.
 */
const swatchSelect = (): HaFormSchemaItem => ({
  name: 'color',
  selector: {
    select: {
      mode: 'dropdown',
      options: [
        ...SWATCH_WORDS.map((value) => ({
          value,
          label: editorWord(
            (value === 'warm' || value === 'cool'
              ? `light.${value}`
              : `option.${value}`) as MessageKey,
          ),
        })),
        { value: CUSTOM, label: editorWord('option.custom') },
      ],
    },
  },
});

/** A Custom row's well: Home Assistant's own colour selector, `[r, g, b]`. */
const RGB_FIELD: HaFormSchemaItem = { name: 'rgb', selector: { color_rgb: {} } };

const fieldsByLanguage = new Map<string, SwatchFields>();

/** The row's fields for the editor's language, built once per language: the same arrays for the same answer. */
const swatchFieldsFor = (): SwatchFields => {
  const { language } = editorLanguage();
  let fields = fieldsByLanguage.get(language);
  if (!fields) {
    const color = swatchSelect();
    const word: readonly HaFormSchemaItem[] = [fieldRow(color, textField('name'))];
    fields = { color, word, custom: [...word, RGB_FIELD] };
    fieldsByLanguage.set(language, fields);
  }
  return fields;
};

/** The fields a row shows: the well only while the row is Custom; the same array for the same answer. */
const swatchFields = (item: Readonly<Record<string, unknown>>): readonly HaFormSchemaItem[] =>
  item['color'] === CUSTOM ? swatchFieldsFor().custom : swatchFieldsFor().word;

/** The colour modes a config's bulb supports, as the house reports them; none where the editor has no house yet. */
const modesOf = (
  config: Readonly<Record<string, unknown>>,
  hass: { states: Record<string, { attributes: Record<string, unknown> }> } | undefined,
): readonly string[] => {
  const entity = config['entity'];
  const modes =
    typeof entity === 'string'
      ? hass?.states[entity]?.attributes['supported_color_modes']
      : undefined;
  return Array.isArray(modes) ? modes.filter((m): m is string => typeof m === 'string') : [];
};

const bulbDims: BulbWhen = (config, hass) => dims(modesOf(config, hass));

const bulbWarms: BulbWhen = (config, hass) => {
  const modes = modesOf(config, hass);
  return !modes.length || modes.includes('color_temp');
};

const bulbColours: BulbWhen = (config, hass) => {
  const modes = modesOf(config, hass);
  return !modes.length || modes.some((mode) => COLOURED.has(mode));
};

/**
 * What the card shows of the bulb under its head, where it shows it at all (`show_brightness` other than never, #124):
 * the card that never shows the brightness is its head alone, as a bulb that only switches.
 */
const shown =
  (when: BulbWhen): BulbWhen =>
  (config, hass) =>
    config['show_brightness'] !== false && when(config, hass);

/** When the card shows the brightness (#124), as its config writes it: always, while the light is on, never. */
const brightnessField = (): HaFormSchemaItem =>
  choiceField('show_brightness', [
    ['true', 'option.always'],
    ['when_on', 'option.on'],
    ['false', 'option.never'],
  ]);

export const base = [...HEAD_BASE, ...SLIDER_BASE];

export const keys = configKeys<LightCardConfig>()([
  'show_brightness',
  'variant',
  'show_stepper',
  'live_update',
  'show_temperature',
  'temperature_tint',
  'show_color',
  'colors',
  'tint',
  'tint_strength',
  'light_whites',
]);

/**
 * The quick colours, edited row by row in their order, any number of them: each a colour (a word, the picker,
 * or Custom with its well) and a name of its own. The bulb's default six show as rows until the list is touched;
 * `when` says while which cards the list is edited (the room lights card's sheet shares it, #137).
 */
export const swatchList = (when: BulbWhen): RowsListSpec => ({
  key: 'colors',
  title: 'editor.colors',
  idKey: 'color',
  when,
  get picker() {
    return swatchFieldsFor().color;
  },
  keys: ['color', 'rgb', 'name'],
  get schema() {
    return swatchFieldsFor().custom;
  },
  schemaOf: swatchFields,
  read: swatchItem,
  write: swatchEntry,
  // the well is Home Assistant's colour input, which paints its whole field: a floating label would sit on the
  // colour, so the well carries no label and its word goes under it as the helper
  computeLabel: (schema) => (schema.name === 'rgb' ? '' : undefined),
  computeHelper: (schema) =>
    schema.name === 'color'
      ? editorWord('editor.color_help')
      : schema.name === 'name'
        ? editorWord('editor.swatch_name_help')
        : schema.name === 'rgb'
          ? editorWord('editor.rgb')
          : undefined,
});

/** The quick colours are a colour bulb's: the list is edited while the bulb has a colour to take, on a card that shows them. */
export const lists: readonly RowsListSpec[] = [swatchList(shown(bulbColours))];

/** What the editor shows where the config says nothing: what the card does then (the quick colours by the bulb). */
export const defaults: EditorDefaults = (config, hass) => ({
  show_brightness: true,
  live_update: false,
  variant: 'auto',
  show_stepper: true,
  show_temperature: true,
  show_color: true,
  temperature_tint: true,
  colors: defaultSwatches(modesOf(config, hass)),
  tint: lightDefaults().tint,
  tint_strength: 'full',
  light_whites: 'temperature',
});

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      entityField(['light']),
      nameIconFields(),
      showIconField(),
      // the editor offers what the bulb does (#65): when the card shows its brightness while it dims (#124); then,
      // where it shows it, the dimmer's layout, stepper and live update, the temperature ruler's options with a white,
      // the colours' with a colour
      onlyWhen(
        bulbDims,
        fieldRow(
          brightnessField(),
          onlyWhen(shown(bulbDims), selectField('variant', ['auto', 'full', 'compact'])),
        ),
      ),
      onlyWhen(shown(bulbDims), fieldRow(boolField('show_stepper'), boolField('live_update'))),
      // its rulers' style, where it draws any: the brightness's, the temperature's, the hue's
      ...sliderFields().map((row) => onlyWhen(shown(bulbDims), row)),
      fieldRow(
        onlyWhen(shown(bulbWarms), boolField('show_temperature')),
        onlyWhen(shown(bulbColours), boolField('show_color')),
      ),
      // the list is edited row by row (the rows editor takes the field out of the form)
      { name: 'colors', selector: { object: {} } },
      onlyWhen(shown(bulbWarms), boolField('temperature_tint')),
      // its colour follows the light's unless one is given (Home Assistant's State, as its own tile's)
      ...colourFields({ state: true }),
      fieldRow(
        tintField(['off', 'on', 'always']),
        // a strength is a lit surface's: none to choose while the light never shows its colour — by its own tint,
        // else by the house's
        onlyWhen(
          ({ tint }) => tint === 'on' || tint === 'always',
          selectField('tint_strength', STRENGTHS, { words: { full: 'full_colour' } }),
        ),
      ),
      // how a white shows is the bulb's: none to choose while the card wears a colour or a tone of its own, nor
      // for a bulb that is never white
      onlyWhen(
        (data, hass) =>
          (!data['color'] || data['color'] === 'state') &&
          !data['tone'] &&
          (bulbWarms(data, hass) || bulbColours(data, hass)),
        selectField('light_whites', ['palette', 'temperature']),
      ),
      actionFields(),
    ],
    ...formLabels({
      show_temperature: 'light.temperature',
      show_color: 'editor.show_color',
      colors: 'editor.colors',
      temperature_tint: 'editor.temperature_tint',
      live_update: 'editor.live_update',
    }),
  };
}
