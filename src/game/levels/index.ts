import type { LevelDef } from '../types';
import { parseLevel } from './format';
import l11 from './data/1-1.json';
import l12 from './data/1-2.json';
import l13 from './data/1-3.json';
import l14 from './data/1-4.json';
import l15 from './data/1-5.json';
import l16 from './data/1-6.json';
import l17 from './data/1-7.json';
import l18 from './data/1-8.json';
import l19 from './data/1-9.json';
import l110 from './data/1-10.json';

// Chapter 1 · First Flight (1-1 to 1-5) and chapter 2 · Undergrowth (1-6 to 1-10). Each level is a
// JSON file in ./data: edit it in the level editor (npm run dev, then open /?edit=1-1) or by hand.
export const LEVELS: LevelDef[] = [l11, l12, l13, l14, l15, l16, l17, l18, l19, l110].map(parseLevel);

export const WORLD_1_LEVEL_COUNT = 10;
export const SEEDS_PER_LEVEL = 3;

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}

// The level editor swaps in a level it has just saved, so play picks it up without a reload.
export function replaceLevel(def: LevelDef): void {
  const i = LEVELS.findIndex((l) => l.id === def.id);
  if (i >= 0) LEVELS[i] = def;
}
