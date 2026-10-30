import { afterEach, describe, expect, it } from 'vitest';
import { CLONE_RADIUS, CLONE_SPREAD, PHYSICS, PLAYFIELD, PUFF_RADIUS, PUFF_SCREEN_X, SIM_STEP, SIZE } from '../config/constants';
import { b2 } from './physics';
import {
  createSim,
  crusherBottom,
  destroySim,
  gateBottom,
  restore,
  retryFromCheckpoint,
  seedPosition,
  setHeld,
  snapshot,
  step,
  type Sim,
  type SimEvent,
} from './sim';
import type { LevelDef, SeesawDef } from './types';

const FLOOR = PLAYFIELD.floorY;
const ROOF = PLAYFIELD.roofY;

function level(over: Partial<LevelDef> = {}): LevelDef {
  return {
    id: 'test',
    n: 1,
    world: 1,
    name: 'Test',
    blurb: '',
    teach: '',
    length: 100000,
    startX: 300,
    startY: 180,
    burrowX: 99999,
    sky: [[0, 0], [1, 0]],
    sunX: 0,
    sunY: 0,
    deaths: 'instant',
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
    orbs: [],
    crushers: [],
    ...over,
  };
}

// Every sim owns a Box2D world, so tests hand theirs back.
const sims: Sim[] = [];
afterEach(() => {
  while (sims.length) destroySim(sims.pop()!);
});

function make(def: LevelDef): Sim {
  const sim = createSim(def);
  sims.push(sim);
  return sim;
}

type Control = boolean | ((sim: Sim) => boolean);

function run(sim: Sim, seconds: number, held: Control): SimEvent[] {
  const events: SimEvent[] = [];
  const steps = Math.round(seconds / SIM_STEP);
  for (let i = 0; i < steps; i++) {
    setHeld(sim, typeof held === 'function' ? held(sim) : held);
    events.push(...step(sim));
  }
  return events;
}

// Hold whenever the leader sinks below y, so it cruises along that line.
const hover = (y: number) => (sim: Sim) => {
  const lead = sim.s.puffs[0];
  return !!lead && (lead.y > y || lead.vy > 90);
};

// Hold for one step to wake Puff, then let go.
function started(def: LevelDef): Sim {
  const sim = make(def);
  run(sim, SIM_STEP, true);
  setHeld(sim, false);
  return sim;
}

const types = (events: SimEvent[]) => events.map((e) => e.type);
const lead = (sim: Sim) => sim.s.puffs[0]!;

describe('waking and flying', () => {
  it('waits for the first hold, and the screen waits with it', () => {
    const sim = make(level());
    run(sim, 2, false);
    expect(sim.s.phase).toBe('waiting');
    expect(sim.s.camX).toBe(300 - PUFF_SCREEN_X);
    expect(types(run(sim, SIM_STEP, true))).toContain('start');
  });

  it('rises at lift minus gravity while held and falls when released', () => {
    const sim = started(level());
    const v0 = lead(sim).vy;
    run(sim, 1, true);
    expect(v0 - lead(sim).vy).toBeCloseTo(PHYSICS.lift - PHYSICS.gravity, -1);
    const before = lead(sim).vy;
    run(sim, 0.5, false);
    expect(lead(sim).vy - before).toBeCloseTo(PHYSICS.gravity * 0.5, -1);
  });

  it('drifts forward with the scroll, holding its spot on screen', () => {
    const sim = started(level());
    run(sim, 6, hover(190));
    const speed = 120;
    expect(sim.s.camX).toBeCloseTo(300 - PUFF_SCREEN_X + speed * 6, -1);
    expect(Math.abs(lead(sim).x - sim.s.camX - PUFF_SCREEN_X)).toBeLessThan(20);
  });
});

