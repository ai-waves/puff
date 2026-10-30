import type { LevelDef } from '../types';

// Every kind of thing a level holds, and the fields each one has. The level loader validates
// against it and the level editor builds its property forms from it, so the two can't drift.

export type Collection =
  | 'rects'
  | 'humps'
  | 'briars'
  | 'seesaws'
  | 'gates'
  | 'curtains'
  | 'wheels'
  | 'pebbles'
  | 'crushers'
  | 'seeds'
  | 'bubbles'
  | 'orbs'
  | 'blooms'
  | 'labels'
  | 'roots';

export type FieldKind = 'number' | 'int' | 'text' | 'longtext' | 'bool' | 'select' | 'ref' | 'numbers' | 'points' | 'color-stops';

export interface Field {
  key: string; // dot path, e.g. 'round.tl' or 'orbit.wheel'
  label: string;
  kind: FieldKind;
  optional?: boolean;
  options?: readonly string[]; // select
  ref?: Collection; // ref: the id must name one of these
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

export interface KindInfo {
  label: string; // what the editor calls it
  fields: Field[];
  hasId: boolean;
}

const num = (key: string, label: string, extra: Partial<Field> = {}): Field => ({ key, label, kind: 'number', ...extra });
const opt = (key: string, label: string, extra: Partial<Field> = {}): Field => num(key, label, { optional: true, ...extra });
const flag = (key: string, label: string, hint?: string): Field => ({ key, label, kind: 'bool', optional: true, hint });
const id: Field = { key: 'id', label: 'ID', kind: 'text' };
const note: Field = { key: 'note', label: 'Note', kind: 'longtext', optional: true, hint: 'What it is for in the beats. The game ignores it.' };

export const SCHEMA: Record<Collection, KindInfo> = {
  rects: {
    label: 'Block',
    hasId: true,
    fields: [
      id,
      num('x0', 'Left'),
      num('x1', 'Right'),
      num('y0', 'Top'),
      num('y1', 'Bottom'),
      { key: 'look', label: 'Look', kind: 'select', optional: true, options: ['block', 'log', 'shelf', 'ledge', 'vine', 'lip', 'mound'], hint: 'mound is bouncy; vine is a thin stem with a knot' },
      opt('round.tl', 'Round top-left', { min: 0 }),
      opt('round.tr', 'Round top-right', { min: 0 }),
      opt('round.bl', 'Round bottom-left', { min: 0 }),
      opt('round.br', 'Round bottom-right', { min: 0 }),
      note,
    ],
  },
  humps: {
    label: 'Moss mound',
    hasId: true,
    fields: [id, num('cx', 'Centre'), num('width', 'Width', { min: 20 }), num('height', 'Height', { min: 5 }), note],
  },
  briars: {
    label: 'Briar',
    hasId: true,
    fields: [
      id,
      num('x0', 'Left'),
      num('base', 'Base y', { hint: '350 is the floor, 14 the roof' }),
      { key: 'side', label: 'Points', kind: 'select', options: ['up', 'down'] },
      { key: 'spikes', label: 'Spike heights', kind: 'numbers', hint: 'left to right, comma separated' },
      opt('width', 'Spike width', { min: 4, hint: 'default 20' }),
      note,
    ],
  },
  seesaws: {
    label: 'Log',
    hasId: true,
    fields: [
      id,
      num('px', 'Pivot x'),
      num('py', 'Pivot y'),
      num('half', 'Half length', { min: 20 }),
      { key: 'high', label: 'High end', kind: 'select', options: ['left', 'right'] },
      { key: 'mode', label: 'Mode', kind: 'select', optional: true, options: ['free', 'dud', 'return', 'beat'], hint: 'dud bounces; return tips back; beat swings on a beat' },
      opt('returnAfter', 'Return after (s)', { min: 0 }),
      opt('beat', 'Beat (s)', { min: 0.2 }),
      opt('baseY', 'Fulcrum base y'),
      flag('heavy', 'Heavy', 'only a swollen Puff tips it'),
      flag('cradle', 'Cradle', 'a knot on the low end holds a pebble'),
      note,
    ],
  },
  gates: {
    label: 'Gate',
    hasId: true,
    fields: [
      id,
      num('x', 'x'),
      num('openBottom', 'Open bottom y', { hint: 'keep it up in the roof, ~40' }),
      { key: 'link', label: 'Opened by log', kind: 'ref', ref: 'seesaws' },
      { key: 'mode', label: 'Mode', kind: 'select', options: ['latch', 'timed'] },
      opt('closeTime', 'Close time (s)', { min: 0.2 }),
      opt('closeAhead', 'Starts closing when Puff is within (pt)', { min: 0 }),
      note,
    ],
  },
  curtains: {
    label: 'Thorn curtain',
    hasId: true,
    fields: [
      id,
      num('x0', 'Left'),
      num('x1', 'Right'),
      num('openBottom', 'Lifted bottom y'),
      num('closedBottom', 'Down bottom y'),
      { key: 'link', label: 'Lifted by log', kind: 'ref', ref: 'seesaws' },
      note,
    ],
  },
  wheels: {
    label: 'Thornwheel',
    hasId: true,
    fields: [
      id,
      num('cx', 'Centre x'),
      num('cy', 'Centre y'),
      num('r', 'Radius', { min: 10 }),
      num('spin', 'Spin (deg/s)', { hint: 'negative turns the other way' }),
      flag('missingTooth', 'Missing tooth'),
      flag('jammable', 'Jammable', 'a pebble in the axle stops it'),
      flag('post', 'On a post'),
      opt('hang', 'Hangs from y'),
      note,
    ],
  },
  pebbles: {
    label: 'Pebble',
    hasId: true,
    fields: [id, num('x', 'x'), num('y', 'y'), num('r', 'Radius', { min: 6 }), flag('heavy', 'Boulder', 'only a swollen Puff can shove it'), note],
  },
  crushers: {
    label: 'Rootcrusher',
    hasId: true,
    fields: [
      id,
      num('x', 'Centre x'),
      num('width', 'Width', { min: 20 }),
      num('rest', 'Raised bottom y'),
      num('period', 'Beat (s)', { min: 1.6 }),
      opt('offset', 'Offset (s)'),
      note,
    ],
  },
  seeds: {
    label: 'Seed',
    hasId: true,
    fields: [
      id,
      num('x', 'x'),
      num('y', 'y'),
      { key: 'orbit.wheel', label: 'Rides wheel', kind: 'ref', ref: 'wheels', optional: true },
      opt('orbit.radius', 'Orbit radius'),
      { key: 'ride.log', label: 'Rides log', kind: 'ref', ref: 'seesaws', optional: true },
      opt('ride.at', 'Along the log (-1 to 1)', { min: -1, max: 1, step: 0.05 }),
      opt('ride.lift', 'Above the log (pt)'),
      { key: 'route', label: 'Solver line to it', kind: 'points', optional: true, hint: 'x,y; x,y; ... (tests only)' },
      note,
    ],
  },
  bubbles: { label: 'Split bubble', hasId: true, fields: [id, num('x', 'x'), num('y', 'y'), note] },
  orbs: {
    label: 'Swell / Shrink orb',
    hasId: true,
    fields: [id, num('x', 'x'), num('y', 'y'), { key: 'kind', label: 'Kind', kind: 'select', options: ['swell', 'shrink'] }, opt('time', 'Lasts (s)', { min: 1, hint: 'default 6' }), note],
  },
  blooms: { label: 'Bloom (checkpoint)', hasId: true, fields: [id, num('x', 'x'), note] },
  labels: { label: 'Label', hasId: false, fields: [{ key: 'text', label: 'Text', kind: 'text' }, num('x', 'x'), num('y', 'y'), note] },
  roots: { label: 'Root', hasId: false, fields: [num('x', 'x'), num('y0', 'Top y'), num('len', 'Length', { min: 2 }), note] },
};

export const COLLECTIONS = Object.keys(SCHEMA) as Collection[];

export const LEVEL_FIELDS: Field[] = [
  { key: 'name', label: 'Name', kind: 'text' },
  { key: 'blurb', label: 'Card line', kind: 'text' },
  { key: 'teach', label: 'Teaches', kind: 'text' },
  { key: 'notes', label: 'Design notes', kind: 'longtext', optional: true },
  num('length', 'Length (pt)', { min: 844 }),
  num('startX', 'Start x'),
  num('startY', 'Start y'),
  num('burrowX', 'Burrow x'),
  { key: 'deaths', label: 'Losing every Puff', kind: 'select', options: ['instant', 'screen'], hint: 'instant re-forms at once; screen shows the fail screen' },
  { key: 'goalClones', label: 'Clones for the badge', kind: 'int', min: 1, max: 6 },
  { key: 'sky', label: 'Sky', kind: 'color-stops' },
  num('sunX', 'Sun x (screen)'),
  num('sunY', 'Sun y (screen)'),
  flag('hint', '"Hold" hint'),
  flag('perch', 'Starts on a dandelion'),
  flag('lingerAtBloom', 'Scroll lingers at first bloom'),
  opt('rootTrail.x0', 'Root trail from x'),
  opt('rootTrail.x1', 'Root trail to x'),
  opt('rootTrail.y', 'Root trail y'),
  { key: 'route', label: 'Solver line', kind: 'points', optional: true, hint: 'x,y; x,y; ... (tests only)' },
];

// Read and write a field by its dot path.
export function getField(obj: object, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export function setField(obj: object, path: string, value: unknown): void {
  const keys = path.split('.');
  let o = obj as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) {
    if (value === undefined && (o[k] === undefined || o[k] === null)) return;
    if (typeof o[k] !== 'object' || o[k] === null) o[k] = {};
    o = o[k] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1]!;
  if (value === undefined) delete o[last];
  else o[last] = value;
  // Drop a nested object once its last field is gone (an orbit, a ride, rounded corners).
  if (keys.length > 1 && value === undefined) {
    const parent = getField(obj, keys.slice(0, -1).join('.'));
    if (parent && typeof parent === 'object' && Object.keys(parent).length === 0) setField(obj, keys.slice(0, -1).join('.'), undefined);
  }
}

// Everything structurally wrong with a level, as readable messages. Empty means valid.
export function validateLevel(def: LevelDef): string[] {
  const errors: string[] = [];
  const where = (c: string, i: number, o: Record<string, unknown>) => `${c}[${i}]${o.id ? ` "${String(o.id)}"` : ''}`;
  const check = (f: Field, value: unknown, at: string) => {
    if (value === undefined || value === null) {
      if (!f.optional) errors.push(`${at}: ${f.label} is missing`);
      return;
    }
    switch (f.kind) {
      case 'number':
      case 'int':
        if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`${at}: ${f.label} must be a number`);
        else if (f.min !== undefined && value < f.min) errors.push(`${at}: ${f.label} must be at least ${f.min}`);
        else if (f.max !== undefined && value > f.max) errors.push(`${at}: ${f.label} must be at most ${f.max}`);
        break;
      case 'text':
      case 'longtext':
        if (typeof value !== 'string') errors.push(`${at}: ${f.label} must be text`);
        break;
      case 'bool':
        if (typeof value !== 'boolean') errors.push(`${at}: ${f.label} must be true or false`);
        break;
      case 'select':
        if (!f.options!.includes(value as string)) errors.push(`${at}: ${f.label} must be one of ${f.options!.join(', ')}`);
        break;
      case 'ref': {
        const ids = (def[f.ref!] as { id?: string }[]).map((o) => o.id);
        if (!ids.includes(value as string)) errors.push(`${at}: ${f.label} "${String(value)}" doesn't exist`);
        break;
      }
      case 'numbers':
        if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== 'number')) errors.push(`${at}: ${f.label} must be a list of numbers`);
        break;
      case 'points':
        if (!Array.isArray(value) || value.some((p) => !Array.isArray(p) || p.length !== 2 || p.some((v) => typeof v !== 'number'))) errors.push(`${at}: ${f.label} must be a list of x,y points`);
        break;
      case 'color-stops':
        if (!Array.isArray(value) || value.length < 2 || value.some((p) => !Array.isArray(p) || p.length !== 2 || typeof p[0] !== 'number' || typeof p[1] !== 'number')) {
          errors.push(`${at}: ${f.label} must be at least two [position, colour] stops`);
        }
        break;
    }
  };
  if (!/^\d+-\d+$/.test(String(def.id))) errors.push(`level: ID "${String(def.id)}" must look like 1-2`);
  for (const f of [num('n', 'Level number'), num('world', 'World'), ...LEVEL_FIELDS]) check(f, getField(def, f.key), 'level');
  for (const c of COLLECTIONS) {
    const list = (def as unknown as Record<string, unknown>)[c];
    if (c === 'labels' || c === 'roots') {
      if (list === undefined) continue;
    }
    if (!Array.isArray(list)) {
      errors.push(`level: ${c} must be a list`);
      continue;
    }
    const seen = new Set<string>();
    list.forEach((o: Record<string, unknown>, i) => {
      const at = where(c, i, o);
      for (const f of SCHEMA[c].fields) check(f, getField(o, f.key), at);
      if (SCHEMA[c].hasId) {
        if (seen.has(String(o.id))) errors.push(`${at}: ID is used twice in ${c}`);
        seen.add(String(o.id));
      }
    });
  }
  return errors;
}
