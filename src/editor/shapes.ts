import { PLAYFIELD, PUFF_RADIUS } from '../config/constants';
import type { Collection } from '../game/levels/schema';
import { briarTriangles, crusherBottom, curtainBottom, gateBottom, seedPosition, seesawEnds, type SimView } from '../game/sim';
import type { BriarDef, CrusherDef, CurtainDef, GateDef, HumpDef, LevelDef, PebbleDef, RectDef, RootDef, SeedDef, SeesawDef, WheelDef } from '../game/types';
import type { Item } from './model';

// Where each kind of object is on screen, what grabs it, and how dragging it or one of its
// handles changes its numbers. Everything here is in world points.

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
const GATE_WIDTH = 14;
const MIN = 4; // the smallest a size can be dragged to

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Handle {
  key: string;
  x: number;
  y: number;
  cursor: string;
}

// Hit-testing order: small things over big ones, so a seed on a block picks the seed.
export const PICK_ORDER: Collection[] = [
  'seeds', 'bubbles', 'orbs', 'pebbles', 'labels', 'blooms', 'roots', 'gates', 'wheels', 'crushers', 'seesaws', 'curtains', 'briars', 'rects', 'humps',
];

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) });
const around = (x: number, y: number, r: number): Box => ({ x0: x - r, y0: y - r, x1: x + r, y1: y + r });
const briarWidth = (b: BriarDef) => (b.width ?? 20) * b.spikes.length;

export function bounds(c: Collection, item: Item, pose: SimView, i: number): Box {
  switch (c) {
    case 'rects': {
      const r = item as unknown as RectDef;
      return box(r.x0, r.y0, r.x1, r.y1);
    }
    case 'humps': {
      const h = item as unknown as HumpDef;
      return box(h.cx - h.width / 2, FLOOR - h.height, h.cx + h.width / 2, FLOOR);
    }
    case 'briars': {
      const b = item as unknown as BriarDef;
      const tall = Math.max(0, ...b.spikes);
      return box(b.x0, b.base, b.x0 + briarWidth(b), b.base + (b.side === 'up' ? -tall : tall));
    }
    case 'seesaws': {
      const sw = item as unknown as SeesawDef;
      const e = seesawEnds(sw, pose.s.seesaws[i]?.angle ?? 0);
      const pad = sw.heavy ? 12 : 8;
      return box(Math.min(e.ax, e.bx) - pad, Math.min(e.ay, e.by, sw.py) - pad, Math.max(e.ax, e.bx) + pad, Math.max(e.ay, e.by) + pad);
    }
    case 'gates': {
      const g = item as unknown as GateDef;
      return box(g.x, ROOF, g.x + GATE_WIDTH, pose.s.gates[i] ? gateBottom(pose, i) : FLOOR);
    }
    case 'curtains': {
      const cu = item as unknown as CurtainDef;
      return box(cu.x0, ROOF, cu.x1, pose.s.curtains[i] ? curtainBottom(pose, i) : cu.closedBottom);
    }
    case 'wheels': {
      const w = item as unknown as WheelDef;
      return around(w.cx, w.cy, w.r);
    }
    case 'pebbles': {
      const p = item as unknown as PebbleDef;
      return around(p.x, p.y, p.r);
    }
    case 'crushers': {
      const cr = item as unknown as CrusherDef;
      return box(cr.x - cr.width / 2, ROOF, cr.x + cr.width / 2, pose.s.crushers[i] ? crusherBottom(pose, i) : cr.rest);
    }
    case 'seeds': {
      const p = pose.def.seeds[i] ? seedPosition(pose, i) : (item as unknown as SeedDef);
      return around(p.x, p.y, 11);
    }
    case 'bubbles':
      return around(item.x as number, item.y as number, 21);
    case 'orbs':
      return around(item.x as number, item.y as number, 21);
    case 'blooms':
      return box((item.x as number) - 13, FLOOR - 76, (item.x as number) + 13, FLOOR);
    case 'labels':
      return box(item.x as number, (item.y as number) - 12, (item.x as number) + Math.max(20, String(item.text).length * 9.5), (item.y as number) + 12);
    case 'roots': {
      const r = item as unknown as RootDef;
      return box(r.x - 5, r.y0, r.x + 5, r.y0 + r.len);
    }
  }
}

