import { describe, expect, it } from 'vitest';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import {
  cityExam,
  cruise,
  descend,
  nudge,
  parkInTheBay,
  reverseHard,
  stopInDoubleFile,
  throughTheBox,
} from '../test/circuitDriver.ts';
import type { CityExam } from '../test/circuitDriver.ts';
import { IDLE } from '../test/examDriver.ts';
import { bayFrame } from './parking.ts';
import { resultOf } from './scoring.ts';

/**
 * Stage III on the city with the real car, cabin, seeded traffic and examiner: a scripted driver completes the lap
 * of route A, parks in the bay of Quesada and gets out. The lap is driven once per transmission; every case
 * branches from the corner into Quesada, where stage II ends.
 */
const afterTheLap: Partial<Record<TransmissionKind, CityExam>> = {};
/** Where the examiner first announced the parking during the automatic lap. */
let firstNotice: { leg: number; distanceM: number } | null = null;

function atTheCorner(kind: TransmissionKind): CityExam {
  let exam = afterTheLap[kind];
  if (!exam) {
    exam = cityExam(kind, 1);
    throughTheBox(exam.driver);
    cruise(exam, {
      until: (driver) => {
        const { parkingAheadM, leg } = driver.session.street;
        if (kind === 'automatic' && firstNotice === null && parkingAheadM !== null)
          firstNotice = { leg, distanceM: parkingAheadM };
        return driver.phase === 'parking';
      },
      maxS: 600,
    });
    expect(exam.driver.faults).toEqual([]);
    expect(exam.driver.session.completedStages).toEqual(['I', 'II']);
    afterTheLap[kind] = exam;
  }
  return { ...exam, driver: exam.driver.clone() };
}

const centreOf = (exam: CityExam) => {
  const body = bodyBox(EXAM_CAR, exam.driver.car.world.vehicle);
  return bayFrame(exam.circuit.bay, { x: body.centerX, z: body.centerZ });
};
const result = (exam: CityExam) => resultOf(exam.driver.session.ledger, exam.driver.session.completedStages);

describe('the whole exam: lap, parking and descent (protocolo PDF 13–14)', () => {
  it.each(['automatic', 'manual'] as const)(
    '%s: a clean exam parks in three manoeuvres within the first band, gets out properly and is approved',
    (kind) => {
      const exam = atTheCorner(kind);
      const { driver } = exam;
      stopInDoubleFile(exam);
      expect(driver.session.parking.startedAtS).not.toBeNull();
      expect(centreOf(exam).leftM).toBeGreaterThan(1.2);
      parkInTheBay(exam);
      const { kerb } = driver.session.parking;
      expect(kerb).not.toBeNull();
      descend(driver);
      const { parking, ledger } = driver.session;
      expect(driver.faults).toEqual([]);
      expect(parking.manoeuvres).toBe(3);
      expect(parking.attempts).toBe(1);
      expect(parking.final?.frontCm).toBeGreaterThanOrEqual(15);
      expect(parking.final?.frontCm).toBeLessThanOrEqual(25);
      expect(parking.final?.rearCm).toBeGreaterThanOrEqual(15);
      expect(parking.final?.rearCm).toBeLessThanOrEqual(25);
      expect(Math.abs(parking.final?.alongM ?? 1)).toBeLessThanOrEqual(0.5);
      expect(driver.session.completedStages).toEqual(['I', 'II', 'III']);
      expect(driver.phase).toBe('finished');
      expect(ledger.points).toBe(0);
      expect(result(exam)).toBe('approved');
    },
    300000,
  );

  it('announces the parking 100 m before the bay, on the last leg, and keeps it in the HUD until the corner', () => {
    const exam = atTheCorner('automatic');
    expect(firstNotice).not.toBeNull();
    expect(firstNotice?.leg).toBe(8);
    expect(firstNotice?.distanceM).toBeLessThanOrEqual(100);
    expect(firstNotice?.distanceM).toBeGreaterThan(97);
    expect(exam.driver.session.street.parkingAheadM).toBeLessThan(30);
    expect(exam.driver.session.parking.aheadM).toBeNull();
  }, 120000);

  it('ignores "I am done" while the car is still moving, and takes it once stopped', () => {
    const exam = atTheCorner('automatic');
    const { driver } = exam;
    driver.ready();
    cruise(exam, { until: (_, t) => t > 0.5, maxS: 5, speed: () => 2 });
    expect(driver.phase).toBe('parking');
    expect(driver.session.parking.endRequested).toBe(false);
    stopInDoubleFile(exam);
    descend(driver);
    // Said in double file: outside the second band, off-centre, and the descent still judged.
    expect(driver.faults).toEqual([
      'rule.eliminatory.r-parking-outside-second-band',
      'rule.minor.s-parking-off-center-or-tilted',
    ]);
    expect(driver.session.ledger.interruption).toBeNull();
    expect(driver.session.completedStages).toEqual(['I', 'II', 'III']);
    expect(result(exam)).toBe('disapproved');
  }, 120000);
});

