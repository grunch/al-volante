import type { CarControls } from '../sim/car.ts';
import type { AutomaticLever, ManualGear, PowertrainCommand, PowertrainState } from '../sim/powertrain/powertrain.ts';

/** Provisional keyboard bindings of the practice yard; configurable controls arrive with the cabin (F03-T03). */
export const KEY_BINDINGS = {
  throttle: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  clutch: ['ShiftLeft', 'ShiftRight'],
  gearUp: ['KeyE'],
  gearDown: ['KeyQ'],
  key: ['KeyK'],
  handbrake: ['Space'],
} as const;

/**
 * Keys are on/off; pedals and wheel move at these rates (full travel per second) so short taps give fine control.
 * The clutch goes down fast and comes up slowly, so the biting point can be held by tapping Shift.
 */
export const CONTROL_RATES = {
  pedalPressPerS: 1.5,
  pedalReleasePerS: 3,
  clutchPressPerS: 4,
  clutchReleasePerS: 0.6,
  steerPerS: 1.5,
  steerReturnPerS: 2.5,
} as const;

export const NEUTRAL_CONTROLS: CarControls = { throttle: 0, brake: 0, clutch: 0, steer: 0 };

const anyPressed = (keys: ReadonlySet<string>, codes: readonly string[]) => codes.some((code) => keys.has(code));

function towards(value: number, target: number, rateUp: number, rateDown: number, dt: number): number {
  return value < target ? Math.min(target, value + rateUp * dt) : Math.max(target, value - rateDown * dt);
}

/** Moves pedals and wheel towards what the held keys ask for. */
export function stepControls(controls: CarControls, keys: ReadonlySet<string>, dt: number): CarControls {
  const left = anyPressed(keys, KEY_BINDINGS.left);
  const right = anyPressed(keys, KEY_BINDINGS.right);
  const steerTarget = left === right ? 0 : left ? 1 : -1;
  const steerRate = steerTarget === 0 ? CONTROL_RATES.steerReturnPerS : CONTROL_RATES.steerPerS;
  const pedal = (codes: readonly string[], value: number, press: number, release: number) =>
    towards(value, anyPressed(keys, codes) ? 1 : 0, press, release, dt);
  return {
    throttle: pedal(
      KEY_BINDINGS.throttle,
      controls.throttle,
      CONTROL_RATES.pedalPressPerS,
      CONTROL_RATES.pedalReleasePerS,
    ),
    brake: pedal(KEY_BINDINGS.brake, controls.brake, CONTROL_RATES.pedalPressPerS, CONTROL_RATES.pedalReleasePerS),
    clutch: pedal(KEY_BINDINGS.clutch, controls.clutch, CONTROL_RATES.clutchPressPerS, CONTROL_RATES.clutchReleasePerS),
    steer: towards(controls.steer, steerTarget, steerRate, steerRate, dt),
  };
}

const MANUAL_SEQUENCE = ['R', 'N', '1', '2', '3', '4', '5'] as const;
const LEVER_SEQUENCE = ['P', 'R', 'N', 'D'] as const;

function neighbour(sequence: readonly string[], current: string, step: 1 | -1): PowertrainCommand[] {
  const next = sequence[sequence.indexOf(current) + step];
  return next === undefined ? [] : [{ type: 'shift', to: next as ManualGear | AutomaticLever }];
}

/** Discrete commands a key asks for, given the current powertrain (K cycles the key, Space toggles the handbrake). */
export function commandsForKey(code: string, powertrain: PowertrainState): PowertrainCommand[] {
  const is = (codes: readonly string[]) => codes.includes(code);
  if (is(KEY_BINDINGS.key)) {
    if (powertrain.key === 'removed') return [{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }];
    if (powertrain.key === 'off') return [{ type: 'turn-key', to: 'on' }];
    return [{ type: 'turn-key', to: powertrain.engineRunning ? 'off' : 'start' }];
  }
  if (is(KEY_BINDINGS.handbrake)) return [{ type: 'handbrake', engaged: !powertrain.handbrake }];
  const step = is(KEY_BINDINGS.gearUp) ? 1 : is(KEY_BINDINGS.gearDown) ? -1 : 0;
  if (step === 0) return [];
  return powertrain.kind === 'manual'
    ? neighbour(MANUAL_SEQUENCE, powertrain.manualGear, step)
    : neighbour(LEVER_SEQUENCE, powertrain.lever, step);
}
