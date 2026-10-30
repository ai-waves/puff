export type SolidKind = 'mound' | 'vine' | 'log' | 'overhang' | 'plank' | 'wall';

// A rectangle Puff can bump into. Nothing in chapter 1 is lethal yet.
export interface Solid {
  id: string;
  kind: SolidKind;
  x0: number;
  x1: number;
  y0: number; // top edge
  y1: number; // bottom edge
}

export interface Seed {
  id: string;
  x: number;
  y: number;
}

export interface Checkpoint {
  id: string;
  x: number;
}

export interface Level {
  id: string;
  name: string;
  length: number; // pt, full stage
  burrowX: number; // pt, reaching this completes the level
  roofY: number;
  floorY: number;
  solids: Solid[];
  seeds: Seed[];
  checkpoints: Checkpoint[];
}
