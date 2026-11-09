// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { weatherHeight } from '../weather-family.js';
import type { FluvyWeatherCard } from './weather-card.js';

// the weather card lands with its own chunk, defined as the index starts
await familiesDefined;

const FluvyWeatherCardClass = customElements.get(
  'fluvy-weather-card',
) as unknown as typeof FluvyWeatherCard;

const NOW = '2026-10-17T19:00:00.000Z';

/** A weather that answers its forecast, live or out of reach as Home Assistant writes it. */
const house = (state: 'live' | 'unavailable' | 'unknown' | 'missing'): HomeAssistant => {
  const forecast = {
    hourly: [0, 1, 2, 3, 4, 5].map((h) => ({
      datetime: new Date(Date.parse(NOW) + h * 3_600_000).toISOString(),
      condition: 'sunny',
      temperature: 18 - h,
    })),
    daily: [0, 1, 2, 3].map((d) => ({
      datetime: new Date(Date.parse(NOW) + d * 86_400_000).toISOString(),
      condition: 'cloudy',
      temperature: 20,
      templow: 12,
    })),
  };
  return {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' } },
    states:
      state === 'missing'
        ? {}
        : {
            'weather.home': {
              entity_id: 'weather.home',
              state: state === 'live' ? 'sunny' : state,
              attributes:
                state === 'live'
                  ? {
                      friendly_name: 'Home',
                      temperature: 18,
                      apparent_temperature: 16,
                      wind_speed: 12,
                    }
                  : { friendly_name: 'Home' },
              last_changed: NOW,
              last_updated: NOW,
            },
          },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    connection: {
      // a weather that cannot be read forecasts nothing
      subscribeMessage: (
        callback: (message: unknown) => void,
        message: { forecast_type: 'hourly' | 'daily' },
      ) => {
        if (state === 'live') callback({ forecast: forecast[message.forecast_type] });
        else callback({ forecast: null });
        return Promise.resolve(() => undefined);
      },
    },
  } as unknown as HomeAssistant;
};

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

/** The card's hero line, its hours' figures and its days' rows, as it draws them. */
async function drawn(state: 'live' | 'unavailable' | 'unknown' | 'missing') {
  const card = document.createElement('fluvy-weather-card') as CardElement;
  card.setConfig({
    type: 'custom:fluvy-weather-card',
    entity: 'weather.home',
    forecast: 'both',
    days: 3,
    _now: NOW,
  });
  card.hass = house(state);
  document.body.append(card);
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await card.updateComplete;
  const root = card.shadowRoot!;
  const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  return {
    line: text(root.querySelector('.am-weather__hero > .fv-card__sub')),
    hours: [...root.querySelectorAll('[data-forecast="hourly"] .am-hour__v')].map(text),
    glyphs: root.querySelectorAll('[data-forecast="hourly"] .am-hour svg').length,
    days: [...root.querySelectorAll('.am-days .fv-row__value')].map(text),
  };
}

afterEach(() => document.body.replaceChildren());

const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** A live card of this config, on the page, its forecast answered. */
async function mounted(config: Record<string, unknown>): Promise<ShadowRoot> {
  const card = document.createElement('fluvy-weather-card') as CardElement;
  card.setConfig({
    type: 'custom:fluvy-weather-card',
    entity: 'weather.home',
    _now: NOW,
    ...config,
  });
  card.hass = house('live');
  document.body.append(card);
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await card.updateComplete;
  return card.shadowRoot!;
}

