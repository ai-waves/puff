import Phaser from 'phaser';
import { PLAYFIELD, PUFF, SCREEN, SIM_STEP } from '../game/constants';
import type { Solid } from '../game/level';
import { LEVEL_1_1 } from '../game/level11';
import { createSim, isSolid, puffX, setHeld, step, type Sim, type SimEvent } from '../game/sim';
import { tuningFor } from '../game/tuning';
import { Sfx } from './sfx';

// Palette from the design board's Level 1-1 and World 1 frames.
const INK = 0x1b0f10;
const CREAM = 0xf6ebd5;
const GLOW = 0xfbe3b4;
const PALE_GLOW = 0xf6d7a2;
const FAR = 0xc8705a;
const MID = 0x7c3a39;
const STEM = 0x5e7a3a;
const LEAF = 0x9bc46a;
const SUN_X = 300;
const SUN_Y = 40;

// World 1 parallax factors: far layer 0.2x, mid layer 0.5x.
const FAR_FACTOR = 0.2;
const MID_FACTOR = 0.5;

const BURROW_GLOW_RANGE = SCREEN.width * 3; // the glow shows from three screens away
const HINT_RETURN_S = 4; // the hint comes back after this long without a hold
const HINT_X = 620;
const HINT_Y = 192;
const BLOOM_Y = 286;
const SKY_STRIPS = 24;

// Sky gradient stops, top to bottom: #F6D7A2 at 0%, #EB9A6C at 75%, #DC7A5E at 100%.
const SKY_STOPS: [number, number][] = [
  [0, 0xf6d7a2],
  [0.75, 0xeb9a6c],
  [1, 0xdc7a5e],
];

export class Level11Scene extends Phaser.Scene {
  private sim!: Sim;
  private accumulator = 0;
  private readonly sfx = new Sfx();
  private world!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private hintText!: Phaser.GameObjects.Text;
  private labelObjects!: { text: Phaser.GameObjects.Text; worldX: number }[];
  private homeText!: Phaser.GameObjects.Text;
  private summaryText!: Phaser.GameObjects.Text;
  private hintAlpha = 1;

  constructor() {
    super('Level11');
  }

  create(): void {
    const { scrollSpeed } = tuningFor(1);
    this.sim = createSim(LEVEL_1_1, scrollSpeed);
    this.accumulator = 0;
    this.hintAlpha = 1;

    this.drawSky();
    this.world = this.add.graphics();
    this.hud = this.add.graphics();

    // The second hint is printed on the log floor, as part of the world.
    this.labelObjects = [{ text: this.makeLabel('Tap to stay level'), worldX: 2230 }];

    this.hintText = this.add
      .text(HINT_X, HINT_Y + 40, 'Hold', { fontFamily: 'Fredoka', fontSize: '20px', color: '#F6EBD5' })
      .setOrigin(0.5, 0);

    this.homeText = this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 - 30, 'Home', { fontFamily: 'Fredoka', fontSize: '44px', color: '#F6EBD5' })
      .setOrigin(0.5)
      .setVisible(false);
    this.summaryText = this.add
      .text(SCREEN.width / 2, SCREEN.height / 2 + 24, '', { fontFamily: 'Fredoka', fontSize: '18px', color: '#F6EBD5' })
      .setOrigin(0.5)
      .setVisible(false);

