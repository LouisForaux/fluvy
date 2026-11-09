import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { fetchRecorded, RecordedSensors, recordedView, type Recorded } from './recorded.js';

const meter: Recorded = {
  statistic_id: 'sensor.solar_energy',
  has_sum: true,
  mean_type: 0,
  statistics_unit_of_measurement: 'kWh',
  display_unit_of_measurement: 'kWh',
};
const house = (states: Record<string, unknown> = {}, answer: unknown = [meter]) => {
  const asked: unknown[] = [];
  const hass = {
    states,
    connection: {},
    callWS: (message: unknown) => {
      asked.push(message);
      return Promise.resolve(answer);
    },
  } as unknown as HomeAssistant;
  return { hass, asked };
};

describe('a sensor no longer in the house, as the recorder keeps it', () => {
  it('asks the recorder once a page for a statistic, and finds the one asked', async () => {
    const { hass, asked } = house();
    expect(await fetchRecorded(hass, 'sensor.solar_energy')).toEqual(meter);
    expect(await fetchRecorded(hass, 'sensor.solar_energy')).toEqual(meter);
    expect(asked).toEqual([
      { type: 'recorder/get_statistics_metadata', statistic_ids: ['sensor.solar_energy'] },
    ]);
    expect(await fetchRecorded(hass, 'sensor.other')).toBeNull();
  });

  it('is null where the recorder cannot be read', async () => {
    const hass = {
      states: {},
      connection: {},
      callWS: () => Promise.reject(new Error('unknown command')),
    } as unknown as HomeAssistant;
    expect(await fetchRecorded(hass, 'sensor.solar_energy')).toBeNull();
  });

  it('dresses a missing sensor in its unit and its state class: a sum counts, a mean measures', () => {
    const { hass } = house();
    const gone = resolveEntity(hass, 'sensor.solar_energy');
    const counted = recordedView(gone, meter);
    expect([counted.status, counted.unit, counted.attr('state_class')]).toEqual([
      'missing',
      'kWh',
      'total',
    ]);
    const measured = recordedView(gone, {
      ...meter,
      has_sum: false,
      mean_type: 1,
      display_unit_of_measurement: '°C',
    });
    expect([measured.unit, measured.attr('state_class')]).toEqual(['°C', 'measurement']);
    // before 2025.4 the recorder said `has_mean`
    expect(recordedView(gone, { statistic_id: 'x', has_mean: true }).attr('state_class')).toBe(
      'measurement',
    );
  });

  it('reads a card’s missing sensors once the recorder has answered, and draws the card again then', async () => {
    const { hass, asked } = house();
    let drawn = 0;
    const sensor = new RecordedSensors({ hass, requestUpdate: () => (drawn += 1) });
    const gone = resolveEntity(hass, 'sensor.solar_energy');
    expect(sensor.view(gone).unit).toBe('');
    expect(sensor.ready(gone)).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([drawn, sensor.ready(gone), sensor.view(gone).unit]).toEqual([1, true, 'kWh']);
    expect(asked).toHaveLength(1);
    // a sensor that is there is never asked about
    const there = resolveEntity(
      { ...hass, states: { 'sensor.house': { state: '1', attributes: {} } } } as never,
      'sensor.house',
    );
    expect([sensor.view(there), sensor.ready(there)]).toEqual([there, true]);
    expect(asked).toHaveLength(1);
    // another missing sensor of the card is asked on its own, once
    const other = resolveEntity(hass, 'sensor.gas');
    expect(sensor.ready(sensor.view(other))).toBe(false);
    sensor.view(other);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect([asked.length, sensor.ready(other), drawn]).toEqual([2, true, 2]);
  });

  it('tells an imported statistic from a sensor that is gone, until the recorder says it keeps nothing of it', async () => {
    const { hass } = house();
    const sensor = new RecordedSensors({ hass, requestUpdate: () => undefined });
    const gone = resolveEntity(hass, 'sensor.solar_energy');
    const imported = resolveEntity(hass, 'linky:typo');
    sensor.view(gone);
    sensor.view(imported);
    expect([sensor.imported(gone), sensor.imported(imported)]).toEqual([false, true]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sensor.imported(imported)).toBe(false);
  });

  it('names an imported statistic as the recorder does', () => {
    const view = resolveEntity(house().hass, 'linky:consumption');
    expect(recordedView(view, { statistic_id: 'x', name: 'Linky' }).name).toBe('Linky');
  });

  it('hands back a sensor that is there, or one the recorder knows nothing of, as it is', () => {
    const { hass } = house({
      'sensor.solar_energy': {
        entity_id: 'sensor.solar_energy',
        state: 'unavailable',
        attributes: { unit_of_measurement: 'Wh' },
      },
    });
    const away = resolveEntity(hass, 'sensor.solar_energy');
    expect(recordedView(away, meter)).toBe(away);
    const gone = resolveEntity(house().hass, 'sensor.solar_energy');
    expect(recordedView(gone, null)).toBe(gone);
    expect(recordedView(gone, undefined)).toBe(gone);
  });
});
