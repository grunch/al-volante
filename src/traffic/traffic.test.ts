import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity, distance, offsetPoint, projectOnRoad } from '../city/model.ts';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import { EXAM_CAR, bodyBox, restingVehicle } from '../sim/vehicle.ts';
import { CYCLE_PERIOD_S, intersectionLight } from './lights.ts';
import { locateOnPath, pointAlong } from './network.ts';
import type { Approach, Path } from './network.ts';
import {
  ACTIVE_RADIUS_M,
  ACTOR_SIZES,
  DEADLOCK_S,
  MAX_ACTIVE_ACTORS,
  createTraffic,
  createTrafficSource,
  createTrafficState,
  laneSpeedAt,
  stepTraffic,
} from './traffic.ts';
import type { Traffic, TrafficState, VehiclePlan } from './traffic.ts';

const city = buildCity(RouteSchema.parse(routeData));
const base = createTraffic(city, 1);
const lap = base.network.paths.find((path) => path.id === 'lap')!;
const FAR_AWAY: OrientedBox = { centerX: 5000, centerZ: 5000, halfLengthM: 2.15, halfWidthM: 0.875, headingRad: 0 };

const carAt = (x: number, z: number, headingRad: number) => bodyBox(EXAM_CAR, restingVehicle({ x, z, headingRad }));
const car = (plan: Partial<VehiclePlan> & { pathId: string; startS: number }, index = 0): VehiclePlan => ({
  id: `vehicle-${index}`,
  kind: 'vehicle',
  halfLengthM: ACTOR_SIZES.vehicle.lengthM / 2,
  halfWidthM: ACTOR_SIZES.vehicle.widthM / 2,
  speedFactor: 1,
  respawnDelayS: 5,
  ...plan,
});
/** The base traffic with only the given vehicles and no pedestrians. */
const only = (vehicles: VehiclePlan[]): Traffic => ({ ...base, vehicles, walks: {} });
const vehicle = (state: TrafficState, id: string) => state.vehicles.find((item) => item.id === id)!;
const frontOf = (traffic: Traffic, state: TrafficState, id: string) => {
  const plan = traffic.vehicles.find((item) => item.id === id)!;
  return vehicle(state, id).s + plan.halfLengthM;
};
const stopOn = (path: Path, roadId: string) => path.stops.find((stop) => stop.approach.road.id === roadId)!;

function run(
  traffic: Traffic,
  carBody: OrientedBox | ((timeS: number) => OrientedBox),
  seconds: number,
  each?: (state: TrafficState, timeS: number) => void,
  from: TrafficState = createTrafficState(traffic),
): TrafficState {
  let state = from;
  const steps = Math.round(seconds / SIM_STEP_S);
  for (let step = 1; step <= steps; step++) {
    const timeS = state.timeS + SIM_STEP_S;
    state = stepTraffic(traffic, state, typeof carBody === 'function' ? carBody(timeS) : carBody, timeS, SIM_STEP_S);
    each?.(state, timeS);
  }
  return state;
}

