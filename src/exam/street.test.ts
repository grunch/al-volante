import { describe, expect, it } from 'vitest';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import type { ActorKind, ActorPose, TrafficSnapshot } from '../sim/scenario.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import { CITY, cityExam, cruise, placeOnLeg, throughTheBox } from '../test/circuitDriver.ts';
import type { CityExam } from '../test/circuitDriver.ts';
import { IDLE } from '../test/examDriver.ts';
import type { Driver } from '../test/examDriver.ts';
import { pointAlong } from '../traffic/network.ts';
import { ACTOR_SIZES } from '../traffic/traffic.ts';
import { distanceAlong } from './circuit.ts';
import type { CircuitCrossing } from './circuit.ts';

/**
 * The circuit judged with the real car, cabin, seeded traffic and examiner: a scripted driver leaves the box of
 * leg 1 and drives route A. Stage I and the box are judged once and every case branches from there.
 */
let afterTheBox: CityExam | null = null;
let afterTheFirstMetres: CityExam | null = null;
/** Fresh out of the box: the first 100 m begin. */
function outOfTheBox(): CityExam {
  if (!afterTheBox) {
    afterTheBox = cityExam('automatic', 1);
    throughTheBox(afterTheBox.driver);
  }
  return { ...afterTheBox, driver: afterTheBox.driver.clone() };
}
/** Past the first 100 m of Quesada, still rolling lawfully towards the corner: the circulation is judged. */
function inCirculation(): CityExam {
  if (!afterTheFirstMetres) {
    afterTheFirstMetres = outOfTheBox();
    cruise(afterTheFirstMetres, { until: (driver) => driver.phase !== 'firstMetres', maxS: 60 });
    expect(afterTheFirstMetres.driver.phase).toBe('circulation');
    expect(afterTheFirstMetres.driver.faults).toEqual([]);
  }
  return { ...afterTheFirstMetres, driver: afterTheFirstMetres.driver.clone() };
}

const kmh = (driver: Driver) => Math.abs(driver.car.world.vehicle.speedMps) * 3.6;
/** Distance from the front bumper to a stop line, as the examiner last measured it; infinite before the first step. */
const toLine = (exam: CityExam, crossing: CircuitCrossing) => {
  const frontS = exam.driver.session.street.previousFrontS;
  return frontS === null ? Infinity : distanceAlong(exam.circuit, frontS, crossing.lineS);
};
const corner = (exam: CityExam, leg: number) =>
  exam.circuit.crossings.find((crossing) => crossing.leg === leg && crossing.corner !== null)!;
const stopNow = (driver: Driver) => driver.hold({ ...IDLE, brake: 1 }, (car) => car.world.vehicle.speedMps === 0, 10);

/**
 * Lawfully up to the first corner and stopped a couple of metres before its line, whatever the light says. With
 * the box of F04-T01 at 20 m of the leg, the first 100 m end just past this line: the corner is judged within them.
 */
function stoppedAtTheFirstCorner(): CityExam {
  const exam = outOfTheBox();
  const first = corner(exam, 1);
  cruise(exam, {
    until: (driver) => driver.car.world.vehicle.speedMps === 0 && toLine(exam, first) < 6,
    maxS: 150,
    speed: (_, wanted) => (toLine(exam, first) < 6.5 ? 0 : wanted),
  });
  expect(exam.driver.phase).toBe('firstMetres');
  expect(exam.driver.faults).toEqual([]);
  return exam;
}

