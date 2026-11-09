import { FluvyChartCard } from '../../../../packages/cards/src/chart/chart-card.js';
import { NOW } from '../now.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-chart-card'))
  customElements.define('fluvy-chart-card', FluvyChartCard);

/*
 * A Chart card's bars, band and step on the house's round times (1.18): a meter's hourly statistics as bars, a room's
 * hourly mean, min and max as a band and as steps, and a sensor's own history as bars, every window ending on the
 * sheets' 21:47. Each slot is a round period of the house's clock and reads what Home Assistant says of that period;
 * the last one, where it is still running, reads so far, paler. The recorder answers from the moment alone, so a
 * frame is the same at every width and in either theme.
 */

const HOUR = 3_600_000;
const NOW_ISO = NOW.toISOString();

const ENERGY = 'sensor.sl_energy';
const ROOM = 'sensor.sl_room';
const POWER = 'sensor.sl_power';

/** A pseudo-random fraction of an index, the same on every page. */
const noise = (i: number): number => (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;

/** The kWh a house used in the hour from `t`: its night's floor, its morning and its evening. */
function used(t: number): number {
  const hour = new Date(t).getHours();
  const daily =
    0.18 +
    0.5 * Math.exp(-((hour - 8) ** 2) / 4) +
    1.25 * Math.exp(-((hour - 19.5) ** 2) / 5) +
    0.22 * noise(Math.floor(t / HOUR));
  return Math.round(daily * 100) / 100;
}

/** A room's temperature through the hour from `t`: its mean, its low and its high. */
function room(t: number): { mean: number; min: number; max: number } {
  const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
  const mean = 20.6 + 1.9 * Math.sin(((hour - 9) / 24) * 2 * Math.PI) + 0.4 * noise(t / HOUR);
  const spread = 0.25 + 0.55 * noise(t / HOUR + 7);
  const fixed = (v: number): number => Math.round(v * 100) / 100;
  return { mean: fixed(mean), min: fixed(mean - spread), max: fixed(mean + spread * 0.8) };
}

/** A house's power as its meter reports it, every two minutes: the evening's load and a kettle's spikes. */
function power(t: number): number {
  const minutes = new Date(t).getHours() * 60 + new Date(t).getMinutes();
  const load = 240 + 1500 * Math.exp(-((minutes / 60 - 19.5) ** 2) / 5);
  const spike = noise(Math.floor(t / 120_000)) > 0.93 ? 1400 : 0;
  return Math.round(load + spike + 80 * noise(t / 120_000));
}

/** The whole hours the recorder holds in a window, ending on the sheets' moment: a statistic's running hour is not compiled. */
function hours(from: number, to: number): number[] {
  const last = Math.floor(Math.min(to, NOW.getTime()) / HOUR) * HOUR;
  const out: number[] = [];
  for (let t = Math.ceil(from / HOUR) * HOUR; t < last; t += HOUR) out.push(t);
  return out;
}

const bars = (span: string, more: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-chart-card',
  _now: NOW_ISO,
  title: 'Energy',
  icon: 'bolt',
  series: [{ entity: ENERGY, source: 'statistics', stat: 'change', period: 'hour', tone: 'solar' }],
  chart: 'bars',
  span,
  ...more,
});
const band = (span: string, more: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-chart-card',
  _now: NOW_ISO,
  title: 'Living room',
  series: [{ entity: ROOM, source: 'statistics', stat: 'mean', period: 'hour', kind: 'band' }],
  chart: 'band',
  span,
  ...more,
});
const step = (span: string, more: Record<string, unknown> = {}) => ({
  ...band(span),
  chart: 'step',
  series: [{ entity: ROOM, source: 'statistics', stat: 'mean', period: 'hour' }],
  ...more,
});
const live = (span: string, more: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-chart-card',
  _now: NOW_ISO,
  title: 'Power',
  icon: 'bolt',
  series: [{ entity: POWER, tone: 'solar' }],
  chart: 'bars',
  span,
  ...more,
});

export const sheet: SheetSpec = {
  states: [
    [
      ENERGY,
      '2.31',
      {
        friendly_name: 'Energy used',
        unit_of_measurement: 'kWh',
        device_class: 'energy',
        state_class: 'total_increasing',
      },
    ],
    [
      ROOM,
      '22.4',
      {
        friendly_name: 'Living room',
        unit_of_measurement: '°C',
        device_class: 'temperature',
        state_class: 'measurement',
      },
    ],
    [
      POWER,
      '612',
      {
        friendly_name: 'Power',
        unit_of_measurement: 'W',
        device_class: 'power',
        state_class: 'measurement',
      },
    ],
  ],

  ws: {
    'recorder/statistics_during_period': (message) => {
      const ids = (message['statistic_ids'] as readonly string[]).filter(
        (id) => id === ENERGY || id === ROOM,
      );
      if (!ids.length) return undefined;
      const from = Date.parse(String(message['start_time']));
      const to = Date.parse(String(message['end_time']));
      return Object.fromEntries(
        ids.map((id) => [
          id,
          hours(from, to).map((t) => ({
            start: t,
            end: t + HOUR,
            ...(id === ENERGY ? { change: used(t) } : room(t)),
          })),
        ]),
      );
    },
    'history/history_during_period': (message) => {
      if (!(message['entity_ids'] as readonly string[]).includes(POWER)) return undefined;
      const from = Date.parse(String(message['start_time']));
      const to = Math.min(Date.parse(String(message['end_time'])), NOW.getTime());
      const states: { s: string; lu: number }[] = [];
      for (let t = Math.ceil(from / 120_000) * 120_000; t <= to; t += 120_000)
        states.push({ s: String(power(t)), lu: t / 1000 });
      return { [POWER]: states };
    },
  },

  frames: [
    // a meter's hourly change as bars: each bar an hour of Home Assistant's, its value that hour's
    { title: 'Slots · bars · 12 h', cards: [bars('12h')] },
    { title: 'Slots · bars · 4 h', cards: [bars('4h')] },
    { title: 'Slots · bars · 24 h', cards: [bars('24h')] },
    { title: 'Slots · bars · 48 h', cards: [bars('48h')] },
    // a week: several hours a slot, each what those hours gained together
    { title: 'Slots · bars · 7 d', cards: [bars('7d')] },
    { title: 'Slots · bars · 12 h · a narrow column', width: 211, cards: [bars('12h')] },
    { title: 'Slots · bars · a wide page', width: 1400, cards: [bars('24h')] },
    // a room's mean as a line in its band of lows and highs, per hour; a week of it
    { title: 'Slots · band · 12 h', cards: [band('12h')] },
    { title: 'Slots · band · 24 h', cards: [band('24h')] },
    { title: 'Slots · band · 7 d', cards: [band('7d')] },
    // steps: the same hours, each held across its own
    { title: 'Slots · step · 12 h', cards: [step('12h')] },
    { title: 'Slots · step · 7 d', cards: [step('7d')] },
    { title: 'Slots · step · every hour', cards: [step('12h', { points: '1h' })] },
    // the sensor's own history: the running hour reads so far, paler
    { title: 'Slots · history bars · 12 h', cards: [live('12h')] },
    { title: 'Slots · history bars · 4 h', cards: [live('4h')] },
  ],
};
