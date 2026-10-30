// Landscape iPhone, 844 x 390 pt (design board header).
export const SCREEN = { width: 844, height: 390 } as const;

// Notch-safe area from the board's safe-area overlay: 47pt each side, 21pt bottom.
export const SAFE = { left: 47, right: 47, bottom: 21 } as const;

// Root ceiling and ground bands in the gameplay frames (A4, D2).
export const PLAYFIELD = { roofY: 14, floorY: 350 } as const;

// Puff is 30pt across for collisions (level board); clones are drawn at half the leader's size.
export const PUFF_RADIUS = 15;
export const CLONE_RADIUS = 10;
export const PUFF_SCREEN_X = 280; // leader position on screen (A4 frame)

// Physics never changes across the 40 levels.
export const PHYSICS = {
  gravity: 300, // pt/s^2
  lift: 420, // pt/s^2 while held
  maxVy: 480, // pt/s, implementation cap
  bounce: 0.35, // moss mounds are soft and bouncy
} as const;

// Puff drifts forward on its own, toward its spot on screen. Blocked, it falls behind the scroll;
// once free it catches up. Its push is gentle, so props and walls can hold it back.
export const DRIFT = {
  pull: 4, // 1/s, how fast Puff matches its target speed
  accel: 300, // pt/s^2, the most the drift can push or brake
  ease: 200, // pt off its spot for the full catch-up or slow-down
  catchUp: 0.6, // up to 1.6x the scroll speed when behind
  slow: 0.5, // down to 0.5x when ahead
} as const;

// The screen scrolls on its own, like Badland. A Puff the left edge passes is lost; the front
// Puff can never run off the right edge, the scroll speeds up first.
export const EDGE_KILL = 0; // screen x a Puff's centre must stay right of
export const CAM_LEAD = 560; // screen x the front Puff can reach before the scroll speeds up

// Swell and Shrink (chapter 2).
export const SIZE = {
  swell: 1.8,
  shrink: 0.5,
  time: 6, // s, default
  rate: 4, // size changes per second, so a resize takes a quarter second
} as const;

export const RESPAWN_TIME = 0.4; // s, burst of fluff before Puff re-forms at the last bloom
export const WHEEL_FREEZE = 1; // s, thornwheels hold still after a respawn (1-5)
export const MAX_PUFFS = 6;
export const CLONE_LAG = 0.08; // s (1-4 tuning: clone lag 80 ms)
export const CLONE_SPREAD = 45; // pt (1-4 tuning: spread 45 pt)
export const SIM_STEP = 1 / 60; // Box2D's sweet spot, with 4 substeps
export const SUBSTEPS = 4;
export const HINT_RETURN = 4; // s without a hold before the hint returns
