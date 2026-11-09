import { css } from 'lit';

/**
 * The engine's sheet: everything a chart or a gauge drawn by it is styled with, one copy for every card that draws
 * one. The classic classes keep their names (`fv-curve`, `curve-line`, `curve-area`, `curve-dot`, `curve-cursor`,
 * `curve-fill-a/b`, `fv-vbar`, `ax-grid`, `ax-tick`, `ax-unit`: the suites and the cards' own rules query them); the
 * engine's own are `fc-*`. A series' ink is the tone its group carries (`--tone-ink`; on `fc-set`, the mode's of the two
 * colours a house's set carries), the accent where none; the fills, the soft copy and the bars derive from it here,
 * once. A card in a lazy chunk adds `chartStyles` to its styles; a core card has the engine adopt it as it lands
 * (`adopt`).
 */
export const chartStyles = css`
  /* ---------- the classic curve (1.0): its line, its fill, its cursor and its dot ---------- */
  .fv-curve .curve-line {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .fv-curve .curve-fill-a {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0.28;
  }
  .fv-curve .curve-fill-b {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0;
  }
  .fv-curve .curve-cursor {
    stroke: var(--fluvy-border-strong);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
  }
  .fv-curve .curve-dot {
    fill: var(--tone-ink, var(--fluvy-accent));
    stroke: var(--fluvy-card);
    stroke-width: 3;
  }
  /* the line draws itself in, then its fill, its dot and its cursor arrive */
  .fv-curve .curve-line {
    stroke-dasharray: 1;
    animation: fv-draw 900ms var(--fv-ease-out) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 120ms);
  }
  .fv-curve .curve-area,
  .fv-curve .curve-dot,
  .fv-curve .curve-cursor {
    animation: fv-fade 500ms var(--fv-ease) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
  }

  /* ---------- the styles (1.11): the line, its soft copy, its fill, the forecast, the marks ---------- */
  /* a style's fills are read from the chart's --fc-fill (the house's 18 %, a flat one two thirds of it, several 16 %);
     in dark mode they take six points more */
  .fc-chart {
    --fc-boost: 0;
  }
  :host([dark]) .fc-chart,
  [data-mode='dark'] .fc-chart {
    --fc-boost: 0.06;
  }
  /* a colour of the house's own set carries itself fitted to the light card and the dark one: it wears the mode's */
  .fc-set {
    --tone-ink: var(--fc-light);
  }
  :host([dark]) .fc-set,
  [data-mode='dark'] .fc-set {
    --tone-ink: var(--fc-dark);
  }
  .fc-line {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    animation: fv-draw 900ms var(--fv-ease-out) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 120ms);
  }
  /* the soft copy: the ink at 55 % over the card, at the house's strength (its stroke-opacity) */
  .fc-glow {
    fill: none;
    stroke: color-mix(in srgb, var(--tone-ink, var(--fluvy-accent)) 55%, var(--fluvy-card));
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .fc-fill-a {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: calc(var(--fc-fill, 0.18) + var(--fc-boost));
  }
  .fc-fill-b {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0;
  }
  .fc-area--flat {
    fill: var(--tone-ink, var(--fluvy-accent));
    fill-opacity: calc(var(--fc-fill, 0.12) + var(--fc-boost));
  }
  .fc-band {
    fill: var(--tone-ink, var(--fluvy-accent));
    fill-opacity: calc(0.14 + var(--fc-boost));
  }
  .fc-area,
  .fc-band,
  .fc-glow,
  .fc-future,
  .fc-now,
  .fc-chart .curve-dot,
  .fc-knob {
    animation: fv-fade 500ms var(--fv-ease) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
  }
  /* the wait above is the first paint's, after the line. Once a chart has been read (its surface says so, scrub.ts)
     the marks that come and go with a read — the cursor, the dot or the knob on each line, and now's knob back at
     rest — arrive as its bubble does: in the short fade, at once (reduced motion: at once, interaction.css) */
  [data-read] .fc-chart :is(.fc-cursor, .curve-cursor, .curve-dot),
  [data-read] .fc-chart ~ .fc-knob {
    animation: fv-fade var(--fv-fast) var(--fv-ease) both;
  }
  /* the forecast: dashed in the disabled ink, or the line's own, faint */
  .fc-future {
    fill: none;
    stroke: var(--fluvy-text-disabled);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 4 5;
  }
  .fc-future--faint {
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-dasharray: none;
    stroke-opacity: 0.35;
  }
  /* a threshold's stretch of a line is the line again in its ink, the forecast's dashes too */
  .fc-future.fc-run {
    stroke: var(--tone-ink, var(--fluvy-accent));
  }
  /* a marked stretch of the plot (a window of the cheapest hours): its tone's fill at a little over half, behind all */
  .fc-stretch {
    fill: var(--tone-fill, var(--fluvy-accent-fill));
    fill-opacity: 0.55;
    animation: fv-fade 500ms var(--fv-ease) both;
    animation-delay: calc(var(--fv-enter-delay, 0ms) + 620ms);
  }
  /* every reading drawn: the classic dot, smaller, its stroke the card's */
  .fv-curve .fc-point {
    stroke-width: 2;
  }
  /* Fluvy's knob on a chart (controls.css draws it): placed by the drawing's coordinates, never taking a pointer */
  .fc-knob {
    pointer-events: none;
  }
  .fc-now,
  .fc-cursor {
    stroke: var(--fluvy-border-strong);
    stroke-width: 1;
  }

  /* ---------- grids and scales: hairlines in the border's colour, the zero line strong, ticks 11/500 ---------- */
  .fc-grid {
    stroke: var(--fluvy-border);
    stroke-width: 1;
  }
  .fc-grid--dashed {
    stroke-dasharray: 3 3;
  }
  .fc-grid--zero {
    stroke: var(--fluvy-border-strong);
    stroke-dasharray: none;
  }
  .ax-grid {
    stroke: var(--fluvy-border);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .ax-tick,
  .ax-unit,
  .fc-tick {
    font-size: 11px;
    font-weight: 500;
    line-height: 16px;
    font-variant-numeric: tabular-nums;
    fill: var(--fluvy-text-secondary);
  }
  /* a scale is read, so the hours under a scaled chart take the secondary ink too, as the ticks do */
  .is-scaled + .fv-axis {
    color: var(--fluvy-text-secondary);
  }

  /* ---------- bars: the classic gradient, the ink, the quiet ones beside the highest, the hollow forecast ---------- */
  .fv-vbar {
    transform-origin: 50% 100%;
    animation: fv-grow-y 560ms var(--fv-ease-out) both;
  }
  .fv-vbar--on {
    fill: var(--tone-ink, var(--fluvy-accent));
  }
  .fv-vbar--off {
    fill: var(--fluvy-border-strong);
  }
  .fv-vbar--forecast {
    fill: var(--tone-fill, var(--fluvy-accent-fill));
  }
  .fc-bar {
    fill: var(--tone-ink, var(--fluvy-accent));
    transform-origin: 50% 100%;
    animation: fv-grow-y 560ms var(--fv-ease-out) both;
  }
  .fc-bar--quiet {
    fill: var(--fluvy-border);
  }
  .fc-bar--hollow {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 1;
    stroke-dasharray: 3 2;
    stroke-opacity: 0.6;
  }
  .fc-bar--sofar {
    fill-opacity: 0.42;
  }
  .fc-bar-a {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0.6;
  }
  .fc-bar-b {
    stop-color: var(--tone-ink, var(--fluvy-accent));
    stop-opacity: 0.48;
  }
  .fc-value {
    font-size: 12px;
    font-weight: 500;
    fill: var(--fluvy-text);
    font-variant-numeric: tabular-nums;
  }
  .fc-value.is-lit {
    font-weight: 600;
  }
  .fc-max {
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 1;
    stroke-dasharray: 2 4;
    stroke-opacity: 0.7;
  }
  .fc-max__word {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    fill: var(--tone-ink, var(--fluvy-accent));
  }

  /* ---------- the bubble in the series' tone, the highlight pill, the legend ---------- */
  .fv-bubble--tone {
    background: var(--tone-ink, var(--fluvy-accent));
    color: #fff;
  }
  .fv-bubble--tone::after {
    background: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    border-radius: 12px;
    background: var(--tone-fill, var(--fluvy-accent-fill));
    color: var(--tone-on, var(--fluvy-accent-on-fill));
    font-size: 12px;
    font-weight: 600;
    line-height: 24px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .fc-pill__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
    color: var(--fluvy-text-secondary);
  }
  .fc-legend__item {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .fc-legend__swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 3px;
    background: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-legend__name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .fc-legend__value {
    color: var(--fluvy-text);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* ---------- gauges: the ring and the reading in its middle (the dial and the ruler are the controls') ---------- */
  .fc-gauge {
    position: relative;
    margin: 0 auto;
  }
  .fc-gauge > svg {
    display: block;
    overflow: visible;
  }
  .fc-ring__track,
  .fc-ring__lit {
    fill: none;
  }
  .fc-ring__track {
    stroke: var(--fluvy-border);
  }
  .fc-ring__lit {
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-linecap: round;
  }
  .fc-gauge__value {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    text-align: center;
  }
  .fc-gauge__value b {
    font-size: 32px;
    font-weight: 700;
    line-height: 36px;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--fluvy-text);
  }
  .fc-gauge__value span {
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
    color: var(--fluvy-text-secondary);
  }
  .fc-gauge__label {
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .fc-gauge--small .fc-gauge__value b {
    font-size: 22px;
    line-height: 28px;
  }
  /* the ruler over its reading, centred, as a mark's: 12 between them, a tile's 8 */
  .fc-gauge--ruler {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .fc-gauge--ruler.fc-gauge--small {
    gap: 8px;
  }

  /* ---------- the moving gauges: a scene in the gauge's room, its reading by rule ---------- */
  .fc-scene {
    position: relative;
    flex: none;
  }
  .fc-scene svg {
    display: block;
  }
  .fc-scene--box {
    overflow: hidden;
    border-radius: var(--fluvy-radius-lg, 16px);
  }
  .fc-scene--box > svg {
    position: absolute;
    left: 0;
    top: 0;
  }
  .fc-scene--small.fc-scene--box,
  .fc-scene--small .fc-air__band {
    border-radius: var(--fluvy-radius-control, 12px);
  }
  /* a mark over its reading, centred */
  .fc-scene--mark {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  /* the reading: the figure (its value bold, its unit after it in the secondary ink), a word under it */
  .fc-reading {
    display: flex;
    flex-direction: column;
    white-space: nowrap;
    pointer-events: none;
  }
  .fc-scene--box > .fc-reading {
    position: absolute;
  }
  .fc-reading--under {
    align-items: center;
    text-align: center;
  }
  .fc-reading__figure {
    display: flex;
    align-items: baseline;
    gap: 3px;
    font-size: 15px;
    font-weight: 500;
    line-height: 36px;
    color: var(--fluvy-text-secondary);
  }
  /* the unit on the value's baseline, its own line no taller than itself: the figure's line is the value's */
  .fc-reading__figure span {
    line-height: 1;
  }
  .fc-reading__figure b {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--fluvy-text);
  }
  .fc-reading__word {
    font-size: 13px;
    font-weight: 500;
    line-height: 20px;
    color: var(--fluvy-text-secondary);
  }
  .fc-reading--m .fc-reading__figure {
    font-size: 13px;
    line-height: 28px;
  }
  .fc-reading--m b {
    font-size: 24px;
  }
  .fc-reading--s .fc-reading__figure {
    font-size: 12px;
    line-height: 24px;
  }
  .fc-reading--s b {
    font-size: 20px;
  }
  .fc-reading--m .fc-reading__word,
  .fc-reading--s .fc-reading__word {
    font-size: 12px;
    line-height: 16px;
  }
  /* in the water: the card's colour over the ink */
  .fc-reading.is-wet b {
    color: var(--fluvy-card);
  }
  .fc-reading.is-wet .fc-reading__figure,
  .fc-reading.is-wet .fc-reading__word {
    color: color-mix(in srgb, var(--fluvy-card) 80%, transparent);
  }

  /* the liquid and the tank: the tone's fill, two waves of its ink, light bubbles in both modes */
  .fc-water {
    background: var(--tone-fill, var(--fluvy-accent-fill));
  }
  /* without a reading, an empty box (and an air without wind) in the grey the sky has then: its room kept, out of reach
     too, where the card is the page's */
  .fc-water.fv-tone--neutral,
  .fv-tone--neutral .fc-air__band,
  .fc-sky {
    background: color-mix(
      in srgb,
      var(--fc-sky, var(--fluvy-text-disabled)) 11%,
      var(--fluvy-card)
    );
  }
  .fc-water__back,
  .fc-water__front,
  .fc-battery__charge {
    fill: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-water__back {
    fill-opacity: 0.9;
  }
  .fc-water__front {
    fill-opacity: 0.5;
  }
  .fc-water--tank .fc-water__back {
    fill-opacity: 0.45;
  }
  .fc-water--tank .fc-water__front {
    fill-opacity: 0.85;
  }

  /* the sky, tinted by the comfort's tone: cold the fifth series colour, mild the accent, warm the warning, extreme
     the danger (stronger) */
  .fc-sky {
    --fc-sky: var(--fluvy-graph-5);
  }
  .fc-sky--mild {
    --fc-sky: var(--fluvy-accent);
  }
  .fc-sky--warm {
    --fc-sky: var(--fluvy-warning);
  }
  .fc-sky--extreme {
    --fc-sky: var(--fluvy-danger);
    background: color-mix(in srgb, var(--fc-sky) 16%, var(--fluvy-card));
  }
  .fc-sky--none {
    --fc-sky: var(--fluvy-text-disabled);
  }
  .fc-snow line {
    stroke: var(--fc-sky);
    stroke-width: 1.25;
    stroke-linecap: round;
  }
  .fc-sky__drift,
  .fc-sky__cloud {
    fill: color-mix(in srgb, #fff 60%, var(--fluvy-card));
  }
  .fc-sky__edge {
    fill: none;
    stroke: var(--fc-sky);
    stroke-opacity: 0.35;
    stroke-width: 1.5;
  }
  .fc-sky__cloud {
    stroke: var(--fc-sky);
    stroke-opacity: 0.25;
    stroke-width: 1.25;
    stroke-linejoin: round;
  }
  .fc-sky__hill {
    fill: var(--fluvy-graph-4);
    fill-opacity: 0.45;
  }
  .fc-sky__ground {
    fill: var(--fluvy-warning);
    fill-opacity: 0.4;
  }
  .fc-sky__ground--dunes {
    fill-opacity: 0.55;
  }
  .fc-sky__plain {
    fill: var(--fluvy-border);
  }
  .fc-sky__cactus {
    fill: none;
    stroke: var(--fluvy-success);
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* Fluvy's sun, outlined */
  .fc-sky__halo {
    fill: var(--fluvy-state-energy-solar-fill);
  }
  .fc-sky__rays line {
    stroke: var(--fluvy-state-energy-solar);
    stroke-linecap: round;
  }
  .fc-sky__sun {
    fill: var(--fluvy-state-energy-solar-fill);
    stroke: var(--fluvy-state-energy-solar);
  }

  /* the battery: its outline in the strong border on the page, its charge in the tone */
  .fc-battery__shape {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .fc-battery__nub {
    width: 36%;
    margin-bottom: -2px;
    border-radius: 2.5px 2.5px 0 0;
    background: var(--fluvy-border-strong);
  }
  .fc-battery__body {
    position: relative;
    box-sizing: border-box;
    width: 100%;
    border: 2.5px solid var(--fluvy-border-strong);
    background: var(--fluvy-page);
  }
  .fc-battery__well {
    position: absolute;
    inset: 4px;
    overflow: hidden;
  }
  .fc-battery__bolt {
    position: absolute;
    left: 50%;
    top: 50%;
    overflow: visible;
    transform: translate(-50%, -50%);
  }

  /* the pulse and the sun: a disc in the tone, its halo, its rings (below) or its rays */
  .fc-pulse__halo,
  .fc-pulse__disc,
  .fc-sun__glow,
  .fc-sun__core {
    fill: var(--tone-ink, var(--fluvy-accent));
  }
  .fc-pulse__bolt {
    fill: var(--fluvy-card);
  }
  .fc-sun__rays line {
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-linecap: round;
  }

  /* the air: streamlines in the tone over a band of the page */
  .fc-air__band {
    overflow: hidden;
    border-radius: var(--fluvy-radius-lg, 16px);
    background: var(--fluvy-page);
  }
  .fc-air__line {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 2;
    stroke-linecap: round;
  }

  /* the motion, one keyframe set: transform, opacity and the dash offset only. What exists only moving (a bubble,
     light in both modes; a ring; a flake) starts unseen, so a gauge at rest has none */
  .fc-wave {
    animation: fc-wave var(--d, 9s) linear infinite;
  }
  .fc-bubble {
    fill: rgb(255 255 255 / 0.75);
    opacity: 0;
    transform-box: fill-box;
    animation: fc-bubble var(--d, 3s) ease-in var(--delay, 0s) infinite;
  }
  .fc-pulse__ring {
    fill: none;
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 2;
    opacity: 0;
    transform-box: fill-box;
    transform-origin: center;
    animation: fc-pulse var(--d, 2s) cubic-bezier(0.2, 0.6, 0.3, 1) var(--delay, 0s) infinite;
  }
  .fc-dash {
    animation: fc-dash var(--d, 3s) linear infinite;
  }
  .fc-spin {
    transform-box: view-box;
    animation: fc-spin var(--d, 30s) linear infinite;
  }
  .fc-breath {
    opacity: var(--o1, 0.2);
    transform-box: fill-box;
    transform-origin: center;
    animation: fc-breath var(--d, 4s) ease-in-out infinite;
  }
  .fc-snow {
    opacity: 0;
    animation: fc-snow var(--d, 5s) linear var(--delay, 0s) infinite;
  }
  .fc-drift {
    animation: fc-drift var(--d, 24s) linear infinite;
  }
  /* the haze: short wavy strokes in the sky's tone, rising off the ground */
  .fc-haze {
    fill: none;
    stroke: var(--fc-sky);
    stroke-opacity: 0.55;
    stroke-width: 1.5;
    stroke-linecap: round;
    animation: fc-haze var(--d, 3s) ease-in-out var(--delay, 0s) infinite;
  }
  /* the battery's bolt, glowing while it charges */
  .fc-bolt {
    fill: var(--fluvy-card);
    stroke: var(--tone-ink, var(--fluvy-accent));
    stroke-width: 1;
    stroke-linejoin: round;
    animation: fc-glow 1.6s ease-in-out infinite;
  }
  @keyframes fc-wave {
    to {
      transform: translateX(var(--shift, -50%));
    }
  }
  @keyframes fc-bubble {
    0% {
      transform: translateY(0);
      opacity: 0;
    }
    12% {
      opacity: 0.85;
    }
    85% {
      opacity: 0.7;
    }
    100% {
      transform: translateY(var(--rise, -60px));
      opacity: 0;
    }
  }
  @keyframes fc-pulse {
    0% {
      transform: scale(1);
      opacity: 0.5;
    }
    100% {
      transform: scale(var(--k, 2.2));
      opacity: 0;
    }
  }
  @keyframes fc-dash {
    to {
      stroke-dashoffset: var(--loop, -240px);
    }
  }
  @keyframes fc-spin {
    to {
      transform: rotate(360deg);
    }
  }
  @keyframes fc-breath {
    0%,
    100% {
      transform: scale(1);
      opacity: var(--o1, 0.2);
    }
    50% {
      transform: scale(1.12);
      opacity: var(--o2, 0.35);
    }
  }
  @keyframes fc-snow {
    0% {
      transform: translate(0, 0);
      opacity: 0;
    }
    15% {
      opacity: 0.85;
    }
    50% {
      transform: translate(var(--sway, 6px), calc(var(--fall, 60px) * 0.5));
    }
    90% {
      opacity: 0.8;
    }
    100% {
      transform: translate(0, var(--fall, 60px));
      opacity: 0;
    }
  }
  @keyframes fc-drift {
    0% {
      transform: translateX(0);
      opacity: 0;
    }
    12% {
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translateX(var(--span, 300px));
      opacity: 0;
    }
  }
  @keyframes fc-haze {
    0% {
      transform: translateY(0);
      opacity: 0;
    }
    30% {
      opacity: 1;
    }
    100% {
      transform: translateY(var(--rise, -14px));
      opacity: 0;
    }
  }
  @keyframes fc-glow {
    0%,
    100% {
      opacity: 0.95;
    }
    50% {
      opacity: 0.55;
    }
  }
  /* a gauge told not to move, or a system (or the house) that asks for less: its first frame — the waves, the rays
     and the cloud where they start, what exists only moving gone */
  .fc-scene.is-still * {
    animation: none !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .fc-scene * {
      animation: none !important;
    }
  }
  :host([reduced-motion]) .fc-scene * {
    animation: none !important;
  }

  /* a chart told not to move: its resting frame at once, whatever the system says of motion */
  .fc-chart.is-still,
  .fc-chart.is-still *,
  .fc-chart.is-still ~ .fc-knob {
    animation: none !important;
  }
`;

/**
 * The engine's sheet into a card's shadow root, once, beside the card's own (as the light card's colour controls
 * adopt theirs): a core card fetches the engine on demand and adopts it as it lands.
 */
export function adopt(root: ShadowRoot): void {
  const sheet = chartStyles.styleSheet;
  if (sheet) {
    if (!root.adoptedStyleSheets.includes(sheet))
      root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  } else if (!root.querySelector('style[data-fluvy-chart]')) {
    // no constructible sheets: a style element ahead of what Lit renders, where its own fallback puts them
    const element = document.createElement('style');
    element.dataset['fluvyChart'] = '';
    element.textContent = chartStyles.cssText;
    root.prepend(element);
  }
}
