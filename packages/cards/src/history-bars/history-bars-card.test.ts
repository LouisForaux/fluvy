// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import type { FluvyRowsEditor } from '../shared/rows-editor.js';
import { clearBarsCache } from './buckets.js';
import { FluvyHistoryBarsCard, type HistoryBarsCardConfig } from './history-bars-card.js';
import { clearLiveCache } from './live.js';

// the energy family lands with the index: the card's tag is defined before a page needs it
await familiesDefined;
// the readings land with their own chunk on the first card that reads that way: here once, before the cards
await Promise.all([import('./readings.js'), import('./history.js')]);

/** The sheet's moment: Saturday 10 October 2026 at noon, in the runner's own zone (what the mock's house reads). */
const NOW = '2026-10-10T12:00:00';
const DAYS = [35.4, 34.4, 28.6, 26.5, 30.2, 9.5, 26.9];
const HOUR = 3_600_000;
const midnight = (day: number, month = 9): number => new Date(2026, month, day).getTime();
const local = (day: number, hour: number, month = 9): number =>
  new Date(2026, month, day, hour).getTime();

interface Row {
  readonly start: number;
  readonly end?: number;
  readonly change?: number;
  readonly mean?: number;
  readonly state?: number;
}
type Rows = Record<string, Row[]>;
/** What the recorder answers: rows by sensor (those asked), an answer of its own for a message, or a throw. */
type Recorder = Rows | ((message: Record<string, unknown>) => unknown);

const KWH = { unit_of_measurement: 'kWh', device_class: 'energy', state_class: 'total_increasing' };

/** The house's sensors: two meters, a temperature, the issues' day counter and rain gauge, a tank with no state class. */
const SENSORS: Record<string, { state: string; attributes: Record<string, unknown> }> = {
  'sensor.solar': { state: '1234.5', attributes: { friendly_name: 'Solar production', ...KWH } },
  'sensor.house': { state: '2222.2', attributes: { friendly_name: 'House', ...KWH } },
  'sensor.outside': {
    state: '13.0',
    attributes: {
      friendly_name: 'Outside',
      unit_of_measurement: '°C',
      device_class: 'temperature',
      state_class: 'measurement',
    },
  },
  // #45: a template summing two inverter day counters
  'sensor.pv_day': { state: '33.3', attributes: { friendly_name: 'PV day', ...KWH } },
  // #44: a monthly rain gauge reported as a `total` with no last_reset
  'sensor.rain': {
    state: '16.9',
    attributes: {
      friendly_name: 'Rain this month',
      unit_of_measurement: 'mm',
      device_class: 'precipitation',
      state_class: 'total',
    },
  },
  'sensor.tank': {
    state: '360',
    attributes: { friendly_name: 'Rain tank', unit_of_measurement: 'L' },
  },
};

/** A house with the sensors and a recorder answering from a table; its questions and more-info requests kept. */
const house = (
  table: Recorder,
  { dead = false, states = {} }: { dead?: boolean; states?: Record<string, string> } = {},
) => {
  const asked: Record<string, unknown>[] = [];
  const opened: string[] = [];
  const build = (overrides: Record<string, string>): HomeAssistant =>
    ({
      language: 'en',
      locale: { language: 'en', number_format: 'language', time_format: '24' },
      config: { currency: 'EUR' },
      states: Object.fromEntries(
        Object.entries(SENSORS).map(([id, { state, attributes }]) => [
          id,
          {
            entity_id: id,
            state: overrides[id] ?? (dead && id === 'sensor.solar' ? 'unavailable' : state),
            attributes,
            last_changed: '',
            last_updated: '',
          },
        ]),
      ),
      entities: {},
      devices: {},
      areas: {},
      localize: (key: string) => key,
      formatEntityState: (s: { state: string }) => s.state,
      callWS: async (message: Record<string, unknown>) => {
        asked.push(message);
        if (typeof table === 'function') return table(message);
        return Object.fromEntries(
          ((message['statistic_ids'] as string[]) ?? [])
            .filter((id) => id in table)
            .map((id) => [id, table[id]]),
        );
      },
    }) as unknown as HomeAssistant;
  const hass = build(states);
  window.addEventListener('hass-more-info', (event) =>
    opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
  );
  /** The same house a moment later, its states changed (a new `hass`, as Home Assistant hands one). */
  const later = (changed: Record<string, string>): HomeAssistant => {
    const next = build({ ...states, ...changed });
    return next;
  };
  return { hass, asked, opened, later };
};

const week = (values: readonly number[] = DAYS, today = 12.3): Rows => ({
  'sensor.solar': [
    ...values.map((change, i) => ({ start: midnight(3 + i), change })),
    { start: midnight(10), change: today },
  ],
  'sensor.house': [...DAYS.map((v, i) => ({ start: midnight(3 + i), change: v * 2 }))],
});

type CardElement = FluvyHistoryBarsCard & {
  updateComplete: Promise<boolean>;
  watched(): readonly string[];
};

/** The recorder answers on a later tick: the bars land on the render after it. */
const settle = async (card: CardElement): Promise<void> => {
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await card.updateComplete;
};

async function mount(config: Partial<HistoryBarsCardConfig>, hass: HomeAssistant) {
  const card = document.createElement('fluvy-history-bars-card') as CardElement;
  card.setConfig({
    type: 'custom:fluvy-history-bars-card',
    entity: 'sensor.solar',
    _now: NOW,
    ...config,
  });
  card.hass = hass;
  document.body.append(card);
  await settle(card);
  return card;
}

