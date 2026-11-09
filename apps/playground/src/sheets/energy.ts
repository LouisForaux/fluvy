import type { HomeAssistant, LovelaceCard, LovelaceCardConfig } from '@fluvy/core';
import { FluvyEnergyCard } from '../../../../packages/cards/src/energy/energy-card.js';
import { FluvyEnergyDevicesCard } from '../../../../packages/cards/src/energy-devices/energy-devices-card.js';
import { FluvyEnergyFlowCard } from '../../../../packages/cards/src/energy-flow/energy-flow-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-energy-card'))
  customElements.define('fluvy-energy-card', FluvyEnergyCard);
if (!customElements.get('fluvy-energy-flow-card'))
  customElements.define('fluvy-energy-flow-card', FluvyEnergyFlowCard);
if (!customElements.get('fluvy-energy-devices-card'))
  customElements.define('fluvy-energy-devices-card', FluvyEnergyDevicesCard);

/** The design sheet's moment: 21:47 on the 24 h axis, so the curve can be held against the render. */
const SHEET_NOW = '2026-09-17T21:47:12';

/**
 * The mock's profile reads a 24-hour clock. This stand-in shows the card it wraps (`card`) to a
 * 12-hour user: the axes must read "12 AM … 12 AM" on one line each.
 */
export class TwelveHour extends HTMLElement implements LovelaceCard {
  private inner: LovelaceCard | undefined;

  setConfig(config: LovelaceCardConfig): void {
    const { card, ...rest } = config as LovelaceCardConfig & { card: string };
    this.inner = document.createElement(card) as LovelaceCard;
    this.inner.setConfig({ ...rest, type: `custom:${card}` });
    this.style.display = 'block';
    this.replaceChildren(this.inner);
  }

  getCardSize(): number | Promise<number> {
    return this.inner?.getCardSize() ?? 1;
  }

  set hass(hass: HomeAssistant) {
    if (this.inner) this.inner.hass = { ...hass, locale: { ...hass.locale, time_format: '12' } };
  }
}
if (!customElements.get('pg-twelve-hour')) customElements.define('pg-twelve-hour', TwelveHour);

