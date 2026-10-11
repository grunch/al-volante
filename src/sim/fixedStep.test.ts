import { describe, expect, it } from 'vitest';
import { MAX_STEPS_PER_FRAME, SIM_STEP_S, advance, createStepper } from './fixedStep.ts';

const move = (position: number) => position + 2 * SIM_STEP_S;

function runAt(frameS: number, totalS: number) {
  let stepper = createStepper(0);
  let steps = 0;
  for (let elapsed = 0; elapsed < totalS - 1e-9; elapsed += frameS) {
    const result = advance(stepper, frameS, move);
    stepper = result.stepper;
    steps += result.steps;
  }
  return { position: stepper.state, steps, carry: stepper.accumulatorS };
}

describe('fixed-step simulation', () => {
  it('advances in fixed steps and reports how far into the next step the frame is', () => {
    // Arrange
    const stepper = createStepper(0);

    // Act
    const result = advance(stepper, SIM_STEP_S * 2.5, move);

    // Assert
    expect(result.steps).toBe(2);
    expect(result.stepper.state).toBeCloseTo(4 * SIM_STEP_S, 12);
    expect(result.alpha).toBeCloseTo(0.5, 9);
    expect(result.previous).toBeCloseTo(2 * SIM_STEP_S, 12);
  });

  it('moves the same at 30, 60 and 144 frames per second (FPS-independent)', () => {
    const at30 = runAt(1 / 30, 2);
    const at60 = runAt(1 / 60, 2);
    const at144 = runAt(1 / 144, 2);

    // The step count can differ by one step left in the accumulator; the position by at most that step.
    for (const run of [at60, at144]) {
      expect(Math.abs(run.steps - at30.steps)).toBeLessThanOrEqual(1);
      expect(Math.abs(run.position - at30.position)).toBeLessThanOrEqual(2 * SIM_STEP_S + 1e-12);
    }
    expect(at30.steps).toBe(240);
  });

  it('caps the steps of a very long frame and drops the excess instead of spiralling', () => {
    const result = advance(createStepper(0), 5, move);

    expect(result.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(result.droppedS).toBeCloseTo(5 - MAX_STEPS_PER_FRAME * SIM_STEP_S, 9);
    expect(result.stepper.accumulatorS).toBe(0);
  });

  it('ignores negative or non-finite frame times', () => {
    expect(advance(createStepper(0), -1, move).steps).toBe(0);
    expect(advance(createStepper(0), Number.NaN, move).steps).toBe(0);
  });
});
