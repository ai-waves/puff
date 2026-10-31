import type { b2BodyId, b2JointId, b2ShapeId, b2Vec2, b2WorldId } from 'box2d3-wasm/compat';
import {
  CAM_LEAD,
  CLONE_LAG,
  CLONE_RADIUS,
  CLONE_SPREAD,
  DRIFT,
  EDGE_KILL,
  MAX_PUFFS,
  PHYSICS,
  PLAYFIELD,
  PUFF_RADIUS,
  PUFF_SCREEN_X,
  RESPAWN_TIME,
  SCREEN,
  SIM_STEP,
  SIZE,
  SUBSTEPS,
  WHEEL_FREEZE,
} from '../config/constants';
import { tuning } from '../config/tuning';
import { addBox, addCapsule, addCircle, addPolygon, addRoundedRect, b2, createBody, m, PT } from './physics';
import type { CrusherDef, LevelDef, RectDef, SeesawDef, WheelDef } from './types';

// One level, simulated by Box2D v3 at a fixed step. No rendering and no randomness: tests and the
// level solver run it headless and get the same result every time, and a snapshot of the Box2D
// world plus the plain-data state below restores any moment exactly.
//
// Badland rules: the screen scrolls on its own. Puff drifts forward and only controls its height.
// A Puff that touches something deadly, or that the left edge of the screen passes, is lost.

export type Cause = 'briar' | 'thornwheel' | 'crusher' | 'behind';

export type SimEvent =
  | { type: 'start' }
  | { type: 'bump'; x: number; y: number; leader: boolean }
  | { type: 'tip'; id: string }
  | { type: 'drop'; id: string } // a returning log falls back
  | { type: 'knock'; id: string } // a thornwheel knocks a log
  | { type: 'gate'; id: string }
  | { type: 'seed'; id: string }
  | { type: 'pop'; id: string }
  | { type: 'split'; x: number; y: number; count: number }
  | { type: 'resize'; id: string; kind: 'swell' | 'shrink' }
  | { type: 'unsize' } // a Swell or Shrink wore off
  | { type: 'dust'; id: string } // a rootcrusher is about to drop
  | { type: 'slam'; id: string }
  | { type: 'checkpoint'; id: string }
  | { type: 'lost'; x: number; y: number; cause: Cause; leader: boolean; left: number }
  | { type: 'respawn' }
  | { type: 'jam'; id: string }
  | { type: 'push'; id: string }
  | { type: 'fail'; cause: Cause }
  | { type: 'win'; home: number };

export interface Puff {
  id: number;
  body: number; // which body of the pool it flies
  x: number;
  y: number;
  vx: number;
  vy: number;
  pvx: number; // velocity before the last step, to tell a bump from a graze
  pvy: number;
  r: number; // current radius, pt
  base: number; // radius at normal size: the leader is bigger than its clones
  size: number; // the size it's growing or shrinking toward
  sizeUntil: number; // s, when a Swell or Shrink wears off
  bonk: number; // seconds of squash left after a bump
  lastBump: number;
}

export interface SimState {
  phase: 'waiting' | 'running' | 'respawning' | 'failed' | 'won';
  t: number;
  held: boolean;
  history: boolean[]; // held state per step, newest last, for clone lag
  lastReleaseAt: number;
  camX: number; // world x of the screen's left edge
  lingerUntil: number;
  lingered: boolean;
  puffs: Puff[]; // index 0 leads; only the leader has a sprout
  nextId: number;
  seesaws: { angle: number; side: 1 | -1; flips: number; flippedAt: number; returning: boolean; beat: number }[];
  gates: { open: number; closingAt: number | null; lift: number }[];
  curtains: { open: number; lift: number }[];
  wheels: { angle: number; jammed: boolean }[];
  pebbles: { x: number; y: number; angle: number; jammed: boolean; gone: boolean }[];
  crushers: { drop: number; warn: boolean }[];
  bubbles: { poppedAt: number | null; splitBy: number[] }[];
  orbs: { poppedAt: number | null }[];
  seeds: boolean[];
  blooms: boolean[];
  checkpoint: { x: number; y: number; count: number } | null;
  respawnAt: number | null;
  freezeUntil: number;
  deaths: number;
  bumps: number;
  tips: number;
  home: number;
  failCause: Cause | null;
}

type Tag =
  | { kind: 'puff'; slot: number }
  | { kind: 'sensor'; slot: number }
  | { kind: 'hazard'; cause: Cause; wheel?: number }
  | { kind: 'pebble'; index: number }
  | { kind: 'solid' };

// Box2D handles for one sim. They never change after createSim, and a snapshot restores the
// world they point into.
interface World {
  id: b2WorldId;
  ground: b2BodyId;
  puffBodies: b2BodyId[];
  puffShapes: b2ShapeId[];
  puffSensors: b2ShapeId[];
  joints: (b2JointId | null)[];
  gates: b2BodyId[];
  curtains: b2BodyId[];
  wheels: b2BodyId[];
  pebbles: b2BodyId[];
  crushers: b2BodyId[];
  tags: Map<number, Tag>;
  vec: b2Vec2;
}

export interface Sim {
  readonly def: LevelDef;
  readonly speed: number;
  readonly world: World;
  s: SimState;
}

// What drawing a level needs from a sim: the level and where everything is, no physics.
export type SimView = Pick<Sim, 'def' | 's'>;

export interface Snapshot {
  s: SimState;
  world: Uint8Array;
}

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
export const TILT = (12 * Math.PI) / 180;
const LINGER = 0.5; // s the scroll lingers at the first bloom, where a level asks for it
const PLANK_HALF_THICK = 5;
const GATE_WIDTH = 14;
const BUBBLE_R = 20;
const ORB_R = 20;
const SEED_R = 7;
const POP_WINDOW = 0.4; // s a popping bubble still catches the Puffs behind the first
const WHEEL_CORE = 0.75;
const WHEEL_TEETH = 16;
const CLONE_DELAY_STEPS = Math.round(CLONE_LAG / SIM_STEP);
const BLOOM_SPAWN_Y = 190;
const SENSOR_GRACE = 3; // pt; Puff survives a thorn that only grazes its fuzz
const BUMP_SPEED = 60; // pt/s of speed lost in a fresh touch to count as a bump
const BUMP_COOLDOWN = 0.6;
const PLANK_DENSITY = 0.5;
const PEBBLE_DENSITY = 0.6; // lighter than Puff, so a bump sends it rolling
const BOULDER_DENSITY = 1; // a boulder slides rather than rolls: a normal Puff can't shove it, a swollen one can
const KNOCK_SPEED = (TILT * 2) / 0.25; // rad/s, a motor-driven log swings across in a quarter second
const KNOCK_TORQUE = 4000; // N·m, far more than any Puff can resist
const CRUSHER_TEETH = 10; // pt, the deadly underside
const CRUSH = { warn: 0.7, slam: 0.14, hold: 0.45, rise: 0.9 }; // s, before the 1% ramp
const FAR = 1000; // pt the roof and floor reach past both ends of the level

