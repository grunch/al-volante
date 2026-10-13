import { createRandom } from '../activities/random.ts';
import type { City } from '../city/model.ts';
import { distance, offsetPoint } from '../city/model.ts';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox, Point } from '../sim/collision.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';
import type { ActorKind, ActorPose, LightState, TrafficSnapshot, TrafficSource } from '../sim/scenario.ts';
import { createEmergencyState, emergencyPose, planEmergency, stepEmergency } from './emergency.ts';
import type { EmergencyPlan, EmergencyState } from './emergency.ts';
import { controlLights, createSignalPlan, crosswalkLight, intersectionLight, redRemainingS } from './lights.ts';
import type { SignalPlan } from './lights.ts';
import { governingLight } from './lookahead.ts';
import { buildNetwork, headingDifference, locateOnPath, pointAlong, travelDistance } from './network.ts';
import type { Approach, Crosswalk, Intersection, Network, Path } from './network.ts';

/** Body sizes per kind, in metres (length × width); the car matches EXAM_CAR, the rest are design approximations. */
export const ACTOR_SIZES: Record<ActorKind, { lengthM: number; widthM: number }> = {
  vehicle: { lengthM: 4.3, widthM: 1.75 },
  bus: { lengthM: 12, widthM: 2.5 },
  pedestrian: { lengthM: 0.5, widthM: 0.5 },
  bicycle: { lengthM: 1.8, widthM: 0.6 },
  emergency: { lengthM: 5, widthM: 2 },
};

/** Actors farther than this from the car are neither posed nor spawned. */
export const ACTIVE_RADIUS_M = 250;
/** Hard cap on posed actors per step (the farthest are dropped first). */
export const MAX_ACTIVE_ACTORS = 60;
/** One vehicle per this many metres of path, at least one on paths of 60 m or more. */
const VEHICLE_SPACING_M = 120;
const MIN_PATH_LENGTH_M = 60;
const BICYCLES_PER_TRACK = 3;
/** Longitudinal limits (m/s²) and the following rule: 2 s of headway (manual.pdf PDF 71) plus a standing gap. */
const ACCEL_MPS2 = 2;
const BRAKE_COMFORT_MPS2 = 3;
const BRAKE_MAX_MPS2 = 5;
const HEADWAY_S = 2;
const STANDING_GAP_M = 3;
/**
 * Beside the parking bay, behind the player's car stopped in double file and driving the same way, the actors
 * leave room for the reverse of the parking manoeuvre (protocolo PDF 13). A game approximation: within this
 * radius of the bay, while the car is slower than this, they keep this standing gap instead of 3 m.
 */
const ROOM_BEHIND_CAR_M = 8;
const ROOM_RADIUS_M = 25;
const ROOM_UNDER_MPS = 2.5;
const BEHIND_CAR_ALIGNED_RAD = 0.5;
/** A car backing towards a vehicle faster than this makes it wait where it is. */
const BACKING_MPS = 0.1;
const LEADER_LOOKAHEAD_M = 60;
/** Speed through a corner link between two lanes that turn more than CORNER_RAD (game approximation). */
const CORNER_MPS = 4;
const CORNER_RAD = Math.PI / 6;
/** A vehicle in another lane is a leader when its centre is this close to the path. */
const LEADER_LATERAL_M = 2.3;
/** Anything straight ahead of the body within this distance is followed too, whatever path it is on. */
const CORRIDOR_M = 30;
const CORRIDOR_MARGIN_M = 0.5;
/** A STOP sign demands a full stop (manual.pdf PDF 64); the wait is a game approximation. */
const STOP_WAIT_S = 1;
const STOP_TOLERANCE_M = 0.6;
/** Vehicles approaching a crossing within this distance, or this many seconds at their speed, count for yields. */
const YIELD_LOOKAHEAD_M = 20;
const YIELD_LOOKAHEAD_S = 4;
/** The car counts as crossing a pavement it is on once it has turned this far from the approach (mid-turn). */
const CAR_TURNING_RAD = Math.PI / 8;
/** Below this speed the car counts as standing still at its line (it waits for whoever is crossing). */
const CAR_STILL_MPS = 0.05;
/** How far along its own path (beyond its body) an actor checks that the waiting car leaves its way free. */
const PATH_CLEAR_AHEAD_M = 6;
const PATH_STEP_M = 0.5;
/** A right-hand vehicle that has stopped this long loses its priority (manual.pdf PDF 64, exception 4). */
const PRIORITY_STOPPED_S = 1.5;
/**
 * A vehicle stuck yielding this long proceeds when everyone it waits for also stands at their own line, so mutual
 * waits cannot last forever (game approximation); it never proceeds over anyone on the crossing or over the car.
 */
export const DEADLOCK_S = 8;
const LOOKAHEAD_M = 60;
/** Pedestrians: walking speeds, gap before stepping off at unsignalled crossings, and respawn delays. */
const WALK_MIN_MPS = 1.1;
const WALK_MAX_MPS = 1.5;
const PEDESTRIAN_GAP_M = 15;
const PEDESTRIAN_GAP_SPEED_MPS = 1;
/** Nobody steps off in front of the player's car moving off right by the crosswalk (F04-T04, a game approximation). */
const PEDESTRIAN_CAR_CLOSE_M = 6;
const PEDESTRIAN_CAR_MOVING_MPS = 0.1;
const WALK_INTERVAL_MIN_S = 25;
const WALK_INTERVAL_MAX_S = 55;
const RESPAWN_MIN_S = 4;
const RESPAWN_MAX_S = 12;
/** A vehicle reappears at its path start only this far from the car and from other vehicles. */
const RESPAWN_CLEAR_M = 40;
const RESPAWN_PATH_GAP_M = 15;

