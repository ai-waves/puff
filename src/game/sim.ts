import { BUMP_BACK, LAG_RECOVERY, PHYSICS, PUFF, SIM_STEP } from './constants';
import type { Level, Solid } from './level';

// Pure, fixed-step simulation. No rendering, no Phaser, so it can run under Node in tests.
// Puff can't die in chapter 1: bumps push it back, nothing ends the run.

export type SimEvent =
  | { type: 'start' }
  | { type: 'bump'; solidId: string }
  | { type: 'tip' }
  | { type: 'seed'; id: string }
  | { type: 'checkpoint'; id: string }
  | { type: 'win' };

export interface Sim {
  readonly level: Level;
  readonly scrollSpeed: number;
  phase: 'waiting' | 'running' | 'won';
  time: number; // s, counts only while running
  scrollX: number; // the level's clock: distance the stage has scrolled
  lag: number; // <= 0, set by bumps; Puff's travel is scrollX + lag
  puffY: number;
  puffVy: number;
  held: boolean;
  lastReleaseAt: number; // s, for the hint timing
  tippedAt: number | null; // s, when the plank was tipped
  bumps: number;
  seeds: Set<string>;
  checkpoints: Set<string>;
  touching: Set<string>;
}

export function createSim(level: Level, scrollSpeed: number): Sim {
  return {
    level,
    scrollSpeed,
    phase: 'waiting',
    time: 0,
    scrollX: 0,
    lag: 0,
    puffY: 150, // resting on the dandelion head
    puffVy: 0,
    held: false,
    lastReleaseAt: 0,
    tippedAt: null,
    bumps: 0,
    seeds: new Set(),
    checkpoints: new Set(),
    touching: new Set(),
  };
}

export function puffX(sim: Sim): number {
  return sim.scrollX + sim.lag;
}

export function isTipped(sim: Sim): boolean {
  return sim.tippedAt !== null;
}

export function setHeld(sim: Sim, held: boolean): void {
  if (sim.held && !held) sim.lastReleaseAt = sim.time;
  sim.held = held;
}

export function isSolid(sim: Sim, solid: Solid): boolean {
  return !(solid.kind === 'plank' && isTipped(sim));
}

export function step(sim: Sim, dt: number = SIM_STEP): SimEvent[] {
  const events: SimEvent[] = [];
  if (sim.phase === 'won') return events;
  if (sim.phase === 'waiting') {
    if (!sim.held) return events;
    sim.phase = 'running';
    events.push({ type: 'start' });
  }

  sim.time += dt;
  sim.scrollX += sim.scrollSpeed * dt;
  sim.lag = Math.min(0, sim.lag + LAG_RECOVERY * dt);

  // Screen y grows downward, so puffVy > 0 means falling. Lift pushes against that.
  const accel = PHYSICS.gravity - (sim.held ? PHYSICS.lift : 0);
  sim.puffVy = clamp(sim.puffVy + accel * dt, -PHYSICS.maxVy, PHYSICS.maxVy);
  sim.puffY += sim.puffVy * dt;

  const { level } = sim;
  const r = PUFF.radius;
  if (sim.puffY < level.roofY + r) {
    sim.puffY = level.roofY + r;
    sim.puffVy = Math.max(sim.puffVy, 0);
  }
  if (sim.puffY > level.floorY - r) {
    sim.puffY = level.floorY - r;
    sim.puffVy = Math.min(sim.puffVy, 0);
  }

  const contacts = new Set<string>();
  for (const solid of level.solids) {
    if (!isSolid(sim, solid)) continue;
    const wasTipped = isTipped(sim);
    if (resolveSolid(sim, solid)) contacts.add(solid.id);
    if (!wasTipped && isTipped(sim)) events.push({ type: 'tip' });
  }
  for (const id of contacts) {
    if (!sim.touching.has(id)) {
      sim.bumps += 1;
      events.push({ type: 'bump', solidId: id });
    }
  }
  sim.touching = contacts;

  const x = puffX(sim);
  for (const seed of level.seeds) {
    if (sim.seeds.has(seed.id)) continue;
    if (Math.hypot(x - seed.x, sim.puffY - seed.y) < r + 10) {
      sim.seeds.add(seed.id);
      events.push({ type: 'seed', id: seed.id });
    }
  }
  for (const checkpoint of level.checkpoints) {
    if (sim.checkpoints.has(checkpoint.id) || x < checkpoint.x) continue;
    sim.checkpoints.add(checkpoint.id);
    events.push({ type: 'checkpoint', id: checkpoint.id });
  }

  if (x >= level.burrowX) {
    sim.phase = 'won';
    events.push({ type: 'win' });
  }
  return events;
}

// Circle against rectangle. Returns true when Puff is touching the solid this step.
function resolveSolid(sim: Sim, solid: Solid): boolean {
  const px = puffX(sim);
  const py = sim.puffY;
  const r = PUFF.radius;
  const cx = clamp(px, solid.x0, solid.x1);
  const cy = clamp(py, solid.y0, solid.y1);
  const dx = px - cx;
  const dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;

  if (d2 === 0) {
    // Centre is inside the rectangle: treat it as a vertical hit on the nearer face.
    const above = py - solid.y0;
    const below = solid.y1 - py;
    if (above <= below) {
      sim.puffY = solid.y0 - r;
      landOn(sim, solid);
    } else {
      sim.puffY = solid.y1 + r;
      sim.puffVy = Math.max(sim.puffVy, 0);
    }
    return true;
  }

  const d = Math.sqrt(d2);
  const nx = dx / d;
  const ny = dy / d;
  const pen = r - d;
  if (Math.abs(ny) >= Math.abs(nx)) {
    sim.puffY += ny * pen;
    if (ny < 0) landOn(sim, solid);
    else sim.puffVy = Math.max(sim.puffVy, 0);
  } else if (nx < 0) {
    // Hit from the left: bump back, then recover over time.
    sim.lag = Math.min(sim.lag, solid.x0 - r - BUMP_BACK - sim.scrollX);
  }
  return true;
}

function landOn(sim: Sim, solid: Solid): void {
  if (sim.puffVy > 0 && solid.kind === 'plank' && !isTipped(sim)) {
    sim.tippedAt = sim.time;
  }
  sim.puffVy = Math.min(sim.puffVy, 0);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