// Formation for the flock, relative to the leader. Every slot stays within the 45pt spread.
export const SLOTS = [
  { dx: 0, dy: 0 },
  { dx: -16, dy: 12 },
  { dx: -28, dy: -12 },
  { dx: -40, dy: 20 },
  { dx: -24, dy: -20 },
  { dx: -36, dy: 4 },
];

// ---------- Setup ----------

let live = 0;

// t0 starts the level's clocks partway through a run: the level editor's test flights start
// wherever you are, with the crushers and thornwheels where a run from the start would find them.
export function createSim(def: LevelDef, t0 = 0): Sim {
  const B = b2();
  if (live >= 100) throw new Error('Too many sims alive: destroySim() the ones you are done with.');
  const wd = B.b2DefaultWorldDef();
  wd.gravity.Set(0, m(PHYSICS.gravity));
  const id = B.b2CreateWorld(wd);
  wd.delete();
  live += 1;

  const ground = createBody(id, 'static', 0, 0);
  const world: World = {
    id,
    ground,
    puffBodies: [],
    puffShapes: [],
    puffSensors: [],
    joints: [],
    gates: [],
    curtains: [],
    wheels: [],
    pebbles: [],
    crushers: [],
    tags: new Map(),
    vec: new B.b2Vec2(0, 0),
  };
  const sim: Sim = { def, speed: tuning(def.n).speed, world, s: initialState(def) };
  sim.s.t = t0;
  const tag = (ids: b2ShapeId | b2ShapeId[], t: Tag) => {
    for (const s of Array.isArray(ids) ? ids : [ids]) world.tags.set(s.index1, t);
  };
  const solid: Tag = { kind: 'solid' };
  const briar: Tag = { kind: 'hazard', cause: 'briar' };

  // Roof and floor, the length of the level and then some.
  tag(addBox(ground, -FAR, ROOF - 400, def.length + FAR, ROOF, { cat: 'terrain' }), solid);
  tag(addBox(ground, -FAR, FLOOR, def.length + FAR, FLOOR + 400, { cat: 'terrain' }), solid);

  // Shapes too thin to have an inside are skipped: a level being edited passes through them, and
  // Box2D can't build a polygon or circle from nothing.
  for (const r of def.rects) if (r.x1 - r.x0 >= 1 && r.y1 - r.y0 >= 1) tag(addRect(ground, r), solid);
  for (const h of def.humps) {
    if (h.width < 2 || h.height < 1) continue;
    const c = humpCircle(h.width, h.height);
    tag(addCircle(ground, h.cx, c.cy, c.r, { cat: 'terrain', restitution: PHYSICS.bounce }), solid);
  }
  for (const b of def.briars) {
    for (const t of briarTriangles(b)) {
      if (Math.abs(t.qy - t.ay) < 1 || t.bx - t.ax < 1) continue;
      tag(addPolygon(ground, [{ x: t.ax, y: t.ay }, { x: t.bx, y: t.by }, { x: t.qx, y: t.qy }], { cat: 'hazard' }), briar);
    }
  }

  for (const sw of def.seesaws) world.joints.push(buildSeesaw(sim, sw, (ids) => tag(ids, solid)));

  for (const g of def.gates) {
    // A bar hanging from the roof, rounded at the bottom like the drawing.
    const o = { x: g.x + GATE_WIDTH / 2, y: FLOOR };
    const body = createBody(id, 'kinematic', o.x, o.y);
    const r = GATE_WIDTH / 2;
    tag(addCapsule(body, { x: o.x, y: ROOF - 60 }, { x: o.x, y: FLOOR - r }, r, { cat: 'prop' }, o), solid);
    world.gates.push(body);
  }
  for (const c of def.curtains) {
    const o = { x: (c.x0 + c.x1) / 2, y: c.closedBottom };
    const body = createBody(id, 'kinematic', o.x, o.y);
    tag(addBox(body, c.x0 - 3, ROOF - 300, c.x1 + 3, c.closedBottom, { cat: 'hazard' }, o), briar);
    world.curtains.push(body);
  }
  def.wheels.forEach((w, i) => {
    const o = { x: w.cx, y: w.cy };
    const angle = wheelAngle(w, t0);
    const body = createBody(id, 'kinematic', o.x, o.y, angle);
    sim.s.wheels[i]!.angle = angle;
    const hz: Tag = { kind: 'hazard', cause: 'thornwheel', wheel: i };
    tag(addCircle(body, w.cx, w.cy, wheelCore(w), { cat: 'hazard' }, o), hz);
    const tooth = w.r * 0.11;
    for (let k = 0; k < WHEEL_TEETH; k++) {
      if (w.missingTooth && k === 0) continue;
      const a = (k / WHEEL_TEETH) * Math.PI * 2;
      tag(addCircle(body, w.cx + Math.cos(a) * (w.r - tooth), w.cy + Math.sin(a) * (w.r - tooth), tooth, { cat: 'hazard' }, o), hz);
    }
    world.wheels.push(body);
  });
  def.pebbles.forEach((p, i) => {
    const body = createBody(id, 'dynamic', p.x, p.y);
    const pebble: Tag = { kind: 'pebble', index: i };
    if (p.heavy) tag(addPolygon(body, boulderPoints(p), { cat: 'pebble', density: BOULDER_DENSITY, friction: 0.8, contactEvents: true }, p), pebble);
    else tag(addCircle(body, p.x, p.y, p.r, { cat: 'pebble', density: PEBBLE_DENSITY, friction: 0.7, rolling: 0.02, contactEvents: true }, p), pebble);
    world.pebbles.push(body);
  });
  def.crushers.forEach((c, i) => {
    const st = crusherState(def, c, t0);
    const o = { x: c.x, y: c.rest };
    const body = createBody(id, 'kinematic', c.x, c.rest + st.drop * (FLOOR - c.rest));
    const x0 = c.x - c.width / 2;
    const x1 = c.x + c.width / 2;
    // The column reaches past the roof even when slammed, so nothing gets above it.
    tag(addBox(body, x0, c.rest - (FLOOR - ROOF) - 200, x1, c.rest - CRUSHER_TEETH, { cat: 'prop' }, o), solid);
    tag(addBox(body, x0 + 2, c.rest - CRUSHER_TEETH, x1 - 2, c.rest, { cat: 'hazard' }, o), { kind: 'hazard', cause: 'crusher' });
    sim.s.crushers[i] = st;
    world.crushers.push(body);
  });

  // A pool of Puff bodies, disabled until a Puff flies one. Bodies are never created mid-level,
  // so every handle stays valid across snapshots.
  const start = { x: def.startX, y: def.startY };
  for (let i = 0; i < MAX_PUFFS; i++) {
    const body = createBody(id, 'dynamic', start.x, start.y, 0, true);
    const shape = addCircle(body, start.x, start.y, PUFF_RADIUS, { cat: 'puff', friction: 0.05, contactEvents: true }, start);
    const sensor = addCircle(body, start.x, start.y, PUFF_RADIUS - SENSOR_GRACE, { cat: 'sensor', sensor: true }, start);
    tag(shape, { kind: 'puff', slot: i });
    tag(sensor, { kind: 'sensor', slot: i });
    B.b2Body_Disable(body);
    world.puffBodies.push(body);
    world.puffShapes.push(shape);
    world.puffSensors.push(sensor);
  }

  const lead = spawnPuff(sim, def.startX, def.startY, PUFF_RADIUS, 0, 0, 1);
  if (lead) sim.s.puffs.push(lead);
  return sim;
}

