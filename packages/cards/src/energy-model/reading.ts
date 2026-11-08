import type { EntityView } from '@fluvy/core';
import { watts } from '../energy/power.js';
import type { PowerMeasure } from './prefs.js';

/**
 * A node's live power in both directions, in watts, from the house's point of view: `in` flows toward the house
 * (import, production, discharge), `out` away from it (export, charge). Both can be non-zero at once — a grid read
 * per phase or with two sensors — and that is the point: a net figure hides one of them.
 *
 * `null` = configured but not readable (a dead sensor, a unit that is not power): a sum that quietly skipped a dead
 * phase would be a wrong number, and a wrong number is worse than "—". With two sensors, a dead one blanks only its
 * own direction.
 */
export interface Directed {
  readonly in: number | null;
  readonly out: number | null;
}

export function readMeasure(measure: PowerMeasure, entity: (id: string) => EntityView): Directed {
  let into: number | null = 0;
  let out: number | null = 0;
  for (const id of measure.power ?? []) {
    const w = watts(entity(id));
    if (w === null) {
      into = null;
      out = null;
      break;
    }
    const signed = measure.invert ? -w : w;
    if (signed > 0) into += signed;
    else out -= signed;
  }
  if (measure.import) {
    const w = watts(entity(measure.import));
    into = w === null || into === null ? null : into + Math.max(0, w);
  }
  if (measure.export) {
    const w = watts(entity(measure.export));
    out = w === null || out === null ? null : out + Math.max(0, w);
  }
  return { in: into, out };
}

/** The net (in − out), or null. */
export const net = (d: Directed): number | null =>
  d.in === null || d.out === null ? null : d.in - d.out;

/**
 * What several sources of a kind read together (two arrays, two batteries): those that can be read, added — one asleep
 * or away counts as nothing, never as the kind's zero — and unknown only when none of them can be read.
 */
export const together = (values: readonly (number | null)[]): number | null =>
  values.length && values.every((v) => v === null)
    ? null
    : values.reduce<number>((sum, v) => sum + (v ?? 0), 0);
