import { planStreetParking } from './streetParking.ts';
import type { Route } from '../content/schemas.ts';
import type { Point, OrientedBox } from '../sim/collision.ts';
import { overlaps } from '../sim/collision.ts';
import { DRY_ASPHALT } from '../sim/dynamics.ts';
import { EXAM_CAR, restingVehicle } from '../sim/vehicle.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { Obstacle, World } from '../sim/world.ts';

export interface Road {
  id: string;
  leg: number | null;
  street: string;
  a: Point;
  b: Point;
  lengthM: number;
  headingRad: number;
  widthM: number;
  widthStatus: 'approximation';
  lanes: number;
  lanesStatus: 'single-source' | 'approximation';
  cycleTrack: boolean;
  kind: 'route' | 'context' | 'busway';
  postedMaxKmh: number | null;
  examMaxKmh: number | null;
}
export interface CityLeg {
  number: number;
  street: string;
  path: Point[];
  lengthM: number;
  turn: 'left' | 'right';
}
export interface CityControl {
  id: string;
  type: string;
  sourcePosition: Point;
  position: Point;
  road: Road;
  status: Route['controls'][number]['status'];
  sources: string[];
  gcbaId?: string;
}
export interface City {
  legs: CityLeg[];
  roads: Road[];
  controls: CityControl[];
  world: World;
  start: { status: 'approximation'; pose: VehicleState };
}

/** East stays +x; north is -z in Three.js. Never mirror the source map. */
export const toWorld = (point: { x: number; y: number }): Point => ({ x: point.x, z: -point.y });
export const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.z - a.z);
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Missing route geometry');
  return value;
}
export const mixPoint = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
});

export function offsetPoint(point: Point, heading: number, leftM: number, aheadM = 0): Point {
  return {
    x: point.x + Math.cos(heading) * leftM + Math.sin(heading) * aheadM,
    z: point.z - Math.sin(heading) * leftM + Math.cos(heading) * aheadM,
  };
}

export function projectOnRoad(point: Point, road: Road): { point: Point; t: number; distanceM: number } {
  const dx = road.b.x - road.a.x;
  const dz = road.b.z - road.a.z;
  const t = Math.max(0, Math.min(1, ((point.x - road.a.x) * dx + (point.z - road.a.z) * dz) / road.lengthM ** 2));
  const projected = mixPoint(road.a, road.b, t);
  return { point: projected, t, distanceM: distance(point, projected) };
}

export function roadBox(road: Road, extraWidthM = 0): OrientedBox {
  return {
    centerX: (road.a.x + road.b.x) / 2,
    centerZ: (road.a.z + road.b.z) / 2,
    halfLengthM: road.lengthM / 2,
    halfWidthM: road.widthM / 2 + extraWidthM,
    headingRad: road.headingRad,
  };
}

function makeRoad(a: Point, b: Point, properties: Omit<Road, 'a' | 'b' | 'lengthM' | 'headingRad'>): Road {
  return { ...properties, a, b, lengthM: distance(a, b), headingRad: Math.atan2(b.x - a.x, b.z - a.z) };
}

function routeRoads(route: Route): Road[] {
  return route.legs.flatMap((leg) =>
    leg.path.slice(1).map((point, index) => {
      const segment = leg.segments.find((part) => index >= part.fromIndex && index < part.toIndex);
      if (!segment) throw new Error(`Missing road segment for leg ${leg.leg}`);
      const lanes = segment.lanesOsm ?? 1;
      // Widths and the default lane count are design approximations, never survey measurements.
      const widthM = leg.roadType === 'avenue' ? 7 : Math.max(8.8, lanes * 3.2 + 3);
      return makeRoad(toWorld(required(leg.path[index])), toWorld(point), {
        id: `leg-${leg.leg}-${index}`,
        leg: leg.leg,
        street: leg.street,
        widthM,
        widthStatus: 'approximation',
        lanes,
        lanesStatus: segment.lanesOsm === null ? 'approximation' : 'single-source',
        cycleTrack: segment.cycleTrackLeft,
        kind: 'route',
        postedMaxKmh: segment.maxspeedOsm,
        examMaxKmh: leg.examMaxKmh,
      });
    }),
  );
}