export interface VehiclePlan {
  id: string;
  kind: ActorKind;
  pathId: string;
  halfLengthM: number;
  halfWidthM: number;
  /** Share of the lane speed this driver keeps. */
  speedFactor: number;
  startS: number;
  respawnDelayS: number;
}

export interface WalkSchedule {
  firstS: number;
  intervalS: number;
  speedMps: number;
  /** Kerb the first pedestrian starts from. */
  side: 0 | 1;
}

export interface Traffic {
  seed: number;
  network: Network;
  plan: SignalPlan;
  vehicles: VehiclePlan[];
  walks: Readonly<Record<string, WalkSchedule>>;
  /** The ambulance of the lap (F04-T03); null when the network has no lap. Tests set it to null to isolate rules. */
  emergency: EmergencyPlan | null;
  /** Centre of the parking bay (F04-T04): vehicles leave room behind a car stopped beside it. */
  parkingBayAt?: Point;
}

export interface VehicleState {
  id: string;
  s: number;
  speedMps: number;
  stoppedS: number;
  waitingS: number;
  /** `atS` of the STOP line it has fully stopped at, until it passes it. */
  clearedStopS: number | null;
  /** `atS` of the crossing where it breaks a mutual wait (after DEADLOCK_S), until it passes it. */
  forcedStopS: number | null;
  /** When it reappears at the start of a finished path; null while on the road. */
  respawnS: number | null;
}

export interface PedestrianState {
  id: string;
  crosswalkId: string;
  /** Fraction of the kerb-to-kerb walk. */
  progress: number;
  side: 0 | 1;
  speedMps: number;
  /** Count of walks on this crosswalk, so each pedestrian has a stable, distinct id. */
  walk: number;
}