function waitFor(exam: CityExam, light: 'red' | 'green') {
  exam.driver.hold({ ...IDLE, brake: 1 }, () => exam.driver.session.street.notice?.light === light, 60);
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

describe('the whole circuit (RECORRIDO.md §4; protocolo PDF 10–12)', () => {
  it('a lawful lap of the eight legs with the seeded traffic scores nothing, follows every instruction and completes stage II', () => {
    const exam = outOfTheBox();
    const { driver, circuit } = exam;
    const legs: number[] = [];
    const instructions: string[] = [];
    const limits = new Map<number, { examKmh: number; postedKmh: number | null }>();
    cruise(exam, {
      until: (d) => {
        const { street } = d.session;
        if (legs.at(-1) !== street.leg) legs.push(street.leg);
        const instruction = street.instruction ? `${street.instruction.turn}:${street.instruction.street}` : '';
        if (instructions.at(-1) !== instruction) instructions.push(instruction);
        if (street.road && !limits.has(street.leg)) limits.set(street.leg, street.road);
        // Back on leg 1 after leg 8, stage II is complete and the parking of stage III begins (F04-T04).
        return d.phase === 'parking';
      },
      maxS: 600,
    });

    expect(driver.faults).toEqual([]);
    expect(driver.session.ledger.interruption).toBeNull();
    expect(driver.session.completedStages).toEqual(['I', 'II']);
    expect(driver.session.prompt).toEqual({ kind: 'say', message: 'parking' });
    expect(driver.session.street.takeover).toBe(false);
    expect(legs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 1]);
    expect(instructions).toEqual([
      'right:Av. Cabildo',
      'right:Guayra',
      'right:Cuba',
      'left:Quesada',
      'right:Cuba',
      'right:Manuel Ugarte',
      'right:Vuelta de Obligado',
      'left:Quesada',
      'right:Av. Cabildo',
    ]);
    // Exam limit (30/45) and posted maximum (OSM, unconfirmed) are told apart per road.
    expect(limits.get(2)).toMatchObject({ examKmh: 45, postedKmh: 60 });
    expect(limits.get(3)).toMatchObject({ examKmh: 30, postedKmh: 40 });
    expect(limits.get(4)).toMatchObject({ examKmh: 30, postedKmh: 30 });
    expect(driver.session.timeS).toBeLessThan(600);
    expect(circuit.legs).toHaveLength(8);
  }, 300000);

  it('the first 100 m in D under 30 km/h hand over to the circulation; faster ignores the instruction (eliminatory g)', () => {
    const clean = inCirculation();
    expect(clean.driver.faults).toEqual([]);
    expect(clean.driver.session.measurements.firstMetresTopKmh).toBeLessThan(31);
    expect(clean.driver.session.measurements.firstMetresTopKmh).toBeGreaterThan(10);

    const fast = outOfTheBox();
    cruise(fast, { until: (driver) => kmh(driver) > 33, maxS: 30, speed: () => 12, slowAtCorners: false });
    expect(fast.driver.faults).toEqual(['rule.eliminatory.g-first-block-instruction']);
    expect(fast.driver.session.ledger.interruption?.cause).toBe('fault');
  }, 90000);

  it('keeps the 30 km/h instruction for the whole first 100 m, even once they reach Av. Cabildo (45 km/h)', () => {
    const exam = outOfTheBox();
    placeOnLeg(exam, 2, 20);
    expect(exam.driver.phase).toBe('firstMetres');
    cruise(exam, { until: (driver) => kmh(driver) > 34, maxS: 30, speed: () => 10, slowAtCorners: false });
    expect(exam.driver.session.street.road?.examKmh).toBe(45);
    expect(exam.driver.faults).toEqual(['rule.eliminatory.g-first-block-instruction']);
  }, 90000);

  it('manual: staying in first above 15 km/h in the first 100 m ignores the instruction to drive in second', () => {
    const exam = cityExam('manual', 1);
    throughTheBox(exam.driver, { secondGear: false });
    exam.driver.hold({ ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps * 3.6 > 17, 30);
    expect(exam.driver.faults).toEqual(['rule.eliminatory.g-first-block-instruction']);
  }, 90000);
});

describe('speed: exam limit against the posted maximum (REGLAS.md §6, D2 and D3)', () => {
  it('over 30 km/h on a street is the exam-speed fault; reaching the posted maximum keeps only the eliminatory one', () => {
    const exam = inCirculation();
    placeOnLeg(exam, 8, 8);
    const { driver } = exam;
    // Over the exam limit, back under it, over it again: two episodes of the exam-speed fault (D3).
    cruise(exam, { until: (d) => kmh(d) > 33, maxS: 30, speed: () => 10 });
    cruise(exam, { until: (d) => kmh(d) < 28, maxS: 30, speed: () => 7 });
    cruise(exam, { until: (d) => kmh(d) > 33, maxS: 30, speed: () => 10 });
    expect(driver.faults).toEqual(['rule.high.f-exam-speed-exceeded', 'rule.high.f-exam-speed-exceeded']);
    // The same episode goes on past the posted maximum (40): its exam-speed fault is replaced by the eliminatory one.
    cruise(exam, { until: (d) => kmh(d) > 42, maxS: 30, speed: () => 13 });
    expect(driver.faults).toEqual(['rule.high.f-exam-speed-exceeded', 'rule.eliminatory.l-road-speed-limit-exceeded']);
    expect(driver.session.ledger.points).toBe(11);
    expect(driver.session.ledger.interruption).toBeNull();
    expect(driver.phase).toBe('circulation');
  }, 90000);
});

describe('the corner of Av. Cabildo (protocolo PDF 12)', () => {
  it('crossing the stop line on red eliminates and interrupts', () => {
    const exam = stoppedAtTheFirstCorner();
    waitFor(exam, 'red');
    cruise(exam, {
      until: (driver) => driver.phase === 'finished' || toLine(exam, corner(exam, 1)) < -0.5,
      maxS: 20,
      obeyLights: false,
      speed: () => 3,
    });
    expect(exam.driver.faults).toEqual(['rule.eliminatory.k-red-light']);
    expect(exam.driver.session.ledger.interruption?.cause).toBe('fault');
  }, 90000);

  it('stopping past the line scores a high fault, once per stop', () => {
    const exam = stoppedAtTheFirstCorner();
    waitFor(exam, 'green');
    cruise(exam, { until: () => toLine(exam, corner(exam, 1)) < -0.5, maxS: 20, speed: () => 2 });
    stopNow(exam.driver);
    exam.driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.5);
    expect(exam.driver.faults).toEqual(['rule.high.h-stop-over-line-or-crosswalk']);
  }, 90000);

  it('standing on the avenue for two seconds blocks the intersection', () => {
    const exam = stoppedAtTheFirstCorner();
    waitFor(exam, 'green');
    const first = corner(exam, 1);
    cruise(exam, {
      until: (driver) => first.pavements.some((box) => overlaps(bodyBox(EXAM_CAR, driver.car.world.vehicle), box)),
      maxS: 20,
      speed: () => 3,
      slowAtCorners: false,
    });
    // Standing there with nothing to yield to (once any pedestrian ahead has finished crossing) blocks it.
    cruise(exam, { until: (driver, t) => driver.faults.length > 0 || t > 15, maxS: 20, speed: () => 0 });
    expect(exam.driver.faults).toEqual(['rule.high.i-block-intersection']);
  }, 90000);

  it('turning without the signal, with the wrong one, or signalling too late is a fault of its own', () => {
    const quiet = stoppedAtTheFirstCorner();
    quiet.driver.cabin({ type: 'signal', value: 'off' });
    waitFor(quiet, 'green');
    cruise(quiet, {
      until: () => toLine(quiet, corner(quiet, 1)) < -0.5,
      maxS: 20,
      signalTurns: false,
      speed: () => 3,
    });
    expect(quiet.driver.faults).toEqual(['rule.low.g-no-turn-signal']);

    const wrong = stoppedAtTheFirstCorner();
    wrong.driver.cabin({ type: 'signal', value: 'left' });
    waitFor(wrong, 'green');
    cruise(wrong, {
      until: () => toLine(wrong, corner(wrong, 1)) < -0.5,
      maxS: 20,
      signalTurns: false,
      speed: () => 3,
    });
    expect(wrong.driver.faults).toEqual(['rule.low.g-no-turn-signal']);

    const late = stoppedAtTheFirstCorner();
    late.driver.cabin({ type: 'signal', value: 'off' });
    late.driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.1);
    late.driver.cabin({ type: 'signal', value: 'right' });
    waitFor(late, 'green');
    cruise(late, { until: () => toLine(late, corner(late, 1)) < -0.5, maxS: 20, signalTurns: false, speed: () => 3 });
    expect(late.driver.faults).toEqual(['rule.minor.q-turn-lane-late']);
  }, 90000);

  it('going straight across the avenue instead of turning ignores the examiner', () => {
    const exam = stoppedAtTheFirstCorner();
    waitFor(exam, 'green');
    const heading = exam.driver.car.world.vehicle.headingRad;
    cruise(exam, {
      until: (driver) => driver.phase === 'finished',
      maxS: 15,
      speed: () => 4,
      slowAtCorners: false,
      steer: (driver) => -2 * (driver.car.world.vehicle.headingRad - heading),
    });
    expect(exam.driver.faults).toEqual(['rule.eliminatory.f-examiner-safety-instruction-ignored']);
  }, 90000);
});

