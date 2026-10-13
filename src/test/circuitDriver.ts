import routeData from '../../specs/route/comuna13-a.json';
import { buildCity, distance } from '../city/model.ts';
import type { City } from '../city/model.ts';
import { RouteSchema } from '../content/schemas.ts';
import { buildCircuit, distanceAlong, legAt } from '../exam/circuit.ts';
import { across } from '../exam/street.ts';
import type { Circuit, ParkingBay } from '../exam/circuit.ts';
import { startPoseFor } from '../exam/modes.ts';
import { bayFrame } from '../exam/parking.ts';
import type { Stage } from '../exam/scoring.ts';
import type { CarControls, CarState } from '../sim/car.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { OrientedBox } from '../sim/collision.ts';
import { overlaps } from '../sim/collision.ts';
import type { TrafficSnapshot } from '../sim/scenario.ts';
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
const PRECAUTION_M = 20;
const EXIT_CROSSWALK_M = 25;
const KERB_MARGIN_M = 2;
const PRECAUTION_MPS = 5;
/** How far ahead (seconds) the driver projects a cyclist riding towards a crossing it is about to enter. */
const CYCLIST_HORIZON_S = [0.5, 1, 1.5, 2, 2.5, 3];
/**
 * Yielding to a cyclist coming across its way, the driver stops this far short of its line: at some corners the
 * cycle track's crossing runs right past the line, and a car standing there blocks the cyclist, who waits for it; both
 * then set off into each other. Nearly standing (under PULL_AWAY_MPS), the driver looks further, since pulling away
 * takes longer: cyclists within CYCLIST_PULL_AWAY_HORIZON_S at their speed, or held up (for a pedestrian, say) within
 * CYCLIST_NEAR_M of the crossing on their way into it. Heuristics of this test driver, not protocol thresholds.
 */
const CYCLIST_ROOM_M = 1.5;
const PULL_AWAY_MPS = 0.5;
const CYCLIST_PULL_AWAY_HORIZON_S = [...CYCLIST_HORIZON_S, 3.5, 4, 4.5, 5];
const CYCLIST_NEAR_M = 12;
const CYCLIST_NEAR_STEPS_M = Array.from({ length: CYCLIST_NEAR_M + 1 }, (_, metres) => metres);
/**
 * Before turning across the cycle track, the driver lets through cyclists this far behind on the side of the turn,
 * no farther to that side than the track can be (heuristics of this test driver, not protocol thresholds).
 */
const CYCLIST_BEHIND_M = 25;
const CYCLIST_AHEAD_M = 6;
const CYCLIST_LATERAL_M = 8;
/** The manual test driver: first gear from a stop, second above this speed; clutch down under this speed. */
const MANUAL_SECOND_GEAR_MPS = 3.5;
const MANUAL_CLUTCH_DOWN_MPS = 2.2;
const MANUAL_PULL_AWAY_MPS = 1.2;
/** Lateral acceleration the test driver allows itself in a corner (the examiner's eliminatory h is 6 m/s²). */
const CORNER_LATERAL_MPS2 = 4;

export const CITY: City = buildCity(RouteSchema.parse(routeData));

export interface CityExam {
  driver: Driver;
  circuit: Circuit;
  traffic: Traffic;
}

/** Whether the traffic snapshot is the seeded city traffic (with vehicle states), not a scripted scenario. */
const isTrafficState = (snapshot: unknown): snapshot is TrafficState =>
  typeof snapshot === 'object' && snapshot !== null && 'vehicles' in snapshot;

