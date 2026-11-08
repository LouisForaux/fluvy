// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { allocate } from '../energy-model/allocate.js';
import { normaliseConfig } from '../shared/config.js';
import { writesZero } from '../shared/units.js';
import { FluvyEnergyFlowCard } from './energy-flow-card.js';
import { lists } from './energy-flow-editor.js';
import {
  arcLengths,
  arcs,
  at,
  crossLayout,
  drawn,
  endAngle,
  HEAD,
  HOUSE_CIRC,
  lane,
  onCircle,
  pulseFrames,
  railIn,
  RING,
  rowsLayout,
  upTo,
  paramAt,
} from './geometry.js';
import { budget, density, pace, type Pulse } from './motion.js';
import { lanesOf, said, type SceneNode, type WayWords } from './scene.js';

const dist = (p: readonly number[], q: readonly number[]): number =>
  Math.hypot((p[0] ?? 0) - (q[0] ?? 0), (p[1] ?? 0) - (q[1] ?? 0));

describe('the arrowhead ends the lane', () => {
  const l = lane([60, 42], 0, onCircle([292, 122], RING, 200), 20, 100);

  it('its tip is the lane’s end, and the lane stops 7 px before it (5 on a thin lane)', () => {
    const acc = arcLengths(l);
    const total = acc[acc.length - 1] ?? 0;
    const lane7 = drawn(l, 'lane');
    const thin = drawn(l, 'thin');
    expect(lane7.run).toBeCloseTo(total - HEAD.lane.trim, 5);
    expect(thin.run).toBeCloseTo(total - HEAD.thin.trim, 5);
    // the body's last point is 7 px of curve before the tip
    const cut = at(upTo(l, paramAt(acc, lane7.run)), 1);
    expect(dist(cut, l.b)).toBeGreaterThan(6.5);
    expect(dist(cut, l.b)).toBeLessThan(7.01);
    expect(lane7.head).toContain(
      `translate(${Math.round(l.b[0] * 10) / 10},${Math.round(l.b[1] * 10) / 10})`,
    );
  });

  it('points along the lane’s last tangent', () => {
    const straight = lane([0, 0], 0, [100, 0], 0, 30);
    expect(endAngle(straight)).toBeCloseTo(0);
    expect(drawn(straight).head).toContain('rotate(0)');
  });

  it('without heads the lane runs its whole length', () => {
    const acc = arcLengths(l);
    expect(drawn(l, 'lane', false).run).toBeCloseTo(acc[acc.length - 1] ?? 0, 5);
  });
});

describe('rows', () => {
  const node = (pair = false) => ({ wordsH: 36, wordsW: 100, pair });

  it('the #19 house: a lane for the sun, a pair for the grid, a lane for the battery, 6 px off the ring', () => {
    const r = rowsLayout({ width: 320, nodes: [node(), node(true), node()], houseWordsH: 36 });
    expect(r.narrow).toBe(false);
    expect(r.lanes.map((l) => `${l.node}.${l.index}`)).toEqual(['0.0', '1.0', '1.1', '2.0']);
    for (const l of r.lanes) expect(dist(l.path.b, r.house)).toBeCloseTo(RING, 5);
    // the pair: two lanes 16 px apart where they leave the words
    const [a, b] = r.lanes.filter((l) => l.node === 1);
    expect((b?.path.a[1] ?? 0) - (a?.path.a[1] ?? 0)).toBe(16);
  });

  it('keeps 20 px of ring between neighbouring contacts, 16 inside a pair', () => {
    const r = rowsLayout({ width: 320, nodes: [node(), node(true), node()], houseWordsH: 36 });
    const ends = r.lanes.map((l) => l.path.b);
    for (let i = 1; i < ends.length; i++) {
      const gap = dist(ends[i - 1] ?? [0, 0], ends[i] ?? [0, 0]);
      expect(gap).toBeGreaterThan(i === 2 ? 15.5 : 19.5);
    }
  });

  it('a lane shorter than 56 px is no lane: the card lists', () => {
    expect(
      rowsLayout({ width: 248, nodes: [node(), node(), node()], houseWordsH: 36 }).narrow,
    ).toBe(true);
    expect(
      rowsLayout({ width: 320, nodes: [node(), node(), node()], houseWordsH: 36 }).narrow,
    ).toBe(false);
  });

  it('the stage ends at the last words, on the 4 px grid', () => {
    const r = rowsLayout({ width: 320, nodes: [node(), node(), node()], houseWordsH: 36 });
    expect(r.height % 4).toBe(0);
    expect(r.height).toBeGreaterThanOrEqual(202 + 22);
  });

  it('consumers move the house to the middle and get a lane each', () => {
    const r = rowsLayout({
      width: 696,
      nodes: [node(), node(), node()],
      houseWordsH: 36,
      consumers: [
        { wordsH: 36, wordsW: 80 },
        { wordsH: 36, wordsW: 80 },
      ],
    });
    expect(r.house[0]).toBe(348);
    expect(r.out).toHaveLength(2);
  });

  it('the rail bends 12 px, or the whole drop when the row is closer to the house', () => {
    expect(railIn(100, 42, 132, 122)).toContain('Q132,42 132,54');
    expect(railIn(100, 114, 132, 122)).toContain('Q132,114 132,122');
  });
});

