import Phaser from 'phaser';
import { PLAYFIELD, PUFF_RADIUS, PUFF_SCREEN_X, SCREEN } from '../config/constants';
import { DEEP, FAR, INK, MID } from '../config/palette';
import {
  boulderPoints,
  briarTriangles,
  crusherBottom,
  curtainBottom,
  gateBottom,
  humpCircle,
  seedPosition,
  seesawEnds,
  type SimView,
} from '../game/sim';
import type { LevelDef, RectDef } from '../game/types';
import { drawBloom, drawBoulder, drawBubble, drawBurrow, drawCrusher, drawOrb, drawSeed, drawSky, drawSpikes, drawSun, drawWheel, glow } from './art';
import { label } from './ui';

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
const EDGE_SHADE = 46; // pt of shadow along the left edge, where the scroll leaves Puffs behind

// Layer depths. Play draws Puffs and effects between the world and the foreground.
export const DEPTH = { sky: 0, far: 1, world: 2, labels: 3, puffs: 4, fx: 5, fore: 6, overlay: 7, hud: 10 } as const;

// Draws a level as it stands in a sim: the sky, the parallax hills, the play layer and the
// foreground. The game and the level editor both draw through it, so they always look the same.
export class LevelView {
  private sky: Phaser.GameObjects.Graphics;
  private far: Phaser.GameObjects.Graphics;
  private world: Phaser.GameObjects.Graphics;
  private fore: Phaser.GameObjects.Graphics;
  private labels: { text: Phaser.GameObjects.Text; x: number }[] = [];
  private def!: LevelDef;
  private look = ''; // the sky, sun and labels last drawn

  constructor(private scene: Phaser.Scene, def: LevelDef) {
    this.sky = scene.add.graphics().setDepth(DEPTH.sky);
    this.far = scene.add.graphics().setDepth(DEPTH.far);
    this.world = scene.add.graphics().setDepth(DEPTH.world);
    this.fore = scene.add.graphics().setDepth(DEPTH.fore);
    this.setLevel(def);
  }

  // Use a new or edited level. The sky and the printed labels are only redrawn when they change, so
  // the level editor can call this every frame.
  setLevel(def: LevelDef): void {
    this.def = def;
    const look = JSON.stringify([def.sky, def.sunX, def.sunY, def.labels]);
    if (look === this.look) return;
    this.look = look;
    // L0 sky and sun never move.
    this.sky.clear();
    drawSky(this.sky, def.sky, SCREEN.width, SCREEN.height);
    drawSun(this.sky, def.sunX, def.sunY, 62);
    for (const l of this.labels) l.text.destroy();
    this.labels = (def.labels ?? []).map((l) => ({ text: label(this.scene, 0, l.y, l.text, { size: 18, weight: 500 }).setOrigin(0, 0.5).setDepth(DEPTH.labels), x: l.x }));
  }

  draw(sim: SimView, cam: number, t: number, opts: { edgeShade?: boolean } = {}): void {
    this.drawBackground(cam, t);
    this.drawWorld(sim, cam, t);
    this.drawForeground(cam, opts.edgeShade ?? false);
  }

  private drawBackground(cam: number, t: number): void {
    const g = this.far.clear();
    // L1 far hills at 0.2x and L2 mid hills at 0.5x parallax.
    const layer = (factor: number, spacing: number, hills: [number, number, number][], color: number) => {
      const shift = cam * factor;
      const first = Math.floor((shift - 400) / spacing);
      g.fillStyle(color, 1);
      for (let k = first; k < first + Math.ceil((SCREEN.width + 800) / spacing) + 1; k++) {
        const [dx, top, r] = hills[((k % hills.length) + hills.length) % hills.length]!;
        g.fillCircle(k * spacing + dx - shift, top + r, r);
      }
    };
    layer(0.2, 540, [[0, 240, 240], [180, 262, 260], [360, 232, 250]], FAR);
    layer(0.5, 680, [[0, 300, 160], [340, 290, 190]], MID);
    // Ambient moths, drawn dull in the mid-layer colour. Only things that help you glow.
    const shift = cam * 0.5;
    g.fillStyle(MID, 1);
    for (let k = Math.floor((shift - 100) / 430); k < Math.floor((shift + SCREEN.width + 100) / 430) + 1; k++) {
      const x = k * 430 + 120 - shift + Math.sin(t * 1.3 + k) * 14;
      const y = 120 + (((k * 53) % 120) + 120) % 120 + Math.sin(t * 3.1 + k * 2) * 8;
      g.fillEllipse(x - 3, y, 5, 3 + Math.abs(Math.sin(t * 18 + k)) * 3).fillEllipse(x + 3, y, 5, 3 + Math.abs(Math.sin(t * 18 + k)) * 3);
    }
  }

