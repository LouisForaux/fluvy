import { describe, expect, it } from 'vitest';
import {
  CHART_DEFAULTS,
  HOUSE_DEFAULTS,
  isPaletteRef,
  MAX_SAVED_SERIES,
  MAX_SAVED_PALETTES,
  parseCards,
  parseHouse,
  parsePalette,
  parsePersonal,
  parseSavedPalettes,
  parseSliderSettings,
  parseWall,
  PERSONAL_DEFAULTS,
  resolveSettings,
  SettingsStore,
  SLIDER_DEFAULTS,
  pageScope,
  WALL_DEFAULTS,
  wearsLook,
  type SettingsHass,
} from '../settings/index.js';
import { CHROME_DEFAULTS, TABS_DEFAULTS } from '../look/tabs.js';

describe('parsing stored settings', () => {
  it('falls back to the defaults for anything missing, broken or unknown', () => {
    expect(parseHouse(undefined)).toEqual(HOUSE_DEFAULTS);
    expect(parseHouse('nonsense')).toEqual(HOUSE_DEFAULTS);
    expect(
      parseHouse({
        palette: 'tartan',
        shape: 'blob',
        scope: 'moon',
        dashboards: 'x',
        frame: 1,
        icons: 'yes',
        activity: 'no',
        tabs: 'pills',
      }),
    ).toEqual(HOUSE_DEFAULTS);
    // tabs read field by field: an unknown style or content takes the default, the rest is kept
    expect(parseHouse({ tabs: { style: 'tartan', content: 'both', title: 'no' } }).tabs).toEqual({
      style: 'fluvy',
      content: 'both',
      title: true,
    });
    expect(parsePersonal({ language: 'sv', motion: 'fast', haptics: 'yes' })).toEqual(
      PERSONAL_DEFAULTS,
    );
  });

  it('keeps what is well formed', () => {
    expect(
      parseHouse({
        palette: 'volt',
        shape: 'round',
        pills: 'crisp',
        scope: 'everywhere',
        dashboards: ['fluvy-home', 3],
        frame: false,
        icons: false,
        activity: false,
        history: false,
        tabs: { style: 'pills', content: 'icons', title: false },
        chrome: {
          logo: true,
          dividers: false,
          header: 'page',
          actions: 'menu',
          // a url path once, nothing a selector could not hold
          separators: ['fluvy-home', 'fluvy-home', 'history', 'a b', '#x', 3],
        },
        lightTint: 'always',
        lightColors: true,
        statuses: { warning: '#DC630B', danger: 'red' },
        cards: { opacity: 60, blur: false, unavailable: 'quiet' },
        extra: true,
      }),
    ).toEqual({
      version: 3,
      palette: 'volt',
      shape: 'round',
      pills: 'crisp',
      tabs: { style: 'pills', content: 'icons', title: false },
      chrome: {
        logo: true,
        dividers: false,
        header: 'page',
        actions: 'menu',
        separators: ['fluvy-home', 'history'],
      },
      scope: 'everywhere',
      dashboards: ['fluvy-home'],
      frame: false,
      icons: false,
      activity: false,
      history: false,
      palettes: [],
      wall: WALL_DEFAULTS,
      lightTint: 'always',
      lightColors: true,
      statuses: { warning: '#dc630b' },
      charts: CHART_DEFAULTS,
      chartSets: [],
      cards: { opacity: 60, blur: false, unavailable: 'quiet' },
      sliders: SLIDER_DEFAULTS,
    });
  });

  it('reads the house’s slider settings: the ruler until the house chooses a style (1.18, #144: nothing changes on upgrade)', () => {
    // a 1.17 house stored none: every slider the ruler, as before, and the same version (a field with its default)
    const upgraded = parseHouse({ version: 3, palette: 'volt' });
    expect(upgraded.sliders).toEqual({ style: 'ruler', words: 'ends' });
    expect(HOUSE_DEFAULTS.sliders).toEqual(SLIDER_DEFAULTS);
    expect(upgraded.version).toBe(3);
    expect(parseSliderSettings({ style: 'bar', words: 'none' })).toEqual({
      style: 'bar',
      words: 'none',
    });
    expect(parseSliderSettings({ style: 'liquid' })).toEqual({ style: 'liquid', words: 'ends' });
    expect(parseSliderSettings({ style: 'fill' }).style).toBe('fill');
    // a word it does not know, another case, a card's own `house`, or not a word: the default
    for (const broken of ['knob', 'Bar', 'house', true, null, 1])
      expect(parseSliderSettings({ style: broken, words: broken })).toEqual(SLIDER_DEFAULTS);
    expect(parseSliderSettings('bar')).toEqual(SLIDER_DEFAULTS);
    expect(
      resolveSettings(parseHouse({ sliders: { style: 'liquid' } }), PERSONAL_DEFAULTS).sliders,
    ).toEqual({ style: 'liquid', words: 'ends' });
  });

  it('reads the house’s status colours, each broken one as the palette’s (1.9: nothing changes on upgrade)', () => {
    expect(parseHouse({}).statuses).toEqual({});
    expect(HOUSE_DEFAULTS.statuses).toEqual({});
    expect(
      parseHouse({
        statuses: { notice: '#1C7ED6', success: 'green', warning: '#dc630b', info: '#000000' },
      }).statuses,
    ).toEqual({ warning: '#dc630b', notice: '#1c7ed6' });
    for (const broken of ['orange', 7, null, ['#dc630b']])
      expect(parseHouse({ statuses: broken }).statuses).toEqual({});
    // the house's, over a person's own palette too
    const own = parsePersonal({ palette: 'volt' });
    expect(resolveSettings(parseHouse({ statuses: { warning: '#dc630b' } }), own).statuses).toEqual(
      {
        warning: '#dc630b',
      },
    );
  });

  it('reads the lights’ defaults, each broken one as off (1.9: nothing changes on upgrade)', () => {
    expect(parseHouse({}).lightTint).toBe('off');
    expect(parseHouse({}).lightColors).toBe(false);
    const broken = parseHouse({ lightTint: 'bright', lightColors: 'yes' });
    expect([broken.lightTint, broken.lightColors]).toEqual(['off', false]);
    expect(resolveSettings(parseHouse({ lightTint: 'on' }), PERSONAL_DEFAULTS).lightTint).toBe(
      'on',
    );
  });

  it('reads the cards’ surface, each broken field as solid and blurred (1.15: nothing changes on upgrade)', () => {
    // a 1.14 house stored none: every card solid, as before, and the same version (a field with its default)
    const upgraded = parseHouse({ version: 3, palette: 'volt' });
    expect(upgraded.cards).toEqual({ opacity: 100, blur: true, unavailable: 'dashed' });
    expect(HOUSE_DEFAULTS.cards).toEqual({ opacity: 100, blur: true, unavailable: 'dashed' });
    expect(upgraded.version).toBe(3);
    expect(parseCards({ opacity: 80, blur: false })).toEqual({
      opacity: 80,
      blur: false,
      unavailable: 'dashed',
    });
    expect(parseCards({ opacity: 0 }).opacity).toBe(0);
    // off its 5 % steps, out of 0 to 100, or not a number: solid; a blur that is not a switch: on
    for (const opacity of [82, -5, 105, '80', null, Number.NaN])
      expect(parseCards({ opacity, blur: 'no' })).toEqual({
        opacity: 100,
        blur: true,
        unavailable: 'dashed',
      });
    expect(
      resolveSettings(parseHouse({ cards: { opacity: 50 } }), PERSONAL_DEFAULTS).cards,
    ).toEqual({ opacity: 50, blur: true, unavailable: 'dashed' });
  });

  it('reads how a card out of reach looks: dashed until the house says quiet (1.16, #126: nothing changes on upgrade)', () => {
    // a 1.15 house stored its surface without it: dashed, as before, and the same version
    const upgraded = parseHouse({ version: 3, cards: { opacity: 80, blur: true } });
    expect(upgraded.cards.unavailable).toBe('dashed');
    expect(upgraded.version).toBe(3);
    expect(parseCards({ unavailable: 'quiet' }).unavailable).toBe('quiet');
    expect(parseCards({ unavailable: 'dashed' }).unavailable).toBe('dashed');
    // a word it does not know, another case, or not a word: dashed
    for (const unavailable of ['normal', 'Quiet', true, null, 1])
      expect(parseCards({ unavailable }).unavailable).toBe('dashed');
    expect(
      resolveSettings(parseHouse({ cards: { unavailable: 'quiet' } }), PERSONAL_DEFAULTS).cards,
    ).toEqual({ opacity: 100, blur: true, unavailable: 'quiet' });
  });

  it('reads the house’s chart settings: a 1.10 house (version 2, none stored) draws every chart classic, as before', () => {
    // the migration is the parse: a field a 2 never stored is its factory value
    const upgraded = parseHouse({ version: 2, palette: 'volt', statuses: { warning: '#dc630b' } });
    expect(upgraded.charts).toEqual(CHART_DEFAULTS);
    expect(upgraded.chartSets).toEqual([]);
    expect(upgraded.version).toBe(3);
    expect(CHART_DEFAULTS).toMatchObject({
      style: 'classic',
      gauge: 'ticks',
      line: 'regular',
      glow: { offset: 5, opacity: 0.35 },
      fill: 18,
      grid: 'hairline',
      endpoint: 'knob',
      caps: 'both',
      now: 'knob',
      wave: 'mid',
      bubble: 'dark',
      series: 'palette',
      animate: true,
      // 1.18: the last 12 hours where a card names none (24 before), the points as each card draws them calmly
      window: 12,
      points: 'auto',
    });
    expect(resolveSettings(upgraded, PERSONAL_DEFAULTS).charts).toEqual(CHART_DEFAULTS);
  });

  it('reads the chart settings field by field, each unknown word as its default', () => {
    const charts = parseHouse({
      charts: {
        style: 'soft',
        gauge: 'arc',
        line: 'heavy',
        glow: { offset: 7, opacity: 0.3 },
        fill: 24,
        grid: 'dotted',
        endpoint: 'ring-label',
        caps: 'top',
        now: 'line',
        wave: 'high',
        knob: 'flat',
        bubble: 'tone',
        series: 'my set',
        animate: 'no',
      },
    }).charts;
    expect(charts).toEqual({
      ...CHART_DEFAULTS,
      style: 'soft',
      glow: { offset: 7, opacity: 0.35 },
      fill: 24,
      caps: 'top',
      now: 'line',
      wave: 'high',
      bubble: 'tone',
    });
    expect(parseHouse({ charts: 'soft' }).charts).toEqual(CHART_DEFAULTS);
    expect(parseHouse({ charts: { gauge: 'ruler', series: 'set-1' } }).charts).toMatchObject({
      gauge: 'ruler',
      series: 'set-1',
    });
  });

  it('reads how much of the past every chart shows and how far apart its points stand: the windows and steps it offers, else the default (1.18)', () => {
    const read = (charts: unknown) => parseHouse({ charts }).charts;
    expect(read({ window: 48, points: '15m' })).toMatchObject({ window: 48, points: '15m' });
    expect(read({ window: 168, points: '1h' })).toMatchObject({ window: 168, points: '1h' });
    // a window or a step it does not offer is the default: a card's own `hours` is where any other lives
    expect(read({ window: 6, points: '10m' })).toMatchObject({ window: 12, points: 'auto' });
    expect(read({ window: '24', points: 30 })).toMatchObject({ window: 12, points: 'auto' });
  });

  it('keeps the well-formed saved series sets: six colours each, the first of each id, twelve at most', () => {
    const six = ['#1D4ED8', '#b45309', '#15803d', '#b91c1c', '#7e22ce', '#0f766e'];
    const sets = parseHouse({
      chartSets: [
        { id: 'warm', name: ' Warm ', colours: six },
        { id: 'warm', name: 'Again', colours: six },
        { id: 'five', name: 'Five', colours: six.slice(0, 5) },
        { id: 'named', name: '', colours: six },
        ...Array.from({ length: 20 }, (_u, i) => ({ id: `s${i}`, name: `S${i}`, colours: six })),
      ],
    }).chartSets;
    expect(sets[0]).toEqual({ id: 'warm', name: 'Warm', colours: six.map((c) => c.toLowerCase()) });
    expect(sets.map((set) => set.id).slice(0, 3)).toEqual(['warm', 's0', 's1']);
    expect(sets.length).toBe(MAX_SAVED_SERIES);
    expect(parseHouse({ chartSets: 'none' }).chartSets).toEqual([]);
  });

  it('reads a set’s colours as the palette’s by name or hexes of its own, anything else the palette’s in its place (1.11)', () => {
    const [set] = parseHouse({
      chartSets: [
        {
          id: 'mixed',
          name: 'Mixed',
          colours: ['graph-12', 'accent', '#B45309', 'red', 'graph-13', null],
        },
      ],
    }).chartSets;
    // a palette's colour by its name follows the palette; Home Assistant's red, a series past twelve and nothing are
    // the palette's own series colour in that place
    expect(set?.colours).toEqual([
      'graph-12',
      'accent',
      '#b45309',
      'graph-4',
      'graph-5',
      'graph-6',
    ]);
    for (const ref of [
      'accent',
      'graph-1',
      'graph-12',
      'ok',
      'warning',
      'danger',
      'notice',
      'light',
    ])
      expect(isPaletteRef(ref), ref).toBe(true);
    for (const ref of ['solar', 'grid', 'battery', 'water', 'gas', 'home'])
      expect(isPaletteRef(ref), ref).toBe(true);
    for (const word of ['graph-0', 'graph-13', 'house', 'Accent', 'primary', 'red', '#b45309'])
      expect(isPaletteRef(word), word).toBe(false);
  });

  it('reads the wall settings field by field, each broken one as its default', () => {
    expect(parseWall(undefined)).toEqual(WALL_DEFAULTS);
    expect(
      parseWall({
        dashboards: ['fluvy-wall', 7],
        after: 5,
        clock: false,
        dim: true,
        wakeEntity: 'binary_sensor.hall_motion',
        theme: 'hours',
        from: '23:30',
        to: '06:15',
        nightDim: 40,
        background: 'wall',
        exit: 'hold',
        subview: 'header',
      }),
    ).toEqual({
      dashboards: ['fluvy-wall'],
      after: 5,
      clock: false,
      dim: true,
      wakeEntity: 'binary_sensor.hall_motion',
      theme: 'hours',
      from: '23:30',
      to: '06:15',
      nightDim: 40,
      background: 'wall',
      exit: 'hold',
      subview: 'header',
    });
    expect(
      parseWall({
        after: 7,
        wakeEntity: 'light.hall',
        theme: 'night',
        from: '25:00',
        to: '7:00',
        nightDim: 50,
        background: 'photo',
        exit: 'door',
        subview: 'tabs',
      }),
    ).toEqual(WALL_DEFAULTS);
    // a wall saved before the way out could be chosen has the button
    expect(parseWall({ after: 5 }).exit).toBe('button');
  });

  it('keeps the well-formed saved palettes, the first of each name, twelve at most', () => {
    const file = (name: string) => ({
      fluvy_palette: 1,
      name,
      title: name,
      palette: { character: 'soft', base: 'warm', accent: '#4f7a4a' },
    });
    expect(parseSavedPalettes(undefined)).toEqual([]);
    const kept = parseSavedPalettes([file('moss'), { name: 'broken' }, file('moss'), file('plum')]);
    expect(kept.map((entry) => entry.name)).toEqual(['moss', 'plum']);
    const many = parseSavedPalettes(Array.from({ length: 14 }, (_, i) => file(`p${i}`)));
    expect(many).toHaveLength(MAX_SAVED_PALETTES);
  });

  it('accepts a custom palette only whole, and drops what its character does not use', () => {
    expect(
      parsePalette({ character: 'vivid', base: 'cool', accent: '#FF4A1A', fill: 'solid' }),
    ).toEqual({
      character: 'vivid',
      base: 'cool',
      accent: '#ff4a1a',
      fill: 'solid',
    });
    expect(
      parsePalette({
        character: 'soft',
        base: 'warm',
        accent: '#123456',
        fill: 'solid',
        highlight: '#e2ff3d',
      }),
    ).toEqual({ character: 'soft', base: 'warm', accent: '#123456' });
    expect(parsePalette({ character: 'vivid', base: 'cool', accent: 'red' })).toBeUndefined();
    expect(parsePalette({ character: 'loud', base: 'cool', accent: '#ff0000' })).toBeUndefined();
  });
});

