/**
 * The facts guard: what the prose says in numbers is what the code says. A count spelled in the README, the docs,
 * the package description, the contributing guide or the design language — "sixty-five cards", "fifteen palettes",
 * "five automatic dashboards", "eight languages", "six tabs" — is read back and held to the catalogue, the palette
 * registry, the strategy's templates, the language registry and the panel's tabs; the every-page budget the
 * development guide names is held to `finish.mjs`, and its table of scripts to `check.mjs`'s `BUDGETS`, name for name
 * and kilobyte for kilobyte. The CHANGELOG is history and is never read.
 *
 *   tsx src/facts.ts --check    what `pnpm --filter @fluvy/docs check` runs: exit 1 with every stale figure named
 */
import { readdir, readFile, realpath } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NUMBER_WORDS, numberOf, wordsOf } from './words.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** What the code says: the counts the prose may spell, and the budgets it may quote. */
export interface Facts {
  readonly cards: number;
  readonly palettes: number;
  readonly dashboards: number;
  readonly languages: number;
  readonly tabs: number;
  /** The every-page gzip budget in KB (`finish.mjs`). */
  readonly everyPageKb: number;
  /** Every script's gzip budget in bytes, by its chunk name (`check.mjs`). */
  readonly budgets: Readonly<Record<string, number>>;
}

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** A spelled or written number, as one token: "fifty-five", "Fifty five", "fifteen", "52". */
const NUMBER = `(?:(?:${NUMBER_WORDS.join('|')})(?:[- ](?:one|two|three|four|five|six|seven|eight|nine))?|\\d{1,3})`;

/**
 * A fact's phrases: the noun a count is spelled before, and the least a count must be to be that fact's (a count of
 * the library is never "two cards side by side").
 */
const COUNTS: ReadonlyArray<{
  readonly fact: keyof Facts;
  readonly phrase: RegExp;
  readonly least: number;
  readonly noun: string;
}> = [
  { fact: 'cards', phrase: new RegExp(`\\b(${NUMBER}) cards\\b`, 'gi'), least: 20, noun: 'cards' },
  {
    fact: 'palettes',
    phrase: new RegExp(`\\b(${NUMBER}) (?:palettes|presets)\\b`, 'gi'),
    least: 10,
    noun: 'palettes',
  },
  {
    fact: 'dashboards',
    phrase: new RegExp(
      `\\b(${NUMBER}) (?:automatic dashboards|templates|dashboards Fluvy builds)\\b`,
      'gi',
    ),
    least: 2,
    noun: 'automatic dashboards',
  },
  {
    fact: 'languages',
    phrase: new RegExp(`\\b(${NUMBER}) languages\\b`, 'gi'),
    least: 2,
    noun: 'languages',
  },
  {
    fact: 'tabs',
    phrase: new RegExp(`\\b(${NUMBER}) (?:equal )?tabs\\b`, 'gi'),
    least: 2,
    noun: 'tabs',
  },
];

/** The spelled counts of one text, each held to its fact (`only`: the facts a source comment may count). */
export function checkCounts(
  file: string,
  text: string,
  facts: Facts,
  only?: ReadonlyArray<keyof Facts>,
): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    for (const { fact, phrase, least, noun } of COUNTS) {
      if (only && !only.includes(fact)) continue;
      for (const match of line.matchAll(phrase)) {
        const said = numberOf(match[1] as string);
        if (said === undefined || said < least) continue;
        const expected = facts[fact] as number;
        if (said !== expected)
          findings.push({
            file,
            line: index + 1,
            text: `"${match[0]}" — the code says ${wordsOf(expected)} (${expected}) ${noun}`,
          });
      }
    }
  });
  return findings;
}

/**
 * The development guide's figures: the every-page budget it names in bold, its chunk list, and its table of scripts
 * (a row a budgeted script: `| \`name\` | N KB | …`), each held to the build's own numbers.
 */
export function checkBudgets(file: string, text: string, facts: Facts): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  const everyPage = [...text.matchAll(/over \*\*(\d+) KB gzip\*\*/g)];
  if (everyPage.length === 0)
    findings.push({
      file,
      line: 0,
      text: 'the every-page budget ("over **N KB gzip**") is not said',
    });
  for (const match of everyPage)
    if (Number(match[1]) !== facts.everyPageKb)
      findings.push({
        file,
        line: lineOf(text, match.index ?? 0),
        text: `"${match[0]}" — finish.mjs says ${facts.everyPageKb} KB`,
      });

  const named = new Map<string, { kb: number; line: number }>();
  lines.forEach((line, index) => {
    const row = /^\| `([\w.-]+)` \| (\d+) KB \|/.exec(line);
    if (row) named.set(row[1] as string, { kb: Number(row[2]), line: index + 1 });
  });
  if (named.size === 0)
    findings.push({ file, line: 0, text: 'the table of script budgets is missing' });
  for (const [name, bytes] of Object.entries(facts.budgets)) {
    const row = named.get(name);
    if (!row)
      findings.push({
        file,
        line: 0,
        text: `the table has no row for \`${name}\` (check.mjs budgets it)`,
      });
    else if (row.kb * 1024 !== bytes)
      findings.push({
        file,
        line: row.line,
        text: `\`${name}\` ${row.kb} KB — check.mjs says ${bytes} B (${bytes / 1024} KB)`,
      });
  }
  for (const [name, row] of named)
    if (!(name in facts.budgets))
      findings.push({
        file,
        line: row.line,
        text: `\`${name}\` is in the table but check.mjs budgets no such chunk`,
      });

  const list = /chunks\/\{([\w,*-]+)\}-<hash>\.js/.exec(text);
  if (!list)
    findings.push({ file, line: 0, text: 'the chunk list (`chunks/{…}-<hash>.js`) is missing' });
  else {
    const listed = new Set((list[1] as string).split(','));
    const onDemand = Object.keys(facts.budgets).filter(
      (name) => !['fluvy.js', 'loader.js', 'core', 'rolldown-runtime', 'lang'].includes(name),
    );
    for (const name of onDemand)
      if (!listed.has(name))
        findings.push({
          file,
          line: lineOf(text, list.index),
          text: `the chunk list lacks \`${name}\``,
        });
    for (const name of listed)
      if (name !== 'lang-*' && !(name in facts.budgets))
        findings.push({
          file,
          line: lineOf(text, list.index),
          text: `the chunk list names \`${name}\`, which check.mjs does not budget`,
        });
    if (!listed.has('lang-*'))
      findings.push({
        file,
        line: lineOf(text, list.index),
        text: 'the chunk list lacks `lang-*`',
      });
  }
  return findings;
}