/** Context connections interpolate between catalogued intersections; their widths and extensions are approximate. */
function contextRoads(route: Route, roads: Road[]): Road[] {
  const point = (node: number): Point => {
    const found = route.legs.flatMap((leg) => leg.path).find((item) => item.osmNode === node);
    if (!found) throw new Error(`Missing context anchor ${node}`);
    return toWorld(found);
  };
  const connection = (id: string, street: string, from: number, to: number, widthM: number, extensionM = 0): Road => {
    const a = point(from),
      b = point(to);
    const fraction = extensionM / distance(a, b);
    return makeRoad(mixPoint(a, b, -fraction), mixPoint(a, b, 1 + fraction), {
      id,
      street,
      leg: null,
      widthM,
      widthStatus: 'approximation',
      lanes: 0,
      lanesStatus: 'approximation',
      cycleTrack: false,
      kind: 'context',
      postedMaxKmh: null,
      examMaxKmh: null,
    });
  };
  const context = [
    connection('ibera', 'Iberá', 437539781, 206176533, 8.8, 45),
    connection('congreso', 'Av. Congreso', 191913308, 92583898, 18, 65),
    connection('obligado-north', 'Vuelta de Obligado', 247921753, 243459671, 8.8),
    connection('quesada-link', 'Quesada', 180274842, 180275561, 8.8),
  ];
  // The northeast carriageway in the source is the exam road. Metrobús and the opposite carriageway are to its left.
  for (const road of roads.filter((item) => item.leg === 2)) {
    for (const [kind, offset, width] of [
      ['busway', 9, 6.4],
      ['context', 18, 7],
    ] as const) {
      context.push(
        makeRoad(offsetPoint(road.a, road.headingRad, offset), offsetPoint(road.b, road.headingRad, offset), {
          ...road,
          id: `${road.id}-${kind}`,
          leg: null,
          widthM: width,
          kind,
          lanes: 2,
          lanesStatus: 'approximation',
          postedMaxKmh: null,
          examMaxKmh: null,
        }),
      );
    }
  }
  return context;
}

function curbObstacles(roads: Road[]): Obstacle[] {
  const obstacles: Obstacle[] = [];
  for (const road of roads) {
    if (road.kind === 'busway') continue;
    const count = Math.ceil(road.lengthM / 4);
    const step = road.lengthM / count;
    for (const side of [-1, 1]) {
      const leftM = side * (road.widthM / 2 + 0.12 + (side === 1 && road.cycleTrack ? 2.6 : 0));
      for (let i = 0; i < count; i++) {
        const center = offsetPoint(mixPoint(road.a, road.b, (i + 0.5) / count), road.headingRad, leftM);
        const box = {
          centerX: center.x,
          centerZ: center.z,
          halfWidthM: 0.12,
          halfLengthM: step / 2,
          headingRad: road.headingRad,
        };
        // Cut the WHOLE collider at every intersecting road, not just its midpoint. The margin keeps turning room.
        if (
          roads.some(
            (other) => other.id !== road.id && overlaps(box, roadBox(other, 3.2 + (other.cycleTrack ? 2.6 : 0))),
          )
        )
          continue;
        obstacles.push({ id: `curb-${road.id}-${side}-${i}`, kind: 'curb', box });
      }
    }
  }
  return obstacles;
}

