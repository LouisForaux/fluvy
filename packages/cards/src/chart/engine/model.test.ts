import { describe, expect, it } from 'vitest';

import { bucket } from './model.js';

describe('readings gathered into bars', () => {
  it('take a measure’s mean over each slot, at most one bar a reading', () => {
    expect(bucket([1, 3, 5, 7, 9, 11], 3, 'mean')).toEqual([2, 6, 10]);
    expect(bucket([1, 2, 3], 6, 'mean')).toEqual([1, 2, 3]);
    expect(bucket([], 24, 'mean')).toEqual([]);
  });

  it('take what a counter gained over each slot, a reset counted from nothing', () => {
    expect(bucket([10, 11, 13, 16, 20, 25], 3, 'change')).toEqual([1, 5, 9]);
    // from the slot before's last reading: 11 → 2 is a reset (2 counted since), 2 → 9 gained 7
    expect(bucket([10, 11, 13, 2, 4, 9], 3, 'increase')).toEqual([1, 2, 7]);
    expect(bucket([10, 11, 13, 2, 4, 9], 3, 'change')).toEqual([1, -9, 7]);
  });

  it('spread readings that do not divide evenly over the slots', () => {
    expect(bucket([1, 2, 3, 4, 5, 6, 7], 3, 'mean')).toEqual([1.5, 3.5, 6]);
  });
});
