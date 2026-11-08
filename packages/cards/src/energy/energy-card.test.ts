// @vitest-environment happy-dom
import {
  CHART_DEFAULTS,
  clearHistoryCache,
  setChartDefaults,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixtures from '../chart/engine/__fixtures__/classic-1.10.json' with { type: 'json' };
import { familiesDefined } from '../index.js';
import { FluvyEnergyCard, type EnergyCardConfig } from './energy-card.js';
import { getConfigForm, lists } from './energy-editor.js';

// the family is defined as its chunk lands
await familiesDefined;

const { TEMP } = fixtures.inputs;
/** A house's power over the window (W): the fixtures' day, a thousand times over, ending on its reading. */
const POWER = TEMP.map((v) => Math.round(v * 100));

/** A lifetime meter: all it ever counted (12.5 MWh), and what its statistics say it counted each hour today. */
const METER = {
  entity_id: 'sensor.meter',
  state: '12500',
  attributes: {
    friendly_name: 'Grid meter',
    unit_of_measurement: 'kWh',
    device_class: 'energy',
    state_class: 'total_increasing',
  },
  last_changed: '',
  last_updated: '',
};

/**
 * A house whose recorder answers every window with the power, one reading in the middle of each of its 48 slots, and
 * the lifetime meter's day as 2.1 + 1.4 kWh; its Energy dashboard's preferences are `prefs` (none: never set up).
 */
const house = (values: readonly number[] = POWER, prefs: unknown = null): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { time_zone: 'UTC' },
    themes: { darkMode: false },
    states: {
      'sensor.power': {
        entity_id: 'sensor.power',
        state: String(values[values.length - 1]),
        attributes: {
          friendly_name: 'House power',
          unit_of_measurement: 'W',
          device_class: 'power',
          state_class: 'measurement',
        },
        last_changed: '',
        last_updated: '',
      },
      'sensor.meter': METER,
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async (message: Record<string, unknown>) => {
      if (message['type'] === 'energy/get_prefs') {
        if (!prefs) throw new Error('not set up');
        return prefs;
      }
      if (message['type'] === 'recorder/statistics_during_period')
        return {
          'sensor.meter': [
            { start: Date.parse(String(message['start_time'])), change: 2.1 },
            { start: Date.parse(String(message['start_time'])) + 3_600_000, change: 1.4 },
          ],
        };
      const start = Date.parse(String(message['start_time']));
      const end = Date.parse(String(message['end_time']));
      return {
        'sensor.power': values.map((v, i) => ({
          s: String(v),
          lu: (start + ((i + 0.5) / values.length) * (end - start)) / 1000,
        })),
      };
    },
    callService: async () => undefined,
  }) as unknown as HomeAssistant;

const settle = async (card: FluvyEnergyCard): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

/** A card over a rolling window (six hours: the series spans the card). */
async function mount(
  config: Partial<EnergyCardConfig>,
  hass: HomeAssistant = house(),
): Promise<FluvyEnergyCard> {
  const card = document.createElement('fluvy-energy-card') as FluvyEnergyCard;
  card.setConfig({ type: 'custom:fluvy-energy-card', entity: 'sensor.power', hours: 6, ...config });
  card.hass = hass;
  document.body.append(card);
  await settle(card);
  return card;
}

/** The tone the card's chart (and its head) wears. */
const toneOf = (card: FluvyEnergyCard): string | undefined =>
  /fv-tone--(\w+)/.exec(card.shadowRoot!.querySelector('.ef-chart')?.className ?? '')?.[1];

/** Each readout's words: its value, then its unit. */
const readouts = (card: FluvyEnergyCard, selector: string): string[] =>
  [...card.shadowRoot!.querySelectorAll(`${selector} .fv-readout__value`)].map((el) =>
    [...el.children].map((part) => part.textContent?.trim()).join(' '),
  );

const ds = (card: FluvyEnergyCard, selector: string): string[] =>
  [...card.shadowRoot!.querySelectorAll(selector)].map((el) => el.getAttribute('d') ?? '');

afterEach(() => document.body.replaceChildren());

/** The points a line's path goes through: its start and the end of each of its curves. */
const pointsOf = (d: string): number => d.split(' C').length;
/** Where they stand across the plot. */
const placesOf = (d: string): number[] =>
  [...d.matchAll(/(?:^M| )(-?[\d.]+),[\d.]+(?= C|$)/g)].map((m) => Number(m[1]));