describe('STOP signs and unsignalised corners (protocolo PDF 12)', () => {
  it('rolling through the STOP of Guayra and Cuba scores the sign fault; a full stop scores nothing', () => {
    const rolling = inCirculation();
    placeOnLeg(rolling, 3, 120);
    const stop = corner(rolling, 3);
    cruise(rolling, { until: () => toLine(rolling, stop) < -0.5, maxS: 40, stopAtStops: false, speed: () => 3.5 });
    expect(rolling.driver.faults).toEqual(['rule.high.j-stop-or-yield-sign']);

    const lawful = inCirculation();
    placeOnLeg(lawful, 3, 120);
    cruise(lawful, { until: () => toLine(lawful, corner(lawful, 3)) < -0.5, maxS: 60 });
    expect(lawful.driver.faults).toEqual([]);
    expect(lawful.driver.session.street.stoppedAt).toBe(stop.approachId);
  }, 90000);

  it('arriving fast at the unsignalised corner of Cuba and Quesada does not slow down for the manoeuvre', () => {
    const exam = inCirculation();
    placeOnLeg(exam, 4, 190);
    const turn = corner(exam, 4);
    cruise(exam, {
      until: () => toLine(exam, turn) < 6,
      maxS: 40,
      speed: () => 7,
      slowAtCorners: false,
      yieldPriority: false,
    });
    expect(exam.driver.faults).toContain('rule.high.m-no-slowdown-before-maneuver');
  }, 90000);
});

