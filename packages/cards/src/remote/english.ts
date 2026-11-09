import { addEnglish } from '@fluvy/core';
import words from '@fluvy/core/locales/en/remote.json';

/** The remote card's English, in its chunk: `remote-cards.ts` imports it first, so it is here before the card speaks. */
addEnglish(words);
