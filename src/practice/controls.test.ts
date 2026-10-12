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

  it('keeps full manoeuvring lock and gives smaller wheel inputs at road speed in either direction', () => {
    const hold = (speed: number) => {
      let controls = NEUTRAL_CONTROLS;
      for (let i = 0; i < 240; i++) controls = stepControls(controls, new Set(['KeyA']), 1 / 120, speed);
      return controls;
    };
    expect(hold(1).steer).toBe(1);
    expect(hold(30 / 3.6).steer).toBeLessThan(0.4);
    expect(hold(45 / 3.6).steer).toBeLessThan(hold(30 / 3.6).steer);
    expect(hold(-30 / 3.6)).toEqual(hold(30 / 3.6));
  });

  it('returns gently while parking and more quickly while rolling without overshooting center', () => {
    const turned = { ...NEUTRAL_CONTROLS, steer: 0.5 };
    const stopped = stepControls(turned, new Set(), 0.1, 0);
    const rolling = stepControls(turned, new Set(), 0.1, 10);
    expect(stopped.steer).toBeGreaterThan(rolling.steer);
    expect(rolling.steer).toBeGreaterThan(0);
    expect(stepControls(rolling, new Set(), 1, 10).steer).toBe(0);
  });
});

describe('command keys', () => {
  const engine = (overrides: Partial<PowertrainState>): PowertrainState => ({
    ...initialPowertrain('manual'),
    ...overrides,
  });

  it('use K for the whole key cycle: contact, start, stop, take it out', () => {
    expect(commandsForKey('KeyK', engine({}))).toEqual([{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }]);
    expect(commandsForKey('KeyK', engine({ key: 'on' }))).toEqual([{ type: 'turn-key', to: 'start' }]);
    expect(commandsForKey('KeyK', engine({ key: 'on', engineRunning: true }))).toEqual([
      { type: 'turn-key', to: 'off' },
    ]);
    // After switching off, K takes the key out, completing the finishing procedure (protocolo PDF 13, 25).
    expect(commandsForKey('KeyK', engine({ key: 'off' }))).toEqual([{ type: 'remove-key' }]);
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
