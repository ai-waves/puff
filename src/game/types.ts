// Level data. Every level is plain data: the sim reads it, the renderer draws it.
// Coordinates are world points: x is distance along the level, y grows downward (0 = top of screen).

export type Look = 'block' | 'log' | 'shelf' | 'ledge' | 'vine' | 'lip' | 'mound';

export interface Corners {
  tl?: number;
  tr?: number;
  br?: number;
  bl?: number;
}

// Static solid rectangle. Safe to touch: Puff bumps off it.
export interface RectDef {
  id: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  look?: Look;
  round?: Corners;
}

// Moss mound: a soft round hump rising from the floor. Bouncy, never deadly.
export interface HumpDef {
  id: string;
  cx: number;
  width: number;
  height: number;
}

// Briar: a row of static spikes. 'up' spikes stand on base y, 'down' spikes hang from it.
export interface BriarDef {
  id: string;
  x0: number;
  base: number;
  side: 'up' | 'down';
  spikes: number[]; // spike heights, left to right
  width?: number; // spike width, default 20
}

// Mossback log: a seesaw. Landing on its high end tips it.
export interface SeesawDef {
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
}

// Gate: a bar hanging from the roof. Closed, it reaches the floor.
export interface GateDef {
  id: string;
  x: number;
  openBottom: number; // bar's bottom edge when fully open
  link: string; // seesaw that works it
  // latch: opens when its log tips and stays open.
  // timed: opens when its log tips, then drifts shut over closeTime once Puff comes within closeAhead.
  mode: 'latch' | 'timed';
  closeTime?: number;
  closeAhead?: number;
}

// Thorn curtain: a hanging briar lifted by a seesaw. Deadly.
export interface CurtainDef {
  id: string;
  x0: number;
  x1: number;
  openBottom: number;
  closedBottom: number;
  link: string;
}

export interface WheelDef {
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

export interface PebbleDef {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface SeedDef {
  id: string;
  x: number;
  y: number;
  orbit?: { wheel: string; radius: number }; // rides a thornwheel's missing tooth
}

export interface BubbleDef {
  id: string;
  x: number;
  y: number;
}

export interface BloomDef {
  id: string;
  x: number;
}

export interface LabelDef {
  text: string;
  x: number;
  y: number;
}

export interface RootDef {
  x: number;
  y0: number;
  len: number;
}

export interface LevelDef {
  id: string; // '1-1'
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
  deaths: 'none' | 'instant' | 'screen';
  goalClones: number; // clones home for the badge; 1 when the level has no Split
  hint?: boolean; // 1-1's "Hold" ring
  perch?: boolean; // start resting on a dandelion head
  lingerAtBloom?: boolean; // camera lingers 0.5s at the first bloom
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
}
