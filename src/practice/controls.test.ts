import { describe, expect, it } from 'vitest';
import { CONTROL_RATES, NEUTRAL_CONTROLS, commandsForKey, stepControls } from './controls.ts';
import { initialPowertrain } from '../sim/powertrain/powertrain.ts';
import type { PowertrainState } from '../sim/powertrain/powertrain.ts';

const run = (keys: string[], seconds: number, start = NEUTRAL_CONTROLS) => {
  let controls = start;
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) controls = stepControls(controls, new Set(keys), 1 / 60);
  return controls;
};

describe('keyboard pedals and wheel', () => {
  it('press pedals progressively, so short taps give fine control at low speed', () => {
    const tap = run(['ArrowUp'], 0.1);
    const held = run(['ArrowUp'], 2);

    expect(tap.throttle).toBeCloseTo(0.1 * CONTROL_RATES.pedalPressPerS, 6);
    expect(held.throttle).toBe(1);
  });

  it('release pedals and recentre the wheel when keys are let go', () => {
    const released = run([], 2, run(['ArrowUp', 'ArrowLeft'], 2));

    expect(released.throttle).toBe(0);
    expect(released.steer).toBe(0);
  });

  it('steer and brake with arrows or WASD', () => {
    expect(run(['KeyA'], 2).steer).toBe(1);
    expect(run(['ArrowRight'], 2).steer).toBe(-1);
    expect(run(['KeyS'], 2).brake).toBe(1);
    expect(run(['KeyW'], 2).throttle).toBe(1);
  });

  it('press the clutch quickly with Shift and let it up slowly, to find the biting point', () => {
    const pressed = run(['ShiftLeft'], 0.5);
    const halfUp = run([], 0.5, pressed);

    expect(pressed.clutch).toBe(1);
    expect(halfUp.clutch).toBeCloseTo(1 - 0.5 * CONTROL_RATES.clutchReleasePerS, 6);
  });
});

describe('command keys', () => {
  const engine = (overrides: Partial<PowertrainState>): PowertrainState => ({
    ...initialPowertrain('manual'),
    ...overrides,
  });

  it('use K for the key: contact, start, stop', () => {
    expect(commandsForKey('KeyK', engine({}))).toEqual([{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }]);
    expect(commandsForKey('KeyK', engine({ key: 'on' }))).toEqual([{ type: 'turn-key', to: 'start' }]);
    expect(commandsForKey('KeyK', engine({ key: 'on', engineRunning: true }))).toEqual([
      { type: 'turn-key', to: 'off' },
    ]);
  });

  it('use Space for the handbrake, and E and Q to move along the gears or the lever', () => {
    expect(commandsForKey('Space', engine({ handbrake: true }))).toEqual([{ type: 'handbrake', engaged: false }]);
    expect(commandsForKey('KeyE', engine({ manualGear: 'N' }))).toEqual([{ type: 'shift', to: '1' }]);
    expect(commandsForKey('KeyQ', engine({ manualGear: 'N' }))).toEqual([{ type: 'shift', to: 'R' }]);
    expect(commandsForKey('KeyE', engine({ manualGear: '5' }))).toEqual([]);
    const automatic = { ...initialPowertrain('automatic'), lever: 'N' as const };
    expect(commandsForKey('KeyE', automatic)).toEqual([{ type: 'shift', to: 'D' }]);
    expect(commandsForKey('KeyQ', automatic)).toEqual([{ type: 'shift', to: 'R' }]);
  });

  it('ignore keys that are not commands', () => {
    expect(commandsForKey('ArrowUp', engine({}))).toEqual([]);
  });
});
