import { plural, sliderStyleOf, strings } from '@fluvy/core';
import type { EntityView, FluvyCardConfig, LovelaceGridOptions } from '@fluvy/core';
import { head, sheetStyles } from '@fluvy/ui';

import { css, html, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';

import { Card, type CardEditor } from '../shared/base.js';

import { nameOf, type HelperHost, type HelperRowConfig } from './context.js';
import { compactNumber, isBoxedNumber, numberBlocks } from './number.js';

import { buttonRow, momentRow, momentValue, plainRow, plainValue, switchRow } from './rows.js';

import { asChips, selectEnd, selectPiece } from './select.js';

import { rowStyles } from './styles.js';

import { textBlocks } from './text.js';
import { offered, ownLabel, SELECTS } from '../shared/dropdown.js';
import { rowEndStyles, rowsKeepIcon, type RowEnd } from '../shared/row-end.js';
import { sinceIds } from '../shared/since.js';
import { ITEM_ALIASES, type AliasSpec, type RowStyle } from '../shared/config.js';
import { HeadFit, SWITCH_SLOT } from '../energy/head.js';
import { toneOf } from '../shared/colour.js';
import { chipRows, EMPTY, HEAD, ROW } from '../shared/heights.js';
import { emptyPanel, itemsOf, listOf, type EmptyList } from '../shared/lists.js';
import { TemplateTexts } from '../shared/templates.js';

const s = strings('helpers');

export type { HelperRowConfig } from './context.js';

export interface HelpersCardConfig extends FluvyCardConfig, EmptyList {
  title?: string;
  subtitle?: string;
  /** The same helpers as `entities`, with a name, an icon, a context line or quick-set times per row (YAML). */
  rows?: ReadonlyArray<string | HelperRowConfig>;
  /** A select's options: chips that fill the row (`full`, the default) or content-sized ones (`chips`). */
  options_style?: RowStyle;
}

const NUMBERS = new Set(['input_number', 'number', 'counter']);
const TEXTS = new Set(['input_text', 'text']);
const SWITCHES = new Set(['input_boolean', 'switch']);
const MOMENTS = new Set(['input_datetime', 'date', 'time', 'datetime']);
const BUTTONS = new Set(['input_button', 'button']);

/** What the house says of a helper: whether a number has a range (its ruler), a select's options, a moment's date. */
export interface HelperShape {
  readonly ranged?: boolean;
  readonly options?: readonly string[];
  readonly dated?: boolean;
}

/**
 * The card's height at a 360 column, for the automatic dashboard's columns. A helper by its kind, 16 under what is
 * above it: a number's field and its ruler (44 + 4 + 44; the field alone for a counter without a range, a boxed
 * number), a select's label and its chips (20 + 8 + rows of 44, in its row's words; a list past six options, or a row
 * that says `display: dropdown`, is a row), a text's label and field (20 + 12 + 44; a 36 label with a second line), a
 * switch, a button, a moment or a state as rows of 60 in one group (16 above the group, not each row), a time's quick
 * presets 56 under its row. The house says a number's range, a select's options and a moment's date (`shapeOf`, read
 * by `house-heights.ts`); where it is not there to say, a ruler (a counter its field) and the row's own options, else
 * one row of three chips.
 */
export function helpersHeight(
  config: HelpersCardConfig,
  shapeOf?: (id: string, domain: string) => HelperShape,
): number {
  // by position, as the card lays them out: the same select twice (an oven's zones) is two rows of their own
  const rows = itemsOf<HelperRowConfig>(config.rows ?? config.entities);
  if (!rows.length) return HEAD + EMPTY;
  // one number or counter and no title: the compact figure (see `compactNumber`)
  if (
    rows.length === 1 &&
    !config.title &&
    /^(counter|number|input_number)\./.test(rows[0]!.entity)
  )
    return 76;
  let height = 64 + 20;
  let group = 0; // rows in the open group of list rows
  for (const row of rows) {
    const id = row.entity;
    const domain = id.slice(0, id.indexOf('.'));
    const shape = shapeOf?.(id, domain) ?? {};
    let block = 0;
    if (NUMBERS.has(domain)) {
      block = (shape.ranged ?? domain !== 'counter') ? 92 : 44;
    } else if (SELECTS.has(domain)) {
      const options = offered(shape.options ?? [], row.options);
      if (asChips(row, options.length || 3)) {
        const style = config.options_style === 'chips' ? 'chips' : 'full';
        const labels = options.map((option) => ownLabel(row, option) ?? option);
        block = 28 + chipRows(labels.length ? labels : ['a', 'b', 'c'], style) * 44;
      }
    } else if (TEXTS.has(domain)) {
      block = (row.secondary ? 36 : 20) + 12 + 44;
    }
    if (block) {
      height += 16 + block;
      group = 0;
      continue;
    }
    if (!group) height += 16;
    group += 1;
    height += ROW;
    // a time with quick presets: the chips under its row
    if (MOMENTS.has(domain) && !shape.dated && row.presets?.length) height += 56;
  }
  return height;
}

/**
 * Every Home Assistant helper on one card, each in the idiom the design sheet gives its kind: a number
 * is a big tabular value with its stepper and the ruler under it, a select is a row of chips, a text
 * helper is the 44 field, and what is one tap (switch, date or time, button) is a list row.
 * One control per module: `number.ts`, `select.ts`, `text.ts`, `rows.ts`.
 */
export class FluvyHelpersCard extends Card<HelpersCardConfig> {
  /** The card's height at a 360 column from its config alone: a ruler and three short options (`helpersHeight`). */
  static override layoutHeight(config: HelpersCardConfig): number {
    return helpersHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.inputs,
    rowStyles,
    rowEndStyles,
    css`
      /* the sheet places the ruler with .in-card > .fv-ruler (a fixed 360 card); here it is a custom element */
      fluvy-ruler {
        margin-top: 4px;
      }

      /* a name that does not fit beside its value sends the value and stepper to a line of their own */
      .in-field,
      .in-compact {
        flex-wrap: wrap;
        gap: 8px 12px;
        height: auto;
        min-height: 44px;
      }

      .in-field--top {
        min-height: 0;
      }

      .in-compact {
        min-height: 76px;
      }

      .in-field__text,
      .in-compact .fv-row__text {
        flex: 1 1 auto;
        max-width: 100%;
      }

      .in-field__control {
        flex: 0 0 auto;
        margin-left: auto;
      }

      .in-quick--flush {
        padding-left: 0;
      }

      /* rows that gave their circles to their names: the hairline after the chips starts the row too */
      .in-quick + .fv-row--bare::before {
        left: 0;
      }

      /* the sheet's compact value is a 36 box around one digit; a unit or three digits may widen it */
      .in-compact__value {
        width: auto;
        min-width: 36px;
      }

      .in-compact__value .fv-unit {
        line-height: 1;
      }
    `,
  ];

  static override properties = { ...Card.properties, preview_: { state: true } };

  /** Value under the finger while a ruler drag is in flight, per entity. */
  declare preview_: Readonly<Record<string, number>>;

  /** The head's fitting; its ruler lays widths out in the card's own classes (a select's filled chips, the rows' ends). */
  private readonly head = new HeadFit(this);
  private readonly ruler = this.head.ruler;
  /** A row's own second line when it is a template: rendered by Home Assistant, live. */
  private readonly texts = new TemplateTexts(this);

  constructor() {
    super();
    this.preview_ = {};
  }

  /**
   * Whether the list rows keep their circles beside what ends them, which is never cut: a switch, a button's "Run",
   * a value's button ("06:45", a long select's option), a state's words. The blocks (a number, a text, chips) have
   * no circle to give.
   */
  private rowsKeepIcon(host: HelperHost): boolean {
    const ends = this.rows().flatMap((row): RowEnd[] => {
      const view = this.entity(row.entity);
      const name = nameOf(host, view, row);
      const domain = view.domain;
      if (NUMBERS.has(domain) || TEXTS.has(domain)) return [];
      if (SWITCHES.has(domain)) return [{ name, end: SWITCH_SLOT }];
      if (BUTTONS.has(domain)) return [{ name, button: s(this.hass, 'run') }];
      if (MOMENTS.has(domain))
        return [{ name, button: momentValue(host, view, row), capped: true }];
      if (!SELECTS.has(domain))
        return [{ name, end: this.ruler.width('fv-row__value', plainValue(host, view)) }];
      const end = selectEnd(host, view, row);
      return end ? [end] : [];
    });
    return rowsKeepIcon(this.ruler, this.contentWidth, ends);
  }

  /** The card as its controls see it for this render (its own helpers are protected). */
  private hostView(): HelperHost {
    const host: HelperHost = {
      hass: this.hass,
      contentWidth: this.contentWidth,
      sliderStyle: sliderStyleOf(this.config),
      ruler: this.ruler,
      texts: this.texts,
      bare: false,
      ...this.controlHost,
      moreInfo: (id) => this.tap(id, { action: 'more-info' }),
      preview: (id) => this.preview_[id],
      setPreview: (id, value) => {
        const next = { ...this.preview_ };
        if (value === null) delete next[id];
        else next[id] = value;
        this.preview_ = next;
      },
      editing: (id) =>
        (this.renderRoot as ShadowRoot).activeElement?.getAttribute('data-field') === id,
      refresh: () => this.requestUpdate(),
    };
    return { ...host, bare: !this.rowsKeepIcon(host) };
  }

  static override editor(): Promise<CardEditor> {
    return import('./helpers-editor.js');
  }
  static override aliases: AliasSpec = { items: { rows: ITEM_ALIASES } };

  static getStubConfig(_hass: unknown, entities: readonly string[]): HelpersCardConfig {
    const helpers = entities.filter((id) =>
      /^(input_number|input_select|input_text|input_boolean|input_datetime|input_button|counter)\./.test(
        id,
      ),
    );
    return {
      type: 'custom:fluvy-helpers-card',
      entities: (helpers.length ? helpers : entities).slice(0, 4),
    };
  }

  protected override prepare(config: HelpersCardConfig): HelpersCardConfig {
    listOf(config, 'rows', ['entities']);
    return config;
  }

  private rows(): HelperRowConfig[] {
    return itemsOf(this.config?.rows ?? this.config?.entities);
  }

  /** The rows' entities, and what their last change is read from (`since`). */
  protected override watched(): readonly string[] {
    const rows = this.rows();
    return [...rows.map((row) => row.entity), ...sinceIds(rows)];
  }

  /**
   * A field whose name and value do not share the line drops the value a size (24 → 20 → 16) before
   * wrapping: "-1.5 °C" beside "Thermostat offset" fits at 20. Measured after each render, classes set
   * outside Lit's bindings like `fitPills`.
   */
  private fitFields(): void {
    for (const field of this.renderRoot.querySelectorAll<HTMLElement>('.in-field')) {
      const text = field.querySelector<HTMLElement>('.in-field__text');
      const control = field.querySelector<HTMLElement>('.in-field__control');
      const value = field.querySelector<HTMLElement>('.in-field__value');
      if (!text || !control || !value) continue;
      value.classList.remove('is-s', 'is-xs');
      const wrapped = (): boolean =>
        control.getBoundingClientRect().top > text.getBoundingClientRect().top + 1;
      if (!wrapped()) continue;
      value.classList.add('is-s');
      if (wrapped()) value.classList.replace('is-s', 'is-xs');
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.fitFields();
  }

  override getCardSize(): number {
    return 1 + this.rows().length;
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected renderCard(): TemplateResult {
    const host = this.hostView();
    const rows = this.rows();
    const views = rows.map((row) => this.entity(row.entity));

    // one counter (or one boxed number) and no title: the sheet's compact card, not a titled list of one
    const [only] = rows;
    const [first] = views;
    if (
      only &&
      first &&
      rows.length === 1 &&
      !this.config?.title &&
      NUMBERS.has(first.domain) &&
      isBoxedNumber(host, first)
    ) {
      return compactNumber(host, first, only);
    }

    // blocks stand on their own; consecutive rows share one list, so the hairlines run between them
    const blocks: TemplateResult[] = [];
    let list: TemplateResult[] = [];
    const flush = (): void => {
      if (list.length) blocks.push(html`<div class="in-rows">${list}</div>`);
      list = [];
    };
    rows.forEach((row, index) => {
      const view = views[index] as EntityView;
      const domain = view.domain;
      const select = SELECTS.has(domain)
        ? selectPiece(host, view, row, this.config?.options_style)
        : undefined;
      if (NUMBERS.has(domain)) {
        flush();
        blocks.push(...numberBlocks(host, view, row));
      } else if (TEXTS.has(domain)) {
        flush();
        blocks.push(...textBlocks(host, view, row));
      } else if (select && 'blocks' in select) {
        flush();
        blocks.push(...select.blocks);
      } else if (select) list.push(select.row);
      else if (SWITCHES.has(domain)) list.push(switchRow(host, view, row));
      else if (MOMENTS.has(domain)) list.push(momentRow(host, view, row));
      else if (BUTTONS.has(domain)) list.push(buttonRow(host, view, row));
      else list.push(plainRow(host, view, row));
    });
    flush();

    const panel = emptyPanel(this, !rows.length, 'sliders', 'common.no_helpers');
    const areas = new Set(views.map((view) => view.areaName).filter(Boolean));
    // none counted is said by the panel, not as "0 helpers"
    const count = panel
      ? ''
      : plural(this.hass, 'helpers.count', views.length, { count: views.length });
    const title = this.config?.title ?? s(this.hass, 'title');
    // the line's trailing segments go whole before the circle gives way, and the circle before a word is cut
    const fitted = this.head.fit({
      width: this.contentWidth,
      title,
      sub:
        this.config?.subtitle ??
        [areas.size === 1 ? [...areas][0] : '', count].filter(Boolean).join(' · '),
    });
    return html`<article class="fv-card" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'sliders') : null,
        tone: toneOf(this.config, 'accent'),
        title,
        sub: fitted.sub,
        cut: fitted.cut,
        // the head is the card's button where its tap has somewhere to go: a card of many has no details of its own
        ...this.headActions(),
      })}
      ${panel ? html`<div class="in-rows">${panel}</div>` : blocks}
    </article>`;
  }
}
