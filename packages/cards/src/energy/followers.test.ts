// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { balanceHeight, flowHeight, sankeyHeight, scoreHeight } from '../energy-family.js';
import type { EnergyCollectionLike, EnergyDataLike } from '../energy-model/collection.js';
import { allocatePeriod, houseMidnight } from '../energy-model/period.js';
import { readPrefs, type EnergyPrefs } from '../energy-model/prefs.js';
import { familiesDefined } from '../index.js';
import { clearMeterCache } from '../meters/today.js';
import type { CardEditor } from '../shared/base.js';
import type { EditorChoices } from '../shared/rows-editor.js';

// the energy family lands with the index: the cards' tags are defined before a page needs them
await familiesDefined;

/** The flow sheet's Energy dashboard: a grid with import and export, an array, a battery. */
const PREFS: EnergyPrefs = {
  energy_sources: [
    { type: 'grid', stat_energy_from: 'sensor.in', stat_energy_to: 'sensor.out' },
    { type: 'solar', stat_energy_from: 'sensor.sun' },
    { type: 'battery', stat_energy_from: 'sensor.discharged', stat_energy_to: 'sensor.charged' },
  ],
  device_consumption: [],
};

/** A day in four buckets (night, morning, afternoon, evening), as Home Assistant fetched them for the picker. */
const DAY = Date.parse('2026-09-16T22:00:00Z');
const rows = (values: readonly number[]) =>
  values.map((change, i) => ({
    start: DAY + i * 6 * 3_600_000,
    end: DAY + (i + 1) * 6 * 3_600_000,
    change,
  }));
const STATS = {
  'sensor.in': rows([2.0, 0.3, 0, 1.8]),
  'sensor.out': rows([0, 0.4, 0.9, 0]),
  'sensor.sun': rows([0, 4.0, 7.2, 0]),
  'sensor.discharged': rows([1.4, 0, 0, 1.0]),
  'sensor.charged': rows([0, 1.6, 1.4, 0]),
};

type Element = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** The meters as sensors, so no card reports one unavailable. */
const meter = (id: string, state: string) => ({
  entity_id: id,
  state,
  attributes: {
    unit_of_measurement: 'kWh',
    device_class: 'energy',
    state_class: 'total_increasing',
  },
  last_changed: new Date().toISOString(),
  last_updated: new Date().toISOString(),
});

const HOUSE = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24', time_zone: 'server' },
  config: { time_zone: 'Europe/Madrid', currency: 'EUR' },
  states: Object.fromEntries(Object.keys(STATS).map((id, i) => [id, meter(id, String(100 + i))])),
  entities: {},
  devices: {},
  areas: {},
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  callWS: async (message: { type: string }) => (message.type === 'energy/get_prefs' ? PREFS : {}),
};

/**
 * A picker's collection on today (or the day before, `yesterday`), holding Home Assistant's figures, counting who
 * holds it.
 */
function picker(yesterday = false) {
  const today = houseMidnight(HOUSE as unknown as HomeAssistant, new Date());
  const start = yesterday
    ? houseMidnight(HOUSE as unknown as HomeAssistant, new Date(today.getTime() - 1))
    : today;
  const state: EnergyDataLike = {
    start,
    end: new Date(yesterday ? today.getTime() - 1 : start.getTime() + 86_400_000 - 1),
    prefs: PREFS,
    info: { cost_sensors: {} },
    stats: STATS,
  };
  const collection = {
    start: state.start,
    end: state.end,
    state,
    subscribed: 0,
    subscribe() {
      collection.subscribed++;
      return () => {};
    },
    setPeriod() {},
    setCompare() {},
    refresh() {},
  } satisfies EnergyCollectionLike & Record<string, unknown>;
  return collection;
}

const hassWith = (collection: unknown): HomeAssistant =>
  ({ ...HOUSE, connection: { _energy_t: collection } }) as unknown as HomeAssistant;

async function mount(tag: string, config: Record<string, unknown>, hass: HomeAssistant) {
  const card = document.createElement(tag) as Element;
  card.setConfig({ type: `custom:${tag}`, ...config });
  card.hass = hass;
  card.width = 360;
  document.body.append(card);
  await card.updateComplete;
  // the preferences arrive a tick later, then the picker's figures are allocated
  await new Promise((resolve) => setTimeout(resolve, 20));
  await card.updateComplete;
  return card;
}

