// the card's words first: they are here before it speaks
import './remote/english.js';
import { registerCard } from '@fluvy/core';
import { REMOTE_FAMILY } from './remote-family.js';
import { FluvyRemoteCard } from './remote/remote-card.js';

/**
 * The TV remote card's element: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands.
 * Its name, description and heights live in `remote-family.ts`, which every page carries.
 */
export const CARDS = REMOTE_FAMILY.map(
  ([tag, name, description]) =>
    [tag, FluvyRemoteCard as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of CARDS)
  registerCard({ tag, name, description }, element);
