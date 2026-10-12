import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { ActorPose, LightState } from '../sim/scenario.ts';
import { intersectionLight } from './lights.ts';
import { locateOnPath } from './network.ts';
import type { Path } from './network.ts';
import type { Traffic, TrafficState } from './traffic.ts';

/** How far the car may stray from the route's lane centre and still be "on the route". */
const ROUTE_LATERAL_M = 6;
/** A vehicle within this lateral distance of the car's own line is ahead of it, not beside it. */
const LEADER_LATERAL_M = 2.3;
const LEADER_LOOKAHEAD_M = 60;
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
  const leader = leaderAhead(state.poses, carBody);
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
export function leaderAhead(poses: readonly ActorPose[], carBody: OrientedBox): LeaderAhead | null {
  const forward = { x: Math.sin(carBody.headingRad), z: Math.cos(carBody.headingRad) };
  const left = { x: Math.cos(carBody.headingRad), z: -Math.sin(carBody.headingRad) };
  let best: LeaderAhead | null = null;
  for (const pose of poses) {
    if (pose.kind === 'pedestrian' || !pose.active) continue;
    const dx = pose.x - carBody.centerX,
      dz = pose.z - carBody.centerZ;
    const along = dx * forward.x + dz * forward.z;
    const lateral = Math.abs(dx * left.x + dz * left.z);
    if (along <= 0 || along > LEADER_LOOKAHEAD_M || lateral > LEADER_LATERAL_M) continue;
    const gapM = overlaps(pose.box, carBody) ? 0 : along - carBody.halfLengthM - pose.box.halfLengthM;
    if (!best || gapM < best.gapM) best = { pose, gapM };
  }
  return best;
}
