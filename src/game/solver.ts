import { PUFF_SCREEN_X, SIM_STEP } from '../config/constants';
import { createSim, destroySim, restore, setHeld, snapshot, step, type Sim, type Snapshot } from './sim';
import type { LevelDef } from './types';

// Beam search over hold/release decisions. The sim is deterministic and a Box2D snapshot restores
// any moment exactly, so a plan found here replays exactly, which proves a level can be finished.
// Used by tests, never shipped in the game.

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
  snap: Snapshot;
  plan: boolean[];
  score: number;
}

function progressX(sim: Sim): number {
  const lead = sim.s.puffs[0];
  return lead ? lead.x : (sim.s.checkpoint?.x ?? sim.def.startX);
}

// The scroll sets the pace, so being ahead of Puff's spot on screen is worth nothing; falling
// behind it is what costs. Capping progress there keeps low and high lines level in the search.
function pace(sim: Sim): number {
  return Math.min(progressX(sim), sim.s.camX + PUFF_SCREEN_X + 10);
}

// Keep the best nodes, but spread across heights: puzzles here are solved by flying low onto a
// log or high over a wheel, and a beam of near-identical cruising lines would miss them.
function select(nodes: { node: Node; band: number }[], beam: number): Node[] {
  nodes.sort((a, b) => b.node.score - a.node.score);
  const top = nodes[0]?.node.score ?? 0;
  const bands = new Map<number, Node[]>();
  const rest: Node[] = [];
  for (const { node, band } of nodes) {
    if (node.score < top - 120) rest.push(node);
    else bands.set(band, [...(bands.get(band) ?? []), node]);
  }
  const out: Node[] = [];
  const queues = [...bands.values()];
  for (let round = 0; out.length < beam && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && out.length < beam) out.push(q[round]!);
  }
  for (const node of rest) if (out.length < beam) out.push(node);
  return out;
}

export function solve(def: LevelDef, opts: SolveOptions = {}): SolveResult {
  const sim = createSim(def);
  try {
    return search(sim, opts);
  } finally {
    destroySim(sim);
  }
}

function search(sim: Sim, opts: SolveOptions): SolveResult {
  const def = sim.def;
  const beam = opts.beam ?? 48;
  const decision = opts.decision ?? 0.1;
  const maxTime = opts.maxTime ?? 240;
  const seedWeight = opts.seedWeight ?? 250;
  const cloneWeight = opts.cloneWeight ?? 120;
  const stepsPerDecision = Math.round(decision / SIM_STEP);

  setHeld(sim, true);
  step(sim);

  let frontier: Node[] = [{ snap: snapshot(sim), plan: [], score: 0 }];
  let best: Node = frontier[0]!;

  while (frontier.length) {
    const next = new Map<string, { node: Node; band: number }>();
    for (const node of frontier) {
      // A Puff waiting to re-form only moves on with a hold.
      const choices = node.snap.s.phase === 'waiting' ? [true] : [true, false];
      for (const held of choices) {
        restore(sim, node.snap);
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
        const x = pace(sim);
        const seedScore = s.seeds.reduce((sum, got, i) => sum + (got ? (opts.seedWeights?.[i] ?? seedWeight) : 0), 0);
        // Tipping logs is how puzzles open, so a tip counts as progress for the search.
        const score = x + seedScore + s.puffs.length * cloneWeight + s.tips * 150 - s.deaths * 400;
        const lead = s.puffs[0];
        const key = [
          Math.round(x / 20),
          lead ? Math.round(lead.y / 12) : -1,
          lead ? Math.round(lead.vy / 80) : 0,
          Math.round(s.camX / 20),
          s.puffs.length,
          s.seeds.map(Number).join(''),
          s.seesaws.map((w) => w.side).join(''),
          s.phase,
          s.deaths,
        ].join('|');
        const prev = next.get(key);
        if (!prev || prev.node.score < score) next.set(key, { node: { snap: snapshot(sim), plan, score }, band: lead ? Math.round(lead.y / 30) : -1 });
      }
    }
    frontier = select([...next.values()], beam);
    if (frontier[0] && frontier[0].score > best.score) best = frontier[0];
    if (frontier[0] && frontier[0].snap.s.t > maxTime) break;
  }

  restore(sim, best.snap);
  const s = sim.s;
  return { won: false, time: s.t, seeds: s.seeds.filter(Boolean).length, home: 0, deaths: s.deaths, bestX: progressX(sim), got: [...s.seeds], plan: best.plan };
}
