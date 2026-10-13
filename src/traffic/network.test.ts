import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity, distance, projectOnRoad } from '../city/model.ts';
import type { City, CityControl, Road } from '../city/model.ts';
import { createRandom } from '../activities/random.ts';
import { overlaps } from '../sim/collision.ts';
import type { Point } from '../sim/collision.ts';
import { DRY_ASPHALT } from '../sim/dynamics.ts';
import { restingVehicle } from '../sim/vehicle.ts';
import { controlLights, createSignalPlan } from './lights.ts';
import { buildNetwork, laneSpeedMps, locateOnPath, pointAlong, travelDirections } from './network.ts';

const city = buildCity(RouteSchema.parse(routeData));
const network = buildNetwork(city);
const at = (x: number, z: number) => network.intersections.find((item) => distance(item.center, { x, z }) < 12) ?? null;

describe('traffic network', () => {
  it('finds every crossing of the route with a control and assigns the control that governs it', () => {
    const quesadaCabildo = at(0, 0);
    expect(quesadaCabildo?.kind).toBe('signal');
    expect(quesadaCabildo?.control?.id).toBe('control-0');
    expect(quesadaCabildo?.mainStreet).toBe('Quesada');
    const iberaCabildo = at(-90, -107);
    expect(iberaCabildo?.kind).toBe('signal');
    expect(iberaCabildo?.control?.id).toBe('control-3');
    // Iberá crosses the three Cabildo carriageways: one intersection, one light.
    expect(iberaCabildo?.approaches.map((approach) => approach.road.id)).toEqual(
      expect.arrayContaining(['leg-2-2', 'ibera', 'leg-2-3-busway', 'leg-2-3-context']),
    );
    const guayraCuba = at(15, -288);
    expect(guayraCuba?.kind).toBe('stop');
    expect(guayraCuba?.control?.id).toBe('control-5');
    expect(guayraCuba?.approaches.find((approach) => approach.road.id === 'leg-3-2')?.rule).toBe('stop');
    const cubaIbera = at(67, -205);
    expect(cubaIbera?.control?.id).toBe('control-6');
    expect(cubaIbera?.approaches.find((approach) => approach.road.id === 'leg-4-0')?.rule).toBe('stop');
    expect(cubaIbera?.approaches.find((approach) => approach.road.id === 'ibera')?.rule).toBe('priority');
    const guayraObligado = at(-70, -237);
    expect(guayraObligado?.kind).toBe('none');
    expect(guayraObligado?.approaches.map((approach) => approach.rule)).toEqual(['priority', 'priority']);
  });

  it('places stop lines before the crossed street, never inside it', () => {
    for (const intersection of network.intersections)
      for (const approach of intersection.approaches) {
        const others = intersection.approaches.filter((other) => other.road.street !== approach.road.street);
        for (const other of others)
          expect(projectOnRoad(approach.stopPoint, other.road).distanceM).toBeGreaterThanOrEqual(
            other.road.widthM / 2 + 1.5,
          );
      }
    // The painted line of the Quesada signal sits further back than the geometric one, and wins.
    const quesada = at(0, 0)?.approaches.find((approach) => approach.road.id === 'leg-1-1');
    expect(quesada?.entryM).toBeCloseTo(quesada!.road.lengthM - 10, 0);
  });

  it('gives the signalled crossings their own crosswalks tied to the nearest signal and the corners theirs', () => {
    const signalled = network.crosswalks.filter((crosswalk) => crosswalk.controlId !== null);
    expect(signalled.map((crosswalk) => crosswalk.controlId)).toEqual(['control-1', 'control-2', 'control-4']);
    expect(signalled[0]?.intersectionId).toBe(at(0, 0)?.id);
    expect(signalled[0]?.group).toBe(1);
    for (const crosswalk of network.crosswalks) {
      expect(crosswalk.road.kind).toBe('route');
      expect(overlaps(crosswalk.box, { ...crosswalk.box, halfLengthM: 0.1, halfWidthM: 0.1 })).toBe(true);
      // Kerbs are outside the pavement, on opposite sides.
      expect(projectOnRoad(crosswalk.kerbs[0], crosswalk.road).distanceM).toBeGreaterThan(crosswalk.road.widthM / 2);
      expect(projectOnRoad(crosswalk.kerbs[1], crosswalk.road).distanceM).toBeGreaterThan(crosswalk.road.widthM / 2);
      expect(distance(crosswalk.kerbs[0], crosswalk.kerbs[1])).toBeGreaterThan(crosswalk.road.widthM);
    }
    const ends = network.crosswalks.filter((crosswalk) => crosswalk.id.endsWith(':exit'));
    expect(ends.length).toBeGreaterThan(5);
  });

  it('builds a cyclic lap for cars with every control in order, plus the busway, context and cycle paths', () => {
    const lap = network.paths.find((path) => path.id === 'lap');
    expect(lap?.cyclic).toBe(true);
    // Lane offsets at the corners add a few metres to the 1506.8 m centreline.
    expect(lap?.lengthM).toBeGreaterThan(1500);
    expect(lap?.lengthM).toBeLessThan(1525);
    const stopKinds = lap!.stops.map((stop) => `${stop.approach.road.street}:${stop.approach.rule}`);
    expect(stopKinds).toEqual([
      // Vuelta de Obligado's northern continuation leaves Quesada here; nothing crosses, but it is a corner.
      'Quesada:priority',
      'Quesada:signal',
      'Av. Cabildo:signal',
      'Av. Cabildo:signal',
      'Guayra:priority',
      'Guayra:stop',
      'Cuba:stop',
      'Cuba:priority',
      'Quesada:stop',
      'Cuba:signal',
      'Cuba:priority',
      'Manuel Ugarte:stop',
      'Vuelta de Obligado:signal',
      'Vuelta de Obligado:stop',
    ]);
    expect(lap!.stops.every((stop, index) => index === 0 || stop.atS > lap!.stops[index - 1]!.atS)).toBe(true);
    const kinds = new Map<string, number>();
    for (const path of network.paths) kinds.set(path.kind, (kinds.get(path.kind) ?? 0) + 1);
    expect(kinds.get('bus')).toBe(2);
    expect(kinds.get('bicycle')).toBe(2);
    const cycle = network.paths.find((path) => path.id.startsWith('cycle-') && path.id.endsWith(':forward'));
    expect(cycle?.segments.every((segment) => segment.lane.road.cycleTrack)).toBe(true);
    expect(cycle?.segments.map((segment) => segment.lane.road.leg)).toEqual([4, 4, 5, 5, 6]);
    expect(cycle?.segments[0]?.lane.speedMps).toBeCloseTo(15 / 3.6, 5);
    // The two directions of the two-way track never share a line: each keeps to its right half.
    const back = network.paths.find((path) => path.id === cycle?.id.replace(':forward', ':back'));
    const firstForward = cycle!.segments[0]!.lane;
    const lastBack = back!.segments.at(-1)!.lane;
    expect(lastBack.road.id).toBe(firstForward.road.id);
    const offset = (lane: typeof firstForward) => projectOnRoad(lane.from, lane.road).distanceM;
    expect(offset(firstForward)).toBeCloseTo(firstForward.road.widthM / 2 + 0.65, 5);
    expect(offset(lastBack)).toBeCloseTo(firstForward.road.widthM / 2 + 1.95, 5);
    for (const path of network.paths) {
      expect(path.lengthM).toBeGreaterThan(0);
      // Cycle tracks run both ways beside one-way streets (a declared approximation); vehicles never do.
      if (path.kind === 'bicycle') continue;
      for (const segment of path.segments) {
        const direction = segment.lane.reverse;
        expect(travelDirections(segment.lane.road)).toContain(direction);
      }
    }
  });

  it('keeps the busway and the opposite carriageway reversed and the avenue two-way', () => {
    expect(travelDirections(city.roads.find((road) => road.id === 'leg-2-1')!)).toEqual([false]);
    expect(travelDirections(city.roads.find((road) => road.id === 'leg-2-1-busway')!)).toEqual([false, true]);
    expect(travelDirections(city.roads.find((road) => road.id === 'leg-2-1-context')!)).toEqual([true]);
    expect(travelDirections(city.roads.find((road) => road.id === 'congreso')!)).toEqual([false, true]);
    expect(travelDirections(city.roads.find((road) => road.id === 'ibera')!)).toEqual([false]);
  });

  it('walks a path by distance, wraps the lap and locates points on it', () => {
    const lap = network.paths.find((path) => path.id === 'lap')!;
    const start = pointAlong(lap, 0);
    expect(start.point).toEqual(lap.points[0]);
    const wrapped = pointAlong(lap, lap.lengthM + 10);
    expect(distance(wrapped.point, pointAlong(lap, 10).point)).toBeLessThan(1e-6);
    expect(pointAlong(lap, 10).segment?.lane.road.id).toBe('leg-1-0');
    const located = locateOnPath(lap, pointAlong(lap, 300).point, 1);
    expect(located?.s).toBeCloseTo(300, 3);
    expect(located?.lateralM).toBeCloseTo(0, 6);
    expect(locateOnPath(lap, { x: 1000, z: 1000 }, 5)).toBeNull();
    const bus = network.paths.find((path) => path.kind === 'bus')!;
    expect(pointAlong(bus, bus.lengthM + 50).point).toEqual(pointAlong(bus, bus.lengthM).point);
  });
});

