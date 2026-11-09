import { html, type TemplateResult } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';

/**
 * The fluvy glyph set: 24 grid, 1.75 round stroke, ink 3..21 tall centred on (12, 12).
 * The design lab keeps the same table in `apps/design-lab/fluvy.js`; `glyphs.test.ts` fails when they drift.
 * A glyph is its SVG body, or [body, strokeWidth] where the default stroke would not survive 20 px.
 */
const GLYPHS = {
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.9 10.6c.6.5.9 1.2.9 2V16h6v-.4c0-.8.3-1.5.9-2A6 6 0 0 0 12 3Z"/>',
  plug: '<path d="M9 3v4"/><path d="M15 3v4"/><path d="M6.5 7h11v4a5.5 5.5 0 0 1-11 0Z"/><path d="M12 16.5V21"/>',
  blinds:
    '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9.3h16"/><path d="M4 14.7h16"/><path d="M8 20v1"/>',
  thermo: '<path d="M10 4.5a2 2 0 1 1 4 0v9.3a4 4 0 1 1-4 0Z"/><path d="M12 9v6.5"/>',
  flame:
    '<path d="M11.8 3C14.4 4.8 17 9.8 17 16a5 5 0 0 1-10 0c0-2.2.5-4.2 1.4-6 .4 1.1 1.1 1.8 2 2C10.2 8.6 10.4 5.6 11.8 3Z"/><path d="M12 13.8c1 .9 1.7 1.7 1.7 2.6a1.7 1.7 0 0 1-3.4 0c0-.9.7-1.7 1.7-2.6Z"/>',
  snow: '<path d="M12 3v18"/><path d="M4.2 7.5l15.6 9"/><path d="M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5"/><path d="M9.5 19.5 12 17l2.5 2.5"/>',
  auto: '<path d="M4 12a8 8 0 0 1 13.7-5.6"/><path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M17.5 3v3.8h-3.8"/><path d="M6.5 21v-3.8h3.8"/>',
  bolt: '<path d="M13 3 5 13.5h6L11 21l8-10.5h-6Z"/>',
  tower:
    '<path d="M12 3 7.5 21"/><path d="M12 3l4.5 18"/><path d="M6 7.5h12"/><path d="M8.2 13h7.6"/><path d="M9.6 7.5 15 13"/><path d="M14.4 7.5 9 13"/><path d="M8.9 18.5 12 16l3.1 2.5"/>',
  generator:
    '<path d="M7 4h6l5 5v10.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5V5a1 1 0 0 1 1-1Z"/><path d="M9.5 4V2.5h3V4"/><path d="M9 11.5l6 5"/><path d="M15 11.5l-6 5"/>',
  swap: '<path d="M4 8h14"/><path d="M15 5l3 3-3 3"/><path d="M20 16H6"/><path d="M9 13l-3 3 3 3"/>',
  speaker:
    '<rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="14" r="3.2"/><circle cx="12" cy="7.5" r="1"/>',
  prev: '<path d="M6 5v14"/><path d="M18 6 9 12l9 6Z" fill="currentColor" stroke="none"/>',
  next: '<path d="M18 5v14"/><path d="M6 6l9 6-9 6Z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
  volume:
    '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5"/><path d="M12 19v2.5"/><path d="M2.5 12H5"/><path d="M19 12h2.5"/><path d="m5.3 5.3 1.8 1.8"/><path d="m16.9 16.9 1.8 1.8"/><path d="m5.3 18.7 1.8-1.8"/><path d="m16.9 7.1 1.8-1.8"/>',
  moon: '<g transform="translate(-0.32 0.32)"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></g>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14"/><path d="M17 5v14"/><path d="M3 12h4"/><path d="M17 12h4"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<g transform="matrix(-1 0 0 1 24 0)"><path d="m9 6 6 6-6 6"/></g>',
  minus: '<path d="M6 12h12"/>',
  plus: '<path d="M12 6v12"/><path d="M6 12h12"/>',
  home: '<path d="M4 11 12 4l8 7v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z"/><path d="M9.5 21v-6h5v6"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  sliders:
    '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
  trendUp: ['<path d="M4 16l5-5 4 4 7-7"/><path d="M15 8h5v5"/>', 2],
  trendDown: ['<path d="M4 8l5 5 4-4 7 7"/><path d="M15 16h5v-5"/>', 2],
  drop: '<path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5Z"/>',
  ban: '<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>',
  signal: ['<path d="M4 18h2"/><path d="M9 18v-4"/><path d="M14 18v-8"/><path d="M19 18V6"/>', 2.2],
  wifi: [
    '<path d="M3 9.5a13 13 0 0 1 18 0"/><path d="M6.5 13a8 8 0 0 1 11 0"/><path d="M10 16.5a3.2 3.2 0 0 1 4 0"/><circle cx="12" cy="19.5" r=".8" fill="currentColor"/>',
    2,
  ],
  battery:
    '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2"/><rect x="5" y="10" width="10" height="4" rx="1" fill="currentColor" stroke="none"/>',
  dots: '<circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19c3-5 6-8 10-10"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  close: '<path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/>',
  fan: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1.5-6.5 4-6.5S19 6 19 8c0 1.5-2 2.5-7 2Z"/><path d="M14 12c4 0 6.5 1.5 6.5 4S18 19 16 19c-1.5 0-2.5-2-2-7Z"/><path d="M12 14c0 4-1.5 6.5-4 6.5S5 18 5 16c0-1.5 2-2.5 7-2Z"/><path d="M10 12c-4 0-6.5-1.5-6.5-4S6 5 8 5c1.5 0 2.5 2 2 7Z"/>',
  swing:
    '<path d="M4 8h13"/><path d="m14 5 3 3-3 3"/><path d="M20 16H7"/><path d="m10 13-3 3 3 3"/>',
  heater:
    '<path d="M8 4h8v13a4 4 0 0 1-8 0Z"/><path d="M12 9c1 1.2 1.8 2 1.8 3.2a1.8 1.8 0 1 1-3.6 0c0-1.2.8-2 1.8-3.2Z"/><path d="M10 21h4"/>',
  humid:
    '<path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5Z"/><path d="M9 15.5c1 .8 2 1 3 0s2-.8 3 0"/>',
  away: '<circle cx="12" cy="5" r="1.8"/><path d="M9.5 21v-6l2-3-1.5-4.5L8 10"/><path d="M13 10.5 15.5 9"/><path d="m11.5 12 3 2 1.5 7"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  car: '<g transform="translate(0 -1)"><path d="M5 18v2"/><path d="M19 18v2"/><path d="m4 12 1.7-4.6A2 2 0 0 1 7.6 6h8.8a2 2 0 0 1 1.9 1.4L20 12"/><rect x="3" y="12" width="18" height="6" rx="2"/><path d="M7 15h1"/><path d="M16 15h1"/></g>',
  backspace:
    '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7Z"/><path d="m12 9 5 5"/><path d="m17 9-5 5"/>',
  power: '<path d="M12 3v8"/><path d="M6.6 6.6a7.5 7.5 0 1 0 10.8 0"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>',
  unlock:
    '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>',
  shield:
    '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 9.5 4-1.2 7-5 7-9.5V6Z"/><path d="m9.5 12 2 2 3.5-4"/>',
  camera:
    '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.5"/>',
  /** a security camera on its wall arm, its hood at the front: the Cameras card's head */
  cctv: '<path d="M15.6 12.9V16.9H20.6"/><g transform="matrix(.883 -.469 .469 .883 7.65 13.7)"><rect x="0" y="-3" width="10.5" height="6" rx="1.5"/><path d="M0-1.5-3.2-3V3L0 1.5"/></g>',
  vacuum:
    '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v4"/><circle cx="12" cy="12" r="2"/><path d="M6 17.5 4 20"/><path d="m18 17.5 2 2.5"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  dock: '<g transform="translate(0 -1)"><path d="M4 20h16"/><path d="M6 20v-8l6-6 6 6v8"/><path d="M10 20v-5h4v5"/></g>',
  locate:
    '<circle cx="12" cy="12" r="3"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><circle cx="12" cy="12" r="7"/>',
  expand: '<path d="M14 4h6v6"/><path d="m20 4-7 7"/><path d="M10 20H4v-6"/><path d="m4 20 7-7"/>',
  snapshot: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8.5"/>',
  /** an arrow leaving its box by the top end corner: open in a new tab */
  external:
    '<path d="M14 4h6v6"/><path d="m20 4-8.5 8.5"/><path d="M20 13v5.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H11"/>',
  /** a circular arrow: reload */
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M20.5 3.75V8h-4.25"/>',
  motion:
    '<g transform="translate(2 0)"><circle cx="15" cy="5" r="1.8"/><path d="M11 21v-6l2.5-3-1.5-4L9 9.5"/><path d="M14 11.5 16.5 10"/><path d="m12 13.5 2.5 2 1.5 5.5"/><path d="M5 12 3 9"/><path d="M6 6.5 4 5"/></g>',
  tilt: '<path d="M4 6h16"/><path d="M6 10h12"/><path d="M8 14h8"/><path d="M10 18h4"/>',
  key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M18 12v3"/><path d="M15 12v2.5"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  cloud:
    '<g transform="translate(-0.7 0)"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18Z"/></g>',
  rain: '<g transform="translate(-0.7 0)"><path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15Z"/><path d="M9 18l-1 2.5"/><path d="M13 18l-1 2.5"/><path d="M17 18l-1 2.5"/></g>',
  wind: '<path d="M4 10h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M4 14h13a2.5 2.5 0 1 1-2.5 2.5"/>',
  person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  map: '<path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2Z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.2"/>',
  door: '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none"/>',
  /** the door's frame with its leaf swung in on its hinge, the knob at its free edge */
  doorOpen:
    '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><path d="M6 3.5l7 2.5v13l-7 2"/><circle cx="11" cy="12.5" r="1" fill="currentColor" stroke="none"/>',
  /** a window's four panes; open, its two sashes swung in */
  window:
    '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 4v16"/><path d="M4 12h16"/>',
  windowOpen:
    '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4.5 5.5 9 7.5v9l-4.5 2"/><path d="M19.5 5.5 15 7.5v9l4.5 2"/>',
  /** a field gate between its posts, braced; open, its leaf swung toward you on the left post */
  gate: '<path d="M4 3v18"/><path d="M20 3v18"/><path d="M4 7h16"/><path d="M4 17h16"/><path d="M4 17 20 7"/>',
  gateOpen: '<path d="M4 3v18"/><path d="M20 3v18"/><path d="M4 7l10-3v16.5L4 17"/>',
  /** a garage, its door shut in two panels; open, the door rolled up into a band at its top */
  garage: '<path d="M4 21V9.5L12 3l8 6.5V21"/><path d="M7.5 12h9v9h-9Z"/><path d="M7.5 16.5h9"/>',
  garageOpen:
    '<path d="M4 21V9.5L12 3l8 6.5V21"/><path d="M7.5 21v-9h9V21"/><path d="M7.5 13.5h9"/>',
  warn: '<path d="M12 4 3 19h18Z"/><path d="M12 10v4"/><circle cx="12" cy="16.5" r=".9" fill="currentColor" stroke="none"/>',
  update: '<path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/>',
  list: '<path d="M9 7h11"/><path d="M9 12h11"/><path d="M9 17h11"/><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none"/>',
  calendar:
    '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16"/><path d="M9 3v4"/><path d="M15 3v4"/>',
  timer:
    '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M10 3h4"/><path d="M12 3v2.5"/>',
  counter: '<path d="M4 12h16"/><path d="M12 4v16"/><circle cx="12" cy="12" r="9"/>',
  text: '<path d="M5 6h14"/><path d="M12 6v13"/><path d="M9 19h6"/>',
  script:
    '<path d="M8 5h9a2 2 0 0 1 2 2v12H8"/><path d="M8 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2"/><path d="M11 9h5"/><path d="M11 13h5"/>',
  ha: '<path d="M4 12 12 4l8 8"/><path d="M6 10.5V20h12v-9.5"/><path d="M12 20v-5"/>',
  updown: '<path d="m7 9 5-5 5 5"/><path d="m7 15 5 5 5-5"/>',
  play: '<path d="M7 5.5v13l11-6.5Z" fill="currentColor" stroke="none"/>',
  shuffle:
    '<path d="M4 7h3.5l7 10H20"/><path d="M4 17h3.5l2.2-3.2"/><path d="M14.3 10.2 16.5 7H20"/><path d="m17.5 4.5 2.5 2.5-2.5 2.5"/><path d="m17.5 14.5 2.5 2.5-2.5 2.5"/>',
  repeat:
    '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
  /* weather conditions — same hand as cloud/rain: the cloud body, then what falls out of it; a sun or moon behind a cloud is cut 2.5 short of it, never crossed */
  cloudSun:
    '<path d="M10.28 9.25a3.4 3.4 0 1 1 6.23 2.73"/><path d="M9.44 6.64 8.03 5.23"/><path d="M13.4 5V3"/><path d="m17.36 6.64 1.41-1.41"/><path d="M19 10.6h2"/><path d="M5.5 21h8a3.6 3.6 0 0 0 .4-7.2A5 5 0 0 0 5.1 15.2 3 3 0 0 0 5.5 21Z"/>',
  cloudMoon:
    '<path d="M17.55 12.66a5 5 0 0 0 3.41-2.9 5 5 0 0 1-6.56-6.56 5 5 0 0 0-2.76 6.25"/><path d="M5.5 21h8a3.6 3.6 0 0 0 .4-7.2A5 5 0 0 0 5.1 15.2 3 3 0 0 0 5.5 21Z"/>',
  fog: '<g transform="translate(-0.7 0)"><path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15Z"/><path d="M5 18h14"/><path d="M8 21h8"/></g>',
  storm:
    '<g transform="translate(-0.7 0)"><path d="M17 15a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15h1.2"/><path d="m13.2 11.5-2.7 4.5h4l-2.7 4.5"/></g>',
  snowCloud:
    '<g transform="translate(-0.7 0)"><path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15Z"/><circle cx="9" cy="18.5" r="1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="20" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="18.5" r="1" fill="currentColor" stroke="none"/></g>',
  sleet:
    '<g transform="translate(-0.7 0)"><path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15Z"/><path d="M9.2 18l-1 2.5"/><path d="M15.8 18l-1 2.5"/><circle cx="12.5" cy="19.5" r="1" fill="currentColor" stroke="none"/></g>',
  repeatOne:
    '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/><path d="m10.8 10.8 1.8-1.2V14.4"/>',
  volumeOff:
    '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z"/><path d="m15.8 10 4.4 4"/><path d="m20.2 10-4.4 4"/>',
  /* the TV remote's keys (1.18, #143): a screen on its stand; two filled triangles in the hand of prev and next;
     subtitles, two unequal lines on the screen's foot */
  tv: '<rect x="3" y="4.5" width="18" height="12.5" rx="2.5"/><path d="M8.5 20.5h7"/><path d="M12 17v3.5"/>',
  rewind:
    '<path d="M11.5 6 4 12l7.5 6Z" fill="currentColor" stroke="none"/><path d="M20 6l-7.5 6 7.5 6Z" fill="currentColor" stroke="none"/>',
  forward:
    '<path d="M12.5 6 20 12l-7.5 6Z" fill="currentColor" stroke="none"/><path d="M4 6l7.5 6L4 18Z" fill="currentColor" stroke="none"/>',
  captions:
    '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 15h6"/><path d="M15 15h2"/><path d="M7 11h2"/><path d="M11 11h6"/>',
  // fluvy's own settings (the panel)
  palette:
    '<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.8-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5C21 6.3 17 3 12 3Z"/><circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.8" cy="7.3" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.4" cy="7.3" r="1.1" fill="currentColor" stroke="none"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  shapeSoft: '<rect x="4" y="4" width="16" height="16" rx="4.5"/>',
  shapeRound: '<rect x="4" y="4" width="16" height="16" rx="6"/>',
  shapeCrisp: '<rect x="4" y="4" width="16" height="16" rx="1.5"/>',
  pillRound: '<rect x="3" y="7" width="18" height="10" rx="5"/>',
  pillSoft: '<rect x="3" y="7" width="18" height="10" rx="3"/>',
  pillCrisp: '<rect x="3" y="7" width="18" height="10" rx="1.5"/>',
  /** a header with its views as words, the open one underlined (the header frame of `tabsNone`) */
  tabsText:
    '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10.5h3.5"/><path d="M13.5 10.5h3.5"/><path d="M7 14.5h3.5"/>',
  /** the view tabs as pills, the open one first */
  tabsPills:
    '<rect x="2.5" y="8" width="10" height="8" rx="4"/><rect x="15.5" y="8" width="6" height="8" rx="4"/>',
  /** a header with its name alone: no tabs */
  tabsNone: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h6"/>',
  globe:
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 15V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M5 20h14"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  // Home Assistant's own places and the apps people add (the sidebar and Settings, when the house chooses our icons)
  bell: '<path d="M18.5 16.75h-13l1.5-2V11a5 5 0 0 1 10 0v3.75Z"/><path d="M10.25 19.5a1.75 1.75 0 0 0 3.5 0"/><path d="M12 4.25v1.75"/>',
  wrench:
    '<path d="M14.75 3.5a4.75 4.75 0 0 0-4.4 6.55l-6.1 6.1a1.95 1.95 0 0 0 2.75 2.75l6.1-6.1a4.75 4.75 0 0 0 6.35-6.1l-2.95 2.95-2.3-.45-.45-2.3 2.95-2.95a4.7 4.7 0 0 0-1.95-.45Z"/>',
  gear: '<path d="M10.29 5.62L10.44 3.14L13.56 3.14L13.71 5.62A6.6 6.6 0 0 1 15.30 6.28L15.30 6.28L17.16 4.63L19.37 6.84L17.72 8.70A6.6 6.6 0 0 1 18.38 10.29L18.38 10.29L20.86 10.44L20.86 13.56L18.38 13.71A6.6 6.6 0 0 1 17.72 15.30L17.72 15.30L19.37 17.16L17.16 19.37L15.30 17.72A6.6 6.6 0 0 1 13.71 18.38L13.71 18.38L13.56 20.86L10.44 20.86L10.29 18.38A6.6 6.6 0 0 1 8.70 17.72L8.70 17.72L6.84 19.37L4.63 17.16L6.28 15.30A6.6 6.6 0 0 1 5.62 13.71L5.62 13.71L3.14 13.56L3.14 10.44L5.62 10.29A6.6 6.6 0 0 1 6.28 8.70L6.28 8.70L4.63 6.84L6.84 4.63L8.70 6.28A6.6 6.6 0 0 1 10.29 5.62Z"/><circle cx="12" cy="12" r="2.75"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3.75V7M14 3.75V7M10 17v3.25M14 17v3.25M3.75 10H7M3.75 14H7M17 10h3.25M17 14h3.25"/>',
  code: '<path d="M8.5 7.5 4 12l4.5 4.5"/><path d="M15.5 7.5 20 12l-4.5 4.5"/><path d="m13.25 5-2.5 14"/>',
  fileCode:
    '<path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8Z"/><path d="M14 3.5V8h4.5"/><path d="M9 12.5h6"/><path d="M9 16h4"/>',
  terminal:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="m7.5 9.5 3 2.5-3 2.5"/><path d="M12.5 15h4"/>',
  zigbee: '<circle cx="12" cy="12" r="8.5"/><path d="M8.25 8.5h7.5l-7.5 7h7.5"/>',
  zwave:
    '<path d="M3.5 12c1.9 0 2.35-5.5 4.25-5.5S9.9 17.5 12 17.5s2.35-11 4.25-11 2.35 5.5 4.25 5.5"/>',
  nodes:
    '<rect x="3.5" y="9.5" width="6" height="5" rx="1.5"/><rect x="14.5" y="4" width="6" height="5" rx="1.5"/><rect x="14.5" y="15" width="6" height="5" rx="1.5"/><path d="M9.5 12h1a1.5 1.5 0 0 0 1.5-1.5V8a1.5 1.5 0 0 1 1.5-1.5h1"/><path d="M11.5 12a1.5 1.5 0 0 1 1 1.5V16a1.5 1.5 0 0 0 1.5 1.5h.5"/>',
  hub: '<circle cx="12" cy="12" r="2.5"/><circle cx="5.5" cy="5.5" r="1.75"/><circle cx="18.5" cy="5.5" r="1.75"/><circle cx="5.5" cy="18.5" r="1.75"/><circle cx="18.5" cy="18.5" r="1.75"/><path d="m6.75 6.75 3.5 3.5M17.25 6.75l-3.5 3.5M6.75 17.25l3.5-3.5M17.25 17.25l-3.5-3.5"/>',
  store:
    '<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5a2.67 2.67 0 0 0 5.33 0 2.67 2.67 0 0 0 5.34 0 2.67 2.67 0 0 0 5.33 0"/><path d="M5.5 12.25v7.25h13v-7.25"/><path d="M10 19.5v-4h4v4"/>',
  database:
    '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.13 2.5 7 2.5s7-1.1 7-2.5V6"/><path d="M5 12c0 1.4 3.13 2.5 7 2.5s7-1.1 7-2.5"/>',
  chart:
    '<path d="M4 20h16"/><path d="M7 16.5V12"/><path d="M12 16.5V6.5"/><path d="M17 16.5v-7"/>',
  box: '<path d="M12 3.5 19.5 7.5v9L12 20.5 4.5 16.5v-9Z"/><path d="M4.5 7.5 12 11.5l7.5-4"/><path d="M12 11.5v9"/>',
  puzzle:
    '<path d="M4 7h3.5a2.5 2.5 0 0 1 5 0H16v3.5a2.5 2.5 0 0 1 0 5V20H4v-4.5a2.5 2.5 0 0 0 0-5Z"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v2.5"/>',
  archive:
    '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1.25"/><path d="M5 9v8.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  rooms:
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M11 4.5V9"/><path d="M11 13v6.5"/><path d="M11 11.5h9.5"/>',
  devices:
    '<rect x="3.5" y="5" width="10" height="14" rx="2"/><rect x="15.5" y="9" width="5" height="10" rx="1.75"/><path d="M7.5 16h2"/>',
  automation:
    '<path d="M19 12a7 7 0 1 1-2.05-4.95"/><path d="M19.5 4v3.5H16"/><path d="m12.75 8.5-2.5 4h3.5l-2.5 4"/>',
  tag: '<path d="M3.5 11.9V5a1.5 1.5 0 0 1 1.5-1.5h6.9l8.6 8.6a1.5 1.5 0 0 1 0 2.1l-6.8 6.8a1.5 1.5 0 0 1-2.1 0Z"/><circle cx="8" cy="8" r="1.5"/>',
  search: '<circle cx="10.75" cy="10.75" r="6.25"/><path d="m15.25 15.25 4.25 4.25"/>',
  undo: '<path d="M8.5 13.5 4.5 9.5l4-4"/><path d="M4.5 9.5h10a5 5 0 0 1 0 10H11"/>',
  redo: '<path d="m15.5 13.5 4-4-4-4"/><path d="M19.5 9.5h-10a5 5 0 0 0 0 10H13"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.65 2.2c-.7.4-1.15.95-1.15 1.75v.3"/><circle cx="12" cy="16.9" r="1.1" fill="currentColor" stroke="none"/>',
  dotsVertical:
    '<circle cx="12" cy="6" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="18" r="1.4" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8.75" y="8.75" width="10.75" height="10.75" rx="2.5"/><path d="M15.25 8.75V6.5a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v6.75a2 2 0 0 0 2 2h2.25"/>',
  trash:
    '<path d="M4.5 7h15"/><path d="M9.5 7V5.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V7"/><path d="m6.5 7 .85 11.1a2 2 0 0 0 2 1.9h5.3a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10.25 11v5M13.75 11v5"/>',
  chat: '<path d="M6 5h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.25V17H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/><circle cx="8.5" cy="11" r="1.05" fill="currentColor" stroke="none"/><circle cx="12" cy="11" r="1.05" fill="currentColor" stroke="none"/><circle cx="15.5" cy="11" r="1.05" fill="currentColor" stroke="none"/>',
  pencil:
    '<path d="M4.75 19.25l.95-4.05L15.9 5a2 2 0 0 1 2.83 0l.27.27a2 2 0 0 1 0 2.83L8.8 18.3Z"/><path d="M14.1 6.8l3.1 3.1"/>',
  sparkle:
    '<path d="M11 4c.55 4.1 1.9 5.45 6 6-4.1.55-5.45 1.9-6 6-.55-4.1-1.9-5.45-6-6 4.1-.55 5.45-1.9 6-6Z"/><path d="M18 15.5v5M15.5 18h5"/>',
  flask:
    '<path d="M9 3.5h6"/><path d="M10.25 3.5v5.25L5.1 18.2a1.5 1.5 0 0 0 1.32 2.3h11.16a1.5 1.5 0 0 0 1.32-2.3L13.75 8.75V3.5"/><path d="M7.5 14.5h9"/>',
  /** a phone that buzzes: haptic feedback */
  haptic:
    '<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M11 17.5h2"/><path d="M4.5 9v6"/><path d="M19.5 9v6"/>',
  /** a window floating inside the page: the shell's frame */
  frame:
    '<rect x="3" y="4" width="18" height="16" rx="3"/><rect x="7" y="8" width="10" height="8" rx="1.5"/>',
  /** a 3D printer: its frame, the head on its rail with the nozzle, the part rising on the bed */
  // an enclosed printer: its frame, the gantry with a solid carriage and nozzle, the part on the bed, 1.75 clear of it
  printer3d:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 8.5h17"/><rect x="8.5" y="6.75" width="7" height="4" rx="1.25" fill="currentColor" stroke="none"/><path d="M10.75 10.5h2.5L12 13Z" fill="currentColor" stroke="none"/><path d="M6.5 17.5h11"/><rect x="9" y="14.75" width="6" height="2.75" rx=".75" fill="currentColor" stroke="none"/>',
} as const satisfies Record<string, string | readonly [string, number]>;

