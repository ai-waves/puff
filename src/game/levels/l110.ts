import { tuning } from '../../config/tuning';
import type { LevelDef } from '../types';
import { beatCrusher, bramble, FLOOR, ROOF } from './util';

// 1-10 · Last Light. Chapter 2 finale. Teach: everything, with a flock. About 95 seconds.
// The sun is nearly down (the board: "level 10 is the last light"). Swell and Shrink take the whole
// flock when it flies through the orb together, and a shrunk flock bunches up to fit a bramble gap.
const t = tuning(10);
const START = 300;
const GATE_OPEN = ROOF + 26;
const crusher = (id: string, x: number, width: number, rest: number, period: number, late?: number) => beatCrusher(10, START, id, x, width, rest, period, late);

export const L110: LevelDef = {
  id: '1-10',
  n: 10,
  world: 1,
  name: 'Last Light',
  blurb: 'The last light. Bring 6 clones home.',
  teach: 'Teach: everything at once.',
  length: 12000,
  startX: START,
  startY: 190,
  burrowX: 11650,
  sky: [
    [0, 0x956060],
    [1, 0x7c3a39],
  ],
  sunX: 640,
  sunY: 235,
  deaths: 'screen',
  goalClones: 6,
  rects: [],
  humps: [{ id: 'home-mound', cx: 10700, width: 1100, height: 90 }],
  briars: [
    ...bramble('eye', 6050, 4, ROOF, FLOOR, 191, 40), // beat 08: a flock-sized gap, for a shrunk flock
    // Beat 11: two tufts with the last seed between them; any clone can reach down for it.
    { id: 'tuft-a', x0: 9150, base: FLOOR, side: 'up', spikes: [50, 66] },
    { id: 'tuft-b', x0: 9440, base: FLOOR, side: 'up', spikes: [62, 48] },
  ],
  seesaws: [{ id: 'heavy-1', px: 3750, py: 300, half: 110, high: 'right', heavy: true }], // beat 05
  gates: [{ id: 'gate-1', x: 4100, openBottom: GATE_OPEN, link: 'heavy-1', mode: 'latch' }],
  curtains: [],
  wheels: [
    // Beat 09: the glade weave, crushers and thornwheels in turn.
    { id: 'glade-1', cx: 7350, cy: 300, r: 40, spin: t.spin, post: true },
    { id: 'glade-2', cx: 8050, cy: 90, r: 40, spin: -t.spin, hang: ROOF },
  ],
  pebbles: [],
  seeds: [
    { id: 'heavy-end', x: 3860, y: 250, ride: { log: 'heavy-1', at: 0.8, lift: 26 } }, // beat 05
    { id: 'eye', x: 6098, y: 191 }, // beat 08: in the bramble gap
    { id: 'last-light', x: 9315, y: 326, route: [[9000, 230], [9200, 280], [9315, 310], [9420, 280], [9600, 230]] }, // beat 11
  ],
  bubbles: [
    { id: 'bubble-1', x: 900, y: 190 }, // beat 01: two
    { id: 'bubble-2', x: 2500, y: 190 }, // beat 03: four
    { id: 'bubble-3', x: 4700, y: 190 }, // beat 06: topped up to six, with a second chance just behind
    { id: 'bubble-4', x: 4860, y: 190 },
  ],
  orbs: [
    { id: 'swell-1', x: 3400, y: 200, kind: 'swell', time: 6 }, // beat 05: the whole flock swells
    { id: 'shrink-1', x: 5800, y: 191, kind: 'shrink', time: 6 }, // beat 08: the whole flock shrinks
  ],
  crushers: [
    crusher('pair-1', 1700, 80, 180, 3.2), // beat 02: the first crushers, flock in tow
    crusher('pair-2', 2100, 80, 180, 3.2),
    crusher('glade-c1', 7000, 80, 170, 3.2), // beat 09
    crusher('glade-c2', 7700, 80, 170, 3.2),
  ],
  blooms: [
    { id: 'bloom-1', x: 2900 }, // beat 04: saves the flock
    { id: 'bloom-2', x: 5300 }, // beat 07
    { id: 'bloom-3', x: 8600 }, // beat 10
  ],
  route: [
    [3200, 200], [3400, 200], [3620, 210], [3800, 262], [3950, 320], [4150, 270],
    [5600, 191], [6300, 191],
    [6800, 215], [7400, 215], [7900, 215], [8300, 215],
  ],
};
