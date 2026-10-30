import {
  BUMP_BACK,
  CLONE_LAG,
  CLONE_RADIUS,
  CLONE_SPREAD,
  MAX_PUFFS,
  PHYSICS,
  PLAYFIELD,
  PUFF_RADIUS,
  RESPAWN_TIME,
  SIM_STEP,
  STUCK_REWIND,
  WHEEL_FREEZE,
} from '../config/constants';
import { tuning } from '../config/tuning';
import { angleDiff, circleCapsule, circleCircle, circleRect, circleTriangle, clamp, type Contact } from './geometry';
import type { LevelDef, SeesawDef, WheelDef } from './types';

// Pure fixed-step simulation of one level. No rendering and no randomness, so tests and the
// level solver can run it headless and get the same result every time.

export type Cause = 'briar' | 'thornwheel' | 'stranded';

export type SimEvent =
  | { type: 'start' }
  | { type: 'bump'; x: number; y: number; leader: boolean }
  | { type: 'tip'; id: string }
  | { type: 'drop'; id: string } // a returning seesaw falls back
  | { type: 'knock'; id: string } // a thornwheel knocks a seesaw
  | { type: 'gate'; id: string }
  | { type: 'seed'; id: string }
  | { type: 'pop'; id: string }
  | { type: 'split'; x: number; y: number; count: number }
  | { type: 'checkpoint'; id: string }
  | { type: 'lost'; x: number; y: number; cause: Cause; leader: boolean; left: number }
  | { type: 'respawn'; rewind: boolean }
  | { type: 'jam'; id: string }
  | { type: 'push'; id: string }
  | { type: 'fail'; cause: Cause }
  | { type: 'win'; home: number };

export interface Puff {
  id: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  bonk: number; // seconds of squash left after a bump
  lastBump?: number; // s, when it last bumped; a Puff pressed against a wall just rests there
}

export interface SimState {
  phase: 'waiting' | 'running' | 'respawning' | 'failed' | 'won';
  t: number;
  held: boolean;
  history: boolean[]; // held state per step, newest last, for clone lag
  lastReleaseAt: number;
  puffs: Puff[]; // index 0 leads; only the leader has a sprout
  nextId: number;
  seesaws: { side: 1 | -1; angle: number; flippedAt: number; flips: number }[];
  gates: { open: number; closingAt: number | null }[];
  curtains: { open: number }[];
  wheels: { angle: number; jammed: boolean }[];
  pebbles: { x: number; y: number; vx: number; vy: number; jammed: boolean; gone: boolean; flungUntil: number }[];
  bubbles: { poppedAt: number | null; splitBy: number[] }[];
  seeds: boolean[];
  blooms: boolean[];
  checkpoint: { x: number; y: number; count: number } | null;
  respawnAt: number | null;
  rewinding: boolean;
  freezeUntil: number;
  stuckFor: number;
  touching: string[];
  deaths: number;
  bumps: number;
  tips: number;
  home: number;
  failCause: Cause | null;
}

export interface Sim {
  readonly def: LevelDef;
  readonly speed: number;
  s: SimState;
}

const TILT = (12 * Math.PI) / 180;
const PLANK_HALF_THICK = 5;
const FULCRUM_HALF = 12;
const GATE_WIDTH = 14;
const BUBBLE_R = 20;
const SEED_R = 7;
const POP_WINDOW = 0.25;
const WHEEL_CORE = 0.75;
const TOOTH_GAP = (16 * Math.PI) / 180;
const PEBBLE_GRAVITY = 600;
const CLONE_DELAY_STEPS = Math.round(CLONE_LAG / SIM_STEP);
const BLOOM_SPAWN_Y = 190;
const STRAND_DISTANCE = 360;
const FLING_REACH = 100; // a tipping log knocks loose pebbles this close to its rising end
const BUMP_COOLDOWN = 0.6; // s between bumps; inside it, Puff rests against the wall
const TIP_COOLDOWN = 1; // s a tipped log settles before it can tip back
const FLING_CLEAR = 0.3; // s a knocked pebble flies clear of walls before it can hit them

// Formation for the flock, relative to the leader. Every slot stays within the 45pt spread.
export const SLOTS = [
  { dx: 0, dy: 0 },
  { dx: -16, dy: 12 },
  { dx: -28, dy: -12 },
  { dx: -40, dy: 20 },
  { dx: -24, dy: -20 },
  { dx: -36, dy: 4 },
];

