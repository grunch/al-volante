import { describe, expect, it } from 'vitest';
import { REAL_RULES } from '../test/realRules.ts';
import { EXAM_START, createSession, observe } from './session.ts';
import type { Observation, Session } from './session.ts';
import { commandCockpit, initialCockpit } from '../practice/cockpit.ts';
import type { CockpitCommand, CockpitState } from '../practice/cockpit.ts';
import { command, initialCarState, stepCar } from '../sim/car.ts';
import type { CarControls, CarState } from '../sim/car.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import type { AutomaticLever, ManualGear, PowertrainCommand, TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { PRACTICE_YARD } from '../sim/tracks/practiceYard.ts';

const IDLE: CarControls = { throttle: 0, brake: 0, clutch: 0, steer: 0 };

/** A scripted driver: the car, the cabin and the session advance together, step by step. */
class Driver {
  session: Session;
  car: CarState;
  cockpit: CockpitState = initialCockpit();

  constructor(
    readonly kind: TransmissionKind,
    seed = 7,
  ) {
    this.session = createSession(REAL_RULES, kind, seed);
    this.car = initialCarState(EXAM_START, kind);
    // Stage I starts with the key in contact (protocolo PDF 9), as the exam page does.
    this.drive({ type: 'insert-key' }, { type: 'turn-key', to: 'on' });
  }

  see(observation: Observation) {
    this.session = observe(this.session, observation);
  }

  cabin(value: CockpitCommand) {
    const before = this.cockpit;
    this.cockpit = commandCockpit(before, value);
    this.see({ type: 'cockpit', command: value, before, after: this.cockpit });
  }

  drive(...commands: PowertrainCommand[]) {
    for (const next of commands) {
      const result = command(this.car, next);
      this.car = result.state;
      this.see({ type: 'step', car: this.car, cockpit: this.cockpit, events: result.events, dt: 0 });
    }
  }

  hold(controls: CarControls, until: (car: CarState, elapsedS: number) => boolean, maxS = 20) {
    for (let t = 0; t < maxS; t += SIM_STEP_S) {
      if (until(this.car, t)) return;
      const result = stepCar(PRACTICE_YARD, this.car, controls, SIM_STEP_S);
      this.car = result.state;
      this.see({ type: 'step', car: this.car, cockpit: this.cockpit, events: result.events, dt: SIM_STEP_S });
    }
    throw new Error(`condition not met in ${maxS} s`);
  }

  ready() {
    this.see({ type: 'ready' });
  }

  get faults() {
    return this.session.ledger.faults.map((fault) => fault.ruleId);
  }

  get phase() {
    return this.session.phase;
  }

  /** Answers every recognition prompt, correctly or through `wrong`. */
  recognise(wrong: Record<string, string> = {}): string[] {
    const targets: string[] = [];
    while (this.session.phase === 'recognition') {
      const prompt = this.session.prompt;
      if (prompt?.kind !== 'recognise') throw new Error('expected a recognition prompt');
      targets.push(prompt.target);
      this.answer(wrong[prompt.target] ?? prompt.target);
    }
    return targets;
  }

  answer(target: string) {
    if (target === 'clutch' || target === 'brake' || target === 'throttle') {
      this.hold({ ...IDLE, [target]: 1 }, (_, t) => t > 0.1);
      this.hold(IDLE, (_, t) => t > 0.1);
    } else if (target.startsWith('gear-')) {
      const to = target.slice(5) as ManualGear | AutomaticLever;
      this.hold(this.kind === 'manual' ? { ...IDLE, clutch: 1 } : { ...IDLE, brake: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to });
      this.hold(IDLE, (_, t) => t > 0.1);
    } else if (target === 'position' || target === 'low' || target === 'high') {
      this.cabin({ type: 'lights', value: target });
    } else if (target === 'signal-left' || target === 'signal-right') {
      this.cabin({ type: 'signal', value: target === 'signal-left' ? 'left' : 'right' });
    } else if (target === 'horn') {
      this.cabin({ type: 'horn', value: true });
    } else {
      this.cabin({
        type: 'toggle',
        control: target as 'hazards' | 'wipers' | 'defogger' | 'rearHeater' | 'airConditioning',
      });
    }
  }

  /** Stage I done properly: adjustments, mirrors, belt, low beams. */
  prepareProperly() {
    this.cabin({ type: 'adjust', control: 'seatDistance', value: 0.6 });
    this.cabin({ type: 'adjust', control: 'headrest', value: 0.6 });
    this.cabin({ type: 'mirror', mirror: 'left', axis: 'yaw', value: 0.1 });
    this.cabin({ type: 'toggle', control: 'belt' });
    this.cabin({ type: 'lights', value: 'low' });
    this.ready();
  }