export function cityExam(
  kind: TransmissionKind,
  seed = 1,
  options: { emergency?: boolean; practice?: Stage } = {},
): CityExam {
  const seeded = createTraffic(CITY, seed);
  const traffic: Traffic = options.emergency === false ? { ...seeded, emergency: null } : seeded;
  const world = { ...CITY.world, traffic: trafficSourceOf(traffic) };
  const circuit = buildCircuit(CITY, traffic);
  const practice = options.practice ?? null;
  const driver = new Driver(kind, seed, world, startPoseFor(CITY, practice), circuit, practice);
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

/** The manual test driver's gears: first to pull away, second once rolling (the first 100 m ask for it). */
function shiftManual(driver: Driver, speed: number, wanted: number, steer: number): void {
  const { powertrain } = driver.car;
  if (powertrain.kind !== 'manual') return;
  const to = speed < 0.3 && wanted > 0 && powertrain.manualGear !== '1' ? '1' : null;
  const up = speed > MANUAL_SECOND_GEAR_MPS && powertrain.manualGear === '1' && wanted > speed ? '2' : null;
  const gear = to ?? up;
  if (!gear) return;
  driver.hold({ ...IDLE, clutch: 1, steer }, (_, t) => t > 0.05, 1);
  driver.drive({ type: 'shift', to: gear });
}

/** A pedestrian on the crosswalk, or at its kerb about to step off: the box widened by the kerb margin. */
function someoneOn(snapshot: TrafficSnapshot, box: OrientedBox): boolean {
  const widened: OrientedBox = { ...box, halfWidthM: box.halfWidthM + KERB_MARGIN_M };
  return snapshot.poses.some((pose) => pose.kind === 'pedestrian' && pose.active && overlaps(pose.box, widened));
}

/** Where a pose would be after riding `metres` straight ahead, with its own footprint. */
function projected(pose: TrafficSnapshot['poses'][number], metres: number): OrientedBox {
  return {
    ...pose.box,
    centerX: pose.box.centerX + Math.sin(pose.headingRad) * metres,
    centerZ: pose.box.centerZ + Math.cos(pose.headingRad) * metres,
  };
}

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
      // A cyclist riding across the pavement the car is about to enter (the examiner's high l): seen coming, not
      // only once inside, so the car waits at the line instead of meeting it in the crossing.
      const cyclistComing = snapshot.poses.some((pose) => {
        if (pose.kind !== 'bicycle' || !across(pose.headingRad, vehicle.headingRad)) return false;
        const before = lastSeen.get(pose.id);
        const speed = before ? distance(before, pose) / SIM_STEP_S : 0;
        const pullingAway = vehicle.speedMps < PULL_AWAY_MPS;
        const reachesM = pullingAway
          ? [...CYCLIST_PULL_AWAY_HORIZON_S.map((seconds) => speed * seconds), ...CYCLIST_NEAR_STEPS_M]
          : CYCLIST_HORIZON_S.map((seconds) => speed * seconds);
        return reachesM.some((metres) => crossing.conflicts.some((box) => overlaps(projected(pose, metres), box)));
      });
      // Turning across the cycle track: cyclists riding straight on, beside or behind on the side of the turn, go first.
      const cyclistAlongside =
        crossing.corner !== null &&
        snapshot.poses.some((pose) => {
          if (pose.kind !== 'bicycle' || Math.abs(headingDifference(pose.headingRad, vehicle.headingRad)) > Math.PI / 4)
            return false;
          const dx = pose.x - body.centerX;
          const dz = pose.z - body.centerZ;
          const along = dx * Math.sin(vehicle.headingRad) + dz * Math.cos(vehicle.headingRad);
          const left = dx * Math.cos(vehicle.headingRad) - dz * Math.sin(vehicle.headingRad);
          const side = crossing.corner?.turn === 'left' ? left : -left;
          const onTurnSide = side > 1 && side < CYCLIST_LATERAL_M;
          return onTurnSide && along > -CYCLIST_BEHIND_M && along < body.halfLengthM + CYCLIST_AHEAD_M;
        });
      if (crossing.rule === 'stop' && options.stopAtStops !== false && clearedStop !== crossing.approachId) {
        wanted = Math.min(wanted, toStop(distanceM));
        // The way must be clear before leaving the STOP: nobody crossing and nobody arriving from the right.
        if (
          vehicle.speedMps === 0 &&
          distanceM <= 3 &&
          stoppedS >= STOP_WAIT_S &&
          !inside &&
          !fromRight &&
          !cyclistComing &&
          !cyclistAlongside
        )
          clearedStop = crossing.approachId;
      } else if (
        options.yieldPriority !== false &&
        crossing.rule !== 'signal' &&
        distanceM > -1 &&
        // Past the line, only a vehicle actually crossing stops the car: standing inside blocks the crossing.
        (inside ||
          (distanceM >= 0 && (cyclistComing || cyclistAlongside || (crossing.rule === 'priority' && fromRight))))
      )
        wanted = Math.min(wanted, toStop(distanceM >= 0 && cyclistComing ? distanceM - CYCLIST_ROOM_M : distanceM));
      if (
        options.slowAtCorners !== false &&
        (crossing.corner || crossing.rule !== 'signal') &&
        distanceM < CORNER_SLOW_M
      )
        wanted = Math.min(wanted, CORNER_MPS);
      // Someone on a crosswalk beyond the crossing: wait at the line rather than inside the intersection.
      const exitOccupied = circuit.crosswalks.some((crosswalk) => {
        const toCrosswalk = distanceAlong(circuit, frontS, crosswalk.startS);
        if (toCrosswalk <= distanceM || toCrosswalk > distanceM + EXIT_CROSSWALK_M) return false;
        return someoneOn(snapshot, crosswalk.box);
      });
      if (options.yieldCrosswalks !== false && distanceM >= 0 && exitOccupied)
        wanted = Math.min(wanted, toStop(distanceM));
      if (options.signalTurns !== false && crossing.corner && distanceM < SIGNAL_M && distanceM > -2) {
        if (driver.cockpit.signal !== crossing.corner.turn)
          driver.cabin({ type: 'signal', value: crossing.corner.turn });
      } else if (options.signalTurns !== false && driver.cockpit.signal !== 'off' && distanceM > SIGNAL_M + 5)
        driver.cabin({ type: 'signal', value: 'off' });
    }
    // Someone on the next crosswalk, or at its kerb about to step off (the driver sees them; the box does not).
    const nextBox = circuit.crosswalks.find((item) => item.id === view.crosswalk?.crosswalkId)?.box;
    const nextOccupied =
      view.crosswalk !== null && (view.crosswalk.occupied || (nextBox !== undefined && someoneOn(snapshot, nextBox)));
    if (view.crosswalk && nextOccupied && options.yieldCrosswalks !== false) {
      // The lap distance jumps on corner links: the straight-line distance to the crosswalk is checked too.
      const box = nextBox;
      const front = {
        x: body.centerX + Math.sin(vehicle.headingRad) * body.halfLengthM,
        z: body.centerZ + Math.cos(vehicle.headingRad) * body.halfLengthM,
      };
      const straight = box ? distance(front, { x: box.centerX, z: box.centerZ }) - box.halfLengthM : Infinity;
      const toCrosswalk = Math.min(view.crosswalk.distanceM, straight);
      wanted = Math.min(wanted, toStop(Math.max(0, toCrosswalk - 2.5)));
      // Precautionary speed (the examiner's minor o): under 20 km/h near a crosswalk with someone on it.
      if (toCrosswalk < PRECAUTION_M) wanted = Math.min(wanted, PRECAUTION_MPS);
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
      // Make way until it has passed the whole body, as the examiner judges it (D6), not only while it is behind.
      const passedM = body.halfLengthM + ambulance.box.halfLengthM + 1;
      if (along < passedM && along > -80) wanted = Math.min(wanted, 2.2);
    }
    for (const bump of circuit.bumps) {
      const distanceM = distanceAlong(circuit, frontS, bump.s);
      if (options.slowAtBumps !== false && distanceM > -2 && distanceM < 15) wanted = Math.min(wanted, 4);
    }
    for (const pose of snapshot.poses) lastSeen.set(pose.id, { x: pose.x, z: pose.z });
    // With the wheel turned, no faster than the lateral acceleration allows (kinematic bicycle, as the examiner).
    const turn = Math.abs(Math.tan(vehicle.steerRad));
    if (turn > 0.05) wanted = Math.min(wanted, Math.sqrt((CORNER_LATERAL_MPS2 * EXAM_CAR.wheelbaseM) / turn));
    if (options.speed) wanted = options.speed(driver, wanted);
    const speed = vehicle.speedMps;
    if (!automatic) shiftManual(driver, speed, wanted, steer);
    let controls: CarControls;
    if (wanted > speed + 0.15) controls = { ...IDLE, steer, throttle: Math.min(0.9, 0.2 + (wanted - speed) * 0.5) };
    else if (wanted < speed - 0.15)
      controls = { ...IDLE, steer, brake: Math.min(1, (speed - wanted) * 0.6 + (wanted < 1 ? 0.35 : 0)) };
    else controls = { ...IDLE, steer, throttle: wanted > 0 ? 0.12 : 0, brake: wanted > 0 ? 0 : 0.5 };
    if (!automatic) {
      // Clutch down when slowing to a crawl (no stall); at the biting point with some throttle when pulling away.
      if (wanted <= speed && speed < MANUAL_CLUTCH_DOWN_MPS) controls = { ...controls, clutch: 1 };
      else if (wanted > Math.max(speed + 0.5, MANUAL_PULL_AWAY_MPS) && speed < MANUAL_PULL_AWAY_MPS)
        controls = { ...controls, clutch: 0.68, throttle: Math.max(controls.throttle, 0.35), brake: 0 };
    }
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