export function createSim(def: LevelDef): Sim {
  return { def, speed: tuning(def.n).speed, s: initialState(def) };
}

function initialState(def: LevelDef): SimState {
  return {
    phase: 'waiting',
    t: 0,
    held: false,
    history: [],
    lastReleaseAt: 0,
    puffs: [{ id: 0, x: def.startX, y: def.startY, vy: 0, r: PUFF_RADIUS, bonk: 0 }],
    nextId: 1,
    seesaws: def.seesaws.map((sw) => {
      const side = sw.high === 'right' ? 1 : -1;
      return { side, angle: side * TILT, flippedAt: -Infinity, flips: 0 };
    }),
    gates: def.gates.map(() => ({ open: 0, closingAt: null })),
    curtains: def.curtains.map(() => ({ open: 0 })),
    wheels: def.wheels.map(() => ({ angle: 0, jammed: false })),
    pebbles: def.pebbles.map((p) => ({ x: p.x, y: p.y, vx: 0, vy: 0, jammed: false, gone: false, flungUntil: 0 })),
    bubbles: def.bubbles.map(() => ({ poppedAt: null, splitBy: [] })),
    seeds: def.seeds.map(() => false),
    blooms: def.blooms.map(() => false),
    checkpoint: null,
    respawnAt: null,
    rewinding: false,
    freezeUntil: 0,
    stuckFor: 0,
    touching: [],
    deaths: 0,
    bumps: 0,
    tips: 0,
    home: 0,
    failCause: null,
  };
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

export function seesawEnds(def: SeesawDef, angle: number) {
  const cx = Math.cos(angle) * def.half;
  const sy = Math.sin(angle) * def.half;
  return { ax: def.px - cx, ay: def.py + sy, bx: def.px + cx, by: def.py - sy };
}

export function gateBottom(sim: Sim, i: number): number {
  const g = sim.def.gates[i]!;
  return PLAYFIELD.floorY + (g.openBottom - PLAYFIELD.floorY) * sim.s.gates[i]!.open;
}

export function curtainBottom(sim: Sim, i: number): number {
  const c = sim.def.curtains[i]!;
  return c.closedBottom + (c.openBottom - c.closedBottom) * sim.s.curtains[i]!.open;
}

export function humpCircle(width: number, height: number) {
  const r = (width * width) / 4 / (2 * height) + height / 2;
  return { r, cy: PLAYFIELD.floorY - height + r };
}

export function wheelCore(w: WheelDef): number {
  return w.r * WHEEL_CORE;
}

export function seedPosition(sim: Sim, i: number): { x: number; y: number } {
  const seed = sim.def.seeds[i]!;
  if (!seed.orbit) return seed;
  const wi = sim.def.wheels.findIndex((w) => w.id === seed.orbit!.wheel);
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
  updateProps(sim, dt, events);

  if (s.phase === 'respawning') {
    if (s.respawnAt !== null && s.t >= s.respawnAt) respawn(sim, events);
    return events;
  }

  const lost: { puff: Puff; cause: Cause }[] = [];
  s.puffs.forEach((puff, i) => {
    movePuff(sim, puff, i, dt, events);
    const cause = hazardAt(sim, puff);
    if (cause) lost.push({ puff, cause });
  });

  const lead = s.puffs[0]!;
  for (const puff of s.puffs.slice(1)) {
    if (puff.x < lead.x - STRAND_DISTANCE && !lost.some((l) => l.puff === puff)) lost.push({ puff, cause: 'stranded' });
  }

  if (lost.length) {
    for (const { puff, cause } of lost) {
      const wasLeader = s.puffs[0] === puff;
      s.puffs = s.puffs.filter((p) => p !== puff);
      events.push({ type: 'lost', x: puff.x, y: puff.y, cause, leader: wasLeader, left: s.puffs.length });
    }
    if (s.puffs.length === 0) {
      allLost(sim, lost[lost.length - 1]!.cause, events);
      return events;
    }
    s.puffs[0]!.r = PUFF_RADIUS; // the next clone takes the lead and grows its sprout
  }

  collectPickups(sim, events);
  checkBlooms(sim, events);
  checkStuck(sim, dt, events);

  const front = s.puffs[0];
  if (front && s.phase === 'running' && front.x >= sim.def.burrowX) {
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
    s.rewinding = false;
  }
}

function respawn(sim: Sim, events: SimEvent[]): void {
  const s = sim.s;
  const cp = s.checkpoint;
  const count = s.rewinding ? Math.max(1, s.puffs.length) : (cp?.count ?? 1);
  const x = cp?.x ?? sim.def.startX;
  const y = cp?.y ?? sim.def.startY;
  s.puffs = [];
  for (let i = 0; i < count; i++) {
    const slot = SLOTS[i]!;
    s.puffs.push({ id: s.nextId++, x: x + slot.dx, y: y + slot.dy, vy: 0, r: i === 0 ? PUFF_RADIUS : CLONE_RADIUS, bonk: 0 });
  }
  // Timed gates whose log has tipped open again for another try.
  s.gates.forEach((g) => {
    g.closingAt = null;
  });
  s.phase = 'running';
  s.respawnAt = null;
  s.freezeUntil = s.t + WHEEL_FREEZE;
  s.stuckFor = 0;
  s.touching = [];
  s.failCause = null;
  events.push({ type: 'respawn', rewind: s.rewinding });
  s.rewinding = false;
}

function updateProps(sim: Sim, dt: number, events: SimEvent[]): void {
  const { def, s } = sim;

  def.seesaws.forEach((sw, i) => {
    const st = s.seesaws[i]!;
    const initial = sw.high === 'right' ? 1 : -1;
    if (sw.mode === 'return' && st.side !== initial && s.t - st.flippedAt >= (sw.returnAfter ?? 3)) {
      flip(sim, i, events, false);
      events.push({ type: 'drop', id: sw.id });
    }
    if (sw.mode === 'beat') {
      const beat = sw.beat ?? 1.5;
      const want = Math.floor(s.t / beat) % 2 === 0 ? initial : (-initial as 1 | -1);
      if (want !== st.side) {
        flip(sim, i, events, false);
        events.push({ type: 'knock', id: sw.id });
      }
    }
    const target = st.side * TILT;
    const rate = (TILT * 2) / 0.25;
    st.angle += clamp(target - st.angle, -rate * dt, rate * dt);
  });

  def.gates.forEach((g, i) => {
    const st = s.gates[i]!;
    const link = s.seesaws[def.seesaws.findIndex((sw) => sw.id === g.link)]!;
    if (g.mode === 'latch') {
      if (link.flips > 0) {
        if (st.open === 0) events.push({ type: 'gate', id: g.id });
        st.open = Math.min(1, st.open + dt / 0.6);
      }
    } else if (link.flips > 0) {
      // Timed: once open, it waits for Puff, then drifts shut over closeTime.
      if (st.open === 0 && st.closingAt === null) events.push({ type: 'gate', id: g.id });
      const lead = s.puffs[0];
      if (st.closingAt === null && lead && st.open >= 1 && g.x - lead.x <= (g.closeAhead ?? 260)) st.closingAt = s.t;
      st.open = st.closingAt === null ? Math.min(1, st.open + dt / 0.3) : Math.max(0, 1 - (s.t - st.closingAt) / (g.closeTime ?? 3));
    }
  });

  def.curtains.forEach((c, i) => {
    const st = s.curtains[i]!;
    const swi = def.seesaws.findIndex((sw) => sw.id === c.link);
    const initial = def.seesaws[swi]!.high === 'right' ? 1 : -1;
    const lifted = s.seesaws[swi]!.side !== initial;
    st.open = lifted ? Math.min(1, st.open + dt / 0.35) : Math.max(0, st.open - dt / 0.5);
  });

  def.wheels.forEach((w, i) => {
    const st = s.wheels[i]!;
    if (st.jammed || s.t < s.freezeUntil) return;
    st.angle += ((w.spin * Math.PI) / 180) * dt;
  });

  movePebbles(sim, dt, events);
}

function flip(sim: Sim, i: number, events: SimEvent[], byPlayer: boolean): void {
  const { def, s } = sim;
  const sw = def.seesaws[i]!;
  const st = s.seesaws[i]!;
  // Anything resting against the end that rises gets flung off it. Test against the plank where it lies now.
  const ends = seesawEnds(sw, st.angle);
  st.side = -st.side as 1 | -1;
  st.flippedAt = s.t;
  st.flips += 1;
  if (byPlayer) {
    s.tips += 1;
    events.push({ type: 'tip', id: sw.id });
  }
  const tipX = st.side > 0 ? ends.bx : ends.ax;
  const tipY = st.side > 0 ? ends.by : ends.ay;
  s.pebbles.forEach((p, pi) => {
    if (p.gone || p.jammed) return;
    const r = def.pebbles[pi]!.r;
    // On the rising end, or on the ground just past it where the log's knock reaches.
    const touching = circleCapsule(p.x, p.y, r + 6, ends.ax, ends.ay, ends.bx, ends.by, PLANK_HALF_THICK);
    const knocked = Math.hypot(p.x - tipX, p.y - tipY) < FLING_REACH;
    if ((touching || knocked) && (p.x - sw.px) * st.side > 0) {
      p.vy = -280;
      p.vx = st.side * 160;
      p.flungUntil = s.t + FLING_CLEAR;
    }
  });
}

// ---------- Puffs ----------

function movePuff(sim: Sim, puff: Puff, i: number, dt: number, events: SimEvent[]): void {
  const { s } = sim;
  const lead = s.puffs[0]!;
  const slot = SLOTS[i] ?? SLOTS[SLOTS.length - 1]!;
  let vx = sim.speed;
  let held = s.held;

  if (i > 0) {
    const delay = CLONE_DELAY_STEPS + (i - 1);
    held = s.history[Math.max(0, s.history.length - 1 - delay)] ?? false;
    vx = clamp(sim.speed + 4 * (lead.x + slot.dx - puff.x), 0, sim.speed * 2);
  }

  puff.bonk = Math.max(0, puff.bonk - dt);
  puff.x += vx * dt;
  let accel = PHYSICS.gravity - (held ? PHYSICS.lift : 0);
  if (i > 0) accel -= 3 * (puff.y - (lead.y + slot.dy)); // a gentle pull back to its place in the flock
  puff.vy = clamp(puff.vy + accel * dt, -PHYSICS.maxVy, PHYSICS.maxVy);
  puff.y += puff.vy * dt;
  if (i > 0 && Math.abs(puff.y - lead.y) > CLONE_SPREAD / 2) {
    // Clones drift, but never more than 1.5 Puff-widths from the leader.
    puff.y = lead.y + Math.sign(puff.y - lead.y) * (CLONE_SPREAD / 2);
    puff.vy = lead.vy;
  }

  const { roofY, floorY } = PLAYFIELD;
  if (puff.y < roofY + puff.r) {
    puff.y = roofY + puff.r;
    puff.vy = Math.max(0, puff.vy);
  }
  if (puff.y > floorY - puff.r) {
    puff.y = floorY - puff.r;
    puff.vy = Math.min(0, puff.vy);
  }

  const contacts = new Set<string>();
  const hit = (key: string, c: Contact | null, bounce = 0) => {
    if (!c) return false;
    resolve(puff, vx, c, bounce);
    if (Math.abs(c.nx) > 0.6 && c.nx < 0) {
      contacts.add(key);
      const fresh = !s.touching.includes(`${puff.id}:${key}`) && s.t - (puff.lastBump ?? -Infinity) > BUMP_COOLDOWN;
      if (fresh) {
        puff.x -= BUMP_BACK;
        puff.bonk = 0.25;
        puff.lastBump = s.t;
        s.bumps += 1;
        events.push({ type: 'bump', x: puff.x, y: puff.y, leader: i === 0 });
      }
    }
    return true;
  };

  const near = (x0: number, x1: number) => x1 > puff.x - 80 && x0 < puff.x + 80;
  const { def } = sim;

  for (const r of def.rects) {
    if (near(r.x0, r.x1)) hit(r.id, circleRect(puff.x, puff.y, puff.r, r.x0, r.y0, r.x1, r.y1));
  }
  for (const h of def.humps) {
    if (!near(h.cx - h.width / 2, h.cx + h.width / 2)) continue;
    const c = humpCircle(h.width, h.height);
    hit(h.id, circleCircle(puff.x, puff.y, puff.r, h.cx, c.cy, c.r), PHYSICS.bounce);
  }
  def.seesaws.forEach((sw, si) => {
    if (!near(sw.px - sw.half, sw.px + sw.half)) return;
    const st = s.seesaws[si]!;
    const e = seesawEnds(sw, st.angle);
    const c = circleCapsule(puff.x, puff.y, puff.r, e.ax, e.ay, e.bx, e.by, PLANK_HALF_THICK);
    if (c) {
      const settled = s.t - st.flippedAt >= TIP_COOLDOWN;
      const landing = c.ny < -0.5 && puff.vy > 40 && settled;
      const onHigh = (c.px - sw.px) * st.side > sw.half * 0.25;
      const mode = sw.mode ?? 'free';
      if (landing && onHigh && (mode === 'free' || mode === 'return')) flip(sim, si, events, true);
      if (landing && mode === 'dud') {
        resolve(puff, vx, c, 0);
        puff.vy = -260; // the wrong log just bounces you
        return;
      }
      hit(sw.id, c);
    }
    hit(`${sw.id}-fulcrum`, circleRect(puff.x, puff.y, puff.r, sw.px - FULCRUM_HALF, sw.py + 4, sw.px + FULCRUM_HALF, sw.baseY ?? PLAYFIELD.floorY));
  });
  def.gates.forEach((g, gi) => {
    if (!near(g.x, g.x + GATE_WIDTH)) return;
    hit(g.id, circleRect(puff.x, puff.y, puff.r, g.x, PLAYFIELD.roofY, g.x + GATE_WIDTH, gateBottom(sim, gi)));
  });
  def.pebbles.forEach((pd, pi) => {
    const p = s.pebbles[pi]!;
    if (p.gone) return;
    const c = circleCircle(puff.x, puff.y, puff.r, p.x, p.y, pd.r);
    if (!c) return;
    resolve(puff, vx, c, 0);
    if (!p.jammed && c.nx < 0) {
      // Bumping a pebble rolls it ahead.
      if (p.vx < sim.speed * 1.2) events.push({ type: 'push', id: pd.id });
      p.vx = Math.max(p.vx, sim.speed * 1.25);
      p.x += c.depth * 0.5;
    }
  });

  const prefix = `${puff.id}:`;
  s.touching = s.touching.filter((k) => !k.startsWith(prefix));
  for (const key of contacts) s.touching.push(prefix + key);
}

// Push a Puff out of a shape. Puffs move forward at the scroll speed, so a push backward costs ground.
function resolve(puff: Puff, vx: number, c: Contact, bounce: number): void {
  puff.x += c.nx * c.depth;
  puff.y += c.ny * c.depth;
  const vn = vx * c.nx + puff.vy * c.ny;
  if (vn < 0) puff.vy -= (1 + bounce) * vn * c.ny;
}

function hazardAt(sim: Sim, puff: Puff): Cause | null {
  const { def, s } = sim;
  const r = puff.r - 3; // a little forgiveness on spikes
  for (const b of def.briars) {
    // Only the spikes under the Puff can touch it.
    const w = b.width ?? 20;
    const first = Math.max(0, Math.floor((puff.x - r - b.x0) / w));
    const last = Math.min(b.spikes.length - 1, Math.floor((puff.x + r - b.x0) / w));
    const dir = b.side === 'up' ? -1 : 1;
    for (let k = first; k <= last; k++) {
      const x = b.x0 + k * w;
      if (circleTriangle(puff.x, puff.y, r, x, b.base, x + w, b.base, x + w / 2, b.base + dir * b.spikes[k]!)) return 'briar';
    }
  }
  for (let i = 0; i < def.curtains.length; i++) {
    const c = def.curtains[i]!;
    if (circleRect(puff.x, puff.y, r, c.x0, PLAYFIELD.roofY, c.x1, curtainBottom(sim, i))) return 'briar';
  }
  for (let i = 0; i < def.wheels.length; i++) {
    const w = def.wheels[i]!;
    const dx = puff.x - w.cx;
    const dy = puff.y - w.cy;
    const d = Math.hypot(dx, dy);
    if (d >= w.r + r) continue;
    if (d < wheelCore(w) + r) return 'thornwheel';
    const inGap = w.missingTooth && Math.abs(angleDiff(Math.atan2(dy, dx), s.wheels[i]!.angle)) < TOOTH_GAP;
    if (!inGap) return 'thornwheel';
  }
  return null;
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
      const twin: Puff = { id: s.nextId++, x: puff.x - 6, y: puff.y + (s.puffs.length % 2 ? 14 : -14), vy: puff.vy, r: CLONE_RADIUS, bonk: 0 };
      st.splitBy.push(twin.id);
      s.puffs.push(twin);
      made += 1;
    }
    if (made) events.push({ type: 'split', x: b.x, y: b.y, count: s.puffs.length });
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
  });
}

