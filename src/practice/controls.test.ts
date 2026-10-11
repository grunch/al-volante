import { describe, expect, it } from 'vitest';
import { CONTROL_RATES, NEUTRAL_CONTROLS, stepControls } from './controls.ts';

const run = (keys: string[], seconds: number, start = NEUTRAL_CONTROLS) => {
  let controls = start;
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) controls = stepControls(controls, new Set(keys), 1 / 60);
  return controls;
};

describe('keyboard controls', () => {
  it('press pedals progressively, so short taps give fine control at low speed', () => {
    const tap = run(['ArrowUp'], 0.1);
    const held = run(['ArrowUp'], 2);

    expect(tap.throttle).toBeCloseTo(0.1 * CONTROL_RATES.pedalPressPerS, 6);
    expect(held.throttle).toBe(1);
  });

  it('release pedals and recentre the wheel when keys are let go', () => {
    const pressed = run(['ArrowUp', 'ArrowLeft'], 2);

    const released = run([], 2, pressed);

    expect(released.throttle).toBe(0);
    expect(released.steer).toBe(0);
  });

  it('steer left with ArrowLeft or A and right with ArrowRight or D', () => {
    expect(run(['ArrowLeft'], 2).steer).toBe(1);
    expect(run(['KeyA'], 2).steer).toBe(1);
    expect(run(['KeyD'], 2).steer).toBe(-1);
  });

  it('brake with ArrowDown or S and accelerate with W', () => {
    expect(run(['KeyS'], 2).brake).toBe(1);
    expect(run(['KeyW'], 2).throttle).toBe(1);
  });
});
