import { PLAYFIELD } from '../config/constants';
import { formatLevel } from '../game/levels/format';
import { COLLECTIONS, SCHEMA, getField, setField, type Collection } from '../game/levels/schema';
import type { LevelDef } from '../game/types';

// The level being edited, with undo and redo. Pure data: the editor scene draws it and the panel
// builds forms from it, and the tests drive it without either.

export type Item = Record<string, unknown>;

export interface Selection {
  c: Collection;
  i: number;
}

const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;
const HISTORY = 300;

// Ids other objects point at, from the schema: renaming a log renames the gates it works.
const REFS = COLLECTIONS.flatMap((from) => SCHEMA[from].fields.filter((f) => f.kind === 'ref').map((f) => ({ from, key: f.key, to: f.ref! })));

// What a new id starts with, per kind.
export const ID_PREFIX: Record<Collection, string> = {
  rects: 'block',
  humps: 'mound',
  briars: 'briar',
  seesaws: 'log',
  gates: 'gate',
  curtains: 'curtain',
  wheels: 'wheel',
  pebbles: 'pebble',
  crushers: 'crusher',
  seeds: 'seed',
  bubbles: 'bubble',
  orbs: 'orb',
  blooms: 'bloom',
  labels: 'label',
  roots: 'root',
};

export class EditorModel {
  def: LevelDef;
  selection: Selection | null = null;
  saved: string; // the file as last loaded or saved
  private undos: string[] = [];
  private redos: string[] = [];
  private before: string | null = null; // the level when the change in progress began

  constructor(def: LevelDef) {
    this.def = structuredClone(def);
    this.saved = formatLevel(def);
  }

  get dirty(): boolean {
    return formatLevel(this.def) !== this.saved;
  }

  get canUndo(): boolean {
    return this.undos.length > 0;
  }

  get canRedo(): boolean {
    return this.redos.length > 0;
  }

  // Labels and roots are optional lists: a level without any has none, not an empty one.
  list(c: Collection): Item[] {
    return (this.def as unknown as Record<string, Item[] | undefined>)[c] ?? [];
  }

  private ensureList(c: Collection): Item[] {
    const d = this.def as unknown as Record<string, Item[] | undefined>;
    return (d[c] ??= []);
  }

  item(sel: Selection | null = this.selection): Item | null {
    return sel ? (this.list(sel.c)[sel.i] ?? null) : null;
  }

  // A change is everything between begin() and end(): one drag, one edit of a field. It becomes
  // one undo step, and only if something actually changed.
  begin(): void {
    if (this.before === null) this.before = JSON.stringify(this.def);
  }

  end(): boolean {
    const before = this.before;
    this.before = null;
    if (before === null || before === JSON.stringify(this.def)) return false;
    this.undos.push(before);
    if (this.undos.length > HISTORY) this.undos.shift();
    this.redos = [];
    return true;
  }

  change(fn: () => void): boolean {
    this.begin();
    fn();
    return this.end();
  }

  undo(): boolean {
    this.end();
    const prev = this.undos.pop();
    if (prev === undefined) return false;
    this.redos.push(JSON.stringify(this.def));
    this.load(prev);
    return true;
  }

  redo(): boolean {
    this.end();
    const next = this.redos.pop();
    if (next === undefined) return false;
    this.undos.push(JSON.stringify(this.def));
    this.load(next);
    return true;
  }

  // Back to the file as last saved, as one undoable step.
  revert(def: LevelDef): void {
    this.change(() => {
      this.def = structuredClone(def);
    });
    this.saved = formatLevel(def);
    this.keepSelection();
  }

  markSaved(text: string): void {
    this.saved = text;
  }

  // Set one field. An emptied optional field is removed, and a renamed id is renamed everywhere
  // it's used. Returns why the value can't be used, if it can't.
  set(sel: Selection | 'level', key: string, value: unknown): string | null {
    if (sel === 'level') {
      setField(this.def, key, value);
      return null;
    }
    const o = this.item(sel);
    if (!o) return 'Nothing selected';
    if (key === 'id') {
      const id = String(value ?? '').trim();
      if (!id) return 'An ID is needed';
      if (this.list(sel.c).some((x, i) => i !== sel.i && x.id === id)) return `Another ${SCHEMA[sel.c].label.toLowerCase()} is called "${id}"`;
      const old = o.id;
      for (const r of REFS) {
        if (r.to !== sel.c) continue;
        for (const x of this.list(r.from)) if (getField(x, r.key) === old) setField(x, r.key, id);
      }
      o.id = id;
      return null;
    }
    setField(o, key, value);
    return null;
  }