const texts = (card: HTMLElement, selector: string): string[] =>
  [...card.shadowRoot!.querySelectorAll(selector)].map((el) =>
    (el.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );

const readouts = (card: HTMLElement): string[] =>
  [...card.shadowRoot!.querySelectorAll('.hb-readouts .fv-readout, .hb-cols .fv-readout')].map(
    (el) =>
      `${el.querySelector('.fv-readout__label')?.textContent?.trim()} ${el
        .querySelector('.fv-readout__value')
        ?.textContent?.replace(/\s+/g, '')}`,
  );

const facts = (card: HTMLElement): string[] =>
  texts(card, '.hb-fact').map((t) => t.replace(/\s/g, ''));

const press = async (card: CardElement, key: string): Promise<void> => {
  card
    .shadowRoot!.querySelector('.hb-chart')!
    .dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  await card.updateComplete;
};

/* ---------- the issues' sensors, as the recorder keeps them ---------- */

/** #45: the summed PV day counter's hours from 13 October 21:00 (first read that evening), 0.0 from midnight. */
const PV_HOURS = [
  35.6, 35.6, 35.6, 0, 0, 0, 0, 0, 0, 0, 0, 0.1, 1.2, 4.6, 9.4, 15.2, 21.3, 27.4, 33.3,
];
const pvHours = (): Row[] =>
  PV_HOURS.map((state, i) => ({
    start: local(13, 21) + i * HOUR,
    end: local(13, 22) + i * HOUR,
    state,
  }));
/** #45 as Home Assistant counts it: 17.0 on its first evening, 51.2 today (a staggered midnight counted twice). */
const PV_COUNTED: Rows = {
  'sensor.pv_day': [
    { start: midnight(13), change: 17 },
    { start: midnight(14), change: 51.2 },
  ],
};
/** The #44 gauge's day: what it gained (Home Assistant's change), by date. */
const RAIN: Record<string, number> = {
  '8-16': 0.3,
  '8-17': 2.6,
  '8-18': 0.4,
  '8-27': 0.2,
  '9-1': -51.1,
  '9-3': 0.9,
  '9-5': 0.6,
  '9-9': 4.5,
  '9-10': 10.9,
};
/** The #44 gauge's days from 14 September to 13 October: the date and what Home Assistant counted. */
const rainDays = (): Array<{ start: number; change: number }> =>
  Array.from({ length: 30 }, (_, i) => {
    const date = new Date(2026, 8, 14 + i);
    return { start: date.getTime(), change: RAIN[`${date.getMonth()}-${date.getDate()}`] ?? 0 };
  });
/** The #44 gauge's readings at each day's close: 47.6 on 14 September, 0.0 on 1 October, 16.9 by the 10th. */
const rainReadings = (): Row[] => {
  let v = 0;
  return rainDays().map((day, i) => {
    v = i === 0 ? 47.6 : day.change < 0 ? 0 : Math.round((v + day.change) * 10) / 10;
    return { start: day.start, end: day.start + 86_400_000, state: v };
  });
};
/** The recorder of a sensor read by its readings (state rows) or as Home Assistant counts it (change rows). */
const byType =
  (id: string, readings: () => Row[], changes: Row[]) => (message: Record<string, unknown>) =>
    (message['types'] as string[]).includes('state') ? { [id]: readings() } : { [id]: changes };

describe('the history bars tell the truth (#44, #45)', () => {
  beforeEach(() => {
    clearBarsCache();
    clearLiveCache();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  const pv = {
    entity: 'sensor.pv_day',
    _now: '2026-10-14T16:30:00',
    days: 6,
    include_today: true,
    head: ['today', 'average', 'total'] as const,
  };

  it('#45 as Home Assistant counts it: the days before the sensor are stubs, the figures are the finished days’', async () => {
    const card = await mount(pv, house(PV_COUNTED).hass);
    expect(card.shadowRoot!.querySelectorAll('.hb-bar.is-empty').length).toBe(5);
    // 1.8 read the same rows as "Daily avg 9.7" and "Lowest 0.0": the days before the sensor counted as zero
    expect(readouts(card)).toEqual(['Today 51.2kWh', 'Daily avg 17.0kWh', 'Total 68.2kWh']);
    expect(facts(card)).toEqual(['Highest17.0kWh', 'Lowest17.0kWh', 'Dailyavg17.0kWh']);
  });

  it('#45 from zero every day: its first evening is 35.6, today 33.3 — no midnight counted twice', async () => {
    const { hass, asked } = house(byType('sensor.pv_day', pvHours, []));
    const card = await mount({ ...pv, reset: 'day' }, hass);
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ period: 'hour', types: ['state'] });
    expect(texts(card, '.hb-value')).toEqual(['35.6', '33.3']);
    expect(readouts(card)).toEqual(['Today 33.3kWh', 'Daily avg 35.6kWh', 'Total 68.9kWh']);
  });

  it('#45 live: today follows the sensor on every state change, with no new question; unavailable keeps it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 16, 30));
    const { hass, asked, later } = house(byType('sensor.pv_day', pvHours, []));
    const card = await mount({ ...pv, _now: '', reset: 'day' }, hass);
    expect(readouts(card)[0]).toBe('Today 33.3kWh');
    const before = asked.length;
    card.hass = later({ 'sensor.pv_day': '33.9' });
    await settle(card);
    expect(readouts(card)[0]).toBe('Today 33.9kWh');
    expect(texts(card, '.hb-value').at(-1)).toBe('33.9');
    expect(asked.length).toBe(before);
    // a sensor that cannot be read now keeps the compiled value: never a zero
    card.hass = later({ 'sensor.pv_day': 'unavailable' });
    await settle(card);
    expect(readouts(card)[0]).toBe('Today 33.3kWh');
  });

  it('today live as Home Assistant counts it keeps its decimals on a rounding half: 10.5 + 0.6 reads 11.1, the last bar with it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 14, 10, 42));
    // the recorder: a week of days, 10.05 counted of today (the noise a float sum carries, as the recorder sends
    // it) through its newest five minutes at 21609.9; the meter reads 21610.3 now, so today is 10.45 so far
    const { hass, asked, later } = house(
      (message) =>
        message['type'] === 'recorder/statistic_during_period'
          ? { change: 10.050000000002903 }
          : message['period'] === '5minute'
            ? {
                'sensor.house': [
                  { start: local(14, 10), end: local(14, 10) + 300_000, state: 21609.9 },
                ],
              }
            : {
                'sensor.house': [
                  ...DAYS.map((change, i) => ({ start: midnight(7 + i), change })),
                  { start: midnight(14), change: 10.05 },
                ],
              },
      { states: { 'sensor.house': '21610.3' } },
    );
    const card = await mount(
      { entity: 'sensor.house', _now: '', include_today: true, head: ['today'] },
      hass,
    );
    expect(readouts(card)).toEqual(['Today 10.5kWh']);
    expect(texts(card, '.hb-value').at(-1)).toBe('10.5');
    const before = asked.length;
    // 0.6 on, as a float sum writes it: 21610.899999999998 — the bucket is 11.05, a hair under it in binary
    card.hass = later({ 'sensor.house': String(21610.3 + 0.6) });
    await settle(card);
    expect(readouts(card)).toEqual(['Today 11.1kWh']);
    expect(texts(card, '.hb-value').at(-1)).toBe('11.1');
    expect(asked.length).toBe(before);
  });

  it('#44 as Home Assistant counts it: the month’s reset is a bar below zero', async () => {
    const changes: Rows = { 'sensor.rain': rainDays().slice(1) };
    const card = await mount(
      { entity: 'sensor.rain', _now: '2026-10-13T22:00:00', days: 28, include_today: true },
      house(changes).hass,
    );
    expect(card.shadowRoot!.querySelectorAll('.hb-bar.is-negative').length).toBe(1);
    expect(readouts(card)).toEqual(['Total −30.7mm', 'Daily avg −1.1mm']);
    expect(facts(card)).toEqual(['Highest10.9mm', 'Lowest−51.1mm', 'Dailyavg−1.1mm']);
  });

  it('#44 from zero every month: 1 October is a day without rain, the month adds up', async () => {
    const card = await mount(
      {
        entity: 'sensor.rain',
        _now: '2026-10-13T22:00:00',
        days: 28,
        include_today: true,
        reset: 'month',
      },
      house(byType('sensor.rain', rainReadings, [])).hass,
    );
    const bars = [...card.shadowRoot!.querySelectorAll('.hb-bar')];
    expect(bars.filter((bar) => bar.classList.contains('is-negative'))).toHaveLength(0);
    expect(bars[16]!.classList.contains('is-empty')).toBe(true); // 1 October
    expect(readouts(card)).toEqual(['Total 20.4mm', 'Daily avg 0.7mm']);
    expect(facts(card)).toEqual(['Highest10.9mm', 'Lowest0.0mm', 'Dailyavg0.7mm']);
  });

  it('the reading at the end, by month: each month’s total where the gauge starts again with it', async () => {
    const months = (): Row[] =>
      [30, 47.6, 51.1, 16.9].map((state, i) => ({
        start: new Date(2026, 6 + i, 1).getTime(),
        end: new Date(2026, 7 + i, 1).getTime(),
        state,
      }));
    const config = {
      entity: 'sensor.rain',
      _now: '2026-10-13T22:00:00',
      stat: 'state' as const,
      period: 'month' as const,
      days: 2,
      include_today: true,
    };
    const card = await mount(
      { ...config, reset: 'month' },
      house(byType('sensor.rain', months, [])).hass,
    );
    expect(texts(card, '.hb-value')).toEqual(['47.6', '51.1', '16.9']);
    expect(readouts(card)).toEqual(['Total 115.6mm', 'Monthly avg 49.4mm']);
    // readings that do not start again with each bar do not add up: no total, the highest instead
    clearBarsCache();
    const plain = await mount(config, house(byType('sensor.rain', months, [])).hass);
    expect(readouts(plain)).toEqual(['Monthly avg 49.4mm', 'Highest 51.1mm']);
  });

  it('a sensor with no state class reads its history: the days before it are stubs that read “—”', async () => {
    const { hass, asked } = house(() => ({
      'sensor.tank': [
        { s: '400', lu: local(7, 0) / 1000 },
        { s: '380', lu: local(8, 12) / 1000 },
        { s: '360', lu: local(9, 12) / 1000 },
      ],
    }));
    const card = await mount({ entity: 'sensor.tank', days: 4 }, hass);
    expect(asked[0]).toMatchObject({
      type: 'history/history_during_period',
      entity_ids: ['sensor.tank'],
      significant_changes_only: false,
    });
    expect(card.shadowRoot!.querySelectorAll('.hb-bar.is-empty').length).toBe(1);
    expect(texts(card, '.hb-value')).toEqual(['400.0', '380.0', '360.0']);
    await press(card, 'Home');
    expect(readouts(card)).toEqual(['Oct 06 —']);
  });

  it('says it could not read the recorder, keeps nothing of the failure and asks again after a minute', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 30));
    let down = true;
    const { hass, asked } = house(() => {
      if (down) throw new Error('offline');
      return { 'sensor.solar': week()['sensor.solar'] };
    });
    const card = await mount({ _now: '' }, hass);
    expect(texts(card, '.fv-empty-state__text')).toEqual(['Couldn’t read the recorder']);
    expect(texts(card, '.fv-empty-state__hint')).toEqual(['Asking again in a minute']);
    down = false;
    vi.advanceTimersByTime(30_000);
    await settle(card);
    expect(asked.length).toBe(1); // not before the minute is up
    vi.advanceTimersByTime(30_000);
    await settle(card);
    expect(asked.length).toBe(2);
    expect(card.shadowRoot!.querySelectorAll('.hb-bar').length).toBe(7);
    // a later read that fails keeps the bars on screen
    down = true;
    vi.advanceTimersByTime(HOUR);
    await settle(card);
    expect(asked.length).toBeGreaterThan(2);
    expect(card.shadowRoot!.querySelectorAll('.hb-bar').length).toBe(7);
    expect(card.shadowRoot!.querySelector('.fv-empty-state')).toBeNull();
  });

  it('asks again a minute after the hour turns, and rolls the window at midnight, for a quiet sensor too', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 14, 22, 58, 30));
    const rows: Rows = {
      'sensor.solar': [12, 13, 14, 15, 16, 17, 18, 19].map((change, i) => ({
        start: midnight(8 + i),
        change,
      })),
    };
    const { hass, asked } = house(rows);
    const card = await mount({ _now: '' }, hass);
    const days = (): number => asked.filter((m) => m['period'] === 'day').length;
    expect(days()).toBe(1);
    // 23:00:30 is too soon (the hour is compiled ten seconds in): 23:01:30 asks
    vi.advanceTimersByTime(2 * 60_000);
    await settle(card);
    expect(days()).toBe(1);
    vi.advanceTimersByTime(60_000);
    await settle(card);
    expect(days()).toBe(2);
    // past midnight the window has rolled: the last finished day is 14 October, with no state change at all
    vi.advanceTimersByTime(60 * 60_000);
    await settle(card);
    expect(days()).toBeGreaterThanOrEqual(3);
    await press(card, 'End');
    expect(readouts(card)[0]).toMatch(/^Oct 14 /);
  });

  it('draws the bars below zero and the one in progress in colours of their own, the latter as in progress', async () => {
    const card = await mount(
      {
        include_today: true,
        negative_color: 'red',
        current_color: 'blue',
      },
      house(week([35.4, -4.2, 28.6, 26.5, 30.2, 9.5, 26.9])).hass,
    );
    const negative = card.shadowRoot!.querySelector('.hb-bar.is-negative');
    const current = card.shadowRoot!.querySelector('.hb-bar.is-current');
    expect(negative?.getAttribute('data-accent')).toMatch(/^#/);
    expect(current?.getAttribute('data-accent')).toMatch(/^#/);
    expect(negative?.getAttribute('data-accent')).not.toBe(current?.getAttribute('data-accent'));
    expect(card.shadowRoot!.querySelectorAll('linearGradient').length).toBe(3);
    // without colours of their own they wear the card's
    const plain = await mount({ include_today: true }, house(week([35.4, -4.2])).hass);
    expect(plain.shadowRoot!.querySelector('.hb-bar.is-current')?.hasAttribute('data-accent')).toBe(
      false,
    );
    expect(plain.shadowRoot!.querySelectorAll('linearGradient').length).toBe(1);
  });

  it('reads the bar in progress by its word under the keys', async () => {
    const card = await mount({ include_today: true }, house(week()).hass);
    await press(card, 'End');
    expect(readouts(card)).toEqual(['Today 12.3kWh']);
    expect(card.shadowRoot!.querySelector('.hb-chart')!.getAttribute('aria-label')).toBe(
      'Today · 12.3 kWh',
    );
  });

  it('draws a mini sparkline’s bars below zero instead of cutting them', async () => {
    const card = await mount(
      { variant: 'mini', negative_color: 'red' },
      house(week([35.4, -4.2, 28.6, 26.5, 30.2, 9.5, 26.9])).hass,
    );
    const negative = card.shadowRoot!.querySelectorAll('.hb-spark .fv-vbar.is-negative');
    expect(negative.length).toBe(1);
    expect(Number(negative[0]!.getAttribute('height'))).toBeGreaterThan(2);
    expect(negative[0]!.getAttribute('data-accent')).toMatch(/^#/);
  });

  it('reads a rain gauge in inches, and ignores a unit its own does not convert to', async () => {
    const { hass, asked } = house(byType('sensor.rain', rainReadings, []));
    await mount(
      { entity: 'sensor.rain', _now: '2026-10-13T22:00:00', reset: 'month', unit: 'in' },
      hass,
    );
    expect(asked[0]).toMatchObject({ units: { distance: 'in' } });
    clearBarsCache();
    const { hass: other, asked: askedOther } = house(byType('sensor.rain', rainReadings, []));
    const card = await mount(
      { entity: 'sensor.rain', _now: '2026-10-13T22:00:00', reset: 'month', unit: 'kWh' },
      other,
    );
    expect(askedOther[0]).toMatchObject({ units: { distance: 'mm' } });
    expect(texts(card, '.ax-unit')).toEqual(['mm']);
  });

  it('converts the live reading too: a rain gauge in inches reads its millimetres now in inches', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 13, 22));
    const inches = (): Row[] => rainReadings().map((row) => ({ ...row, state: row.state! / 25.4 }));
    const { hass, later } = house(byType('sensor.rain', inches, []));
    const card = await mount(
      {
        entity: 'sensor.rain',
        _now: '',
        reset: 'month',
        unit: 'in',
        decimals: 2,
        head: ['today'],
      },
      hass,
    );
    expect(readouts(card)).toEqual(['Today 0.00in']);
    card.hass = later({ 'sensor.rain': '42.3' }); // 25.4 mm more than the 16.9 compiled
    await settle(card);
    expect(readouts(card)).toEqual(['Today 1.00in']);
  });

  it('without a head, a still tap on the chart is the card’s; a press that travels reads the bars', async () => {
    const { hass, opened } = house(week());
    const card = await mount({ show_head: false }, hass);
    const chart = card.shadowRoot!.querySelector('.hb-chart') as HTMLElement;
    expect(chart.getAttribute('role')).toBe('button');
    const pointer = (type: string, x: number) =>
      chart.dispatchEvent(
        new PointerEvent(type, { clientX: x, clientY: 10, bubbles: true, pointerType: 'touch' }),
      );
    pointer('pointerdown', 40);
    pointer('pointerup', 40);
    chart.click();
    expect(opened).toEqual(['sensor.solar']);
    pointer('pointerdown', 40);
    pointer('pointermove', 90);
    pointer('pointerup', 90);
    chart.click();
    expect(opened).toEqual(['sensor.solar']);
    chart.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(opened).toEqual(['sensor.solar', 'sensor.solar']);
  });
});

