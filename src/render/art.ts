import Phaser from 'phaser';
import { BLUSH, BURROW_GLOW, CREAM, GLOW, ICE, INK, MID, MINT, PALE, PEACH, SKY, SPROUT, STEM } from '../config/palette';

type G = Phaser.GameObjects.Graphics;

// ---------- Puff ----------
// Geometry from the board's 60pt figure: body radius 30, a fuzzy rim of 8 tufts (radius 14,
// 24 from the centre), one big eye, a blush, and the sprout. scale 1 is that 60pt figure.

export type PuffState = 'drift' | 'puff' | 'bonk' | 'sleep' | 'lost';

export interface PuffLook {
  scale: number;
  state: PuffState;
  sprout?: boolean; // only the leader has one
  blush?: boolean;
  glow?: boolean;
  look?: { x: number; y: number }; // unit vector the eye looks toward (the next hazard)
  leaf?: number; // leaf angle in degrees: -25 normal, -45 perked up in light, 35 drooping
  tilt?: number; // radians
  alpha?: number;
}

const TUFT_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 - Math.PI / 2);

export function drawPuff(g: G, x: number, y: number, p: PuffLook): void {
  const stretch = p.state === 'puff' ? [1.1, 1.35] : p.state === 'bonk' ? [1.45, 0.85] : [1, 1];
  const sx = stretch[0]! * p.scale;
  const sy = stretch[1]! * p.scale;
  const tilt = (p.tilt ?? 0) + (p.state === 'lost' ? (25 * Math.PI) / 180 : 0);
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const at = (lx: number, ly: number) => ({ x: x + (lx * sx * cos - ly * sy * sin), y: y + (lx * sx * sin + ly * sy * cos) });
  const k = (sx + sy) / 2;
  const alpha = (p.alpha ?? 1) * (p.state === 'lost' ? 0.8 : 1);

  if (p.glow && p.state !== 'lost') {
    for (const [r, a] of [[52, 0.08], [44, 0.14], [38, 0.22]] as const) g.fillStyle(0xffecbe, a * alpha).fillCircle(x, y, r * k);
  }

  // Sprout behind the body, so the stem rises out of the fuzz.
  if (p.sprout) {
    const droop = p.state === 'bonk' || p.state === 'lost';
    const top = droop ? -42 : -46;
    const a = at(0, -31);
    const b = at(0, top);
    g.lineStyle(Math.max(1.5, 2 * k), STEM, alpha).lineBetween(a.x, a.y, b.x, b.y);
    const leafAngle = ((droop ? 40 : (p.leaf ?? -25)) * Math.PI) / 180 + tilt;
    const leaf = at(droop ? -6 : 8, top - 1.5);
    fillRotatedEllipse(g, leaf.x, leaf.y, 7 * k, 3.5 * k, leafAngle, SPROUT, alpha);
  }

  // Tufts. A lost Puff has only three left, scattering.
  g.fillStyle(CREAM, alpha);
  const tufts = p.state === 'lost' ? [TUFT_ANGLES[1]!, TUFT_ANGLES[4]!, TUFT_ANGLES[6]!] : TUFT_ANGLES;
  for (const ang of tufts) {
    const c = at(Math.cos(ang) * 24, Math.sin(ang) * 24);
    g.fillCircle(c.x, c.y, 14 * k);
  }
  g.fillEllipse(x, y, 60 * sx, 60 * sy);

  // The eye looks toward the next hazard, which doubles as a gameplay tell.
  const lx = (p.look?.x ?? 1) * 3;
  const ly = (p.look?.y ?? 0) * 3;
  if (p.state === 'sleep') {
    const c = at(2, -2);
    g.fillStyle(INK, alpha).beginPath();
    g.arc(c.x, c.y, 12 * k, 0, Math.PI, false);
    g.closePath();
    g.fillPath();
  } else if (p.state === 'bonk') {
    const c = at(0, 0);
    g.fillStyle(INK, alpha).fillRoundedRect(c.x - 12 * sx, c.y - 2.5 * sy, 24 * sx, 5 * sy, 2.5 * k);
  } else if (p.state === 'lost') {
    const c = at(2, 2);
    g.lineStyle(4 * k, INK, alpha);
    g.lineBetween(c.x - 6 * k, c.y - 6 * k, c.x + 6 * k, c.y + 6 * k);
    g.lineBetween(c.x - 6 * k, c.y + 6 * k, c.x + 6 * k, c.y - 6 * k);
  } else {
    const lift = p.state === 'puff' ? -4 : 0;
    const e = at(2 + lx, -2 + ly + lift);
    g.fillStyle(INK, alpha).fillCircle(e.x, e.y, 12 * k);
    const h = at(4.5 + lx, -6.5 + ly + lift);
    g.fillStyle(0xffffff, alpha).fillCircle(h.x, h.y, 3.5 * k);
  }

  if (p.blush && p.state !== 'lost' && p.state !== 'sleep') {
    const b = at(16.5, 11);
    g.fillStyle(BLUSH, alpha).fillEllipse(b.x, b.y, 9 * k, 6 * k);
  }
}

