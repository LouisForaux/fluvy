// @vitest-environment happy-dom
import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hueAt } from './hue-ring.js';
import {
  FluvyLightsColourSheet,
  roomBulb,
  type LightsColourHost,
  type SheetLamp,
} from './lights-colour-sheet.js';

/*
 * The room's colour sheet (#137): the room as one bulb (the lit colour bulbs' mean, the whites' temperature, every
 * bulb's modes), the hue wheel's geometry, and the sheet itself: the room's name, its line and its switch, the light
 * card's controls for the room, which lights take no colour, and a colour sent to every light in one call.
 */

const STAMP = '2026-11-09T19:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown>) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});
const STATES = {
  'light.ceiling': state('light.ceiling', 'on', {
    friendly_name: 'Ceiling',
    supported_color_modes: ['color_temp'],
    color_mode: 'color_temp',
    brightness: 179,
    color_temp_kelvin: 2700,
    min_color_temp_kelvin: 2200,
    max_color_temp_kelvin: 6500,
    rgb_color: [255, 167, 87],
  }),
  'light.floor': state('light.floor', 'on', {
    friendly_name: 'Floor lamp',
    supported_color_modes: ['hs', 'color_temp'],
    color_mode: 'hs',
    brightness: 140,
    hs_color: [36, 100],
    rgb_color: [255, 152, 0],
    min_color_temp_kelvin: 2000,
    max_color_temp_kelvin: 6535,
  }),
  'light.strip': state('light.strip', 'on', {
    friendly_name: 'TV strip',
    supported_color_modes: ['hs'],
    color_mode: 'hs',
    brightness: 140,
    hs_color: [36, 50],
    rgb_color: [255, 203, 128],
  }),
  'light.reading': state('light.reading', 'off', {
    friendly_name: 'Reading lamp',
    supported_color_modes: ['color_temp'],
  }),
  'light.shelf': state('light.shelf', 'on', {
    friendly_name: 'Shelf',
    supported_color_modes: ['onoff'],
    color_mode: 'onoff',
  }),
};

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  states: STATES,
  entities: {},
  devices: {},
  areas: {},
  callService: () => Promise.resolve(),
} as unknown as HomeAssistant;

const lamp = (id: keyof typeof STATES): SheetLamp => {
  const view = resolveEntity(hass, id);
  const modes = view.attr<string[]>('supported_color_modes') ?? [];
  return {
    view,
    name: STATES[id].attributes['friendly_name'] as string,
    usable: true,
    on: view.state === 'on',
    colours: modes.some((mode) => ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(mode)),
  };
};

describe('the room as one bulb', () => {
  it('glows its lit colour bulbs’ mean by their brightness, a white among them adding nothing', () => {
    const room = roomBulb([lamp('light.ceiling'), lamp('light.floor'), lamp('light.strip')], null);
    expect(room.shown).toEqual({ rgb: [255, 178, 64] });
    expect(room.hue).toBe(36);
    expect(room.saturation).toBe(75);
    expect([...room.modes].sort()).toEqual(['color_temp', 'hs']);
    expect([room.minK, room.maxK]).toEqual([2000, 6535]);
  });

  it('is white at its lit whites’ temperature where no colour bulb glows, and shows nothing while off', () => {
    expect(roomBulb([lamp('light.ceiling'), lamp('light.reading')], null).shown).toEqual({
      kelvin: 2700,
    });
    const off = roomBulb([lamp('light.reading')], null);
    expect(off.shown).toEqual({});
    expect([off.hue, off.saturation, off.minK, off.maxK]).toEqual([0, 100, 2000, 6500]);
  });

  it('shows the finger’s choice while it is held', () => {
    const room = roomBulb([lamp('light.floor')], { rgb: [0, 0, 255], hue: 240 });
    expect(room.shown).toEqual({ rgb: [0, 0, 255], hue: 240 });
    expect(room.hue).toBe(240);
  });
});

describe('the hue wheel', () => {
  it('reads the hue off a point of the ring: red at three o’clock, the hues running clockwise', () => {
    expect(hueAt(200, 108)).toBe(0);
    expect(hueAt(108, 200)).toBe(90);
    expect(hueAt(16, 108)).toBe(180);
    expect(hueAt(108, 16)).toBe(270);
  });
});

type Sheet = FluvyLightsColourSheet & { updateComplete: Promise<boolean> };

