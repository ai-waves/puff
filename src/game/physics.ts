import Box2DFactory, { type Box2DModule } from 'box2d3-wasm/compat';
import type { b2BodyId, b2ShapeDef, b2ShapeId, b2WorldId } from 'box2d3-wasm/compat';

// Box2D v3, compiled to WebAssembly (box2d3-wasm). The compat build needs no SIMD, threads or
// cross-origin isolation, so it runs anywhere WKWebView does. Load it once at boot, then use it
// synchronously.

let mod: Box2DModule | null = null;
let loading: Promise<Box2DModule> | null = null;

export function loadBox2D(): Promise<Box2DModule> {
  loading ??= Box2DFactory().then((m) => (mod = m));
  return loading;
}

export function b2(): Box2DModule {
  if (!mod) throw new Error('Box2D is not loaded yet. Await loadBox2D() first.');
  return mod;
}

// The game works in screen points; Box2D in metres. Puff is 30pt across, so 1m = 30pt keeps it
// at 1m, right in the size range Box2D is tuned for.
export const PT = 30;
export const m = (pt: number): number => pt / PT;

// Collision categories. Puffs pass through hazards and only their slightly smaller sensor feels
// them, so a graze is forgiven and a real touch is lost. Puffs never collide with each other.
export const CAT = {
  terrain: 0x01,
  prop: 0x02, // logs, gates, crusher bodies
  pebble: 0x04,
  hazard: 0x08,
  puff: 0x10,
  sensor: 0x20,
} as const;

export const MASK = {
  terrain: 0xffff,
  prop: CAT.terrain | CAT.prop | CAT.pebble | CAT.puff,
  pebble: CAT.terrain | CAT.prop | CAT.pebble | CAT.hazard | CAT.puff,
  hazard: CAT.pebble | CAT.sensor,
  puff: CAT.terrain | CAT.prop | CAT.pebble,
  sensor: CAT.hazard,
} as const;

export type Category = keyof typeof CAT;

export interface ShapeOptions {
  cat: Category;
  density?: number;
  friction?: number;
  restitution?: number;
  rolling?: number;
  sensor?: boolean;
  contactEvents?: boolean;
}

// Build a shape def, hand it to `make`, and free it afterwards.
export function withShapeDef<T>(o: ShapeOptions, make: (def: b2ShapeDef) => T): T {
  const B = b2();
  const def = B.b2DefaultShapeDef();
  def.filter.categoryBits = CAT[o.cat];
  def.filter.maskBits = MASK[o.cat];
  if (o.cat === 'puff' || o.cat === 'sensor') def.filter.groupIndex = -1;
  def.density = o.sensor ? 0 : (o.density ?? 1); // a sensor must not weigh anything
  def.material.friction = o.friction ?? 0.6;
  def.material.restitution = o.restitution ?? 0;
  def.material.rollingResistance = o.rolling ?? 0;
  def.isSensor = o.sensor ?? false;
  // Hazards must be visible to sensors; a sensor must ask for its own events too.
  def.enableSensorEvents = o.cat === 'hazard' || o.sensor === true;
  def.enableContactEvents = o.contactEvents ?? false;
  const out = make(def);
  def.delete();
  return out;
}

export interface Point {
  x: number;
  y: number;
}

// A convex polygon from points in pt, relative to the body origin (also in pt).
export function addPolygon(body: b2BodyId, pts: Point[], o: ShapeOptions, origin: Point = { x: 0, y: 0 }): b2ShapeId {
  const B = b2();
  const hull = B.b2ComputeHull(pts.map((p) => ({ x: m(p.x - origin.x), y: m(p.y - origin.y) })));
  const poly = B.b2MakePolygon(hull, 0);
  const id = withShapeDef(o, (def) => B.b2CreatePolygonShape(body, def, poly));
  poly.delete();
  hull.delete();
  return id;
}

export function addCircle(body: b2BodyId, x: number, y: number, r: number, o: ShapeOptions, origin: Point = { x: 0, y: 0 }): b2ShapeId {
  const B = b2();
  const c = new B.b2Circle();
  c.center.Set(m(x - origin.x), m(y - origin.y));
  c.radius = m(r);
  const id = withShapeDef(o, (def) => B.b2CreateCircleShape(body, def, c));
  c.delete();
  return id;
}