export interface TrafficState extends TrafficSnapshot {
  vehicles: readonly VehicleState[];
  pedestrians: readonly PedestrianState[];
  /** Next time a pedestrian may step off at each crosswalk, and how many walks it had. */
  walks: Readonly<Record<string, { nextS: number; count: number }>>;
  /** Where the car body was last step, to estimate its speed. */
  carCenter: Point | null;
  carSpeedMps: number;
  carStoppedS: number;
  touching: readonly string[];
  emergency: EmergencyState;
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

/** Lookups by id, built once per traffic description. */
interface Index {
  plans: Map<string, VehiclePlan>;
  paths: Map<string, Path>;
  intersections: Map<string, Intersection>;
  crosswalks: Map<string, Crosswalk>;
}
const indexes = new WeakMap<Traffic, Index>();
function indexOf(traffic: Traffic): Index {
  const cached = indexes.get(traffic);
  if (cached) return cached;
  const index: Index = {
    plans: new Map(traffic.vehicles.map((plan) => [plan.id, plan])),
    paths: new Map(traffic.network.paths.map((path) => [path.id, path])),
    intersections: new Map(traffic.network.intersections.map((item) => [item.id, item])),
    crosswalks: new Map(traffic.network.crosswalks.map((item) => [item.id, item])),
  };
  indexes.set(traffic, index);
  return index;
}

const between = (random: () => number, min: number, max: number) => min + random() * (max - min);

function planVehicles(network: Network, random: () => number): VehiclePlan[] {
  const vehicles: VehiclePlan[] = [];
  for (const path of network.paths) {
    // Density follows the lanes themselves, not the stubs beyond them (a 36 m link gets no vehicle).
    const lanesM = path.segments.reduce((sum, segment) => sum + segment.lane.lengthM, 0);
    const count =
      path.kind === 'bicycle'
        ? BICYCLES_PER_TRACK
        : lanesM < MIN_PATH_LENGTH_M
          ? 0
          : Math.max(1, Math.floor(lanesM / VEHICLE_SPACING_M));
    const spacing = path.lengthM / count;
    for (let index = 0; index < count; index++) {
      const kind: ActorKind = path.kind === 'bus' ? 'bus' : path.kind === 'bicycle' ? 'bicycle' : 'vehicle';
      const size = ACTOR_SIZES[kind];
      vehicles.push({
        id: `${kind}-${vehicles.length}`,
        kind,
        pathId: path.id,
        halfLengthM: size.lengthM / 2,
        halfWidthM: size.widthM / 2,
        speedFactor: between(random, 0.85, 1),
        startS: Math.min(path.lengthM - size.lengthM, (index + between(random, 0.2, 0.8)) * spacing),
        respawnDelayS: between(random, RESPAWN_MIN_S, RESPAWN_MAX_S),
      });
    }
  }
  return vehicles;
}

export function createTraffic(city: City, seed: number): Traffic {
  if (!Number.isInteger(seed) || seed < 0) throw new Error('Traffic seed must be a non-negative integer');
  const random = createRandom(seed);
  const network = buildNetwork(city);
  const plan = createSignalPlan(network, random);
  const vehicles = planVehicles(network, random);
  const walks: Record<string, WalkSchedule> = {};
  for (const crosswalk of network.crosswalks)
    walks[crosswalk.id] = {
      firstS: between(random, 2, WALK_INTERVAL_MAX_S),
      intervalS: between(random, WALK_INTERVAL_MIN_S, WALK_INTERVAL_MAX_S),
      speedMps: between(random, WALK_MIN_MPS, WALK_MAX_MPS),
      side: random() < 0.5 ? 0 : 1,
    };
  const { pose } = city.start;
  const parkingBayAt = offsetPoint(pose, pose.headingRad, 0, EXAM_CAR.lengthM / 2 - EXAM_CAR.rearOverhangM);
  return { seed, network, plan, vehicles, walks, emergency: planEmergency(network), parkingBayAt };
}

export function createTrafficState(traffic: Traffic): TrafficState {
  return {
    timeS: 0,
    light: 'green',
    lights: controlLights(traffic.plan, traffic.network, 0),
    poses: [],
    contacts: [],
    vehicles: traffic.vehicles.map((vehicle) => ({
      id: vehicle.id,
      s: vehicle.startS,
      speedMps: 0,
      stoppedS: 0,
      waitingS: 0,
      clearedStopS: null,
      forcedStopS: null,
      respawnS: null,
    })),
    pedestrians: [],
    walks: Object.fromEntries(
      Object.entries(traffic.walks).map(([id, schedule]) => [id, { nextS: schedule.firstS, count: 0 }]),
    ),
    carCenter: null,
    carSpeedMps: 0,
    carStoppedS: 0,
    touching: [],
    emergency: createEmergencyState(),
  };
}

/** A posed vehicle of the previous step, as the others see it while deciding. */
interface Placed {
  plan: VehiclePlan;
  state: VehicleState;
  path: Path;
  point: Point;
  headingRad: number;
  box: OrientedBox;
}

function place(index: Index, state: VehicleState): Placed | null {
  if (state.respawnS !== null) return null;
  const plan = required(index.plans.get(state.id), 'vehicle plan');
  const path = required(index.paths.get(plan.pathId), 'path');
  const { point, headingRad } = pointAlong(path, state.s);
  return {
    plan,
    state,
    path,
    point,
    headingRad,
    box: {
      centerX: point.x,
      centerZ: point.z,
      halfLengthM: plan.halfLengthM,
      halfWidthM: plan.halfWidthM,
      headingRad,
    },
  };
}

const poseOf = (id: string, kind: ActorKind, box: OrientedBox, active: boolean): ActorPose => ({
  id,
  kind,
  x: box.centerX,
  z: box.centerZ,
  headingRad: box.headingRad,
  active,
  box,
  inside: (zone) => overlaps(box, zone),
});

/** The lane speed at `s`; the stubs and corner links outside any lane take the slower of their neighbours. */
export function laneSpeedAt(path: Path, s: number): number {
  const segment = pointAlong(path, s).segment;
  if (segment) return segment.lane.speedMps;
  const wrapped = path.cyclic ? ((s % path.lengthM) + path.lengthM) % path.lengthM : s;
  const first = required(path.segments[0], 'segment');
  const last = required(path.segments.at(-1), 'segment');
  let previous = path.cyclic ? last : first;
  let next = path.cyclic ? first : last;
  for (const candidate of path.segments) {
    if (candidate.endS <= wrapped) previous = candidate;
    else {
      next = candidate;
      break;
    }
  }
  return Math.min(previous.lane.speedMps, next.lane.speedMps);
}

/** Allowed speed now to be at `targetMps` after `distanceM` of comfort braking. */
const speedToReach = (targetMps: number, distanceM: number) =>
  Math.sqrt(targetMps * targetMps + 2 * BRAKE_COMFORT_MPS2 * Math.max(0, distanceM));

/** Slower lanes and corners ahead, anticipated so the vehicle enters them at their speed. */
function speedLimitAhead(path: Path, frontS: number): number {
  let allowed = Infinity;
  path.segments.forEach((segment, index) => {
    const toStart = aheadM(path, frontS, segment.startS);
    if (toStart > 0 && toStart <= LOOKAHEAD_M)
      allowed = Math.min(allowed, speedToReach(segment.lane.speedMps, toStart));
    const next = path.segments[index + 1] ?? (path.cyclic ? path.segments[0] : undefined);
    if (!next || Math.abs(headingDifference(next.lane.headingRad, segment.lane.headingRad)) < CORNER_RAD) return;
    const toCorner = aheadM(path, frontS, segment.endS);
    if (toCorner > -1 && toCorner <= LOOKAHEAD_M) allowed = Math.min(allowed, speedToReach(CORNER_MPS, toCorner));
  });
  return allowed;
}

/**
 * Whether a light `distanceM` ahead holds the vehicle: always on red; on yellow only while it can still stop before
 * the line at full braking. Stop lines and signalled crossings share this rule.
 */
const mustStopAtLight = (light: LightState | null, distanceM: number, speedMps: number) =>
  light === 'red' || (light === 'yellow' && distanceM >= (speedMps * speedMps) / (2 * BRAKE_MAX_MPS2));

/** Allowed speed now so that the vehicle can stop, at comfort braking, in `distanceM`. */
function speedToStop(distanceM: number): number {
  return distanceM <= 0.3 ? 0 : Math.sqrt(2 * BRAKE_COMFORT_MPS2 * distanceM);
}

/** Allowed speed behind a leader `gapM` ahead moving at `leaderMps`: two seconds of headway plus a standing gap. */
function speedBehind(gapM: number, leaderMps: number, standingGapM = STANDING_GAP_M): number {
  const free = Math.max(0, gapM - standingGapM);
  return Math.min(leaderMps + free / HEADWAY_S, Math.sqrt(leaderMps * leaderMps + 2 * BRAKE_COMFORT_MPS2 * free));
}

/** Bumper gap to a box straight ahead of `self` in its own frame, or null when it is beside or behind. */
function corridorGap(self: Placed, box: OrientedBox): number | null {
  const forward = { x: Math.sin(self.headingRad), z: Math.cos(self.headingRad) };
  const left = { x: Math.cos(self.headingRad), z: -Math.sin(self.headingRad) };
  const dx = box.centerX - self.point.x,
    dz = box.centerZ - self.point.z;
  const along = dx * forward.x + dz * forward.z;
  const lateral = Math.abs(dx * left.x + dz * left.z);
  const turn = headingDifference(box.headingRad, self.headingRad);
  // The other box's extent along and across this heading, from its orientation.
  const reachAlong = Math.abs(Math.cos(turn)) * box.halfLengthM + Math.abs(Math.sin(turn)) * box.halfWidthM;
  const reachAcross = Math.abs(Math.sin(turn)) * box.halfLengthM + Math.abs(Math.cos(turn)) * box.halfWidthM;
  if (along <= 0 || along > CORRIDOR_M || lateral > self.plan.halfWidthM + reachAcross + CORRIDOR_MARGIN_M) return null;
  return Math.max(0, along - self.plan.halfLengthM - reachAlong);
}

/** Distance ahead along a path from `fromS` to `toS`, wrapping on cyclic paths; negative when behind. */
function aheadM(path: Path, fromS: number, toS: number): number {
  const delta = toS - fromS;
  if (!path.cyclic) return delta;
  const wrapped = ((delta % path.lengthM) + path.lengthM) % path.lengthM;
  return wrapped > path.lengthM / 2 ? wrapped - path.lengthM : wrapped;
}

interface Car {
  body: OrientedBox;
  center: Point;
  front: Point;
  speedMps: number;
  /** Velocity estimated between steps; a follower reads only the part moving away from it. */
  velocity: Point;
  stoppedS: number;
}

/** The car as a vehicle approaching an intersection: which approach, how far its front is from the stop line. */
function carApproach(approach: Approach, car: Car): { distanceM: number } | null {
  const { road, reverse } = approach;
  const lateral = Math.abs(
    (car.body.centerX - road.a.x) * -Math.cos(road.headingRad) +
      (car.body.centerZ - road.a.z) * Math.sin(road.headingRad),
  );
  if (lateral > road.widthM / 2 + 1) return null;
  if (Math.abs(headingDifference(car.body.headingRad, approach.headingRad)) > Math.PI / 3) return null;
  const along = travelDistance(road, reverse, car.center);
  if (along <= 0 || along >= road.lengthM) return null;
  return { distanceM: approach.entryM - travelDistance(road, reverse, car.front) };
}

/** Someone a vehicle waits for at a crossing: another actor, or the car. */
type Holder = Placed | 'car';

/** Whoever vehicle `self` on `approach` must wait for: anyone inside the crossing, or arriving with priority. */
function holdersAt(
  traffic: Traffic,
  intersectionId: string,
  approach: Approach,
  self: Placed | null,
  others: readonly Placed[],
  car: Car,
  carPresent: boolean,
): Holder[] {
  const intersection = required(indexOf(traffic).intersections.get(intersectionId), 'intersection');
  const fromRight = (other: Approach) => {
    const difference = headingDifference(other.headingRad, approach.headingRad);
    return difference > Math.PI / 4 && difference < (3 * Math.PI) / 4;
  };
  // A STOP loses the priority even from the right (manual.pdf PDF 64, exception 1): nobody yields to who arrives at one.
  const hasPriorityOver = (other: Approach) =>
    other.id !== approach.id &&
    other.rule !== 'stop' &&
    (approach.rule === 'stop' || (approach.rule === 'priority' && fromRight(other)));
  // Someone counts as arriving when close to the crossing or seconds away from it, unless they have stood still.
  const arriving = (remainingM: number, speedMps: number, stoppedS: number) =>
    remainingM >= -1 &&
    (remainingM <= YIELD_LOOKAHEAD_M || remainingM <= speedMps * YIELD_LOOKAHEAD_S) &&
    (speedMps > 0.5 || stoppedS < PRIORITY_STOPPED_S);
  // Anyone crossing the pavement ahead is let through; parallel traffic beside the vehicle is not a conflict.
  const crossingInside = (box: OrientedBox, minAngleRad = Math.PI / 4) =>
    Math.abs(headingDifference(box.headingRad, approach.headingRad)) > minAngleRad &&
    approach.conflicts.some((conflict) => overlaps(box, conflict));
  const holders: Holder[] = [];
  for (const other of others) {
    if (other === self || (self && other.path.id === self.path.id)) continue;
    const withPriority = other.path.stops.some(
      (stop) =>
        stop.approach.intersectionId === intersectionId &&
        hasPriorityOver(stop.approach) &&
        // Wrapped on the cyclic lap: a line just past its start is ahead of a vehicle still at its end.
        arriving(
          aheadM(other.path, other.state.s + other.plan.halfLengthM, stop.atS),
          other.state.speedMps,
          other.state.stoppedS,
        ),
    );
    if (withPriority || crossingInside(other.box)) holders.push(other);
  }
  if (!carPresent) return holders;
  const carWithPriority = intersection.approaches.some((other) => {
    if (!hasPriorityOver(other)) return false;
    const relation = carApproach(other, car);
    return relation !== null && arriving(relation.distanceM, car.speedMps, car.stoppedS);
  });
  // The car standing mid-turn on the pavement is already crossing, though still closer to the approach's heading.
  if (carWithPriority || crossingInside(car.body, CAR_TURNING_RAD)) holders.push('car');
  return holders;
}

/**
 * Whether `other` stands still at its line of a crossing `self` is already driving across, so it waits for `self`:
 * it is not a vehicle ahead of `self` even when it brushes its corridor, or both would wait for each other forever.
 */
function waitsAtLineFor(other: Placed, self: Placed): boolean {
  if (other.state.speedMps > 0 || other.path.id === self.path.id) return false;
  const front = other.state.s + other.plan.halfLengthM;
  return other.path.stops.some((stop) => {
    const remaining = aheadM(other.path, front, stop.atS);
    return (
      remaining >= -STOP_TOLERANCE_M &&
      remaining <= STOP_TOLERANCE_M + 0.5 &&
      Math.abs(headingDifference(self.headingRad, stop.approach.headingRad)) > Math.PI / 4 &&
      stop.approach.conflicts.some((conflict) => overlaps(self.box, conflict))
    );
  });
}

/** Whether the car's body stands on `self`'s own path just ahead, as the actor will sweep it (curves included). */
function carOnPathAhead(self: Placed, car: Car): boolean {
  for (let ahead = 0; ahead <= self.plan.halfLengthM + PATH_CLEAR_AHEAD_M; ahead += PATH_STEP_M) {
    const { point, headingRad } = pointAlong(self.path, self.state.s + ahead);
    const swept: OrientedBox = {
      centerX: point.x,
      centerZ: point.z,
      halfLengthM: self.plan.halfLengthM,
      halfWidthM: self.plan.halfWidthM,
      headingRad,
    };
    if (overlaps(swept, car.body)) return true;
  }
  return false;
}

/**
 * Whether the car stands still at its line of a crossing `self` is already driving across: like `waitsAtLineFor`,
 * it waits for `self` and is no obstacle ahead, even when its bonnet brushes the straight-line corridor of an actor
 * turning past it; otherwise both would wait for each other forever (the car yields to whoever is inside the
 * crossing). A car standing on the actor's own path is still an obstacle: the actor never drives into it.
 */
function carWaitsAtLineFor(traffic: Traffic, car: Car, self: Placed): boolean {
  if (car.speedMps > CAR_STILL_MPS || carOnPathAhead(self, car)) return false;
  for (const intersection of indexOf(traffic).intersections.values()) {
    if (distance(intersection.center, car.center) > LEADER_LOOKAHEAD_M) continue;
    for (const approach of intersection.approaches) {
      const relation = carApproach(approach, car);
      if (
        relation !== null &&
        relation.distanceM >= -STOP_TOLERANCE_M &&
        relation.distanceM <= STOP_TOLERANCE_M + 0.5 &&
        Math.abs(headingDifference(self.headingRad, approach.headingRad)) > Math.PI / 4 &&
        approach.conflicts.some((conflict) => overlaps(self.box, conflict))
      )
        return true;
    }
  }
  return false;
}

/**
 * Whether the deadlock break may pass `holder`: an actor standing still before its own line at this crossing, so
 * both wait at the edge and nobody is on the pavement. The car, anyone moving and anyone already past their line
 * keep holding. Between two stuck vehicles, the one already breaking, then the longer wait, then the lower id goes.
 */
function passableInDeadlock(holder: Holder, self: Placed, intersectionId: string, breaking: boolean): boolean {
  if (holder === 'car' || holder.state.speedMps > 0) return false;
  const front = holder.state.s + holder.plan.halfLengthM;
  const line = holder.path.stops.find(
    (stop) =>
      stop.approach.intersectionId === intersectionId && aheadM(holder.path, front, stop.atS) >= -STOP_TOLERANCE_M,
  );
  if (!line) return false;
  if (breaking) return true;
  const { waitingS } = holder.state;
  const goesFirst =
    holder.state.forcedStopS === line.atS ||
    (waitingS >= DEADLOCK_S &&
      (waitingS > self.state.waitingS || (waitingS === self.state.waitingS && holder.plan.id < self.plan.id)));
  return !goesFirst;
}

function pedestrianBoxes(traffic: Traffic, pedestrians: readonly PedestrianState[]): Map<string, OrientedBox> {
  const boxes = new Map<string, OrientedBox>();
  for (const pedestrian of pedestrians) {
    const crosswalk = required(indexOf(traffic).crosswalks.get(pedestrian.crosswalkId), 'crosswalk');
    boxes.set(pedestrian.id, pedestrianBox(crosswalk, pedestrian));
  }
  return boxes;
}

function pedestrianBox(crosswalk: Crosswalk, pedestrian: PedestrianState): OrientedBox {
  const from = crosswalk.kerbs[pedestrian.side];
  const to = crosswalk.kerbs[pedestrian.side === 0 ? 1 : 0];
  const size = ACTOR_SIZES.pedestrian;
  return {
    centerX: from.x + (to.x - from.x) * pedestrian.progress,
    centerZ: from.z + (to.z - from.z) * pedestrian.progress,
    halfLengthM: size.lengthM / 2,
    halfWidthM: size.widthM / 2,
    headingRad: Math.atan2(to.x - from.x, to.z - from.z),
  };
}

interface Decision {
  targetMps: number;
  yielding: boolean;
  clearedStopS: number | null;
  forcedStopS: number | null;
}

function decide(
  traffic: Traffic,
  self: Placed,
  others: readonly Placed[],
  pedestrians: ReadonlyMap<string, OrientedBox>,
  car: Car,
  carPresent: boolean,
  timeS: number,
): Decision {
  const { path, state, plan } = self;
  const frontS = state.s + plan.halfLengthM;
  // The whole body must be inside a faster lane before speeding up, and the front sets the slower limits.
  const limit = Math.min(laneSpeedAt(path, frontS), laneSpeedAt(path, state.s - plan.halfLengthM));
  let target = Math.min(limit, speedLimitAhead(path, frontS)) * plan.speedFactor;
  // The vehicle ahead on this path, or anyone standing on it (the car included).
  for (const other of others) {
    if (other === self || waitsAtLineFor(other, self)) continue;
    let gap: number | null = null;
    if (other.path.id === path.id) {
      const ahead = aheadM(path, state.s, other.state.s);
      if (ahead > 0 && ahead <= LEADER_LOOKAHEAD_M) gap = ahead - other.plan.halfLengthM - plan.halfLengthM;
    } else if (
      distance(other.point, self.point) <= LEADER_LOOKAHEAD_M &&
      // Oncoming traffic beside the path (the other half of a two-way cycle track) is never a leader.
      Math.abs(headingDifference(other.headingRad, self.headingRad)) < Math.PI / 2
    ) {
      const located = locateOnPath(path, other.point, LEADER_LATERAL_M);
      if (located) {
        const ahead = aheadM(path, state.s, located.s);
        if (ahead > 0 && ahead <= LEADER_LOOKAHEAD_M) gap = ahead - other.plan.halfLengthM - plan.halfLengthM;
      }
    }
    if (gap === null && distance(other.point, self.point) <= CORRIDOR_M) gap = corridorGap(self, other.box);
    if (gap !== null) target = Math.min(target, speedBehind(Math.max(0, gap), other.state.speedMps));
  }
  if (carPresent && distance(car.center, self.point) <= LEADER_LOOKAHEAD_M && !carWaitsAtLineFor(traffic, car, self)) {
    let gap: number | null = null;
    const located = locateOnPath(path, car.center, LEADER_LATERAL_M);
    if (located) {
      const ahead = aheadM(path, state.s, located.s);
      if (ahead > 0 && ahead <= LEADER_LOOKAHEAD_M) gap = ahead - car.body.halfLengthM - plan.halfLengthM;
    }
    const straight = corridorGap(self, car.body);
    if (straight !== null) gap = gap === null ? straight : Math.min(gap, straight);
    if (gap !== null) {
      const forward = { x: Math.sin(self.headingRad), z: Math.cos(self.headingRad) };
      const awayMps = car.velocity.x * forward.x + car.velocity.z * forward.z;
      const behind = Math.abs(headingDifference(car.body.headingRad, self.headingRad)) < BEHIND_CAR_ALIGNED_RAD;
      const besideBay =
        traffic.parkingBayAt !== undefined && distance(car.center, traffic.parkingBayAt) <= ROOM_RADIUS_M;
      const room = behind && besideBay && car.speedMps < ROOM_UNDER_MPS ? ROOM_BEHIND_CAR_M : STANDING_GAP_M;
      // A car backing towards the vehicle behind it: that one waits where it is instead of closing the gap. Other
      // vehicles (oncoming or crossing in a corner) read the car's speed as before, so corners never lock up.
      if (behind && awayMps < -BACKING_MPS) target = 0;
      else target = Math.min(target, speedBehind(Math.max(0, gap), behind ? Math.max(0, awayMps) : car.speedMps, room));
    }
  }
  // Pedestrians on the crosswalks ahead, and the lights of the signalled crossings (they bind like a stop line).
  for (const crossing of path.crosswalks) {
    const remaining = aheadM(path, frontS, crossing.atS);
    if (remaining < -STOP_TOLERANCE_M || remaining > LOOKAHEAD_M) continue;
    const { crosswalk } = crossing;
    const light = crosswalk.controlId ? crosswalkLight(traffic.plan, crosswalk, timeS) : null;
    const walkedOn = remaining >= -0.5 && [...pedestrians.values()].some((box) => overlaps(box, crosswalk.box));
    if (walkedOn || mustStopAtLight(light, remaining, state.speedMps))
      target = Math.min(target, speedToStop(remaining));
  }
  // Signals, STOP signs and priorities at the next crossings.
  let yielding = false;
  let clearedStopS = state.clearedStopS;
  let forcedStopS = state.forcedStopS;
  for (const stop of path.stops) {
    const remaining = aheadM(path, frontS, stop.atS);
    if (remaining < -STOP_TOLERANCE_M) {
      if (remaining < -plan.halfLengthM * 2 - 2) {
        if (clearedStopS === stop.atS) clearedStopS = null;
        if (forcedStopS === stop.atS) forcedStopS = null;
      }
      continue;
    }
    // Stops are sorted by `atS`, not by distance ahead: near the end of a cyclic path the next ones wrap around.
    if (remaining > LOOKAHEAD_M) continue;
    const { approach } = stop;
    const intersection = required(indexOf(traffic).intersections.get(approach.intersectionId), 'intersection');
    const light = intersectionLight(traffic.plan, intersection, approach.group, timeS);
    if (mustStopAtLight(light, remaining, state.speedMps)) {
      target = Math.min(target, speedToStop(remaining));
      continue;
    }
    if (approach.rule === 'stop' && clearedStopS !== stop.atS) {
      target = Math.min(target, speedToStop(remaining));
      if (state.speedMps === 0 && remaining <= STOP_TOLERANCE_M + 0.5 && state.stoppedS >= STOP_WAIT_S)
        clearedStopS = stop.atS;
      else continue;
    }
    const holders = holdersAt(traffic, intersection.id, approach, self, others, car, carPresent);
    if (holders.length === 0) continue;
    // A long wait is broken only when everyone holding it waits at their own line too; an occupied crossing never is.
    const breaking = forcedStopS === stop.atS;
    if (
      (breaking || state.waitingS >= DEADLOCK_S) &&
      holders.every((holder) => passableInDeadlock(holder, self, intersection.id, breaking))
    ) {
      forcedStopS = stop.atS;
      continue;
    }
    target = Math.min(target, speedToStop(remaining));
    yielding = true;
  }
  return { targetMps: target, yielding, clearedStopS, forcedStopS };
}

function respawnClear(
  self: VehiclePlan,
  path: Path,
  others: readonly Placed[],
  car: Car,
  carPresent: boolean,
): boolean {
  const start = required(path.points[0], 'path start');
  if (carPresent && distance(car.center, start) < RESPAWN_CLEAR_M) return false;
  return !others.some(
    (other) =>
      other.plan.id !== self.id &&
      other.path.id === path.id &&
      other.state.s < RESPAWN_PATH_GAP_M + self.halfLengthM * 2,
  );
}

function stepVehicle(
  traffic: Traffic,
  placed: Placed | null,
  state: VehicleState,
  others: readonly Placed[],
  pedestrians: ReadonlyMap<string, OrientedBox>,
  car: Car,
  carPresent: boolean,
  timeS: number,
  dt: number,
): VehicleState {
  if (!placed) {
    const index = indexOf(traffic);
    const plan = required(index.plans.get(state.id), 'vehicle plan');
    const path = required(index.paths.get(plan.pathId), 'path');
    if (state.respawnS !== null && timeS >= state.respawnS && respawnClear(plan, path, others, car, carPresent))
      return {
        ...state,
        s: 0,
        speedMps: 0,
        stoppedS: 0,
        waitingS: 0,
        clearedStopS: null,
        forcedStopS: null,
        respawnS: null,
      };
    return state;
  }
  const decision = decide(traffic, placed, others, pedestrians, car, carPresent, timeS);
  const delta = decision.targetMps - state.speedMps;
  let speedMps = state.speedMps + Math.max(-BRAKE_MAX_MPS2 * dt, Math.min(ACCEL_MPS2 * dt, delta));
  if (speedMps < 0.05 && decision.targetMps < 0.05) speedMps = 0;
  const s = state.s + speedMps * dt;
  const path = placed.path;
  if (!path.cyclic && s >= path.lengthM)
    return {
      ...state,
      s: path.lengthM,
      speedMps: 0,
      stoppedS: 0,
      waitingS: 0,
      clearedStopS: null,
      forcedStopS: null,
      respawnS: timeS + placed.plan.respawnDelayS,
    };
  return {
    ...state,
    s: path.cyclic ? s % path.lengthM : s,
    speedMps,
    stoppedS: speedMps === 0 ? state.stoppedS + dt : 0,
    waitingS: decision.yielding && speedMps === 0 ? state.waitingS + dt : 0,
    clearedStopS: decision.clearedStopS,
    forcedStopS: decision.forcedStopS,
  };
}

/** Whether a pedestrian may step off at `crosswalk` now. */
function mayWalk(
  traffic: Traffic,
  crosswalk: Crosswalk,
  schedule: WalkSchedule,
  placed: readonly Placed[],
  car: Car,
  timeS: number,
): boolean {
  const crossingS = distance(crosswalk.kerbs[0], crosswalk.kerbs[1]) / schedule.speedMps;
  const cycle = crosswalk.intersectionId ? traffic.plan.cycles[crosswalk.intersectionId] : undefined;
  const near = (point: Point, speedMps: number) =>
    distance(point, crosswalk.center) <= PEDESTRIAN_GAP_M && speedMps > PEDESTRIAN_GAP_SPEED_MPS;
  const carNear =
    near(car.center, car.speedMps) ||
    (distance(car.center, crosswalk.center) <= PEDESTRIAN_CAR_CLOSE_M && car.speedMps > PEDESTRIAN_CAR_MOVING_MPS);
  if (cycle) {
    if (redRemainingS(cycle, crosswalk.group, timeS) < crossingS + 1) return false;
    // Even on their phase, pedestrians do not step off in front of a car about to turn across (F04-T03).
    if (carNear) return false;
  } else if (placed.some((other) => near(other.point, other.state.speedMps)) || carNear) {
    return false;
  }
  return !placed.some((other) => overlaps(other.box, crosswalk.box)) && !overlaps(car.body, crosswalk.box);
}

function stepPedestrians(
  traffic: Traffic,
  state: TrafficState,
  placed: readonly Placed[],
  car: Car,
  timeS: number,
  dt: number,
): Pick<TrafficState, 'pedestrians' | 'walks'> {
  const walks = { ...state.walks };
  const pedestrians: PedestrianState[] = [];
  for (const pedestrian of state.pedestrians) {
    const crosswalk = required(indexOf(traffic).crosswalks.get(pedestrian.crosswalkId), 'crosswalk');
    const lengthM = distance(crosswalk.kerbs[0], crosswalk.kerbs[1]);
    const progress = pedestrian.progress + (pedestrian.speedMps * dt) / lengthM;
    if (progress >= 1) continue;
    pedestrians.push({ ...pedestrian, progress });
  }
  for (const crosswalk of traffic.network.crosswalks) {
    // A crosswalk without a schedule has no pedestrians (tests use it to isolate vehicles).
    const schedule = traffic.walks[crosswalk.id];
    const walk = walks[crosswalk.id];
    if (!schedule || !walk) continue;
    if (timeS < walk.nextS || pedestrians.some((item) => item.crosswalkId === crosswalk.id)) continue;
    if (distance(crosswalk.center, car.center) > ACTIVE_RADIUS_M) continue;
    if (!mayWalk(traffic, crosswalk, schedule, placed, car, timeS)) continue;
    const side = (schedule.side + walk.count) % 2 === 0 ? 0 : 1;
    pedestrians.push({
      id: `pedestrian-${crosswalk.id}-${walk.count}`,
      crosswalkId: crosswalk.id,
      progress: 0,
      side,
      speedMps: schedule.speedMps,
      walk: walk.count,
    });
    walks[crosswalk.id] = { nextS: timeS + schedule.intervalS, count: walk.count + 1 };
  }
  return { pedestrians, walks };
}

/** Advances every actor one fixed step beside the car; pure, so the same inputs always give the same state. */
export function stepTraffic(
  traffic: Traffic,
  state: TrafficState,
  carBody: OrientedBox,
  timeS: number,
  dt: number,
): TrafficState {
  const index = indexOf(traffic);
  const center = { x: carBody.centerX, z: carBody.centerZ };
  const carSpeedMps = state.carCenter && dt > 0 ? distance(state.carCenter, center) / dt : 0;
  const velocity =
    state.carCenter && dt > 0
      ? { x: (center.x - state.carCenter.x) / dt, z: (center.z - state.carCenter.z) / dt }
      : { x: 0, z: 0 };
  const car: Car = {
    body: carBody,
    center,
    front: {
      x: carBody.centerX + Math.sin(carBody.headingRad) * carBody.halfLengthM,
      z: carBody.centerZ + Math.cos(carBody.headingRad) * carBody.halfLengthM,
    },
    speedMps: carSpeedMps,
    velocity,
    stoppedS: carSpeedMps < 0.05 ? state.carStoppedS + dt : 0,
  };
  const placedById = new Map<string, Placed | null>();
  for (const vehicle of state.vehicles) placedById.set(vehicle.id, place(index, vehicle));
  const placed = [...placedById.values()].filter((item): item is Placed => item !== null);
  const pedestrians = pedestrianBoxes(traffic, state.pedestrians);
  const vehicles = state.vehicles.map((vehicle) => {
    const self = placedById.get(vehicle.id) ?? null;
    // Far vehicles still move, but only nearby ones react to the car; that keeps the step cheap and deterministic.
    const carPresent = !self || distance(self.point, center) <= ACTIVE_RADIUS_M;
    return stepVehicle(traffic, self, vehicle, placed, pedestrians, car, carPresent, timeS, dt);
  });
  const walked = stepPedestrians(traffic, state, placed, car, timeS, dt);
  const poses: ActorPose[] = [];
  for (const vehicle of vehicles) {
    const next = place(index, vehicle);
    if (next && distance(next.point, center) <= ACTIVE_RADIUS_M)
      poses.push(poseOf(next.plan.id, next.plan.kind, next.box, true));
  }
  // The ambulance drives beside the route lane and does not go through posed vehicles; the actors do not react to it.
  const lap = index.paths.get('lap');
  const emergency =
    traffic.emergency && lap
      ? stepEmergency(
          lap,
          traffic.emergency,
          state.emergency,
          carBody,
          poses.map((pose) => pose.box),
          dt,
        )
      : state.emergency;
  const ambulance = lap ? emergencyPose(lap, emergency) : null;
  if (ambulance) poses.push(ambulance);
  for (const pedestrian of walked.pedestrians) {
    const crosswalk = required(index.crosswalks.get(pedestrian.crosswalkId), 'crosswalk');
    poses.push(poseOf(pedestrian.id, 'pedestrian', pedestrianBox(crosswalk, pedestrian), true));
  }
  poses.sort((a, b) => distance(a, center) - distance(b, center));
  const visible = poses.slice(0, MAX_ACTIVE_ACTORS);
  const overlapping = visible.filter((pose) => overlaps(pose.box, carBody));
  const contacts = overlapping.filter((pose) => !state.touching.includes(pose.id)).map((pose) => pose.kind);
  const lights = controlLights(traffic.plan, traffic.network, timeS);
  return {
    timeS,
    light: governingLight(traffic, lights, carBody, timeS) ?? 'green',
    lights,
    poses: visible,
    contacts,
    vehicles,
    pedestrians: walked.pedestrians,
    walks: walked.walks,
    carCenter: center,
    carSpeedMps,
    carStoppedS: car.stoppedS,
    touching: overlapping.map((pose) => pose.id),
    emergency,
  };
}

/** A traffic description as the driving loop consumes it, stepped beside the car. */
export function trafficSourceOf(traffic: Traffic): TrafficSource<TrafficState> & { traffic: Traffic } {
  return {
    traffic,
    create: () => createTrafficState(traffic),
    step: (state, carBody, timeS, dt) => stepTraffic(traffic, state, carBody, timeS, dt),
  };
}

/** The traffic as the driving loop consumes it: created with the city and a seed, stepped beside the car. */
export function createTrafficSource(city: City, seed: number): TrafficSource<TrafficState> & { traffic: Traffic } {
  return trafficSourceOf(createTraffic(city, seed));
}