describe('the scrolling screen', () => {
  const wall = { id: 'wall', x0: 700, x1: 760, y0: ROOF, y1: FLOOR };

  it('bumps Puff off a wall without ending the run', () => {
    const sim = started(level({ rects: [wall] }));
    const events = run(sim, 4, hover(190));
    expect(types(events)).toContain('bump');
    expect(types(events)).not.toContain('lost');
    expect(lead(sim).x).toBeLessThan(700 - PUFF_RADIUS + 1);
  });

  it('loses a Puff the left edge of the screen passes', () => {
    const sim = started(level({ rects: [wall] }));
    const events = run(sim, 8, hover(190));
    const lost = events.find((e) => e.type === 'lost');
    expect(lost).toMatchObject({ cause: 'behind', leader: true });
  });

  it('re-forms at the start with no bloom yet, and waits for a hold', () => {
    const sim = started(level({ rects: [wall] }));
    const events = run(sim, 8, hover(190));
    expect(types(events)).toContain('respawn');
    expect(sim.s.phase).toBe('waiting');
    expect(lead(sim).x).toBeCloseTo(300, 0);
    expect(sim.s.camX).toBe(300 - PUFF_SCREEN_X);
  });

  it('bounces off a moss mound', () => {
    const sim = started(level({ startY: 150, humps: [{ id: 'm', cx: 360, width: 500, height: 120 }] }));
    let rose = false;
    let fell = false;
    for (let i = 0; i < 120; i++) {
      step(sim);
      if (lead(sim).vy > 60) fell = true;
      if (fell && lead(sim).vy < -20) rose = true;
    }
    expect(rose).toBe(true);
  });
});

describe('Mossback logs', () => {
  const log = (over: Partial<SeesawDef> = {}): SeesawDef => ({ id: 'log', px: 300, py: 300, half: 100, high: 'right', ...over });

  it('tips when Puff lands on the high end', () => {
    const sim = started(level({ startX: 360, startY: 240, seesaws: [log()] }));
    const events = run(sim, 1, false);
    expect(types(events)).toContain('tip');
    expect(sim.s.seesaws[0]!.side).toBe(-1);
  });

  it('does not tip when Puff lands on the low end', () => {
    const sim = started(level({ startX: 360, startY: 240, seesaws: [log({ high: 'left' })] }));
    expect(types(run(sim, 1, false))).not.toContain('tip');
  });

  it('bounces Puff off the wrong log without tipping it', () => {
    const sim = started(level({ startX: 360, startY: 240, seesaws: [log({ mode: 'dud' })] }));
    let peak = Infinity;
    let landed = false;
    const events: SimEvent[] = [];
    for (let i = 0; i < 70; i++) {
      events.push(...step(sim));
      if (lead(sim).y > 255) landed = true;
      if (landed) peak = Math.min(peak, lead(sim).y);
    }
    expect(types(events)).not.toContain('tip');
    expect(peak).toBeLessThan(250);
  });

  it('opens a latched gate up into the roof and keeps it open', () => {
    const sim = started(level({ startX: 360, startY: 240, seesaws: [log()], gates: [{ id: 'g', x: 700, openBottom: 40, link: 'log', mode: 'latch' }] }));
    const events = run(sim, 1.6, false);
    expect(types(events)).toContain('gate');
    expect(gateBottom(sim, 0)).toBeCloseTo(40, 0);
    run(sim, 2, hover(200));
    expect(gateBottom(sim, 0)).toBeCloseTo(40, 0);
  });

  it('starts a timed gate closing when Puff comes near, and shuts it over 3s', () => {
    const sim = started(level({ startX: 360, startY: 240, seesaws: [log()], gates: [{ id: 'g', x: 1300, openBottom: 40, link: 'log', mode: 'timed', closeTime: 3, closeAhead: 260 }] }));
    run(sim, 1, false);
    expect(gateBottom(sim, 0)).toBeCloseTo(40, 0);
    let closingSeen = false;
    for (let i = 0; i < 60 * 8 && !closingSeen; i++) {
      setHeld(sim, hover(120)(sim));
      step(sim);
      if (sim.s.gates[0]!.closingAt !== null) closingSeen = true;
    }
    expect(closingSeen).toBe(true);
    expect(1300 - lead(sim).x).toBeLessThanOrEqual(261);
    run(sim, 3.2, hover(120));
    expect(gateBottom(sim, 0)).toBeGreaterThan(FLOOR - 1);
  });

  it('lets a pebble tip a log: props move other props', () => {
    const sim = started(level({ startX: 120, startY: 100, seesaws: [log()], pebbles: [{ id: 'p', x: 360, y: 200, r: 16 }] }));
    const events = run(sim, 1.5, hover(100));
    expect(types(events)).toContain('tip');
  });

  it('needs a swollen Puff to tip a heavy log', () => {
    const heavy = log({ px: 500, heavy: true });
    // Even dropped from the roof, a normal Puff can't move it.
    const light = started(level({ startX: 520, startY: 40, seesaws: [heavy] }));
    expect(types(run(light, 2, false))).not.toContain('tip');
    const swollen = started(level({ startX: 520, startY: 200, seesaws: [heavy], orbs: [{ id: 'o', x: 525, y: 200, kind: 'swell' }] }));
    const events = run(swollen, 1.5, false);
    expect(lead(swollen).r).toBeCloseTo(PUFF_RADIUS * SIZE.swell, 0);
    expect(types(events)).toContain('tip');
  });
});

