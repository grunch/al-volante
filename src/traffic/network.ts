import type { City, CityControl, Road } from '../city/model.ts';
import { distance, mixPoint, offsetPoint, projectOnRoad } from '../city/model.ts';
import type { OrientedBox, Point } from '../sim/collision.ts';

/**
 * The traffic network derived from the city: where streets cross, who controls each crossing, where the
 * crosswalks are and which lanes the actors follow. Everything here is geometry decided once per city; the
 * widths and setbacks are game approximations stated in `specs/ARQUITECTURA.md` («Tránsito del circuito»).
 */

/** Crossing points closer than this belong to the same intersection (Cabildo spans three carriageways). */
const CLUSTER_RADIUS_M = 22;
/** A road ending this close to an intersection's crossing points continues through it. */
const ENDPOINT_RADIUS_M = 3;
/** A STOP or signal control this close to an intersection governs it. */
const CONTROL_RADIUS_M = 20;
/** Stop line distance from the crossed road's edge: a 3 m crosswalk plus half a metre of margin. */
const STOP_LINE_SETBACK_M = 2;
/** A crosswalk sits this far past the stop line, and is this long along the road. */
const CROSSWALK_OFFSET_M = 1.5;
export const CROSSWALK_HALF_LENGTH_M = 1.5;
/** The cycle track lies to the left of the road, outside its width (model.ts curb offsets). */
export const CYCLE_TRACK_WIDTH_M = 2.6;
/** Where a crosswalk of an intersection coincides with a signalled crossing control, the control wins. */
const DUPLICATE_CROSSWALK_M = 8;
/** Segment parameters this far outside [0, 1] still count as meeting (floating point at shared nodes). */
const PARAMETER_MARGIN = 0.02;
/** Open paths start and end this far beyond their roads, so vehicles appear and vanish outside the crossings. */
const PATH_STUB_M = 15;

export type ApproachRule = 'signal' | 'stop' | 'priority';

export interface Approach {
  id: string;
  intersectionId: string;
  road: Road;
  /** Travelling from `road.b` to `road.a`. */
  reverse: boolean;
  /** Heading of travel. */
  headingRad: number;
  /** Distance along the direction of travel, from the lane start, where the front bumper must stop. */
  entryM: number;
  /** The stop line on the road's centreline. */
  stopPoint: Point;
  /** 0 = the street of the control (or the first street found), 1 = the crossing street. */
  group: 0 | 1;
  rule: ApproachRule;
  /** The pavement this approach must cross: a square around each crossing point on its road. */
  conflicts: OrientedBox[];
}

export interface Intersection {
  id: string;
  center: Point;
  /** Covers the crossing points plus the widest participating road; axis-aligned. Conflicts are per approach. */
  box: OrientedBox;
  control: CityControl | null;
  kind: 'signal' | 'stop' | 'none';
  /** Street that owns group 0. */
  mainStreet: string;
  approaches: Approach[];
}

export interface Crosswalk {
  id: string;
  road: Road;
  center: Point;
  box: OrientedBox;
  /** Kerb points where pedestrians wait, left and right of the road. */
  kerbs: [Point, Point];
  /** The intersection whose light phases apply (walk when the road's group is red); null walks on gaps. */
  intersectionId: string | null;
  group: 0 | 1;
  /** A `crossing-traffic_signals` control, which carries its own vehicle light. */
  controlId: string | null;
}

export interface Lane {
  id: string;
  road: Road;
  reverse: boolean;
  from: Point;
  to: Point;
  headingRad: number;
  lengthM: number;
  /** Target speed on this lane, in m/s. */
  speedMps: number;
}

export type PathKind = 'vehicle' | 'bus' | 'bicycle';

export interface PathStop {
  /** Where the front bumper stops. */
  atS: number;
  approach: Approach;
}

export interface PathCrosswalk {
  /** Where the front bumper stops before the crosswalk. */
  atS: number;
  crosswalk: Crosswalk;
}

export interface PathSegment {
  lane: Lane;
  startS: number;
  endS: number;
}

export interface Path {
  id: string;
  kind: PathKind;
  points: Point[];
  cumulativeM: number[];
  lengthM: number;
  cyclic: boolean;
  segments: PathSegment[];
  stops: PathStop[];
  crosswalks: PathCrosswalk[];
}

export interface Network {
  intersections: Intersection[];
  crosswalks: Crosswalk[];
  lanes: Lane[];
  paths: Path[];
}

