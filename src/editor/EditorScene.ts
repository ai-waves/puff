import Phaser from 'phaser';
import './editor.css';
import { PLAYFIELD, PUFF_RADIUS, PUFF_SCREEN_X, SCREEN } from '../config/constants';
import { CREAM, GLOW, SKY } from '../config/palette';
import { tuning } from '../config/tuning';
import { formatLevel, parseLevel } from '../game/levels/format';
import { LEVELS, levelById, replaceLevel } from '../game/levels/index';
import { lintLevel, type Lint } from '../game/levels/lint';
import { SCHEMA, validateLevel, type Collection } from '../game/levels/schema';
import { arrivalTime, camAtTime, placeAtTime, poseSim, seedPosition, seesawEnds, type SimView } from '../game/sim';
import type { LevelDef } from '../game/types';
import { drawPuff } from '../render/art';
import { DEPTH, LevelView } from '../render/levelView';
import { go, label } from '../render/ui';
import { EditorModel, type Item, type Selection } from './model';
import { EditorPanel, type PanelHost } from './panel';
import { bounds, dragHandle, dragMarker, handles, hits, markerHit, markers, move, PICK_ORDER, type Box, type Handle } from './shapes';

// The level editor (dev builds only): the level drawn exactly as the game draws it, at any moment
// of a run, with every object draggable and every number in a form beside it.

export interface EditorData {
  levelId?: string;
  t?: number; // seconds into a run to show
}

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
const SELECT = 0x7fd4ff;
const ERROR = 0xff8a7a;
const WARN = 0xf2c386;
const HANDLE = 4; // half a handle's size, pt
const DRAFT = 'hollowdrift-editor-draft:';

// One editing session per level while the page is open: a test flight, or a look at another
// level, keeps your unsaved changes and undo history. Unsaved changes also survive a reload.
const sessions = new Map<string, EditorModel>();
const prefs = { snap: 5, routes: false, ghostY: 190 };

// While something is dragged the view holds still (cam), even when the drag moves what the view
// follows: the start, or the end of the level.
type Drag =
  | { kind: 'move'; sel: Selection; orig: Item; x: number; y: number; cam: number }
  | { kind: 'handle'; sel: Selection; orig: Item; key: string; cam: number }
  | { kind: 'marker'; key: string; orig: LevelDef; x: number; y: number; cam: number }
  | { kind: 'ghost' }
  | { kind: 'pan'; px: number; t: number };

export class EditorScene extends Phaser.Scene {
  private editor: Editor | null = null;

  constructor() {
    super('editor');
  }

  create(data: EditorData): void {
    this.cameras.main.fadeIn(160, 27, 15, 16);
    this.editor = new Editor(this, data);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.editor?.destroy();
      this.editor = null;
    });
  }

  update(_time: number, delta: number): void {
    this.editor?.update(Math.min(delta / 1000, 0.1));
  }
}

class Editor implements PanelHost {
  model: EditorModel;
  lints: Lint[] = [];
  pose: SimView;
  t: number;
  playing = false;
  pointer: { x: number; y: number } | null = null;
  private view: LevelView;
  private overlay: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  private textsUsed = 0;
  private panel: EditorPanel;
  private drag: Drag | null = null;
  private hover: { sel?: Selection; handle?: Handle } = {};
  private panelDue = true;
  private clockDue = true;
  private restoredDraft = false;
  private onKey = (e: KeyboardEvent) => this.key(e);