/**
 * Stage III fixtures: the double-file stop beside the bay, the reverse in two arcs, the positioning and the
 * descent, each with the lawful behaviour that a test can switch off to produce the faulty case.
 */
export interface ParkingOptions {
  /** Hazards on from the corner (lawful), switched on only 1 s before the stop, or never. */
  hazards?: 'early' | 'late' | 'never';
  /** Glance at the right mirror at the double-file stop and while reversing (lawful), or not at the stop. */
  look?: boolean;
  /** Lateral target of the body's centre in the bay's frame: 0 lands at 20 cm from the kerb. */
  targetLeftM?: number;
  /** Along target of the body's centre in the bay's frame, reached with the forward positioning. */
  targetAlongM?: number;
  /** Abort the reverse once the centre is this far into the bay, pull out and align again, this many times. */
  retries?: number;
}

/** Turning radius of the rear axle at full lock (kinematic bicycle). */
const LOCK_RADIUS_M = EXAM_CAR.wheelbaseM / Math.tan(EXAM_CAR.maxSteerRad);
/** Double file: this far right of the lap line (next to the bay, not in the middle of the 8,8 m street). */
const DOUBLE_FILE_LATERAL_M = -0.5;
/** The wheel takes a moment to reach full lock: the reverse starts a little further ahead. */
const REVERSE_START_MARGIN_M = 0.3;
/** The reverse ends this far behind the along target; the forward positioning covers the rest. */
const REVERSE_END_ALONG_M = -0.9;
/** The two arcs end slightly right of where the kinematic plan says (steering lag): aim a little left. */
const LATERAL_BIAS_M = 0.1;
/** Time to turn the wheel from one lock to the other while standing still, between the two arcs. */
const RELOCK_S = 1.3;
/** Nobody this close behind, ahead or beside before pulling out into the lane. */
const GAP_BEHIND_M = 35;
const GAP_AHEAD_M = 10;
const GAP_LATERAL_M = 6;
const GAP_STANDING_M = 3;
/** A retried attempt is aborted this far into the bay: nearly in, with the nose out of the lane so traffic passes. */
const ABORT_AT_LEFT_M = 0.35;
/** Walking pace of the manoeuvre, regulated in slices. */
const CREEP_MPS = 0.5;
const CREEP_SLICE_S = 0.05;

