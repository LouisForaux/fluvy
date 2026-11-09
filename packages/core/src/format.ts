import type { EntityView } from './entity.js';
import type { FrontendLocaleData, HomeAssistant } from './ha/types.js';
import { languageOf, localize, plural, speaks } from './i18n/index.js';

/** Locale used for numbers: Home Assistant lets the user override the language's own grouping. */
function numberLocale(
  locale: FrontendLocaleData | undefined,
  language: string,
): string | undefined {
  switch (locale?.number_format) {
    case 'comma_decimal':
      return 'en-US';
    case 'decimal_comma':
      return 'de-DE';
    case 'space_comma':
      return 'fr-FR';
    case 'system':
      return undefined;
    default:
      return locale?.language ?? language;
  }
}

export interface NumberOptions {
  /** Undefined: the reading's own (its precision, else its unit's default). */
  readonly digits?: number | undefined;
  readonly minDigits?: number;
  /** In the language's short words for its size, rounded as it rounds them (no `digits`): "5.1M", "421K", "511万". */
  readonly compact?: boolean;
}

/** A number as the user's locale writes it; anything that is not a finite number reads as "—", never "NaN". */
export function formatNumber(
  hass: HomeAssistant | undefined,
  value: number,
  options: NumberOptions = {},
): string {
  if (!Number.isFinite(value)) return '—';
  const clampDigits = (n: number): number => Math.min(20, Math.max(0, Math.trunc(n)));
  const minDigits = clampDigits(options.minDigits ?? 0);
  const digits = Math.max(
    minDigits,
    clampDigits(options.digits ?? (Math.abs(value) >= 100 ? 0 : 1)),
  );
  const opts: Intl.NumberFormatOptions = options.compact
    ? { notation: 'compact' }
    : { maximumFractionDigits: digits, minimumFractionDigits: minDigits };
  if (hass?.locale?.number_format === 'none') opts.useGrouping = false;
  try {
    return numberFormat(numberLocale(hass?.locale, hass?.language ?? 'en'), opts).format(value);
  } catch {
    return value.toFixed(digits);
  }
}

/** `Intl.NumberFormat` construction is the expensive part of formatting; sixty-five cards share one per locale and option set. */
const formatters = new Map<string, Intl.NumberFormat>();
function numberFormat(
  locale: string | undefined,
  opts: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale ?? ''}|${opts.maximumFractionDigits}|${opts.minimumFractionDigits}|${opts.useGrouping === false ? 0 : 1}|${opts.notation ?? ''}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, opts);
    if (formatters.size > 64) formatters.clear();
    formatters.set(key, formatter);
  }
  return formatter;
}

/** Value and unit as two strings, so a readout can set them in different sizes on one baseline. */
export interface ValueParts {
  readonly value: string;
  readonly unit: string;
}

/** Scales W → kW and Wh → kWh once the figure is long enough to crowd a readout. */
export function scaleUnit(value: number, unit: string): { value: number; unit: string } {
  const abs = Math.abs(value);
  if ((unit === 'W' || unit === 'Wh') && abs >= 1000)
    return { value: value / 1000, unit: `k${unit}` };
  if ((unit === 'kW' || unit === 'kWh') && abs >= 1000)
    return { value: value / 1000, unit: `M${unit.slice(1)}` };
  return { value, unit };
}

export function valueParts(
  hass: HomeAssistant | undefined,
  view: EntityView,
  options: NumberOptions = {},
): ValueParts {
  if (view.status === 'missing' || view.status === 'unavailable' || view.status === 'unknown')
    return { value: '—', unit: '' };
  if (view.number === null) return { value: stateText(hass, view), unit: '' };
  const registryPrecision = hass?.entities?.[view.id]?.display_precision;
  const precision =
    typeof registryPrecision === 'number' && Number.isFinite(registryPrecision)
      ? registryPrecision
      : undefined;
  const scaled = scaleUnit(view.number, view.unit);
  const rescaled = scaled.unit !== view.unit;
  const digits =
    options.digits ??
    (rescaled
      ? Math.abs(scaled.value) >= 100
        ? 0
        : Math.abs(scaled.value) >= 10
          ? 1
          : 2
      : (precision ?? defaultDigits(view.number, view.unit)));
  // a precision set in the registry is exact, as Home Assistant writes it: 21.0 at one decimal stays "21.0"
  const exact =
    !rescaled &&
    precision !== undefined &&
    (options.digits === undefined || options.digits === precision);
  return {
    value: formatNumber(hass, scaled.value, {
      ...options,
      digits,
      ...(exact ? { minDigits: options.minDigits ?? precision } : {}),
    }),
    unit: displayUnit(scaled.unit),
  };
}

/**
 * The digits a reading is written with now (its registry precision, else the default for its unit), for another
 * `value` of the same sensor (a chart's moment, so a figure read under the finger keeps the width it has at rest).
 * Undefined where either is written in a larger unit than the sensor's ("1.2 kW" has digits of its own) or the
 * reading is not a number: the value then takes its own.
 */