describe('the energy card’s line, drawn by the engine', () => {
  it('draws the classic curve (1.10’s geometry, `classic.test.ts`) calmly: its points on round times, 5 px apart at least', async () => {
    // a 320 column over six hours: a point every ten minutes, each the mean of the readings around it
    const card = await mount({});
    const [line] = ds(card, '.ef-chart .curve-line');
    const places = placesOf(line ?? '');
    const gaps = places.slice(2, -1).map((x, i) => x - (places[i + 1] as number));
    expect(Math.min(...gaps)).toBeCloseTo((320 * 10) / 360, 1);
    expect(ds(card, '.ef-chart .curve-area')).toHaveLength(1);
    expect(card.shadowRoot!.querySelectorAll('.ef-chart .curve-dot').length).toBe(1);
    // a 112 column: a point every half hour
    card.width = 152;
    await settle(card);
    expect(pointsOf(ds(card, '.ef-chart .curve-line')[0] ?? '')).toBeLessThanOrEqual(14);
  });

  it('keeps a classic thin line at 1.10’s one pixel, the card’s own rule', async () => {
    const card = await mount({ line_width: 'thin' });
    const line = card.shadowRoot!.querySelector('.ef-chart .curve-line') as SVGElement;
    expect(line.getAttribute('style')).toBeNull();
    expect(card.shadowRoot!.querySelector('.ef-chart.is-thin')).not.toBeNull();
  });

  it('draws the style the card names: the soft line, its copy and Fluvy’s knob at its end', async () => {
    const card = await mount({ chart: 'soft' });
    const root = card.shadowRoot!;
    expect(root.querySelectorAll('.ef-chart .fc-line').length).toBe(1);
    expect(root.querySelectorAll('.ef-chart .fc-glow').length).toBe(1);
    expect(root.querySelectorAll('.ef-chart .fv-knob').length).toBe(1);
    expect(root.querySelector('.ef-chart .curve-line')).toBeNull();
  });

  it('draws a stepped power on a scale from zero in the card’s unit, the hours under the plot', async () => {
    const card = await mount({ chart: 'step' });
    const root = card.shadowRoot!;
    const ticks = [...root.querySelectorAll('.fc-tick')].map((t) => t.textContent);
    // 1.6 … 2.4 kW read in kW, from zero: power starts there
    expect(ticks[0]).toBe('0');
    expect(ticks.every((t) => Number(t) <= 3)).toBe(true);
    const axis = root.querySelector('.ef-chart + div') as HTMLElement;
    expect(parseFloat(axis.style.marginInlineStart)).toBeGreaterThan(0);
  });

  it('draws minimal without a bubble at rest: the style labels nothing', async () => {
    const card = await mount({ chart: 'minimal' });
    expect(card.shadowRoot!.querySelector('.ef-chart .fv-bubble')).toBeNull();
    expect(card.shadowRoot!.querySelectorAll('.ef-chart .fc-line').length).toBe(1);
  });
});

describe('the energy card’s tone: what its line shows', () => {
  /** The Energy dashboard's preferences: the sensor as a grid connection's power, an array's, or a device's. */
  const grid = { energy_sources: [{ type: 'grid', stat_rate: 'sensor.power' }] };
  const solar = { energy_sources: [{ type: 'solar', stat_rate: 'sensor.power' }] };
  const device = {
    energy_sources: [],
    device_consumption: [
      { stat_consumption: 'sensor.heat_pump_energy', stat_rate: 'sensor.power' },
    ],
  };

  it('is the grid’s for the Energy dashboard’s grid power, the sun’s for its array’s', async () => {
    expect(toneOf(await mount({}, house(POWER, grid)))).toBe('grid');
    expect(toneOf(await mount({}, house(POWER, solar)))).toBe('solar');
  });

  it('is the house’s for an individual device’s power, the accent for a sensor the dashboard does not name', async () => {
    expect(toneOf(await mount({}, house(POWER, device)))).toBe('house');
    expect(toneOf(await mount({}))).toBe('accent');
  });

  it('is the card’s own where it names one: a tone, or a colour (the accent it redefines)', async () => {
    expect(toneOf(await mount({ tone: 'water' }, house(POWER, grid)))).toBe('water');
    expect(toneOf(await mount({ color: '#00aa88' }, house(POWER, solar)))).toBe('accent');
  });
});

