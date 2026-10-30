// Difficulty from the level board: D(n) = (1 + ramp)^(n - 1), applied to every tuning value.
export const RAMP = 0.01;

export function difficulty(n: number, ramp = RAMP): number {
  return Math.pow(1 + ramp, n - 1);
}

// Values exactly as the board's renderVals() rounds them for level n.
export function tuning(n: number, ramp = RAMP) {
  const d = difficulty(n, ramp);
  return {
    d,
    speed: 120 * d, // scroll speed, pt/s
    gap: Math.round(110 / d), // narrowest gap, pt
    tapWindowMs: Math.round(600 / d),
    checkpointSpacing: Math.round(3600 * d),
    spin: Math.round(90 * d), // thornwheel spin, deg/s
  };
}
