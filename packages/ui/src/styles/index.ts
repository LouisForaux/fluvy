import { unsafeCSS, type CSSResult } from 'lit';
import { ambientCss } from './generated/ambient.js';
import { climateCss } from './generated/climate.js';
import { clocksCss } from './generated/clocks.js';
import { devicesCss } from './generated/devices.js';
import { fluvyCss } from './generated/fluvy.js';
import { homeCss } from './generated/home.js';
import { inputsCss } from './generated/inputs.js';
import { interactionCss } from './generated/interaction.js';
import { roomsCss } from './generated/rooms.js';
import { sliderCss } from './generated/slider.js';
import { solarCss } from './generated/solar.js';
import { tokensCss } from './generated/tokens.js';

/**
 * One CSSResult per stylesheet, created once: Lit turns each into a single constructable
 * stylesheet that every card adopts, so sixty-five cards share one parsed copy of the language.
 */
const sheet = (css: string): CSSResult => unsafeCSS(css);

/** The token fallback: what a card uses where no fluvy look reaches it (generated: Linen, Soft). */
const fallback = sheet(tokensCss);

/** Token fallback + the primitive language + the interaction layer. Every card starts with these. */
export const baseStyles: readonly CSSResult[] = [fallback, sheet(fluvyCss), sheet(interactionCss)];

/**
 * Replaces the token fallback with the look in use: the one constructed sheet every card adopts changes
 * in place, so every card follows at once.
 */
export function setFallbackTokens(css: string): void {
  fallback.styleSheet?.replaceSync(css);
}

/**
 * The sheets of the cards' families. One that only a family or a page fetched on demand adopts is a module of its own,
 * which travels in that chunk: the energy family's (`@fluvy/ui/styles/energy`), the player's (`@fluvy/ui/styles/media`),
 * the calendar's (`@fluvy/ui/styles/calendar`) and the Activity and History pages' chrome (`@fluvy/ui/styles/page`).
 */
export const sheetStyles = {
  home: sheet(homeCss),
  slider: sheet(sliderCss),
  climate: sheet(climateCss),
  devices: sheet(devicesCss),
  ambient: sheet(ambientCss),
  inputs: sheet(inputsCss),
  solar: sheet(solarCss),
  clocks: sheet(clocksCss),
  rooms: sheet(roomsCss),
} as const;