const centreInBay = (driver: Driver, bay: ParkingBay) => {
  const body = bodyBox(EXAM_CAR, driver.car.world.vehicle);
  return bayFrame(bay, { x: body.centerX, z: body.centerZ });
};

/**
 * Creeps at walking pace in the current gear with the wheel where asked: the clutch slips at the biting point
 * (manual) or the converter creeps (automatic), and is let go, or the brake touched, above the creeping speed.
 */
function creep(driver: Driver, steer: number, until: (car: CarState) => boolean, maxS = 30): void {
  for (let t = 0; t < maxS; t += CREEP_SLICE_S) {
    if (until(driver.car)) return;
    const slow = Math.abs(driver.car.world.vehicle.speedMps) < CREEP_MPS;
    const pedals =
      driver.kind === 'manual' ? { ...IDLE, clutch: slow ? 0.68 : 1 } : { ...IDLE, brake: slow ? 0.05 : 0.3 };
    driver.hold({ ...pedals, steer }, (_, elapsed) => elapsed >= CREEP_SLICE_S, 1);
  }
  throw new Error(`creep: condition not met in ${maxS} s`);
}

function stopNow(driver: Driver): void {
  driver.hold({ ...IDLE, brake: 1, clutch: 1 }, (car) => car.world.vehicle.speedMps === 0, 10);
  driver.hold({ ...IDLE, brake: 1, clutch: 1 }, (_, t) => t > 0.6, 5);
}

function engage(driver: Driver, gear: 'R' | 'forward'): void {
  const to = gear === 'R' ? 'R' : driver.kind === 'manual' ? '1' : 'D';
  driver.hold(driver.kind === 'manual' ? { ...IDLE, clutch: 1 } : { ...IDLE, brake: 1 }, (_, t) => t > 0.1);
  driver.drive({ type: 'shift', to }, { type: 'handbrake', engaged: false });
}

/**
 * From the corner into Quesada (phase `parking`), drives slowly to the double-file position, 5,5 m ahead of the
 * bay's centre in the lane, with the hazards as asked, and stops.
 */