describe('the history bars’ editor', () => {
  it('offers the bars classic, bars and columns, the mini row classic and minimal, and a highlight only to bars', () => {
    const section = (FluvyHistoryBarsCard.getConfigForm().schema as HaFormSchemaItem[]).find(
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
            `${field.name}${field.name === 'chart' ? `:${(field.selector as { select: { options: { value: string }[] } }).select.options.map((o) => o.value).join(',')}` : ''}`,
        );
    expect(shown({})).toEqual(['chart:classic,bars,columns', 'animate']);
    expect(shown({ chart: 'bars' })).toEqual([
      'chart:classic,bars,columns',
      'highlight',
      'animate',
    ]);
    expect(shown({ chart: 'columns' })).toEqual(['chart:classic,bars,columns', 'animate']);
    expect(shown({ variant: 'mini' })).toEqual(['chart:classic,minimal', 'animate']);
  });

  it('shows when it resets, where it is read from and the two colours, with what the card does by default', () => {
    expect(FluvyHistoryBarsCard.keys).toEqual(
      expect.arrayContaining(['reset', 'source', 'negative_color', 'current_color']),
    );
    const names = JSON.stringify(FluvyHistoryBarsCard.getConfigForm().schema);
    for (const name of ['reset', 'source', 'negative_color', 'current_color'])
      expect(names).toContain(`"name":"${name}"`);
    const defaults = (entity: string, attributes: Record<string, unknown> = {}) =>
      FluvyHistoryBarsCard.defaults!({ type: 'x', entity }, {
        states: { [entity]: { attributes } },
      } as unknown as HomeAssistant);
    expect(defaults('sensor.a', { state_class: 'total_increasing' })).toMatchObject({
      stat: 'change',
      reset: 'auto',
      source: 'auto',
      head: ['total', 'average'],
    });
    expect(defaults('sensor.b', { state_class: 'measurement' })).toMatchObject({
      stat: 'mean',
      head: ['average', 'highest'],
    });
    expect(defaults('sensor.c')).toMatchObject({ stat: 'state', head: ['average', 'highest'] });
    // a utility meter on a monthly cycle is still counted as Home Assistant counts it: its helper names the cycle
    expect(
      defaults('sensor.d', {
        state_class: 'total_increasing',
        last_reset: new Date(2026, 9, 1).toISOString(),
        next_reset: new Date(2026, 10, 1).toISOString(),
      }),
    ).toMatchObject({ reset: 'auto' });
  });

  it('says under when it resets what the sensor is: a total without last_reset, a utility meter’s cycle', async () => {
    const form = FluvyHistoryBarsCard.getConfigForm();
    const helper = form.computeHelper as unknown as (
      schema: { name: string },
      localize: (key: string) => string,
      data?: Record<string, unknown>,
      hass?: HomeAssistant,
    ) => string | undefined;
    const { hass } = house({});
    expect(helper({ name: 'reset' }, (k) => k, { entity: 'sensor.rain' }, hass)).toMatch(
      /^A total with no last_reset/,
    );
    expect(helper({ name: 'reset' }, (k) => k, { entity: 'sensor.solar' }, hass)).toMatch(
      /^A counter that starts again/,
    );
    expect(
      helper(
        { name: 'stat' },
        (k) => k,
        { entity: 'sensor.rain', stat: 'state', period: 'month', reset: 'auto' },
        hass,
      ),
    ).toBe('These readings add up when “When it resets” is “Every month”');
    expect(
      helper(
        { name: 'stat' },
        (k) => k,
        { entity: 'sensor.rain', stat: 'state', period: 'month', reset: 'month' },
        hass,
      ),
    ).toBeUndefined();
    // a fact's own unit is the fact's: the card's helper says nothing under it
    expect(helper({ name: 'unit' }, (k) => k)).toBeUndefined();
    const editor = (await FluvyHistoryBarsCard.getConfigElement()) as FluvyRowsEditor;
    expect(editor.spec?.computeHelper).toBe(form.computeHelper);
  });
});

