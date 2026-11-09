import {
  cardDefaults,
  fireEvent,
  localize,
  sliderDefaults,
  type HaFormSchemaItem,
  type HomeAssistant,
  type LovelaceCardConfig,
  type LovelaceConfigForm,
  type MessageKey,
} from '@fluvy/core';
import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { normaliseConfig, type AliasSpec } from './config.js';
import {
  editorWord,
  type FormLabeler,
  formLabels,
  NUMBER_DEFAULTS,
  visibleFields,
} from './form.js';

/** One list of the config (`rows`, `tiles`, `entities`): ids or `{ entity, … }` items edited one form each. */
export interface RowsListSpec {
  readonly key: string;
  /** A second key the card reads the same list from (`entities` beside `rows`): read when `key` is empty, dropped once `key` is written. */
  readonly alias?: string;
  readonly title: MessageKey;
  /** The item's fields; the id field (`entity`, or `idKey`) is the first and required. */
  readonly schema: readonly HaFormSchemaItem[];
  /**
   * The fields one item shows, when they depend on the item (a grid source has no state of charge): a part of
   * `schema`, the same array for the same answer so its form is not rebuilt on every render.
   */
  readonly schemaOf?: (item: Readonly<Record<string, unknown>>) => readonly HaFormSchemaItem[];
  /** Domains the add-picker offers; default: those of the schema's entity field. */
  readonly domains?: readonly string[];
  /** The field that identifies an item: `entity` (an entity picker adds items) or a text field such as a chip's `name`. */
  readonly idKey?: string;
  /** Other fields that identify an item as well (a battery read by two sensors has no `power`): an entry that carries one is kept. */
  readonly also?: readonly string[];
  /** The add field when it is neither an entity nor text (a source's kind, from a list): its name is the `idKey`. */
  readonly picker?: HaFormSchemaItem;
  /**
   * Fields of the card's own form its section draws over its items, by name (the appliance's roles: whether the card
   * searches its device for the rest): taken out of the card's form, edited as the card's.
   */
  readonly fields?: readonly string[];
  /** The keys an item may carry, as its interface declares them: what the editors' contract checks the schema against. */
  readonly keys?: readonly string[];
  /** Words for the item's own fields; the card's, then the shared item words, name the rest. */
  readonly computeLabel?: FormLabeler;
  /**
   * What is said under an item's field, told the item and the house (a legend entry's sensor that keeps counting); the
   * card's, then the shared item helpers, say the rest.
   */
  readonly computeHelper?: FormHelper;
  /**
   * A config entry as the editor's item, when the list's grammar is wider than ids and `{ id, … }` objects (a
   * light's quick colours: words, hexes, triplets, named objects); null drops the entry. Without it, a bare id
   * becomes `{ [idKey]: id }` and an object that carries an id is kept as it is.
   */
  readonly read?: (raw: unknown) => Item | null;
  /** An item back as its config entry, the reverse of `read`; null drops the item. Without it, `compact`. */
  readonly write?: (item: Item) => Entry | null;
  /**
   * Whether the list can act on what the card's form holds, as a field's `when` (a compact lock draws no rows): left
   * out of the editor while it cannot, its entries kept in the config.
   */
  readonly when?: HaFormSchemaItem['when'];
  /**
   * The options of an item's selects, asked of the item as a card's are of its config (a legend entry's units, of its
   * own sensor's class): a list that says none offers the card's.
   */
  readonly choices?: EditorChoices;
  /** What its section says under its title, in a line (an appliance's roles: what they are for). */
  readonly helper?: MessageKey;
  /**
   * The entities its entity fields offer while the card names whose they are (an appliance's device's): its items',
   * and its picker where it picks an entity; a switch at the head of its section, on by default, offers the house's.
   */
  readonly own?: OwnEntities;
}

/** The entities a list offers while its card names whose they are, and its switch's word. */
export interface OwnEntities {
  /** The entities, asked of the card's config and the house; none, and the list offers the house's. */
  readonly entities: (
    config: LovelaceCardConfig,
    hass: HomeAssistant | undefined,
  ) => readonly string[];
  readonly label: MessageKey;
}

type Labeler = FormLabeler;

/**
 * What is said under a card's own field, which may depend on what the editor shows (its config with the defaults)
 * and on the house — a helper that reads the sensor picked (a counter's cycle).
 */
export type FormHelper = (
  schema: HaFormSchemaItem,
  localize: (key: string) => string,
  data?: Readonly<Record<string, unknown>>,
  hass?: HomeAssistant,
) => string | undefined;

/** What a card does for each key the config leaves out: the editor shows it, and never writes it unless the user changes it. */
export type EditorDefaults = (
  config: LovelaceCardConfig,
  hass: HomeAssistant | undefined,
) => Readonly<Record<string, unknown>>;

/** A choice of a select: its value and its words. */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

/**
 * The options of a card's selects as the house has them, by field (a thermostat's modes, from its entity): they take
 * the place of the form's own at render, so the form itself stays one static schema; a field left out keeps its own.
 */
