import type { HomeAssistant } from '@fluvy/core';
import type { MockHouse } from './hass.js';

/**
 * The mock's WebSocket: one table of answers by message type. Home Assistant's own reads have answers drawn from the
 * house (`houseWs`): history, statistics, what an item relates to, the repairs, a person's and the house's stored data.
 * A sheet adds its own (`SheetSpec.ws`); joined with `mergeWs`, the sheets' answers come first and an answer of
 * `undefined` passes the message on to the next table. Each is handed the house it answers for (a sheet asking
 * another sheet's table itself may hand none).
 */
export type Answer = (message: Record<string, unknown>, house?: MockHouse) => unknown;
export type WsTable = Readonly<Record<string, Answer>>;

type Rows = Record<string, unknown[]>;

/** Answers keyed by id (statistics, history): the first table with rows for an id answers it. */
const byId = (replies: readonly unknown[]): Rows => {
  const out: Rows = {};
  for (const reply of replies)
    for (const [id, rows] of Object.entries((reply ?? {}) as Rows))
      if (!out[id]?.length) out[id] = rows;
  return out;
};

/** What an item relates to, from every table: each kind's ids joined. */
const union = (replies: readonly unknown[]): Rows => {
  const out: Record<string, Set<unknown>> = {};
  for (const reply of replies)
    for (const [kind, ids] of Object.entries((reply ?? {}) as Rows))
      for (const id of ids) (out[kind] ??= new Set()).add(id);
  return Object.fromEntries(Object.entries(out).map(([kind, ids]) => [kind, [...ids]]));
};

/** How several tables' answers to one message become one; any other message takes the first answer given. */
const JOIN: Readonly<Record<string, (replies: readonly unknown[]) => unknown>> = {
  'recorder/statistics_during_period': byId,
  'history/history_during_period': byId,
  'search/related': union,
};

/**
 * Several tables as one, the first first. A message more than one table answers is asked of each: statistics and
 * history are joined id by id, what an item relates to kind by kind, and anything else is the first answer that is
 * not `undefined` (or `null`).
 */
export function mergeWs(tables: ReadonlyArray<WsTable | undefined>): Record<string, Answer> {
  const types = new Set(tables.flatMap((table) => Object.keys(table ?? {})));
  return Object.fromEntries(
    [...types].map((type) => {
      const handlers = tables.flatMap((table) => (table?.[type] ? [table[type]] : []));
      if (handlers.length === 1) return [type, handlers[0] as Answer];
      const merged: Answer = async (message, house) => {
        const replies = await Promise.all(handlers.map((handler) => handler(message, house)));
        const join = JOIN[type];
        return join
          ? join(replies)
          : replies.find((reply) => reply !== undefined && reply !== null);
      };
      return [type, merged];
    }),
  );
}

/**
 * A long-term statistic as the recorder keeps it: a row an hour, the newest the hour that ended last on the page's
 * clock. A measurement keeps each hour's mean (its min and max with it); a counter its reading at the hour's end
 * (`state`, and `sum`, which here never resets), so `change` is what it gained.
 */
export interface StatisticSeed {
  readonly kind: 'measurement' | 'counter';
  /** One value an hour, oldest first: a measurement's mean, a counter's reading at the hour's end. */
  readonly hourly: readonly number[];
  /** What the recorder says of a statistic an integration imports, which has no entity to read them from. */
  readonly unit?: string;
  readonly name?: string;
}

/** A repair Home Assistant lists (`repairs/list_issues`), as its frontend reads it. */
export interface RepairIssue {
  readonly domain: string;
  readonly issue_id: string;
  readonly severity: 'critical' | 'error' | 'warning';
  readonly translation_key?: string;
  readonly translation_placeholders?: Record<string, string> | null;
  readonly is_fixable?: boolean;
  readonly ignored?: boolean;
  readonly dismissed_version?: string | null;
  readonly created?: string;
  readonly learn_more_url?: string | null;
}

