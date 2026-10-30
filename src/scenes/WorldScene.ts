import Phaser from 'phaser';
import { SCREEN } from '../config/constants';
import { CREAM, INK, MID, MUTED, SKY } from '../config/palette';
import { totalSeeds, worlds, type WorldInfo } from '../game/progress';
import { drawSky } from '../render/art';
import { go, iconButton, label, tappable } from '../render/ui';
import { services } from '../services';

// A2 · World select. Each card is a small slice of its world's palette, so players learn the
// biomes before they enter them. Worlds unlock by total seeds.
const BG = 0x140d0e;
const TOP = 96;
const LEFT = 64;
const RIGHT = SCREEN.width - 56;
const GAP = 14;
const CARD_H = 262;
const CARD_W = (RIGHT - LEFT - GAP * 3) / 4;
const RADIUS = 24;

// Draws card art in card-local coordinates, clipped to the card so shapes never spill into a neighbour.
interface Painter {
  circle(cx: number, cy: number, r: number, color: number, alpha?: number): void;
  rect(x: number, y: number, w: number, h: number, color: number): void;
  ring(cx: number, cy: number, r: number, color: number, alpha: number): void;
  glow(cx: number, cy: number, r: number, color: number): void;
}

interface Theme {
  sky: [number, number][];
  footer: number;
  label: number;
  seeds: number;
  art: (p: Painter) => void;
}

const THEMES: Theme[] = [
  {
    sky: [[0, 0xf2c386], [1, 0xdc7a5e]],
    footer: INK,
    label: MUTED,
    seeds: SKY,
    art: (p) => {
      p.glow(130, 60, 30, 0xfbe3b4);
      p.circle(130, 60, 30, 0xfbe3b4);
      p.circle(60, 240, 100, MID);
      p.circle(180, 240, 90, INK);
      p.circle(30, 0, 60, INK);
    },
  },
  {
    sky: [[0, 0xa9ccc6], [1, 0x5e8c8e]],
    footer: 0x0d1617,
    label: 0x9fb5b3,
    seeds: 0xa9ccc6,
    art: (p) => {
      p.rect(20, 60, 26, 200, 0x2f4c50);
      p.rect(60, 90, 40, 200, 0x2f4c50);
      p.rect(120, 40, 22, 200, 0x2f4c50);
      p.circle(115, 235, 85, 0x0d1617);
      p.glow(117, 77, 7, 0xf08a3c);
      p.circle(117, 77, 7, 0xf08a3c);
    },
  },
  {
    sky: [[0, 0x2f6f9a], [1, 0x173b5e]],
    footer: 0x050e18,
    label: 0x8da3b8,
    seeds: 0x8da3b8,
    art: (p) => {
      p.circle(50, 240, 80, 0x050e18);
      p.circle(170, 250, 70, 0x050e18);
      p.ring(65, 55, 5, 0xffffff, 0.5);
      p.ring(87, 83, 3, 0xffffff, 0.5);
    },
  },
  {
    sky: [[0, 0x8e7bc9], [1, 0x3d2f6e]],
    footer: 0x0b0718,
    label: 0xa398c4,
    seeds: 0xa398c4,
    art: (p) => {
      p.circle(80, 150, 40, 0x0b0718);
      p.circle(140, 80, 20, 0x0b0718);
      p.circle(32, 42, 2, 0xf6d36b);
      p.circle(151.5, 141.5, 1.5, 0xf6d36b);
    },
  },
];

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('world');
  }

  create(): void {
    this.cameras.main.fadeIn(220, 27, 15, 16);
    const info = worlds(services.save);
    const art = this.add.graphics();
    info.forEach((w, i) => this.drawCard(art, w, i));

    // Frame: the background drawn over everything outside the rounded cards, which clips their art.
    const frame = this.add.graphics();
    frame.fillStyle(BG, 1);
    frame.fillRect(0, 0, SCREEN.width, TOP).fillRect(0, TOP + CARD_H, SCREEN.width, SCREEN.height - TOP - CARD_H);
    frame.fillRect(0, TOP, LEFT, CARD_H).fillRect(RIGHT, TOP, SCREEN.width - RIGHT, CARD_H);
    info.forEach((_, i) => {
      const x = LEFT + i * (CARD_W + GAP);
      if (i < 3) frame.fillRect(x + CARD_W, TOP, GAP, CARD_H);
      roundCorners(frame, x, TOP, CARD_W, CARD_H, RADIUS, BG);
    });

    // Text and rings on top of the frame.
    const rings = this.add.graphics();
    info.forEach((w, i) => this.cardText(rings, w, i));

    iconButton(this, LEFT + 22, 26 + 22, 'back', { ink: CREAM, outlineAlpha: 0.5, onTap: () => go(this, 'title') });
    label(this, LEFT + 44 + 16, 48, 'Choose a world', { size: 28, weight: 600 }).setOrigin(0, 0.5);
    const seeds = label(this, RIGHT, 48, `${totalSeeds(services.save)} seeds`, { size: 18, weight: 500 }).setOrigin(1, 0.5);
    rings.fillStyle(SKY, 1).fillCircle(seeds.x - seeds.width - 14, 48, 6);
  }

  private drawCard(g: Phaser.GameObjects.Graphics, w: WorldInfo, i: number): void {
    const theme = THEMES[i]!;
    const x = LEFT + i * (CARD_W + GAP);
    const sky = this.add.graphics();
    sky.setPosition(x, TOP);
    drawSky(sky, theme.sky, CARD_W, CARD_H, 30);
    sky.setDepth(-1);
    theme.art(painter(g, x, TOP, CARD_W, CARD_H));
    const footerH = 82;
    g.fillStyle(theme.footer, 1).fillRect(x, TOP + CARD_H - footerH, CARD_W, footerH);
    if (w.locked || !w.playable) g.fillStyle(0x0a080c, 0.55).fillRect(x, TOP, CARD_W, CARD_H - footerH);
  }

  private cardText(g: Phaser.GameObjects.Graphics, w: WorldInfo, i: number): void {
    const theme = THEMES[i]!;
    const x = LEFT + i * (CARD_W + GAP);
    const footerTop = TOP + CARD_H - 82;
    const dim = w.locked || !w.playable;
    label(this, x + 16, footerTop + 14, `WORLD ${w.n}`, { size: 11, mono: true, spacing: 0.12, color: theme.label });
    label(this, x + 16, footerTop + 30, w.name, { size: 22, weight: 600, color: dim ? theme.label : CREAM });
    const line = w.locked ? 'Locked' : w.playable ? `${w.seeds} / ${w.total} seeds` : 'Coming soon';
    label(this, x + 16, footerTop + 58, line, { size: 14, weight: 400, color: theme.seeds });
    if (w.locked) {
      label(this, x + CARD_W / 2, TOP + (CARD_H - 82) / 2, w.lockText, { size: 15, weight: 400, align: 'center' }).setOrigin(0.5);
    }
    if (!dim) {
      g.lineStyle(3, CREAM, 1).strokeRoundedRect(x - 1.5, TOP - 1.5, CARD_W + 3, CARD_H + 3, RADIUS + 1.5);
      const hit = this.add.container(x + CARD_W / 2, TOP + CARD_H / 2);
      tappable(this, hit, CARD_W, CARD_H, () => go(this, 'map', { world: w.n }));
    }
  }
}

