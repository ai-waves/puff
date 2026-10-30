import { describe, expect, it } from 'vitest';
import { PHYSICS, PUFF, SIM_STEP } from './constants';
import { LEVEL_1_1 } from './level11';
import type { Level } from './level';
import { createSim, isTipped, puffX, setHeld, step, type Sim } from './sim';

const SPEED = 120;

// Runs the sim for `seconds` with the given hold state, returning all events.
function run(sim: Sim, seconds: number, held: boolean) {
  setHeld(sim, held);
  const events = [];
  const steps = Math.round(seconds / SIM_STEP);
  for (let i = 0; i < steps; i++) events.push(...step(sim, SIM_STEP));
  return events;
}

// A flat strip with no walls, long enough for each test.
const flat: Level = {
  ...LEVEL_1_1,
  id: 'test',
  burrowX: 100000,
  solids: [],
  seeds: [],
  checkpoints: [],
};

describe('Level 1-1 data', () => {
  it('has three seeds, one bloom, and no lethal content', () => {
    expect(LEVEL_1_1.seeds).toHaveLength(3);
    expect(LEVEL_1_1.checkpoints).toHaveLength(1);
    expect(LEVEL_1_1.solids.every((s) => s.kind !== undefined)).toBe(true);
  });

  it('keeps the hollow log corridor at the design gap of 110pt', () => {
    const roof = LEVEL_1_1.solids.find((s) => s.id === 'log-roof')!;
    const floor = LEVEL_1_1.solids.find((s) => s.id === 'log-floor')!;
    expect(floor.y0 - roof.y1).toBe(110);
  });

  it('places the burrow at the 1:05 beat, 7,800pt at 120 pt/s', () => {
    expect(LEVEL_1_1.burrowX / SPEED).toBe(65);
  });
});

describe('waiting and hold', () => {
  it('does not scroll until the first hold', () => {
    const sim = createSim(flat, SPEED);
    run(sim, 2, false);
    expect(sim.phase).toBe('waiting');
    expect(sim.scrollX).toBe(0);
  });

  it('starts the run on the first hold', () => {
    const sim = createSim(flat, SPEED);
    const events = run(sim, 0.05, true);
    expect(sim.phase).toBe('running');
    expect(events[0]).toEqual({ type: 'start' });
  });
});

describe('lift and gravity', () => {
  it('rises while held and falls once released', () => {
    const sim = createSim(flat, SPEED);
    run(sim, 0.1, true);
    const before = sim.puffY;
    run(sim, 0.5, true);
    expect(sim.puffY).toBeLessThan(before);

    const apex = sim.puffY;
    run(sim, 0.5, false);
    expect(sim.puffY).toBeGreaterThan(apex);
  });

  it('keeps the net lift at lift minus gravity while held', () => {
    const sim = createSim(flat, SPEED);
    run(sim, 0.01, true);
    const v0 = sim.puffVy;
    run(sim, 1, true);
    // puffVy is positive when falling, so a net rise shows up as a drop in puffVy.
    expect(v0 - sim.puffVy).toBeCloseTo(PHYSICS.lift - PHYSICS.gravity, 0);
  });

  it('stays under the roof when held for a long time', () => {
    const sim = createSim(flat, SPEED);
    run(sim, 10, true);
    expect(sim.puffY).toBeGreaterThanOrEqual(flat.roofY + PUFF.radius);
  });
});

describe('bumps', () => {
  it('pushes Puff back from a mound and never ends the run', () => {
    const sim = createSim(LEVEL_1_1, SPEED);
    // Hold off the ground long enough to reach the first mound, then sit on the floor.
    run(sim, 0.01, true);
    setHeld(sim, false);
    sim.puffY = LEVEL_1_1.floorY - PUFF.radius;
    sim.puffVy = 0;
    run(sim, 6, false);
    expect(sim.bumps).toBeGreaterThan(0);
    expect(sim.phase).toBe('running');
  });

  it('clears a mound by holding over it', () => {
    const sim = createSim(LEVEL_1_1, SPEED);
    run(sim, 0.01, true);
    // Hold for the first 5 s. That climbs above the mound at 480pt and clears it.
    run(sim, 4.5, true);
    expect(puffX(sim)).toBeGreaterThan(480);
    expect(sim.bumps).toBe(0);
  });
});

describe('seeds and checkpoints', () => {
  it('collects a seed that Puff flies through', () => {
    const level: Level = { ...flat, seeds: [{ id: 'a', x: 50, y: 150 }] };
    const sim = createSim(level, SPEED);
    const events = run(sim, 0.5, true);
    expect(sim.seeds.has('a')).toBe(true);
    expect(events).toContainEqual({ type: 'seed', id: 'a' });
  });

  it('marks a checkpoint once Puff passes it', () => {
    const level: Level = { ...flat, checkpoints: [{ id: 'c', x: 30 }] };
    const sim = createSim(level, SPEED);
    run(sim, 0.01, true);
    run(sim, 1, true);
    expect(sim.checkpoints.has('c')).toBe(true);
  });
});

describe('plank tipping', () => {
  const plankLevel: Level = {
    ...flat,
    solids: [
      { id: 'plank', kind: 'plank', x0: 0, x1: 500, y0: 282, y1: 296 },
    ],
    seeds: [{ id: 'hidden', x: 150, y: 322 }],
  };

  it('tips when Puff lands on it, then lets Puff through to the seed', () => {
    const sim = createSim(plankLevel, SPEED);
    // Start Puff above the plank and let it fall.
    run(sim, 0.01, true);
    setHeld(sim, false);
    sim.puffY = 200;
    sim.puffVy = 0;
    const events = run(sim, 1, false);
    expect(isTipped(sim)).toBe(true);
    expect(events).toContainEqual({ type: 'tip' });
    expect(sim.seeds.size).toBe(0);
  });

  it('does not tip when Puff hits the underside', () => {
    const sim = createSim(plankLevel, SPEED);
    run(sim, 0.01, true);
    setHeld(sim, false);
    sim.puffY = 330;
    sim.puffVy = -200;
    run(sim, 0.2, false);
    expect(isTipped(sim)).toBe(false);
  });
});

describe('burrow', () => {
  it('wins when Puff reaches the burrow', () => {
    const level: Level = { ...flat, burrowX: 60 };
    const sim = createSim(level, SPEED);
    const events = run(sim, 1, true);
    expect(sim.phase).toBe('won');
    expect(events).toContainEqual({ type: 'win' });
  });
});
