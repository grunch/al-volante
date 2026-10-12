import routeData from '../../specs/route/comuna13-a.json';
import { buildCity, distance } from '../city/model.ts';
import type { City } from '../city/model.ts';
import { RouteSchema } from '../content/schemas.ts';
import { buildCircuit, distanceAlong, legAt } from '../exam/circuit.ts';
import type { Circuit } from '../exam/circuit.ts';
import type { CarControls } from '../sim/car.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import { headingDifference, pointAlong } from '../traffic/network.ts';
import { lookAhead } from '../traffic/lookahead.ts';
import { createTraffic, trafficSourceOf } from '../traffic/traffic.ts';
import type { Traffic, TrafficState } from '../traffic/traffic.ts';
import { Driver, IDLE } from './examDriver.ts';

/**
 * A lawful test driver for the circuit (F04-T03): pure pursuit on the lap path, obeying lights, STOP signs,
 * priorities, crosswalks, the vehicle ahead, the ambulance and the corners. Every lawful behaviour can be switched
 * off to produce the faulty case of a rule. It is a test fixture, not the examiner.
 */

const CRUISE_MPS = 7.2;
const COMFORT_BRAKE_MPS2 = 2;
const STOP_WAIT_S = 1.2;
const CORNER_MPS = 3.8;
const CORNER_SLOW_M = 22;
const SIGNAL_M = 45;
const PURSUIT_M = 7;

export const CITY: City = buildCity(RouteSchema.parse(routeData));

export interface CityExam {
  driver: Driver;
  circuit: Circuit;
  traffic: Traffic;
}

/** Whether the traffic snapshot is the seeded city traffic (with vehicle states), not a scripted scenario. */
const isTrafficState = (snapshot: unknown): snapshot is TrafficState =>
  typeof snapshot === 'object' && snapshot !== null && 'vehicles' in snapshot;

export function cityExam(kind: TransmissionKind, seed = 1, options: { emergency?: boolean } = {}): CityExam {
  const seeded = createTraffic(CITY, seed);
  const traffic: Traffic = options.emergency === false ? { ...seeded, emergency: null } : seeded;
  const world = { ...CITY.world, traffic: trafficSourceOf(traffic) };
  const circuit = buildCircuit(CITY, traffic);
  const driver = new Driver(kind, seed, world, CITY.start.pose, circuit);
  return { driver, circuit, traffic };
}

/** Stage I and the box done properly, out of the box and ready to drive: the first 100 m begin. */
export function throughTheBox(driver: Driver, options: { secondGear?: boolean } = {}): Driver {
  driver.ready();
  driver.recognise();
  driver.prepareProperly();
  driver.startEngine();
  driver.moveInBox(-0.3);
  driver.moveInBox(0.3);
  driver.cabin({ type: 'signal', value: 'left' });
  driver.cabin({ type: 'look', yaw: 0.5, pitch: 0 });
  driver.cabin({ type: 'look', yaw: 0, pitch: 0 });
  driver.driveOut();
  driver.cabin({ type: 'signal', value: 'off' });
  if (driver.phase !== 'firstMetres') throw new Error(`expected the first metres, got ${driver.phase}`);
  if (driver.kind === 'manual') {
    driver.hold({ ...IDLE, clutch: 0.7, throttle: 0.4 }, (car) => car.world.vehicle.speedMps > 0.3, 5);
    driver.hold({ ...IDLE, clutch: 0.6, throttle: 0.5 }, (car) => car.world.vehicle.speedMps > 1.5, 8);
    if (options.secondGear !== false) {
      driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
      driver.drive({ type: 'shift', to: '2' });
    }
  }
  return driver;
}

export interface CruiseOptions {
  until: (driver: Driver, elapsedS: number) => boolean;
  maxS: number;
  cruiseMps?: number;
  /** Lawful behaviours, all on by default. */
  obeyLights?: boolean;
  stopAtStops?: boolean;
  yieldPriority?: boolean;
  yieldCrosswalks?: boolean;
  keepDistance?: boolean;
  signalTurns?: boolean;
  slowAtCorners?: boolean;
  yieldToEmergency?: boolean;
  slowAtBumps?: boolean;
  /** Lateral offset to follow instead of the lane line (positive = left), e.g. to drive on the cycle track. */
  lateralM?: number;
  /** Final say on the wanted speed and the steering. */
  speed?: (driver: Driver, wantedMps: number) => number;
  steer?: (driver: Driver, steer: number) => number;
}

export const toStop = (distanceM: number) => (distanceM <= 0.4 ? 0 : Math.sqrt(2 * COMFORT_BRAKE_MPS2 * distanceM));

