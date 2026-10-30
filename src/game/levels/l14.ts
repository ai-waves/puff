import { tuning } from '../../config/tuning';
import type { LevelDef } from '../types';
import { FLOOR, ROOF, heights } from './util';

// 1-4 · Bramble Run. Teach: you can be many. About 95 seconds. Clones are lives you can see.
// Map: 1720px = 10,200pt (x scale 5.93).
const t = tuning(4);

// Beat 09: the bramble run, a thorn corridor at the level gap for 10 seconds.
const RUN_X0 = 7000;
const RUN_LENGTH = Math.round(10 * t.speed);
const RUN_SPIKE = 20;
const RUN_COUNT = Math.round(RUN_LENGTH / RUN_SPIKE);
const RUN_ROOF = 95; // bottom of the ceiling block
const RUN_FLOOR = 300; // top of the floor block
const ROOF_TIP = 150;
const FLOOR_TIP = ROOF_TIP + t.gap;

export const L14: LevelDef = {
  id: '1-4',
  n: 4,
  world: 1,
  name: 'Bramble Run',
  blurb: 'First Split bubble. Bring 5 clones home.',
  teach: 'Teach: you can be many.',
  length: 10200,
  startX: 297,
  startY: 179,
  burrowX: 9874,
  sky: [
    [0, 0xefb67d],
    [1, 0xdf7f5d],
  ],
  sunX: 700,
  sunY: 130,
  deaths: 'screen',
  goalClones: 5,
  rects: [
    { id: 'run-roof', look: 'block', x0: RUN_X0, x1: RUN_X0 + RUN_LENGTH, y0: ROOF, y1: RUN_ROOF },
    { id: 'run-floor', look: 'block', x0: RUN_X0, x1: RUN_X0 + RUN_LENGTH, y0: RUN_FLOOR, y1: FLOOR },
  ],
  humps: [],
  briars: [
    // Beat 05: a low tuft that only clips the bottom clone of a lazy flock.
    { id: 'shaving-tuft', x0: 3629, base: FLOOR, side: 'up', spikes: [34, 44] },
    // Beat 06: seed 1 sits between two tufts.
    { id: 'tuft-a', x0: 3985, base: FLOOR, side: 'up', spikes: [62, 47] },
    { id: 'tuft-b', x0: 4519, base: FLOOR, side: 'up', spikes: [47, 65] },
    { id: 'run-thorns-roof', x0: RUN_X0, base: RUN_ROOF, side: 'down', width: RUN_SPIKE, spikes: heights(RUN_COUNT, [ROOF_TIP - RUN_ROOF, ROOF_TIP - RUN_ROOF - 10]) },
    { id: 'run-thorns-floor', x0: RUN_X0, base: RUN_FLOOR, side: 'up', width: RUN_SPIKE, spikes: heights(RUN_COUNT, [RUN_FLOOR - FLOOR_TIP, RUN_FLOOR - FLOOR_TIP - 10]) },
  ],
  // Beat 07: two bubbles and seed 2 sit behind a seesaw gate.
  seesaws: [{ id: 'gate-log', px: 5100, py: 300, half: 110, high: 'right' }],
  gates: [{ id: 'gate', x: 5400, openBottom: ROOF + 26, link: 'gate-log', mode: 'latch' }],
  curtains: [],
  wheels: [],
  pebbles: [],
  seeds: [
    { id: 'net', x: 4299, y: 308 }, // beat 06: any clone can collect it
    { id: 'gated', x: 6090, y: 320 }, // beat 07
    { id: 'edge', x: 7900, y: ROOF_TIP + 10 }, // beat 09: hugs the roof, so only the top clone reaches it
  ],
  bubbles: [
    { id: 'bubble-1', x: 996, y: 145 }, // beat 01: popping it makes two Puffs
    { id: 'bubble-2', x: 2360, y: 191 }, // beat 03: three
    { id: 'bubble-3', x: 6037, y: 138 }, // beat 07: behind the gate
    { id: 'bubble-4', x: 6298, y: 226 },
  ],
  orbs: [],
  crushers: [],
  blooms: [
    { id: 'bloom-1', x: 3090 }, // beat 04: saves the clone count
    { id: 'bloom-2', x: 6707 }, // beat 08: one quiet screen to count the flock
  ],
  // Drop onto the gate log's high end to open the gate; keep the flock centred in the bramble run.
  route: [[4800, 200], [4950, 215], [5160, 258], [5300, 315], [5500, 300], [6950, 203], [7500, 203], [8000, 203], [8300, 203]],
};
