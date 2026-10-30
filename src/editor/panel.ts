import { PLAYFIELD, PUFF_RADIUS, SCREEN } from '../config/constants';
import { CREAM, FAR, GLOW, INK, SKY, css } from '../config/palette';
import { LEVELS } from '../game/levels/index';
import type { Lint } from '../game/levels/lint';
import { COLLECTIONS, LEVEL_FIELDS, SCHEMA, getField, setField, type Collection, type Field } from '../game/levels/schema';
import { arrivalTime, crusherState, humpCircle, type SimView } from '../game/sim';
import type { CrusherDef, LevelDef, SeedDef, SeesawDef } from '../game/types';
import type { EditorModel, Item, Selection } from './model';
import { bounds } from './shapes';

// The editor's HTML around the game canvas: the toolbar, the side panel with the selected
// object's fields, its timing and the level's problems, and the strip with the minimap and clock.

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
const LATE = 0.25; // s a Puff keeping its place should arrive after a crusher has lifted

export interface PanelHost {
  readonly model: EditorModel;
  readonly lints: Lint[];
  readonly pose: SimView;
  readonly t: number;
  readonly tMax: number;
  readonly camX: number;
  readonly playing: boolean;
  readonly snap: number;
  readonly showRoutes: boolean;
  readonly pointer: { x: number; y: number } | null;
  setTime(t: number): void;
  togglePlay(): void;
  select(sel: Selection | null, reveal?: boolean): void;
  add(c: Collection): void;
  duplicate(): void;
  remove(): void;
  undo(): void;
  redo(): void;
  save(): void;
  revert(): void;
  testFlight(): void;
  openLevel(id: string): void;
  exit(): void;
  setSnap(n: number): void;
  toggleRoutes(): void;
  edited(): void; // the panel changed the level
}

type Control = { sync(): void; focused(): boolean };

export class EditorPanel {
  private bar: HTMLElement;
  private strip: HTMLElement;
  private side: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  private levelSelect!: HTMLSelectElement;
  private undoBtn!: HTMLButtonElement;
  private redoBtn!: HTMLButtonElement;
  private revertBtn!: HTMLButtonElement;
  private routesBtn!: HTMLButtonElement;
  private status!: HTMLElement;
  private readout!: HTMLElement;
  private minimap!: HTMLCanvasElement;
  private range!: HTMLInputElement;
  private playBtn!: HTMLButtonElement;
  private clockText!: HTMLElement;
  private form!: HTMLElement;
  private timing!: HTMLElement;
  private problems!: HTMLElement;
  private formKey = '';
  private controls: Control[] = [];
  private timingDraw: (() => void) | null = null;

  constructor(private host: PanelHost) {
    document.body.classList.add('editing');
    this.bar = el('div', { class: 'ed-bar' });
    this.strip = el('div', { class: 'ed-strip' });
    this.side = el('div', { class: 'ed-side' });
    this.toastEl = el('div', { class: 'ed-toast' });
    this.buildBar();
    this.buildStrip();
    this.buildSide();
    document.body.append(this.bar, this.strip, this.side, this.toastEl);
  }

  destroy(): void {
    for (const e of [this.bar, this.strip, this.side, this.toastEl]) e.remove();
    document.body.classList.remove('editing');
    window.clearTimeout(this.toastTimer);
  }