const FIVE = 300_000;
/** A pseudo-random fraction of an index, the same on every page. */
const noise = (i: number): number => (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;

/**
 * A cloudy day of an array's power (#138), as Home Assistant keeps it: its five-minute means (kW) — a hill from 07:00
 * to 17:00 that clouds cut into, 2.61 at 12:00 between two dips, its peak 2.94 at 11:35.
 */
export const CLOUDY = Array.from({ length: 288 }, (_, i) => {
  if (i === 139) return 2.94;
  if (i === 144) return 2.61;
  const sun = Math.max(0, Math.sin(((i - 84) / 120) * Math.PI)) ** 1.5 * 2.3;
  const sky = noise(i);
  // a cloud's shade, or the bright edge of one
  return Math.round(sun * (sky > 0.85 ? 1.15 : 0.3 + 0.6 * sky) * 100) / 100;
});

/** Where an instant falls on the cloudy day: its five-minute bucket of the page's day. */
const bucketOf = (t: number): number => Math.floor((t - new Date(t).setHours(0, 0, 0, 0)) / FIVE);

/** The minutes inside a bucket: around its mean, which they average to (the history the recorder means). */
const minuteOf = (t: number): number => {
  const mean = CLOUDY[bucketOf(t)] ?? 0;
  const k = Math.floor(t / 60_000) % 5;
  return Math.max(0, mean * (1 + [0.25, -0.25, 0.12, -0.12, 0][k]!));
};

/**
 * Home Assistant's own line of the cloudy day: its five-minute means, each at its start, under a plain polyline — what
 * the energy card above it must draw (the same peaks, 12:00 the bucket from 12:00).
 */
class MeansLine extends HTMLElement implements LovelaceCard {
  setConfig(): void {
    const w = 320;
    const h = 120;
    const top = Math.max(...CLOUDY);
    const at = (i: number): string =>
      `${((i / 288) * w).toFixed(1)},${(h - ((CLOUDY[i] ?? 0) / top) * (h - 8)).toFixed(1)}`;
    // its own line height: a system font's own would set the line under it off the grid on one machine and not another
    this.style.cssText = 'display:block;padding:12px 20px;font:500 11px/16px system-ui;color:#888';
    this.innerHTML = `<div>Home Assistant · 12:00 ${CLOUDY[144]} kW · peak ${top} kW</div>
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="display:block">
        <line x1="${w / 2}" x2="${w / 2}" y1="0" y2="${h}" stroke="#bbb" stroke-dasharray="2 3" />
        <polyline fill="none" stroke="#7a9a2a" stroke-width="1" vector-effect="non-scaling-stroke"
          points="${CLOUDY.map((_, i) => at(i)).join(' ')}" />
      </svg>`;
  }

  getCardSize(): number {
    return 3;
  }

  set hass(_hass: HomeAssistant) {}
}
if (!customElements.get('pg-means-line')) customElements.define('pg-means-line', MeansLine);

/**
 * A cloudy array as the recorder answers for it (`id`): its statistics' buckets compiled so far, its minutes' history —
 * the window sheet's too.
 */
export const cloudyWs = (id: string) => ({
  'recorder/statistics_during_period': (message: Record<string, unknown>) => {
    const ids = message['statistic_ids'] as readonly string[];
    if (!ids.includes(id)) return undefined;
    const from = Math.floor(Date.parse(String(message['start_time'])) / FIVE) * FIVE;
    const to = Math.min(
      Date.parse(String(message['end_time'] ?? new Date().toISOString())),
      Date.now(),
    );
    const rows = [];
    for (let start = from; start + FIVE <= to; start += FIVE)
      rows.push({ start, end: start + FIVE, mean: CLOUDY[bucketOf(start)] });
    return { [id]: rows };
  },
  'history/history_during_period': (message: Record<string, unknown>) => {
    const ids = message['entity_ids'] as readonly string[];
    if (!ids.includes(id)) return undefined;
    const from = Math.floor(Date.parse(String(message['start_time'])) / 60_000) * 60_000;
    const to = Date.parse(String(message['end_time']));
    const states = [];
    for (let t = from; t <= to; t += 60_000)
      states.push({ s: minuteOf(t).toFixed(3), lu: Math.max(t, from) / 1000 });
    return { [id]: states };
  },
});

type Attributes = Record<string, unknown>;
const power = (name: string, unit: 'W' | 'kW' = 'W'): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class: 'power',
  state_class: 'measurement',
});
const energy = (name: string, unit: 'Wh' | 'kWh' | 'MJ' = 'kWh'): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class: 'energy',
  state_class: 'total_increasing',
});

/** The sheet draws its curves through a dozen points; a recorder returns many more. Same shape, eased between the points. */
const dense = (points: readonly number[], scale: number, per = 8): number[] =>
  points.flatMap((value, i) => {
    const next = points[i + 1];
    if (next === undefined) return [Math.round(value * scale)];
    return Array.from({ length: per }, (_, step) =>
      Math.round((value + ((next - value) * (1 - Math.cos((step / per) * Math.PI))) / 2) * scale),
    );
  });

/**
 * The grid meter's readings at the ends of the day's hours so far, 00:00 to 21:00 (kWh): all it ever counted, 12.5
 * MWh, and 7.5 kWh of it today — what an energy card's legend reads with `period: today`.
 */
const GRID_METER = [
  12526.7, 12526.8, 12527.0, 12527.3, 12527.8, 12528.3, 12528.6, 12528.8, 12528.9, 12529.0, 12529.1,
  12529.3, 12529.6, 12530.0, 12530.5, 12531.2, 12531.9, 12532.6, 12533.2, 12533.8, 12534.2,
];

/** The grid's import through the day (kW): the night's trickle, the cooking, the evening. */
const GRID_DAY = [0.3, 0.2, 0.2, 0.3, 0.9, 1.2, 0.4, 0.1, 0.1, 0.6, 1.4, 1.8, 1.4];

