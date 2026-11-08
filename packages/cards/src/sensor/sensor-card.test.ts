// @vitest-environment happy-dom
import {
  CHART_DEFAULTS,
  clearHistoryCache,
  setChartDefaults,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import fixtures from '../chart/engine/__fixtures__/classic-1.10.json' with { type: 'json' };
import { familiesDefined } from '../index.js';
import { FluvySensorCard, type SensorCardConfig } from './sensor-card.js';
import * as sensorEditor from './sensor-editor.js';

// the chart engine lands with the families: the card draws its chart from its first render after the history
await familiesDefined;

const { TEMP, HUM } = fixtures.inputs;
/** A day of an energy meter (kWh, counting up): what it gained each half hour, added up. */
const METER = TEMP.reduce<number[]>((sums, v, i) => [...sums, (sums[i - 1] ?? 1000) + v / 40], []);

/** The windows the recorder was asked for, in hours. */
const asked: number[] = [];

/** A house whose recorder answers every window with the readings, one at the start of each of its 48 slots. */
const house = (): HomeAssistant => {
  const readings: Record<string, readonly number[]> = {
    'sensor.temp': TEMP,
    'sensor.hum': HUM,
    'sensor.meter': METER,
  };
  const sensor = (
    name: string,
    values: readonly number[],
    unit: string,
    deviceClass: string,
    stateClass = 'measurement',
  ) => ({
    entity_id: name,
    state: String(values[values.length - 1]),
    attributes: {
      friendly_name: name,
      unit_of_measurement: unit,
      device_class: deviceClass,
      state_class: stateClass,
    },
    last_changed: '',
    last_updated: '',
  });
  return {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: {},
    themes: { darkMode: false },
    states: {
      'sensor.temp': sensor('sensor.temp', TEMP, '°C', 'temperature'),
      'sensor.hum': sensor('sensor.hum', HUM, '%', 'humidity'),
      'sensor.meter': sensor('sensor.meter', METER, 'kWh', 'energy', 'total_increasing'),
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callWS: async (message: Record<string, unknown>) => {
      const start = Date.parse(String(message['start_time']));
      const end = Date.parse(String(message['end_time']));
      asked.push(Math.round((end - start) / 3_600_000));
      const id = (message['entity_ids'] as string[])[0] as string;
      const values = readings[id] ?? [];
      return {
        [id]: values.map((v, i) => ({
          s: String(v),
          lu: (start + (i / 48) * (end - start)) / 1000,
        })),
      };
    },
    callService: async () => undefined,
  } as unknown as HomeAssistant;
};

const settle = async (card: FluvySensorCard): Promise<void> => {
  for (let i = 0; i < 3; i++) {
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

async function mount(config: Partial<SensorCardConfig>): Promise<FluvySensorCard> {
  const card = document.createElement('fluvy-sensor-card') as FluvySensorCard;
  card.setConfig({ type: 'custom:fluvy-sensor-card', entity: 'sensor.temp', ...config });
  card.hass = house();
  document.body.append(card);
  await settle(card);
  return card;
}

const ds = (card: FluvySensorCard, selector: string): string[] =>
  [...card.shadowRoot!.querySelectorAll(selector)].map((el) => el.getAttribute('d') ?? '');

afterEach(() => {
  document.body.replaceChildren();
  setChartDefaults({ settings: CHART_DEFAULTS, sets: [] });
});

/** The places a line's path goes through: its start and the end of each of its curves. */
const placesOf = (d: string): number[] =>
  [...d.matchAll(/(?:^M| )(-?[\d.]+),[\d.]+(?= C|$)/g)].map((m) => Number(m[1]));

describe('the sensor’s chart, drawn by the engine', () => {
  it('draws one sensor classic through its line, calmly: never two points closer than its stroke needs', async () => {
    const card = await mount({});
    const [line] = ds(card, '.am-chart .curve-line');
    const places = placesOf(line ?? '');
    const gaps = places.slice(2, -1).map((x, i) => x - (places[i + 1] as number));
    // 5 px apart at least for the house's 2.5 line (`leastGap`), the ends aside
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(5 - 1e-6);
    expect(places.length).toBeLessThanOrEqual(
      (card as unknown as { contentWidth: number }).contentWidth / 5 + 2,
    );
    expect(places.length).toBeGreaterThan(10);
    expect(ds(card, '.am-chart .curve-area')).toHaveLength(1);
    expect(card.shadowRoot!.querySelectorAll('.am-chart .curve-dot').length).toBe(1);
    expect(card.shadowRoot!.querySelector('.am-chart svg')?.getAttribute('data-measure')).toBe(
      'drawn',
    );
    // the bubble at now, on the line's end
    expect(card.shadowRoot!.querySelector('.am-chart .fv-bubble b')?.textContent).toBe(
      String(TEMP[47]),
    );
  });

  it('draws several sensors classic, each through its line on its own scale, their points at the same times', async () => {
    const card = await mount({ entities: ['sensor.hum'] });
    const lines = ds(card, '.am-chart--several .curve-line');
    expect(lines).toHaveLength(2);
    expect(placesOf(lines[0] ?? '')).toEqual(placesOf(lines[1] ?? ''));
    expect(ds(card, '.am-chart--several .curve-area')).toHaveLength(2);
    expect(card.shadowRoot!.querySelector('.am-multi')).not.toBeNull();
  });

  it('shows the house’s window where it names none (12 hours from the factory), and its own where it does', async () => {
    clearHistoryCache();
    asked.length = 0;
    const house12 = await mount({});
    expect(asked).toContain(12);
    expect(house12.shadowRoot!.querySelector('.fv-card__sub')?.textContent).toContain('12 h');
    setChartDefaults({ settings: { ...CHART_DEFAULTS, window: 48 }, sets: [] });
    asked.length = 0;
    await mount({});
    expect(asked).toContain(48);
    asked.length = 0;
    await mount({ hours: 4 });
    expect(asked).toEqual([4]);
  });

  it('reads, where it is pointed at, the reading in force at the round time it snaps to — its dot on the line there', async () => {
    const card = await mount({ hours: 24 });
    (card as unknown as { scrubber: { set(value: number): void } }).scrubber.set(0.5);
    await card.updateComplete;
    const bubble = card.shadowRoot!.querySelector('.am-chart .fv-bubble');
    const [value, time] = [...(bubble?.querySelectorAll('b, span') ?? [])].map((el) =>
      el.textContent?.trim(),
    );
    // a day on a column: five minutes a pixel's worth at most, so the time is a round five minutes
    expect(bubble?.textContent).toMatch(/\d\d:\d[05]/);
    // the day's readings are TEMP, each held a half hour: what it says is one of them, never a mean between two
    expect(TEMP).toContain(Number(value));
    expect(time).toBeDefined();
  });

  it('draws the style the card names: the soft line, its copy and Fluvy’s knob at its end', async () => {
    const card = await mount({ chart: 'soft' });
    const root = card.shadowRoot!;
    expect(root.querySelectorAll('.fc-line').length).toBe(1);
    expect(root.querySelectorAll('.fc-glow').length).toBe(1);
    expect(root.querySelectorAll('.am-chart .fv-knob').length).toBe(1);
    expect(root.querySelector('.curve-line')).toBeNull();
  });

  it('puts a stepped temperature on a nice scale of its own range, its ticks in a column the axis row starts after', async () => {
    const card = await mount({ chart: 'step' });
    const root = card.shadowRoot!;
    // 16.2 … 23.5 °C: a measurement never forces zero
    expect([...root.querySelectorAll('.fc-tick')].map((t) => t.textContent)).toEqual([
      '16',
      '18',
      '20',
      '22',
      '24',
    ]);
    const axis = root.querySelector('.am-chart + div') as HTMLElement;
    expect(parseFloat(axis.style.marginInlineStart)).toBeGreaterThan(0);
  });

  it('draws a meter’s day as 24 bars, each what it gained in its hour, on a scale from zero', async () => {
    const card = await mount({ entity: 'sensor.meter', chart: 'bars', hours: 24 });
    const root = card.shadowRoot!;
    expect(root.querySelectorAll('.am-chart .fc-bar').length).toBe(24);
    expect(Number(root.querySelector('.fc-tick')?.textContent)).toBe(0);
  });

  it('draws its scale in the unit the card asks, as its figures read', async () => {
    const kwh = await mount({ entity: 'sensor.meter', chart: 'bars' });
    const wh = await mount({ entity: 'sensor.meter', chart: 'bars', unit: 'Wh' });
    const top = (card: FluvySensorCard): number =>
      Math.max(
        ...[...card.shadowRoot!.querySelectorAll('.fc-tick')].map((t) =>
          Number(t.textContent?.replace(/,/g, '')),
        ),
      );
    expect(top(wh)).toBe(top(kwh) * 1000);
  });

  it('draws no bars for a temperature, whose readings do not add up: its style is drawn classic', async () => {
    const card = await mount({ chart: 'bars' });
    expect(card.shadowRoot!.querySelectorAll('.am-chart .fc-bar').length).toBe(0);
    expect(card.shadowRoot!.querySelectorAll('.am-chart .curve-line').length).toBe(1);
  });

  it('draws the tile’s spark classic, or minimal where the card says so', async () => {
    const classic = await mount({ variant: 'tile' });
    expect(classic.shadowRoot!.querySelectorAll('.am-spark .curve-line').length).toBe(1);
    const minimal = await mount({ variant: 'tile', chart: 'minimal' });
    expect(minimal.shadowRoot!.querySelectorAll('.am-spark .fc-line').length).toBe(1);
    expect(minimal.shadowRoot!.querySelectorAll('.am-spark .fc-area').length).toBe(0);
  });
});

describe('the sensor’s editor', () => {
  const section = (sensorEditor.getConfigForm().schema as HaFormSchemaItem[]).find(
    (item) => item.type === 'expandable' && item.schema?.some((field) => field.name === 'chart'),
  ) as HaFormSchemaItem;
  const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));
  const all = fields(section.schema ?? []);
  const shown = (data: Record<string, unknown>, hass?: HomeAssistant): string[] =>
    (section.schema ?? [])
      .filter((item) => !item.when || item.when(data, hass))
      .flatMap((item) => fields([item]).filter((field) => !field.when || field.when(data, hass)))
      .map(
        (field) =>
          `${field.name}${field.name === 'chart' ? `:${JSON.stringify((field.selector as { select: { options: { value: string }[] } }).select.options.map((o) => o.value))}` : ''}`,
      );

  it('offers every key the sensor can draw, and never now (its window ends there)', () => {
    expect(new Set(all.map((field) => field.name))).toEqual(
      new Set([
        'chart',
        'curve',
        'fill',
        'line_width',
        'glow',
        'show_points',
        'show_grid',
        'show_axis',
        'highlight',
        'animate',
        'points',
      ]),
    );
  });

  it('shows only what the chosen style acts on: no soft shadow in classic, the highlight in steps', () => {
    expect(shown({})).not.toContain('glow');
    expect(shown({ chart: 'soft' })).toContain('glow');
    expect(shown({ chart: 'step' })).toContain('highlight');
    expect(shown({ chart: 'bars', entity: 'sensor.meter' }, house())).not.toContain('curve');
    // a temperature asked for bars draws classic, and the editor shows what classic acts on
    expect(shown({ chart: 'bars', entity: 'sensor.temp' }, house())).toContain('curve');
  });

  it('offers bars to one sensor whose readings add up, the lines only to a measurement or several, and no highlight over several', () => {
    const lines = 'chart:["classic","soft","glow","minimal","step"]';
    expect(shown({ entity: 'sensor.meter' }, house())[0]).toBe(
      'chart:["classic","soft","glow","minimal","step","bars","columns"]',
    );
    expect(shown({ entity: 'sensor.temp' }, house())[0]).toBe(lines);
    expect(shown({})[0]).toBe(lines);
    const several = shown({ entities: ['sensor.hum'], chart: 'step' });
    expect(several[0]).toBe('chart:["classic","soft","glow","minimal","step"]');
    expect(several).not.toContain('highlight');
  });
});