describe('lane speeds', () => {
  const route = city.roads.find((road) => road.kind === 'route')!;
  const context = city.roads.find((road) => road.id === 'ibera')!;
  const busway = city.roads.find((road) => road.kind === 'busway')!;

  it('keeps the lower of the exam limit and the posted maximum, and the street limit without either', () => {
    expect(laneSpeedMps({ ...route, examMaxKmh: 30, postedMaxKmh: 20 })).toBeCloseTo(20 / 3.6, 9);
    expect(laneSpeedMps({ ...route, examMaxKmh: 45, postedMaxKmh: null })).toBeCloseTo(45 / 3.6, 9);
    expect(laneSpeedMps({ ...route, examMaxKmh: null, postedMaxKmh: null })).toBeCloseTo(30 / 3.6, 9);
  });

  it('gives context streets the street or avenue limit by name or width, and the busway its own', () => {
    expect(laneSpeedMps({ ...context, street: 'Iberá', widthM: 8.8 })).toBeCloseTo(30 / 3.6, 9);
    expect(laneSpeedMps({ ...context, street: 'Iberá', widthM: 18 })).toBeCloseTo(45 / 3.6, 9);
    expect(laneSpeedMps({ ...context, street: 'Av. Congreso', widthM: 8.8 })).toBeCloseTo(45 / 3.6, 9);
    expect(laneSpeedMps(busway)).toBeCloseTo(40 / 3.6, 9);
  });
});

