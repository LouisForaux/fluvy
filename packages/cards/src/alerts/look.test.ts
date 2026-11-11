import { describe, expect, it } from 'vitest';
import type { HomeAssistant } from '@fluvy/core';
import { AlertEngine, type AlertResult } from './engine.js';
import { house, MINUTE, NOW, type HouseOptions, type Seed } from './fixture.js';
import { culpritText, culprits, mostNames, type LookContext } from './look.js';
import { definitionOf, type AlertConfig } from './model.js';

/** An alert as it stands in this house now. */
function result(alert: AlertConfig, hass: HomeAssistant): AlertResult {
  const engine = new AlertEngine([definitionOf(alert, 0, 'card')], { now: () => NOW });
  return engine.evaluate(hass).alerts[0] as AlertResult;
}

/** Who is at fault, as a line says it. */
function said(alert: AlertConfig, hass: HomeAssistant): string[] {
  const context: LookContext = { hass, now: NOW };
  return culprits(context, result(alert, hass)).map((one) => culpritText(context, one));
}

/** A window open this many minutes, named by its role on its device (#89), in an area or none. */
const window = (minutes: number, device: string, area?: string): Seed => ({
  state: 'on',
  attributes: { device_class: 'window', friendly_name: 'Window' },
  changed: NOW - minutes * MINUTE,
  device,
  ...(area ? { area } : {}),
});

const AREAS: HouseOptions['areas'] = {
  kitchen: { name: 'Kitchen' },
  bath: { name: 'Bathroom' },
  bedroom: { name: 'Bedroom' },
  hall: { name: 'Hall' },
};
const OPEN: AlertConfig = { preset: 'open', for: 0 };

describe('who is at fault', () => {
  it('names rows that share a name by their areas, in the alert’s order (#89)', () => {
    const hass = house(
      {
        'binary_sensor.a': window(40, 'a', 'kitchen'),
        'binary_sensor.b': window(30, 'b', 'bath'),
        'binary_sensor.c': window(20, 'c', 'bedroom'),
        'binary_sensor.d': window(10, 'd', 'hall'),
      },
      { areas: AREAS },
    );
    expect(said(OPEN, hass)).toEqual(['Kitchen', 'Bathroom', 'Bedroom', 'Hall']);
  });

  it('names them by their devices where they share an area, and counts a name they still share', () => {
    const one = {
      'binary_sensor.a': window(40, 'a', 'kitchen'),
      'binary_sensor.b': window(30, 'b', 'kitchen'),
      'binary_sensor.c': window(20, 'c', 'kitchen'),
      'binary_sensor.d': window(10, 'd', 'kitchen'),
    };
    const named = house(one, {
      areas: AREAS,
      devices: {
        a: { name: 'Left window' },
        b: { name: 'Right window' },
        c: { name: 'Skylight' },
        d: { name: 'Door window' },
      },
    });
    expect(said(OPEN, named)).toEqual(['Left window', 'Right window', 'Skylight', 'Door window']);
    const alike = house(one, {
      areas: AREAS,
      devices: Object.fromEntries(['a', 'b', 'c', 'd'].map((id) => [id, { name: 'Contact' }])),
    });
    expect(said(OPEN, alike)).toEqual(['Window ×4']);
  });

  it('counts an area two of them share, keeps a row’s own name where it has no area, and the rest as they are', () => {
    const hass = house(
      {
        'binary_sensor.front_door': {
          state: 'on',
          attributes: { device_class: 'door', friendly_name: 'Front door' },
          changed: NOW - 50 * MINUTE,
        },
        'binary_sensor.a': window(40, 'a', 'kitchen'),
        'binary_sensor.b': window(30, 'b', 'bath'),
        'binary_sensor.c': window(20, 'c', 'kitchen'),
        'binary_sensor.d': window(10, 'd'),
      },
      { areas: AREAS },
    );
    expect(said(OPEN, hass)).toEqual(['Front door', 'Kitchen ×2', 'Bathroom', 'Window']);
  });

  it('keeps the person’s areas where the alert names by area, counting the rows each has', () => {
    const hass = house(
      {
        'binary_sensor.a': window(40, 'a', 'kitchen'),
        'binary_sensor.b': window(30, 'b', 'bath'),
        'binary_sensor.c': window(20, 'c', 'kitchen'),
      },
      { areas: AREAS },
    );
    expect(said({ ...OPEN, name_by: 'area' }, hass)).toEqual(['Kitchen ×2', 'Bathroom']);
  });

  it('tells devices of one name apart by their areas where the alert counts devices', () => {
    const battery = (state: string, device: string, area: string): Seed => ({
      state,
      attributes: { device_class: 'battery' },
      device,
      area,
    });
    const hass = house(
      {
        'sensor.a_battery': battery('8', 'a', 'hall'),
        'sensor.b_battery': battery('12', 'b', 'kitchen'),
        'sensor.c_battery': battery('15', 'c', 'hall'),
      },
      {
        areas: AREAS,
        devices: Object.fromEntries(['a', 'b', 'c'].map((id) => [id, { name: 'Motion sensor' }])),
      },
    );
    expect(said({ preset: 'low_battery' }, hass)).toEqual(['Hall ×2', 'Kitchen']);
  });
});

describe('the most names a line can hold', () => {
  /** A ruler as the card's: its width plus the pixel of rounding, kerned a pixel narrower in a join than its parts. */
  const ruler = (measured: string[]) => (text: string) => {
    measured.push(text);
    return text.length * 7 - Math.max(0, text.split(', ').length - 1) + 1;
  };

  /** The longest run of names that fits `room` with its "+n", looked for from `from` down, as the card does. */
  const run = (names: string[], room: number, from: number, width: (text: string) => number) => {
    for (let k = from; k >= 1; k--) {
      const said = `${names.slice(0, k).join(', ')}${k === names.length ? '' : ` +${names.length - k}`}`;
      if (width(said) <= room) return said;
    }
    return '';
  };

  it('finds the run a search from every name finds, measuring a handful of lines, not a hundred', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let trial = 0; trial < 200; trial++) {
      const names = Array.from({ length: 1 + Math.floor(random() * 150) }, (_, i) =>
        'Battery '.slice(0, 1 + Math.floor(random() * 8)).concat(String(i)),
      );
      const room = 40 + Math.floor(random() * 400);
      const all: string[] = [];
      const bounded: string[] = [];
      const expected = run(names, room, names.length, ruler(all));
      const width = ruler(bounded);
      expect(run(names, room, mostNames(names, room, width), width)).toBe(expected);
      // a bound of the room's, whatever the names: a few a line holds, measured one by one, then the runs below
      expect(bounded.length).toBeLessThanOrEqual(2 * (room / 7 + 2) + 4);
      if (all.length > 60) expect(bounded.length).toBeLessThan(all.length / 2);
    }
  });

  it('names them all where they all fit', () => {
    expect(mostNames(['Hall', 'Kitchen'], 400, (text) => text.length * 7 + 1)).toBe(2);
  });
});
