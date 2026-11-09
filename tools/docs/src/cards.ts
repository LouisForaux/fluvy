/**
 * The cards' tables in `docs/cards.md`, generated from the code so the docs cannot drift: for every card of the
 * catalogue its name, type, description and the options its editor shows (the card's own keys with a select's
 * values, its lists with their item keys) and the older names it still reads. The prose around the tables is
 * written by hand and kept; the tables live between `<!-- generated:cards -->` and `<!-- /generated:cards -->`.
 *
 *   pnpm docs:cards            writes docs/cards.md
 *   pnpm --filter @fluvy/docs check   fails when the file is not what the code says (what `pnpm check` runs)
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

GlobalRegistrator.register();

const CATALOGUE = await (await import('@fluvy/cards')).catalogue();

type Schema = readonly {
  name: string;
  selector?: Record<string, unknown>;
  type?: string;
  schema?: Schema;
}[];
/** What a card's editor shows (its class's, or the module a card every page carries keeps it in). */
interface Editor {
  keys: readonly string[];
  lists?: readonly { key: string; alias?: string; schema: Schema }[];
  getConfigForm(): { schema: Schema };
}
interface Contract {
  aliases?: { keys?: readonly { from: string; to: string }[]; drop?: readonly string[] };
  editor(): Promise<Editor>;
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FILE = join(root, 'docs', 'cards.md');
const OPEN = '<!-- generated:cards -->';
const CLOSE = '<!-- /generated:cards -->';

/** The sections of the page, each the tags it holds in order. */
const SECTIONS: ReadonlyArray<readonly [title: string, tags: readonly string[]]> = [
  [
    'Everyday',
    [
      'fluvy-tile-card',
      'fluvy-tiles-card',
      'fluvy-template-card',
      'fluvy-light-card',
      'fluvy-slider-card',
      'fluvy-lights-card',
      'fluvy-thermostat-card',
      'fluvy-entities-card',
      'fluvy-items-card',
      'fluvy-media-card',
      'fluvy-now-playing-card',
      'fluvy-remote-card',
      'fluvy-cover-card',
      'fluvy-fan-card',
      'fluvy-vacuum-card',
      'fluvy-lock-card',
      'fluvy-alarm-card',
      'fluvy-camera-card',
      'fluvy-cameras-card',
      'fluvy-printer-card',
      'fluvy-appliance-card',
      'fluvy-appliances-card',
      'fluvy-vehicle-card',
      'fluvy-weather-card',
      'fluvy-sensor-card',
      'fluvy-readouts-card',
      'fluvy-people-card',
      'fluvy-openings-card',
      'fluvy-alerts-card',
    ],
  ],
  ['Rooms and the map', ['fluvy-room-card', 'fluvy-map-card']],
  [
    'Structure and navigation',
    ['fluvy-hello-card', 'fluvy-chips-card', 'fluvy-heading-card', 'fluvy-web-card'],
  ],
  [
    'Scenes, actions and helpers',
    [
      'fluvy-scene-card',
      'fluvy-scenes-card',
      'fluvy-actions-card',
      'fluvy-helpers-card',
      'fluvy-todo-card',
      'fluvy-timer-card',
      'fluvy-updates-card',
      'fluvy-automations-card',
    ],
  ],
  [
    'Energy',
    [
      'fluvy-energy-period-card',
      'fluvy-energy-usage-card',
      'fluvy-energy-card',
      'fluvy-energy-flow-card',
      'fluvy-energy-balance-card',
      'fluvy-grid-card',
      'fluvy-batteries-card',
      'fluvy-ev-charger-card',
      'fluvy-energy-sankey-card',
      'fluvy-energy-score-card',
      'fluvy-energy-devices-card',
      'fluvy-meters-card',
      'fluvy-gauge-card',
      'fluvy-stat-tiles-card',
      'fluvy-production-card',
      'fluvy-history-bars-card',
      'fluvy-chart-card',
      'fluvy-bars-card',
      'fluvy-distribution-card',
      'fluvy-humidity-card',
    ],
  ],
  ['Time', ['fluvy-clock-card', 'fluvy-calendar-card']],
];

type Field = { name: string; selector?: Record<string, unknown> };

/** Every field of a form, through its rows and its folded groups. */
const flatten = (schema: Schema): Field[] =>
  schema.flatMap((item) => (item.schema ? flatten(item.schema) : [item]));

/** A select's values, in its order. */
const valuesOf = (field: Field): string[] =>
  (
    field.selector?.['select'] as { options?: readonly { value: string }[] } | undefined
  )?.options?.map((o) => o.value) ?? [];

/**
 * A key as the table names it: the key, with a select's values after it. A key the form shows in turns (one select for
 * a sensor alone, another beside others) is said once, with every value any of its selects offers.
 */
function option(field: Field, fields: readonly Field[]): string {
  const values = [...new Set(fields.filter((f) => f.name === field.name).flatMap(valuesOf))];
  return values.length
    ? `\`${field.name}\` (${values.map((value) => `\`${value}\``).join(', ')})`
    : `\`${field.name}\``;
}

