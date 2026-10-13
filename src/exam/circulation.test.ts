import { describe, expect, it } from 'vitest';
import { offsetPoint } from '../city/model.ts';
import { initialCockpit } from '../practice/cockpit.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import { initialCarState } from '../sim/car.ts';
import type { CarState } from '../sim/car.ts';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import type { ActorKind, ActorPose, LightState, TrafficSnapshot } from '../sim/scenario.ts';
import { restingVehicle } from '../sim/vehicle.ts';
import { CITY } from '../test/circuitDriver.ts';
import { headingDifference, locateOnPath, pointAlong } from '../traffic/network.ts';
import { ACTOR_SIZES, createTraffic } from '../traffic/traffic.ts';
import { buildCircuit, roadAt } from './circuit.ts';
import type { Circuit, CircuitCrossing } from './circuit.ts';
import { CIRCULATION, createStreet, judgeCirculation } from './circulation.ts';
import type { Report, Street } from './circulation.ts';
import { FICHA_GROUPS } from './scoring.ts';

/**
 * The circulation judge against synthetic traffic: actors placed exactly where a rule needs them, with the car
 * moving in a straight line. The scripted driver (street.test.ts) covers the rules the seeded traffic can produce.
 */
const circuit: Circuit = buildCircuit(CITY, { ...createTraffic(CITY, 1), emergency: null });
const leg3 = circuit.legs[2]!;
const leg4 = circuit.legs[3]!;
/** An open stretch of Guayra: past its mid-leg crossing, well before its corner. */
const OPEN_S = leg3.startS + 100;
const crossingOf = (leg: number, rule: CircuitCrossing['rule'], corner: boolean): CircuitCrossing =>
  circuit.crossings.find((item) => item.leg === leg && item.rule === rule && (item.corner !== null) === corner)!;

/**
 * The car as a rigid body at lap distance `s`, `lateralM` left of the lap line (the right-hand lane's centre,
 * which on Av. Cabildo is 1,75 m right of the road's centreline), heading along it.
 */
function carAt(s: number, lateralM: number, speedMps: number, brake = 0, headingOffset = 0): CarState {
  const { point, headingRad } = pointAlong(circuit.lap, s);
  const centre = offsetPoint(point, headingRad, lateralM);
  const toRear = 4.3 / 2 - 0.8;
  const heading = headingRad + headingOffset;
  const vehicle = restingVehicle({
    x: centre.x - Math.sin(heading) * toRear,
    z: centre.z - Math.cos(heading) * toRear,
    headingRad: heading,
  });
  const car = initialCarState({ ...vehicle, speedMps }, 'automatic');
  return { ...car, controls: { ...car.controls, brake } };
}

function moved(car: CarState, dt: number, lateralStepM = 0): CarState {
  const { x, z, headingRad, speedMps } = car.world.vehicle;
  const next = {
    ...car.world.vehicle,
    x: x + Math.sin(headingRad) * speedMps * dt + Math.cos(headingRad) * lateralStepM,
    z: z + Math.cos(headingRad) * speedMps * dt - Math.sin(headingRad) * lateralStepM,
    odometerM: car.world.vehicle.odometerM + Math.abs(speedMps) * dt,
  };
  return { ...car, world: { ...car.world, vehicle: next } };
}

function poseAt(id: string, kind: ActorKind, x: number, z: number, headingRad: number): ActorPose {
  const size = ACTOR_SIZES[kind];
  const box: OrientedBox = {
    centerX: x,
    centerZ: z,
    halfLengthM: size.lengthM / 2,
    halfWidthM: size.widthM / 2,
    headingRad,
  };
  return { id, kind, x, z, headingRad, active: true, box, inside: (zone) => overlaps(box, zone) };
}

/** An actor moving in a straight line from a point, as a function of time. */
const mover =
  (id: string, kind: ActorKind, from: { x: number; z: number }, headingRad: number, speedMps: number) => (t: number) =>
    poseAt(
      id,
      kind,
      from.x + Math.sin(headingRad) * speedMps * t,
      from.z + Math.cos(headingRad) * speedMps * t,
      headingRad,
    );