  startEngine() {
    const held = this.kind === 'manual' ? { ...IDLE, clutch: 1 } : { ...IDLE, brake: 1 };
    this.hold(held, (_, t) => t > 0.2);
    this.drive({ type: 'turn-key', to: 'start' });
    this.hold(held, (_, t) => t > 0.5);
  }

  /** Moves the signed distance along the heading with the technique the protocol asks for, then stops. */
  moveInBox(metres: number) {
    const startZ = this.car.world.vehicle.z;
    const reverse = metres < 0;
    const reached = (car: CarState) =>
      reverse ? car.world.vehicle.z <= startZ + metres : car.world.vehicle.z >= startZ + metres;
    if (this.kind === 'manual') {
      this.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to: reverse ? 'R' : '1' }, { type: 'handbrake', engaged: false });
      this.hold({ ...IDLE, clutch: 0.68 }, reached);
      this.hold({ ...IDLE, clutch: 1, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
      this.hold({ ...IDLE, clutch: 1, brake: 1 }, (_, t) => t > 1);
    } else {
      this.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to: reverse ? 'R' : 'D' }, { type: 'handbrake', engaged: false });
      // Easing off the brake lets the converter creep the car; braking again stops it.
      this.hold({ ...IDLE, brake: 0.05 }, reached);
      this.hold({ ...IDLE, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
      this.hold({ ...IDLE, brake: 1 }, (_, t) => t > 1);
    }
  }

  /** Drives out of the box to the left (+x) in one forward manoeuvre, then stops. */
  driveOut() {
    if (this.kind === 'manual') {
      this.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
      this.drive({ type: 'shift', to: '1' });
    }
    // Manual: pull away at the biting point, then let the clutch up. Straight until the whole body is past the
    // front posts (turning earlier swings the side into them), then full lock to the left.
    if (this.kind === 'manual') {
      this.hold({ ...IDLE, clutch: 0.7, throttle: 0.4 }, (car) => car.world.vehicle.speedMps > 0.3, 5);
      this.hold({ ...IDLE, clutch: 0.6, throttle: 0.5 }, (car) => car.world.vehicle.speedMps > 1.5, 8);
    }
    const pedals: CarControls = { ...IDLE, throttle: 0.25 };
    this.hold(pedals, (car) => car.world.vehicle.z > 17, 30);
    this.hold({ ...pedals, steer: 1 }, (car) => car.world.vehicle.x > -1.5, 30);
    this.hold({ ...IDLE, brake: 1, clutch: 1 }, (car) => car.world.vehicle.speedMps === 0);
  }

  /** Puts the car elsewhere in the box, as a test fixture. */
  place(x: number) {
    this.car = { ...this.car, world: { ...this.car.world, vehicle: { ...this.car.world.vehicle, x } } };
  }
}

function throughStageOne(kind: TransmissionKind): Driver {
  const driver = new Driver(kind);
  driver.ready();
  driver.recognise();
  driver.prepareProperly();
  return driver;
}

function inTheBoxAfterThirtyCentimetres(kind: TransmissionKind): Driver {
  const driver = throughStageOne(kind);
  driver.startEngine();
  driver.moveInBox(-0.3);
  driver.moveInBox(0.3);
  return driver;
}

const ALL_TARGETS = [
  'clutch',
  'brake',
  'throttle',
  'gear-1',
  'gear-R',
  'gear-N',
  'position',
  'low',
  'high',
  'signal-left',
  'signal-right',
  'hazards',
  'wipers',
  'defogger',
  'horn',
  'rearHeater',
  'airConditioning',
];

