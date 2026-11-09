import {
  formatNumber,
  formatTime,
  navigate,
  stateText,
  strings,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';
import {
  batteryLevel,
  clickPress,
  head,
  preventMenu,
  round,
  sheetStyles,
  startPress,
} from '@fluvy/ui';
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { agoShort } from '../helpers/datetime.js';
import { HeadFit } from '../energy/head.js';
import { mapHead, mapRow } from '../shared/map-head.js';
import { Card, type CardEditor } from '../shared/base.js';
import { ITEM_ALIASES, type AliasSpec } from '../shared/config.js';
import { changedAt, sinceIds } from '../shared/since.js';
import { renderAvatar, unplaced, type Presence } from '../shared/avatar.js';
import { charging, personBattery, type BatterySource } from '../shared/battery.js';
import { EMPTY, entryCount, HEAD, rowsOf, ROW } from '../shared/heights.js';
import { emptyPanel, itemsOf, listOf, type EmptyList } from '../shared/lists.js';

const s = strings('people');
const DASH = '—';

export type PeopleLayout = 'grid' | 'rows';

/** A person on the card: their entity, and the name, phone battery, colour and actions they are shown with. */
export interface PersonItem {
  readonly entity: string;
  readonly name?: EntityName;
  /** The battery sensor of their phone (shown whatever `show_battery` says); else found from their tracker. */
  readonly battery?: string;
  readonly color?: string;
  /** Where their last change is read from (#67): a timestamp sensor, or `attribute:<name>` of their own; else Home Assistant's. */
  readonly since?: string;
  /** What a tap on them does (default: their details); a page of their own is `navigate`. */
  readonly tap_action?: ActionConfig;
  readonly hold_action?: ActionConfig;
}

export interface PeopleCardConfig extends FluvyCardConfig, EmptyList {
  title?: string;
  /** The people, in order: ids, or entries with their own name, battery, colour and actions (`entities` reads too). */
  people?: ReadonlyArray<string | PersonItem>;
  /** Everyone's phone battery: the sensor an entry names, else the one on the device of the tracker they are seen by. */
  show_battery?: boolean;
  /** `grid` = the sheet's avatar columns; `rows` = the desktop composition's 60 rows (avatar, name, time or zone, state at the right). */
  variant?: PeopleLayout;
  /** Where the map round button goes (default `/map`). */
  map_path?: string;
  /** Under a name: the zone someone is in (default), and the time they arrived (when there is no zone, or the zone is off). */
  show_zone?: boolean;
  show_time?: boolean;
  /** Test hook: an ISO date that freezes "now" (the times in the sub lines). Undocumented. */
  _now?: string;
}

interface Person {
  readonly item: PersonItem;
  readonly view: EntityView;
  /** The name shown: the entry's, else the person's own. */
  readonly name: string;
  /** Their phone's charge, 0–100; null when it cannot be read; undefined when none is shown. */
  readonly battery: number | null | undefined;
  /** The phone is on its charger. */
  readonly charging: boolean;
  readonly presence: Presence;
  /** "Home", "Away", or the honest "Unavailable" / "Unknown" the entity is reporting. */
  readonly word: string;
  /** The zone the person is in when it is not home, else ''. */
  readonly zone: string;
  /** When the state last changed: the clock time today, a short relative time before that. */
  readonly since: string;
  readonly picture: string;
}

const MORE_INFO: ActionConfig = { action: 'more-info' };

/** Two moments on the same calendar day (a change today reads as its time, before that as how long ago). */
const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Who is home: the count in the head, a round button to the map, and one 44 avatar per person —
 * the picture Home Assistant has, else initials on the accent fill — with the name and where they
 * are. Home keeps the full avatar and lights the presence dot; away dims it. Coordinates are never
 * shown: where a person is, is a zone name or nothing.
 */
export class FluvyPeopleCard extends Card<PeopleCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: PeopleCardConfig): number {
    const n = entryCount(config, ['people', 'entities']);
    if (!n) return HEAD + EMPTY;
    const list = (config['people'] ?? config.entities ?? []) as ReadonlyArray<string | PersonItem>;
    // a battery line under a person in the grid (20 + 4); the rows say it in their sub
    const battery =
      config.show_battery === true ||
      list.some((entry) => typeof entry !== 'string' && entry.battery);
    // the rows sit 16 under the head as every list's do (HEAD); the grid's columns 4 closer
    return config.variant === 'rows' ? HEAD + ROW * n : 84 + (battery ? 128 : 104) * rowsOf(n, 3);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.ambient,
    css`
      /* the lab fixes the sheet at 360; a dashboard column decides here */
      .am-card {
        width: 100%;
      }
      .am-people {
        grid-template-columns: repeat(var(--am-people, 3), minmax(0, 1fr));
      }
      .am-person {
        width: 100%;
        min-width: 0;
        cursor: pointer;
      }
      .am-person__name,
      .am-person__state {
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .am-person__name {
        transition: color var(--fv-base) var(--fv-ease);
      }
      /* a phone's charge (the shared battery part) under the state line, or before the detail in a row */
      .am-person .fv-battery {
        margin-top: 4px;
      }
      .fv-row__sub .fv-battery {
        height: 16px;
        font-size: inherit;
        line-height: inherit;
        vertical-align: top;
      }
      .fv-row__sub .fv-battery svg {
        flex-basis: 16px;
        width: 16px;
        height: 16px;
      }
      /* a person's own colour: a ring round their avatar (a picture would hide any fill), 2 apart on the card */
      [data-accent] > .am-avatar {
        box-shadow:
          0 0 0 2px var(--fluvy-card),
          0 0 0 4px var(--fluvy-accent);
      }
      @media (hover: hover) {
        .am-person:hover .am-person__name {
          color: var(--fluvy-accent);
        }
      }
    `,
  ];

  static override properties = { ...Card.properties, broken_: { state: true } };

  /** Pictures that failed to load: those people fall back to initials instead of a broken image. */
  declare broken_: ReadonlySet<string>;

  constructor() {
    super();
    this.broken_ = new Set();
  }

  static override editor(): Promise<CardEditor> {
    return import('./people-editor.js');
  }
  static override aliases: AliasSpec = {
    keys: [{ from: 'layout', to: 'variant' }],
    items: { people: ITEM_ALIASES },
  };

  static getStubConfig(_hass: unknown, entities: readonly string[]): PeopleCardConfig {
    return {
      type: 'custom:fluvy-people-card',
      entities: entities.filter((id) => id.startsWith('person.')).slice(0, 3),
    };
  }

  protected override prepare(config: PeopleCardConfig): PeopleCardConfig {
    listOf(config, 'people', ['entities']);
    return config;
  }

  /** The people as entries (a bare id is an entry with nothing of its own), in their order. */
  private items(): PersonItem[] {
    return itemsOf(this.config?.people ?? this.config?.entities);
  }

  /** The head's fitting (what gives way, in its order), as every card's head. */
  private readonly headFit = new HeadFit(this);

  /** Where a person's charge is read: their entry's sensor, else (when everyone's is shown) their phone's, found. */
  private batteryOf(item: PersonItem): BatterySource | undefined {
    if (item.battery) return { entity: item.battery };
    return this.config?.show_battery === true ? personBattery(this.hass, item.entity) : undefined;
  }

  /** Watched: the people and the batteries shown beside them. */
  /** The people, their phones' batteries, and what their last change is read from (`since`). */
  protected override watched(): readonly string[] {
    const items = this.items();
    return [
      ...items.flatMap((item) => {
        const battery = this.batteryOf(item);
        return battery ? [item.entity, battery.entity] : [item.entity];
      }),
      ...sinceIds(items),
    ];
  }

  override getCardSize(): number {
    const count = this.items().length || 1;
    return this.config?.variant === 'rows' ? 2 + count : 2 + 2 * Math.ceil(count / 3);
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  private person(item: PersonItem, now: Date): Person {
    const view = this.entity(item.entity);
    const usable = view.status === 'ok';
    const source = this.batteryOf(item);
    const charge = source ? this.entity(source.entity) : undefined;
    const level =
      charge === undefined || charge.status !== 'ok'
        ? null
        : source?.attribute
          ? charge.attr<number | null>(source.attribute)
          : charge.number;
    const presence: Presence = !usable ? unplaced(view) : view.state === 'home' ? 'home' : 'away';
    const changed = changedAt(this.hass, view, item.since);
    // out of reach the dashed ring, or quiet (`unavailable`) their face as it rests; unknown, the ring either way
    const picture =
      usable || (presence === 'off' && this.looksQuiet)
        ? (view.attr<string | null>('entity_picture') ?? '')
        : '';
    return {
      item,
      view,
      name: this.nameFor(view, item.name),
      battery:
        source === undefined
          ? undefined
          : typeof level === 'number' && Number.isFinite(level)
            ? Math.min(100, Math.max(0, level))
            : null,
      charging: source !== undefined && charging(this.hass, source),
      presence,
      word: !usable
        ? stateText(this.hass, view)
        : this.t(presence === 'home' ? 'person.home' : 'person.away'),
      // a person in a zone reports the zone's own name as its state
      zone: presence === 'away' && view.state !== 'not_home' ? view.state : '',
      since:
        !usable || !changed || Number.isNaN(changed.getTime())
          ? ''
          : sameDay(changed, now)
            ? formatTime(this.hass, changed)
            : agoShort(this.hass, changed, now),
      picture: picture && this.hass ? this.hass.hassUrl(picture) : '',
    };
  }

  private renderAvatar(person: Person): TemplateResult {
    const { name, presence, picture } = person;
    return renderAvatar({
      name,
      picture,
      presence,
      broken: this.broken_,
      onBroken: (failed) => {
        this.broken_ = new Set([...this.broken_, failed]);
      },
    });
  }

  /** Under a name: the zone, when shown and there is one; else the time, when shown. */
  private detail(person: Person): string {
    const zone = this.config?.show_zone === false ? '' : person.zone;
    return zone || (this.config?.show_time === false ? '' : person.since);
  }

  /** A person's battery as a figure ("78 %"), "—" when the phone says nothing. */
  private batteryFigure(person: Person): string {
    const level = person.battery;
    return level === null || level === undefined
      ? DASH
      : `${formatNumber(this.hass, level, { digits: 0 })} %`;
  }

  /** A phone's charge: the shared battery part, its figure in the house's numbers. */
  private renderBattery(person: Person): TemplateResult | typeof nothing {
    const level = person.battery;
    if (level === undefined) return nothing;
    return batteryLevel(level, this.batteryFigure(person), person.charging);
  }

  /** What a tap and a hold on a person do: their entry's actions, else their details. */
  private actionsOf(person: Person): { tap: () => void; hold: () => void } {
    return {
      tap: () => this.tap(person.view.id, person.item.tap_action ?? MORE_INFO),
      hold: () => this.hold(person.view.id, person.item.hold_action ?? MORE_INFO),
    };
  }

  /** The grid's columns: as many of the sheet's 96 (+ 16 gap) as the card holds, never more than there are people. */
  private gridColumns(people: readonly Person[]): { columns: number; column: number } {
    const columns = Math.max(
      2,
      Math.min(4, Math.floor((this.contentWidth + 16) / 112), people.length),
    );
    return { columns, column: (this.contentWidth - 16 * (columns - 1)) / columns };
  }

  /**
   * A person's word in a grid column of that width: their own; for someone out of reach (whose "Entity not found" is
   * the longest thing a person says) "Unavailable", else a dash; for someone nobody can place, or who is away (their
   * dimmed face says so, Polish's "Poza domem" at 211), a dash — never cut, and never what turns the grid into rows, so
   * the card keeps its size (1.9) and its faces. Undefined where the word of someone home would be cut.
   */
  private gridWord(person: Person, column: number): string | undefined {
    const words =
      person.presence === 'off'
        ? [person.word, this.t('state.unavailable'), DASH]
        : person.presence === 'home'
          ? [person.word]
          : [person.word, DASH];
    return words.find((word) => this.headFit.ruler.width('am-person__state', word) <= column);
  }

  /** Whether every person's state holds its grid column; where one would be cut the card lays its people as rows. */
  private gridHolds(people: readonly Person[]): boolean {
    const { column } = this.gridColumns(people);
    return people.every((person) => this.gridWord(person, column) !== undefined);
  }

  /** The sheet: avatar, name, "Home · 18:40" / "Away · School" — the state and its one detail. */
  private renderGrid(people: readonly Person[]): TemplateResult {
    const { columns, column } = this.gridColumns(people);
    // a person's line keeps its state; its detail (the zone, the time) goes, whole, where the column cannot hold both —
    // measured as the card sets it (a size of the house's own, Fluvy's zoom, a font that lands late)
    const ruler = this.headFit.ruler;
    return html`<div class="am-people fv-cols" data-align="center" style="--am-people:${columns}">
      ${people.map((person) => {
        const detail = this.detail(person);
        const word = this.gridWord(person, column) ?? person.word;
        // a dash joins no detail: the detail alone, then, says where or since when
        const both = word === DASH ? detail : `${word} · ${detail}`;
        const line = detail && ruler.width('am-person__state', both) <= column ? both : word;
        const { tap, hold } = this.actionsOf(person);
        return html`<button
          class="am-person"
          data-target
          data-accent=${this.accents.item(person.item.color) ?? nothing}
          aria-label=${`${person.name} · ${word === person.word ? line : person.word}`}
          .fvTap=${tap}
          .fvHold=${hold}
          @pointerdown=${startPress}
          @click=${clickPress}
          @contextmenu=${preventMenu}
        >
          ${this.renderAvatar(person)}
          <span class="am-person__name">${person.name}</span>
          <span class="am-person__state">${line}</span>
          ${this.renderBattery(person)}
        </button>`;
      })}
    </div>`;
  }

  /** The desktop composition: the list row with the avatar in the icon column, the state said once at the right. */
  private renderRows(people: readonly Person[]): TemplateResult {
    const ruler = this.headFit.ruler;
    // a battery is said whole: its glyph (16), 2 and its figure under the name
    const batteryNeed = (person: Person): number =>
      person.battery === undefined
        ? 0
        : 18 + ruler.width('fv-row__sub', this.batteryFigure(person));
    // a column too narrow for a name, or a battery, beside its state gives every row's avatar to its words, as every
    // list does
    const keep =
      this.headFit.rowsKeepIcon(
        this.contentWidth,
        people.map((person) => ({ title: person.name, value: person.word })),
      ) &&
      people.every(
        (person) => this.headFit.rowRoom(this.contentWidth, person.word) >= batteryNeed(person),
      );
    return html`<div class="am-rows">
      ${people.map((person) => {
        const { tap, hold } = this.actionsOf(person);
        const key = (event: KeyboardEvent): void => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            tap();
          }
        };
        // the battery stays whole; its detail (the zone, the time) goes, whole, where the line cannot hold it (beside
        // the battery, both), never cut
        const battery = person.battery === undefined ? null : this.renderBattery(person);
        const detail = this.detail(person);
        // a state that would leave the name under 40 (never before it has begun), or cut the battery, is a dash, its
        // word the row's label
        const word =
          this.contentWidth - (keep ? 56 : 0) - 12 - ruler.width('fv-row__value', person.word) <
          Math.max(Math.min(40, ruler.width('fv-row__title', person.name)), batteryNeed(person))
            ? DASH
            : person.word;
        const room = this.contentWidth - (keep ? 56 : 0) - 12 - ruler.width('fv-row__value', word);
        const sub =
          !detail ||
          (battery
            ? 18 + ruler.width('fv-row__sub', `${this.batteryFigure(person)} · ${detail}`)
            : ruler.width('fv-row__sub', detail)) <= room
            ? detail
            : '';
        return html`<div
          class="fv-row fv-row--tap ${keep ? '' : 'fv-row--bare'}"
          role="button"
          tabindex="0"
          aria-label=${word === person.word ? nothing : `${person.name} · ${person.word}`}
          data-accent=${this.accents.item(person.item.color) ?? nothing}
          .fvTap=${tap}
          .fvHold=${hold}
          @pointerdown=${startPress}
          @click=${clickPress}
          @contextmenu=${preventMenu}
          @keydown=${key}
        >
          ${keep ? this.renderAvatar(person) : nothing}
          <span class="fv-row__text"
            ><span class="fv-row__title" data-name>${person.name}</span>${
              sub || battery
                ? html`<span class="fv-row__sub"
                    >${battery}${battery && sub ? ' · ' : ''}${sub}</span
                  >`
                : nothing
            }</span
          >
          <span class="fv-row__value ${person.presence === 'home' ? '' : 'fv-row__value--quiet'}"
            >${word}</span
          >
        </div>`;
      })}
    </div>`;
  }

  protected renderCard(): TemplateResult {
    const now = this.now();
    const people = this.items().map((item) => this.person(item, now));
    const home = people.filter((person) => person.presence === 'home').length;

    // "updated now": how fresh the freshest report is — a tracker reports far more often than its state changes
    let latest = 0;
    for (const { view } of people) {
      const at =
        view.stateObj && view.status === 'ok' ? Date.parse(view.stateObj.last_updated) : NaN;
      if (Number.isFinite(at) && at > latest) latest = at;
    }
    const when =
      latest === 0
        ? ''
        : now.getTime() - latest < 60_000
          ? this.t('common.now').toLocaleLowerCase()
          : agoShort(this.hass, new Date(latest), now);
    const panel = emptyPanel(this, !people.length, 'person', 'common.no_people');
    // nobody listed is said by the panel, never as "0 of 0"
    const count = panel ? '' : s(this.hass, 'count', { home, total: people.length });
    // the first of `texts` that holds `room`, measured as the card sets it (else the last)
    const first = (cls: string, texts: readonly string[], room: number): string =>
      texts.find((text) => this.headFit.ruler.width(cls, text) <= room) ?? texts[texts.length - 1]!;
    // the card's own title where it fits beside the map's round, a shorter one where it does not; a typed one is the
    // user's. Where not even the short one holds beside the round (half a phone's column), the round gives way to a
    // row under the body: a control never goes
    const { title, roundFits } = mapHead(
      this.headFit,
      this.contentWidth,
      [s(this.hass, 'title'), s(this.hass, 'title_short')],
      this.config?.title,
    );
    const open = (): void => navigate(this.config?.map_path ?? '/map');
    // the head: 44 circle + 12, the titles, 12 + the 44 round; "updated" is the first word to go, the time the second
    const sub = when
      ? first(
          'fv-card__sub',
          [`${count} · ${s(this.hass, 'updated', { when })}`, `${count} · ${when}`, count],
          this.contentWidth - 112,
        )
      : count;
    // a column too narrow even for the short title (half a phone's) gives the circle's room to it, as heads do
    const fitted = this.headFit.fit({
      width: this.contentWidth,
      title,
      sub,
      // half a section: the figures alone, under the title that says what they count ("Doma" over "2/3")
      shorter: panel ? [] : [`${home}/${people.length}`],
      trailing: roundFits ? 44 : 0,
    });

    return html`<article class="fv-card am-card" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'person') : null,
        small: fitted.small,
        tone: home > 0 ? 'accent' : 'neutral',
        title,
        name: this.config?.title !== undefined,
        sub: fitted.sub,
        trailing: roundFits ? round('map', 'quiet', s(this.hass, 'map'), open) : nothing,
        cut: fitted.cut,
        ...this.headActions(),
      })}
      ${
        // the grid where every state holds its column, else the rows (whose avatars give way, the state never cut)
        panel
          ? html`<div class="am-rows">${panel}</div>`
          : this.config?.variant === 'rows' || !this.gridHolds(people)
            ? this.renderRows(people)
            : this.renderGrid(people)
      }
      ${roundFits ? nothing : mapRow(this.hass, this.headFit, this.contentWidth, open)}
    </article>`;
  }
}