export function digitsOf(
  hass: HomeAssistant | undefined,
  view: EntityView,
  value: number,
): number | undefined {
  if (view.number === null) return undefined;
  if (scaleUnit(value, view.unit).unit !== view.unit) return undefined;
  if (scaleUnit(view.number, view.unit).unit !== view.unit) return undefined;
  const precision = hass?.entities?.[view.id]?.display_precision;
  if (typeof precision === 'number' && Number.isFinite(precision)) return precision;
  return defaultDigits(view.number, view.unit);
}

function defaultDigits(value: number, unit: string): number {
  if (unit === '%' || unit === 'W' || unit === 'lx' || unit === 'ppm')
    return Number.isInteger(value) ? 0 : 1;
  return Math.abs(value) >= 100 ? 0 : 1;
}

/** "°C" stays, "%" stays: spacing is the template's job ("46 %" is set with a gap, not a character). */
export const displayUnit = (unit: string): string => unit;

/** Home Connect's namespaces: the first words of every key it names a programme or a setting's value by. */
const HOME_CONNECT =
  /^(?:b_s_h_common|consumer_products|cooking|dishcare|heating_ventilation_air_conditioning|laundry_care|refrigeration)_/;
/** The groups it files programmes under ("beverage", "coffee world"), which Home Assistant's own names leave out. */
const PROGRAM_GROUP =
  /^(?:basic|beverage|cleaning_modes|cleaning|coffee_world|heating_mode|hood|steam_modes|subsequent_mode)_/;

/**
 * A raw key in words: a Home Connect programme by what follows `_program_`, less its group, and a setting's value by
 * what follows `_enum_type_` (`consumer_products_coffee_maker_program_beverage_espresso` is "espresso"); any other
 * key with its underscores as spaces.
 */
function keyWords(key: string): string {
  if (HOME_CONNECT.test(key)) {
    const program = key.split('_program_')[1];
    const tail =
      program === undefined ? key.split('_enum_type_')[1] : program.replace(PROGRAM_GROUP, '');
    if (tail) return tail.replace(/_/g, ' ');
  }
  return key.replace(/_/g, ' ');
}

/**
 * A state's or an option's words: Home Assistant's own (`said`, its translation), else the raw key's (`keyWords`).
 * Where it has no translation it says the raw key itself, and a Home Connect key then says its tail too; any other
 * stays as it said it. Capitalised: its untranslated words come lower case ("idle").
 */
