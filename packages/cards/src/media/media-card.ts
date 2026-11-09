import {
  formatDuration,
  formatNumber,
  formatTime,
  isEntityId,
  isUsable,
  numberAttr,
  relativeTime,
  resolveEntity,
  sliderStill,
  sliderStyleOf,
  stateText,
  strings,
  textAttr,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  clamp,
  clickPress,
  glyph,
  headTap,
  ico,
  icon,
  label,
  preventMenu,
  round,
  startPress,
  type ChipItem,
  type IconRef,
  type RulerChangeDetail,
} from '@fluvy/ui';
import { mediaStyles } from '@fluvy/ui/styles/media';

import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { keyed } from 'lit/directives/keyed.js';

import { Card, ENTITY_BASE, SLIDER_BASE } from '../shared/base.js';
import { HeadFit } from '../energy/head.js';

import {
  actionFields,
  boolField,
  choiceField,
  colourFields,
  editorLanguage,
  entityField,
  fieldRow,
  formLabels,
  nameIconFields,
  onlyWhen,
  selectField,
  sliderFields,
  textField,
} from '../shared/form.js';
import {
  controlsField,
  fitControls,
  hasPower,
  hasVolume,
  isActive,
  isOff,
  isPlaying,
  MEDIA,
  mediaControls,
  mediaPicture,
  playable,
  playPauseAction,
  powerAction,
  trackPosition,
  type MediaControl,
  type PowerAction,
} from '../shared/media.js';
import { mediaHeight } from '../media-family.js';
import { configKeys, type RowStyle } from '../shared/config.js';
import { iconOf } from '../shared/domain.js';
import { chipRow } from '../shared/chips.js';
import { fitLine } from '../shared/fit.js';
import { imageEntity, imageOf, isControl } from '../shared/picture.js';
import { isTemplate, TemplateTexts } from '../shared/templates.js';
import type { EditorDefaults } from '../shared/rows-editor.js';

const s = strings('media');

export type MediaVariant = 'full' | 'mini' | 'hero';

export interface MediaCardConfig extends FluvyCardConfig {
  /** `full` = the player card, `mini` = the 44 row, `hero` = the 200 artwork layout. */
  variant?: MediaVariant;
  /** Sources as chips filling the row (default) or content-sized. */
  source_style?: RowStyle;
  show_source?: boolean;
  show_volume?: boolean;
  /**
   * The power round: the head's trailing round in place of "…" (the dialog stays a tap on the head, the art and the
   * words, or a still press on it, away), the hero's corner, and the mini row when `controls` names it. On by default, for a player
   * that can be switched on or off; it reads "Turn on" on a player that is off, in place of a dead transport.
   */
  show_power?: boolean;
  /**
   * The mini row's rounds in order — `power`, `previous`, `play`, `next`, `volume` — each when the player can
   * take it; as many as the row holds beside the title, the last ones giving way. Default `[play, next]`.
   */
  controls?: readonly MediaControl[];
  /**
   * A picture of the person's own (#99): an address, or an entity whose picture it is (a television's product
   * picture, `image.lounge_tv`), on the plate where the player has no artwork (`image_mode: fallback`, the default), or
   * always (`always`).
   */
  image?: string;
  image_mode?: ImageMode;
  /**
   * The line under the title in place of the player's own, in every variant (#101): words of the person's own, a
   * template (the player is `entity` in it), or an entity said as its state with its unit (a status sensor's "On · TV
   * · Volume 7"). A player out of reach still says why.
   */
  secondary?: string;
}

export type ImageMode = 'fallback' | 'always';

/** The click of a pressed head or row, seen before its own buttons': a hold, or a mouse's drag, never also taps. */
const clickHeld = { handleEvent: clickPress, capture: true };

const VARIANTS: readonly MediaVariant[] = ['full', 'mini', 'hero'];
const SEEK_STEP = 10; // seconds per arrow key
const MAX_SOURCES = 6;
/** The mini row's rounds when none are asked for: what it always drew. */
const MINI_CONTROLS: readonly MediaControl[] = ['play', 'next'];

/* the head's geometry (media.css): the 80 art and its 16, the 48 round and the 16 before it, the speaker line's
   20 glyph and its 6; the mini row's 44 art and 12 gaps on the compact card's 16 padding, and a title's 96 floor */
const ART = 80 + 16;
const ROUND = 48;
const HEAD_GAP = 16;
const SPEAKER_GLYPH = 20 + 6;
const MINI_PADDING = 16;
const MINI_ART = 44 + 12;
const MINI_ROUND = 12 + 44;
const TITLE_FLOOR = 96;

/**
 * A picture URL that is safe inside `url("…")`: a quote, a backslash or a control character (a line break ends a CSS
 * string) can never reach the stylesheet.
 */
const cssUrl = (url: string): string =>
  [...url].filter((char) => char !== '"' && char !== '\\' && !isControl(char)).join('');

/**
 * The media player: artwork, what is playing, the seek bar with its times, the five-round transport
 * and the volume ruler — in three sizes (`full`, `mini`, `hero`).
 *
 * Everything on a `media_player` is optional, so every line degrades: no artwork falls back to the
 * gradient plate, no duration leaves the seek line at rest (its track empty, its times dashes: the player keeps its
 * size whatever plays), no feature bit hides its control, and an idle or unreachable speaker (the dead Cast device
 * every instance has) reads as calm, not broken: out of reach it keeps the whole player, still, in the off skin.
 *
 * The head keeps one trailing round, as every head of the language does: the power round for a player
 * that can be switched on or off (two 48 rounds beside the 80 art would leave a title 104 px at a phone's
 * column), else "…"; the dialog stays a tap on the head (the art and the words) and a still press on it away.
 */
