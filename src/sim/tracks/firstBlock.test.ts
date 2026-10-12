import { describe, expect, it } from 'vitest';
import { overlaps } from '../collision.ts';
import { EXAM_CAR, bodyBox } from '../vehicle.ts';
import { FIRST_BLOCK, FIRST_BLOCK_START, FIRST_BLOCK_ZONES } from './firstBlock.ts';

describe('first block: Quesada from the box to Av. Cabildo (RECORRIDO.md, leg 1)', () => {
  it('starts the car in a 6 m box at the right kerb, clear of every obstacle', () => {
    const body = bodyBox(EXAM_CAR, FIRST_BLOCK_START);
    const posts = FIRST_BLOCK.obstacles.filter((obstacle) => obstacle.kind === 'pole');

    expect(FIRST_BLOCK.obstacles.filter((obstacle) => overlaps(body, obstacle.box))).toEqual([]);
    expect(posts).toHaveLength(4);
    expect(body.centerX).toBeLessThan(0);
  });

  it('has a 127 m block at 30 km/h ending at a stop line before the crosswalk and the avenue', () => {
    const { stopLineZ, crosswalk, intersection, blockLengthM, limits } = FIRST_BLOCK_ZONES;

    expect(blockLengthM).toBe(127);
    expect(limits).toEqual({ examKmh: 30, roadKmh: 30, avenueKmh: 45 });
    expect(stopLineZ).toBeLessThan(crosswalk.centerZ - crosswalk.halfLengthM);
    expect(crosswalk.centerZ + crosswalk.halfLengthM).toBeLessThanOrEqual(
      intersection.centerZ - intersection.halfLengthM,
    );
    expect(FIRST_BLOCK.scenario?.light.stopLineZ).toBe(stopLineZ);
  });

  it('keeps the street open: no obstacle crosses the lane between the box and the far side of the avenue', () => {
    const { intersection } = FIRST_BLOCK_ZONES;
    const lane = {
      centerX: -2,
      centerZ: (intersection.centerZ + intersection.halfLengthM) / 2,
      halfLengthM: (intersection.centerZ + intersection.halfLengthM) / 2,
      halfWidthM: 1.5,
      headingRad: 0,
    };

    expect(FIRST_BLOCK.obstacles.filter((obstacle) => overlaps(lane, obstacle.box))).toEqual([]);
  });

  it('scripts a pedestrian on the crosswalk and cross traffic on the avenue during the red light', () => {
    const actors = FIRST_BLOCK.scenario?.actors ?? [];
    const pedestrian = actors.find((actor) => actor.kind === 'pedestrian');
    const vehicle = actors.find((actor) => actor.kind === 'vehicle');
    const { crosswalk, intersection, stopLineZ } = FIRST_BLOCK_ZONES;

    expect(pedestrian?.from.z).toBeCloseTo(crosswalk.centerZ, 6);
    expect(pedestrian?.trigger).toEqual({ carZAtLeast: stopLineZ - 30 });
    expect(vehicle?.trigger).toEqual({ lightPhase: 'red', everyCycle: true });
    expect(vehicle?.from.z).toBeGreaterThan(intersection.centerZ - intersection.halfLengthM);
  });
});
