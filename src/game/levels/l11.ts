import { tuning } from '../../config/tuning';
import type { LevelDef } from '../types';
import { FLOOR, ROOF } from './util';

// 1-1 · First Light. Teach one verb: hold. About 70 seconds. No way to die.
// Positions come from the board's level map (1720px wide = 8,400pt), with x scaled by 4.88
// and y mapped from the map's roof and ground bands onto the 14-350pt playfield.
const { gap } = tuning(1); // 110pt, the level's narrowest gap

// Hollow log: a gap-wide corridor for 6 seconds (720pt at 120 pt/s).
const LOG_MID = 222;
const LOG_TOP = LOG_MID - gap / 2;
const LOG_BOTTOM = LOG_MID + gap / 2;

export const L11: LevelDef = {
  id: '1-1',
  n: 1,
  world: 1,
  name: 'First Light',
  blurb: 'Hold to puff. Reach the burrow.',
  teach: 'Teach one verb: hold.',
  length: 8400,
  startX: 391,
  startY: 195,
  burrowX: 8083,
  sky: [
    [0, 0xf6d7a2],
    [0.75, 0xeb9a6c],
    [1, 0xdc7a5e],
  ],
  sunX: 635,
  sunY: 120,
  deaths: 'none',
  goalClones: 1,
  hint: true,
  perch: true,
  lingerAtBloom: true,
  labels: [{ text: 'Tap to stay level', x: 2900, y: 305 }],
  roots: [
    { x: 2860, y0: LOG_TOP, len: 18 },
    { x: 3170, y0: LOG_TOP, len: 26 },
    { x: 3480, y0: LOG_TOP, len: 14 },
  ],
  rects: [
    // Beat 04: hollow log.
    { id: 'log-roof', look: 'log', x0: 2815, x1: 3535, y0: ROOF, y1: LOG_TOP, round: { bl: 40, br: 40 } },
    { id: 'log-floor', look: 'log', x0: 2740, x1: 3610, y0: LOG_BOTTOM, y1: FLOOR, round: { tl: 50, tr: 50 } },
    // Beat 06-07: a nook past the Mossback log's low end. The pebble sits on seed 2 against
    // a moss lip, so Puff can't shove it aside. Tipping the log knocks the pebble away.
    { id: 'nook-lip', look: 'lip', x0: 5198, x1: 5214, y0: 312, y1: FLOOR, round: { tl: 6, tr: 6 } },
    // Beat 08: vine weave. Vines hang from the roof and a moss arch rises between them.
    { id: 'vine-1', look: 'vine', x0: 5952, x1: 5964, y0: ROOF, y1: 195 },
    { id: 'arch', look: 'mound', x0: 6203, x1: 6789, y0: 270, y1: FLOOR, round: { tl: 70, tr: 70 } },
    { id: 'vine-2', look: 'vine', x0: 6489, x1: 6501, y0: ROOF, y1: 127 },
    { id: 'vine-3', look: 'vine', x0: 6978, x1: 6990, y0: ROOF, y1: 209 },
    // Beat 09: the alcove overhang. Its clearance is the level gap.
    { id: 'overhang', look: 'block', x0: 7228, x1: 7814, y0: ROOF, y1: FLOOR - gap, round: { bl: 40, br: 40 } },
  ],
  // Beat 02: the first moss mound. You can't avoid it; holding clears it.
  humps: [{ id: 'mound-1', cx: 1367, width: 1074, height: 99 }],
  briars: [],
  // Beat 06: Mossback log, a preview of 1-2. Landing on the high end tips it and rolls the pebble away.
  seesaws: [{ id: 'mossback', px: 5000, py: 320, half: 90, high: 'left' }],
  gates: [],
  curtains: [],
  wheels: [],
  pebbles: [{ id: 'pebble', x: 5180, y: FLOOR - 18, r: 18 }],
  seeds: [
    { id: 'high', x: 1851, y: 79 }, // beat 03: open sky, rewards holding longer
    { id: 'low', x: 5180, y: 340 }, // beat 07: under the pebble until the log tips and knocks it away
    { id: 'alcove', x: 7516, y: 337 }, // beat 09: under the overhang
  ],
  bubbles: [],
  blooms: [{ id: 'bloom-1', x: 4166 }], // beat 05
};
