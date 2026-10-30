import Phaser from 'phaser';
import { SCREEN } from '../config/constants';
import { CREAM, FAR, INK, MUTED } from '../config/palette';
import { audio } from '../audio/audio';
import { LEVELS, levelById, nextLevel } from '../game/levels/index';
import { record } from '../game/progress';
import { drawSky, drawSun, glow } from '../render/art';
import { button, go, label, seedDots } from '../render/ui';
import { services } from '../services';
import type { ClearData } from './PlayScene';

// A6 · Level clear. The level ends at a glowing burrow and the sky brightens. Clones saved is the
// main result. Seeds fill in one at a time with a soft chime, and the next level is one tap away.
export class ClearScene extends Phaser.Scene {
  constructor() {
    super('clear');
  }

  create(data: ClearData): void {
    this.cameras.main.fadeIn(260, 255, 243, 220);
    const def = levelById(data.levelId) ?? LEVELS[0]!;
    const finale = def.id === '1-5';
    const g = this.add.graphics();
    // 1-5's burrow opens onto dusk; the others onto bright golden light.
    drawSky(g, finale ? [[0, 0xd4876c], [0.6, 0xb95f52], [1, 0x7c3a39]] : [[0, 0xf6d7a2], [0.6, 0xf2c386], [1, 0xeb9a6c]], SCREEN.width, SCREEN.height);
    drawSun(g, 425, 135, 95);
    g.fillStyle(FAR, 1).fillCircle(150, 500, 230).fillCircle(710, 500, 230);
    g.fillStyle(INK, 1).fillRect(0, SCREEN.height - 54, SCREEN.width, 54);
    g.fillRoundedRect(340, 250, 164, 120, { tl: 82, tr: 82, bl: 0, br: 0 });
    glow(g, 422, 320, 30, 0xffecbe, 1.4);
    g.fillStyle(0xf6d7a2, 1).fillRoundedRect(392, 290, 60, 60, { tl: 30, tr: 30, bl: 0, br: 0 });

    label(this, SCREEN.width / 2, 64, 'Home.', { size: 52, weight: 600, color: INK }).setOrigin(0.5, 0);
    const line = def.goalClones > 1 ? `${data.home} of ${def.goalClones} clones made it` : 'Puff made it home';
    label(this, SCREEN.width / 2, 130, line, { size: 18, weight: 400, color: 0x5a2a2a }).setOrigin(0.5, 0);

    // Seeds fill in one at a time, each with a soft chime.
    const dots = this.add.graphics();
    const shown = [false, false, false];
    const drawDots = () => {
      dots.clear();
      shown.forEach((on, i) => {
        const x = SCREEN.width / 2 - (3 * 26 + 2 * 12) / 2 + i * 38 + 13;
        if (on) {
          glow(dots, x, 187, 13, 0xffecbe, 1.2);
          dots.fillStyle(CREAM, 1).fillCircle(x, 187, 13);
          dots.lineStyle(3, INK, 1).strokeCircle(x, 187, 13);
        } else {
          dots.lineStyle(3, INK, 1).strokeCircle(x, 187, 11.5);
        }
      });
    };
    drawDots();
    let delay = 500;
    data.seeds.forEach((got, i) => {
      if (!got) return;
      this.time.delayedCall(delay, () => {
        shown[i] = true;
        drawDots();
        audio.seed();
      });
      delay += 380;
    });
    // 1-2: three soft knocks, one for each log you tipped.
    for (let k = 0; k < data.knocks; k++) this.time.delayedCall(delay + 200 + k * 320, () => audio.knock());

    const seconds = Math.round(data.time);
    label(this, 64, SCREEN.height - 72 - 50, 'TIME', { size: 11, mono: true, spacing: 0.14, color: INK });
    label(this, 64, SCREEN.height - 72 - 32, `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`, { size: 24, weight: 600, color: INK });

    const next = nextLevel(def.id);
    const y = SCREEN.height - 72 - 52;
    const replay = button(this, 0, y, 'Replay', { kind: 'secondary', ink: INK, outlineAlpha: 1, onTap: () => go(this, 'play', { levelId: def.id }) });
    const forward = finale
      ? button(this, 0, y, 'Chapter', { kind: 'primary', ink: INK, paper: CREAM, onTap: () => this.chapterCard() })
      : button(this, 0, y, next ? `Next · ${next.id}` : 'Map', { kind: 'primary', ink: INK, paper: CREAM, onTap: () => (next ? go(this, 'play', { levelId: next.id }) : go(this, 'map', { world: 1 })) });
    forward.setX(SCREEN.width - 56 - forward.w / 2);
    replay.setX(forward.x - forward.w / 2 - 12 - replay.w / 2);
  }

  // Last light: a chapter card reads "First Flight" with all 15 chapter seeds shown.
  private chapterCard(): void {
    const dim = this.add.rectangle(0, 0, SCREEN.width, SCREEN.height, INK, 0.92).setOrigin(0).setInteractive();
    const items: Phaser.GameObjects.GameObject[] = [dim];
    items.push(label(this, SCREEN.width / 2, 70, 'CHAPTER 1 · COMPLETE', { size: 12, mono: true, spacing: 0.2, color: MUTED }).setOrigin(0.5, 0));
    items.push(label(this, SCREEN.width / 2, 92, 'First Flight', { size: 52, weight: 600 }).setOrigin(0.5, 0));
    const g = this.add.graphics();
    items.push(g);
    const groupW = 3 * 14 + 2 * 6;
    const gap = 36;
    const left = SCREEN.width / 2 - (LEVELS.length * groupW + (LEVELS.length - 1) * gap) / 2;
    LEVELS.forEach((l, i) => {
      const x = left + i * (groupW + gap);
      seedDots(g, x, 196, record(services.save, l.id).seeds, { ink: CREAM, emptyAlpha: 0.6, ring: 2.5 });
      items.push(label(this, x + groupW / 2, 214, l.id, { size: 11, mono: true, spacing: 0.12, color: MUTED }).setOrigin(0.5, 0));
    });
    const map = button(this, SCREEN.width / 2 - 90, 270, 'Map', { kind: 'primary', w: 180, onTap: () => go(this, 'map', { world: 1 }) });
    items.push(map);
    const card = this.add.container(0, 0, items).setAlpha(0);
    this.tweens.add({ targets: card, alpha: 1, duration: 400 });
    audio.chime();
  }
}
