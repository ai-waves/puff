import Phaser from 'phaser';
import { SCREEN } from '../config/constants';
import { CREAM, INK, MID, MUTED } from '../config/palette';
import { LEVELS, WORLD_1_LEVEL_COUNT } from '../game/levels/index';
import { currentLevel, isUnlocked, record } from '../game/progress';
import { drawPuff, drawSky, glow } from '../render/art';
import { button, go, iconButton, label } from '../render/ui';
import { services } from '../services';

// A3 · Level map · Mossdeep. Levels sit on a vine path; the three dots under a level are its seeds.
// Puff waits at the next level, and tapping a level opens a small card with its goal before play.
const PATH: [number, number][] = [
  [110, 250], [180, 180], [260, 230], [340, 160], [420, 210],
  [500, 140], [580, 200], [660, 150], [740, 215], [790, 160],
];
const LOCKED_NUMBER = 0x8a7468;

export class MapScene extends Phaser.Scene {
  private selected = 0;
  private card!: Phaser.GameObjects.Container;
  private puff!: Phaser.GameObjects.Graphics;
  private current = 0;

  constructor() {
    super('map');
  }

  create(): void {
    this.cameras.main.fadeIn(220, 27, 15, 16);
    const save = services.save;
    this.current = LEVELS.indexOf(currentLevel(save));
    this.selected = this.current;

    const g = this.add.graphics();
    drawSky(g, [[0, 0xe9a877], [1, 0xc8705a]], SCREEN.width, SCREEN.height);
    g.fillStyle(MID, 1).fillCircle(120, 460, 180).fillCircle(570, 510, 210);
    g.fillStyle(INK, 1).fillRect(0, SCREEN.height - 30, SCREEN.width, 30);
    // Shifted right of the board's spot so it doesn't swallow the ink 'Mossdeep' header.
    g.fillEllipse(370, -40, 240, 200).fillEllipse(760, -40, 320, 240);

    // Dashed vine path.
    g.fillStyle(INK, 1);
    for (let i = 1; i < PATH.length; i++) {
      const [x0, y0] = PATH[i - 1]!;
      const [x1, y1] = PATH[i]!;
      const len = Math.hypot(x1 - x0, y1 - y0);
      for (let d = 0; d < len; d += 11) g.fillCircle(x0 + ((x1 - x0) * d) / len, y0 + ((y1 - y0) * d) / len, 1.5);
    }

    for (let i = 0; i < WORLD_1_LEVEL_COUNT; i++) this.node(g, i);

    this.puff = this.add.graphics();
    iconButton(this, 64 + 22, 26 + 22, 'back', { ink: INK, outlineAlpha: 0.7, onTap: () => go(this, 'world') });
    label(this, 64 + 44 + 16, 30, 'WORLD 1', { size: 11, mono: true, spacing: 0.12, color: INK });
    label(this, 64 + 44 + 16, 44, 'Mossdeep', { size: 24, weight: 600, color: INK });
    this.showCard();
  }

  private node(g: Phaser.GameObjects.Graphics, i: number): void {
    const [x, y] = PATH[i]!;
    const level = LEVELS[i];
    const save = services.save;
    const cleared = level ? record(save, level.id).cleared : false;
    const isCurrent = i === this.current && level !== undefined;
    const r = isCurrent ? 29 : 23;
    if (isCurrent) {
      glow(g, x, y, 30, 0xffecbe, 1.2);
      g.fillStyle(CREAM, 0.35).fillCircle(x, y, r + 6);
    }
    if (cleared || isCurrent) {
      g.fillStyle(CREAM, 1).fillCircle(x, y, r);
    } else {
      g.fillStyle(INK, 1).fillCircle(x, y, r);
      g.lineStyle(1.5, CREAM, 0.35).strokeCircle(x, y, r - 0.75);
    }
    label(this, x, y, String(i + 1), { size: isCurrent ? 22 : 18, weight: isCurrent ? 700 : 600, color: cleared || isCurrent ? INK : LOCKED_NUMBER }).setOrigin(0.5);

    if (cleared && level) {
      const seeds = record(save, level.id).seeds;
      seeds.forEach((got, k) => {
        const cx = x - 14 + k * 14;
        if (got) g.fillStyle(INK, 1).fillCircle(cx, y + r + 11, 4.5);
        else g.lineStyle(1.5, INK, 1).strokeCircle(cx, y + r + 11, 3.75);
      });
    }

    const hit = this.add.zone(x, y, 52, 52).setInteractive();
    hit.on('pointerup', () => {
      this.selected = i;
      this.showCard();
    });
  }

  private showCard(): void {
    this.card?.destroy();
    const i = this.selected;
    const level = LEVELS[i];
    const save = services.save;
    const w = 380;
    const h = 68;
    const x = SCREEN.width - 56 - w;
    const y = SCREEN.height - 40 - h;
    const bg = this.add.graphics();
    bg.fillStyle(INK, 1).fillRoundedRect(x, y, w, h, 20);
    const items: Phaser.GameObjects.GameObject[] = [bg];

    let title = `1-${i + 1}`;
    let body = 'Coming soon.';
    let playable = false;
    if (level) {
      title = `${level.id} ${level.name}`;
      const open = isUnlocked(save, level.id);
      const rec = record(save, level.id);
      body = open ? level.blurb : `Finish 1-${i} to open.`;
      if (open && level.goalClones > 1 && rec.badge) body = `${level.blurb} Badge earned.`;
      playable = open;
    }
    const textW = playable ? w - 20 - 130 : w - 40;
    items.push(label(this, x + 20, y + 13, title, { size: 18, weight: 600 }));
    items.push(label(this, x + 20, y + 38, body, { size: 13, weight: 400, color: MUTED }).setWordWrapWidth(textW));
    if (playable && level) {
      const play = button(this, 0, y + 10, 'Play', { kind: 'primary', h: 48, size: 18, onTap: () => go(this, 'play', { levelId: level.id }) });
      play.setX(x + w - 10 - play.span / 2);
      items.push(play);
    }
    this.card = this.add.container(0, 0, items);
  }

  update(time: number): void {
    const [x, y] = PATH[this.current]!;
    this.puff.clear();
    drawPuff(this.puff, x, y - 60 + Math.sin(time / 700) * 4, { scale: 0.55, state: 'drift', sprout: true, blush: true });
  }
}
