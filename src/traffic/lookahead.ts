import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { ActorPose, LightState } from '../sim/scenario.ts';
import { intersectionLight } from './lights.ts';
import { headingDifference, locateOnPath, pointAlong } from './network.ts';
import type { Path } from './network.ts';
import type { Traffic, TrafficState } from './traffic.ts';

/** How far the car may stray from the route's lane centre and still be "on the route". */
const ROUTE_LATERAL_M = 6;
/** A vehicle within this lateral distance of the car's own line is ahead of it, not beside it. */
const LEADER_LATERAL_M = 2.3;
const LEADER_LOOKAHEAD_M = 60;
/**
 * Largest heading difference between a leader and the way it is compared with (the route's or the car's).
 */
const LEADER_MAX_TURN_RAD = Math.PI / 3;
export const LOOKAHEAD_M = 80;

export interface SignalAhead {
  /** The control whose lamps the driver sees (an intersection signal or a signalled crossing). */
  controlId: string | null;
  intersectionId: string | null;
  light: LightState;
  /** From the front bumper to the stop line; negative once past it. */
  distanceM: number;
}

export interface CrossingAhead {
  intersectionId: string;
  approachId: string;
  rule: 'stop' | 'priority';
  distanceM: number;
  /** The pavement the car must cross; a vehicle inside it has to be let through. */
  conflicts: readonly OrientedBox[];
}

export interface CrosswalkAhead {
  crosswalkId: string;
  distanceM: number;
  /** A pedestrian is on it. */
  occupied: boolean;
}

export interface LeaderAhead {
  pose: ActorPose;
  /** Bumper to bumper, along the car's heading. */
  gapM: number;
}

/** What governs the car next along the route: the examiner (F04-T03) and test drivers read this, never the state. */
export interface DriverView {
  /** Distance along the route's lap path, or null when the car is off the route. */
  routeS: number | null;
  signal: SignalAhead | null;
  crossing: CrossingAhead | null;
  crosswalk: CrosswalkAhead | null;
  leader: LeaderAhead | null;
}

const lapOf = (traffic: Traffic): Path | undefined => traffic.network.paths.find((path) => path.id === 'lap');

function aheadOnLap(lap: Path, fromS: number, toS: number): number {
  const delta = toS - fromS;
  const wrapped = ((delta % lap.lengthM) + lap.lengthM) % lap.lengthM;
  return wrapped > lap.lengthM / 2 ? wrapped - lap.lengthM : wrapped;
}

function frontS(lap: Path, carBody: OrientedBox): number | null {
  const located = locateOnPath(lap, { x: carBody.centerX, z: carBody.centerZ }, ROUTE_LATERAL_M);
  return located ? located.s + carBody.halfLengthM : null;
}

/** The light the car faces next on the route, within LOOKAHEAD_M; null when none applies. */
export function governingLight(
  traffic: Traffic,
  lights: Readonly<Record<string, LightState>>,
  carBody: OrientedBox,
  timeS: number,
): LightState | null {
  return signalAhead(traffic, lights, carBody, timeS)?.light ?? null;
}

function signalAhead(
  traffic: Traffic,
  lights: Readonly<Record<string, LightState>>,
  carBody: OrientedBox,
  timeS: number,
): SignalAhead | null {
  const lap = lapOf(traffic);
  if (!lap) return null;
  const front = frontS(lap, carBody);
  if (front === null) return null;
  let best: SignalAhead | null = null;
  const consider = (candidate: SignalAhead) => {
    if (candidate.distanceM < -carBody.halfLengthM * 2 || candidate.distanceM > LOOKAHEAD_M) return;
    if (!best || candidate.distanceM < best.distanceM) best = candidate;
  };
  for (const stop of lap.stops) {
    const intersection = traffic.network.intersections.find((item) => item.id === stop.approach.intersectionId);
    if (!intersection || intersection.kind !== 'signal') continue;
    const light = intersectionLight(traffic.plan, intersection, stop.approach.group, timeS);
    if (!light) continue;
    consider({
      controlId: intersection.control?.id ?? null,
      intersectionId: intersection.id,
      light,
      distanceM: aheadOnLap(lap, front, stop.atS),
    });
  }
  for (const crossing of lap.crosswalks) {
    const { controlId } = crossing.crosswalk;
    const light = controlId ? lights[controlId] : undefined;
    if (!controlId || !light) continue;
    consider({
      controlId,
      intersectionId: crossing.crosswalk.intersectionId,
      light,
      distanceM: aheadOnLap(lap, front, crossing.atS),
    });
  }
  return best;
}

