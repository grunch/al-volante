import { describe, expect, it } from 'vitest';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { FIRST_BLOCK, FIRST_BLOCK_START, FIRST_BLOCK_ZONES } from '../sim/tracks/firstBlock.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';
import type { Course } from './session.ts';
import { Driver, IDLE } from '../test/examDriver.ts';
import type { CarControls, CarState } from '../sim/car.ts';

const { stopLineZ, crosswalk, intersection } = FIRST_BLOCK_ZONES;

/** A driver on the first block who has already left the box and is straight in the lane. */
/** The first block without kerbs, fronts or avenue, and its corner 300 m further: room for speed episodes. */
const LONG_BLOCK: World = {
  surface: FIRST_BLOCK.surface,
  obstacles: FIRST_BLOCK.obstacles.filter((obstacle) => obstacle.kind === 'pole'),
  markings: FIRST_BLOCK.markings ?? [],
};
const LONG_COURSE = {
  ...FIRST_BLOCK_ZONES,
  stopLineZ: FIRST_BLOCK_ZONES.stopLineZ + 300,
  crosswalk: { ...FIRST_BLOCK_ZONES.crosswalk, centerZ: FIRST_BLOCK_ZONES.crosswalk.centerZ + 300 },
  intersection: { ...FIRST_BLOCK_ZONES.intersection, centerZ: FIRST_BLOCK_ZONES.intersection.centerZ + 300 },
};

function inTheLane(kind: TransmissionKind, world: World = FIRST_BLOCK, course: Course = FIRST_BLOCK_ZONES): Driver {
  const driver = new Driver(kind, 7, world, FIRST_BLOCK_START, course);
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
  expect(driver.phase).toBe('firstMetres');
  // Manual: pull away in first and get rolling; the tests then choose the gear.
  if (kind === 'manual') {
    driver.hold({ ...IDLE, clutch: 0.7, throttle: 0.4 }, (car) => car.world.vehicle.speedMps > 0.3, 5);
    driver.hold({ ...IDLE, clutch: 0.6, throttle: 0.5 }, (car) => car.world.vehicle.speedMps > 1.5, 8);
  }
  return driver;
}

const frontZ = (driver: Driver) => {
  const body = bodyBox(EXAM_CAR, driver.car.world.vehicle);
  return body.centerZ + body.halfLengthM;
};
const pedestrianOnCrosswalk = (driver: Driver) =>
  driver.scenario?.poses.some((pose) => pose.kind === 'pedestrian' && pose.active && pose.inside(crosswalk)) ?? false;

const LANE_X = -1.55;
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** Keeps the car centred in the lane with a little proportional steering, as a steady driver would. */
function laneKeeping(
  driver: Driver,
  controls: CarControls,
  until: (car: CarState, t: number) => boolean,
  maxS: number,
) {
  let elapsed = 0;
  while (elapsed < maxS) {
    const { x, headingRad } = driver.car.world.vehicle;
    const steer = clamp(-2 * headingRad - 0.08 * (x - LANE_X), 0.3);
    driver.hold({ ...controls, steer }, (car, t) => t >= 0.25 || until(car, elapsed + t), 1);
    elapsed += 0.25;
    if (until(driver.car, elapsed)) return;
  }
  throw new Error(`condition not met in ${maxS} s`);
}

/** Automatic, in D at a steady throttle, until the car reaches `z`. */
function cruiseTo(driver: Driver, z: number, throttle = 0.2) {
  laneKeeping(driver, { ...IDLE, throttle }, (car) => car.world.vehicle.z >= z, 60);
}

function stopNow(driver: Driver) {
  driver.hold({ ...IDLE, brake: 1 }, (car) => car.world.vehicle.speedMps === 0, 10);
}

/** Through the first 100 m in D and up to 12 m before the stop line, signalling right 40 m before the corner. */
function approachTheCorner(driver: Driver): Driver {
  cruiseTo(driver, 60);
  expect(driver.phase).toBe('firstMetres');
  cruiseTo(driver, stopLineZ - 40);
  driver.cabin({ type: 'signal', value: 'right' });
  cruiseTo(driver, stopLineZ - 12, 0.12);
  expect(driver.phase).toBe('approach');
  return driver;
}

function waitForGreen(driver: Driver) {
  driver.hold({ ...IDLE, brake: 1 }, () => driver.scenario?.light === 'green' && !pedestrianOnCrosswalk(driver), 90);
}

