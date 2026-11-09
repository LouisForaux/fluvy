import { FluvyHistoryBarsCard } from '../../../../packages/cards/src/history-bars/history-bars-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-history-bars-card'))
  customElements.define('fluvy-history-bars-card', FluvyHistoryBarsCard);

/**
 * The history bars (1.8, issue #38): the mock-up's four cards with their very numbers — solar production, the
 * house, the feed-in and the import over the seven finished days before Saturday 10 October 2026 — then thirty
 * days, twelve weeks, twelve months, the compact and mini layouts, a narrow column, a temperature's means, every
 * part switched off, the day in progress, a lifetime meter in Wh, and the honest states: no statistics yet, a
 * sensor that is unavailable, one that is not there. Then 1.9's (issues #44 and #45): a day counter and a monthly
 * rain gauge as Home Assistant counts them and from zero on their cycles, a reading at the end by month, a lifetime
 * meter after a restart, a sensor read from its history, bars below zero in their own colour, a recorder that cannot
 * be read, a narrow column, today live on the page's clock, and a chart that is the card's tap.
 */

/** The sheet's moment: Saturday 10 October 2026 at noon, so the seven finished days read 03–09 October. */
const NOW = '2026-10-10T12:00:00';
const NOW_MS = new Date(2026, 9, 10, 12).getTime();
const DAY = 86_400_000;

