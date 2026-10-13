import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity } from '../city/model.ts';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import type { LightState } from '../sim/scenario.ts';
import { CYCLE_PERIOD_S, crosswalkLight, groupLight } from './lights.ts';
import type { Crosswalk, PathCrosswalk } from './network.ts';
import { ACTOR_SIZES, createTraffic, createTrafficState, stepTraffic } from './traffic.ts';
import type { PedestrianState, Traffic, TrafficState } from './traffic.ts';

/**
 * The crossings of Av. Cabildo with their own vehicle light (controls 1, 2 and 4 of route A): the actors obey them
 * exactly like the stop lines of a signal, since the examiner fails the player for crossing them on red.
 */
const city = buildCity(RouteSchema.parse(routeData));
const base = createTraffic(city, 1);
const lap = base.network.paths.find((path) => path.id === 'lap')!;
const FAR_AWAY: OrientedBox = { centerX: 5000, centerZ: 5000, halfLengthM: 2.15, halfWidthM: 0.875, headingRad: 0 };
const HALF_LENGTH_M = ACTOR_SIZES.vehicle.lengthM / 2;
const ACTOR = 'vehicle-0';

/** Where a walker stands on its crosswalk, as the traffic poses it (kerb to kerb, from its side). */
function pedestrianBox(crosswalk: Crosswalk, pedestrian: PedestrianState): OrientedBox {
  const from = crosswalk.kerbs[pedestrian.side];
  const to = crosswalk.kerbs[pedestrian.side === 0 ? 1 : 0];
  return {
    centerX: from.x + (to.x - from.x) * pedestrian.progress,
    centerZ: from.z + (to.z - from.z) * pedestrian.progress,
    halfLengthM: ACTOR_SIZES.pedestrian.lengthM / 2,
    halfWidthM: ACTOR_SIZES.pedestrian.widthM / 2,
    headingRad: Math.atan2(to.x - from.x, to.z - from.z),
  };
}

const crossingOf = (controlId: string): PathCrosswalk =>
  lap.crosswalks.find((item) => item.crosswalk.controlId === controlId)!;

/**
 * The base traffic, without pedestrians, with one lap vehicle whose front bumper starts `leadM` before `crossing`,
 * and the crossing's host signal shifted so that `light` begins on its road exactly at `startsAtS`.
 */
function scenario(crossing: PathCrosswalk, leadM: number, light: LightState, startsAtS: number): Traffic {
  const hostId = crossing.crosswalk.intersectionId!;
  const cycle = { ...base.plan.cycles[hostId]!, offsetS: 0 };
  // The phase where `light` begins for the crossing's group, found on the unshifted cycle.
  let phase = 0;
  while (!(
    groupLight(cycle, crossing.crosswalk.group, phase) === light &&
    groupLight(cycle, crossing.crosswalk.group, phase - 0.25) !== light
  ))
    phase += 0.25;
  const offsetS = (((phase - startsAtS) % CYCLE_PERIOD_S) + CYCLE_PERIOD_S) % CYCLE_PERIOD_S;
  return {
    ...base,
    plan: { cycles: { ...base.plan.cycles, [hostId]: { ...cycle, offsetS } } },
    vehicles: [
      {
        id: ACTOR,
        kind: 'vehicle',
        pathId: lap.id,
        halfLengthM: HALF_LENGTH_M,
        halfWidthM: ACTOR_SIZES.vehicle.widthM / 2,
        speedFactor: 1,
        startS: crossing.atS - leadM - HALF_LENGTH_M,
        respawnDelayS: 5,
      },
    ],
    walks: {},
  };
}

interface Trace {
  /** When the front bumper first went past the line, and the light it showed then. */
  crossed: { timeS: number; light: LightState } | null;
  /** Front bumper positions (relative to the line) at every step where the vehicle stood still before crossing. */
  stoppedFronts: { light: LightState; frontM: number }[];
  /** The farthest the front went past the line while its light was red, before crossing on another light. */
  maxFrontOnRedM: number;
  /** First time the front reached each watched distance before the line, with the speed then. */
  reached: Map<number, { timeS: number; speedMps: number }>;
}

function drive(
  traffic: Traffic,
  crossing: PathCrosswalk,
  seconds: number,
  from: TrafficState = createTrafficState(traffic),
  watchM: readonly number[] = [],
  each?: (state: TrafficState, light: LightState) => void,
): Trace {
  const trace: Trace = { crossed: null, stoppedFronts: [], maxFrontOnRedM: -Infinity, reached: new Map() };
  let state = from;
  for (let step = 0; step < Math.round(seconds / SIM_STEP_S); step++) {
    const timeS = state.timeS + SIM_STEP_S;
    state = stepTraffic(traffic, state, FAR_AWAY, timeS, SIM_STEP_S);
    const light = crosswalkLight(traffic.plan, crossing.crosswalk, timeS)!;
    const actor = state.vehicles.find((item) => item.id === ACTOR)!;
    const frontM = actor.s + HALF_LENGTH_M - crossing.atS;
    for (const watched of watchM)
      if (!trace.reached.has(watched) && frontM >= -watched)
        trace.reached.set(watched, { timeS, speedMps: actor.speedMps });
    if (trace.crossed === null) {
      if (light === 'red') trace.maxFrontOnRedM = Math.max(trace.maxFrontOnRedM, frontM);
      if (actor.speedMps === 0) trace.stoppedFronts.push({ light, frontM });
      if (frontM > 0.3) trace.crossed = { timeS, light };
    }
    each?.(state, light);
  }
  return trace;
}

