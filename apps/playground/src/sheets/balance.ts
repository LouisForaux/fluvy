import { FluvyEnergyBalanceCard } from '../../../../packages/cards/src/balance/balance-card.js';
import { FluvyGaugeCard } from '../../../../packages/cards/src/gauge/gauge-card.js';
import { FluvyGridCard } from '../../../../packages/cards/src/grid/grid-card.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-energy-balance-card'))
  customElements.define('fluvy-energy-balance-card', FluvyEnergyBalanceCard);
if (!customElements.get('fluvy-grid-card')) customElements.define('fluvy-grid-card', FluvyGridCard);
if (!customElements.get('fluvy-gauge-card'))
  customElements.define('fluvy-gauge-card', FluvyGaugeCard);

/**
 * The energy balance, the grid and the signed gauge (1.4), on the #19 house: 3.2 kW of sun on one phase, the grid
 * 1.9 kW in on two phases and 0.4 out on the third, the battery charging 0.6. Every id carries `bl_`.
 */
const NOW = '2026-09-17T21:47:12';

type Attributes = Record<string, unknown>;
const power = (name: string, unit: 'W' | 'kW' = 'W'): Attributes => ({
  friendly_name: name,
  unit_of_measurement: unit,
  device_class: 'power',
  state_class: 'measurement',
});
const energy = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'kWh',
  device_class: 'energy',
  state_class: 'total_increasing',
});
const volts = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'V',
  device_class: 'voltage',
  state_class: 'measurement',
});
const money = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: 'EUR',
  device_class: 'monetary',
  state_class: 'total',
});

const house19 = {
  sources: [
    { type: 'solar', power: 'sensor.bl_solar' },
    { type: 'grid', phases: ['sensor.bl_l1', 'sensor.bl_l2', 'sensor.bl_l3'] },
    { type: 'battery', power: 'sensor.bl_battery' },
  ],
  _now: NOW,
};

/** #140's house: two arrays, the first one's inverter offline, and the grid. */
const TWO_ARRAYS = [
  { type: 'solar', power: 'sensor.bl_e1' },
  { type: 'solar', power: 'sensor.bl_e2' },
  { type: 'grid', power: 'sensor.bl_e_grid' },
];

/** A day's energy and money in four buckets (night, morning, afternoon, evening). */
const DAY = Date.parse('2026-09-16T22:00:00Z');
const buckets = (values: readonly number[]): { start: number; change: number }[] =>
  values.map((change, i) => ({ start: DAY + i * 6 * 3600_000, change }));
const STATS: Record<string, { start: number; change: number }[]> = {
  'sensor.bl_grid_in_energy': buckets([2.0, 0.3, 0, 1.8]),
  'sensor.bl_grid_out_energy': buckets([0, 0.4, 0.9, 0]),
  'sensor.bl_solar_energy': buckets([0, 4.0, 7.2, 0]),
  'sensor.bl_battery_out_energy': buckets([1.4, 0, 0, 1.0]),
  'sensor.bl_battery_in_energy': buckets([0, 1.6, 1.4, 0]),
  // the grid's money: what importing cost (its own statistic) and what exporting paid (the one Home Assistant made)
  'sensor.bl_grid_cost': buckets([0.62, 0.09, 0, 0.56]),
  'sensor.bl_grid_out_energy_compensation': buckets([0, 0.03, 0.07, 0]),
};

