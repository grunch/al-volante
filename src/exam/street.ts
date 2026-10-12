import type { CarState } from '../sim/car.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import type { ActorPose, LightState, TrafficSnapshot } from '../sim/scenario.ts';
import type { OrientedBox, Point } from '../sim/collision.ts';
import { headingDifference } from '../traffic/network.ts';
import type { lookAhead } from '../traffic/lookahead.ts';
import type { Circuit, CircuitLeg } from './circuit.ts';

/**
 * The state and the thresholds of stage II on the circuit (F04-T03), shared by the circulation judges. The
 * thresholds are game decisions (REGLAS.md §7, D6–D9, and §9), not protocol values.
 */
/**
 * Stage II on the circuit: every circulation rule of the protocol that the game can observe (REGLAS.md §5, anexo
 * II), judged once per fixed step from the car, the cabin and the traffic snapshot. Pure: it returns the next
 * street state and the faults to score; `session.ts` applies them. The thresholds below are game decisions
 * (REGLAS.md §9 and §7, D6–D9), not protocol values.
 */
export const CIRCULATION = {
  /** Speed limits are judged with this margin (same as the box phases). */
  speedToleranceKmh: 1,
  /** Following distance: under 2 s of headway (protocolo PDF 12, 28) for this long, behind a moving vehicle. */
  headwayS: 2,
  tailgatingS: 1.5,
  tailgatingMinSpeedMps: 2,
  leaderMovingMps: 1,
  /** Lane keeping: the body outside its lane by more than the margin for this long (minor p). */
  laneMarginM: 0.5,
  offLaneS: 3,
  /** The car is "along" its road when its heading is within this of the road's. */
  alignedRad: 0.35,
  /** Exclusive lanes (cycle track, busway) and the wrong way for this long are eliminatory j; the solid line, o. */
  forbiddenLaneS: 1,
  solidLineS: 0.5,
  wrongWayRad: 2.1,
  wrongWayMinSpeedMps: 1,
  /** Mirror glance (D4) within this time before a lane change (high o); signal on this long before it (low h). */
  glanceBeforeLaneChangeS: 5,
  signalBeforeLaneChangeS: 3,
  /** A lane change counts once the car has settled this far into the road after the corner. */
  laneSettleM: 20,
  /** Slowing down (high m) and precautionary speed (minor o): faster than this within this distance. */
  approachKmh: 20,
  approachM: 12,
  precautionM: 15,
  precautionS: 0.5,
  precautionBrake: 0.2,
  /** A full stop at a STOP counts within this distance before its line. */
  stopZoneM: 3,
  /** Standing inside the crossing this long blocks it (high i), unless yielding to a crosswalk this close ahead. */
  blockIntersectionS: 2,
  yieldingM: 6,
  yieldingLinkM: 12,
  /** A stop whose front is past the line, up to the far edge of the crosswalk, is over the line (high h). */
  overLineM: 0.1,
  crosswalkEndM: 4.5,
  /** Right-hand priority (high k): a vehicle this close to its own line, moving, is arriving. */
  arrivingM: 20,
  arrivingMinSpeedMps: 0.5,
  /** Unnecessary stop (minor k): stopped this long with nothing within these distances. */
  unnecessaryStopS: 1,
  clearCrossingM: 8,
  clearLeaderM: 12,
  clearCrosswalkM: 15,
  clearSignalM: 30,
  /** Minimum speed (minor l): under this speed, this long, with the way clear this far ahead. */
  minimumKmh: 10,
  slowS: 8,
  clearAheadM: 30,
  /** Horn (minor m): justified only with someone this close ahead. */
  hornConflictM: 15,
  /** Speed bump (minor n): faster than this over the hump. */
  bumpKmh: 20,
  /** Loss of control (eliminatory h): lateral acceleration above this for this long (kinematic model). */
  lateralAccelMps2: 6,
  lateralAccelS: 0.3,
  /** Emergency vehicle (eliminatory n): make way by slowing to this or pulling right by this before it passes. */
  emergencyYieldKmh: 10,
  emergencyPullRightM: 0.7,
  emergencyStuckS: 4,
  /** Making way is judged while the ambulance is this close behind (D6). */
  emergencyNearM: 30,
  /** Overtaking (eliminatory p): a vehicle is beside the car between these lateral distances, ahead by this. */
  besideMinM: 1.5,
  besideMaxM: 5,
  aheadM: 2,
  /** Takeover: the braking needed to avoid an actor ahead exceeds this, with the closing speed above this. */
  takeoverDecelMps2: 7,
  takeoverClosingMps: 1.5,
  /** Leaving the route after a corner (eliminatory f): off the lap this long while moving, or past the box. */
  offRouteS: 3,
  pastCornerM: 1,
  /** Escalatable faults stay escalatable for this long after they were scored. */
  escalatableS: 10,
  /** The examiner announces a control this far ahead. */
  noticeM: 60,
  /** The examiner announces the parking this far before the bay (protocolo PDF 24). */
  parkingNoticeM: 100,
  /** The car is still on the route this far from the lap line (Cabildo's busway is 9 m to its left). */
  onRouteM: 14,
} as const;

export interface Report {
  ruleId: string;
  episode?: string;
  /** Withdraws the fault of this episode instead of scoring it (decision D2). */
  withdraw?: boolean;
}

