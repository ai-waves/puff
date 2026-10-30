import { PUFF_SCREEN_X, SIM_STEP } from '../config/constants';
import { createSim, destroySim, restore, retryFromCheckpoint, setHeld, snapshot, step, type Sim, type Snapshot } from './sim';
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
  routeWeight?: number; // how hard to keep to the designer's line, in score per pt off it
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

// How far the leader is off the designer's line, if there's one here. A seed's own line wins over
// the level's where they overlap.
function offRoute(routes: [number, number][][], x: number, y: number): number {
  for (const route of routes) {
    for (let i = 1; i < route.length; i++) {
      const [x0, y0] = route[i - 1]!;
      const [x1, y1] = route[i]!;
      if (x >= x0 && x <= x1 && x1 - x0 <= 600) return Math.abs(y - (y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)));
    }
  }
  return 0;
}

// Keep the best nodes, but spread across heights and sizes: puzzles here are solved by flying low
// onto a log, high over a wheel, or swollen onto a heavy log, and a beam of near-identical cruising
// lines would miss them.
function select(nodes: { node: Node; band: string }[], beam: number): Node[] {
  nodes.sort((a, b) => b.node.score - a.node.score);
  // Bands in order of their best node; each band's nodes best first.
  const bands = new Map<string, Node[]>();
  for (const { node, band } of nodes) bands.set(band, [...(bands.get(band) ?? []), node]);
  const queues = [...bands.values()];
  const out: Node[] = [];
  for (let round = 0; out.length < beam && queues.some((q) => q.length > round); round++) {
    for (const q of queues) if (q[round] && out.length < beam) out.push(q[round]!);
  }
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
  // Sent after one seed, follow that seed's line where it has one.
  const target = opts.seedWeights ? opts.seedWeights.indexOf(Math.max(...opts.seedWeights)) : -1;
  const routes = [def.seeds[target]?.route, def.route].filter((r): r is [number, number][] => !!r);

  setHeld(sim, true);
  step(sim);

  let frontier: Node[] = [{ snap: snapshot(sim), plan: [], score: 0 }];
  let best: Node = frontier[0]!;

  while (frontier.length) {
    const next = new Map<string, { node: Node; band: string }>();
    // Every line reaches the burrow at about the same moment, so take the best of this round's
    // finishers rather than the first.
    let finished: { result: SolveResult; score: number } | null = null;
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
          const seedScore = s.seeds.reduce((sum, got, i) => sum + (got ? (opts.seedWeights?.[i] ?? seedWeight) : 0), 0);
          const score = seedScore + s.home * cloneWeight - s.deaths * 400;
          if (!finished || score > finished.score) {
            finished = { score, result: { won: true, time: s.t, seeds: s.seeds.filter(Boolean).length, home: s.home, deaths: s.deaths, bestX: def.burrowX, got: [...s.seeds], plan } };
          }
          continue;
        }
        // A player on the fail screen taps Retry, so the search does too. The death still counts.
        if (s.phase === 'failed') retryFromCheckpoint(sim);
        const x = pace(sim);
        const seedScore = s.seeds.reduce((sum, got, i) => sum + (got ? (opts.seedWeights?.[i] ?? seedWeight) : 0), 0);
        // Tipping logs is how puzzles open, so a tip counts as progress for the search.
        const lead = s.puffs[0];
        const guide = lead ? offRoute(routes, lead.x, lead.y) * (opts.routeWeight ?? 1) : 0;
        const score = x + seedScore + s.puffs.length * cloneWeight + s.tips * 150 - s.deaths * 400 - guide;
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
          // Lines that look alike can differ in what they've set in motion: a Puff's size, the
          // orbs it has used, the gates it has opened and where the pebbles have rolled.
          s.puffs.map((p) => Math.round(p.r / 4)).join(','),
          s.orbs.map((o) => (o.poppedAt === null ? 0 : 1)).join(''),
          s.gates.map((g) => (g.open > 0 ? 1 : 0)).join(''),
          s.pebbles.map((p) => Math.round(p.x / 40)).join(','),
        ].join('|');
        const prev = next.get(key);
        // A swollen or shrunken Puff, or a bigger flock, is a different situation at the same height.
        const band = lead ? `${Math.round(lead.y / 30)}|${Math.round(lead.r / 4)}|${s.puffs.length}` : '-';
        if (!prev || prev.node.score < score) next.set(key, { node: { snap: snapshot(sim), plan, score }, band });
      }
    }
    if (finished) return finished.result;
    frontier = select([...next.values()], beam);
    if (frontier[0] && frontier[0].score > best.score) best = frontier[0];
    if (frontier[0] && frontier[0].snap.s.t > maxTime) break;
  }

  restore(sim, best.snap);
  const s = sim.s;
  return { won: false, time: s.t, seeds: s.seeds.filter(Boolean).length, home: 0, deaths: s.deaths, bestX: progressX(sim), got: [...s.seeds], plan: best.plan };
}
