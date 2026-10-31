import { describe, expect, it } from 'vitest';
import type { LevelDef } from '../types';
import { formatLevel, parseLevel } from './format';
import { LEVELS } from './index';
import { getField, setField, validateLevel } from './schema';

const files = import.meta.glob('./data/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('level files', () => {
  it('has one file per level', () => {
    expect(Object.keys(files).sort()).toEqual(LEVELS.map((l) => `./data/${l.id}.json`).sort());
  });

  it('keeps every file in the form the editor writes, so a save only changes what moved', () => {
    for (const [path, text] of Object.entries(files)) expect(formatLevel(parseLevel(JSON.parse(text))), path).toBe(text);
  });

  it('stores sky colours as readable hex and loads them as numbers', () => {
    const raw = JSON.parse(files['./data/1-1.json']!);
    expect(raw.sky[0]).toEqual([0, '#f6d7a2']);
    expect(LEVELS[0]!.sky[0]).toEqual([0, 0xf6d7a2]);
  });
});

describe('level validation', () => {
  const base = (): LevelDef => structuredClone(LEVELS[1]!);

  it('passes every shipped level', () => {
    for (const l of LEVELS) expect(validateLevel(l), l.id).toEqual([]);
  });

  it('names what is missing or wrong', () => {
    const l = base();
    delete (l.seesaws[0] as Partial<LevelDef['seesaws'][number]>).half;
    (l.gates[0] as { mode: string }).mode = 'sideways';
    l.gates[1]!.link = 'no-such-log';
    l.pebbles.push({ ...l.pebbles[0]! });
    const errors = validateLevel(l);
    expect(errors).toContain('seesaws[0] "log-1": Half length is missing');
    expect(errors).toContain('gates[0] "gate-1": Mode must be one of latch, timed');
    expect(errors).toContain('gates[1] "gate-2": Opened by log "no-such-log" doesn\'t exist');
    expect(errors).toContain('pebbles[2] "pebble-1": ID is used twice in pebbles');
    expect(() => parseLevel(l)).toThrow(/1-2 is invalid/);
  });

  it('reads and writes nested fields by path, dropping emptied groups', () => {
    const o: Record<string, unknown> = {};
    setField(o, 'ride.log', 'log-1');
    setField(o, 'ride.at', 0.5);
    expect(getField(o, 'ride.at')).toBe(0.5);
    setField(o, 'ride.log', undefined);
    setField(o, 'ride.at', undefined);
    expect(o).toEqual({});
  });
});
