import { describe, expect, it } from 'vitest';
import { angleDiff, circleCapsule, circleCircle, circleRect, circleTriangle } from './geometry';

describe('geometry', () => {
  it('pushes a circle out of the nearest rect face', () => {
    const c = circleRect(0, 5, 10, 8, -50, 40, 50)!;
    expect(c.nx).toBe(-1);
    expect(c.depth).toBeCloseTo(2);
    expect(circleRect(-20, 5, 10, 8, -50, 40, 50)).toBeNull();
  });

  it('pushes a centre inside a rect out of the closest face', () => {
    const c = circleRect(10, 0, 5, 0, -100, 100, 100)!;
    expect(c.nx).toBe(-1);
    expect(c.depth).toBe(15);
  });

  it('separates overlapping circles along the line between them', () => {
    const c = circleCircle(0, -15, 10, 0, 0, 10)!;
    expect(c.ny).toBe(-1);
    expect(c.depth).toBe(5);
  });

  it('finds contact with the middle of a capsule', () => {
    const c = circleCapsule(50, -12, 10, 0, 0, 100, 0, 5)!;
    expect(c.ny).toBe(-1);
    expect(c.depth).toBeCloseTo(3);
  });

  it('detects a circle touching a spike', () => {
    expect(circleTriangle(10, -15, 6, 0, 0, 20, 0, 10, -30)).toBe(true);
    expect(circleTriangle(40, -15, 6, 0, 0, 20, 0, 10, -30)).toBe(false);
  });

  it('wraps angle differences', () => {
    expect(angleDiff(0.1, Math.PI * 2)).toBeCloseTo(0.1);
  });
});
