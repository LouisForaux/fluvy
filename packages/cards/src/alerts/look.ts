import {
  areaOf,
  formatNumber,
  localize,
  plural,
  registryText,
  resolveEntity,
  stateText,
  type HomeAssistant,
} from '@fluvy/core';
import { durationShort } from '../helpers/datetime.js';
import { iconOf } from '../shared/domain.js';
import { nameOf, type AlertResult, type AlertRow } from './engine.js';
import type { NameBy } from './model.js';
import type { RepairsStore } from './repairs.js';

/*
 * What an alert says, the same on the card and in its sheet: its name and glyph, who is at fault (its culprits, by
 * device when it counts devices, rows of one name told apart or counted), how long or how much (a battery's 12 %, a
 * door's 6 min), and its rows grouped as it counts them.
 */

/** What a card and its sheet read an alert's words from besides `hass`: the repairs' titles, the clock. */
export interface LookContext {
  readonly hass: HomeAssistant | undefined;
  readonly repairs?: RepairsStore | undefined;
  readonly now: number;
}

/** An alert's name: the person's, a split alert's entity's own, else its preset's title. */
export function alertName({ hass }: LookContext, result: AlertResult): string {
  const { definition } = result;
  if (definition.name) return definition.name;
  if (result.entity) return nameOf(hass as HomeAssistant, result.entity);
  return definition.title ? localize(hass, definition.title) : definition.key;
}

/** An alert's glyph: the person's, a split alert's entity's own icon, else its preset's. */
export function alertIcon({ hass }: LookContext, result: AlertResult): string {
  const own = result.definition.config.icon;
  const entity = result.entity ? hass?.states[result.entity]?.attributes['icon'] : undefined;
  return own ?? (typeof entity === 'string' ? entity : result.definition.icon);
}

/** One of an alert's rows as a sheet lists it: an entity, a device and its entities, or a source's item. */
export interface RowGroup {
  /** The row's own id (an entity's, a repair's) or its device's. */
  readonly id: string;
  readonly device: string | undefined;
  readonly rows: readonly AlertRow[];
  /** The row standing for the group: its first in the alert's order (the lowest battery, the longest open). */
  readonly lead: AlertRow;
}

/** The rows as the alert counts them: a row each, or one per device (its entities under it), in the alert's order. */
export function groupsOf(result: AlertResult): RowGroup[] {
  if (result.definition.countBy !== 'device')
    return result.rows.map((row) => ({ id: row.id, device: row.device, rows: [row], lead: row }));
  const groups = new Map<string, AlertRow[]>();
  for (const row of result.rows) {
    const key = row.device ?? row.id;
    const rows = groups.get(key);
    if (rows) rows.push(row);
    else groups.set(key, [row]);
  }
  return [...groups].map(([id, rows]) => ({
    id,
    device: rows[0]?.device,
    rows,
    lead: rows[0] as AlertRow,
  }));
}

/** What names a row: its device when the alert counts devices, else the alert's `name_by`. */
const namedBy = ({ definition }: AlertResult, group: RowGroup): NameBy =>
  definition.countBy === 'device' && group.device ? 'device' : definition.nameBy;

/** A row's name: a repair's title, a device's when the alert counts devices, else by the alert's `name_by`. */
export function rowName(
  { hass, repairs }: LookContext,
  result: AlertResult,
  group: RowGroup,
): string {
  if (result.definition.source === 'repairs') return repairs?.item(group.id)?.title ?? group.id;
  return nameOf(hass as HomeAssistant, group.lead.id, namedBy(result, group));
}

/** One of who is at fault: a name, and how many of the alert's rows (or devices) go by it. */
export interface Culprit {
  readonly name: string;
  readonly n: number;
}

/**
 * Who is at fault, in the alert's order. Rows that share a name are named by what tells them apart: their areas, else
 * (each named by its entity) their devices; an alert named by area keeps the person's areas, a repair its title. Those
 * that still share a name are one culprit, counted ("Window ×4").
 */
