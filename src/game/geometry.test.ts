import { describe, expect, it } from 'vitest';
import { circleTriangle, closestOnSegment } from './geometry';

describe('geometry', () => {
  it('finds the closest point on a segment, clamped to its ends', () => {
    expect(closestOnSegment(50, -12, 0, 0, 100, 0)).toMatchObject({ x: 50, y: 0 });
    expect(closestOnSegment(-30, 5, 0, 0, 100, 0)).toMatchObject({ x: 0, y: 0, t: 0 });
  });

  it('detects a circle touching a spike', () => {
    expect(circleTriangle(10, -15, 6, 0, 0, 20, 0, 10, -30)).toBe(true);
    expect(circleTriangle(40, -15, 6, 0, 0, 20, 0, 10, -30)).toBe(false);
  });
});
