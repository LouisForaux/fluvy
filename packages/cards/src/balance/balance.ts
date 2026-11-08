import type { SourceKind } from '../energy-model/prefs.js';
import { together, type Directed } from '../energy-model/reading.js';

/**
 * The energy balance's arithmetic: what comes in against what goes out. Coming in: what each kind of source gives the
 * house (the sun, the grid's import, a battery or a car discharging, a generator). Going out: what charges a battery or
 * a car, what is exported, and the house — the remainder, so the two totals agree by construction. Nothing is
 * estimated: a figure that cannot be read is `null`, and every figure that depends on it (a total, the house) too —
 * but one of several sources of a kind (two arrays) counts as nothing while another of its kind reads (`together`).
 */

/** One source as the balance reads it: toward the house and away from it (W live, Wh over a period). */
export interface Flow {
  readonly kind: SourceKind;
  readonly reading: Directed;
  readonly name?: string | undefined;
  readonly color?: string | undefined;
}

export type ItemKind = SourceKind | 'house';

export interface Item {
  readonly kind: ItemKind;
  readonly value: number | null;
  /** The source's own name and colour, when it is the only one of its kind. */
  readonly name?: string;
  readonly color?: string;
}

export interface Balance {
  readonly coming: readonly Item[];
  readonly going: readonly Item[];
  readonly inTotal: number | null;
  readonly outTotal: number | null;
  /** What the house used: everything that came in less what charged, what was exported. */
  readonly house: number | null;
}

/** The order of the legends: sources as the flow lists them; the house first among where it goes. */
const COMING: readonly SourceKind[] = ['solar', 'grid', 'battery', 'generator', 'vehicle'];
const GOING: readonly SourceKind[] = ['battery', 'vehicle', 'grid'];

/** A sum that is unknown as soon as one of its parts is. */
export const sumOf = (values: readonly (number | null)[]): number | null =>
  values.reduce<number | null>((acc, v) => (acc === null || v === null ? null : acc + v), 0);

export function balanceOf(flows: readonly Flow[]): Balance {
  const of = (kind: SourceKind): Flow[] => flows.filter((f) => f.kind === kind);
  const own = (list: readonly Flow[]): Pick<Item, 'name' | 'color'> => {
    const only = list.length === 1 ? list[0] : undefined;
    return {
      ...(only?.name ? { name: only.name } : {}),
      ...(only?.color ? { color: only.color } : {}),
    };
  };
  const item = (kind: SourceKind, way: 'in' | 'out'): Item => ({
    kind,
    value: together(of(kind).map((f) => f.reading[way])),
    ...own(of(kind)),
  });

  const incoming = COMING.filter((k) => of(k).length).map((k) => item(k, 'in'));
  const outgoing = GOING.filter((k) => of(k).length).map((k) => item(k, 'out'));
  const inTotal = sumOf(incoming.map((i) => i.value));
  const outs = sumOf(outgoing.map((i) => i.value));
  // the house cannot give energy back: sensors that disagree by a few watts leave it at 0, and the totals show why
  const house = inTotal === null || outs === null ? null : Math.max(0, inTotal - outs);
  const outTotal = house === null || outs === null ? null : house + outs;

  // a legend lists what flows (or cannot be read: an unreadable source says so); when nothing comes in, every source
  const shown = (i: Item): boolean => i.value === null || i.value > 0;
  const listed = incoming.filter(shown);
  const coming = listed.length ? listed : incoming;
  // a two-way source that cannot be read at all is listed once, among what comes in: its way is not known, and two
  // "—" for it would grow the card by a row while it is away (the owner's rule, 1.9)
  const twice = (i: Item): boolean =>
    i.value === null && coming.some((c) => c.kind === i.kind && c.value === null);
  return {
    coming,
    going: [{ kind: 'house', value: house }, ...outgoing.filter((i) => shown(i) && !twice(i))],
    inTotal,
    outTotal,
    house,
  };
}

/** A direction below its threshold rests: it reads 0 (an unreadable one stays unknown). */
export const rested = (reading: Directed, threshold: number): Directed => ({
  in: reading.in === null ? null : reading.in < threshold ? 0 : reading.in,
  out: reading.out === null ? null : reading.out < threshold ? 0 : reading.out,
});

/**
 * How many columns a legend of `count` items takes in `width`: as many as fit the widest item whole — its swatch
 * and name, its figure — every row full but the last (4 → 2 × 2, 5 → 3 + 2), one column at the least.
 */
export function legendColumns(count: number, widest: number, width: number): number {
  const candidates = count <= 3 ? [3, 2, 1] : count === 4 ? [4, 2, 1] : [3, 2, 1];
  for (const n of candidates) if (n <= count && widest <= width / n) return n;
  return 1;
}

/** Items in rows of `columns`, the last row shorter. */
export const rowsOf = <T>(items: readonly T[], columns: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / Math.max(1, columns)) }, (_, r) =>
    items.slice(r * columns, (r + 1) * columns),
  );
