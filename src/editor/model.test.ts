import { describe, expect, it } from 'vitest';
import { formatLevel } from '../game/levels/format';
import { levelById } from '../game/levels/index';
import { EditorModel } from './model';

const open = (id = '1-2') => new EditorModel(levelById(id)!);

describe('editing a level', () => {
  it('makes each change one undo step, and only if something changed', () => {
    const m = open();
    m.begin();
    m.def.seesaws[0]!.px += 10;
    m.def.seesaws[0]!.px += 10; // a drag is many moves
    expect(m.end()).toBe(true);
    expect(m.change(() => {})).toBe(false);
    expect(m.canUndo).toBe(true);
    m.undo();
    expect(m.def.seesaws[0]!.px).toBe(levelById('1-2')!.seesaws[0]!.px);
    expect(m.canUndo).toBe(false);
    m.redo();
    expect(m.def.seesaws[0]!.px).toBe(levelById('1-2')!.seesaws[0]!.px + 20);
    m.change(() => (m.def.length += 100));
    expect(m.canRedo).toBe(false);
  });

  it('knows when it differs from the file, ignoring what it only looked at', () => {
    const m = open('1-8');
    for (const c of ['labels', 'roots', 'rects'] as const) m.list(c);
    expect(m.dirty).toBe(false);
    m.change(() => (m.def.crushers[0]!.x += 5));
    expect(m.dirty).toBe(true);
    m.markSaved(formatLevel(m.def));
    expect(m.dirty).toBe(false);
  });

  it('renames an id everywhere it is used, and refuses a taken one', () => {
    const m = open('1-2');
    const sel = { c: 'seesaws' as const, i: 0 };
    expect(m.set(sel, 'id', 'log-2')).toMatch(/Another log is called "log-2"/);
    expect(m.set(sel, 'id', 'first-log')).toBeNull();
    expect(m.def.gates[0]!.link).toBe('first-log');
    expect(m.def.seeds.find((s) => s.ride)!.ride!.log).toBe('first-log');

    const w = open('1-5');
    const wi = w.def.wheels.findIndex((x) => x.id === 'orbit');
    w.set({ c: 'wheels', i: wi }, 'id', 'carousel');
    expect(w.def.seeds.find((s) => s.orbit)!.orbit!.wheel).toBe('carousel');
  });

  it('adds objects with fresh ids, blooms in their place along the level', () => {
    const m = open('1-2');
    const a = m.add('wheels', 1000, 200);
    const b = m.add('wheels', 1100, 200);
    expect([m.item(a)!.id, m.item(b)!.id]).toEqual(['wheel-1', 'wheel-2']);
    const xs = m.def.blooms.map((x) => x.x);
    const bloom = m.add('blooms', (xs[0]! + xs[1]!) / 2, 0);
    expect(bloom.i).toBe(1);
    expect(m.def.blooms.map((x) => x.x)).toEqual([...m.def.blooms.map((x) => x.x)].sort((p, q) => p - q));
  });

  it('starts a gate on the nearest log behind it', () => {
    const m = open('1-2');
    const g = m.add('gates', m.def.seesaws[1]!.px + 300, 0);
    expect(m.item(g)!.link).toBe(m.def.seesaws[1]!.id);
  });

  it('duplicates just ahead, without the note, and deletes', () => {
    const m = open('1-8');
    const copy = m.duplicate({ c: 'crushers', i: 0 })!;
    expect(copy).toEqual({ c: 'crushers', i: 1 });
    expect(m.item(copy)).toMatchObject({ id: 'first-1', x: m.def.crushers[0]!.x + 40 });
    expect(m.item(copy)!.note).toBeUndefined();
    m.remove(copy);
    expect(m.selection).toBeNull();
    expect(m.def.crushers[1]!.id).toBe('seed');
  });

  it('drops an optional list once its last item goes', () => {
    const m = open('1-2');
    const sel = m.add('labels', 500, 100);
    expect(m.def.labels).toHaveLength(1);
    m.remove(sel);
    expect(m.def.labels).toBeUndefined();
    expect(m.dirty).toBe(false);
  });

  it('reverts to the file as one undoable step', () => {
    const m = open('1-3');
    m.change(() => (m.def.seeds[0]!.x += 20));
    m.revert(levelById('1-3')!);
    expect(m.dirty).toBe(false);
    m.undo();
    expect(m.def.seeds[0]!.x).toBe(levelById('1-3')!.seeds[0]!.x + 20);
  });
});