export const frontOf = (vehicle: VehicleState) => {
  const body = bodyBox(EXAM_CAR, vehicle);
  return body.centerZ + body.halfLengthM;
};

/** Drives along the lap one fixed step at a time until `until` holds; throws after `maxS`. */
export function cruise(exam: CityExam, options: CruiseOptions): void {
  const { driver, circuit } = exam;
  const { lap } = circuit;
  let clearedStop: string | null = null;
  let stoppedS = 0;
  const lastSeen = new Map<string, { x: number; z: number }>();
  const automatic = driver.kind === 'automatic';
  for (let elapsed = 0; elapsed < options.maxS; elapsed += SIM_STEP_S) {
    if (options.until(driver, elapsed)) return;
    if (driver.phase === 'finished') return;
    const vehicle = driver.car.world.vehicle;
    const body = bodyBox(EXAM_CAR, vehicle);
    const snapshot = driver.scenario;
    if (!snapshot) throw new Error('the circuit driver needs traffic');
    const view = lookAhead(circuit.traffic, snapshot, body);
    const centreS = view.routeS ?? 0;
    const frontS = centreS + body.halfLengthM;
    // Pure pursuit of a point ahead on the lap line, shifted by the wanted lateral offset.
    const ahead = pointAlong(lap, frontS + PURSUIT_M);
    const lateral = options.lateralM ?? 0;
    const target = {
      x: ahead.point.x + Math.cos(ahead.headingRad) * lateral,
      z: ahead.point.z - Math.sin(ahead.headingRad) * lateral,
    };
    const heading = Math.atan2(target.x - vehicle.x, target.z - vehicle.z);
    const error = headingDifference(heading, vehicle.headingRad);
    const wheel = Math.atan((2 * EXAM_CAR.wheelbaseM * Math.sin(error)) / Math.max(1, distance(vehicle, target)));
    let steer = Math.max(-1, Math.min(1, wheel / EXAM_CAR.maxSteerRad));
    if (options.steer) steer = options.steer(driver, steer);
    let wanted = options.cruiseMps ?? CRUISE_MPS;
    const leg = legAt(circuit, centreS);
    if (leg) wanted = Math.min(wanted, (leg.examKmh / 3.6) * 0.92);
    if (view.signal && options.obeyLights !== false) {
      const { light, distanceM } = view.signal;
      const canStop = distanceM >= (vehicle.speedMps * vehicle.speedMps) / (2 * 4);
      if (light === 'red' || (light === 'yellow' && canStop)) wanted = Math.min(wanted, toStop(distanceM));
    }
    const corner = circuit.crossings
      .map((crossing) => ({ crossing, distanceM: distanceAlong(circuit, frontS, crossing.lineS) }))
      .filter((item) => item.distanceM >= -1)
      .sort((a, b) => a.distanceM - b.distanceM)[0];
    if (corner) {
      const { crossing, distanceM } = corner;
      const inside = snapshot.poses.some(
        (pose) =>
          pose.kind !== 'pedestrian' &&
          pose.kind !== 'emergency' &&
          Math.abs(headingDifference(pose.headingRad, vehicle.headingRad)) > Math.PI / 4 &&
          crossing.conflicts.some((box) => pose.inside(box)),
      );
      const fromRight = snapshot.poses.some((pose) => {
        if (pose.kind === 'pedestrian' || pose.kind === 'emergency') return false;
        const difference = headingDifference(pose.headingRad, vehicle.headingRad);
        if (difference <= Math.PI / 4 || difference >= (3 * Math.PI) / 4) return false;
        return distance(pose, crossing.center) < 22 && distance(pose, crossing.center) > 4;
      });
      if (crossing.rule === 'stop' && options.stopAtStops !== false && clearedStop !== crossing.approachId) {
        wanted = Math.min(wanted, toStop(distanceM));
        if (vehicle.speedMps === 0 && distanceM <= 3 && stoppedS >= STOP_WAIT_S && !inside)
          clearedStop = crossing.approachId;
      } else if (
        options.yieldPriority !== false &&
        crossing.rule !== 'signal' &&
        distanceM > -1 &&
        (inside || (crossing.rule === 'priority' && fromRight))
      )
        wanted = Math.min(wanted, toStop(distanceM));
      if (
        options.slowAtCorners !== false &&
        (crossing.corner || crossing.rule !== 'signal') &&
        distanceM < CORNER_SLOW_M
      )
        wanted = Math.min(wanted, CORNER_MPS);
      if (options.signalTurns !== false && crossing.corner && distanceM < SIGNAL_M && distanceM > -2) {
        if (driver.cockpit.signal !== crossing.corner.turn)
          driver.cabin({ type: 'signal', value: crossing.corner.turn });
      } else if (options.signalTurns !== false && driver.cockpit.signal !== 'off' && distanceM > SIGNAL_M + 5)
        driver.cabin({ type: 'signal', value: 'off' });
    }
    if (view.crosswalk?.occupied && options.yieldCrosswalks !== false) {
      // The lap distance jumps on corner links: the straight-line distance to the crosswalk is checked too.
      const box = circuit.crosswalks.find((item) => item.id === view.crosswalk?.crosswalkId)?.box;
      const front = {
        x: body.centerX + Math.sin(vehicle.headingRad) * body.halfLengthM,
        z: body.centerZ + Math.cos(vehicle.headingRad) * body.halfLengthM,
      };
      const straight = box ? distance(front, { x: box.centerX, z: box.centerZ }) - box.halfLengthM : Infinity;
      wanted = Math.min(wanted, toStop(Math.max(0, Math.min(view.crosswalk.distanceM, straight) - 2.5)));
    }
    if (view.leader && options.keepDistance !== false) {
      const free = Math.max(0, view.leader.gapM - 3);
      const before = lastSeen.get(view.leader.pose.id);
      const leaderSpeed = before ? distance(before, view.leader.pose) / SIM_STEP_S : 0;
      // Two seconds of headway with a margin (the examiner's high g), and room to stop behind a standing one.
      const headway = leaderSpeed > 1 ? Math.max(0, view.leader.gapM - 1) / 2.4 : leaderSpeed + free / 2.2;
      wanted = Math.min(wanted, headway, Math.sqrt(2 * COMFORT_BRAKE_MPS2 * free));
    }
    const ambulance = snapshot.poses.find((pose) => pose.kind === 'emergency');
    if (ambulance && options.yieldToEmergency !== false) {
      const forward = { x: Math.sin(vehicle.headingRad), z: Math.cos(vehicle.headingRad) };
      const along = (ambulance.x - body.centerX) * forward.x + (ambulance.z - body.centerZ) * forward.z;
      if (along < 0 && along > -80) wanted = Math.min(wanted, 2.2);
    }
    for (const bump of circuit.bumps) {
      const distanceM = distanceAlong(circuit, frontS, bump.s);
      if (options.slowAtBumps !== false && distanceM > -2 && distanceM < 15) wanted = Math.min(wanted, 4);
    }
    for (const pose of snapshot.poses) lastSeen.set(pose.id, { x: pose.x, z: pose.z });
    if (options.speed) wanted = options.speed(driver, wanted);
    const speed = vehicle.speedMps;
    let controls: CarControls;
    if (wanted > speed + 0.15) controls = { ...IDLE, steer, throttle: Math.min(0.9, 0.2 + (wanted - speed) * 0.5) };
    else if (wanted < speed - 0.15)
      controls = { ...IDLE, steer, brake: Math.min(1, (speed - wanted) * 0.6 + (wanted < 1 ? 0.35 : 0)) };
    else controls = { ...IDLE, steer, throttle: wanted > 0 ? 0.12 : 0, brake: wanted > 0 ? 0 : 0.5 };
    if (!automatic && wanted === 0 && speed < 2) controls = { ...controls, clutch: 1 };
    driver.hold(controls, (_, t) => t > 0, 1);
    stoppedS = driver.car.world.vehicle.speedMps === 0 ? stoppedS + SIM_STEP_S : 0;
  }
  throw new Error(`condition not met in ${options.maxS} s`);
}