export type EditorChoices = (
  config: LovelaceCardConfig,
  hass: HomeAssistant | undefined,
) => Readonly<Record<string, readonly SelectOption[]>>;
type Choices = ReturnType<EditorChoices>;

/** A schema with the options of the selects `choices` names swapped in, through its grids; the rest is untouched. */
export function withChoices(
  schema: readonly HaFormSchemaItem[],
  choices: Readonly<Record<string, readonly SelectOption[]>>,
): HaFormSchemaItem[] {
  return schema.map((item) => {
    if (item.schema) return { ...item, schema: withChoices(item.schema, choices) };
    const select = item.selector?.['select'] as Record<string, unknown> | undefined;
    const options = choices[item.name];
    return select && options
      ? { ...item, selector: { ...item.selector, select: { ...select, options: [...options] } } }
      : item;
  });
}

/**
 * A schema with its entity fields offering only `include` (a device's entities, and what its items name already),
 * through its grids; with none, the schema as it is.
 */
export function withEntities(
  schema: readonly HaFormSchemaItem[],
  include: readonly string[] | undefined,
): readonly HaFormSchemaItem[] {
  if (!include) return schema;
  return schema.map((item) => {
    if (item.schema) return { ...item, schema: withEntities(item.schema, include) };
    const entity = item.selector?.['entity'] as Record<string, unknown> | undefined;
    return entity
      ? {
          ...item,
          selector: { ...item.selector, entity: { ...entity, include_entities: [...include] } },
        }
      : item;
  });
}

/** The names of a schema's entity fields, through its grids. */
const entityFields = (schema: readonly HaFormSchemaItem[]): string[] =>
  schema.flatMap((item) =>
    item.schema
      ? entityFields(item.schema)
      : item.selector?.['entity'] !== undefined
        ? [item.name]
        : [],
  );

export interface RowsEditorSpec {
  /** The card's own fields (title, tone …) — everything but the lists, and the fields their sections draw. */
  readonly schema: readonly HaFormSchemaItem[];
  readonly lists: readonly RowsListSpec[];
  /** The card's fields each list's section draws over its items (`RowsListSpec.fields`), by the list's key. */
  readonly heads?: Readonly<Record<string, readonly HaFormSchemaItem[]>>;
  readonly computeLabel: Labeler;
  readonly computeHelper?: FormHelper;
  readonly defaults?: EditorDefaults;
  readonly choices?: EditorChoices;
  /** The older names the card still reads: shown as the newer ones, and written as them on the first change. */
  readonly aliases?: readonly AliasSpec[];
}

type Item = Record<string, unknown>;
type Entry = string | Item;

/** The card's form as a list's section draws its fields: its data, what can act, its helpers. */
interface CardForm {
  readonly data: Readonly<Record<string, unknown>>;
  readonly asked: Readonly<Record<string, unknown>>;
  readonly helper: Labeler;
}

/** Every field of the card's own: its form's, and those its lists' sections draw. */
const cardFields = (spec: RowsEditorSpec | undefined): readonly HaFormSchemaItem[] =>
  spec ? [...spec.schema, ...Object.values(spec.heads ?? {}).flat()] : [];

/** Editor words for the fields an item may carry; a card adds its own through `computeLabel`. */
export const itemLabels: Labeler = formLabels({
  color: 'editor.color',
  sub: 'editor.sub',
  secondary: 'editor.secondary',
  low: 'editor.low',
  high: 'editor.high',
  plain: 'editor.plain',
  highlight: 'editor.highlight',
  label: 'editor.label',
  path: 'editor.path',
  meta: 'editor.meta',
  readouts: 'editor.readouts',
  presets: 'editor.presets',
}).computeLabel;

/** What a field says under itself where it has a word of its own (`helper`: an item's colour, what it wears while none is chosen). */
const ownHelper = (schema: HaFormSchemaItem): string | undefined =>
  schema.helper ? editorWord(schema.helper) : undefined;

/**
 * What the editor says under an item's field: its own word where it has one; a row's second line takes a keyword or
 * a template (its select), or words of the person's own or a template (a text field).
 */
export const itemHelpers: Labeler = (schema) =>
  ownHelper(schema) ??
  (schema.name === 'secondary'
    ? editorWord(schema.selector?.['select'] ? 'editor.secondary_helper' : 'editor.template_helper')
    : undefined);

/**
 * `ha-form` and `ha-sortable` belong to Home Assistant's editors (its pickers with them); when a card's editor, or the
 * settings panel's Dashboards tab, opens before they are defined, the entities card's editor (which uses both) pulls
 * them in.
 */
export async function ensureEditorElements(): Promise<void> {
  if (customElements.get('ha-form') && customElements.get('ha-sortable')) return;
  try {
    const helpers = (await window.loadCardHelpers?.()) as
      { createCardElement?: (config: LovelaceCardConfig) => HTMLElement } | undefined;
    const card = helpers?.createCardElement?.({ type: 'entities', entities: [] });
    await (
      card?.constructor as { getConfigElement?: () => Promise<unknown> } | undefined
    )?.getConfigElement?.();
  } catch {
    /* the wait below is the only requirement */
  }
  await customElements.whenDefined('ha-form');
}