describe('resolving the two layers', () => {
  it("takes the house's look unless the person chose their own, as a whole", () => {
    const house = parseHouse({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
      scope: 'everywhere',
    });
    expect(resolveSettings(house, PERSONAL_DEFAULTS).look).toEqual({
      palette: 'volt',
      shape: 'round',
      pills: 'soft',
      tabs: TABS_DEFAULTS,
      chrome: CHROME_DEFAULTS,
    });
    const own = resolveSettings(house, parsePersonal({ palette: 'blaze' }));
    expect(own.look).toEqual({
      palette: 'blaze',
      shape: 'round',
      pills: 'soft',
      tabs: TABS_DEFAULTS,
      chrome: CHROME_DEFAULTS,
    });
    // a person's tabs count only with their own look, as their shape and pills do
    const tabs = { style: 'hidden', content: 'names', title: true } as const;
    expect(resolveSettings(house, parsePersonal({ tabs })).look.tabs).toEqual(TABS_DEFAULTS);
    expect(resolveSettings(house, parsePersonal({ palette: 'blaze', tabs })).look.tabs).toEqual(
      tabs,
    );
    expect(
      resolveSettings(house, parsePersonal({ palette: 'blaze', pills: 'crisp' })).look.pills,
    ).toBe('crisp');
    expect(own.personalLook).toBe(true);
    expect(
      resolveSettings(house, parsePersonal({ palette: 'blaze', shape: 'crisp' })).look.shape,
    ).toBe('crisp');
  });

  it('keeps everywhere only while Home Assistant wears the Fluvy theme', () => {
    expect(pageScope('everywhere', 'Fluvy')).toBe('everywhere');
    // another theme in the profile (Home Assistant's own, or any other): its pages are its, Fluvy's dashboards stay
    expect(pageScope('everywhere', 'default')).toBe('dashboards');
    expect(pageScope('everywhere', 'Minimalist')).toBe('dashboards');
    // before Home Assistant says (the first paint) the setting holds
    expect(pageScope('everywhere', undefined)).toBe('everywhere');
    expect(pageScope('dashboards', 'Fluvy')).toBe('dashboards');
  });

  it('puts the look on the chosen dashboards, or every fluvy one when none is chosen', () => {
    expect(wearsLook({ dashboards: [] }, 'fluvy-home')).toBe(true);
    expect(wearsLook({ dashboards: [] }, 'dashboard-garden')).toBe(false);
    expect(wearsLook({ dashboards: ['dashboard-garden'] }, 'dashboard-garden')).toBe(true);
    expect(wearsLook({ dashboards: ['dashboard-garden'] }, 'fluvy-home')).toBe(false);
    expect(wearsLook({ dashboards: [] }, undefined)).toBe(false);
  });
});