describe('pebbles', () => {
  it('rolls ahead when Puff pushes it', () => {
    const sim = started(level({ startY: 320, pebbles: [{ id: 'p', x: 560, y: FLOOR - 16, r: 16 }] }));
    const events = run(sim, 3, false);
    expect(types(events)).toContain('push');
    expect(sim.s.pebbles[0]!.x).toBeGreaterThan(640);
  });

  it('jams a thornwheel it rolls into', () => {
    const sim = started(level({
      startY: 320,
      pebbles: [{ id: 'p', x: 560, y: FLOOR - 16, r: 16 }],
      wheels: [{ id: 'w', cx: 680, cy: FLOOR - 50, r: 50, spin: 90, jammable: true }],
    }));
    const events = run(sim, 4, (s) => !!s.s.puffs[0] && s.s.puffs[0].x > 560);
    expect(types(events)).toContain('jam');
    const a = sim.s.wheels[0]!.angle;
    run(sim, 0.5, true);
    expect(sim.s.wheels[0]!.angle).toBe(a);
  });

  it('only budges a boulder for a swollen Puff', () => {
    const boulder = { id: 'b', x: 560, y: FLOOR - 24, r: 24, heavy: true };
    const sim = started(level({ startY: 320, pebbles: [boulder] }));
    run(sim, 3, false);
    expect(sim.s.pebbles[0]!.x).toBeLessThan(600);
    const big = started(level({ startY: 320, pebbles: [boulder], orbs: [{ id: 'o', x: 380, y: 320, kind: 'swell', time: 10 }] }));
    run(big, 4, false);
    expect(big.s.pebbles[0]!.x).toBeGreaterThan(700);
  });
});