interface Run {
  reports: Report[];
  street: Street;
  takeover: boolean;
  done: boolean;
}

interface RunOptions {
  cockpit?: Partial<CockpitState>;
  lateral?: (t: number) => number;
  street?: Street;
  firstMetres?: boolean;
  /** Simulation time of the first step, to continue a previous run. */
  startS?: number;
  /** Lights of the snapshot by control id (a mid-block crosswalk's own light). */
  lights?: Record<string, LightState>;
}

/** Steps the judge for `seconds` with the car moving straight; `poses(t)` places the actors at each time. */
function run(
  start: CarState,
  seconds: number,
  poses: (t: number) => ActorPose[] = () => [],
  options: RunOptions = {},
): Run {
  // The judge only advances to the next leg in order, so a fresh street starts on the leg where the car is placed.
  const startLeg = roadAt(circuit.lap, locateOnPath(circuit.lap, start.world.vehicle, 10)?.s ?? 0)?.leg ?? 1;
  let street = options.street ?? createStreet(circuit, startLeg);
  let car = start;
  const cockpit = { ...initialCockpit(), belt: true, lights: 'low' as const, ...options.cockpit };
  const reports: Report[] = [];
  let takeover = false;
  let done = false;
  let lateral = options.lateral ? options.lateral(0) : 0;
  const steps = Math.round(seconds / SIM_STEP_S);
  for (let step = 0; step <= steps; step++) {
    const t = (options.startS ?? 0) + step * SIM_STEP_S;
    const snapshot: TrafficSnapshot = {
      timeS: t,
      light: 'green',
      lights: options.lights ?? {},
      poses: poses(t),
      contacts: [],
    };
    const verdict = judgeCirculation(
      street,
      circuit,
      car,
      cockpit,
      snapshot,
      SIM_STEP_S,
      t,
      options.firstMetres ?? false,
    );
    street = verdict.street;
    reports.push(...verdict.reports);
    takeover ||= verdict.takeover;
    done ||= verdict.done;
    const wantedLateral = options.lateral ? options.lateral(t) : 0;
    car = moved(car, SIM_STEP_S, wantedLateral - lateral);
    lateral = wantedLateral;
  }
  return { reports, street, takeover, done };
}

const ids = (result: Run) => result.reports.map((report) => report.ruleId);
const unique = (result: Run) => [...new Set(ids(result))];

/** A point `beforeM` before the stop line of another approach of a crossing, on that approach's road. */
function onApproach(crossing: CircuitCrossing, pick: (difference: number) => boolean, beforeM: number) {
  const own = pointAlong(circuit.lap, crossing.lineS).headingRad;
  const other = crossing.otherApproaches.find((item) => pick(headingDifference(item.headingRad, own)))!;
  const start = other.reverse ? other.road.b : other.road.a;
  return { point: offsetPoint(start, other.headingRad, 0, other.entryM - beforeM), headingRad: other.headingRad };
}

describe('progress along the circuit', () => {
  it('counts only the next leg in order: going back to the previous one never advances the lap', () => {
    const second = circuit.legs[1]!;
    const first = circuit.legs[0]!;
    let street = run(carAt(second.startS + 5, 0, 0), 0.1).street;
    expect([street.leg, street.legsEntered]).toEqual([2, 1]);
    for (let back = 0; back < 8; back++) {
      street = run(carAt(first.endS - 5, 0, 0), 0.1, undefined, { street }).street;
      expect([street.leg, street.legsEntered]).toEqual([2, 1]);
      street = run(carAt(second.startS + 5, 0, 0), 0.1, undefined, { street }).street;
      expect([street.leg, street.legsEntered]).toEqual([2, 1]);
    }
  });
});