export const KMH_TO_MPS = 1 / 3.6;
/** Context streets carry no source speed; actors there use the exam limit for streets and avenues (REGLAS.md §6). */
const CONTEXT_STREET_KMH = 30;
const CONTEXT_AVENUE_KMH = 45;
const BUSWAY_KMH = 40;
const BICYCLE_KMH = 15;
/** Avenues are modelled wider than this (Cabildo 7 m per carriageway is the exception, handled by name). */
const AVENUE_WIDTH_M = 12;

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

export const headingDifference = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Parameters of the meeting point of segments ab and cd, or null when parallel. */
function meet(a: Point, b: Point, c: Point, d: Point): { t: number; u: number } | null {
  const r = { x: b.x - a.x, z: b.z - a.z };
  const s = { x: d.x - c.x, z: d.z - c.z };
  const denominator = r.x * s.z - r.z * s.x;
  if (Math.abs(denominator) < 1e-9) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / denominator;
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / denominator;
  return { t, u };
}

interface Crossing {
  point: Point;
  roads: [Road, Road];
}

function crossings(roads: readonly Road[]): Crossing[] {
  const found: Crossing[] = [];
  for (let i = 0; i < roads.length; i++)
    for (let j = i + 1; j < roads.length; j++) {
      const a = required(roads[i], 'road'),
        b = required(roads[j], 'road');
      if (a.street === b.street) continue;
      const parameters = meet(a.a, a.b, b.a, b.b);
      if (!parameters) continue;
      const inside = (value: number) => value >= -PARAMETER_MARGIN && value <= 1 + PARAMETER_MARGIN;
      if (inside(parameters.t) && inside(parameters.u))
        found.push({ point: mixPoint(a.a, a.b, Math.max(0, Math.min(1, parameters.t))), roads: [a, b] });
    }
  return found;
}

/** Single-linkage clusters of crossing points. */
function cluster(items: Crossing[]): Crossing[][] {
  const groups: Crossing[][] = [];
  for (const item of items) {
    const near = groups.filter((group) => group.some((other) => distance(other.point, item.point) <= CLUSTER_RADIUS_M));
    if (near.length === 0) {
      groups.push([item]);
      continue;
    }
    const merged = [...near.flat(), item];
    for (const group of near) groups.splice(groups.indexOf(group), 1);
    groups.push(merged);
  }
  return groups;
}

export function laneSpeedMps(road: Road): number {
  if (road.kind === 'busway') return BUSWAY_KMH * KMH_TO_MPS;
  if (road.kind === 'context')
    return (
      (road.widthM >= AVENUE_WIDTH_M || road.street.startsWith('Av.') ? CONTEXT_AVENUE_KMH : CONTEXT_STREET_KMH) *
      KMH_TO_MPS
    );
  const limits = [road.examMaxKmh, road.postedMaxKmh].filter((value): value is number => value !== null);
  return (limits.length ? Math.min(...limits) : CONTEXT_STREET_KMH) * KMH_TO_MPS;
}

/** Distance along the direction of travel of a point projected on the road. */
export function travelDistance(road: Road, reverse: boolean, point: Point): number {
  const along = projectOnRoad(point, road).t * road.lengthM;
  return reverse ? road.lengthM - along : along;
}

