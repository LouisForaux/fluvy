import { describe, expect, it } from 'vitest';
import { balanceHeight } from '../energy-family.js';
import { balanceOf, legendColumns, rested, rowsOf, sumOf, type Flow } from './balance.js';

const flow = (kind: Flow['kind'], into: number | null, out: number | null, extra = {}): Flow => ({
  kind,
  reading: { in: into, out },
  ...extra,
});

describe('the balance: what comes in against what goes out', () => {
  it('the #19 house, live: the grid imports on two phases and exports on the third, both counted', () => {
    const b = balanceOf([flow('solar', 3200, 0), flow('grid', 1900, 400), flow('battery', 0, 600)]);
    expect(b.coming.map((i) => [i.kind, i.value])).toEqual([
      ['solar', 3200],
      ['grid', 1900],
    ]);
    expect(b.going.map((i) => [i.kind, i.value])).toEqual([
      ['house', 4100],
      ['battery', 600],
      ['grid', 400],
    ]);
    expect(b.inTotal).toBe(5100);
    expect(b.outTotal).toBe(5100);
  });

  it('a day of the Energy dashboard’s meters: the house is the remainder, the totals agree', () => {
    const b = balanceOf([
      flow('grid', 4100, 1300),
      flow('solar', 11200, 0),
      flow('battery', 2400, 3000),
    ]);
    expect(b.coming.map((i) => i.kind)).toEqual(['solar', 'grid', 'battery']);
    expect(b.house).toBeCloseTo(13400, 6);
    expect(b.inTotal).toBeCloseTo(17700, 6);
    expect(b.outTotal).toBeCloseTo(17700, 6);
  });

  it('an unreadable source says so, and nothing that depends on it is guessed', () => {
    const b = balanceOf([flow('solar', 1800, 0), flow('grid', null, null)]);
    expect(b.coming.find((i) => i.kind === 'grid')?.value).toBeNull();
    expect(b.inTotal).toBeNull();
    expect(b.house).toBeNull();
    expect(b.outTotal).toBeNull();
    // its way not known, it is listed once, among what comes in (1.9: the card keeps its rows)
    expect(b.going.map((i) => [i.kind, i.value])).toEqual([['house', null]]);
  });

  it('a battery that cannot be read is listed once, where a live one is listed once either way', () => {
    const rows = (flows: Flow[]) => {
      const b = balanceOf(flows);
      return [b.coming.length, b.going.length];
    };
    const away = rows([
      flow('solar', 3200, 0),
      flow('grid', 1900, 400),
      flow('battery', null, null),
    ]);
    expect(away).toEqual([3, 2]);
    expect(
      rows([flow('solar', 3200, 0), flow('grid', 1900, 400), flow('battery', 0, 600)]),
    ).toEqual([2, 3]);
    // the export alone unreadable: the import says what it knows, the export its "—"
    const half = balanceOf([flow('solar', 1000, 0), flow('grid', 500, null)]);
    expect(half.going.map((i) => [i.kind, i.value])).toEqual([
      ['house', null],
      ['grid', null],
    ]);
  });

  it('an export sensor that cannot be read leaves the import known, the house unknown', () => {
    const b = balanceOf([flow('solar', 1000, 0), flow('grid', 500, null)]);
    expect(b.inTotal).toBe(1500);
    expect(b.house).toBeNull();
    expect(b.outTotal).toBeNull();
  });

  it('one of several of a kind that cannot be read counts as nothing; none read, the kind is unknown (#140)', () => {
    // E1's inverter offline, E2 making 942 W
    const b = balanceOf([flow('solar', null, null), flow('solar', 942, 0), flow('grid', 300, 0)]);
    expect(b.coming.find((i) => i.kind === 'solar')?.value).toBe(942);
    expect(b.house).toBe(1242);
    const dark = balanceOf([
      flow('solar', null, null),
      flow('solar', null, null),
      flow('grid', 300, 0),
    ]);
    expect(dark.coming.find((i) => i.kind === 'solar')?.value).toBeNull();
    expect(dark.house).toBeNull();
  });

  it('several of a kind are summed; one alone keeps its own name and colour', () => {
    const b = balanceOf([
      flow('solar', 2100, 0, { name: 'East' }),
      flow('solar', 1400, 0, { name: 'West' }),
      flow('grid', 0, 300),
      flow('battery', 0, 800, { name: 'Garage', color: 'teal' }),
      flow('battery', 500, 0),
      flow('generator', 1200, 0),
      flow('vehicle', 0, 3700, { name: 'Model 3' }),
    ]);
    expect(b.coming.map((i) => [i.kind, i.value, i.name])).toEqual([
      ['solar', 3500, undefined],
      ['battery', 500, undefined],
      ['generator', 1200, undefined],
    ]);
    expect(b.going.map((i) => [i.kind, i.value])).toEqual([
      ['house', 400],
      ['battery', 800],
      ['vehicle', 3700],
      ['grid', 300],
    ]);
    expect(b.going.find((i) => i.kind === 'vehicle')?.name).toBe('Model 3');
    expect(b.inTotal).toBe(b.outTotal);
  });

  it('when nothing comes in every source is listed at nothing, and the house is always listed', () => {
    const b = balanceOf([flow('solar', 0, 0), flow('grid', 0, 0)]);
    expect(b.coming.map((i) => [i.kind, i.value])).toEqual([
      ['solar', 0],
      ['grid', 0],
    ]);
    expect(b.going.map((i) => [i.kind, i.value])).toEqual([['house', 0]]);
  });

  it('sensors that disagree by a few watts leave the house at nothing, and the totals show why', () => {
    const b = balanceOf([flow('solar', 590, 0), flow('battery', 0, 600)]);
    expect(b.house).toBe(0);
    expect(b.inTotal).toBe(590);
    expect(b.outTotal).toBe(600);
  });

  it('a direction below its threshold rests at 0, an unreadable one stays unknown', () => {
    expect(rested({ in: 6, out: 400 }, 10)).toEqual({ in: 0, out: 400 });
    expect(rested({ in: null, out: 4 }, 10)).toEqual({ in: null, out: 0 });
    expect(sumOf([1, 2, null])).toBeNull();
    expect(sumOf([])).toBe(0);
  });
});

