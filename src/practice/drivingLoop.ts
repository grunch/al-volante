import { assistedClutch } from './assistedClutch.ts';
import type { ContinuousControls } from './controls.ts';
import { CLUTCH_PRESSED } from '../sim/powertrain/powertrain.ts';
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
  keyboardClutch: number;
  assistedPedal: number;
  pendingShift: Extract<PowertrainCommand, { type: 'shift' }> | null;
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
    keyboardClutch: 0,
    assistedPedal: 0,
    pendingShift: null,
    events,
    alpha: 0,
    traffic: traffic ?? null,
    scenario: traffic ? traffic.create() : null,
  };
}

export interface DrivingInput {
  /** End of this frame on the same clock as sensor and pointer events. */
  frameEndMs: number;
  continuous?: (atMs: number) => ContinuousControls;
  assistClutch?: boolean;
  commands?: readonly PowertrainCommand[];
  /** Sampled every step: an examiner takeover also overrides continuous inputs and pending shifts. */
  blocked?: () => boolean;
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
  input?: DrivingInput,
): DrivingFrame {
  const events: CarEvent[] = [];
  let stepper = frame.stepper;
  let scenario = frame.scenario;
  let pendingShift = frame.pendingShift;
  const assist = Boolean(input?.assistClutch && stepper.state.powertrain.kind === 'manual');
  const apply = (next: PowertrainCommand) => {
    if (input?.blocked?.()) return;
    if (assist && next.type === 'shift') {
      // Validate non-clutch restrictions at request time, before braking can make an unsafe reverse request valid.
      const validation = command({ ...stepper.state, controls: { ...stepper.state.controls, clutch: 1 } }, next, specs);
      const refused = validation.events.filter((event) => event.type === 'shift-refused');
      if (refused.length > 0) {
        pendingShift = null;
        events.push(...refused);
        observe?.(stepper.state, refused, 0, scenario);
        return;
      }
      pendingShift = next;
      return;
    }
    // A recognition shift can press the assistant with the engine off. Only the player's clutch may enable starting in gear.
    const state =
      assist && next.type === 'turn-key' && next.to === 'start' && !stepper.state.powertrain.engineRunning
        ? { ...stepper.state, controls: { ...stepper.state.controls, clutch: frame.keyboardClutch } }
        : stepper.state;
    const result = command(state, next, specs);
    stepper = { ...stepper, state: result.state };
    events.push(...result.events);
    observe?.(result.state, result.events, 0, scenario);
  };
  for (const code of pressed) {
    for (const next of commandsForKey(code, stepper.state.powertrain)) apply(next);
  }
  for (const next of input?.commands ?? []) apply(next);
  let controls = frame.controls;
  let keyboardClutch = frame.keyboardClutch;
  let assistedPedal = frame.assistedPedal;
  const durationS = Number.isFinite(frameS) && frameS > 0 ? frameS : 0;
  const stepStartMs = (input?.frameEndMs ?? 0) - (durationS + stepper.accumulatorS) * 1000;
  let steps = 0;
  const result = advance(stepper, frameS, (current) => {
    const atMs = stepStartMs + ++steps * SIM_STEP_S * 1000;
    const blocked = input?.blocked?.() ?? false;
    const continuous = blocked ? undefined : input?.continuous?.(atMs);
    controls = stepControls(
      { ...controls, clutch: keyboardClutch },
      typeof keys === 'function' ? keys() : keys,
      SIM_STEP_S,
      current.world.vehicle.speedMps,
      continuous,
    );
    keyboardClutch = controls.clutch;
    if (blocked || !assist) pendingShift = null;
    assistedPedal =
      assist && !blocked
        ? assistedClutch(assistedPedal, current, controls, pendingShift !== null, SIM_STEP_S, specs)
        : 0;
    controls = { ...controls, clutch: Math.max(controls.clutch, assistedPedal) };
    if (pendingShift && controls.clutch >= CLUTCH_PRESSED) {
      const shifted = command({ ...current, controls }, pendingShift, specs);
      pendingShift = null;
      current = shifted.state;
      events.push(...shifted.events);
      observe?.(current, shifted.events, 0, scenario);
    }
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
  return {
    stepper: result.stepper,
    controls,
    keyboardClutch,
    assistedPedal,
    pendingShift,
    events,
    alpha: result.alpha,
    traffic: frame.traffic,
    scenario,
  };
}