/** What the house's answers read: the house as the cards see it and what it keeps. */
export interface House {
  readonly hass: () => HomeAssistant;
  /** entity id → its states over any window asked, spread evenly from its start to its end. */
  readonly history: Readonly<Record<string, readonly number[]>>;
  /** statistic id → what the recorder keeps for it. */
  readonly statistics: Readonly<Record<string, StatisticSeed>>;
  /** The repairs listed, as they are now (a test may change them and fire `repairs_issue_registry_updated`). */
  readonly issues: () => readonly RepairIssue[];
  /** The stored data, a person's (`user`) and the house's (`system`): its `frontend/*_data` messages. */
  readonly data: StoredData;
}

const HOUR = 3_600_000;

interface Row {
  readonly start: number;
  readonly end: number;
  readonly value: number;
  /** A counter's gain over the row (its reading less the one before). */
  readonly change: number;
}

/** A seed's rows, the newest ending at the last full hour. */
const hourlyRows = (seed: StatisticSeed): Row[] => {
  const last = Math.floor(Date.now() / HOUR) * HOUR;
  const count = seed.hourly.length;
  return seed.hourly.map((value, i) => ({
    start: last - (count - i) * HOUR,
    end: last - (count - i - 1) * HOUR,
    value,
    change: i ? value - (seed.hourly[i - 1] ?? value) : 0,
  }));
};

/** Where a period that holds `t` starts, on the page's own calendar (Home Assistant's weeks start on Monday). */
const periodStart = (t: number, period: string): number => {
  const d = new Date(t);
  switch (period) {
    case '5minute':
      return Math.floor(t / 300_000) * 300_000;
    case 'hour':
      return Math.floor(t / HOUR) * HOUR;
    case 'day':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    case 'week':
      return new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate() - ((d.getDay() + 6) % 7),
      ).getTime();
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    default:
      return new Date(d.getFullYear(), 0, 1).getTime();
  }
};

/** The start of the period after the one starting at `start`. */
const periodEnd = (start: number, period: string): number => {
  const d = new Date(start);
  switch (period) {
    case '5minute':
      return start + 300_000;
    case 'hour':
      return start + HOUR;
    case 'day':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    case 'week':
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7).getTime();
    case 'month':
      return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    default:
      return new Date(d.getFullYear() + 1, 0, 1).getTime();
  }
};

/** Five-minute rows from hourly ones: a measurement's mean held, a counter's reading drawn evenly through the hour. */
const fiveMinuteRows = (rows: readonly Row[]): Row[] =>
  rows.flatMap((row) =>
    Array.from({ length: 12 }, (_, k) => ({
      start: row.start + k * 300_000,
      end: row.start + (k + 1) * 300_000,
      value: row.value - row.change + (row.change * (k + 1)) / 12,
      change: row.change / 12,
    })),
  );

/** One statistic's rows over a window, by period: what `recorder/statistics_during_period` sends for it. */
const statisticRows = (
  seed: StatisticSeed,
  from: number,
  to: number,
  period: string,
  types: readonly string[] | undefined,
): Record<string, number>[] => {
  const hourly = hourlyRows(seed);
  const rows = (period === '5minute' ? fiveMinuteRows(hourly) : hourly).filter(
    (row) => row.start >= from && row.start < to,
  );
  const buckets = new Map<number, Row[]>();
  for (const row of rows) {
    const start = periodStart(row.start, period);
    buckets.set(start, [...(buckets.get(start) ?? []), row]);
  }
  const wanted = (type: string): boolean => !types || types.includes(type);
  return [...buckets].map(([start, members]) => {
    const values = members.map((row) => row.value);
    const lastValue = values[values.length - 1] ?? 0;
    const out: Record<string, number> = { start, end: periodEnd(start, period) };
    if (seed.kind === 'measurement') {
      if (wanted('mean')) out['mean'] = values.reduce((sum, v) => sum + v, 0) / values.length;
      if (wanted('min')) out['min'] = Math.min(...values);
      if (wanted('max')) out['max'] = Math.max(...values);
    } else {
      if (wanted('state')) out['state'] = lastValue;
      if (wanted('sum')) out['sum'] = lastValue;
      if (wanted('change')) out['change'] = members.reduce((sum, row) => sum + row.change, 0);
    }
    return out;
  });
};

/** A duration as Home Assistant's `rolling_window` writes it, in ms. */
const duration = (value: unknown): number => {
  const d = (value ?? {}) as Record<string, number | undefined>;
  return (
    (d['days'] ?? 0) * 86_400_000 +
    (d['hours'] ?? 0) * HOUR +
    (d['minutes'] ?? 0) * 60_000 +
    (d['seconds'] ?? 0) * 1000
  );
};