export function fillRotatedEllipse(g: G, cx: number, cy: number, rx: number, ry: number, angle: number, color: number, alpha = 1): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 14; i++) {
    const t = (i / 14) * Math.PI * 2;
    const ex = Math.cos(t) * rx;
    const ey = Math.sin(t) * ry;
    pts.push(new Phaser.Math.Vector2(cx + ex * Math.cos(angle) - ey * Math.sin(angle), cy + ex * Math.sin(angle) + ey * Math.cos(angle)));
  }
  g.fillStyle(color, alpha).fillPoints(pts, true);
}

// ---------- Sky and light ----------

export function drawSky(g: G, stops: [number, number][], w: number, h: number, strips = 40): void {
  const stripH = h / strips;
  for (let i = 0; i < strips; i++) g.fillStyle(gradientAt(stops, i / (strips - 1)), 1).fillRect(0, i * stripH, w, stripH + 1);
}

export function gradientAt(stops: [number, number][], t: number): number {
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i]!;
    const [t0, c0] = stops[i - 1]!;
    if (t <= t1) return mix(c0, c1, (t - t0) / Math.max(1e-6, t1 - t0));
  }
  return stops[stops.length - 1]![1];
}

export function mix(a: number, b: number, k: number): number {
  const ch = (s: number) => {
    const from = (a >> s) & 0xff;
    const to = (b >> s) & 0xff;
    return Math.round(from + (to - from) * Math.min(1, Math.max(0, k))) << s;
  };
  return ch(16) | ch(8) | ch(0);
}

// A soft glow: stacked translucent discs, like the board's box-shadow glows.
const GLOW_LAYERS = 12;

export function glow(g: G, x: number, y: number, r: number, color = GLOW, strength = 1): void {
  for (let i = 0; i < GLOW_LAYERS; i++) {
    const m = 2.2 - (i / (GLOW_LAYERS - 1)) * 1.1;
    g.fillStyle(color, 0.03 * strength).fillCircle(x, y, r * m);
  }
}

export function drawSun(g: G, x: number, y: number, r: number): void {
  glow(g, x, y, r, GLOW, 1.4);
  g.fillStyle(GLOW, 1).fillCircle(x, y, r);
}

// ---------- World objects ----------

export function drawSeed(g: G, x: number, y: number, a = 1): void {
  glow(g, x, y, 10, 0xffecbe, a);
  g.fillStyle(SKY, a).fillCircle(x, y, 7);
  g.lineStyle(3, INK, a).strokeCircle(x, y, 7);
}

// Split bubble: a mint-glowing ring with two Puffs inside.
export function drawBubble(g: G, x: number, y: number, r = 20, a = 1): void {
  glow(g, x, y, r, MINT, a);
  g.fillStyle(MINT, 0.3 * a).fillCircle(x, y, r);
  g.lineStyle(2.5, PALE, a).strokeCircle(x, y, r);
  g.fillStyle(CREAM, a).fillCircle(x - r * 0.3, y, r * 0.27).fillCircle(x + r * 0.3, y, r * 0.27);
}

