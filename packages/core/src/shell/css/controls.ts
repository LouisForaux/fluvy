/*
 * Controls the theme's variables cannot finish (switches and checkboxes need no sheet: their sizes and
 * colours are public variables the theme sets).
 */

/**
 * A checked radio is the solid accent with an on-accent dot, as a checked box is. Options keep no margin of their
 * own (Web Awesome's em margins put stacked options 54.5 apart and every control under them on a half pixel):
 * a stacked option is its control's 44, a row of them 16 apart.
 */
export const radioCss = `:host([aria-checked="true"]) .control { background-color: var(--fluvy-accent); border-color: var(--fluvy-accent); color: var(--fluvy-text-on-accent); }
:host([appearance="default"]), :host([appearance="default"][data-wa-radio-horizontal]) { margin: 0; margin-block: 0; }`;
export const radioGroupCss =
  ':host([orientation="horizontal"]) [part~="form-control-input"] { column-gap: 16px; }';

/** A form's switch rows (the boolean selector: Add dashboard, card editors) on the fields' 16 column, their label on a 20 line. */
export const booleanSelectorCss =
  'ha-formfield { padding-inline: 16px; } .primary { line-height: 20px; }';

/** A picker's label above its box (entity pickers in card editors): the fields' label face, 13/500 secondary, 8 over the box. */
export const genericPickerCss =
  'label { font: 500 13px/16px var(--ha-font-family-body); color: var(--secondary-text-color); margin: 0 0 8px; }';

/** The slider of a number selector: the cards' knob (a card-white 20 thumb in a 2 px accent ring, lifted); the 6 px track comes from the theme. */
export const sliderCss = `:host { --thumb-width: 20px; --thumb-height: 20px; }
#thumb { background-color: var(--fluvy-card); box-shadow: 0 0 0 2px var(--fluvy-accent), var(--fluvy-shadow-knob); }`;

/** A button group used as a switch between views (By target / By type, UI / YAML): one 40 track on the page-alt fill, segments with a 10 radius, the chosen one in the active tiles' idiom (accent fill, dark ink). */
export const toggleGroupCss = `wa-button-group::part(base) { gap: 4px; padding: 4px; border-radius: var(--fluvy-radius-control); background: var(--fluvy-page-alt); }
ha-button { --ha-button-height: 32px; }
ha-button::part(base) { border: 0; border-radius: 10px; background: transparent; color: var(--fluvy-text-secondary); }
ha-button[appearance="accent"]::part(base) { background: var(--fluvy-accent-fill); color: var(--fluvy-accent-on-fill); }`;

/** Filter chips (pickers, filter panes): the 36 pill, text only; chosen = the accent fill with its dark ink (no Material check glyph). */
export const filterChipCss = `:host { --md-filter-chip-container-shape: var(--fluvy-radius-pill, 9999px); --md-filter-chip-container-height: 36px; --md-filter-chip-selected-container-color: var(--fluvy-accent-fill); --md-filter-chip-selected-label-text-color: var(--fluvy-accent-on-fill); --md-filter-chip-label-text-weight: 500; --md-filter-chip-icon-size: 0px; --md-filter-chip-with-leading-icon-leading-space: 16px; }
.checkmark { display: none; }
.container { width: 100%; justify-content: center; } .primary.action { flex: 1 1 auto; justify-content: center; }`;

/** A checkbox's label on a 20 line (HA's line-height 1 stacked it on its hint with no leading), the hint under the label, not under the box. */
export const checkboxCss =
  '[part~="label"] { line-height: 20px; } [part~="hint"] { margin-inline-start: 28px; }';

/** A button's label never breaks inside the button (a narrow table cell or a translated footer grows the button instead). */
export const buttonCss = '[part~="label"] { white-space: nowrap; }';

/** The Filters chip: 36 tall like the chips beside it (its pill comes with every assist chip); its count an 18 pill with 11/600 figures. */
export const filterPaneChipCss = `:host { --md-assist-chip-container-height: 36px; }
.badge { min-width: 18px; height: 18px; line-height: 18px; padding: 0 5px; box-sizing: border-box; border-radius: 9px; font-size: 11px; font-weight: 600; }`;

/**
 * Every toolbar chip (Filters, Group by, Sort by, Sources, the date range): the pill and the chips' 13/500 label,
 * not a 10 radius and Material's 12.25/400. The shape is set on the chip itself, because half a dozen pages give
 * their chips HA's 10 px from outside; a chip that must stay square inside a group says so with
 * `--fluvy-assist-chip-shape` (the date range's middle chip).
 */
export const assistChipCss =
  ':host { --md-assist-chip-container-shape: var(--fluvy-assist-chip-shape, var(--fluvy-radius-pill, 9999px)); --md-assist-chip-label-text-size: 13px; --md-assist-chip-label-text-line-height: 16px; --md-assist-chip-label-text-weight: 500; }';

/** Filter-pane rows: the name keeps 12 px from its checkbox. */
export const checkListItemCss = '.mdc-deprecated-list-item__text { padding-inline-end: 12px; }';
