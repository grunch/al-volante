import type { City, Road } from '../city/model.ts';
import { offsetPoint, projectOnRoad } from '../city/model.ts';
import type { OrientedBox, Point } from '../sim/collision.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';
import { aheadOnLap } from '../traffic/lookahead.ts';
import { locateOnPath, pointAlong, travelDistance } from '../traffic/network.ts';
import type { ApproachRule, Path } from '../traffic/network.ts';
import type { Traffic } from '../traffic/traffic.ts';

/**
 * The exam circuit as the examiner reads it (F04-T03): the eight legs of route A (RECORRIDO.md §4) laid along the
 * traffic network's lap path, with every crossing the car must judge, the corner that ends each leg and its turn,
 * the crosswalks, the speed bump and the roads' limits. Derived once from the city and its traffic; nothing here
 * is hard-coded to a block.
 */

/** Metres before the corner by which a turn must be signalled (protocolo PDF 12, 24). */
export const SIGNAL_BEFORE_CORNER_M = 30;

export interface CircuitLeg {
  number: number;
  street: string;
  /** Lap distance where the leg's first road starts and where its last road ends (the corner is near `endS`). */
  startS: number;
  endS: number;
  lengthM: number;
  turn: 'left' | 'right';
  nextStreet: string;
  /** Exam limit (REGLAS.md §6: 30 streets, 45 avenues) and the posted maximum from OSM, still single-source. */
  examKmh: number;
  postedKmh: number | null;
  /** Most lanes of any road of the leg, and whether any of them has the cycle track on its left. */
  lanes: number;
  cycleTrack: boolean;
}

export interface CircuitCrossing {
  intersectionId: string;
  approachId: string;
  rule: ApproachRule;
  group: 0 | 1;
  /** The leg whose road the stop line is on. */
  leg: number;
  /** Lap distance of the stop line, where the front bumper must stop. */
  lineS: number;
  /** The pavement the car crosses: a vehicle or a cyclist inside it has to be let through. */
  conflicts: readonly OrientedBox[];
  /** The crossed streets' carriageways across the car's road: standing on one blocks the intersection. */
  pavements: readonly OrientedBox[];
  /** Headings of the other approaches of the intersection, to tell who comes from the right. */
  otherApproaches: readonly { headingRad: number; road: Road; reverse: boolean; entryM: number }[];
  /** The crossing ends the leg: the car turns here. */
  corner: { turn: 'left' | 'right'; nextStreet: string; nextLeg: number } | null;
  center: Point;
  boxHalfM: number;
}

export interface CircuitCrosswalk {
  id: string;
  /** Lap distance where the crosswalk begins (the front bumper reaches it). */
  startS: number;
  box: OrientedBox;
  /** A `crossing-traffic_signals` control with its own vehicle light. */
  controlId: string | null;
  leg: number;
  /** Just past a corner's stop line: crossed while turning (the ficha's «Giros» row, decision D1). */
  atCorner: boolean;
}

export interface CircuitBump {
  id: string;
  s: number;
  leg: number;
}

/**
 * The parking bay of stage III (protocolo PDF 13, 21): the 6 m bay of the city's start pose, with the kerb on its
 * right and its two painted end lines. Distances to the kerb come from the road's geometry (CIUDAD.md: the bay's
 * width, side and position are approximations; only the 6 m length is sourced).
 */
export interface ParkingBay {
  /** Centre of the bay on the ground, and the heading of the kerb (a parked car faces this way). */
  center: Point;
  headingRad: number;
  /** Half the bay's length along the kerb (3 m for the 6 m bay). */
  halfLengthM: number;
  /** Lateral position of the kerb's edge in the bay's frame (positive is left): negative, the kerb is on the right. */
  kerbLeftM: number;
  /**
   * The bay's markers: the part of each painted end line (`city.world.markings`) nearest the kerb, standing for
   * the posts of the real bay (a game approximation, D13). Touching one is high d; hitting it, eliminatory d.
   */
  lines: readonly OrientedBox[];
  /** Lap distance of the bay's front line, for the examiner's notice 100 m before (protocolo PDF 24). */
  frontS: number;
}

export interface Circuit {
  traffic: Traffic;
  lap: Path;
  bay: ParkingBay;
  legs: readonly CircuitLeg[];
  crossings: readonly CircuitCrossing[];
  crosswalks: readonly CircuitCrosswalk[];
  bumps: readonly CircuitBump[];
  /** Busway carriageways (the Metrobús of Av. Cabildo): exclusive lanes the car may not use. */
  busways: readonly OrientedBox[];
  /** Roads with a busway beside them: their left edge is the continuous line of eliminatory o (REGLAS.md X3). */
  solidLineLeft: ReadonlySet<string>;
}

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

