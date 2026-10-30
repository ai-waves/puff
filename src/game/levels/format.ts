import type { LevelDef } from '../types';
import { LEVEL_FIELDS, SCHEMA, validateLevel, type Collection, type Field } from './schema';

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

// The file form of a level: keys in the schema's order, numbers rounded to 3 places, short lists
// and small objects kept on one line, so a diff shows exactly what moved.
export function formatLevel(def: LevelDef): string {
  const out = ordered(def as unknown as Raw, LEVEL_KEYS, LEVEL_FIELDS);
  out.sky = def.sky.map(([at, c]) => [at, `#${c.toString(16).padStart(6, '0')}`]);
  for (const c of Object.keys(SCHEMA) as Collection[]) {
    const list = out[c] as Raw[] | undefined;
    if (list) out[c] = list.map((o) => ordered(o, keysOf(SCHEMA[c].fields), SCHEMA[c].fields));
  }
  return stringify(out, '') + '\n';
}

const LEVEL_KEYS = [
  'id', 'n', 'world', 'name', 'blurb', 'teach', 'notes', 'length', 'startX', 'startY', 'burrowX', 'sky', 'sunX', 'sunY', 'deaths',
  'goalClones', 'hint', 'perch', 'lingerAtBloom', 'labels', 'roots', 'rootTrail', 'rects', 'humps', 'briars', 'seesaws', 'gates',
  'curtains', 'wheels', 'pebbles', 'seeds', 'bubbles', 'orbs', 'crushers', 'blooms', 'route',
];

// The top-level keys fields name, in order: 'round.tl' names 'round'.
function keysOf(fields: Field[], prefix = ''): string[] {
  const keys = fields.filter((f) => f.key.startsWith(prefix)).map((f) => f.key.slice(prefix.length).split('.')[0]!);
  return [...new Set(keys)];
}

// A copy with known keys first, in order, nested groups too; anything else after, as it was.
function ordered(o: Raw, keys: string[], fields: Field[], prefix = ''): Raw {
  const out: Raw = {};
  for (const k of [...keys, ...Object.keys(o)]) {
    if (!(k in o) || k in out) continue;
    const v = o[k];
    const nested = keysOf(fields, `${prefix}${k}.`);
    out[k] = nested.length && v && typeof v === 'object' && !Array.isArray(v) ? ordered(v as Raw, nested, fields, `${prefix}${k}.`) : structuredClone(v);
  }
  return out;
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
