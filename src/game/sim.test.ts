import { describe, expect, it } from 'vitest';
import { CLONE_RADIUS, CLONE_SPREAD, PHYSICS, PLAYFIELD, SIM_STEP } from '../config/constants';
import { createSim, gateBottom, retryFromCheckpoint, seedPosition, setHeld, step, type Sim, type SimEvent } from './sim';
import type { LevelDef } from './types';

const FLOOR = PLAYFIELD.floorY;

function level(over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    n: 1,
    world: 1,
    name: 'Test',
    blurb: '',
    teach: '',
    length: 100000,
    startX: 100,
    startY: 180,
    burrowX: 99999,
    sky: [[0, 0], [1, 0]],
    sunX: 0,
    sunY: 0,
    deaths: 'none',
    goalClones: 1,
    rects: [],
    humps: [],
    briars: [],
    seesaws: [],
    gates: [],
    curtains: [],
    wheels: [],
    pebbles: [],
    seeds: [],
    bubbles: [],
    blooms: [],
    ...over,
  };
}

function run(sim: Sim, seconds: number, held: boolean): SimEvent[] {
  setHeld(sim, held);
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_STEP);
  for (let i = 0; i < steps; i++) events.push(...step(sim));
  return events;
}

// Hold for one step to wake Puff, then let go.
function started(def: LevelDef): Sim {
  const sim = createSim(def);
  run(sim, SIM_STEP, true);
  setHeld(sim, false);
  return sim;
}

const types = (events: SimEvent[]) => events.map((e) => e.type);

describe('waking and flying', () => {
  it('waits for the first hold', () => {
    const sim = createSim(level());
    run(sim, 2, false);
    expect(sim.s.phase).toBe('waiting');
    expect(types(run(sim, SIM_STEP, true))).toContain('start');
  });

  it('rises at lift minus gravity while held and falls when released', () => {
    const sim = started(level());
    const v0 = sim.s.puffs[0]!.vy;
    run(sim, 1, true);
    expect(v0 - sim.s.puffs[0]!.vy).toBeCloseTo(PHYSICS.lift - PHYSICS.gravity, 0);
    const before = sim.s.puffs[0]!.vy;
    run(sim, 0.5, false);
    expect(sim.s.puffs[0]!.vy).toBeGreaterThan(before);
  });
});

describe('bumps', () => {
  it('pushes Puff back from a wall without ending the run', () => {
    const sim = started(level({ rects: [{ id: 'wall', x0: 300, x1: 340, y0: 14, y1: FLOOR }] }));
    const events = run(sim, 3, false);
    expect(types(events)).toContain('bump');
    expect(sim.s.puffs[0]!.x).toBeLessThan(300 - 14);
    expect(sim.s.phase).toBe('running');
  });

  it('bounces off a moss mound', () => {
    const sim = started(level({ startY: 150, humps: [{ id: 'm', cx: 160, width: 400, height: 120 }] }));
    let rose = false;
    for (let i = 0; i < 120; i++) {
      step(sim);
      if (sim.s.puffs[0]!.vy < -1) rose = true;
    }
    expect(rose).toBe(true);
  });
});