describe('priority at unsignalised corners (protocolo PDF 12; high k)', () => {
  const corner = crossingOf(4, 'priority', true);
  const fromRight = (difference: number) => difference > Math.PI / 4 && difference < (3 * Math.PI) / 4;

  it('scores entering while a vehicle from the right is arriving at its own line', () => {
    const arriving = onApproach(corner, fromRight, 12);
    const vehicle = mover('right', 'vehicle', arriving.point, arriving.headingRad, 4);
    const result = run(carAt(corner.lineS - 8, 0, 4), 4, (t) => [vehicle(t)]);
    expect(unique(result)).toContain('rule.high.k-unsignalized-priority');
    expect(result.reports.find((report) => report.ruleId === 'rule.high.k-unsignalized-priority')?.episode).toBe(
      corner.intersectionId,
    );
  });

  it('scores nothing when the right-hand vehicle has stopped, or when nobody is arriving', () => {
    const waiting = onApproach(corner, fromRight, 6);
    const still = mover('right', 'vehicle', waiting.point, waiting.headingRad, 0);
    expect(ids(run(carAt(corner.lineS - 8, 0, 4), 4, (t) => [still(t)]))).not.toContain(
      'rule.high.k-unsignalized-priority',
    );
    expect(ids(run(carAt(corner.lineS - 8, 0, 4), 4))).not.toContain('rule.high.k-unsignalized-priority');
  });
});

describe('following distance (protocolo PDF 12, 28; high g)', () => {
  it('scores under two seconds behind a moving vehicle for more than the grace time, once per leg', () => {
    const s = OPEN_S;
    const { point, headingRad } = pointAlong(circuit.lap, s + 2.15 + 2.15 + 6);
    const leader = mover('leader', 'vehicle', point, headingRad, 7);
    const result = run(carAt(s, 0, 7), 4, (t) => [leader(t)]);
    expect(ids(result)).toContain('rule.high.g-following-distance');
    expect(result.reports.find((report) => report.ruleId === 'rule.high.g-following-distance')?.episode).toBe('leg-3');
  });

  it('scores nothing at two seconds or more, nor behind a vehicle that is standing still', () => {
    const s = OPEN_S;
    const far = pointAlong(circuit.lap, s + 4.3 + 16);
    const leader = mover('leader', 'vehicle', far.point, far.headingRad, 7);
    expect(ids(run(carAt(s, 0, 7), 4, (t) => [leader(t)]))).not.toContain('rule.high.g-following-distance');
    const near = pointAlong(circuit.lap, s + 4.3 + 6);
    const parked = mover('parked', 'vehicle', near.point, near.headingRad, 0);
    expect(ids(run(carAt(s, 0, 2.5, 1), 1, (t) => [parked(t)]))).not.toContain('rule.high.g-following-distance');
  });
});

describe('overtaking (protocolo PDF 12, 17; eliminatory p)', () => {
  const s = OPEN_S;
  const ahead = pointAlong(circuit.lap, s + 12);
  const slow = mover('slow', 'vehicle', ahead.point, ahead.headingRad, 2);
  // Pull out after a second, stay beside for the pass, then back in line.
  const pullOut = (side: number) => (t: number) => (t < 1 ? 0 : side * 2.6);

  it('scores passing a vehicle ahead on its right', () => {
    const result = run(carAt(s, 0, 8), 6, (t) => [slow(t)], { lateral: pullOut(-1) });
    expect(unique(result)).toEqual(['rule.eliminatory.p-illegal-overtaking']);
  });

  it('scores it too when the car moves aside only once level with the vehicle', () => {
    const late = run(carAt(s, 0, 8), 6, (t) => [slow(t)], { lateral: (t) => (t < 1.75 ? 0 : -2.6) });
    expect(unique(late)).toContain('rule.eliminatory.p-illegal-overtaking');
  });

  it('allows passing on the left mid-block, but not through a crossing', () => {
    const clean = run(carAt(s, 0, 8), 6, (t) => [slow(t)], { lateral: pullOut(1) });
    expect(ids(clean)).not.toContain('rule.eliminatory.p-illegal-overtaking');
    const crossing = crossingOf(3, 'priority', false);
    const near = pointAlong(circuit.lap, crossing.lineS - 2);
    const crawling = mover('crawling', 'vehicle', near.point, near.headingRad, 0.5);
    const through = run(carAt(crossing.lineS - 14, 0, 7), 6, (t) => [crawling(t)], { lateral: pullOut(1) });
    expect(ids(through)).toContain('rule.eliminatory.p-illegal-overtaking');
  });
});

