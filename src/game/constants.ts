// Logical units are points (pt). The design board draws phone screens at 844 x 390.
export const SCREEN = { width: 844, height: 390 } as const;

// Roof and ground bands from the design's D1 frame (14pt roof, 44pt ground).
export const PLAYFIELD = { roofY: 14, floorY: 346 } as const;

export const PUFF = { radius: 15, screenX: 200 } as const;

// Physics is the same on all 40 levels (design: "Physics stays the same").
export const PHYSICS = {
  gravity: 300, // pt/s^2, always pulls down
  lift: 420, // pt/s^2, added while the player holds
  maxVy: 480, // pt/s, implementation cap so a long hold can't overshoot the roof
} as const;

// How far a bump pushes Puff back, and how fast that lag recovers.
export const BUMP_BACK = 24; // pt
export const LAG_RECOVERY = 60; // pt/s

// Fixed simulation step. Rendering interpolates nothing; the sim is always on whole steps.
export const SIM_STEP = 1 / 120; // s
