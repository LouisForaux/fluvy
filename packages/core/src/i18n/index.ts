import type { HomeAssistant } from '../ha/types.js';
import { safeStorage } from '../storage.js';
import {
  english,
  type CountKey,
  type KeyOf,
  type MessageKey,
  type Namespace,
  type Values,
} from './catalogue.js';
import { LANGUAGE_CODES, resolveLanguage, speaks, type LanguageCode } from './languages.js';

export type { Catalogue, CountKey, KeyOf, MessageKey, Namespace, Values } from './catalogue.js';
export { english } from './catalogue.js';
export * from './languages.js';

/**
 * Fluvy's own words. English is the fallback of every lookup: its core part ships inline, and a lazy family's part
 * arrives with the family's chunk (`addEnglish`), so a page that never opens the panel never carries the panel's
 * words. Every other language is a catalogue fetched the first time it is needed (a chunk of its own), so a dashboard
 * pays for the language it speaks and no other. The language is one decision, `languageOf(hass)`: the person's choice
 * in Fluvy's settings, else Home Assistant's, resolved to a language Fluvy has. Entity states and attribute values
 * come translated from Home Assistant itself.
 */

type Table = Readonly<Record<string, unknown>>;
type Loaded = Readonly<Record<string, Table>>;

/** The language chosen in Fluvy's settings, remembered here so the next page load fetches it before `hass` arrives. */
const HINT_KEY = 'fluvy:language';

/** English as far as it has arrived: the core part, and each family's part its chunk registered. */
const englishTables: Record<string, Table> = { ...english };
const catalogues: Partial<Record<LanguageCode, Loaded>> = { en: englishTables };
const loading = new Map<LanguageCode, Promise<void>>();
const listeners = new Set<() => void>();

/** Each language's catalogue as its own chunk: the loader map is explicit so the bundler sees every one. */
const LOADERS: Record<Exclude<LanguageCode, 'en'>, () => Promise<{ default: Loaded }>> = {
  es: () => import('./locales/es.json'),
  de: () => import('./locales/de.json'),
  nl: () => import('./locales/nl.json'),
  fr: () => import('./locales/fr.json'),
  it: () => import('./locales/it.json'),
  'pt-BR': () => import('./locales/pt-BR.json'),
  'pt-PT': () => import('./locales/pt-PT.json'),
  tr: () => import('./locales/tr.json'),
  ja: () => import('./locales/ja.json'),
  hu: () => import('./locales/hu.json'),
  sk: () => import('./locales/sk.json'),
  pl: () => import('./locales/pl.json'),
  'zh-Hans': () => import('./locales/zh-Hans.json'),
};

/**
 * A lazy family's English (`locales/en/<family>.json`): registered by the module that owns the words, as its first
 * import, so they are here before anything in the family's chunk says them. Every other language's catalogue carries
 * every namespace already.
 */
export function addEnglish(
  tables: Readonly<Record<string, Readonly<Record<string, string>>>>,
): void {
  Object.assign(englishTables, tables);
}

let override: LanguageCode | undefined;
let hinted: LanguageCode | undefined;

/** A person's choice of language for Fluvy's own words (Fluvy's settings); undefined: Home Assistant's. */
export function setLanguageOverride(language: LanguageCode | undefined): void {
  override = language;
}

/** The language a person chose, if any. */
export function languageOverride(): LanguageCode | undefined {
  return override;
}

/**
 * The language a person chose for Fluvy where it is not the page's (`page`: Home Assistant's); null where Fluvy
 * speaks the page's language, the one Home Assistant's own formatters speak.
 */
export const ownLanguage = (page: string | undefined): LanguageCode | null =>
  override && !(speaks(page) && resolveLanguage(page) === override) ? override : null;

/**
 * Marks what says Fluvy's words (a card, the panel, a page of ours) with their language, where the person chose one
 * that is not the page's (`page`: Home Assistant's), so the browser draws them as that language — a kanji in its
 * Japanese form, a word hyphenated by its own rules; and takes the mark off where they are the page's language again.
 */
export function markLanguage(host: Element, page: string | undefined): void {
  const lang = ownLanguage(page);
  if (host.getAttribute('lang') === lang) return;
  if (lang) host.setAttribute('lang', lang);
  else host.removeAttribute('lang');
}

/**
 * The one decision: the language Fluvy speaks for this `hass` — the person's choice, else Home Assistant's, resolved
 * to a language Fluvy has. Asking for a language starts fetching its words if they are not here yet.
 */
export function languageOf(hass: Pick<HomeAssistant, 'language'> | undefined): LanguageCode {
  const code = override ?? resolveLanguage(hass?.language);
  if (!catalogues[code]) void ensureLanguage(code);
  if (code !== hinted) {
    hinted = code;
    try {
      safeStorage()?.setItem(HINT_KEY, code);
    } catch {
      // storage refused: the next load starts in English until hass arrives
    }
  }
  return code;
}

