import { tuning } from '../../config/tuning';
import type { BriarDef, LevelDef } from '../types';
import { bramble, FLOOR, ROOF } from './util';

// 1-7 · Needle's Eye. Teach: smaller fits. About 85 seconds.
// The Shrink card: "0.5x. Slips through bramble gaps." The Briar card: "Shrink to pass between
// them." A bramble gap here is two rows of thorns tip to tip, 22pt apart: a normal Puff can't help
// touching them, a shrunk one (15pt across) slips through.
const { gap } = tuning(7); // 104pt at the slalom
const EYE = 22;

const eye = (id: string, x0: number, count: number, top: number, bottom: number, mid: number) => bramble(id, x0, count, top, bottom, mid, EYE);

// Beat 07: the slalom from 1-3, with a Shrink at its mouth that wears off partway through.
const SLALOM_FLOOR_TIPS = [245, 225, 255];
const slalom: BriarDef[] = [];
[5900, 6400, 6900].forEach((x0, i) => {
  const floorTip = SLALOM_FLOOR_TIPS[i]!;
  const up = FLOOR - floorTip;
  const down = floorTip - gap - ROOF;
  slalom.push({ id: `slalom-floor-${i + 1}`, x0, base: FLOOR, side: 'up', width: 24, spikes: [up * 0.6, up * 0.85, up, up * 0.85, up * 0.6] });
  slalom.push({ id: `slalom-roof-${i + 1}`, x0: x0 + 90, base: ROOF, side: 'down', width: 24, spikes: [down * 0.6, down * 0.85, down, down * 0.85, down * 0.6] });
});

export const L17: LevelDef = {
  id: '1-7',
  n: 7,
  world: 1,
  name: "Needle's Eye",
  blurb: 'Shrink to slip through the brambles.',
  teach: 'Teach: smaller fits.',
  length: 10400,
  startX: 300,
  startY: 190,
  burrowX: 10050,
  sky: [
    [0, 0xd4876c],
    [1, 0xb95f52],
  ],
  sunX: 680,
  sunY: 180,
  deaths: 'instant',
  goalClones: 1,
  rects: [
    // Beat 03: a shelf splits the way. The lower lane holds a bramble eye and a seed.
    { id: 'lane-shelf', look: 'shelf', x0: 2450, x1: 3000, y0: 200, y1: 240, round: { tl: 8, tr: 8, bl: 8, br: 8 } },
    // Beat 08: the same again, the eye in the upper lane this time.
    { id: 'high-shelf', look: 'shelf', x0: 7500, x1: 8000, y0: 150, y1: 190, round: { tl: 8, tr: 8, bl: 8, br: 8 } },
  ],
  // Beat 01: a soft mound to wake up on.
  humps: [{ id: 'mound-1', cx: 900, width: 700, height: 70 }],
  briars: [
    ...eye('lane-eye', 2600, 6, 240, FLOOR, 295), // beat 03
    ...eye('needle', 3800, 8, ROOF, FLOOR, 191), // beat 05: the whole way is a bramble wall with an eye
    ...slalom, // beat 07
    ...eye('high-eye', 7650, 4, ROOF, 150, 82), // beat 08
  ],
  seesaws: [],
  gates: [],
  curtains: [],
  wheels: [],
  pebbles: [],
  seeds: [
    // Beat 03: past the eye in the lower lane.
    { id: 'lane', x: 2850, y: 300, route: [[2200, 260], [2380, 295], [2900, 295], [3050, 250]] },
    { id: 'needle', x: 3896, y: 191 }, // beat 05: in the eye itself
    // Beat 08: in the upper lane's eye.
    { id: 'thimble', x: 7698, y: 82, route: [[7250, 120], [7400, 82], [7800, 82], [8050, 150]] },
  ],
  bubbles: [],
  orbs: [
    { id: 'shrink-1', x: 1600, y: 190, kind: 'shrink', time: 5 }, // beat 02: in open sky
    { id: 'shrink-2', x: 2400, y: 295, kind: 'shrink', time: 5 }, // beat 03: at the lower lane's mouth
    { id: 'shrink-3', x: 3560, y: 191, kind: 'shrink', time: 5 }, // beat 05
    { id: 'shrink-4', x: 5650, y: 200, kind: 'shrink', time: 6 }, // beat 07: wears off in the slalom
    { id: 'shrink-5', x: 7400, y: 82, kind: 'shrink', time: 5 }, // beat 08
  ],
  crushers: [],
  blooms: [
    { id: 'bloom-1', x: 2100 }, // beat 04
    { id: 'bloom-2', x: 5000 }, // beat 06
  ],
  route: [[3300, 191], [3560, 191], [4100, 191]],
};
