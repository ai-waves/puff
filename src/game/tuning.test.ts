import { describe, expect, it } from 'vitest';
import { difficulty, tuningFor } from './tuning';

describe('difficulty ramp', () => {
  it('leaves level 1-1 at the base numbers', () => {
    expect(difficulty(1)).toBe(1);
    expect(tuningFor(1)).toMatchObject({
      scrollSpeed: 120,
      narrowestGap: 110,
      tapWindowMs: 600,
      checkpointSpacing: 3600,
      hazardSpeed: 90,
    });
  });

  it('reaches about 1.47x at level 40, as the board says', () => {
    expect(difficulty(40)).toBeGreaterThan(1.46);
    expect(difficulty(40)).toBeLessThan(1.48);
  });

  it('speeds the world up and tightens gaps as levels rise', () => {
    const early = tuningFor(5);
    const late = tuningFor(40);
    expect(late.scrollSpeed).toBeGreaterThan(early.scrollSpeed);
    expect(late.narrowestGap).toBeLessThan(early.narrowestGap);
  });
});
