import Phaser from 'phaser';
import { HINT_RETURN, PLAYFIELD, PUFF_RADIUS, PUFF_SCREEN_X, SCREEN, SIM_STEP } from '../config/constants';
import { CREAM, INK, MID, MUTED, PALE } from '../config/palette';
import { audio } from '../audio/audio';
import { LEVELS, levelById } from '../game/levels/index';
import { recordClear } from '../game/progress';
import {
  arrivalTime,
  briarTriangles,
  createSim,
  crusherBottom,
  curtainBottom,
  destroySim,
  gateBottom,
  retryFromCheckpoint,
  seedPosition,
  setHeld,
  step,
  type Cause,
  type Puff,
  type Sim,
  type SimEvent,
} from '../game/sim';
import { circleTriangle } from '../game/geometry';
import type { LevelDef } from '../game/types';
import { drawCrusher, drawPuff, drawSky, drawSpikes, drawWheel, type PuffState } from '../render/art';
import { DEPTH, LevelView } from '../render/levelView';
import { settingsRow } from '../render/panels';
import { button, go, iconButton, label, seedDots } from '../render/ui';
import { services } from '../services';

export interface PlayData {
  levelId: string;
  held?: boolean; // the title's hold carries straight into play
  // A test flight from the level editor: the edited level, from (x, y) at t seconds into a run, so
  // crushers and thornwheels are where a run from the start would find them. Nothing is recorded,
  // and Esc (or Editor) goes back to the editor where it left off.
  test?: { def: LevelDef; x: number; y: number; t: number };
}

export interface ClearData {
  levelId: string;
  seeds: boolean[];
  home: number;
  time: number;
  knocks: number;
}

interface Particle {
  kind: 'tuft' | 'spark' | 'dust' | 'ring' | 'lost';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
}

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
const LEADER_SCALE = PUFF_RADIUS / 30; // Puff is 30pt across; the art is drawn at 60pt
const CLONE_SCALE = LEADER_SCALE * (2 / 3);
const HUD_ALPHA = 0.85; // full opacity only while something changes
const BAR_X = 322;
const BAR_W = 200;
const HUD_Y = 44;
const HUD_SAMPLES = [330, 420, 520, 650, 700, 760]; // screen x where HUD ink sits

export class PlayScene extends Phaser.Scene {
  private def!: LevelDef;
  private sim!: Sim;
  private acc = 0;
  private camX = 0;
  private paused = false;
  private ending = false;
  private view!: LevelView;
  private test: PlayData['test'] | null = null;
  private puffs!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private hudLayer!: Phaser.GameObjects.Container;
  private cloneText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private pauseUI: Phaser.GameObjects.Container | null = null;
  private failUI: Phaser.GameObjects.Container | null = null;
  private brighten!: Phaser.GameObjects.Rectangle;
  private particles: Particle[] = [];
  private hintAlpha = 1;
  private hudFlashUntil = 0;
  private hudKey = '';
  private reformAt = -1;
  private now = 0;
  private onVisibility = () => {
    if (document.hidden) this.pause();
  };

  constructor() {
    super('play');
  }

  create(data: PlayData): void {
    this.test = data.test ?? null;
    const midway = this.test !== null && this.test.t > 0.05 && this.test.x > this.test.def.startX;
    this.def = this.test ? (midway ? testFlight(this.test.def, this.test.x, this.test.y) : this.test.def) : (levelById(data.levelId) ?? LEVELS[0]!);
    this.sim = createSim(this.def, midway ? this.test!.t : 0);
    // Only carry the title's hold over if the finger is still down after the fade.
    if (data.held && this.input.activePointer.isDown) setHeld(this.sim, true);
    this.acc = 0;
    this.camX = this.sim.s.camX;
    this.paused = false;
    this.ending = false;
    this.particles = [];
    this.pauseUI = null;
    this.failUI = null;
    this.hintAlpha = this.def.hint ? 1 : 0;
    this.hudKey = '';
    this.reformAt = -1;
    this.cameras.main.fadeIn(220, 27, 15, 16);

    this.view = new LevelView(this, this.def);
    this.puffs = this.add.graphics().setDepth(DEPTH.puffs);
    this.fx = this.add.graphics().setDepth(DEPTH.fx);
    this.brighten = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0xfff3dc, 0).setOrigin(0).setDepth(DEPTH.overlay);

