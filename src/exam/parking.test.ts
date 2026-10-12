import { describe, expect, it } from 'vitest';
import { offsetPoint } from '../city/model.ts';
import { initialCockpit } from '../practice/cockpit.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import { initialCarState } from '../sim/car.ts';
import type { CarState } from '../sim/car.ts';
import type { PowertrainState, TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { EXAM_CAR, restingVehicle } from '../sim/vehicle.ts';
import { CITY } from '../test/circuitDriver.ts';
import { REAL_BANDS, REAL_RULES } from '../test/realRules.ts';
import { createTraffic } from '../traffic/traffic.ts';
import { buildCircuit } from './circuit.ts';
import {
  PARKING,
  bayFrame,
  createParking,
  judgeDescent,
  judgeFinalPosition,
  judgeParkingStep,
  kerbDistancesCm,
  noteDescentLook,
  noteHazards,
  noteParkingLook,
} from './parking.ts';
import type { Parking } from './parking.ts';
import { GAME_PARAMETERS } from './session.ts';

/**
 * The parking judges against synthetic positions in the bay's frame: the car placed exactly where a rule needs
 * it, step by step. The scripted driver (parkingStreet.test.ts) parks for real on the city.
 */
const circuit = buildCircuit(CITY, { ...createTraffic(CITY, 1), emergency: null });
const { bay } = circuit;
const MIRROR = GAME_PARAMETERS.mirrorGlanceYawRad;
const toRear = EXAM_CAR.lengthM / 2 - EXAM_CAR.rearOverhangM;

/** The car as a rigid body with its centre at (`alongM`, `leftM`) of the bay's frame, heading along the kerb. */
function carAt(alongM: number, leftM: number, speedMps: number, headingOffset = 0, kind: TransmissionKind = 'manual') {
  const centre = offsetPoint(bay.center, bay.headingRad, leftM, alongM);
  const heading = bay.headingRad + headingOffset;
  const vehicle = restingVehicle({
    x: centre.x - Math.sin(heading) * toRear,
    z: centre.z - Math.cos(heading) * toRear,
    headingRad: heading,
  });
  return initialCarState({ ...vehicle, speedMps }, kind);
}

const cockpitWith = (changes: Partial<CockpitState>): CockpitState => ({ ...initialCockpit(), ...changes });
const HAZARDS = cockpitWith({ hazards: true });

/** Plays a sequence of positions, one per step of `dtS`, and collects every rule reported. */
function play(
  steps: readonly { car: CarState; cockpit?: CockpitState; look?: number }[],
  from: Parking = createParking(),
  dtS = 0.1,
): { parking: Parking; rules: string[]; episodes: (string | undefined)[] } {
  let parking = from;
  const rules: string[] = [];
  const episodes: (string | undefined)[] = [];
  steps.forEach((step, index) => {
    if (step.look !== undefined) parking = noteParkingLook(parking, step.look, MIRROR);
    const verdict = judgeParkingStep(parking, bay, step.car, step.cockpit ?? HAZARDS, index * dtS);
    parking = verdict.parking;
    for (const report of verdict.reports) {
      rules.push(report.ruleId);
      episodes.push(report.episode);
    }
  });
  return { parking, rules, episodes };
}

/** Hazards on, then the alignment stop in double file 5 m ahead of the bay's centre, after `seconds` of steps. */
const alignment = (seconds = 4) => [
  ...Array.from({ length: Math.round(seconds * 10) }, () => ({ car: carAt(5, 3.3, 2) })),
  { car: carAt(5, 3.3, 0) },
];
/** Reversing with a glance at the right mirror once moving back, so the reverse is checked (high p is tested apart). */
const reversing = (count: number, leftM = 3.3, alongM = 2) =>
  Array.from({ length: count }, (_, index) => ({
    car: carAt(alongM, leftM, -0.8),
    ...(index === 1 ? { look: -MIRROR.min } : {}),
  }));
const reversingBlind = (count: number) => Array.from({ length: count }, () => ({ car: carAt(2, 3.3, -0.8) }));
const forwards = (count: number, leftM = 0) => Array.from({ length: count }, () => ({ car: carAt(-0.5, leftM, 0.8) }));
const stillInBay = { car: carAt(0, 0, 0) };
/** The alignment stop with a glance at the right mirror, so the reverse is checked (high p is tested apart). */
const aligned = (seconds = 4) => [...alignment(seconds), { car: carAt(5, 3.3, 0), look: -MIRROR.min }];
/** Already aligned in double file, hazards judged: only what follows is reported. */
const started: Parking = { ...createParking(), startedAtS: 0, manoeuvres: 1, attempts: 1, lookedBeforeReverse: true };

describe('the parking thresholds come from the rule catalog (REGLAS.md §6)', () => {
  const parameters = (id: string) => REAL_RULES.find((rule) => rule.id === id)!.parameters as Record<string, number>;
  it('matches the parameters of the stage III rules and the box marker speed of stage I', () => {
    expect(PARKING.hazardsBeforeStopS).toBe(parameters('rule.low.i-no-hazards-before-parking').hazardsBeforeStopMinS);
    expect(PARKING.maxManoeuvres).toBe(parameters('rule.minor.r-parking-over-three-maneuvers').maxParkingManeuvers);
    expect(PARKING.maxAttempts).toBe(parameters('rule.eliminatory.q-parking-over-two-attempts').maxParkingAttempts);
    expect(PARKING.maxAxleDifferenceCm).toBe(
      parameters('rule.minor.s-parking-off-center-or-tilted').maxAxleOffsetDifferenceCm,
    );
    expect(PARKING.lineHitSpeedMps).toBe(GAME_PARAMETERS.markerKnockSpeedMps);
  });

  it('derives the bay from the city: 6 m long, the kerb 20 cm right of the parked car, two end lines on the lap', () => {
    expect(bay.halfLengthM).toBeCloseTo(3, 3);
    expect(bay.lines).toHaveLength(2);
    expect(bay.kerbLeftM).toBeLessThan(0);
    const parked = kerbDistancesCm(bay, CITY.start.pose);
    expect(parked.frontCm).toBeCloseTo(20, 3);
    expect(parked.rearCm).toBeCloseTo(20, 3);
    expect(bayFrame(bay, CITY.start.pose).alongM).toBeCloseTo(-toRear, 3);
    expect(circuit.legs[0]!.startS).toBeLessThan(bay.frontS);
    expect(bay.frontS - circuit.legs[0]!.startS).toBeLessThan(30);
  });
});

describe('hazards before stopping in double file (rule.low.i; protocolo PDF 13, 27)', () => {
  it('scores nothing with the hazards on for exactly 3 s before the stop, and scores them on 2,9 s or never', () => {
    expect(play(alignment(3)).rules).toEqual([]);
    expect(play(alignment(2.9)).rules).toEqual(['rule.low.i-no-hazards-before-parking']);
    const never = alignment(4).map((step) => ({ ...step, cockpit: initialCockpit() }));
    expect(play(never).rules).toEqual(['rule.low.i-no-hazards-before-parking']);
    // Switched on and off again before the stop: the count starts over.
    const flicker = alignment(4).map((step, index) => ({
      ...step,
      cockpit: index === 20 ? initialCockpit() : HAZARDS,
    }));
    expect(play(flicker).rules).toEqual(['rule.low.i-no-hazards-before-parking']);
  });

  it('counts the hazards from when they came on before the parking phase: the notice comes on the last leg', () => {
    // On 2,5 s before stage III began, and the double-file stop 1 s into it: 3,5 s before stopping.
    const onSinceTheLastLeg = noteHazards(createParking(), true, -2.5);
    expect(play(alignment(1), onSinceTheLastLeg).rules).toEqual([]);
    expect(play(alignment(1)).rules).toEqual(['rule.low.i-no-hazards-before-parking']);
    expect(noteHazards(onSinceTheLastLeg, false, 0).hazardsSinceS).toBeNull();
  });

  it('stopping in the bay itself, driving in forwards, is not the double-file alignment and begins nothing', () => {
    const forwardsIn = [...Array.from({ length: 40 }, () => ({ car: carAt(0, 0, 2) })), { car: carAt(0, 0, 0) }];
    const { parking } = play(forwardsIn);
    expect(parking.startedAtS).toBeNull();
    expect(parking.manoeuvres).toBe(0);
  });

  it('a stop outside the parking zone (far before the bay) does not begin the manoeuvre', () => {
    const early = [{ car: carAt(-20, 3.3, 2) }, { car: carAt(-20, 3.3, 0) }];
    const { parking } = play(early);
    expect(parking.startedAtS).toBeNull();
    expect(parking.manoeuvres).toBe(0);
    expect(parking.aheadM).toBeCloseTo(bay.halfLengthM + 20 - EXAM_CAR.lengthM / 2, 3);
  });
});

describe('manoeuvres and attempts (rule.minor.r, rule.eliminatory.q; protocolo PDF 24–25, 33)', () => {
  it('counts the alignment, the reverse and the forward positioning as three manoeuvres, with no fault', () => {
    const { parking, rules } = play([...aligned(), ...reversing(5), ...forwards(5), stillInBay]);
    expect(rules).toEqual([]);
    expect(parking.manoeuvres).toBe(3);
    expect(parking.attempts).toBe(1);
    expect(parking.kerb).not.toBeNull();
  });

  it('a forward nudge before the first reverse is still aligning; a fourth manoeuvre scores minor r once', () => {
    const nudge = play([...aligned(), { car: carAt(5.5, 3.3, 0.5) }, ...reversing(5), ...forwards(5)]);
    expect(nudge.parking.manoeuvres).toBe(3);
    expect(nudge.rules).toEqual([]);
    const four = play([...aligned(), ...reversing(5), ...forwards(5), ...reversing(5, 0, 0.5), ...forwards(5)]);
    expect(four.parking.manoeuvres).toBe(5);
    expect(four.rules).toEqual(['rule.minor.r-parking-over-three-maneuvers']);
  });

  it('pulling out of the bay to align again is a second attempt; a third one eliminates', () => {
    const attempt = (leftM: number) => [
      ...reversing(3, 2.5),
      { car: carAt(0.5, 0.5, -0.5) },
      ...forwards(3, leftM).map((step) => ({ ...step, look: -MIRROR.min })),
    ];
    const two = play([...aligned(), ...attempt(3.3), { car: carAt(5, 3.3, 0) }]);
    expect(two.parking.attempts).toBe(2);
    // Aligning, reversing and pulling out are three manoeuvres so far: the second attempt will add a fourth.
    expect(two.parking.manoeuvres).toBe(3);
    expect(two.rules).toEqual([]);
    const three = play([...aligned(), ...attempt(3.3), ...attempt(3.3)]);
    expect(three.parking.attempts).toBe(3);
    expect(three.rules).toEqual([
      'rule.minor.r-parking-over-three-maneuvers',
      'rule.eliminatory.q-parking-over-two-attempts',
    ]);
    // Positioning forward inside the bay is not a new attempt.
    const inside = play([...aligned(), ...attempt(0.3)]);
    expect(inside.parking.attempts).toBe(1);
  });
});

describe('mirrors or a head turn while reversing (rule.high.p; protocolo PDF 13, 29–30)', () => {
  it('scores the reverse done without a glance, once the car moves forward again, per attempt', () => {
    const blind = play([...alignment(), ...reversing(5), ...forwards(2)]);
    expect(blind.rules).toEqual(['rule.high.p-no-mirror-check-parking']);
    expect(blind.episodes).toEqual(['attempt-1']);
    const glance = play([
      ...alignment(),
      { car: carAt(5, 3.3, 0), look: -MIRROR.min },
      ...reversing(5),
      ...forwards(2),
    ]);
    expect(glance.rules).toEqual([]);
    const back = play([...alignment(), { car: carAt(5, 3.3, 0), look: 2.35 }, ...reversing(5), ...forwards(2)]);
    expect(back.rules).toEqual([]);
    // A glance before the alignment stop does not count; a head turn short of the mirror range neither.
    const early = play([{ car: carAt(5, 3.3, 2), look: 0.5 }, ...alignment(), ...reversing(5), ...forwards(2)]);
    expect(early.rules).toEqual(['rule.high.p-no-mirror-check-parking']);
    const short = play([...alignment(), { car: carAt(5, 3.3, 0), look: 0.1 }, ...reversing(5), ...forwards(2)]);
    expect(short.rules).toEqual(['rule.high.p-no-mirror-check-parking']);
  });

  it('asks for both moments: at the double-file stop and while reversing; a look after the reverse does not count', () => {
    const atStopOnly = play([...aligned(), ...reversingBlind(5), ...forwards(2)]);
    expect(atStopOnly.rules).toEqual(['rule.high.p-no-mirror-check-parking']);
    const inReverseOnly = play([...alignment(), ...reversing(5), ...forwards(2)]);
    expect(inReverseOnly.rules).toEqual(['rule.high.p-no-mirror-check-parking']);
    const both = play([...aligned(), ...reversing(5), ...forwards(2)]);
    expect(both.rules).toEqual([]);
    const tooLate = play([
      ...aligned(),
      ...reversingBlind(5),
      { car: carAt(-0.5, 0, 0.8) },
      { car: carAt(-0.5, 0, 0.8), look: -MIRROR.min },
    ]);
    expect(tooLate.rules).toEqual(['rule.high.p-no-mirror-check-parking']);
  });

  it('is judged at the end of the manoeuvre when the driver says so straight after reversing', () => {
    const { parking } = play([...alignment(), ...reversing(5), { car: carAt(0, 0, 0) }]);
    const final = judgeFinalPosition(parking, bay, carAt(0, 0, 0), REAL_BANDS);
    expect(final.reports.map((report) => report.ruleId)).toEqual(['rule.high.p-no-mirror-check-parking']);
    const again = judgeFinalPosition(final.parking, bay, carAt(0, 0, 0), REAL_BANDS);
    expect(again.reports).toEqual([]);
  });
});

describe('the painted end lines stand for the bay markers (rule.high.d, rule.eliminatory.d; D13)', () => {
  const onRearLine = (speedMps: number) => ({ car: carAt(-bay.halfLengthM + 1.5, 0, speedMps) });
  it('touching a line slowly is a high fault per contact; hitting it at 1 m/s or more eliminates', () => {
    const touch = play([stillInBay, onRearLine(-0.5), onRearLine(-0.5), stillInBay, onRearLine(-0.5)], started);
    expect(touch.rules).toEqual(['rule.high.d-box-marker-touch', 'rule.high.d-box-marker-touch']);
    const hit = play([stillInBay, onRearLine(-1)], started);
    expect(hit.rules).toEqual(['rule.eliminatory.d-curb-mount-or-marker-hit']);
    expect(play([stillInBay, onRearLine(-0.99)], started).rules).toEqual(['rule.high.d-box-marker-touch']);
  });
});

describe('the final position (rules t, u, r, s; protocolo PDF 13, 21, 25, 33; V1 and V3)', () => {
  const finalRules = (leftM: number, headingOffset = 0, alongM = 0) =>
    judgeFinalPosition(createParking(), bay, carAt(alongM, leftM, 0, headingOffset), REAL_BANDS).reports.map(
      (report) => report.ruleId,
    );
  /** The parked car's right side is 20 cm from the kerb: shifting its centre left by `cm - 20` gives `cm`. */
  const atCm = (cm: number) => (cm - 20) / 100;

  it('is correct between 15 and 25 cm inclusive, too close under 15, on the second band up to 50 inclusive, outside above', () => {
    expect(finalRules(atCm(20))).toEqual([]);
    expect(finalRules(atCm(15))).toEqual([]);
    expect(finalRules(atCm(25))).toEqual([]);
    expect(finalRules(atCm(14.9))).toEqual(['rule.minor.t-parking-too-close-to-curb']);
    expect(finalRules(atCm(25.1))).toEqual(['rule.minor.u-parking-on-second-band']);
    expect(finalRules(atCm(50))).toEqual(['rule.minor.u-parking-on-second-band']);
    expect(finalRules(atCm(50.1))).toEqual(['rule.eliminatory.r-parking-outside-second-band']);
  });

  it('measures each axle: the two axles in different bands score each band once', () => {
    // Rear at 20 cm, front 29 cm further: tilted by less than 30 cm, but the front is on the second band.
    const tilt = (cm: number) => Math.asin(cm / 100 / EXAM_CAR.wheelbaseM);
    const parking = createParking();
    const car = (frontExtraCm: number, rearCm = 20) => {
      const heading = bay.headingRad + tilt(frontExtraCm);
      const rearRight = offsetPoint(bay.center, bay.headingRad, bay.kerbLeftM + rearCm / 100, -toRear);
      const axle = offsetPoint(rearRight, heading, EXAM_CAR.widthM / 2);
      return initialCarState(restingVehicle({ x: axle.x, z: axle.z, headingRad: heading }), 'manual');
    };
    const kerb = kerbDistancesCm(bay, car(29).world.vehicle);
    expect(kerb.rearCm).toBeCloseTo(20, 3);
    expect(kerb.frontCm).toBeCloseTo(49, 3);
    const rules = (extra: number) =>
      judgeFinalPosition(parking, bay, car(extra), REAL_BANDS).reports.map((report) => report.ruleId);
    expect(rules(29)).toEqual(['rule.minor.u-parking-on-second-band']);
    // Exactly 30 cm between the axles is not tilted; 30,5 cm is (one fault besides the band, here outside it).
    expect(rules(30)).toEqual(['rule.minor.u-parking-on-second-band']);
    expect(rules(30.5)).toEqual([
      'rule.eliminatory.r-parking-outside-second-band',
      'rule.minor.s-parking-off-center-or-tilted',
    ]);
    // Front 10 cm, rear 40 cm: too close and on the second band at once, not tilted (exactly 30 cm apart).
    const both = judgeFinalPosition(parking, bay, car(-30, 40), REAL_BANDS);
    expect(both.parking.final).toMatchObject({ frontCm: expect.closeTo(10, 3), rearCm: expect.closeTo(40, 3) });
    expect(both.reports.map((report) => report.ruleId)).toEqual([
      'rule.minor.t-parking-too-close-to-curb',
      'rule.minor.u-parking-on-second-band',
    ]);
  });

  it('is off-centre beyond 0,5 m of the bay centre along the kerb, not at exactly 0,5 m', () => {
    expect(finalRules(0, 0, 0.5)).toEqual([]);
    expect(finalRules(0, 0, 0.51)).toEqual(['rule.minor.s-parking-off-center-or-tilted']);
    expect(finalRules(0, 0, -0.51)).toEqual(['rule.minor.s-parking-off-center-or-tilted']);
    const { parking } = judgeFinalPosition(createParking(), bay, carAt(0.3, 0, 0), REAL_BANDS);
    expect(parking.final?.alongM).toBeCloseTo(0.3, 3);
    expect(parking.final?.frontCm).toBeCloseTo(20, 3);
  });
});

describe('the descent (rules v, w, x, y, low j; protocolo PDF 13, 25, 27; X7, D14)', () => {
  const powertrain = (kind: TransmissionKind, changes: Partial<PowertrainState>): CarState => {
    const car = carAt(0, 0, 0, 0, kind);
    const done: PowertrainState = {
      ...car.powertrain,
      key: 'removed',
      engineRunning: false,
      handbrake: true,
      manualGear: 'N',
      lever: 'P',
      ...changes,
    };
    return { ...car, powertrain: done };
  };
  const looked = noteDescentLook(createParking(), MIRROR.min, MIRROR);
  const off = cockpitWith({ lights: 'off' });
  const rules = (parking: Parking, car: CarState, cockpit: CockpitState, kind: TransmissionKind) =>
    judgeDescent(parking, car, cockpit, kind).map((report) => report.ruleId);

  it('scores nothing when everything was done, in both transmissions', () => {
    expect(rules(looked, powertrain('manual', {}), off, 'manual')).toEqual([]);
    expect(rules(looked, powertrain('automatic', {}), off, 'automatic')).toEqual([]);
    expect(rules(looked, powertrain('manual', {}), cockpitWith({ lights: 'position' }), 'manual')).toEqual([]);
  });

  it('scores each omission once: gear, handbrake, low beams, engine and key, left mirror', () => {
    expect(rules(looked, powertrain('manual', { manualGear: '1' }), off, 'manual')).toEqual([
      'rule.minor.w-not-neutral-or-park-at-end',
    ]);
    expect(rules(looked, powertrain('automatic', { lever: 'N' }), off, 'automatic')).toEqual([
      'rule.minor.w-not-neutral-or-park-at-end',
    ]);
    expect(rules(looked, powertrain('manual', { handbrake: false }), off, 'manual')).toEqual([
      'rule.minor.x-handbrake-not-applied-at-end',
    ]);
    expect(rules(looked, powertrain('manual', {}), cockpitWith({ lights: 'low' }), 'manual')).toEqual([
      'rule.minor.v-low-beams-not-off',
    ]);
    expect(rules(looked, powertrain('manual', {}), cockpitWith({ lights: 'high' }), 'manual')).toEqual([
      'rule.minor.v-low-beams-not-off',
    ]);
    // The door opened before the engine was off, or with the key still in: one fault for the whole item.
    expect(rules(looked, powertrain('manual', { engineRunning: true, key: 'on' }), off, 'manual')).toEqual([
      'rule.minor.y-engine-key-steering-lock',
    ]);
    expect(rules(looked, powertrain('manual', { key: 'off' }), off, 'manual')).toEqual([
      'rule.minor.y-engine-key-steering-lock',
    ]);
    expect(rules(createParking(), powertrain('manual', {}), off, 'manual')).toEqual([
      'rule.low.j-no-traffic-check-before-exit',
    ]);
  });

  it('only the left mirror counts before opening the door: the right one or a full head turn do not', () => {
    expect(noteDescentLook(createParking(), -MIRROR.min, MIRROR).leftMirrorChecked).toBe(false);
    expect(noteDescentLook(createParking(), 1.3, MIRROR).leftMirrorChecked).toBe(false);
    expect(noteDescentLook(createParking(), MIRROR.max, MIRROR).leftMirrorChecked).toBe(true);
  });

  it('lists every omission of a driver who opens the door at once, in the order of the protocol', () => {
    const car = powertrain('automatic', { key: 'on', engineRunning: true, handbrake: false, lever: 'D' });
    expect(rules(createParking(), car, cockpitWith({ lights: 'low' }), 'automatic')).toEqual([
      'rule.minor.w-not-neutral-or-park-at-end',
      'rule.minor.x-handbrake-not-applied-at-end',
      'rule.minor.v-low-beams-not-off',
      'rule.minor.y-engine-key-steering-lock',
      'rule.low.j-no-traffic-check-before-exit',
    ]);
  });
});
