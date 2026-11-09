import {
  haptic,
  isUsable,
  relativeTime,
  stateText,
  strings,
  textAttr,
  type ActionConfig,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { head, icon, stepper, type IconRef, type RulerChangeDetail, type Tone } from '@fluvy/ui';
import { css, html, nothing, svg, type CSSResultGroup, type TemplateResult } from 'lit';

import { Hold } from '../cover/common.js';
import { HeadFit } from '../energy/head.js';
import {
  actionRows,
  appsLayout,
  DEFAULT_CONTROLS,
  DEFAULT_KEYS,
  remoteGroups,
  remoteHeight,
  ringFit,
  type RemoteGroup,
} from '../remote-family.js';
import { Card, type CardEditor } from '../shared/base.js';
import { chipRow } from '../shared/chips.js';
import { iconOf } from '../shared/domain.js';
import { drawnAs } from '../shared/heights.js';
import { changedAt } from '../shared/since.js';
import { buttonService, commandFor, isKey, KEY_GLYPHS, type Key } from './keys.js';
import { appPlatform, appTitle, platformOf, shortTitle, type Platform } from './platforms.js';

const s = strings('remote');

export type RemoteVariant = 'full' | 'compact' | 'pad' | 'row';
export const VARIANTS: readonly RemoteVariant[] = ['full', 'compact', 'pad', 'row'];
export type Dpad = 'ring' | 'grid';
export const DPADS: readonly Dpad[] = ['ring', 'grid'];
export type OkLabel = 'word' | 'plain';
export const OK_LABELS: readonly OkLabel[] = ['word', 'plain'];
export type SideKeys = 'auto' | 'sides' | 'row';
export const SIDE_KEYS: readonly SideKeys[] = ['auto', 'sides', 'row'];
export type OffKeys = 'live' | 'power';
export const OFF_KEYS: readonly OffKeys[] = ['live', 'power'];
export type VolumeStyle = 'auto' | 'ruler' | 'keys' | 'stepper';
export const VOLUMES: readonly VolumeStyle[] = ['auto', 'ruler', 'keys', 'stepper'];
export type AppsStyle = 'circles' | 'chips';
export const APPS_STYLES: readonly AppsStyle[] = ['circles', 'chips'];
export type AppsTint = 'open' | 'always';
export const APPS_TINTS: readonly AppsTint[] = ['open', 'always'];

/** An app of the row: a platform (its logo, colour and name), a source of the player, a key, or an action of its own. */
export interface RemoteApp {
  app?: string;
  name?: string;
  icon?: string;
  /** A picture of the person's own in place of the logo: `/local/…`, a web address or a data image. */
  image?: string;
  color?: string;
  source?: string;
  key?: string;
  tap_action?: ActionConfig;
}

/** A key of the person's own: a key of the table, or any action. */
export interface RemoteCustom {
  name: string;
  icon?: string;
  key?: string;
  tap_action?: ActionConfig;
}

export interface RemoteCardConfig extends FluvyCardConfig {
  /** The remote that takes the keys (`remote.send_command`); left out, the player takes what it can. */
  remote?: string;
  /** Where the volume goes: a receiver or a soundbar, drawn in its on, off and unavailable states. */
  volume_entity?: string;
  variant?: RemoteVariant;
  dpad?: Dpad;
  ok_label?: OkLabel;
  side_keys?: SideKeys;
  off_keys?: OffKeys;
  volume?: VolumeStyle;
  apps_style?: AppsStyle;
  apps_tint?: AppsTint;
  /** The groups drawn, in this order. */
  groups?: readonly RemoteGroup[];
  /** The four keys round the pad. */
  nav?: readonly string[];
  /** The playback rounds. */
  transport?: readonly string[];
  /** The compact row's keys. */
  keys?: readonly string[];
  /** The row's rounds. */
  controls?: readonly string[];
  apps?: readonly RemoteApp[];
  custom?: readonly RemoteCustom[];
  /** A key's command for this device, over the table's: a command word, or an action. */
  commands?: Readonly<Record<string, string | ActionConfig>>;
}

/* media_player supported_features */
const MEDIA = {
  PAUSE: 1,
  VOLUME_SET: 4,
  VOLUME_MUTE: 8,
  PREVIOUS: 16,
  NEXT: 32,
  TURN_ON: 128,
  TURN_OFF: 256,
  VOLUME_STEP: 1024,
  SELECT_SOURCE: 2048,
  STOP: 4096,
  PLAY: 16384,
} as const;

/** What a television usually does, for one this page has never read: its card then keeps the anatomy it declares. */
const USUAL =
  MEDIA.PAUSE |
  MEDIA.PLAY |
  MEDIA.STOP |
  MEDIA.PREVIOUS |
  MEDIA.NEXT |
  MEDIA.VOLUME_SET |
  MEDIA.VOLUME_MUTE |
  MEDIA.TURN_ON |
  MEDIA.TURN_OFF |
  MEDIA.SELECT_SOURCE;

export const DEFAULT_NAV: readonly Key[] = ['back', 'menu', 'captions', 'home'];
export const DEFAULT_TRANSPORT: readonly Key[] = ['rewind', 'play_pause', 'forward'];
/** A pressed quadrant lights this long. */
const PRESS_MS = 180;
/** A key held repeats after this long, this often. */
const HOLD_MS = 450;
const REPEAT_MS = 150;

type Plan =
  | {
      readonly kind: 'service';
      readonly domain: string;
      readonly service: string;
      readonly data: Record<string, unknown>;
      readonly target: string;
    }
  | { readonly kind: 'action'; readonly action: ActionConfig; readonly target: string | undefined };

/** An app as the row draws it. */
interface AppItem {
  readonly id: string;
  /** What is said under the circle: the person's name, else the platform's short name ("Prime"). */
  readonly name: string;
  /** What the app is called in full: the circle's label. */
  readonly title: string;
  readonly icon: IconRef | string;
  readonly colour: string | undefined;
  readonly active: boolean;
  readonly run: (() => void) | undefined;
}

/** The keys a config names, each once, only names the card knows; the default where it names none. */
const keysOf = (raw: unknown, fallback: readonly string[]): readonly Key[] => [
  ...new Set((Array.isArray(raw) ? (raw as unknown[]) : fallback).filter(isKey)),
];

/** A cell of `columns` across `width`, `gap` apart, on a whole pixel: what the division leaves over is a tail at the row's end. */
const wholeCell = (width: number, gap: number, columns: number): number =>
  Math.max(0, Math.floor((width - gap * (columns - 1)) / columns));

/** The player is switched off (a television in standby counts). */
const isOff = (state: string): boolean => state === 'off' || state === 'standby';

/** The logos' chunk, fetched once by the first card that draws an app. */
let logos: Promise<unknown> | undefined;
const loadLogos = (): Promise<unknown> => (logos ??= import('../app-logos/paths.js'));

/**
 * The TV remote card (#143): the feel of a remote in Fluvy's hand. The head with the power round; the player's
 * sources as chips; the D-pad, a ring of four arrows round OK between its four keys (or the reference's grid);
 * rewind · play/pause · forward; the volume — the house's ruler where the device reports a level it can set, keys or a
 * stepper where not — routed to a receiver if asked; the channel; the apps with their logos; keys of the person's own.
 * Each key goes to the player's own service where it has one, else to the remote as its integration takes it (Android
 * TV Remote, Apple TV, Roku, LG webOS, Samsung, Fire TV), else to a command of the config's. Compact, a row of keys;
 * pad, the D-pad alone; row, the media card's mini row. Off, the power round takes the primary fill and every key
 * stays alive (or power alone); out of reach the card keeps its size and anatomy in the dashed skin.
 */
export class FluvyRemoteCard extends Card<RemoteCardConfig> {
  /** The card's height at a 360 column from its config alone (`remoteHeight`). */
  static override layoutHeight(config: LovelaceCardConfig): number {
    return remoteHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    css`
      .rm-gap {
        height: 16px;
      }
      /* the sources' chips follow a group's gap, not a label: the house's 8 under a label is not theirs here */
      .fv-chips {
        margin-top: 0;
      }
      .rm-card--row {
        padding: 16px;
      }
      .rm-row {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 44px;
      }
      .rm-row__text {
        flex: 1 1 auto;
        min-width: 0;
      }
      .rm-row__rounds {
        display: flex;
        gap: 8px;
      }
      /* the pad: the ring centred, its four keys at the column's edges where they hold */
      .rm-pad {
        position: relative;
      }
      .rm-pad__key {
        position: absolute;
      }
      .rm-ring {
        position: absolute;
        top: 0;
        display: block;
      }
      .rm-ring svg {
        display: block;
      }
      .rm-ring__disc {
        fill: var(--fluvy-inset, var(--fluvy-page));
      }
      .rm-wedge {
        fill: var(--fluvy-accent-fill);
      }
      .rm-arrow,
      .rm-ok {
        position: absolute;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 50%;
        background: none;
        font: inherit;
        color: var(--fluvy-text);
        cursor: pointer;
        transition:
          transform var(--fv-fast) var(--fv-ease),
          color var(--fv-base) var(--fv-ease),
          background-color var(--fv-base) var(--fv-ease);
        user-select: none;
        -webkit-user-select: none;
        touch-action: manipulation;
      }
      .rm-arrow {
        width: 44px;
        height: 44px;
      }
      .rm-arrow svg {
        width: 20px;
        height: 20px;
      }
      .rm-arrow.is-pressed {
        color: var(--fluvy-accent-on-fill);
      }
      .rm-ok {
        width: 64px;
        height: 64px;
        background: var(--fv-solid-card, var(--fluvy-card));
        box-shadow:
          inset 0 0 0 1px var(--fluvy-border),
          0 1px 2px rgb(0 0 0 / 0.06);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .rm-ok:active {
        transform: scale(0.94);
        background: var(--fluvy-page-alt);
      }
      .rm-arrow[disabled],
      .rm-ok[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      .rm-okcell {
        background: var(--fv-solid-card, var(--fluvy-card));
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
        color: var(--fluvy-text);
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      /* equal cells that fill the column; the card hands over the gap that keeps them on the 4 grid */
      .rm-cells {
        display: grid;
        gap: var(--rm-gap, 16px);
      }
      .rm-cells + .rm-cells {
        margin-top: var(--rm-gap, 16px);
      }
      .rm-cells .fv-action {
        gap: 8px;
      }
      .rm-cells__word {
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
      }
      .rm-transport {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 48px;
      }
      .rm-transport .fv-round {
        width: 48px;
        height: 48px;
      }
      .rm-transport .fv-round svg {
        width: 24px;
        height: 24px;
      }
      /* a group's label with where it goes and its figure at the end */
      .rm-label {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
        height: 20px;
        margin-top: 16px;
        font-size: 11px;
        font-weight: 600;
        line-height: 20px;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--fluvy-text-secondary);
        white-space: nowrap;
      }
      /* the baseline it shares with the taller figure pushes it down: a 16 line holds it inside the label's 20 */
      .rm-label__word {
        line-height: 16px;
      }
      .rm-label__meta {
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0;
        text-transform: none;
        font-variant-numeric: tabular-nums;
      }
      .rm-label + .rm-cells,
      .rm-label + .rm-volume {
        margin-top: 8px;
      }
      .rm-volume {
        display: flex;
        align-items: center;
        gap: 20px;
        height: 44px;
      }
      .rm-volume--stepper {
        justify-content: flex-end;
        gap: 12px;
      }
      /* the apps: circles in equal cells, their names under them */
      .rm-apps {
        display: grid;
        row-gap: 8px;
      }
      .rm-apps__row {
        display: grid;
        column-gap: 4px;
      }
      .rm-app {
        display: grid;
        justify-items: center;
        row-gap: 8px;
        min-width: 0;
      }
      .rm-app__circle {
        cursor: pointer;
      }
      .rm-app__circle.is-rest {
        background: var(
          --fluvy-accent-rest,
          color-mix(in srgb, var(--fluvy-accent-fill) 40%, var(--fluvy-card))
        );
        box-shadow: inset 0 0 0 1px var(--fluvy-accent-fill-border);
      }
      .rm-app__circle img,
      .fv-chip__pill img {
        display: block;
        width: 24px;
        height: 24px;
        object-fit: contain;
        border-radius: 4px;
      }
      .fv-chip__pill img {
        width: 16px;
        height: 16px;
      }
      :is(.rm-app__circle, .fv-chip__pill)[disabled] img {
        filter: grayscale(1);
        opacity: 0.5;
      }
      .rm-app__circle[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      /* the ruler's words' size: six names hold their cells of 50 at a 360 column */
      .rm-app__name {
        max-width: 100%;
        font-size: 11px;
        font-weight: 500;
        line-height: 16px;
        color: var(--fluvy-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .rm-app.is-active .rm-app__name {
        color: var(--fluvy-text);
      }
      /* out of reach: what would vanish into the card's page fill wears the dashed skin the card wears; quiet, none of
         it (the keys rest as they do, still and at full strength, and the quiet sheet answers the shared ones) */
      .is-off:where(:not([data-unavailable='quiet']))
        :is(.fv-round, .fv-action, .fv-chip__pill, .rm-ok, .rm-app__circle, .fv-stepper) {
        background: transparent;
        outline: 1px dashed var(--fluvy-unavailable-border);
        outline-offset: -1px;
        box-shadow: none;
        color: var(--fluvy-unavailable);
      }
      .is-off:where(:not([data-unavailable='quiet'])) .rm-ring__disc {
        fill: transparent;
        stroke: var(--fluvy-unavailable-border);
        stroke-dasharray: 3 3;
      }
      .is-off:where(:not([data-unavailable='quiet'])) :is(.rm-arrow, .rm-label, .rm-app__name) {
        color: var(--fluvy-unavailable);
      }
      .is-off .fv-round[disabled],
      .is-off .fv-action[disabled],
      .is-off .rm-arrow[disabled],
      .is-off .rm-ok[disabled],
      .is-off .rm-app__circle[disabled],
      .is-off .fv-stepper__half[disabled] {
        opacity: 1;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    pressed_: { state: true },
    logos_: { state: true },
    broken_: { state: true },
  };
  /** The arrow whose quadrant lights (180 ms after a press). */
  declare pressed_: string;
  /** The logos' chunk has landed: the apps draw their marks. */
  declare logos_: boolean;
  /** The pictures that would not load: those apps wear their logo, or their glyph, instead of a broken image. */
  declare broken_: ReadonlySet<string>;

  static override editor(): Promise<CardEditor> {
    return import('./remote-editor.js');
  }

  static getStubConfig(
    _hass: unknown,
    entities: readonly string[],
  ): LovelaceCardConfig & { entity: string } {
    const entity = entities.find((id) => id.startsWith('media_player.')) ?? '';
    const remote = entities.find((id) => id.startsWith('remote.'));
    return { type: 'custom:fluvy-remote-card', entity, ...(remote ? { remote } : {}) };
  }

  /** The head, measured: what gives way in a narrow column is the line's trailing segments, then the circle. */
  private readonly head = new HeadFit(this);
  /** The mute as the round was last tapped, until the device says so. */
  private readonly mutedHold = new Hold<boolean>(this);
  private pressTimer = 0;
  private holdTimer = 0;
  private repeatTimer = 0;
  /** A held key has repeated: the click that follows the release runs nothing. */
  private repeated = false;

  /** A picture's error does not bubble: heard on its way down, once for each address. */
  private readonly pictureFailed = {
    capture: true,
    handleEvent: ({ target }: Event): void => {
      const src = target instanceof HTMLImageElement ? target.getAttribute('src') : null;
      if (src && !this.broken_.has(src)) this.broken_ = new Set([...this.broken_, src]);
    },
  };

  constructor() {
    super();
    this.pressed_ = '';
    this.logos_ = false;
    this.broken_ = new Set();
  }

  protected override prepare(config: RemoteCardConfig): RemoteCardConfig {
    if (!config.entity && !config.remote)
      throw new Error('fluvy-remote-card: "entity" (a media player) or "remote" is required');
    return config;
  }

  private get remote(): RemoteCardConfig {
    return this.config as RemoteCardConfig;
  }

  private get variant(): RemoteVariant {
    const asked = this.remote.variant;
    return asked && VARIANTS.includes(asked) ? asked : 'full';
  }

  /** The player, the remote and the device the volume goes to. */
  protected override watched(): readonly string[] {
    const { entity, remote, volume_entity } = this.remote;
    return [entity ?? '', remote ?? '', volume_entity ?? ''].filter(Boolean);
  }

  override getCardSize(): number {
    return Math.ceil(remoteHeight(this.config ?? { type: '' }) / 50);
  }

  /** The full card and the pad need the ring's room; the compact row and the row hold half a section. */
  override getGridOptions(): LovelaceGridOptions {
    return this.variant === 'full' || this.variant === 'pad'
      ? { columns: 12, rows: 'auto', min_columns: 8 }
      : { columns: 12, rows: 'auto', min_columns: 6 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.mutedHold.clear();
    this.stopRepeat();
    clearTimeout(this.pressTimer);
  }

  /* ---------- the device ---------- */

  /** The player (the card's entity), or the remote where the card has no player; one never read draws as a television usually does. */
  private player(): EntityView {
    return drawnAs(this.entity(this.remote.entity ?? this.remote.remote), USUAL);
  }

  private remoteView(): EntityView | undefined {
    return this.remote.remote ? this.entity(this.remote.remote) : undefined;
  }

  /** The device the volume goes to: `volume_entity`, else the player. */
  private volumeView(): EntityView {
    return this.entity(this.remote.volume_entity ?? this.remote.entity ?? this.remote.remote);
  }

  /** The integration behind the keys: the remote's, else the player's (Home Assistant's registry says). */
  private integration(): string | undefined {
    const entities = this.hass?.entities;
    const { remote, entity } = this.remote;
    return (
      (remote && entities?.[remote]?.platform) ||
      (entity && entities?.[entity]?.platform) ||
      undefined
    );
  }

  /** The device can be read: its player, or its remote. */
  private usable(): boolean {
    const r = this.remoteView();
    return isUsable(this.player()) || (r !== undefined && isUsable(r));
  }

  /** The device is switched off: its player says so, else its remote. */
  private off(): boolean {
    const p = this.player();
    if (isUsable(p))
      return p.domain === 'media_player' ? isOff(this.stateOf(p)) : this.stateOf(p) === 'off';
    const r = this.remoteView();
    return r !== undefined && isUsable(r) && this.stateOf(r) === 'off';
  }

  /** A key may be pressed: the device is reachable and, while off, every key is alive or this is the power. */
  private alive(key: Key): boolean {
    if (!this.usable()) return false;
    if (key === 'power') return true;
    return !(this.off() && (this.remote.off_keys ?? 'live') === 'power');
  }

  /** What a key does on this device, or nothing where no part of it takes the key. */
  private plan(key: Key): Plan | null {
    const over = this.remote.commands?.[key];
    const p = this.player();
    const target = this.remote.entity ?? this.remote.remote ?? '';
    if (over && typeof over === 'object') return { kind: 'action', action: over, target };
    const player = p.domain === 'media_player' ? p : undefined;
    const service = (
      domain: string,
      name: string,
      data: Record<string, unknown> = {},
      id = p.id,
    ): Plan => ({
      kind: 'service',
      domain,
      service: name,
      data,
      target: id,
    });
    // the player's own services first, where it has them: Home Assistant then says what changed
    if (player && typeof over !== 'string') {
      const state = this.stateOf(player);
      const v = this.volumeView();
      const level = v.attr<number>('volume_level');
      switch (key) {
        case 'power':
          if (isOff(state) ? player.supports(MEDIA.TURN_ON) : player.supports(MEDIA.TURN_OFF))
            return service('media_player', isOff(state) ? 'turn_on' : 'turn_off');
          break;
        case 'volume_up':
        case 'volume_down':
          if (v.supports(MEDIA.VOLUME_STEP)) return service('media_player', key, {}, v.id);
          if (v.supports(MEDIA.VOLUME_SET) && typeof level === 'number')
            return service(
              'media_player',
              'volume_set',
              {
                volume_level: Math.min(
                  1,
                  Math.max(0, level + (key === 'volume_up' ? 0.05 : -0.05)),
                ),
              },
              v.id,
            );
          break;
        case 'mute':
          if (v.supports(MEDIA.VOLUME_MUTE))
            return service(
              'media_player',
              'volume_mute',
              { is_volume_muted: !this.muted(v) },
              v.id,
            );
          break;
        case 'play_pause':
          if (player.supports(MEDIA.PLAY) || player.supports(MEDIA.PAUSE))
            return service('media_player', 'media_play_pause');
          break;
        case 'play':
          if (player.supports(MEDIA.PLAY)) return service('media_player', 'media_play');
          break;
        case 'pause':
          if (player.supports(MEDIA.PAUSE)) return service('media_player', 'media_pause');
          break;
        case 'stop':
          if (player.supports(MEDIA.STOP)) return service('media_player', 'media_stop');
          break;
        case 'previous':
          if (player.supports(MEDIA.PREVIOUS))
            return service('media_player', 'media_previous_track');
          break;
        case 'next':
          if (player.supports(MEDIA.NEXT)) return service('media_player', 'media_next_track');
          break;
      }
    }
    const integration = this.integration();
    const command = typeof over === 'string' ? over : commandFor(integration, key);
    if (!command) return null;
    // webOS takes its buttons on the player itself; every other integration on its remote
    if (buttonService(integration) && player)
      return service('webostv', 'button', { button: command });
    const r = this.remoteView();
    if (r) {
      if (key === 'power' && !isUsable(p))
        return service('remote', this.stateOf(r) === 'off' ? 'turn_on' : 'turn_off', {}, r.id);
      return service('remote', 'send_command', { command }, r.id);
    }
    return null;
  }

  /** Something on the device takes the key. */
  private takes(key: Key): boolean {
    return this.plan(key) !== null;
  }

  private muted(v: EntityView): boolean {
    return this.mutedHold.read(v.attr<boolean | null>('is_volume_muted') === true);
  }

  /* ---------- pressing ---------- */

  private press(key: Key): void {
    const plan = this.plan(key);
    if (!plan || !this.alive(key)) return;
    haptic(this, key === 'power' ? 'medium' : 'selection');
    if (plan.kind === 'action') {
      this.tap(plan.target, plan.action);
      return;
    }
    const p = this.player();
    if (plan.service === 'turn_on' || plan.service === 'turn_off')
      this.expect(
        plan.target,
        plan.service === 'turn_on' ? (plan.domain === 'remote' ? 'on' : 'idle') : 'off',
      );
    else if (plan.service === 'volume_mute')
      this.mutedHold.set(Boolean(plan.data['is_volume_muted']));
    else if (plan.service === 'media_play_pause')
      this.expect(p.id, this.stateOf(p) === 'playing' ? 'paused' : 'playing');
    this.call(plan.domain, plan.service, plan.data, plan.target);
  }

  /** A press on an arrow lights its quadrant for a moment. */
  private light(direction: string): void {
    this.pressed_ = direction;
    clearTimeout(this.pressTimer);
    this.pressTimer = window.setTimeout(() => {
      this.pressed_ = '';
    }, PRESS_MS);
  }

  /** A key held repeats: after 450 ms, every 150 ms; the click of the release then runs nothing. */
  private startRepeat(event: PointerEvent, key: Key): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    this.stopRepeat();
    this.repeated = false;
    this.holdTimer = window.setTimeout(() => {
      this.repeatTimer = window.setInterval(() => {
        this.repeated = true;
        this.press(key);
      }, REPEAT_MS);
    }, HOLD_MS);
  }

  private stopRepeat(): void {
    clearTimeout(this.holdTimer);
    clearInterval(this.repeatTimer);
    this.holdTimer = this.repeatTimer = 0;
  }

  /** The handlers a repeating key takes: held, it repeats; released, one press unless it repeated. */
  private repeating(key: Key, direction?: string) {
    return {
      down: (event: PointerEvent) => this.startRepeat(event, key),
      up: () => this.stopRepeat(),
      click: () => {
        if (this.repeated) {
          this.repeated = false;
          return;
        }
        if (direction) this.light(direction);
        this.press(key);
      },
    };
  }

  private keyLabel(key: Key): string {
    if (key === 'power') return s(this.hass, this.off() ? 'turn_on' : 'turn_off');
    if (key === 'mute' && this.muted(this.volumeView())) return s(this.hass, 'key.unmute');
    return s(this.hass, `key.${key}`);
  }

  private keyGlyph(key: Key): IconRef {
    if (key === 'play_pause') {
      const p = this.player();
      return this.stateOf(p) === 'playing' || this.stateOf(p) === 'buffering' ? 'pause' : 'play';
    }
    if (key === 'mute' && this.muted(this.volumeView())) return 'volumeOff';
    return KEY_GLYPHS[key];
  }

  /** A key as a 44 round (48 in the transport): the power on the primary fill while the device is off. */
  private keyRound(key: Key, extra = '', kind: '' | 'quiet' | 'accent' = ''): TemplateResult {
    const still = !this.takes(key) || !this.alive(key);
    const { down, up, click } = this.repeating(key);
    const label = this.keyLabel(key);
    const primary = key === 'power' && this.off() && this.usable();
    return html`<button
      class="fv-round ${primary ? 'fv-round--accent' : kind ? `fv-round--${kind}` : ''} ${extra}"
      data-control
      data-target
      aria-label=${label}
      title=${label}
      ?disabled=${still}
      @pointerdown=${down}
      @pointerup=${up}
      @pointerleave=${up}
      @pointercancel=${up}
      @click=${click}
    >
      ${icon(this.keyGlyph(key))}
    </button>`;
  }

  /** The equal cells of an action row that fill the column, in `columns`, `gap` apart; a word beside the glyph where asked. */
  private cells(
    items: ReadonlyArray<{
      key: Key;
      word?: string;
      primary?: boolean;
      glyph?: IconRef | string;
      label?: string;
      run?: () => void;
      still?: boolean;
    }>,
    width: number,
    extra = '',
  ): TemplateResult {
    const { gap, columns } = this.gapFor(items.length, width);
    return html`<div
      class="rm-cells ${extra}"
      data-fill-row
      style="grid-template-columns:repeat(${columns}, ${wholeCell(width, gap, columns)}px);--rm-gap:${gap}px"
    >
      ${items.map((item) => {
        const still = item.still ?? (!this.takes(item.key) || !this.alive(item.key));
        const label = item.label ?? this.keyLabel(item.key);
        const handlers = item.run
          ? { down: () => undefined, up: () => undefined, click: item.run }
          : this.repeating(item.key);
        return html`<button
          class="fv-action ${item.primary ? 'fv-action--accent' : ''}"
          data-control
          data-target
          aria-label=${label}
          title=${label}
          ?disabled=${still}
          @pointerdown=${handlers.down}
          @pointerup=${handlers.up}
          @pointerleave=${handlers.up}
          @pointercancel=${handlers.up}
          @click=${handlers.click}
        >
          ${icon(item.glyph ?? this.keyGlyph(item.key))}${item.word ? html`<span class="rm-cells__word">${item.word}</span>` : nothing}
        </button>`;
      })}
    </div>`;
  }

  /** The gap and the columns of `count` cells across `width`: 16 while every cell keeps 44, else 4, else two rows. */
  private gapFor(count: number, width: number): { gap: number; columns: number } {
    const cell = (gap: number, n: number): number => (width - gap * (n - 1)) / n;
    if (cell(16, count) >= 44) return { gap: 16, columns: count };
    if (cell(4, count) >= 44) return { gap: 4, columns: count };
    const rows = actionRows(count, width);
    return { gap: 16, columns: Math.ceil(count / rows) };
  }

  /* ---------- the head ---------- */

  /** The line under the name: what plays, else the source, else the state; off, since when; out of reach, why. */
  private line(p: EntityView): string {
    if (!this.usable()) return this.outOfReach(p);
    if (this.off()) {
      const changed = changedAt(this.hass, p);
      return [stateText(this.hass, p), changed ? relativeTime(this.hass, changed) : '']
        .filter(Boolean)
        .join(' · ');
    }
    // an app is often its own source too: said once
    const said = [textAttr(p, 'app_name') || textAttr(p, 'media_title'), textAttr(p, 'source')];
    return [...new Set(said.filter(Boolean))].join(' · ') || stateText(this.hass, p);
  }

  private outOfReach(p: EntityView): string {
    const changed = changedAt(this.hass, p);
    return [stateText(this.hass, p), changed ? relativeTime(this.hass, changed) : '']
      .filter(Boolean)
      .join(' · ');
  }

  /** The head's circle: the card's own icon, the entity's, else the screen for a television and the speaker for a receiver. */
  private headIcon(p: EntityView): IconRef | string {
    if (this.remote.icon) return this.remote.icon;
    if (p.registryIcon || p.ownIcon) return iconOf(p);
    return p.deviceClass === 'receiver' || p.deviceClass === 'speaker' ? 'speaker' : 'tv';
  }

  private tone(): Tone {
    return this.accents.pick(this.config?.color) ? 'accent' : (this.config?.tone ?? 'media');
  }

  /* ---------- the groups ---------- */

  /** The player's sources, where it takes one; the platforms among them go to the apps row where that row is theirs. */
  private sources(p: EntityView, withoutApps: boolean): readonly string[] {
    if (p.domain !== 'media_player' || !p.supports(MEDIA.SELECT_SOURCE)) return [];
    const list = p.attr<unknown>('source_list');
    const sources = Array.isArray(list) ? list.map(String) : [];
    return withoutApps ? sources.filter((source) => !platformOf(source)) : sources;
  }

  private renderSources(
    p: EntityView,
    width: number,
    sources: readonly string[],
  ): TemplateResult | typeof nothing {
    if (!sources.length) return nothing;
    const current = textAttr(p, 'source');
    const still = !this.usable() || !this.alive('input');
    return html`<div class="rm-gap"></div>
      ${chipRow(
        sources.map((source) => ({
          key: source,
          label: source,
          name: true,
          active: this.usable() && source === current,
          unavailable: !this.usable(),
          disabled: still && this.usable(),
        })),
        (source) => {
          haptic(this, 'selection');
          this.call('media_player', 'select_source', { source }, p.id);
        },
        'full',
        { ruler: this.head.ruler, width },
      )}`;
  }

  /** The pad: the ring between its four keys, or over a row of them; or the reference's grid. */
  private renderPad(width: number): TemplateResult {
    const nav = keysOf(this.remote.nav, DEFAULT_NAV).slice(0, 4);
    if ((this.remote.dpad ?? 'ring') === 'grid') return this.renderGrid(nav, width);
    const { sides, size } = ringFit(width, this.remote.side_keys);
    const left = Math.round((width - size) / 2);
    const key = (k: Key | undefined, x: string, y: number) =>
      k
        ? html`<span class="rm-pad__key" style="${x}:0;top:${y}px">${this.keyRound(k)}</span>`
        : nothing;
    const [a, b, c, d] = nav;
    return html`<div class="rm-gap"></div>
      <div class="rm-pad" style="height:${size}px">
        ${sides ? html`${key(a, 'left', 22)}${key(b, 'right', 22)}${key(c, 'left', size - 66)}${key(d, 'right', size - 66)}` : nothing}
        <div class="rm-ring" style="left:${left}px">${this.renderRing(size)}</div>
      </div>
      ${
        sides || !nav.length
          ? nothing
          : html`<div class="rm-gap"></div>
              ${this.cells(
                nav.map((k) => ({ key: k })),
                width,
              )}`
      }`;
  }

  /**
   * The ring: a disc of the inset ground, four arrows at 44 targets, OK a 64 disc of the card's colour on its hairline
   * (a drawn key, a target but none of the house's control heights).
   */
  private renderRing(size: number): TemplateResult {
    const c = size / 2;
    const rGap = 36;
    const rGlyph = c - 28;
    const rad = (deg: number): number => (deg * Math.PI) / 180;
    const pt = (r: number, deg: number): [number, number] => [
      c + r * Math.cos(rad(deg)),
      c + r * Math.sin(rad(deg)),
    ];
    const wedge = (deg: number): string => {
      const [x0, y0] = pt(c - 1, deg - 45);
      const [x1, y1] = pt(c - 1, deg + 45);
      const [x2, y2] = pt(rGap, deg + 45);
      const [x3, y3] = pt(rGap, deg - 45);
      return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${c - 1} ${c - 1} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${rGap} ${rGap} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
    };
    const arrows: ReadonlyArray<[Key, number]> = [
      ['up', -90],
      ['right', 0],
      ['down', 90],
      ['left', 180],
    ];
    const pressed = arrows.find(([k]) => k === this.pressed_);
    const okStill = !this.takes('ok') || !this.alive('ok');
    const word = (this.remote.ok_label ?? 'word') === 'word';
    return html`<svg width=${size} height=${size} viewBox="0 0 ${size} ${size}" aria-hidden="true">
        <circle class="rm-ring__disc" cx=${c} cy=${c} r=${c - 0.5} />
        ${pressed ? svg`<path class="rm-wedge" d=${wedge(pressed[1])} />` : nothing}
      </svg>
      ${arrows.map(([k, deg]) => {
        const [x, y] = pt(rGlyph, deg);
        const { down, up, click } = this.repeating(k, k);
        const still = !this.takes(k) || !this.alive(k);
        return html`<button
          class="rm-arrow ${this.pressed_ === k ? 'is-pressed' : ''}"
          style="left:${Math.round(x - 22)}px;top:${Math.round(y - 22)}px"
          data-control
          data-target
          aria-label=${this.keyLabel(k)}
          title=${this.keyLabel(k)}
          ?disabled=${still}
          @pointerdown=${down}
          @pointerup=${up}
          @pointerleave=${up}
          @pointercancel=${up}
          @click=${click}
        >
          ${icon(KEY_GLYPHS[k])}
        </button>`;
      })}
      <button
        class="rm-ok"
        style="left:${c - 32}px;top:${c - 32}px"
        data-target
        aria-label=${this.keyLabel('ok')}
        title=${this.keyLabel('ok')}
        ?disabled=${okStill}
        @click=${() => this.press('ok')}
      >
        ${word ? s(this.hass, 'key.ok') : nothing}
      </button>`;
  }

  /** The reference's grid: nine cells, the four keys at the corners, OK in the middle on the card's colour. */
  private renderGrid(nav: readonly Key[], width: number): TemplateResult {
    const [a, b, c, d] = nav;
    const word = (this.remote.ok_label ?? 'word') === 'word';
    const cell = (
      k: Key | undefined,
    ): { key: Key; still?: boolean; glyph?: IconRef; label?: string } =>
      k ? { key: k } : { key: 'ok', still: true, glyph: 'dots', label: '' };
    const okStill = !this.takes('ok') || !this.alive('ok');
    const { gap } = this.gapFor(3, width);
    const rows: Array<ReadonlyArray<ReturnType<typeof cell>>> = [
      [cell(a), cell('up'), cell(b)],
      [cell('left'), { key: 'ok', still: okStill }, cell('right')],
      [cell(c), cell('down'), cell(d)],
    ];
    return html`<div class="rm-gap"></div>
      ${rows.map(
        (row) =>
          html`<div
            class="rm-cells"
            data-fill-row
            style="grid-template-columns:repeat(3, ${wholeCell(width, gap, 3)}px);--rm-gap:${gap}px"
          >
            ${row.map((item) => {
              const ok = item.key === 'ok' && item.still === okStill && item.glyph === undefined;
              const { down, up, click } = this.repeating(item.key, item.key);
              const label = item.label ?? this.keyLabel(item.key);
              return html`<button
                class="fv-action ${ok ? 'rm-okcell' : ''}"
                data-control
                data-target
                aria-label=${label}
                title=${label}
                ?disabled=${item.still ?? (!this.takes(item.key) || !this.alive(item.key))}
                @pointerdown=${ok ? nothing : down}
                @pointerup=${ok ? nothing : up}
                @pointerleave=${ok ? nothing : up}
                @pointercancel=${ok ? nothing : up}
                @click=${ok ? () => this.press('ok') : click}
              >
                ${ok ? (word ? s(this.hass, 'key.ok') : nothing) : icon(item.glyph ?? KEY_GLYPHS[item.key])}
              </button>`;
            })}
          </div>`,
      )}`;
  }

  /** Rewind · play/pause · forward as 48 rounds centred under the pad, 40 apart where the column holds them. */
  private renderTransport(width: number): TemplateResult {
    const keys = keysOf(this.remote.transport, DEFAULT_TRANSPORT);
    const gap =
      keys.length > 1
        ? Math.max(
            8,
            Math.min(40, Math.floor((width - 48 * keys.length) / (keys.length - 1) / 4) * 4),
          )
        : 0;
    return html`<div class="rm-gap"></div>
      <div class="rm-transport" style="gap:${gap}px">
        ${keys.map((k) => this.keyRound(k, '', this.usable() && (k === 'play_pause' || k === 'play') ? 'accent' : ''))}
      </div>`;
  }

  /** The label of a group with where it goes and its figure at the end, fitted: the name gives way before the figure. */
  private renderLabel(text: string, place: string, figure: string, width: number): TemplateResult {
    const figureW = figure ? this.head.ruler.width('rm-label__meta', figure) + 12 : 0;
    const whole = place ? `${text} · ${place}` : text;
    const said = this.head.ruler.width('rm-label', whole) <= width - figureW ? whole : text;
    return html`<div class="rm-label">
      <span class="rm-label__word">${said}</span
      >${figure ? html`<span class="rm-label__meta">${figure}</span>` : nothing}
    </div>`;
  }

  /** The volume: the house's ruler where the device reports a level it can set, keys or a stepper where not, the mute beside. */
  private renderVolume(width: number): TemplateResult {
    const v = this.volumeView();
    const routed =
      this.remote.volume_entity !== undefined && this.remote.volume_entity !== this.remote.entity;
    const usable = isUsable(v);
    const level = v.attr<number>('volume_level');
    // the ruler where the device can be set a level (a capability, kept out of reach), whatever it reports now
    const hasLevel = v.supports(MEDIA.VOLUME_SET);
    const asked = this.remote.volume ?? 'auto';
    const mode: Exclude<VolumeStyle, 'auto'> =
      asked === 'auto' ? (hasLevel ? 'ruler' : 'keys') : asked;
    const vOff = usable && v.domain === 'media_player' && isOff(this.stateOf(v));
    const muted = usable && this.muted(v);
    const figure = !usable
      ? '—'
      : vOff
        ? this.t('common.off')
        : typeof level === 'number'
          ? `${Math.round(level * 100)} %`
          : '';
    const place = routed ? this.nameFor(v, undefined) : '';
    const label = this.renderLabel(this.t('common.volume'), place, figure, width);
    const still = !usable || vOff || !this.usable();
    const mute = () => {
      const muteStill = !this.takes('mute') || !this.alive('mute') || (!usable && this.usable());
      return html`<button
        class="fv-round fv-round--quiet"
        data-control
        data-target
        aria-label=${this.keyLabel('mute')}
        title=${this.keyLabel('mute')}
        ?disabled=${muteStill}
        @click=${() => this.press('mute')}
      >
        ${icon(muted ? 'volumeOff' : 'volume')}
      </button>`;
    };
    if (mode === 'keys')
      return html`${label}${this.cells(
        [{ key: 'volume_down' }, { key: 'mute', glyph: 'volumeOff' }, { key: 'volume_up' }],
        width,
      )}`;
    if (mode === 'stepper')
      return html`${label}
        <div class="rm-volume rm-volume--stepper">
          ${mute()}
          ${stepper((direction) => this.press(direction > 0 ? 'volume_up' : 'volume_down'), {
            disabled: still || !this.takes('volume_up'),
            decrease: this.keyLabel('volume_down'),
            increase: this.keyLabel('volume_up'),
          })}
        </div>`;
    const value = typeof level === 'number' ? Math.round(level * 100) : 0;
    const name = this.nameFor(v, undefined);
    return html`${label}
      <div class="rm-volume">
        <fluvy-ruler
          .value=${value}
          .min=${0}
          .max=${100}
          .step=${1}
          .length=${width - 64}
          .tone=${usable && !vOff && !muted ? this.tone() : 'neutral'}
          ?inactive=${!usable || vOff}
          ?disabled=${!usable || !this.alive('volume_up')}
          unit="%"
          .label=${`${name} · ${this.t('common.volume')}`}
          .format=${(n: number) => String(Math.round(n))}
          @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => {
            haptic(this, 'selection');
            this.call(
              'media_player',
              'volume_set',
              { volume_level: event.detail.value / 100 },
              v.id,
            );
          }}
        ></fluvy-ruler>
        ${mute()}
      </div>`;
  }

  /** The channel: its number where the player says it, down · guide · up. */
  private renderChannel(p: EntityView, width: number): TemplateResult {
    const channel = this.usable() ? textAttr(p, 'media_channel') || '—' : '—';
    return html`${this.renderLabel(s(this.hass, 'channel'), '', channel, width)}${this.cells(
      [{ key: 'channel_down' }, { key: 'guide' }, { key: 'channel_up' }],
      width,
    )}`;
  }

  /** The apps as the row draws them: the person's list, else the player's sources that name a platform. */
  private appItems(p: EntityView): readonly AppItem[] {
    const sources = this.sources(p, false);
    const current = this.usable() ? textAttr(p, 'app_name') || textAttr(p, 'source') : '';
    const currentPlatform = platformOf(current);
    const integration = this.integration();
    const r = this.remoteView();
    const item = (
      id: string,
      name: string,
      pf: Platform | undefined,
      own: Omit<RemoteApp, 'app' | 'name'>,
    ): AppItem => {
      const source = own.source ?? sources.find((candidate) => pf && platformOf(candidate) === pf);
      const key = isKey(own.key) ? own.key : undefined;
      const run = own.tap_action
        ? () => this.tap(p.id, own.tap_action)
        : key
          ? () => this.press(key)
          : source
            ? () => this.call('media_player', 'select_source', { source }, p.id)
            : pf?.android && r && (integration === 'androidtv_remote' || integration === undefined)
              ? () => this.call('remote', 'turn_on', { activity: pf.android }, r.id)
              : undefined;
      return {
        id,
        name: shortTitle(name, pf),
        title: name,
        icon:
          (own.image && !this.broken_.has(own.image) ? own.image : undefined) ??
          own.icon ??
          (pf ? `app:${pf.id}` : 'grid'),
        colour: own.color ?? (pf?.hex || undefined),
        active: Boolean(
          this.usable() && ((pf && pf === currentPlatform) || (source && source === current)),
        ),
        // an app is a key of a kind: alive as the keys are (every key, or power alone, while the device is off)
        run: run && this.alive('ok') ? () => (haptic(this, 'selection'), run()) : undefined,
      };
    };
    const own = this.remote.apps;
    if (own?.length)
      return own.map((app, index) => {
        const pf = appPlatform(app);
        return item(app.app ?? app.source ?? app.name ?? String(index), appTitle(app, pf), pf, app);
      });
    return sources
      .map((source) => [source, platformOf(source)] as const)
      .filter((pair): pair is readonly [string, Platform] => pair[1] !== undefined)
      .map(([source, pf]) => item(pf.id, pf.title, pf, { source }));
  }

  private renderApps(p: EntityView, width: number): TemplateResult | typeof nothing {
    const items = this.appItems(p);
    if (!items.length) return nothing;
    if (!this.logos_ && items.some((item) => String(item.icon).startsWith('app:')))
      void loadLogos().then(() => {
        this.logos_ = true;
      });
    const always = this.remote.apps_tint === 'always';
    if ((this.remote.apps_style ?? 'circles') === 'chips')
      return html`<div class="rm-gap"></div>
        ${chipRow(
          items.map((item) => ({
            key: item.id,
            label: item.name,
            glyph: item.icon,
            name: true,
            active: item.active,
            ...(item.colour ? { accent: this.accents.item(item.colour) ?? '' } : {}),
            unavailable: !this.usable(),
            disabled: this.usable() && !item.run,
          })),
          (key) => items.find((item) => item.id === key)?.run?.(),
          'full',
          { ruler: this.head.ruler, width },
        )}`;
    // as many a row as keep every name under its circle (measured in the names' class), fewer where that does, the
    // most with the circles alone where none would: the family's rule, so the height declared is the height drawn
    const { perRow, names } = appsLayout(
      items.map((item) => item.name),
      width,
      (text) => this.head.ruler.width('rm-app__name', text),
    );
    const rows: AppItem[][] = [];
    for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
    return html`<div class="rm-gap"></div>
      <div class="rm-apps">
        ${rows.map(
          (row) =>
            html`<div
              class="rm-apps__row"
              style="grid-template-columns:repeat(${perRow}, minmax(0, 1fr))"
            >
              ${row.map((item) => {
                const coloured = item.active || always;
                const accent = coloured && item.colour ? this.accents.item(item.colour) : undefined;
                const label = s(this.hass, 'open', { app: item.title });
                return html`<span class="rm-app ${item.active ? 'is-active' : ''}">
                  <button
                    class="fv-ico rm-app__circle ${coloured ? `fv-ico--${this.tone()} ${!item.active && always ? 'is-rest' : ''}` : 'fv-ico--neutral'}"
                    data-icon
                    data-target
                    data-accent=${accent ?? nothing}
                    aria-label=${label}
                    title=${label}
                    ?disabled=${!item.run}
                    @click=${item.run ?? nothing}
                  >
                    ${icon(item.icon, 'grid')}
                  </button>
                  ${names ? html`<span class="rm-app__name">${item.name}</span>` : nothing}
                </span>`;
              })}
            </div>`,
        )}
      </div>`;
  }

  /** The person's own keys: a key of the table or an action, as cells; their words beside the glyphs where every word holds. */
  private renderCustom(p: EntityView, width: number): TemplateResult | typeof nothing {
    const own = this.remote.custom ?? [];
    if (!own.length) return nothing;
    const { gap, columns } = this.gapFor(own.length, width);
    const cell = wholeCell(width, gap, columns);
    const words = own.every(
      (item) => 20 + 8 + this.head.ruler.width('rm-cells__word', item.name) + 24 <= cell,
    );
    return html`<div class="rm-gap"></div>
      ${this.cells(
        own.map((item) => {
          const key = isKey(item.key) ? item.key : undefined;
          const run = item.tap_action
            ? () => this.tap(p.id, item.tap_action)
            : key
              ? () => this.press(key)
              : undefined;
          return {
            key: key ?? 'ok',
            glyph: item.icon ?? (key ? KEY_GLYPHS[key] : 'dots'),
            label: item.name,
            ...(words ? { word: item.name } : {}),
            still:
              !run ||
              !this.usable() ||
              (key !== undefined && (!this.takes(key) || !this.alive(key))),
            run: run ? () => (haptic(this, 'selection'), run()) : () => undefined,
          };
        }),
        width,
      )}`;
  }

  /* ---------- the variants ---------- */

  private renderRow(p: EntityView, name: string): TemplateResult {
    const inner = this.width - 32;
    const controls = keysOf(this.remote.controls, DEFAULT_CONTROLS);
    // the rounds that hold beside a 96 title and the circle (three at a phone's column); the row is there to control
    const beside = Math.max(
      1,
      Math.min(controls.length, Math.floor((inner - 44 - 12 - 96 + 8) / 52)),
    );
    const shown = controls.slice(0, beside);
    const fit = this.head.fit({
      width: inner,
      title: name,
      sub: this.line(p),
      trailing: shown.length * 52 - 8,
    });
    return html`<article
      class="fv-card rm-card rm-card--row ${this.usable() ? '' : 'is-unavailable is-off'}"
      data-card
    >
      <div class="rm-row">
        ${fit.icon ? html`<span class="fv-ico fv-ico--${this.usable() ? (this.off() ? 'neutral' : this.tone()) : 'off'} ${fit.small ? 'fv-ico--small' : ''}" data-icon>${icon(this.usable() || this.looksQuiet ? this.headIcon(p) : 'ban')}</span>` : nothing}
        <div class="rm-row__text">
          <p class="fv-card__title" data-name>${name}</p>
          ${fit.sub ? html`<p class="fv-card__sub">${fit.sub}</p>` : nothing}
        </div>
        <div class="rm-row__rounds">${shown.map((k) => this.keyRound(k))}</div>
      </div>
    </article>`;
  }

  protected override renderCard(): TemplateResult {
    const p = this.player();
    const name = this.nameFor(p, this.remote.name);
    const variant = this.variant;
    if (variant === 'row') return this.renderRow(p, name);
    const width = this.contentWidth;
    const usable = this.usable();
    const fitted = this.head.fit({ width, title: name, sub: this.line(p), trailing: 44 });
    const parts: Array<TemplateResult | typeof nothing> = [];
    if (variant === 'compact') {
      const keys = keysOf(this.remote.keys, DEFAULT_KEYS);
      parts.push(
        html`<div class="rm-gap"></div>`,
        this.cells(
          keys.map((k) => ({ key: k, primary: k === 'play_pause' || k === 'play' })),
          width,
        ),
      );
    } else if (variant === 'pad') parts.push(this.renderPad(width));
    else {
      const groups = remoteGroups(this.remote.groups);
      const appsDrawn = groups.includes('apps') && !this.remote.apps?.length;
      // the pad and the channel are the remote's (or a webOS television's own buttons): offered by the config and
      // the registry alone, so the anatomy never follows a state
      const keyed = Boolean(this.remote.remote) || buttonService(this.integration());
      for (const group of groups)
        switch (group) {
          case 'source':
            parts.push(this.renderSources(p, width, this.sources(p, appsDrawn)));
            break;
          case 'dpad':
            if (keyed) parts.push(this.renderPad(width));
            break;
          case 'transport':
            parts.push(this.renderTransport(width));
            break;
          case 'volume':
            parts.push(this.renderVolume(width));
            break;
          case 'channel':
            if (keyed) parts.push(this.renderChannel(p, width));
            break;
          case 'apps':
            parts.push(this.renderApps(p, width));
            break;
          case 'custom':
            parts.push(this.renderCustom(p, width));
            break;
        }
    }
    return html`<article
      class="fv-card rm-card ${usable ? '' : 'is-unavailable is-off'}"
      data-card
      @error=${this.pictureFailed}
    >
      ${head({
        icon: fitted.icon ? (usable || this.looksQuiet ? this.headIcon(p) : 'ban') : null,
        small: fitted.small,
        tone: usable ? (this.off() ? 'neutral' : this.tone()) : 'off',
        title: name,
        name: true,
        sub: fitted.sub,
        trailing: this.keyRound('power'),
        cut: fitted.cut,
        ...this.headActions(p.id),
      })}
      ${parts}
    </article>`;
  }
}
