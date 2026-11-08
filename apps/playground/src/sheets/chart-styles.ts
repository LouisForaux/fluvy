import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from '@fluvy/core';
import { axis, baseStyles, head, textWidth } from '@fluvy/ui';
import { css, html, LitElement, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { FluvySensorCard } from '../../../../packages/cards/src/sensor/sensor-card.js';
import {
  loadChartEngine,
  type ChartEngine,
} from '../../../../packages/cards/src/shared/chart-load.js';
import type { ScrubController } from '../../../../packages/cards/src/chart/engine/index.js';
import { mergeWs, type FrameSpec, type SheetSpec } from '../scenes.js';
import { sheet as arrays } from './arrays.js';
import { sheet as energy } from './energy.js';
import { sheet as flow } from './flow.js';
import { sheet as historyBars } from './history-bars.js';
import { sheet as solar } from './solar.js';

if (!customElements.get('fluvy-sensor-card'))
  customElements.define('fluvy-sensor-card', FluvySensorCard);

/*
 * The chart styles (1.11), the review page's source: every `chart` style on one day of temperature (the design
 * page's), the tile's spark, two sensors on one chart, every `gauge` style on one value, and a frame per fine key at
 * its values. The house's chart settings come from the page (`&charts={"style":"soft","fill":24}`): the same frames
 * under another house. Light and dark are the page's (`&mode=dark`).
 */

const NOW = '2026-09-17T21:47:12';

/** The design page's day, at the 48 points a card asks for. */
const day = (f: (t: number) => number): number[] =>
  Array.from({ length: 48 }, (_unused, i) => Math.round(f(i / 47) * 10) / 10);
const TEMPERATURE = day(
  (t) =>
    17.8 +
    6.9 * Math.exp(-((t - 0.62) ** 2) / 0.07) +
    0.9 * Math.sin(t * 9) * Math.exp(-t) -
    1.4 * t,
);
const HUMIDITY = day((t) => 58 - 18 * Math.exp(-((t - 0.6) ** 2) / 0.08) + 2.5 * Math.sin(t * 7));

/**
 * The design page's day as the recorder answers it: a reading at the start of each of the window's 48 slots, so a card
 * that asks 48 points reads it back whole, each slot's mean its one reading — 1.10's strings (`classic-1.10.json`).
 */
const DESIGN_DAY: Readonly<Record<string, readonly number[]>> = {
  'sensor.cs_temperature': TEMPERATURE,
  'sensor.cs_humidity': HUMIDITY,
};
const designDay = (message: Record<string, unknown>): Record<string, unknown> => {
  const start = Date.parse(String(message['start_time']));
  const end = Date.parse(String(message['end_time']));
  return Object.fromEntries(
    (message['entity_ids'] as readonly string[]).flatMap((id) => {
      const series = DESIGN_DAY[id] ?? [];
      return series.length
        ? [
            [
              id,
              series.map((v, i) => ({
                s: String(v),
                lu: (start + (i / series.length) * (end - start)) / 1000,
              })),
            ],
          ]
        : [];
    }),
  );
};
/** The house's day of energy, an hour a slot (kWh): a quiet night, the morning, the evening's peak. */
const USAGE = Array.from(
  { length: 24 },
  (_unused, h) =>
    Math.round(
      (0.3 + 0.9 * Math.exp(-((h - 8) ** 2) / 3) + 1.6 * Math.exp(-((h - 20) ** 2) / 4)) * 100,
    ) / 100,
);
/** Its meter over the day (kWh, counting up), at the 48 points a card asks for: a half hour's use a point. */
const METER = USAGE.flatMap((kwh) => [kwh / 2, kwh / 2]).reduce<number[]>(
  (sums, half, i) => [...sums, Math.round(((sums[i - 1] ?? 1824) + half) * 1000) / 1000],
  [],
);

/** The readings' lows and highs, as a summary keeps them: the band drawn behind the line. */
const BAND = {
  low: TEMPERATURE.map((v, i) => Math.round((v - 1.6 - 0.4 * Math.sin(i / 5)) * 10) / 10),
  high: TEMPERATURE.map((v, i) => Math.round((v + 1.2 + 0.5 * Math.cos(i / 4)) * 10) / 10),
};
/** Now, two thirds into the day: the rest is forecast. */
const NOW_AT = 2 / 3;

const MEASURE = { state_class: 'measurement' };

/** A sensor card over the design page's day (its 24 hours, where the house shows 12). */
const sensor = (more: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-sensor-card',
  entity: 'sensor.cs_temperature',
  hours: 24,
  _now: NOW,
  ...more,
});