/* ---------- pure list operations (tested) ---------- */

export const idKeyOf = (list: RowsListSpec): string => list.idKey ?? 'entity';

/** An item whose first field is an entity picker (its box under a label): the handle and the cross line up with the box. */
const pickedFirst = (list: RowsListSpec): boolean =>
  (list.schema[0]?.selector as { entity?: unknown } | undefined)?.entity !== undefined;

/** Whether a field holds an id: a non-empty text, or a list of them (a source's phases). */
const holdsId = (value: unknown): boolean =>
  (typeof value === 'string' && value !== '') ||
  (Array.isArray(value) && value.some((v) => typeof v === 'string' && v !== ''));

/**
 * A config entry as an item: a bare id becomes `{ [idKey]: id }`; anything without an id — its `idKey`, or one of
 * the fields that identify it as well (`also`) — is dropped.
 */
export const toItem = (raw: unknown, idKey: string, also: readonly string[] = []): Item | null => {
  if (typeof raw === 'string') return raw ? { [idKey]: raw } : null;
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Item;
  if (typeof item[idKey] === 'string' || also.some((key) => holdsId(item[key]))) return item;
  return null;
};

/**
 * A number's "Automatic" (`unit`, `decimals`: `NUMBER_DEFAULTS`): what the card does where its config says nothing,
 * so it is dropped as an empty field is, never written.
 */
const automatic = (key: string, value: unknown): boolean =>
  value === 'auto' && key in NUMBER_DEFAULTS;

/** An item back to its config entry: empty fields (and a number's Automatic) dropped, an entity with nothing else goes back to its bare id — the config stays as small as the user wrote it. */
export const compact = (item: Item, idKey: string): Entry => {
  const keys = Object.keys(item).filter(
    (key) =>
      item[key] !== undefined &&
      item[key] !== '' &&
      item[key] !== null &&
      !automatic(key, item[key]),
  );
  return keys.length === 1 && keys[0] === idKey && idKey === 'entity'
    ? (item[idKey] as string)
    : Object.fromEntries(keys.map((key) => [key, item[key]]));
};

/** A config entry as the list's item: the list's own reading, else the id rule. */
export const itemOf = (raw: unknown, list: RowsListSpec): Item | null =>
  list.read ? list.read(raw) : toItem(raw, idKeyOf(list), list.also);

/** An item back as the list's config entry: the list's own writing, else `compact`. */
export const entryOf = (item: Item, list: RowsListSpec): Entry | null =>
  list.write ? list.write(item) : compact(item, idKeyOf(list));

/**
 * The items of a list as the editor shows them: under `key`, else under the alias; and, when the config names
 * neither, `fallback` — what the card does then, shown as rows and written only once the list is touched. A list
 * the config names empty is empty: `colors: []` shows no row.
 */
export const itemsOf = (
  config: LovelaceCardConfig | undefined,
  list: RowsListSpec,
  fallback?: readonly unknown[],
): Item[] => {
  const own = config?.[list.key];
  const raw = Array.isArray(own) && own.length ? own : list.alias ? config?.[list.alias] : own;
  const absent = own === undefined && (!list.alias || config?.[list.alias] === undefined);
  const entries = Array.isArray(raw) ? raw : absent ? (fallback ?? []) : [];
  return entries.map((entry) => itemOf(entry, list)).filter((item): item is Item => item !== null);
};

/** The config with one list replaced: written under the list's own key, the alias (if any) dropped so the card reads one list. */
export const withList = (
  config: LovelaceCardConfig,
  list: RowsListSpec,
  entries: readonly Entry[],
): LovelaceCardConfig => {
  const next: LovelaceCardConfig = { ...config, [list.key]: [...entries] } as LovelaceCardConfig;
  if (list.alias && list.alias !== list.key) delete next[list.alias];
  return next;
};

/** The fields of a schema whose selector is a select, through its rows, each with the values it offers: words. */
const selectsOf = (schema: readonly HaFormSchemaItem[]): Map<string, readonly unknown[]> =>
  new Map(
    schema.flatMap((item): Array<[string, readonly unknown[]]> => {
      if (item.schema) return [...selectsOf(item.schema)];
      const select = item.selector?.['select'] as { options?: readonly unknown[] } | undefined;
      return select
        ? [[item.name, (select.options ?? []).map((o) => (o as { value?: unknown })?.value ?? o)]]
        : [];
    }),
  );

/**
 * A value as a select that offers `offered` words it: a number the YAML holds (`decimals: 2`, `columns: 2`) as "2", a
 * toggle among the select's own choices (a light card's `show_brightness: false`, #124) as "false", and a toggle the
 * select grew out of (1.10's `show_grid: true`) as what it meant — on its Automatic, off its None.
 */