  constructor(private scene: Phaser.Scene, data: EditorData) {
    const id = data.levelId ?? new URLSearchParams(location.search).get('edit') ?? LEVELS[0]!.id;
    const file = levelById(id) ?? LEVELS[0]!;
    this.model = sessions.get(file.id) ?? this.openSession(file);
    sessions.set(file.id, this.model);
    this.t = Math.min(Math.max(0, data.t ?? 0), this.tMax);
    this.pose = poseSim(this.model.def, this.t);
    this.lints = lintLevel(this.model.def);
    history.replaceState(null, '', `?edit=${file.id}`);

    this.view = new LevelView(scene, this.model.def);
    this.overlay = scene.add.graphics().setDepth(DEPTH.overlay);
    this.panel = new EditorPanel(this);
    refit(scene);

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => this.moveTo(p));
    scene.input.on('pointerup', () => this.up());
    scene.input.on('pointerupoutside', () => this.up());
    scene.input.on('gameout', () => {
      this.pointer = null;
      this.clockDue = true;
    });
    scene.input.on('wheel', (_p: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number) => {
      this.setTime(this.t + (Math.abs(dx) > Math.abs(dy) ? dx : dy) / this.speed);
    });
    window.addEventListener('keydown', this.onKey);
    if (this.restoredDraft) this.panel.toast(`Picked up your unsaved changes to ${file.id} from last time. Revert throws them away.`);
  }

  // A fresh session from the level file, picking up a draft left from before a reload.
  private openSession(file: LevelDef): EditorModel {
    const model = new EditorModel(file);
    try {
      const raw = localStorage.getItem(DRAFT + file.id);
      const draft = raw ? (JSON.parse(raw) as { base: string; def: LevelDef }) : null;
      // Only a draft of this very file: if the file changed since, the draft is stale.
      if (draft && draft.base === model.saved && formatLevel(draft.def) !== model.saved) {
        model.change(() => {
          model.def = draft.def;
        });
        this.restoredDraft = true;
      }
    } catch {
      // No storage, or a draft that doesn't read: start from the file.
    }
    return model;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey);
    this.panel.destroy();
    refit(this.scene);
  }

  get snap(): number {
    return prefs.snap;
  }

  get showRoutes(): boolean {
    return prefs.routes;
  }

  get camX(): number {
    if (this.drag && 'cam' in this.drag) return this.drag.cam;
    return camAtTime(this.model.def, this.t);
  }

  get tMax(): number {
    return Math.max(1, arrivalTime(this.model.def, this.model.def.burrowX) + 1);
  }

  private get speed(): number {
    return tuning(this.model.def.n).speed;
  }

  // ---------- Frame ----------

  update(dt: number): void {
    if (this.playing) {
      this.t = Math.min(this.tMax, this.t + dt);
      if (this.t >= this.tMax) this.playing = false;
      this.clockDue = true;
    }
    const def = this.model.def;
    this.pose = poseSim(def, this.t);
    this.view.setLevel(def);
    this.view.draw(this.pose, this.camX, this.scene.time.now / 1000);
    this.drawOverlay();
    if (this.panelDue) {
      this.panelDue = false;
      this.clockDue = false;
      this.panel.refresh();
    } else if (this.clockDue) {
      this.clockDue = false;
      this.panel.clock();
    }
  }

  // The level changed: recheck it, keep a draft, and redraw the panel on the next frame.
  edited(): void {
    this.changed();
    if (!this.drag) this.t = Math.min(this.t, this.tMax);
    this.keepDraft();
  }

  // Mid-drag: recheck, but leave the draft until the drag ends.
  private changed(): void {
    this.lints = lintLevel(this.model.def);
    this.panelDue = true;
  }

  private keepDraft(): void {
    try {
      const key = DRAFT + this.model.def.id;
      if (this.model.dirty) localStorage.setItem(key, JSON.stringify({ base: this.model.saved, def: this.model.def }));
      else localStorage.removeItem(key);
    } catch {
      // Drafts are a convenience; without storage they just don't survive a reload.
    }
  }

  // ---------- Panel actions ----------

  setTime(t: number): void {
    this.t = Math.min(Math.max(0, t), this.tMax);
    this.clockDue = true;
  }

  togglePlay(): void {
    if (!this.playing && this.t >= this.tMax - 0.01) this.t = 0;
    this.playing = !this.playing;
    this.clockDue = true;
  }

  select(sel: Selection | null, reveal = false): void {
    this.model.selection = sel && this.model.item(sel) ? sel : null;
    this.panelDue = true;
    if (!reveal || !sel) return;
    const item = this.model.item(sel);
    if (!item) return;
    // Bring it on screen: the clock moves to when a Puff keeping its place has it ahead.
    const b = bounds(sel.c, item, this.pose, sel.i);
    if (b.x1 < this.camX + 40 || b.x0 > this.camX + SCREEN.width - 40) this.setTime(arrivalTime(this.model.def, (b.x0 + b.x1) / 2 - SCREEN.width / 2 + PUFF_SCREEN_X));
  }

  add(c: Collection): void {
    const x = this.camX + SCREEN.width / 2;
    this.model.change(() => this.model.add(c, this.snapTo(x), 200));
    this.edited();
    this.panel.toast(`Added a ${SCHEMA[c].label.toLowerCase()} in the middle of the view.`);
  }

  duplicate(): void {
    if (!this.model.selection) return;
    this.model.change(() => this.model.duplicate());
    this.edited();
  }

  remove(): void {
    const sel = this.model.selection;
    if (!sel) return;
    this.model.change(() => this.model.remove(sel));
    this.edited();
  }

  undo(): void {
    if (this.model.undo()) this.edited();
  }

  redo(): void {
    if (this.model.redo()) this.edited();
  }

  setSnap(n: number): void {
    prefs.snap = n;
  }

  toggleRoutes(): void {
    prefs.routes = !prefs.routes;
    this.panelDue = true;
  }

  async save(): Promise<void> {
    commitTyping();
    const def = this.model.def;
    const errors = validateLevel(def);
    if (errors.length) {
      this.panel.toast(`Can't save yet: ${errors[0]}${errors.length > 1 ? ` (and ${errors.length - 1} more)` : ''}.`, true);
      return;
    }
    const text = formatLevel(def);
    try {
      const res = await fetch('/__editor/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: def.id, text }),
      });
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
    } catch (err) {
      this.panel.toast(`Couldn't save: ${(err as Error).message}`, true);
      return;
    }
    this.model.markSaved(text);
    replaceLevel(parseLevel(JSON.parse(text))); // play picks it up without a reload
    this.edited();
    this.panel.toast(`Saved src/game/levels/data/${def.id}.json`);
  }

  revert(): void {
    const file = levelById(this.model.def.id);
    if (!file || !this.model.dirty) return;
    this.model.revert(file);
    this.edited();
    this.panel.toast('Back to the saved file. Undo brings your changes back.');
  }

  testFlight(): void {
    commitTyping();
    const def = this.model.def;
    const errors = validateLevel(def);
    if (errors.length) {
      this.panel.toast(`Fix this first: ${errors[0]}.`, true);
      return;
    }
    this.playing = false;
    go(this.scene, 'play', { levelId: def.id, test: { def: structuredClone(def), x: placeAtTime(def, this.t), y: prefs.ghostY, t: this.t } });
  }

  openLevel(id: string): void {
    if (id === this.model.def.id) return;
    commitTyping();
    this.scene.scene.restart({ levelId: id, t: 0 });
  }

  exit(): void {
    commitTyping();
    history.replaceState(null, '', location.pathname);
    go(this.scene, 'map', { world: this.model.def.world });
  }

  // ---------- Pointer ----------

  private world(p: Phaser.Input.Pointer): { x: number; y: number } {
    return { x: this.camX + p.x, y: p.y };
  }

  private snapTo(v: number, free = false): number {
    const s = free ? 1 : prefs.snap;
    return Math.round(v / s) * s;
  }

  private down(p: Phaser.Input.Pointer): void {
    commitTyping();
    const { x, y } = this.world(p);
    const m = this.model;
    const sel = m.selection;
    const item = m.item();
    // A handle of the selected object, a level marker, the ghost Puff, an object, or nothing.
    if (sel && item) {
      const h = handles(sel.c, item, this.pose, sel.i).find((hd) => near(hd, x, y));
      if (h) {
        m.begin();
        this.drag = { kind: 'handle', sel, orig: structuredClone(item), key: h.key, cam: this.camX };
        return;
      }
    }
    const mk = markers(m.def).find((mm) => markerHit(mm, x, y));
    if (mk) {
      m.begin();
      this.select(null);
      this.drag = { kind: 'marker', key: mk.key, orig: structuredClone(m.def), x, y, cam: this.camX };
      return;
    }
    if (this.ghostAt(x, y)) {
      this.drag = { kind: 'ghost' };
      return;
    }
    const picked = this.pick(x, y);
    if (picked) {
      m.begin();
      this.select(picked);
      this.drag = { kind: 'move', sel: picked, orig: structuredClone(m.item(picked)!), x, y, cam: this.camX };
      return;
    }
    this.select(null);
    this.playing = false;
    this.drag = { kind: 'pan', px: p.x, t: this.t };
  }

  private moveTo(p: Phaser.Input.Pointer): void {
    const { x, y } = this.world(p);
    this.pointer = { x, y };
    this.clockDue = true;
    const e = p.event as MouseEvent | undefined;
    const free = !!e?.altKey;
    const d = this.drag;
    if (!d) {
      this.updateHover(x, y);
      return;
    }
    const m = this.model;
    if (d.kind === 'pan') {
      this.setTime(d.t - (p.x - d.px) / this.speed);
      return;
    }
    if (d.kind === 'ghost') {
      prefs.ghostY = Math.round(Math.min(FLOOR - PUFF_RADIUS, Math.max(ROOF + PUFF_RADIUS, y)));
      return;
    }
    let dx = d.kind === 'handle' ? 0 : this.snapTo(x - d.x, free);
    let dy = d.kind === 'handle' ? 0 : this.snapTo(y - d.y, free);
    if (e?.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (d.kind === 'marker') {
      dragMarker(m.def, d.key, d.orig, dx, dy);
    } else {
      const item = m.item(d.sel);
      if (!item) return;
      if (d.kind === 'move') move(d.sel.c, item, d.orig, dx, dy, this.pose, d.sel.i);
      else dragHandle(d.sel.c, item, d.orig, d.key, this.snapTo(x, free), this.snapTo(y, free));
    }
    this.changed();
  }

  private up(): void {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    if (d.kind === 'pan' || d.kind === 'ghost') return;
    // A moved start moves time zero: keep the view where it was, as far as the clock allows.
    if (d.kind === 'marker') this.t = Math.max(0, arrivalTime(this.model.def, d.cam + PUFF_SCREEN_X));
    // Blooms open in list order: a bloom dragged past another takes its place in the list.
    if (d.kind === 'move' && d.sel.c === 'blooms') this.sortBlooms(d.sel);
    this.model.end();
    this.edited();
  }

  private sortBlooms(sel: Selection): void {
    const list = this.model.list('blooms');
    const moved = list[sel.i];
    list.sort((a, b) => (a.x as number) - (b.x as number));
    this.model.selection = { c: 'blooms', i: list.indexOf(moved!) };
  }

  private pick(x: number, y: number): Selection | null {
    for (const c of PICK_ORDER) {
      const list = this.model.list(c);
      for (let i = list.length - 1; i >= 0; i--) if (hits(c, list[i]!, this.pose, i, x, y)) return { c, i };
    }
    return null;
  }

  private ghostAt(x: number, y: number): boolean {
    return this.t > 0.05 && Math.hypot(x - placeAtTime(this.model.def, this.t), y - prefs.ghostY) <= PUFF_RADIUS + 4;
  }

  private updateHover(x: number, y: number): void {
    const m = this.model;
    const sel = m.selection;
    const item = m.item();
    let cursor = 'grab';
    this.hover = {};
    const handle = sel && item ? handles(sel.c, item, this.pose, sel.i).find((hd) => near(hd, x, y)) : undefined;
    const marker = markers(m.def).find((mm) => markerHit(mm, x, y));
    if (handle) {
      this.hover.handle = handle;
      cursor = handle.cursor;
    } else if (marker) {
      cursor = marker.cursor;
    } else if (this.ghostAt(x, y)) {
      cursor = 'ns-resize';
    } else {
      const picked = this.pick(x, y);
      if (picked) {
        this.hover.sel = picked;
        cursor = 'move';
      }
    }
    this.scene.input.setDefaultCursor(cursor);
  }

  // ---------- Keys ----------

  private key(e: KeyboardEvent): void {
    const typing = isTyping(e.target);
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    // Save, undo and redo work from anywhere, a field being typed in included: its edit is
    // committed first, so undo takes back the whole edit rather than a keystroke.
    if (mod && (k === 's' || k === 'z' || k === 'y')) {
      e.preventDefault();
      commitTyping();
      if (k === 's') void this.save();
      else if (k === 'y' || e.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (typing) return;
    if (mod && k === 'd') {
      e.preventDefault();
      this.duplicate();
    } else if (k === 'delete' || k === 'backspace') {
      e.preventDefault();
      this.remove();
    } else if (k === 'escape') {
      this.select(null);
    } else if (k === 'p' && !mod) {
      this.testFlight();
    } else if (k === ' ') {
      e.preventDefault();
      this.togglePlay();
    } else if (k === 'home') {
      this.setTime(0);
    } else if (k === 'end') {
      this.setTime(this.tMax);
    } else if (k.startsWith('arrow')) {
      e.preventDefault();
      this.nudge(k, e.shiftKey ? 10 : 1);
    }
  }

  private nudge(k: string, step: number): void {
    const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0;
    const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0;
    const sel = this.model.selection;
    const item = this.model.item();
    if (!sel || !item) {
      this.setTime(this.t + (dx * 20) / this.speed);
      return;
    }
    this.model.change(() => move(sel.c, item, structuredClone(item), dx, dy, this.pose, sel.i));
    this.edited();
  }

  // ---------- Overlay ----------

  private drawOverlay(): void {
    const g = this.overlay.clear();
    const def = this.model.def;
    const cam = this.camX;
    this.textsUsed = 0;
    const box = (b: Box, color: number, alpha: number, width = 1.5) => {
      g.lineStyle(width, color, alpha).strokeRect(b.x0 - cam - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4);
    };

    // Ruler along the roof.
    for (let x = Math.ceil(cam / 50) * 50; x < cam + SCREEN.width; x += 50) {
      const big = x % 200 === 0;
      g.fillStyle(CREAM, big ? 0.6 : 0.3).fillRect(x - cam, 0, 1, big ? 8 : 4);
      if (big) this.text(x - cam + 3, 0, String(x), 9, CREAM, 0.6);
    }

    if (prefs.routes) {
      const line = (pts: [number, number][], color: number) => {
        g.lineStyle(1.5, color, 0.7);
        for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1]![0] - cam, pts[i - 1]![1], pts[i]![0] - cam, pts[i]![1]);
        for (const [px, py] of pts) g.fillStyle(color, 0.9).fillCircle(px - cam, py, 2.5);
      };
      if (def.route) line(def.route, CREAM);
      for (const s of def.seeds) if (s.route) line(s.route, SKY);
    }

    // Problems.
    for (const l of this.lints) {
      if (!l.c || l.i === undefined) continue;
      const item = this.model.list(l.c)[l.i];
      if (item) box(bounds(l.c, item, this.pose, l.i), l.level === 'error' ? ERROR : WARN, 0.9);
    }

    // Level markers.
    const lead = PUFF_RADIUS / 30;
    drawPuff(g, def.startX - cam, def.startY, { scale: lead, state: 'drift', sprout: true, blush: true });
    this.text(def.startX - cam, def.startY + PUFF_RADIUS + 4, 'START', 9, CREAM, 0.85, 0.5);
    this.text(def.burrowX - cam, FLOOR + 6, 'BURROW', 9, GLOW, 0.9, 0.5);
    g.fillStyle(ERROR, 0.8).fillRect(def.length - cam - 1, ROOF, 2, FLOOR - ROOF);
    this.text(def.length - cam - 4, ROOF + 4, 'END', 9, ERROR, 0.9, 1);

    // The ghost: a Puff keeping its place, t seconds in. Test flights start from it.
    if (this.t > 0.05) {
      const gx = placeAtTime(def, this.t) - cam;
      g.lineStyle(1, CREAM, 0.25).lineBetween(gx, ROOF, gx, FLOOR);
      drawPuff(g, gx, prefs.ghostY, { scale: lead, state: 'drift', sprout: true, alpha: 0.6 });
      this.text(gx, prefs.ghostY + PUFF_RADIUS + 4, 'P · TEST FROM HERE', 9, CREAM, 0.8, 0.5);
    }

    // Hover, then the selection with its other states and handles.
    const m = this.model;
    if (!this.drag && this.hover.sel) {
      const item = m.item(this.hover.sel);
      if (item) box(bounds(this.hover.sel.c, item, this.pose, this.hover.sel.i), SELECT, 0.45);
    }
    const sel = m.selection;
    const item = m.item();
    if (sel && item) {
      this.drawStates(g, sel, item, cam);
      box(bounds(sel.c, item, this.pose, sel.i), SELECT, 1, 2);
      for (const h of handles(sel.c, item, this.pose, sel.i)) {
        const big = this.hover.handle === h || (this.drag?.kind === 'handle' && this.drag.key === h.key);
        const r = big ? HANDLE + 1.5 : HANDLE;
        g.fillStyle(0xffffff, 1).fillRect(h.x - cam - r, h.y - r, r * 2, r * 2);
        g.lineStyle(1.5, SELECT, 1).strokeRect(h.x - cam - r, h.y - r, r * 2, r * 2);
      }
    }
    for (let i = this.textsUsed; i < this.texts.length; i++) this.texts[i]!.setVisible(false);
  }

  // Where a selected object goes when it moves: the open gate, the lifted curtain, the tipped log,
  // the slammed crusher, the line a riding seed keeps to.
  private drawStates(g: Phaser.GameObjects.Graphics, sel: Selection, item: Item, cam: number): void {
    const faint = (x0: number, y0: number, x1: number, y1: number) => g.lineStyle(1.5, SELECT, 0.55).strokeRect(x0 - cam, y0, x1 - x0, y1 - y0);
    const def = this.model.def;
    switch (sel.c) {
      case 'gates': {
        const x = item.x as number;
        faint(x, ROOF, x + 14, item.openBottom as number);
        this.text(x - cam + 18, (item.openBottom as number) - 6, 'OPEN', 9, SELECT, 0.9);
        break;
      }
      case 'curtains':
        faint(item.x0 as number, ROOF, item.x1 as number, item.openBottom as number);
        this.text((item.x1 as number) - cam + 6, (item.openBottom as number) - 6, 'LIFTED', 9, SELECT, 0.9);
        break;
      case 'seesaws': {
        const sw = def.seesaws[sel.i]!;
        const e = seesawEnds(sw, -(this.pose.s.seesaws[sel.i]?.angle ?? 0));
        g.lineStyle(4, SELECT, 0.4).lineBetween(e.ax - cam, e.ay, e.bx - cam, e.by);
        break;
      }
      case 'crushers': {
        const w = item.width as number;
        const x = item.x as number;
        faint(x - w / 2, ROOF, x + w / 2, FLOOR);
        g.lineStyle(1.5, SELECT, 0.9).lineBetween(x - w / 2 - cam - 6, item.rest as number, x + w / 2 - cam + 6, item.rest as number);
        this.text(x + w / 2 - cam + 8, (item.rest as number) - 6, 'RAISED', 9, SELECT, 0.9);
        break;
      }
      case 'seeds': {
        const p = seedPosition(this.pose, sel.i);
        const s = def.seeds[sel.i]!;
        const anchor = s.ride ? def.seesaws.find((sw) => sw.id === s.ride!.log) : undefined;
        const wheel = s.orbit ? def.wheels.find((w) => w.id === s.orbit!.wheel) : undefined;
        if (anchor) g.lineStyle(1, SELECT, 0.7).lineBetween(anchor.px - cam, anchor.py, p.x - cam, p.y);
        if (wheel) g.lineStyle(1, SELECT, 0.6).strokeCircle(wheel.cx - cam, wheel.cy, s.orbit!.radius);
        break;
      }
      default:
        break;
    }
  }

  // A small mono caption from a reused pool.
  private text(x: number, y: number, s: string, size: number, color: number, alpha: number, originX = 0): void {
    let t = this.texts[this.textsUsed];
    if (!t) {
      t = label(this.scene, 0, 0, '', { size, mono: true, spacing: 0.08 }).setDepth(DEPTH.hud);
      this.texts.push(t);
    }
    this.textsUsed++;
    t.setVisible(true).setText(s).setPosition(x, y).setOrigin(originX, 0).setAlpha(alpha).setColor(`#${color.toString(16).padStart(6, '0')}`).setFontSize(size);
  }
}

// The canvas moved into or out of the editor's layout: fit it to its new box now. (Phaser's own
// check would, half a second later, but a refresh before it reads the new box gets stuck.)
function refit(scene: Phaser.Scene): void {
  requestAnimationFrame(() => {
    scene.scale.getParentBounds();
    scene.scale.refresh();
  });
}

function near(h: Handle, x: number, y: number): boolean {
  return Math.abs(h.x - x) <= HANDLE + 3 && Math.abs(h.y - y) <= HANDLE + 3;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

// Leaving a field commits what's typed in it.
function commitTyping(): void {
  const el = document.activeElement as HTMLElement | null;
  if (el && isTyping(el)) el.blur();
}
