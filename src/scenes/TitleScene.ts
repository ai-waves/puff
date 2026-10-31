import Phaser from 'phaser';
import { SCREEN } from '../config/constants';
import { CREAM, FAR, INK, MID } from '../config/palette';
import { audio } from '../audio/audio';
import { currentLevel } from '../game/progress';
import { drawPuff, drawSky, drawSun } from '../render/art';
import { settingsOverlay, toast } from '../render/panels';
import { button, go, label } from '../render/ui';
import { services } from '../services';

// A1 · Title. The wordmark sits in the silhouette layer, so it reads as part of the world.
// Puff floats near the sun and bobs slowly. The first hold starts the last unfinished level.
export class TitleScene extends Phaser.Scene {
  private puff!: Phaser.GameObjects.Graphics;
  private words: Phaser.GameObjects.Text[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('title');
  }

  create(): void {
    this.cameras.main.fadeIn(220, 27, 15, 16);
    const g = this.add.graphics();
    drawSky(g, [[0, 0xf2c386], [0.68, 0xeb9a6c], [1, 0xdc7a5e]], SCREEN.width, SCREEN.height);
    drawSun(g, 605, 131, 85);
    g.fillStyle(FAR, 1).fillCircle(140, 470, 220).fillCircle(490, 470, 190).fillCircle(840, 470, 240);
    g.fillStyle(MID, 1).fillCircle(260, 445, 140).fillCircle(635, 465, 165);
    g.fillStyle(INK, 1);
    g.fillRect(0, SCREEN.height - 48, SCREEN.width, 48);
    g.fillCircle(40, 380, 80).fillCircle(770, 420, 130).fillCircle(420, 378, 60);
    // The board puts this top-right blob behind the Skins and Settings pills (ink on ink), so it sits higher here.
    g.fillCircle(260, -20, 110).fillCircle(40, -10, 100).fillEllipse(770, -78, 300, 170);
    g.fillRoundedRect(250, 60, 3, 90, 1.5).fillRoundedRect(290, 70, 3, 130, 1.5).fillRoundedRect(700, 0, 3, 180, 1.5);

    this.words = [
      label(this, SCREEN.width / 2, 118, 'HOLLOWDRIFT', { size: 76, weight: 700, color: INK, spacing: 0.04 }).setOrigin(0.5, 0),
      label(this, SCREEN.width / 2, 200, "A SEED'S LONG WAY HOME", { size: 13, mono: true, color: INK, spacing: 0.3 }).setOrigin(0.5, 0),
      label(this, SCREEN.width / 2, SCREEN.height - 66 - 24, 'Hold anywhere to begin', { size: 20, weight: 500, color: CREAM, spacing: 0.06 }).setOrigin(0.5, 0),
    ];

    this.puff = this.add.graphics();

    const settings = button(this, 0, 28, 'Settings', { kind: 'secondary', h: 44, size: 16, ink: INK, outlineAlpha: 0.7, onTap: () => this.openSettings() });
    settings.setX(SCREEN.width - 56 - settings.span / 2);
    const skins = button(this, 0, 28, 'Skins', { kind: 'secondary', h: 44, size: 16, ink: INK, outlineAlpha: 0.7, onTap: () => toast(this, 'Skins are coming in a later update') });
    skins.setX(settings.x - settings.span / 2 - 12 - skins.span / 2);

    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      audio.unlock();
      services.applySettings();
      if (over.length || this.overlay) return;
      go(this, 'play', { levelId: currentLevel(services.save).id, held: true });
    });
  }

  // The title's words would show through the panel's toggles, so they step aside while it's open.
  private openSettings(): void {
    for (const w of this.words) w.setVisible(false);
    this.overlay = settingsOverlay(this, () => {
      this.overlay?.destroy();
      this.overlay = null;
      for (const w of this.words) w.setVisible(true);
    });
  }

  update(time: number): void {
    const bob = Math.sin(time / 900) * 6;
    this.puff.clear();
    drawPuff(this.puff, 630, 126 + bob, { scale: 0.8, state: 'drift', sprout: true, blush: true, glow: true, tilt: (8 * Math.PI) / 180, look: { x: 0.6, y: 0.4 } });
  }
}