    this.input.on('pointerdown', () => {
      this.sfx.unlock();
      if (this.sim.phase === 'won') {
        this.scene.restart();
        return;
      }
      setHeld(this.sim, true);
    });
    this.input.on('pointerup', () => setHeld(this.sim, false));
    this.input.on('pointerupoutside', () => setHeld(this.sim, false));
  }

  update(_time: number, deltaMs: number): void {
    this.accumulator += Math.min(deltaMs / 1000, 0.1);
    while (this.accumulator >= SIM_STEP) {
      this.handle(step(this.sim, SIM_STEP));
      this.accumulator -= SIM_STEP;
    }
    this.draw();
  }

  private handle(events: SimEvent[]): void {
    for (const event of events) {
      if (event.type === 'checkpoint') this.sfx.tone(880, { duration: 0.6 });
      if (event.type === 'seed') this.sfx.tone(1320, { duration: 0.3, gain: 0.08 });
      if (event.type === 'tip') this.sfx.tone(220, { duration: 0.25, type: 'triangle' });
      if (event.type === 'win') {
        [660, 880, 990].forEach((f, i) => this.sfx.tone(f, { duration: 0.8, delay: i * 0.12 }));
        this.showResults();
      }
    }
  }

  private showResults(): void {
    const seconds = Math.round(this.sim.time);
    const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    this.summaryText.setText(`Seeds ${this.sim.seeds.size}/${LEVEL_1_1.seeds.length} · ${time} · tap to play again`);
    this.homeText.setVisible(true);
    this.summaryText.setVisible(true);
  }

  private makeLabel(text: string): Phaser.GameObjects.Text {
    return this.add.text(0, 318, text, { fontFamily: 'Fredoka', fontSize: '12px', color: '#F6EBD5' }).setOrigin(0, 0.5);
  }

  private drawSky(): void {
    const sky = this.add.graphics();
    const stripHeight = PLAYFIELD.floorY / SKY_STRIPS;
    for (let i = 0; i < SKY_STRIPS; i++) {
      const t = i / (SKY_STRIPS - 1);
      sky.fillStyle(skyColorAt(t), 1).fillRect(0, i * stripHeight, SCREEN.width, stripHeight + 1);
    }
  }

  private draw(): void {
    const { sim } = this;
    const px = puffX(sim);
    const g = this.world;
    g.clear();

    // Sun and parallax layers.
    g.fillStyle(GLOW, 0.25).fillCircle(SUN_X, SUN_Y, 90);
    g.fillStyle(GLOW, 1).fillCircle(SUN_X, SUN_Y, 45);
    this.drawHills(g, FAR_FACTOR, FAR, 260, 240, 900);
    this.drawHills(g, MID_FACTOR, MID, 300, 150, 600);

    // Roof and ground bands.
    g.fillStyle(INK, 1);
    g.fillRect(0, 0, SCREEN.width, PLAYFIELD.roofY);
    g.fillRect(0, PLAYFIELD.floorY, SCREEN.width, SCREEN.height - PLAYFIELD.floorY);

    const sx = (wx: number) => wx - px + PUFF.screenX;
    const onScreen = (wx: number) => Math.abs(sx(wx) - SCREEN.width / 2) < SCREEN.width;

    for (const solid of LEVEL_1_1.solids) {
      if (onScreen(solid.x0) || onScreen(solid.x1)) this.drawSolid(g, solid, sx);
    }

    for (const cp of LEVEL_1_1.checkpoints) {
      if (!onScreen(cp.x)) continue;
      const lit = this.sim.checkpoints.has(cp.id);
      g.fillStyle(STEM, 1).fillRect(sx(cp.x) - 1, BLOOM_Y + 4, 2, PLAYFIELD.floorY - BLOOM_Y - 4);
      if (lit) g.fillStyle(GLOW, 0.35).fillCircle(sx(cp.x), BLOOM_Y, 26);
      g.fillStyle(lit ? GLOW : MID, 1).fillCircle(sx(cp.x), BLOOM_Y, 10);
    }

    for (const seed of LEVEL_1_1.seeds) {
      if (!onScreen(seed.x)) continue;
      if (this.sim.seeds.has(seed.id)) {
        g.lineStyle(1.5, CREAM, 0.4).strokeCircle(sx(seed.x), seed.y, 9);
      } else {
        g.fillStyle(GLOW, 0.35).fillCircle(sx(seed.x), seed.y, 18);
        g.fillStyle(CREAM, 1).fillCircle(sx(seed.x), seed.y, 9);
      }
    }

    const burrowX = sx(LEVEL_1_1.burrowX);
    if (LEVEL_1_1.burrowX - px < BURROW_GLOW_RANGE) g.fillStyle(GLOW, 0.18).fillCircle(burrowX, 300, 110);
    g.fillStyle(INK, 1).fillRoundedRect(burrowX - 45, 286, 90, 60, 45);
    g.fillStyle(PALE_GLOW, 1).fillCircle(burrowX, 300, 20);

    for (const label of this.labelObjects) label.text.setX(sx(label.worldX));

    this.drawPuff(g);
    this.drawHud();
  }

  private drawSolid(g: Phaser.GameObjects.Graphics, solid: Solid, sx: (wx: number) => number): void {
    const x = sx(solid.x0);
    const w = solid.x1 - solid.x0;
    const h = solid.y1 - solid.y0;

    if (!isSolid(this.sim, solid)) {
      // A tipped plank lifts out of the way over half a second.
      const lifted = this.sim.tippedAt === null ? 0 : Math.min(1, (this.sim.time - this.sim.tippedAt) / 0.5);
      g.fillStyle(INK, 1 - lifted * 0.6).fillRect(x, solid.y0 - lifted * 60, w, h);
      return;
    }

    g.fillStyle(INK, 1);
    switch (solid.kind) {
      case 'mound':
        g.fillRoundedRect(x, solid.y0, w, h + 40, 40);
        break;
      case 'vine':
        g.fillRoundedRect(x, solid.y0, w, h, 8);
        break;
      default:
        g.fillRect(x, solid.y0, w, h);
    }
  }

  private drawHills(g: Phaser.GameObjects.Graphics, factor: number, color: number, y: number, radius: number, period: number): void {
    const offset = (puffX(this.sim) * factor) % period;
    g.fillStyle(color, 1);
    for (let x = -period; x < SCREEN.width + period; x += period) g.fillCircle(x - offset, y, radius);
  }

  private drawPuff(g: Phaser.GameObjects.Graphics): void {
    const cx = PUFF.screenX;
    const cy = this.sim.puffY;
    g.fillStyle(GLOW, 0.3).fillCircle(cx, cy, 26);
    g.fillStyle(CREAM, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.fillCircle(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 3.5);
    }
    g.fillCircle(cx, cy, PUFF.radius);
    g.lineStyle(2, STEM, 1).lineBetween(cx, cy - 15, cx, cy - 22);
    g.fillStyle(LEAF, 1).fillEllipse(cx + 2, cy - 21, 14, 7);
    g.fillStyle(INK, 1).fillCircle(cx + 4, cy - 3, 5);
    g.fillStyle(0xffffff, 1).fillCircle(cx + 5, cy - 4, 1.5);
  }

  private drawHud(): void {
    const h = this.hud;
    h.clear();

    // Seed counter, top right: three seeds, filled once found.
    const startX = SCREEN.width - 56 - 3 * 14 - 2 * 6;
    LEVEL_1_1.seeds.forEach((seed, i) => {
      const x = startX + i * 20 + 7;
      if (this.sim.seeds.has(seed.id)) h.fillStyle(CREAM, 1).fillCircle(x, 53, 7);
      else h.lineStyle(2.5, CREAM, 0.7).strokeCircle(x, 53, 7);
    });

    // The hint shows until the first hold, then fades on release and returns after 4s without one.
    const sinceRelease = this.sim.time - this.sim.lastReleaseAt;
    const wantVisible = !this.sim.held && (this.sim.phase === 'waiting' || sinceRelease >= HINT_RETURN_S);
    this.hintAlpha += ((wantVisible ? 1 : 0) - this.hintAlpha) * 0.2;
    h.lineStyle(1.5, 0xfff8ec, this.hintAlpha).strokeCircle(HINT_X, HINT_Y, 42);
    h.fillStyle(0xfff8ec, this.hintAlpha).fillCircle(HINT_X, HINT_Y, 12);
    this.hintText.setAlpha(this.hintAlpha);

    if (this.sim.phase === 'won') h.fillStyle(INK, 0.6).fillRect(0, 0, SCREEN.width, SCREEN.height);
  }
}

// Linear blend between sky stops, returned as a packed 0xRRGGBB number.
function skyColorAt(t: number): number {
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [t1, c1] = SKY_STOPS[i]!;
    const [t0, c0] = SKY_STOPS[i - 1]!;
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return mix(c0, c1, k);
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1]![1];
}

function mix(a: number, b: number, k: number): number {
  const channel = (shift: number) => {
    const from = (a >> shift) & 0xff;
    const to = (b >> shift) & 0xff;
    return Math.round(from + (to - from) * k) << shift;
  };
  return channel(16) | channel(8) | channel(0);
}