const wordOf = (value: unknown, offered: readonly unknown[] | undefined): unknown => {
  if (offered && typeof value === 'number') return String(value);
  if (typeof value === 'boolean' && offered?.includes(String(value))) return String(value);
  if (offered?.includes('auto') && offered.includes('none') && typeof value === 'boolean')
    return value ? 'auto' : 'none';
  return value;
};

/** A form's values as its selects word them (`wordOf`). */
const worded = (
  entries: Readonly<Record<string, unknown>>,
  selects: ReadonlyMap<string, readonly unknown[]>,
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    Object.entries(entries).map(([key, value]) => [key, wordOf(value, selects.get(key))]),
  );

/**
 * The form's value with a toggle's words (`wordOf`) back as the toggle the config holds, and a select's own "true" and
 * "false" as the toggle they say: nothing is rewritten that the person did not pick.
 */
const unworded = (
  value: Readonly<Record<string, unknown>>,
  held: Readonly<Record<string, unknown>>,
  selects: ReadonlyMap<string, readonly unknown[]>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      const offered = selects.get(key);
      return [
        key,
        typeof held[key] === 'boolean' && entry === wordOf(held[key], offered)
          ? held[key]
          : (entry === 'true' || entry === 'false') && offered?.includes(entry)
            ? entry === 'true'
            : entry,
      ];
    }),
  );

const sameValue = (a: unknown, b: unknown): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * The form's value as config: a default the user left as it was stays out of the config (it was only shown), and a
 * number's Automatic chosen after a value takes the key out, as a cleared field does.
 */
export const withoutUntouchedDefaults = (
  value: Readonly<Record<string, unknown>>,
  config: LovelaceCardConfig,
  defaults: Readonly<Record<string, unknown>>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([key, entry]) =>
        !automatic(key, entry) &&
        (key in config || !(key in defaults) || !sameValue(entry, defaults[key])),
    ),
  );

/** `entries` with the one at `from` moved to `to`. */
export const moved = <T>(entries: readonly T[], from: number, to: number): T[] => {
  const next = [...entries];
  const [entry] = next.splice(from, 1);
  if (entry !== undefined) next.splice(to, 0, entry);
  return next;
};

const DRAG_HANDLE =
  'M7,19V17H9V19H7M11,19V17H13V19H11M15,19V17H17V19H15M7,15V13H9V15H7M11,15V13H13V15H11M15,15V13H17V15H15M7,11V9H9V11H7M11,11V9H13V11H11M15,11V9H17V11H15M7,7V5H9V7H7M11,7V5H13V7H11M15,7V5H17V7H15Z';

/**
 * The visual editor of the cards whose list items carry options (a bar's tone, a tile's name): one
 * `ha-form` for the card's own fields, one per item with a drag handle to reorder and a cross to
 * remove it, and a picker to add the next. Home Assistant's form editor can only hold ids in a list;
 * this one keeps every option editable.
 */
