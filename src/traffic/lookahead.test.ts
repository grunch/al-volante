import { describe, expect, it } from 'vitest';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { ActorPose } from '../sim/scenario.ts';
import routeData from '../../specs/route/comuna13-a.json';
import { buildCity, offsetPoint } from '../city/model.ts';
import { RouteSchema } from '../content/schemas.ts';
import { governingLight, leaderAhead, lookAhead } from './lookahead.ts';
import { pointAlong } from './network.ts';
import { createTraffic, createTrafficState } from './traffic.ts';

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

  it('has no gap to a vehicle already overlapping the car', () => {
    expect(leaderAhead([vehicleAt('touching', 3, 0)], car)?.gapM).toBe(0);
  });

  it('ignores traffic crossing the car’s way or coming the other way: those are conflicts, not leaders', () => {
    expect(leaderAhead([vehicleAt('crossing', 8, Math.PI / 2)], car)).toBeNull();
    expect(leaderAhead([vehicleAt('oncoming', 8, Math.PI)], car)).toBeNull();
    expect(leaderAhead([vehicleAt('crossing', 8, Math.PI / 2), vehicleAt('ahead', 20, 0)], car)?.pose.id).toBe('ahead');
  });
});

describe('the vehicle ahead on the route', () => {
  const city = buildCity(RouteSchema.parse(routeData));
  const traffic = createTraffic(city, 1);
  const lap = traffic.network.paths.find((path) => path.id === 'lap')!;
  const at = (s: number, leftM: number): OrientedBox => {
    const { point, headingRad } = pointAlong(lap, s);
    const centre = offsetPoint(point, headingRad, leftM);
    return { centerX: centre.x, centerZ: centre.z, halfLengthM: 2.15, halfWidthM: 0.875, headingRad };
  };
  const vehicleOnLap = (s: number): ActorPose => {
    const box = at(s, 0);
    return {
      id: 'ahead',
      kind: 'vehicle',
      x: box.centerX,
      z: box.centerZ,
      headingRad: box.headingRad,
      active: true,
      box,
      inside: (zone) => overlaps(box, zone),
    };
  };
  const view = (car: OrientedBox) =>
    lookAhead(traffic, { ...createTrafficState(traffic), poses: [vehicleOnLap(300)] }, car).leader;

  it('follows the vehicle on the route’s line while the car keeps to it, not from the next lane', () => {
    expect(view(at(285, 0))?.gapM).toBeCloseTo(15 - 2.15 - 2.15, 1);
    expect(view(at(285, 2.6))).toBeNull();
  });

  it('reports the signal ahead across the whole band the caller counts as on the route', () => {
    // Arrange: 30 m before Cabildo's signal at Iberá (a signalled crosswalk comes first), on the lap line and 9 m to
    // its left (the busway side).
    const stop = lap.stops.find((item) => item.approach.rule === 'signal' && item.approach.road.leg === 2)!;
    const state = createTrafficState(traffic);
    const onLine = at(stop.atS - 30 - 2.15, 0);
    const besideLine = at(stop.atS - 30 - 2.15, 9);

    // Act
    const reference = lookAhead(traffic, state, onLine, 14);
    const beside = lookAhead(traffic, state, besideLine, 14);

    // Assert: the examiner widens the band to judge the busway side; the light must not vanish inside it.
    expect(reference.signal?.distanceM).toBeGreaterThan(0);
    expect(reference.signal?.distanceM).toBeLessThanOrEqual(30);
    expect(beside.routeS).toBeCloseTo(reference.routeS!, 1);
    expect(beside.crossing).toBeNull();
    expect(beside.signal).toEqual(reference.signal);
  });

  it('off the route, reports no route controls but still the vehicle straight ahead', () => {
    // Arrange: 20 m to the left of the lap line, beyond its 6 m band, with a vehicle 12 m ahead.
    const off = at(285, 20);
    const forward = offsetPoint({ x: off.centerX, z: off.centerZ }, off.headingRad, 0, 12);
    const box = { ...off, centerX: forward.x, centerZ: forward.z };
    const ahead: ActorPose = { ...vehicleOnLap(300), x: box.centerX, z: box.centerZ, box };
    const state = { ...createTrafficState(traffic), poses: [ahead] };

    // Act
    const view = lookAhead(traffic, state, off);

    // Assert
    expect(view.routeS).toBeNull();
    expect(view.signal).toBeNull();
    expect(view.crossing).toBeNull();
    expect(view.crosswalk).toBeNull();
    expect(view.leader?.gapM).toBeCloseTo(12 - 2.15 - 2.15, 6);
    expect(governingLight(traffic, state.lights, off, 0)).toBeNull();
  });

  it('without a lap, nothing on the route governs the car', () => {
    const lapless = { ...traffic, network: { ...traffic.network, paths: [] } };
    const state = createTrafficState(lapless);
    const view = lookAhead(lapless, state, at(285, 0));
    expect(view).toEqual({ routeS: null, signal: null, crossing: null, crosswalk: null, leader: null });
    expect(governingLight(lapless, state.lights, at(285, 0), 0)).toBeNull();
  });
});