describe('controls of a synthetic block', () => {
  /** Four one-way legs around a 200 m block and a street crossing the first leg 25 m after its start. */
  const street = (id: string, name: string, a: Point, b: Point, leg: number | null): Road => ({
    id,
    leg,
    street: name,
    a,
    b,
    lengthM: distance(a, b),
    headingRad: Math.atan2(b.x - a.x, b.z - a.z),
    widthM: 8.8,
    widthStatus: 'approximation',
    lanes: 1,
    lanesStatus: 'approximation',
    cycleTrack: false,
    kind: leg === null ? 'context' : 'route',
    postedMaxKmh: null,
    examMaxKmh: leg === null ? null : 30,
  });
  const corners: Point[] = [
    { x: 0, z: 0 },
    { x: 0, z: 200 },
    { x: 200, z: 200 },
    { x: 200, z: 0 },
  ];
  const legs = corners.map((from, index) =>
    street(`leg-${index + 1}`, `Leg ${index + 1}`, from, corners[(index + 1) % 4]!, index + 1),
  );
  const control = (id: string, type: string, road: Road, position: Point): CityControl => ({
    id,
    type,
    sourcePosition: position,
    position,
    road,
    status: 'single-source',
    sources: [],
  });
  const first = legs[0]!;
  const second = legs[1]!;
  const block: City = {
    legs: legs.map((road) => ({
      number: road.leg!,
      street: road.street,
      path: [road.a, road.b],
      lengthM: road.lengthM,
      turn: 'left',
    })),
    roads: [...legs, street('cross', 'Cross', { x: 60, z: 25 }, { x: -60, z: 25 }, null)],
    controls: [
      // Two controls near one crossing: the nearer governs it.
      control('far-stop', 'stop', first, { x: -5.5, z: 8 }),
      control('signal', 'traffic_signals', first, { x: -5, z: 17 }),
      // A signalled crosswalk on the crossing replaces the corner crosswalk of the approach.
      control('crossing', 'crossing-traffic_signals', first, { x: 0, z: 23 }),
      // A signalled crosswalk mid-block, with no signal near it.
      control('mid-block', 'crossing-traffic_signals', second, { x: 100, z: 200 }),
    ],
    world: { surface: DRY_ASPHALT, obstacles: [], markings: [] },
    start: { status: 'approximation', pose: restingVehicle({ x: 0, z: 0, headingRad: 0 }) },
  };
  const blockNetwork = buildNetwork(block);
  const crossing = blockNetwork.intersections.find((item) => distance(item.center, { x: 0, z: 25 }) < 1)!;

  it('lets the nearest control govern a crossing and orders crossings on the same x by z', () => {
    expect(crossing.kind).toBe('signal');
    expect(crossing.control?.id).toBe('signal');
    expect(crossing.approaches.map((approach) => approach.rule)).toEqual(['signal', 'signal']);
    const onTheFirstLeg = blockNetwork.intersections.filter((item) => Math.abs(item.center.x) < 1);
    expect(onTheFirstLeg.map((item) => item.center.z)).toEqual([0, 25, 200]);
    expect(onTheFirstLeg.map((item) => item.id)).toEqual(['intersection-0', 'intersection-1', 'intersection-2']);
  });

  it('ties a signalled crosswalk to its crossing, drops the duplicate corner one and leaves a lone one unlit', () => {
    const signalled = blockNetwork.crosswalks.find((item) => item.controlId === 'crossing')!;
    expect(signalled.intersectionId).toBe(crossing.id);
    expect(signalled.group).toBe(0);
    const approach = crossing.approaches.find((item) => item.road.id === first.id)!;
    expect(blockNetwork.crosswalks.some((item) => item.id === `crosswalk-${approach.id}`)).toBe(false);
    const lone = blockNetwork.crosswalks.find((item) => item.controlId === 'mid-block')!;
    expect(lone.intersectionId).toBeNull();
    expect(lone.group).toBe(1);
    const plan = createSignalPlan(blockNetwork, createRandom(1));
    const lights = controlLights(plan, blockNetwork, 0);
    expect(lights['crossing']).toBeDefined();
    expect(lights['mid-block']).toBeUndefined();
  });
});