// Paint the background into each corner outside a rounded rectangle.
function roundCorners(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, r: number, color: number): void {
  const corner = (cx: number, cy: number, ox: number, oy: number, start: number) => {
    const pts = [new Phaser.Math.Vector2(ox, oy)];
    for (let k = 0; k <= 8; k++) {
      const a = start + (k / 8) * (Math.PI / 2);
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    g.fillStyle(color, 1).fillPoints(pts, true);
  };
  corner(x + r, y + r, x, y, Math.PI);
  corner(x + w - r, y + r, x + w, y, -Math.PI / 2);
  corner(x + w - r, y + h - r, x + w, y + h, 0);
  corner(x + r, y + h - r, x, y + h, Math.PI / 2);
}

type Pt = { x: number; y: number };

function painter(g: Phaser.GameObjects.Graphics, ox: number, oy: number, w: number, h: number): Painter {
  const fill = (pts: Pt[], color: number, alpha: number) => {
    const clipped = clip(pts, w, h);
    if (clipped.length >= 3) g.fillStyle(color, alpha).fillPoints(clipped.map((p) => new Phaser.Math.Vector2(ox + p.x, oy + p.y)), true);
  };
  const disc = (cx: number, cy: number, r: number): Pt[] =>
    Array.from({ length: 48 }, (_, i) => ({ x: cx + Math.cos((i / 48) * Math.PI * 2) * r, y: cy + Math.sin((i / 48) * Math.PI * 2) * r }));
  return {
    circle: (cx, cy, r, color, alpha = 1) => fill(disc(cx, cy, r), color, alpha),
    rect: (x, y, rw, rh, color) => fill([{ x, y }, { x: x + rw, y }, { x: x + rw, y: y + rh }, { x, y: y + rh }], color, 1),
    ring: (cx, cy, r, color, alpha) => g.lineStyle(1.5, color, alpha).strokeCircle(ox + cx, oy + cy, r),
    glow: (cx, cy, r, color) => {
      for (let i = 0; i < 8; i++) fill(disc(cx, cy, r * (2.2 - (i / 7) * 1.1)), color, 0.05);
    },
  };
}

// Sutherland-Hodgman clip of a polygon to the box [0, w] x [0, h].
function clip(pts: Pt[], w: number, h: number): Pt[] {
  const edges: [(p: Pt) => boolean, (a: Pt, b: Pt) => Pt][] = [
    [(p) => p.x >= 0, (a, b) => lerpAt(a, b, (0 - a.x) / (b.x - a.x))],
    [(p) => p.x <= w, (a, b) => lerpAt(a, b, (w - a.x) / (b.x - a.x))],
    [(p) => p.y >= 0, (a, b) => lerpAt(a, b, (0 - a.y) / (b.y - a.y))],
    [(p) => p.y <= h, (a, b) => lerpAt(a, b, (h - a.y) / (b.y - a.y))],
  ];
  let out = pts;
  for (const [inside, cross] of edges) {
    const input = out;
    out = [];
    input.forEach((cur, i) => {
      const prev = input[(i + input.length - 1) % input.length]!;
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur));
        out.push(cur);
      } else if (inside(prev)) {
        out.push(cross(prev, cur));
      }
    });
    if (!out.length) break;
  }
  return out;
}

function lerpAt(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
