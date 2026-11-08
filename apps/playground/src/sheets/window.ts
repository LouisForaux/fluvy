import type { LovelaceCardConfig } from '@fluvy/core';
import { mergeWs, type SheetSpec } from '../scenes.js';
import { cloudyWs } from './energy.js';

/*
 * How much time a chart shows, and a line that is never crowded (1.18): the cloudy day of #138 and a steady
 * temperature, each line on the house's round times as calmly as its card's width draws it in its style — or a point
 * every 5 or 30 minutes, each Home Assistant's reading then — at a half section, a narrow column, a column and a wide
 * page, over the house's 12 hours, 4 hours, a day and a week; Home Assistant's own thin line of the same means beside
 * the energy card. Opened with a picker's day past and a clock pinned in the afternoon, the hill is in every window:
 * `?sheet=window&period=yesterday&at=2026-09-18T18:00:00`.
 */

const PICKER = 'energy_window';
const CLOUDY_PV = 'sensor.tw_cloudy_pv';
const TEMPERATURE = 'sensor.tw_temperature';
const HUMIDITY = 'sensor.tw_humidity';

/** A pseudo-random fraction of an index, the same on every page. */
const noise = (i: number): number => (((Math.sin(i * 78.233) * 43758.5453) % 1) + 1) % 1;

/**
 * A room's steady day as its sensors report it, every two minutes to their tenth: a temperature that rises from 19.2
 * at dawn to 22.6 in the afternoon and a humidity that falls as it warms, each with the jitter of a real sensor.
 */
function steady(id: string, t: number): number {
  const hour = (t - new Date(t).setHours(0, 0, 0, 0)) / 3_600_000;
  const day = Math.sin(((hour - 9) / 24) * 2 * Math.PI);
  const jitter = noise(Math.floor(t / 120_000)) - 0.5;
  return id === HUMIDITY
    ? Math.round(52 - 9 * day + 1.5 * jitter)
    : Math.round((20.9 + 1.7 * day + 0.25 * jitter) * 10) / 10;
}

const steadyWs = {
  'history/history_during_period': (message: Record<string, unknown>) => {
    const ids = (message['entity_ids'] as readonly string[]).filter(
      (id) => id === TEMPERATURE || id === HUMIDITY,
    );
    if (!ids.length) return undefined;
    const from = Date.parse(String(message['start_time']));
    const to = Date.parse(String(message['end_time']));
    return Object.fromEntries(
      ids.map((id) => {
        const states: { s: string; lu: number }[] = [];
        for (let t = Math.ceil(from / 120_000) * 120_000; t <= to; t += 120_000) {
          const s = String(steady(id, t));
          // a sensor reports a change: the same tenth again is not a state of its own
          if (states[states.length - 1]?.s !== s) states.push({ s, lu: t / 1000 });
        }
        if (states[0]) states[0] = { s: states[0].s, lu: from / 1000 };
        return [id, states];
      }),
    );
  },
};

const pv = (extra: Partial<LovelaceCardConfig> = {}): LovelaceCardConfig => ({
  type: 'custom:fluvy-energy-card',
  entity: CLOUDY_PV,
  collection_key: PICKER,
  tone: 'solar',
  decimals: 2,
  ...extra,
});
const temperature = (extra: Partial<LovelaceCardConfig> = {}): LovelaceCardConfig => ({
  type: 'custom:fluvy-sensor-card',
  entity: TEMPERATURE,
  ...extra,
});
const HA_LINE = { type: 'pg-means-line' };

export const sheet: SheetSpec = {
  states: [
    [
      CLOUDY_PV,
      '0.00',
      {
        friendly_name: 'Solar production',
        unit_of_measurement: 'kW',
        device_class: 'power',
        state_class: 'measurement',
      },
    ],
    // read at the afternoon the sheet is pinned to (18:00): their history ends on them
    [
      TEMPERATURE,
      '22.1',
      {
        friendly_name: 'Living room',
        unit_of_measurement: '°C',
        device_class: 'temperature',
        state_class: 'measurement',
      },
    ],
    [
      HUMIDITY,
      '46',
      {
        friendly_name: 'Living room humidity',
        unit_of_measurement: '%',
        device_class: 'humidity',
        state_class: 'measurement',
      },
    ],
  ],

  collections: [PICKER],

  ws: mergeWs([cloudyWs(CLOUDY_PV), steadyWs]),

  frames: [
    // the cloudy day over a picker's day: automatic (the finest round step a 320 plot draws calmly, each point the
    // mean around its time), and a point every 30 and every 5 minutes (each Home Assistant's reading then)
    { title: 'Cloudy day · a picker · automatic', cards: [pv(), HA_LINE] },
    { title: 'Cloudy day · a picker · every 30 min', cards: [pv({ points: '30m' }), HA_LINE] },
    { title: 'Cloudy day · a picker · every 5 min', cards: [pv({ points: '5m' }), HA_LINE] },
    { title: 'Cloudy day · a picker · soft', cards: [pv({ chart: 'soft' })] },
    { title: 'Cloudy day · a picker · minimal', cards: [pv({ chart: 'minimal' })] },
    {
      title: 'Cloudy day · half a section',
      width: 320,
      cards: [
        { ...pv(), cols: 6 },
        { ...pv({ chart: 'soft' }), cols: 6 },
      ],
    },
    { title: 'Cloudy day · a narrow column', width: 211, cards: [pv()] },
    { title: 'Cloudy day · a wide page', width: 1400, cards: [pv(), HA_LINE] },
    // its history over the house's window (12 h), the sensor card's too
    {
      title: 'Cloudy day · its history · the house’s 12 h',
      cards: [{ type: 'custom:fluvy-energy-card', entity: CLOUDY_PV, tone: 'solar', decimals: 2 }],
    },
    { title: 'Cloudy day · the sensor card', cards: [{ ...temperature(), entity: CLOUDY_PV }] },
    // a steady temperature over the house's window and over the card's own
    { title: 'Steady temperature · 4 h', cards: [temperature({ hours: 4 })] },
    { title: 'Steady temperature · the house’s 12 h', cards: [temperature()] },
    { title: 'Steady temperature · 24 h', cards: [temperature({ hours: 24 })] },
    { title: 'Steady temperature · 7 d', cards: [temperature({ hours: 168 })] },
    {
      title: 'Steady temperature · soft and minimal',
      cards: [temperature({ chart: 'soft' }), temperature({ chart: 'minimal' })],
    },
    { title: 'Steady temperature · a wide page', width: 1400, cards: [temperature()] },
    {
      title: 'Steady temperature · with its humidity',
      cards: [temperature({ entities: [HUMIDITY] })],
    },
    {
      title: 'Steady temperature · tiles',
      cards: [
        { ...temperature({ variant: 'tile' }), cols: 6 },
        { ...temperature({ variant: 'tile', chart: 'minimal' }), cols: 6 },
      ],
    },
  ],
};
