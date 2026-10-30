import Phaser from 'phaser';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/400.css';
import { SCREEN } from './game/constants';
import { Level11Scene } from './render/Level11Scene';

// Wait for the bundled font so Phaser text doesn't render in a fallback face.
async function boot(): Promise<void> {
  await Promise.all([document.fonts.load('400 20px Fredoka'), document.fonts.load('600 20px Fredoka')]);
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: SCREEN.width,
    height: SCREEN.height,
    backgroundColor: '#1b0f10',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [Level11Scene],
  });
}

void boot();