const lineOf = (text: string, index: number): number => text.slice(0, index).split('\n').length;

/** `BUDGETS` as `tools/release/check.mjs` writes it: a name, a number with its digit groups. */
export function parseBudgets(source: string): Record<string, number> {
  const body = /const BUDGETS = \{([\s\S]*?)\n\};/.exec(source)?.[1];
  if (!body) throw new Error('tools/release/check.mjs: BUDGETS not found');
  const budgets: Record<string, number> = {};
  for (const match of body.matchAll(/^\s*'?([\w.-]+)'?:\s*([\d_]+),/gm))
    budgets[match[1] as string] = Number((match[2] as string).replaceAll('_', ''));
  return budgets;
}

/** The every-page budget as `finish.mjs` writes it (`const BUDGET = N * 1024`). */
export function parseEveryPageKb(source: string): number {
  const match = /const BUDGET = (\d+) \* 1024;/.exec(source);
  if (!match) throw new Error('packages/bundle/scripts/finish.mjs: BUDGET not found');
  return Number(match[1]);
}

/** What the code says, read from it. */
export async function readFacts(): Promise<Facts> {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator');
  if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();
  const [{ catalogue }, { PALETTE_NAMES }, { TEMPLATES }, { LANGUAGE_CODES }, { TABS }] =
    await Promise.all([
      import('@fluvy/cards'),
      import('@fluvy/tokens/config'),
      import('../../../packages/cards/src/strategy/templates.js'),
      import('../../../packages/core/src/i18n/languages.js'),
      import('../../../packages/cards/src/panel/model.js'),
    ]);
  const [check, finish] = await Promise.all([
    readFile(join(ROOT, 'tools', 'release', 'check.mjs'), 'utf8'),
    readFile(join(ROOT, 'packages', 'bundle', 'scripts', 'finish.mjs'), 'utf8'),
  ]);
  return {
    cards: (await catalogue()).length,
    palettes: PALETTE_NAMES.length,
    dashboards: TEMPLATES.length,
    languages: LANGUAGE_CODES.length,
    tabs: TABS.length,
    everyPageKb: parseEveryPageKb(finish),
    budgets: parseBudgets(check),
  };
}

/** The prose that may spell a count: the repository's guides, the package description and the design language. */
export async function proseFiles(): Promise<string[]> {
  return [
    'README.md',
    'CONTRIBUTING.md',
    'package.json',
    join('design', 'language.md'),
    join('packages', 'cards', 'README.md'),
    ...(await readdir(join(ROOT, 'docs')))
      .filter((f) => f.endsWith('.md'))
      .map((f) => join('docs', f)),
  ].sort();
}

/**
 * The hand-written sources, whose comments may count the library ("sixty-five cards share one parsed copy") and are
 * held to that count alone: a comment's "two tabs" or "five languages" is a fixture, not a fact.
 */
export async function sourceFiles(): Promise<string[]> {
  const files: string[] = [];
  for (const dir of ['packages', 'tools']) files.push(...(await sources(join(ROOT, dir))));
  return files.sort();
}

/** Every hand-written source under a folder, never a test, a generated file or a build. */
async function sources(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ['node_modules', 'dist', 'generated', '__snapshots__', '__tests__', 'out'].includes(
          entry.name,
        )
      )
        continue;
      out.push(...(await sources(path)));
    } else if (/\.(ts|mjs)$/.test(entry.name) && !/\.(test|generated)\.(ts|mjs)$/.test(entry.name))
      out.push(relative(ROOT, path));
  }
  return out;
}

export async function findings(facts: Facts): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const file of await proseFiles()) {
    const text = await readFile(join(ROOT, file), 'utf8');
    out.push(...checkCounts(file, text, facts));
    if (file === join('docs', 'development.md')) out.push(...checkBudgets(file, text, facts));
  }
  for (const file of await sourceFiles())
    out.push(...checkCounts(file, await readFile(join(ROOT, file), 'utf8'), facts, ['cards']));
  return out;
}

const isMain = async (): Promise<boolean> =>
  Boolean(process.argv[1]) &&
  (await realpath(process.argv[1] as string)) === fileURLToPath(import.meta.url);

if (await isMain()) {
  const facts = await readFacts();
  const found = await findings(facts);
  if (found.length) {
    for (const f of found) console.error(`✗ ${f.file}:${f.line}: ${f.text}`);
    process.exit(1);
  }
  console.log(
    `✓ facts: ${wordsOf(facts.cards)} cards, ${wordsOf(facts.palettes)} palettes, ${wordsOf(facts.dashboards)} automatic dashboards, ${wordsOf(facts.languages)} languages, ${wordsOf(facts.tabs)} tabs, every page ${facts.everyPageKb} KB, ${Object.keys(facts.budgets).length} budgets — as the code says`,
  );
}
