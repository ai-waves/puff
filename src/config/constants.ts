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

export const BUMP_BACK = 24; // pt a bump pushes a Puff back
export const RESPAWN_TIME = 0.4; // s, burst of fluff before Puff re-forms (1-3)
export const WHEEL_FREEZE = 1; // s, thornwheels hold still after a respawn (1-5)
export const STUCK_REWIND = 3; // s pressed against a closed gate before drifting back
export const MAX_PUFFS = 6;
export const CLONE_LAG = 0.08; // s (1-4 tuning: clone lag 80 ms)
export const CLONE_SPREAD = 45; // pt (1-4 tuning: spread 45 pt)
export const SIM_STEP = 1 / 120;
export const HINT_RETURN = 4; // s without a hold before the hint returns