function approachesOf(
  intersection: Omit<Intersection, 'approaches'>,
  group: Crossing[],
  roads: readonly Road[],
  controls: readonly CityControl[],
): Approach[] {
  const points = group.map((crossing) => crossing.point);
  const participants = new Set<Road>(group.flatMap((crossing) => crossing.roads));
  for (const road of roads)
    if (
      points.some(
        (point) => distance(point, road.a) <= ENDPOINT_RADIUS_M || distance(point, road.b) <= ENDPOINT_RADIUS_M,
      )
    )
      participants.add(road);
  const approaches: Approach[] = [];
  for (const road of participants) {
    const others = [...participants].filter((other) => other.street !== road.street);
    const crossedHalfWidth = Math.max(0, ...others.map((other) => other.widthM / 2));
    const onRoad = points.filter(
      (point) => projectOnRoad(point, road).distanceM <= crossedHalfWidth + ENDPOINT_RADIUS_M,
    );
    const alongs = onRoad.map((point) => projectOnRoad(point, road).t * road.lengthM);
    if (alongs.length === 0) continue;
    const conflictHalf = Math.max(road.widthM / 2, crossedHalfWidth) + 0.5;
    const conflicts = onRoad.map((point): OrientedBox => ({
      centerX: point.x,
      centerZ: point.z,
      halfLengthM: conflictHalf,
      halfWidthM: conflictHalf,
      headingRad: 0,
    }));
    const directions = travelDirections(road);
    for (const reverse of directions) {
      const first = reverse ? road.lengthM - Math.max(...alongs) : Math.min(...alongs);
      // A road that starts at the intersection only departs from it.
      if (first < crossedHalfWidth + STOP_LINE_SETBACK_M + 0.5) continue;
      let entryM = first - crossedHalfWidth - STOP_LINE_SETBACK_M;
      // Painted stop lines (signage.ts) sit 1 m behind their pole; use them when they are further back.
      const painted = controls.find(
        (control) =>
          control.road.id === road.id &&
          !reverse &&
          (control.type === 'stop' || control.type === 'traffic_signals') &&
          distance(control.sourcePosition, intersection.center) <= CONTROL_RADIUS_M,
      );
      if (painted) entryM = Math.min(entryM, Math.max(0, travelDistance(road, false, painted.position) - 1));
      const headingRad = reverse ? road.headingRad + Math.PI : road.headingRad;
      const start = reverse ? road.b : road.a;
      approaches.push({
        id: `${intersection.id}:${road.id}${reverse ? ':reverse' : ''}`,
        intersectionId: intersection.id,
        road,
        reverse,
        headingRad,
        entryM,
        stopPoint: offsetPoint(start, headingRad, 0, entryM),
        group: road.street === intersection.mainStreet ? 0 : 1,
        rule:
          intersection.kind === 'signal'
            ? 'signal'
            : intersection.kind === 'stop' && road.street === intersection.mainStreet
              ? 'stop'
              : 'priority',
        conflicts,
      });
    }
  }
  return approaches.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Directions of travel per road. Route roads follow their leg; the busway, Av. Congreso and Cabildo's opposite
 * carriageway are game approximations (two-way busway and avenue, opposite carriageway reversed); the other
 * context streets run from `a` to `b` as a declared approximation, since the catalogue carries no sense for them.
 */
export function travelDirections(road: Road): boolean[] {
  if (road.kind === 'route') return [false];
  if (road.kind === 'busway' || road.street === 'Av. Congreso') return [false, true];
  if (road.id.endsWith('-context')) return [true];
  return [false];
}

function intersectionsOf(city: City): Intersection[] {
  const groups = cluster(crossings(city.roads));
  return groups
    .map((group, index) => {
      const points = group.map((crossing) => crossing.point);
      const center = {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        z: points.reduce((sum, point) => sum + point.z, 0) / points.length,
      };
      const control =
        city.controls
          .filter(
            (item) =>
              (item.type === 'stop' || item.type === 'traffic_signals') &&
              distance(item.sourcePosition, center) <= CONTROL_RADIUS_M,
          )
          .sort((a, b) => distance(a.sourcePosition, center) - distance(b.sourcePosition, center))[0] ?? null;
      const roads = new Set<Road>(group.flatMap((crossing) => crossing.roads));
      const widest = Math.max(...[...roads].map((road) => road.widthM / 2));
      const reach = Math.max(...points.map((point) => distance(point, center)));
      const half = reach + widest + 1;
      const mainStreet = control ? control.road.street : required(group[0], 'crossing').roads[0].street;
      const base = {
        id: `intersection-${index}`,
        center,
        box: { centerX: center.x, centerZ: center.z, halfLengthM: half, halfWidthM: half, headingRad: 0 },
        control,
        kind: control ? (control.type === 'stop' ? ('stop' as const) : ('signal' as const)) : ('none' as const),
        mainStreet,
      };
      return { ...base, approaches: approachesOf(base, group, city.roads, city.controls) };
    })
    .sort((a, b) => a.center.x - b.center.x || a.center.z - b.center.z)
    .map((intersection, index) => {
      const id = `intersection-${index}`;
      return {
        ...intersection,
        id,
        approaches: intersection.approaches.map((approach) => ({
          ...approach,
          id: approach.id.replace(intersection.id, id),
          intersectionId: id,
        })),
      };
    });
}

function crosswalkAt(
  id: string,
  road: Road,
  center: Point,
  intersectionId: string | null,
  group: 0 | 1,
  controlId: string | null,
): Crosswalk {
  const leftM = road.widthM / 2 + (road.cycleTrack ? CYCLE_TRACK_WIDTH_M : 0);
  const rightM = road.widthM / 2;
  const box: OrientedBox = {
    centerX: center.x,
    centerZ: center.z,
    halfLengthM: CROSSWALK_HALF_LENGTH_M,
    halfWidthM: (leftM + rightM) / 2,
    headingRad: road.headingRad,
  };
  // The box is centred on the pavement, which the cycle track widens to the left.
  const shifted = offsetPoint(center, road.headingRad, (leftM - rightM) / 2);
  return {
    id,
    road,
    center,
    box: { ...box, centerX: shifted.x, centerZ: shifted.z },
    kerbs: [offsetPoint(center, road.headingRad, leftM + 1.2), offsetPoint(center, road.headingRad, -rightM - 1.2)],
    intersectionId,
    group,
    controlId,
  };
}

function crosswalksOf(city: City, intersections: readonly Intersection[]): Crosswalk[] {
  const found: Crosswalk[] = [];
  for (const control of city.controls) {
    if (control.type !== 'crossing-traffic_signals') continue;
    const center = projectOnRoad(control.sourcePosition, control.road).point;
    const host = intersections
      .filter((item) => item.kind === 'signal' && distance(item.center, center) <= CLUSTER_RADIUS_M)
      .sort((a, b) => distance(a.center, center) - distance(b.center, center))[0];
    found.push(
      crosswalkAt(
        `crosswalk-${control.id}`,
        control.road,
        center,
        host?.id ?? null,
        host && host.mainStreet === control.road.street ? 0 : 1,
        control.id,
      ),
    );
  }
  for (const intersection of intersections) {
    for (const approach of intersection.approaches) {
      if (approach.road.kind !== 'route') continue;
      const center = offsetPoint(
        approach.stopPoint,
        approach.headingRad,
        0,
        CROSSWALK_OFFSET_M + CROSSWALK_HALF_LENGTH_M,
      );
      const duplicate = found.some(
        (other) => other.road.id === approach.road.id && distance(other.center, center) <= DUPLICATE_CROSSWALK_M,
      );
      if (duplicate) continue;
      found.push(
        crosswalkAt(
          `crosswalk-${approach.id}`,
          approach.road,
          center,
          intersection.kind === 'signal' ? intersection.id : null,
          approach.group,
          null,
        ),
      );
    }
    // Departures: route roads that start inside the intersection get a crosswalk just past it.
    for (const road of city.roads) {
      if (road.kind !== 'route' || distance(road.a, intersection.center) > intersection.box.halfLengthM) continue;
      const others = intersection.approaches.filter((approach) => approach.road.street !== road.street);
      const crossedHalfWidth = Math.max(0, ...others.map((approach) => approach.road.widthM / 2));
      const alongM = projectOnRoad(intersection.center, road).t * road.lengthM;
      const center = offsetPoint(
        road.a,
        road.headingRad,
        0,
        alongM + crossedHalfWidth + CROSSWALK_OFFSET_M + CROSSWALK_HALF_LENGTH_M,
      );
      if (projectOnRoad(center, road).t >= 1) continue;
      const duplicate = found.some(
        (other) => other.road.id === road.id && distance(other.center, center) <= DUPLICATE_CROSSWALK_M,
      );
      if (duplicate) continue;
      found.push(
        crosswalkAt(
          `crosswalk-${intersection.id}:${road.id}:exit`,
          road,
          center,
          intersection.kind === 'signal' ? intersection.id : null,
          road.street === intersection.mainStreet ? 0 : 1,
          null,
        ),
      );
    }
  }
  return found;
}

/** Lateral offset (positive = left of the road heading) of lane `index` out of `count`, rightmost first. */
export function laneOffsetM(road: Road, index: number, count: number): number {
  return -road.widthM / 2 + ((index + 0.5) * road.widthM) / count;
}

function laneOf(road: Road, reverse: boolean, leftM: number, suffix: string, speedMps = laneSpeedMps(road)): Lane {
  const from = offsetPoint(reverse ? road.b : road.a, road.headingRad, leftM);
  const to = offsetPoint(reverse ? road.a : road.b, road.headingRad, leftM);
  return {
    id: `${road.id}:${suffix}`,
    road,
    reverse,
    from,
    to,
    headingRad: reverse ? road.headingRad + Math.PI : road.headingRad,
    lengthM: road.lengthM,
    speedMps,
  };
}

function pathOf(
  id: string,
  kind: PathKind,
  lanes: readonly Lane[],
  cyclic: boolean,
  intersections: readonly Intersection[],
  crosswalks: readonly Crosswalk[],
): Path {
  const points: Point[] = [];
  const cumulativeM: number[] = [];
  const segments: PathSegment[] = [];
  let total = 0;
  const firstLane = required(lanes[0], 'lane');
  const lastLane = required(lanes.at(-1), 'lane');
  if (!cyclic) {
    points.push(offsetPoint(firstLane.from, firstLane.headingRad, 0, -PATH_STUB_M));
    cumulativeM.push(0);
    total = PATH_STUB_M;
  }
  for (const lane of lanes) {
    const last = points.at(-1);
    if (last) {
      total += distance(last, lane.from);
    }
    points.push(lane.from);
    cumulativeM.push(total);
    const startS = total;
    total += lane.lengthM;
    points.push(lane.to);
    cumulativeM.push(total);
    segments.push({ lane, startS, endS: total });
  }
  const first = required(points[0], 'path point');
  if (cyclic) total += distance(required(points.at(-1), 'path point'), first);
  else {
    total += PATH_STUB_M;
    points.push(offsetPoint(lastLane.to, lastLane.headingRad, 0, PATH_STUB_M));
    cumulativeM.push(total);
  }
  const stops: PathStop[] = [];
  const pathCrosswalks: PathCrosswalk[] = [];
  for (const segment of segments) {
    for (const intersection of intersections)
      for (const approach of intersection.approaches)
        if (approach.road.id === segment.lane.road.id && approach.reverse === segment.lane.reverse)
          stops.push({ atS: segment.startS + approach.entryM, approach });
    for (const crosswalk of crosswalks)
      if (crosswalk.road.id === segment.lane.road.id) {
        const along = travelDistance(crosswalk.road, segment.lane.reverse, crosswalk.center);
        pathCrosswalks.push({ atS: segment.startS + along - CROSSWALK_HALF_LENGTH_M, crosswalk });
      }
  }
  stops.sort((a, b) => a.atS - b.atS);
  pathCrosswalks.sort((a, b) => a.atS - b.atS);
  return { id, kind, points, cumulativeM, lengthM: total, cyclic, segments, stops, crosswalks: pathCrosswalks };
}

/** Consecutive roads of a list that chain end to start. */
function runs(roads: readonly Road[]): Road[][] {
  const result: Road[][] = [];
  for (const road of roads) {
    const current = result.at(-1);
    const previous = current?.at(-1);
    if (current && previous && distance(previous.b, road.a) <= ENDPOINT_RADIUS_M) current.push(road);
    else result.push([road]);
  }
  return result;
}

function pathsOf(city: City, intersections: readonly Intersection[], crosswalks: readonly Crosswalk[]): Path[] {
  const build = (id: string, kind: PathKind, lanes: Lane[], cyclic: boolean) =>
    pathOf(id, kind, lanes, cyclic, intersections, crosswalks);
  const route = city.legs.flatMap((leg) => city.roads.filter((road) => road.leg === leg.number));
  const paths: Path[] = [];
  paths.push(
    build(
      'lap',
      'vehicle',
      route.map((road) => laneOf(road, false, laneOffsetM(road, 0, Math.max(1, road.lanes)), 'lane-0')),
      true,
    ),
  );
  for (const run of runs(route.filter((road) => road.lanes >= 2)))
    paths.push(
      build(
        `left-${required(run[0], 'run').id}`,
        'vehicle',
        run.map((road) => laneOf(road, false, laneOffsetM(road, 1, road.lanes), 'lane-1')),
        false,
      ),
    );
  const busway = city.roads.filter((road) => road.kind === 'busway');
  for (const run of runs(busway)) {
    const base = required(run[0], 'run').id;
    paths.push(
      build(
        `${base}:forward`,
        'bus',
        run.map((road) => laneOf(road, false, laneOffsetM(road, 0, 2), 'forward')),
        false,
      ),
      build(
        `${base}:back`,
        'bus',
        [...run].reverse().map((road) => laneOf(road, true, laneOffsetM(road, 1, 2), 'back')),
        false,
      ),
    );
  }
  const context = city.roads.filter((road) => road.kind === 'context');
  for (const run of runs(context.filter((road) => road.id.endsWith('-context')))) {
    const base = required(run[0], 'run').id;
    const reversed = [...run].reverse();
    for (const index of [0, 1])
      paths.push(
        build(
          `${base}:opposite-${index}`,
          'vehicle',
          reversed.map((road) => laneOf(road, true, laneOffsetM(road, index, 2), `opposite-${index}`)),
          false,
        ),
      );
  }
  for (const road of context.filter((road) => !road.id.endsWith('-context'))) {
    const twoWay = travelDirections(road).length === 2;
    paths.push(
      build(`${road.id}:forward`, 'vehicle', [laneOf(road, false, twoWay ? -road.widthM / 4 : 0, 'forward')], false),
    );
    if (twoWay) paths.push(build(`${road.id}:back`, 'vehicle', [laneOf(road, true, road.widthM / 4, 'back')], false));
  }
  for (const run of runs(route.filter((road) => road.cycleTrack))) {
    const base = required(run[0], 'run').id;
    const leftM = (road: Road) => road.widthM / 2 + CYCLE_TRACK_WIDTH_M / 2;
    const speed = BICYCLE_KMH * KMH_TO_MPS;
    paths.push(
      build(
        `cycle-${base}:forward`,
        'bicycle',
        run.map((road) => laneOf(road, false, leftM(road), 'cycle-forward', speed)),
        false,
      ),
      build(
        `cycle-${base}:back`,
        'bicycle',
        [...run].reverse().map((road) => laneOf(road, true, leftM(road), 'cycle-back', speed)),
        false,
      ),
    );
  }
  return paths;
}

export function buildNetwork(city: City): Network {
  const intersections = intersectionsOf(city);
  const crosswalks = crosswalksOf(city, intersections);
  const paths = pathsOf(city, intersections, crosswalks);
  return {
    intersections,
    crosswalks,
    lanes: paths.flatMap((path) => path.segments.map((segment) => segment.lane)),
    paths,
  };
}

/** The lane segment covering `s` (already wrapped), or null on a stub or corner link. */
function segmentAt(path: Path, s: number): PathSegment | null {
  let low = 0,
    high = path.segments.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const segment = required(path.segments[middle], 'segment');
    if (s < segment.startS) high = middle - 1;
    else if (s > segment.endS) low = middle + 1;
    else return segment;
  }
  return null;
}

