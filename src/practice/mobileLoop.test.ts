import { describe, expect, it } from 'vitest';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { ContinuousInput } from './continuousInput.ts';
import { EXAM_SPECS, initialCarState } from '../sim/car.ts';
import type { CarEvent } from '../sim/car.ts';
import { restingVehicle } from '../sim/vehicle.ts';
import { SIM_STEP_S as DT } from '../sim/fixedStep.ts';
import type { PowertrainCommand } from '../sim/powertrain/powertrain.ts';
import { assistedClutch } from './assistedClutch.ts';
import { rpmToRadS } from '../sim/powertrain/engine.ts';
import { Driver } from '../test/examDriver.ts';
import { observe } from '../exam/session.ts';
import { NEUTRAL_CONTROLS } from './controls.ts';

const WORLD = { obstacles: [], surface: { name: 'dry-asphalt', grip: 1 } };
const EMPTY = new Set<string>();
const PREPARED: PowertrainCommand[] = [{ type: 'insert-key' }, { type: 'turn-key', to: 'start' }];

function driver() {
  let frame = startDriving(restingVehicle(), 'manual', PREPARED);
  let atMs = 0;
  const events: CarEvent[] = [];
  const tick = (throttle = 0, brake = 0, commands: PowertrainCommand[] = [], keys = EMPTY) => {
    atMs += DT * 1000;
    frame = driveFrame(WORLD, frame, keys, [], DT, undefined, undefined, {
      frameEndMs: atMs,
      assistClutch: true,
      continuous: () => ({ throttle, brake, steer: 0 }),
      commands,
    });
    events.push(...frame.events);
    return frame;
  };
  const hold = (seconds: number, throttle = 0, brake = 0) => {
    for (let i = 0; i < seconds / DT; i++) tick(throttle, brake);
    return frame;
  };
  return {
    tick,
    hold,
    events,
    get frame() {
      return frame;
    },
  };
}

describe('continuous driving timeline', () => {
  it('produces exactly the same moving car at 30 and 120 FPS with timestamped tilt and pedals', () => {
    function run(hz: number) {
      const input = new ContinuousInput();
      for (let atMs = 0; atMs < 4000; atMs += 10) {
        const angle = atMs < 400 ? 0 : Math.sin(atMs / 800) * 50;
        const radians = ((angle + 90) * Math.PI) / 180;
        input.pushGravity({
          x: 9.80665 * Math.sin(radians),
          y: 9.80665 * Math.cos(radians),
          z: 0,
          screenAngleDeg: 90,
          landscape: true,
          atMs,
        });
      }
      input.pushPedals({ atMs: 0, throttle: 0, brake: 1 });
      input.pushPedals({ atMs: 520, throttle: 0.5, brake: 0 });
      input.pushPedals({ atMs: 1780, throttle: 0.8, brake: 0 });
      input.pushPedals({ atMs: 3510, throttle: 0, brake: 1 });
      let frame = startDriving(restingVehicle(), 'manual', PREPARED);
      for (let i = 1; i <= hz * 4; i++)
        frame = driveFrame(WORLD, frame, EMPTY, [], 1 / hz, undefined, undefined, {
          frameEndMs: (i * 1000) / hz,
          continuous: (atMs) => input.sample(atMs),
          assistClutch: true,
          commands:
            i === 1
              ? [
                  { type: 'shift', to: '1' },
                  { type: 'handbrake', engaged: false },
                ]
              : [],
        });
      return frame;
    }
    const slow = run(30);
    const fast = run(120);
    expect(slow.stepper.state).toEqual(fast.stepper.state);
    expect(slow.stepper.state.world.vehicle.odometerM).toBeGreaterThan(1);
    expect(slow.stepper.state.world.vehicle.headingRad).not.toBe(0);
  });
  it('centers expired tilt, honors takeover during the frame and clears a pending assisted shift', () => {
    const input = new ContinuousInput();
    for (let atMs = 0; atMs <= 400; atMs += 20)
      input.pushGravity({
        x: atMs <= 300 ? 9.8 : 5,
        y: atMs <= 300 ? 0 : -8.4,
        z: 0,
        atMs,
        screenAngleDeg: 90,
        landscape: true,
      });
    let frame = startDriving(restingVehicle(), 'manual', PREPARED);
    for (let i = 1; i <= 300; i++)
      frame = driveFrame(WORLD, frame, EMPTY, [], DT, undefined, undefined, {
        frameEndMs: i * DT * 1000,
        continuous: (t) => input.sample(t),
      });
    expect(frame.controls.steer).toBe(0);
    let blocked = false;
    frame = driveFrame(
      WORLD,
      frame,
      () => (blocked ? new Set(['ArrowDown', 'ShiftLeft']) : EMPTY),
      [],
      0.1,
      undefined,
      () => {
        blocked = true;
      },
      {
        frameEndMs: 2600,
        assistClutch: true,
        commands: [{ type: 'shift', to: '1' }],
        continuous: () => ({ throttle: 1, steer: 1 }),
        blocked: () => blocked,
      },
    );
    expect(frame.pendingShift).toBeNull();
    expect(frame.controls.brake).toBeGreaterThan(0);
    expect(frame.stepper.state.powertrain.manualGear).toBe('N');
    const ignored = driveFrame(WORLD, frame, EMPTY, [], 0, undefined, undefined, {
      frameEndMs: 2600,
      commands: [{ type: 'handbrake', engaged: false }],
      blocked: () => true,
    });
    expect(ignored.stepper.state.powertrain.handbrake).toBe(true);
  });
});