// Static ground shaped like its drawing.
function addRect(ground: b2BodyId, r: RectDef): b2ShapeId[] {
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  if (r.look === 'vine') {
    // A thin stem with a leafy knot at the tip.
    const mid = (r.x0 + r.x1) / 2;
    const knot = Array.from({ length: 8 }, (_, k) => {
      const a = (k / 8) * Math.PI * 2;
      return { x: mid + Math.cos(a) * 9, y: r.y1 - 6 + Math.sin(a) * 6 };
    });
    return [addBox(ground, mid - 2, r.y0, mid + 2, r.y1 - 6, { cat: 'terrain' }), addPolygon(ground, knot, { cat: 'terrain' })];
  }
  // The same clamp the renderer applies to each corner radius.
  const c = (v = 0) => Math.min(v, w / 2, h);
  const round = r.round ?? {};
  const bouncy = r.look === 'mound' ? PHYSICS.bounce : 0;
  return addRoundedRect(ground, r.x0, r.y0, r.x1, r.y1, { tl: c(round.tl), tr: c(round.tr), br: c(round.br), bl: c(round.bl) }, { cat: 'terrain', restitution: bouncy });
}

// A Mossback log on a real hinge: a plank on the fulcrum's tip, free to tilt 12° either way.
function buildSeesaw(sim: Sim, sw: SeesawDef, solid: (ids: b2ShapeId) => void): b2JointId | null {
  const B = b2();
  const { world } = sim;
  const base = sw.baseY ?? FLOOR;
  solid(addPolygon(world.ground, [{ x: sw.px - 18, y: base }, { x: sw.px + 18, y: base }, { x: sw.px, y: sw.py + 6 }], { cat: 'terrain' }));
  const initial = sw.high === 'right' ? 1 : -1;
  const angle = -initial * TILT; // Box2D's y points down, so a positive angle dips the right end
  const mode = sw.mode ?? 'free';
  const o = { x: sw.px, y: sw.py };
  const plank = (body: b2BodyId, opts: Parameters<typeof addCapsule>[4]) =>
    addCapsule(body, { x: sw.px - sw.half, y: sw.py }, { x: sw.px + sw.half, y: sw.py }, PLANK_HALF_THICK, opts, o);
  if (mode === 'dud') {
    // The wrong log is stuck fast, and springy: it just bounces you.
    solid(plank(createBody(world.id, 'static', o.x, o.y, angle), { cat: 'prop', restitution: 0.9 }));
    return null;
  }
  const body = createBody(world.id, 'dynamic', o.x, o.y, angle);
  solid(plank(body, { cat: 'prop', density: sw.heavy ? PLANK_DENSITY * 3 : PLANK_DENSITY, friction: 0.8 }));
  if (sw.cradle) {
    // A knot of bark on the low end's tip, so a pebble resting there stays put.
    const tip = sw.px - initial * (sw.half - 4);
    solid(addBox(body, tip - 4, sw.py - PLANK_HALF_THICK - 9, tip + 4, sw.py, { cat: 'prop', density: PLANK_DENSITY }, o));
  }
  const jd = B.b2DefaultRevoluteJointDef();
  jd.base.bodyIdA = world.ground;
  jd.base.bodyIdB = body;
  jd.base.localFrameA.p.Set(m(sw.px), m(sw.py));
  jd.base.localFrameB.p.Set(0, 0);
  jd.enableLimit = true;
  jd.lowerAngle = -TILT;
  jd.upperAngle = TILT;
  // A beat log is swung by its motor. A heavy log's motor holds it still, like a stiff hinge.
  jd.enableMotor = mode === 'beat' || !!sw.heavy;
  jd.maxMotorTorque = KNOCK_TORQUE;
  jd.motorSpeed = 0;
  const joint = B.b2CreateRevoluteJoint(world.id, jd);
  jd.delete();
  return joint;
}