  // A new object of kind c near (x, y), selected.
  add(c: Collection, x: number, y: number): Selection {
    const o = this.fresh(c, Math.round(x), Math.round(y));
    const list = this.ensureList(c);
    // Blooms open in list order, so a new one goes in its place along the level.
    let i = list.length;
    if (c === 'blooms') {
      i = list.findIndex((b) => (b.x as number) > (o.x as number));
      if (i < 0) i = list.length;
    }
    list.splice(i, 0, o);
    this.selection = { c, i };
    return this.selection;
  }

  remove(sel: Selection | null = this.selection): void {
    if (!sel || !this.item(sel)) return;
    const list = this.list(sel.c);
    list.splice(sel.i, 1);
    if (!list.length && (sel.c === 'labels' || sel.c === 'roots')) delete (this.def as unknown as Record<string, unknown>)[sel.c];
    if (this.selection?.c === sel.c) {
      if (this.selection.i === sel.i) this.selection = null;
      else if (this.selection.i > sel.i) this.selection = { c: sel.c, i: this.selection.i - 1 };
    }
  }

  // A copy just ahead of the original, with its own id.
  duplicate(sel: Selection | null = this.selection, dx = 40): Selection | null {
    const o = sel ? this.item(sel) : null;
    if (!sel || !o) return null;
    const copy = structuredClone(o);
    if (SCHEMA[sel.c].hasId) copy.id = this.nextId(sel.c, String(o.id).replace(/-?\d+$/, '') || ID_PREFIX[sel.c]);
    shiftX(sel.c, copy, dx);
    delete copy.note;
    this.list(sel.c).splice(sel.i + 1, 0, copy);
    this.selection = { c: sel.c, i: sel.i + 1 };
    return this.selection;
  }

  nextId(c: Collection, prefix = ID_PREFIX[c]): string {
    const ids = new Set(this.list(c).map((o) => o.id));
    let n = 1;
    while (ids.has(`${prefix}-${n}`)) n++;
    return `${prefix}-${n}`;
  }

  private fresh(c: Collection, x: number, y: number): Item {
    const id = SCHEMA[c].hasId ? { id: this.nextId(c) } : {};
    const nearest = (to: Collection) => {
      const before = this.list(to).filter((o) => ((o.px ?? o.cx) as number) <= x);
      return (before[before.length - 1] ?? this.list(to)[0])?.id as string | undefined;
    };
    switch (c) {
      case 'rects':
        return { ...id, x0: x - 60, x1: x + 60, y0: FLOOR - 90, y1: FLOOR };
      case 'humps':
        return { ...id, cx: x, width: 300, height: 50 };
      case 'briars':
        return { ...id, x0: x - 60, base: FLOOR, side: 'up', spikes: [30, 42, 30, 42, 30, 42] };
      case 'seesaws':
        return { ...id, px: x, py: 300, half: 90, high: 'right' };
      case 'gates':
        return { ...id, x, openBottom: ROOF + 26, link: nearest('seesaws') ?? '', mode: 'latch' };
      case 'curtains':
        return { ...id, x0: x - 40, x1: x + 40, openBottom: ROOF + 40, closedBottom: 250, link: nearest('seesaws') ?? '' };
      case 'wheels':
        return { ...id, cx: x, cy: y, r: 50, spin: 90 };
      case 'pebbles':
        return { ...id, x, y, r: 14 };
      case 'crushers':
        return { ...id, x, width: 80, rest: 180, period: 3.2 };
      case 'seeds':
      case 'bubbles':
        return { ...id, x, y };
      case 'orbs':
        return { ...id, x, y, kind: 'swell' };
      case 'blooms':
        return { ...id, x };
      case 'labels':
        return { text: 'Label', x, y: 120 };
      case 'roots':
        return { x, y0: ROOF, len: 60 };
    }
  }

  private load(json: string): void {
    this.def = JSON.parse(json) as LevelDef;
    this.keepSelection();
  }

  private keepSelection(): void {
    if (this.selection && !this.item()) this.selection = null;
  }
}

// Move an object along the level by dx.
export function shiftX(c: Collection, o: Item, dx: number): void {
  for (const k of X_KEYS[c]) if (typeof o[k] === 'number') o[k] = (o[k] as number) + dx;
}

export const X_KEYS: Record<Collection, string[]> = {
  rects: ['x0', 'x1'],
  humps: ['cx'],
  briars: ['x0'],
  seesaws: ['px'],
  gates: ['x'],
  curtains: ['x0', 'x1'],
  wheels: ['cx'],
  pebbles: ['x'],
  crushers: ['x'],
  seeds: ['x'],
  bubbles: ['x'],
  orbs: ['x'],
  blooms: ['x'],
  labels: ['x'],
  roots: ['x'],
};