describe('show_name (#145)', () => {
  const height = (config: Record<string, unknown>): number =>
    weatherHeight({ type: 'custom:fluvy-weather-card', ...config });

  it('leaves the full hero’s label to the condition, with no separator', async () => {
    const root = await mounted({ show_name: false });
    expect(root.querySelector('.am-weather__name')).toBeNull();
    expect(text(root.querySelector('.am-weather__label'))).toBe('Sunny');
  });

  it('leaves the compact head without its title, the condition on its line', async () => {
    const root = await mounted({ variant: 'compact', show_name: false });
    expect(text(root.querySelector('.fv-card__title'))).toBe('');
    expect(text(root.querySelector('.fv-card__sub'))).toContain('Sunny');
  });

  it('keeps the name by default', async () => {
    const root = await mounted({ variant: 'compact' });
    expect(text(root.querySelector('.fv-card__title'))).toBe('Home');
  });

  it('changes no declared height', () => {
    for (const variant of ['full', 'compact'])
      expect(height({ variant, show_name: false })).toBe(height({ variant }));
  });

  it('takes the name field away from the editor while the name is hidden', () => {
    const fields = FluvyWeatherCardClass.getConfigForm().schema.flatMap(
      (item) => item.schema ?? [item],
    );
    const name = fields.find((item) => item.name === 'name');
    expect(fields.some((item) => item.name === 'show_name')).toBe(true);
    expect(name?.when?.({ show_name: false })).toBe(false);
    expect(name?.when?.({})).toBe(true);
  });
});

describe('hourly_step (#146)', () => {
  const hours = (root: ShadowRoot): string[] =>
    [...root.querySelectorAll('[data-forecast="hourly"] .am-hour__v')].map(text);

  it('shows the forecast’s own entry at every step, never a blend', async () => {
    // the forecast cools a degree an hour from 18: the entries at 0, 2 and 4 hours
    expect(hours(await mounted({ forecast: 'hourly', hourly_step: 2 }))).toEqual([
      '18°',
      '16°',
      '14°',
    ]);
  });

  it('leaves the hours as they were by default', async () => {
    expect(hours(await mounted({ forecast: 'hourly' }))).toEqual([
      '18°',
      '17°',
      '16°',
      '15°',
      '14°',
    ]);
  });

  it('draws as many columns as a short forecast gives', async () => {
    expect(hours(await mounted({ forecast: 'hourly', hourly_step: 5 }))).toEqual(['18°', '13°']);
  });

  it('keeps a weather out of reach’s columns, their hours a step apart', async () => {
    const card = document.createElement('fluvy-weather-card') as CardElement;
    card.setConfig({
      type: 'custom:fluvy-weather-card',
      entity: 'weather.home',
      forecast: 'hourly',
      hourly_step: 3,
      _now: NOW,
    });
    card.hass = house('unavailable');
    document.body.append(card);
    await card.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await card.updateComplete;
    const root = card.shadowRoot!;
    expect(hours(root)).toEqual(['—', '—', '—', '—', '—']);
    const [first, second] = [...root.querySelectorAll('[data-forecast="hourly"] .am-hour__t')]
      .slice(1)
      .map((label) => Number(text(label)));
    expect(((second as number) - (first as number) + 24) % 24).toBe(3);
  });

  it('is offered only while the forecast shows hours', () => {
    const field = FluvyWeatherCardClass.getConfigForm().schema.find(
      (item) => item.name === 'hourly_step',
    );
    expect(field?.when?.({ forecast: 'hourly' })).toBe(true);
    expect(field?.when?.({ forecast: 'both' })).toBe(true);
    expect(field?.when?.({})).toBe(false);
    expect(field?.when?.({ forecast: 'hourly', show_forecast: false })).toBe(false);
  });
});

describe('a weather out of reach keeps its hero, its hours and its days (1.9)', () => {
  it('draws the live card’s slots, nothing forecast in them', async () => {
    const live = await drawn('live');
    expect(live.days).toHaveLength(3);
    for (const state of ['unavailable', 'unknown', 'missing'] as const) {
      const twin = await drawn(state);
      expect(twin.line, state).toBe('Feels — · Wind —');
      expect(twin.hours, state).toEqual(live.hours.map(() => '—'));
      expect(twin.glyphs, state).toBe(0);
      expect(twin.days, state).toEqual(['—', '—', '—']);
    }
  });
});