const text = (card: Element): string =>
  (card.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim();

afterEach(() => {
  document.body.innerHTML = '';
  clearMeterCache();
});

/** What the picker's figures add up to: the house used 13.4 kWh (the Energy dashboard's arithmetic). */
const EXPECTED = allocatePeriod(STATS, readPrefs(PREFS).sources);

describe('the period cards following a date picker', () => {
  it('the figures are allocatePeriod’s over the picker’s statistics, the chips are gone, the subtitle is the range', async () => {
    expect(EXPECTED.allocation.usedTotal).toBeCloseTo(13.4, 5);
    const collection = picker();
    const hass = hassWith(collection);
    for (const [tag, config] of [
      ['fluvy-energy-flow-card', { period: 'day', collection_key: 'energy_t' }],
      ['fluvy-energy-balance-card', { period: 'day', collection_key: 'energy_t' }],
      ['fluvy-energy-sankey-card', { collection_key: 'energy_t' }],
      ['fluvy-energy-score-card', { collection_key: 'energy_t' }],
    ] as const) {
      const card = await mount(tag, config, hass);
      expect(card.shadowRoot?.querySelector('.en-period'), `${tag}: no chips`).toBeNull();
      // the sankey's line carries its total after the range
      expect(card.shadowRoot?.querySelector('.fv-card__sub')?.textContent?.trim(), tag).toMatch(
        /^Today( · |$)/,
      );
      if (tag !== 'fluvy-energy-score-card')
        expect(text(card), `${tag}: the house's 13.4 kWh`).toMatch(/13[.,]4\s?kWh/);
    }
    // four cards, one subscription each, and nothing asked of our own for the figures
    expect(collection.subscribed).toBe(4);
  });

  it('a card keeps its one subscription across updates and lets it go off the page', async () => {
    const collection = picker();
    const card = await mount(
      'fluvy-energy-flow-card',
      { period: 'day', collection_key: 'energy_t' },
      hassWith(collection),
    );
    card.hass = hassWith(collection);
    await card.updateComplete;
    card.hass = hassWith(collection);
    await card.updateComplete;
    expect(collection.subscribed).toBe(1);
  });

  it('a key that is not a collection key is a readable error, as Home Assistant’s cards throw', () => {
    const card = document.createElement('fluvy-energy-flow-card') as Element;
    expect(() =>
      card.setConfig({ type: 'custom:fluvy-energy-flow-card', period: 'day', collection_key: 't' }),
    ).toThrow(/collection_key.*energy_/);
  });

  it('declares the chip-less height while following, whatever show_period says', () => {
    expect(flowHeight({ type: 'x', period: 'day', collection_key: 'energy_t' })).toBe(
      flowHeight({ type: 'x', period: 'day', show_period: false }),
    );
    expect(balanceHeight({ type: 'x', period: 'day', collection_key: 'energy_t' })).toBe(
      balanceHeight({ type: 'x', period: 'day', show_period: false }),
    );
    expect(sankeyHeight({ type: 'x', collection_key: 'energy_t' })).toBe(
      sankeyHeight({ type: 'x', show_period: false }),
    );
    expect(scoreHeight({ type: 'x', collection_key: 'energy_t' })).toBe(
      scoreHeight({ type: 'x', show_period: false }),
    );
    expect(flowHeight({ type: 'x', period: 'day' })).toBe(
      flowHeight({ type: 'x', period: 'day', collection_key: 'energy_t' }) + 60,
    );
  });
});

describe('a follower’s figures in the unit and decimals asked', () => {
  it('the picker’s house reads in the unit asked, at the decimals asked', async () => {
    const hass = hassWith(picker());
    for (const [tag, config] of [
      ['fluvy-energy-flow-card', { period: 'day' }],
      ['fluvy-energy-balance-card', { period: 'day' }],
      ['fluvy-energy-sankey-card', {}],
    ] as const) {
      const following = { ...config, collection_key: 'energy_t' };
      const watts = await mount(tag, { ...following, unit: 'Wh', decimals: 0 }, hass);
      expect(text(watts), `${tag}: in Wh`).toMatch(/13,400\s?Wh/);
      const two = await mount(tag, { ...following, decimals: 2 }, hass);
      expect(text(two), `${tag}: two decimals`).toMatch(/13\.40\s?kWh/);
    }
  });

  it('Water & gas over a past day reads its hours alone, in the unit asked of a litre meter', async () => {
    const day = picker(true);
    const midnight = day.start.getTime();
    const asked: Record<string, unknown>[] = [];
    // the meter's hours as the recorder gives them in the unit asked: 48.15 m³ when the day ended, 0.15 m³ used
    const hours = [
      { start: midnight - 3_600_000, change: 0.4, state: 48.0 },
      { start: midnight + 7 * 3_600_000, change: 0.12, state: 48.12 },
      { start: midnight + 20 * 3_600_000, change: 0.03, state: 48.15 },
    ];
    const hass = {
      ...hassWith(day),
      states: {
        'sensor.water': {
          entity_id: 'sensor.water',
          // the reading now, 60 L past the day's end: not part of a day that is over
          state: '48210',
          attributes: {
            unit_of_measurement: 'L',
            device_class: 'water',
            state_class: 'total_increasing',
          },
          last_changed: '',
          last_updated: '',
        },
      },
      callWS: async (message: Record<string, unknown>) => {
        asked.push(message);
        return message['period'] === 'hour' ? { 'sensor.water': hours } : {};
      },
    } as unknown as HomeAssistant;
    const card = await mount(
      'fluvy-meters-card',
      { meters: ['sensor.water'], collection_key: 'energy_t', unit: 'm³', decimals: 2 },
      hass,
    );
    expect(asked.find((m) => m['period'] === 'hour')?.['units']).toEqual({ volume: 'm³' });
    expect(card.shadowRoot?.querySelector('.fv-card__sub')?.textContent?.trim()).toMatch(
      /^Yesterday/,
    );
    expect(text(card)).toMatch(/0\.15\s?m³/);
  });

  it('the energy card over a past day reads the day’s last mean in the unit and decimals asked', async () => {
    const day = picker(true);
    const midnight = day.start.getTime();
    const hass = {
      ...hassWith(day),
      states: {
        'sensor.power': {
          entity_id: 'sensor.power',
          // the reading now: not the day's
          state: '500',
          attributes: { unit_of_measurement: 'W', device_class: 'power' },
          last_changed: '',
          last_updated: '',
        },
      },
      callWS: async (message: Record<string, unknown>) =>
        message['type'] === 'recorder/statistics_during_period'
          ? {
              'sensor.power': [
                { start: midnight, end: midnight + 43_200_000, mean: 800 },
                { start: midnight + 43_200_000, end: day.end!.getTime(), mean: 1234.5 },
              ],
            }
          : {},
    } as unknown as HomeAssistant;
    const card = await mount(
      'fluvy-energy-card',
      { entity: 'sensor.power', collection_key: 'energy_t', unit: 'kW', decimals: 2 },
      hass,
    );
    expect(card.shadowRoot?.querySelector('.fv-card__sub')?.textContent?.trim()).toMatch(
      /Yesterday$/,
    );
    expect(text(card)).toMatch(/1\.23\s?kW/);
    expect(text(card)).not.toMatch(/0\.50\s?kW/);
  });

  it('the energy card over a past cloudy day draws every five minutes and reads Home Assistant’s 12:00 at noon (#138)', async () => {
    const day = picker(true);
    const midnight = day.start.getTime();
    // an array's five-minute means (kW): a hill clouds cut into, 2.61 at 12:00 between two dips, its peak 2.94 at 11:35
    const means = Array.from({ length: 288 }, (_unused, i) => {
      const sun = Math.max(0, Math.sin(((i - 84) / 120) * Math.PI)) * 1.6;
      return i === 139 ? 2.94 : i === 144 ? 2.61 : i % 7 === 3 ? sun * 0.3 : sun;
    });
    const hass = {
      ...hassWith(day),
      states: {
        'sensor.pv': {
          entity_id: 'sensor.pv',
          state: '0',
          attributes: { unit_of_measurement: 'kW', device_class: 'power' },
          last_changed: '',
          last_updated: '',
        },
      },
      callWS: async (message: Record<string, unknown>) =>
        message['type'] === 'recorder/statistics_during_period'
          ? {
              'sensor.pv': means.map((mean, i) => ({
                start: midnight + i * 300_000,
                end: midnight + (i + 1) * 300_000,
                mean,
              })),
            }
          : {},
    } as unknown as HomeAssistant;
    const card = await mount(
      'fluvy-energy-card',
      { entity: 'sensor.pv', collection_key: 'energy_t', chart: 'classic', decimals: 2 },
      hass,
    );
    const line = card.shadowRoot?.querySelector('.ef-chart .curve-line')?.getAttribute('d') ?? '';
    expect(line.split(' C')).toHaveLength(288);
    // read at the middle of the day's axis: Home Assistant's 12:00, the bucket from 12:00 to 12:05
    (card as unknown as { scrubber: { set(value: number): void } }).scrubber.set(0.5);
    await card.updateComplete;
    const readout = card.shadowRoot?.querySelector('.ef-top .fv-readout');
    expect(readout?.querySelector('.fv-readout__label')?.textContent?.trim()).toBe('12:00');
    expect(readout?.querySelector('.fv-readout__value')?.textContent?.replace(/\s+/g, ' ')).toMatch(
      /2\.61\s?kW/,
    );
  });

  it('the energy and production cards offer the pickers and the sensor’s own units in one choice', async () => {
    const hass = hassWith(picker());
    for (const tag of ['fluvy-energy-card', 'fluvy-production-card']) {
      // each card's editor: its class's, or the module it fetches with the visual editor
      const card = customElements.get(tag) as unknown as { editor(): Promise<CardEditor> };
      const offer = (await card.editor()).choices as EditorChoices;
      const choices = offer({ type: `custom:${tag}`, entity: 'sensor.sun' }, hass);
      expect(
        choices['collection_key']?.map((o) => o.value),
        tag,
      ).toEqual(['energy_t']);
      expect(
        choices['unit']?.map((o) => o.value),
        tag,
      ).toEqual(['auto', 'Wh', 'kWh', 'MWh']);
    }
  });
});
