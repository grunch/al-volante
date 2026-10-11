import { NEUTRAL_CONTROLS, stepControls } from './controls.ts';
import { advance, createStepper, SIM_STEP_S } from '../sim/fixedStep.ts';
import type { Stepper } from '../sim/fixedStep.ts';
import { simpleDriveInput } from '../sim/simpleDrive.ts';
import type { SimpleControls } from '../sim/simpleDrive.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import { initialWorldState, stepWorld } from '../sim/world.ts';
import type { Contact, World, WorldState } from '../sim/world.ts';

export interface DrivingFrame {
  stepper: Stepper<WorldState>;
  controls: SimpleControls;
  /** First contact during the frame, if any. */
  contact: Contact | null;
  /** Fraction of the next step elapsed, to interpolate the view. */
  alpha: number;
}

export function startDriving(start: VehicleState): DrivingFrame {
  return { stepper: createStepper(initialWorldState(start)), controls: NEUTRAL_CONTROLS, contact: null, alpha: 0 };
}

/**
 * Advances one rendered frame. Pedal and wheel ramps move inside each fixed step (by SIM_STEP_S, not by the frame
 * time), so holding a key for the same time does exactly the same at any frame rate.
 */
export function driveFrame(
  spec: VehicleSpec,
  world: World,
  frame: DrivingFrame,
  keys: ReadonlySet<string>,
  reverse: boolean,
  frameS: number,
): DrivingFrame {
  let controls: SimpleControls = { ...frame.controls, reverse };
  let contact: Contact | null = null;
  const result = advance(frame.stepper, frameS, (current) => {
    controls = stepControls(controls, keys, SIM_STEP_S);
    const next = stepWorld(spec, world, current, simpleDriveInput(controls), SIM_STEP_S);
    contact = contact ?? next.contacts[0] ?? null;
    return next;
  });
  return { stepper: result.stepper, controls, contact, alpha: result.alpha };
}