// Swell and Shrink orbs, from the power-up board: a glowing ring around a big or a tiny Puff.
export function drawOrb(g: G, x: number, y: number, kind: 'swell' | 'shrink', r = 20, a = 1): void {
  const tint = kind === 'swell' ? PEACH : ICE;
  glow(g, x, y, r, tint, a);
  g.fillStyle(tint, 0.35 * a).fillCircle(x, y, r);
  g.lineStyle(2.5, PALE, a).strokeCircle(x, y, r);
  g.fillStyle(CREAM, a).fillCircle(x, y, r * (kind === 'swell' ? 0.46 : 0.18));
}

// Rootcrusher: a column of knotted roots from the roof, with a row of root teeth underneath.
// While it's about to drop, dust trickles from its underside.
export function drawCrusher(g: G, x: number, width: number, bottom: number, roof: number, warn: boolean, t: number): void {
  const x0 = x - width / 2;
  g.fillStyle(INK, 1).fillRect(x0, roof - 2, width, bottom - 8 - roof + 2);
  // Root grain, a shade lighter, so the column reads as roots rather than a wall.
  g.lineStyle(1.5, MID, 0.55);
  for (const k of [0.22, 0.5, 0.78]) {
    const rx = x0 + width * k;
    g.lineBetween(rx + Math.sin(k * 9) * 3, roof, rx - Math.sin(k * 7) * 3, bottom - 14);
  }
  for (let tx = x0; tx < x0 + width - 0.5; tx += 10) {
    const w = Math.min(10, x0 + width - tx);
    g.fillStyle(INK, 1).fillTriangle(tx, bottom - 9, tx + w, bottom - 9, tx + w / 2, bottom);
  }
  if (warn) {
    for (let k = 0; k < 7; k++) {
      const dx = x0 + 8 + ((k * 37) % Math.max(1, width - 16));
      const fall = ((t * 70 + k * 23) % 40) + 4;
      g.fillStyle(INK, 1 - fall / 48).fillRect(dx, bottom + fall, 3, 5);
    }
  }
}

// A boulder: a black octagon.
export function drawBoulder(g: G, pts: { x: number; y: number }[], dx: number): void {
  g.fillStyle(INK, 1).fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x - dx, p.y)), true);
}

// Thornwheel: a black disc ringed with thorns. One may be missing, for a seed to ride in.
export function drawWheel(g: G, cx: number, cy: number, r: number, angle: number, missingTooth = false): void {
  const tooth = r * 0.11;
  const ring = r - tooth;
  g.fillStyle(INK, 1).fillCircle(cx, cy, r * 0.75);
  for (let k = 0; k < 16; k++) {
    if (missingTooth && k === 0) continue;
    const a = angle + (k / 16) * Math.PI * 2;
    g.fillCircle(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring, tooth);
  }
  g.fillStyle(MID, 1).fillCircle(cx, cy, Math.max(2, r * 0.06));
}

export function drawBloom(g: G, x: number, floorY: number, open: boolean, t: number): void {
  const headY = floorY - 64;
  g.fillStyle(INK, 1).fillRect(x - 1.5, headY, 3, floorY - headY);
  if (open) {
    glow(g, x, headY, 11, GLOW, 1 + 0.15 * Math.sin(t * 3));
    g.fillStyle(GLOW, 1).fillCircle(x, headY, 11);
  } else {
    g.fillStyle(INK, 1).fillEllipse(x, headY + 2, 12, 16);
  }
}

export function drawBurrow(g: G, x: number, floorY: number, brightness = 1): void {
  glow(g, x, floorY - 30, 40, 0xffecbe, brightness);
  g.fillStyle(INK, 1).fillRoundedRect(x - 60, floorY - 80, 120, 80, { tl: 60, tr: 60, bl: 0, br: 0 });
  g.fillStyle(BURROW_GLOW, 1).fillRoundedRect(x - 26, floorY - 56, 52, 56, { tl: 26, tr: 26, bl: 0, br: 0 });
}

export function drawSpikes(g: G, spikes: { ax: number; ay: number; bx: number; by: number; qx: number; qy: number }[], dx: number): void {
  g.fillStyle(INK, 1);
  for (const s of spikes) g.fillTriangle(s.ax - dx, s.ay, s.bx - dx, s.by, s.qx - dx, s.qy);
}
