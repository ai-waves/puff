import type { LevelDef } from '../types';
import { L11 } from './l11';
import { L12 } from './l12';
import { L13 } from './l13';
import { L14 } from './l14';
import { L15 } from './l15';
import { L16 } from './l16';
import { L17 } from './l17';
import { L18 } from './l18';
import { L19 } from './l19';
import { L110 } from './l110';

// Chapter 1 · First Flight (1-1 to 1-5) and chapter 2 · Undergrowth (1-6 to 1-10).
export const LEVELS: LevelDef[] = [L11, L12, L13, L14, L15, L16, L17, L18, L19, L110];

export const WORLD_1_LEVEL_COUNT = 10;
export const SEEDS_PER_LEVEL = 3;

export function levelById(id: string): LevelDef | undefined {
  return LEVELS.find((l) => l.id === id);
}

export function nextLevel(id: string): LevelDef | undefined {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 ? LEVELS[i + 1] : undefined;
}
