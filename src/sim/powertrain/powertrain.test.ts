import { describe, expect, it } from 'vitest';
import { EXAM_POWERTRAIN, applyCommand, initialPowertrain, stepPowertrain } from './powertrain.ts';
import type { Pedals, PowertrainState } from './powertrain.ts';
import { radSToRpm, rpmToRadS } from './engine.ts';

const MASS = 1150;
const DT = 1 / 120;
const NO_PEDALS: Pedals = { throttle: 0, brake: 0, clutch: 0 };
const running = (overrides: Partial<PowertrainState> = {}): PowertrainState => ({
  ...initialPowertrain('manual'),
  key: 'on',
  engineRunning: true,
  engineRadS: rpmToRadS(EXAM_POWERTRAIN.engine.idleRpm),
  handbrake: false,
  ...overrides,
});

function idleFor(state: PowertrainState, pedals: Pedals, speedMps: number, seconds: number) {
  let current = state;
  let last = stepPowertrain(EXAM_POWERTRAIN, current, pedals, speedMps, MASS, DT);
  for (let t = 0; t < seconds; t += DT) {
    last = stepPowertrain(EXAM_POWERTRAIN, current, pedals, speedMps, MASS, DT);
    current = last.state;
  }
  return last;
}

describe('powertrain', () => {
  it('revs freely in neutral up to the fuel cut', () => {
    const revved = idleFor(running(), { ...NO_PEDALS, throttle: 1 }, 0, 3);

    expect(radSToRpm(revved.state.engineRadS)).toBeLessThanOrEqual(EXAM_POWERTRAIN.engine.maxRpm + 50);
    expect(radSToRpm(revved.state.engineRadS)).toBeGreaterThan(5000);
    expect(revved.tractionN).toBe(0);
  });

  it('settles at idle with no load and the accelerator released', () => {
    const settled = idleFor(running({ engineRadS: rpmToRadS(3000) }), NO_PEDALS, 0, 5);

    expect(radSToRpm(settled.state.engineRadS)).toBeCloseTo(EXAM_POWERTRAIN.engine.idleRpm, -1);
  });

  it('shifts the automatic up and down with speed, with hysteresis', () => {
    const inD = running({ kind: 'automatic', lever: 'D' });

    const at25 = stepPowertrain(EXAM_POWERTRAIN, inD, NO_PEDALS, 25 / 3.6, MASS, DT).state;
    const back15 = stepPowertrain(EXAM_POWERTRAIN, at25, NO_PEDALS, 15 / 3.6, MASS, DT).state;
    const at10 = stepPowertrain(EXAM_POWERTRAIN, back15, NO_PEDALS, 10 / 3.6, MASS, DT).state;

    expect(at25.autoGear).toBe(2);
    expect(back15.autoGear).toBe(2);
    expect(at10.autoGear).toBe(1);
  });

  it('holds the car in P, with the handbrake, and with a stopped engine in gear', () => {
    const parked = stepPowertrain(
      EXAM_POWERTRAIN,
      { ...initialPowertrain('automatic'), handbrake: false },
      NO_PEDALS,
      0,
      MASS,
      DT,
    );
    const handbrake = stepPowertrain(EXAM_POWERTRAIN, initialPowertrain('manual'), NO_PEDALS, 0, MASS, DT);
    const inGear = stepPowertrain(
      EXAM_POWERTRAIN,
      { ...initialPowertrain('manual'), manualGear: '1', handbrake: false },
      NO_PEDALS,
      0,
      MASS,
      DT,
    );
    const neutral = stepPowertrain(
      EXAM_POWERTRAIN,
      { ...initialPowertrain('manual'), handbrake: false },
      NO_PEDALS,
      0,
      MASS,
      DT,
    );

    expect(parked.holdN).toBe(EXAM_POWERTRAIN.parkHoldN);
    expect(handbrake.holdN).toBeCloseTo(EXAM_POWERTRAIN.handbrakeDecelMps2 * MASS, 6);
    expect(inGear.holdN).toBeGreaterThan(1000);
    expect(neutral.holdN).toBe(0);
  });

  it('drives the key: insert, contact, start, stop and remove, with events', () => {
    let state = initialPowertrain('manual');
    const events: string[] = [];
    for (const next of [
      { type: 'insert-key' },
      { type: 'turn-key', to: 'start' },
      { type: 'turn-key', to: 'off' },
      { type: 'remove-key' },
    ] as const) {
      const result = applyCommand(EXAM_POWERTRAIN, state, next, NO_PEDALS, 0);
      state = result.state;
      events.push(...result.events.map((event) => event.type));
    }

    expect(events).toEqual(['key-inserted', 'engine-started', 'engine-stopped', 'key-removed']);
    expect(state.key).toBe('removed');
  });

  it('refuses invalid positions and reverse while rolling forward', () => {
    const manual = running();
    const automatic = running({ kind: 'automatic', lever: 'D' });

    expect(
      applyCommand(EXAM_POWERTRAIN, manual, { type: 'shift', to: 'D' }, { ...NO_PEDALS, clutch: 1 }, 0).events,
    ).toEqual([{ type: 'shift-refused', to: 'D', reason: 'invalid' }]);
    expect(
      applyCommand(EXAM_POWERTRAIN, manual, { type: 'shift', to: 'R' }, { ...NO_PEDALS, clutch: 1 }, 3).events[0],
    ).toMatchObject({ reason: 'moving' });
    expect(
      applyCommand(EXAM_POWERTRAIN, automatic, { type: 'shift', to: 'P' }, { ...NO_PEDALS, brake: 1 }, 3).events[0],
    ).toMatchObject({ reason: 'moving' });
    expect(applyCommand(EXAM_POWERTRAIN, automatic, { type: 'shift', to: '3' }, NO_PEDALS, 0).events[0]).toMatchObject({
      reason: 'invalid',
    });
  });
});