describe('the cross', () => {
  it('is mirrored about the middle of the grid and the house', () => {
    const g = crossLayout(320);
    expect(g.sun[0]).toBe((g.grid[0] + g.house[0]) / 2);
    expect(g.battery[0]).toBe(g.sun[0]);
    // every lane into the house arrives 6 px off its ring
    for (const key of ['sunHouse', 'gridHouse', 'batteryHouse'] as const)
      expect(dist(g.lanes[key].b, g.house)).toBeCloseTo(RING, 5);
  });
});

describe('the house’s arcs', () => {
  it('share the ring by origin, 4 px apart, and draw nothing for a share of 0', () => {
    const list = arcs([
      { key: 'solar', value: 0.54 },
      { key: 'battery', value: 0 },
      { key: 'grid', value: 0.46 },
    ]);
    expect(list.map((a) => a.key)).toEqual(['solar', 'battery', 'grid']);
    expect(Number(list[0]?.dash.split(' ')[0])).toBeCloseTo(0.54 * HOUSE_CIRC - 4, 1);
    expect(list[1]?.dash.startsWith('0.00 ')).toBe(true);
    expect(Number(list[2]?.offset)).toBeCloseTo(-0.54 * HOUSE_CIRC, 1);
  });
});

describe('pulses', () => {
  const l = lane([0, 0], 0, [200, 0], 0, 60);

  it('travel the lane up to the head, fading in and out', () => {
    const frames = pulseFrames(l, 193, 23, 6, 8);
    expect(frames[0]?.transform).toBe('translate(-23.00px, -3.00px) rotate(0.00deg)');
    expect(frames[frames.length - 1]?.transform).toMatch(/^translate\(170\.00px, -3\.00px\)/);
    expect(frames[0]?.opacity).toBe('0.000');
    expect(frames[frames.length - 1]?.opacity).toBe('0.000');
  });

  it('run at 24 → 72 px/s as a share of the house’s peak', () => {
    expect(pace(0, 6000)).toBe(24);
    expect(pace(6000, 6000)).toBe(72);
    expect(pace(12000, 6000)).toBe(72);
  });

  it('never more than eight on a card: every flowing lane its first, then the extras by strength', () => {
    const p = (key: string, watts: number, run = 300): Pulse => ({
      key,
      path: l,
      run,
      watts,
      ink: 'en-ink--solar',
      body: '',
    });
    expect(density(500, 120)).toBe(1);
    expect(density(4000, 300)).toBe(5);
    const counts = budget([p('small', 200), p('big', 4000), p('mid', 2000)], 'full');
    expect(counts.get('big')).toBe(5);
    expect(counts.get('mid')).toBe(2);
    expect(counts.get('small')).toBe(1);
    // the approved wide frame: six lanes, each moving
    const six = budget(
      [4600, 900, 300, 3700, 1200, 900].map((w, i) => p(`l${i}`, w, 160)),
      'full',
    );
    expect([...six.values()].every((n) => n >= 1)).toBe(true);
    expect([...six.values()].reduce((a, b) => a + b, 0)).toBe(8);
    expect([...budget([p('a', 4000), p('b', 4000)], 'calm').values()]).toEqual([1, 1]);
  });
});

