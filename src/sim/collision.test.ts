import { describe, expect, it } from 'vitest';
import { clearance, cornersOf, overlaps } from './collision.ts';
import type { OrientedBox } from './collision.ts';

const box = (centerX: number, centerZ: number, halfLengthM = 1, halfWidthM = 1, headingRad = 0): OrientedBox => ({
  centerX,
  centerZ,
  halfLengthM,
  halfWidthM,
  headingRad,
});

describe('oriented boxes', () => {
  it('has its corners along the heading (length) and across it (width)', () => {
    const corners = cornersOf(box(0, 0, 2, 1, Math.PI / 2));

    // Facing +x: length runs along x, width along z.
    expect(corners.map((corner) => [Math.round(corner.x), Math.round(corner.z)])).toEqual(
      expect.arrayContaining([
        [2, 1],
        [2, -1],
        [-2, 1],
        [-2, -1],
      ]),
    );
  });

  it('overlap only when they really intersect; touching is not overlapping', () => {
    expect(overlaps(box(0, 0), box(1.5, 0))).toBe(true);
    expect(overlaps(box(0, 0), box(2, 0))).toBe(false);
    expect(overlaps(box(0, 0), box(3, 0))).toBe(false);
  });

  it('use every axis: a rotated box next to a corner does not overlap', () => {
    // A 2 × 2 box turned 45° shows a face (1 m from its centre) to the square's corner, which is √2 m from the origin;
    // place it so that face stops 0.1 m short of the corner. Only the turned box's own axis separates them.
    const tipDistance = Math.SQRT2 + 0.1 + 1;
    const diamond = box(tipDistance / Math.SQRT2, tipDistance / Math.SQRT2, 1, 1, Math.PI / 4);

    expect(overlaps(box(0, 0), diamond)).toBe(false);
    expect(clearance(box(0, 0), diamond)).toBeCloseTo(0.1, 6);
  });

  it('measure the gap between separate boxes and zero when they overlap', () => {
    expect(clearance(box(0, 0), box(2.5, 0))).toBeCloseTo(0.5, 9);
    expect(clearance(box(0, 0), box(2.3, 2.4))).toBeCloseTo(Math.hypot(0.3, 0.4), 9);
    expect(clearance(box(0, 0), box(1, 0))).toBe(0);
  });
});