describe('pedestrians and cyclists (protocolo PDF 12; high l, minor o)', () => {
  // The crosswalk just past the Congreso signal on Cuba: no slowing rule applies there, only the pedestrian.
  const crosswalk = circuit.crosswalks.find((item) => item.id === 'crosswalk-intersection-13:leg-6-1:exit')!;
  const onCrosswalk = () => [poseAt('walker', 'pedestrian', crosswalk.box.centerX, crosswalk.box.centerZ, 0)];

  it('scores keeping the speed up towards an occupied crosswalk, then entering it; braking avoids the first', () => {
    const hurried = run(carAt(crosswalk.startS - 14, 0, 7), 3, onCrosswalk);
    expect(unique(hurried)).toEqual(['rule.minor.o-precautionary-speed', 'rule.high.l-yield-to-pedestrians-cyclists']);
    expect(hurried.street.escalatable.at(-1)?.ruleId).toBe('rule.high.l-yield-to-pedestrians-cyclists');
    const braking = run(carAt(crosswalk.startS - 14, 0, 7, 0.6), 0.6, onCrosswalk);
    expect(ids(braking)).toEqual([]);
  });

  it('scores a cyclist riding across the pavement the car enters, not one riding along beside it', () => {
    const crossing = crossingOf(3, 'priority', false);
    const conflict = crossing.conflicts[0]!;
    const heading = pointAlong(circuit.lap, crossing.lineS).headingRad;
    const across = poseAt('bike', 'bicycle', conflict.centerX, conflict.centerZ, heading + Math.PI / 2);
    const entering = run(carAt(crossing.lineS - 3, 0, 4), 2, () => [across]);
    expect(unique(entering)).toEqual(['rule.high.l-yield-to-pedestrians-cyclists']);
    const along = poseAt('bike', 'bicycle', conflict.centerX, conflict.centerZ, heading);
    expect(ids(run(carAt(crossing.lineS - 3, 0, 4), 2, () => [along]))).toEqual([]);
  });
});

describe('the ficha row of the context: a turn or a crossing (decision D1; protocolo PDF 16–17)', () => {
  const groupOf = (result: Run, ruleId: string) => result.reports.find((report) => report.ruleId === ruleId)?.group;
  const slowdown = 'rule.high.m-no-slowdown-before-maneuver';
  const yielding = 'rule.high.l-yield-to-pedestrians-cyclists';

  it('reports not slowing down at the signalised corner as a turn, and at an unsignalised crossing as a crossing', () => {
    const corner = crossingOf(1, 'signal', true);
    const straight = crossingOf(3, 'priority', false);

    const turning = run(carAt(corner.lineS - 14, 0, 8), 1);
    const crossing = run(carAt(straight.lineS - 14, 0, 8), 1);

    expect(groupOf(turning, slowdown)).toBe(FICHA_GROUPS.turns);
    expect(groupOf(crossing, slowdown)).toBe(FICHA_GROUPS.crossings);
  });

  it('reports a pedestrian not yielded to on the street the car turns into as a turn', () => {
    const atCorner = circuit.crosswalks.find((item) => item.id === 'crosswalk-intersection-4:leg-2-0:exit')!;
    const midBlock = circuit.crosswalks.find((item) => item.id === 'crosswalk-intersection-13:leg-6-1:exit')!;
    const walkerOn = (crosswalk: typeof atCorner) => () => [
      poseAt('walker', 'pedestrian', crosswalk.box.centerX, crosswalk.box.centerZ, 0),
    ];

    const turning = run(carAt(atCorner.startS - 3, 0, 2), 2, walkerOn(atCorner));
    const crossing = run(carAt(midBlock.startS - 3, 0, 2), 2, walkerOn(midBlock));

    expect(groupOf(turning, yielding)).toBe(FICHA_GROUPS.turns);
    expect(groupOf(crossing, yielding)).toBe(FICHA_GROUPS.crossings);
  });

  it('reports a cyclist crossing the corner where the car turns as a turn', () => {
    const corner = crossingOf(1, 'signal', true);
    const conflict = corner.conflicts[0]!;
    const heading = pointAlong(circuit.lap, corner.lineS).headingRad;
    const bike = poseAt('bike', 'bicycle', conflict.centerX, conflict.centerZ, heading + Math.PI / 2);

    const turning = run(carAt(corner.lineS - 3, 0, 4), 2, () => [bike]);

    expect(groupOf(turning, yielding)).toBe(FICHA_GROUPS.turns);
  });
});