describe('hazards', () => {
  it('loses Puff on briar, and re-forms it at once', () => {
    const sim = started(level({ briars: [{ id: 'b', x0: 200, base: FLOOR, side: 'up', spikes: Array(30).fill(60) }] }));
    const events = run(sim, 2, false);
    expect(events.find((e) => e.type === 'lost')).toMatchObject({ cause: 'briar' });
    expect(types(events)).toContain('respawn');
    expect(sim.s.deaths).toBe(1);
  });

  it('forgives a graze: only a real touch is deadly', () => {
    // Spike tips 2pt into Puff's fuzz.
    const sim = make(level({ startY: FLOOR - 60 - PUFF_RADIUS + 2, briars: [{ id: 'b', x0: 260, base: FLOOR, side: 'up', spikes: [60, 60, 60, 60] }] }));
    const events = run(sim, SIM_STEP * 2, true);
    expect(types(events)).not.toContain('lost');
  });

  it('kills on a thornwheel, but not inside its missing tooth', () => {
    const wheel = { id: 'w', cx: 300 - 66, cy: 180, r: 60, spin: 0 };
    const open = make(level({ wheels: [{ ...wheel, missingTooth: true }] }));
    expect(types(run(open, SIM_STEP * 2, true))).not.toContain('lost');
    const full = make(level({ wheels: [wheel] }));
    expect(run(full, SIM_STEP * 2, true).find((e) => e.type === 'lost')).toMatchObject({ cause: 'thornwheel' });
  });

  it('carries an orbiting seed around with its wheel', () => {
    const sim = started(level({ wheels: [{ id: 'w', cx: 2000, cy: 180, r: 40, spin: 90, missingTooth: true }], seeds: [{ id: 's', x: 0, y: 0, orbit: { wheel: 'w', radius: 46 } }] }));
    run(sim, 1, hover(180));
    const p = seedPosition(sim, 0);
    expect(Math.hypot(p.x - 2000, p.y - 180)).toBeCloseTo(46, 3);
    expect(Math.atan2(p.y - 180, p.x - 2000)).toBeCloseTo(Math.PI / 2, 1);
  });

  it('lifts a thorn curtain while its log is tipped, then drops it', () => {
    const sim = started(level({
      startX: 360,
      startY: 240,
      seesaws: [{ id: 'log', px: 300, py: 300, half: 100, high: 'right', mode: 'return', returnAfter: 2 }],
      curtains: [{ id: 'c', x0: 2000, x1: 2024, openBottom: 150, closedBottom: FLOOR - 4, link: 'log' }],
    }));
    run(sim, 1.4, false);
    expect(sim.s.curtains[0]!.open).toBe(1);
    const events = run(sim, 3, hover(200));
    expect(types(events)).toContain('drop');
    expect(sim.s.curtains[0]!.open).toBe(0);
  });

  it('slams a rootcrusher on its beat, with dust first, and crushes a Puff under it', () => {
    // A wide crusher that slams 2s in, while Puff is right under it.
    const crusher = { id: 'c', x: 600, width: 400, height: 60, rest: 200, period: 3, offset: 1 };
    const sim = started(level({ crushers: [crusher] }));
    const events = run(sim, 2.5, hover(290));
    const order = types(events).filter((t) => t === 'dust' || t === 'slam' || t === 'lost');
    expect(order).toEqual(['dust', 'lost', 'slam']);
    expect(events.find((e) => e.type === 'lost')).toMatchObject({ cause: 'crusher' });
  });

  it('is only deadly underneath: its sides just bump', () => {
    // It slams just ahead of Puff, which flies into its side, then under it once it rises.
    const crusher = { id: 'c', x: 700, width: 120, height: 80, rest: 120, period: 100, offset: 99.7 };
    const sim = started(level({ startX: 590, startY: 300, crushers: [crusher] }));
    expect(crusherBottom(sim, 0)).toBeCloseTo(120, 0);
    const events = run(sim, 0.6, hover(300));
    expect(crusherBottom(sim, 0)).toBeCloseTo(FLOOR, 0);
    events.push(...run(sim, 3, hover(300)));
    expect(types(events)).toContain('bump');
    expect(types(events)).not.toContain('lost');
    expect(lead(sim).x).toBeGreaterThan(800);
  });
});

describe('Swell and Shrink', () => {
  it('grows Puff 1.8x for a while, heavier but just as easy to fly', () => {
    const sim = started(level({ orbs: [{ id: 'o', x: 360, y: 180, kind: 'swell', time: 2 }] }));
    const mass = b2().b2Body_GetMass(sim.world.puffBodies[lead(sim).body]!);
    const events = run(sim, 0.8, hover(180));
    expect(events.find((e) => e.type === 'resize')).toMatchObject({ kind: 'swell' });
    expect(lead(sim).r).toBeCloseTo(PUFF_RADIUS * SIZE.swell, 1);
    expect(b2().b2Body_GetMass(sim.world.puffBodies[lead(sim).body]!) / mass).toBeCloseTo(SIZE.swell ** 2, 1);
    const v0 = lead(sim).vy;
    run(sim, 0.5, true);
    expect(v0 - lead(sim).vy).toBeCloseTo((PHYSICS.lift - PHYSICS.gravity) * 0.5, -1);
    expect(types(run(sim, 2, hover(180)))).toContain('unsize');
    expect(lead(sim).r).toBeCloseTo(PUFF_RADIUS, 1);
  });

  it('shrinks Puff to slip through a gap it would never fit', () => {
    // A 24pt slot through a wall: Puff is 30 across, shrunk it's 15.
    const wall = [
      { id: 'top', x0: 800, x1: 840, y0: ROOF, y1: 168 },
      { id: 'bottom', x0: 800, x1: 840, y0: 192, y1: FLOOR },
    ];
    const normal = started(level({ rects: wall }));
    expect(types(run(normal, 8, hover(180)))).toContain('lost');
    const small = started(level({ rects: wall, orbs: [{ id: 'o', x: 500, y: 180, kind: 'shrink', time: 8 }] }));
    const events = run(small, 8, hover(180));
    expect(types(events)).not.toContain('lost');
    expect(lead(small).x).toBeGreaterThan(900);
  });
});

