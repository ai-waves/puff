import { describe, expect, it } from 'vitest';
import { difficulty, tuning } from './tuning';

describe('difficulty ramp', () => {
  it('matches the numbers the board prints for chapter 1', () => {
    // Board: D / pt/s / gap / tap window / checkpoint spacing / spin, from renderVals().
    const expected = [
      { speed: 120, gap: 110, tapWindowMs: 600, checkpointSpacing: 3600, spin: 90 },
      { speed: 121, gap: 109, tapWindowMs: 594, checkpointSpacing: 3636, spin: 91 },
      { speed: 122, gap: 108, tapWindowMs: 588, checkpointSpacing: 3672, spin: 92 },
      { speed: 124, gap: 107, tapWindowMs: 582, checkpointSpacing: 3709, spin: 93 },
      { speed: 125, gap: 106, tapWindowMs: 577, checkpointSpacing: 3746, spin: 94 },
    ];
    expected.forEach((e, i) => {
      const t = tuning(i + 1);
      expect({ ...t, speed: Math.round(t.speed) }).toMatchObject(e);
    });
  });

  it('reaches 1.47x at level 40', () => {
    expect(difficulty(40).toFixed(2)).toBe('1.47');
  });
});
