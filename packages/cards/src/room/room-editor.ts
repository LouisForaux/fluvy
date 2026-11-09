import {
  addEnglish,
  areaContents,
  areaEntities,
  deviceNameOf,
  lightDefaults,
  resolveEntity,
  type ClimateKind,
  type HaFormSchemaItem,
  type HomeAssistant,
  type LovelaceConfigForm,
} from '@fluvy/core';
import { configKeys } from '../shared/config.js';
import {
  accentField,
  actionField,
  actionFields,
  areaField,
  boolField,
  choiceField,
  colourFields,
  editorWord,
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
  sinceChoices,
  textField,
  tintField,
  toneField,
} from '../shared/form.js';
import type { BaseKey } from '../shared/base.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from '../shared/rows-editor.js';
import { lists as tilesLists } from '../tiles/tiles-editor.js';
import type { RoomCardConfig } from './room-card.js';
import { defaultGroups, QUICK_GROUPS, quickEntry } from './quick-actions.js';
import words from '@fluvy/core/locales/en/room-editor.json';

// the editor's own English, in its chunk: its words are said once it is drawn, never by a dashboard
addEnglish(words);

/** The room card's editor: fetched by its `editor()` the first time the card is edited, never by a dashboard. */

/** Whether the room draws what its editor offers under its head or hero (its form's data): a row draws none of it. */
const drawsControls = ({ variant }: Readonly<Record<string, unknown>>): boolean =>
  variant !== 'row';

/** …its tiles (`controls: tiles`), and their colour at rest with them. */
const drawsTiles = (form: Readonly<Record<string, unknown>>): boolean =>
  drawsControls(form) && form['controls'] === 'tiles';

/** …its lights, in a row of their own or among its tiles. */
const drawsLights = (form: Readonly<Record<string, unknown>>): boolean =>
  drawsControls(form) && form['controls'] !== 'none';

/** …its quick actions. */
/** The arrows stand on a tile's head and on the category rows: a card of neither has none to hide. */
const drawsArrows = ({ variant, controls }: Readonly<Record<string, unknown>>): boolean =>
  variant === 'tile' || (variant !== 'row' && (controls ?? 'rows') === 'rows');
const drawsQuick = ({ show_quick_actions: shown }: Readonly<Record<string, unknown>>): boolean =>
  shown !== false;

/** A reading's field: a sensor of its class, or the thermostat (the humidifier) that carries it (`climateAttribute`). */
const readingField = (kind: ClimateKind, ...domain: string[]): HaFormSchemaItem => ({
  name: `${kind}_entity`,
  selector: { entity: { filter: [{ domain: 'sensor', device_class: kind }, { domain }] } },
});

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
];

export const keys = configKeys<RoomCardConfig>()([
  'area',
  'variant',
  'picture',
  'show_climate',
  'show_count',
  'show_quick_actions',
  'show_arrow',
  'controls',
  'tiles',
  'quick_actions',
  'path',
  'temperature_entity',
  'humidity_entity',
  'include',
  'exclude',
  'tint',
  'name_lines',
  'light_colors',
  'light_whites',
]);

/** What a quick action stands for: one of the room's sets, by its word, or an entity. */
const groupField = choiceField('group', [
  ...QUICK_GROUPS.map((group) => [group, `room.${group}`] as const),
  ['entity', 'editor.entity'],
]);
/** A set's round: its own name, icon, colour and actions; an entity's, the entity first. */
const GROUP_ITEM: readonly HaFormSchemaItem[] = [
  groupField,
  fieldRow(textField('name'), iconField()),
  fieldRow(toneField(), accentField('color', { item: 'bulb' })),
  actionFields(),
];
const ENTITY_ITEM: readonly HaFormSchemaItem[] = [
  groupField,
  entityField(undefined, 'entity', false),
  nameIconFields(),
  ...GROUP_ITEM.slice(2),
];

/** A room's tiles are a group's but for their look out of reach, which is the room's: they sit inside it. */
const ownLook = (key: string): boolean => key !== 'unavailable';

export const lists: readonly RowsListSpec[] = [
  {
    key: 'tiles',
    title: 'editor.tiles',
    keys: (tilesLists[0]?.keys ?? []).filter(ownLook),
    schema: (tilesLists[0]?.schema ?? []).filter((field) => ownLook(field.name)),
    when: drawsTiles,
  },
  {
    key: 'quick_actions',
    idKey: 'group',
    also: ['entity'],
    title: 'room-editor.quick_actions',
    keys: ['group', 'entity', 'name', 'icon', 'tone', 'color', 'tap_action', 'hold_action'],
    picker: groupField,
    computeLabel: (schema) =>
      schema.name === 'group' ? editorWord('room-editor.group') : undefined,
    read: (raw) => quickEntry(raw) as Record<string, unknown> | null,
    // a set alone is its word, an entity alone its id; an entity's kind is never written beside it
    write: ({ group, entity, ...own }) => {
      const kept = Object.fromEntries(
        Object.entries(own).filter(([, value]) => value !== undefined && value !== ''),
      );
      const bare = !Object.keys(kept).length;
      if (group !== 'entity') return bare ? String(group) : { group, ...kept };
      if (typeof entity !== 'string' || !entity) return { group };
      return bare ? entity : { entity, ...kept };
    },
    schema: ENTITY_ITEM,
    schemaOf: (item) => (item['group'] === 'entity' ? ENTITY_ITEM : GROUP_ITEM),
    when: drawsQuick,
  },
];