describe('the scene', () => {
  const words: WayWords = {
    in: 'in',
    out: 'out',
    charging: 'charging',
    discharging: 'discharging',
    charged: 'charged',
    discharged: 'discharged',
  };
  const a = allocate({ solar: 3200, fromGrid: 1900, toGrid: 400, fromBattery: 0, toBattery: 600 });
  const origins = {
    allocation: a,
    solar: { tone: 'solar' as const },
    grid: { tone: 'grid' as const },
    battery: { tone: 'battery' as const },
  };
  const grid = (into: number, out: number, pair = true): SceneNode => ({
    kind: 'grid',
    ink: { tone: 'grid' },
    reading: { in: into, out },
    threshold: 10,
    pair,
  });

  it('#19: the grid imports and exports at once — two lanes, the export in the sun’s colour', () => {
    const [first, second] = lanesOf(grid(1900, 400), origins);
    expect(first).toMatchObject({ way: 'in', rest: false, hidden: false, ink: { tone: 'grid' } });
    expect(second).toMatchObject({
      way: 'out',
      rest: false,
      hidden: false,
      ink: { tone: 'solar' },
    });
    expect(said(grid(1900, 400), words)).toEqual({
      first: { value: 1900, way: 'in' },
      second: { value: 400, way: 'out' },
      idle: false,
    });
  });

  it('a grid that only exports turns its one lane round; the second waits hidden', () => {
    const [first, second] = lanesOf(grid(0, 1900), origins);
    expect(first).toMatchObject({ way: 'out', rest: false });
    expect(second).toMatchObject({ hidden: true });
  });

  it('a battery charging from the sun runs out of the house in the sun’s colour', () => {
    const battery: SceneNode = {
      kind: 'battery',
      ink: { tone: 'battery' },
      reading: { in: 0, out: 600 },
      threshold: 10,
      pair: false,
    };
    expect(lanesOf(battery, origins)).toEqual([
      { way: 'out', rest: false, hidden: false, watts: 600, ink: { tone: 'solar' } },
    ]);
    expect(said(battery, words).first).toEqual({ value: 600, way: 'charging' });
    expect(said(battery, words, (total) => total > 0).first).toEqual({
      value: 600,
      way: 'charged',
    });
  });

  it('cheap hours: the grid charging the battery is lilac', () => {
    const night = allocate({
      solar: 0,
      fromGrid: 4200,
      toGrid: 0,
      fromBattery: 0,
      toBattery: 3600,
    });
    const battery: SceneNode = {
      kind: 'battery',
      ink: { tone: 'battery' },
      reading: { in: 0, out: 3600 },
      threshold: 10,
      pair: false,
    };
    expect(lanesOf(battery, { ...origins, allocation: night })[0]?.ink).toEqual({ tone: 'grid' });
  });

  it('a flow below its threshold rests, and its words say 0', () => {
    const solar: SceneNode = {
      kind: 'solar',
      ink: { tone: 'solar' },
      reading: { in: 4, out: 0 },
      threshold: 10,
      pair: false,
    };
    expect(lanesOf(solar, origins)[0]).toMatchObject({ way: 'in', rest: true });
    expect(said(solar, words)).toEqual({ first: { value: 0, way: '' }, idle: true });
  });

  it('over a period every total is said as it is, rounded only by its decimals; under the threshold it rests (#109)', () => {
    // two decimals of a kWh, as `decimals: 2` writes a day's totals
    const reads = (total: number): boolean =>
      !writesZero(total, { unit: 'kWh', divisor: 1000, digits: 2 });
    // a day's 0.05 kWh of sun, a hair under the 50 Wh its lane rests below: Home Assistant's dashboard says 0.05
    const solar: SceneNode = {
      kind: 'solar',
      ink: { tone: 'solar' },
      reading: { in: 49.999999999997, out: 0 },
      threshold: 50,
      pair: false,
    };
    expect(said(solar, words, reads)).toEqual({
      first: { value: 49.999999999997, way: '' },
      idle: true,
    });
    expect(lanesOf(solar, origins)[0]).toMatchObject({ rest: true });
    const battery: SceneNode = { ...solar, kind: 'battery', reading: { in: 0, out: 20 } };
    expect(said(battery, words, reads)).toEqual({
      first: { value: 20, way: 'charged' },
      idle: true,
    });
    // both ways over the day: each said, the one that flowed lighting the figures
    expect(said({ ...grid(3000, 20), threshold: 50 }, words, reads)).toEqual({
      first: { value: 3000, way: 'in' },
      second: { value: 20, way: 'out' },
      idle: false,
    });
    // what its decimals write as 0.00 rests at 0, its way unsaid
    expect(said({ ...battery, reading: { in: 4, out: 0 } }, words, reads)).toEqual({
      first: { value: 0, way: '' },
      idle: true,
    });
  });

  it('an unreadable source says nothing it does not know', () => {
    expect(said({ ...grid(0, 0), reading: { in: null, out: null } }, words).first.value).toBeNull();
  });
});