describe('Split bubbles and clones', () => {
  const bubble = { id: 'b', x: 340, y: 180 };

  it('splits Puff in two when it touches a bubble', () => {
    const sim = started(level({ bubbles: [bubble] }));
    const events = run(sim, 0.3, hover(180));
    expect(types(events)).toContain('pop');
    expect(sim.s.puffs).toHaveLength(2);
    expect(sim.s.puffs[1]!.r).toBe(CLONE_RADIUS);
  });

  it('splits every Puff that touches it, up to 6', () => {
    const sim = started(level({ bubbles: [bubble, { id: 'b2', x: 900, y: 180 }, { id: 'b3', x: 1500, y: 180 }] }));
    run(sim, 12, hover(180));
    expect(sim.s.puffs).toHaveLength(6);
  });

  it('copies input to clones with a slight lag', () => {
    const sim = started(level({ bubbles: [bubble] }));
    run(sim, 1, hover(180));
    run(sim, 1, false);
    const [l, c] = sim.s.puffs.map((p) => p.vy);
    setHeld(sim, true);
    step(sim);
    step(sim);
    expect(sim.s.puffs[0]!.vy).toBeLessThan(l!);
    expect(sim.s.puffs[1]!.vy).toBeGreaterThan(c!);
  });

  it('keeps clones close to the leader', () => {
    const sim = started(level({ bubbles: [bubble, { id: 'b2', x: 900, y: 180 }] }));
    let worst = 0;
    for (let i = 0; i < 60 * 8; i++) {
      setHeld(sim, hover(180)(sim));
      step(sim);
      if (sim.s.t > 6) for (const p of sim.s.puffs) worst = Math.max(worst, Math.abs(p.y - lead(sim).y));
    }
    expect(worst).toBeLessThan(CLONE_SPREAD / 2 + 8);
  });

  it('lets any clone collect a seed', () => {
    const sim = started(level({ bubbles: [bubble], seeds: [{ id: 's', x: 1200, y: 220 }] }));
    run(sim, 1, hover(180));
    // The leader flies over the seed; the clone below it picks it up.
    run(sim, 7, hover(190));
    expect(sim.s.seeds[0]).toBe(true);
  });

  it('saves the clone count at a bloom and restores it after a fail', () => {
    const sim = started(level({ deaths: 'screen', bubbles: [bubble], blooms: [{ id: 'bl', x: 800 }], briars: [{ id: 'b', x0: 1400, base: ROOF, side: 'down', spikes: Array(20).fill(300) }] }));
    const events = run(sim, 10, hover(180));
    expect(types(events)).toContain('checkpoint');
    expect(types(events)).toContain('fail');
    expect(sim.s.phase).toBe('failed');
    expect(types(retryFromCheckpoint(sim))).toContain('respawn');
    expect(sim.s.puffs).toHaveLength(2);
    expect(lead(sim).x).toBeCloseTo(800, 0);
    expect(sim.s.phase).toBe('waiting');
  });
});

describe('checkpoints and the burrow', () => {
  it('opens a bloom when the leader passes it', () => {
    const sim = started(level({ blooms: [{ id: 'b', x: 600 }] }));
    expect(types(run(sim, 4, hover(180)))).toContain('checkpoint');
  });

  it('wins when the leader reaches the burrow, counting Puffs home', () => {
    const sim = started(level({ burrowX: 900 }));
    const events = run(sim, 8, hover(180));
    expect(events.find((e) => e.type === 'win')).toMatchObject({ home: 1 });
    expect(sim.s.phase).toBe('won');
  });
});

describe('determinism', () => {
  it('replays exactly from a snapshot', () => {
    const def = level({
      seesaws: [{ id: 'log', px: 900, py: 300, half: 100, high: 'right' }],
      pebbles: [{ id: 'p', x: 1300, y: FLOOR - 16, r: 16 }],
      wheels: [{ id: 'w', cx: 2200, cy: 120, r: 40, spin: 90 }],
    });
    const sim = started(def);
    run(sim, 1, hover(200));
    const snap = snapshot(sim);
    const pattern = (s: Sim) => Math.floor(s.s.t * 3) % 3 !== 0;
    const a = types(run(sim, 6, pattern)).join();
    const end = JSON.stringify(sim.s);
    restore(sim, snap);
    const b = types(run(sim, 6, pattern)).join();
    expect(b).toBe(a);
    expect(JSON.stringify(sim.s)).toBe(end);
  });
});