describe('the history bars’ height at a 360 column', () => {
  const height = (config: Partial<HistoryBarsCardConfig>): number =>
    FluvyHistoryBarsCard.layoutHeight({
      type: 'custom:fluvy-history-bars-card',
      entity: 'sensor.solar',
      ...config,
    });

  it('counts the head, the readouts’ row, the values, the plot, the dates and two rows of facts', () => {
    expect(height({})).toBe(40 + 44 + 60 + 20 + 20 + 120 + 24 + 24 + 32 + 44 * 2 + 12);
    expect(height({ show_values: false })).toBe(484 - 16);
    expect(height({ show_dates: false })).toBe(484 - 24);
    expect(height({ show_facts: false })).toBe(484 - 156);
    expect(height({ facts: [] })).toBe(484 - 156);
    expect(height({ facts: ['average', 'highest', 'lowest', 'today'] })).toBe(484);
    // the figures count too: a week's (a hundred and more, "246.3 kWh"), or a total, take a row each
    expect(height({ facts: ['total', 'average', 'highest', 'lowest'] })).toBe(484 - 100 + 212);
    expect(height({ period: 'week' })).toBe(484 + 56);
    expect(height({ period: 'month', facts: ['highest', 'lowest'] })).toBe(484);
    expect(height({ head: [] })).toBe(484 - 60);
    // a long label folds the strip to one a row (two a row with their circles is the default at 360)
    expect(height({ facts: [{ kind: 'money', name: 'Revenue (est.)' }, 'co2', 'highest'] })).toBe(
      484 + 56,
    );
    expect(
      height({
        facts: [{ kind: 'share', of: 'sensor.x', name: 'Share of production' }, 'money', 'co2'],
      }),
    ).toBe(484 + 56);
  });

  it('gives the head’s row to the readouts when the head is off, and knows the other layouts', () => {
    expect(height({ show_head: false })).toBe(484 - 60);
    expect(height({ show_head: false, head: [] })).toBe(484 - 124);
    expect(height({ variant: 'compact' })).toBe(40 + 44 + 60 + 20 + 4 + 80 + 24);
    expect(height({ variant: 'compact', show_dates: false })).toBe(248);
    expect(height({ variant: 'mini' })).toBe(148);
    expect(height({ variant: 'mini', show_head: false })).toBe(88);
  });

  it('stays on the 4 px grid', () => {
    for (const config of [
      {},
      { variant: 'compact' as const },
      { variant: 'mini' as const },
      { facts: ['total', 'co2', 'trees', 'km', 'money'] as const },
      { show_values: false, show_dates: false, show_facts: false },
    ])
      expect(height(config) % 4).toBe(0);
  });
});

