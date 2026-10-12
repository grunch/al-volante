import type { City, Road } from '../city/model.ts';
import { projectOnRoad } from '../city/model.ts';
import type { OrientedBox, Point } from '../sim/collision.ts';
import { aheadOnLap } from '../traffic/lookahead.ts';
import { pointAlong, travelDistance } from '../traffic/network.ts';
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
}

export interface CircuitBump {
  id: string;
  s: number;
  leg: number;
}

export interface Circuit {
  traffic: Traffic;
  lap: Path;
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

function crosswalksOf(lap: Path): CircuitCrosswalk[] {
  return lap.crosswalks.map((item) => ({
    id: item.crosswalk.id,
    startS: item.atS,
    box: item.crosswalk.box,
    controlId: item.crosswalk.controlId,
    leg: required(item.crosswalk.road.leg ?? undefined, 'leg of a crosswalk road'),
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

export function buildCircuit(city: City, traffic: Traffic): Circuit {
  const lap = required(
    traffic.network.paths.find((path) => path.id === 'lap'),
    'lap path',
  );
  const legs = legsOf(city, lap);
  const busways = city.roads.filter((road) => road.kind === 'busway');
  return {
    traffic,
    lap,
    legs,
    crossings: crossingsOf(city, traffic, lap, legs),
    crosswalks: crosswalksOf(lap),
    bumps: bumpsOf(city, lap),
    busways: busways.map(roadBoxOf),
    solidLineLeft: new Set(
      city.roads
        .filter((road) => road.kind === 'route' && busways.some((busway) => busway.id.startsWith(`${road.id}-`)))
        .map((road) => road.id),
    ),
  };
}