/** The window a `recorder/statistic_during_period` asks about: a fixed period, a calendar one, a rolling one, or all. */
const windowOf = (message: Record<string, unknown>): [number, number] => {
  const now = Date.now();
  const fixed = message['fixed_period'] as { start_time?: string; end_time?: string } | undefined;
  if (fixed)
    return [
      fixed.start_time ? new Date(fixed.start_time).getTime() : -Infinity,
      fixed.end_time ? new Date(fixed.end_time).getTime() : now,
    ];
  const calendar = message['calendar'] as { period: string; offset?: number } | undefined;
  if (calendar) {
    let start = periodStart(now, calendar.period);
    for (let k = 0; k > (calendar.offset ?? 0); k -= 1)
      start = periodStart(start - 1, calendar.period);
    for (let k = 0; k < (calendar.offset ?? 0); k += 1) start = periodEnd(start, calendar.period);
    return [start, Math.min(periodEnd(start, calendar.period), now)];
  }
  const rolling = message['rolling_window'] as { duration?: unknown; offset?: unknown } | undefined;
  if (rolling) {
    const end = now + duration(rolling.offset);
    return [end - duration(rolling.duration), end];
  }
  return [-Infinity, now];
};

/** One statistic over a window, as `recorder/statistic_during_period` sends it: the asked types it has. */
const statisticOver = (
  seed: StatisticSeed,
  [from, to]: [number, number],
  types: readonly string[] | undefined,
): Record<string, number> => {
  const rows = fiveMinuteRows(hourlyRows(seed)).filter((row) => row.start >= from && row.end <= to);
  if (!rows.length) return {};
  const wanted = (type: string): boolean => !types || types.includes(type);
  const values = rows.map((row) => row.value);
  const out: Record<string, number> = {};
  if (seed.kind === 'measurement') {
    if (wanted('mean')) out['mean'] = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (wanted('min')) out['min'] = Math.min(...values);
    if (wanted('max')) out['max'] = Math.max(...values);
  } else if (wanted('change')) out['change'] = rows.reduce((sum, row) => sum + row.change, 0);
  return out;
};

/** What an item relates to in the registries: its device, area and integration, or what an area or device holds. */
const related = (hass: HomeAssistant, type: unknown, id: unknown): Record<string, string[]> => {
  const entries = Object.values(hass.entities);
  const out: Record<string, string[]> = {};
  const put = (kind: string, value: string | null | undefined): void => {
    if (value && !out[kind]?.includes(value)) (out[kind] ??= []).push(value);
  };
  if (type === 'entity') {
    const entry = hass.entities[String(id)];
    put('device', entry?.device_id);
    put('area', entry?.area_id ?? hass.devices[entry?.device_id ?? '']?.area_id);
    put('integration', entry?.platform);
  } else if (type === 'device') {
    put('area', hass.devices[String(id)]?.area_id);
    for (const entry of entries) if (entry.device_id === id) put('entity', entry.entity_id);
  } else if (type === 'area') {
    for (const device of Object.values(hass.devices))
      if (device.area_id === id) put('device', device.id);
    for (const entry of entries)
      if ((entry.area_id ?? hass.devices[entry.device_id ?? '']?.area_id) === id)
        put('entity', entry.entity_id);
  }
  return out;
};

/** Stored data by layer and key, with who listens to each key (`frontend/subscribe_*_data`). */
export interface StoredData {
  get(layer: Layer, key: string): unknown;
  set(layer: Layer, key: string, value: unknown): void;
  listen(layer: Layer, key: string, callback: (message: { value: unknown }) => void): () => void;
}
export type Layer = 'user' | 'system';

/** The person's and the house's stored data, seeded from the sheets; a write tells whoever listens to that key. */
export function storedData(seed: Partial<Record<Layer, Record<string, unknown>>> = {}): StoredData {
  const values: Record<Layer, Map<string, unknown>> = {
    user: new Map(Object.entries(seed.user ?? {})),
    system: new Map(Object.entries(seed.system ?? {})),
  };
  const listeners = new Map<string, Set<(message: { value: unknown }) => void>>();
  return {
    get: (layer, key) => values[layer].get(key) ?? null,
    set: (layer, key, value) => {
      values[layer].set(key, value);
      for (const callback of listeners.get(`${layer}|${key}`) ?? []) callback({ value });
    },
    listen: (layer, key, callback) => {
      const id = `${layer}|${key}`;
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id)?.add(callback);
      return () => listeners.get(id)?.delete(callback);
    },
  };
}