function turnRightAndGo(driver: Driver) {
  const nearEdgeZ = intersection.centerZ - intersection.halfLengthM;
  laneKeeping(driver, { ...IDLE, throttle: 0.12 }, (car) => car.world.vehicle.z >= nearEdgeZ + 1, 30);
  driver.hold({ ...IDLE, throttle: 0.1, steer: -1 }, (car) => car.world.vehicle.headingRad <= -1.5, 30);
  driver.hold({ ...IDLE, throttle: 0.2 }, (car) => car.world.vehicle.x <= FIRST_BLOCK_ZONES.turnDoneX, 60);
}

describe('first 100 m (protocolo PDF 11, 31)', () => {
  it('automatic: covers them in D under 30 km/h without faults, then the examiner moves on to the corner', () => {
    const driver = inTheLane('automatic');

    cruiseTo(driver, 60);
    expect(driver.phase).toBe('firstMetres');
    cruiseTo(driver, 110);

    expect(driver.phase).toBe('approach');
    expect(driver.faults).toEqual([]);
    expect(driver.session.measurements.firstMetresTopKmh).toBeLessThan(31);
    expect(driver.session.measurements.firstMetresTopKmh).toBeGreaterThan(10);
  });

  it('automatic: going faster than 30 km/h ignores the first-block instruction (eliminatory g, once)', () => {
    const driver = inTheLane('automatic');

    laneKeeping(driver, { ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps * 3.6 > 33, 30);

    expect(driver.faults).toEqual(['rule.eliminatory.g-first-block-instruction']);
    expect(driver.session.ledger.interruption?.cause).toBe('fault');
  });

  it('manual: staying in first above 15 km/h ignores the instruction to drive in second', () => {
    const driver = inTheLane('manual');

    laneKeeping(driver, { ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps * 3.6 > 17, 30);

    expect(driver.faults).toEqual(['rule.eliminatory.g-first-block-instruction']);
  });
});

describe('the corner of Av. Cabildo (protocolo PDF 12)', () => {
  it('stopping before the line, waiting for green and the pedestrian, signalling early and turning right scores nothing', () => {
    const driver = approachTheCorner(inTheLane('automatic'));
    stopNow(driver);
    expect(frontZ(driver)).toBeLessThan(stopLineZ);

    waitForGreen(driver);
    turnRightAndGo(driver);

    expect(driver.faults).toEqual([]);
    expect(driver.phase).toBe('finished');
    expect(driver.session.ledger.interruption).toBeNull();
  });

  it('crossing the stop line on red eliminates and interrupts', () => {
    const driver = approachTheCorner(inTheLane('automatic'));
    stopNow(driver);
    driver.hold({ ...IDLE, brake: 1 }, () => driver.scenario?.light === 'red', 60);

    laneKeeping(driver, { ...IDLE, throttle: 0.15 }, () => frontZ(driver) >= stopLineZ + 0.5, 20);

    expect(driver.faults).toEqual(['rule.eliminatory.k-red-light']);
    expect(driver.session.ledger.interruption?.cause).toBe('fault');
  });

  it('stopping past the line scores a high fault, once per stop', () => {
    const driver = approachTheCorner(inTheLane('automatic'));
    stopNow(driver);
    waitForGreen(driver);

    laneKeeping(driver, { ...IDLE, throttle: 0.1 }, () => frontZ(driver) >= stopLineZ + 0.4, 20);
    stopNow(driver);
    driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.5);

    expect(driver.faults).toEqual(['rule.high.h-stop-over-line-or-crosswalk']);
  });

  it('turning without the signal, or signalling too late, is a fault of its own', () => {
    const quiet = inTheLane('automatic');
    cruiseTo(quiet, stopLineZ - 12);
    stopNow(quiet);
    waitForGreen(quiet);
    laneKeeping(quiet, { ...IDLE, throttle: 0.12 }, () => frontZ(quiet) >= stopLineZ + 0.5, 20);
    expect(quiet.faults).toEqual(['rule.low.g-no-turn-signal']);
    expect(quiet.phase).toBe('approach');

    const late = inTheLane('automatic');
    cruiseTo(late, stopLineZ - 12);
    stopNow(late);
    late.cabin({ type: 'signal', value: 'right' });
    waitForGreen(late);
    laneKeeping(late, { ...IDLE, throttle: 0.12 }, () => frontZ(late) >= stopLineZ + 0.5, 20);
    expect(late.faults).toEqual(['rule.minor.q-turn-lane-late']);
  });

  it('a signal switched off before the corner counts as no signal', () => {
    const driver = inTheLane('automatic');
    cruiseTo(driver, 60);
    driver.cabin({ type: 'signal', value: 'right' });
    cruiseTo(driver, stopLineZ - 40);
    driver.cabin({ type: 'signal', value: 'off' });
    cruiseTo(driver, stopLineZ - 12, 0.12);
    stopNow(driver);
    waitForGreen(driver);

    laneKeeping(driver, { ...IDLE, throttle: 0.12 }, () => frontZ(driver) >= stopLineZ + 0.5, 20);

    expect(driver.faults).toEqual(['rule.low.g-no-turn-signal']);
  });

  it('after the first 100 m, over 30 km/h but under the road maximum is the exam-speed fault, not the eliminatory one', () => {
    const driver = inTheLane('automatic');
    cruiseTo(driver, 60);
    cruiseTo(driver, 106);
    expect(driver.phase).toBe('approach');

    laneKeeping(driver, { ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps * 3.6 > 33, 20);
    stopNow(driver);

    expect(driver.faults[0]).toBe('rule.high.f-exam-speed-exceeded');
    expect(driver.faults).not.toContain('rule.eliminatory.l-road-speed-limit-exceeded');
  });

  it('an exceeding that reaches the road maximum keeps only the eliminatory fault, and a corrected one opens a new episode', () => {
    // The real block leaves 21 m between the end of the first 100 m and the line: a longer, open one for this.
    const driver = inTheLane('automatic', LONG_BLOCK, LONG_COURSE);
    cruiseTo(driver, 60);
    cruiseTo(driver, 104);
    expect(driver.phase).toBe('approach');

    // Over the exam limit, back under it, over it again: two episodes of the exam-speed fault (D3).
    laneKeeping(driver, { ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps * 3.6 > 33, 20);
    laneKeeping(driver, { ...IDLE, brake: 0.3 }, (car) => car.world.vehicle.speedMps * 3.6 < 28, 20);
    laneKeeping(driver, { ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps * 3.6 > 33, 20);
    expect(driver.faults).toEqual(['rule.high.f-exam-speed-exceeded', 'rule.high.f-exam-speed-exceeded']);

    // The same episode goes on past the road maximum: its exam-speed fault is replaced by the eliminatory one (D2).
    laneKeeping(driver, { ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps * 3.6 > 42, 20);

    expect(driver.faults).toEqual(['rule.high.f-exam-speed-exceeded', 'rule.eliminatory.l-road-speed-limit-exceeded']);
    expect(driver.session.ledger.points).toBe(11);

    // Easing off to 35 km/h is still the same episode: the exam-speed fault does not come back.
    laneKeeping(driver, { ...IDLE, brake: 0.3 }, (car) => car.world.vehicle.speedMps * 3.6 < 36, 20);
    laneKeeping(driver, { ...IDLE, throttle: 0.3 }, (_, t) => t > 1, 5);

    expect(driver.faults).toEqual(['rule.high.f-exam-speed-exceeded', 'rule.eliminatory.l-road-speed-limit-exceeded']);
  });

  it('driving onto the crosswalk while the pedestrian is on it does not yield; hitting them is eliminatory', () => {
    // Wait for the green just before the pedestrian's trigger, then go: the pedestrian steps off as the car moves.
    const driver = inTheLane('automatic');
    cruiseTo(driver, stopLineZ - 35);
    stopNow(driver);
    driver.cabin({ type: 'signal', value: 'right' });
    driver.hold({ ...IDLE, brake: 1 }, () => driver.scenario?.light === 'green', 60);

    laneKeeping(
      driver,
      { ...IDLE, throttle: 0.4 },
      () => driver.phase === 'finished' || frontZ(driver) > stopLineZ + 4,
      20,
    );

    expect(driver.faults).toEqual(['rule.high.l-yield-to-pedestrians-cyclists']);
    const hit = driver.scenario?.touching.includes('pedestrian') || driver.phase === 'finished';
    if (hit) {
      // Entering the crosswalk scored the fault; hitting the pedestrian raised that same fault to eliminatory.
      expect(driver.session.ledger.faults[0]).toMatchObject({ points: 8, escalated: true });
      expect(driver.session.ledger.interruption?.cause).toBe('fault');
    }
  });

  it('going straight through instead of turning ignores the examiner', () => {
    const driver = approachTheCorner(inTheLane('automatic'));
    stopNow(driver);
    waitForGreen(driver);
    laneKeeping(driver, { ...IDLE, throttle: 0.15 }, (car) => car.world.vehicle.z > intersection.centerZ + 3, 60);

    expect(driver.faults).toEqual(['rule.eliminatory.f-examiner-safety-instruction-ignored']);
  });
});