describe('Mossback logs', () => {
  const log = (over = {}) => ({ id: 'log', px: 300, py: 300, half: 100, high: 'right' as const, ...over });

  it('tips when Puff lands on the high end', () => {
    const sim = started(level({ startX: 330, startY: 240, seesaws: [log()] }));
    const events = run(sim, 0.8, false);
    expect(types(events)).toContain('tip');
    expect(sim.s.seesaws[0]!.side).toBe(-1);
  });

  it('does not tip when Puff lands on the low end', () => {
    const sim = started(level({ startX: 330, startY: 240, seesaws: [log({ high: 'left' })] }));
    expect(types(run(sim, 0.8, false))).not.toContain('tip');
  });

  it('bounces Puff off the wrong log without tipping it', () => {
    const sim = started(level({ startX: 330, startY: 240, seesaws: [log({ mode: 'dud' })] }));
    const events = run(sim, 0.6, false);
    expect(types(events)).not.toContain('tip');
    expect(sim.s.puffs[0]!.y).toBeLessThan(260);
  });

  it('opens a latched gate and keeps it open', () => {
    const sim = started(level({ startX: 330, startY: 240, seesaws: [log()], gates: [{ id: 'g', x: 900, openBottom: 250, link: 'log', mode: 'latch' }] }));
    run(sim, 3, false);
    expect(sim.s.gates[0]!.open).toBe(1);
    expect(gateBottom(sim, 0)).toBe(250);
  });

  it('starts a timed gate closing when Puff comes near, and shuts it over 3s', () => {
    const sim = started(level({ startX: 330, startY: 240, seesaws: [log()], gates: [{ id: 'g', x: 1200, openBottom: 200, link: 'log', mode: 'timed', closeTime: 3, closeAhead: 260 }] }));
    run(sim, 1, false);
    expect(sim.s.gates[0]!.open).toBe(1);
    expect(sim.s.gates[0]!.closingAt).toBeNull();
    run(sim, 4.5, true); // Puff reaches within 260pt of the gate
    expect(sim.s.gates[0]!.closingAt).not.toBeNull();
    run(sim, 3.2, true);
    expect(sim.s.gates[0]!.open).toBe(0);
  });

  it('drifts Puff back to try again after 3s against a closed gate', () => {
    const sim = started(level({ gates: [{ id: 'g', x: 300, openBottom: 250, link: 'log', mode: 'latch' }], seesaws: [log({ px: 2000 })] }));
    const events = run(sim, 6, false);
    expect(events).toContainEqual({ type: 'respawn', rewind: true });
    expect(sim.s.puffs[0]!.x).toBeLessThan(300);
  });

  it('lets a pebble tip a log: props move other props', () => {
    const sim = started(level({ startY: 100, seesaws: [log()], pebbles: [{ id: 'p', x: 380, y: 200, r: 14 }] }));
    expect(types(run(sim, 1, false))).toContain('tip');
  });
});

describe('pebbles', () => {
  it('rolls ahead when Puff bumps it', () => {
    const sim = started(level({ startY: FLOOR - 15, pebbles: [{ id: 'p', x: 300, y: FLOOR - 16, r: 16 }] }));
    const events = run(sim, 2, false);
    expect(types(events)).toContain('push');
    expect(sim.s.pebbles[0]!.x).toBeGreaterThan(300);
  });

  it('jams a thornwheel it rolls into', () => {
    const sim = started(level({
      startY: 60,
      pebbles: [{ id: 'p', x: 300, y: FLOOR - 16, r: 16 }],
      wheels: [{ id: 'w', cx: 420, cy: 300, r: 50, spin: 90, jammable: true }],
    }));
    sim.s.pebbles[0]!.vx = 150;
    const events = run(sim, 2, true);
    expect(types(events)).toContain('jam');
    const angle = sim.s.wheels[0]!.angle;
    run(sim, 1, true);
    expect(sim.s.wheels[0]!.angle).toBe(angle);
  });
});

describe('death and respawn', () => {
  const briar = { id: 'b', x0: 400, base: FLOOR, side: 'up' as const, spikes: [80, 80, 80] };

  it('respawns instantly at the last bloom when the level has no fail screen', () => {
    const sim = started(level({ deaths: 'instant', startY: FLOOR - 15, briars: [briar], blooms: [{ id: 'b1', x: 200 }] }));
    const events = run(sim, 3, false);
    expect(types(events)).toContain('lost');
    expect(types(events)).toContain('respawn');
    expect(sim.s.deaths).toBeGreaterThan(0);
    expect(types(events)).not.toContain('fail');
  });

  it('waits on the fail screen in clone levels, then retries from the checkpoint', () => {
    const sim = started(level({ deaths: 'screen', startY: FLOOR - 15, briars: [briar], blooms: [{ id: 'b1', x: 200 }] }));
    const events = run(sim, 3, false);
    expect(events).toContainEqual({ type: 'fail', cause: 'briar' });
    expect(sim.s.phase).toBe('failed');
    retryFromCheckpoint(sim);
    expect(sim.s.phase).toBe('running');
    expect(sim.s.puffs[0]!.x).toBe(200);
    expect(sim.s.freezeUntil).toBeCloseTo(sim.s.t + 1);
  });

  it('kills on a thornwheel, but not inside its missing tooth', () => {
    const wheel = { id: 'w', cx: 400, cy: 180, r: 40, spin: 0, missingTooth: true };
    const facing = started(level({ wheels: [wheel] }));
    facing.s.wheels[0]!.angle = Math.PI; // the gap faces Puff
    facing.s.puffs[0]!.x = 400 - 47;
    facing.s.puffs[0]!.y = 180;
    expect(types(step(facing, 1e-6))).not.toContain('lost');

    const away = started(level({ wheels: [wheel] }));
    away.s.puffs[0]!.x = 400 - 47;
    away.s.puffs[0]!.y = 180;
    expect(types(step(away, 1e-6))).toContain('lost');
  });

  it('carries an orbiting seed around with its wheel', () => {
    const sim = started(level({ wheels: [{ id: 'w', cx: 400, cy: 180, r: 40, spin: 90, missingTooth: true }], seeds: [{ id: 's', x: 0, y: 0, orbit: { wheel: 'w', radius: 46 } }] }));
    expect(seedPosition(sim, 0).x).toBeCloseTo(446);
    sim.s.wheels[0]!.angle = Math.PI / 2;
    expect(seedPosition(sim, 0).y).toBeCloseTo(226);
  });

  it('lifts a thorn curtain while its log is tipped, then drops it', () => {
    const sim = started(level({
      deaths: 'instant',
      startX: 330,
      startY: 240,
      seesaws: [{ id: 'log', px: 300, py: 300, half: 100, high: 'right', mode: 'return', returnAfter: 2 }],
      curtains: [{ id: 'c', x0: 3000, x1: 3024, openBottom: 200, closedBottom: FLOOR - 4, link: 'log' }],
    }));
    run(sim, 1, false);
    expect(sim.s.curtains[0]!.open).toBe(1);
    const events = run(sim, 2, false);
    expect(types(events)).toContain('drop');
    run(sim, 1, false);
    expect(sim.s.curtains[0]!.open).toBe(0);
  });
});