describe('the ambulance of Guayra (protocolo PDF 12; eliminatory n)', () => {
  it('scores keeping speed in the middle of the lane until it gives up; slowing or pulling right lets it through', () => {
    const stubborn = inCirculation();
    placeOnLeg(stubborn, 3, 10);
    cruise(stubborn, {
      until: (driver) => driver.faults.length > 0 || toLine(stubborn, corner(stubborn, 3)) < 20,
      maxS: 60,
      yieldToEmergency: false,
      cruiseMps: 6.5,
      // Slows for the crossing of Guayra as the rule asks, but never under the speed that would count as yielding.
      speed: (_, wanted) => Math.max(wanted, 4),
    });
    expect(stubborn.driver.faults).toEqual(['rule.eliminatory.n-emergency-vehicle-not-yielded']);
    expect(stubborn.driver.session.ledger.interruption).toBeNull();

    const polite = inCirculation();
    placeOnLeg(polite, 3, 10);
    let seen = false;
    cruise(polite, {
      until: (driver) => {
        seen ||= driver.session.street.notice?.kind === 'emergency';
        return seen && driver.session.street.emergency.judged;
      },
      maxS: 60,
    });
    expect(polite.driver.faults).toEqual([]);
    expect(polite.driver.session.street.emergency.yielded).toBe(true);
  }, 120000);
});