describe('the history bars card', () => {
  beforeEach(() => clearBarsCache());
  afterEach(() => document.body.replaceChildren());

  it('asks the recorder once for the week, by day, and draws a bar for every finished day', async () => {
    const { hass, asked } = house(week());
    const card = await mount({}, hass);
    expect(asked.length).toBe(1);
    expect(asked[0]).toMatchObject({
      type: 'recorder/statistics_during_period',
      statistic_ids: ['sensor.solar'],
      period: 'day',
      types: ['change'],
      units: { energy: 'kWh' },
    });
    expect(new Date(asked[0]!['start_time'] as string).getTime()).toBe(midnight(3));
    expect(card.shadowRoot!.querySelectorAll('.hb-bar').length).toBe(7);
    expect(texts(card, '.hb-value')).toEqual([
      '35.4',
      '34.4',
      '28.6',
      '26.5',
      '30.2',
      '9.5',
      '26.9',
    ]);
    expect(texts(card, '.hb-date')).toEqual([
      'Oct 03',
      'Oct 04',
      'Oct 05',
      'Oct 06',
      'Oct 07',
      'Oct 08',
      'Oct 09',
    ]);
    expect(texts(card, '.ax-tick')).toEqual(['0', '10', '20', '30', '40']);
    expect(texts(card, '.ax-unit')).toEqual(['kWh']);
    expect(texts(card, '.fv-card__sub')).toEqual(['Last 7 days']);
  });

  it('reads its figures in the unit of a typical day: a spike Home Assistant counted reads in it too', async () => {
    // a lifetime meter after a restart: its whole reading counted again on 7 October (the playground's frame)
    const card = await mount({}, house(week([24.1, 31.5, 28.2, 26.4, 18_280.2, 30.8, 27.5])).hass);
    expect(texts(card, '.ax-unit')).toEqual(['kWh']);
    expect(texts(card, '.ax-tick')).toEqual(['0', '5,000', '10,000', '15,000', '20,000']);
    expect(readouts(card)).toEqual(['Total 18,448.7kWh', 'Daily avg 2,635.5kWh']);
    expect(facts(card)).toEqual(['Highest18,280.2kWh', 'Lowest24.1kWh', 'Dailyavg2,635.5kWh']);
    await press(card, 'Home');
    expect(readouts(card)).toEqual(['Oct 03 24.1kWh']);
    await press(card, 'End');
    expect(readouts(card)).toEqual(['Oct 09 27.5kWh']);
  });

  it('reads the total and the daily average in the head, and the honest facts under the chart', async () => {
    const card = await mount({}, house(week()).hass);
    expect(readouts(card)).toEqual(['Total 191.5kWh', 'Daily avg 27.4kWh']);
    expect(texts(card, '.hb-fact').map((t) => t.replace(/\s/g, ''))).toEqual([
      'Highest35.4kWh',
      'Lowest9.5kWh',
      'Dailyavg27.4kWh',
    ]);
  });

  it('draws the day in progress only when asked, and says so', async () => {
    const card = await mount({ include_today: true }, house(week()).hass);
    expect(card.shadowRoot!.querySelectorAll('.hb-bar').length).toBe(8);
    // 1.9: the average is the finished days' (1.8 read 25.5 with today's half day in it); the total adds today
    expect(readouts(card)).toEqual(['Total 203.8kWh', 'Daily avg 27.4kWh']);
    expect(texts(card, '.fv-card__sub')).toEqual(['Last 7 days · Today']);
  });

  it('files a day the recorder skipped as nothing gained, and a measurement’s as no bar', async () => {
    const rows = week();
    rows['sensor.solar'] = rows['sensor.solar']!.filter((row) => row.start !== midnight(6));
    const card = await mount({}, house(rows).hass);
    expect(card.shadowRoot!.querySelectorAll('.hb-bar.is-empty').length).toBe(1);
    expect(readouts(card)).toEqual(['Total 165.0kWh', 'Daily avg 23.6kWh']);
    const means: Rows = {
      'sensor.outside': [14.2, 15.8, 13.1, 16, 17.3, 15.1].map((mean, i) => ({
        start: midnight(3 + (i >= 3 ? i + 1 : i)),
        mean,
      })),
    };
    const temperature = await mount(
      { entity: 'sensor.outside', head: ['average', 'highest'] },
      house(means).hass,
    );
    expect(temperature.shadowRoot!.querySelectorAll('.hb-bar.is-empty').length).toBe(1);
    expect(readouts(temperature)).toEqual(['Daily avg 15.3°C', 'Highest 17.3°C']);
  });

  it('reads the bar under the keys: ← from the end, → forward, Escape lets go', async () => {
    const card = await mount({}, house(week()).hass);
    const chart = card.shadowRoot!.querySelector('.hb-chart') as HTMLElement;
    const press = async (key: string) => {
      chart.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await card.updateComplete;
    };
    await press('ArrowLeft');
    expect(card.shadowRoot!.querySelectorAll('.hb-bar.is-hover').length).toBe(1);
    expect(readouts(card)).toEqual(['Oct 09 26.9kWh']);
    expect(chart.getAttribute('aria-label')).toBe('Oct 09 · 26.9 kWh');
    await press('ArrowLeft');
    await press('ArrowLeft');
    await press('ArrowLeft');
    expect(readouts(card)).toEqual(['Oct 06 26.5kWh']);
    await press('Home');
    expect(readouts(card)).toEqual(['Oct 03 35.4kWh']);
    await press('End');
    expect(readouts(card)).toEqual(['Oct 09 26.9kWh']);
    await press('Escape');
    expect(readouts(card)).toEqual(['Total 191.5kWh', 'Daily avg 27.4kWh']);
    expect(chart.classList.contains('is-scrub')).toBe(false);
  });

  it('opens the sensor from a fact, the fact’s own action when it has one', async () => {
    const { hass, opened } = house(week());
    const card = await mount(
      {
        facts: [
          'highest',
          { kind: 'share', of: 'sensor.house' },
          { kind: 'lowest', tap_action: { action: 'none' } },
        ],
      },
      hass,
    );
    const facts = card.shadowRoot!.querySelectorAll<HTMLElement>('.hb-fact');
    expect(facts.length).toBe(3);
    facts[0]!.click();
    facts[1]!.click();
    facts[2]!.click();
    expect(opened).toEqual(['sensor.solar', 'sensor.house']);
    expect(texts(card, '.hb-fact').map((t) => t.replace(/\s/g, ''))[1]).toBe('ShareofHouse50%');
  });

  it('watches its sensor and the sensors its shares are of', async () => {
    const card = await mount(
      { facts: [{ kind: 'share', of: 'sensor.house' }] },
      house(week()).hass,
    );
    expect(card.watched()).toEqual(['sensor.solar', 'sensor.house']);
  });

  it('says so when the recorder knows nothing of the sensor, and draws no strip', async () => {
    const card = await mount({}, house({}).hass);
    expect(texts(card, '.fv-empty-state__text')).toEqual(['No statistics yet']);
    expect(card.shadowRoot!.querySelector('.hb-facts')).toBeNull();
    expect(readouts(card)).toEqual(['Total —', 'Daily avg —']);
  });

  it('keeps the history of a sensor that is unavailable now, and wears the state', async () => {
    const card = await mount({}, house(week(), { dead: true }).hass);
    expect(card.shadowRoot!.querySelector('.fv-card')!.classList.contains('is-unavailable')).toBe(
      true,
    );
    expect(card.shadowRoot!.querySelectorAll('.hb-bar').length).toBe(7);
    expect(texts(card, '.fv-card__sub')).toEqual(['Unavailable · Last 7 days']);
  });

  it('keeps its card for a sensor that is not there, in the off skin, its line opening with the state (1.9)', async () => {
    const card = await mount({ entity: 'sensor.none' }, house(week()).hass);
    expect(card.shadowRoot!.querySelector('.fv-card--empty')).toBeNull();
    expect(card.shadowRoot!.querySelector('.fv-card')!.classList.contains('is-off')).toBe(true);
    expect(texts(card, '.fv-card__sub')).toEqual(['Entity not found · Last 7 days']);
  });

  it('reads a sensor that is not there as the recorder keeps it: its bars, in its unit (1.9)', async () => {
    const rows = week()['sensor.solar'] ?? [];
    const recorder = (message: Record<string, unknown>): unknown =>
      message['type'] === 'recorder/get_statistics_metadata'
        ? [
            {
              statistic_id: 'sensor.gone',
              has_sum: true,
              statistics_unit_of_measurement: 'kWh',
              display_unit_of_measurement: 'kWh',
            },
          ]
        : { 'sensor.gone': rows };
    const card = await mount({ entity: 'sensor.gone' }, house(recorder).hass);
    await settle(card);
    expect(card.shadowRoot!.querySelectorAll('.hb-bar').length).toBe(7);
    expect(readouts(card)[0]).toMatch(/kWh$/);
    expect(texts(card, '.fv-card__sub')).toEqual(['Entity not found · Last 7 days']);
  });

  describe('an imported statistic, with no entity behind it (#149)', () => {
    const id = 'linky:consumption';
    const known = (message: Record<string, unknown>): unknown =>
      message['type'] === 'recorder/get_statistics_metadata'
        ? [
            {
              statistic_id: id,
              has_sum: true,
              name: 'Linky consumption',
              statistics_unit_of_measurement: 'kWh',
              display_unit_of_measurement: 'kWh',
            },
          ]
        : { [id]: week()['sensor.solar'] ?? [] };

    it('is drawn as any sensor: its name, its colour, and no word of an entity not found', async () => {
      const card = await mount({ entity: id, color: 'green' }, house(known).hass);
      await settle(card);
      const root = card.shadowRoot!;
      expect(root.querySelectorAll('.hb-bar').length).toBe(7);
      expect(root.querySelector('.fv-card')!.classList.contains('is-off')).toBe(false);
      expect(root.querySelector('.hb-chart')!.classList.contains('fv-tone--neutral')).toBe(false);
      expect(texts(card, '.fv-card__title')).toEqual(['Linky consumption']);
      expect(texts(card, '.fv-card__sub')).toEqual(['Last 7 days']);
    });

    it('is no button by default, having no entity for more-info to open, and keeps a tap of its own', async () => {
      const bare = await mount({ entity: id, show_head: false }, house(known).hass);
      await settle(bare);
      expect(bare.shadowRoot!.querySelector('.hb-chart')!.getAttribute('role')).toBe('img');
      const own = await mount(
        { entity: id, show_head: false, tap_action: { action: 'navigate', navigation_path: '/x' } },
        house(known).hass,
      );
      await settle(own);
      expect(own.shadowRoot!.querySelector('.hb-chart')!.getAttribute('role')).toBe('button');
    });

    it('is not found where the recorder keeps nothing of it', async () => {
      const none = (message: Record<string, unknown>): unknown =>
        message['type'] === 'recorder/get_statistics_metadata' ? [] : {};
      const card = await mount({ entity: 'linky:typo' }, house(none).hass);
      await settle(card);
      expect(card.shadowRoot!.querySelector('.fv-card')!.classList.contains('is-off')).toBe(true);
      expect(texts(card, '.fv-card__sub')).toEqual(['Entity not found · Last 7 days']);
    });
  });

  it('draws classic as 1.10 did, bar for bar, while the house keeps its factory style', async () => {
    const card = await mount({ include_today: true }, house(week()).hass);
    const root = card.shadowRoot!;
    // recorded on 1.10's card: the bars' paths (the one in progress too), the dashed gridlines, the gradient
    expect({
      bars: [...root.querySelectorAll('.hb-bar')].map((b) => b.getAttribute('d')),
      grid: [...root.querySelectorAll('.ax-grid')].map((l) => l.getAttribute('y1')),
      gradient: root.querySelectorAll('linearGradient').length,
    }).toMatchSnapshot();
  });

  it('draws the bars style: the ink flat, rounded at both ends, the highest lit and the rest quiet, hairlines across', async () => {
    const card = await mount({ chart: 'bars', highlight: 'max' }, house(week()).hass);
    const root = card.shadowRoot!;
    const bars = [...root.querySelectorAll('.hb-bar')];
    expect(root.querySelector('linearGradient')).toBeNull();
    expect(root.querySelector('.ax-grid')).toBeNull();
    expect(root.querySelectorAll('.fc-grid').length).toBe(5);
    // 35.4 lit, the six others quiet
    expect(bars.filter((b) => b.getAttribute('style')?.includes('--fluvy-border')).length).toBe(6);
    expect(bars[0]?.getAttribute('style')).not.toContain('--fluvy-border');
    // an arc at each of its four corners
    expect(bars[0]?.getAttribute('d')?.match(/a/g)?.length).toBe(4);
  });

  it('draws columns without a highlight, and stands still where motion is off', async () => {
    const card = await mount(
      { chart: 'columns', highlight: 'max', animate: false },
      house(week()).hass,
    );
    const root = card.shadowRoot!;
    expect(
      [...root.querySelectorAll('.hb-bar')].some((b) =>
        b.getAttribute('style')?.includes('--fluvy-border'),
      ),
    ).toBe(false);
    expect(root.querySelector('.hb-chart.is-still')).not.toBeNull();
  });

  it('draws the mini row’s sparkline as a minimal line where asked, its bars classic', async () => {
    const minimal = await mount({ variant: 'mini', chart: 'minimal' }, house(week()).hass);
    expect(minimal.shadowRoot!.querySelectorAll('.hb-spark .fc-line').length).toBe(1);
    expect(minimal.shadowRoot!.querySelector('.hb-spark .fv-vbar')).toBeNull();
    // bars is not the mini row's: it draws classic
    const bars = await mount({ variant: 'mini', chart: 'bars' }, house(week()).hass);
    expect(bars.shadowRoot!.querySelectorAll('.hb-spark .fv-vbar').length).toBe(7);
  });

  it('draws the compact and mini layouts', async () => {
    const compact = await mount({ variant: 'compact' }, house(week()).hass);
    expect(compact.shadowRoot!.querySelectorAll('.hb-bar').length).toBe(7);
    expect(compact.shadowRoot!.querySelector('.hb-value')).toBeNull();
    expect(compact.shadowRoot!.querySelector('.ax-tick')).toBeNull();
    expect(compact.shadowRoot!.querySelector('.hb-facts')).toBeNull();
    expect(compact.shadowRoot!.querySelectorAll('.hb-date').length).toBe(7);
    const mini = await mount({ variant: 'mini' }, house(week()).hass);
    expect(mini.shadowRoot!.querySelector('.hb-chart')).toBeNull();
    expect(mini.shadowRoot!.querySelectorAll('.hb-spark .fv-vbar').length).toBe(7);
    expect(readouts(mini)).toEqual(['Total 191.5kWh', 'Daily avg 27.4kWh']);
  });
});
