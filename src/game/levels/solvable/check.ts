import { describe, expect, it } from 'vitest';
import { solve } from '../../solver';
import { levelById } from '../index';

// Slow checks (several minutes): a beam-search player proves a level can be finished, each of its
// seeds can be collected, and its clone badge can be earned, all in the real Box2D simulation.
// One file per level, so Vitest runs levels side by side. Run with `npm run test:levels`.

// Wider searches for the few seeds that hang on a beat, like 1-5's rhythm seed.
const SEED_BEAM: Record<string, number> = { 'up-beat': 128 };

export function checkLevel(id: string): void {
  const level = levelById(id)!;
  describe(`${level.id} ${level.name}`, () => {
    it('can be finished', () => {
      const r = solve(level, { beam: 32 });
      expect(r.won).toBe(true);
    }, 300_000);

    it.each(level.seeds.map((s, i) => [s.id, i] as const))('seed %s can be collected', (seedId, i) => {
      const r = solve(level, { beam: SEED_BEAM[seedId] ?? 32, seedWeights: level.seeds.map((_, j) => (j === i ? 5000 : 0)) });
      expect(r.won && r.got[i]).toBe(true);
    }, 600_000);

    it.runIf(level.goalClones > 1)('the clone badge can be earned', () => {
      const r = solve(level, { beam: 64, cloneWeight: 1500, seedWeight: 0 });
      expect(r.won).toBe(true);
      expect(r.home).toBeGreaterThanOrEqual(level.goalClones);
    }, 600_000);
  });
}
