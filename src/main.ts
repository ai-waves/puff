import Phaser from 'phaser';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import { SCREEN } from './config/constants';
import { loadBox2D } from './game/physics';
import { loadSave } from './platform/storage';
import { ClearScene } from './scenes/ClearScene';
import { MapScene } from './scenes/MapScene';
import { PlayScene } from './scenes/PlayScene';
import { TitleScene } from './scenes/TitleScene';
import { WorldScene } from './scenes/WorldScene';
import { services } from './services';

// Wait for the bundled fonts, saved progress and the Box2D physics engine, then start at the title.
async function boot(): Promise<void> {
  const fonts = ['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 20px Fredoka`));
  fonts.push(document.fonts.load('400 12px "JetBrains Mono"'));
  const [save] = await Promise.all([loadSave(), loadBox2D(), ...fonts]);
  services.save = save;
  services.applySettings();
  const scenes: Phaser.Types.Scenes.SceneType[] = [TitleScene, WorldScene, MapScene, PlayScene, ClearScene];
  // Dev builds add the level editor; production builds leave it out entirely. /?edit=1-2 opens it.
  if (import.meta.env.DEV) {
    const { EditorScene } = await import('./editor/EditorScene');
    if (new URLSearchParams(location.search).has('edit')) scenes.unshift(EditorScene);
    else scenes.push(EditorScene);
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: SCREEN.width,
    height: SCREEN.height,
    backgroundColor: '#1b0f10',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    input: { activePointers: 2 },
    scene: scenes,
  });
  // Dev builds expose the game and sim so headless smoke tests can drive every screen.
  if (import.meta.env.DEV) {
    const sim = await import('./game/sim');
    Object.assign(window, { __game: game, __sim: sim });
  }
}

void boot();
