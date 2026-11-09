import {
  actionRuns,
  failedToLoad,
  FluvyCard,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceCardConfig,
  type LovelaceConfigForm,
} from '@fluvy/core';
import { baseStyles, fitPills, pressCover } from '@fluvy/ui';
import { nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';
import type { ShowIcon } from '../energy/head.js';
import { loadChartEngine } from './chart-load.js';
import { COMMON_ALIASES, normaliseConfig, type AliasSpec, type KnownKeys } from './config.js';
import { FontsSettled } from './fonts.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from './rows-editor.js';

/** What a card with a head honours of its circle (`HeadFit` reads it through `Card.showIcon`). */
export interface HeadConfig {
  show_icon?: ShowIcon;
}

/** The base card's fields every editor may show; a card names the ones it honours. */
export type BaseKey = KnownKeys<FluvyCardConfig & HeadConfig>;

/** What a card of one entity honours of the base: the entity, its name and icon, both actions, its tone and colour. */
export const ENTITY_BASE: readonly BaseKey[] = [
  'entity',
  'name',
  'icon',
  'tap_action',
  'hold_action',
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'unavailable',
];

/** The same for a card of one entity with a head: whether its circle shows too. */
export const HEAD_BASE: readonly BaseKey[] = [...ENTITY_BASE, 'show_icon'];

/** What a card with a slider honours of the base besides (1.18, #144): the style its sliders are drawn in, and the words under a bar or a liquid. */
export const SLIDER_BASE: readonly BaseKey[] = ['slider_style', 'slider_words'];

/** A head's actions (`head()`'s `onTap`, `onHold` and `label`): the card's tap and hold, each where it can run. */
export interface HeadActions {
  readonly onTap?: () => void;
  readonly onHold?: () => void;
  readonly label?: string;
}

/**
 * What a control drawn by a module of its own needs from the card that draws it: the state to draw (the expected one
 * while a change is in flight), and the card's optimistic state and calls, protected on the card itself.
 */
export interface ControlHost {
  state(view: EntityView): string;
  expect(entityId: string, state: string): void;
  call(domain: string, service: string, data: Record<string, unknown>, entityId: string): void;
}

/** What a card's editor shows: the contract's parts (see `Card`), all but the older names, which the card reads itself. */
export interface CardEditor {
  readonly base: readonly BaseKey[];
  readonly keys: readonly string[];
  readonly lists?: readonly RowsListSpec[];
  readonly defaults?: EditorDefaults | undefined;
  readonly choices?: EditorChoices | undefined;
  /** The fields of the card's visual editor; every card has one. */
  getConfigForm(): LovelaceConfigForm;
}

/**
 * What every card in this package shares on top of the core base class: the fluvy stylesheets, the pill-fitting pass
 * (badges and chips sized from their laid-out text, on the 4 px grid), and the editors' contract.
 *
 * The contract: a card declares what its editor shows — `base` (the base fields it honours), `keys` (its own, checked
 * against its config's interface by `configKeys`), `lists` (the lists edited item by item), `defaults` (what it does
 * for a key left out), `choices` (a select's options as its entity has them) and `aliases` (the older names it still
 * reads) — and the base builds the editor from its `getConfigForm()`. `editors.test.ts` holds every card to it: what
 * the form and the lists show is exactly `base ∪ keys`, and no older name is ever shown. A card's aliases are read on
 * `setConfig` — its own first, then the names every card shares (`COMMON_ALIASES`) — so the card itself only ever
 * sees the newer names. A card every page carries keeps the rest in a module of its own (`<name>-editor.ts`, which
 * its `editor()` fetches with the visual editor), so a dashboard never loads its editor; a card of a family fetched
 * on demand declares it on its class.
 */
export abstract class Card<C extends FluvyCardConfig = FluvyCardConfig> extends FluvyCard<C> {
  static override styles: CSSResultGroup = [...baseStyles];

  static base: readonly BaseKey[] = ENTITY_BASE;
  static keys: readonly string[] = [];
  static lists: readonly RowsListSpec[] = [];
  static defaults: EditorDefaults | undefined = undefined;
  static choices: EditorChoices | undefined = undefined;
  static aliases: AliasSpec | undefined = undefined;

  /** The fields of the card's visual editor; every card has one. */
  static getConfigForm(): LovelaceConfigForm {
    return { schema: [] };
  }

  /** The card's editor: its class, or the module of a card every page carries (fetched the first time it is edited). */
  static editor(): Promise<CardEditor> {
    return Promise.resolve(this);
  }

  /**
   * The visual editor: the card's form, its lists item by item, its defaults shown, its older names read. The
   * editor is fetched the first time a card is edited (Home Assistant awaits this, and says what failed in the
   * editor's place): a dashboard never loads it. A page left open through an update cannot fetch it any more, and
   * asks the server which build it serves.
   */
  static async getConfigElement(): Promise<HTMLElement> {
    // a chart card's Chart section is the chart engine's: it lands with the bundle, so this waits on nothing in practice
    const [{ listsEditor }, editor] = await Promise.all([
      import('./rows-editor.js'),
      this.editor(),
      loadChartEngine(),
    ]).catch((error: unknown) => {
      failedToLoad(error);
      throw error;
    });
    return listsEditor(
      editor.getConfigForm(),
      editor.lists ?? [],
      editor.defaults,
      [...(this.aliases ? [this.aliases] : []), COMMON_ALIASES],
      editor.choices,
    );
  }

  override setConfig(config: LovelaceCardConfig): void {
    const { aliases } = this.constructor as typeof Card;
    super.setConfig(
      aliases
        ? normaliseConfig(config, aliases, COMMON_ALIASES)
        : normaliseConfig(config, COMMON_ALIASES),
    );
  }

  /** The card as a control of a module of its own sees it (a select's dropdown, a helper's control). */
  protected readonly controlHost: ControlHost = {
    state: (view) => this.stateOf(view),
    expect: (id, state) => this.expect(id, state),
    call: (domain, service, data, id) => this.call(domain, service, data, id),
  };

  constructor() {
    super();
    // A pill fitted before the web font lands is fitted again once it has: a frame after the font set says so
    // (the face is usable for layout only then), and once more at 1.2 s as a safety net. Fitting in the
    // `loadingdone` handler itself measured the fallback face still, which left a tab row 8 px too wide
    // until the safety net ran.
    new FontsSettled(this, () => {
      if (this.isConnected) fitPills(this.renderRoot, true);
    });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    fitPills(this.renderRoot);
  }

  /** Whether the head's circle shows (`show_icon`); a value it does not know is `auto`, as none is. */
  get showIcon(): ShowIcon {
    return (this.config as HeadConfig | undefined)?.show_icon ?? 'auto';
  }

  /**
   * The head's tap and hold (the head is the card's button) from the card's `tap_action` and `hold_action`, run for
   * `entityId` — the card's entity by default. One that cannot run is left out (`none`; more-info or a toggle with no
   * entity to act on, as a card of many has none), so a head is never a button that does nothing. `label`: what a
   * reader hears for the head's button where its title says less.
   */
  protected headActions(
    entityId: string | undefined = this.config?.entity,
    label?: string,
  ): HeadActions {
    const config = this.config;
    return {
      ...(actionRuns(config?.tap_action, entityId) ? { onTap: () => this.tap(entityId) } : {}),
      ...(actionRuns(config?.hold_action, entityId) ? { onHold: () => this.hold(entityId) } : {}),
      ...(label ? { label } : {}),
    };
  }

  /**
   * A readout alone where its control would be (none asked for, or a column too narrow for even its halves) is the
   * card's tap and hold: a button laid over its row (`pressCover`), named by what it says. None where neither runs.
   */
  protected readoutTap(
    entityId: string | undefined,
    label: string,
  ): TemplateResult | typeof nothing {
    const { onTap, onHold } = this.headActions(entityId);
    return onTap || onHold ? pressCover(label.trim(), onTap, onHold) : nothing;
  }
}
