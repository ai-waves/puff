// Level data. Every level is plain data: the sim reads it, the renderer draws it.
// Coordinates are world points: x is distance along the level, y grows downward (0 = top of screen).

export type Look = 'block' | 'log' | 'shelf' | 'ledge' | 'vine' | 'lip' | 'mound';

// Every object can carry a designer's note: what it's for in the level's beats. The level editor
// shows and edits it; the game ignores it.
export interface Noted {
  note?: string;
}

export interface Corners {
  tl?: number;
  tr?: number;
  br?: number;
  bl?: number;
}

// Static solid rectangle. Safe to touch: Puff bumps off it.
export interface RectDef extends Noted {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  look?: Look;
  round?: Corners;
}

// Moss mound: a soft round hump rising from the floor. Bouncy, never deadly.
export interface HumpDef extends Noted {
  id: string;
  cx: number;
  width: number;
  height: number;
}

// Briar: a row of static spikes. 'up' spikes stand on base y, 'down' spikes hang from it.
export interface BriarDef extends Noted {
  id: string;
  x0: number;
  base: number;
  side: 'up' | 'down';
  spikes: number[]; // spike heights, left to right
  width?: number; // spike width, default 20
}

// Mossback log: a seesaw on a real hinge. Weight on its high end tips it.
export interface SeesawDef extends Noted {
  id: string;
  px: number; // pivot
  py: number;
  half: number; // half the plank length
  high: 'left' | 'right'; // which end starts raised
  baseY?: number; // where the fulcrum stands, default the floor
  // free: tips whenever something lands on the high end. dud: bounces, never tips.
  // return: tips back by itself after returnAfter seconds. beat: tipped by a thornwheel on a steady beat.
  mode?: 'free' | 'dud' | 'return' | 'beat';
  returnAfter?: number;
  beat?: number;
  // A heavy old log: its hinge holds against anything lighter than a swollen Puff.
  heavy?: boolean;
  cradle?: boolean; // a knot on the low end that holds a pebble until the log tips
}

// Gate: a bar hanging from the roof. Closed, it reaches the floor; open, it creaks up into the roof.
export interface GateDef extends Noted {
  id: string;
  x: number;
  openBottom: number; // bar's bottom edge when fully open, tucked under the roof
  link: string; // seesaw that works it
  // latch: opens when its log tips and stays open.
  // timed: opens when its log tips, then drifts shut over closeTime once Puff comes within closeAhead.
  mode: 'latch' | 'timed';
  closeTime?: number;
  closeAhead?: number;
}

// Thorn curtain: a hanging briar lifted by a seesaw. Deadly.
export interface CurtainDef extends Noted {
  id: string;
  x0: number;
  x1: number;
  openBottom: number;
  closedBottom: number;
  link: string;
}

export interface WheelDef extends Noted {
  id: string;
  cx: number;
  cy: number;
  r: number; // tip of the thorns
  spin: number; // deg/s, negative turns the other way
  missingTooth?: boolean; // a seed can ride in the gap
  jammable?: boolean; // a pebble in the axle stops it
  post?: boolean; // drawn on a post down to the floor
  hang?: number; // drawn hanging from this y
}

export interface PebbleDef extends Noted {
  id: string;
  x: number;
  y: number;
  r: number;
  heavy?: boolean; // a boulder: only a swollen Puff can shove it
}

// Rootcrusher: a column of roots from the roof that slams to the floor on a beat. Its toothed
// underside is deadly; its sides are safe. Dust falls from it just before it drops. Up, Puff flies
// under it; down, it's a wall.
export interface CrusherDef extends Noted {
  id: string;
  x: number; // centre
  width: number;
  rest: number; // y of its underside while raised
  period: number; // s per slam, before the 1% ramp
  offset?: number; // s, shifts this crusher's beat
}

// Swell and Shrink orbs. Touching one resizes every Puff touching it for a few seconds.
export interface OrbDef extends Noted {
  id: string;
  x: number;
  y: number;
  kind: 'swell' | 'shrink';
  time?: number; // s the size lasts, default 6
}

export interface SeedDef extends Noted {
  id: string;
  x: number;
  y: number;
  orbit?: { wheel: string; radius: number }; // rides a thornwheel's missing tooth
  // Rides a log: `at` runs from -1 (left end) to 1 (right end), `lift` is pt above its middle.
  ride?: { log: string; at: number; lift: number };
  route?: [number, number][]; // the designer's line to this seed, like LevelDef.route
}

export interface BubbleDef extends Noted {
  id: string;
  x: number;
  y: number;
}

export interface BloomDef extends Noted {
  id: string;
  x: number;
}

export interface LabelDef extends Noted {
  text: string;
  x: number;
  y: number;
}

export interface RootDef extends Noted {
  x: number;
  y0: number;
  len: number;
}

export interface LevelDef {
  id: string; // '1-1'
  notes?: string; // the level's design notes, from the board
  n: number; // global level number, 1-40
  world: number;
  name: string;
  blurb: string; // level-card goal line
  teach: string;
  length: number;
  startX: number;
  startY: number;
  burrowX: number;
  sky: [number, number][]; // gradient stops: [position 0-1, colour], top to bottom
  sunX: number;
  sunY: number;
  // instant: a lost run re-forms at the last bloom right away. screen: the A7 fail screen first.
  deaths: 'instant' | 'screen';
  goalClones: number; // clones home for the badge; 1 when the level has no Split
  hint?: boolean; // 1-1's "Hold" ring
  perch?: boolean; // start resting on a dandelion head
  lingerAtBloom?: boolean; // the scroll lingers 0.5s at the first bloom
  labels?: LabelDef[];
  roots?: RootDef[];
  rootTrail?: { x0: number; x1: number; y: number }; // root along the ceiling that points to a gate
  rects: RectDef[];
  humps: HumpDef[];
  briars: BriarDef[];
  seesaws: SeesawDef[];
  gates: GateDef[];
  curtains: CurtainDef[];
  wheels: WheelDef[];
  pebbles: PebbleDef[];
  seeds: SeedDef[];
  bubbles: BubbleDef[];
  blooms: BloomDef[];
  orbs: OrbDef[];
  crushers: CrusherDef[];
  // The designer's line through a puzzle, as points the leader passes. Only the level tests use
  // it: their solver searches near it, and a win still has to happen in the real simulation.
  // Points more than 600pt apart leave the stretch between them free.
  route?: [number, number][];
}