export function stopInDoubleFile(exam: CityExam, options: ParkingOptions = {}): void {
  const { driver, circuit } = exam;
  const { bay } = circuit;
  const startAlongM = (d: Driver) => reverseStartAlongM(d, bay, options);
  const hazards = (on: boolean) => {
    if (driver.cockpit.hazards !== on) driver.cabin({ type: 'toggle', control: 'hazards' });
  };
  // The recognition round left the hazards on: from here they are deliberate.
  hazards(options.hazards !== 'late' && options.hazards !== 'never');
  cruise(exam, {
    until: (d) => centreInBay(d, bay).alongM >= startAlongM(d) - 0.3,
    maxS: 60,
    lateralM: DOUBLE_FILE_LATERAL_M,
    speed: (d) => (centreInBay(d, bay).alongM > startAlongM(d) - 6 ? 1.2 : 2.5),
  });
  if (options.hazards === 'late') hazards(true);
  stopNow(driver);
  if (options.look !== false) {
    driver.cabin({ type: 'look', yaw: -0.5, pitch: 0 });
    driver.cabin({ type: 'look', yaw: 0, pitch: 0 });
  }
}

/**
 * Two arcs at full lock in reverse: wheel to the right (the tail goes to the kerb, the nose swings left, so the
 * heading grows) until it has swung enough, then wheel to the left back to the kerb's heading.
 */
function reverseIn(driver: Driver, bay: ParkingBay, targetLeftM: number, abortAtLeftM: number | null): void {
  const heading0 = bay.headingRad;
  const lateral = centreInBay(driver, bay).leftM - targetLeftM - LATERAL_BIAS_M;
  const swing = Math.acos(Math.max(-1, 1 - lateral / (2 * LOCK_RADIUS_M)));
  engage(driver, 'R');
  creep(driver, -1, (car) => headingDifference(car.world.vehicle.headingRad, heading0) >= swing);
  // A pause in the same direction is not a manoeuvre: the wheel goes to the other lock while standing still, and the
  // driver checks the right mirror again during the reverse (protocolo PDF 13).
  driver.cabin({ type: 'look', yaw: -0.5, pitch: 0 });
  driver.cabin({ type: 'look', yaw: 0, pitch: 0 });
  driver.hold(
    { ...IDLE, brake: 1, clutch: 1, steer: 1 },
    (car, t) => car.world.vehicle.speedMps === 0 && t > RELOCK_S,
    5,
  );
  creep(
    driver,
    1,
    (car) =>
      headingDifference(car.world.vehicle.headingRad, heading0) <= 0.02 ||
      (abortAtLeftM !== null && centreInBay(driver, bay).leftM <= abortAtLeftM),
  );
  stopNow(driver);
}

/** Where the reverse (two arcs at full lock) starts so that the S-curve from the current lateral offset ends centred. */
function reverseStartAlongM(driver: Driver, bay: ParkingBay, options: ParkingOptions): number {
  const lateral = centreInBay(driver, bay).leftM - (options.targetLeftM ?? 0) - LATERAL_BIAS_M;
  const swing = Math.acos(Math.max(-1, 1 - lateral / (2 * LOCK_RADIUS_M)));
  const end = (options.targetAlongM ?? 0) + REVERSE_END_ALONG_M;
  return end + 2 * LOCK_RADIUS_M * Math.sin(swing) + REVERSE_START_MARGIN_M;
}

/** Waits, braked, until no vehicle is coming up behind or alongside: a careful driver looks before pulling out. */
function waitForGap(driver: Driver): void {
  driver.hold(
    { ...IDLE, brake: 1, clutch: 1 },
    (car, t) => {
      if (t < 0.5) return false;
      const { x, z, headingRad } = car.world.vehicle;
      const forward = { x: Math.sin(headingRad), z: Math.cos(headingRad) };
      const left = { x: Math.cos(headingRad), z: -Math.sin(headingRad) };
      const snapshot = driver.scenario;
      const speedOf = (id: string) =>
        isTrafficState(snapshot) ? (snapshot.vehicles.find((item) => item.id === id)?.speedMps ?? 0) : 1;
      return !(snapshot?.poses ?? []).some((pose) => {
        if (pose.kind === 'pedestrian') return false;
        const dx = pose.x - x,
          dz = pose.z - z;
        const along = dx * forward.x + dz * forward.z;
        const lateral = dx * left.x + dz * left.z;
        // A vehicle already waiting behind the car is no threat to a pull-out; a moving one is.
        if (along < -GAP_STANDING_M && speedOf(pose.id) < 0.3) return false;
        return along > -GAP_BEHIND_M && along < GAP_AHEAD_M && Math.abs(lateral) < GAP_LATERAL_M;
      });
    },
    60,
  );
}

