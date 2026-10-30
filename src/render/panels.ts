import Phaser from 'phaser';
import { SCREEN } from '../config/constants';
import { CREAM, MUTED } from '../config/palette';
import { services } from '../services';
import { button, label, toggle } from './ui';

// The three settings toggles from the Pause frame, centred on cx.
export function settingsRow(scene: Phaser.Scene, cx: number, y: number): Phaser.GameObjects.Container {
  const s = services.save.settings;
  const items = [
    toggle(scene, 0, 0, 'Music', s.music, (v) => services.setSetting('music', v)),
    toggle(scene, 0, 0, 'Sound', s.sound, (v) => services.setSetting('sound', v)),
    toggle(scene, 0, 0, 'Haptics', s.haptics, (v) => services.setSetting('haptics', v)),
  ];
  const gap = 28;
  const total = items.reduce((w, c) => w + c.w, 0) + gap * (items.length - 1);
  let x = cx - total / 2;
  for (const c of items) {
    c.setPosition(x, y);
    x += c.w + gap;
  }
  return scene.add.container(0, 0, items);
}

// Settings from the title: the same three toggles over the dimmed world. No separate settings screen.
export function settingsOverlay(scene: Phaser.Scene, onClose: () => void): Phaser.GameObjects.Container {
  const dim = scene.add.rectangle(0, 0, SCREEN.width, SCREEN.height, 0x140b0c, 0.72).setOrigin(0).setInteractive();
  const title = label(scene, SCREEN.width / 2, 120, 'Settings', { size: 44, weight: 600, color: CREAM }).setOrigin(0.5);
  const kicker = label(scene, SCREEN.width / 2, 82, 'HOLLOWDRIFT', { size: 12, mono: true, spacing: 0.2, color: MUTED }).setOrigin(0.5);
  const row = settingsRow(scene, SCREEN.width / 2, 196);
  const done = button(scene, SCREEN.width / 2 - 90, 246, 'Done', { kind: 'primary', w: 180, onTap: onClose });
  return scene.add.container(0, 0, [dim, kicker, title, row, done]).setDepth(100);
}

// A quiet one-line message near the bottom of the screen.
export function toast(scene: Phaser.Scene, text: string): void {
  const t = label(scene, SCREEN.width / 2, SCREEN.height - 40, text, { size: 16, weight: 500, color: CREAM }).setOrigin(0.5).setDepth(120);
  const bg = scene.add.graphics().setDepth(119);
  bg.fillStyle(0x1b0f10, 0.85).fillRoundedRect(t.x - t.width / 2 - 16, t.y - 18, t.width + 32, 36, 18);
  scene.tweens.add({ targets: [t, bg], alpha: 0, delay: 1600, duration: 400, onComplete: () => { t.destroy(); bg.destroy(); } });
}