const KWH = { unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing' };
const WH = { unit_of_measurement: 'Wh', device_class: 'energy', state_class: 'total_increasing' };
const CELSIUS = {
  unit_of_measurement: '°C',
  device_class: 'temperature',
  state_class: 'measurement',
};

/** A sensor's day `daysAgo` days back (0 today, 1 yesterday): what it gained, or its mean; null for a day it has no row. */
type Daily = (daysAgo: number) => number | null;

/** A quiet, repeatable series around a typical day: the same number for the same day on every run. */
const noise = (k: number): number => {
  const x = Math.sin(k * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/** The mock-up's last seven days (oldest first) for the finished week, a typical day with its swing before them, and today so far. */
const series = (
  last7: ReadonlyArray<number | null>,
  typical: number,
  swing: number,
  today: number,
): Daily => {
  return (k) => {
    if (k === 0) return today;
    if (k <= 7) return last7[7 - k] ?? null;
    return Math.round((typical + swing * noise(k)) * 10) / 10;
  };
};

const SENSORS: Record<
  string,
  { readonly daily: Daily; readonly mean?: boolean; readonly scale?: number }
> = {
  'sensor.hb_solar': { daily: series([35.4, 34.4, 28.6, 26.5, 30.2, 9.5, 26.9], 24, 12, 12.3) },
  'sensor.hb_house': { daily: series([22.1, 25.3, 28.7, 24.6, 23.9, 26.4, 22.8], 24, 5, 9.8) },
  'sensor.hb_export': { daily: series([28.4, 27.6, 22.1, 19.8, 24.7, 6.2, 21.4], 17, 10, 7.1) },
  'sensor.hb_import': { daily: series([4.8, 6.9, 9.1, 5.6, 4.3, 16.8, 7.2], 7, 5, 2.4) },
  'sensor.hb_outside': {
    daily: series([14.2, 15.8, 13.1, null, 16.0, 17.3, 15.1], 15, 4, 13.0),
    mean: true,
  },
  'sensor.hb_dead': { daily: series([1.2, 1.1, 1.3, 1.2, 0, 1.4, 1.2], 1.2, 0.3, 0.4) },
  // a lifetime meter in Wh: the same solar days a thousand times over, read in kWh by the card
  'sensor.hb_wh': {
    daily: series([35.4, 34.4, 28.6, 26.5, 30.2, 9.5, 26.9], 24, 12, 12.3),
    scale: 1000,
  },
};

/** The next bucket's start in the browser's own calendar (the mock's house reads the browser's clock). */
const next = (d: Date, period: string): Date =>
  period === 'month'
    ? new Date(d.getFullYear(), d.getMonth() + 1, 1)
    : new Date(d.getFullYear(), d.getMonth(), d.getDate() + (period === 'week' ? 7 : 1));

const TODAY = new Date(2026, 9, 10).getTime();
const daysAgo = (day: Date): number => Math.round((TODAY - day.getTime()) / DAY);

interface Row {
  readonly start: number;
  readonly end: number;
  readonly change?: number;
  readonly mean?: number;
  readonly max?: number;
  readonly min?: number;
}

/**
 * The recorder's rows for a question: one per bucket from the start asked, each the sum (or the mean) of the days
 * in it up to now; a bucket whose days all have no row has none either.
 */
const rows = (message: Record<string, unknown>, id: string): Row[] => {
  const sensor = SENSORS[id];
  if (!sensor) return [];
  const period = String(message['period'] ?? 'day');
  const out: Row[] = [];
  let start = new Date(Date.parse(String(message['start_time'])));
  while (start.getTime() < NOW_MS) {
    const end = next(start, period);
    const days: number[] = [];
    for (
      let day = new Date(start);
      day.getTime() < Math.min(end.getTime(), NOW_MS);
      day = next(day, 'day')
    ) {
      const value = sensor.daily(daysAgo(day));
      if (value !== null) days.push(value * (sensor.scale ?? 1));
    }
    if (days.length) {
      const sum = days.reduce((a, b) => a + b, 0);
      out.push(
        sensor.mean
          ? {
              start: start.getTime(),
              end: end.getTime(),
              mean: Math.round((sum / days.length) * 100) / 100,
              max: Math.max(...days),
              min: Math.min(...days),
            }
          : { start: start.getTime(), end: end.getTime(), change: Math.round(sum * 1000) / 1000 },
      );
    }
    start = end;
  }
  return out;
};

/* ---------- 1.9: the issues' sensors (#44, #45) as the recorder keeps them ---------- */

const HOUR = 3_600_000;
/** A row of the page's own calendar (the mock's house reads the browser's clock). */
const at = (month: number, day: number, hour = 0): number =>
  new Date(2026, month, day, hour).getTime();
/** A row in the reply to a question asked from `start_time`, as the recorder sends it. */
interface Answered {
  readonly start: number;
  readonly end: number;
  readonly change?: number;
  readonly state?: number;
}
const from = (message: Record<string, unknown>, rows: readonly Answered[]): Answered[] => {
  const start = Date.parse(String(message['start_time']));
  const end = message['end_time'] ? Date.parse(String(message['end_time'])) : Infinity;
  return rows.filter((row) => row.start >= start && row.start < end);
};
const asksFor = (message: Record<string, unknown>, type: string): boolean =>
  ((message['types'] as string[] | undefined) ?? []).includes(type);
/** Rows of one value a day, from a day on: what Home Assistant counted, or the reading at each day's close. */
const days = (month: number, day: number, values: readonly number[], key: 'change' | 'state') =>
  values.map((value, i) => ({
    start: at(month, day + i),
    end: at(month, day + i + 1),
    [key]: value,
  }));

/**
 * #45: a template summing two inverter day counters. Its hours from 13 October 21:00 (it was made that evening),
 * 0.0 from midnight to sunrise, 33.3 by the 15:00 hour; and Home Assistant's own day rows, which count the two
 * counters' staggered midnight twice: 17.0 on its first evening, 51.2 today.
 */
const PV_HOURS = [
  35.6, 35.6, 35.6, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 1.2, 4.6, 9.4, 15.2, 21.3, 27.4, 33.3,
];
const PV_NOW = '2026-10-14T16:30:00';
const pvRows = (message: Record<string, unknown>): Answered[] =>
  message['period'] === 'hour' && asksFor(message, 'state')
    ? from(
        message,
        PV_HOURS.map((state, i) => ({
          start: at(9, 13, 21) + i * HOUR,
          end: at(9, 13, 22) + i * HOUR,
          state,
        })),
      )
    : from(message, days(9, 13, [17, 51.2], 'change'));

/**
 * #44: a monthly rain gauge reported as a `total` with no last_reset — so Home Assistant counts its reset on 1 October
 * as −51.1 — read by the day (what it counted, or its reading at each close) and by the month (its reading at each
 * month's end, the month's rain).
 */
const RAIN_NOW = '2026-10-13T22:00:00';
const RAIN_GAINS: Readonly<Record<string, number>> = {
  '8-16': 0.3,
  '8-17': 2.6,
  '8-18': 0.4,
  '8-27': 0.2,
  '9-3': 0.9,
  '9-5': 0.6,
  '9-9': 4.5,
  '9-10': 10.9,
};
const rainDays = (): { change: number[]; state: number[] } => {
  const change: number[] = [];
  const state: number[] = [];
  let reading = 47.6;
  for (let i = 0; i < 31; i++) {
    const date = new Date(2026, 8, 13 + i);
    const gain = RAIN_GAINS[`${date.getMonth()}-${date.getDate()}`] ?? 0;
    const fresh = date.getDate() === 1;
    change.push(fresh ? -reading : gain);
    reading = fresh ? 0 : Math.round((reading + gain) * 10) / 10;
    state.push(reading);
  }
  return { change, state };
};
const RAIN_MONTHS = [54.3, 38.2, 61.4, 12.8, 63, 51.1, 16.9];
const rainRows = (message: Record<string, unknown>): Answered[] => {
  if (message['period'] === 'month')
    return from(
      message,
      RAIN_MONTHS.map((state, i) => ({ start: at(3 + i, 1), end: at(4 + i, 1), state })),
    );
  const { change, state } = rainDays();
  return asksFor(message, 'state')
    ? from(message, days(8, 13, state, 'state'))
    : from(message, days(8, 13, change, 'change'));
};

/**
 * A lifetime meter whose integration read 0 for a moment at a restart on 7 October: Home Assistant took the fall for
 * a new meter and counted its whole reading again that day; its readings at each day's close never saw the glitch.
 */
const LIFE_DAYS = [24.1, 31.5, 28.2, 26.4, 22.9, 30.8, 27.5, 12.6];
const lifeRows = (message: Record<string, unknown>): Answered[] => {
  if (asksFor(message, 'state')) {
    let reading = 18_150;
    return from(
      message,
      [0, ...LIFE_DAYS].map((gain, i) => {
        reading = Math.round((reading + gain) * 10) / 10;
        return { start: at(9, 2 + i), end: at(9, 3 + i), state: reading };
      }),
    );
  }
  return from(
    message,
    days(
      9,
      3,
      LIFE_DAYS.map((gain, i) => (i === 4 ? gain + 18_257.3 : gain)),
      'change',
    ),
  );
};

/** A net meter (`total`): the days it exported more than it took are below zero. */
const NET_DAYS = [5.2, -3.1, 7.8, -6.4, 2.2, -1.5, 4.9, 1.8];

/** What the recorder keeps of the issues' sensors, by message. */
const RECORDED: Readonly<Record<string, (message: Record<string, unknown>) => Answered[]>> = {
  'sensor.hb_pv': pvRows,
  'sensor.hb_rain': rainRows,
  'sensor.hb_life': lifeRows,
  'sensor.hb_net': (message) => from(message, days(9, 3, NET_DAYS, 'change')),
  'hb_import:consumption': pvRows,
};

/** A rain tank with no state class: no statistics, its history only — from 5 October, two days into the window. */
const TANK: ReadonlyArray<readonly [number, number]> = [
  [at(9, 5, 0), 412],
  [at(9, 5, 19), 405],
  [at(9, 6, 7), 398],
  [at(9, 6, 21), 431],
  [at(9, 7, 13), 424],
  [at(9, 8, 9), 417],
  [at(9, 9, 2), 409],
  [at(9, 9, 18), 401],
  [at(9, 10, 8), 396],
];

/** The solar meter with the card's default colour (the palette's accent): what the other frames are drawn with. */
const plain = {
  type: 'custom:fluvy-history-bars-card',
  entity: 'sensor.hb_solar',
  icon: 'sun',
  _now: NOW,
};
/** The mock-up's four cards wear its own colours (the issue's hexes: a palette's named amber reads khaki on Linen). */
const solar = { ...plain, color: '#C9A063' };
const house = {
  type: 'custom:fluvy-history-bars-card',
  entity: 'sensor.hb_house',
  icon: 'home',
  color: '#7E9FD0',
  _now: NOW,
};
const feedIn = {
  type: 'custom:fluvy-history-bars-card',
  entity: 'sensor.hb_export',
  icon: 'up',
  color: '#86B98C',
  price: 0.19,
  facts: [
    { kind: 'share', of: 'sensor.hb_solar', name: 'Share of production', icon: 'tower' },
    { kind: 'money', name: 'Revenue (est.)' },
    { kind: 'co2', name: 'CO₂ avoided' },
  ],
  _now: NOW,
};
const gridImport = {
  type: 'custom:fluvy-history-bars-card',
  entity: 'sensor.hb_import',
  icon: 'down',
  color: '#EE9A86',
  price: 0.3,
  facts: [
    { kind: 'money', name: 'Costs (est.)' },
    { kind: 'km' },
    { kind: 'share', of: 'sensor.hb_house', name: 'Share of consumption' },
  ],
  _now: NOW,
};

/** #45's card at its own moment (14 October, 16:30): six days and today, today first. */
const pv = {
  type: 'custom:fluvy-history-bars-card',
  entity: 'sensor.hb_pv',
  icon: 'sun',
  days: 6,
  include_today: true,
  head: ['today', 'average', 'total'],
  _now: PV_NOW,
};
/** #44's card at its own moment (13 October, 22:00): 28 days and today. */
const rain = {
  type: 'custom:fluvy-history-bars-card',
  entity: 'sensor.hb_rain',
  icon: 'drop',
  days: 28,
  include_today: true,
  _now: RAIN_NOW,
};
const life = {
  type: 'custom:fluvy-history-bars-card',
  entity: 'sensor.hb_life',
  icon: 'bolt',
  _now: NOW,
};
/**
 * A house meter on the page's own clock, live: its hours over the last thirty days end at the last full hour (the
 * house's statistics), and what it reads now is a little past them.
 */
const LIVE_HOURS = Array.from({ length: 30 * 24 }, (_, i) => i).reduce<number[]>((out, i) => {
  const hour = i % 24;
  const use = 0.35 + (hour >= 7 && hour <= 22 ? 0.6 : 0) + 0.2 * Math.abs(noise(i));
  out.push(Math.round(((out[out.length - 1] ?? 21_000) + use) * 100) / 100);
  return out;
}, []);
const LIVE_NOW = Math.round(((LIVE_HOURS[LIVE_HOURS.length - 1] ?? 0) + 0.4) * 100) / 100;

export const sheet: SheetSpec = {
  states: [
    ['sensor.hb_solar', '18342.7', { friendly_name: 'Solar production', ...KWH }],
    ['sensor.hb_house', '21877.2', { friendly_name: 'House consumption', ...KWH }],
    ['sensor.hb_export', '9210.4', { friendly_name: 'Feed-in to grid', ...KWH }],
    ['sensor.hb_import', '6032.9', { friendly_name: 'Grid import', ...KWH }],
    ['sensor.hb_outside', '13.0', { friendly_name: 'Outside temperature', ...CELSIUS }],
    ['sensor.hb_dead', 'unavailable', { friendly_name: 'Pool pump energy', ...KWH }],
    ['sensor.hb_fresh', '0.4', { friendly_name: 'Heat pump energy', ...KWH }],
    ['sensor.hb_wh', '18342700', { friendly_name: 'Lifetime production', ...WH }],
    ['sensor.hb_panels', '5.4', { friendly_name: 'Panels', unit_of_measurement: 'kWp' }],
    ['sensor.hb_pv', '33.3', { friendly_name: 'PV1 + PV2 today', ...KWH }],
    [
      'sensor.hb_rain',
      '16.9',
      {
        friendly_name: 'Rain this month',
        unit_of_measurement: 'mm',
        device_class: 'precipitation',
        state_class: 'total',
      },
    ],
    ['sensor.hb_life', '18392.5', { friendly_name: 'Inverter lifetime', ...KWH }],
    [
      'sensor.hb_net',
      '2961.4',
      {
        friendly_name: 'Grid net',
        unit_of_measurement: 'kWh',
        device_class: 'energy',
        state_class: 'total',
      },
    ],
    ['sensor.hb_broken', '120.4', { friendly_name: 'Garage meter', ...KWH }],
    ['sensor.hb_tank', '396', { friendly_name: 'Rain tank', unit_of_measurement: 'L' }],
    ['sensor.hb_live', String(LIVE_NOW), { friendly_name: 'House meter', ...KWH }],
  ],

  statistics: {
    'sensor.hb_live': { kind: 'counter', hourly: LIVE_HOURS },
    'hb_import:consumption': {
      kind: 'counter',
      hourly: [],
      unit: 'kWh',
      name: 'Imported consumption',
    },
  },

  ws: {
    'recorder/statistics_during_period': (message) => {
      const ids = (message['statistic_ids'] as string[] | undefined) ?? [];
      // a recorder that cannot be read: what the card says, and asks again
      if (ids.includes('sensor.hb_broken')) throw new Error('The recorder is not running');
      return Object.fromEntries([
        ...ids.filter((id) => id in SENSORS).map((id) => [id, rows(message, id)]),
        ...ids.flatMap((id) => {
          const recorded = RECORDED[id]?.(message);
          return recorded ? [[id, recorded]] : [];
        }),
      ]);
    },
    // the rain tank's states, as the history sends them (`minimal_response`: the state and its instant in seconds)
    'history/history_during_period': (message) =>
      ((message['entity_ids'] as string[] | undefined) ?? []).includes('sensor.hb_tank')
        ? {
            'sensor.hb_tank': TANK.filter(
              ([t]) => t <= Date.parse(String(message['end_time'])),
            ).map(([t, v]) => ({ s: String(v), lu: t / 1000 })),
          }
        : undefined,
  },

  frames: [
    /* ---- the mock-up's cards at a phone's column ---- */
    { title: 'Solar production', cards: [solar] },
    { title: 'House consumption', cards: [house] },
    { title: 'Feed-in to grid', cards: [feedIn] },
    { title: 'Grid import', cards: [gridImport] },

    /* ---- the mock-up's four cards at the mock-up's width: the readouts beside the title, the circles in the strip ---- */
    {
      title: 'Mock-up · Solar production',
      width: 760,
      cards: [{ ...solar, facts: ['co2', 'trees', 'highest'] }],
    },
    {
      title: 'Mock-up · House consumption',
      width: 760,
      cards: [{ ...house, facts: ['lowest', 'highest', 'average'] }],
    },
    { title: 'Mock-up · Feed-in to grid', width: 760, cards: [feedIn] },
    { title: 'Mock-up · Grid import', width: 760, cards: [gridImport] },

    /* ---- longer windows ---- */
    { title: '30 days', cards: [{ ...plain, days: 30 }] },
    { title: '12 weeks', cards: [{ ...plain, period: 'week', days: 12 }] },
    { title: '12 months', cards: [{ ...plain, period: 'month', days: 12 }] },

    /* ---- the other layouts ---- */
    { title: 'Compact', cards: [{ ...house, variant: 'compact' }] },
    { title: 'Mini', cards: [{ ...plain, variant: 'mini' }] },
    { title: 'Narrow 232', width: 232, cards: [plain] },

    /* ---- what else a bar can show ---- */
    {
      title: 'Outside temperature · mean',
      cards: [{ ...plain, entity: 'sensor.hb_outside', icon: 'thermo', tone: 'cool' }],
    },
    {
      title: 'Facts of your own',
      cards: [
        {
          ...plain,
          include_today: true,
          head: ['total', { kind: 'today', name: 'So far today' }],
          facts: [
            {
              kind: 'money',
              factor: 0.12,
              name: 'Worth',
              icon: 'tag',
              color: 'green',
              tap_action: { action: 'none' },
            },
            {
              kind: 'template',
              name: 'Panels',
              template: '{{ states("sensor.hb_panels") }}',
              unit: 'kWp',
              icon: 'grid',
            },
            { kind: 'average', decimals: 2, name: 'A day' },
          ],
        },
      ],
    },
    {
      title: 'Everything off',
      cards: [
        {
          ...plain,
          show_values: false,
          show_axis: false,
          show_grid: false,
          show_dates: false,
          show_facts: false,
          head: [],
        },
      ],
    },
    { title: 'Include today', cards: [{ ...plain, include_today: true }] },
    {
      title: 'A lifetime meter in Wh',
      cards: [{ ...plain, entity: 'sensor.hb_wh', icon: 'bolt', days: 14 }],
    },

    /* ---- the honest states ---- */
    {
      title: 'No statistics yet',
      cards: [{ ...plain, entity: 'sensor.hb_fresh', icon: 'heater' }],
    },
    { title: 'Unavailable', cards: [{ ...plain, entity: 'sensor.hb_dead', icon: 'drop' }] },
    { title: 'Missing', cards: [{ ...plain, entity: 'sensor.hb_none' }] },

    /* ---- the compact and mini layouts at their own size: half a section ---- */
    {
      title: 'Compact · half a section',
      cards: [
        { ...house, variant: 'compact', cols: 6 },
        { ...solar, variant: 'compact', cols: 6 },
      ],
    },
    {
      title: 'Mini · half a section',
      cards: [
        { ...plain, variant: 'mini', cols: 6 },
        { ...feedIn, variant: 'mini', cols: 6 },
      ],
    },

    /* ---- 1.9: the bars tell the truth (#44, #45); frames only ever appended ---- */
    { title: '#45 · a day counter as Home Assistant counts it', cards: [pv] },
    { title: '#45 · from zero every day', cards: [{ ...pv, reset: 'day' }] },
    { title: '#44 · a monthly rain gauge', cards: [rain] },
    { title: '#44 · from zero every month', cards: [{ ...rain, reset: 'month' }] },
    {
      title: 'The reading at the end · by month',
      cards: [{ ...rain, stat: 'state', period: 'month', days: 6, reset: 'month' }],
    },
    {
      title: 'A lifetime meter after a restart',
      cards: [
        { ...life, name: 'As Home Assistant counts it' },
        { ...life, name: 'Never starts again', reset: 'never' },
      ],
    },
    {
      title: 'From the history',
      cards: [{ ...plain, entity: 'sensor.hb_tank', icon: 'drop' }],
    },
    {
      title: 'Below zero in its own colour',
      cards: [
        {
          ...plain,
          entity: 'sensor.hb_net',
          icon: 'grid',
          include_today: true,
          negative_color: 'green',
          current_color: 'amber',
        },
        {
          ...plain,
          entity: 'sensor.hb_net',
          icon: 'grid',
          variant: 'mini',
          include_today: true,
          negative_color: 'green',
        },
      ],
    },
    {
      title: 'Couldn’t read the recorder',
      // on the page's own clock: it asks again a minute on
      cards: [{ type: plain.type, entity: 'sensor.hb_broken', icon: 'heater' }],
    },
    { title: 'Narrow 211', width: 211, cards: [{ ...rain, reset: 'month' }] },
    {
      title: 'Live today',
      cards: [
        {
          type: 'custom:fluvy-history-bars-card',
          entity: 'sensor.hb_live',
          icon: 'home',
          include_today: true,
          head: ['today', 'total'],
        },
      ],
    },
    {
      title: 'Without a head, the chart is the tap',
      cards: [{ ...plain, show_head: false, tap_action: { action: 'more-info' } }],
    },
    {
      title: 'An imported statistic, no entity behind it (#149)',
      cards: [{ type: plain.type, entity: 'hb_import:consumption', color: 'green' }],
    },
  ],
};
