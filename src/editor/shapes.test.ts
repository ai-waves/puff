import { describe, expect, it } from 'vitest';
import { PLAYFIELD } from '../config/constants';
import { levelById } from '../game/levels/index';
import { poseSim, seedPosition } from '../game/sim';
import type { LevelDef } from '../game/types';
import type { Item } from './model';
import { bounds, dragHandle, dragMarker, handles, hits, move } from './shapes';

const FLOOR = PLAYFIELD.floorY;
const copy = <T>(o: T) => structuredClone(o) as unknown as Item;

describe('grabbing and dragging objects', () => {
  const def = structuredClone(levelById('1-2')!);
  const pose = poseSim(def, 0);

  it('moves a block and resizes it by a corner, never past its other side', () => {
    const r = copy({ id: 'b', x0: 100, x1: 200, y0: 250, y1: 350 });
    move('rects', r, copy(r), 30, -20, pose, 0);
    expect(r).toMatchObject({ x0: 130, x1: 230, y0: 230, y1: 330 });
    const orig = copy(r);
    dragHandle('rects', r, orig, 'x1 y0', 500, 100);
    expect(r).toMatchObject({ x0: 130, x1: 500, y0: 100, y1: 330 });
    dragHandle('rects', r, orig, 'x0', 999, 0);
    expect(r.x0).toBe(226); // 4pt short of the right edge
  });

  it('sizes a mound from either side, symmetrically, and only along the floor', () => {
    const h = copy({ id: 'm', cx: 1000, width: 300, height: 50 });
    dragHandle('humps', h, copy(h), 'left', 800, 0);
    expect(h.width).toBe(400);
    dragHandle('humps', h, copy(h), 'height', 0, FLOOR - 80);
    expect(h.height).toBe(80);
    move('humps', h, copy(h), 50, 50, pose, 0);
    expect(h.cx).toBe(1050);
  });

  it('adds and removes briar spikes from its end, and sets each tip', () => {
    const b = copy({ id: 'br', x0: 0, base: FLOOR, side: 'up', spikes: [30, 40], width: 20 });
    dragHandle('briars', b, copy(b), 'count', 100, FLOOR);
    expect(b.spikes).toEqual([30, 40, 30, 40, 30]);
    dragHandle('briars', b, copy(b), 'tip 1', 30, FLOOR - 65);
    expect(b.spikes).toEqual([30, 65, 30, 40, 30]);
    expect(handles('briars', b, pose, 0).map((h) => h.key)).toContain('tip 4');
  });

  it('grabs a log by its plank or fulcrum, and lengthens it from an end', () => {
    const i = 0;
    const sw = def.seesaws[i]!;
    const plank = bounds('seesaws', copy(sw), pose, i);
    expect(hits('seesaws', copy(sw), pose, i, sw.px, sw.py)).toBe(true);
    expect(hits('seesaws', copy(sw), pose, i, sw.px, FLOOR - 4)).toBe(true); // the fulcrum
    expect(hits('seesaws', copy(sw), pose, i, sw.px + sw.half - 10, plank.y0 - 30)).toBe(false);
    const o = copy(sw);
    dragHandle('seesaws', o, copy(sw), 'end', sw.px + 150, sw.py);
    expect(o.half).toBe(150);
  });

  it('keeps a riding seed on its log: dragging it changes where along, and how high', () => {
    const d: LevelDef = structuredClone(def);
    const si = d.seeds.findIndex((s) => s.ride);
    const p = poseSim(d, 0);
    const at = seedPosition(p, si);
    const seed = d.seeds[si]! as unknown as Item;
    move('seeds', seed, copy(seed), -40, -10, p, si);
    const now = seedPosition(poseSim(d, 0), si);
    expect(now.x).toBeCloseTo(at.x - 40, 0);
    expect(now.y).toBeCloseTo(at.y - 10, 0);
    expect(d.seeds[si]!.x).toBe(def.seeds[si]!.x); // its own point is left alone
  });

  it('moves the start, burrow and end markers, within reason', () => {
    const d: LevelDef = structuredClone(def);
    dragMarker(d, 'start', def, 40, -500);
    expect(d.startX).toBe(def.startX + 40);
    expect(d.startY).toBe(PLAYFIELD.roofY + 15);
    dragMarker(d, 'length', def, -def.length, 0);
    expect(d.length).toBe(844);
  });
});