describe('exam session: familiarisation and stage I (protocolo PDF 9–10)', () => {
  it('starts in the box with the engine off and the key in contact, and the familiarisation scores nothing', () => {
    const driver = new Driver('manual');

    expect(driver.car.powertrain).toMatchObject({ key: 'on', engineRunning: false, handbrake: true });
    expect(driver.phase).toBe('familiarisation');
    driver.cabin({ type: 'lights', value: 'high' });
    driver.hold({ ...IDLE, throttle: 1 }, (_, t) => t > 0.5);
    driver.ready();

    expect(driver.faults).toEqual([]);
    expect(driver.phase).toBe('recognition');
  });

  it('asks for every pedal, gear, light and instrument in a seeded random order; a correct round scores nothing', () => {
    const a = new Driver('manual', 1);
    const b = new Driver('manual', 2);
    const same = new Driver('manual', 1);
    [a, b, same].forEach((driver) => driver.ready());

    const orderA = a.recognise();

    expect(orderA).toEqual(same.recognise());
    expect(orderA).not.toEqual(b.recognise());
    expect([...orderA].sort()).toEqual([...ALL_TARGETS].sort());
    expect(a.faults).toEqual([]);
    expect(a.phase).toBe('preparation');
  });

  it('the automatic asks for its lever instead of the clutch and the manual gears', () => {
    const driver = new Driver('automatic');
    driver.ready();

    const targets = driver.recognise();

    expect(targets).not.toContain('clutch');
    expect(targets).toEqual(expect.arrayContaining(['gear-P', 'gear-R', 'gear-N', 'gear-D']));
    expect(driver.faults).toEqual([]);
  });

  it('scores the lights and the instruments once each however many are wrong; pedals and gearbox eliminate', () => {
    const driver = new Driver('manual', 3);
    driver.ready();
    const wrong: Record<string, string> = {
      clutch: 'brake',
      brake: 'throttle',
      throttle: 'clutch',
      'gear-1': 'gear-R',
      'gear-R': 'gear-N',
      'gear-N': 'gear-1',
      position: 'low',
      low: 'high',
      high: 'position',
      'signal-left': 'signal-right',
      'signal-right': 'hazards',
      hazards: 'low',
      wipers: 'defogger',
      defogger: 'horn',
      horn: 'wipers',
      rearHeater: 'airConditioning',
      airConditioning: 'rearHeater',
    };

    driver.recognise(wrong);

    expect([...driver.faults].sort()).toEqual([
      'rule.eliminatory.a-pedals-not-recognized',
      'rule.eliminatory.b-gearbox-not-handled',
      'rule.minor.a-lights-recognition',
      'rule.minor.b-instruments-recognition',
    ]);
    expect(driver.session.ledger.interruption?.cause).toBe('fault');
    expect(driver.phase).toBe('finished');
  });

  it('scores seat, headrest and mirrors never adjusted when the driver says the preparation is done', () => {
    const driver = new Driver('automatic');
    driver.ready();
    driver.recognise();

    driver.cabin({ type: 'toggle', control: 'belt' });
    driver.ready();

    expect([...driver.faults].sort()).toEqual([
      'rule.high.a-mirrors-not-checked',
      'rule.minor.c-seat-adjustment',
      'rule.minor.d-headrest-adjustment',
    ]);
    expect(driver.phase).toBe('unlock');
  });

  it('a proper preparation scores nothing, completes stage I and moves on to unlocking the car', () => {
    const driver = throughStageOne('manual');

    expect(driver.faults).toEqual([]);
    expect(driver.phase).toBe('unlock');
    expect(driver.session.completedStages).toEqual(['I']);
  });
});

describe('exam session: unlocking and the engine (protocolo PDF 10, anexo II)', () => {
  it('scores starting in gear as not checking neutral, and a second start with the engine running', () => {
    const driver = throughStageOne('manual');
    driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: '1' });
    driver.hold(IDLE, (_, t) => t > 0.2);
    driver.drive({ type: 'turn-key', to: 'start' });
    driver.startEngine();
    driver.drive({ type: 'turn-key', to: 'start' });
    driver.drive({ type: 'turn-key', to: 'start' });

    expect(driver.faults).toEqual(['rule.minor.e-neutral-check-before-start', 'rule.minor.h-start-while-running']);
    expect(driver.phase).toBe('reverse');
  });

  it('interrupts before any movement when the exam already adds up to 8 points', () => {
    const driver = new Driver('manual');
    driver.ready();
    driver.recognise();
    driver.cabin({ type: 'toggle', control: 'belt' });
    driver.ready(); // mirrors (3) + seat (1) + headrest (1)
    driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: '1' });
    driver.hold(IDLE, (_, t) => t > 0.2);
    driver.drive({ type: 'turn-key', to: 'start' }); // neutral check (1)
    driver.startEngine();
    driver.drive({ type: 'turn-key', to: 'start' }); // start while running (1)
    driver.drive({ type: 'turn-key', to: 'start' }); // same episode
    expect(driver.session.ledger.points).toBe(7);

    driver.drive({ type: 'turn-key', to: 'off' });
    driver.startEngine();
    driver.drive({ type: 'turn-key', to: 'start' }); // new episode (1): 8 points

    expect(driver.session.ledger.points).toBe(8);
    expect(driver.session.ledger.interruption?.cause).toBe('cutoff');
    expect(driver.phase).toBe('finished');
  });

  it('scores moving off with the handbrake on, and the belt off as eliminatory', () => {
    const driver = throughStageOne('automatic');
    driver.cabin({ type: 'toggle', control: 'belt' });
    driver.startEngine();
    driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: 'R' });

    driver.hold({ ...IDLE, throttle: 1 }, (car) => car.world.vehicle.speedMps < -0.3);

    expect(driver.faults).toEqual(['rule.minor.f-handbrake-on-start', 'rule.eliminatory.c-no-seatbelt']);
    expect(driver.phase).toBe('finished');
  });
});