describe('Split bubbles and clones', () => {
  it('splits Puff in two when it touches a bubble', () => {
    const sim = started(level({ bubbles: [{ id: 'b', x: 160, y: 180 }] }));
    const events = run(sim, 1, true);
    expect(types(events)).toContain('pop');
    expect(sim.s.puffs).toHaveLength(2);
    expect(sim.s.puffs[1]!.r).toBe(CLONE_RADIUS);
  });

  it('splits every Puff that touches it, up to 6', () => {
    const sim = started(level({ bubbles: [{ id: 'b', x: 140, y: 190 }, { id: 'c', x: 400, y: 190 }] }));
    for (let i = 0; i < 2; i++) sim.s.puffs.push({ id: 100 + i, x: 95 - 10 * i, y: 180, vy: 0, r: CLONE_RADIUS, bonk: 0 });
    run(sim, 0.6, false);
    expect(sim.s.puffs).toHaveLength(6);
    run(sim, 2, true);
    expect(sim.s.puffs).toHaveLength(6);
  });

  it('copies input to clones with a slight lag', () => {
    const sim = started(level({ bubbles: [{ id: 'b', x: 140, y: 180 }] }));
    run(sim, 0.5, false);
    const [lead, clone] = sim.s.puffs;
    const lv = lead!.vy;
    const cv = clone!.vy;
    run(sim, 5 * SIM_STEP, true);
    expect(lead!.vy).toBeLessThan(lv); // already slowing
    expect(clone!.vy).toBeGreaterThan(cv); // still falling: its input arrives 80ms later
  });

  it('keeps clones within the 45pt spread of the leader', () => {
    const sim = started(level({ bubbles: [{ id: 'b', x: 140, y: 180 }, { id: 'c', x: 600, y: 180 }] }));
    for (let i = 0; i < 40; i++) run(sim, 0.15, i % 3 === 0);
    const lead = sim.s.puffs[0]!;
    for (const p of sim.s.puffs.slice(1)) expect(Math.abs(p.y - lead.y)).toBeLessThanOrEqual(CLONE_SPREAD / 2 + 1e-6);
  });

  it('lets any clone collect a seed', () => {
    const sim = started(level({ seeds: [{ id: 's', x: 0, y: 0 }] }));
    const lead = sim.s.puffs[0]!;
    sim.s.puffs.push({ id: 50, x: lead.x - 16, y: lead.y + 22, vy: lead.vy, r: CLONE_RADIUS, bonk: 0 });
    const clone = sim.s.puffs[1]!;
    (sim.def.seeds[0] as { x: number; y: number }).x = clone.x + 2;
    (sim.def.seeds[0] as { x: number; y: number }).y = clone.y + 8;
    const events = step(sim);
    expect(events).toContainEqual({ type: 'seed', id: 's' });
  });

  it('saves the clone count at a bloom and restores it on respawn', () => {
    const sim = started(level({ deaths: 'instant', bubbles: [{ id: 'b', x: 140, y: 180 }], blooms: [{ id: 'b1', x: 300 }] }));
    run(sim, 2, true);
    expect(sim.s.checkpoint?.count).toBe(2);
    sim.s.puffs = sim.s.puffs.slice(0, 1);
    sim.s.puffs[0]!.y = FLOOR - 15;
    sim.def.briars.push({ id: 'b', x0: sim.s.puffs[0]!.x + 20, base: FLOOR, side: 'up', spikes: [60, 60] });
    setHeld(sim, false);
    let respawned = false;
    for (let i = 0; i < 240 && !respawned; i++) respawned = types(step(sim)).includes('respawn');
    expect(respawned).toBe(true);
    expect(sim.s.puffs).toHaveLength(2);
  });

  it('loses a clone left too far behind', () => {
    const sim = started(level());
    sim.s.puffs.push({ id: 9, x: sim.s.puffs[0]!.x - 400, y: 180, vy: 0, r: CLONE_RADIUS, bonk: 0 });
    expect(step(sim)).toContainEqual(expect.objectContaining({ type: 'lost', cause: 'stranded' }));
  });
});

