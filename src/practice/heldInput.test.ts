import { describe, expect, it } from 'vitest';
import { HeldInput } from './heldInput.ts';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { drivingKeys } from './bindings.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';

describe('held input pulses', () => {
  it.each(['throttle', 'brake', 'left', 'right', 'clutch', 'horn'] as const)(
    'preserves a released %s until one sample',
    (action) => {
      const input = new HeldInput();
      input.press('pointer-1', action);
      input.release('pointer-1');
      expect(input.sample()).toEqual(new Set([action]));
      expect(input.sample()).toEqual(new Set());
    },
  );

  it('keeps other sources held and clears pending pulses on focus loss', () => {
    const input = new HeldInput();
    input.press('key', 'throttle');
    input.press('pointer', 'throttle');
    input.release('pointer');
    expect(input.sample()).toEqual(new Set(['throttle']));
    expect(input.sample()).toEqual(new Set(['throttle']));
    input.clear();
    expect(input.sample()).toEqual(new Set());
    input.press('pointer', 'brake');
    input.release('pointer');
    input.clear();
    expect(input.sample()).toEqual(new Set());
  });

  it('waits for an actual step and applies a tap only once within a long frame', () => {
    const input = new HeldInput();
    input.press('pointer', 'clutch');
    input.release('pointer');
    const samples: boolean[] = [];
    const sample = () => {
      const actions = input.sample();
      samples.push(actions.has('clutch'));
      return drivingKeys(actions);
    };
    let frame = startDriving(PRACTICE_YARD_START, 'manual');
    frame = driveFrame(PRACTICE_YARD, frame, sample, [], SIM_STEP_S / 2);
    expect(samples).toEqual([]);
    frame = driveFrame(PRACTICE_YARD, frame, sample, [], SIM_STEP_S / 2);
    expect(samples).toEqual([true]);
    expect(frame.controls.clutch).toBeGreaterThan(0);
    driveFrame(PRACTICE_YARD, frame, sample, [], 0.062);
    expect(samples.filter(Boolean)).toHaveLength(1);
    expect(samples.length).toBeGreaterThan(2);
  });
});
