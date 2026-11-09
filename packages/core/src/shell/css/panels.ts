import { emptyState } from './shared.js';

/*
 * The panels beside Settings: Activity, History, the 2026 Lights / Climate dashboards, To-do, Media,
 * the developer tools. What HA sizes from the viewport is sized from the frame; lists that became
 * scroll boxes inside a scrolling surface open up.
 */

/** A logbook given a height (more-info on wide screens, the logbook card): its rows ride the one scroll of the dialog or view. */
export const moreInfoLogbookCss = 'ha-logbook { --logbook-max-height: unset; }';
export const logbookCardCss = 'ha-logbook { height: auto; }';

/** Activity: the floating date header on the page fill it floats over, the empty state on the page's page-alt panel; on the phone the toolbar wraps so the date navigator fits. */
export const logbookPanelCss = `ha-logbook { --card-background-color: var(--primary-background-color); --fluvy-empty-surface: var(--fluvy-page-alt); --fluvy-empty-margin: 16px; }
@media (max-width: 600px) { .toolbar { flex-wrap: wrap; row-gap: 8px; height: auto; padding-block: 8px; overflow-x: visible; } ha-date-range-nav { flex: 1 1 100%; } }`;
export const historyPanelCss =
  '@media (max-width: 600px) { .toolbar { flex-wrap: wrap; row-gap: 8px; height: auto; padding-block: 8px; overflow-x: visible; } ha-date-range-nav { flex: 1 1 100%; } }';
export const dateRangeNavCss =
  ':host { max-width: 100%; } .date-range-inputs { max-width: 100%; border-radius: var(--fluvy-radius-pill, 9999px); } .range { --fluvy-assist-chip-shape: 0px; }';

/** The Lights and Climate dashboards: at least the height of their box, not of the window (they scrolled 88 px with nothing below). */
export const viewPanelCss = 'hui-view-container { min-height: 100%; }';

/** To-do: the page's 16 gutter around the list (HA leaves 8), as padding: a margin collapsed through the pane's full height and scrolled the page 16 px for nothing; the floating button's room kept below. */
export const todoPanelCss = '#columns { margin: 0; padding: 16px 16px 86px; }';

/** The to-do card (the To-do panel, dashboards): "You have no to-do items" as the empty state. */
export const todoListCardCss = `:host { --fluvy-empty-margin: 0 16px 16px; }
${emptyState('.empty', 'check')}`;

/** The full log: the log box sized from the frame, so only it scrolls. */
export const errorLogCss =
  ':host { --error-log-card-height: calc(100vh - 255px - var(--safe-area-inset-top, 0px) - var(--safe-area-inset-bottom, 0px)); }';

/** Read-only code viewers in page cards grow with their content: the page scrolls once. */
export const debugViewportCss = '.snapshot-editor { --code-mirror-max-height: none; }';

/** The media bar's progress line on the phone is not a slider to grab while nothing plays: no knob when disabled. */
export const mediaBarCss = 'ha-slider[disabled] { --thumb-width: 0px; --thumb-height: 0px; }';

const MEDIA_INK = 'filter: grayscale(1) contrast(0.9) brightness(0.8);';

/** The media browser's tiles with no picture of their own: Home Assistant's icon in the neutral ink, not HA blue. */
export const mediaBrowseCss = `.child .icon-holder { ${MEDIA_INK} }`;

/**
 * A brand's logo in the media browser, in the neutral ink. Only Home Assistant's thumbnail knows a logo from a picture:
 * a photo, a video, an album's or a folder's cover keeps its colours (#147).
 */
export const mediaThumbnailCss = `.image.brand { ${MEDIA_INK} }`;
