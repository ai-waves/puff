// Collision helpers. Every contact's normal points from the shape toward the circle,
// and depth is how far the circle must move along it to separate.
export interface Contact {
  nx: number;
  ny: number;
  depth: number;
  px: number; // contact point on the shape
  py: number;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function circleRect(cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number): Contact | null {
  const px = clamp(cx, x0, x1);
  const py = clamp(cy, y0, y1);
  const dx = cx - px;
  const dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 > 0) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d, px, py };
  }
  // Centre inside: leave through the nearest face.
  const faces = [
    { nx: -1, ny: 0, depth: cx - x0 + r, px: x0, py: cy },
    { nx: 1, ny: 0, depth: x1 - cx + r, px: x1, py: cy },
    { nx: 0, ny: -1, depth: cy - y0 + r, px: cx, py: y0 },
    { nx: 0, ny: 1, depth: y1 - cy + r, px: cx, py: y1 },
  ];
  return faces.reduce((a, b) => (b.depth < a.depth ? b : a));
}

export function circleCircle(cx: number, cy: number, r: number, ox: number, oy: number, or: number): Contact | null {
  const dx = cx - ox;
  const dy = cy - oy;
  const d = Math.hypot(dx, dy);
  if (d >= r + or) return null;
  if (d === 0) return { nx: 0, ny: -1, depth: r + or, px: ox, py: oy - or };
  const nx = dx / d;
  const ny = dy / d;
  return { nx, ny, depth: r + or - d, px: ox + nx * or, py: oy + ny * or };
}

export function closestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
  return { x: ax + vx * t, y: ay + vy * t, t };
}

export function circleCapsule(cx: number, cy: number, r: number, ax: number, ay: number, bx: number, by: number, half: number): Contact | null {
  const q = closestOnSegment(cx, cy, ax, ay, bx, by);
  const c = circleCircle(cx, cy, r, q.x, q.y, half);
  return c;
}

function sideOf(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

// True when a circle overlaps a triangle. Used for briar spikes.
export function circleTriangle(cx: number, cy: number, r: number, ax: number, ay: number, bx: number, by: number, qx: number, qy: number): boolean {
  const s1 = sideOf(cx, cy, ax, ay, bx, by);
  const s2 = sideOf(cx, cy, bx, by, qx, qy);
  const s3 = sideOf(cx, cy, qx, qy, ax, ay);
  const inside = (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
  if (inside) return true;
  const edges: [number, number, number, number][] = [
    [ax, ay, bx, by],
    [bx, by, qx, qy],
    [qx, qy, ax, ay],
  ];
  return edges.some(([x0, y0, x1, y1]) => {
    const p = closestOnSegment(cx, cy, x0, y0, x1, y1);
    return Math.hypot(cx - p.x, cy - p.y) < r;
  });
}

// Signed smallest difference between two angles, in radians.
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
