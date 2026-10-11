import { describe, expect, it } from 'vitest';
import { overlaps } from '../collision.ts';
import { EXAM_CAR, bodyBox } from '../vehicle.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from './practiceYard.ts';

describe('practice yard', () => {
  it('starts the car clear of every obstacle', () => {
    const body = bodyBox(EXAM_CAR, PRACTICE_YARD_START);

    expect(PRACTICE_YARD.obstacles.filter((obstacle) => overlaps(body, obstacle.box))).toEqual([]);
  });

  it('paints the parking box outline between its posts', () => {
    const markings = PRACTICE_YARD.markings ?? [];
    const zs = markings.flatMap((line) => [line.centerZ - line.halfLengthM, line.centerZ + line.halfLengthM]);

    expect(markings).toHaveLength(4);
    // The 6 m are measured outside the painted lines, as in the garage (F02-T01-FIX01).
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(6, 6);
  });

  it('marks a 6 m parking box with posts and has a kerb and enclosing walls', () => {
    const posts = PRACTICE_YARD.obstacles.filter((obstacle) => obstacle.kind === 'pole');
    const zs = posts.map((post) => post.box.centerZ);

    expect(posts).toHaveLength(4);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(6, 6);
    expect(PRACTICE_YARD.obstacles.some((obstacle) => obstacle.kind === 'curb')).toBe(true);
    expect(PRACTICE_YARD.obstacles.filter((obstacle) => obstacle.kind === 'wall')).toHaveLength(4);
  });
});
