/**
 * The chart engine (1.11): every chart and gauge of the house drawn by one set of rules, in its own chunk (`chart`),
 * reached by a core card through `ChartLoader` (`shared/chart-load.ts`: fetched once at start, its sheet adopted as it
 * lands) and by a card in a lazy chunk by a static import (energy, history bars, the History page …), which adds
 * `chartStyles` to its own.
 *
 * The API (what the adopting cards, the Chart card and the settings panel build on):
 *
 *   resolveStyle(preset, fine, caps, house?)  a card's style: its own key (`chart`, the fine keys of
 *                                             `shared/chart-config.ts`) › the house's chart settings
 *                                             (`chartDefaults()`, fluvy's settings → Charts) › the style's own
 *                                             defaults (`CHART_PRESETS`); `resolveGauge` likewise for `gauge`
 *   drawChart(spec)                           the drawing (`draw.ts`): a frame (width, height, headroom, pad, the
 *                                             scale's column), the series (evenly spaced values, `null` a gap, a
 *                                             tone, a series colour or a colour of their own, a band), the style,
 *                                             the scale, the extent, `now`, the cursor; `data-measure="drawn"` on
 *                                             the svg, Fluvy's knobs beside it (the wrapper is the card's,
 *                                             positioned, as for the bubble)
 *   plotOf(spec) · readAt(spec, fraction)     where the plot is (the axis row starts at its `left`); where each line
 *                                             is at a fraction of the plot, and the reading there: the bubble's place
 *   chartBubble(o)                            the value bubble (`decor.ts`): `look` the style's, `lean` 16 for classic
 *   drawRead(spec, read, rest, family?)       a chart and its bubble: what it reads at its cursor, else what has
 *                                             happened ends on where the style labels it, placed by the style
 *   drawGauge(o)                              a gauge in its style (`gauge.ts`): Fluvy's controls read-only — ticks,
 *                                             dial, ring, ruler — or a gauge that moves with what it reads
 *                                             (`scenes.ts`: liquid, thermo, tank, battery, pulse, air, sun), in its
 *                                             room; `movingFor(reads)` the ones that read a sensor
 *   ScrubController · scrub(controller)       reading a chart by pointing at it (`scrub.ts`): one owner for every
 *                                             chart that scrubs, the keys that read it without a pointer
 *   timeLine(o) · pastLine(…)                 a line through time (`timeline.ts`, 1.18): the recorder's readings
 *                                             laid on the house's round times as calmly as the plot's width and
 *                                             the style's stroke allow, or every 5, 15, 30 min or hour (`points`),
 *                                             and read where it is pointed at as Home Assistant reads them; a
 *                                             sensor's last hours; `everyWord` · `windowWord` say a step and a window
 *   chartSection(caps, capsOf?) · chartDefaultsFor(config, caps) · chartKeysFor(caps) · gaugeField(options)
 *                                             the editor's Chart section (`fields.ts`): an editor opens once the
 *                                             engine has landed (`Card.getConfigElement`)
 *   chartStyles · adopt(root)                 the engine's sheet (`styles.ts`)
 *   HOUSE_ACTS                                the house's chart settings each style draws with: what the
 *                                             settings panel offers for the style chosen
 *   previewStyle · previewGauge · previewChart · previewSeries
 *                                             the settings panel's Charts tab (`preview.ts`): a style's tile, a
 *                                             gauge's, the preview of a chart, its bars and a gauge in one mode, a
 *                                             set of series colours — each on the settings being chosen, at least
 *                                             `PREVIEW_LEAST` across
 *   the maths, pure and tested: `scale.ts` (tightScale, airScale, niceTicks, niceStep, yOf), `path.ts`
 *   (linePath, areaPath, bandPath, yAt, splitAt), `bars.ts` (barGeometry, barPath, columns, thinStep, labelled,
 *   labelsApart), `axis.ts` (tickText, gridLines, tickLabels, unitLabel, quarterTicks, roundTicks), `ring.ts` (polar,
 *   arcPath, arcDash, radialTicks, knobAt), `model.ts` (bucket, readingsOf), `palette.ts`
 *   (seriesPaint, fitSet: a house's set fitted to each mode's card, seriesCheck: what fitting cannot fix,
 *   PALETTE_REFS · refInk · refHex: the colours of the palette's a set or a series may name, as tokens and as hexes)
 *
 * The 1.10 geometry is kept byte for byte (`classic.test.ts` against `__fixtures__/classic-1.10.json`): a card that
 * says `chart: classic`, and every card until the house chooses another style, draws exactly what it drew.
 */