describe('the legends', () => {
  it('take as many columns as the widest item holds, every row full but the last', () => {
    expect(legendColumns(3, 90, 320)).toBe(3);
    expect(legendColumns(2, 90, 320)).toBe(2);
    expect(legendColumns(3, 120, 320)).toBe(2);
    expect(legendColumns(4, 70, 320)).toBe(4);
    expect(legendColumns(4, 90, 320)).toBe(2);
    expect(legendColumns(5, 90, 320)).toBe(3);
    expect(legendColumns(3, 200, 136)).toBe(1);
    expect(rowsOf([1, 2, 3, 4, 5], 3)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });
});

describe('the balance’s height at a 360 column', () => {
  it('matches the approved drawings: live per phase 488, a day with its money 428', () => {
    expect(
      balanceHeight({
        type: 'custom:fluvy-energy-balance-card',
        sources: [
          { type: 'solar', power: 'sensor.a' },
          { type: 'grid', phases: ['sensor.l1', 'sensor.l2', 'sensor.l3'] },
        ],
      }),
    ).toBe(488);
    expect(balanceHeight({ type: 'custom:fluvy-energy-balance-card', period: 'day' })).toBe(428);
    expect(balanceHeight({ type: 'custom:fluvy-energy-balance-card' })).toBe(308);
    expect(
      balanceHeight({
        type: 'custom:fluvy-energy-balance-card',
        show_phases: false,
        sources: [{ type: 'grid', phases: ['sensor.l1', 'sensor.l2'] }],
      }),
    ).toBe(308);
  });
});