/** Position and heading at `s` metres along a path (wrapping on cyclic paths). */
export function pointAlong(path: Path, s: number): { point: Point; headingRad: number; segment: PathSegment | null } {
  const wrapped = path.cyclic
    ? ((s % path.lengthM) + path.lengthM) % path.lengthM
    : Math.max(0, Math.min(path.lengthM, s));
  const last = path.points.length - 1;
  const segment = segmentAt(path, wrapped);
  // Binary search for the first point at or beyond `wrapped`, then step back over zero-length links.
  let low = 0,
    high = last;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (required(path.cumulativeM[middle], 'cumulative') < wrapped) low = middle + 1;
    else high = middle;
  }
  for (let index = Math.max(0, low - 1); index < last; index++) {
    const start = required(path.cumulativeM[index], 'cumulative');
    const end = required(path.cumulativeM[index + 1], 'cumulative');
    // Lanes of one street meet at a shared node: that zero-length link carries no heading.
    if (end === start || wrapped > end) continue;
    const a = required(path.points[index], 'point'),
      b = required(path.points[index + 1], 'point');
    const fraction = Math.max(0, Math.min(1, (wrapped - start) / (end - start)));
    return { point: mixPoint(a, b, fraction), headingRad: Math.atan2(b.x - a.x, b.z - a.z), segment };
  }
  // Closing link of a cyclic path, from the last point back to the first.
  const a = required(path.points[last], 'point'),
    b = required(path.points[0], 'point');
  const start = required(path.cumulativeM[last], 'cumulative');
  const fraction = Math.max(0, Math.min(1, (wrapped - start) / Math.max(1e-6, path.lengthM - start)));
  return { point: mixPoint(a, b, fraction), headingRad: Math.atan2(b.x - a.x, b.z - a.z), segment };
}

/** Distance along a path of the closest point to `point`, with the lateral distance; null if farther than `maxLateralM`. */
export function locateOnPath(path: Path, point: Point, maxLateralM: number): { s: number; lateralM: number } | null {
  let best: { s: number; lateralM: number } | null = null;
  const count = path.points.length - (path.cyclic ? 0 : 1);
  for (let index = 0; index < count; index++) {
    const a = required(path.points[index], 'point');
    const b = required(path.points[(index + 1) % path.points.length], 'point');
    const start = required(path.cumulativeM[index], 'cumulative');
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    const t =
      lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
    const lateralM = distance(point, { x: a.x + dx * t, z: a.z + dz * t });
    if (lateralM <= maxLateralM && (best === null || lateralM < best.lateralM))
      best = { s: start + t * Math.sqrt(lengthSquared), lateralM };
  }
  return best;
}