/** The words of a language are here (English always). */
export const languageReady = (code: LanguageCode): boolean => Boolean(catalogues[code]);

/**
 * Fetches a language's catalogue once; resolved at once when it is here. Never rejects: a failed fetch keeps
 * English, and the next call tries again.
 */
export function ensureLanguage(code: LanguageCode): Promise<void> {
  if (catalogues[code] || code === 'en') return Promise.resolve();
  const pending = loading.get(code);
  if (pending) return pending;
  const promise = LOADERS[code]()
    .then((module) => {
      catalogues[code] = module.default;
      for (const listener of listeners) listener();
    })
    .catch((error: unknown) => {
      console.warn(`fluvy: the ${code} words did not load`, error);
    })
    .finally(() => loading.delete(code));
  loading.set(code, promise);
  return promise;
}

/** Runs when a language's words arrive: the cards on the page say them at once. */
export function onWords(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const fill = (template: string, values: Values | undefined): string =>
  values
    ? template.replace(/\{(\w+)\}/g, (match, name: string) =>
        name in values ? String(values[name]) : match,
      )
    : template;

/** A word out of the loaded catalogue, else English, else the key itself (a typo never breaks a card). */
function word(code: LanguageCode, namespaces: readonly string[], key: string): string {
  const table = catalogues[code];
  for (const namespace of namespaces) {
    const own = table?.[namespace]?.[key];
    if (typeof own === 'string') return own;
  }
  for (const namespace of namespaces) {
    const fallback = englishTables[namespace]?.[key];
    if (typeof fallback === 'string') return fallback;
  }
  return key;
}

const split = (key: MessageKey | CountKey): [namespace: string, key: string] => {
  const dot = key.indexOf('.');
  return [key.slice(0, dot), key.slice(dot + 1)];
};

/** A shared word (`'climate.mode.heat'`, `'editor.title'`) in the language `hass` speaks. */
export function localize(
  hass: Pick<HomeAssistant, 'language'> | undefined,
  key: MessageKey,
  values?: Values,
): string {
  const [namespace, name] = split(key);
  return fill(word(languageOf(hass), [namespace], name), values);
}

export type Strings<N extends Namespace> = (
  hass: Pick<HomeAssistant, 'language'> | undefined,
  key: KeyOf<N>,
  values?: Values,
) => string;

/**
 * A card's or a page's own words: `strings('cover')` looks a key up in the `cover` namespace; a page adds the
 * shared page words after its own (`strings('history', 'page')`).
 *
 *   const s = strings('cover');
 *   s(this.hass, 'favourites')
 */
export function strings<const N extends readonly [Namespace, ...Namespace[]]>(
  ...namespaces: N
): Strings<N[number]> {
  return (hass, key, values) => fill(word(languageOf(hass), namespaces, key), values);
}

/**
 * A count: `${key}_${category}` when the catalogue has the CLDR category (`_one`, `_other`, a language's `_few`
 * and `_many`), else the key itself; `{n}` is always at hand in the template. Every count is said here: a card that
 * picked its words by `n === 1` would give Slovak's 3 the words of 5.
 */
export function plural(
  hass: Pick<HomeAssistant, 'language'> | undefined,
  key: CountKey,
  n: number,
  values?: Values,
): string {
  const code = languageOf(hass);
  const [namespace, name] = split(key);
  let category = 'other';
  try {
    category = new Intl.PluralRules(code).select(n);
  } catch {
    // an engine without the rules for this language: the plain form
  }
  const table = catalogues[code]?.[namespace] ?? englishTables[namespace];
  const chosen = table?.[`${name}_${category}`] !== undefined ? `${name}_${category}` : name;
  return fill(word(code, [namespace], chosen), { n, ...values });
}

/** Words in a fixed language, whatever the person chose (a dashboard pinned to a language). */
export function wordsIn(code: LanguageCode): (key: MessageKey, values?: Values) => string {
  if (!catalogues[code]) void ensureLanguage(code);
  return (key, values) => {
    const [namespace, name] = split(key);
    return fill(word(code, [namespace], name), values);
  };
}

/** Every language Fluvy ships, loaded (the tests and the tools: nothing waits on a fetch afterwards). */
export const preloadLanguages = (): Promise<void[]> =>
  Promise.all(LANGUAGE_CODES.map((code) => ensureLanguage(code)));

/** The language this browser last said Fluvy's words in (`languageOf` remembers it), else the page's, if either. */
export function rememberedLanguage(): LanguageCode | undefined {
  try {
    const hint = safeStorage()?.getItem(HINT_KEY) ?? globalThis.document?.documentElement?.lang;
    return hint ? resolveLanguage(hint) : undefined;
  } catch {
    // no storage, no document: none
    return undefined;
  }
}

// the last chosen language starts loading with the module, before Home Assistant is connected: no flash of English
const remembered = rememberedLanguage();
if (remembered) void ensureLanguage(remembered);