describe('the manoeuvre (rules low i, high p, minor r, eliminatory q; protocolo PDF 13, 24–25, 27, 29, 33)', () => {
  it('hazards switched on less than 3 s before the double-file stop, or never, score the low fault once', () => {
    const late = atTheCorner('automatic');
    stopInDoubleFile(late, { hazards: 'late' });
    expect(late.driver.faults).toEqual(['rule.low.i-no-hazards-before-parking']);
    const never = atTheCorner('automatic');
    stopInDoubleFile(never, { hazards: 'never' });
    expect(never.driver.faults).toEqual(['rule.low.i-no-hazards-before-parking']);
    parkInTheBay(never);
    descend(never.driver);
    expect(never.driver.faults).toEqual(['rule.low.i-no-hazards-before-parking']);
    expect(never.driver.session.ledger.points).toBe(2);
    expect(result(never)).toBe('approved');
  }, 120000);

  it('reversing without a glance at the mirrors scores the high fault; a fourth manoeuvre, the minor one', () => {
    const blind = atTheCorner('automatic');
    stopInDoubleFile(blind, { look: false });
    parkInTheBay(blind);
    expect(blind.driver.faults).toEqual(['rule.high.p-no-mirror-check-parking']);

    const fussy = atTheCorner('automatic');
    stopInDoubleFile(fussy);
    parkInTheBay(fussy);
    nudge(fussy.driver, fussy.circuit.bay, -0.2);
    nudge(fussy.driver, fussy.circuit.bay, 0.2);
    expect(fussy.driver.session.parking.manoeuvres).toBe(5);
    expect(fussy.driver.faults).toEqual(['rule.minor.r-parking-over-three-maneuvers']);
    descend(fussy.driver);
    expect(fussy.driver.faults).toEqual(['rule.minor.r-parking-over-three-maneuvers']);
    expect(result(fussy)).toBe('approved');
  }, 120000);

  it('a second attempt costs the manoeuvres; a third attempt eliminates and interrupts', () => {
    const twice = atTheCorner('automatic');
    stopInDoubleFile(twice);
    parkInTheBay(twice, { retries: 1 });
    expect(twice.driver.session.parking.attempts).toBe(2);
    expect(twice.driver.faults).toEqual(['rule.minor.r-parking-over-three-maneuvers']);
    expect(twice.driver.phase).toBe('parking');

    const thrice = atTheCorner('automatic');
    stopInDoubleFile(thrice);
    parkInTheBay(thrice, { retries: 2 });
    expect(thrice.driver.session.parking.attempts).toBe(3);
    expect(thrice.driver.faults).toEqual([
      'rule.minor.r-parking-over-three-maneuvers',
      'rule.eliminatory.q-parking-over-two-attempts',
    ]);
    expect(thrice.driver.phase).toBe('finished');
    expect(thrice.driver.session.ledger.interruption?.cause).toBe('fault');
    expect(thrice.driver.session.completedStages).toEqual(['I', 'II']);
  }, 120000);

  it('taking the belt off while parking eliminates (eliminatory c)', () => {
    const exam = atTheCorner('automatic');
    stopInDoubleFile(exam);
    exam.driver.cabin({ type: 'toggle', control: 'belt' });
    expect(exam.driver.faults).toEqual(['rule.eliminatory.c-no-seatbelt']);
    expect(exam.driver.phase).toBe('finished');
  }, 120000);
});