/** The lap segment (lane of a route road) that covers `s`, or null inside a corner link. */
export function roadAt(lap: Path, s: number): Road | null {
  return pointAlong(lap, s).segment?.lane.road ?? null;
}

/** Signed lateral offset of a point from a road's centreline: positive to the left of its heading. */
export function lateralOnRoad(road: Road, point: Point): number {
  const left = { x: Math.cos(road.headingRad), z: -Math.sin(road.headingRad) };
  const { point: projected } = projectOnRoad(point, road);
  return (point.x - projected.x) * left.x + (point.z - projected.z) * left.z;
}

/** The leg at lap distance `s`, by the road under it; null inside a corner link. */
export function legAt(circuit: Circuit, s: number): CircuitLeg | null {
  const road = roadAt(circuit.lap, s);
  return road ? (circuit.legs.find((leg) => leg.number === road.leg) ?? null) : null;
}

/** Distance from the front bumper at `frontS` to a lap distance, the short way round. */
export function distanceAlong(circuit: Circuit, frontS: number, toS: number): number {
  return aheadOnLap(circuit.lap, frontS, toS);
}

function legsOf(city: City, lap: Path): CircuitLeg[] {
  return city.legs.map((leg) => {
    const segments = lap.segments.filter((segment) => segment.lane.road.leg === leg.number);
    const roads = segments.map((segment) => segment.lane.road);
    const first = required(roads[0], `roads of leg ${leg.number}`);
    const posted = roads.map((road) => road.postedMaxKmh).filter((value): value is number => value !== null);
    return {
      number: leg.number,
      street: leg.street,
      startS: required(segments[0], 'segment').startS,
      endS: required(segments.at(-1), 'segment').endS,
      lengthM: leg.lengthM,
      turn: leg.turn,
      nextStreet: required(city.legs[leg.number % city.legs.length], 'next leg').street,
      examKmh: required(first.examMaxKmh ?? undefined, `exam limit of leg ${leg.number}`),
      // The most restrictive posted maximum of the leg's roads; the examiner reads the road under the car anyway.
      postedKmh: posted.length ? Math.min(...posted) : null,
      lanes: Math.max(1, ...roads.map((road) => road.lanes)),
      cycleTrack: roads.some((road) => road.cycleTrack),
    };
  });
}

function crossingsOf(city: City, traffic: Traffic, lap: Path, legs: readonly CircuitLeg[]): CircuitCrossing[] {
  const crossings: CircuitCrossing[] = [];
  for (const stop of lap.stops) {
    const { approach } = stop;
    const leg = required(approach.road.leg ?? undefined, 'leg of a route road');
    const intersection = required(
      traffic.network.intersections.find((item) => item.id === approach.intersectionId),
      'intersection',
    );
    const legEntry = required(
      legs.find((item) => item.number === leg),
      'leg',
    );
    // The leg's corner is the last stop of its last road: the route turns there.
    const lastRoad = lap.segments.filter((segment) => segment.lane.road.leg === leg).at(-1)?.lane.road;
    const isCorner =
      lastRoad?.id === approach.road.id &&
      !lap.stops.some((other) => other.approach.road.id === approach.road.id && other.atS > stop.atS);
    // Every road of another street through a crossing point, including the one the route turns into.
    const pavements = approach.conflicts.flatMap((conflict) =>
      city.roads
        .filter(
          (road) =>
            road.street !== approach.road.street &&
            road.kind !== 'busway' &&
            projectOnRoad({ x: conflict.centerX, z: conflict.centerZ }, road).distanceM <= 1,
        )
        .map((road): OrientedBox => ({
          centerX: conflict.centerX,
          centerZ: conflict.centerZ,
          halfLengthM: approach.road.widthM / 2 + 0.5,
          halfWidthM: road.widthM / 2,
          headingRad: road.headingRad,
        })),
    );
    crossings.push({
      intersectionId: intersection.id,
      approachId: approach.id,
      rule: approach.rule,
      group: approach.group,
      leg,
      lineS: stop.atS,
      conflicts: approach.conflicts,
      pavements,
      otherApproaches: intersection.approaches
        .filter((other) => other.id !== approach.id)
        .map((other) => ({
          headingRad: other.headingRad,
          road: other.road,
          reverse: other.reverse,
          entryM: other.entryM,
        })),
      corner: isCorner
        ? { turn: legEntry.turn, nextStreet: legEntry.nextStreet, nextLeg: (leg % legs.length) + 1 }
        : null,
      center: intersection.center,
      boxHalfM: intersection.box.halfLengthM,
    });
  }
  return crossings.sort((a, b) => a.lineS - b.lineS);
}

/**
 * A crosswalk starting this far past a corner's stop line or less is crossed while turning: the one just past the
 * line and the one on the street turned into (up to about 18 m on route A), not a mid-block one further on.
 */
const CORNER_CROSSWALK_M = 20;

