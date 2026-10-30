import type { LevelDef } from '../types';
import { beatCrusher, bramble, FLOOR, ROOF } from './util';

// 1-9 · Fernshade. Teach: change size on the fly. About 85 seconds.
// Chapter 2's three ideas together: Swell to tip a heavy log, then Shrink at once for the bramble
// beyond it, and low rootcrushers that only a shrunk Puff can slip under before they slam.
const START = 300;
const GATE_OPEN = ROOF + 26;
const LOW = 330; // a low crusher's underside: only a shrunk Puff fits beneath it
const crusher = (id: string, x: number, width: number, rest: number, period: number, late?: number) => beatCrusher(9, START, id, x, width, rest, period, late);

export const L19: LevelDef = {
  id: '1-9',
  n: 9,
  world: 1,
  name: 'Fernshade',
  blurb: 'Big for the logs, small for the brambles.',
  teach: 'Teach: change size on the fly.',
  length: 10800,
  startX: START,
  startY: 190,
  burrowX: 10450,
  sky: [
    [0, 0xad6b64],
    [1, 0x8e4b49],
  ],
  sunX: 660,
  sunY: 210,
  deaths: 'instant',
  goalClones: 1,
  rects: [],
  humps: [
    { id: 'mound-1', cx: 850, width: 640, height: 70 },
    { id: 'mound-2', cx: 8900, width: 1000, height: 90 }, // beat 08: soft ground on the way home
  ],
  briars: [
    ...bramble('swap', 2550, 6, ROOF, FLOOR, 191, 22), // beat 02: Swell for the log, then Shrink for this
    ...bramble('swap-2', 6600, 6, ROOF, FLOOR, 191, 22), // beat 06: the same, faster
  ],
  seesaws: [
    { id: 'heavy-1', px: 1850, py: 300, half: 100, high: 'right', heavy: true }, // beat 02
    { id: 'heavy-2', px: 5950, py: 300, half: 100, high: 'right', heavy: true }, // beat 06
  ],
  gates: [
    { id: 'gate-1', x: 2150, openBottom: GATE_OPEN, link: 'heavy-1', mode: 'latch' },
    { id: 'gate-2', x: 6250, openBottom: GATE_OPEN, link: 'heavy-2', mode: 'latch' },
  ],
  curtains: [],
  wheels: [],
  pebbles: [],
  seeds: [
    { id: 'swap', x: 2622, y: 191 }, // beat 02: in the bramble gap itself
    // Beat 04: on the floor under the first low crusher.
    { id: 'slot', x: 3860, y: 342, route: [[3400, 300], [3560, 336], [4000, 337], [4150, 300]] },
    { id: 'heavy-end', x: 6040, y: 250, ride: { log: 'heavy-2', at: 0.8, lift: 26 } }, // beat 06: on the heavy log's high end
  ],
  bubbles: [],
  orbs: [
    { id: 'swell-1', x: 1500, y: 200, kind: 'swell', time: 6 }, // beat 02
    { id: 'shrink-1', x: 2350, y: 191, kind: 'shrink', time: 5 }, // straight after the gate
    { id: 'shrink-2', x: 3560, y: 336, kind: 'shrink', time: 8 }, // beat 04: low, for both low crushers
    { id: 'swell-2', x: 5600, y: 200, kind: 'swell', time: 6 }, // beat 06
    { id: 'shrink-3', x: 6400, y: 191, kind: 'shrink', time: 5 },
  ],
  crushers: [
    // Beat 04: two low crushers. Hug the floor, small, between slams.
    crusher('low-1', 3860, 60, LOW, 3.2),
    crusher('low-2', 4300, 60, LOW, 3.2),
    // Beat 07: one more, high this time, after the second bramble.
    crusher('last', 7300, 90, 200, 3.2),
  ],
  blooms: [
    { id: 'bloom-1', x: 3000 }, // beat 03
    { id: 'bloom-2', x: 5200 }, // beat 05
  ],
  // Swell, drop onto the heavy log, Shrink, thread the bramble; hug the floor under the low crushers.
  route: [
    [1300, 200], [1500, 200], [1720, 210], [1900, 262], [2050, 320], [2250, 250], [2350, 191], [2750, 191],
    [3400, 300], [3560, 336], [4400, 337], [4550, 280],
    [5400, 200], [5600, 200], [5820, 210], [6000, 262], [6150, 320], [6330, 250], [6400, 191], [6800, 191],
  ],
};
