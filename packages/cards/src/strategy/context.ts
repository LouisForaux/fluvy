import { wordsIn, type HomeAssistant } from '@fluvy/core';
import { capsOf, moreHost } from './caps.js';
import { gridExportPositive } from './energy-sign.js';
import { HomeRegistry } from './home-registry.js';
import { findEnergyRoles } from './energy-roles.js';
import { HELLO_HEIGHT, helloCard, TABS_HEIGHT, tabsCard } from './layout.js';
import type { Template } from './templates.js';
import type {
  EnergyPrefs,
  EnergyRoles,
  FluvyStrategyConfig,
  Section,
  StrategyContext,
  View,
} from './types.js';

/*
 * The house as an automatic dashboard reads it: its energy roles, the context every view is built from, and the
 * frame every view is given (the greeting and the tabs first, the template's columns).
 */

/** Columns of the home dashboard's views: the widest layout, kept on every tab (an empty section still takes its column). */
export const COLUMNS = 3;

export const withCards = (sections: readonly Section[]): Section[] =>
  sections.filter((section) => section.cards.length > 0);

/**
 * The template's frame: the greeting first in the first section, the views as chips under it when the dashboard
 * asks for them (and has more than one; a wall opens with neither), then empty sections up to the template's columns;
 * a band across them (a section spanning the columns) on a row of its own — before the columns where the view leads
 * with it (the Energy dashboard's period strip on its Today view), else after them (the appliances).
 */
export function framed(
  view: View,
  ctx: StrategyContext,
  views: readonly View[],
  template: Pick<Template, 'header' | 'columns'> = { header: 'hello', columns: COLUMNS },
): View {
  const tabs = views.filter((other) => !other.subview);
  const header =
    template.header === 'hello'
      ? [
          helloCard(ctx.weather),
          ...(ctx.greetingTabs && tabs.length > 1 ? [tabsCard(ctx.base, views)] : []),
        ]
      : [];
  // the bands before the first column lead; a view of bands alone (every appliance) keeps them under the greeting
  const columns = view.sections.findIndex((section) => !section.column_span);
  const lead = columns > 0 ? view.sections.slice(0, columns) : [];
  const across = view.sections.slice(lead.length).filter((section) => section.column_span);
  const [first, ...rest] = view.sections.filter((section) => !section.column_span);
  const sections: Section[] = first
    ? [{ ...first, cards: [...header, ...first.cards] }, ...rest]
    : [{ type: 'grid', cards: header }];
  while (sections.length < template.columns) sections.push({ type: 'grid', cards: [] });
  return { ...view, sections: [...lead, ...sections, ...across] };
}

/** A grid meter found by its words (not given by the energy preferences) takes the sign its last day shows. */
async function signedEnergyRoles(hass: HomeAssistant, roles: EnergyRoles): Promise<EnergyRoles> {
  if (!roles.gridPower || roles.gridSigned || roles.gridExport || roles.batteryPowers.length)
    return roles;
  return {
    ...roles,
    gridInvert: await gridExportPositive(
      hass,
      roles.gridPower,
      roles.solarPowers.map((p) => p.id),
    ),
  };
}

/**
 * The house's power meters as the automatic dashboard finds them: the energy dashboard's preferences first, then
 * the registries' words, each with its sign.
 */
export async function houseEnergy(
  hass: HomeAssistant,
  home = new HomeRegistry(hass),
): Promise<EnergyRoles> {
  // a house without the energy dashboard answers with an error: then there are no preferences
  const prefs = await hass
    .callWS<EnergyPrefs>({ type: 'energy/get_prefs' })
    .catch((): null => null);
  return signedEnergyRoles(hass, findEnergyRoles(home, prefs));
}

/** The context a dashboard is generated in: the house, its words, its base path, its weather and energy, and the cards' style. */
export async function buildContext(
  config: FluvyStrategyConfig,
  hass: HomeAssistant,
  base = `/${(typeof location !== 'undefined' ? location.pathname.split('/')[1] : '') || 'fluvy-home'}`,
): Promise<StrategyContext> {
  const home = new HomeRegistry(hass, config.rooms, config.exclude);
  const ctx: StrategyContext = {
    home,
    t: config.language ? wordsIn(config.language) : (key) => home.t(key),
    // the dashboard the strategy is generated for: the page's first path segment
    base,
    panelUrl: hass.panelUrl || base.slice(1),
    weather: config.weather ?? home.weather[0],
    energy: await houseEnergy(hass, home),
    style: {
      ...(config.thermostat_variant ? { thermostat: config.thermostat_variant } : {}),
      ...(config.tile_size ? { tiles: config.tile_size } : {}),
      ...(config.flow_style ? { flow: config.flow_style } : {}),
      ...(config.room_variant ? { room: config.room_variant } : {}),
      ...(config.camera_refresh ? { refresh: config.camera_refresh } : {}),
      ...(config.scenes_max ? { scenes: config.scenes_max } : {}),
    },
    areas: config.areas,
    greetingTabs: config.greeting_tabs === 'show',
    hass,
    header: HELLO_HEIGHT + (config.greeting_tabs === 'show' ? TABS_HEIGHT : 0),
    caps: capsOf(config.caps),
    // each view gathers its own (`generateWith`); the first's until then
    more: moreHost('home', home.t('strategy.home'), 'fluvy:home', COLUMNS),
  };
  return ctx;
}
