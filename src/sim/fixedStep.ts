/** Simulation step: 120 Hz keeps low-speed manoeuvres (centimetres per step) and collisions precise. */
export const SIM_STEP_S = 1 / 120;
/** At most 0.1 s of simulation per frame; longer frames (a background tab) drop the excess instead of spiralling. */
export const MAX_STEPS_PER_FRAME = 12;
/** Absorbs floating-point error so a frame of exactly n steps runs n steps. */
const EPSILON_S = 1e-9;

export interface Stepper<S> {
  state: S;
  /** State before the last step, to interpolate rendering between steps. */
  previous: S;
  accumulatorS: number;
}

export interface AdvanceResult<S> {
  stepper: Stepper<S>;
  steps: number;
  /** Fraction of the next step already elapsed: render `previous` blended towards `state` by this much. */
  alpha: number;
  previous: S;
  droppedS: number;
}

export function createStepper<S>(state: S): Stepper<S> {
  return { state, previous: state, accumulatorS: 0 };
}

/**
 * Runs as many fixed steps as the frame time covers. The simulation never sees the frame rate: the same inputs over
 * the same time give the same states whether frames come at 30 or 144 Hz.
 */
export function advance<S>(stepper: Stepper<S>, frameS: number, step: (state: S) => S): AdvanceResult<S> {
  let accumulatorS = stepper.accumulatorS + (Number.isFinite(frameS) && frameS > 0 ? frameS : 0);
  let { state, previous } = stepper;
  let steps = 0;
  while (accumulatorS + EPSILON_S >= SIM_STEP_S && steps < MAX_STEPS_PER_FRAME) {
    previous = state;
    state = step(state);
    accumulatorS -= SIM_STEP_S;
    steps += 1;
  }
  let droppedS = 0;
  if (accumulatorS + EPSILON_S >= SIM_STEP_S) {
    droppedS = accumulatorS;
    accumulatorS = 0;
  }
  accumulatorS = Math.max(0, accumulatorS);
  return { stepper: { state, previous, accumulatorS }, steps, alpha: accumulatorS / SIM_STEP_S, previous, droppedS };
}
