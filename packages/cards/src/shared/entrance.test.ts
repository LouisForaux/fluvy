// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { catalogue, familiesDefined } from '../index.js';

await familiesDefined;

describe('the entrance', () => {
  // #148: a card a person places plays it; only what every view opens with stays still as the view changes under it
  it('is left out only by the greeting and the tabs', async () => {
    const still = (await catalogue())
      .filter(([, element]) => (element as unknown as { still: boolean }).still)
      .map(([tag]) => tag);
    expect(still.sort()).toEqual(['fluvy-chips-card', 'fluvy-hello-card']);
  });
});
