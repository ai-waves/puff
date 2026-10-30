import { PLAYFIELD } from './constants';
import type { Level } from './level';

// Level 1-1 · First Light. Positions are in pt of travel. The design's beat timestamps at
// 120 pt/s give the x-positions: beat 02 at 0:04 is 480pt, beat 04 at 0:18 is 2160pt, and so on.
const { roofY, floorY } = PLAYFIELD;

// Hollow log: 110pt corridor (design: narrowest gap) between roof-side and floor-side bars.
const LOG_X0 = 2160;
const LOG_X1 = 2880;
const LOG_TOP_BOTTOM = 140;
const LOG_BOTTOM_TOP = 250;

// Vine weave: vines hang from the roof, mounds rise from the floor, alternating.
const VINE_BOTTOM = 150;
const MOUND_TOP = 300;

export const LEVEL_1_1: Level = {
  id: '1-1',
  name: 'First Light',
  length: 8400,
  burrowX: 7800,
  roofY,
  floorY,
  solids: [
    // Beat 02: the first moss mound. Holding clears it.
    { id: 'mound-1', kind: 'mound', x0: 480, x1: 600, y0: MOUND_TOP, y1: floorY },

    // Beat 04: hollow log. Its corridor is the level's narrowest gap, 110pt.
    { id: 'log-roof', kind: 'log', x0: LOG_X0, x1: LOG_X1, y0: roofY, y1: LOG_TOP_BOTTOM },
    { id: 'log-floor', kind: 'log', x0: LOG_X0, x1: LOG_X1, y0: LOG_BOTTOM_TOP, y1: floorY },

    // Beat 06: Mossback plank. Landing on it tips it, and the lid lifts over the seed pocket.
    { id: 'plank', kind: 'plank', x0: 4240, x1: 4360, y0: 282, y1: 296 },
    { id: 'pocket-wall-left', kind: 'wall', x0: 4236, x1: 4244, y0: 296, y1: floorY },
    { id: 'pocket-wall-right', kind: 'wall', x0: 4356, x1: 4364, y0: 296, y1: floorY },

    // Beat 08: vine weave. Vines hang from the roof and mounds rise from the floor, alternating.
    { id: 'vine-1', kind: 'vine', x0: 5520, x1: 5536, y0: roofY, y1: VINE_BOTTOM },
    { id: 'mound-2', kind: 'mound', x0: 5640, x1: 5730, y0: MOUND_TOP, y1: floorY },
    { id: 'vine-2', kind: 'vine', x0: 5760, x1: 5776, y0: roofY, y1: VINE_BOTTOM },
    { id: 'mound-3', kind: 'mound', x0: 5880, x1: 5970, y0: MOUND_TOP, y1: floorY },
    { id: 'vine-3', kind: 'vine', x0: 6000, x1: 6016, y0: roofY, y1: VINE_BOTTOM },
    { id: 'mound-4', kind: 'mound', x0: 6120, x1: 6210, y0: MOUND_TOP, y1: floorY },
    { id: 'vine-4', kind: 'vine', x0: 6240, x1: 6256, y0: roofY, y1: VINE_BOTTOM },

    // Beat 09: alcove overhang. Seed 3 sits under it.
    { id: 'alcove-overhang', kind: 'overhang', x0: 6900, x1: 7080, y0: roofY, y1: 200 },
  ],
  seeds: [
    // Beat 03: high seed, reached by holding longer.
    { id: 'seed-high', x: 1200, y: 110 },
    // Beat 07: low seed, only reachable once the plank has tipped.
    { id: 'seed-low', x: 4300, y: 322 },
    // Beat 09: alcove seed.
    { id: 'seed-alcove', x: 6990, y: 262 },
  ],
  checkpoints: [
    // Beat 05: the first bloom.
    { id: 'bloom-1', x: 3360 },
  ],
};
