import { describe, expect, it } from 'vitest';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { ActorPose } from '../sim/scenario.ts';
import { leaderAhead } from './lookahead.ts';

const car: OrientedBox = { centerX: 0, centerZ: 0, halfLengthM: 2.15, halfWidthM: 0.875, headingRad: 0 };

function vehicleAt(id: string, z: number, headingRad: number): ActorPose {
  const box = { centerX: 0, centerZ: z, halfLengthM: 2.15, halfWidthM: 0.875, headingRad };
  return { id, kind: 'vehicle', x: 0, z, headingRad, active: true, box, inside: (zone) => overlaps(box, zone) };
}

describe('the vehicle ahead', () => {
  it('is the nearest vehicle travelling the car’s way, with the bumper gap', () => {
    const leader = leaderAhead([vehicleAt('far', 30, 0), vehicleAt('near', 12, 0.1)], car);
    expect(leader?.pose.id).toBe('near');
    const reach = Math.cos(0.1) * 2.15 + Math.sin(0.1) * 0.875;
    expect(leader?.gapM).toBeCloseTo(12 - 2.15 - reach, 6);
  });

  it('through a turn, follows the vehicle ahead on the road being entered, by the way the route takes', () => {
    // Mid right turn the car still heads 22,5° off; the vehicle ahead already runs along the new road (90°).
    const turning = { ...car, headingRad: Math.PI / 8 };
    const ahead = vehicleAt('ahead', 6, Math.PI / 2);
    expect(leaderAhead([ahead], turning)).toBeNull();
    const route = (wayRad: number, onLine: number | null) => ({
      ways: [0, wayRad],
      locate: () => (onLine === null ? null : { aheadM: 7, headingRad: onLine }),
    });
    expect(leaderAhead([ahead], turning, route(Math.PI / 2, null))?.pose.id).toBe('ahead');
    expect(leaderAhead([ahead], turning, route(0, null))).toBeNull();
    // A vehicle turning ahead on the route's line, going the route's way there, is still the one to follow.
    const followed = leaderAhead([ahead], turning, route(0, Math.PI / 2));
    expect(followed?.pose.id).toBe('ahead');
    expect(followed?.gapM).toBeCloseTo(7 - 2.15, 6);
    // Crossing the route's line is not going its way.
    expect(leaderAhead([ahead], turning, route(0, 0))).toBeNull();
  });

  it('ignores traffic crossing the car’s way or coming the other way: those are conflicts, not leaders', () => {
    expect(leaderAhead([vehicleAt('crossing', 8, Math.PI / 2)], car)).toBeNull();
    expect(leaderAhead([vehicleAt('oncoming', 8, Math.PI)], car)).toBeNull();
    expect(leaderAhead([vehicleAt('crossing', 8, Math.PI / 2), vehicleAt('ahead', 20, 0)], car)?.pose.id).toBe('ahead');
  });
});