// Axis-aligned box from x0,y0 to x1,y1 (pt), relative to the body origin.
export function addBox(body: b2BodyId, x0: number, y0: number, x1: number, y1: number, o: ShapeOptions, origin: Point = { x: 0, y: 0 }): b2ShapeId {
  return addPolygon(body, [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], o, origin);
}

// A capsule from a to b with radius r (pt): how logs and gates are drawn.
export function addCapsule(body: b2BodyId, a: Point, b: Point, r: number, o: ShapeOptions, origin: Point = { x: 0, y: 0 }): b2ShapeId {
  const B = b2();
  const c = new B.b2Capsule();
  c.center1.Set(m(a.x - origin.x), m(a.y - origin.y));
  c.center2.Set(m(b.x - origin.x), m(b.y - origin.y));
  c.radius = m(r);
  const id = withShapeDef(o, (def) => B.b2CreateCapsuleShape(body, def, c));
  c.delete();
  return id;
}

// A rectangle with rounded corners, exactly as drawn: a polygon with the corners cut off at 45°,
// plus each rounded corner filled in. Their union is the rounded rect, so nothing invisible sticks
// out of a curve. A corner is a circle when the whole circle fits inside the rect, otherwise a
// quarter-disc polygon.
export function addRoundedRect(
  body: b2BodyId,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  corners: { tl: number; tr: number; br: number; bl: number },
  o: ShapeOptions,
): b2ShapeId[] {
  const { tl, tr, br, bl } = corners;
  const pts: Point[] = [];
  const cut = (r: number, cx: number, cy: number, a: Point, b: Point) => {
    if (r > 0) pts.push(a, b);
    else pts.push({ x: cx, y: cy });
  };
  cut(tl, x0, y0, { x: x0, y: y0 + tl }, { x: x0 + tl, y: y0 });
  cut(tr, x1, y0, { x: x1 - tr, y: y0 }, { x: x1, y: y0 + tr });
  cut(br, x1, y1, { x: x1, y: y1 - br }, { x: x1 - br, y: y1 });
  cut(bl, x0, y1, { x: x0 + bl, y: y1 }, { x: x0, y: y1 - bl });
  const ids = [addPolygon(body, pts, o)];
  const fits = (r: number) => 2 * r <= x1 - x0 && 2 * r <= y1 - y0;
  // Corner centre and the angle its quarter arc starts at (screen angles, y down).
  const corner = (r: number, cx: number, cy: number, start: number) => {
    if (r <= 0) return;
    if (fits(r)) {
      ids.push(addCircle(body, cx, cy, r, o));
      return;
    }
    const arc: Point[] = [{ x: cx, y: cy }];
    for (let k = 0; k <= 6; k++) {
      const a = start + (k / 6) * (Math.PI / 2);
      arc.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    ids.push(addPolygon(body, arc, o));
  };
  corner(tl, x0 + tl, y0 + tl, Math.PI);
  corner(tr, x1 - tr, y0 + tr, -Math.PI / 2);
  corner(br, x1 - br, y1 - br, 0);
  corner(bl, x0 + bl, y1 - bl, Math.PI / 2);
  return ids;
}

export function createBody(world: b2WorldId, type: 'static' | 'kinematic' | 'dynamic', x: number, y: number, angle = 0, fixedRotation = false): b2BodyId {
  const B = b2();
  const def = B.b2DefaultBodyDef();
  def.type =
    type === 'static' ? B.b2BodyType.b2_staticBody : type === 'kinematic' ? B.b2BodyType.b2_kinematicBody : B.b2BodyType.b2_dynamicBody;
  def.position.Set(m(x), m(y));
  if (angle !== 0) {
    const rot = B.b2MakeRot(angle);
    def.rotation = rot;
    rot.delete();
  }
  def.motionLocks.angularZ = fixedRotation;
  const id = B.b2CreateBody(world, def);
  def.delete();
  return id;
}

export function sameShape(a: b2ShapeId, b: b2ShapeId): boolean {
  return a.index1 === b.index1 && a.generation === b.generation;
}
