import { tuning } from '../../config/tuning';
import type { LevelDef } from '../types';
import { beatCrusher } from './util';

// 1-8 · Rootfall. Teach: some things move on a beat. About 85 seconds.
// The Rootcrusher card: "Slams on a beat. Watch the dust fall before it drops." Each crusher is a
// column of roots: up, Puff flies under it; down, it's a wall that only bumps. Each beat is set so
// that a Puff keeping its place on screen meets the crusher just after it lifts.
const t = tuning(8);
const START = 300;
const crusher = (id: string, x: number, width: number, rest: number, period: number, late?: number) => beatCrusher(8, START, id, x, width, rest, period, late);

export const L18: LevelDef = {
  id: '1-8',
  n: 8,
  world: 1,
  name: 'Rootfall',
  blurb: 'Rootcrushers slam on a beat. Reach the burrow.',
  teach: 'Teach: some things move on a beat.',
  length: 10600,
  startX: START,
  startY: 190,
  burrowX: 10250,
  sky: [
    [0, 0xc27868],
    [1, 0xa5554e],
  ],
  sunX: 670,
  sunY: 195,
  deaths: 'instant',
  goalClones: 1,
  rects: [],
  humps: [
    { id: 'mound-1', cx: 800, width: 600, height: 60 },
    { id: 'mound-2', cx: 8600, width: 900, height: 90 }, // beat 08: soft ground on the way home
  ],
  briars: [],
  seesaws: [],
  gates: [],
  curtains: [],
  wheels: [
    // Beat 06: a thornwheel on a post between two crushers: dive, rise, dive.
    { id: 'between', cx: 6800, cy: 285, r: 45, spin: t.spin, post: true },
  ],
  pebbles: [],
  seeds: [
    { id: 'under', x: 2600, y: 332 }, // beat 02: on the floor right under a crusher
    // Beat 04: tucked against the middle crusher of the row, low, on its far side.
    { id: 'row', x: 4560, y: 330 },
    // Beat 06: just over the thornwheel's teeth.
    { id: 'crown', x: 6800, y: 214, route: [[6400, 260], [6560, 300], [6700, 222], [6900, 222], [7000, 300], [7250, 260]] },
  ],
  bubbles: [],
  orbs: [],
  crushers: [
    crusher('first', 1500, 80, 170, 4, 0.4), // beat 01: a slow, wide-open first one
    crusher('seed', 2600, 100, 190, 3.2), // beat 02
    crusher('row-1', 4200, 80, 180, 3.2), // beat 04: a row, each a beat behind the last
    crusher('row-2', 4500, 80, 180, 3.2),
    crusher('row-3', 4800, 80, 180, 3.2),
    crusher('weave-1', 6500, 80, 200, 3.2), // beat 06
    crusher('weave-2', 7100, 80, 200, 3.2),
  ],
  blooms: [
    { id: 'bloom-1', x: 3300 }, // beat 03
    { id: 'bloom-2', x: 5600 }, // beat 05
  ],
};
