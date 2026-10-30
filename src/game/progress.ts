import { LEVELS, SEEDS_PER_LEVEL, WORLD_1_LEVEL_COUNT } from './levels/index';
import type { LevelDef } from './types';

// Saved progress. Pure functions over plain data, so tests need no storage.

export interface LevelRecord {
  cleared: boolean;
  seeds: boolean[]; // best per seed across runs
  bestHome: number;
  badge: boolean; // brought the goal number of clones home
  bestTime: number | null;
}

export interface Settings {
  music: boolean;
  sound: boolean;
  haptics: boolean;
}

export interface SaveData {
  version: 1;
  levels: Record<string, LevelRecord>;
  settings: Settings;
}

// Defaults as the Pause frame shows them: music and sound on, haptics off.
export const DEFAULT_SETTINGS: Settings = { music: true, sound: true, haptics: false };

export function emptySave(): SaveData {
  return { version: 1, levels: {}, settings: { ...DEFAULT_SETTINGS } };
}

export function record(save: SaveData, id: string): LevelRecord {
  return save.levels[id] ?? { cleared: false, seeds: [false, false, false], bestHome: 0, badge: false, bestTime: null };
}

export interface RunResult {
  seeds: boolean[];
  home: number;
  time: number;
}

// A cleared run keeps the best of everything. Seeds only count once the level is finished.
export function recordClear(save: SaveData, def: LevelDef, run: RunResult): SaveData {
  const prev = record(save, def.id);
  const next: LevelRecord = {
    cleared: true,
    seeds: prev.seeds.map((got, i) => got || !!run.seeds[i]),
    bestHome: Math.max(prev.bestHome, run.home),
    badge: prev.badge || run.home >= def.goalClones,
    bestTime: prev.bestTime === null ? run.time : Math.min(prev.bestTime, run.time),
  };
  return { ...save, levels: { ...save.levels, [def.id]: next } };
}

export function seedCount(save: SaveData, id: string): number {
  return record(save, id).seeds.filter(Boolean).length;
}

export function totalSeeds(save: SaveData): number {
  return Object.keys(save.levels).reduce((n, id) => n + seedCount(save, id), 0);
}

export function worldSeeds(save: SaveData, world: number): number {
  return Object.keys(save.levels)
    .filter((id) => id.startsWith(`${world}-`))
    .reduce((n, id) => n + seedCount(save, id), 0);
}

export function isUnlocked(save: SaveData, id: string): boolean {
  const i = LEVELS.findIndex((l) => l.id === id);
  if (i < 0) return false;
  return i === 0 || record(save, LEVELS[i - 1]!.id).cleared;
}

// The title's first hold starts the last unfinished level.
export function currentLevel(save: SaveData): LevelDef {
  return LEVELS.find((l) => !record(save, l.id).cleared) ?? LEVELS[LEVELS.length - 1]!;
}

export interface WorldInfo {
  n: number;
  name: string;
  seeds: number;
  total: number;
  locked: boolean;
  lockText: string;
  playable: boolean; // has designed levels
}

// Worlds unlock by total seeds, not by finishing every level, so a hard level never blocks progress.
// Each world holds 10 levels x 3 seeds = 30 (the level board's structure).
const WORLDS = [
  { n: 1, name: 'Mossdeep', seedsToOpen: 0 },
  { n: 2, name: 'Rustwell', seedsToOpen: 20 },
  { n: 3, name: 'Brinefall', seedsToOpen: 45 },
  { n: 4, name: 'Stillsky', seedsToOpen: null }, // opens when Brinefall is finished
] as const;

export const SEEDS_PER_WORLD = WORLD_1_LEVEL_COUNT * SEEDS_PER_LEVEL;

export function worlds(save: SaveData): WorldInfo[] {
  const total = totalSeeds(save);
  return WORLDS.map((w) => {
    const locked = w.seedsToOpen === null ? true : total < w.seedsToOpen;
    return {
      n: w.n,
      name: w.name,
      seeds: worldSeeds(save, w.n),
      total: SEEDS_PER_WORLD,
      locked,
      lockText: w.seedsToOpen === null ? 'Finish Brinefall\nto open' : `Collect ${w.seedsToOpen} seeds\nto open`,
      playable: w.n === 1,
    };
  });
}