export class FluvyMediaCard extends Card<MediaCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: MediaCardConfig): number {
    return mediaHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    mediaStyles,
    css`
      /* the sheet fixes 360; a dashboard column decides here */
      .md-card,
      .md-mini {
        width: auto;
      }

      /* artwork: the language's plate (.fv-art), the entity picture crossfading over it; the mini's glyph is 20, the
         hero's 32, and an idle hero sits flat like the sheet's empty panel */
      .md-art--s svg {
        width: 20px;
        height: 20px;
      }
      .md-art--l svg {
        width: 32px;
        height: 32px;
      }
      .md-art--l.fv-art--idle {
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
      }
      /* the person's own picture is drawn whole, never cropped; out of reach it greys and fades with the card */
      .fv-art__img--own {
        background-size: contain;
        background-repeat: no-repeat;
      }
      .is-unavailable .fv-art__img--own {
        filter: grayscale(1);
      }
      .is-unavailable .fv-art__img--own.is-on {
        opacity: 0.5;
      }
      /* the art and the words are the player's button (its head's, as headTap draws it): the art gives under the finger and
         rises under a pointer, as a head's circle does, and the words dim; the hero's head is its art and its words */
      .md-hero__head {
        display: block;
      }
      .fv-card__head--tap .fv-art {
        transition: scale var(--fv-fast) var(--fv-ease);
      }
      .fv-card__head--tap :is(.md-now__text, .md-hero__text, .fv-row__text) {
        transition: opacity var(--fv-base) var(--fv-ease);
      }
      .fv-card__head--tap:has(.fv-card__tap:active) .fv-art {
        scale: 0.94;
      }
      .fv-card__head--tap:has(.fv-card__tap:active)
        :is(.md-now__text, .md-hero__text, .fv-row__text) {
        opacity: 0.7;
      }
      @media (hover: hover) {
        .fv-card__head--tap:has(.fv-card__tap:hover:not(:active)) .fv-art {
          scale: 1.06;
        }
      }

      /* fluid text: the source line ellipsizes instead of pushing the card open */
      .md-source__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .md-hero__title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* the hero's words keep the room of their three lines (the track, who made it, the speaker) whatever the player
         says: a track without an artist, a player out of reach (1.9: a card keeps its size) */
      .md-hero__text {
        min-height: calc(28px + 2 * 20px);
      }
      .md-card--hero .md-source {
        justify-content: center;
      }

      /* seek: the fill and the knob move on the compositor, one step a second while playing */
      .md-progress {
        max-width: 100%;
        touch-action: pan-y;
      }
      .md-progress[role='slider'] {
        cursor: pointer;
      }
      .md-progress .fv-knob {
        left: 0;
        top: 0;
      }
      .md-progress__fill {
        width: 100%;
        transform-origin: left center;
      }
      .is-playing .md-progress__fill {
        transition: transform 1s linear;
      }
      .is-playing .md-progress .fv-knob {
        transition: translate 1s linear;
      }
      .is-scrubbing .md-progress__fill,
      .is-scrubbing .md-progress .fv-knob {
        transition: none;
      }

      /* the sheet's 20 px transport gap, kept centred: it closes on a narrow column instead of clipping,
         and a wide column keeps the rhythm instead of flinging the rounds to the edges */
      .md-controls {
        justify-content: center;
      }

      /* the play glyph swaps under the finger */
      .md-swap {
        display: flex;
        animation: md-swap 200ms var(--fv-ease-out) both;
      }
      @keyframes md-swap {
        from {
          opacity: 0;
          transform: scale(0.72);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      .md-volume fluvy-ruler {
        flex: 0 0 auto;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    tick_: { state: true },
    scrub_: { state: true },
  };

  /** Beats the local clock: while playing the position advances once a second without a state change. */
  declare tick_: number;
  /** Fraction under the finger while the seek bar is being dragged. */
  declare scrub_: number | null;

  private timer = 0;
  /** Lays the head's lines out to the room its rounds leave (measured, re-measured when a font lands). */
  private readonly head = new HeadFit(this);
  /** The line of the person's own, where it is a template (`secondary`). */
  private readonly texts = new TemplateTexts(this);
  /** Two stacked artwork layers; the front one holds the current picture so a change crossfades. */
  private readonly layers: [string, string] = ['', ''];
  private front = 0;

  constructor() {
    super();
    this.tick_ = 0;
    this.scrub_ = null;
  }

  static override base = [...ENTITY_BASE, ...SLIDER_BASE];
  static override keys = configKeys<MediaCardConfig>()([
    'variant',
    'source_style',
    'show_source',
    'show_volume',
    'show_power',
    'controls',
    'image',
    'image_mode',
    'secondary',
  ]);
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entityField(['media_player']),
        nameIconFields(),
        textField('secondary'),
        // the person's own picture, and when it shows: where the player has no artwork, or always
        fieldRow(
          textField('image'),
          onlyWhen(
            (data) => Boolean(data['image']),
            choiceField('image_mode', [
              ['fallback', 'media.o_fallback'],
              ['always', 'option.always'],
            ]),
          ),
        ),
        fieldRow(selectField('variant', VARIANTS), selectField('source_style', ['full', 'chips'])),
        fieldRow(boolField('show_source'), boolField('show_volume')),
        boolField('show_power'),
        controlsField(),
        // the volume's style, where the row shows (the mini has none)
        ...sliderFields().map((row) =>
          onlyWhen(({ show_volume, variant }) => show_volume !== false && variant !== 'mini', row),
        ),
        ...colourFields(),
        actionFields(),
      ],
      ...formLabels({ image_mode: 'media.editor_image_mode' }),
      computeHelper: (schema) =>
        schema.name === 'secondary' ? s(editorLanguage(), 'editor_secondary_helper') : undefined,
    };
  }
  /** What the card does for a key left out, shown in the editor: the power round is offered where the player has one. */
  static override defaults: EditorDefaults = (config, hass) => {
    const view = resolveEntity(hass, typeof config['entity'] === 'string' ? config['entity'] : '');
    return {
      variant: 'full',
      source_style: 'full',
      show_source: true,
      show_volume: true,
      show_power: view.stateObj ? hasPower(view) : true,
      controls: [...MINI_CONTROLS],
      image_mode: 'fallback',
    };
  };

  static getStubConfig(_hass: unknown, entities: readonly string[]): MediaCardConfig {
    return {
      type: 'custom:fluvy-media-card',
      entity: entities.find((id) => id.startsWith('media_player.')) ?? '',
    };
  }

  protected override prepare(config: MediaCardConfig): MediaCardConfig {
    if (!config.entity) throw new Error('fluvy-media-card: "entity" is required');
    const variant = config.variant && VARIANTS.includes(config.variant) ? config.variant : 'full';
    return { ...config, variant };
  }

  private get variant(): MediaVariant {
    return this.config?.variant ?? 'full';
  }

  override getCardSize(): number {
    return this.variant === 'mini' ? 2 : this.variant === 'hero' ? 12 : 7;
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: this.variant === 'hero' ? 8 : 6 };
  }

  /**
   * The player, the entity its line of the person's own says (`secondary`), and the one its picture is read from
   * (`image`): its new picture draws the plate again.
   */
  protected override watched(): readonly string[] {
    const line = this.config?.secondary;
    const image = imageEntity(this.config?.image);
    return [...super.watched(), ...(isEntityId(line) ? [line] : []), ...(image ? [image] : [])];
  }

  /* ---------- lifecycle ---------- */

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncTimer();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = 0;
    }
  }

  /** One interval, only while a playing track has a duration to advance along. */
  private syncTimer(): void {
    const view = this.entity();
    // `isConnected`: Home Assistant keeps pushing `hass` at a card it has already removed
    const needed =
      this.isConnected &&
      view.status === 'ok' &&
      this.isPlaying(view) &&
      numberAttr(view, 'media_duration') !== null;
    if (needed && !this.timer)
      this.timer = window.setInterval(() => {
        this.tick_ = Date.now();
      }, 1000);
    else if (!needed) this.stopTimer();
  }

  /* ---------- reading the entity ---------- */

  private isPlaying(view: EntityView): boolean {
    return isPlaying(this.stateOf(view));
  }

  private isActive(view: EntityView): boolean {
    return isActive(this.stateOf(view));
  }

  /** Artist · album, a series title for television, the app as a last resort. */
  private secondary(view: EntityView): string {
    const parts = [
      textAttr(view, 'media_series_title'),
      textAttr(view, 'media_artist'),
      textAttr(view, 'media_album_name'),
    ].filter(Boolean);
    return parts.length ? parts.join(' · ') : textAttr(view, 'app_name');
  }

  /**
   * The line of the person's own (`secondary`), or undefined: their words, what their template renders to (a blank
   * line until Home Assistant answers, nothing for one that fails), or an entity's state with its unit.
   */
  private ownLine(view: EntityView): string | undefined {
    const line = this.config?.secondary;
    // YAML may write a figure where words were meant (`secondary: 7`): they are its words
    if (line === undefined || line === null || line === '') return undefined;
    const text = String(line);
    if (isTemplate(text)) return this.texts.line(text, view.id);
    return isEntityId(text) ? stateText(this.hass, this.entity(text)) : text;
  }

  /**
   * A television that is on and plays nothing Home Assistant can name — a tuner's channel, an app its integration does
   * not report as playing (#101): what it shows, its app or its input, else its name; undefined for any other player.
   */
  private watching(view: EntityView, name: string): string | undefined {
    if (view.deviceClass !== 'tv' || isOff(view.state) || view.state === 'idle') return undefined;
    return textAttr(view, 'app_name') || textAttr(view, 'source') || name;
  }

  /**
   * The speaker line under the track: the device, plus its input when one is selected and the lines above do not say
   * it already.
   */
  private sourceLine(view: EntityView, name: string, said: string): string {
    const source = textAttr(view, 'source');
    return source && source !== name && !said.split(' · ').includes(source)
      ? `${name} · ${source}`
      : name;
  }

  /**
   * The line of a player that plays nothing. One at rest (idle, in standby, off) says when it last played; one that is
   * on says what it shows, its input or its app ("On · HDMI 1": a television watched, #101), else its state alone —
   * never what its title says already (`said`: a television's app).
   */
  private idleLine(view: EntityView, said = ''): string {
    const text = stateText(this.hass, view);
    const resting = isOff(view.state) || view.state === 'idle';
    if (!resting) {
      const shows = [textAttr(view, 'source'), textAttr(view, 'app_name')].find(
        (shown) => shown && shown !== said,
      );
      return shows ? `${text} · ${shows}` : text;
    }
    const when = view.stateObj?.last_changed;
    if (!when) return text;
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) return text;
    return `${text} · ${s(this.hass, 'last_played', { time: relativeTime(this.hass, date) })}`;
  }

  private unavailableLine(view: EntityView): string {
    const text = stateText(this.hass, view);
    const when = view.stateObj?.last_changed;
    if (!when) return text;
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) return text;
    const sameDay = date.toDateString() === new Date().toDateString();
    return `${text} · ${sameDay ? s(this.hass, 'since', { time: formatTime(this.hass, date) }) : relativeTime(this.hass, date)}`;
  }

  /* ---------- commands ---------- */

  private playPause(view: EntityView): void {
    const { service, expect } = playPauseAction(view, this.stateOf(view));
    this.expect(view.id, expect);
    this.call('media_player', service);
  }

  private seek(seconds: number): void {
    this.call('media_player', 'media_seek', { seek_position: Math.round(seconds) });
  }

  /**
   * What the power round does now, or null: asked away, or a player that can be neither switched on nor off. A player
   * gone from the house keeps the round its config offers, still: its features are not known (1.9).
   */
  private power(view: EntityView): PowerAction | null {
    if (this.config?.show_power === false) return null;
    if (view.status === 'missing') return { service: 'turn_off', expect: 'off' };
    return powerAction(view, this.stateOf(view));
  }

  /* ---------- pieces ---------- */

  /**
   * The picture on the plate: the person's own (`image`) where the player has no artwork, or always where asked
   * (`image_mode: always`), else the artwork. A player out of reach has none of its own and keeps the person's, greyed
   * with the card. `own`: the person's picture is the one shown.
   */
  private picture(
    view: EntityView,
    away: boolean,
  ): { readonly url: string; readonly own: boolean } {
    const own = imageOf(this.hass, this.config?.image);
    const artwork = away ? '' : mediaPicture(this.hass, view);
    return own && (this.config?.image_mode === 'always' || !artwork)
      ? { url: own, own: true }
      : { url: artwork, own: false };
  }

  /**
   * The gradient plate with the picture over it; a picture change crossfades the two layers. The person's own picture
   * is drawn whole (a product picture is never cropped).
   */
  private art(size: number, picture: string, extra = '', ref: IconRef = 'speaker'): TemplateResult {
    if (this.layers[this.front] !== picture) {
      this.front = this.front === 0 ? 1 : 0;
      this.layers[this.front] = picture;
    }
    const own = imageOf(this.hass, this.config?.image);
    return html`<span
      class="fv-art ${extra}"
      data-measure="skip"
      style="width:${size}px;height:${size}px"
    >
      ${this.layers.map(
        (url, index) =>
          html`<span
            class="fv-art__img ${url && index === this.front ? 'is-on' : ''} ${url && url === own ? 'fv-art__img--own' : ''}"
            style=${url ? `background-image:url("${cssUrl(url)}")` : nothing}
          ></span>`,
      )}
      ${picture ? nothing : icon(ref)}
    </span>`;
  }

  private transportRound(
    ref: IconRef,
    on: boolean,
    text: string,
    onClick: () => void,
    still = false,
  ): TemplateResult {
    return html`<button
      class="fv-round ${on ? 'is-on' : 'fv-round--quiet'}"
      data-control
      data-target
      aria-label=${text}
      title=${text}
      aria-pressed=${on ? 'true' : 'false'}
      ?disabled=${still}
      @click=${onClick}
    >
      ${icon(ref)}
    </button>`;
  }

  private playRound(view: EntityView, still = false): TemplateResult {
    const playing = this.isPlaying(view);
    const active = this.isActive(view);
    const name = playing ? 'pause' : 'play';
    const text = playing ? this.t('media.pause') : this.t('media.play');
    return html`<button
      class="fv-round ${active ? 'fv-round--accent' : 'fv-round--quiet'}"
      data-control
      data-target
      aria-label=${text}
      title=${text}
      ?disabled=${still}
      @click=${() => this.playPause(view)}
    >
      ${keyed(name, html`<span class="md-swap">${glyph(name)}</span>`)}
    </button>`;
  }

  /** Switches the player off, or — the one clear thing to do with a player that is off — on, in the primary fill. */
  private powerRound(view: EntityView, action: PowerAction, extra = ''): TemplateResult {
    const on = action.service === 'turn_on';
    return round(
      'power',
      on ? 'accent' : 'quiet',
      s(this.hass, on ? 'power_on' : 'power_off'),
      () => {
        this.expect(view.id, action.expect);
        this.call('media_player', action.service);
      },
      !isUsable(view),
      extra,
    );
  }

  /** Mutes and unmutes a player that can be muted; else the round opens its dialog, where the volume is. */
  private volumeRound(view: EntityView): TemplateResult {
    const muted = view.attr<boolean>('is_volume_muted') === true;
    const still = !isUsable(view);
    if (!view.supports(MEDIA.VOLUME_MUTE))
      return round(
        'volume',
        'quiet',
        this.t('media.volume'),
        () => this.tap(view.id, { action: 'more-info' }),
        still,
      );
    return round(
      muted ? 'volumeOff' : 'volume',
      'quiet',
      muted ? s(this.hass, 'unmute') : this.t('media.mute'),
      () => this.call('media_player', 'volume_mute', { is_volume_muted: !muted }),
      still,
    );
  }

  private repeatRound(view: EntityView, still = false): TemplateResult {
    const mode = textAttr(view, 'repeat') || 'off';
    const next = mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off';
    const text = s(
      this.hass,
      mode === 'one' ? 'repeat_single' : mode === 'all' ? 'repeat_all' : 'repeat_off',
    );
    return this.transportRound(
      mode === 'one' ? 'repeatOne' : 'repeat',
      mode !== 'off',
      text,
      () => this.call('media_player', 'repeat_set', { repeat: next }),
      still,
    );
  }

  /**
   * The transport: five equal rounds 20 apart on the sheet. A column that cannot hold them 8 apart loses the ends
   * (shuffle and repeat: the modes, which more-info still offers) before the three that move the track; one that
   * cannot hold even those steps the rounds down to 44. A player that is off has no transport while the head's
   * power round (`powered`) is there to switch it on: that round is the one clear thing to do. A player out of reach
   * keeps every round its features offer (all five for one gone from the house, whose features are not known), still.
   */
  private renderTransport(
    view: EntityView,
    big: boolean,
    powered: boolean,
  ): TemplateResult | typeof nothing {
    const still = !isUsable(view);
    const gone = view.status === 'missing';
    const offers = (bit: number): boolean => gone || view.supports(bit);
    const active = still || this.isActive(view);
    const canPlay = still
      ? gone || playable(view)
      : playable(view) && !(powered && isOff(this.stateOf(view)));
    const items: { readonly round: TemplateResult; readonly mode?: boolean }[] = [];
    if (active && offers(MEDIA.SHUFFLE)) {
      const on = view.attr<boolean>('shuffle') === true;
      items.push({
        round: this.transportRound(
          'shuffle',
          on,
          this.t('media.shuffle'),
          () => this.call('media_player', 'shuffle_set', { shuffle: !on }),
          still,
        ),
        mode: true,
      });
    }
    if (active && offers(MEDIA.PREVIOUS)) {
      items.push({
        round: round(
          'prev',
          'quiet',
          this.t('media.previous'),
          () => this.call('media_player', 'media_previous_track'),
          still,
        ),
      });
    }
    if (canPlay) items.push({ round: this.playRound(view, still) });
    if (active && offers(MEDIA.NEXT)) {
      items.push({
        round: round(
          'next',
          'quiet',
          this.t('media.next'),
          () => this.call('media_player', 'media_next_track'),
          still,
        ),
      });
    }
    if (active && offers(MEDIA.REPEAT))
      items.push({ round: this.repeatRound(view, still), mode: true });
    if (!items.length) return nothing;
    const width = this.contentWidth;
    const needs = (count: number, size: number): number => count * size + (count - 1) * 8;
    let size = big ? 56 : 48;
    const shown = needs(items.length, size) <= width ? items : items.filter((item) => !item.mode);
    if (needs(shown.length, size) > width) size = 44;
    const gap =
      shown.length > 1
        ? `min(20px, calc((100% - ${shown.length * size}px) / ${shown.length - 1}))`
        : '0px';
    return html`<div
      class="md-controls ${size === 48 ? '' : `md-controls--${size}`}"
      style="gap:${gap}"
    >
      ${shown.map((item) => item.round)}
    </div>`;
  }

  /**
   * The seek line with nothing to seek (nothing playing, a stream without a length, a player out of reach): its empty
   * track and its times as dashes, so the player keeps its size whatever it plays (1.9).
   */
  private restingSeek(big: boolean): TemplateResult {
    return html`<div class="md-seek ${big ? 'md-seek--sheet' : ''}" aria-hidden="true">
      <div class="md-progress" style="width:${this.contentWidth}px"></div>
      <div class="md-times"><span>—</span><span>—</span></div>
    </div>`;
  }

  private renderSeek(view: EntityView, big: boolean): TemplateResult {
    const duration = numberAttr(view, 'media_duration');
    const position = trackPosition(view, duration);
    if (duration === null || position === null) return this.restingSeek(big);
    const width = this.contentWidth;
    const fraction = this.scrub_ ?? position / duration;
    const shown = this.scrub_ === null ? position : this.scrub_ * duration;
    const seekable = view.supports(MEDIA.SEEK);
    const moving = this.isPlaying(view) && this.scrub_ === null;
    // the knob keeps a 4 px optical overhang at the ends, never half outside the column (as fluvy-ruler does)
    const x = clamp(fraction * width - 14, -4, width - 24);
    const text = `${this.nameFor(view, this.config?.name)} · ${s(this.hass, 'position')}`;
    return html`<div class="md-seek ${big ? 'md-seek--sheet' : ''}">
      <div
        class="md-progress"
        data-control
        data-target
        style="width:${width}px"
        role=${seekable ? 'slider' : nothing}
        tabindex=${seekable ? 0 : nothing}
        aria-label=${seekable ? text : nothing}
        aria-valuemin=${seekable ? 0 : nothing}
        aria-valuemax=${seekable ? Math.round(duration) : nothing}
        aria-valuenow=${seekable ? Math.round(shown) : nothing}
        aria-valuetext=${seekable ? formatDuration(shown) : nothing}
        @pointerdown=${this.onSeekDown}
        @pointermove=${this.onSeekMove}
        @pointerup=${this.onSeekUp}
        @pointercancel=${this.onSeekCancel}
        @keydown=${this.onSeekKey}
      >
        <span
          class="md-progress__fill"
          data-measure="value"
          style="transform:scaleX(${fraction.toFixed(5)})"
        ></span>
        <span
          class="fv-knob fv-knob--accent"
          data-measure="value"
          style="width:28px;height:28px;translate:${moving ? x.toFixed(2) : Math.round(x)}px 8px"
        ></span>
      </div>
      <div class="md-times">
        <span>${formatDuration(shown)}</span><span>${formatDuration(duration)}</span>
      </div>
    </div>`;
  }

  private renderVolume(view: EntityView): TemplateResult | typeof nothing {
    if (this.config?.show_volume === false) return nothing;
    // a player out of reach keeps its volume where its features say it has one (and where they are not known), still
    const still = !isUsable(view);
    const gone = view.status === 'missing';
    const canSet = gone || view.supports(MEDIA.VOLUME_SET);
    const canMute = gone || view.supports(MEDIA.VOLUME_MUTE);
    if (!canSet && !canMute) return nothing;
    const muted = view.attr<boolean>('is_volume_muted') === true;
    const level = numberAttr(view, 'volume_level');
    const value = level === null ? 0 : Math.round(clamp(level, 0, 1) * 100);
    const name = this.nameFor(view, this.config?.name);
    const length = this.contentWidth - (canMute ? 64 : 0);
    return html`${label(this.t('media.volume'))}
      <div class="md-volume">
        ${
          canSet
            ? html`<fluvy-ruler
                .value=${value}
                .min=${0}
                .max=${100}
                .step=${1}
                .length=${length}
                .tone=${muted || still ? 'neutral' : 'accent'}
                ?inactive=${still}
                ?inert=${still}
                .look=${sliderStyleOf(this.config)}
                ?still=${sliderStill()}
                unit="%"
                .label=${`${name} · ${this.t('media.volume')}`}
                .format=${(v: number) => formatNumber(this.hass, v, { digits: 0 })}
                @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.call('media_player', 'volume_set', { volume_level: event.detail.value / 100 })}
              ></fluvy-ruler>`
            : nothing
        }
        ${canMute ? this.volumeRound(view) : nothing}
      </div>`;
  }

  private renderSources(view: EntityView): TemplateResult | typeof nothing {
    if (this.config?.show_source === false) return nothing;
    const list = view.attr<readonly string[]>('source_list');
    if (!Array.isArray(list) || !list.length || !view.supports(MEDIA.SELECT_SOURCE)) return nothing;
    const current = textAttr(view, 'source');
    const names = list.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    const shown = names.slice(0, MAX_SOURCES);
    if (current && !shown.includes(current)) {
      shown.pop();
      shown.unshift(current);
    }
    if (!shown.length) return nothing;
    const items: ChipItem[] = shown.map((source) => ({
      key: source,
      label: source,
      active: source === current,
    }));
    // measured, so a source's name is never cut in a narrow column ("Netflix" in a third of 171): two a row instead
    const fit = { ruler: this.head.ruler, width: this.contentWidth };
    return html`${label(this.t('media.source'))}${chipRow(items, (key) => this.call('media_player', 'select_source', { source: key }), this.config?.source_style, fit)}`;
  }

  /* ---------- seek gestures ---------- */

  private fractionAt(event: PointerEvent): number {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return clamp((event.clientX - box.left) / Math.max(1, box.width), 0, 1);
  }

  private readonly onSeekDown = (event: PointerEvent): void => {
    if (!this.entity().supports(MEDIA.SEEK)) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      /* the pointer is already gone */
    }
    this.scrub_ = this.fractionAt(event);
  };

  private readonly onSeekMove = (event: PointerEvent): void => {
    if (this.scrub_ === null) return;
    this.scrub_ = this.fractionAt(event);
  };

  private readonly onSeekUp = (event: PointerEvent): void => {
    if (this.scrub_ === null) return;
    const fraction = this.fractionAt(event);
    this.scrub_ = null;
    const duration = numberAttr(this.entity(), 'media_duration');
    if (duration !== null) this.seek(fraction * duration);
  };

  private readonly onSeekCancel = (): void => {
    this.scrub_ = null;
  };

  private readonly onSeekKey = (event: KeyboardEvent): void => {
    const view = this.entity();
    if (!view.supports(MEDIA.SEEK)) return;
    const duration = numberAttr(view, 'media_duration');
    if (duration === null) return;
    const position = trackPosition(view, duration) ?? 0;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = position + SEEK_STEP;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = position - SEEK_STEP;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = duration;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.seek(clamp(next, 0, duration));
  };

  /* ---------- variants ---------- */

  private renderPlayer(view: EntityView, name: string, hero: boolean): TemplateResult {
    // a player out of reach (unavailable, or gone from the house) is the whole player at rest in the off skin: its name
    // and why over the plate, the seek line, the rounds and the volume still — only the colours change (1.9)
    const away = !isUsable(view);
    const active = !away && this.isActive(view);
    const { url: picture, own } = this.picture(view, away);
    // the plate's gradient stands in for artwork: under the person's own picture, or with nothing playing, it is at rest
    const idle = own || (!active && !picture) ? 'fv-art--idle' : '';
    // a television watched is titled by what it shows, never "Nothing playing" (#101)
    const title = active
      ? textAttr(view, 'media_title') || textAttr(view, 'app_name') || name
      : away
        ? name
        : (this.watching(view, name) ?? this.t('media.nothing'));
    // the person's own line in place of the player's, but for why a player out of reach is so
    const ownWords = away ? undefined : this.ownLine(view);
    let second =
      ownWords ??
      (active
        ? this.secondary(view)
        : away
          ? this.unavailableLine(view)
          : this.idleLine(view, title));
    if (ownWords === undefined && active && (second === title || !second))
      second = stateText(this.hass, view);
    const speaker = this.sourceLine(view, name, `${title} · ${second}`);
    const saysSpeaker = speaker !== title;
    const plate = away && !this.looksQuiet ? 'ban' : 'speaker';
    const classes = `fv-card md-card ${hero ? 'md-card--hero' : ''} ${away ? 'is-off is-unavailable' : ''} ${this.isPlaying(view) ? 'is-playing' : ''} ${this.scrub_ === null ? '' : 'is-scrubbing'}`;
    const wide = this.contentWidth >= 312;
    const power = this.power(view);
    const body = html` ${this.renderSeek(view, hero)}
    ${this.renderTransport(view, hero && wide, power !== null)} ${this.renderVolume(view)}
    ${this.renderSources(view)}`;

    // the artwork and the words under or beside it are the player's head, and its button: a tap is the tap action, a
    // still press the hold action; the rounds keep their own
    const { onTap, onHold } = this.headActions(view.id);
    const pressed = onTap ?? onHold;
    const heads = `${onTap ? 'fv-card__head--tap' : ''} ${onHold ? 'fv-card__head--hold' : ''}`;
    const named = (text: string, cls: string): TemplateResult => {
      const words = onTap ? headTap(text, { onTap, onHold, label: name, name: true }) : text;
      return html`<h3 class=${cls} data-name>${words}</h3>`;
    };
    if (hero) {
      // the corner round keeps 12 px clear of the art, which gives up that room on both sides (it stays centred)
      const clear = power ? 2 * (ROUND + 12) : 0;
      const size = Math.min(200, Math.floor((this.contentWidth - clear) / 4) * 4);
      return html`<article class=${classes} data-card>
        <div
          class="md-hero__head ${heads}"
          .fvHold=${onHold}
          @pointerdown=${pressed ? startPress : nothing}
          @contextmenu=${onHold ? preventMenu : nothing}
          @click=${pressed ? clickHeld : nothing}
        >
          <div class="md-hero">
            ${this.art(size, picture, `md-art--l ${idle}`, plate)}
            ${power ? this.powerRound(view, power, 'md-hero__power') : nothing}
          </div>
          <div class="md-hero__text" data-align="center">
            ${named(title, 'md-hero__title')}
            ${second ? html`<p class="fv-card__sub" data-name=${ownWords === undefined ? nothing : ''}>${second}</p>` : nothing}
            ${saysSpeaker ? html`<p class="fv-card__sub md-source">${glyph('speaker')}<span class="md-source__text">${speaker}</span></p>` : nothing}
          </div>
        </div>
        ${body}
      </article>`;
    }

    // the title is a name and may end in an ellipsis; the lines under it lose their trailing segments instead. A column
    // that would leave the words less than a name's start beside the 80 art and the round lets the art go (the head's
    // own rule: the words and the art are one button, so its tap stays), and the head keeps its 80
    const keepsArt = this.contentWidth - ART - HEAD_GAP - ROUND >= TITLE_FLOOR;
    const room = this.contentWidth - (keepsArt ? ART : 0) - HEAD_GAP - ROUND;
    // why a player is out of reach is said whole: "Not found" where "Entity not found" would not hold
    const sub =
      view.status === 'missing'
        ? fitLine(
            second
              .split(' · ')
              .map((text, index) =>
                index ? { text, optional: true } : { text, short: this.t('state.not_found') },
              ),
            room,
            (text) => this.head.ruler.width('fv-card__sub', text),
          )
        : this.head.fitSub(second, room);
    const source = this.head.fitSub(speaker, room - SPEAKER_GLYPH);
    return html`<article class=${classes} data-card>
      <div
        class="md-now ${heads}"
        .fvHold=${onHold}
        @pointerdown=${pressed ? startPress : nothing}
        @contextmenu=${onHold ? preventMenu : nothing}
        @click=${pressed ? clickHeld : nothing}
      >
        ${keepsArt ? this.art(80, picture, idle, plate) : nothing}
        <div class="md-now__text">
          ${named(title, 'fv-card__title md-title')}
          ${sub ? html`<p class="fv-card__sub" data-name=${ownWords === undefined ? nothing : ''}>${sub}</p>` : nothing}
          ${saysSpeaker ? html`<p class="fv-card__sub md-source">${glyph('speaker')}<span class="md-source__text">${source}</span></p>` : nothing}
        </div>
        ${
          power
            ? this.powerRound(view, power)
            : round(
                'dots',
                'quiet',
                this.t('common.more'),
                () => this.tap(view.id, { action: 'more-info' }),
                away,
              )
        }
      </div>
      ${body}
    </article>`;
  }

  /**
   * The mini row's rounds: the controls asked for that this player can take now, in their order — as many as the
   * row holds beside a title of 96 (a name's floor), the rest giving way in an order of need (`fitControls`). A
   * power round makes the player's off state its own: the play round then waits for it to be on. A column that
   * cannot hold even one round beside the art lets the art go first (the compact tile's rule) and keeps the one
   * round that matters most: the row is there to control the player.
   */
  private miniRounds(
    view: EntityView,
    inner: number,
  ): { readonly art: boolean; readonly rounds: TemplateResult[] } {
    const state = this.stateOf(view);
    // out of reach, the rounds its features offer (those asked for, where they are not known) stay, still
    const still = !isUsable(view);
    const gone = view.status === 'missing';
    const offers = (bit: number): boolean => gone || view.supports(bit);
    const active = still || isActive(state);
    const power = this.power(view);
    const offered = mediaControls(this.config?.controls, MINI_CONTROLS).filter((control) => {
      switch (control) {
        case 'power':
          return power !== null;
        case 'previous':
          return active && offers(MEDIA.PREVIOUS);
        case 'play':
          return still ? gone || playable(view) : playable(view) && !(power && isOff(state));
        case 'next':
          return active && offers(MEDIA.NEXT);
        case 'volume':
          return this.config?.show_volume !== false && (gone || hasVolume(view));
      }
    });
    const beside = Math.max(0, Math.floor((inner - MINI_ART - TITLE_FLOOR) / MINI_ROUND));
    const art = beside > 0 || !offered.length;
    const rounds = fitControls(offered, art ? beside : 1).map((control) => {
      switch (control) {
        case 'power':
          return this.powerRound(view, power as PowerAction);
        case 'previous':
          return round(
            'prev',
            'quiet',
            this.t('media.previous'),
            () => this.call('media_player', 'media_previous_track'),
            still,
          );
        case 'play':
          return this.playRound(view, still);
        case 'next':
          return round(
            'next',
            'quiet',
            this.t('media.next'),
            () => this.call('media_player', 'media_next_track'),
            still,
          );
        case 'volume':
          return this.volumeRound(view);
      }
    });
    return { art, rounds };
  }

  /**
   * The compact row. Out of reach (unavailable, or gone from the house) it is the calm dashed row every instance needs
   * for its dead Cast devices — the ban circle, the name and why, its rounds still — at the row's own size (1.9).
   */
  private renderMini(view: EntityView, name: string): TemplateResult {
    const away = !isUsable(view);
    const active = !away && this.isActive(view);
    const { url: picture, own } = this.picture(view, away);
    const duration = numberAttr(view, 'media_duration');
    const position = trackPosition(view, duration);
    const title = active
      ? textAttr(view, 'media_title') || textAttr(view, 'app_name') || name
      : name;
    const inner = this.width - 2 * MINI_PADDING;
    const { art, rounds } = this.miniRounds(view, inner);
    // the line under the title keeps its first segment (the speaker's name, or the state) and loses the rest —
    // the position, a value, never ends in an ellipsis; the figures are measured by their shape ("0:00"), as they
    // are tabular, so a position ticking once a second never fills the ruler's memory
    const ownWords = away ? undefined : this.ownLine(view);
    const line =
      ownWords !== undefined
        ? ownWords.split(' · ')
        : active
          ? [name, position === null ? this.secondary(view) : formatDuration(position)].filter(
              Boolean,
            )
          : (away ? this.unavailableLine(view) : this.idleLine(view)).split(' · ');
    const sub = fitLine(
      line.map((text, index) => ({ text, optional: index > 0 })),
      inner - (art ? MINI_ART : 0) - rounds.length * MINI_ROUND,
      (text) => this.head.ruler.width('fv-row__sub', text.replace(/\d/g, '0')),
    );
    // the art (where the row keeps it) and the words are the row's button, whichever is drawn; the rounds keep their own
    const { onTap, onHold } = this.headActions(view.id);
    const pressed = onTap ?? onHold;
    return html`<article
      class="fv-card md-mini__card ${away ? 'is-off is-unavailable' : ''} ${this.isPlaying(view) ? 'is-playing' : ''}"
      data-card
    >
      <div
        class="md-mini__row ${onTap ? 'fv-card__head--tap' : ''} ${onHold ? 'fv-card__head--hold' : ''}"
        .fvHold=${onHold}
        @pointerdown=${pressed ? startPress : nothing}
        @contextmenu=${onHold ? preventMenu : nothing}
        @click=${pressed ? clickHeld : nothing}
      >
        ${
          !art
            ? nothing
            : away && !own && !this.looksQuiet
              ? ico('ban', 'off')
              : picture
                ? this.art(44, picture, `md-art--s ${own ? 'fv-art--idle' : ''}`)
                : ico(iconOf(view, this.config?.icon), active ? 'media' : 'neutral')
        }
        <div class="fv-row__text">
          <span class="fv-row__title" data-name
            >${onTap ? headTap(title, { onTap, onHold, label: name, name: true }) : title}</span
          ><span class="fv-row__sub" data-name>${sub}</span>
        </div>
        ${rounds}
      </div>
    </article>`;
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.nameFor(view, this.config?.name);
    const variant = this.variant;
    if (variant === 'mini') return this.renderMini(view, name);
    return this.renderPlayer(view, name, variant === 'hero');
  }
}
