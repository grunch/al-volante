import { describe, expect, it } from 'vitest';
import { SIM_STEP_S } from '../fixedStep.ts';
import { EXAM_CAR, restingVehicle } from '../vehicle.ts';
import { DRY_ASPHALT } from '../dynamics.ts';
import type { World } from '../world.ts';
import { command, initialCarState, stepCar } from '../car.ts';
import type { CarControls, CarEvent, CarState } from '../car.ts';
import type { TransmissionKind } from './powertrain.ts';

/**
 * The procedures of the exam protocol (REGLAS.md §3, protocolo PDF 9–13) driven step by step in both transmissions.
 * A procedure is a sequence of commands and pedal phases; each phase holds the controls until a condition is met.
 */
const OPEN_YARD: World = { surface: DRY_ASPHALT, obstacles: [] };
const IDLE: CarControls = { throttle: 0, brake: 0, clutch: 0, steer: 0 };
const KMH = 3.6;

interface Run {
  state: CarState;
  events: CarEvent[];
}

function hold(run: Run, controls: CarControls, until: (state: CarState, elapsedS: number) => boolean, maxS = 20): Run {
  let { state } = run;
  const events = [...run.events];
  for (let t = 0; t < maxS; t += SIM_STEP_S) {
    if (until(state, t)) return { state, events };
    const result = stepCar(OPEN_YARD, state, controls, SIM_STEP_S);
    state = result.state;
    events.push(...result.events);
  }
  throw new Error(`condition not met in ${maxS} s`);
}