describe('the energy card’s window', () => {
  const sub = (card: FluvyEnergyCard): string | undefined =>
    card.shadowRoot!.querySelector('.fv-card__sub')?.textContent?.trim();
  /** A card that names no window, or the one given. */
  const bare = async (config: Partial<EnergyCardConfig> = {}): Promise<FluvyEnergyCard> => {
    const card = document.createElement('fluvy-energy-card') as FluvyEnergyCard;
    card.setConfig({ type: 'custom:fluvy-energy-card', entity: 'sensor.power', ...config });
    card.hass = house();
    document.body.append(card);
    await settle(card);
    return card;
  };

  it('is the house’s where it names none (the last 12 hours), the day on its axis with `hours: 24`', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-09-17T15:00:00Z') });
    clearHistoryCache();
    expect(sub(await bare())).toBe('Last 12 h');
    setChartDefaults({ settings: { ...CHART_DEFAULTS, window: 4 }, sets: [] });
    expect(sub(await bare())).toBe('Last 4 h');
    expect(sub(await bare({ hours: 24 }))).toMatch(/· today$/);
    setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
    vi.useRealTimers();
  });
});

describe('the energy card read the other way round (`invert`)', () => {
  it('reads a grid meter that is negative while importing as what comes in, its curve above the line', async () => {
    // one moment for both cards: their windows and their readings' times are the same
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-09-17T15:00:00Z') });
    clearHistoryCache();
    const negative = POWER.map((v) => -v);
    const plain = await mount({}, house(POWER));
    clearHistoryCache(); // the same sensor and window: its history is asked again of the other house
    const card = await mount({ invert: true }, house(negative));
    expect(readouts(card, '.ef-top')).toEqual(readouts(plain, '.ef-top'));
    expect(readouts(card, '.ef-top')[0]).not.toContain('−');
    expect(ds(card, '.ef-chart .curve-line')).toEqual(ds(plain, '.ef-chart .curve-line'));
    vi.useRealTimers();
  });
});

describe('the energy card’s legend over the day (`period: today`)', () => {
  it('reads a lifetime meter’s change since midnight, not all it ever counted', async () => {
    const state = await mount({ legend: [{ entity: 'sensor.meter', name: 'Grid' }] });
    const today = await mount({
      legend: [{ entity: 'sensor.meter', name: 'Grid', period: 'today' }],
    });
    expect(readouts(state, '.ef-cols')).toEqual(['12.5 MWh']);
    expect(readouts(today, '.ef-cols')).toEqual(['3.5 kWh']);
  });

  it('says under a total’s period, while it reads its state, that “Since midnight” reads its day', () => {
    const legend = lists.find((list) => list.key === 'legend')!;
    const field = { name: 'period' } as HaFormSchemaItem;
    const hass = house();
    const helper = (item: Record<string, unknown>): string | undefined =>
      legend.computeHelper?.(field, (key) => key, item, hass);
    expect(helper({ entity: 'sensor.meter' })).toMatch(/keeps counting/);
    expect(helper({ entity: 'sensor.meter', period: 'today' })).toBeUndefined();
    expect(helper({ entity: 'sensor.power' })).toBeUndefined();
  });
});

describe('the energy card’s editor', () => {
  const section = (getConfigForm().schema as HaFormSchemaItem[]).find(
    (item) => item.type === 'expandable' && item.schema?.some((field) => field.name === 'chart'),
  ) as HaFormSchemaItem;
  const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));
  const shown = (data: Record<string, unknown>): string[] =>
    (section.schema ?? [])
      .filter((item) => !item.when || item.when(data))
      .flatMap((item) => fields([item]).filter((field) => !field.when || field.when(data)))
      .map(
        (field) =>
          `${field.name}${field.name === 'chart' ? `:${JSON.stringify((field.selector as { select: { options: { value: string }[] } }).select.options.map((o) => o.value))}` : ''}`,
      );

  it('offers the line the line styles, and a stacked chart classic, soft and step', () => {
    expect(shown({})[0]).toBe('chart:["classic","soft","glow","minimal","step"]');
    expect(shown({ variant: 'compact' })[0]).toBe(
      'chart:["classic","soft","glow","minimal","step"]',
    );
    expect(shown({ variant: 'sources' })[0]).toBe('chart:["classic","soft","step"]');
    expect(shown({ variant: 'overview' })[0]).toBe('chart:["classic","soft","step"]');
  });

  it('shows a stacked chart only its line, its gridlines and its scale; the line what its style acts on', () => {
    expect(shown({ variant: 'sources', chart: 'soft' }).slice(1)).toEqual([
      'line_width',
      'show_grid',
      'show_axis',
    ]);
    expect(shown({ chart: 'soft' })).toContain('glow');
    expect(shown({})).not.toContain('glow');
    expect(shown({})).not.toContain('show_now');
  });
});