function row(
  tag: string,
  name: string,
  description: string,
  card: Contract,
  editor: Editor,
): string {
  const cardLists = editor.lists ?? [];
  // a list's own key is said once, as the list
  const fields = flatten(editor.getConfigForm().schema).filter(
    (f) => editor.keys.includes(f.name) && !cardLists.some((list) => list.key === f.name),
  );
  const own = fields
    .filter((field, index) => fields.findIndex((f) => f.name === field.name) === index)
    .map((field) => option(field, fields));
  const lists = cardLists.map((list) => {
    const keys = flatten(list.schema).map((f) => `\`${f.name}\``);
    return `\`${list.key}\` (a list: ${keys.join(', ')})`;
  });
  const options = [...own, ...lists];
  const reads = [
    ...(card.aliases?.keys ?? []).map((m) => `\`${m.from}\` → \`${m.to}\``),
    ...cardLists.filter((list) => list.alias).map((list) => `\`${list.alias}\` → \`${list.key}\``),
    ...(card.aliases?.drop ?? []).map((key) => `\`${key}\` (folded in)`),
  ];
  const cells = [
    `**${name.replace(/^Fluvy · /, '')}**`,
    `\`custom:${tag}\``,
    description,
    options.length ? options.join(', ') : '—',
    reads.length ? reads.join(', ') : '—',
  ];
  return `| ${cells.join(' | ')} |`;
}

const catalogue = new Map(
  await Promise.all(
    CATALOGUE.map(async ([tag, element, name, description]) => {
      const card = element as unknown as Contract;
      return [tag, { card, editor: await card.editor(), name, description }] as const;
    }),
  ),
);
const placed = new Set(SECTIONS.flatMap(([, tags]) => tags));
const missing = [...catalogue.keys()].filter((tag) => !placed.has(tag));
if (missing.length) throw new Error(`cards without a section: ${missing.join(', ')}`);

const tables = SECTIONS.map(([title, tags]) => {
  const rows = tags.map((tag) => {
    const entry = catalogue.get(tag);
    if (!entry) throw new Error(`${tag} is in a section but not in the catalogue`);
    return row(tag, entry.name, entry.description, entry.card, entry.editor);
  });
  return `## ${title}\n\n| Card | Type | What it is | Options | Reads |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}`;
}).join('\n\n');

const generated = `${OPEN}\n\n${tables}\n\n${CLOSE}`;
const current = await readFile(FILE, 'utf8');
const start = current.indexOf(OPEN);
const end = current.indexOf(CLOSE);
if (start < 0 || end < 0) throw new Error(`${FILE}: the generated markers are missing`);
const next = `${current.slice(0, start)}${generated}${current.slice(end + CLOSE.length)}`;

if (process.argv.includes('--check')) {
  if (next !== current) {
    console.error(`✗ docs/cards.md is not what the code says: run pnpm docs:cards`);
    process.exit(1);
  }
  console.log(`✓ docs/cards.md: ${catalogue.size} cards as the code says`);
} else {
  await writeFile(FILE, next);
  console.log(`docs/cards.md: ${catalogue.size} cards in ${SECTIONS.length} sections`);
}
