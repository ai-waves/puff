import { SIM_STEP } from '../config/constants';
import { createSim, setHeld, step, type Sim, type SimState } from './sim';
import type { LevelDef } from './types';

// Beam search over hold/release decisions. Because the sim is deterministic, a plan found here
// replays exactly, which proves a level can be finished. Used by tests, never shipped in the game.

export interface SolveOptions {
  beam?: number;
  decision?: number; // seconds between hold/release decisions
  maxTime?: number; // give up after this much level time
  seedWeight?: number; // how much a seed is worth in pt of progress
  cloneWeight?: number; // how much a living clone is worth
  seedWeights?: number[]; // per-seed override, to send the search after one seed
}

export interface SolveResult {
  won: boolean;
  time: number;
  seeds: number;
  home: number;
  deaths: number;
  bestX: number;
  got: boolean[]; // which seeds were collected
  plan: boolean[];
}

interface Node {
  sim: Sim;
  plan: boolean[];
  score: number;
}

function cloneSim(sim: Sim): Sim {
  return { def: sim.def, speed: sim.speed, s: structuredClone(sim.s) as SimState };
}

function progressX(sim: Sim): number {
  const lead = sim.s.puffs[0];
  return lead ? lead.x : (sim.s.checkpoint?.x ?? sim.def.startX);
}

export function solve(def: LevelDef, opts: SolveOptions = {}): SolveResult {
  const beam = opts.beam ?? 48;
  const decision = opts.decision ?? 0.1;
  const maxTime = opts.maxTime ?? 240;
  const seedWeight = opts.seedWeight ?? 250;
  const cloneWeight = opts.cloneWeight ?? 120;
  const stepsPerDecision = Math.round(decision / SIM_STEP);

  const root = createSim(def);
  setHeld(root, true);
  step(root);

  let frontier: Node[] = [{ sim: root, plan: [], score: 0 }];
  let best: Node = frontier[0]!;

  while (frontier.length) {
    const next = new Map<string, Node>();
    for (const node of frontier) {
      for (const held of [true, false]) {
        const sim = cloneSim(node.sim);
        setHeld(sim, held);
        for (let i = 0; i < stepsPerDecision; i++) {
          step(sim, SIM_STEP);
          if (sim.s.phase === 'won' || sim.s.phase === 'failed') break;
        }
        const plan = [...node.plan, held];
        const s = sim.s;
        if (s.phase === 'won') {
          return { won: true, time: s.t, seeds: s.seeds.filter(Boolean).length, home: s.home, deaths: s.deaths, bestX: def.burrowX, got: [...s.seeds], plan };
        }
        if (s.phase === 'failed') continue;
        const x = progressX(sim);
        const seedScore = s.seeds.reduce((sum, got, i) => sum + (got ? (opts.seedWeights?.[i] ?? seedWeight) : 0), 0);
        // Tipping logs is how puzzles open, so a tip counts as progress for the search.
        const score = x + seedScore + s.puffs.length * cloneWeight + s.tips * 150 - s.deaths * 400;
        const lead = s.puffs[0];
        const key = [
          Math.round(x / 10),
          lead ? Math.round(lead.y / 12) : -1,
          lead ? Math.round(lead.vy / 80) : 0,
          s.puffs.length,
          s.seeds.map(Number).join(''),
          s.seesaws.map((w) => w.side).join(''),
          s.phase,
        ].join('|');
        const prev = next.get(key);
        if (!prev || prev.score < score) next.set(key, { sim, plan, score });
      }
    }
    frontier = [...next.values()].sort((a, b) => b.score - a.score).slice(0, beam);
    if (frontier[0] && frontier[0].score > best.score) best = frontier[0];
    if (frontier[0] && frontier[0].sim.s.t > maxTime) break;
  }

  const s = best.sim.s;
  return { won: false, time: s.t, seeds: s.seeds.filter(Boolean).length, home: 0, deaths: s.deaths, bestX: progressX(best.sim), got: [...s.seeds], plan: best.plan };
}