describe('the final position and the markers (rules t, u, r, s, high d, eliminatory d; protocolo PDF 13, 21, 25, 33)', () => {
  it('ends on the second band (minor u) or outside it (eliminatory r, reported at the end), or too close (minor t)', () => {
    const second = atTheCorner('automatic');
    stopInDoubleFile(second);
    parkInTheBay(second, { targetLeftM: 0.2 });
    descend(second.driver);
    expect(second.driver.session.parking.final?.rearCm).toBeGreaterThan(25);
    expect(second.driver.session.parking.final?.rearCm).toBeLessThanOrEqual(50);
    expect(second.driver.faults).toEqual(['rule.minor.u-parking-on-second-band']);
    expect(result(second)).toBe('approved');

    const outside = atTheCorner('automatic');
    stopInDoubleFile(outside);
    parkInTheBay(outside, { targetLeftM: 0.45 });
    descend(outside.driver);
    expect(outside.driver.session.parking.final?.rearCm).toBeGreaterThan(50);
    expect(outside.driver.faults).toEqual(['rule.eliminatory.r-parking-outside-second-band']);
    expect(outside.driver.session.ledger.interruption).toBeNull();
    expect(outside.driver.session.completedStages).toEqual(['I', 'II', 'III']);
    expect(result(outside)).toBe('disapproved');

    const close = atTheCorner('automatic');
    stopInDoubleFile(close);
    parkInTheBay(close, { targetLeftM: -0.08 });
    descend(close.driver);
    expect(close.driver.session.parking.final?.rearCm).toBeLessThan(15);
    expect(close.driver.faults).toEqual(['rule.minor.t-parking-too-close-to-curb']);
  }, 120000);

  it('ending more than 0,5 m off the bay centre is off-centre (minor s)', () => {
    const exam = atTheCorner('automatic');
    stopInDoubleFile(exam);
    parkInTheBay(exam);
    // Creeping on forward is still the positioning manoeuvre, not a new one.
    nudge(exam.driver, exam.circuit.bay, 0.62);
    expect(exam.driver.session.parking.manoeuvres).toBe(3);
    descend(exam.driver);
    expect(exam.driver.session.parking.final?.alongM).toBeGreaterThan(0.5);
    expect(exam.driver.faults).toEqual(['rule.minor.s-parking-off-center-or-tilted']);
  }, 120000);

  it('backing fast into the rear marker hits it: eliminatory d interrupts the exam', () => {
    const exam = atTheCorner('automatic');
    stopInDoubleFile(exam);
    parkInTheBay(exam);
    nudge(exam.driver, exam.circuit.bay, 0.6);
    expect(exam.driver.faults).toEqual([]);
    // A fourth manoeuvre (the minor fault) that backs 1,4 m into the rear marker at more than 1 m/s.
    reverseHard(exam.driver, () => exam.driver.phase === 'finished');
    expect(exam.driver.faults).toEqual([
      'rule.minor.r-parking-over-three-maneuvers',
      'rule.eliminatory.d-curb-mount-or-marker-hit',
    ]);
    expect(exam.driver.session.ledger.interruption?.cause).toBe('fault');
  }, 120000);
});

describe('the descent (rules v, w, x, y, low j; protocolo PDF 13, 25, 27)', () => {
  it('manual: gearbox left in gear, no handbrake and the low beams on score one minor fault each', () => {
    const exam = atTheCorner('manual');
    stopInDoubleFile(exam);
    parkInTheBay(exam);
    descend(exam.driver, { gear: false, handbrake: false, lights: false });
    expect(exam.driver.faults).toEqual([
      'rule.minor.w-not-neutral-or-park-at-end',
      'rule.minor.x-handbrake-not-applied-at-end',
      'rule.minor.v-low-beams-not-off',
    ]);
    expect(exam.driver.session.ledger.points).toBe(3);
    expect(result(exam)).toBe('approved');
  }, 120000);

  it('automatic: opening the door with the engine running is one fault, as is leaving the key in', () => {
    const running = atTheCorner('automatic');
    stopInDoubleFile(running);
    parkInTheBay(running);
    descend(running.driver, { engine: false });
    expect(running.driver.faults).toEqual(['rule.minor.y-engine-key-steering-lock']);

    const keyIn = atTheCorner('automatic');
    stopInDoubleFile(keyIn);
    parkInTheBay(keyIn);
    descend(keyIn.driver, { key: false });
    expect(keyIn.driver.faults).toEqual(['rule.minor.y-engine-key-steering-lock']);
    expect(keyIn.driver.car.powertrain.engineRunning).toBe(false);
  }, 120000);

  it('not looking at the left mirror before opening the door is the low fault; a head turn does not replace it', () => {
    const exam = atTheCorner('automatic');
    stopInDoubleFile(exam);
    parkInTheBay(exam);
    exam.driver.ready();
    exam.driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.1);
    expect(exam.driver.phase).toBe('leaving');
    exam.driver.cabin({ type: 'look', yaw: 1.3, pitch: 0 });
    descend(exam.driver, { mirror: false });
    expect(exam.driver.faults).toEqual(['rule.low.j-no-traffic-check-before-exit']);
    expect(exam.driver.session.ledger.points).toBe(2);
  }, 120000);
});