function apply(run: Run, ...commands: Parameters<typeof command>[1][]): Run {
  let { state } = run;
  const events = [...run.events];
  for (const next of commands) {
    const result = command(state, next);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

const types = (run: Run) => run.events.map((event) => event.type);
const speedKmh = (state: CarState) => state.world.vehicle.speedMps * KMH;
const z = (state: CarState) => state.world.vehicle.z;

/** Stage I state: in the box, engine off, key in contact, handbrake on (protocolo PDF 9). */
function inTheBox(kind: TransmissionKind): Run {
  return apply(
    { state: initialCarState(restingVehicle(), kind), events: [] },
    { type: 'insert-key' },
    { type: 'turn-key', to: 'on' },
  );
}

/** Starts the engine the way each transmission requires: clutch pressed in neutral, or lever in P. */
function started(kind: TransmissionKind): Run {
  const run = inTheBox(kind);
  const pressed = hold(run, { ...IDLE, clutch: 1, brake: 1 }, (_, t) => t > 0.1);
  return apply(pressed, { type: 'turn-key', to: 'start' });
}

describe('stage I and engine start (protocolo PDF 9–10)', () => {
  it('starts with the engine off, key in contact and handbrake on; the manual starts in neutral', () => {
    const run = inTheBox('manual');

    expect(run.state.powertrain).toMatchObject({ key: 'on', engineRunning: false, handbrake: true, manualGear: 'N' });
    expect(types(started('manual'))).toContain('engine-started');
  });

  it('refuses to start the manual in gear with the clutch released, and the automatic outside P or N', () => {
    const inGear = apply(
      hold(inTheBox('manual'), { ...IDLE, clutch: 1 }, (_, t) => t > 0.1),
      { type: 'shift', to: '1' },
    );
    const released = hold(inGear, IDLE, (_, t) => t > 0.1);

    expect(types(apply(released, { type: 'turn-key', to: 'start' }))).toContain('start-refused');
    const automatic = apply(
      hold(inTheBox('automatic'), { ...IDLE, brake: 1 }, (_, t) => t > 0.1),
      { type: 'shift', to: 'R' },
    );
    expect(types(apply(automatic, { type: 'turn-key', to: 'start' }))).toContain('start-refused');
  });
});

describe('moving 30 cm in the box (protocolo PDF 11)', () => {
  it('manual: reverses 30 cm with the clutch alone, no accelerator, without stalling', () => {
    // Arrange: engine idling, reverse engaged, handbrake released.
    let run = apply(started('manual'), { type: 'shift', to: 'R' }, { type: 'handbrake', engaged: false });
    const startZ = z(run.state);

    // Act: let the clutch up to the biting point, then press it again (and brake at the end, as allowed).
    run = hold(run, { ...IDLE, clutch: 0.68 }, (state) => z(state) < startZ - 0.25);
    run = hold(run, { ...IDLE, clutch: 1, brake: 1 }, (state) => state.world.vehicle.speedMps === 0);

    // Assert
    expect(startZ - z(run.state)).toBeGreaterThan(0.25);
    expect(startZ - z(run.state)).toBeLessThan(0.4);
    expect(types(run)).not.toContain('stall');
    expect(run.state.powertrain.engineRunning).toBe(true);
  });

  it('manual: moves forward 30 cm in first in one manoeuvre', () => {
    let run = apply(started('manual'), { type: 'shift', to: '1' }, { type: 'handbrake', engaged: false });
    const startZ = z(run.state);

    run = hold(run, { ...IDLE, clutch: 0.68 }, (state) => z(state) > startZ + 0.25);
    run = hold(run, { ...IDLE, clutch: 1, brake: 1 }, (state) => state.world.vehicle.speedMps === 0);

    expect(z(run.state) - startZ).toBeGreaterThan(0.25);
    expect(z(run.state) - startZ).toBeLessThan(0.4);
    expect(types(run)).not.toContain('stall');
  });

  it('automatic: reverses 30 cm regulating only with the brake, and moves forward 30 cm in D', () => {
    let run = apply(
      hold(started('automatic'), { ...IDLE, brake: 1 }, (_, t) => t > 0.1),
      { type: 'shift', to: 'R' },
      { type: 'handbrake', engaged: false },
    );
    const startZ = z(run.state);

    // Easing off the brake lets the converter creep the car backwards; braking again stops it.
    run = hold(run, { ...IDLE, brake: 0.05 }, (state) => z(state) < startZ - 0.25);
    run = hold(run, { ...IDLE, brake: 1 }, (state) => state.world.vehicle.speedMps === 0);
    expect(startZ - z(run.state)).toBeGreaterThan(0.25);
    expect(startZ - z(run.state)).toBeLessThan(0.4);

    run = apply(run, { type: 'shift', to: 'D' });
    const backZ = z(run.state);
    run = hold(run, { ...IDLE, brake: 0.05 }, (state) => z(state) > backZ + 0.25);
    run = hold(run, { ...IDLE, brake: 1 }, (state) => state.world.vehicle.speedMps === 0);
    expect(z(run.state) - backZ).toBeGreaterThan(0.25);
    expect(z(run.state) - backZ).toBeLessThan(0.4);
  });
});

describe('first 100 m (protocolo PDF 11, 31)', () => {
  it('manual: pulls away in first, changes to second and covers 100 m under 30 km/h without stalling', () => {
    let run = apply(started('manual'), { type: 'shift', to: '1' }, { type: 'handbrake', engaged: false });
    // Biting point with some throttle until first gear reaches its idle speed (about 6.5 km/h), then release fully.
    run = hold(run, { ...IDLE, clutch: 0.66, throttle: 0.3 }, (state) => speedKmh(state) > 7);
    run = hold(run, { ...IDLE, clutch: 0.3, throttle: 0.3 }, (state) => speedKmh(state) > 9);
    run = hold(run, { ...IDLE, clutch: 1 }, (_, t) => t > 0.3);
    run = apply(run, { type: 'shift', to: '2' });
    run = hold(run, { ...IDLE, clutch: 0.4, throttle: 0.2 }, (_, t) => t > 0.8);
    const startZ = z(run.state);
    let fastest = 0;
    run = hold(
      run,
      { ...IDLE, throttle: 0.22 },
      (state) => {
        fastest = Math.max(fastest, speedKmh(state));
        return z(state) > startZ + 100;
      },
      60,
    );

    expect(run.state.powertrain.manualGear).toBe('2');
    expect(types(run)).not.toContain('stall');
    expect(fastest).toBeLessThanOrEqual(30);
  });

  it('automatic: covers 100 m in D under 30 km/h', () => {
    const run = apply(
      hold(started('automatic'), { ...IDLE, brake: 1 }, (_, t) => t > 0.1),
      { type: 'shift', to: 'D' },
      { type: 'handbrake', engaged: false },
    );
    const startZ = z(run.state);
    let fastest = 0;
    const finished = hold(
      run,
      { ...IDLE, throttle: 0.2 },
      (state) => {
        fastest = Math.max(fastest, speedKmh(state));
        return z(state) > startZ + 100;
      },
      60,
    );

    expect(finished.state.powertrain.lever).toBe('D');
    expect(fastest).toBeLessThanOrEqual(30);
    expect(fastest).toBeGreaterThan(15);
  });
});

describe('mistakes the exam penalises', () => {
  it('stalls the manual when the clutch is released at once without accelerating (falta: apagado del motor)', () => {
    let run = apply(started('manual'), { type: 'shift', to: '1' }, { type: 'handbrake', engaged: false });

    run = hold(run, IDLE, (state) => !state.powertrain.engineRunning, 3);

    expect(types(run)).toContain('stall');
  });

  it('reports moving off with the handbrake applied (falta f, etapa I)', () => {
    let run = apply(started('manual'), { type: 'shift', to: '1' });

    // Enough clutch and throttle to overcome the handbrake without stalling.
    run = hold(run, { ...IDLE, clutch: 0.58, throttle: 1 }, (state) => speedKmh(state) > 2, 5);

    expect(types(run).filter((type) => type === 'moved-with-handbrake')).toHaveLength(1);
  });

  it('refuses a manual gear change without the clutch, and leaving P without the brake', () => {
    const grind = apply(started('manual'), { type: 'shift', to: '1' });
    const released = hold(grind, IDLE, (_, t) => t > 0.1);

    expect(released.state.powertrain.manualGear).toBe('1');
    expect(types(apply(released, { type: 'shift', to: '2' }))).toContain('shift-refused');
    const automatic = hold(started('automatic'), IDLE, (_, t) => t > 0.1);
    expect(types(apply(automatic, { type: 'shift', to: 'D' }))).toContain('shift-refused');
  });
});

describe('finishing (protocolo PDF 13, 25)', () => {
  it('leaves the car in N or P with the handbrake, engine off and key removed', () => {
    const manual = apply(started('manual'), { type: 'turn-key', to: 'off' }, { type: 'remove-key' });
    const automatic = apply(started('automatic'), { type: 'turn-key', to: 'off' }, { type: 'remove-key' });

    expect(manual.state.powertrain).toMatchObject({
      manualGear: 'N',
      handbrake: true,
      engineRunning: false,
      key: 'removed',
    });
    expect(automatic.state.powertrain).toMatchObject({
      lever: 'P',
      handbrake: true,
      engineRunning: false,
      key: 'removed',
    });
    expect(types(manual)).toContain('engine-stopped');
  });

  it('keeps the key in while the engine runs, and in the automatic outside P', () => {
    const running = apply(started('manual'), { type: 'remove-key' });
    const outsideP = apply(
      apply(
        hold(started('automatic'), { ...IDLE, brake: 1 }, (_, t) => t > 0.1),
        { type: 'shift', to: 'N' },
      ),
      { type: 'turn-key', to: 'off' },
      { type: 'remove-key' },
    );

    expect(running.state.powertrain.key).toBe('on');
    expect(outsideP.state.powertrain.key).toBe('off');
  });
});

describe('vehicle limits still hold', () => {
  it('cannot be driven at all with the engine off', () => {
    const run = hold(
      apply(inTheBox('manual'), { type: 'handbrake', engaged: false }),
      { ...IDLE, throttle: 1 },
      (_, t) => t > 2,
    );

    expect(run.state.world.vehicle.speedMps).toBe(0);
    expect(EXAM_CAR.massKg).toBeGreaterThan(0);
  });
});
