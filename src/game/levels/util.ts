import { PLAYFIELD } from '../../config/constants';

export const { roofY: ROOF, floorY: FLOOR } = PLAYFIELD;

// Repeat a height pattern across n spikes.
export function heights(n: number, pattern: number[]): number[] {
  return Array.from({ length: n }, (_, i) => pattern[i % pattern.length]!);
}