describe('the examiner takes the dual controls (protocolo PDF 7)', () => {
  it('reports an imminent contact with an actor straight ahead the car can no longer brake for', () => {
    const s = OPEN_S;
    const near = pointAlong(circuit.lap, s + 4.3 + 5);
    const parked = () => [poseAt('parked', 'vehicle', near.point.x, near.point.z, near.headingRad)];
    expect(run(carAt(s, 0, 9), 0.1, parked).takeover).toBe(true);
    const far = pointAlong(circuit.lap, s + 4.3 + 25);
    const away = () => [poseAt('parked', 'vehicle', far.point.x, far.point.z, far.headingRad)];
    expect(run(carAt(s, 0, 9), 0.1, away).takeover).toBe(false);
    expect(run(carAt(s, 0, 2), 0.1, parked).takeover).toBe(false);
    // An actor that is not on the street (a parked spawn not yet active) is no reason to brake.
    const inactive = () => parked().map((pose) => ({ ...pose, active: false }));
    expect(run(carAt(s, 0, 9), 0.1, inactive).takeover).toBe(false);
  });
});

describe('the route and the lights of a mid-block crosswalk (protocolo PDF 12; eliminatory f and k)', () => {
  it('scores leaving the route for 3 s while moving, not while standing still', () => {
    const moving = run(carAt(OPEN_S, 30, 2), 3.5);
    const standing = run(carAt(OPEN_S, 30, 0), 4);

    expect(unique(moving)).toEqual(['rule.eliminatory.f-examiner-safety-instruction-ignored']);
    expect(moving.street.notice).toBeNull();
    expect(ids(standing)).toEqual([]);
  });

  it('scores crossing a pedestrian light on red once, and lets the car through on green', () => {
    const crosswalk = circuit.crosswalks.find((item) => item.controlId !== null)!;
    const through = (light: LightState) =>
      run(carAt(crosswalk.startS - 4, 0, 4), 2.5, () => [], { lights: { [crosswalk.controlId!]: light } });

    expect(ids(through('red')).filter((id) => id === 'rule.eliminatory.k-red-light')).toHaveLength(1);
    expect(ids(through('green'))).not.toContain('rule.eliminatory.k-red-light');
  });
});

describe('the horn (protocolo PDF 12; minor m)', () => {
  const s = OPEN_S;
  it('scores a press with nobody close ahead, once per press', () => {
    const result = run(carAt(s, 0, 5), 0.5, () => [], { cockpit: { horn: true } });
    expect(ids(result)).toEqual(['rule.minor.m-horn-misuse']);
  });
  it('accepts a press with a pedestrian or a vehicle close ahead', () => {
    const near = pointAlong(circuit.lap, s + 8);
    const walker = () => [poseAt('walker', 'pedestrian', near.point.x, near.point.z, 0)];
    expect(ids(run(carAt(s, 0, 5), 0.5, walker, { cockpit: { horn: true } }))).toEqual([]);
  });
});