function crosswalksOf(lap: Path, crossings: readonly CircuitCrossing[]): CircuitCrosswalk[] {
  return lap.crosswalks.map((item) => ({
    id: item.crosswalk.id,
    startS: item.atS,
    box: item.crosswalk.box,
    controlId: item.crosswalk.controlId,
    leg: required(item.crosswalk.road.leg ?? undefined, 'leg of a crosswalk road'),
    atCorner: crossings.some((crossing) => {
      const pastLineM = aheadOnLap(lap, crossing.lineS, item.atS);
      return crossing.corner !== null && pastLineM >= 0 && pastLineM <= CORNER_CROSSWALK_M;
    }),
  }));
}

function bumpsOf(city: City, lap: Path): CircuitBump[] {
  const bumps: CircuitBump[] = [];
  for (const control of city.controls) {
    if (control.type !== 'traffic-calming-hump') continue;
    const segment = lap.segments.find((item) => item.lane.road.id === control.road.id);
    if (!segment) continue;
    bumps.push({
      id: control.id,
      s: segment.startS + travelDistance(control.road, false, control.sourcePosition),
      leg: required(control.road.leg ?? undefined, 'leg of a bump road'),
    });
  }
  return bumps;
}

const roadBoxOf = (road: Road): OrientedBox => ({
  centerX: (road.a.x + road.b.x) / 2,
  centerZ: (road.a.z + road.b.z) / 2,
  halfLengthM: road.lengthM / 2,
  halfWidthM: road.widthM / 2,
  headingRad: road.headingRad,
});

/** How far from the lap line the bay's centre may be and still be located on it (it sits beside the right lane). */
const BAY_LATERAL_M = 6;
/** The markers reach this far from the kerb's edge into the road (the real posts stand by the kerb; D13). */
export const MARKER_REACH_M = 1.2;

/** Lateral position of a point in the frame of the bay (positive to the left of its heading). */
function bayFrameLeftM(center: Point, headingRad: number, point: Point): number {
  return (point.x - center.x) * Math.cos(headingRad) - (point.z - center.z) * Math.sin(headingRad);
}

function bayOf(city: City, lap: Path): ParkingBay {
  const pose = city.start.pose;
  const center = offsetPoint(pose, pose.headingRad, 0, EXAM_CAR.lengthM / 2 - EXAM_CAR.rearOverhangM);
  const road = required(
    [...city.roads]
      .filter((item) => item.kind === 'route')
      .sort((a, b) => projectOnRoad(center, a).distanceM - projectOnRoad(center, b).distanceM)[0],
    'road of the parking bay',
  );
  const lines = city.world.markings ?? [];
  const forward = { x: Math.sin(pose.headingRad), z: Math.cos(pose.headingRad) };
  const halfLengthM = lines.length
    ? Math.max(
        ...lines.map(
          (line) =>
            Math.abs((line.centerX - center.x) * forward.x + (line.centerZ - center.z) * forward.z) + line.halfLengthM,
        ),
      )
    : 3;
  const located = required(locateOnPath(lap, center, BAY_LATERAL_M) ?? undefined, 'parking bay on the lap');
  const kerbLeftM = -road.widthM / 2 - lateralOnRoad(road, center);
  // Each marker is the stretch of its line from the kerb's edge to MARKER_REACH_M into the road.
  const markers = lines.map((line) => {
    const lineCentreLeftM = bayFrameLeftM(center, pose.headingRad, { x: line.centerX, z: line.centerZ });
    const reachLeftM = kerbLeftM + MARKER_REACH_M / 2;
    const shifted = offsetPoint({ x: line.centerX, z: line.centerZ }, line.headingRad, reachLeftM - lineCentreLeftM);
    return { ...line, centerX: shifted.x, centerZ: shifted.z, halfWidthM: MARKER_REACH_M / 2 };
  });
  return {
    center,
    headingRad: pose.headingRad,
    halfLengthM,
    kerbLeftM,
    lines: markers,
    frontS: located.s + halfLengthM,
  };
}

export function buildCircuit(city: City, traffic: Traffic): Circuit {
  const lap = required(
    traffic.network.paths.find((path) => path.id === 'lap'),
    'lap path',
  );
  const legs = legsOf(city, lap);
  const busways = city.roads.filter((road) => road.kind === 'busway');
  const crossings = crossingsOf(city, traffic, lap, legs);
  return {
    traffic,
    lap,
    bay: bayOf(city, lap),
    legs,
    crossings,
    crosswalks: crosswalksOf(lap, crossings),
    bumps: bumpsOf(city, lap),
    busways: busways.map(roadBoxOf),
    solidLineLeft: new Set(
      city.roads
        .filter((road) => road.kind === 'route' && busways.some((busway) => busway.id.startsWith(`${road.id}-`)))
        .map((road) => road.id),
    ),
  };
}
