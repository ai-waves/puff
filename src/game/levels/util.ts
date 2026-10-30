import { PLAYFIELD } from '../../config/constants';
import { tuning } from '../../config/tuning';
import type { BriarDef, CrusherDef } from '../types';

export const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;

// Repeat a height pattern across n spikes.
export function heights(n: number, pattern: number[]): number[] {
  return Array.from({ length: n }, (_, i) => pattern[i % pattern.length]!);
}

// A rootcrusher whose beat meets a Puff flying at level n's scroll pace from startX: it arrives
// `late` seconds after the crusher has finished lifting (slam, hold and rise take ~1.4s).
export function beatCrusher(n: number, startX: number, id: string, x: number, width: number, rest: number, period: number, late = 0.25): CrusherDef {
  const t = tuning(n);
  const arrive = (px: number) => (px - startX) / t.speed + 0.5; // ~0.5s to get going after the first hold
  const lifted = 0.14 + (0.45 + 0.9) / t.d;
  return { id, x, width, rest, period, offset: lifted + late - arrive(x - width / 2 - 15) };
}

// A bramble gap: a row of thorns hanging from `top` and a row rising from `bottom`, tip to tip,
// leaving `gap` pt around `mid`.
export function bramble(id: string, x0: number, count: number, top: number, bottom: number, mid: number, gap: number): BriarDef[] {
  return [
    { id: `${id}-top`, x0, base: top, side: 'down', width: 24, spikes: Array(count).fill(mid - gap / 2 - top) },
    { id: `${id}-bottom`, x0, base: bottom, side: 'up', width: 24, spikes: Array(count).fill(bottom - (mid + gap / 2)) },
  ];
}