  toast(message: string, bad = false): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.toggle('bad', bad);
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), bad ? 4200 : 2600);
  }

  // Everything that depends on the level. Fields being typed in keep what's typed.
  refresh(rebuildForm = false): void {
    const m = this.host.model;
    this.levelSelect.value = m.def.id;
    this.undoBtn.disabled = !m.canUndo;
    this.redoBtn.disabled = !m.canRedo;
    const dirty = m.dirty;
    this.revertBtn.disabled = !dirty;
    this.status.textContent = dirty ? 'Unsaved' : 'Saved';
    this.status.classList.toggle('dirty', dirty);
    this.routesBtn.classList.toggle('ed-on', this.host.showRoutes);
    if (rebuildForm || this.keyOf() !== this.formKey) this.buildForm();
    else for (const c of this.controls) if (!c.focused()) c.sync();
    this.buildProblems();
    this.clock();
  }

  // The parts that follow the clock and the pointer.
  clock(): void {
    const h = this.host;
    this.range.max = String(Math.max(0.01, h.tMax));
    if (document.activeElement !== this.range) this.range.value = String(h.t);
    this.playBtn.textContent = h.playing ? '❚❚' : '▶';
    this.clockText.textContent = `${h.t.toFixed(2)} s · scroll x ${Math.round(h.camX)}`;
    this.readout.textContent = h.pointer ? `x ${Math.round(h.pointer.x)}  y ${Math.round(h.pointer.y)}` : '';
    this.drawMinimap();
    this.timingDraw?.();
  }

  // ---------- Toolbar ----------

  private buildBar(): void {
    const h = this.host;
    this.levelSelect = el('select', { title: 'Level' }) as HTMLSelectElement;
    for (const l of LEVELS) this.levelSelect.append(new Option(`${l.id} · ${l.name}`, l.id));
    this.levelSelect.addEventListener('change', () => h.openLevel(this.levelSelect.value));

    const add = el('select', { class: 'ed-add', title: 'Add an object in the middle of the view' }) as HTMLSelectElement;
    add.append(new Option('＋ Add…', ''));
    for (const c of COLLECTIONS) add.append(new Option(SCHEMA[c].label, c));
    add.addEventListener('change', () => {
      if (add.value) h.add(add.value as Collection);
      add.value = '';
      add.blur();
    });

    this.undoBtn = button('Undo', () => h.undo());
    this.undoBtn.title = 'Undo (Ctrl+Z)';
    this.redoBtn = button('Redo', () => h.redo());
    this.redoBtn.title = 'Redo (Ctrl+Shift+Z)';
    const snap = el('select', { title: 'Snap positions to a grid. Hold Alt while dragging to place freely.' }) as HTMLSelectElement;
    for (const n of [1, 5, 10, 20]) snap.append(new Option(n === 1 ? 'Snap off' : `Snap ${n}`, String(n)));
    snap.value = String(h.snap);
    snap.addEventListener('change', () => h.setSnap(Number(snap.value)));
    this.routesBtn = button('Solver lines', () => h.toggleRoutes());
    this.routesBtn.title = 'Show the routes the level tests search along';
    this.readout = el('span', { class: 'ed-readout ed-pointer' });
    this.status = el('span', { class: 'ed-status' });
    this.revertBtn = button('Revert', () => h.revert());
    this.revertBtn.title = 'Throw away changes since the last save';
    const test = button('Test flight', () => h.testFlight());
    test.title = 'Fly from the ghost Puff, with the clock where it is (P). Esc comes back here.';
    const save = button('Save', () => h.save());
    save.title = 'Write the level file (Ctrl+S)';
    save.classList.add('ed-primary');
    const exit = button('Exit', () => h.exit());

    this.bar.append(
      group(this.levelSelect, add),
      sep(),
      group(this.undoBtn, this.redoBtn),
      sep(),
      group(snap, this.routesBtn),
      el('span', { class: 'ed-grow' }),
      this.status,
      group(this.revertBtn, test, save, exit),
    );
  }

  // ---------- Strip: minimap and clock ----------

  private buildStrip(): void {
    const h = this.host;
    this.minimap = el('canvas', { class: 'ed-minimap', title: 'The whole level. Click or drag to go there.' }) as HTMLCanvasElement;
    const jump = (e: PointerEvent) => {
      const r = this.minimap.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * h.model.def.length;
      // Centre the view there: the clock is wherever a Puff keeping its place sees it centred.
      h.setTime(Math.max(0, arrivalTime(h.model.def, x - SCREEN.width / 2 + 280)));
    };
    this.minimap.addEventListener('pointerdown', (e) => {
      this.minimap.setPointerCapture(e.pointerId);
      jump(e);
    });
    this.minimap.addEventListener('pointermove', (e) => {
      if (this.minimap.hasPointerCapture(e.pointerId)) jump(e);
    });

    this.playBtn = button('▶', () => h.togglePlay());
    this.playBtn.title = 'Play the clock (Space)';
    this.range = el('input', { type: 'range', min: '0', step: '0.01', title: 'Seconds into a run' }) as HTMLInputElement;
    this.range.addEventListener('input', () => h.setTime(Number(this.range.value)));
    this.clockText = el('span', { class: 'ed-readout' });
    this.strip.append(this.minimap, group(this.playBtn, this.range, this.readout, this.clockText));
    this.strip.lastElementChild!.classList.add('ed-clock');
  }

  private drawMinimap(): void {
    const cv = this.minimap;
    const w = cv.clientWidth;
    const hgt = cv.clientHeight;
    if (!w || !hgt) return;
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hgt * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hgt * dpr);
    }
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const h = this.host;
    const def = h.model.def;
    const sx = w / def.length;
    const sy = hgt / SCREEN.height;
    const X = (x: number) => x * sx;
    const Y = (y: number) => y * sy;

    const sky = ctx.createLinearGradient(0, 0, 0, hgt);
    for (const [at, c] of def.sky) sky.addColorStop(Math.min(1, Math.max(0, at)), css(c));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hgt);
    ctx.fillStyle = css(INK);
    ctx.fillRect(0, 0, w, Y(ROOF));
    ctx.fillRect(0, Y(FLOOR), w, hgt - Y(FLOOR));

    for (const r of def.rects) ctx.fillRect(X(r.x0), Y(r.y0), Math.max(1, X(r.x1) - X(r.x0)), Y(r.y1) - Y(r.y0));
    for (const m of def.humps) {
      const c = humpCircle(m.width, m.height);
      ctx.beginPath();
      ctx.ellipse(X(m.cx), Y(c.cy), c.r * sx, c.r * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const b of def.briars) {
      const tall = Math.max(...b.spikes);
      const y0 = b.side === 'up' ? b.base - tall : b.base;
      ctx.fillRect(X(b.x0), Y(y0), Math.max(1, (b.width ?? 20) * b.spikes.length * sx), tall * sy);
    }
    for (const c of def.curtains) ctx.fillRect(X(c.x0), Y(ROOF), Math.max(1, X(c.x1) - X(c.x0)), Y(c.closedBottom) - Y(ROOF));
    for (const g of def.gates) ctx.fillRect(X(g.x), Y(ROOF), 1.5, Y(FLOOR) - Y(ROOF));
    for (const c of def.crushers) ctx.fillRect(X(c.x - c.width / 2), Y(ROOF), Math.max(1.5, c.width * sx), Y(c.rest) - Y(ROOF));
    ctx.strokeStyle = css(INK);
    ctx.lineWidth = 2;
    for (const sw of def.seesaws) {
      ctx.beginPath();
      ctx.moveTo(X(sw.px - sw.half), Y(sw.py));
      ctx.lineTo(X(sw.px + sw.half), Y(sw.py));
      ctx.stroke();
    }
    for (const wh of def.wheels) {
      ctx.beginPath();
      ctx.ellipse(X(wh.cx), Y(wh.cy), Math.max(1.5, wh.r * sx), wh.r * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const dot = (x: number, y: number, r: number, color: number) => {
      ctx.fillStyle = css(color);
      ctx.beginPath();
      ctx.arc(X(x), Y(y), r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const p of def.pebbles) dot(p.x, p.y, 1.5, INK);
    def.seeds.forEach((s) => dot(s.x, s.y, 2, SKY));
    for (const b of def.blooms) dot(b.x, FLOOR - 64, 2.5, GLOW);
    dot(def.startX, def.startY, 3, CREAM);
    dot(def.burrowX, FLOOR - 30, 3.5, GLOW);
    ctx.fillStyle = css(FAR);
    ctx.fillRect(X(def.length) - 2, 0, 2, hgt);

    // Problems along the top edge.
    for (const l of h.lints) {
      if (!l.c || l.i === undefined) continue;
      const item = h.model.list(l.c)[l.i];
      if (!item) continue;
      const b = safeBounds(l.c, item, h.pose, l.i);
      if (!b) continue;
      ctx.fillStyle = l.level === 'error' ? '#ff8a7a' : '#f2c386';
      ctx.fillRect(X(b.x0) - 1, 0, Math.max(3, X(b.x1) - X(b.x0)), 4);
    }

    // The selection, then the view.
    const sel = h.model.selection;
    const item = h.model.item();
    if (sel && item) {
      const b = safeBounds(sel.c, item, h.pose, sel.i);
      if (b) {
        ctx.strokeStyle = '#7fd4ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(X(b.x0) - 2, Y(b.y0) - 2, Math.max(4, X(b.x1) - X(b.x0) + 4), Y(b.y1) - Y(b.y0) + 4);
      }
    }
    ctx.fillStyle = 'rgba(27, 15, 16, 0.35)';
    ctx.fillRect(0, 0, X(h.camX), hgt);
    ctx.fillRect(X(h.camX + SCREEN.width), 0, w, hgt);
    ctx.strokeStyle = 'rgba(246, 235, 213, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(X(h.camX) + 0.75, 0.75, SCREEN.width * sx - 1.5, hgt - 1.5);
  }

  // ---------- Side panel ----------

  private buildSide(): void {
    this.form = el('div');
    this.timing = el('div', { class: 'ed-section ed-timing' });
    this.problems = el('div', { class: 'ed-problems-box' });
    const keys = el('details', { class: 'ed-section' });
    keys.append(el('summary', {}, 'Mouse and keys'));
    const list = el('div', { class: 'ed-keys' });
    for (const [k, v] of [
      ['Drag', 'move what you grab; drag empty space to scroll'],
      ['Handles', 'resize, re-aim, set heights'],
      ['Alt + drag', 'place freely, without the snap'],
      ['Shift + drag', 'keep to one axis'],
      ['Wheel', 'scroll the level (and the clock with it)'],
      ['Arrows', 'nudge 1pt, Shift 10pt; with nothing selected, scroll'],
      ['Space', 'play or stop the clock'],
      ['P', 'test flight from the ghost Puff'],
      ['Ctrl+D', 'duplicate'],
      ['Delete', 'delete'],
      ['Ctrl+Z / Ctrl+Shift+Z', 'undo / redo'],
      ['Ctrl+S', 'save to the level file'],
      ['Esc', 'select nothing (the level)'],
    ]) list.append(el('kbd', {}, k!), el('span', {}, v!));
    keys.append(list);
    this.side.append(this.problems, this.form, this.timing, keys);
  }

  private buildForm(): void {
    const h = this.host;
    const m = h.model;
    const sel = m.selection;
    const item = m.item();
    this.formKey = this.keyOf();
    this.controls = [];
    this.form.replaceChildren();
    this.timing.replaceChildren();
    this.timing.hidden = true;
    this.timingDraw = null;

    if (!sel || !item) {
      this.form.append(el('div', { class: 'ed-kicker' }, `Level ${m.def.id} · world ${m.def.world}`), el('div', { class: 'ed-title' }, m.def.name));
      this.form.append(el('p', { class: 'ed-ok' }, 'Click an object to edit it. Drag the start Puff, the burrow and the end line to move them.'));
      this.form.append(this.fields(LEVEL_FIELDS, m.def as unknown as Item, 'level'));
      return;
    }
    const info = SCHEMA[sel.c];
    this.form.append(el('div', { class: 'ed-kicker' }, info.label), el('div', { class: 'ed-title' }, String(item.id ?? item.text ?? `${info.label} ${sel.i + 1}`)));
    const actions = el('div', { class: 'ed-actions' });
    actions.append(button('Duplicate', () => h.duplicate(), 'Ctrl+D'), button('Delete', () => h.remove(), 'Del'), button('Done', () => h.select(null), 'Esc'));
    this.form.append(actions, this.fields(info.fields, item, sel));
    if (sel.c === 'crushers') this.crusherTiming(sel.i);
    if (sel.c === 'seesaws' && (item as unknown as SeesawDef).mode === 'beat') this.beatTiming(sel.i);
  }

  // What the form shows: which object, and its mode, since a beat log gets a timing chart.
  private keyOf(): string {
    const sel = this.host.model.selection;
    const item = this.host.model.item();
    return sel && item ? `${sel.c}:${sel.i}:${String(item.id ?? '')}:${String(item.mode ?? '')}` : 'level';
  }

  private fields(fields: Field[], obj: Item, target: Selection | 'level'): HTMLElement {
    const grid = el('div', { class: 'ed-fields' });
    for (const f of fields) this.field(grid, f, obj, target);
    return grid;
  }

  private field(grid: HTMLElement, f: Field, obj: Item, target: Selection | 'level'): void {
    const h = this.host;
    const m = h.model;
    const id = `ed-f-${f.key.replace(/\W/g, '-')}`;
    const lab = el('label', { for: id }, f.label);
    const hint = el('div', { class: 'ed-hint' }, f.hint ?? '');
    const live = () => (target === 'level' ? (m.def as unknown as Item) : m.item(target)) ?? obj;
    const read = () => getField(live(), f.key);
    const bad = (msg: string | null) => {
      hint.textContent = msg ?? f.hint ?? '';
      hint.classList.toggle('ed-bad', !!msg);
      hint.hidden = !hint.textContent;
    };
    // Apply a value: one undo step per edit, however many keystrokes it takes.
    const apply = (v: unknown, done: boolean) => {
      m.begin();
      const err = this.setValue(target, f, v);
      if (done) m.end();
      bad(err);
      h.edited();
    };

    let input: HTMLElement;
    let sync: () => void;
    const wide = f.kind === 'longtext' || f.kind === 'color-stops';
    switch (f.kind) {
      case 'number':
      case 'int': {
        const inp = el('input', { id, type: 'number', step: f.step !== undefined ? String(f.step) : 'any' }) as HTMLInputElement;
        if (f.min !== undefined) inp.min = String(f.min);
        if (f.max !== undefined) inp.max = String(f.max);
        const parse = (): { v: unknown; ok: boolean } => {
          if (inp.value.trim() === '') return { v: undefined, ok: !!f.optional };
          const n = Number(inp.value);
          return Number.isFinite(n) ? { v: f.kind === 'int' ? Math.round(n) : n, ok: true } : { v: undefined, ok: false };
        };
        inp.addEventListener('input', () => {
          const p = parse();
          inp.classList.toggle('ed-bad', !p.ok);
          if (p.ok) apply(p.v, false);
        });
        inp.addEventListener('change', () => {
          const p = parse();
          if (p.ok) apply(p.v, true);
          else m.end();
          sync();
        });
        sync = () => {
          const v = read();
          inp.value = typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : '';
          inp.placeholder = f.optional ? 'default' : '';
          inp.classList.remove('ed-bad');
        };
        input = inp;
        break;
      }
      case 'text':
      case 'longtext': {
        const inp = (f.kind === 'text' ? el('input', { id, type: 'text' }) : el('textarea', { id, rows: '3' })) as HTMLInputElement;
        // An id is renamed everywhere it's used, so it changes once you're done typing.
        const isId = f.key === 'id';
        const value = () => (inp.value === '' && f.optional ? undefined : inp.value);
        if (!isId) inp.addEventListener('input', () => apply(value(), false));
        inp.addEventListener('change', () => {
          apply(value(), true);
          if (isId) sync();
        });
        sync = () => {
          const v = read();
          inp.value = typeof v === 'string' ? v : '';
        };
        input = inp;
        break;
      }
      case 'bool': {
        const inp = el('input', { id, type: 'checkbox' }) as HTMLInputElement;
        inp.addEventListener('change', () => apply(inp.checked ? true : undefined, true));
        sync = () => {
          inp.checked = read() === true;
        };
        input = el('div', { class: 'ed-check' });
        input.append(inp);
        break;
      }
      case 'select':
      case 'ref': {
        const sel = el('select', { id }) as HTMLSelectElement;
        const fill = () => {
          const v = read();
          const options = f.kind === 'select' ? [...f.options!] : m.list(f.ref!).map((o) => String(o.id));
          sel.replaceChildren();
          if (f.optional || v === undefined) sel.append(new Option(f.kind === 'ref' ? '(none)' : '(default)', ''));
          for (const o of options) sel.append(new Option(o, o));
          if (typeof v === 'string' && !options.includes(v)) sel.append(new Option(`${v} (missing)`, v));
          sel.value = typeof v === 'string' ? v : '';
        };
        sel.addEventListener('focus', fill);
        sel.addEventListener('change', () => apply(sel.value === '' ? undefined : sel.value, true));
        sync = fill;
        input = sel;
        break;
      }
      case 'numbers': {
        const inp = el('input', { id, type: 'text' }) as HTMLInputElement;
        inp.addEventListener('change', () => {
          const parts = inp.value.split(/[\s,]+/).filter(Boolean).map(Number);
          if (!parts.length || parts.some((n) => !Number.isFinite(n))) return bad('Numbers, separated by commas');
          apply(parts, true);
        });
        sync = () => {
          const v = read();
          inp.value = Array.isArray(v) ? v.join(', ') : '';
        };
        input = inp;
        break;
      }
      case 'points': {
        const inp = el('input', { id, type: 'text', placeholder: 'none' }) as HTMLInputElement;
        inp.addEventListener('change', () => {
          if (!inp.value.trim()) return apply(undefined, true);
          const pts = inp.value.split(';').map((p) => p.split(',').map((n) => Number(n.trim())));
          if (pts.some((p) => p.length !== 2 || p.some((n) => !Number.isFinite(n)))) return bad('Points as x,y; x,y; …');
          apply(pts, true);
        });
        sync = () => {
          const v = read() as [number, number][] | undefined;
          inp.value = Array.isArray(v) ? v.map((p) => p.join(',')).join('; ') : '';
        };
        input = inp;
        break;
      }
      case 'color-stops': {
        const box = el('div', { class: 'ed-stops' });
        const stops = () => ((read() as [number, number][] | undefined) ?? []).map((s) => [...s] as [number, number]);
        sync = () => {
          box.replaceChildren();
          stops().forEach(([at, color], k) => {
            const row = el('div', { class: 'ed-stop' });
            const pick = el('input', { type: 'color', value: css(color).toLowerCase() }) as HTMLInputElement;
            const pos = el('input', { type: 'number', step: '0.05', min: '0', max: '1', value: String(at) }) as HTMLInputElement;
            const put = (done: boolean) => {
              const next = stops();
              next[k] = [Number(pos.value) || 0, parseInt(pick.value.slice(1), 16)];
              apply(next, done);
            };
            pick.addEventListener('input', () => put(false));
            pick.addEventListener('change', () => put(true));
            pos.addEventListener('change', () => put(true));
            const del = button('×', () => {
              const next = stops();
              if (next.length <= 2) return bad('A sky needs at least two colours');
              next.splice(k, 1);
              apply(next, true);
              sync();
            });
            row.append(pick, pos, del);
            box.append(row);
          });
          box.append(
            button('＋ Colour', () => {
              const next = stops();
              next.push([1, next[next.length - 1]?.[1] ?? INK]);
              apply(next, true);
              sync();
            }),
          );
        };
        input = box;
        break;
      }
    }
    if (wide) {
      lab.classList.add('ed-wide');
      input.classList.add('ed-wide');
      hint.classList.add('ed-wide');
    }
    grid.append(lab, input, hint);
    sync();
    bad(null);
    this.controls.push({ sync, focused: () => input.contains(document.activeElement) });
  }

  // Set a field from the form. Attaching a seed to a log or a wheel fills in where on it; detaching
  // removes the whole attachment.
  private setValue(target: Selection | 'level', f: Field, v: unknown): string | null {
    const m = this.host.model;
    if (target !== 'level' && target.c === 'seeds' && (f.key === 'ride.log' || f.key === 'orbit.wheel')) {
      const seed = m.item(target) as unknown as SeedDef;
      const group = f.key.split('.')[0]! as 'ride' | 'orbit';
      if (v === undefined) {
        setField(seed, group, undefined);
        return null;
      }
      if (group === 'ride') seed.ride = { log: String(v), at: seed.ride?.at ?? 0.8, lift: seed.ride?.lift ?? 22 };
      else {
        const w = m.def.wheels.find((x) => x.id === v);
        seed.orbit = { wheel: String(v), radius: seed.orbit?.radius ?? Math.round((w?.r ?? 40) + 4) };
      }
      delete seed[group === 'ride' ? 'orbit' : 'ride'];
      return null;
    }
    return m.set(target, f.key, v);
  }

  // ---------- Timing ----------

  // A crusher against a Puff keeping its place: when that Puff is under it, and what the column
  // does around then.
  private crusherTiming(i: number): void {
    const h = this.host;
    const wrap = this.timing;
    wrap.hidden = false;
    const cv = el('canvas') as HTMLCanvasElement;
    const text = el('p');
    const fit = button('Time it for a Puff keeping its place', () => {
      const def = h.model.def;
      const c = def.crushers[i]!;
      const tIn = arrivalTime(def, c.x - c.width / 2 - PUFF_RADIUS);
      h.model.change(() => {
        c.offset = Math.round((liftTime(def, c) + LATE - tIn) * 1000) / 1000;
      });
      h.edited();
    });
    fit.title = `Sets the offset so the column has finished lifting ${LATE}s before that Puff reaches it`;
    wrap.append(el('h3', {}, 'Timing'), cv, text, fit);
    this.timingDraw = () => {
      const def = h.model.def;
      const c = def.crushers[i];
      if (!c) return;
      const tIn = arrivalTime(def, c.x - c.width / 2 - PUFF_RADIUS);
      const tOut = arrivalTime(def, c.x + c.width / 2 + PUFF_RADIUS);
      const mid = (tIn + tOut) / 2;
      const t0 = mid - 2.5;
      const t1 = mid + 2.5;
      const ctx = canvas2d(cv);
      if (!ctx) return;
      const { g, w, h: hgt } = ctx;
      const X = (t: number) => ((t - t0) / (t1 - t0)) * w;
      const Y = (y: number) => (y / SCREEN.height) * hgt;
      // The crusher as the game shows it, one thin slice of time per pixel: sky, roof, floor, column.
      skyFill(g, def, w, hgt);
      g.fillStyle = css(INK);
      g.fillRect(0, 0, w, Y(ROOF));
      g.fillRect(0, Y(FLOOR), w, hgt - Y(FLOOR));
      for (let px = 0; px < w; px++) {
        const st = crusherState(def, c, t0 + (px / w) * (t1 - t0));
        g.fillStyle = st.warn ? '#5b3433' : css(INK);
        g.fillRect(px, 0, 1, Y(c.rest + st.drop * (FLOOR - c.rest)));
      }
      // When a Puff keeping its place is under it, and now.
      g.fillStyle = 'rgba(255, 255, 255, 0.22)';
      g.fillRect(X(tIn), Y(ROOF), X(tOut) - X(tIn), Y(FLOOR) - Y(ROOF));
      g.fillStyle = '#7fd4ff';
      g.fillRect(X(tIn), 0, 1, hgt);
      g.fillRect(X(tOut), 0, 1, hgt);
      if (h.t >= t0 && h.t <= t1) {
        g.fillStyle = css(GLOW);
        g.fillRect(X(h.t) - 1, 0, 2, hgt);
      }
      text.textContent = crusherVerdict(def, c, tIn, tOut);
    };
  }

  // A beat log: which end is up when a Puff keeping its place reaches it.
  private beatTiming(i: number): void {
    const h = this.host;
    const wrap = this.timing;
    wrap.hidden = false;
    const cv = el('canvas') as HTMLCanvasElement;
    const text = el('p');
    wrap.append(el('h3', {}, 'Timing'), cv, text);
    this.timingDraw = () => {
      const def = h.model.def;
      const sw = def.seesaws[i];
      if (!sw) return;
      const beat = sw.beat ?? 1.5;
      const ta = arrivalTime(def, sw.px);
      const t0 = ta - 3;
      const t1 = ta + 3;
      const ctx = canvas2d(cv);
      if (!ctx) return;
      const { g, w, h: hgt } = ctx;
      const X = (t: number) => ((t - t0) / (t1 - t0)) * w;
      const initialLeft = sw.high === 'left';
      // Top band: the left end is up. Bottom band: the right end is.
      skyFill(g, def, w, hgt);
      g.fillStyle = css(INK);
      for (let px = 0; px < w; px++) {
        const t = t0 + (px / w) * (t1 - t0);
        const leftUp = (Math.floor(t / beat) % 2 === 0) === initialLeft;
        g.fillRect(px, leftUp ? 10 : hgt / 2 + 4, 1, hgt / 2 - 14);
      }
      g.fillStyle = '#7fd4ff';
      g.fillRect(X(ta), 0, 1, hgt);
      if (h.t >= t0 && h.t <= t1) {
        g.fillStyle = css(GLOW);
        g.fillRect(X(h.t) - 1, 0, 2, hgt);
      }
      const leftUp = (Math.floor(ta / beat) % 2 === 0) === initialLeft;
      const into = ta - Math.floor(ta / beat) * beat;
      text.textContent = `It swings every ${beat}s. A Puff keeping its place reaches the pivot at ${ta.toFixed(2)}s, ${into.toFixed(2)}s into a beat, with the ${leftUp ? 'left' : 'right'} end up. Top band: left end up; bottom band: right end up.`;
    };
  }

  // ---------- Problems ----------

  private buildProblems(): void {
    const h = this.host;
    const lints = h.lints;
    if (!lints.length) {
      this.problems.replaceChildren(el('p', { class: 'ed-ok' }, '✓ No problems: this level passes every design check the tests run.'));
      return;
    }
    const errors = lints.filter((l) => l.level === 'error').length;
    const head = [errors && `${errors} error${errors > 1 ? 's' : ''}`, lints.length - errors && `${lints.length - errors} warning${lints.length - errors > 1 ? 's' : ''}`].filter(Boolean).join(', ');
    const ul = el('ul', { class: 'ed-problems' });
    for (const l of lints) {
      const li = el('li');
      li.append(el('span', { class: `ed-mark-${l.level}` }, l.level === 'error' ? '●' : '▲'), el('span', {}, l.message));
      if (l.c && l.i !== undefined) {
        li.dataset.c = l.c;
        li.title = 'Show it';
        li.addEventListener('click', () => h.select({ c: l.c!, i: l.i! }, true));
      }
      ul.append(li);
    }
    this.problems.replaceChildren(el('h3', {}, `Problems · ${head}`), ul);
  }
}

// When a crusher's column has finished lifting, in seconds into its beat.
function liftTime(def: LevelDef, c: CrusherDef): number {
  const probe = { ...c, offset: 0 };
  let down = false;
  for (let u = 0; u < c.period * 2; u += 0.002) {
    const drop = crusherState(def, probe, u).drop;
    if (drop > 0) down = true;
    else if (down) return u;
  }
  return 0;
}

// Is there room under the crusher the whole time a Puff keeping its place is there?
function crusherVerdict(def: LevelDef, c: CrusherDef, tIn: number, tOut: number): string {
  const gap = (t: number) => FLOOR - (c.rest + crusherState(def, c, t).drop * (FLOOR - c.rest));
  const down = (t: number) => crusherState(def, c, t).drop > 0.02;
  const span = `A Puff keeping its place is under it from ${tIn.toFixed(2)}s to ${tOut.toFixed(2)}s`;
  let least = Infinity;
  let leastAt = tIn;
  for (let t = tIn; t <= tOut; t += 0.01) {
    if (gap(t) < least) {
      least = gap(t);
      leastAt = t;
    }
  }
  if (least < 2 * PUFF_RADIUS + 20) {
    return `${span}, but the gap under it closes to ${Math.round(least)}pt at ${leastAt.toFixed(2)}s. Shift the offset, or try “Time it”.`;
  }
  let before = 0;
  while (before < c.period && !down(tIn - before)) before += 0.01;
  let after = 0;
  while (after < c.period && !down(tOut + after)) after += 0.01;
  const lift = down(tIn) ? 'It is still finishing its lift as that Puff arrives' : `It finished lifting ${before.toFixed(2)}s before`;
  return `${span}, with at least ${Math.round(least)}pt of room. ${lift}, and slams again ${after.toFixed(2)}s after it's through.`;
}

// A chart's background: the level's sky.
function skyFill(g: CanvasRenderingContext2D, def: LevelDef, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  for (const [at, c] of def.sky) sky.addColorStop(Math.min(1, Math.max(0, at)), css(c));
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
}

function safeBounds(c: Collection, item: Item, pose: SimView, i: number) {
  try {
    return bounds(c, item, pose, i);
  } catch {
    return null;
  }
}

function canvas2d(cv: HTMLCanvasElement): { g: CanvasRenderingContext2D; w: number; h: number } | null {
  const w = cv.clientWidth;
  const h = cv.clientHeight;
  if (!w || !h) return null;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  const g = cv.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  return { g, w, h };
}

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(text: string, onClick: () => void, key?: string): HTMLButtonElement {
  const b = el('button', { type: 'button' }, text) as HTMLButtonElement;
  if (key) b.append(el('span', { class: 'ed-kbd' }, key));
  b.addEventListener('click', () => {
    onClick();
    b.blur();
  });
  return b;
}

function group(...children: HTMLElement[]): HTMLElement {
  const g = el('div', { class: 'ed-group' });
  g.append(...children);
  return g;
}

function sep(): HTMLElement {
  return el('span', { class: 'ed-sep' });
}