/** Every style the sensor draws (a band needs a band: the Chart card's). */
const STYLES = ['classic', 'soft', 'glow', 'minimal', 'step', 'bars', 'columns'] as const;
const GAUGES = ['ticks', 'dial', 'ring', 'ruler'] as const;

/**
 * A gauge drawn by the engine in a card of its own, until the gauge cards adopt the styles: its style, a reading of
 * 62 % (or none), a tile at half a section.
 */
class ChartGauge extends LitElement implements LovelaceCard {
  static override styles = [
    ...baseStyles,
    css`
      :host {
        display: block;
      }
      .pg-gauge {
        display: flex;
        justify-content: center;
        margin-top: 16px;
      }
    `,
  ];

  static override properties = {
    config: { state: true },
    engine: { state: true },
    wide: { state: true },
  };

  declare config: { gauge?: string; title?: string; value?: number | null };
  declare engine: ChartEngine | undefined;
  declare wide: number;
  private readonly watch = new ResizeObserver(([entry]) => {
    this.wide = Math.floor(entry?.contentRect.width ?? 0);
  });

  constructor() {
    super();
    this.config = {};
    this.wide = 0;
  }

  setConfig(config: LovelaceCardConfig): void {
    this.config = config as ChartGauge['config'];
  }

  set hass(_hass: HomeAssistant) {
    // the reading is the config's: nothing of the house's is read
  }