/**
 * Marta’s flat as the energy sheet draws it: solar 3.2 kW, the grid importing 0.4 kW, the battery
 * charging at 1.1 kW, the house on 2.5 kW. Every id carries `ef_`: other sheets have a house too.
 */
export const sheet: SheetSpec = {
  states: [
    /* the house — on purpose in W, the unit most inverters report, beside a second integration in kW */
    ['sensor.ef_house_power', '2500', power('House power')],
    ['sensor.ef_solar_power', '3.2', power('Solar power', 'kW')],
    ['sensor.ef_grid_power', '400', power('Grid power')],
    ['sensor.ef_battery_power', '-1100', power('Battery power')], // negative = charging
    [
      'sensor.ef_battery_level',
      '78',
      { friendly_name: 'Battery', unit_of_measurement: '%', device_class: 'battery' },
    ],
    ['sensor.ef_cost_now', '0.27', { friendly_name: 'Energy cost', unit_of_measurement: '€/h' }],

    /* today's totals */
    ['sensor.ef_grid_today', '4.1', energy('Grid')],
    ['sensor.ef_solar_today', '5700', energy('Solar', 'Wh')],
    ['sensor.ef_peak_today', '2800', power('Peak')],
    ['sensor.ef_self_use', '88', { friendly_name: 'Self-use', unit_of_measurement: '%' }],
    ['sensor.ef_exported_today', '1.3', energy('Exported')],
    ['sensor.ef_imported_today', '4.1', energy('Imported')],

    /* the grid's lifetime meter, and a second connection's meter that reads negative while it imports */
    ['sensor.ef_grid_meter', String(GRID_METER[GRID_METER.length - 1]), energy('Grid meter')],
    ['sensor.ef_garage_power', '-1400', power('Garage meter')],

    /* a flat without solar; a house that exports through a meter that signs export as positive */
    ['sensor.ef_flat_grid_power', '1.4', power('Grid power', 'kW')],
    ['sensor.ef_flat_house_power', '1400', power('House power')],
    ['sensor.ef_export_grid_power', '1800', power('Grid power')],

    /* an evening on the battery: no sun, the battery discharging, a trickle from the grid, no house meter */
    ['sensor.ef_night_solar_power', '-4', power('Solar power')], // the inverter's own standby draw
    ['sensor.ef_night_grid_power', '35', power('Grid power')],
    ['sensor.ef_night_battery_power', '820', power('Battery power')], // positive = discharging
    [
      'sensor.ef_night_battery_level',
      '41.6',
      { friendly_name: 'Battery', unit_of_measurement: '%', device_class: 'battery' },
    ],

    /* appliances drawing now (the sheet's list), in two units */
    ['sensor.ef_dishwasher_power', '1.4', power('Dishwasher', 'kW')],
    ['sensor.ef_heat_pump_power', '900', power('Heat pump')],
    ['sensor.ef_media_power', '96', power('Media')],
    ['sensor.ef_fridge_power', '104', power('Fridge')],

    /* appliances today, in three units, one with its cost, one asleep, one gone, one that is not energy at all */
    ['sensor.ef_dishwasher_energy', '1.42', energy('Dishwasher')],
    ['sensor.ef_heat_pump_energy', '13.7', energy('Heat pump', 'MJ')],
    ['sensor.ef_media_energy', '420', energy('Kitchen speaker', 'Wh')],
    ['sensor.ef_fridge_energy', '0.9', energy('Fridge')],
    ['sensor.ef_oven_energy', '0', energy('Oven')],
    [
      'sensor.ef_dishwasher_cost',
      '0.3',
      { friendly_name: 'Dishwasher cost', unit_of_measurement: '€', device_class: 'monetary' },
    ],
    ['sensor.ef_dryer_energy', 'unavailable', energy('Dryer')],
    [
      'sensor.ef_tap_water',
      '84',
      { friendly_name: 'Kitchen tap', unit_of_measurement: 'L', device_class: 'water' },
    ],

    /* the cloudy day's array (#138), asleep now */
    ['sensor.ef_cloudy_pv', '0.00', power('Solar production', 'kW')],

    /* hard states */
    ['sensor.ef_quiet_power', '1200', power('Utility room power')], // no history at all
    ['sensor.ef_dead_power', 'unavailable', power('House power')],
    ['sensor.ef_dead_solar', 'unavailable', power('Solar power')],
    ['sensor.ef_dead_grid', 'unknown', power('Grid power')],
    ['sensor.ef_dead_energy', 'unavailable', energy('Grid')],
  ],

  /* the mock spreads each series evenly over whatever window the card asks for */
  history: {
    'sensor.ef_house_power': dense(
      [0.6, 0.4, 0.3, 0.3, 0.5, 1.4, 2.1, 1.6, 1.2, 1.9, 2.8, 2.2, 2.5],
      1000,
    ),
    'sensor.ef_flat_house_power': dense([0.9, 0.7, 1.8, 1.1, 0.9, 1.5, 2.2, 1.6, 1.4], 1000),
    'sensor.ef_dead_power': [900, 850, 800, 780, 1100, 1400],
    // the evening's import easing to the 0.4 kW it reads now
    'sensor.ef_grid_power': dense([...GRID_DAY.slice(0, -2), 1.1, 0.4], 1000),
    'sensor.ef_heat_pump_power': dense(
      [0.2, 0.2, 0.9, 1.1, 0.6, 0.3, 0.2, 0.4, 1.0, 1.2, 0.9],
      1000,
    ),
    // the garage's meter signs what it imports negative: its curve is the grid's, upside down
    'sensor.ef_garage_power': dense(GRID_DAY, -1000),
  },

  statistics: { 'sensor.ef_grid_meter': { kind: 'counter', hourly: GRID_METER } },

  /** The picker the cloudy day's card follows: today, unless the page says `?period=`. */
  collections: ['energy_cloudy'],

  /**
   * The flat's Energy dashboard: its grid (the power and the lifetime meter), a second connection whose meter reads
   * negative while it imports, the sun, and the heat pump among the individual devices — what an energy card's line
   * reads as the grid's, the sun's or the house's.
   */
  ws: {
    ...cloudyWs('sensor.ef_cloudy_pv'),
    'energy/get_prefs': () => ({
      energy_sources: [
        {
          type: 'grid',
          stat_energy_from: 'sensor.ef_grid_meter',
          stat_rate: 'sensor.ef_grid_power',
        },
        { type: 'grid', power_config: { stat_rate_inverted: 'sensor.ef_garage_power' } },
        {
          type: 'solar',
          stat_energy_from: 'sensor.ef_solar_today',
          stat_rate: 'sensor.ef_solar_power',
        },
      ],
      device_consumption: [
        { stat_consumption: 'sensor.ef_heat_pump_energy', stat_rate: 'sensor.ef_heat_pump_power' },
      ],
    }),
  },

  frames: [
    {
      title: 'Energy',
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_house_power',
          title: 'Energy',
          cost_entity: 'sensor.ef_cost_now',
          _now: SHEET_NOW,
          legend: [
            { entity: 'sensor.ef_grid_today', label: 'Grid' },
            { entity: 'sensor.ef_solar_today', label: 'Solar' },
            { entity: 'sensor.ef_peak_today', label: 'Peak' },
          ],
        },
      ],
    },
    // the head, the chart and its axis: half a section
    // the one rule for units and decimals: the frame above as the house asks it — watts whatever the size, no
    // decimals, one legend item in watt-hours of its own
    {
      title: 'Units and decimals · W, no decimals',
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_house_power',
          title: 'Energy',
          unit: 'W',
          decimals: 0,
          cost_entity: 'sensor.ef_cost_now',
          _now: SHEET_NOW,
          legend: [
            { entity: 'sensor.ef_grid_today', label: 'Grid' },
            { entity: 'sensor.ef_solar_today', label: 'Solar', unit: 'Wh' },
            { entity: 'sensor.ef_peak_today', label: 'Peak' },
          ],
        },
      ],
    },
    {
      title: 'Energy · compact',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_house_power',
          variant: 'compact',
          _now: SHEET_NOW,
        },
      ],
    },
    {
      title: 'Flow',
      cards: [
        {
          type: 'custom:fluvy-energy-flow-card',
          subtitle: 'Live · 5 s ago', // the sheet's words; the other frames leave the card to say how fresh its readings are
          solar_power: 'sensor.ef_solar_power',
          grid_power: 'sensor.ef_grid_power',
          battery_power: 'sensor.ef_battery_power',
          battery_level: 'sensor.ef_battery_level',
          home_power: 'sensor.ef_house_power',
          readouts: [
            { entity: 'sensor.ef_self_use', label: 'Self-use' },
            { entity: 'sensor.ef_exported_today', label: 'Exported' },
            { entity: 'sensor.ef_imported_today', label: 'Imported' },
          ],
        },
      ],
    },
    {
      title: 'Appliances',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          rows: [
            { entity: 'sensor.ef_fridge_power', icon: 'plug' },
            { entity: 'sensor.ef_dishwasher_power', icon: 'plug' },
            { entity: 'sensor.ef_media_power', icon: 'speaker', tone: 'media' },
            { entity: 'sensor.ef_heat_pump_power', icon: 'thermo', tone: 'heat' },
          ],
        },
      ],
    },
    {
      title: 'Appliances today',
      cards: [
        {
          type: 'custom:fluvy-energy-devices-card',
          title: 'Consumption',
          icon: 'home',
          rows: [
            {
              entity: 'sensor.ef_dishwasher_energy',
              icon: 'plug',
              cost_entity: 'sensor.ef_dishwasher_cost',
            },
            { entity: 'sensor.ef_heat_pump_energy', icon: 'thermo', tone: 'heat' },
            { entity: 'sensor.ef_media_energy', name: 'Media', icon: 'speaker', tone: 'media' },
            { entity: 'sensor.ef_fridge_energy', icon: 'plug' },
            { entity: 'sensor.ef_oven_energy', icon: 'flame' },
            { entity: 'sensor.ef_dryer_energy', icon: 'plug' },
            { entity: 'sensor.ef_tap_water' },
          ],
        },
      ],
    },
    {
      title: 'No solar',
      cards: [
        {
          type: 'custom:fluvy-energy-flow-card',
          grid_power: 'sensor.ef_flat_grid_power',
          home_power: 'sensor.ef_flat_house_power',
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Legs',
          flow_style: 'legs',
          solar_power: 'sensor.ef_solar_power',
          grid_power: 'sensor.ef_grid_power',
          home_power: 'sensor.ef_house_power',
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Rail',
          flow_style: 'rail',
          solar_power: 'sensor.ef_solar_power',
          grid_power: 'sensor.ef_grid_power',
          home_power: 'sensor.ef_house_power',
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Rail · lone source',
          flow_style: 'rail',
          grid_power: 'sensor.ef_flat_grid_power',
          home_power: 'sensor.ef_flat_house_power',
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Narrow',
          solar_power: 'sensor.ef_solar_power',
          grid_power: 'sensor.ef_grid_power',
          home_power: 'sensor.ef_house_power',
          cols: 6,
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Narrow rail',
          flow_style: 'rail',
          solar_power: 'sensor.ef_solar_power',
          grid_power: 'sensor.ef_grid_power',
          battery_power: 'sensor.ef_battery_power',
          home_power: 'sensor.ef_house_power',
          cols: 6,
        },
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_flat_house_power',
          title: 'Energy',
          hours: 6,
        },
      ],
    },
    {
      title: '12-hour clock · mixed units',
      cards: [
        {
          type: 'pg-twelve-hour',
          card: 'fluvy-energy-card',
          entity: 'sensor.ef_house_power',
          title: 'Energy',
          _now: SHEET_NOW,
          legend: ['sensor.ef_media_energy', 'sensor.ef_grid_today', 'sensor.ef_peak_today'],
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Totals in one unit',
          subtitle: 'Live · 5 s ago',
          solar_power: 'sensor.ef_solar_power',
          grid_power: 'sensor.ef_grid_power',
          readouts: [
            'sensor.ef_media_energy',
            'sensor.ef_exported_today',
            'sensor.ef_imported_today',
          ],
        },
      ],
    },
    {
      title: 'Exporting',
      cards: [
        {
          type: 'custom:fluvy-energy-flow-card',
          solar_power: 'sensor.ef_solar_power',
          grid_power: 'sensor.ef_export_grid_power',
          grid_invert: true,
        },
      ],
    },
    {
      title: 'On the battery',
      cards: [
        {
          type: 'custom:fluvy-energy-flow-card',
          solar_power: 'sensor.ef_night_solar_power',
          grid_power: 'sensor.ef_night_grid_power',
          battery_power: 'sensor.ef_night_battery_power',
          battery_level: 'sensor.ef_night_battery_level',
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Battery',
          subtitle: 'Garage · 10 kWh',
          battery_power: 'sensor.ef_battery_power',
          battery_invert: true,
          battery_level: 'sensor.ef_battery_level',
        },
      ],
    },
    {
      title: 'Nothing to show',
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_quiet_power',
          title: 'Utility room',
        },
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_dead_power',
          title: 'Energy',
          cost_entity: 'sensor.ef_cost_now',
          legend: ['sensor.ef_dead_energy', { entity: 'sensor.ef_missing_energy', label: 'Solar' }],
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          solar_power: 'sensor.ef_dead_solar',
          grid_power: 'sensor.ef_dead_grid',
          home_power: 'sensor.ef_dead_power',
        },
        {
          type: 'custom:fluvy-energy-flow-card',
          title: 'Half known',
          solar_power: 'sensor.ef_dead_solar',
          grid_power: 'sensor.ef_grid_power',
        },
        {
          type: 'custom:fluvy-energy-devices-card',
          rows: [
            { entity: 'sensor.ef_dryer_energy' },
            { entity: 'sensor.ef_dead_energy', name: 'Washer' },
          ],
        },
        { type: 'custom:fluvy-energy-card', entity: 'sensor.ef_not_there' },
      ],
    },
    // the line wears what it shows (1.11.1): the grid's power, a device the Energy dashboard counts in the house
    {
      title: 'What the line shows · the grid, a device',
      cards: [
        { type: 'custom:fluvy-energy-card', entity: 'sensor.ef_grid_power', _now: SHEET_NOW },
        { type: 'custom:fluvy-energy-card', entity: 'sensor.ef_heat_pump_power', _now: SHEET_NOW },
      ],
    },
    // a meter that reads negative while it imports, read the other way round; a lifetime meter's day in the legend
    {
      title: 'Read the other way round · the day of a lifetime meter',
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_garage_power',
          invert: true,
          _now: SHEET_NOW,
          legend: [
            { entity: 'sensor.ef_grid_meter', name: 'Imported', period: 'today' },
            { entity: 'sensor.ef_solar_today', name: 'Solar' },
          ],
        },
      ],
    },
    // #138: a cloudy day, every five minutes where Home Assistant puts it — following a picker (its statistics), and
    // not (its history) — each over Home Assistant's own line of the same means
    {
      title: 'A cloudy day · following a picker',
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_cloudy_pv',
          collection_key: 'energy_cloudy',
          tone: 'solar',
          decimals: 2,
        },
        { type: 'pg-means-line' },
      ],
    },
    {
      title: 'A cloudy day · its history',
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_cloudy_pv',
          tone: 'solar',
          decimals: 2,
        },
        { type: 'pg-means-line' },
      ],
    },
    // the sensor card on the same history: each half hour's mean, its Min and Max the day's own
    {
      title: 'A cloudy day · the sensor card',
      cards: [{ type: 'custom:fluvy-sensor-card', entity: 'sensor.ef_cloudy_pv' }],
    },
    // the compact chart at its own size: half a section
    {
      title: 'Energy · compact · half a section',
      cards: [
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_house_power',
          variant: 'compact',
          _now: SHEET_NOW,
          cols: 6,
        },
        {
          type: 'custom:fluvy-energy-card',
          entity: 'sensor.ef_solar_power',
          variant: 'compact',
          _now: SHEET_NOW,
          cols: 6,
        },
      ],
    },
  ],
};