export function sampleLeg(city: Pick<City, 'legs'>, number: number, distanceM: number): VehicleState {
  const leg = city.legs.find((item) => item.number === number);
  if (!leg) throw new Error(`Unknown leg ${number}`);
  if (!Number.isFinite(distanceM)) throw new Error('Invalid distance');
  let remaining = Math.max(0, Math.min(distanceM, leg.lengthM));
  for (let index = 1; index < leg.path.length; index++) {
    const a = required(leg.path[index - 1]),
      b = required(leg.path[index]);
    const length = distance(a, b);
    if (remaining <= length || index === leg.path.length - 1) {
      return restingVehicle({
        ...mixPoint(a, b, Math.min(1, remaining / length)),
        headingRad: Math.atan2(b.x - a.x, b.z - a.z),
      });
    }
    remaining -= length;
  }
  throw new Error('Empty route leg');
}

/** Entry on the right-hand through lane when the source has multiple lanes. */
export function entryPose(city: City, leg: number): VehicleState {
  if (leg === 1) return city.start.pose;
  const pose = sampleLeg(city, leg, 18);
  const road = required(
    city.roads
      .filter((item) => item.leg === leg)
      .sort((a, b) => projectOnRoad(pose, a).distanceM - projectOnRoad(pose, b).distanceM)[0],
  );
  return road.lanes > 1 ? { ...pose, ...offsetPoint(pose, pose.headingRad, -road.widthM / 4) } : pose;
}

export function buildCity(route: Route): City {
  const routeEdges = routeRoads(route);
  const roads = [...routeEdges, ...contextRoads(route, routeEdges)];
  const legs = route.legs.map((leg) => ({
    number: leg.leg,
    street: leg.street,
    path: leg.path.map(toWorld),
    lengthM: routeEdges.filter((road) => road.leg === leg.leg).reduce((sum, road) => sum + road.lengthM, 0),
    turn: leg.turnIntoNext.direction,
  }));
  const controls = route.controls.map((source, index): CityControl => {
    const sourcePosition = toWorld(source);
    // Shared controls face the incoming leg, never the outgoing leg at a turn.
    const candidates = routeEdges.filter((road) => road.leg !== null && source.legs.includes(road.leg));
    const road = required(
      candidates.sort(
        (a, b) => projectOnRoad(sourcePosition, a).distanceM - projectOnRoad(sourcePosition, b).distanceM,
      )[0],
    );
    const projection = projectOnRoad(sourcePosition, road);
    const legEnd = required(route.legs.find((leg) => leg.leg === road.leg)?.path.at(-1));
    const setback = distance(projection.point, toWorld(legEnd)) < 4 ? -9 : 0;
    return {
      id: `control-${index}`,
      type: source.type,
      sourcePosition,
      position: offsetPoint(projection.point, road.headingRad, -road.widthM / 2 - 0.6, setback),
      road,
      status: source.status,
      sources: source.sources,
      ...(source.gcbaId ? { gcbaId: source.gcbaId } : {}),
    };
  });
  const pose = sampleLeg({ legs }, 1, 20);
  const entryRoad = required(routeEdges.find((road) => road.leg === 1));
  const parked = {
    ...pose,
    ...offsetPoint(pose, pose.headingRad, -(entryRoad.widthM / 2 - EXAM_CAR.widthM / 2 - 0.2)),
  };
  // Only the 6 m length is sourced (protocolo PDF 21); width, side and position are explicit approximations.
  const bayCenter = offsetPoint(parked, parked.headingRad, 0, EXAM_CAR.lengthM / 2 - EXAM_CAR.rearOverhangM);
  const markings = [-2.955, 2.955].map((ahead) => {
    const point = offsetPoint(bayCenter, pose.headingRad, 0, ahead);
    return { centerX: point.x, centerZ: point.z, halfWidthM: 1.2, halfLengthM: 0.045, headingRad: pose.headingRad };
  });
  return {
    legs,
    roads,
    controls,
    world: {
      surface: DRY_ASPHALT,
      obstacles: [
        ...curbObstacles(roads),
        ...planStreetParking(roads, [parked, ...legs.map((leg) => sampleLeg({ legs }, leg.number, 18))]),
      ],
      markings,
    },
    start: { status: 'approximation', pose: parked },
  };
}
