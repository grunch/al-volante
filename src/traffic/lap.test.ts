import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity, distance, sampleLeg } from '../city/model.ts';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { ActorPose } from '../sim/scenario.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import { initialWorldState, stepWorld } from '../sim/world.ts';
import { CYCLE_PERIOD_S } from './lights.ts';
import { lookAhead } from './lookahead.ts';
import { pointAlong } from './network.ts';
import { createTrafficSource, laneSpeedAt } from './traffic.ts';
import type { TrafficState } from './traffic.ts';

const CRUISE_MPS = 5.5;
const COMFORT_BRAKE_MPS2 = 2.5;
const STOP_WAIT_S = 1;
const MAX_STEPS = 72000;
/** How far straight ahead the driver checks that its body can move without touching a vehicle, and in what steps. */
const SWEEP_M = 6;
const SWEEP_STEP_M = 0.25;
const SWEEP_MARGIN_M = 1;

/** Speed that still allows stopping `distanceM` ahead at comfort braking. */
const toStop = (distanceM: number) => (distanceM <= 0.4 ? 0 : Math.sqrt(2 * COMFORT_BRAKE_MPS2 * distanceM));

/**
 * Metres the body can still move straight ahead before it touches a vehicle travelling its general way. Through a
 * corner the car cuts inside the lane line, so the route distance to a leader turning ahead overstates the room.
 */
function clearAheadM(body: OrientedBox, poses: readonly ActorPose[]): number {
  const forward = { x: Math.sin(body.headingRad), z: Math.cos(body.headingRad) };
  const ahead = poses.filter(
    (pose) =>
      pose.kind !== 'pedestrian' &&
      Math.cos(pose.headingRad - body.headingRad) > 0 &&
      distance(pose, { x: body.centerX, z: body.centerZ }) < SWEEP_M * 3,
  );
  for (let metres = 0; metres <= SWEEP_M; metres += SWEEP_STEP_M) {
    const swept = { ...body, centerX: body.centerX + forward.x * metres, centerZ: body.centerZ + forward.z * metres };
    if (ahead.some((pose) => overlaps(pose.box, swept))) return metres;
  }
  return Infinity;
}

/**
 * A lawful test driver: pure pursuit on the route, stopping at red and yellow lights, making a full stop at STOP
 * signs, waiting for anyone inside a crossing, keeping two seconds behind the vehicle ahead (and never moving its
 * body into one, even while cutting a corner) and letting pedestrians finish crossing. It is a test fixture, not
 * the examiner.
 */