describe('manual clutch assistant with unchanged physics', () => {
  it('rejects reverse at request time even when braking would stop the car before the clutch opens', () => {
    let frame = startDriving({ ...restingVehicle(), speedMps: 0.51 }, 'manual', PREPARED);
    const observations: CarEvent[] = [];
    frame = driveFrame(WORLD, frame, EMPTY, [], DT, undefined, (_, events) => observations.push(...events), {
      assistClutch: true,
      commands: [{ type: 'shift', to: 'R' }],
      continuous: () => ({ brake: 1 }),
    });
    expect(frame.events).toContainEqual({ type: 'shift-refused', to: 'R', reason: 'moving' });
    expect(observations).toContainEqual({ type: 'shift-refused', to: 'R', reason: 'moving' });
    expect(frame.pendingShift).toBeNull();
    for (let step = 0; step < 60; step++)
      frame = driveFrame(WORLD, frame, EMPTY, [], DT, undefined, undefined, {
        assistClutch: true,
        continuous: () => ({ brake: 1 }),
      });
    expect(frame.stepper.state.world.vehicle.speedMps).toBe(0);
    expect(frame.stepper.state.powertrain.manualGear).toBe('N');
  });

  it('keeps accelerating through clutch synchronization at full throttle', () => {
    const d = driver();
    d.tick(1, 0, [
      { type: 'shift', to: '1' },
      { type: 'handbrake', engaged: false },
    ]);
    let previousSpeed = 0;
    for (let sample = 0; sample < 6; sample++) {
      const car = d.hold(0.5, 1).stepper.state;
      expect(car.world.vehicle.speedMps).toBeGreaterThan(previousSpeed);
      expect(car.powertrain.engineRunning).toBe(true);
      previousSpeed = car.world.vehicle.speedMps;
    }
    expect(previousSpeed).toBeGreaterThan(8);
  });
  it('waits for the pressed threshold before shifting, supports every gear, and keeps the handbrake stationary', () => {
    const d = driver();
    expect(d.tick(0, 0, [{ type: 'shift', to: '1' }]).stepper.state.powertrain.manualGear).toBe('N');
    expect(d.hold(0.15).stepper.state.powertrain.manualGear).toBe('N');
    expect(d.hold(0.15).stepper.state.powertrain.manualGear).toBe('1');
    expect(d.frame.controls.clutch).toBe(1);
    expect(d.hold(1, 1).stepper.state.world.vehicle.odometerM).toBe(0);
    for (const to of ['2', '3', '4', '5', 'R', 'N'] as const) {
      d.tick(0, 0, [{ type: 'shift', to }]);
      expect(d.hold(0.3).stepper.state.powertrain.manualGear).toBe(to);
    }
    expect(d.events.some((event) => event.type === 'shift-refused')).toBe(false);
  });
  it.each(['1', 'R'] as const)('creeps near 0.3 m/s in %s, stops within 5 cm and never stalls', (to) => {
    const d = driver();
    d.tick(0, 0, [
      { type: 'shift', to },
      { type: 'handbrake', engaged: false },
    ]);
    const car = d.hold(5).stepper.state;
    expect(Math.abs(car.world.vehicle.speedMps)).toBeCloseTo(0.3, 1);
    expect(Math.sign(car.world.vehicle.speedMps)).toBe(to === 'R' ? -1 : 1);
    const distance = car.world.vehicle.odometerM;
    const stopped = d.hold(1, 0, 1).stepper.state;
    expect(stopped.world.vehicle.speedMps).toBe(0);
    expect(stopped.world.vehicle.odometerM - distance).toBeLessThan(0.05);
    expect(d.events.some((event) => event.type === 'stall')).toBe(false);
  });
  it.each([0.1, 0.3, 0.6, 1])('pulls away and changes up at throttle %s without stalling', (throttle) => {
    const d = driver();
    d.tick(0, 0, [
      { type: 'shift', to: '1' },
      { type: 'handbrake', engaged: false },
    ]);
    const moving = d.hold(8, throttle).stepper.state;
    expect(moving.world.vehicle.speedMps).toBeGreaterThan(0.5);
    d.tick(throttle, 0, [{ type: 'shift', to: '2' }]);
    expect(d.hold(4, throttle).stepper.state.powertrain.manualGear).toBe('2');
    d.tick(throttle, 0, [{ type: 'shift', to: 'R' }]);
    d.hold(0.5, throttle);
    expect(d.events.some((event) => event.type === 'shift-refused' && event.reason === 'moving')).toBe(true);
    d.hold(5, 0, 1);
    expect(d.events.some((event) => event.type === 'stall')).toBe(false);
    expect(d.frame.stepper.state.world.vehicle.speedMps).toBe(0);
  });
  it('does not bypass engine-off starting restrictions and keeps a manually pressed clutch', () => {
    const d = driver();
    d.tick(0, 0, [{ type: 'shift', to: '1' }]);
    d.hold(0.5);
    d.tick(0, 0, [{ type: 'turn-key', to: 'off' }]);
    expect(d.hold(0.1).controls.clutch).toBe(0);
    d.tick(0, 0, [{ type: 'turn-key', to: 'start' }]);
    expect(d.events).toContainEqual({ type: 'start-refused', reason: 'in-gear' });
    for (let i = 0; i < 40; i++) d.tick(0, 0, [], new Set(['ShiftLeft']));
    expect(d.frame.controls.clutch).toBe(1);
    d.tick(0, 0, [{ type: 'turn-key', to: 'start' }]);
    expect(d.frame.stepper.state.powertrain.engineRunning).toBe(true);
  });
  it('rejects starting in gear during an engine-off assisted shift', () => {
    let frame = startDriving(restingVehicle(), 'manual', [{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }]);
    for (let i = 1; i <= 26; i++)
      frame = driveFrame(WORLD, frame, EMPTY, [], DT, undefined, undefined, {
        frameEndMs: i * DT * 1000,
        assistClutch: true,
        commands: i === 1 ? [{ type: 'shift', to: '1' }] : [],
      });
    expect(frame.controls.clutch).toBeGreaterThanOrEqual(0.85);
    frame = driveFrame(WORLD, frame, EMPTY, ['KeyK'], 0, undefined, undefined, { frameEndMs: 220, assistClutch: true });
    expect(frame.events).toContainEqual({ type: 'start-refused', reason: 'in-gear' });
  });
  it('releases in neutral and normal running, presses at low rpm without throttle', () => {
    let car = initialCarState(restingVehicle(), 'manual');
    expect(assistedClutch(1, car, NEUTRAL_CONTROLS, false, DT, EXAM_SPECS)).toBe(0);
    car = {
      ...car,
      powertrain: {
        ...car.powertrain,
        engineRunning: true,
        handbrake: false,
        manualGear: '2',
        engineRadS: rpmToRadS(2000),
      },
    };
    expect(assistedClutch(1, car, NEUTRAL_CONTROLS, false, 0.4, EXAM_SPECS)).toBe(0);
    car.powertrain.engineRadS = rpmToRadS(900);
    expect(assistedClutch(0, car, NEUTRAL_CONTROLS, false, 0.25, EXAM_SPECS)).toBe(1);
  });
  it('completes both exam 30 cm manoeuvres without throttle or wheel faults', () => {
    const exam = new Driver('manual');
    exam.ready();
    exam.recognise();
    exam.prepareProperly();
    exam.startEngine();
    let frame = {
      ...startDriving(exam.car.world.vehicle, 'manual'),
      stepper: { state: exam.car, previous: exam.car, accumulatorS: 0 },
    };
    let atMs = 0;
    const tick = (brake: number, commands: PowertrainCommand[] = []) => {
      atMs += DT * 1000;
      frame = driveFrame(
        exam.world,
        frame,
        EMPTY,
        [],
        DT,
        undefined,
        (car, events, dt, scenario) => {
          exam.session = observe(exam.session, { type: 'step', car, events, dt, scenario, cockpit: exam.cockpit });
        },
        { frameEndMs: atMs, assistClutch: true, commands, continuous: () => ({ throttle: 0, brake, steer: 0 }) },
      );
    };
    for (const to of ['R', '1'] as const) {
      tick(1, [
        { type: 'shift', to },
        { type: 'handbrake', engaged: false },
      ]);
      for (let i = 0; i < 60; i++) tick(1);
      const origin = frame.stepper.state.world.vehicle.odometerM;
      for (let i = 0; i < 1000 && frame.stepper.state.world.vehicle.odometerM - origin < 0.28; i++) tick(0);
      for (let i = 0; i < 150; i++) tick(1);
    }
    expect(exam.faults).toEqual([]);
    expect(exam.phase).toBe('exit');
  });
});