export function stateSaid(said: string | undefined, key: string): string {
  const words = said && !(said === key && HOME_CONNECT.test(key)) ? said : keyWords(key);
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Human state text. Home Assistant's own formatter first (translated, device-class aware). */
export function stateText(hass: HomeAssistant | undefined, view: EntityView): string {
  if (view.status === 'missing') return localizeStatus(hass, 'missing');
  if (view.status === 'unavailable') return localizeStatus(hass, 'unavailable');
  if (view.status === 'unknown') return localizeStatus(hass, 'unknown');
  let said: string | undefined;
  if (hass?.formatEntityState && view.stateObj) {
    try {
      const text = hass.formatEntityState(view.stateObj);
      if (typeof text === 'string') said = text;
    } catch {
      /* the key's own words */
    }
  }
  return stateSaid(said, view.state);
}

function localizeStatus(
  hass: HomeAssistant | undefined,
  key: 'missing' | 'unavailable' | 'unknown',
): string {
  return localize(hass, `state.${key}`);
}

const use12h = (hass: HomeAssistant | undefined): boolean | undefined =>
  hass?.locale?.time_format === '12'
    ? true
    : hass?.locale?.time_format === '24'
      ? false
      : undefined;

const formats = new Map<string, Intl.DateTimeFormat>();

/**
 * An `Intl.DateTimeFormat`, cached: in the language asked (the browser's when undefined); a zone the engine does not
 * know falls back to the browser's own, and a tag it does not know to English. Never throws.
 */
export function dateFormat(
  language: string | undefined,
  options: Intl.DateTimeFormatOptions = {},
): Intl.DateTimeFormat {
  const key = `${language ?? ''}|${JSON.stringify(options)}`;
  let format = formats.get(key);
  if (!format) {
    const zoneless = { ...options };
    delete zoneless.timeZone;
    const attempts: readonly (readonly [string | undefined, Intl.DateTimeFormatOptions])[] = [
      [language, options],
      [language, zoneless],
      ['en', options],
      ['en', zoneless],
    ];
    for (const [tag, opts] of attempts) {
      try {
        format = new Intl.DateTimeFormat(tag, opts);
        break;
      } catch {
        /* the next, plainer attempt */
      }
    }
    format ??= new Intl.DateTimeFormat('en');
    if (formats.size > 256) formats.clear();
    formats.set(key, format);
  }
  return format;
}

/** Whether the house reads a 12-hour clock: the profile's choice, else its language's habit (the browser's for "system"). */
export function clock12(hass: HomeAssistant | undefined): boolean {
  const chosen = use12h(hass);
  if (chosen !== undefined) return chosen;
  const language = hass?.locale?.time_format === 'system' ? undefined : (hass?.language ?? 'en');
  const cycle = dateFormat(language, { hour: 'numeric' }).resolvedOptions().hourCycle;
  return cycle === 'h11' || cycle === 'h12';
}

/** A clock's fields as they read on a wall. */
export interface WallClock {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

/** Whether this browser knows a time zone by that name. */
export function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

/** What a clock on the wall of `timeZone` shows at that instant (the browser's own clock without a zone it knows). */
export function wallClock(date: Date, timeZone: string | undefined): WallClock {
  if (timeZone && isTimeZone(timeZone)) {
    const parts = dateFormat('en', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const field = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    return {
      year: field('year'),
      month: field('month'),
      day: field('day'),
      hour: field('hour'),
      minute: field('minute'),
      second: field('second'),
    };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    second: date.getSeconds(),
  };
}

/** The day's two halves as the house writes them ("AM", "PM"; "a. m.", "p. m."). */
export function dayPeriods(hass: HomeAssistant | undefined): readonly [string, string] {
  const half = (hour: number): string => {
    try {
      return (
        new Intl.DateTimeFormat(hass?.language ?? 'en', { hour: 'numeric', hourCycle: 'h12' })
          .formatToParts(new Date(2020, 0, 1, hour))
          .find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM')
      );
    } catch {
      return hour < 12 ? 'AM' : 'PM';
    }
  };
  return [half(9), half(21)];
}

const validDate = (date: Date): boolean => Number.isFinite(date.getTime());

/** The time zone Home Assistant wants shown: the server's when the profile says so, else the browser's (undefined). */
export function houseZone(hass: HomeAssistant | undefined): string | undefined {
  const zone = hass?.config?.time_zone;
  return typeof zone === 'string' && zone !== '' && hass?.locale?.time_zone === 'server'
    ? zone
    : undefined;
}

export function formatTime(
  hass: HomeAssistant | undefined,
  date: Date,
  withSeconds = false,
): string {
  if (!validDate(date)) return '—';
  const opts: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
  };
  const h12 = use12h(hass);
  // `hourCycle`, not `hour12: false`: the latter can print midnight as "24:05" on some engines
  if (h12 !== undefined) opts.hourCycle = h12 ? 'h12' : 'h23';
  const zone = houseZone(hass);
  if (zone) opts.timeZone = zone;
  return dateFormat(hass?.language ?? 'en', opts).format(date); // an unknown zone must not take the clock down
}

export function formatDate(
  hass: HomeAssistant | undefined,
  date: Date,
  style: 'full' | 'short' | 'day' | 'month' | 'weekday' = 'full',
): string {
  if (!validDate(date)) return '—';
  const opts: Intl.DateTimeFormatOptions =
    style === 'full'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : style === 'short'
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : style === 'day'
          ? { weekday: 'long', day: 'numeric' }
          : style === 'weekday'
            ? { weekday: 'short' }
            : { month: 'long' };
  const zone = houseZone(hass);
  if (zone) opts.timeZone = zone;
  return dateFormat(hass?.language ?? 'en', opts).format(date);
}

/**
 * "5 min ago" / "hace 5 min" with the platform's own rules; under a minute it is simply "now" / "ahora". `short`: a
 * past of days in its short form ("32 d ago"), for a line too narrow for "32 days ago".
 */
export function relativeTime(
  hass: HomeAssistant | undefined,
  from: Date,
  now: Date = new Date(),
  short = false,
): string {
  if (!validDate(from) || !validDate(now)) return '—';
  const seconds = (now.getTime() - from.getTime()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return localize(hass, 'common.now');
  const minutes = Math.round(abs / 60);
  const hours = Math.round(abs / 3600);
  const days = Math.round(abs / 86_400);
  const past = seconds >= 0;
  // The design writes these in full ("4 min ago", "hace 2 h"); Intl's narrow style says "4m ago", its
  // long style "4 minutes ago" — neither is the sheet. A language Fluvy does not speak falls back to Intl.
  if (speaks(languageOf(hass))) {
    if (abs < 3600)
      return localize(hass, past ? 'time.minutes_ago' : 'time.in_minutes', { n: minutes });
    if (abs < 86_400)
      return localize(hass, past ? 'time.hours_ago' : 'time.in_hours', { n: hours });
    if (days === 1) return localize(hass, past ? 'time.yesterday' : 'time.tomorrow');
    return past
      ? localize(hass, short ? 'time.days_ago_short' : 'time.days_ago', { n: days })
      : plural(hass, 'time.in_days', days);
  }
  const rtf = new Intl.RelativeTimeFormat(hass?.language ?? 'en', {
    numeric: 'auto',
    style: 'short',
  });
  const signed = past ? -1 : 1;
  if (abs < 3600) return rtf.format(signed * minutes, 'minute');
  if (abs < 86_400) return rtf.format(signed * hours, 'hour');
  return rtf.format(signed * days, 'day');
}

export function formatDuration(totalSeconds: number): string {
  const s = Number.isFinite(totalSeconds) ? Math.max(0, Math.round(totalSeconds)) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