describe('the emergency vehicle (protocolo PDF 12; eliminatory n)', () => {
  const s = OPEN_S;
  const behind = pointAlong(circuit.lap, s - 30);
  const ambulance = mover(
    'ambulance',
    'emergency',
    offsetPoint(behind.point, behind.headingRad, 2.4),
    behind.headingRad,
    14,
  );

  it('scores not making way before it passes', () => {
    const result = run(carAt(s, 0, 7), 6, (t) => [ambulance(t)]);
    expect(unique(result)).toEqual(['rule.eliminatory.n-emergency-vehicle-not-yielded']);
  });

  it('accepts pulling to the right, or slowing down, while it comes', () => {
    const right = run(carAt(s, -1, 7), 6, (t) => [ambulance(t)], { lateral: () => -1 });
    expect(ids(right)).toEqual([]);
    const slow = run(carAt(s, 0, 2), 6, (t) => [ambulance(t)]);
    expect(ids(slow)).toEqual([]);
  });

  it('scores an ambulance held up behind the car for 4 s that has to find its own way, not one let through', () => {
    const close = pointAlong(circuit.lap, s - 5);
    // Standing still 5 m behind for 4.2 s, then gone (it turned off): it never passed the car.
    const stuck = (t: number) =>
      t < 4.2 ? [poseAt('ambulance', 'emergency', close.point.x, close.point.z, close.headingRad)] : [];

    // Just over 10 km/h in the middle of the lane, the ambulance stays within 20 m behind.
    const holding = run(carAt(s, 0, 2.85), 4.5, stuck);
    const yielding = run(carAt(s, 0, 2), 4.5, stuck);

    expect(unique(holding)).toEqual(['rule.eliminatory.n-emergency-vehicle-not-yielded']);
    expect(ids(yielding)).toEqual([]);
    expect(yielding.street.emergency).toMatchObject({ seen: true, judged: true });
  });

  it('does not keep a slow moment from far away as making way: the yield must hold while it comes close', () => {
    const farBehind = pointAlong(circuit.lap, s - 80);
    const far = mover(
      'ambulance',
      'emergency',
      offsetPoint(farBehind.point, farBehind.headingRad, 2.4),
      farBehind.headingRad,
      14,
    );
    // Slow for a moment while the ambulance is 80 m behind, then back to normal speed until it passes.
    const slowFirst = run(carAt(s - 1, 0, 2), 0.5, (t) => [far(t)]);
    expect(ids(slowFirst)).toEqual([]);
    const thenFast = run(carAt(s, 0, 7), 14, (t) => [far(t)], { street: slowFirst.street, startS: 0.5 });
    // The 90 m driven also cross the next corner, which scores its own rules; only the ambulance matters here.
    expect(ids(thenFast)).toContain('rule.eliminatory.n-emergency-vehicle-not-yielded');
  });
});