/** Everything relevant ahead of the car on the route, from the current traffic state. */
export function lookAhead(traffic: Traffic, state: TrafficState, carBody: OrientedBox): DriverView {
  const lap = lapOf(traffic);
  const front = lap ? frontS(lap, carBody) : null;
  const empty: DriverView = { routeS: null, signal: null, crossing: null, crosswalk: null, leader: null };
  // Through a corner the car's heading lags: the way the route takes over the next 20 m also counts.
  const route: LeaderRoute | undefined =
    // Only while the car itself keeps to the route's line: after a lane change the line is someone else's lane.
    lap && front !== null && locateOnPath(lap, { x: carBody.centerX, z: carBody.centerZ }, LEADER_LATERAL_M)
      ? {
          ways: [0, 5, 10, 15, 20].map((aheadM) => pointAlong(lap, front + aheadM).headingRad),
          locate: (point) => {
            const located = locateOnPath(lap, point, LEADER_LATERAL_M);
            return located
              ? { aheadM: aheadOnLap(lap, front, located.s), headingRad: pointAlong(lap, located.s).headingRad }
              : null;
          },
        }
      : undefined;
  const leader = leaderAhead(state.poses, carBody, route);
  if (!lap || front === null) return { ...empty, leader };
  let crossing: CrossingAhead | null = null;
  for (const stop of lap.stops) {
    if (stop.approach.rule === 'signal') continue;
    const distanceM = aheadOnLap(lap, front, stop.atS);
    if (distanceM < -1 || distanceM > LOOKAHEAD_M) continue;
    if (!crossing || distanceM < crossing.distanceM)
      crossing = {
        intersectionId: stop.approach.intersectionId,
        approachId: stop.approach.id,
        rule: stop.approach.rule,
        distanceM,
        conflicts: stop.approach.conflicts,
      };
  }
  let crosswalk: CrosswalkAhead | null = null;
  for (const item of lap.crosswalks) {
    const distanceM = aheadOnLap(lap, front, item.atS);
    if (distanceM < -1 || distanceM > LOOKAHEAD_M) continue;
    if (!crosswalk || distanceM < crosswalk.distanceM)
      crosswalk = {
        crosswalkId: item.crosswalk.id,
        distanceM,
        occupied: state.poses.some((pose) => pose.kind === 'pedestrian' && pose.inside(item.crosswalk.box)),
      };
  }
  return {
    routeS: front - carBody.halfLengthM,
    signal: signalAhead(traffic, state.lights, carBody, state.timeS),
    crossing,
    crosswalk,
    leader,
  };
}

/** The nearest vehicle ahead on the car's own line. */
/** The route the car follows, for leaders: its way over the next metres and its heading where an actor stands. */
export interface LeaderRoute {
  /** The route's headings over the next 20 m ahead of the bumper, a corner included. */
  ways: readonly number[];
  /** Where an actor stands on the route's line: metres ahead of the bumper along it, and the route's heading there. */
  locate(point: { x: number; z: number }): { aheadM: number; headingRad: number } | null;
}

/** An actor's half extent along a heading `turn` away from its own. */
const reach = (pose: ActorPose, turn: number) =>
  Math.abs(Math.cos(turn)) * pose.box.halfLengthM + Math.abs(Math.sin(turn)) * pose.box.halfWidthM;

/**
 * The vehicle ahead. On the route's line it is followed along the route, as the actors follow each other, so a
 * vehicle turning ahead at a corner is still the leader before the car turns. Off the line, it must be straight ahead
 * of the car within its corridor and travel the car's way or the route's way over the next metres. Crossing or
 * oncoming traffic is a conflict, never a leader.
 */
export function leaderAhead(
  poses: readonly ActorPose[],
  carBody: OrientedBox,
  route?: LeaderRoute,
): LeaderAhead | null {
  const forward = { x: Math.sin(carBody.headingRad), z: Math.cos(carBody.headingRad) };
  const left = { x: Math.cos(carBody.headingRad), z: -Math.sin(carBody.headingRad) };
  let best: LeaderAhead | null = null;
  const consider = (pose: ActorPose, gapM: number) => {
    const gap = overlaps(pose.box, carBody) ? 0 : Math.max(0, gapM);
    if (!best || gap < best.gapM) best = { pose, gapM: gap };
  };
  for (const pose of poses) {
    if (pose.kind === 'pedestrian' || !pose.active) continue;
    const alongTheWay = (way: number) => Math.abs(headingDifference(pose.headingRad, way)) <= LEADER_MAX_TURN_RAD;
    const onRoute = route?.locate(pose);
    if (onRoute && alongTheWay(onRoute.headingRad)) {
      if (onRoute.aheadM > 0 && onRoute.aheadM <= LEADER_LOOKAHEAD_M)
        consider(pose, onRoute.aheadM - reach(pose, headingDifference(pose.headingRad, onRoute.headingRad)));
      continue;
    }
    const dx = pose.x - carBody.centerX,
      dz = pose.z - carBody.centerZ;
    const along = dx * forward.x + dz * forward.z;
    const lateral = Math.abs(dx * left.x + dz * left.z);
    if (along <= 0 || along > LEADER_LOOKAHEAD_M || lateral > LEADER_LATERAL_M) continue;
    if (!alongTheWay(carBody.headingRad) && !route?.ways.some(alongTheWay)) continue;
    consider(pose, along - carBody.halfLengthM - reach(pose, headingDifference(pose.headingRad, carBody.headingRad)));
  }
  return best;
}