export const sheet: SheetSpec = {
  states: [
    ['sensor.bl_solar', '3.2', power('Solar power', 'kW')],
    ['sensor.bl_l1', '-0.4', power('Grid L1', 'kW')],
    ['sensor.bl_l2', '1000', power('Grid L2')],
    ['sensor.bl_l3', '0.9', power('Grid L3', 'kW')],
    ['sensor.bl_battery', '-600', power('Battery power')],
    ['sensor.bl_v1', '229.2', volts('Voltage L1')],
    ['sensor.bl_v2', '231.8', volts('Voltage L2')],
    ['sensor.bl_v3', '231.0', volts('Voltage L3')],
    [
      'sensor.bl_price',
      '0.31',
      {
        friendly_name: 'Electricity price',
        unit_of_measurement: '€/kWh',
        device_class: 'monetary',
      },
    ],

    /* two sensors, in and out (the Energy dashboard's grid too) */
    ['sensor.bl_grid_in', '1.9', power('Grid import', 'kW')],
    ['sensor.bl_grid_out', '400', power('Grid export')],
    /* one signed sensor */
    ['sensor.bl_grid_net', '-1.8', power('Grid power', 'kW')],
    ['sensor.bl_grid_import', '2.4', power('Grid power', 'kW')],

    /* two roofs, two batteries, a generator and a car */
    ['sensor.bl_east', '2.1', power('East roof', 'kW')],
    ['sensor.bl_west', '1.4', power('West roof', 'kW')],
    ['sensor.bl_many_grid', '-300', power('Grid power')],
    ['sensor.bl_garage', '-800', power('Garage battery')],
    ['sensor.bl_basement', '500', power('Basement battery')],
    ['sensor.bl_generator', '1.2', power('Generator', 'kW')],
    ['sensor.bl_car', '-3.7', power('Car', 'kW')],
    /* #140: two arrays, the first one's inverter offline */
    ['sensor.bl_e1', 'unavailable', power('MPPT power E1')],
    ['sensor.bl_e2', '942', power('MPPT power E2')],
    ['sensor.bl_e_grid', '300', power('Grid power')],

    /* the grid unreadable */
    ['sensor.bl_down_solar', '1.8', power('Solar power', 'kW')],
    ['sensor.bl_down_l1', '0.3', power('Grid L1', 'kW')],
    ['sensor.bl_down_l2', 'unavailable', power('Grid L2')],
    ['sensor.bl_down_l3', '0.2', power('Grid L3', 'kW')],
    ['sensor.bl_down_net', 'unavailable', power('Grid power', 'kW')],

    /* nothing new for twelve minutes */
    ['sensor.bl_stale_solar', '3.2', power('Solar power', 'kW'), 720],
    ['sensor.bl_stale_grid', '1.5', power('Grid power', 'kW'), 720],

    /* not power: a signed temperature */
    [
      'sensor.bl_outside',
      '-4.2',
      { friendly_name: 'Outside', unit_of_measurement: '°C', device_class: 'temperature' },
    ],

    /* the Energy dashboard's meters and money */
    ['sensor.bl_grid_in_energy', '4.1', energy('Grid import')],
    ['sensor.bl_grid_out_energy', '1.3', energy('Grid export')],
    ['sensor.bl_solar_energy', '11.2', energy('Solar')],
    ['sensor.bl_battery_out_energy', '2.4', energy('Battery out')],
    ['sensor.bl_battery_in_energy', '3.0', energy('Battery in')],
    ['sensor.bl_grid_cost', '1.27', money('Grid cost')],
    ['sensor.bl_grid_out_energy_compensation', '0.10', money('Grid compensation')],
    ['sensor.bl_self_use', '72', { friendly_name: 'Self-powered', unit_of_measurement: '%' }],
  ],

  /** The signed meter over the day: out 2.2 at most, in 0.4 at most. */
  history: {
    'sensor.bl_grid_net': [0.4, 0.1, -0.6, -1.4, -2.2, -2.0, -1.8],
    'sensor.bl_grid_import': [0.3, 0.9, 1.6, 2.4, 3.1, 2.4],
    'sensor.bl_outside': [2.1, 0.4, -1.8, -3.9, -4.2],
  },

  ws: {
    'energy/get_prefs': () => ({
      energy_sources: [
        {
          type: 'grid',
          stat_energy_from: 'sensor.bl_grid_in_energy',
          stat_energy_to: 'sensor.bl_grid_out_energy',
          stat_cost: 'sensor.bl_grid_cost',
          stat_compensation: null,
          power_config: { stat_rate_from: 'sensor.bl_grid_in', stat_rate_to: 'sensor.bl_grid_out' },
        },
        { type: 'solar', stat_energy_from: 'sensor.bl_solar_energy', stat_rate: 'sensor.bl_solar' },
        {
          type: 'battery',
          stat_energy_from: 'sensor.bl_battery_out_energy',
          stat_energy_to: 'sensor.bl_battery_in_energy',
          stat_rate: 'sensor.bl_battery',
        },
      ],
      device_consumption: [],
    }),
    'energy/info': () => ({
      cost_sensors: { 'sensor.bl_grid_out_energy': 'sensor.bl_grid_out_energy_compensation' },
    }),
    'recorder/statistics_during_period': (message) =>
      Object.fromEntries(
        ((message['statistic_ids'] as string[] | undefined) ?? []).map((id) => [
          id,
          STATS[id] ?? [],
        ]),
      ),
  },

  frames: [
    /* ---------- the balance ---------- */
    {
      title: 'Balance · live, per phase',
      cards: [{ type: 'custom:fluvy-energy-balance-card', ...house19 }],
    },
    {
      title: 'Balance · today',
      cards: [{ type: 'custom:fluvy-energy-balance-card', period: 'day', _now: NOW }],
    },
    {
      title: 'Balance · the Energy dashboard’s, live',
      cards: [{ type: 'custom:fluvy-energy-balance-card', _now: NOW }],
    },
    {
      title: 'Balance · two roofs, two batteries, a generator, a car',
      cards: [
        {
          type: 'custom:fluvy-energy-balance-card',
          sources: [
            { type: 'solar', power: 'sensor.bl_east' },
            { type: 'solar', power: 'sensor.bl_west' },
            { type: 'grid', power: 'sensor.bl_many_grid' },
            { type: 'battery', power: 'sensor.bl_garage' },
            { type: 'battery', power: 'sensor.bl_basement' },
            { type: 'generator', power: 'sensor.bl_generator' },
            { type: 'vehicle', power: 'sensor.bl_car' },
          ],
          _now: NOW,
        },
      ],
    },
    // #140: every array counts, the one offline as nothing — the house is still worked out
    {
      title: 'Two arrays · the first offline',
      cards: [
        { type: 'custom:fluvy-energy-flow-card', sources: TWO_ARRAYS, _now: NOW },
        { type: 'custom:fluvy-energy-balance-card', sources: TWO_ARRAYS, _now: NOW },
      ],
    },
    {
      title: 'Balance · long names',
      cards: [
        {
          type: 'custom:fluvy-energy-balance-card',
          title: 'Energy balance of the whole house and the garden studio',
          sources: [
            { type: 'solar', power: 'sensor.bl_solar', name: 'South-west roof array' },
            { type: 'grid', power: 'sensor.bl_grid_import', name: 'Utility connection' },
            { type: 'battery', power: 'sensor.bl_battery', name: 'Garage battery pack' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Balance · the grid unreadable',
      cards: [
        {
          type: 'custom:fluvy-energy-balance-card',
          sources: [
            { type: 'solar', power: 'sensor.bl_down_solar' },
            {
              type: 'grid',
              phases: ['sensor.bl_down_l1', 'sensor.bl_down_l2', 'sensor.bl_down_l3'],
            },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Balance · a missing sensor',
      cards: [
        {
          type: 'custom:fluvy-energy-balance-card',
          sources: [
            { type: 'solar', power: 'sensor.bl_solar' },
            { type: 'grid', power: 'sensor.bl_nowhere' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Balance · stale',
      cards: [
        {
          type: 'custom:fluvy-energy-balance-card',
          sources: [
            { type: 'solar', power: 'sensor.bl_stale_solar' },
            { type: 'grid', power: 'sensor.bl_stale_grid' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Balance · a desktop column',
      width: 392,
      cards: [{ type: 'custom:fluvy-energy-balance-card', ...house19 }],
    },
    {
      title: 'Balance · half a column',
      cards: [
        { type: 'custom:fluvy-energy-balance-card', ...house19, title: 'Balance', cols: 6 },
        {
          type: 'custom:fluvy-energy-balance-card',
          title: 'Today',
          period: 'day',
          _now: NOW,
          cols: 6,
        },
      ],
    },

    /* ---------- the grid ---------- */
    {
      title: 'Grid · three phases, the price',
      cards: [
        {
          type: 'custom:fluvy-grid-card',
          phases: ['sensor.bl_l1', 'sensor.bl_l2', 'sensor.bl_l3'],
          voltages: ['sensor.bl_v1', 'sensor.bl_v2', 'sensor.bl_v3'],
          price: 'sensor.bl_price',
          _now: NOW,
        },
      ],
    },
    {
      title: 'Grid · the Energy dashboard’s',
      cards: [{ type: 'custom:fluvy-grid-card', _now: NOW }],
    },
    {
      title: 'Grid · one signed sensor, readouts',
      cards: [
        {
          type: 'custom:fluvy-grid-card',
          power: 'sensor.bl_grid_net',
          readouts: [
            { entity: 'sensor.bl_self_use', name: 'Self-powered' },
            { entity: 'sensor.bl_grid_out_energy', name: 'Exported' },
            { entity: 'sensor.bl_grid_in_energy', name: 'Imported' },
          ],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Grid · a phase unreadable',
      cards: [
        {
          type: 'custom:fluvy-grid-card',
          phases: ['sensor.bl_down_l1', 'sensor.bl_down_l2', 'sensor.bl_down_l3'],
          price: 'sensor.bl_nowhere_price',
          _now: NOW,
        },
      ],
    },
    {
      title: 'Grid · long names',
      cards: [
        {
          type: 'custom:fluvy-grid-card',
          title: 'Main utility connection in the basement',
          import: 'sensor.bl_grid_in',
          export: 'sensor.bl_grid_out',
          price: 'sensor.bl_price',
          _now: NOW,
        },
      ],
    },
    {
      title: 'Grid · a desktop column',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-grid-card',
          phases: ['sensor.bl_l1', 'sensor.bl_l2', 'sensor.bl_l3'],
          voltages: ['sensor.bl_v1', 'sensor.bl_v2', 'sensor.bl_v3'],
          price: 'sensor.bl_price',
          _now: NOW,
        },
      ],
    },
    {
      title: 'Grid · half a column',
      cards: [
        {
          type: 'custom:fluvy-grid-card',
          phases: ['sensor.bl_l1', 'sensor.bl_l2', 'sensor.bl_l3'],
          voltages: ['sensor.bl_v1', 'sensor.bl_v2', 'sensor.bl_v3'],
          price: 'sensor.bl_price',
          _now: NOW,
          cols: 6,
        },
        { type: 'custom:fluvy-grid-card', _now: NOW, cols: 6 },
      ],
    },

    /* ---------- the signed gauge ---------- */
    {
      title: 'Gauge · signed, exporting',
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_grid_net',
          variant: 'signed',
          icon: 'tower',
          label: 'Net',
          max: 5,
        },
      ],
    },
    // the signed ring with its row's average alone (#83)
    {
      title: 'Gauge · signed, the average alone',
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_grid_net',
          variant: 'signed',
          icon: 'tower',
          label: 'Net',
          max: 5,
          stats: ['average'],
        },
      ],
    },
    {
      title: 'Gauge · signed, no row',
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_grid_net',
          variant: 'signed',
          icon: 'tower',
          label: 'Net',
          max: 5,
          show_stats: false,
        },
      ],
    },
    {
      title: 'Gauge · signed, importing, its scale from the day',
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_grid_import',
          variant: 'signed',
          icon: 'tower',
        },
      ],
    },
    {
      title: 'Gauge · signed, not power',
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_outside',
          variant: 'signed',
          min: -20,
          max: 40,
        },
      ],
    },
    {
      title: 'Gauge · signed, unavailable',
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_down_net',
          variant: 'signed',
          icon: 'tower',
          max: 5,
        },
      ],
    },
    {
      title: 'Gauge · signed, a desktop column',
      width: 392,
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_grid_net',
          name: 'Grid power at the main distribution board',
          variant: 'signed',
          icon: 'tower',
          label: 'Net',
          max: 5,
        },
      ],
    },
    {
      title: 'Gauge · signed, half a column',
      cards: [
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_grid_net',
          variant: 'signed',
          icon: 'tower',
          label: 'Net',
          max: 5,
          cols: 6,
        },
        {
          type: 'custom:fluvy-gauge-card',
          entity: 'sensor.bl_outside',
          variant: 'signed',
          min: -20,
          max: 40,
          cols: 6,
        },
      ],
    },
  ],
};