describe('lanes (protocolo PDF 12; minor p, low h, high o, eliminatory j and o)', () => {
  const cabildo = circuit.legs[1]!;
  const s = cabildo.startS + 60;

  // Lateral offsets from the right lane's line: the left lane is 3,5 m over, the carriageway edge 5,25 m.
  const LEFT_LANE_M = 3.5;

  it('scores a lane change without a mirror glance and without three seconds of signal, both once', () => {
    // Lane changes count once the car has settled 20 m into the road after its corner.
    const result = run(carAt(s, 0, 8), 5, () => [], { lateral: (t) => (t < 3.5 ? 0 : LEFT_LANE_M) });
    expect(ids(result)).toEqual(['rule.high.o-no-mirror-check-lane-change', 'rule.low.h-no-lane-change-signal']);
  });

  it('accepts a lane change after a glance at the mirror with the signal on for three seconds', () => {
    const signalled = run(carAt(s, 0, 8), 3.5, () => [], { cockpit: { signal: 'left' } });
    const street: Street = { ...signalled.street, lastGlance: { yaw: 0.5, atS: 3.5 }, previousFrontS: null };
    const change = run(carAt(s + 28, 0, 8), 2, () => [], {
      cockpit: { signal: 'left' },
      lateral: (t) => (t < 4 ? 0 : LEFT_LANE_M),
      street,
      startS: 3.5,
    });
    expect(ids(change)).toEqual([]);
  });

  it('scores straddling two lanes for three seconds, the continuous line beside the busway and the busway itself', () => {
    const straddle = run(carAt(s, LEFT_LANE_M / 2, 8), 7, () => [], { lateral: () => LEFT_LANE_M / 2 });
    expect(ids(straddle)).toContain('rule.minor.p-lane-keeping');
    const line = run(carAt(s, 6.35, 8), 1.2, () => [], { lateral: () => 6.35 });
    expect(unique(line)).toContain('rule.eliminatory.o-solid-line-crossed');
    expect(unique(line)).not.toContain('rule.eliminatory.j-forbidden-road-lane-direction');
    const busway = run(carAt(s, 10.75, 8), 1.5, () => [], { lateral: () => 10.75 });
    expect(unique(busway)).toContain('rule.eliminatory.j-forbidden-road-lane-direction');
  });

  it('accepts a change to the right after a glance at the right mirror, not after one at the left mirror', () => {
    const signalled = run(carAt(s, LEFT_LANE_M, 8), 3.5, () => [], {
      cockpit: { signal: 'right' },
      lateral: () => LEFT_LANE_M,
    });
    const change = (yaw: number) =>
      run(carAt(s + 28, LEFT_LANE_M, 8), 2, () => [], {
        cockpit: { signal: 'right' },
        lateral: (t) => (t < 4 ? LEFT_LANE_M : 0),
        street: { ...signalled.street, lastGlance: { yaw, atS: 3.5 }, previousFrontS: null },
        startS: 3.5,
      });

    expect(ids(change(-0.5))).toEqual([]);
    expect(ids(change(0.5))).toEqual(['rule.high.o-no-mirror-check-lane-change']);
  });

  it('scores turning right at the end of Av. Cabildo from its left lane, and keeps it escalatable (high n)', () => {
    const corner = crossingOf(2, 'signal', true);
    const turnFrom = (lateralM: number) =>
      run(carAt(corner.lineS - 30, lateralM, 6), 6, () => [], { lateral: () => lateralM });

    const wrong = turnFrom(LEFT_LANE_M);

    expect(ids(wrong)).toContain('rule.high.n-turn-from-wrong-lane');
    expect(wrong.street.escalatable.map((item) => item.ruleId)).toContain('rule.high.n-turn-from-wrong-lane');
    expect(ids(turnFrom(0))).not.toContain('rule.high.n-turn-from-wrong-lane');
  });

  it('scores driving on the cycle track and against the one-way direction', () => {
    const track = run(carAt(leg4.startS + 60, 5.3, 6), 1.5, () => [], { lateral: () => 5.3 });
    expect(unique(track)).toEqual(['rule.eliminatory.j-forbidden-road-lane-direction']);
    const wrongWay = run(carAt(leg3.startS + 100, 0, 4, 0, Math.PI), 1.5);
    expect(unique(wrongWay)).toEqual(['rule.eliminatory.j-forbidden-road-lane-direction']);
  });
});

describe('speed bump, loss of control and the way (minor n, eliminatory h, minor l and k)', () => {
  it('scores the hump of Cuba taken over the threshold, not under it', () => {
    const bump = circuit.bumps[0]!;
    // The hump sits a few metres before the Manuel Ugarte corner: taken fast, the corner is not slowed for either.
    expect(ids(run(carAt(bump.s - 8, 0, 7), 2))).toContain('rule.minor.n-speed-bump-imprudent');
    expect(ids(run(carAt(bump.s - 8, 0, 4), 3))).toEqual([]);
  });

  it('scores crawling with the way clear and stopping for nothing, each once per episode', () => {
    const s = OPEN_S;
    expect(unique(run(carAt(s, 0, 1.5), 9))).toEqual(['rule.minor.l-below-minimum-speed']);
    expect(unique(run(carAt(s, 0, 0), 1.5))).toEqual(['rule.minor.k-unnecessary-stop']);
    const line = crossingOf(3, 'priority', false).lineS;
    expect(unique(run(carAt(line - 4, 0, 0), 1.5))).toEqual([]);
  });

  it('skips the speed rules in the first 100 m, where the instruction rule applies instead', () => {
    const s = OPEN_S;
    expect(ids(run(carAt(s, 0, 10), 0.5, () => [], { firstMetres: true }))).toEqual([]);
    expect(ids(run(carAt(s, 0, 10), 0.5))).toEqual(['rule.high.f-exam-speed-exceeded']);
  });

  it('keeps the thresholds as documented game decisions', () => {
    expect(CIRCULATION.headwayS).toBe(2);
    expect(CIRCULATION.approachKmh).toBe(20);
    expect(CIRCULATION.bumpKmh).toBe(20);
    expect(CIRCULATION.minimumKmh).toBe(10);
  });
});
