import { describe, expect, it } from 'vitest';
import { PLAYFIELD, SCREEN } from '../../config/constants';
import { tuning } from '../../config/tuning';
import { briarTriangles, humpCircle } from '../sim';
import { LEVELS, levelById } from './index';

const get = (id: string) => levelById(id)!;
const ROOF = PLAYFIELD.roofY;
const FLOOR = PLAYFIELD.floorY;

// Content lists and tuning tables from the level board.
describe('chapter 1 content', () => {
  it('has the five designed levels in order, with the board lengths', () => {
    expect(LEVELS.map((l) => [l.id, l.name, l.length])).toEqual([
      ['1-1', 'First Light', 8400],
      ['1-2', 'Mossback', 9000],
      ['1-3', 'Briarwood', 9600],
      ['1-4', 'Bramble Run', 10200],
      ['1-5', 'Thornwheel Glade', 11000],
    ]);
  });

  it('gives every level 3 seeds and the board blooms', () => {
    expect(LEVELS.map((l) => l.seeds.length)).toEqual([3, 3, 3, 3, 3]);
    expect(LEVELS.map((l) => l.blooms.length)).toEqual([1, 1, 2, 2, 3]);
  });

  it('keeps 1-1 and 1-2 deathless, with death from 1-3', () => {
    for (const id of ['1-1', '1-2']) {
      const l = get(id);
      expect(l.deaths).toBe('none');
      expect(l.briars.length + l.curtains.length + l.wheels.length).toBe(0);
    }
    expect(get('1-3').deaths).toBe('instant');
  });

  it('matches the props each level lists', () => {
    const l11 = get('1-1');
    expect([l11.seesaws.length, l11.pebbles.length]).toEqual([1, 1]);
    const l12 = get('1-2');
    expect([l12.seesaws.length, l12.pebbles.length, l12.gates.length]).toEqual([4, 2, 3]);
    expect(l12.gates.filter((g) => g.mode === 'timed')).toHaveLength(1);
    expect(l12.seesaws.filter((s) => s.mode === 'dud')).toHaveLength(1);
    const l13 = get('1-3');
    expect([l13.seesaws.length, l13.curtains.length, l13.briars.length]).toEqual([1, 1, 10]);
    const l14 = get('1-4');
    expect([l14.bubbles.length, l14.seesaws.length, l14.gates.length, l14.goalClones]).toEqual([4, 1, 1, 5]);
    const l15 = get('1-5');
    expect([l15.wheels.length, l15.bubbles.length, l15.pebbles.length, l15.seesaws.length, l15.goalClones]).toEqual([9, 3, 1, 1, 6]);
  });

  it('puts every burrow inside its level', () => {
    for (const l of LEVELS) expect(l.burrowX).toBeLessThan(l.length);
  });
});

describe('narrowest gaps', () => {
  it('1-1: the hollow log corridor and the alcove are 110pt, for 6s', () => {
    const l = get('1-1');
    const roof = l.rects.find((r) => r.id === 'log-roof')!;
    const floor = l.rects.find((r) => r.id === 'log-floor')!;
    expect(floor.y0 - roof.y1).toBe(110);
    expect((roof.x1 - roof.x0) / tuning(1).speed).toBe(6);
    expect(FLOOR - l.rects.find((r) => r.id === 'overhang')!.y1).toBe(110);
  });

  it('1-3: slalom neighbours leave exactly the level gap, and thorns stop two screens early', () => {
    const l = get('1-3');
    const slalom = l.briars.filter((b) => b.id.startsWith('slalom'));
    for (let i = 0; i < slalom.length; i += 2) {
      const floorTip = Math.min(...briarTriangles(slalom[i]!).map((t) => t.qy));
      const roofTip = Math.max(...briarTriangles(slalom[i + 1]!).map((t) => t.qy));
      expect(Math.round(floorTip - roofTip)).toBe(tuning(3).gap);
    }
    const lastThorn = Math.max(...l.briars.map((b) => b.x0 + (b.width ?? 20) * b.spikes.length));
    expect(l.burrowX - lastThorn).toBeGreaterThanOrEqual(2 * SCREEN.width);
  });

  it('1-4: the bramble run is a 10s corridor at the level gap', () => {
    const l = get('1-4');
    const roof = l.briars.find((b) => b.id === 'run-thorns-roof')!;
    const floor = l.briars.find((b) => b.id === 'run-thorns-floor')!;
    const roofTip = Math.max(...briarTriangles(roof).map((t) => t.qy));
    const floorTip = Math.min(...briarTriangles(floor).map((t) => t.qy));
    expect(floorTip - roofTip).toBe(tuning(4).gap);
    expect(Math.round(((roof.width ?? 20) * roof.spikes.length) / tuning(4).speed)).toBe(10);
  });

  it('1-5: wheels spin at the tuned rate, except the one resting above the path', () => {
    const l = get('1-5');
    const spins = l.wheels.filter((w) => w.id !== 'resting').map((w) => Math.abs(w.spin));
    expect(new Set(spins)).toEqual(new Set([tuning(5).spin]));
    const glade = l.wheels.filter((w) => w.id.startsWith('glade')).map((w) => Math.sign(w.spin));
    expect(glade).toEqual([1, -1, 1]); // counter-rotating
  });

  it('never puts a seed inside solid ground', () => {
    for (const l of LEVELS) {
      for (const seed of l.seeds) {
        if (seed.orbit) continue;
        expect(seed.y).toBeGreaterThan(ROOF);
        expect(seed.y).toBeLessThan(FLOOR);
        for (const r of l.rects) {
          const inside = seed.x > r.x0 && seed.x < r.x1 && seed.y > r.y0 && seed.y < r.y1;
          expect(inside, `${l.id} ${seed.id} inside ${r.id}`).toBe(false);
        }
        for (const h of l.humps) {
          const c = humpCircle(h.width, h.height);
          expect(Math.hypot(seed.x - h.cx, seed.y - c.cy), `${l.id} ${seed.id} inside ${h.id}`).toBeGreaterThan(c.r);
        }
      }
    }
  });
});