/**
 * What a room's `include` and `exclude` offer (#95), each with its words: its entities, its devices and its domains,
 * any other entry typed (an entity elsewhere, a pattern of ids).
 */
function roomEntries(config: Readonly<Record<string, unknown>>, hass?: HomeAssistant) {
  const area = String(config['area'] ?? '');
  if (!hass?.states || !area) return [];
  const ids = areaEntities(hass, area);
  const devices = [...new Set(ids.map((id) => hass.entities?.[id]?.device_id ?? ''))].filter(
    (device) => hass.devices?.[device],
  );
  return [
    ...ids.map((id) => ({ value: id, label: `${resolveEntity(hass, id).name} (${id})` })),
    ...devices.map((device) => ({
      value: device,
      label: deviceNameOf(hass.devices?.[device]) ?? device,
    })),
    ...[...new Set(ids.map((id) => id.slice(0, id.indexOf('.'))))].map((domain) => ({
      value: domain,
      label: domain,
    })),
  ];
}

/** A tile's `since` offers the house's timestamp sensors, as the tiles card's do; `include`, `exclude` the room's own. */
export const choices: EditorChoices = (config, hass) => {
  const entries = roomEntries(config, hass);
  return { ...sinceChoices(config, hass), include: entries, exclude: entries };
};

/** A room's `include` or `exclude`: its entities, devices and domains to choose, or a pattern typed (#95). */
const entriesField = (name: 'include' | 'exclude'): HaFormSchemaItem => ({
  name,
  selector: { select: { multiple: true, custom_value: true, mode: 'dropdown', options: [] } },
  helper: 'room-editor.entries_help',
});

/**
 * What the editor shows where the config says nothing: what the card does then — its variant, the readings it found
 * and its quick actions (its lights, then its blinds, where it has them), in the room as its `include` and `exclude`
 * say.
 */
export const defaults: EditorDefaults = (config, hass) => {
  const area = hass?.areas?.[String(config['area'] ?? '')];
  const found =
    hass && area ? areaContents(hass, area.area_id, config as RoomCardConfig) : undefined;
  return {
    variant: config['picture'] || area?.picture ? 'photo' : 'tile',
    controls: 'rows',
    name_lines: '1',
    show_count: true,
    show_climate: true,
    show_quick_actions: true,
    show_arrow: true,
    quick_actions: defaultGroups(hass, found?.devices ?? []),
    tint: 'on',
    light_colors: lightDefaults().colors,
    light_whites: 'temperature',
    temperature_entity: found?.climate.temperature,
    humidity_entity: found?.climate.humidity,
  };
};

export function getConfigForm(): LovelaceConfigForm {
  return {
    schema: [
      areaField(),
      fieldRow(textField('name'), iconField()),
      showIconField(),
      fieldRow(
        selectField('variant', ['photo', 'tile', 'row']),
        onlyWhen(drawsControls, selectField('controls', ['rows', 'tiles', 'none'])),
      ),
      fieldRow(boolField('show_climate'), boolField('show_count')),
      fieldRow(boolField('show_quick_actions'), onlyWhen(drawsArrows, boolField('show_arrow'))),
      // the list is edited item by item (the rows editor takes the field out of the form)
      { name: 'quick_actions', selector: { object: {} } },
      // a picture is the photo's alone (the default where the room has one)
      fieldRow(
        onlyWhen(({ variant }) => variant === 'photo', textField('picture')),
        textField('path'),
      ),
      fieldRow(
        readingField('temperature', 'climate'),
        readingField('humidity', 'climate', 'humidifier'),
      ),
      entriesField('include'),
      entriesField('exclude'),
      ...colourFields(),
      // its tiles' colour at rest; their names' lines, and the row's (a compact tile)
      fieldRow(
        onlyWhen(drawsTiles, tintField()),
        onlyWhen((form) => drawsTiles(form) || form['variant'] === 'row', nameLinesField()),
      ),
      onlyWhen(drawsLights, lightColourFields()),
      fieldRow(actionField('tap_action'), actionField('hold_action')),
    ],
    ...formLabels({
      temperature_entity: 'editor.temperature_entity',
      humidity_entity: 'editor.humidity_entity',
      show_quick_actions: 'room-editor.show_quick_actions',
      show_arrow: 'room-editor.show_arrow',
      quick_actions: 'room-editor.quick_actions',
      include: 'room-editor.include',
      exclude: 'room-editor.exclude',
    }),
  };
}
