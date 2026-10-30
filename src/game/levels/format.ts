import type { LevelDef } from '../types';
import { validateLevel } from './schema';

// Levels live in src/game/levels/data/*.json, written by hand or by the level editor. On disk sky
// colours are "#rrggbb" strings; in the game they're numbers.

type Raw = Record<string, unknown>;

export function parseLevel(raw: unknown): LevelDef {
  const def = structuredClone(raw) as Raw;
  if (Array.isArray(def.sky)) {
    def.sky = (def.sky as [number, string | number][]).map(([at, c]) => [at, typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : c]);
  }
  const level = def as unknown as LevelDef;
  const errors = validateLevel(level);
  if (errors.length) throw new Error(`Level ${String(def.id)} is invalid:\n${errors.join('\n')}`);
  return level;
}

// The file form of a level: stable key order, numbers rounded to 3 places, short lists and small
// objects kept on one line so a diff shows exactly what moved.
export function formatLevel(def: LevelDef): string {
  const out = structuredClone(def) as unknown as Raw;
  out.sky = def.sky.map(([at, c]) => [at, `#${c.toString(16).padStart(6, '0')}`]);
  return stringify(out, '') + '\n';
}

const WIDTH = 120;

function stringify(v: unknown, indent: string): string {
  if (typeof v === 'number') return String(Math.round(v * 1000) / 1000);
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  const inner = indent + '  ';
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const one = `[${v.map((x) => stringify(x, inner)).join(', ')}]`;
    if (!one.includes('\n') && one.length + indent.length <= WIDTH) return one;
    return `[\n${v.map((x) => inner + stringify(x, inner)).join(',\n')}\n${indent}]`;
  }
  const entries = Object.entries(v as Raw).filter(([, x]) => x !== undefined);
  if (entries.length === 0) return '{}';
  const one = `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${stringify(x, inner)}`).join(', ')} }`;
  if (!one.includes('\n') && one.length + indent.length <= WIDTH && indent.length > 0) return one;
  return `{\n${entries.map(([k, x]) => `${inner}${JSON.stringify(k)}: ${stringify(x, inner)}`).join(',\n')}\n${indent}}`;
}
