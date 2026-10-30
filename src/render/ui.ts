import Phaser from 'phaser';
import { CREAM, FONT, INK, MONO, MUTED, SKY, css } from '../config/palette';

// UI kit from the board: thin, quiet, out of the way. Hit targets are at least 44pt.

type Scene = Phaser.Scene;

export interface TextOpts {
  size: number;
  weight?: 400 | 500 | 600 | 700;
  color?: number;
  mono?: boolean;
  spacing?: number; // letter spacing in em
  align?: 'left' | 'center' | 'right';
}

export function label(scene: Scene, x: number, y: number, text: string, o: TextOpts): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: o.mono ? MONO : FONT,
    fontSize: `${o.size}px`,
    fontStyle: String(o.weight ?? (o.mono ? 400 : 500)),
    color: css(o.color ?? CREAM),
    align: o.align ?? 'left',
  });
  if (o.spacing) t.setLetterSpacing(o.spacing * o.size);
  return t;
}

export interface ButtonOpts {
  kind: 'primary' | 'secondary';
  w?: number;
  h?: number;
  size?: number;
  ink?: number; // the colour the button is drawn in; cream on dark screens, ink on light ones
  paper?: number; // text colour on a filled button
  outlineAlpha?: number;
  onTap: () => void;
}

// Pill button. Primary is filled; Secondary is a thin outline.
// Containers report no size here: Phaser offsets a sized container's hit area by half its size,
// so hit areas are explicit rectangles in container space and the width travels as `span`.
// (Not `w`: that's Phaser's fourth position coordinate, and setPosition(x, y) resets it to 0.)
export type Widget = Phaser.GameObjects.Container & { span: number };

export function button(scene: Scene, x: number, y: number, text: string, o: ButtonOpts): Widget {
  const h = o.h ?? 52;
  const size = o.size ?? 19;
  const ink = o.ink ?? CREAM;
  const paper = o.paper ?? INK;
  const primary = o.kind === 'primary';
  const t = label(scene, 0, 0, text, { size, weight: primary ? 600 : 500, color: primary ? paper : ink }).setOrigin(0.5);
  const w = o.w ?? Math.ceil(t.width + (primary ? 52 : 44));
  const g = scene.add.graphics();
  if (primary) g.fillStyle(ink, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  else g.lineStyle(1.5, ink, o.outlineAlpha ?? 0.6).strokeRoundedRect(-w / 2 + 0.75, -h / 2 + 0.75, w - 1.5, h - 1.5, h / 2 - 0.75);
  const c = scene.add.container(x + w / 2, y + h / 2, [g, t]);
  tappable(scene, c, w, Math.max(44, h), o.onTap);
  return Object.assign(c, { span: w });
}

export function tappable(scene: Scene, c: Phaser.GameObjects.Container, w: number, h: number, onTap: () => void): void {
  c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  c.on('pointerdown', () => c.setScale(0.97));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    onTap();
  });
  void scene;
}

export type Glyph = 'pause' | 'back';

// 44pt circle button: pause (two bars) or back (‹).
export function iconButton(scene: Scene, cx: number, cy: number, glyph: Glyph, o: { ink?: number; fill?: number; fillAlpha?: number; outlineAlpha?: number; onTap: () => void }): Phaser.GameObjects.Container {
  const ink = o.ink ?? CREAM;
  const g = scene.add.graphics();
  if (o.fill !== undefined) g.fillStyle(o.fill, o.fillAlpha ?? 0.35).fillCircle(0, 0, 22);
  g.lineStyle(1.5, ink, o.outlineAlpha ?? 0.7).strokeCircle(0, 0, 21.25);
  const items: Phaser.GameObjects.GameObject[] = [g];
  if (glyph === 'pause') {
    g.fillStyle(ink, 1).fillRoundedRect(-6.5, -7, 4, 14, 2).fillRoundedRect(2.5, -7, 4, 14, 2);
  } else {
    items.push(label(scene, -1, -1, '‹', { size: 22, weight: 500, color: ink }).setOrigin(0.5));
  }
  const c = scene.add.container(cx, cy, items);
  tappable(scene, c, 48, 48, o.onTap);
  return c;
}

// Toggle from the Pause frame: a 40x24 track, gold and ink when on, faint and muted when off.
export function toggle(scene: Scene, x: number, y: number, text: string, value: boolean, onChange: (v: boolean) => void): Widget {
  const t = label(scene, 0, 0, text, { size: 16, weight: 400, color: MUTED }).setOrigin(0, 0.5);
  const g = scene.add.graphics();
  const trackX = t.width + 10;
  let on = value;
  const draw = () => {
    g.clear();
    if (on) {
      g.fillStyle(SKY, 1).fillRoundedRect(trackX, -12, 40, 24, 12);
      g.fillStyle(INK, 1).fillCircle(trackX + 40 - 12, 0, 9);
    } else {
      g.fillStyle(CREAM, 0.2).fillRoundedRect(trackX, -12, 40, 24, 12);
      g.fillStyle(MUTED, 1).fillCircle(trackX + 12, 0, 9);
    }
  };
  draw();
  const w = trackX + 40;
  const c = scene.add.container(x, y, [t, g]);
  c.setInteractive(new Phaser.Geom.Rectangle(0, -22, w, 44), Phaser.Geom.Rectangle.Contains);
  c.on('pointerup', () => {
    on = !on;
    draw();
    onChange(on);
  });
  return Object.assign(c, { span: w });
}

// Three seed dots: filled gold with an ink ring when found, an empty ring otherwise.
export function seedDots(g: Phaser.GameObjects.Graphics, x: number, cy: number, got: boolean[], o: { size?: number; gap?: number; ring?: number; ink?: number; emptyAlpha?: number; fill?: number } = {}): number {
  const size = o.size ?? 14;
  const gap = o.gap ?? 6;
  const ring = o.ring ?? 2.5;
  const ink = o.ink ?? INK;
  got.forEach((have, i) => {
    const cx = x + i * (size + gap) + size / 2;
    if (have) {
      g.fillStyle(o.fill ?? SKY, 1).fillCircle(cx, cy, size / 2);
      if (ring) g.lineStyle(ring, ink, 1).strokeCircle(cx, cy, size / 2);
    } else {
      g.lineStyle(ring || 2.5, ink, o.emptyAlpha ?? 1).strokeCircle(cx, cy, size / 2 - (ring || 2.5) / 2);
    }
  });
  return got.length * size + (got.length - 1) * gap;
}

// Scene change with a short fade, so screens feel continuous.
export function go(scene: Scene, key: string, data?: object): void {
  scene.input.enabled = false; // no double taps during the fade
  scene.cameras.main.fadeOut(180, 27, 15, 16);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    scene.input.enabled = true; // the flag survives a restart, so turn it back on
    scene.scene.start(key, data);
  });
}