  private drawWorld(sim: SimView, cam: number, t: number): void {
    const g = this.world.clear();
    const def = this.def;
    const s = sim.s;
    const lo = cam - 220;
    const hi = cam + SCREEN.width + 220;
    const on = (x0: number, x1: number) => x1 > lo && x0 < hi;

    // Burrow glow shows from three screens away.
    const bx = def.burrowX - cam;
    if (def.burrowX - cam < SCREEN.width * 3 + PUFF_SCREEN_X) glow(this.world, bx, FLOOR - 40, 70, 0xffecbe, 1);

    g.fillStyle(INK, 1);
    for (const h of def.humps) {
      if (!on(h.cx - h.width / 2, h.cx + h.width / 2)) continue;
      const c = humpCircle(h.width, h.height);
      g.fillCircle(h.cx - cam, c.cy, c.r);
    }
    for (const r of def.rects) if (on(r.x0, r.x1)) drawRect(g, r, cam);

    for (const root of def.roots ?? []) {
      if (!on(root.x - 10, root.x + 10)) continue;
      const wob = Math.sin(t * 2.5 + root.x) * 2; // roots twitch but don't hurt
      g.lineStyle(3, INK, 1).lineBetween(root.x - cam, root.y0, root.x - cam + wob, root.y0 + root.len);
    }
    if (def.rootTrail && on(def.rootTrail.x0, def.rootTrail.x1)) {
      const { x0, x1 } = def.rootTrail;
      g.lineStyle(3, INK, 1).lineBetween(x0 - cam, ROOF, x0 - cam + Math.sin(t * 2) * 1.5, 250);
      g.fillStyle(INK, 1).fillRect(x0 - cam, ROOF, x1 - x0, 5);
      for (let x = x0 + 30; x < x1; x += 45) g.lineStyle(2, INK, 1).lineBetween(x - cam, ROOF + 4, x - cam + 3, ROOF + 14);
    }

    def.seesaws.forEach((sw, i) => {
      if (!on(sw.px - sw.half, sw.px + sw.half)) return;
      const angle = s.seesaws[i]!.angle;
      const e = seesawEnds(sw, angle);
      const base = sw.baseY ?? FLOOR;
      g.fillStyle(INK, 1).fillTriangle(sw.px - 18 - cam, base, sw.px + 18 - cam, base, sw.px - cam, sw.py);
      g.lineStyle(10, INK, 1).lineBetween(e.ax - cam, e.ay, e.bx - cam, e.by);
      g.fillCircle(e.ax - cam, e.ay, 5).fillCircle(e.bx - cam, e.by, 5);
      // Knots on a log: the low-end cradle, and the bark of a heavy log.
      const knot = (at: number, w: number, h: number) => {
        const along = at * sw.half;
        const cx = sw.px + Math.cos(angle) * along - cam;
        const cy = sw.py - Math.sin(angle) * along;
        const pts = [[-w / 2, 0], [w / 2, 0], [w / 2, -h], [-w / 2, -h]].map(([px, py]) =>
          new Phaser.Math.Vector2(cx + px! * Math.cos(angle) + py! * Math.sin(angle), cy - px! * Math.sin(angle) + py! * Math.cos(angle)));
        g.fillStyle(INK, 1).fillPoints(pts, true);
      };
      const initial = sw.high === 'right' ? 1 : -1;
      if (sw.cradle) knot(-initial * ((sw.half - 4) / sw.half), 8, 14);
      if (sw.heavy) {
        g.lineStyle(18, INK, 1).lineBetween(e.ax - cam, e.ay, e.bx - cam, e.by);
        g.fillCircle(e.ax - cam, e.ay, 9).fillCircle(e.bx - cam, e.by, 9);
        for (const at of [-0.55, 0.1, 0.6]) knot(at, 10, 13);
      }
    });
    def.gates.forEach((gate, i) => {
      if (!on(gate.x, gate.x + 14)) return;
      g.fillStyle(INK, 1).fillRoundedRect(gate.x - cam, ROOF, 14, gateBottom(sim, i) - ROOF, { tl: 0, tr: 0, bl: 7, br: 7 });
    });
    def.curtains.forEach((c, i) => {
      if (!on(c.x0, c.x1)) return;
      const bottom = curtainBottom(sim, i);
      g.fillStyle(INK, 1).fillRect(c.x0 - cam, ROOF, c.x1 - c.x0, bottom - 12 - ROOF);
      for (let x = c.x0 - 6; x < c.x1 + 6; x += 12) g.fillTriangle(x - cam, bottom - 14, x + 12 - cam, bottom - 14, x + 6 - cam, bottom);
    });
    for (const b of def.briars) {
      const w = (b.width ?? 20) * b.spikes.length;
      if (on(b.x0, b.x0 + w)) drawSpikes(g, briarTriangles(b), cam);
    }
    def.wheels.forEach((w, i) => {
      if (!on(w.cx - w.r, w.cx + w.r)) return;
      g.fillStyle(INK, 1);
      if (w.post) g.fillRect(w.cx - 2 - cam, w.cy, 4, FLOOR - w.cy);
      if (w.hang !== undefined) g.fillRect(w.cx - 2 - cam, w.hang, 4, w.cy - w.hang);
      drawWheel(g, w.cx - cam, w.cy, w.r, s.wheels[i]!.angle, w.missingTooth);
    });
    // Seeds first, so a pebble resting on one hides it.
    def.seeds.forEach((_, i) => {
      if (s.seeds[i]) return;
      const p = seedPosition(sim, i);
      if (on(p.x - 20, p.x + 20)) drawSeed(g, p.x - cam, p.y);
    });
    def.pebbles.forEach((p, i) => {
      const st = s.pebbles[i]!;
      if (st.gone || !on(st.x - p.r, st.x + p.r)) return;
      if (!p.heavy) {
        g.fillStyle(INK, 1).fillCircle(st.x - cam, st.y, p.r);
        return;
      }
      const pts = boulderPoints({ x: 0, y: 0, r: p.r }).map((q) => ({
        x: st.x + q.x * Math.cos(st.angle) - q.y * Math.sin(st.angle),
        y: st.y + q.x * Math.sin(st.angle) + q.y * Math.cos(st.angle),
      }));
      drawBoulder(g, pts, cam);
    });
    def.crushers.forEach((c, i) => {
      if (on(c.x - c.width / 2, c.x + c.width / 2)) drawCrusher(g, c.x - cam, c.width, crusherBottom(sim, i), ROOF, s.crushers[i]!.warn, t);
    });
    def.orbs.forEach((o, i) => {
      if (s.orbs[i]!.poppedAt === null && on(o.x - 30, o.x + 30)) drawOrb(g, o.x - cam, o.y + Math.sin(t * 2 + i) * 3, o.kind);
    });
    def.blooms.forEach((b, i) => {
      if (on(b.x - 30, b.x + 30)) drawBloom(g, b.x - cam, FLOOR, s.blooms[i]!, t);
    });
    def.bubbles.forEach((b, i) => {
      if (s.bubbles[i]!.poppedAt === null && on(b.x - 30, b.x + 30)) drawBubble(g, b.x - cam, b.y + Math.sin(t * 2 + i) * 3);
    });
    if (on(def.burrowX - 80, def.burrowX + 80)) drawBurrow(g, bx, FLOOR);

    // 1-1: Puff starts asleep on a dandelion head.
    if (def.perch && on(def.startX - 20, def.startX + 20)) {
      const headY = def.startY + PUFF_RADIUS + 9;
      g.fillStyle(INK, 1).fillRect(def.startX - 2 - cam, headY, 4, FLOOR - headY).fillCircle(def.startX - cam, headY, 10);
    }

    // The play layer's roof and ground.
    g.fillStyle(INK, 1).fillRect(0, 0, SCREEN.width, ROOF).fillRect(0, FLOOR, SCREEN.width, SCREEN.height - FLOOR);
    for (const l of this.labels) l.text.setX(l.x - cam);
  }

