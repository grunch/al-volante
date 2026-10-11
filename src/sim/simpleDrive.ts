import type { DriveInput } from './dynamics.ts';

/**
 * Traction at full throttle until the powertrain of F03-T02 replaces this adapter: about 2.6 m/s² for the exam car,
 * enough to creep with a light press and to reach exam speeds briskly.
 */
export const SIMPLE_MAX_TRACTION_N = 3000;

export interface SimpleControls {
  /** Accelerator, 0 to 1. */
  throttle: number;
  /** Brake pedal, 0 to 1. */
  brake: number;
  /** Steering wheel, -1 (right) to 1 (left). */
  steer: number;
  reverse: boolean;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function simpleDriveInput(controls: SimpleControls): DriveInput {
  const tractionN = clamp(controls.throttle, 0, 1) * SIMPLE_MAX_TRACTION_N;
  return {
    tractionN: controls.reverse ? -tractionN : tractionN,
    brake: clamp(controls.brake, 0, 1),
    steer: clamp(controls.steer, -1, 1),
  };
}