/** The layer a `frontend/*_data` message speaks to. */
export const layerOf = (type: string): Layer => (type.includes('system') ? 'system' : 'user');

/** What Home Assistant answers an admin only: a guest who asks is refused before the table is (`callWS`). */
export const ADMIN_ONLY: ReadonlySet<string> = new Set(['frontend/set_system_data']);

/** Home Assistant's own reads, answered from the house. */
export function houseWs(house: House): WsTable {
  const ids = (message: Record<string, unknown>, key: string): string[] =>
    ([] as string[]).concat((message[key] as string | string[] | undefined) ?? []);
  const time = (value: unknown, fallback: number): number =>
    value === undefined ? fallback : new Date(String(value)).getTime();
  const read = (message: Record<string, unknown>): unknown => ({
    value: house.data.get(layerOf(message['type'] as string), String(message['key'])),
  });
  const write = (message: Record<string, unknown>): null => {
    house.data.set(layerOf(message['type'] as string), String(message['key']), message['value']);
    return null;
  };
  return {
    // every id asked: its series spread over the window (an id with none has none)
    'history/history_during_period': (message) => {
      const start = time(message['start_time'], Date.now());
      const end = time(message['end_time'], Date.now());
      return Object.fromEntries(
        ids(message, 'entity_ids').map((id) => {
          const series = house.history[id] ?? [];
          return [
            id,
            series.map((v, i) => ({
              s: String(v),
              lu: (start + (i / Math.max(1, series.length - 1)) * (end - start)) / 1000,
            })),
          ];
        }),
      );
    },
    'recorder/statistics_during_period': (message) => {
      const from = time(message['start_time'], -Infinity);
      const to = time(message['end_time'], Date.now());
      const period = String(message['period'] ?? 'hour');
      const types = message['types'] as readonly string[] | undefined;
      return Object.fromEntries(
        ids(message, 'statistic_ids').flatMap((id) => {
          const seed = house.statistics[id];
          const rows = seed ? statisticRows(seed, from, to, period, types) : [];
          return rows.length ? [[id, rows]] : [];
        }),
      );
    },
    'recorder/statistic_during_period': (message) => {
      const seed = house.statistics[String(message['statistic_id'])];
      return seed
        ? statisticOver(seed, windowOf(message), message['types'] as readonly string[] | undefined)
        : {};
    },
    // what the recorder keeps of each id asked, read from the house as it is (a twin's entity taken out of reach is
    // still the house's): a meter's sum or a measurement's mean, in its unit; an id it keeps nothing of is left out
    'recorder/get_statistics_metadata': (message) => {
      const states = house.hass().states;
      return ids(message, 'statistic_ids').flatMap((id) => {
        const attributes = states[id]?.attributes ?? {};
        const stateClass = attributes['state_class'];
        const kind =
          house.statistics[id]?.kind ??
          (stateClass === 'measurement'
            ? 'measurement'
            : stateClass === 'total' || stateClass === 'total_increasing'
              ? 'counter'
              : undefined);
        if (!kind) return [];
        const seed = house.statistics[id];
        const unit =
          (attributes['unit_of_measurement'] as string | undefined) ?? seed?.unit ?? null;
        return [
          {
            statistic_id: id,
            source: 'recorder',
            has_sum: kind === 'counter',
            mean_type: kind === 'measurement' ? 1 : 0,
            statistics_unit_of_measurement: unit,
            display_unit_of_measurement: unit,
            ...(seed?.name ? { name: seed.name } : {}),
          },
        ];
      });
    },
    'search/related': (message) => related(house.hass(), message['item_type'], message['item_id']),
    'repairs/list_issues': () => ({ issues: house.issues() }),
    'frontend/get_user_data': read,
    'frontend/get_system_data': read,
    'frontend/set_user_data': write,
    'frontend/set_system_data': write,
  };
}
