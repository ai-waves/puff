import { describe, expect, it } from 'vitest';
import { LEVELS } from './levels/index';
import { currentLevel, emptySave, isUnlocked, recordClear, totalSeeds, worlds } from './progress';

const [l11, l12, , l14] = LEVELS;

describe('progress', () => {
  it('starts with only 1-1 open and the board default settings', () => {
    const save = emptySave();
    expect(isUnlocked(save, '1-1')).toBe(true);
    expect(isUnlocked(save, '1-2')).toBe(false);
    expect(save.settings).toEqual({ music: true, sound: true, haptics: false });
    expect(currentLevel(save).id).toBe('1-1');
  });

  it('opens the next level and keeps the best seeds across runs', () => {
    let save = recordClear(emptySave(), l11!, { seeds: [true, false, false], home: 1, time: 70 });
    save = recordClear(save, l11!, { seeds: [false, false, true], home: 1, time: 66 });
    expect(isUnlocked(save, '1-2')).toBe(true);
    expect(save.levels['1-1']!.seeds).toEqual([true, false, true]);
    expect(save.levels['1-1']!.bestTime).toBe(66);
    expect(totalSeeds(save)).toBe(2);
    expect(currentLevel(save).id).toBe(l12!.id);
  });

  it('earns the clone badge only with the goal number home', () => {
    let save = recordClear(emptySave(), l14!, { seeds: [], home: 4, time: 95 });
    expect(save.levels['1-4']!.badge).toBe(false);
    save = recordClear(save, l14!, { seeds: [], home: 5, time: 99 });
    expect(save.levels['1-4']!.badge).toBe(true);
    expect(save.levels['1-4']!.bestHome).toBe(5);
  });

  it('opens worlds by total seeds', () => {
    const w = worlds(emptySave());
    expect(w.map((x) => x.name)).toEqual(['Mossdeep', 'Rustwell', 'Brinefall', 'Stillsky']);
    expect(w.map((x) => x.locked)).toEqual([false, true, true, true]);
    expect(w[0]!.total).toBe(30);
    expect(w[3]!.lockText).toBe('Finish Brinefall\nto open');
  });
});