describe('checkpoints and the burrow', () => {
  it('opens a bloom when the leader passes it', () => {
    const sim = started(level({ blooms: [{ id: 'b1', x: 150 }] }));
    expect(run(sim, 1, true)).toContainEqual({ type: 'checkpoint', id: 'b1' });
  });

  it('wins when the leader reaches the burrow, counting Puffs home', () => {
    const sim = started(level({ burrowX: 200 }));
    expect(run(sim, 1.5, true)).toContainEqual({ type: 'win', home: 1 });
    expect(sim.s.phase).toBe('won');
  });
});

describe('never stuck', () => {
  // Forward speed must never turn into downward speed against something round: beside a pebble on
  // the floor, that pins Puff down however long the player holds.
  it('lets a held Puff rise off the floor beside a pebble wedged against a lip', () => {
    const sim = started(level({
      startX: 240,
      startY: FLOOR - 15,
      pebbles: [{ id: 'p', x: 300, y: FLOOR - 18, r: 18 }],
      rects: [{ id: 'lip', x0: 318, x1: 334, y0: 312, y1: FLOOR }],
    }));
    run(sim, 1, false); // comes to rest against the pebble
    expect(sim.s.puffs[0]!.y).toBeCloseTo(FLOOR - 15, 0);
    run(sim, 0.7, true);
    expect(sim.s.puffs[0]!.y).toBeLessThan(FLOOR - 15 - 25); // rises about as fast as in open air
    run(sim, 1.8, true);
    const p = sim.s.puffs[0]!;
    expect(p.y).toBeLessThan(290);
    expect(p.x).toBeGreaterThan(334);
    // Pebbles are heavy: shoved against the lip, it stays put rather than bouncing back off it.
    expect(sim.s.pebbles[0]!.x).toBeCloseTo(300, 0);
  });

  it('never wedges Puff under a raised log end: it rises up through the log', () => {
    const sim = started(level({ startX: 200, startY: FLOOR - 15, seesaws: [{ id: 'log', px: 400, py: 320, half: 110, high: 'left' }] }));
    run(sim, 1.5, false); // flies low, under the raised end
    run(sim, 3, true);
    const p = sim.s.puffs[0]!;
    expect(p.x).toBeGreaterThan(420);
    expect(p.y).toBeLessThan(300);
  });

  it('still lands on a log from above', () => {
    const sim = started(level({ startX: 300, startY: 200, seesaws: [{ id: 'log', px: 400, py: 300, half: 110, high: 'right', mode: 'dud' }] }));
    run(sim, 0.6, false);
    expect(sim.s.puffs[0]!.y).toBeLessThan(300); // bounced on top, not fallen through
  });

  it('drifts back after 8s with no forward progress at all', () => {
    const sim = started(level({ rects: [{ id: 'wall', x0: 300, x1: 340, y0: 14, y1: FLOOR }], blooms: [{ id: 'b1', x: 150 }] }));
    // Puff reaches the wall at about 1.5s, so it drifts back about 8s later.
    const early = run(sim, 7, true);
    expect(types(early)).not.toContain('respawn');
    const events = run(sim, 3.5, true);
    expect(events).toContainEqual({ type: 'respawn', rewind: true });
    expect(sim.s.puffs[0]!.x).toBeLessThan(300);
  });
});