describe('seeded traffic', () => {
  it('is reproducible: the same seed and inputs yield identical states, another seed a different scenario', () => {
    const a = createTrafficSource(city, 3);
    const b = createTrafficSource(city, 3);
    const c = createTrafficSource(city, 4);
    expect(a.traffic.vehicles).toEqual(b.traffic.vehicles);
    expect(a.traffic.plan).toEqual(b.traffic.plan);
    expect(c.traffic.vehicles).not.toEqual(a.traffic.vehicles);
    const moving = (timeS: number) => carAt(60 - timeS * 3, -38 + timeS * 2, -1);
    const strip = (state: TrafficState) => ({
      ...state,
      poses: state.poses.map((pose) => [pose.id, pose.x, pose.z, pose.active]),
    });
    const first = run(a.traffic, moving, 6);
    const second = run(b.traffic, moving, 6);
    expect(strip(first)).toEqual(strip(second));
    expect(strip(run(c.traffic, moving, 6))).not.toEqual(strip(first));
    expect(() => createTraffic(city, 1.5)).toThrow();
  }, 30000);

  it('spawns a bounded set of actors near the car and caps the active ones', () => {
    expect(base.vehicles.length).toBeGreaterThan(20);
    expect(base.vehicles.length).toBeLessThanOrEqual(MAX_ACTIVE_ACTORS);
    expect(base.vehicles.filter((item) => item.kind === 'bus')).toHaveLength(4);
    expect(base.vehicles.filter((item) => item.kind === 'bicycle')).toHaveLength(6);
    const body = carAt(60, -38, -1);
    const state = run(base, body, 2);
    expect(state.poses.length).toBeGreaterThan(0);
    expect(state.poses.length).toBeLessThanOrEqual(MAX_ACTIVE_ACTORS);
    for (const pose of state.poses)
      expect(distance(pose, { x: body.centerX, z: body.centerZ })).toBeLessThanOrEqual(ACTIVE_RADIUS_M);
    expect(run(base, FAR_AWAY, 1).poses).toHaveLength(0);
  });

  it('keeps every vehicle at or below the speed of its lane', () => {
    run(base, carAt(60, -38, -1), 20, (state) => {
      for (const item of state.vehicles) {
        const plan = base.vehicles.find((vehicle) => vehicle.id === item.id)!;
        const path = base.network.paths.find((candidate) => candidate.id === plan.pathId)!;
        const limit = laneSpeedAt(path, item.s);
        // Fixed-step tracking may overshoot a lane change by a few hundredths of a metre per second.
        expect(
          item.speedMps,
          JSON.stringify({
            id: item.id,
            path: path.id,
            s: item.s,
            t: state.timeS,
            seg: pointAlong(path, item.s).segment?.lane.id,
          }),
        ).toBeLessThanOrEqual(limit + 0.05);
      }
    });
  }, 30000);

  it('stops at a red light before the line and goes on green', () => {
    const stop = stopOn(lap, 'leg-1-1');
    const traffic = only([car({ pathId: 'lap', startS: stop.atS - 70 })]);
    const intersection = traffic.network.intersections.find((item) => item.id === stop.approach.intersectionId)!;
    let crossedAt: { timeS: number; light: string } | null = null;
    let stoppedOnRed = false;
    const end = run(traffic, FAR_AWAY, CYCLE_PERIOD_S * 2.5, (state, timeS) => {
      const light = intersectionLight(traffic.plan, intersection, stop.approach.group, timeS);
      const front = frontOf(traffic, state, 'vehicle-0');
      if (crossedAt === null && front > stop.atS + 0.3) crossedAt = { timeS, light: light ?? 'none' };
      if (crossedAt === null && light === 'red') {
        expect(front).toBeLessThanOrEqual(stop.atS + 0.3);
        if (vehicle(state, 'vehicle-0').speedMps === 0) stoppedOnRed = true;
      }
    });
    expect(crossedAt).not.toBeNull();
    expect(crossedAt!.light).not.toBe('red');
    expect(stoppedOnRed).toBe(true);
    expect(vehicle(end, 'vehicle-0').s).toBeGreaterThan(stop.atS);
  });

  it('comes to a full stop at a STOP sign, waits, then goes', () => {
    const stop = stopOn(lap, 'leg-3-2');
    expect(stop.approach.rule).toBe('stop');
    const traffic = only([car({ pathId: 'lap', startS: stop.atS - 50 })]);
    let stoppedS = 0;
    let stoppedFront = NaN;
    let passedAt: number | null = null;
    run(traffic, FAR_AWAY, 40, (state, timeS) => {
      const front = frontOf(traffic, state, 'vehicle-0');
      if (passedAt === null && front > stop.atS + 0.3) passedAt = timeS;
      if (passedAt === null && vehicle(state, 'vehicle-0').speedMps === 0) {
        stoppedS += SIM_STEP_S;
        stoppedFront = front;
      }
    });
    expect(passedAt).not.toBeNull();
    expect(stoppedS).toBeGreaterThanOrEqual(1);
    expect(stop.atS - stoppedFront).toBeGreaterThanOrEqual(0);
    expect(stop.atS - stoppedFront).toBeLessThanOrEqual(1.2);
  });

  it('also stops at the STOP just before the lap closes, where the next stops wrap around', () => {
    const stop = lap.stops.at(-1)!;
    expect(stop.approach.rule).toBe('stop');
    const traffic = only([car({ pathId: 'lap', startS: stop.atS - 40 })]);
    let stoppedS = 0;
    let passedAt: number | null = null;
    run(traffic, FAR_AWAY, 20, (state, timeS) => {
      const wrapped = vehicle(state, 'vehicle-0').s < stop.atS - 100;
      if (passedAt === null && (wrapped || frontOf(traffic, state, 'vehicle-0') > stop.atS + 0.3)) passedAt = timeS;
      if (passedAt === null && vehicle(state, 'vehicle-0').speedMps === 0) stoppedS += SIM_STEP_S;
    });
    expect(passedAt).not.toBeNull();
    expect(stoppedS).toBeGreaterThanOrEqual(1);
  });

  it('keeps a following distance behind a slower vehicle instead of overlapping it', () => {
    const traffic = only([
      car({ pathId: 'lap', startS: 40, speedFactor: 0.4, id: 'vehicle-0' }),
      car({ pathId: 'lap', startS: 25, speedFactor: 1, id: 'vehicle-1' }, 1),
    ]);
    let minimumGap = Infinity;
    const end = run(traffic, FAR_AWAY, 25, (state) => {
      const gap = vehicle(state, 'vehicle-0').s - vehicle(state, 'vehicle-1').s - ACTOR_SIZES.vehicle.lengthM;
      minimumGap = Math.min(minimumGap, gap);
    });
    expect(minimumGap).toBeGreaterThan(2);
    const leader = vehicle(end, 'vehicle-0'),
      follower = vehicle(end, 'vehicle-1');
    expect(follower.speedMps).toBeLessThanOrEqual(leader.speedMps + 0.5);
    expect(follower.speedMps).toBeGreaterThan(0);
  });

  it('follows the car itself: a vehicle behind the stopped car waits, and never spawns on top of it', () => {
    const start = pointAlong(lap, 60);
    const body = carAt(start.point.x, start.point.z, start.headingRad);
    const traffic = only([car({ pathId: 'lap', startS: 30 })]);
    const end = run(traffic, body, 20);
    const front = frontOf(traffic, end, 'vehicle-0');
    const rearS = locateOnPath(lap, { x: body.centerX, z: body.centerZ }, 1)!.s - body.halfLengthM;
    expect(vehicle(end, 'vehicle-0').speedMps).toBe(0);
    expect(rearS - front).toBeGreaterThan(2.5);
    expect(rearS - front).toBeLessThan(4);
    expect(end.contacts).toEqual([]);
  });

  it('yields to a vehicle crossing from the right at a corner without signals and goes when it has priority', () => {
    const stop = lap.stops.find((item) => item.approach.road.id === 'leg-4-1')!;
    expect(stop.approach.rule).toBe('priority');
    const link = base.network.paths.find((path) => path.id === 'quesada-link:forward')!;
    const intersection = base.network.intersections.find((item) => item.id === stop.approach.intersectionId)!;
    const linkStop = link.stops.find((item) => item.approach.intersectionId === intersection.id)!;
    expect(linkStop.approach.rule).toBe('priority');
    const traffic = only([
      car({ pathId: 'lap', startS: stop.atS - 30, id: 'vehicle-0' }),
      car({ pathId: link.id, startS: linkStop.atS - 30, id: 'vehicle-1' }, 1),
    ]);
    let bothInside = false;
    let slowest = Infinity;
    let linkPassedS: number | null = null;
    let lapPassedS: number | null = null;
    run(traffic, FAR_AWAY, 30, (state, timeS) => {
      const lapFront = frontOf(traffic, state, 'vehicle-0');
      const linkFront = frontOf(traffic, state, 'vehicle-1');
      if (linkPassedS === null && linkFront > linkStop.atS + 0.3) linkPassedS = timeS;
      if (lapPassedS === null && lapFront > stop.atS + 0.3) lapPassedS = timeS;
      if (lapPassedS === null) slowest = Math.min(slowest, vehicle(state, 'vehicle-0').speedMps);
      const boxes = state.poses.map((pose) => pose.box);
      if (boxes.length === 2 && boxes.every((box) => overlaps(box, intersection.box))) bothInside = true;
    });
    // The lap car slowed down to let the link car through, and only then entered the crossing.
    expect(slowest).toBeLessThan(2);
    expect(bothInside).toBe(false);
    expect(linkPassedS).not.toBeNull();
    expect(lapPassedS).not.toBeNull();
    expect(linkPassedS!).toBeLessThan(lapPassedS!);
  });

  it('yields to the car when it comes from the right, and proceeds once the car has stopped and lost priority', () => {
    const stop = lap.stops.find((item) => item.approach.road.id === 'leg-4-1')!;
    const link = city.roads.find((road) => road.id === 'quesada-link')!;
    const traffic = only([car({ pathId: 'lap', startS: stop.atS - 25 })]);
    // The car drives along Quesada toward Cuba, then creeps toward the corner without stopping.
    const approaching = (timeS: number) => {
      const along = 2 + 6 * Math.min(timeS, 1.5) + 0.8 * Math.max(0, Math.min(timeS, 8) - 1.5);
      const point = offsetPoint(link.a, link.headingRad, 0, along);
      return carAt(point.x, point.z, link.headingRad);
    };
    let waitedS = 0;
    const held = run(traffic, approaching, 8, (state) => {
      if (vehicle(state, 'vehicle-0').speedMps === 0) waitedS += SIM_STEP_S;
    });
    expect(waitedS).toBeGreaterThan(1);
    expect(frontOf(traffic, held, 'vehicle-0')).toBeLessThanOrEqual(stop.atS + 0.3);
    // The car then stays stopped short of the corner: by exception 4 the actor may go.
    const parked = approaching(8);
    const released = run(traffic, parked, 12, undefined, held);
    expect(frontOf(traffic, released, 'vehicle-0')).toBeGreaterThan(stop.atS + 1);
  });

  it('keeps the right of way of the car coming from the right however long it waits, never breaking it as a deadlock', () => {
    const stop = lap.stops.find((item) => item.approach.road.id === 'leg-4-1')!;
    const link = city.roads.find((road) => road.id === 'quesada-link')!;
    const traffic = only([car({ pathId: 'lap', startS: stop.atS - 25 })]);
    // The car keeps creeping toward the corner, short of its line, for longer than the deadlock wait.
    const creeping = (timeS: number) => {
      const point = offsetPoint(
        link.a,
        link.headingRad,
        0,
        2 + 6 * Math.min(timeS, 1.5) + 0.6 * Math.max(0, timeS - 1.5),
      );
      return carAt(point.x, point.z, link.headingRad);
    };
    let waitedS = 0;
    const end = run(traffic, creeping, 18, (state) => {
      expect(frontOf(traffic, state, 'vehicle-0')).toBeLessThanOrEqual(stop.atS + 0.3);
      if (vehicle(state, 'vehicle-0').speedMps === 0) waitedS += SIM_STEP_S;
    });
    expect(waitedS).toBeGreaterThan(DEADLOCK_S + 1);
    expect(end.contacts).toEqual([]);
  });

  it('does not yield to the car arriving at a STOP from its right: the STOP loses the priority', () => {
    const stop = lap.stops.find((item) => item.approach.road.id === 'leg-4-1')!;
    const link = city.roads.find((road) => road.id === 'quesada-link')!;
    // The same corner with a STOP sign on the Quesada link, which arrives from the lap's right.
    const withStop = (approach: Approach): Approach =>
      approach.road.id === link.id ? { ...approach, rule: 'stop' } : approach;
    const network = {
      ...base.network,
      intersections: base.network.intersections.map((item) => ({ ...item, approaches: item.approaches.map(withStop) })),
      paths: base.network.paths.map((path) => ({
        ...path,
        stops: path.stops.map((item) => ({ ...item, approach: withStop(item.approach) })),
      })),
    };
    const traffic: Traffic = { ...only([car({ pathId: 'lap', startS: stop.atS - 25 })]), network };
    const creeping = (timeS: number) => {
      const along = 2 + 6 * Math.min(timeS, 1.5) + 0.6 * Math.max(0, timeS - 1.5);
      const point = offsetPoint(link.a, link.headingRad, 0, along);
      return carAt(point.x, point.z, link.headingRad);
    };
    let passedAt: number | null = null;
    run(traffic, creeping, 10, (state, timeS) => {
      if (passedAt === null && frontOf(traffic, state, 'vehicle-0') > stop.atS + 0.3) passedAt = timeS;
    });
    expect(passedAt).not.toBeNull();
  });

  it('waits at its line while the car stands on the crossing, past the deadlock wait, and goes once it is clear', () => {
    const stop = lap.stops.find((item) => item.approach.road.id === 'leg-4-1')!;
    const link = city.roads.find((road) => road.id === 'quesada-link')!;
    const crossing = stop.approach.conflicts[0]!;
    // A stalled car across the middle of the corner: no priority to keep, but it occupies the pavement.
    const stalled = carAt(crossing.centerX, crossing.centerZ, link.headingRad);
    const traffic = only([car({ pathId: 'lap', startS: stop.atS - 25 })]);
    let waitedS = 0;
    const held = run(traffic, stalled, 20, (state) => {
      expect(frontOf(traffic, state, 'vehicle-0')).toBeLessThanOrEqual(stop.atS + 0.3);
      if (vehicle(state, 'vehicle-0').speedMps === 0) waitedS += SIM_STEP_S;
      expect(state.contacts).toEqual([]);
    });
    expect(waitedS).toBeGreaterThan(DEADLOCK_S + 1);
    const released = run(traffic, FAR_AWAY, 10, undefined, held);
    expect(frontOf(traffic, released, 'vehicle-0')).toBeGreaterThan(stop.atS + 1);
  });

  it('lets pedestrians cross a signalled crosswalk only on its walk phase', () => {
    const crosswalk = base.network.crosswalks.find((item) => item.controlId === 'control-1')!;
    const body = carAt(40, -25, -1);
    let walks = 0;
    run({ ...base, vehicles: [] }, body, CYCLE_PERIOD_S * 4, (state) => {
      for (const pose of state.poses) {
        if (pose.kind !== 'pedestrian' || !pose.id.includes(crosswalk.id)) continue;
        walks += 1;
        if (pose.inside(crosswalk.box)) expect(state.lights['control-1']).toBe('red');
      }
    });
    expect(walks).toBeGreaterThan(0);
  });

  it('lets pedestrians step off an unsignalled crosswalk only in a gap, and vehicles stop for them', () => {
    // The exit crosswalk of Cuba onto Quesada: unsignalled, with no stop line just before it.
    const crossing = lap.crosswalks.find(
      (item) => item.crosswalk.road.id === 'leg-3-1' && item.crosswalk.intersectionId === null,
    )!;
    const { crosswalk } = crossing;
    expect(lap.stops.some((stop) => stop.atS < crossing.atS && stop.atS > crossing.atS - 10)).toBe(false);
    const vehicles = [car({ pathId: 'lap', startS: crossing.atS - 90, speedFactor: 1 })];
    const body = carAt(crosswalk.center.x - 80, crosswalk.center.z + 60, 0);
    // The first walk starts when the vehicle is 25 m away: a gap for the walker, too close to pass before it.
    const alone = only(vehicles);
    let gapAtS = 0;
    run(alone, body, 30, (state, timeS) => {
      if (gapAtS === 0 && crossing.atS - frontOf(alone, state, 'vehicle-0') <= 25) gapAtS = timeS;
    });
    expect(gapAtS).toBeGreaterThan(0);
    const traffic = { ...base, vehicles, walks: { [crosswalk.id]: { ...base.walks[crosswalk.id]!, firstS: gapAtS } } };
    let started = 0;
    let stoppedForWalker = false;
    let previous = new Set<string>();
    run(traffic, body, 60, (state) => {
      const walkers = state.poses.filter((pose) => pose.kind === 'pedestrian' && pose.id.includes(crosswalk.id));
      for (const walker of walkers) {
        if (!previous.has(walker.id)) {
          started += 1;
          const actor = state.poses.find((pose) => pose.id === 'vehicle-0');
          if (actor)
            expect(
              distance(actor, crosswalk.center) > 15 ||
                actor.active === false ||
                vehicle(state, 'vehicle-0').speedMps <= 1,
            ).toBe(true);
        }
        const front = frontOf(traffic, state, 'vehicle-0');
        const beforeCrosswalk = front <= crossing.atS && front > crossing.atS - 6;
        if (walker.inside(crosswalk.box) && vehicle(state, 'vehicle-0').speedMps === 0 && beforeCrosswalk)
          stoppedForWalker = true;
        const actorBox = state.poses.find((pose) => pose.id === 'vehicle-0')?.box;
        if (actorBox) expect(overlaps(actorBox, walker.box)).toBe(false);
      }
      previous = new Set(walkers.map((walker) => walker.id));
    });
    expect(started).toBeGreaterThan(0);
    expect(stoppedForWalker).toBe(true);
  });

  it('keeps bicycles on the cycle track beside the road', () => {
    const body = carAt(100, -150, 0.5);
    run(base, body, 30, (state) => {
      for (const pose of state.poses) {
        if (pose.kind !== 'bicycle') continue;
        const road = city.roads
          .filter((item) => item.cycleTrack)
          .sort((a, b) => projectOnRoad(pose, a).distanceM - projectOnRoad(pose, b).distanceM)[0]!;
        const projection = projectOnRoad(pose, road);
        // Corners link one track to the next across the intersection, and the track's ends have 15 m stubs beyond
        // the road; judge the straights only.
        if (base.network.intersections.some((item) => distance(item.center, pose) < 12)) continue;
        if (projection.t <= 0.001 || projection.t >= 0.999) continue;
        const lateral = projection.distanceM;
        expect(lateral).toBeGreaterThanOrEqual(road.widthM / 2 - 0.3);
        expect(lateral).toBeLessThanOrEqual(road.widthM / 2 + 2.6 + 0.3);
        // Left of the road, where the track is drawn.
        const left = offsetPoint(projectOnRoad(pose, road).point, road.headingRad, 1);
        expect(distance(pose, left)).toBeLessThan(distance(pose, projectOnRoad(pose, road).point));
      }
    });
  }, 30000);

  it('lets bicycles pass an oncoming bicycle standing on the other half of the track', () => {
    const forward = base.network.paths.find((path) => path.kind === 'bicycle' && path.id.endsWith(':forward'))!;
    const back = base.network.paths.find((path) => path.id === forward.id.replace(':forward', ':back'))!;
    const bike = (pathId: string, startS: number, speedFactor: number, index: number): VehiclePlan => ({
      ...car({ pathId, startS, speedFactor }, index),
      id: `bicycle-${index}`,
      kind: 'bicycle',
      halfLengthM: ACTOR_SIZES.bicycle.lengthM / 2,
      halfWidthM: ACTOR_SIZES.bicycle.widthM / 2,
    });
    // The oncoming bicycle stands still 30 m ahead of the moving one, on its own half of the track.
    const meeting = pointAlong(forward, 50).point;
    const standing = locateOnPath(back, meeting, 3)!;
    const traffic = only([bike(forward.id, 20, 1, 0), bike(back.id, standing.s, 0.0001, 1)]);
    let overlapped = false;
    const state = run(traffic, FAR_AWAY, 15, (step) => {
      const [a, b] = step.poses.filter((pose) => pose.kind === 'bicycle');
      if (a && b && overlaps(a.box, b.box)) overlapped = true;
    });
    expect(overlapped).toBe(false);
    expect(vehicle(state, 'bicycle-0').s).toBeGreaterThan(60);
  }, 30000);

  it('reports a contact once when the car body overlaps an actor, with the actor kind', () => {
    const traffic = only([car({ pathId: 'lap', startS: 100, speedFactor: 0.0001 })]);
    const place = pointAlong(lap, 100);
    const body = carAt(place.point.x, place.point.z, place.headingRad);
    let contacts: string[] = [];
    run(traffic, body, 1, (state) => {
      contacts = [...contacts, ...state.contacts];
    });
    expect(contacts).toEqual(['vehicle']);
  });

  it('buses run both ways on the busway and reappear at their start after finishing it', () => {
    const forward = base.network.paths.find((path) => path.id.endsWith('busway:forward'))!;
    const bus = base.vehicles.find((item) => item.kind === 'bus' && item.pathId === forward.id)!;
    const traffic = only([{ ...bus, startS: forward.lengthM - 5 }]);
    const body = carAt(200, 200, 0);
    let respawned = false;
    let finished = false;
    run(traffic, body, 30, (state) => {
      const item = vehicle(state, bus.id);
      if (item.respawnS !== null) finished = true;
      if (finished && item.respawnS === null && item.s < 1) respawned = true;
    });
    expect(finished).toBe(true);
    expect(respawned).toBe(true);
  });

  it('exposes the light the car faces next on the route, green where none applies', () => {
    const stop = stopOn(lap, 'leg-1-1');
    const place = pointAlong(lap, stop.atS - 30);
    const body = carAt(place.point.x, place.point.z, place.headingRad);
    const intersection = base.network.intersections.find((item) => item.id === stop.approach.intersectionId)!;
    run(base, body, 3, (state, timeS) => {
      expect(state.light).toBe(intersectionLight(base.plan, intersection, 0, timeS));
      expect(state.lights['control-0']).toBe(state.light);
    });
    expect(run(base, FAR_AWAY, 0.5).light).toBe('green');
  });
});
