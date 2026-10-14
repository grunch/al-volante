import type { CarControls } from '../sim/car.ts';
import type { AutomaticLever, ManualGear, PowertrainCommand, PowertrainState } from '../sim/powertrain/powertrain.ts';

/** Canonical actions; user bindings are translated to these keys before each simulation step. */
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
  steerReturnPerS: 0.7,
} as const;

export const NEUTRAL_CONTROLS: CarControls = { throttle: 0, brake: 0, clutch: 0, steer: 0 };

const anyPressed = (keys: ReadonlySet<string>, codes: readonly string[]) => codes.some((code) => keys.has(code));

function towards(value: number, target: number, rateUp: number, rateDown: number, dt: number): number {
  return value < target ? Math.min(target, value + rateUp * dt) : Math.max(target, value - rateDown * dt);
}

/**
 * Keyboard steering assist: full lock for manoeuvring, finer input at road speed. This models a driver's
 * smaller wheel movements with binary keys, not a variable physical steering ratio or an exam speed limit.
 * Signed speed is intentional: reversing gets the same sensitivity. All ramps run in simulation time.
 */
export interface ContinuousControls {
  steer?: number | null;
  throttle?: number | null;
  brake?: number | null;
  clutch?: number | null;
}

export function stepControls(
  controls: CarControls,
  keys: ReadonlySet<string>,
  dt: number,
  speedMps = 0,
  continuous: ContinuousControls = {},
): CarControls {
  const left = anyPressed(keys, KEY_BINDINGS.left);
  const right = anyPressed(keys, KEY_BINDINGS.right);
  const speed = Math.abs(speedMps);
  const steeringRange = 1 / (1 + (Math.max(0, speed - 2) / 5) ** 2);
  const steerTarget = (left === right ? 0 : left ? 1 : -1) * steeringRange;
  const steerRate =
    steerTarget === 0
      ? CONTROL_RATES.steerReturnPerS + Math.min(speed / 10, 1)
      : CONTROL_RATES.steerPerS * Math.sqrt(steeringRange);
  const pedal = (codes: readonly string[], value: number, press: number, release: number) =>
    towards(value, anyPressed(keys, codes) ? 1 : 0, press, release, dt);
  const analog = (value: number | null | undefined, min = 0) =>
    value != null && Number.isFinite(value) ? Math.min(1, Math.max(min, value)) : null;
  const throttle = analog(continuous.throttle);
  const brake = analog(continuous.brake);
  const clutch = analog(continuous.clutch);
  const steer = analog(continuous.steer, -1);
  return {
    throttle:
      throttle !== null && !anyPressed(keys, KEY_BINDINGS.throttle)
        ? towards(controls.throttle, throttle, 5, 5, dt)
        : pedal(KEY_BINDINGS.throttle, controls.throttle, CONTROL_RATES.pedalPressPerS, CONTROL_RATES.pedalReleasePerS),
    brake:
      brake !== null && !anyPressed(keys, KEY_BINDINGS.brake)
        ? towards(controls.brake, brake, 5, 5, dt)
        : pedal(KEY_BINDINGS.brake, controls.brake, CONTROL_RATES.pedalPressPerS, CONTROL_RATES.pedalReleasePerS),
    clutch: Math.max(
      clutch ?? 0,
      pedal(KEY_BINDINGS.clutch, controls.clutch, CONTROL_RATES.clutchPressPerS, CONTROL_RATES.clutchReleasePerS),
    ),
    steer: steer !== null && !left && !right ? steer : towards(controls.steer, steerTarget, steerRate, steerRate, dt),
  };
}

const MANUAL_SEQUENCE = ['R', 'N', '1', '2', '3', '4', '5'] as const;
const LEVER_SEQUENCE = ['P', 'R', 'N', 'D'] as const;

function neighbour(sequence: readonly string[], current: string, step: 1 | -1): PowertrainCommand[] {
  const next = sequence[sequence.indexOf(current) + step];
  return next === undefined ? [] : [{ type: 'shift', to: next as ManualGear | AutomaticLever }];
}

/**
 * Discrete commands a key asks for, given the current powertrain. K cycles the key (contact, start, stop, take it
 * out), Space toggles the handbrake and E/Q move along the gears or the lever.
 */
export function commandsForKey(code: string, powertrain: PowertrainState): PowertrainCommand[] {
  const is = (codes: readonly string[]) => codes.includes(code);
  if (is(KEY_BINDINGS.key)) {
    if (powertrain.key === 'removed') return [{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }];
    // Switched off: the next press takes the key out (refused while the automatic is outside P).
    if (powertrain.key === 'off') return [{ type: 'remove-key' }];
    return [{ type: 'turn-key', to: powertrain.engineRunning ? 'off' : 'start' }];
  }
  if (is(KEY_BINDINGS.handbrake)) return [{ type: 'handbrake', engaged: !powertrain.handbrake }];
  const step = is(KEY_BINDINGS.gearUp) ? 1 : is(KEY_BINDINGS.gearDown) ? -1 : 0;
  if (step === 0) return [];
  return powertrain.kind === 'manual'
    ? neighbour(MANUAL_SEQUENCE, powertrain.manualGear, step)
    : neighbour(LEVER_SEQUENCE, powertrain.lever, step);
}