/** Puts the car on a leg of the circuit, as a fixture, and lets the examiner forget where it came from. */
export function placeOnLeg(exam: CityExam, leg: number, distanceM: number, lateralM = 0): void {
  const { driver, circuit } = exam;
  const entry = circuit.legs.find((item) => item.number === leg);
  if (!entry) throw new Error(`unknown leg ${leg}`);
  const { point, headingRad } = pointAlong(circuit.lap, entry.startS + distanceM);
  const x = point.x + Math.cos(headingRad) * lateralM;
  const z = point.z - Math.sin(headingRad) * lateralM;
  const toRear = EXAM_CAR.lengthM / 2 - EXAM_CAR.rearOverhangM;
  const vehicle: VehicleState = {
    ...driver.car.world.vehicle,
    x: x - Math.sin(headingRad) * toRear,
    z: z - Math.cos(headingRad) * toRear,
    headingRad,
    steerRad: 0,
  };
  driver.car = { ...driver.car, world: { ...driver.car.world, vehicle } };
  driver.session = {
    ...driver.session,
    street: { ...driver.session.street, previousFrontS: null, cornerPending: null, poseMemory: {}, passing: {} },
  };
  if (driver.scenario && isTrafficState(driver.scenario)) {
    const reset: TrafficState = { ...driver.scenario, carCenter: null, touching: [] };
    driver.scenario = reset;
  }
}
