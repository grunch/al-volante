import { describe, expect, it } from 'vitest';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { Driver, IDLE } from '../test/examDriver.ts';
import { settleCirculation } from './session.ts';

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

const MANUAL_GEAR_ROUND = ['1', '2', '3', '4', '5', '4', '3', '2', '1', 'N', 'R', 'N'].map((gear) => `gear-${gear}`);
const ALL_TARGETS = [
  'clutch',
  'brake',
  'throttle',
  ...MANUAL_GEAR_ROUND,
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
    expect(targets.filter((target) => target.startsWith('gear-'))).toEqual(
      ['R', 'N', 'D', 'N', 'R', 'P'].map((gear) => `gear-${gear}`),
    );
    expect(driver.faults).toEqual([]);
  });

  it('scores the lights and the instruments once each however many are wrong; pedals and gearbox eliminate', () => {
    const driver = new Driver('manual', 3);
    driver.ready();
    const wrong: Record<string, string> = {
      clutch: 'brake',
      brake: 'throttle',
      throttle: 'clutch',
      // Asked first from neutral, the driver goes to reverse: away from it (eliminatory b, once).
      'gear-1': 'gear-R',
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

  it('asks the gearbox in its order and takes the gears on the way to the asked one as steps, not answers', () => {
    const driver = new Driver('manual', 5);
    driver.ready();
    while (driver.session.prompt.kind === 'recognise' && !driver.session.prompt.target.startsWith('gear-'))
      driver.answer(driver.session.prompt.target);
    expect(driver.session.prompt).toEqual({ kind: 'recognise', target: 'gear-1' });

    // Asked second from first, going back to neutral is away from it (a wrong answer); then, asked third,
    // second is on the way (not an answer) and third answers.
    driver.answer('gear-1');
    expect(driver.session.prompt).toEqual({ kind: 'recognise', target: 'gear-2' });
    driver.answer('gear-N');
    expect(driver.faults).toEqual(['rule.eliminatory.b-gearbox-not-handled']);
    expect(driver.session.prompt).toEqual({ kind: 'recognise', target: 'gear-3' });
    driver.answer('gear-2');
    expect(driver.session.prompt).toEqual({ kind: 'recognise', target: 'gear-3' });
    driver.answer('gear-3');
    expect(driver.session.prompt).toEqual({ kind: 'recognise', target: 'gear-4' });
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

  it('needs all three mirrors checked, and forgets adjustments made while familiarising', () => {
    const driver = new Driver('manual');
    // Adjusted during the familiarisation: the cabin is put back when the recognition starts.
    driver.cabin({ type: 'adjust', control: 'seatDistance', value: 0.7 });
    driver.ready();
    driver.recognise();
    driver.cabin({ type: 'adjust', control: 'headrest', value: 0.6 });
    driver.cabin({ type: 'mirror', mirror: 'left', axis: 'yaw', value: 0.1 });
    driver.cabin({ type: 'mirror', mirror: 'center', axis: 'pitch', value: 0.1 });
    driver.cabin({ type: 'toggle', control: 'belt' });
    driver.ready();

    expect([...driver.faults].sort()).toEqual(['rule.high.a-mirrors-not-checked', 'rule.minor.c-seat-adjustment']);
  });

  it('switching an instrument off is not an answer to the next question', () => {
    const driver = new Driver('manual', 3);
    driver.ready();
    while (driver.session.prompt.kind === 'recognise' && driver.session.prompt.target !== 'wipers')
      driver.answer(driver.session.prompt.target);
    driver.answer('wipers');
    const next = driver.session.prompt;

    driver.cabin({ type: 'toggle', control: 'wipers' });

    expect(driver.session.prompt).toEqual(next);
    expect(driver.faults).toEqual([]);
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

  it('manual: starting in gear with the clutch down works, but neutral was not checked', () => {
    const driver = throughStageOne('manual');
    driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: '1' });

    driver.drive({ type: 'turn-key', to: 'start' });

    expect(driver.car.powertrain.engineRunning).toBe(true);
    expect(driver.faults).toEqual(['rule.minor.e-neutral-check-before-start']);
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

  it('manual: advancing the 30 cm in second instead of first fails the manoeuvre', () => {
    const driver = throughStageOne('manual');
    driver.startEngine();
    driver.moveInBox(-0.3);
    driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: '2' });
    const startZ = driver.car.world.vehicle.z;
    driver.hold({ ...IDLE, clutch: 0.68, throttle: 0 }, (car) => car.world.vehicle.z > startZ + 0.3, 20);
    driver.hold({ ...IDLE, clutch: 1, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
    driver.hold({ ...IDLE, clutch: 1, brake: 1 }, (_, t) => t > 1);

    expect(driver.faults).toEqual(['rule.high.c-forward-30cm-fail']);
  });

  it('leaving the box properly scores nothing and ends this part of the exam', () => {
    const driver = inTheBoxAfterThirtyCentimetres('manual');

    driver.cabin({ type: 'signal', value: 'left' });
    // A full head turn is only a complement (X6); the glance at the side mirror is what counts.
    driver.cabin({ type: 'look', yaw: 1.3, pitch: 0 });
    expect(driver.session.exit.looked).toBe(false);
    driver.cabin({ type: 'look', yaw: 0.5, pitch: 0 });
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

    // High e escalates: a takeover right after raises it to eliminatory instead of adding a reckless manoeuvre.
    const taken = settleCirculation(driver.session, { reports: [], takeover: true, done: false });
    expect(taken.ledger.faults.filter((fault) => fault.escalated).map((fault) => fault.ruleId)).toEqual([
      'rule.high.e-no-mirror-check-leaving-box',
    ]);
    expect(taken.ledger.faults.map((fault) => fault.ruleId)).not.toContain('rule.eliminatory.i-reckless-maneuver');
    expect(taken.ledger.interruption?.cause).toBe('examiner');
  });

  it('a takeover in the same step as an interrupting fault is still applied, and the interruption is the examiner’s', () => {
    const driver = new Driver('automatic');
    const taken = settleCirculation(driver.session, {
      reports: [{ ruleId: 'rule.eliminatory.k-red-light' }],
      takeover: true,
      done: false,
    });
    expect(taken.phase).toBe('finished');
    expect(taken.street.takeover).toBe(true);
    expect(taken.ledger.faults.map((fault) => fault.ruleId)).toEqual([
      'rule.eliminatory.k-red-light',
      'rule.eliminatory.i-reckless-maneuver',
    ]);
    expect(taken.ledger.interruption).toMatchObject({ ruleId: 'rule.eliminatory.k-red-light', cause: 'examiner' });
  });

  it('manual: regulating the reverse with the brake, instead of braking only to stop, fails it', () => {
    const driver = throughStageOne('manual');
    driver.startEngine();
    driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: 'R' }, { type: 'handbrake', engaged: false });
    const startZ = driver.car.world.vehicle.z;

    // Brake while still moving well short of the 30 cm, then keep going on the clutch alone.
    driver.hold({ ...IDLE, clutch: 0.68 }, (car) => car.world.vehicle.z < startZ - 0.08);
    driver.hold({ ...IDLE, clutch: 0.68, brake: 0.15 }, (_, t) => t > 0.3);
    driver.hold({ ...IDLE, clutch: 0.68 }, (car) => car.world.vehicle.z < startZ - 0.28);
    driver.hold({ ...IDLE, clutch: 1, brake: 1 }, (car) => car.world.vehicle.speedMps === 0);
    driver.hold({ ...IDLE, clutch: 1, brake: 1 }, (_, t) => t > 1);

    expect(driver.session.measurements.reverseCm).toBeGreaterThan(20);
    expect(driver.faults).toEqual(['rule.high.b-reverse-30cm-fail']);
  });

  it('scraping the kerb with a wheel at walking pace is a minor fault, not mounting it', () => {
    const driver = inTheBoxAfterThirtyCentimetres('automatic');
    driver.cabin({ type: 'signal', value: 'left' });
    driver.cabin({ type: 'look', yaw: 0.5, pitch: 0 });

    // Creep forward steering right from just off the kerb: the nose touches it slowly.
    driver.place(-5.5);
    driver.hold({ ...IDLE, brake: 0.05, steer: -1 }, (car) => car.world.contacts.length > 0, 30);

    expect(driver.car.world.contacts[0]?.kind).toBe('curb');
    expect(driver.faults).toEqual(['rule.minor.i-curb-scrape']);
    expect(driver.phase).toBe('exit');
  });

  it('hitting a post at speed or mounting the kerb eliminates and interrupts', () => {
    const driver = inTheBoxAfterThirtyCentimetres('automatic');
    driver.cabin({ type: 'signal', value: 'left' });
    driver.cabin({ type: 'look', yaw: 0.5, pitch: 0 });

    driver.place(-4.5);
    driver.hold({ ...IDLE, throttle: 1 }, (car) => car.world.contacts.length > 0, 30);

    expect(driver.faults).toEqual(['rule.eliminatory.d-curb-mount-or-marker-hit']);
    expect(driver.session.ledger.interruption?.cause).toBe('fault');
    expect(driver.phase).toBe('finished');
  });
});

describe('car events in stage III (protocolo PDF 15–17)', () => {
  it('score only the rules the ficha lists for the parking: a stall or a refused start there is not a fault', () => {
    const driver = new Driver('manual');
    driver.session = { ...driver.session, phase: 'parking' };
    driver.see({
      type: 'step',
      car: driver.car,
      cockpit: driver.cockpit,
      events: [
        { type: 'stall' },
        { type: 'start-refused', reason: 'running' },
        { type: 'start-refused', reason: 'in-gear' },
        { type: 'moved-with-handbrake' },
        { type: 'contact', obstacleId: 'curb-1', kind: 'curb', impactSpeedMps: 0.5 },
      ],
      dt: 0,
      scenario: null,
    });
    expect(driver.faults).toEqual(['rule.minor.i-curb-scrape']);

    // The same events while driving in stage II do score.
    const circulating = new Driver('manual');
    circulating.session = { ...circulating.session, phase: 'circulation' };
    circulating.see({
      type: 'step',
      car: circulating.car,
      cockpit: { ...circulating.cockpit, belt: true },
      events: [{ type: 'stall' }],
      dt: 0,
      scenario: null,
    });
    expect(circulating.faults).toContain('rule.low.d-engine-stall');
  });
});
