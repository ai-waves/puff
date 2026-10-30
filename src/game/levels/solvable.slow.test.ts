import { describe, expect, it } from 'vitest';
import { solve } from '../solver';
import { LEVELS } from './index';

// Slow checks (several minutes): a beam-search player proves each level can be finished,
// each seed can be collected, and the clone badges can be earned. Run with `npm run test:levels`.
describe.each(LEVELS)('$id $name', (level) => {
  it('can be finished', () => {
    const r = solve(level, { beam: 48 });
    expect(r.won).toBe(true);
  }, 120_000);

  it.each(level.seeds.map((s, i) => [s.id, i] as const))('seed %s can be collected', (_id, i) => {
    // A wide beam, so seeds that need waiting for a beat (1-5's rhythm seed) aren't pruned away.
    const r = solve(level, { beam: 128, seedWeights: level.seeds.map((_, j) => (j === i ? 5000 : 0)) });
    expect(r.won && r.got[i]).toBe(true);
  }, 120_000);

  it.runIf(level.goalClones > 1)('the clone badge can be earned', () => {
    const r = solve(level, { beam: 128, cloneWeight: 1500, seedWeight: 0 });
    expect(r.won).toBe(true);
    expect(r.home).toBeGreaterThanOrEqual(level.goalClones);
  }, 300_000);
});
