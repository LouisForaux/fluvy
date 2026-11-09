import {
  areaEntities,
  entriesOf,
  idsOf,
  type HaFormSchemaItem,
  type HomeAssistant,
  type LovelaceConfigForm,
} from '@fluvy/core';
import type { BaseKey } from '../shared/base.js';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionFields,
  areaField,
  boolField,
  choiceField,
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
import { COLOURED } from '../shared/light.js';
import { EMPTY_KEYS } from '../shared/lists.js';
import type { EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { swatchList } from '../light/light-editor.js';
import { defaultSwatches } from '../light/swatches.js';
import { LIGHTS_VARIANTS, type LightItem, type LightsCardConfig } from './lights-card.js';

/** The lights card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

type When = NonNullable<HaFormSchemaItem['when']>;

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
  'show_color',
  'color_action',
  'color_control',
  'colors',
  'light_colors',
  'light_whites',
  'tint',
  ...EMPTY_KEYS,
]);

/** The lights the card draws, as the editor sees them: the list's, else the area's as the house has it. */
const lightsOf = (config: Readonly<Record<string, unknown>>, hass?: HomeAssistant): string[] => {
  const raw = config['lights'] ?? config['entities'];
  const listed = idsOf(entriesOf<LightItem>(Array.isArray(raw) ? raw : undefined));
  if (listed.length || !hass?.states || typeof config['area'] !== 'string') return listed;
  return areaEntities(hass, config['area'], { domains: ['light'] });
};

/** A light's colour modes as the house reports them; none where it has not described the light. */
const modesOf = (hass: HomeAssistant | undefined, id: string): readonly string[] => {
  const modes: unknown = hass?.states[id]?.attributes['supported_color_modes'];
  return Array.isArray(modes) ? modes.filter((m): m is string => typeof m === 'string') : [];
};

/**
 * Whether the colour round can act (#137): a light of the room takes a colour; one the house has not described does,
 * as a bulb it has not, and so does a card with no lights yet.
 */
const roomColours: When = (config, hass) => {
  const ids = lightsOf(config, hass);
  return (
    !ids.length ||
    ids.some((id) => {
      const modes = modesOf(hass, id);
      return !modes.length || modes.some((mode) => COLOURED.has(mode));
    })
  );
};

/** The round is asked for. */
const colourOn = (config: Readonly<Record<string, unknown>>): boolean =>
  config['show_color'] === true;

/** The round opens the sheet (its control and its quick colours act): asked for, and not the details. */
const sheetOpens: When = (config, hass) =>
  colourOn(config) && config['color_action'] !== 'more-info' && roomColours(config, hass);

export const lists: readonly RowsListSpec[] = [
  {
    key: 'lights',
    title: 'lights.editor_lights',
    domains: ['light'],
    keys: ['entity', 'name', 'icon', 'color'],
    schema: [entityField(['light']), nameIconFields(), accentField('color', { item: 'bulb' })],
  },
  // the sheet's quick colours, the light card's list, edited while the sheet is what the round opens
  swatchList(sheetOpens),
];

export const defaults: EditorDefaults = (config, hass) => ({
  variant: 'row',
  name_lines: '1',
  show_count: true,
  show_level: true,
  show_brightness: false,
  show_color: false,
  color_action: 'sheet',
  color_control: 'ruler',
  colors: defaultSwatches(lightsOf(config, hass).flatMap((id) => modesOf(hass, id))),
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
      // the colour round (#137), where a light of the room takes a colour; while it is on, what it opens — the
      // details only where the card is one light (a group counts as one) — and the sheet's control
      onlyWhen(
        roomColours,
        fieldRow(
          boolField('show_color'),
          onlyWhen(
            (config, hass) => colourOn(config) && lightsOf(config, hass).length === 1,
            choiceField('color_action', [
              ['sheet', 'editor.color_sheet'],
              ['more-info', 'editor.color_details'],
            ]),
          ),
        ),
      ),
      onlyWhen(
        sheetOpens,
        choiceField('color_control', [
          ['ruler', 'option.ruler'],
          ['wheel', 'editor.color_wheel'],
        ]),
      ),
      // the list is edited row by row (the rows editor takes the field out of the form)
      { name: 'colors', selector: { object: {} } },
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
      show_color: 'editor.color_round',
      color_action: 'editor.color_action',
      color_control: 'editor.color_control',
      colors: 'editor.colors',
      tint: 'lights.editor_tint',
    }),
  };
}