export class FluvyRowsEditor extends LitElement {
  static override properties = {
    hass: { attribute: false },
    config: { state: true },
    spec: { attribute: false },
    ready: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
    }
    .list {
      margin-top: 24px;
    }
    .list__title {
      margin: 0 0 8px;
      font-size: 14px;
      font-weight: 500;
      color: var(--secondary-text-color);
    }
    /* what a list is for, under its title: Home Assistant's helper text */
    .list__helper {
      margin: -4px 0 8px;
      font-size: 12px;
      line-height: 16px;
      color: var(--secondary-text-color);
    }
    /* the card's own fields a list draws over its items */
    .list__fields {
      display: block;
      margin-bottom: 8px;
    }
    /* an item is a panel (the 16 of an inner tile) round its fields: the handle and the remove button on the first
       field's box — a plain field's 56, or an entity picker's box under its label (24) */
    .item {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      padding: 12px 12px 12px 0;
      margin-bottom: 8px;
      border-radius: var(--fluvy-radius-lg);
      background: var(--card-background-color);
      box-shadow: inset 0 0 0 1px var(--divider-color);
    }
    .item ha-form {
      flex: 1 1 auto;
      min-width: 0;
    }
    .item ha-icon-button {
      flex: 0 0 auto;
      margin-top: 4px;
      color: var(--secondary-text-color);
    }
    .handle {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 40px;
      height: 48px;
      margin-top: 4px;
      color: var(--secondary-text-color);
      cursor: grab;
      touch-action: none;
    }
    .handle:active {
      cursor: grabbing;
    }
    .item--entity .handle,
    .item--entity > ha-icon-button {
      margin-top: 28px;
    }
    .add {
      margin-top: 8px;
    }
    .wait {
      height: 44px;
      border-radius: var(--fluvy-radius-control);
      background: var(--divider-color);
      opacity: 0.4;
    }
  `;

  declare hass?: HomeAssistant;
  declare config: LovelaceCardConfig | undefined;
  declare spec: RowsEditorSpec | undefined;
  declare ready: boolean;

  /**
   * The add-picker's schema per list, with the house's options and the entities it offers: kept while they are the
   * same, so its `ha-form` is not handed a new schema on every render.
   */
  private readonly pickers = new WeakMap<
    RowsListSpec,
    { readonly key: string; readonly schema: readonly HaFormSchemaItem[] }
  >();
  /** Each list's switch that offers the house's entities again (`own`): one field, named by the list. */
  private readonly ownSwitches = new WeakMap<RowsListSpec, readonly HaFormSchemaItem[]>();
  /** The lists whose switch offers the house's entities again, over those the card names whose they are. */
  private readonly everywhere = new Set<string>();
  /** The words of each list's item forms, and the helpers under them: built once per list, for the same reason. */
  private readonly labelers = new WeakMap<RowsListSpec, Labeler>();
  /** The card's form as it stands (the fields that can act, the house's options), kept while it is the same, likewise. */
  private chosen:
    { readonly key: string; readonly schema: readonly HaFormSchemaItem[] } | undefined;
  /** The card's fields each list's section draws, those that can act, kept while they are the same, likewise. */
  private readonly drawn = new WeakMap<
    RowsListSpec,
    { readonly key: string; readonly schema: readonly HaFormSchemaItem[] }
  >();
  /** Each list's item forms with the house's options in them, by the form the list says an item shows, then by the options. */
  private readonly itemForms = new WeakMap<
    readonly HaFormSchemaItem[],
    Map<string, readonly HaFormSchemaItem[]>
  >();

  constructor() {
    super();
    this.ready = false;
  }

  /** The config as the card reads it: an older name shows in its newer field, and leaves the config once anything is saved. */
  setConfig(config: LovelaceCardConfig): void {
    this.config = normaliseConfig(config, ...(this.spec?.aliases ?? []));
  }

  override connectedCallback(): void {
    super.connectedCallback();
    void ensureEditorElements().then(() => {
      this.ready = true;
    });
  }

  private t(key: MessageKey): string {
    return localize(this.hass, key);
  }

  /** What the card does when the config names no list: its default under the list's key, shown as rows until the list is touched. */
  private fallback(list: RowsListSpec): readonly unknown[] | undefined {
    const value = this.defaults()[list.key];
    return Array.isArray(value) ? value : undefined;
  }

  private items(list: RowsListSpec): Item[] {
    return itemsOf(this.config, list, this.fallback(list));
  }

  private written(list: RowsListSpec): Entry[] {
    return this.items(list)
      .map((item) => entryOf(item, list))
      .filter((entry): entry is Entry => entry !== null);
  }

  private commit(next: LovelaceCardConfig): void {
    this.config = next;
    fireEvent(this, 'config-changed', { config: next });
  }

  private defaults(): Readonly<Record<string, unknown>> {
    return this.config && this.spec?.defaults ? this.spec.defaults(this.config, this.hass) : {};
  }

  /**
   * The card's form as it stands: the fields that can act on the card (`asked`, the whole config over the defaults,
   * its lists too — a hidden one keeps its value, which `ha-form` hands back with every change), its selects offering
   * what the house has (`choices`) where the card says so.
   */
  private schema(
    spec: RowsEditorSpec,
    asked: Readonly<Record<string, unknown>>,
    choices: Choices,
  ): readonly HaFormSchemaItem[] {
    const shown = visibleFields(spec.schema, asked, this.hass);
    // the fields whole, not their names: two fields of one name take turns (a week's first day and a month's)
    const key = JSON.stringify([choices, shown]);
    if (this.chosen?.key !== key) this.chosen = { key, schema: withChoices(shown, choices) };
    return this.chosen.schema;
  }

  /**
   * The card's fields a list's section draws over its items, those that can act (`asked`): the same array while they
   * are.
   */
  private head(
    list: RowsListSpec,
    asked: Readonly<Record<string, unknown>>,
  ): readonly HaFormSchemaItem[] {
    const shown = visibleFields(this.spec?.heads?.[list.key] ?? [], asked, this.hass);
    const key = JSON.stringify(shown);
    const kept = this.drawn.get(list);
    if (kept?.key === key) return kept.schema;
    this.drawn.set(list, { key, schema: shown });
    return shown;
  }

  /**
   * An item's form: what its list says the item shows, its selects offering what the house has where the card says
   * so (`choices`: a row's `since` from the house's timestamp sensors), or where the list asks the item (a legend
   * entry's units) — the same array for the same answer, whichever item asks.
   */
  private itemSchema(
    list: RowsListSpec,
    item: Item,
    choices: Choices,
    key: string,
    scope: readonly string[] | undefined,
  ): readonly HaFormSchemaItem[] {
    const own = list.schemaOf?.(item) ?? list.schema;
    const asked = list.choices?.(item as LovelaceCardConfig, this.hass);
    const answer = `${asked ? JSON.stringify(asked) : key}${scope ? JSON.stringify(scope) : ''}`;
    const forms = this.itemForms.get(own) ?? new Map<string, readonly HaFormSchemaItem[]>();
    this.itemForms.set(own, forms);
    const kept = forms.get(answer);
    if (kept) return kept;
    const schema = withEntities(withChoices(own, asked ?? choices), scope);
    forms.set(answer, schema);
    return schema;
  }

  /**
   * The entities a list's entity fields offer: those its card names whose they are (`own`, an appliance's device's)
   * with what its items name already, while its switch is on; none, and they offer the house's.
   */
  private scope(
    list: RowsListSpec,
    items: readonly Item[],
    own: readonly string[],
  ): readonly string[] | undefined {
    if (!own.length || this.everywhere.has(list.key)) return undefined;
    const fields = entityFields(list.schema);
    const named = items.flatMap((item) =>
      fields.map((name) => item[name]).filter((id): id is string => typeof id === 'string'),
    );
    return [...new Set([...own, ...named])];
  }

  /**
   * The card's form (and the fields a list's section draws of it) edits everything but the lists: its value is the
   * whole of that part (a cleared field is absent from it).
   */
  private onCard(event: CustomEvent<{ value: Record<string, unknown> }>): void {
    event.stopPropagation();
    const config = this.config;
    if (!config) return;
    const lists = Object.fromEntries(
      (this.spec?.lists ?? [])
        .flatMap((list) => [list.key, list.alias])
        .filter((key): key is string => Boolean(key) && config[key as string] !== undefined)
        .map((key) => [key, config[key]]),
    );
    const own = withoutUntouchedDefaults(
      unworded(event.detail.value, config, selectsOf(cardFields(this.spec))),
      config,
      this.defaults(),
    );
    this.commit({ ...own, ...lists, type: config.type } as LovelaceCardConfig);
  }

  private onItem(list: RowsListSpec, index: number, event: CustomEvent<{ value: Item }>): void {
    event.stopPropagation();
    if (!this.config) return;
    const entries = this.written(list);
    const entry = entryOf(event.detail.value, list);
    // an item that says nothing any more (its id cleared) leaves the list
    if (entry === null) entries.splice(index, 1);
    else entries[index] = entry;
    this.commit(withList(this.config, list, entries));
  }

  private onAdd(list: RowsListSpec, event: CustomEvent<{ value: Item }>): void {
    event.stopPropagation();
    const idKey = idKeyOf(list);
    const id = event.detail.value[idKey];
    if (!this.config || typeof id !== 'string' || !id) return;
    const entry = entryOf({ [idKey]: id }, list);
    if (entry === null) return;
    this.commit(withList(this.config, list, [...this.written(list), entry]));
    this.requestUpdate(); // the picker goes back to empty
  }

  private onMove(
    list: RowsListSpec,
    event: CustomEvent<{ oldIndex: number; newIndex: number }>,
  ): void {
    event.stopPropagation();
    if (!this.config) return;
    this.commit(
      withList(
        this.config,
        list,
        moved(this.written(list), event.detail.oldIndex, event.detail.newIndex),
      ),
    );
  }

  private removeItem(list: RowsListSpec, index: number): void {
    if (!this.config) return;
    this.commit(
      withList(
        this.config,
        list,
        this.written(list).filter((_, i) => i !== index),
      ),
    );
  }

  /** The add-picker: the list's own, else an entity's or a text's, with the house's options and the entities offered. */
  private picker(
    list: RowsListSpec,
    choices: Choices,
    key: string,
    scope: readonly string[] | undefined,
  ): readonly HaFormSchemaItem[] {
    const answer = `${key}${scope ? JSON.stringify(scope) : ''}`;
    const kept = this.pickers.get(list);
    if (kept?.key === answer) return kept.schema;
    const idKey = idKeyOf(list);
    const domains =
      list.domains ??
      (list.schema[0]?.selector as { entity?: { domain?: string[] } } | undefined)?.entity?.domain;
    const field: HaFormSchemaItem =
      list.picker ??
      (idKey === 'entity'
        ? { name: 'entity', selector: { entity: domains ? { domain: [...domains] } : {} } }
        : { name: idKey, selector: { text: {} } });
    const schema = withEntities(withChoices([field], choices), scope);
    this.pickers.set(list, { key: answer, schema });
    return schema;
  }

  private ownSwitch(list: RowsListSpec): readonly HaFormSchemaItem[] {
    let schema = this.ownSwitches.get(list);
    if (!schema) {
      schema = [{ name: list.key, selector: { boolean: {} } }];
      this.ownSwitches.set(list, schema);
    }
    return schema;
  }

  /** A list's switch says its own word. */
  private readonly ownLabel: Labeler = (schema) => {
    const own = this.spec?.lists.find((list) => list.key === schema.name)?.own;
    return own ? this.t(own.label) : undefined;
  };

  /** The switch turned: the list's entity fields offer its own entities, or the house's. */
  private onOwn(list: RowsListSpec, event: CustomEvent<{ value: Item }>): void {
    event.stopPropagation();
    if (event.detail.value[list.key] === false) this.everywhere.add(list.key);
    else this.everywhere.delete(list.key);
    this.requestUpdate();
  }

  private readonly addLabel: Labeler = () => this.t('editor.add');

  /** An item's field is named by its list, else by the card, else by the shared item words. */
  private labeler(list: RowsListSpec): Labeler {
    let labeler = this.labelers.get(list);
    if (!labeler) {
      const own = this.spec?.computeLabel;
      labeler = (schema, localize) =>
        list.computeLabel?.(schema, localize) ??
        own?.(schema, localize) ??
        itemLabels(schema, localize);
      this.labelers.set(list, labeler);
    }
    return labeler;
  }

  /**
   * What is said under an item's field: by its list (told the item and the house), else by the card, else by the
   * shared item helpers.
   */
  private helper(list: RowsListSpec, item: Item): Labeler {
    const own = this.spec?.computeHelper;
    return (schema, localize) =>
      list.computeHelper?.(schema, localize, item, this.hass) ??
      own?.(schema, localize) ??
      itemHelpers(schema, localize);
  }

  /**
   * A list's section: its title, the card's fields it draws (`card`: its form's data, what can act, its helpers), its
   * items, its picker.
   */
  private renderList(
    list: RowsListSpec,
    choices: Choices,
    key: string,
    card: CardForm,
  ): TemplateResult {
    const items = this.items(list);
    const head = this.head(list, card.asked);
    const own = list.own && this.config ? list.own.entities(this.config, this.hass) : [];
    const scope = this.scope(list, items, own);
    return html`<div class="list">
      <p class="list__title">${this.t(list.title)}</p>
      ${list.helper ? html`<p class="list__helper">${this.t(list.helper)}</p>` : nothing}
      ${
        head.length
          ? html`<ha-form
              class="list__fields"
              .hass=${this.hass}
              .data=${card.data}
              .schema=${head}
              .computeLabel=${this.spec?.computeLabel}
              .computeHelper=${card.helper}
              @value-changed=${this.onCard}
            ></ha-form>`
          : nothing
      }
      ${
        own.length
          ? html`<ha-form
              class="list__fields"
              .hass=${this.hass}
              .data=${{ [list.key]: !this.everywhere.has(list.key) }}
              .schema=${this.ownSwitch(list)}
              .computeLabel=${this.ownLabel}
              @value-changed=${(event: CustomEvent<{ value: Item }>) => this.onOwn(list, event)}
            ></ha-form>`
          : nothing
      }
      <ha-sortable
        handle-selector=".handle"
        @item-moved=${(event: CustomEvent<{ oldIndex: number; newIndex: number }>) => this.onMove(list, event)}
      >
        <div class="items">
          ${items.map((item, index) => {
            const schema = this.itemSchema(list, item, choices, key, scope);
            // an item's selects read a number its YAML holds as their word, as the card's form does (`decimals: 2`)
            return html`<div class="item ${pickedFirst(list) ? 'item--entity' : ''}">
              <div class="handle" aria-hidden="true">
                <ha-svg-icon .path=${DRAG_HANDLE}></ha-svg-icon>
              </div>
              <ha-form
                .hass=${this.hass}
                .data=${worded(item, selectsOf(schema))}
                .schema=${schema}
                .computeLabel=${this.labeler(list)}
                .computeHelper=${this.helper(list, item)}
                @value-changed=${(event: CustomEvent<{ value: Item }>) => this.onItem(list, index, event)}
              ></ha-form>
              <ha-icon-button
                .label=${this.t('editor.remove')}
                @click=${() => this.removeItem(list, index)}
                ><ha-icon icon="mdi:close"></ha-icon
              ></ha-icon-button>
            </div>`;
          })}
        </div>
      </ha-sortable>
      <div class="add">
        <ha-form
          .hass=${this.hass}
          .data=${{}}
          .schema=${this.picker(list, choices, key, scope)}
          .computeLabel=${this.addLabel}
          @value-changed=${(event: CustomEvent<{ value: Item }>) => this.onAdd(list, event)}
        ></ha-form>
      </div>
    </div>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    const spec = this.spec;
    if (!spec || !this.config) return nothing;
    if (!this.ready) return html`<div class="wait"></div>`;
    // the card's form holds everything but the lists: neither the config's nor a default under a list's key
    const withoutLists = (
      entries: Readonly<Record<string, unknown>>,
    ): Readonly<Record<string, unknown>> =>
      Object.fromEntries(
        Object.entries(entries).filter(
          ([key]) => !spec.lists.some((list) => list.key === key || list.alias === key),
        ),
      );
    const defaults = this.defaults();
    const data = worded(
      { ...withoutLists(defaults), ...withoutLists(this.config) },
      selectsOf(cardFields(spec)),
    );
    // what can act is asked of the whole card, its lists too (a camera of the list asked live)
    const asked = { ...defaults, ...this.config };
    // the house's options for the selects, asked once for the card's form and for its lists' items
    const choices = spec.choices?.(this.config, this.hass) ?? {};
    const key = JSON.stringify(choices);
    // the card's helpers are told what the form shows and the house (one that reads the sensor picked); a field with
    // a word of its own says it where the card says nothing
    const own = spec.computeHelper;
    const helper = (
      schema: HaFormSchemaItem,
      localize: (key: string) => string,
    ): string | undefined => own?.(schema, localize, data, this.hass) ?? ownHelper(schema);
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this.schema(spec, asked, choices)}
        .computeLabel=${spec.computeLabel}
        .computeHelper=${helper}
        @value-changed=${this.onCard}
      ></ha-form>
      ${spec.lists
        .filter((list) => list.when?.(asked, this.hass) ?? true)
        .map((list) => this.renderList(list, choices, key, { data, asked, helper }))}
    `;
  }
}

/** `static getConfigElement()` of a card: the rows editor set up for that card. */
export function rowsEditor(spec: RowsEditorSpec): HTMLElement {
  const element = document.createElement('fluvy-rows-editor') as FluvyRowsEditor;
  element.spec = spec;
  return element;
}

/** The fields of a schema with these names, through its rows. */
const fieldsNamed = (
  schema: readonly HaFormSchemaItem[],
  names: ReadonlySet<string>,
): HaFormSchemaItem[] =>
  schema.flatMap((item) =>
    item.schema ? fieldsNamed(item.schema, names) : names.has(item.name) ? [item] : [],
  );

/** The list fields, and those their sections draw, taken out of a card's form: the editor draws those itself. */
function withoutLists(
  schema: readonly HaFormSchemaItem[],
  keys: ReadonlySet<string>,
): HaFormSchemaItem[] {
  return schema.flatMap((item) => {
    if (keys.has(item.name)) return [];
    if (item.schema) {
      const inner = withoutLists(item.schema, keys);
      return inner.length ? [{ ...item, schema: inner }] : [];
    }
    return [item];
  });
}

/**
 * What an editor shows where a card's config says nothing: the card's own defaults, and what every card that offers
 * them does — on a card with a head (`show_icon`), the circle that shows by itself (`auto`); on a card of a list
 * (`hide_empty`), a list that stays in sight while it is empty; on a card with a surface (`card_opacity`), the house's
 * opacity for every card; on a card of entities (`unavailable`), how the house draws every card out of reach; on a card
 * with a slider (`slider_style`), the house's style and the words under it.
 */
export function editorDefaults(
  form: LovelaceConfigForm,
  defaults?: EditorDefaults,
): EditorDefaults | undefined {
  const shows = (name: string, schema: readonly HaFormSchemaItem[] = form.schema): boolean =>
    schema.some((item) => item.name === name || shows(name, item.schema ?? []));
  const shared = {
    ...(shows('show_icon') ? { show_icon: 'auto' } : {}),
    ...(shows('hide_empty') ? { hide_empty: false } : {}),
  };
  // the house's opacity, its look out of reach and its sliders' words as they are when the editor asks (the panel may
  // change them meanwhile)
  const surface = shows('card_opacity');
  const away = shows('unavailable');
  const sliders = shows('slider_style');
  return Object.keys(shared).length || surface || away || sliders
    ? (config, hass) => ({
        ...shared,
        ...(surface ? { card_opacity: cardDefaults().opacity } : {}),
        ...(away ? { unavailable: cardDefaults().unavailable } : {}),
        ...(sliders ? { slider_style: 'house', slider_words: sliderDefaults().words } : {}),
        ...defaults?.(config, hass),
      })
    : defaults;
}

/**
 * `static getConfigElement()` for a card that already has a form: the same fields and labels, plus its lists edited
 * item by item, its defaults shown, its older names read as the newer ones, and its selects offering what the house
 * has (`choices`).
 */
export function listsEditor(
  form: LovelaceConfigForm,
  lists: readonly RowsListSpec[],
  own?: EditorDefaults,
  aliases?: readonly AliasSpec[],
  choices?: EditorChoices,
): HTMLElement {
  const keys = new Set(lists.flatMap((list) => [list.key, ...(list.alias ? [list.alias] : [])]));
  const drawn = lists.filter((list) => list.fields?.length);
  const defaults = editorDefaults(form, own);
  return rowsEditor({
    schema: withoutLists(
      form.schema,
      new Set([...keys, ...drawn.flatMap((list) => list.fields ?? [])]),
    ),
    lists,
    ...(drawn.length
      ? {
          heads: Object.fromEntries(
            drawn.map((list) => [list.key, fieldsNamed(form.schema, new Set(list.fields))]),
          ),
        }
      : {}),
    computeLabel: (schema, localize) => form.computeLabel?.(schema, localize),
    ...(form.computeHelper ? { computeHelper: form.computeHelper } : {}),
    ...(defaults ? { defaults } : {}),
    ...(aliases?.length ? { aliases } : {}),
    ...(choices ? { choices } : {}),
  });
}

/** `static getConfigElement()` for a card without lists: its form, with what the card does by default shown in it. */
export function formEditor(form: LovelaceConfigForm, defaults: EditorDefaults): HTMLElement {
  return listsEditor(form, [], defaults);
}

// defined here, with the module a card's `getConfigElement` fetches: the element exists exactly when an editor is asked for
if (!customElements.get('fluvy-rows-editor'))
  customElements.define('fluvy-rows-editor', FluvyRowsEditor);