function initialState(def: LevelDef): SimState {
  return {
    phase: 'waiting',
    t: 0,
    held: false,
    history: [],
    lastReleaseAt: 0,
    camX: def.startX - PUFF_SCREEN_X,
    lingerUntil: 0,
    lingered: false,
    puffs: [],
    nextId: 0,
    seesaws: def.seesaws.map((sw) => {
      const side = sw.high === 'right' ? 1 : -1;
      return { angle: side * TILT, side, flips: 0, flippedAt: -Infinity, returning: false, beat: 0 };
    }),
    gates: def.gates.map(() => ({ open: 0, closingAt: null, lift: 0 })),
    curtains: def.curtains.map(() => ({ open: 0, lift: 0 })),
    wheels: def.wheels.map(() => ({ angle: 0, jammed: false })),
    pebbles: def.pebbles.map((p) => ({ x: p.x, y: p.y, angle: 0, jammed: false, gone: false })),
    crushers: def.crushers.map(() => ({ drop: 0, warn: false })),
    bubbles: def.bubbles.map(() => ({ poppedAt: null, splitBy: [] })),
    orbs: def.orbs.map(() => ({ poppedAt: null })),
    seeds: def.seeds.map(() => false),
    blooms: def.blooms.map(() => false),
    checkpoint: null,
    respawnAt: null,
    freezeUntil: 0,
    deaths: 0,
    bumps: 0,
    tips: 0,
    home: 0,
    failCause: null,
  };
}

export function destroySim(sim: Sim): void {
  const B = b2();
  if (!B.b2World_IsValid(sim.world.id)) return;
  B.b2DestroyWorld(sim.world.id);
  sim.world.vec.delete();
  live -= 1;
}

export function snapshot(sim: Sim): Snapshot {
  return { s: structuredClone(sim.s), world: b2().b2World_GetSnapshot(sim.world.id) };
}

export function restore(sim: Sim, snap: Snapshot): void {
  b2().b2World_RestoreFromSnapshot(sim.world.id, snap.world);
  sim.s = structuredClone(snap.s);
}

export function leader(sim: Sim): Puff | undefined {
  return sim.s.puffs[0];
}

export function setHeld(sim: Sim, held: boolean): void {
  if (sim.s.held && !held) sim.s.lastReleaseAt = sim.s.t;
  sim.s.held = held;
}

export function seedsFound(sim: Sim): number {
  return sim.s.seeds.filter(Boolean).length;
}

// ---------- Geometry the renderer also needs ----------

// Log ends for a tilt angle, where a positive angle raises the right end.
export function seesawEnds(def: SeesawDef, angle: number) {
  const cx = Math.cos(angle) * def.half;
  const sy = Math.sin(angle) * def.half;
  return { ax: def.px - cx, ay: def.py + sy, bx: def.px + cx, by: def.py - sy };
}

export function gateBottom(sim: SimView, i: number): number {
  return FLOOR - sim.s.gates[i]!.lift;
}

export function curtainBottom(sim: SimView, i: number): number {
  return sim.def.curtains[i]!.closedBottom - sim.s.curtains[i]!.lift;
}

// The crusher block's underside right now.
export function crusherBottom(sim: SimView, i: number): number {
  const c = sim.def.crushers[i]!;
  return c.rest + sim.s.crushers[i]!.drop * (FLOOR - c.rest);
}

// A boulder is an octagon, resting on a flat side.
export function boulderPoints(p: { x: number; y: number; r: number }) {
  return Array.from({ length: 8 }, (_, k) => {
    const a = ((k + 0.5) / 8) * Math.PI * 2;
    return { x: p.x + Math.cos(a) * p.r, y: p.y + Math.sin(a) * p.r };
  });
}

export function humpCircle(width: number, height: number) {
  const r = (width * width) / 4 / (2 * height) + height / 2;
  return { r, cy: PLAYFIELD.floorY - height + r };
}

export function wheelCore(w: WheelDef): number {
  return w.r * WHEEL_CORE;
}

export function seedPosition(sim: SimView, i: number): { x: number; y: number } {
  const seed = sim.def.seeds[i]!;
  // A seed riding something that isn't there (mid-edit) just sits at its own point.
  if (seed.ride) {
    const si = sim.def.seesaws.findIndex((sw) => sw.id === seed.ride!.log);
    if (si < 0) return seed;
    const sw = sim.def.seesaws[si]!;
    const a = sim.s.seesaws[si]!.angle;
    const along = seed.ride.at * sw.half;
    return { x: sw.px + Math.cos(a) * along - Math.sin(a) * seed.ride.lift, y: sw.py - Math.sin(a) * along - Math.cos(a) * seed.ride.lift };
  }
  if (!seed.orbit) return seed;
  const wi = sim.def.wheels.findIndex((w) => w.id === seed.orbit!.wheel);
  if (wi < 0) return seed;
  const w = sim.def.wheels[wi]!;
  const a = sim.s.wheels[wi]!.angle;
  return { x: w.cx + Math.cos(a) * seed.orbit.radius, y: w.cy + Math.sin(a) * seed.orbit.radius };
}

export function briarTriangles(b: { x0: number; base: number; side: 'up' | 'down'; spikes: number[]; width?: number }) {
  const w = b.width ?? 20;
  const dir = b.side === 'up' ? -1 : 1;
  return b.spikes.map((h, i) => {
    const x = b.x0 + i * w;
    return { ax: x, ay: b.base, bx: x + w, by: b.base, qx: x + w / 2, qy: b.base + dir * h };
  });
}

// A rootcrusher's beat: it slams down, holds, rises, waits, and dust falls just before the next
// slam. Its windows shorten with the 1% ramp, like every other timing.
export function crusherState(def: LevelDef, c: CrusherDef, t: number): { drop: number; warn: boolean } {
  const d = tuning(def.n).d;
  const period = c.period / d;
  const slam = CRUSH.slam;
  const hold = CRUSH.hold / d;
  const rise = CRUSH.rise / d;
  const u = (((t + (c.offset ?? 0)) % period) + period) % period;
  if (u < slam) return { drop: (u / slam) ** 2, warn: false };
  if (u < slam + hold) return { drop: 1, warn: false };
  if (u < slam + hold + rise) {
    const k = (u - slam - hold) / rise;
    return { drop: 1 - k * k * (3 - 2 * k), warn: false };
  }
  return { drop: 0, warn: u >= period - CRUSH.warn / d };
}

// ---------- A run's clock ----------
// The clock starts at the first hold, and the scroll moves at the level's pace from then on. The
// level editor shows a level at a moment of a run: the scroll where it would be, a Puff keeping
// its place on screen, and every clocked thing where its clock puts it.

