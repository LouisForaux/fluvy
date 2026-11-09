import core from './locales/en/core.json';
import type activity from './locales/en/activity.json';
import type alerts from './locales/en/alerts.json';
import type appliances from './locales/en/appliances.json';
import type automations from './locales/en/automations.json';
import type chart from './locales/en/chart.json';
import type chartCard from './locales/en/chart-card.json';
import type devices from './locales/en/devices.json';
import type editor from './locales/en/editor.json';
import type energy from './locales/en/energy.json';
import type energyPeriod from './locales/en/energy-period.json';
import type energyUsage from './locales/en/energy-usage.json';
import type history from './locales/en/history.json';
import type items from './locales/en/items.json';
import type job from './locales/en/job.json';
import type media from './locales/en/media.json';
import type panel from './locales/en/panel.json';
import type remote from './locales/en/remote.json';
import type roomEditor from './locales/en/room-editor.json';
import type slider from './locales/en/slider.json';
import type strategy from './locales/en/strategy.json';
import type template from './locales/en/template.json';
import type vehicle from './locales/en/vehicle.json';
import type web from './locales/en/web.json';

/**
 * The shape of a catalogue, taken from English (the source every other language mirrors key for key): one table
 * per namespace — the shared words (`common`, `climate`, `editor`, …), one per card or page (`cover`, `panel`,
 * `history`, …). English comes in parts, and the shape is all of them at once: `core.json` ships inline, each lazy
 * family's part (`panel.json`, `energy.json`, …) travels with that family's chunk and the editors' (`editor.json`) with
 * the fields every editor is built of, each registered (`addEnglish`) as its chunk lands. Every other language is one
 * catalogue with every namespace.
 */
export type Catalogue = typeof core &
  typeof activity &
  typeof alerts &
  typeof appliances &
  typeof automations &
  typeof chart &
  typeof chartCard &
  typeof devices &
  typeof editor &
  typeof energy &
  typeof energyPeriod &
  typeof energyUsage &
  typeof history &
  typeof items &
  typeof job &
  typeof media &
  typeof panel &
  typeof remote &
  typeof roomEditor &
  typeof slider &
  typeof strategy &
  typeof template &
  typeof vehicle &
  typeof web;

export type Namespace = keyof Catalogue;

/** The keys of one namespace (`'favourites' | 'class.awning' | …` for `cover`). */
export type KeyOf<N extends Namespace> = N extends unknown ? keyof Catalogue[N] & string : never;

/** A key with its namespace (`'climate.mode.heat'`, `'editor.title'`): what `localize()` and a card's `t()` take. */
export type MessageKey = { [N in Namespace]: `${N}.${KeyOf<N>}` }[Namespace];

/** The count a form belongs to: `devices` for `devices_one` and for `days_other`. */
type Counted<K extends string> = K extends `${infer Base}_${'one' | 'other'}` ? Base : never;

/**
 * A count with its namespace (`'alerts.devices'`): what `plural()` takes. English writes a count in its forms by number,
 * `devices_one` beside `devices` (the other form), or `days_other` alone for one it says only of two or more; every
 * other language adds the forms its own rules give a whole number (Slovak's `_few`).
 */
export type CountKey = { [N in Namespace]: `${N}.${Counted<KeyOf<N>>}` }[Namespace];

export type Values = Readonly<Record<string, string | number>>;

/** English's inline part, the fallback of every lookup: the words any page may say before a family lands. */
export const english: typeof core = core;
