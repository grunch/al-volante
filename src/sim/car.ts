import { applyCommand, initialPowertrain, stepPowertrain, EXAM_POWERTRAIN } from './powertrain/powertrain.ts';
import type {
  PowertrainCommand,
  PowertrainEvent,
  PowertrainSpec,
  PowertrainState,
  TransmissionKind,
} from './powertrain/powertrain.ts';
import type { ActorKind } from './scenario.ts';
import { EXAM_CAR } from './vehicle.ts';
import type { VehicleSpec, VehicleState } from './vehicle.ts';
import { initialWorldState, stepWorld } from './world.ts';
import type { Contact, World, WorldState } from './world.ts';

/** What the driver's hands and feet do: pedals from 0 to 1 (clutch 1 = pressed) and the wheel from -1 to 1. */
export interface CarControls {
  throttle: number;
  brake: number;
  clutch: number;
  steer: number;
}

export interface CarState {
  world: WorldState;
  powertrain: PowertrainState;
  /** Controls of the last step; commands such as a gear change check them (the clutch must be down). */
  controls: CarControls;
}

/** Touching a scripted actor (a pedestrian, a vehicle) of the world's scenario; the driving loop reports it. */
export interface ActorContact {
  type: 'actor-contact';
  actor: ActorKind;
}

export type CarEvent = PowertrainEvent | ({ type: 'contact' } & Contact) | ActorContact;

export interface CarSpecs {
  vehicle: VehicleSpec;
  powertrain: PowertrainSpec;
}

export const EXAM_SPECS: CarSpecs = { vehicle: EXAM_CAR, powertrain: EXAM_POWERTRAIN };

const RESTING_CONTROLS: CarControls = { throttle: 0, brake: 0, clutch: 0, steer: 0 };

export function initialCarState(vehicle: VehicleState, kind: TransmissionKind): CarState {
  return { world: initialWorldState(vehicle), powertrain: initialPowertrain(kind), controls: RESTING_CONTROLS };
}

/** Key, lever and handbrake commands, checked against the current pedals and speed. */
export function command(
  state: CarState,
  next: PowertrainCommand,
  specs: CarSpecs = EXAM_SPECS,
): { state: CarState; events: CarEvent[] } {
  const result = applyCommand(specs.powertrain, state.powertrain, next, state.controls, state.world.vehicle.speedMps);
  return { state: { ...state, powertrain: result.state }, events: result.events };
}

/** One fixed step: the powertrain turns pedals into forces, then the world moves the car and reports contacts. */
export function stepCar(
  world: World,
  state: CarState,
  controls: CarControls,
  dt: number,
  specs: CarSpecs = EXAM_SPECS,
): { state: CarState; events: CarEvent[] } {
  const drive = stepPowertrain(
    specs.powertrain,
    state.powertrain,
    controls,
    state.world.vehicle.speedMps,
    specs.vehicle.massKg,
    dt,
  );
  const next = stepWorld(
    specs.vehicle,
    world,
    state.world,
    { tractionN: drive.tractionN, brake: controls.brake, steer: controls.steer, holdN: drive.holdN },
    dt,
  );
  const contacts: CarEvent[] = next.contacts.map((contact) => ({ type: 'contact', ...contact }));
  return { state: { world: next, powertrain: drive.state, controls }, events: [...drive.events, ...contacts] };
}