// If Puff is pressed against a closed gate for a while, it drifts back to try again.
function checkStuck(sim: Sim, dt: number, events: SimEvent[]): void {
  const { def, s } = sim;
  const lead = s.puffs[0]!;
  const blocked = def.gates.some((g, i) => s.touching.includes(`${lead.id}:${g.id}`) && s.gates[i]!.open < 0.6);
  s.stuckFor = blocked ? s.stuckFor + dt : 0;
  if (s.stuckFor >= STUCK_REWIND) {
    s.stuckFor = 0;
    s.phase = 'respawning';
    s.respawnAt = s.t + RESPAWN_TIME;
    s.rewinding = true;
    events.push({ type: 'lost', x: lead.x, y: lead.y, cause: 'stranded', leader: true, left: s.puffs.length });
  }
}

// ---------- Pebbles ----------

function movePebbles(sim: Sim, dt: number, events: SimEvent[]): void {
  const { def, s } = sim;
  s.pebbles.forEach((p, i) => {
    if (p.gone || p.jammed) return;
    const r = def.pebbles[i]!.r;
    if (p.vx === 0 && p.vy === 0 && restingSupported(sim, p.x, p.y, r)) return;
    p.vy = Math.min(p.vy + PEBBLE_GRAVITY * dt, 700);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const push = (c: Contact | null) => {
      if (!c) return false;
      p.x += c.nx * c.depth;
      p.y += c.ny * c.depth;
      const vn = p.vx * c.nx + p.vy * c.ny;
      if (vn < 0) {
        p.vx -= 1.2 * vn * c.nx;
        p.vy -= 1.2 * vn * c.ny;
      }
      return true;
    };

    if (p.y > PLAYFIELD.floorY - r) {
      p.y = PLAYFIELD.floorY - r;
      p.vy = 0;
    }
    const flying = s.t < p.flungUntil;
    if (!flying) for (const rect of def.rects) push(circleRect(p.x, p.y, r, rect.x0, rect.y0, rect.x1, rect.y1));
    for (const h of def.humps) {
      const c = humpCircle(h.width, h.height);
      push(circleCircle(p.x, p.y, r, h.cx, c.cy, c.r));
    }
    def.seesaws.forEach((sw, si) => {
      const st = s.seesaws[si]!;
      const e = seesawEnds(sw, st.angle);
      const c = circleCapsule(p.x, p.y, r, e.ax, e.ay, e.bx, e.by, PLANK_HALF_THICK);
      const settled = s.t - st.flippedAt >= TIP_COOLDOWN;
      if (c && settled && c.ny < -0.5 && p.vy > 40 && (c.px - sw.px) * st.side > sw.half * 0.25 && (sw.mode ?? 'free') === 'free') {
        flip(sim, si, events, true); // props can move other props
      }
      push(c);
      push(circleRect(p.x, p.y, r, sw.px - FULCRUM_HALF, sw.py + 4, sw.px + FULCRUM_HALF, sw.baseY ?? PLAYFIELD.floorY));
    });
    def.gates.forEach((g, gi) => push(circleRect(p.x, p.y, r, g.x, PLAYFIELD.roofY, g.x + GATE_WIDTH, gateBottom(sim, gi))));
    def.wheels.forEach((w, wi) => {
      if (Math.hypot(p.x - w.cx, p.y - w.cy) < w.r + r && w.jammable && !s.wheels[wi]!.jammed) {
        s.wheels[wi]!.jammed = true;
        p.jammed = true;
        events.push({ type: 'jam', id: w.id });
      }
    });

    // Rolling friction along the ground.
    const grounded = p.y >= PLAYFIELD.floorY - r - 0.5;
    if (grounded) p.vx *= Math.max(0, 1 - 0.6 * dt);
    if (Math.abs(p.vx) < 4 && grounded) p.vx = 0;
    if (p.x > def.length + 200) p.gone = true;
  });
}

// A pebble placed at rest stays put until something pushes it.
function restingSupported(sim: Sim, x: number, y: number, r: number): boolean {
  const { def } = sim;
  if (y >= PLAYFIELD.floorY - r - 1) return true;
  return def.rects.some((rect) => x >= rect.x0 && x <= rect.x1 && Math.abs(rect.y0 - (y + r)) < 2) ||
    def.humps.some((h) => Math.abs(x - h.cx) < 4) ||
    def.seesaws.some((sw) => Math.abs(x - sw.px) <= sw.half + 4 && y < sw.py + 40 && y > sw.py - 60);
}
