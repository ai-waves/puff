import { tuning } from '../../config/tuning';
import type { LevelDef } from '../types';
import { FLOOR, ROOF, heights } from './util';

// 1-5 · Thornwheel Glade. Chapter finale. Teach: hazards move. About 110 seconds.
// Everything from 1-1 to 1-4 comes back. Map: 1720px = 11,000pt (x scale 6.40).
const { spin } = tuning(5); // 94 deg/s

export const L15: LevelDef = {
  id: '1-5',
  n: 5,
  world: 1,
  name: 'Thornwheel Glade',
  blurb: 'Thornwheels spin. Bring 6 clones home.',
  teach: 'Teach: hazards move.',
  length: 11000,
  startX: 320,
  startY: 210,
  burrowX: 10648,
  sky: [
    [0, 0xeaa676],
    [1, 0xd67459],
  ],
  sunX: 690,
  sunY: 150,
  deaths: 'screen',
  goalClones: 6,
  rects: [
    // Beat 01: the ledge the resting wheel hangs from.
    { id: 'ledge', look: 'ledge', x0: 703, x1: 1535, y0: ROOF, y1: 54, round: { bl: 13, br: 13 } },
    // Beat 05: the mound the pebble rests on.
    { id: 'mound', look: 'mound', x0: 4221, x1: 4988, y0: 257, y1: FLOOR, round: { tl: 60, tr: 60 } },
  ],
  humps: [],
  briars: [
    // Beat 09: the glade's briar floor.
    { id: 'glade-floor', x0: 8570, base: FLOOR, side: 'up', width: 24, spikes: heights(69, [40, 28, 40, 31]) },
  ],
  seesaws: [
    // Beat 08: the wheel's thorns knock this log on a steady beat.
    { id: 'beat-log', px: 7930, py: 300, half: 110, high: 'left', mode: 'beat', beat: 1.5 },
  ],
  gates: [],
  curtains: [],
  wheels: [
    { id: 'resting', cx: 1119, cy: 88, r: 30, spin: 30, hang: 54 }, // beat 01: turns slowly above the path
    { id: 'first', cx: 2366, cy: 210, r: 48, spin }, // beat 02: over or under both work
    { id: 'orbit', cx: 3294, cy: 187, r: 42, spin: -spin, missingTooth: true }, // beat 03
    { id: 'jam', cx: 5260, cy: 290, r: 50, spin, jammable: true, post: true }, // beat 05
    { id: 'flock', cx: 6395, cy: 204, r: 48, spin: -spin }, // beat 06
    { id: 'knocker', cx: 7770, cy: 230, r: 40, spin }, // beat 08
    { id: 'glade-1', cx: 8928, cy: 95, r: 43, spin }, // beat 09: three counter-rotating wheels
    { id: 'glade-2', cx: 9439, cy: 235, r: 43, spin: -spin },
    { id: 'glade-3', cx: 9951, cy: 104, r: 43, spin },
  ],
  pebbles: [{ id: 'pebble', x: 4822, y: 257 - 14, r: 14 }], // beat 05: push it into the wheel's axle
  seeds: [
    { id: 'orbit', x: 3294, y: 141, orbit: { wheel: 'orbit', radius: 46 } }, // beat 03: rides the missing tooth
    // Beat 08: the rhythm seed, low just past the log's end. Dive for it as the end swings down;
    // as it swings up, it knocks Puff away.
    { id: 'up-beat', x: 8062, y: 336 },
    { id: 'shadow', x: 9439, y: 93 }, // beat 09: in the centre wheel's shadow
  ],
  bubbles: [
    { id: 'bubble-1', x: 5871, y: 129 }, // beat 06: right before a wheel
    { id: 'bubble-2', x: 7150, y: 70 }, // beat 07: two bubbles off the main line top the flock up to 6
    { id: 'bubble-3', x: 7350, y: 322 },
  ],
  blooms: [
    { id: 'bloom-1', x: 3908 }, // beat 04: wheels freeze for 1s after a respawn
    { id: 'bloom-2', x: 6977 }, // beat 07
    { id: 'bloom-3', x: 8397 }, // beat 09: just before the glade
  ],
};