it('completes the lap with traffic on, obeying the lights, without touching anyone and never waiting a full cycle', () => {
  const city = buildCity(RouteSchema.parse(routeData));
  const source = createTrafficSource(city, 1);
  const { traffic } = source;
  const lap = traffic.network.paths.find((path) => path.id === 'lap')!;
  const waypoints = city.legs.flatMap((leg) => {
    const result = [];
    for (let d = 0; d < leg.lengthM; d += 1) result.push(sampleLeg(city, leg.number, d));
    return result;
  });
  const start = sampleLeg(city, 1, 20);
  let state = initialWorldState({ ...start, speedMps: 0 });
  let snapshot: TrafficState = source.create();
  let index = 20;
  const contacts: string[] = [];
  const actorContacts: string[] = [];
  let clearedStop: string | null = null;
  let stoppedS = 0;
  let longestStopS = 0;
  let redCrossings = 0;
  let lightStops = 0;
  let previousSignalDistance: number | null = null;
  const lastSeen = new Map<string, { x: number; z: number }>();
  let step = 0;
  for (; step < MAX_STEPS && index < waypoints.length + 20; step++) {
    const vehicle = state.vehicle;
    const body = bodyBox(EXAM_CAR, vehicle);
    while (distance(vehicle, waypoints[index % waypoints.length]!) < 7) {
      index++;
      if (index >= waypoints.length + 20) break;
    }
    const target = waypoints[index % waypoints.length]!;
    const heading = Math.atan2(target.x - vehicle.x, target.z - vehicle.z);
    const error = Math.atan2(Math.sin(heading - vehicle.headingRad), Math.cos(heading - vehicle.headingRad));
    const wheelAngle = Math.atan((2 * EXAM_CAR.wheelbaseM * Math.sin(error)) / Math.max(1, distance(vehicle, target)));
    const view = lookAhead(traffic, snapshot, body);
    let wanted =
      view.routeS === null ? CRUISE_MPS : Math.min(CRUISE_MPS, laneSpeedAt(lap, view.routeS + EXAM_CAR.lengthM / 2));
    if (view.signal) {
      const { light, distanceM } = view.signal;
      const canStop = distanceM >= (vehicle.speedMps * vehicle.speedMps) / (2 * 4);
      if (light === 'red' || (light === 'yellow' && canStop)) wanted = Math.min(wanted, toStop(distanceM));
      if (previousSignalDistance !== null && previousSignalDistance >= 0 && distanceM < 0 && light === 'red')
        redCrossings++;
      previousSignalDistance = distanceM;
    } else previousSignalDistance = null;
    if (view.crossing) {
      const { approachId, rule, distanceM, conflicts } = view.crossing;
      const inside = snapshot.poses.some(
        (pose) => pose.kind !== 'pedestrian' && conflicts.some((conflict) => pose.inside(conflict)),
      );
      if (rule === 'stop' && clearedStop !== approachId) {
        wanted = Math.min(wanted, toStop(distanceM));
        if (vehicle.speedMps === 0 && distanceM <= 3 && stoppedS >= STOP_WAIT_S) clearedStop = approachId;
      } else if (inside && distanceM > -1) wanted = Math.min(wanted, toStop(distanceM));
      else if (rule === 'priority' && distanceM < 15) wanted = Math.min(wanted, 4);
    }
    if (view.crosswalk?.occupied) wanted = Math.min(wanted, toStop(view.crosswalk.distanceM));
    if (view.leader) {
      const free = Math.max(0, view.leader.gapM - 3);
      const before = lastSeen.get(view.leader.pose.id);
      const leaderSpeed = before ? distance(before, view.leader.pose) / SIM_STEP_S : 0;
      wanted = Math.min(wanted, leaderSpeed + free / 2, Math.sqrt(2 * COMFORT_BRAKE_MPS2 * free));
    }
    wanted = Math.min(wanted, toStop(clearAheadM(body, snapshot.poses) - SWEEP_MARGIN_M));
    for (const pose of snapshot.poses) lastSeen.set(pose.id, { x: pose.x, z: pose.z });
    const speed = vehicle.speedMps;
    const tractionN = wanted > speed ? Math.min(3000, (wanted - speed) * 2000 + 150) : 0;
    const brake = wanted < speed ? Math.min(1, (speed - wanted) / 2 + (wanted === 0 ? 0.3 : 0)) : 0;
    state = stepWorld(
      EXAM_CAR,
      city.world,
      state,
      { tractionN, brake, steer: Math.max(-1, Math.min(1, wheelAngle / EXAM_CAR.maxSteerRad)) },
      SIM_STEP_S,
    );
    snapshot = source.step(snapshot, bodyBox(EXAM_CAR, state.vehicle), state.timeS, SIM_STEP_S);
    contacts.push(...state.contacts.map((contact) => contact.obstacleId));
    actorContacts.push(...snapshot.contacts);
    if (state.vehicle.speedMps === 0) {
      stoppedS += SIM_STEP_S;
      if (view.signal?.light === 'red' && stoppedS < SIM_STEP_S * 1.5) lightStops++;
    } else {
      longestStopS = Math.max(longestStopS, stoppedS);
      stoppedS = 0;
    }
    if (contacts.length || actorContacts.length) break;
  }
  const diagnostic = JSON.stringify({
    index,
    timeS: state.timeS,
    x: state.vehicle.x,
    z: state.vehicle.z,
    speed: state.vehicle.speedMps,
    view: lookAhead(traffic, snapshot, bodyBox(EXAM_CAR, state.vehicle)),
    near: snapshot.poses.filter((pose) => distance(pose, state.vehicle) < 12),
  });
  expect(contacts, diagnostic).toEqual([]);
  expect(actorContacts, diagnostic).toEqual([]);
  expect(index, diagnostic).toBeGreaterThanOrEqual(waypoints.length + 20);
  expect(state.vehicle.odometerM).toBeGreaterThan(1400);
  expect(redCrossings).toBe(0);
  expect(lightStops).toBeGreaterThan(0);
  expect(longestStopS).toBeLessThanOrEqual(CYCLE_PERIOD_S);
  expect(step).toBeLessThan(MAX_STEPS);
  // The traffic kept moving around the car: the lap's actors are spread along it, not piled up behind.
  const lapVehicles = snapshot.vehicles.filter(
    (item) => traffic.vehicles.find((plan) => plan.id === item.id)?.pathId === 'lap',
  );
  const positions = lapVehicles.map((item) => pointAlong(lap, item.s).point);
  expect(positions.some((point) => distance(point, state.vehicle) > 200)).toBe(true);
  expect(snapshot.poses.filter((pose) => overlaps(pose.box, bodyBox(EXAM_CAR, state.vehicle)))).toHaveLength(0);
}, 240000);