import '../english.js';

export type {
  ChartPoint,
  ChartSeries,
  Curve,
  SeriesColour,
  Stretch,
  Threshold,
  Window,
} from './model.js';
export { bucket, readingsOf, type BucketRule, type Readings } from './model.js';
export {
  airScale,
  niceStep,
  niceTicks,
  tightScale,
  yOf,
  type NiceStep,
  type PlotBox,
  type Scale,
  type Ticks,
  type TightScale,
} from './scale.js';
export { areaPath, bandPath, linePath, runsOf, splitAt, yAt, type Pt } from './path.js';
export {
  barGeometry,
  barPath,
  columns,
  labelled,
  labelsApart,
  thinStep,
  type BarGeometry,
  type Column,
  type ColumnsOptions,
  type Placed,
  type Rounded,
} from './bars.js';
export {
  AXIS_GAP,
  gridClass,
  gridLines,
  quarterTicks,
  roundTicks,
  tickLabels,
  tickText,
  UNIT_COLUMN,
  unitLabel,
  type MarksOptions,
  type QuartersOptions,
  type TimeTick,
} from './axis.js';
export {
  arcDash,
  arcPath,
  knobAt,
  polar,
  radialTicks,
  signedTicks,
  type RadialTicksOptions,
  type Tick,
} from './ring.js';
export {
  chartBubble,
  cursorLine,
  dot,
  highlightPill,
  KNOB,
  knob,
  legend,
  nowLine,
  point,
  shadowCopy,
  type BubbleOptions,
  type LegendItem,
} from './decor.js';
export { dialRadius, drawGauge, type GaugeOptions } from './gauge.js';
export {
  chartDefaultsFor,
  chartKeysFor,
  chartSection,
  gaugeField,
  seriesColourField,
  type CapsOf,
} from './fields.js';
export {
  ACTS,
  acts,
  CHART_KEYS,
  CHART_PRESETS,
  chartKeysOf,
  GAUGE_PRESETS,
  gaugeReads,
  HOUSE_ACTS,
  isBars,
  MOVING,
  movingFor,
  presetsFor,
  resolveGauge,
  resolveStyle,
  styleOf,
  type GaugeSpec,
  type HouseKey,
  type PresetSpec,
  type Reads,
  type ResolvedGauge,
  type ResolvedStyle,
} from './presets.js';
export {
  fitSet,
  PALETTE_REFS,
  refHex,
  refInk,
  seriesCheck,
  seriesPaint,
  setInks,
  type FittedSet,
  type SeriesPaint,
  type SeriesWarning,
} from './palette.js';
export { adopt, chartStyles } from './styles.js';
export { scrub, ScrubController, scrubFraction } from './scrub.js';
export {
  everyWord,
  pastLine,
  timeLine,
  windowWord,
  type LineStyle,
  type Timed,
  type TimeLine,
  type TimeLineOptions,
} from './timeline.js';
export {
  drawChart,
  drawRead,
  plotOf,
  readAt,
  type ChartFrame,
  type ChartSpec,
  type Reading,
} from './draw.js';
export {
  PREVIEW_LEAST,
  previewChart,
  previewGauge,
  previewSeries,
  previewStyle,
  type ChartPreviewOptions,
  type GaugePreviewOptions,
} from './preview.js';