describe('the examiner takes the dual controls (protocolo PDF 7)', () => {
  const movingAt = (exam: CityExam, speedMps: number) => ({
    ...exam.driver.car,
    world: { ...exam.driver.car.world, vehicle: { ...exam.driver.car.world.vehicle, speedMps } },
  });
  const snapshotWith = (exam: CityExam, poses: ActorPose[], contacts: ActorKind[] = []): TrafficSnapshot => ({
    timeS: exam.driver.car.world.timeS,
    light: 'green',
    lights: {},
    poses,
    contacts,
  });

  it('an unavoidable contact ahead interrupts the exam as a reckless manoeuvre, by the examiner', () => {
    const exam = inCirculation();
    placeOnLeg(exam, 3, 100);
    const { driver } = exam;
    const ahead = pointAlong(exam.circuit.lap, exam.circuit.legs[2]!.startS + 100 + 4.3 + 4);
    const parked = poseAt('parked', 'vehicle', ahead.point.x, ahead.point.z, ahead.headingRad);
    for (let step = 0; step < 2; step++)
      driver.see({
        type: 'step',
        car: movingAt(exam, 8),
        cockpit: driver.cockpit,
        events: [],
        dt: SIM_STEP_S,
        scenario: snapshotWith(exam, [parked]),
      });
    expect(driver.phase).toBe('finished');
    expect(driver.faults).toEqual(['rule.eliminatory.i-reckless-maneuver']);
    expect(driver.session.ledger.interruption?.cause).toBe('examiner');
    expect(driver.session.street.takeover).toBe(true);
  });

  it('a parked-car contact triggers the same examiner intervention as moving traffic, only once', () => {
    const exam = inCirculation();
    placeOnLeg(exam, 3, 100);
    const observation = {
      type: 'step' as const,
      car: movingAt(exam, 3),
      cockpit: exam.driver.cockpit,
      events: [{ type: 'contact' as const, kind: 'vehicle' as const, obstacleId: 'parked-car', impactSpeedMps: 3 }],
      dt: SIM_STEP_S,
      scenario: snapshotWith(exam, []),
    };
    exam.driver.see(observation);
    exam.driver.see(observation);
    expect(exam.driver.faults).toEqual(['rule.eliminatory.i-reckless-maneuver']);
    expect(exam.driver.session.street.takeover).toBe(true);
    expect(exam.driver.session.ledger.interruption?.cause).toBe('examiner');
    expect(exam.driver.phase).toBe('finished');
  }, 30_000);

  it('hitting a pedestrian raises the yielding fault of that crosswalk to eliminatory; hitting a car is reckless', () => {
    const onFoot = inCirculation();
    const crosswalk = onFoot.circuit.crosswalks.find((item) => item.id === 'crosswalk-intersection-2:leg-3-1:exit')!;
    placeOnLeg(onFoot, 3, crosswalk.startS - onFoot.circuit.legs[2]!.startS - 1);
    const walker = poseAt('walker', 'pedestrian', crosswalk.box.centerX, crosswalk.box.centerZ, 0);
    const { driver } = onFoot;
    for (let step = 0; step < 3; step++)
      driver.see({
        type: 'step',
        car: movingAt(onFoot, 2),
        cockpit: driver.cockpit,
        events: [],
        dt: SIM_STEP_S,
        scenario: snapshotWith(onFoot, [walker]),
      });
    expect(driver.faults).toEqual(['rule.high.l-yield-to-pedestrians-cyclists']);
    driver.see({
      type: 'step',
      car: movingAt(onFoot, 2),
      cockpit: driver.cockpit,
      events: [{ type: 'actor-contact', actor: 'pedestrian' }],
      dt: SIM_STEP_S,
      scenario: snapshotWith(onFoot, [walker], ['pedestrian']),
    });
    expect(driver.session.ledger.faults).toEqual([
      expect.objectContaining({ ruleId: 'rule.high.l-yield-to-pedestrians-cyclists', points: 8, escalated: true }),
    ]);
    expect(driver.session.ledger.interruption?.cause).toBe('examiner');
    expect(driver.phase).toBe('finished');

    const metal = inCirculation();
    placeOnLeg(metal, 3, 100);
    metal.driver.see({
      type: 'step',
      car: movingAt(metal, 3),
      cockpit: metal.driver.cockpit,
      events: [{ type: 'actor-contact', actor: 'vehicle' }],
      dt: SIM_STEP_S,
      scenario: snapshotWith(metal, [], ['vehicle']),
    });
    expect(metal.driver.faults).toEqual(['rule.eliminatory.i-reckless-maneuver']);
    expect(metal.driver.session.ledger.interruption?.cause).toBe('examiner');
  });
});

describe('handling (minor n, eliminatory h) and what the HUD reads', () => {
  it('full lock at speed loses control of the car', () => {
    const exam = inCirculation();
    placeOnLeg(exam, 8, 10);
    cruise(exam, { until: (driver) => kmh(driver) > 24, maxS: 30, speed: () => 7 });
    exam.driver.hold({ ...IDLE, throttle: 0.3, steer: -1 }, (_, t) => t > 1.2, 5);
    expect(exam.driver.faults).toEqual(['rule.eliminatory.h-loss-of-control']);
  }, 90000);

  it('announces the next control and the road limits as the car drives', () => {
    const exam = outOfTheBox();
    const { driver } = exam;
    cruise(exam, { until: (d) => d.session.street.notice?.kind === 'signal', maxS: 60 });
    expect(driver.session.street.notice?.distanceM).toBeLessThanOrEqual(60);
    expect(driver.session.street.road).toEqual({ street: 'Quesada', examKmh: 30, postedKmh: 40 });
    expect(driver.session.street.instruction).toEqual({ turn: 'right', street: 'Av. Cabildo' });
    expect(CITY.legs[0]?.street).toBe('Quesada');
  }, 90000);
});
