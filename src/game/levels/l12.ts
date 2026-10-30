import type { LevelDef } from '../types';
import { FLOOR, ROOF } from './util';

// 1-2 · Mossback. Teach: touching moves things. About 80 seconds. Nothing here is deadly.
// Map: 1720px = 9,000pt (x scale 5.23); y maps the map's 14-230 band onto 14-350.
// Every gate sits on the same screen as the log that works it, and creaks right up into the
// roof when it opens, so an open gate never looks like a wall.
const GATE_OPEN = ROOF + 26;

export const L12: LevelDef = {
  id: '1-2',
  n: 2,
  world: 1,
  name: 'Mossback',
  blurb: 'Tip 3 logs to open the way.',
  teach: 'Teach: touching moves things.',
  length: 9000,
  startX: 262,
  startY: 191,
  burrowX: 8712,
  sky: [
    [0, 0xf4cd94],
    [1, 0xe99366],
  ],
  sunX: 640,
  sunY: 125,
  deaths: 'instant',
  goalClones: 1,
  // Beat 07: a root runs from the right log's end along the ceiling to gate 3. The world gives the answer.
  rootTrail: { x0: 7540, x1: 7900, y: ROOF },
  rects: [
    // Beat 05: the mound the second pebble rests on. Its far edge is sharp, so a pushed pebble
    // drops straight off it onto log 2's high end.
    { id: 'mound', look: 'mound', x0: 3700, x1: 4300, y0: 210, y1: FLOOR, round: { tl: 80, tr: 24 } },
  ],
  humps: [],
  briars: [],
  seesaws: [
    // Beat 02: landing on the high end tips it, and gate 1 creaks up in full view.
    { id: 'log-1', px: 1779, py: 300, half: 110, high: 'right' },
    // Beat 05: the pebble rolls off the mound onto this log's high end, tucked under the edge, and tips it.
    { id: 'log-2', px: 4390, py: 279, half: 80, high: 'left' },
    // Beat 07: two logs. The left one is the wrong one and just bounces you.
    { id: 'log-3', px: 6593, py: 300, half: 110, high: 'right', mode: 'dud' },
    { id: 'log-4', px: 7430, py: 300, half: 110, high: 'right' },
  ],
  gates: [
    { id: 'gate-1', x: 2250, openBottom: GATE_OPEN, link: 'log-1', mode: 'latch' },
    // Beat 06: gate 2 drifts shut over 3s, so the player has to commit to a dive.
    { id: 'gate-2', x: 4880, openBottom: GATE_OPEN, link: 'log-2', mode: 'timed', closeTime: 3, closeAhead: 260 },
    { id: 'gate-3', x: 7900, openBottom: GATE_OPEN, link: 'log-4', mode: 'latch' },
  ],
  curtains: [],
  wheels: [],
  pebbles: [
    { id: 'pebble-1', x: 764, y: FLOOR - 16, r: 16 }, // beat 01: bumping it rolls it ahead
    { id: 'pebble-2', x: 4200, y: 194, r: 16 }, // beat 05: on the mound
  ],
  seeds: [
    { id: 'raised-end', x: 1880, y: 252, ride: { log: 'log-1', at: 0.8, lift: 22 } }, // beat 03: grabbing it tips the log
    { id: 'behind-gate', x: 4940, y: 330 }, // beat 06: low, behind the closing gate
    // Beat 08: the skill seed, low just past the right log's raised end. Puff only flies forward,
    // so it's a steep dive past the end rather than a hollow under it.
    { id: 'hollow', x: 7610, y: 332 },
  ],
  bubbles: [],
  orbs: [],
  crushers: [],
  blooms: [{ id: 'bloom-1', x: 3249 }], // beat 04: gates you've opened stay open
};
