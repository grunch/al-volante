import { NEUTRAL_CONTROLS, commandsForKey, stepControls } from './controls.ts';
import { EXAM_SPECS, command, initialCarState, stepCar } from '../sim/car.ts';
import type { CarControls, CarEvent, CarSpecs, CarState } from '../sim/car.ts';
import { advance, createStepper, SIM_STEP_S } from '../sim/fixedStep.ts';
import type { Stepper } from '../sim/fixedStep.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';

export interface DrivingFrame {
  stepper: Stepper<CarState>;
  controls: CarControls;
  /** Everything that happened during the frame: command results and simulation events. */
  events: CarEvent[];
  /** Fraction of the next step elapsed, to interpolate the view. */
  alpha: number;
}

export function startDriving(start: VehicleState, transmission: TransmissionKind): DrivingFrame {
  return {
    stepper: createStepper(initialCarState(start, transmission)),
    controls: NEUTRAL_CONTROLS,
    events: [],
    alpha: 0,
  };
}

/**
 * Advances one rendered frame. Command keys pressed since the last frame act first, on the current state (the
 * clutch decides whether a gear goes in). Then pedal and wheel ramps move inside each fixed step (by SIM_STEP_S, not
 * by the frame time), so holding a key for the same time does exactly the same at any frame rate.
 */
export function driveFrame(
  world: World,
  frame: DrivingFrame,
  keys: ReadonlySet<string> | (() => ReadonlySet<string>),
  pressed: readonly string[],
  frameS: number,
  specs: CarSpecs = EXAM_SPECS,
): DrivingFrame {
  const events: CarEvent[] = [];
  let stepper = frame.stepper;
  for (const code of pressed) {
    for (const next of commandsForKey(code, stepper.state.powertrain)) {
      const result = command(stepper.state, next, specs);
      stepper = { ...stepper, state: result.state };
      events.push(...result.events);
    }
  }
  let controls = frame.controls;
  const result = advance(stepper, frameS, (current) => {
    controls = stepControls(controls, typeof keys === 'function' ? keys() : keys, SIM_STEP_S);
    const next = stepCar(world, current, controls, SIM_STEP_S, specs);
    events.push(...next.events);
    return next.state;
  });
  return { stepper: result.stepper, controls, events, alpha: result.alpha };
}