export function hits(c: Collection, item: Item, pose: SimView, i: number, x: number, y: number, pad = 3): boolean {
  if (c === 'seesaws') {
    // The plank, or the fulcrum under it.
    const sw = item as unknown as SeesawDef;
    const e = seesawEnds(sw, pose.s.seesaws[i]?.angle ?? 0);
    const reach = (sw.heavy ? 10 : 6) + pad;
    if (segmentDistance(x, y, e.ax, e.ay, e.bx, e.by) <= reach) return true;
    return x >= sw.px - 18 - pad && x <= sw.px + 18 + pad && y >= sw.py && y <= (sw.baseY ?? FLOOR);
  }
  if (c === 'wheels' || c === 'pebbles') {
    const b = bounds(c, item, pose, i);
    return Math.hypot(x - (b.x0 + b.x1) / 2, y - (b.y0 + b.y1) / 2) <= (b.x1 - b.x0) / 2 + pad;
  }
  if (c === 'humps') {
    const h = item as unknown as HumpDef;
    // Inside the mound's arc, not its bounding box.
    const r = (h.width * h.width) / 4 / (2 * h.height) + h.height / 2;
    return Math.hypot(x - h.cx, y - (FLOOR - h.height + r)) <= r + pad && y >= FLOOR - h.height - pad;
  }
  const b = bounds(c, item, pose, i);
  return x >= b.x0 - pad && x <= b.x1 + pad && y >= b.y0 - pad && y <= b.y1 + pad;
}

export function handles(c: Collection, item: Item, pose: SimView, i: number): Handle[] {
  const h = (key: string, x: number, y: number, cursor: string): Handle => ({ key, x, y, cursor });
  switch (c) {
    case 'rects': {
      const r = item as unknown as RectDef;
      const mx = (r.x0 + r.x1) / 2;
      const my = (r.y0 + r.y1) / 2;
      return [
        h('x0 y0', r.x0, r.y0, 'nwse-resize'), h('x1 y0', r.x1, r.y0, 'nesw-resize'), h('x0 y1', r.x0, r.y1, 'nesw-resize'), h('x1 y1', r.x1, r.y1, 'nwse-resize'),
        h('x0', r.x0, my, 'ew-resize'), h('x1', r.x1, my, 'ew-resize'), h('y0', mx, r.y0, 'ns-resize'), h('y1', mx, r.y1, 'ns-resize'),
      ];
    }
    case 'humps': {
      const m = item as unknown as HumpDef;
      return [h('left', m.cx - m.width / 2, FLOOR - 6, 'ew-resize'), h('right', m.cx + m.width / 2, FLOOR - 6, 'ew-resize'), h('height', m.cx, FLOOR - m.height, 'ns-resize')];
    }
    case 'briars': {
      const b = item as unknown as BriarDef;
      const tips = briarTriangles(b).map((t, k) => h(`tip ${k}`, t.qx, t.qy, 'ns-resize'));
      return [...tips, h('count', b.x0 + briarWidth(b), b.base, 'ew-resize')];
    }
    case 'seesaws': {
      const sw = item as unknown as SeesawDef;
      const e = seesawEnds(sw, pose.s.seesaws[i]?.angle ?? 0);
      return [h('end', e.ax, e.ay, 'ew-resize'), h('end', e.bx, e.by, 'ew-resize')];
    }
    case 'gates': {
      const g = item as unknown as GateDef;
      return [h('openBottom', g.x + GATE_WIDTH / 2, g.openBottom, 'ns-resize')];
    }
    case 'curtains': {
      const cu = item as unknown as CurtainDef;
      const mx = (cu.x0 + cu.x1) / 2;
      const my = (ROOF + cu.closedBottom) / 2;
      return [h('x0', cu.x0, my, 'ew-resize'), h('x1', cu.x1, my, 'ew-resize'), h('closedBottom', mx, cu.closedBottom, 'ns-resize'), h('openBottom', mx, cu.openBottom, 'ns-resize')];
    }
    case 'wheels': {
      const w = item as unknown as WheelDef;
      const out = [h('r', w.cx + w.r, w.cy, 'ew-resize')];
      if (w.hang !== undefined) out.push(h('hang', w.cx, w.hang, 'ns-resize'));
      return out;
    }
    case 'pebbles': {
      const p = item as unknown as PebbleDef;
      return [h('r', p.x + p.r, p.y, 'ew-resize')];
    }
    case 'crushers': {
      const cr = item as unknown as CrusherDef;
      const my = (ROOF + cr.rest) / 2;
      return [h('width', cr.x - cr.width / 2, my, 'ew-resize'), h('width', cr.x + cr.width / 2, my, 'ew-resize'), h('rest', cr.x, cr.rest, 'ns-resize')];
    }
    case 'roots': {
      const r = item as unknown as RootDef;
      return [h('len', r.x, r.y0 + r.len, 'ns-resize')];
    }
    default:
      return [];
  }
}