describe('signalised crosswalks', () => {
  it('are the three crossings of Av. Cabildo on the lap, lit by their host signal', () => {
    // Arrange / Act
    const ids = lap.crosswalks.filter((item) => item.crosswalk.controlId !== null).map((item) => item.crosswalk.id);

    // Assert
    expect(ids).toEqual(['crosswalk-control-1', 'crosswalk-control-2', 'crosswalk-control-4']);
    for (const id of ['control-1', 'control-2', 'control-4'])
      expect(crosswalkLight(base.plan, crossingOf(id).crosswalk, 0)).not.toBeNull();
  });

  // control-1: 60 m before it the vehicle still passes the Quesada line, whose green is this crossing's red.
  // control-4: it starts just past the Iberá line, which shows the same light as this crossing.
  it.each([
    { controlId: 'control-1', leadM: 60 },
    { controlId: 'control-2', leadM: 60 },
    { controlId: 'control-4', leadM: 12 },
  ])('stops before the line of $controlId while it is red and goes on once it turns green', ({ controlId, leadM }) => {
    // Arrange: the crossing turns red as the vehicle sets off.
    const crossing = crossingOf(controlId);
    const traffic = scenario(crossing, leadM, 'red', 0);

    // Act
    const trace = drive(traffic, crossing, CYCLE_PERIOD_S * 1.5);

    // Assert: across only once the light allows it, never past the line on red, standing right before it.
    expect(trace.crossed?.light).toBe('green');
    expect(trace.maxFrontOnRedM).toBeLessThanOrEqual(0.3);
    const onRed = trace.stoppedFronts.filter((item) => item.light === 'red');
    expect(onRed.length).toBeGreaterThan(0);
    for (const { frontM } of onRed) expect(frontM).toBeGreaterThanOrEqual(-1.2);
  });

  it('stops on yellow when it can still brake comfortably, and drives on when the yellow catches it at the line', () => {
    // Arrange: a first pass on green to learn when the vehicle is 30 m and 3 m from the line, and how fast.
    const crossing = crossingOf('control-2');
    const green = drive(scenario(crossing, 60, 'green', 0), crossing, 12, undefined, [30, 3]);
    const far = green.reached.get(30)!;
    const near = green.reached.get(3)!;
    expect(green.stoppedFronts.filter((item) => item.frontM > -59)).toEqual([]);
    // At 3 m it cannot stop even at full braking (5 m/s²); at 30 m it stops at comfort braking (3 m/s²).
    expect((near.speedMps * near.speedMps) / (2 * 5)).toBeGreaterThan(3);
    expect((far.speedMps * far.speedMps) / (2 * 3)).toBeLessThan(30);

    // Act
    const early = drive(scenario(crossing, 60, 'yellow', far.timeS), crossing, CYCLE_PERIOD_S * 1.5);
    const late = drive(scenario(crossing, 60, 'yellow', near.timeS), crossing, near.timeS + 3);

    // Assert
    expect(early.crossed?.light).toBe('green');
    expect(early.maxFrontOnRedM).toBeLessThanOrEqual(0.3);
    expect(early.stoppedFronts.some((item) => item.light !== 'green' && item.frontM >= -1.2)).toBe(true);
    expect(late.stoppedFronts.filter((item) => item.frontM > -59)).toEqual([]);
    expect(late.crossed?.light).toBe('yellow');
  });

  it('drives across on green without stopping', () => {
    // Arrange
    const crossing = crossingOf('control-2');

    // Act
    const trace = drive(scenario(crossing, 60, 'green', 0), crossing, 10);

    // Assert: it only stood still at its start.
    expect(trace.crossed?.light).toBe('green');
    expect(trace.stoppedFronts.filter((item) => item.frontM > -59)).toEqual([]);
  });

  it('still lets a pedestrian on the crosswalk finish crossing while its light is green', () => {
    // Arrange: a slow walker still on the crossing when the vehicles' green begins.
    const crossing = crossingOf('control-2');
    const traffic = scenario(crossing, 40, 'green', 0);
    const walker: PedestrianState = {
      id: `pedestrian-${crossing.crosswalk.id}-0`,
      crosswalkId: crossing.crosswalk.id,
      progress: 0.3,
      side: 0,
      speedMps: 0.25,
      walk: 0,
    };
    const from: TrafficState = { ...createTrafficState(traffic), pedestrians: [walker] };
    const lights = new Set<LightState>();
    let walkerOnIt = false;

    // Act
    const trace = drive(traffic, crossing, 12, from, [], (state, light) => {
      lights.add(light);
      walkerOnIt = state.pedestrians.some(
        (item) => item.id === walker.id && overlaps(pedestrianBox(crossing.crosswalk, item), crossing.crosswalk.box),
      );
    });

    // Assert: green all along and the walker still on it, so the vehicle waits right before the crosswalk.
    expect([...lights]).toEqual(['green']);
    expect(walkerOnIt).toBe(true);
    expect(trace.crossed).toBeNull();
    expect(trace.stoppedFronts.some((item) => item.light === 'green' && item.frontM >= -1.2)).toBe(true);
  });
});
