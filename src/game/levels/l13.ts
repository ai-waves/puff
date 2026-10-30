import { tuning } from '../../config/tuning';
import type { BriarDef, LevelDef } from '../types';
import { FLOOR, ROOF, heights } from './util';

// 1-3 · Briarwood. Teach: some things hurt. About 90 seconds. Make the first death cheap:
// respawn is instant (a 0.4s burst of fluff), with no fail screen and no counter.
// Map: 1720px = 9,600pt (x scale 5.58).
const { gap } = tuning(3); // 108pt at the slalom

// Beat 09: the slalom. Thorns alternate floor and roof; where neighbours overlap, the
// vertical gap between their tips is the level gap. Every cluster ends two screens before the burrow.
const SLALOM_FLOOR_TIPS = [250, 230, 260];
const slalom: BriarDef[] = [];
const starts = [6450, 6900, 7340];
starts.forEach((x0, i) => {
  const floorTip = SLALOM_FLOOR_TIPS[i]!;
  const roofTip = floorTip - gap;
  const up = FLOOR - floorTip;
  const down = roofTip - ROOF;
  slalom.push({ id: `slalom-floor-${i + 1}`, x0, base: FLOOR, side: 'up', width: 24, spikes: [up * 0.6, up * 0.85, up, up * 0.85, up * 0.6] });
  slalom.push({ id: `slalom-roof-${i + 1}`, x0: x0 + 90, base: ROOF, side: 'down', width: 24, spikes: [down * 0.6, down * 0.85, down, down * 0.85, down * 0.6] });
});

export const L13: LevelDef = {
  id: '1-3',
  n: 3,
  world: 1,
  name: 'Briarwood',
  blurb: 'Briar can end a run now. Reach the burrow.',
  teach: 'Teach: some things hurt.',
  length: 9600,
  startX: 279,
  startY: 163,
  burrowX: 9293,
  sky: [
    [0, 0xf2c386],
    [1, 0xe68a62],
  ],
  sunX: 640,
  sunY: 130,
  deaths: 'instant',
  goalClones: 1,
  rects: [
    // Beat 01: a briar bed under a mossy shelf, in view but out of reach.
    { id: 'shelf', look: 'shelf', x0: 446, x1: 1284, y0: 257, y1: 276, round: { tl: 8, tr: 8, bl: 8, br: 8 } },
    { id: 'shelf-wall', look: 'lip', x0: 446, x1: 466, y0: 276, y1: FLOOR },
    // Beat 05: the hollow log from 1-1 returns, with thorns on its roof.
    { id: 'log-roof', look: 'log', x0: 3460, x1: 4800, y0: ROOF, y1: 117 },
    { id: 'log-floor', look: 'log', x0: 3460, x1: 4800, y0: 269, y1: FLOOR, round: { tr: 60 } },
  ],
  humps: [],
  briars: [
    { id: 'bed', x0: 470, base: FLOOR, side: 'up', width: 26, spikes: heights(30, [44, 34, 50, 38, 44, 34]) },
    // Beat 02: one low tuft with plenty of clearance.
    { id: 'tuft', x0: 1764, base: FLOOR, side: 'up', spikes: [40, 59] },
    // Beat 03: the thorn seed floats one Puff-width above this tuft.
    { id: 'seed-tuft', x0: 2420, base: FLOOR, side: 'up', spikes: [47, 62] },
    { id: 'log-thorns', x0: 3460, base: 117, side: 'down', width: 24, spikes: heights(56, [28, 20, 28, 18, 28, 22]) },
    ...slalom,
  ],
  // Beat 06: a seesaw lifts a hanging briar curtain. Tip it, then slip under before it drops back.
  seesaws: [{ id: 'curtain-log', px: 5023, py: 300, half: 110, high: 'right', mode: 'return', returnAfter: 3.5 }],
  gates: [],
  curtains: [{ id: 'curtain', x0: 5323, x1: 5347, openBottom: 205, closedBottom: FLOOR - 4, link: 'curtain-log' }],
  wheels: [],
  pebbles: [],
  seeds: [
    { id: 'thorn', x: 2450, y: 255 }, // beat 03: the first optional risk
    { id: 'low', x: 5440, y: 330 }, // beat 07: a late, low line past the curtain
    { id: 'pocket', x: 6800, y: 200 }, // beat 09: the one wide pocket in the slalom
  ],
  bubbles: [],
  orbs: [],
  crushers: [],
  blooms: [
    { id: 'bloom-1', x: 3075 }, // beat 04
    { id: 'bloom-2', x: 6201 }, // beat 08: right before the peak, so retries stay under 10s
  ],
};
