// Small geometry helpers for the renderer. Box2D handles every collision in play.

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function closestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
  return { x: ax + vx * t, y: ay + vy * t, t };
}

function sideOf(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

// True when a circle overlaps a triangle. The HUD uses it to tell when hanging briar shades it.
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
