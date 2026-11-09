// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { FluvyPeopleCard } from './people-card.js';

if (!customElements.get('fluvy-people-card'))
  customElements.define('fluvy-people-card', FluvyPeopleCard);

const NOW = '2026-10-17T19:00:00.000Z';

const person = (id: string, state: string): HassEntity => ({
  entity_id: id,
  state,
  attributes: { friendly_name: id.split('.')[1] ?? '' },
  last_changed: NOW,
  last_updated: NOW,
});

const house = (states: readonly HassEntity[]): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: {} },
    states: Object.fromEntries(states.map((state) => [state.entity_id, state])),
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
  }) as unknown as HomeAssistant;

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
  headFit: { ruler: unknown };
};

/** The card at `width`, a stub ruler at 8 px a glyph, except for what `wide` names (too wide for any column). */
async function draw(states: readonly HassEntity[], width: number, wide: RegExp) {
  const card = document.createElement('fluvy-people-card') as CardElement;
  Object.assign(card.headFit, {
    ruler: {
      width: (_cls: string, text: string) => (wide.test(text) ? 400 : text.length * 8),
      pill: (_cls: string, text: string, sides: number) => text.length * 8 + sides,
      clear() {},
    },
  });
  card.setConfig({
    type: 'custom:fluvy-people-card',
    entities: states.map((state) => state.entity_id),
    _now: NOW,
  });
  card.hass = house(states);
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  return card.shadowRoot!;
}

const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

afterEach(() => document.body.replaceChildren());

describe('the People card in a narrow column', () => {
  const states = [person('person.anna', 'home'), person('person.bo', 'not_home')];

  it('keeps the faces where the word for away does not hold its column', async () => {
    const root = await draw(states, 211, /^Away/);
    expect(root.querySelectorAll('.am-person')).toHaveLength(2);
    expect(root.querySelector('.am-rows')).toBeNull();
    // the column says the time, the detail standing in for a word that does not hold
    const line = text(root.querySelectorAll('.am-person__state')[1]);
    expect(line).not.toContain('Away');
    expect(line).not.toContain('—');
    expect(root.querySelectorAll('.am-person')[1]?.getAttribute('aria-label')).toContain('Away');
  });

  it('is a dash where nothing else holds beside the face, whole, the word kept for the label', async () => {
    const root = await draw(states, 211, /^Away|:/);
    expect(text(root.querySelectorAll('.am-person__state')[1])).toBe('—');
  });

  it('still lays rows where the word for home would be cut', async () => {
    const root = await draw(states, 211, /^Home/);
    expect(root.querySelector('.am-person')).toBeNull();
    expect(root.querySelector('.am-rows')).not.toBeNull();
  });

  it('counts in figures alone where the words would be cut in the head', async () => {
    const root = await draw(states, 152, /of 2/);
    expect(text(root.querySelector('.fv-card__sub'))).toBe('1/2');
  });
});