describe('the settings store', () => {
  function fakeHass() {
    const listeners = new Map<string, (message: { value: unknown }) => void>();
    const sent: { type: string; key?: unknown; value?: unknown }[] = [];
    const hass = {
      connection: {
        subscribeMessage: <T>(callback: (message: T) => void, message: { type: string }) => {
          listeners.set(message.type, callback as (message: { value: unknown }) => void);
          return Promise.resolve(() => listeners.delete(message.type));
        },
      },
      callWS: <T>(message: { type: string; key?: unknown; value?: unknown }) => {
        sent.push(message);
        return Promise.resolve(undefined as T);
      },
    } as unknown as SettingsHass;
    return { hass, listeners, sent };
  }

  it('hands over the resolved settings on each answer and change, and caches them', () => {
    const { hass, listeners } = fakeHass();
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    } as Storage;
    const store = new SettingsStore(() => hass, storage);
    const seen: string[] = [];
    store.start((settings) => seen.push(`${String(settings.look.palette)}/${settings.scope}`));
    listeners.get('frontend/subscribe_system_data')?.({
      value: { palette: 'volt', scope: 'everywhere' },
    });
    listeners.get('frontend/subscribe_user_data')?.({ value: null });
    listeners.get('frontend/subscribe_user_data')?.({ value: { palette: 'noir' } });
    expect(seen).toEqual(['volt/everywhere', 'volt/everywhere', 'noir/everywhere']);
    expect(JSON.parse(stored.get('fluvy:settings') ?? '{}').house.palette).toBe('volt');
  });

  it("writes the house's settings whole and parsed, and a person's without the fields they cleared", async () => {
    const { hass, listeners, sent } = fakeHass();
    const store = new SettingsStore(() => hass, undefined);
    store.start(() => undefined);
    await store.saveHouse({ palette: 'blaze', shape: 'round' });
    expect(sent[0]).toEqual({
      type: 'frontend/set_system_data',
      key: 'fluvy',
      value: { ...HOUSE_DEFAULTS, palette: 'blaze', shape: 'round' },
    });
    listeners.get('frontend/subscribe_user_data')?.({ value: { palette: 'volt', language: 'es' } });
    await store.savePersonal({ palette: undefined });
    expect(sent[1]).toEqual({
      type: 'frontend/set_user_data',
      key: 'fluvy',
      value: { ...PERSONAL_DEFAULTS, language: 'es' },
    });
  });

  it('keeps a field of a newer version through a save, and parses what it knows', async () => {
    const { hass, listeners, sent } = fakeHass();
    const store = new SettingsStore(() => hass, undefined);
    store.start(() => undefined);
    listeners.get('frontend/subscribe_system_data')?.({
      value: { version: 3, palette: 'volt', rooms: { order: ['kitchen'] }, wall: { after: 5 } },
    });
    await store.saveHouse({ shape: 'round' });
    expect(sent[0]?.value).toEqual({
      ...HOUSE_DEFAULTS,
      palette: 'volt',
      shape: 'round',
      wall: { ...WALL_DEFAULTS, after: 5 },
      rooms: { order: ['kitchen'] },
    });
  });
});
