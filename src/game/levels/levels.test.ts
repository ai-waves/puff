import { describe, expect, it } from 'vitest';
import { PLAYFIELD, PUFF_RADIUS, PUFF_SCREEN_X, SCREEN, SIZE } from '../../config/constants';
import { tuning } from '../../config/tuning';
import { briarTriangles, humpCircle, seesawEnds } from '../sim';
import { LEVELS, levelById } from './index';

const get = (id: string) => levelById(id)!;
const CHAPTER_1 = LEVELS.slice(0, 5);
const CHAPTER_2 = LEVELS.slice(5, 10);
const ROOF = PLAYFIELD.roofY;
const FLOOR = PLAYFIELD.floorY;

// Content lists and tuning tables from the level board.
describe('chapter 1 content', () => {
  it('has the five designed levels in order, with the board lengths', () => {
    expect(CHAPTER_1.map((l) => [l.id, l.name, l.length])).toEqual([
      ['1-1', 'First Light', 8400],
      ['1-2', 'Mossback', 9000],
      ['1-3', 'Briarwood', 9600],
      ['1-4', 'Bramble Run', 10200],
      ['1-5', 'Thornwheel Glade', 11000],
    ]);
  });

  it('gives every level 3 seeds and the board blooms', () => {
    expect(LEVELS.map((l) => l.seeds.length)).toEqual(Array(10).fill(3));
    expect(CHAPTER_1.map((l) => l.blooms.length)).toEqual([1, 1, 2, 2, 3]);
  });

  it('has nothing deadly in 1-1 and 1-2, where only the scroll can leave Puff behind', () => {
    for (const id of ['1-1', '1-2']) {
      const l = get(id);
      expect(l.deaths).toBe('instant');
      expect(l.briars.length + l.curtains.length + l.wheels.length + l.crushers.length).toBe(0);
    }
    expect(get('1-3').deaths).toBe('instant');
    expect(get('1-3').briars.length).toBeGreaterThan(0);
  });

  it('keeps every gate on the same screen as the log that works it, and tucks it into the roof when open', () => {
    for (const l of LEVELS) {
      for (const g of l.gates) {
        const sw = l.seesaws.find((s) => s.id === g.link)!;
        const e = seesawEnds(sw, 0);
        // Puff sits 280pt in from the left, so the rest of the screen is ahead of it.
        expect(g.x - Math.max(e.ax, e.bx), `${l.id} ${g.id}`).toBeLessThanOrEqual(SCREEN.width - PUFF_SCREEN_X - 40);
        expect(g.openBottom, `${l.id} ${g.id}`).toBeLessThanOrEqual(ROOF + 30);
      }
    }
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

// Chapter 2 · Undergrowth. The board gives it one line, "Swell, Shrink, Rootcrusher", plus the
// power-up and hazard cards and the sky for each level; the levels themselves are designed here.
describe('chapter 2 content', () => {
  it('has five levels, 1-6 to 1-10, under the board sky for each', () => {
    expect(CHAPTER_2.map((l) => l.id)).toEqual(['1-6', '1-7', '1-8', '1-9', '1-10']);
    // Sky per level from the board: level 1 is golden hour, level 10 is the last light.
    expect(CHAPTER_2.map((l) => [l.sky[0]![1], l.sky[l.sky.length - 1]![1]])).toEqual([
      [0xe19670, 0xc96955],
      [0xd4876c, 0xb95f52],
      [0xc27868, 0xa5554e],
      [0xad6b64, 0x8e4b49],
      [0x956060, 0x7c3a39],
    ]);
    // The sun sets across the world.
    const suns = LEVELS.map((l) => l.sunY);
    expect([...suns].sort((a, b) => a - b)).toEqual(suns);
  });

  it('brings in one idea per level, then combines them', () => {
    const has = (id: string) => {
      const l = get(id);
      return {
        swell: l.orbs.some((o) => o.kind === 'swell'),
        shrink: l.orbs.some((o) => o.kind === 'shrink'),
        crusher: l.crushers.length > 0,
      };
    };
    expect(has('1-6')).toEqual({ swell: true, shrink: false, crusher: false });
    expect(has('1-7')).toEqual({ swell: false, shrink: true, crusher: false });
    expect(has('1-8')).toEqual({ swell: false, shrink: false, crusher: true });
    expect(has('1-9')).toEqual({ swell: true, shrink: true, crusher: true });
    expect(has('1-10')).toEqual({ swell: true, shrink: true, crusher: true });
    for (const l of CHAPTER_1) expect(l.orbs.length + l.crushers.length).toBe(0);
  });

  it('only lets a swollen Puff tip the heavy logs that guard its gates', () => {
    for (const l of [get('1-6'), get('1-9'), get('1-10')]) {
      for (const g of l.gates) expect(l.seesaws.find((s) => s.id === g.link)!.heavy, `${l.id} ${g.id}`).toBe(true);
      // A Swell orb waits before each heavy log.
      for (const s of l.seesaws.filter((w) => w.heavy)) {
        expect(l.orbs.some((o) => o.kind === 'swell' && o.x < s.px && s.px - o.x < 600), `${l.id} ${s.id}`).toBe(true);
      }
    }
  });

  it('makes bramble gaps a normal Puff cannot fit through, but a shrunk one can', () => {
    // A Puff's thorn sensor is its body less 3pt of fuzz: 24pt across normally, 9pt shrunk.
    const normal = 2 * (PUFF_RADIUS - 3);
    const shrunk = 2 * (PUFF_RADIUS * SIZE.shrink - 3);
    for (const id of ['1-7', '1-9']) {
      const l = get(id);
      const tops = l.briars.filter((b) => b.side === 'down' && b.id.endsWith('-top'));
      expect(tops.length, id).toBeGreaterThan(0);
      for (const top of tops) {
        const bottom = l.briars.find((b) => b.id === top.id.replace('-top', '-bottom'))!;
        const gap = Math.min(...briarTriangles(bottom).map((t) => t.qy)) - Math.max(...briarTriangles(top).map((t) => t.qy));
        expect(gap, `${id} ${top.id}`).toBeLessThan(normal);
        expect(gap, `${id} ${top.id}`).toBeGreaterThan(shrunk + 8);
      }
    }
  });

  it('hangs every rootcrusher clear of the ground it slams onto', () => {
    for (const l of LEVELS) {
      for (const c of l.crushers) {
        expect(c.rest, `${l.id} ${c.id}`).toBeLessThan(FLOOR);
        // Nothing solid under a crusher: it slams all the way to the floor.
        for (const r of l.rects) expect(r.x1 < c.x - c.width / 2 || r.x0 > c.x + c.width / 2 || r.y1 < c.rest, `${l.id} ${c.id} over ${r.id}`).toBe(true);
      }
    }
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

  it('re-forms Puff in open air: the start and every bloom are clear of ground', () => {
    for (const l of LEVELS) {
      const spots = [{ x: l.startX, y: l.startY }, ...l.blooms.map((b) => ({ x: b.x, y: 190 }))];
      for (const p of spots) {
        for (const r of l.rects) {
          const near = p.x + 15 > r.x0 && p.x - 15 < r.x1 && p.y + 15 > r.y0 && p.y - 15 < r.y1;
          expect(near, `${l.id} spawn at ${p.x} inside ${r.id}`).toBe(false);
        }
      }
    }
  });

  it('never puts a seed inside solid ground', () => {
    for (const l of LEVELS) {
      for (const seed of l.seeds) {
        if (seed.orbit || seed.ride) continue;
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