describe('1.3’s YAML', () => {
  const spec = FluvyEnergyFlowCard.aliases;
  it('reads the flat keys as sources, and never writes them', () => {
    const config = normaliseConfig(
      {
        type: 'custom:fluvy-energy-flow-card',
        solar_power: 'sensor.pv',
        grid_power: 'sensor.grid',
        grid_invert: true,
        battery_power: 'sensor.battery',
        battery_level: 'sensor.soc',
        home_power: 'sensor.house',
        flow_style: 'ribbons',
      },
      spec ?? {},
    );
    expect(config).toEqual({
      type: 'custom:fluvy-energy-flow-card',
      sources: [
        { type: 'solar', power: 'sensor.pv' },
        { type: 'grid', power: 'sensor.grid', invert: true },
        { type: 'battery', power: 'sensor.battery', level: 'sensor.soc' },
      ],
      home: 'sensor.house',
      flow_style: 'stream',
    });
  });

  it('a list under `power` is read as phases; sources written leave the flat keys unread', () => {
    const config = normaliseConfig(
      {
        type: 'custom:fluvy-energy-flow-card',
        sources: [{ type: 'grid', power: ['sensor.l1', 'sensor.l2'] }],
        grid_power: 'sensor.old',
      },
      spec ?? {},
    );
    expect(config).toEqual({
      type: 'custom:fluvy-energy-flow-card',
      sources: [{ type: 'grid', phases: ['sensor.l1', 'sensor.l2'] }],
    });
  });
});

describe('the sources editor', () => {
  const sources = lists.find((list) => list.key === 'sources');
  const names = (schema: readonly HaFormSchemaItem[]): string[] =>
    schema.flatMap((item) => (item.schema ? names(item.schema) : [item.name]));
  const shown = (item: Record<string, unknown>): string[] =>
    names(sources?.schemaOf?.(item) ?? sources?.schema ?? []);

  it('shows each kind what it is read by', () => {
    expect(shown({ type: 'grid' })).toEqual(
      expect.arrayContaining(['power', 'phases', 'import', 'export']),
    );
    expect(shown({ type: 'grid' })).not.toContain('level');
    expect(shown({ type: 'solar' })).not.toContain('export');
    expect(shown({ type: 'battery' })).toEqual(expect.arrayContaining(['level', 'capacity']));
    expect(shown({ type: 'battery' })).not.toContain('phases');
  });

  it('keeps a field the source already carries, and the same form for the same answer', () => {
    expect(shown({ type: 'solar', export: 'sensor.out' })).toContain('export');
    expect(sources?.schemaOf?.({ type: 'grid' })).toBe(sources?.schemaOf?.({ type: 'grid' }));
    expect(names(sources?.schemaOf?.({ type: 'nope' }) ?? [])).toEqual(
      names(sources?.schema ?? []),
    );
  });
});

describe('several sources of a kind', () => {
  if (!customElements.get('fluvy-energy-flow-card'))
    customElements.define('fluvy-energy-flow-card', FluvyEnergyFlowCard);
  const power = (id: string, state: string) => ({
    entity_id: id,
    state,
    attributes: { unit_of_measurement: 'W', device_class: 'power' },
    last_changed: '',
    last_updated: '',
  });
  /** What the house uses as the flow reads it: two arrays (E1, E2) and the grid bringing 300 W. */
  const houseOf = async (e1: string, e2: string): Promise<number | null> => {
    const card = document.createElement('fluvy-energy-flow-card') as FluvyEnergyFlowCard;
    card.setConfig({
      type: 'custom:fluvy-energy-flow-card',
      sources: [
        { type: 'solar', power: 'sensor.e1' },
        { type: 'solar', power: 'sensor.e2' },
        { type: 'grid', power: 'sensor.grid' },
      ],
    });
    card.hass = {
      language: 'en',
      locale: { language: 'en', number_format: 'language', time_format: '24' },
      config: {},
      themes: { darkMode: false },
      states: {
        'sensor.e1': power('sensor.e1', e1),
        'sensor.e2': power('sensor.e2', e2),
        'sensor.grid': power('sensor.grid', '300'),
      },
      entities: {},
      devices: {},
      areas: {},
      localize: (key: string) => key,
      callWS: async () => ({}),
    } as unknown as HomeAssistant;
    document.body.append(card);
    await card.updateComplete;
    const scene = (card as unknown as { build(): { houseValue: number | null } }).build();
    card.remove();
    return scene.houseValue;
  };

  it('counts an array that cannot be read as nothing while another reads; none read, the house is unknown (#140)', async () => {
    // E1's inverter offline, E2 making 942 W: the house uses 1242 W
    expect(await houseOf('unavailable', '942')).toBe(1242);
    expect(await houseOf('600', '942')).toBe(1842);
    expect(await houseOf('unavailable', 'unavailable')).toBeNull();
  });
});