describe('exam session: 30 cm in the box and leaving it (protocolo PDF 11)', () => {
  it.each(['manual', 'automatic'] as const)('%s: reverses and advances 30 cm properly and scores nothing', (kind) => {
    const driver = throughStageOne(kind);
    driver.startEngine();
    expect(driver.phase).toBe('reverse');

    driver.moveInBox(-0.3);
    expect(driver.phase).toBe('forward');
    driver.moveInBox(0.3);

    expect(driver.faults).toEqual([]);
    expect(driver.phase).toBe('exit');
    expect(driver.session.measurements.reverseCm).toBeGreaterThan(20);
    expect(driver.session.measurements.reverseCm).toBeLessThan(40);
    expect(driver.session.measurements.forwardCm).toBeGreaterThan(20);
  });

  it('scores a reverse that goes too far, and an advance with the wheel turned', () => {
    const driver = throughStageOne('automatic');
    driver.startEngine();

    driver.moveInBox(-0.8);
    driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: 'D' });
    const startOdometer = driver.car.world.vehicle.odometerM;
    driver.hold({ ...IDLE, brake: 0.05, steer: 1 }, (car) => car.world.vehicle.odometerM > startOdometer + 0.3);
    driver.hold({ ...IDLE, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
    driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 1);

    expect(driver.faults).toEqual(['rule.high.b-reverse-30cm-fail', 'rule.high.c-forward-30cm-fail']);
    expect(driver.phase).toBe('exit');
  });

  it('manual: scores a reverse made with the accelerator, and a stall as engine stopped', () => {
    const driver = throughStageOne('manual');
    driver.startEngine();
    driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: 'R' }, { type: 'handbrake', engaged: false });
    const startZ = driver.car.world.vehicle.z;
    driver.hold({ ...IDLE, clutch: 0.68, throttle: 0.3 }, (car) => car.world.vehicle.z < startZ - 0.3);
    driver.hold({ ...IDLE, clutch: 1, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
    driver.hold({ ...IDLE, clutch: 1, brake: 1 }, (_, t) => t > 1);
    expect(driver.faults).toEqual(['rule.high.b-reverse-30cm-fail']);

    driver.drive({ type: 'shift', to: '1' });
    driver.hold(IDLE, (car) => !car.powertrain.engineRunning);

    expect(driver.faults).toEqual(['rule.high.b-reverse-30cm-fail', 'rule.low.d-engine-stall']);
  });

  it('leaving the box properly scores nothing and ends this part of the exam', () => {
    const driver = inTheBoxAfterThirtyCentimetres('manual');

    driver.cabin({ type: 'signal', value: 'left' });
    driver.cabin({ type: 'look', yaw: 1.3, pitch: 0 });
    driver.cabin({ type: 'look', yaw: 0, pitch: 0 });
    driver.driveOut();

    expect(driver.faults).toEqual([]);
    expect(driver.phase).toBe('finished');
    expect(driver.session.measurements.exitManoeuvres).toBe(1);
  });

  it('scores leaving without the signal and without looking, and a scrape against a post', () => {
    const driver = inTheBoxAfterThirtyCentimetres('automatic');

    // Too close to the lane-side line: creeping forward in D touches the front post at walking pace.
    driver.cabin({ type: 'signal', value: 'off' });
    driver.place(-4.5);
    driver.hold({ ...IDLE, brake: 0.05 }, (car) => car.world.contacts.length > 0, 30);
    const impact = driver.car.world.contacts[0]?.impactSpeedMps ?? 0;
    driver.hold({ ...IDLE, brake: 1 }, (_, t) => t > 0.5);
    driver.drive({ type: 'shift', to: 'R' });
    driver.hold({ ...IDLE, brake: 0.05 }, (_, t) => t > 1.5);
    driver.hold({ ...IDLE, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);

    expect(impact).toBeGreaterThan(0);
    expect(impact).toBeLessThan(1);
    expect(driver.faults).toEqual([
      'rule.minor.j-no-signal-leaving-box',
      'rule.high.e-no-mirror-check-leaving-box',
      'rule.high.d-box-marker-touch',
    ]);
    expect(driver.phase).toBe('exit');
    expect(driver.session.measurements.exitManoeuvres).toBe(2);
  });

  it('hitting a post at speed or mounting the kerb eliminates and interrupts', () => {
    const driver = inTheBoxAfterThirtyCentimetres('automatic');
    driver.cabin({ type: 'signal', value: 'left' });
    driver.cabin({ type: 'look', yaw: 1.3, pitch: 0 });

    driver.place(-4.5);
    driver.hold({ ...IDLE, throttle: 1 }, (car) => car.world.contacts.length > 0, 30);

    expect(driver.faults).toEqual(['rule.eliminatory.d-curb-mount-or-marker-hit']);
    expect(driver.session.ledger.interruption?.cause).toBe('fault');
    expect(driver.phase).toBe('finished');
  });
});