    this.hud = this.add.graphics();
    this.hintText = label(this, 642, 192 + 42 + 12, 'Hold', { size: 20, weight: 500, color: INK, spacing: 0.04 }).setOrigin(0.5, 0).setDepth(DEPTH.hud);
    this.cloneText = label(this, 0, HUD_Y, '×1', { size: 18, weight: 600 }).setOrigin(0, 0.5);
    const pauseBtn = iconButton(this, 60 + 22, HUD_Y, 'pause', { fill: INK, fillAlpha: 0.35, onTap: () => this.pause() });
    this.hudLayer = this.add.container(0, 0, [this.hud, this.cloneText, pauseBtn]).setDepth(DEPTH.hud);
    // Dev builds: E opens this level in the level editor, right where you are.
    if (import.meta.env.DEV) this.input.keyboard?.on('keydown-E', () => this.openEditor());
    if (this.test) {
      const back = () => this.backToEditor();
      this.input.keyboard?.on('keydown-ESC', back);
      label(this, SCREEN.width - 56, SCREEN.height - 30, 'TEST FLIGHT · ESC FOR EDITOR', { size: 11, mono: true, spacing: 0.14, color: CREAM }).setOrigin(1, 0.5).setDepth(DEPTH.hud).setAlpha(0.7);
    }

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      audio.unlock();
      services.applySettings();
      if (over.length || this.paused || this.failUI || this.ending) return;
      setHeld(this.sim, true);
    });
    const release = () => setHeld(this.sim, false);
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    audio.startLevel();
    audio.setVoices(1);
    document.addEventListener('visibilitychange', this.onVisibility);
    const sim = this.sim;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      audio.stopLevel();
      document.removeEventListener('visibilitychange', this.onVisibility);
      destroySim(sim); // free the Box2D world
    });
  }

  update(time: number, delta: number): void {
    this.now = time / 1000;
    const dt = Math.min(delta / 1000, 0.1);
    if (!this.paused && !this.failUI && !this.ending) {
      this.acc += dt;
      while (this.acc >= SIM_STEP) {
        this.handle(step(this.sim, SIM_STEP));
        this.acc -= SIM_STEP;
      }
    }
    this.camX = this.sim.s.camX; // the scroll belongs to the sim: it decides who it leaves behind
    this.tickParticles(dt);
    this.draw();
  }

  // ---------- Events ----------

  private handle(events: SimEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'bump':
          audio.bump();
          services.buzz('light');
          this.burst('dust', e.x + 12, e.y, 4);
          break;
        case 'tip':
          audio.knock();
          services.buzz('light');
          break;
        case 'drop':
        case 'knock':
          audio.knock();
          break;
        case 'gate':
          audio.creak();
          break;
        case 'push':
          audio.tap();
          break;
        case 'seed': {
          audio.seed();
          const i = this.def.seeds.findIndex((s) => s.id === e.id);
          const p = seedPosition(this.sim, i);
          this.burst('spark', p.x, p.y, 8);
          break;
        }
        case 'pop': {
          audio.pop();
          const b = this.def.bubbles.find((x) => x.id === e.id)!;
          this.particles.push({ kind: 'ring', x: b.x, y: b.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 20 });
          break;
        }
        case 'split':
          audio.setVoices(e.count);
          break;
        case 'checkpoint':
          audio.chime();
          break;
        case 'lost':
          audio.fluff();
          services.buzz('medium');
          this.burst('tuft', e.x, e.y, 9);
          this.particles.push({ kind: 'lost', x: e.x, y: e.y, vx: 20, vy: -30, life: 0.4, max: 0.4, size: e.leader ? LEADER_SCALE : CLONE_SCALE });
          audio.setVoices(e.left);
          break;
        case 'respawn':
          this.reformAt = this.now;
          this.camX = this.sim.s.camX;
          audio.setVoices(this.sim.s.puffs.length);
          break;
        case 'resize': {
          audio.pop();
          services.buzz('light');
          const o = this.def.orbs.find((x) => x.id === e.id)!;
          this.particles.push({ kind: 'ring', x: o.x, y: o.y, vx: 0, vy: 0, life: 0.35, max: 0.35, size: 20 });
          break;
        }
        case 'unsize':
          audio.tap();
          break;
        case 'dust':
          break;
        case 'slam': {
          audio.knock();
          services.buzz('medium');
          const i = this.def.crushers.findIndex((c) => c.id === e.id);
          const c = this.def.crushers[i]!;
          this.burst('dust', c.x - c.width / 2, FLOOR - 4, 4);
          this.burst('dust', c.x + c.width / 2, FLOOR - 4, 4);
          break;
        }
        case 'jam':
          audio.jam();
          break;
        case 'fail':
          this.time.delayedCall(550, () => this.showFail(e.cause));
          break;
        case 'win':
          this.win(e.home);
          break;
        case 'start':
          break;
      }
    }
  }


  // ---------- Win, fail, pause ----------

  private win(home: number): void {
    this.ending = true;
    setHeld(this.sim, false);
    this.hudLayer.setVisible(false);
    services.buzz('success');
    // Clones enter one at a time, each with a chime.
    for (let i = 0; i < home; i++) this.time.delayedCall(i * 180, () => audio.chime());
    const cam = this.cameras.main;
    cam.pan(PUFF_SCREEN_X + 60, 300, 1200, 'Sine.easeInOut');
    cam.zoomTo(1.15, 1200, 'Sine.easeInOut');
    this.tweens.add({ targets: this.brighten, alpha: 0.4, duration: 1200 });

    const s = this.sim.s;
    if (this.test) {
      this.time.delayedCall(1400, () => this.backToEditor());
      return;
    }
    services.setSave(recordClear(services.save, this.def, { seeds: s.seeds, home, time: s.t }));
    const knocks = this.def.seesaws.filter((sw, i) => (sw.mode ?? 'free') === 'free' && s.seesaws[i]!.flips > 0).length;
    const result: ClearData = { levelId: this.def.id, seeds: [...s.seeds], home, time: s.t, knocks };
    this.time.delayedCall(1400 + home * 120, () => go(this, 'clear', result));
  }

  private pause(): void {
    if (this.paused || this.failUI || this.ending) return;
    this.paused = true;
    setHeld(this.sim, false);
    const dim = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x140b0c, 0.72).setOrigin(0).setInteractive();
    const kicker = label(this, SCREEN.width / 2, 93, `${this.def.id} · ${this.def.name.toUpperCase()}`, { size: 12, mono: true, spacing: 0.2, color: MUTED }).setOrigin(0.5, 0);
    const title = label(this, SCREEN.width / 2, 138, 'Paused', { size: 44, weight: 600 }).setOrigin(0.5);
    const left = SCREEN.width / 2 - (180 + 150 + 150 + 28) / 2;
    const resume = button(this, left, 192, 'Resume', { kind: 'primary', w: 180, onTap: () => this.resume() });
    const restart = button(this, left + 194, 192, 'Restart', { kind: 'secondary', w: 150, onTap: () => this.restart() });
    const map = this.test
      ? button(this, left + 358, 192, 'Editor', { kind: 'secondary', w: 150, onTap: () => this.backToEditor() })
      : button(this, left + 358, 192, 'Map', { kind: 'secondary', w: 150, onTap: () => go(this, 'map', { world: this.def.world }) });
    const toggles = settingsRow(this, SCREEN.width / 2, 284);
    this.pauseUI = this.add.container(0, 0, [dim, kicker, title, resume, restart, map, toggles]).setDepth(150);
  }

  private resume(): void {
    this.pauseUI?.destroy();
    this.pauseUI = null;
    this.paused = false;
  }

  // A7 · Fail. Quick and a bit funny, never a punishment: the sky drains of warmth, the cause gets
  // a one-word title, and the main button returns to the last checkpoint in under a second.
  private showFail(cause: Cause): void {
    if (this.failUI) return;
    const g = this.add.graphics();
    drawSky(g, [[0, 0xb9786a], [1, 0x7c3a39]], SCREEN.width, SCREEN.height);
    g.fillStyle(0x5a2a2a, 1).fillCircle(110, 450, 210).fillCircle(640, 510, 260);
    g.fillStyle(INK, 1).fillRect(0, SCREEN.height - 40, SCREEN.width, 40).fillEllipse(700, 440, 360, 280).fillEllipse(90, -30, 260, 220);
    if (cause === 'thornwheel') {
      drawWheel(g, 640, 170, 60, this.now);
    } else if (cause === 'crusher') {
      drawCrusher(g, 650, 150, SCREEN.height - 40, 0, false, this.now);
    } else if (cause === 'behind') {
      g.fillStyle(INK, 1).fillRect(SCREEN.width - 230, 0, 230, SCREEN.height);
    } else {
      drawSpikes(g, briarTriangles({ x0: 560, base: SCREEN.height - 40, side: 'up', spikes: [70, 96, 60, 84, 66], width: 28 }), 0);
    }
    g.fillStyle(CREAM, 1);
    for (const [x, y, w, a] of [[565, 163, 18, -30], [552, 180, 12, 10], [567, 198, 14, 40]] as const) {
      const r = (a * Math.PI) / 180;
      g.fillPoints(
        [[-w / 2, -2.5], [w / 2, -2.5], [w / 2, 2.5], [-w / 2, 2.5]].map(([px, py]) => new Phaser.Math.Vector2(x + px! * Math.cos(r) - py! * Math.sin(r), y + px! * Math.sin(r) + py! * Math.cos(r))),
        true,
      );
    }
    const words: Record<Cause, [string, string]> = {
      thornwheel: ['Shredded.', 'The thornwheel got your last clone.'],
      briar: ['Pricked.', 'The briar got your last clone.'],
      crusher: ['Squashed.', 'The rootcrusher got your last clone.'],
      behind: ['Left behind.', 'The dark caught your last clone.'],
    };
    const [title, line] = words[cause];
    const t1 = label(this, 64, 96, title, { size: 48, weight: 600 });
    const t2 = label(this, 64, 96 + 56, line, { size: 19, weight: 400, color: 0xe8cfc0 });
    const retry = button(this, 64, 232, 'Retry from checkpoint', { kind: 'primary', h: 56, size: 20, onTap: () => this.retry() });
    const restart = button(this, 64 + retry.span + 12, 232, 'Restart', { kind: 'secondary', h: 56, onTap: () => this.restart() });
    const block = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0, 0).setOrigin(0).setInteractive();
    this.failUI = this.add.container(0, 0, [block, g, t1, t2, retry, restart]).setDepth(200);
  }

  private retry(): void {
    this.handle(retryFromCheckpoint(this.sim));
    this.failUI?.destroy();
    this.failUI = null;
    setHeld(this.sim, false);
  }

  private restart(): void {
    this.scene.restart({ levelId: this.def.id, test: this.test ?? undefined });
  }

  private backToEditor(): void {
    if (!this.test) return;
    go(this, 'editor', { levelId: this.test.def.id, t: this.test.t });
  }

  private openEditor(): void {
    if (this.ending) return;
    go(this, 'editor', { levelId: this.def.id, t: arrivalTime(this.def, this.camX + PUFF_SCREEN_X) });
  }

  // ---------- Particles ----------

  private burst(kind: Particle['kind'], x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const speed = kind === 'tuft' ? 80 + Math.random() * 80 : kind === 'spark' ? 50 + Math.random() * 50 : 30 + Math.random() * 30;
      const life = kind === 'tuft' ? 0.45 : 0.35;
      this.particles.push({ kind, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, max: life, size: kind === 'tuft' ? 4 : 2.5 });
    }
  }

  private tickParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'tuft') p.vy += 60 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  // ---------- Drawing ----------

  private draw(): void {
    const cam = this.camX;
    const t = this.now;
    this.view.draw(this.sim, cam, t, { edgeShade: this.sim.s.phase !== 'waiting' || this.sim.s.t > 0 });
    this.drawPuffs(cam, t);
    this.drawFx(cam);
    this.drawHud(t);
  }

  private drawPuffs(cam: number, t: number): void {
    const g = this.puffs.clear();
    const s = this.sim.s;
    const lead = s.puffs[0];
    if (!lead) return;
    const look = this.lookToward(lead);
    const grow = this.reformAt < 0 ? 1 : Math.min(1, (this.now - this.reformAt) / 0.2);
    const lit = this.inLight(lead.x);
    // Draw clones first, so the leader sits on top of the flock.
    for (let i = s.puffs.length - 1; i >= 0; i--) {
      const p = s.puffs[i]!;
      const isLead = i === 0;
      let state: PuffState = 'drift';
      if (s.phase === 'waiting' && this.def.perch) state = 'sleep';
      else if (p.bonk > 0) state = 'bonk';
      else if (isLead ? s.held : p.vy < -30) state = 'puff';
      // A Swell or Shrink about to wear off wobbles.
      const ending = p.size !== 1 && p.sizeUntil - s.t < 1 ? 1 + Math.sin(t * 30) * 0.05 : 1;
      drawPuff(g, p.x - cam, p.y, {
        scale: (p.r / 30) * grow * ending,
        state,
        sprout: isLead,
        blush: isLead,
        glow: isLead,
        look,
        leaf: lit ? -45 : -25,
        tilt: state === 'drift' ? Math.sin(t * 2.2 + p.id) * 0.06 : 0,
      });
    }
  }

  // Is this world point covered by the dark play layer?
  private darkAt(x: number, y: number): boolean {
    const def = this.def;
    if (def.rects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1)) return true;
    if (def.gates.some((g, i) => x >= g.x && x <= g.x + 14 && y <= gateBottom(this.sim, i))) return true;
    if (def.curtains.some((c, i) => x >= c.x0 && x <= c.x1 && y <= curtainBottom(this.sim, i))) return true;
    if (def.wheels.some((w) => Math.hypot(x - w.cx, y - w.cy) < w.r)) return true;
    if (def.crushers.some((c, i) => Math.abs(x - c.x) < c.width / 2 && y <= crusherBottom(this.sim, i))) return true;
    return def.briars.some((b) => {
      if (b.side !== 'down' || x < b.x0 || x > b.x0 + (b.width ?? 20) * b.spikes.length) return false;
      return briarTriangles(b).some((t) => circleTriangle(x, y, 0.01, t.ax, t.ay, t.bx, t.by, t.qx, t.qy));
    });
  }

  // One big eye looks toward the next hazard ahead.
  private lookToward(lead: Puff): { x: number; y: number } {
    const def = this.def;
    let best: { x: number; y: number } | null = null;
    let bestD = 700;
    const consider = (x: number, y: number) => {
      const d = x - lead.x;
      if (d > -20 && d < bestD) {
        bestD = d;
        best = { x, y };
      }
    };
    for (const b of def.briars) {
      const w = (b.width ?? 20) * b.spikes.length;
      const tall = Math.max(...b.spikes);
      consider(Math.max(b.x0, Math.min(lead.x + 40, b.x0 + w)), b.side === 'up' ? b.base - tall / 2 : b.base + tall / 2);
    }
    for (const w of def.wheels) consider(w.cx, w.cy);
    def.crushers.forEach((c, i) => consider(c.x, crusherBottom(this.sim, i)));
    def.curtains.forEach((c, i) => consider(c.x0, (ROOF + curtainBottom(this.sim, i)) / 2));
    if (!best) return { x: 1, y: 0.15 };
    const target = best as { x: number; y: number };
    const dx = target.x - lead.x;
    const dy = target.y - lead.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: dx / len, y: dy / len };
  }

  // The sprout perks up in light: near an open bloom or the burrow's glow.
  private inLight(x: number): boolean {
    if (Math.abs(this.def.burrowX - x) < 300) return true;
    return this.def.blooms.some((b, i) => this.sim.s.blooms[i] && Math.abs(b.x - x) < 140);
  }

  private drawFx(cam: number): void {
    const g = this.fx.clear();
    for (const p of this.particles) {
      const k = p.life / p.max;
      const x = p.x - cam;
      if (p.kind === 'tuft') g.fillStyle(CREAM, k).fillCircle(x, p.y, p.size);
      else if (p.kind === 'spark') g.fillStyle(0xfff3c8, k).fillCircle(x, p.y, p.size);
      else if (p.kind === 'dust') g.fillStyle(MID, k).fillCircle(x, p.y, p.size);
      else if (p.kind === 'ring') g.lineStyle(2, PALE, k).strokeCircle(x, p.y, p.size * (1.6 - k * 0.6));
      else drawPuff(g, x, p.y, { scale: p.size, state: 'lost', sprout: true, alpha: k });
    }
  }

  // A4 · HUD: pause, level progress (the tick marks the checkpoint), seeds and a live clone count.
  // Everything sits in the top 70pt so thumbs on the lower screen never cover it.
  private drawHud(t: number): void {
    const g = this.hud.clear();
    const s = this.sim.s;
    const lead = s.puffs[0];
    const def = this.def;

    // When the play layer covers the HUD (the hollow log, a bramble ceiling) it shades the HUD,
    // so its ink turns pale.
    const dark = HUD_SAMPLES.filter((x) => this.darkAt(this.camX + x, HUD_Y)).length;
    const pale = dark >= HUD_SAMPLES.length / 2;
    const ink = pale ? CREAM : INK;

    const key = `${s.seeds.join()}|${s.puffs.length}|${s.blooms.join()}`;
    if (key !== this.hudKey) {
      if (this.hudKey) this.hudFlashUntil = t + 1;
      this.hudKey = key;
    }
    this.hudLayer.setAlpha(t < this.hudFlashUntil ? 1 : HUD_ALPHA);

    if (s.phase !== 'waiting') {
      const span = def.burrowX - def.startX;
      const progress = lead ? Math.max(0, Math.min(1, (lead.x - def.startX) / span)) : 0;
      g.fillStyle(pale ? CREAM : INK, pale ? 0.25 : 0.3).fillRoundedRect(BAR_X, HUD_Y - 2.5, BAR_W, 5, 2.5);
      g.fillStyle(ink, 1).fillRoundedRect(BAR_X, HUD_Y - 2.5, Math.max(5, BAR_W * progress), 5, 2.5);
      for (const b of def.blooms) g.fillStyle(ink, 1).fillRect(BAR_X + (BAR_W * (b.x - def.startX)) / span - 1, HUD_Y - 4.5, 2, 9);
      g.fillStyle(CREAM, 1).fillCircle(BAR_X + BAR_W * progress, HUD_Y, 6.5);
      if (!pale) g.lineStyle(2, INK, 1).strokeCircle(BAR_X + BAR_W * progress, HUD_Y, 6.5);
    }

    // Seeds, plus the clone pill in levels with Split bubbles.
    let right = SCREEN.width - 56;
    const flock = def.bubbles.length > 0;
    this.cloneText.setVisible(flock);
    if (flock) {
      this.cloneText.setText(`×${s.puffs.length}`);
      const pillW = 8 + 20 + 8 + this.cloneText.width + 14;
      const x = right - pillW;
      g.fillStyle(pale ? CREAM : INK, pale ? 0.12 : 1).fillRoundedRect(x, HUD_Y - 18, pillW, 36, 18);
      g.fillStyle(CREAM, 1).fillCircle(x + 8 + 10, HUD_Y, 10);
      this.cloneText.setPosition(x + 36, HUD_Y);
      right = x - 16;
    }
    seedDots(g, right - 54, HUD_Y, s.seeds, pale ? { ring: 0, ink: CREAM, emptyAlpha: 0.7 } : {});

    // 1-1 hint: a single word under the right thumb. It fades on release and only returns
    // if the player hasn't held for 4 seconds. Every level shows it while a re-formed Puff waits
    // for the hold that starts the scroll again.
    const reforming = s.phase === 'waiting' && s.t > 0;
    if (def.hint || reforming) {
      this.hintText.setVisible(true);
      const idle = s.phase === 'waiting' || (def.hint && s.phase === 'running' && s.t - s.lastReleaseAt >= HINT_RETURN);
      const want = !s.held && idle ? 1 : 0;
      this.hintAlpha += (want - this.hintAlpha) * 0.15;
      const a = this.hintAlpha;
      const pulse = 1 + Math.sin(t * 3) * 0.04;
      g.lineStyle(14, PALE, 0.18 * a).strokeCircle(642, 192, (42 + 7) * pulse);
      g.lineStyle(1.5, PALE, a).strokeCircle(642, 192, 42 * pulse);
      g.fillStyle(PALE, a).fillCircle(642, 192, 12);
      this.hintText.setAlpha(a);
    } else {
      this.hintText.setVisible(false);
    }
  }
}

// The level as a test flight from (x, y): Puff starts mid-air there, and blooms already behind it
// are left out so the first checkpoint is ahead.
function testFlight(def: LevelDef, x: number, y: number): LevelDef {
  const blooms = def.blooms.filter((b) => b.x > x);
  const linger = !!def.lingerAtBloom && def.blooms[0] !== undefined && def.blooms[0].x > x; // only if it's still ahead
  return { ...def, startX: x, startY: y, perch: false, hint: false, lingerAtBloom: linger, blooms };
}