// Drag the whole object by (dx, dy) from where it was (orig) when the drag began.
export function move(c: Collection, item: Item, orig: Item, dx: number, dy: number, pose: SimView, i: number): void {
  const add = (...keys: string[]) => (d: number) => {
    for (const k of keys) if (typeof orig[k] === 'number') item[k] = (orig[k] as number) + d;
  };
  switch (c) {
    case 'rects':
      add('x0', 'x1')(dx);
      add('y0', 'y1')(dy);
      return;
    case 'humps':
      add('cx')(dx);
      return;
    case 'briars':
      add('x0')(dx);
      add('base')(dy);
      return;
    case 'seesaws':
      add('px')(dx);
      add('py', 'baseY')(dy);
      return;
    case 'gates':
    case 'crushers':
    case 'blooms':
      add('x')(dx);
      return;
    case 'curtains':
      add('x0', 'x1')(dx);
      return;
    case 'wheels':
      add('cx')(dx);
      add('cy', 'hang')(dy);
      return;
    case 'roots':
      add('x')(dx);
      add('y0')(dy);
      return;
    case 'seeds': {
      const s = orig as unknown as SeedDef;
      if (s.ride || s.orbit) {
        const at = seedPosition({ def: { ...pose.def, seeds: pose.def.seeds.map((x, k) => (k === i ? s : x)) }, s: pose.s }, i);
        attachSeed(item as unknown as SeedDef, pose, at.x + dx, at.y + dy);
        return;
      }
      add('x')(dx);
      add('y')(dy);
      return;
    }
    default:
      add('x')(dx);
      add('y')(dy);
  }
}

// A seed riding a log or a wheel moves along with it: dragging one changes where on the log it
// sits, or how far out on the wheel.
function attachSeed(seed: SeedDef, pose: SimView, x: number, y: number): void {
  if (seed.ride) {
    const si = pose.def.seesaws.findIndex((sw) => sw.id === seed.ride!.log);
    const sw = pose.def.seesaws[si];
    if (!sw) return;
    const a = pose.s.seesaws[si]!.angle;
    const dx = x - sw.px;
    const dy = y - sw.py;
    const along = Math.cos(a) * dx - Math.sin(a) * dy;
    seed.ride = { log: seed.ride.log, at: round3(clamp(along / sw.half, -1, 1)), lift: Math.round(-Math.sin(a) * dx - Math.cos(a) * dy) };
  } else if (seed.orbit) {
    const w = pose.def.wheels.find((wh) => wh.id === seed.orbit!.wheel);
    if (w) seed.orbit = { wheel: seed.orbit.wheel, radius: Math.max(0, Math.round(Math.hypot(x - w.cx, y - w.cy))) };
  }
}