  getCardSize(): number {
    return 4;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch.observe(this);
    void loadChartEngine().then((engine) => {
      engine.adopt(this.renderRoot as ShadowRoot);
      this.engine = engine;
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.watch.disconnect();
  }

  protected override shouldUpdate(changed: PropertyValues): boolean {
    return changed.size > 0;
  }

  protected override render(): TemplateResult {
    const engine = this.engine;
    // a tile is half a section: under the full card's floor (211)
    const small = this.wide < 211;
    // the card's content: its width less the card's 20 on each side (16 in a tile)
    const content = Math.max(0, this.wide - (small ? 32 : 40));
    const style = engine?.resolveGauge(this.config.gauge as 'ticks', {});
    const size = style?.preset === 'ruler' ? content : Math.min(small ? 120 : 176, content);
    return html`<article class="fv-card ${small ? 'fv-tile' : ''}" data-card>
      ${head({ icon: small ? null : 'drop', tone: 'water', title: this.config.title ?? 'Humidity', name: true })}
      <div class="pg-gauge">
        ${
          engine && style && size > 0
            ? engine.drawGauge({
                style,
                size,
                min: 0,
                max: 100,
                value: this.config.value === undefined ? 62 : this.config.value,
                format: (value) => String(Math.round(value)),
                unit: '%',
                tone: 'water',
                small,
              })
            : nothing
        }
      </div>
    </article>`;
  }
}
if (!customElements.get('pg-chart-gauge')) customElements.define('pg-chart-gauge', ChartGauge);

/**
 * A day with its forecast, drawn by the engine in a card of its own until the Chart card draws it: the style the
 * config names, now at two thirds of the day (the past solid, the forecast as the style says, now marked), a band of
 * the readings' lows and highs, read by pointing at it or by the keys (← → Home End Escape), its bubble saying when.
 */
class ChartSample extends LitElement implements LovelaceCard {
  static override styles = [
    ...baseStyles,
    css`
      :host {
        display: block;
      }
      .pg-chart {
        position: relative;
        height: 120px;
        margin-top: 16px;
        outline: none;
      }
    `,
  ];

  static override properties = {
    config: { state: true },
    engine: { state: true },
    wide: { state: true },
  };

  declare config: { chart?: string; title?: string };
  declare engine: ChartEngine | undefined;
  declare wide: number;
  private scrubber: ScrubController | undefined;
  private readonly watch = new ResizeObserver(([entry]) => {
    this.wide = Math.floor(entry?.contentRect.width ?? 0);
  });

  constructor() {
    super();
    this.config = {};
    this.wide = 0;
  }

  setConfig(config: LovelaceCardConfig): void {
    this.config = config as ChartSample['config'];
  }

  set hass(_hass: HomeAssistant) {
    // the day is the sheet's
  }

  getCardSize(): number {
    return 4;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.watch.observe(this);
    void loadChartEngine().then((engine) => {
      engine.adopt(this.renderRoot as ShadowRoot);
      this.scrubber = new engine.ScrubController(this);
      this.engine = engine;
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.watch.disconnect();
  }

  protected override render(): TemplateResult {
    const engine = this.engine;
    const width = Math.max(0, this.wide - 40);
    const name = this.config.chart ?? 'soft';
    if (!engine || !this.scrubber || width <= 0)
      return html`<article class="fv-card" data-card>
        ${head({ icon: 'chart', tone: 'heat', title: this.config.title ?? name, name: true })}
      </article>`;
    const style = engine.resolveStyle(
      name as 'soft',
      {},
      { now: true, bars: true, band: true, axis: true },
    );
    // bars stand for what adds up: the day's energy, an hour a bar, from zero; the lines read the temperature
    const slotted = engine.isBars(style.preset);
    const values = slotted ? USAGE : TEMPERATURE;
    const spec = {
      frame: { width, height: 120, headroom: 44 },
      series: [{ values, band: BAND }],
      style,
      zero: slotted,
      now: NOW_AT,
      cursor: this.scrubber.value,
      id: 'pg',
      tick: (value: number, decimals: number) => engine.tickText(undefined, value, decimals),
      measure: (text: string) => textWidth(text, { size: 11, weight: 500, tabular: true }),
      value: (value: number) => value.toFixed(1),
      maxWord: 'MAX',
    };
    const plot = engine.plotOf(spec);
    const read = engine.readAt(spec, this.scrubber.value);
    const hours = (fraction: number): string =>
      `${String(Math.floor(fraction * 24) % 24).padStart(2, '0')}:00`;
    const reading = values[read.index] ?? 0;
    const bubble =
      this.scrubber.value !== null || style.label
        ? engine.chartBubble({
            x: read.x,
            width,
            start: plot.left,
            lean: style.preset === 'classic' ? 16 : 0,
            value: reading.toFixed(1),
            unit: slotted ? 'kWh' : '°C',
            ...(this.scrubber.value !== null
              ? { time: hours((read.x - plot.left) / plot.width) }
              : {}),
            look: style.bubble,
          })
        : nothing;
    return html`<article class="fv-card fv-tone--heat" data-card>
      ${head({ icon: 'chart', tone: 'heat', title: this.config.title ?? name, name: true })}
      <div
        class="pg-chart"
        tabindex="0"
        style="width:${width}px"
        ${engine.scrub(this.scrubber)}
        @keydown=${(event: KeyboardEvent) => this.scrubber?.key(event)}
      >
        ${engine.drawChart(spec)}${bubble}
      </div>
      <div style="margin-inline-start:${plot.left}px">
        ${axis([
          [0, '00:00'],
          [0.5, '12:00'],
          [1, '24:00'],
        ])}
      </div>
    </article>`;
  }
}
if (!customElements.get('pg-chart-sample')) customElements.define('pg-chart-sample', ChartSample);

const gauge = (name: string, more: Record<string, unknown> = {}) => ({
  type: 'pg-chart-gauge',
  gauge: name,
  ...more,
});

/** A fine key at each of its values, on the style that acts on it. */
const fine = (
  title: string,
  chart: string,
  key: string,
  values: readonly unknown[],
): FrameSpec => ({
  title,
  cards: values.map((value) => sensor({ chart, [key]: value, name: `${key}: ${String(value)}` })),
});

/**
 * The cards that take the styles (1.11), each in a style it draws, as its own sheet draws it with that sheet's house
 * (its states, its history and statistics, its Energy dashboard): what the measurer reads in every language. The
 * chart suite reads the sheets themselves under the house's soft.
 */
// the flow's house first: its Energy dashboard is the one the stacked charts read (the first answer is the house's)
const HOUSES = [flow, energy, solar, arrays, historyBars] as const;
const from = (house: SheetSpec, title: string, style: Record<string, unknown>) =>
  (house.frames.find((frame) => frame.title === title)?.cards ?? []).map((card) => ({
    ...card,
    ...style,
  }));
const ADOPTED: readonly FrameSpec[] = [
  { title: 'Adopted · energy · soft', cards: from(energy, 'Energy', { chart: 'soft' }) },
  {
    title: 'Adopted · energy · step, compact',
    width: 392,
    cards: from(energy, 'Energy · compact', { chart: 'step' }),
  },
  {
    title: 'Adopted · by source · soft',
    cards: from(flow, 'House power by source', { chart: 'soft' }),
  },
  {
    title: 'Adopted · the whole house · step',
    cards: from(flow, 'The whole house', { chart: 'step' }),
  },
  {
    title: 'Adopted · history bars · bars',
    cards: from(historyBars, 'Solar production', { chart: 'bars', highlight: 'max' }),
  },
  {
    title: 'Adopted · history bars · columns, mini minimal',
    cards: [
      ...from(historyBars, 'Compact', { chart: 'columns' }),
      ...from(historyBars, 'Mini', { chart: 'minimal' }),
    ],
  },
  { title: 'Adopted · production · soft', cards: from(solar, 'Production', { chart: 'soft' }) },
  { title: 'Adopted · arrays · columns', cards: from(arrays, 'Two arrays', { chart: 'columns' }) },
  {
    title: 'Adopted · gauge · dial, ring',
    cards: [
      ...from(solar, 'Solar power', { gauge: 'dial' }),
      ...from(solar, 'Solar power', { gauge: 'ring' }),
    ],
  },
  { title: 'Adopted · humidity · ruler', cards: from(solar, 'Humidity', { gauge: 'ruler' }) },
  {
    title: 'Adopted · distribution, bars · soft',
    cards: [
      ...from(solar, 'Distribution', { chart: 'soft' }),
      ...from(solar, 'Strings & inverter', { chart: 'soft' }),
    ],
  },
];

export const sheet: SheetSpec = {
  states: [
    [
      'sensor.cs_temperature',
      String(TEMPERATURE[47]),
      {
        friendly_name: 'Living room',
        unit_of_measurement: '°C',
        device_class: 'temperature',
        ...MEASURE,
      },
    ],
    [
      'sensor.cs_humidity',
      String(HUMIDITY[47]),
      {
        friendly_name: 'Living room humidity',
        unit_of_measurement: '%',
        device_class: 'humidity',
        ...MEASURE,
      },
    ],
    [
      'sensor.cs_energy',
      String(METER[47]),
      {
        friendly_name: 'House energy',
        unit_of_measurement: 'kWh',
        device_class: 'energy',
        state_class: 'total_increasing',
      },
    ],
    // the adopted cards' houses
    ...HOUSES.flatMap((house) => house.states),
  ],
  history: Object.assign(
    { 'sensor.cs_energy': METER },
    ...HOUSES.map((house) => house.history ?? {}),
  ),
  statistics: Object.assign({}, ...HOUSES.map((house) => house.statistics ?? {})),
  ws: mergeWs([{ 'history/history_during_period': designDay }, ...HOUSES.map((house) => house.ws)]),
  frames: [
    // the lines on the day's temperature; the bars on the house's meter, whose readings add up
    ...STYLES.map((chart) => ({
      title: `Style · ${chart}`,
      cards: [
        sensor({
          chart,
          ...(chart === 'bars' || chart === 'columns' ? { entity: 'sensor.cs_energy' } : {}),
        }),
      ],
    })),
    {
      title: 'Tiles · classic and minimal',
      cards: [
        sensor({ variant: 'tile', chart: 'classic', name: 'Classic', cols: 6 }),
        sensor({ variant: 'tile', chart: 'minimal', name: 'Minimal', cols: 6 }),
      ],
    },
    ...(['classic', 'soft', 'step'] as const).map((chart) => ({
      title: `Several · ${chart}`,
      cards: [sensor({ chart, entities: ['sensor.cs_humidity'] })],
    })),
    ...(['classic', 'soft', 'glow', 'minimal', 'step', 'bars', 'columns', 'band'] as const).map(
      (chart) => ({
        title: `Forecast · ${chart}`,
        cards: [{ type: 'pg-chart-sample', chart }],
      }),
    ),
    ...GAUGES.map((name) => ({
      title: `Gauge · ${name}`,
      cards: [gauge(name, { cols: 6 }), gauge(name, { cols: 6, value: null }), gauge(name)],
    })),
    fine('Line · thin, regular, bold', 'soft', 'line_width', ['thin', 'regular', 'bold']),
    fine('Fill · gradient, flat, none', 'soft', 'fill', ['gradient', 'flat', 'none']),
    fine('Curve · smooth, straight, step', 'soft', 'curve', ['smooth', 'straight', 'step']),
    fine('Points · none, end, all', 'soft', 'show_points', ['none', 'end', 'all']),
    fine('Grid · vertical, horizontal, both', 'soft', 'show_grid', ['x', 'y', 'both']),
    fine('Soft shadow · on, off', 'soft', 'glow', [true, false]),
    fine('Highlight · lowest, highest, both', 'step', 'highlight', ['min', 'max', 'both']),
    fine('Scale · shown, hidden', 'step', 'show_axis', [true, false]),
    ...ADOPTED,
  ],
};