/** The sheet docked (no dialog) on a room, opened; what the room was sent is kept. */
async function open(
  ids: (keyof typeof STATES)[],
  options: { control?: 'ruler' | 'wheel' } = {},
): Promise<{ sheet: Sheet; sent: Record<string, unknown>[]; state: { flips: number } }> {
  const sent: Record<string, unknown>[] = [];
  const state = { flips: 0 };
  const lamps = ids.map(lamp);
  const host: LightsColourHost = {
    title: () => 'Living room',
    line: () => '2 of 3 on · 63 %',
    tone: () => 'light',
    lamps: () => lamps,
    flip: () => {
      state.flips += 1;
    },
    colors: () => undefined,
    control: () => options.control ?? 'ruler',
    look: () => 'ruler',
    still: () => true,
    words: (items) => items,
    pick: (data) => {
      sent.push(data);
    },
    adopt: () => undefined,
  };
  const sheet = document.createElement('fluvy-lights-colour-sheet') as Sheet;
  sheet.docked = true;
  sheet.hass = hass;
  sheet.card = host;
  document.body.append(sheet);
  sheet.open();
  await sheet.updateComplete;
  return { sheet, sent, state };
}

const root = (sheet: Sheet): ShadowRoot => sheet.shadowRoot!;
const text = (sheet: Sheet, selector: string): string =>
  root(sheet).querySelector(selector)?.textContent?.trim() ?? '';

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('the room’s colour sheet', () => {
  it('heads with the room’s name over the card’s line and the room’s switch, then the light card’s controls', async () => {
    const { sheet, state } = await open(['light.ceiling', 'light.floor', 'light.reading']);
    expect(text(sheet, '.fv-sheet__title')).toBe('Living room');
    expect(text(sheet, '.fv-sheet__head .fv-card__sub')).toBe('2 of 3 on · 63 %');
    const toggle = root(sheet).querySelector<HTMLElement>('.fv-sheet__head [role="switch"]')!;
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    toggle.click();
    expect(state.flips).toBe(1);
    // the hue ruler on the room's hue, the quick colours under it: the room's six, orange checked (the Floor lamp's)
    const ruler = root(sheet).querySelector<HTMLElement & { value: number }>('fluvy-ruler')!;
    expect(ruler.value).toBe(36);
    const swatches = [...root(sheet).querySelectorAll<HTMLElement>('.lc-swatch')];
    expect(swatches.map((el) => el.title)).toEqual([
      'Warm',
      'Cool',
      'Red',
      'Orange',
      'Green',
      'Blue',
    ]);
    expect(swatches.map((el) => el.classList.contains('is-active'))).toEqual([
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('says which lights take no colour, in the house’s list words; nothing where every light does', async () => {
    const mixed = await open(['light.ceiling', 'light.floor', 'light.reading']);
    expect(text(mixed.sheet, '.ls-hint')).toBe('Ceiling and Reading lamp take no colour');
    const one = await open(['light.floor', 'light.shelf']);
    expect(text(one.sheet, '.ls-hint')).toBe('Shelf takes no colour');
    const colours = await open(['light.floor', 'light.strip']);
    expect(root(colours.sheet).querySelector('.ls-hint')).toBeNull();
  });

  it('sends a quick colour to the room and holds it until the room reports it, or five seconds pass', async () => {
    vi.useFakeTimers();
    const { sheet, sent } = await open(['light.ceiling', 'light.floor']);
    root(sheet).querySelector<HTMLElement>('.lc-swatch[title="Blue"]')!.click();
    expect(sent).toEqual([{ rgb_color: [33, 150, 243] }]);
    await sheet.updateComplete;
    const active = (): string =>
      root(sheet).querySelector<HTMLElement>('.lc-swatch.is-active')?.title ?? '';
    expect(active()).toBe('Blue');
    vi.advanceTimersByTime(5001);
    await sheet.updateComplete;
    expect(active()).toBe('Orange');
  });

  it('draws the hue wheel in the ruler’s slot where asked, on the room’s hue and colour', async () => {
    const { sheet, sent } = await open(['light.floor', 'light.strip'], { control: 'wheel' });
    expect(root(sheet).querySelector('fluvy-ruler')).toBeNull();
    const ring = root(sheet).querySelector<HTMLElement & { value: number; color: string }>(
      'fluvy-hue-ring',
    )!;
    expect(ring.value).toBe(36);
    // the two colour bulbs' mean: orange and its paler neighbour
    expect(ring.color).toBe('#ffb240');
    ring.dispatchEvent(
      new CustomEvent('fluvy-change', { detail: { value: 120 }, bubbles: true, composed: true }),
    );
    expect(sent).toEqual([{ hs_color: [120, 75] }]);
  });
});