export function culprits(context: LookContext, result: AlertResult): Culprit[] {
  const named = groupsOf(result).map((group) => [group, rowName(context, result, group)] as const);
  const sharing = new Map<string, RowGroup[]>();
  for (const [group, name] of named) {
    const same = sharing.get(name);
    if (same) same.push(group);
    else sharing.set(name, [group]);
  }
  // what tells apart the rows of a name: the first of their areas and devices that differs between them
  const tellers = new Map<string, (group: RowGroup) => string>();
  for (const [name, same] of sharing) {
    const by = namedBy(result, same[0] as RowGroup);
    if (same.length < 2 || by === 'area' || result.definition.source === 'repairs') continue;
    const area = (group: RowGroup): string => rowArea(context, group.lead) || name;
    const device = (group: RowGroup): string =>
      nameOf(context.hass as HomeAssistant, group.lead.id, 'device');
    const teller = (by === 'entity' ? [area, device] : [area]).find(
      (of) => new Set(same.map(of)).size > 1,
    );
    if (teller) tellers.set(name, teller);
  }
  // each name said once, in the order of its first row, with how many go by it
  const counts = new Map<string, number>();
  for (const [group, name] of named) {
    const told = tellers.get(name)?.(group) ?? name;
    counts.set(told, (counts.get(told) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => ({ name, n }));
}

/** A culprit as a line says it: its name, and how many go by it where more than one does ("Window ×4"). */
export const culpritText = ({ hass }: LookContext, { name, n }: Culprit): string =>
  n > 1 ? localize(hass, 'alerts.shared', { name, n: formatNumber(hass, n, { digits: 0 }) }) : name;

/**
 * The most culprits a line of `room` pixels can name, joined with ", ": where the names, measured one by one, already
 * overflow it. A line looks for the longest run of names that fits from there down, each join laid out to be measured;
 * from all of them down, a house's hundred low batteries laid out a hundred ever longer lines (100 ms) to name two.
 * Each name is allowed 2 px of rounding and kerning against its join, so no run that fits is passed over.
 */
export function mostNames(
  names: readonly string[],
  room: number,
  width: (text: string) => number,
): number {
  const slack = 2;
  let used = 0;
  for (let k = 0; k < names.length; k++) {
    used += width(names[k] as string) - slack + (k ? width(', ') - slack : 0);
    if (used > room) return k + 1;
  }
  return names.length;
}

/**
 * How long a row has matched, or an alert since its oldest match ("6 min"); nothing in its first minute — a leak a
 * moment old is not "1 min", and the name says it alone until it is.
 */
export const lasted = ({ hass, now }: LookContext, since: number): string =>
  now - since < 60_000 ? '' : durationShort(hass, new Date(since), new Date(now));

/** What a row is now: its state in Home Assistant's words ("12 %", "Open", "Unavailable"); a repair's severity. */
export function rowState({ hass }: LookContext, row: AlertRow): string {
  if (row.state) return stateText(hass, resolveEntity(hass, row.id));
  return row.severity ? localize(hass, `alerts.severity.${row.severity}`) : '';
}

/** A row's detail on a card: a number's state (a battery's 12 %), else how long it has matched. */
export const rowDetail = (context: LookContext, row: AlertRow): string =>
  row.value !== undefined && row.state ? rowState(context, row) : lasted(context, row.since);

/** A row's glyph: its entity's (a door as it stands, a battery), else the alert's. */
export function rowGlyph(context: LookContext, result: AlertResult, row: AlertRow): string {
  return row.state ? iconOf(resolveEntity(context.hass, row.id)) : alertIcon(context, result);
}

/** Where a row is: its area's name. */
export function rowArea({ hass }: LookContext, row: AlertRow): string {
  const area = row.state ? areaOf(hass, row.id) : undefined;
  return (area && registryText(hass?.areas?.[area]?.name)) || '';
}

/** "3 devices" / "1 entity" / "2 repairs": what an alert counts. */
export const countWords = ({ hass }: LookContext, result: AlertResult): string =>
  plural(
    hass,
    result.definition.source === 'repairs'
      ? 'alerts.repairs'
      : result.definition.countBy === 'device'
        ? 'alerts.devices'
        : 'alerts.entities',
    result.count,
  );