export interface Notice {
  kind: 'signal' | 'stop' | 'priority' | 'bump' | 'emergency';
  distanceM: number;
  light: LightState | null;
}

export interface Street {
  odometerStartM: number | null;
  /** Current leg of the circuit and how many legs were entered since the start (8 is a lap). */
  leg: number;
  legsEntered: number;
  instruction: { turn: 'left' | 'right'; street: string } | null;
  notice: Notice | null;
  /** Metres to the bay's front line once the examiner has announced the parking, on the last leg (D10). */
  parkingAheadM: number | null;
  road: { street: string; examKmh: number; postedKmh: number | null } | null;
  signalSince: { left: number | null; right: number | null };
  signalAtS: { left: number | null; right: number | null };
  lastGlance: { yaw: number; atS: number } | null;
  stops: number;
  wasStopped: boolean;
  stoppedS: number;
  stopJudged: boolean;
  blockedS: number;
  speedingIn: string | null;
  speedEpisodes: number;
  roadMaxEpisode: number | null;
  crossed: readonly string[];
  stoppedAt: string | null;
  previousFrontS: number | null;
  cornerPending: { intersectionId: string; center: Point; boxHalfM: number; leg: number } | null;
  tailgatingS: number;
  offLaneS: number;
  offRouteS: number;
  wrongWayS: number;
  forbiddenS: number;
  solidLineS: number;
  slowS: number;
  lateralAccelS: number;
  precautionS: number;
  laneRoadId: string | null;
  /** Lap distance where the current road was entered: lane changes are judged once the car has settled on it. */
  laneEnteredS: number | null;
  laneIndex: number | null;
  laneChanges: number;
  poseMemory: Readonly<Record<string, Point>>;
  passing: Readonly<Record<string, 'behind' | 'left' | 'right'>>;
  hornWas: boolean;
  hornEpisodes: number;
  emergency: { seen: boolean; yielded: boolean; judged: boolean; stuckS: number };
  bumpsPassed: readonly string[];
  escalatable: readonly { ruleId: string; episode: string; atS: number }[];
  /** Rule and episode pairs already reported, so a lasting condition is reported once (the ledger agrees). */
  reported: readonly string[];
  /** The examiner took the dual controls: the car must be stopped and the exam ends. */
  takeover: boolean;
}

/** The street state at the start of leg `startLeg` (1 for the exam; a later leg to practise from there). */
export function createStreet(circuit: Circuit | null, startLeg = 1): Street {
  const first = circuit?.legs.find((leg) => leg.number === startLeg) ?? circuit?.legs[0];
  return {
    odometerStartM: null,
    leg: first?.number ?? 1,
    legsEntered: (first?.number ?? 1) - 1,
    instruction: first ? { turn: first.turn, street: first.nextStreet } : null,
    notice: null,
    parkingAheadM: null,
    road: first ? { street: first.street, examKmh: first.examKmh, postedKmh: first.postedKmh } : null,
    signalSince: { left: null, right: null },
    signalAtS: { left: null, right: null },
    lastGlance: null,
    stops: 0,
    wasStopped: false,
    stoppedS: 0,
    stopJudged: false,
    blockedS: 0,
    speedingIn: null,
    speedEpisodes: 0,
    roadMaxEpisode: null,
    crossed: [],
    stoppedAt: null,
    previousFrontS: null,
    cornerPending: null,
    tailgatingS: 0,
    offLaneS: 0,
    offRouteS: 0,
    wrongWayS: 0,
    forbiddenS: 0,
    solidLineS: 0,
    slowS: 0,
    lateralAccelS: 0,
    precautionS: 0,
    laneRoadId: null,
    laneEnteredS: null,
    laneIndex: null,
    laneChanges: 0,
    poseMemory: {},
    passing: {},
    hornWas: false,
    hornEpisodes: 0,
    emergency: { seen: false, yielded: false, judged: false, stuckS: 0 },
    bumpsPassed: [],
    escalatable: [],
    reported: [],
    takeover: false,
  };
}

export interface Frame {
  circuit: Circuit;
  car: CarState;
  cockpit: CockpitState;
  scenario: TrafficSnapshot;
  dt: number;
  timeS: number;
  body: OrientedBox;
  center: Point;
  speedMps: number;
  kmh: number;
  stopped: boolean;
  /** The car came to a halt this very step. */
  justStopped: boolean;
  /** Lap distances of the body centre and the front bumper. */
  centreS: number;
  frontS: number;
  leg: CircuitLeg;
  legKey: string;
  view: ReturnType<typeof lookAhead>;
}

export const kmhOf = (car: CarState) => Math.abs(car.world.vehicle.speedMps) * 3.6;

/** Headings across each other (between 45° and 135° apart): crossing traffic, not parallel or oncoming. */
export const across = (a: number, b: number) => Math.abs(Math.sin(headingDifference(a, b))) > Math.SQRT1_2;

export function poseSpeed(street: Street, pose: ActorPose, dt: number): { x: number; z: number } {
  const before = street.poseMemory[pose.id];
  if (!before || dt <= 0) return { x: 0, z: 0 };
  return { x: (pose.x - before.x) / dt, z: (pose.z - before.z) / dt };
}

export function remember(street: Street, ruleId: string, episode: string, atS: number): Street {
  return { ...street, escalatable: [...street.escalatable, { ruleId, episode, atS }] };
}
