// Difficulty ramp from the design board: D(n) = (1 + ramp)^(n - 1).
// Each tuning value scales with D: speeds and checkpoint spacing grow, gaps and timing windows shrink.
export const RAMP_PER_LEVEL = 0.01;

export function difficulty(levelNumber: number, ramp = RAMP_PER_LEVEL): number {
  return Math.pow(1 + ramp, levelNumber - 1);
}

export function tuningFor(levelNumber: number, ramp = RAMP_PER_LEVEL) {
  const d = difficulty(levelNumber, ramp);
  return {
    d,
    scrollSpeed: 120 * d, // pt/s
    hazardSpeed: 90 * d, // wheel spin, deg/s
    narrowestGap: 110 / d, // pt
    tapWindowMs: 600 / d,
    checkpointSpacing: 3600 * d, // pt
  };
}
