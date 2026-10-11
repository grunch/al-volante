import type { SimpleControls } from '../sim/simpleDrive.ts';

/** Provisional keyboard bindings of the practice yard; configurable controls arrive with the cabin (F03-T03). */
export const KEY_BINDINGS = {
  throttle: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  reverse: ['KeyR'],
} as const;

/** Keys are on/off; pedals and wheel move at these rates (full travel per second) so short taps give fine control. */
export const CONTROL_RATES = {
  pedalPressPerS: 1.5,
  pedalReleasePerS: 3,
  steerPerS: 1.5,
  steerReturnPerS: 2.5,
} as const;

export const NEUTRAL_CONTROLS: SimpleControls = { throttle: 0, brake: 0, steer: 0, reverse: false };

const anyPressed = (keys: ReadonlySet<string>, codes: readonly string[]) => codes.some((code) => keys.has(code));

function towards(value: number, target: number, rateUp: number, rateDown: number, dt: number): number {
  if (value < target) return Math.min(target, value + rateUp * dt);
  return Math.max(target, value - rateDown * dt);
}

function steerTowards(value: number, target: number, dt: number): number {
  const rate = target === 0 ? CONTROL_RATES.steerReturnPerS : CONTROL_RATES.steerPerS;
  return value < target ? Math.min(target, value + rate * dt) : Math.max(target, value - rate * dt);
}

/** Moves pedals and wheel towards what the held keys ask for. */
export function stepControls(controls: SimpleControls, keys: ReadonlySet<string>, dt: number): SimpleControls {
  const left = anyPressed(keys, KEY_BINDINGS.left);
  const right = anyPressed(keys, KEY_BINDINGS.right);
  const steerTarget = left === right ? 0 : left ? 1 : -1;
  const pedal = (codes: readonly string[], value: number) =>
    towards(value, anyPressed(keys, codes) ? 1 : 0, CONTROL_RATES.pedalPressPerS, CONTROL_RATES.pedalReleasePerS, dt);
  return {
    ...controls,
    throttle: pedal(KEY_BINDINGS.throttle, controls.throttle),
    brake: pedal(KEY_BINDINGS.brake, controls.brake),
    steer: steerTowards(controls.steer, steerTarget, dt),
  };
}