// Drag one handle to (x, y).
export function dragHandle(c: Collection, item: Item, orig: Item, key: string, x: number, y: number): void {
  switch (c) {
    case 'rects': {
      const o = orig as unknown as RectDef;
      for (const k of key.split(' ')) {
        if (k === 'x0') item.x0 = Math.min(x, o.x1 - MIN);
        if (k === 'x1') item.x1 = Math.max(x, o.x0 + MIN);
        if (k === 'y0') item.y0 = Math.min(y, o.y1 - MIN);
        if (k === 'y1') item.y1 = Math.max(y, o.y0 + MIN);
      }
      return;
    }
    case 'humps': {
      const o = orig as unknown as HumpDef;
      if (key === 'height') item.height = clamp(FLOOR - y, 5, FLOOR - ROOF - 20);
      else item.width = Math.max(20, 2 * Math.abs(x - o.cx));
      return;
    }
    case 'briars': {
      const o = orig as unknown as BriarDef;
      const w = o.width ?? 20;
      if (key === 'count') {
        const n = Math.max(1, Math.round((x - o.x0) / w));
        item.spikes = Array.from({ length: n }, (_, k) => o.spikes[k] ?? o.spikes[k % o.spikes.length]!);
      } else {
        const k = Number(key.split(' ')[1]);
        const spikes = [...(item.spikes as number[])];
        spikes[k] = Math.max(2, o.side === 'up' ? o.base - y : y - o.base);
        item.spikes = spikes;
      }
      return;
    }
    case 'seesaws': {
      const o = orig as unknown as SeesawDef;
      item.half = Math.max(20, Math.round(Math.hypot(x - o.px, y - o.py)));
      return;
    }
    case 'gates':
      item.openBottom = clamp(y, ROOF + 4, FLOOR - 20);
      return;
    case 'curtains': {
      const o = orig as unknown as CurtainDef;
      if (key === 'x0') item.x0 = Math.min(x, o.x1 - MIN * 3);
      if (key === 'x1') item.x1 = Math.max(x, o.x0 + MIN * 3);
      if (key === 'closedBottom') item.closedBottom = clamp(y, ROOF + 20, FLOOR);
      if (key === 'openBottom') item.openBottom = clamp(y, ROOF, FLOOR - 20);
      return;
    }
    case 'wheels': {
      const o = orig as unknown as WheelDef;
      if (key === 'hang') item.hang = Math.min(y, o.cy);
      else item.r = Math.max(10, Math.round(Math.abs(x - o.cx)));
      return;
    }
    case 'pebbles': {
      const o = orig as unknown as PebbleDef;
      item.r = Math.max(6, Math.round(Math.abs(x - o.x)));
      return;
    }
    case 'crushers': {
      const o = orig as unknown as CrusherDef;
      if (key === 'rest') item.rest = clamp(y, ROOF + 20, FLOOR - 10);
      else item.width = Math.max(20, 2 * Math.abs(x - o.x));
      return;
    }
    case 'roots': {
      const o = orig as unknown as RootDef;
      item.len = Math.max(2, y - o.y0);
      return;
    }
  }
}

// The level's own markers: where Puff starts, the burrow, and the end of the level.
export function markers(def: LevelDef): Handle[] {
  return [
    { key: 'start', x: def.startX, y: def.startY, cursor: 'move' },
    { key: 'burrow', x: def.burrowX, y: FLOOR - 40, cursor: 'ew-resize' },
    { key: 'length', x: def.length, y: (ROOF + FLOOR) / 2, cursor: 'ew-resize' },
  ];
}

export function markerHit(m: Handle, x: number, y: number): boolean {
  if (m.key === 'start') return Math.hypot(x - m.x, y - m.y) <= PUFF_RADIUS + 4;
  if (m.key === 'burrow') return Math.abs(x - m.x) <= 60 && y >= FLOOR - 80 && y <= FLOOR;
  return Math.abs(x - m.x) <= 6;
}

export function dragMarker(def: LevelDef, key: string, orig: LevelDef, dx: number, dy: number): void {
  if (key === 'start') {
    def.startX = orig.startX + dx;
    def.startY = clamp(orig.startY + dy, ROOF + PUFF_RADIUS, FLOOR - PUFF_RADIUS);
  }
  if (key === 'burrow') def.burrowX = orig.burrowX + dx;
  if (key === 'length') def.length = Math.max(844, orig.length + dx);
}

export function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const k = dx === 0 && dy === 0 ? 0 : clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(x - (ax + k * dx), y - (ay + k * dy));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