function wheelAngle(w: WheelDef, t: number): number {
  const a = ((w.spin * Math.PI) / 180) * t;
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// Seconds into a run when a Puff keeping its place on screen reaches x.
export function arrivalTime(def: LevelDef, x: number): number {
  const t = (x - def.startX) / tuning(def.n).speed;
  const bloom = def.lingerAtBloom ? def.blooms[0] : undefined;
  return bloom && x > bloom.x ? t + LINGER : t;
}

// Where that Puff is t seconds into a run.
export function placeAtTime(def: LevelDef, t: number): number {
  const speed = tuning(def.n).speed;
  const bloom = def.lingerAtBloom ? def.blooms[0] : undefined;
  if (bloom) {
    const at = (bloom.x - def.startX) / speed;
    if (t > at) t = Math.max(at, t - LINGER);
  }
  return def.startX + speed * t;
}

// The scroll t seconds into a run. It stops at the end of the level; Puff flies on to the burrow.
export function camAtTime(def: LevelDef, t: number): number {
  return Math.min(placeAtTime(def, t) - PUFF_SCREEN_X, def.length - SCREEN.width);
}

// The level t seconds into a run, with nobody in it and no physics: what the level editor draws.
export function poseSim(def: LevelDef, t: number): SimView {
  const s = initialState(def);
  s.t = t;
  s.camX = camAtTime(def, t);
  def.wheels.forEach((w, i) => (s.wheels[i]!.angle = wheelAngle(w, t)));
  def.crushers.forEach((c, i) => (s.crushers[i] = crusherState(def, c, t)));
  def.seesaws.forEach((sw, i) => {
    if (sw.mode !== 'beat' || Math.floor(t / (sw.beat ?? 1.5)) % 2 === 0) return;
    const st = s.seesaws[i]!;
    st.side = st.side === 1 ? -1 : 1;
    st.angle = -st.angle;
  });
  return { def, s };
}

// ---------- Stepping ----------

export function step(sim: Sim, dt: number = SIM_STEP): SimEvent[] {
  const s = sim.s;
  const events: SimEvent[] = [];
  if (s.phase === 'won' || s.phase === 'failed') return events;

  s.history.push(s.held);
  if (s.history.length > 32) s.history.shift();

  if (s.phase === 'waiting') {
    if (!s.held) return events;
    s.phase = 'running';
    events.push({ type: 'start' });
  }

  s.t += dt;
  driveProps(sim, dt, events);
  if (s.phase === 'running') drivePuffs(sim);
  b2().b2World_Step(sim.world.id, dt, SUBSTEPS);
  readBack(sim, dt);

  const lost: { puff: Puff; cause: Cause }[] = [];
  readEvents(sim, events, lost);

  if (s.phase === 'respawning') {
    if (s.respawnAt !== null && s.t >= s.respawnAt) respawn(sim, events);
    return events;
  }

  scroll(sim, dt);
  for (const puff of s.puffs) {
    if (puff.x < s.camX + EDGE_KILL && !lost.some((l) => l.puff === puff)) lost.push({ puff, cause: 'behind' });
  }

  if (lost.length) {
    for (const { puff, cause } of lost) {
      const wasLeader = s.puffs[0] === puff;
      s.puffs = s.puffs.filter((p) => p !== puff);
      b2().b2Body_Disable(sim.world.puffBodies[puff.body]!);
      events.push({ type: 'lost', x: puff.x, y: puff.y, cause, leader: wasLeader, left: s.puffs.length });
    }
    if (s.puffs.length === 0) {
      allLost(sim, lost[lost.length - 1]!.cause, events);
      return events;
    }
    const lead = s.puffs[0]!;
    if (lead.base !== PUFF_RADIUS) {
      // The next clone takes the lead and grows its sprout.
      const scale = lead.r / lead.base;
      lead.base = PUFF_RADIUS;
      setRadius(sim, lead, PUFF_RADIUS * scale);
    }
  }

  resize(sim, dt, events);
  collectPickups(sim, events);
  checkBlooms(sim, events);

  const front = s.puffs[0];
  if (front && front.x >= sim.def.burrowX) {
    s.phase = 'won';
    s.home = s.puffs.length;
    events.push({ type: 'win', home: s.home });
  }
  return events;
}

// Retry from the fail screen: back to the last bloom with the clone count it saved.
export function retryFromCheckpoint(sim: Sim): SimEvent[] {
  const events: SimEvent[] = [];
  if (sim.s.phase !== 'failed') return events;
  respawn(sim, events);
  return events;
}

function allLost(sim: Sim, cause: Cause, events: SimEvent[]): void {
  const s = sim.s;
  s.deaths += 1;
  if (sim.def.deaths === 'screen') {
    s.phase = 'failed';
    s.failCause = cause;
    events.push({ type: 'fail', cause });
  } else {
    // Instant respawn: a 0.4s burst of fluff, then Puff re-forms at the last bloom.
    s.phase = 'respawning';
    s.respawnAt = s.t + RESPAWN_TIME;
  }
}

function respawn(sim: Sim, events: SimEvent[]): void {
  const { s, def } = sim;
  const cp = s.checkpoint;
  const count = cp?.count ?? 1;
  const x = cp?.x ?? def.startX;
  const y = cp?.y ?? def.startY;
  for (const p of s.puffs) b2().b2Body_Disable(sim.world.puffBodies[p.body]!);
  s.puffs = [];
  for (let i = 0; i < count; i++) {
    const slot = SLOTS[i]!;
    const puff = spawnPuff(sim, x + slot.dx, y + slot.dy, i === 0 ? PUFF_RADIUS : CLONE_RADIUS, 0, 0, 1);
    if (puff) s.puffs.push(puff);
  }
  // Another try: timed gates open again, and bubbles and orbs past the bloom grow back.
  for (const g of s.gates) g.closingAt = null;
  def.bubbles.forEach((b, i) => {
    if (b.x > x) s.bubbles[i] = { poppedAt: null, splitBy: [] };
  });
  def.orbs.forEach((o, i) => {
    if (o.x > x) s.orbs[i] = { poppedAt: null };
  });
  // The scroll waits for the next hold, so a retry never starts mid-fall.
  s.camX = x - PUFF_SCREEN_X;
  s.phase = 'waiting';
  s.held = false;
  s.respawnAt = null;
  s.freezeUntil = s.t + WHEEL_FREEZE;
  s.failCause = null;
  events.push({ type: 'respawn' });
}

// ---------- Puffs ----------

function spawnPuff(sim: Sim, x: number, y: number, base: number, vx: number, vy: number, size: number): Puff | null {
  const B = b2();
  const { world, s } = sim;
  const used = new Set(s.puffs.map((p) => p.body));
  const slot = world.puffBodies.findIndex((_, i) => !used.has(i));
  if (slot < 0) return null;
  const body = world.puffBodies[slot]!;
  const pos = new B.b2Vec2(m(x), m(y));
  const rot = B.b2MakeRot(0);
  B.b2Body_SetTransform(body, pos, rot);
  pos.delete();
  rot.delete();
  world.vec.Set(m(vx), m(vy));
  B.b2Body_SetLinearVelocity(body, world.vec);
  B.b2Body_Enable(body);
  const puff: Puff = { id: s.nextId++, body: slot, x, y, vx, vy, pvx: vx, pvy: vy, r: base * size, base, size, sizeUntil: 0, bonk: 0, lastBump: -Infinity };
  setRadius(sim, puff, base * size);
  return puff;
}

function setRadius(sim: Sim, puff: Puff, r: number): void {
  const B = b2();
  const { world } = sim;
  puff.r = r;
  const c = new B.b2Circle();
  c.radius = m(r);
  B.b2Shape_SetCircle(world.puffShapes[puff.body]!, c);
  c.radius = m(Math.max(2, r - SENSOR_GRACE));
  B.b2Shape_SetCircle(world.puffSensors[puff.body]!, c);
  c.delete();
  B.b2Body_UpdateMassFromShapes(world.puffBodies[puff.body]!);
}

// Hold to puff up; the drift carries Puff forward to its spot on screen. Clones copy the input a
// beat late and keep to their place in the flock. Forces scale with mass, so a swollen or shrunken
// Puff handles exactly the same: it only pushes harder or softer.
function drivePuffs(sim: Sim): void {
  const B = b2();
  const { s, world } = sim;
  const lead = s.puffs[0];
  if (!lead) return;
  s.puffs.forEach((p, i) => {
    const body = world.puffBodies[p.body]!;
    const mass = B.b2Body_GetMass(body);
    let held = s.held;
    let ay = 0;
    let targetVx: number;
    if (i === 0) {
      const off = (PUFF_SCREEN_X - (p.x - s.camX)) / DRIFT.ease;
      targetVx = sim.speed * (1 + clamp(off, -DRIFT.slow, DRIFT.catchUp));
    } else {
      held = s.history[Math.max(0, s.history.length - 1 - (CLONE_DELAY_STEPS + i - 1))] ?? false;
      // The flock keeps its shape at the leader's size: a shrunk flock bunches up to slip through
      // brambles together, a swollen one spreads a little.
      const k = clamp(lead.r / lead.base, 0.5, 1.2);
      const slot = SLOTS[i] ?? SLOTS[SLOTS.length - 1]!;
      targetVx = clamp(lead.vx + 4 * (lead.x + slot.dx * k - p.x), 0, sim.speed * 2);
      ay -= 3 * (p.y - (lead.y + slot.dy * k)); // a gentle pull back to its place in the flock
      const apart = p.y - lead.y;
      const over = Math.abs(apart) - (CLONE_SPREAD / 2) * k;
      // Clones drift, but never far past 1.5 Puff-widths from the leader.
      if (over > 0) ay += -Math.sign(apart) * 60 * over + 6 * (lead.vy - p.vy);
    }
    if (held) ay -= PHYSICS.lift;
    const ax = clamp(DRIFT.pull * (targetVx - p.vx), -DRIFT.accel, DRIFT.accel);
    world.vec.Set((mass * ax) / PT, (mass * ay) / PT);
    B.b2Body_ApplyForceToCenter(body, world.vec, true);
  });
}

function readBack(sim: Sim, dt: number): void {
  const B = b2();
  const { s, world, def } = sim;
  for (const p of s.puffs) {
    const body = world.puffBodies[p.body]!;
    const pos = B.b2Body_GetPosition(body);
    const vel = B.b2Body_GetLinearVelocity(body);
    p.pvx = p.vx;
    p.pvy = p.vy;
    p.x = pos.x * PT;
    p.y = pos.y * PT;
    p.vx = vel.x * PT;
    p.vy = vel.y * PT;
    pos.delete();
    vel.delete();
    if (Math.abs(p.vy) > PHYSICS.maxVy) {
      p.vy = Math.sign(p.vy) * PHYSICS.maxVy;
      world.vec.Set(m(p.vx), m(p.vy));
      B.b2Body_SetLinearVelocity(body, world.vec);
    }
    p.bonk = Math.max(0, p.bonk - dt);
  }
  s.pebbles.forEach((st, i) => {
    if (st.gone || st.jammed) return;
    const body = world.pebbles[i]!;
    const pos = B.b2Body_GetPosition(body);
    const rot = B.b2Body_GetRotation(body);
    st.x = pos.x * PT;
    st.y = pos.y * PT;
    st.angle = B.b2Rot_GetAngle(rot);
    pos.delete();
    rot.delete();
    if (st.x > def.length + 200) {
      st.gone = true;
      B.b2Body_Disable(body);
    }
  });
  def.wheels.forEach((_, i) => {
    const rot = B.b2Body_GetRotation(world.wheels[i]!);
    s.wheels[i]!.angle = B.b2Rot_GetAngle(rot);
    rot.delete();
  });
}

// ---------- Props ----------

function driveProps(sim: Sim, dt: number, events: SimEvent[]): void {
  const B = b2();
  const { def, s, world } = sim;

  def.seesaws.forEach((sw, i) => {
    const st = s.seesaws[i]!;
    const joint = world.joints[i];
    if (!joint) return; // the dud never moves
    const initial = sw.high === 'right' ? 1 : -1;
    const mode = sw.mode ?? 'free';
    // A positive angle raises the right end; Box2D measures the other way round.
    st.angle = -B.b2RevoluteJoint_GetCurrentAngle(joint);
    const side = st.side;
    if (side === 1 && st.angle < -TILT / 2) st.side = -1;
    if (side === -1 && st.angle > TILT / 2) st.side = 1;
    if (st.side !== side) {
      st.flips += 1;
      st.flippedAt = s.t;
      if (mode === 'free' || (mode === 'return' && !st.returning)) {
        s.tips += 1;
        events.push({ type: 'tip', id: sw.id });
      }
    }
    if (mode === 'return') {
      if (!st.returning && st.side !== initial && s.t - st.flippedAt >= (sw.returnAfter ?? 3)) {
        st.returning = true;
        B.b2RevoluteJoint_EnableMotor(joint, true);
        B.b2RevoluteJoint_SetMaxMotorTorque(joint, KNOCK_TORQUE);
        B.b2RevoluteJoint_SetTargetMotorSpeed(joint, -initial * KNOCK_SPEED);
        B.b2Joint_WakeBodies(joint); // a log at rest sleeps, and a sleeping motor does nothing
        events.push({ type: 'drop', id: sw.id });
      } else if (st.returning && st.side === initial && Math.abs(st.angle - initial * TILT) < 0.02) {
        st.returning = false;
        B.b2RevoluteJoint_EnableMotor(joint, false);
      }
    }
    if (sw.heavy) {
      // Only a swollen Puff's weight frees the hinge. Physics does the rest.
      const free = s.puffs.some((p) => p.r > p.base * 1.4 && onPlank(sw, st.angle, p));
      B.b2RevoluteJoint_SetMaxMotorTorque(joint, free ? 0 : KNOCK_TORQUE);
      if (free) B.b2Joint_WakeBodies(joint);
    }
    if (mode === 'beat') {
      const n = Math.floor(s.t / (sw.beat ?? 1.5));
      const want = n % 2 === 0 ? initial : -initial;
      if (n !== st.beat || s.t <= dt) {
        st.beat = n;
        if (want !== st.side) events.push({ type: 'knock', id: sw.id });
        B.b2RevoluteJoint_SetTargetMotorSpeed(joint, -want * KNOCK_SPEED);
        B.b2Joint_WakeBodies(joint);
      }
    }
  });

  def.gates.forEach((g, i) => {
    const st = s.gates[i]!;
    const link = s.seesaws[def.seesaws.findIndex((sw) => sw.id === g.link)]!;
    const was = st.open;
    if (link.flips > 0) {
      if (g.mode === 'latch') {
        st.open = Math.min(1, st.open + dt / 0.6);
      } else {
        // Timed: once open, it waits for Puff, then drifts shut over closeTime. It never closes
        // onto a Puff underneath it.
        const lead = s.puffs[0];
        if (st.closingAt === null && lead && st.open >= 1 && g.x - lead.x <= (g.closeAhead ?? 260)) st.closingAt = s.t;
        if (st.closingAt === null) st.open = Math.min(1, st.open + dt / 0.3);
        else if (!puffUnder(sim, g.x, g.x + GATE_WIDTH, gateBottom(sim, i))) st.open = Math.max(0, st.open - dt / (g.closeTime ?? 3));
      }
    }
    if (was === 0 && st.open > 0) events.push({ type: 'gate', id: g.id });
    const lift = st.open * (FLOOR - g.openBottom);
    moveY(sim, world.gates[i]!, st.lift - lift, dt);
    st.lift = lift;
  });

  def.curtains.forEach((c, i) => {
    const st = s.curtains[i]!;
    const swi = def.seesaws.findIndex((sw) => sw.id === c.link);
    const initial = def.seesaws[swi]!.high === 'right' ? 1 : -1;
    const lifted = s.seesaws[swi]!.side !== initial;
    const next = lifted ? Math.min(1, st.open + dt / 0.35) : Math.max(0, st.open - dt / 0.5);
    // A falling curtain waits rather than crush a Puff into the floor.
    if (next >= st.open || !puffUnder(sim, c.x0, c.x1, curtainBottom(sim, i))) st.open = next;
    const lift = st.open * (c.closedBottom - c.openBottom);
    moveY(sim, world.curtains[i]!, st.lift - lift, dt);
    st.lift = lift;
  });

  def.wheels.forEach((w, i) => {
    const spinning = !s.wheels[i]!.jammed && s.t >= s.freezeUntil;
    B.b2Body_SetAngularVelocity(world.wheels[i]!, spinning ? (w.spin * Math.PI) / 180 : 0);
  });

  def.crushers.forEach((c, i) => {
    const st = s.crushers[i]!;
    const next = crusherState(def, c, s.t);
    if (next.warn && !st.warn) events.push({ type: 'dust', id: c.id });
    if (next.drop >= 1 && st.drop < 1) events.push({ type: 'slam', id: c.id });
    moveY(sim, world.crushers[i]!, (next.drop - st.drop) * (FLOOR - c.rest), dt);
    s.crushers[i] = next;
  });
}

// Is this Puff resting on (or pressing into) the log?
function onPlank(sw: SeesawDef, angle: number, p: Puff): boolean {
  const e = seesawEnds(sw, angle);
  const dx = e.bx - e.ax;
  const dy = e.by - e.ay;
  const k = clamp(((p.x - e.ax) * dx + (p.y - e.ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(p.x - (e.ax + dx * k), p.y - (e.ay + dy * k)) < p.r + PLANK_HALF_THICK + 3;
}

// Move a kinematic body down by dy pt (up when negative) over this step.
function moveY(sim: Sim, body: b2BodyId, dy: number, dt: number): void {
  sim.world.vec.Set(0, m(dy) / dt);
  b2().b2Body_SetLinearVelocity(body, sim.world.vec);
}

// Is a Puff right under something coming down at `bottom` between x0 and x1?
function puffUnder(sim: Sim, x0: number, x1: number, bottom: number): boolean {
  return sim.s.puffs.some((p) => p.x + p.r > x0 - 2 && p.x - p.r < x1 + 2 && p.y + p.r > bottom && p.y - p.r < bottom + 6);
}

// ---------- Contacts ----------

function readEvents(sim: Sim, events: SimEvent[], lost: { puff: Puff; cause: Cause }[]): void {
  const B = b2();
  const { s, world, def } = sim;
  const bySlot = (slot: number) => s.puffs.find((p) => p.body === slot);

  // Hazards: a Puff's sensor, its body less a little fuzz, touched something deadly.
  const sensed = B.b2World_GetSensorEvents(world.id);
  for (let k = 0; k < sensed.beginCount; k++) {
    const e = sensed.GetBeginEvent(k);
    const a = world.tags.get(e.sensorShapeId.index1);
    const b = world.tags.get(e.visitorShapeId.index1);
    if (a?.kind !== 'sensor' || b?.kind !== 'hazard') continue;
    const puff = bySlot(a.slot);
    if (puff && !lost.some((l) => l.puff === puff)) lost.push({ puff, cause: b.cause });
  }
  sensed.delete();

  const contacts = B.b2World_GetContactEvents(world.id);
  for (let k = 0; k < contacts.beginCount; k++) {
    const e = contacts.GetBeginEvent(k);
    const a = world.tags.get(e.shapeIdA.index1);
    const b = world.tags.get(e.shapeIdB.index1);
    e.delete();
    if (!a || !b) continue;
    for (const [one, other] of [[a, b], [b, a]] as const) {
      if (one.kind === 'pebble' && other.kind === 'hazard' && other.wheel !== undefined) {
        // A pebble rolling into a jammable wheel's axle stops it for good.
        const w = def.wheels[other.wheel]!;
        const ws = s.wheels[other.wheel]!;
        const ps = s.pebbles[one.index]!;
        if (w.jammable && !ws.jammed && !ps.jammed) {
          ws.jammed = true;
          ps.jammed = true;
          B.b2Body_SetType(world.pebbles[one.index]!, B.b2BodyType.b2_staticBody);
          events.push({ type: 'jam', id: w.id });
        }
      }
      if (one.kind === 'puff') {
        const puff = bySlot(one.slot);
        if (!puff) continue;
        if (other.kind === 'pebble' && !s.pebbles[other.index]!.jammed) events.push({ type: 'push', id: def.pebbles[other.index]!.id });
        bump(sim, puff, events);
      }
    }
  }
  contacts.delete();
}

// A fresh touch that costs real speed is a bump: a squash, a thud, and a buzz.
function bump(sim: Sim, puff: Puff, events: SimEvent[]): void {
  const { s } = sim;
  if (s.t - puff.lastBump < BUMP_COOLDOWN) return;
  if (Math.hypot(puff.vx - puff.pvx, puff.vy - puff.pvy) < BUMP_SPEED) return;
  puff.lastBump = s.t;
  puff.bonk = 0.25;
  s.bumps += 1;
  events.push({ type: 'bump', x: puff.x, y: puff.y, leader: s.puffs[0] === puff });
}

// ---------- Scroll ----------

function scroll(sim: Sim, dt: number): void {
  const { s, def } = sim;
  if (s.t >= s.lingerUntil) s.camX += sim.speed * dt;
  const front = Math.max(...s.puffs.map((p) => p.x));
  s.camX = Math.min(Math.max(s.camX, front - CAM_LEAD), def.length - SCREEN.width);
}

// ---------- Pickups ----------

function resize(sim: Sim, dt: number, events: SimEvent[]): void {
  const { s } = sim;
  let wore = false;
  for (const p of s.puffs) {
    if (p.size !== 1 && s.t >= p.sizeUntil) {
      p.size = 1;
      wore = true;
    }
    const want = p.base * p.size;
    if (Math.abs(p.r - want) > 0.01) {
      const rate = SIZE.rate * p.base * dt;
      setRadius(sim, p, p.r + clamp(want - p.r, -rate, rate));
    }
  }
  if (wore) events.push({ type: 'unsize' });
}

function collectPickups(sim: Sim, events: SimEvent[]): void {
  const { def, s } = sim;
  def.seeds.forEach((seed, i) => {
    if (s.seeds[i]) return;
    const p = seedPosition(sim, i);
    // Any clone can collect a seed, so a wider flock is a wider net.
    if (s.puffs.some((puff) => Math.hypot(puff.x - p.x, puff.y - p.y) < puff.r + SEED_R + 2)) {
      s.seeds[i] = true;
      events.push({ type: 'seed', id: seed.id });
    }
  });

  // Split bubble: every Puff that touches it while it pops splits in two, up to 6 Puffs.
  def.bubbles.forEach((b, i) => {
    const st = s.bubbles[i]!;
    if (st.poppedAt !== null && s.t - st.poppedAt > POP_WINDOW) return;
    let made = 0;
    for (const puff of [...s.puffs]) {
      if (st.splitBy.includes(puff.id)) continue;
      if (Math.hypot(puff.x - b.x, puff.y - b.y) >= puff.r + BUBBLE_R + 4) continue;
      if (st.poppedAt === null) {
        st.poppedAt = s.t;
        events.push({ type: 'pop', id: b.id });
      }
      st.splitBy.push(puff.id);
      if (s.puffs.length >= MAX_PUFFS) continue;
      const twin = spawnPuff(sim, puff.x - 6, puff.y + (s.puffs.length % 2 ? 14 : -14), CLONE_RADIUS, puff.vx, puff.vy, puff.size);
      if (!twin) continue;
      twin.sizeUntil = puff.sizeUntil;
      st.splitBy.push(twin.id);
      s.puffs.push(twin);
      made += 1;
    }
    if (made) events.push({ type: 'split', x: b.x, y: b.y, count: s.puffs.length });
  });

  // Swell and Shrink: the first Puff to touch an orb pops it, and the whole flock changes size
  // together for a while, so a flock can still fit through what its leader fits through.
  def.orbs.forEach((o, i) => {
    const st = s.orbs[i]!;
    if (st.poppedAt !== null) return;
    if (!s.puffs.some((p) => Math.hypot(p.x - o.x, p.y - o.y) < p.r + ORB_R + 4)) return;
    st.poppedAt = s.t;
    events.push({ type: 'resize', id: o.id, kind: o.kind });
    for (const puff of s.puffs) {
      puff.size = o.kind === 'swell' ? SIZE.swell : SIZE.shrink;
      puff.sizeUntil = s.t + (o.time ?? SIZE.time);
    }
  });
}

function checkBlooms(sim: Sim, events: SimEvent[]): void {
  const { def, s } = sim;
  const lead = s.puffs[0]!;
  def.blooms.forEach((b, i) => {
    if (s.blooms[i] || lead.x < b.x) return;
    s.blooms[i] = true;
    // The checkpoint saves your clone count. Respawning never takes clones away.
    s.checkpoint = { x: b.x, y: BLOOM_SPAWN_Y, count: s.puffs.length };
    events.push({ type: 'checkpoint', id: b.id });
    // 1-1: the scroll lingers 0.5s on the first bloom so the player notices it.
    if (def.lingerAtBloom && !s.lingered) {
      s.lingered = true;
      s.lingerUntil = s.t + LINGER;
    }
  });
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