export type GlyphName = keyof typeof GLYPHS;

export const glyphNames = Object.keys(GLYPHS) as GlyphName[];

/** Glyphs a family brings with its chunk (the appliances' kinds): drawn as the set's own once it has landed. */
const ADDED: Record<string, string> = {};

/** Adds a chunk's glyphs to the set, so `icon('washer')` and a config's `fluvy:washer` draw them. */
export function addGlyphs(table: Readonly<Record<string, string>>): void {
  Object.assign(ADDED, table);
}

export const isGlyph = (name: string | undefined): name is GlyphName =>
  name !== undefined && (name in GLYPHS || Object.hasOwn(ADDED, name));

/**
 * The platforms' logos (`app:netflix`): filled marks on the 24 grid, drawn as the glyphs are and sized to sit with
 * them, brought by the chunk that holds them (`addLogos`) the first time a card draws one. Nothing here until then.
 */
const LOGOS: Record<string, string> = {};

/** Adds a chunk's logos (id → the SVG body) so `icon('app:<id>')` draws them. */
export function addLogos(table: Readonly<Record<string, string>>): void {
  Object.assign(LOGOS, table);
}

export const isLogo = (id: string): boolean => Object.hasOwn(LOGOS, id);

/** A logo as an inline SVG in the current colour; templates are built once and reused. */
export function logo(id: string): TemplateResult {
  let template = logos.get(id);
  if (!template) {
    template = html`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      ${unsafeSVG(LOGOS[id] ?? '')}
    </svg>`;
    logos.set(id, template);
  }
  return template;
}
const logos = new Map<string, TemplateResult>();

export function glyphBody(name: GlyphName): { body: string; strokeWidth: number } {
  const entry: string | readonly [string, number] = Object.hasOwn(GLYPHS, name)
    ? GLYPHS[name]
    : (ADDED[name] ?? '');
  return typeof entry === 'string'
    ? { body: entry, strokeWidth: 1.75 }
    : { body: entry[0], strokeWidth: entry[1] };
}

const cache = new Map<GlyphName, TemplateResult>();

/** The glyph as an inline SVG that inherits `currentColor`. Templates are built once and reused. */
export function glyph(name: GlyphName): TemplateResult {
  let template = cache.get(name);
  if (!template) {
    const { body, strokeWidth } = glyphBody(name);
    template = html`<svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width=${strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      ${unsafeSVG(body)}
    </svg>`;
    cache.set(name, template);
  }
  return template;
}