  // L4 foreground at 1.4x. It never covers the flight path or anything you can pick up.
  private drawForeground(cam: number, edgeShade: boolean): void {
    const g = this.fore.clear();
    const shift = cam * 1.4;
    g.fillStyle(DEEP, 1);
    for (let k = Math.floor((shift - 200) / 900); k < Math.floor((shift + SCREEN.width + 200) / 900) + 1; k++) {
      g.fillCircle(k * 900 + 100 - shift, SCREEN.height + 30, 70);
      g.fillCircle(k * 900 + 560 - shift, -46, 60);
    }
    // The dark creeps in from the left edge: a Puff the scroll leaves there is lost.
    if (edgeShade) for (let k = 0; k < 8; k++) g.fillStyle(INK, 0.09).fillRect(0, 0, EDGE_SHADE * (1 - k / 8), SCREEN.height);
  }
}

function drawRect(g: Phaser.GameObjects.Graphics, r: RectDef, cam: number): void {
  const x = r.x0 - cam;
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  g.fillStyle(INK, 1);
  if (r.look === 'vine') {
    g.fillRect(x + w / 2 - 2, r.y0, 4, h - 6);
    g.fillEllipse(x + w / 2, r.y1 - 6, 18, 12);
    return;
  }
  const round = r.round ?? {};
  const clampR = (v = 0) => Math.min(v, w / 2, h);
  g.fillRoundedRect(x, r.y0, w, h, { tl: clampR(round.tl), tr: clampR(round.tr), bl: clampR(round.bl), br: clampR(round.br) });
}