/** Pulls forward out of the bay at full left lock until the body's centre is back in the lane, and straightens. */
function pullOut(driver: Driver, bay: ParkingBay, options: ParkingOptions): void {
  waitForGap(driver);
  engage(driver, 'forward');
  creep(driver, 1, () => centreInBay(driver, bay).leftM >= 2.2);
  creep(driver, -1, (car) => headingDifference(car.world.vehicle.headingRad, bay.headingRad) <= 0.05);
  creep(driver, 0, () => centreInBay(driver, bay).alongM >= reverseStartAlongM(driver, bay, options) - 0.1);
  stopNow(driver);
  driver.cabin({ type: 'look', yaw: -0.5, pitch: 0 });
  driver.cabin({ type: 'look', yaw: 0, pitch: 0 });
}

/** Reverses into the bay (with the retries asked), positions forward to the along target and stops. */
export function parkInTheBay(exam: CityExam, options: ParkingOptions = {}): void {
  const { driver, circuit } = exam;
  const { bay } = circuit;
  const targetLeftM = options.targetLeftM ?? 0;
  for (let retry = 0; retry < (options.retries ?? 0); retry++) {
    reverseIn(driver, bay, targetLeftM, ABORT_AT_LEFT_M);
    pullOut(driver, bay, options);
  }
  reverseIn(driver, bay, targetLeftM, null);
  const targetAlongM = options.targetAlongM ?? 0;
  if (centreInBay(driver, bay).alongM < targetAlongM - 0.05) {
    engage(driver, 'forward');
    creep(driver, 0, () => centreInBay(driver, bay).alongM >= targetAlongM - 0.05);
    stopNow(driver);
  }
}

export interface DescentOptions {
  gear?: boolean;
  handbrake?: boolean;
  lights?: boolean;
  engine?: boolean;
  key?: boolean;
  mirror?: boolean;
}

/** Says the parking is done, then leaves the car as the protocol asks (each step can be skipped), and opens the door. */
export function descend(driver: Driver, options: DescentOptions = {}): void {
  driver.ready();
  driver.hold({ ...IDLE, brake: 1, clutch: 1 }, (_, t) => t > 0.1);
  if (driver.phase !== 'leaving') return;
  if (options.gear !== false) {
    driver.hold(driver.kind === 'manual' ? { ...IDLE, clutch: 1 } : { ...IDLE, brake: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: driver.kind === 'manual' ? 'N' : 'P' });
  }
  if (options.handbrake !== false) driver.drive({ type: 'handbrake', engaged: true });
  if (options.lights !== false) driver.cabin({ type: 'lights', value: 'off' });
  if (options.engine !== false) driver.drive({ type: 'turn-key', to: 'off' });
  if (options.key !== false) driver.drive({ type: 'remove-key' });
  if (options.mirror !== false) {
    driver.cabin({ type: 'look', yaw: 0.5, pitch: 0 });
    driver.cabin({ type: 'look', yaw: 0, pitch: 0 });
  }
  driver.cabin({ type: 'toggle', control: 'door' });
  driver.hold(IDLE, (_, t) => t > 0.1);
}

/** Moves the parked car along the kerb by `metres` (negative in reverse) at creeping pace and stops. */
export function nudge(driver: Driver, bay: ParkingBay, metres: number): void {
  const from = centreInBay(driver, bay).alongM;
  engage(driver, metres < 0 ? 'R' : 'forward');
  creep(driver, 0, () =>
    metres < 0 ? centreInBay(driver, bay).alongM <= from + metres : centreInBay(driver, bay).alongM >= from + metres,
  );
  stopNow(driver);
}

/** Backs up fast and straight from where the car stands, until `until` holds or the car is stopped by a contact. */
export function reverseHard(driver: Driver, until: (car: CarState) => boolean): void {
  engage(driver, 'R');
  const pedals = driver.kind === 'manual' ? { ...IDLE, clutch: 0.5, throttle: 0.5 } : { ...IDLE, throttle: 0.4 };
  driver.hold(pedals, (car, t) => until(car) || (t > 0.5 && car.world.vehicle.speedMps === 0), 10);
}
