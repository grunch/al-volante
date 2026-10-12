import { NEUTRAL_CONTROLS, commandsForKey, stepControls } from './controls.ts';
import { EXAM_SPECS, command, initialCarState, stepCar } from '../sim/car.ts';
import type { CarControls, CarEvent, CarSpecs, CarState } from '../sim/car.ts';
import { advance, createStepper, SIM_STEP_S } from '../sim/fixedStep.ts';
import type { Stepper } from '../sim/fixedStep.ts';
import type { PowertrainCommand, TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { TrafficSnapshot, TrafficSource } from '../sim/scenario.ts';
import { bodyBox } from '../sim/vehicle.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';

export interface DrivingFrame {
  stepper: Stepper<CarState>;
  controls: CarControls;
  /** Everything that happened during the frame: command results and simulation events. */
  events: CarEvent[];
  /** Fraction of the next step elapsed, to interpolate the view. */
  alpha: number;
  /** The traffic stepped beside the car; null in a world without any. */
  traffic: TrafficSource | null;
  /** The traffic's lights and actors after the last step; null in a world without traffic. */
  scenario: TrafficSnapshot | null;
}

/** Called after every fixed step and every command, with what the step produced; the exam evaluation listens here. */
export type StepObserver = (
  car: CarState,
  events: readonly CarEvent[],
  dt: number,
  scenario: TrafficSnapshot | null,
) => void;

/** A session starts at rest; `prepared` commands (the key in contact for an exam) are applied before any step. */
export function startDriving(
  start: VehicleState,
  transmission: TransmissionKind,
  prepared: readonly PowertrainCommand[] = [],
  specs: CarSpecs = EXAM_SPECS,
  traffic?: TrafficSource,
): DrivingFrame {
  let state = initialCarState(start, transmission);
  const events: CarEvent[] = [];
  for (const next of prepared) {
    const result = command(state, next, specs);
    state = result.state;
    events.push(...result.events);
  }
  return {
    stepper: createStepper(state),
    controls: NEUTRAL_CONTROLS,
    events,
    alpha: 0,
    traffic: traffic ?? null,
    scenario: traffic ? traffic.create() : null,
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
  observe?: StepObserver,
): DrivingFrame {
  const events: CarEvent[] = [];
  let stepper = frame.stepper;
  let scenario = frame.scenario;
  for (const code of pressed) {
    for (const next of commandsForKey(code, stepper.state.powertrain)) {
      const result = command(stepper.state, next, specs);
      stepper = { ...stepper, state: result.state };
      events.push(...result.events);
      observe?.(result.state, result.events, 0, scenario);
    }
  }
  let controls = frame.controls;
  const result = advance(stepper, frameS, (current) => {
    controls = stepControls(controls, typeof keys === 'function' ? keys() : keys, SIM_STEP_S);
    const next = stepCar(world, current, controls, SIM_STEP_S, specs);
    const stepEvents: CarEvent[] = [...next.events];
    if (frame.traffic && scenario) {
      const { vehicle, timeS } = next.state.world;
      scenario = frame.traffic.step(scenario, bodyBox(specs.vehicle, vehicle), timeS, SIM_STEP_S);
      stepEvents.push(...scenario.contacts.map((actor) => ({ type: 'actor-contact' as const, actor })));
    }
    events.push(...stepEvents);
    observe?.(next.state, stepEvents, SIM_STEP_S, scenario);
    return next.state;
  });
  return { stepper: result.stepper, controls, events, alpha: result.alpha, traffic: frame.traffic, scenario };
}
