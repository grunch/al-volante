import { EXAM_ENGINE, clutchEngagement, engineTorqueNm, radSToRpm, rpmToRadS } from './engine.ts';
import type { EngineSpec } from './engine.ts';

export type TransmissionKind = 'manual' | 'automatic';
export type ManualGear = 'R' | 'N' | '1' | '2' | '3' | '4' | '5';
export type AutomaticLever = 'P' | 'R' | 'N' | 'D';
export type KeyPosition = 'removed' | 'off' | 'on';

/** Gearbox, final drive and holding forces; game approximations of a compact car (ARQUITECTURA.md, «Tren motriz»). */
export interface PowertrainSpec {
  engine: EngineSpec;
  wheelRadiusM: number;
  efficiency: number;
  manual: { ratios: Record<Exclude<ManualGear, 'N'>, number>; finalDrive: number; clutchMaxNm: number };
  automatic: {
    ratios: readonly [number, number, number, number];
    reverseRatio: number;
    finalDrive: number;
    /** Torque converter: torque = k · ωe · (ωe − ωg). */
    converterK: number;
    upshiftKmh: readonly [number, number, number];
    downshiftKmh: readonly [number, number, number];
  };
  handbrakeDecelMps2: number;
  parkHoldN: number;
  /** Torque a stopped engine resists with when the car is in gear and the clutch released. */
  stoppedEngineHoldNm: number;
}

export const EXAM_POWERTRAIN: PowertrainSpec = {
  engine: EXAM_ENGINE,
  wheelRadiusM: 0.3,
  efficiency: 0.92,
  manual: {
    ratios: { R: -3.5, '1': 3.6, '2': 2.1, '3': 1.4, '4': 1.03, '5': 0.82 },
    finalDrive: 4.1,
    clutchMaxNm: 220,
  },
  automatic: {
    ratios: [2.9, 1.6, 1, 0.75],
    reverseRatio: -2.6,
    finalDrive: 4,
    converterK: 0.0044,
    upshiftKmh: [18, 35, 55],
    downshiftKmh: [12, 28, 45],
  },
  // Enough to hold the car on a 20 % slope, and weak enough to drive off with it on by mistake (rule.minor.f-handbrake-on-start).
  handbrakeDecelMps2: 2,
  parkHoldN: 20000,
  stoppedEngineHoldNm: 40,
};

/** A manual gear change needs the clutch pressed at least this far. */
export const CLUTCH_PRESSED = 0.85;
/** Leaving P needs the brake pressed at least this far (shift interlock). */
const BRAKE_FOR_SHIFT = 0.3;
/** Engine and gearbox speeds closer than this lock the clutch. */
const LOCK_EPSILON_RAD_S = 2;
/** Moving faster than this blocks shifts into reverse or park. */
const SHIFT_MOVING_MPS = 0.5;
/** Speed above which a car held by the handbrake counts as moving off. */
const MOVING_MPS = 0.1;

export interface PowertrainState {
  kind: TransmissionKind;
  key: KeyPosition;
  engineRunning: boolean;
  engineRadS: number;
  manualGear: ManualGear;
  lever: AutomaticLever;
  /** Gear the automatic is in while in D. */
  autoGear: 1 | 2 | 3 | 4;
  handbrake: boolean;
  /** The current handbrake episode was already reported, so it is reported once. */
  handbrakeReported: boolean;
}

export interface Pedals {
  throttle: number;
  brake: number;
  /** Clutch pedal travel, 1 = pressed to the floor. */
  clutch: number;
}

export type PowertrainCommand =
  | { type: 'insert-key' }
  | { type: 'remove-key' }
  | { type: 'turn-key'; to: 'on' | 'off' | 'start' }
  | { type: 'shift'; to: ManualGear | AutomaticLever }
  | { type: 'handbrake'; engaged: boolean };

/** Physical events the exam evaluation (F03-T04) turns into faults; the simulation does not judge them. */
export type PowertrainEvent =
  | { type: 'engine-started' }
  | { type: 'engine-stopped' }
  | { type: 'stall' }
  | { type: 'start-refused'; reason: 'key' | 'in-gear' | 'running' }
  | { type: 'shift-refused'; to: string; reason: 'clutch' | 'brake' | 'moving' | 'invalid' }
  | { type: 'gear-engaged'; gear: string }
  | { type: 'handbrake'; engaged: boolean }
  | { type: 'moved-with-handbrake' }
  | { type: 'key-inserted' }
  | { type: 'key-removed' }
  | { type: 'key-refused' };

export function initialPowertrain(kind: TransmissionKind): PowertrainState {
  return {
    kind,
    key: 'removed',
    engineRunning: false,
    engineRadS: 0,
    manualGear: 'N',
    lever: 'P',
    autoGear: 1,
    handbrake: true,
    handbrakeReported: false,
  };
}

const MANUAL_GEARS: readonly string[] = ['R', 'N', '1', '2', '3', '4', '5'];
const LEVER_POSITIONS: readonly string[] = ['P', 'R', 'N', 'D'];

/** Whether the starter may crank: the manual in neutral or with the clutch down, the automatic in P or N. */
function mayStart(state: PowertrainState, pedals: Pedals): boolean {
  if (state.kind === 'manual') return state.manualGear === 'N' || pedals.clutch >= CLUTCH_PRESSED;
  return state.lever === 'P' || state.lever === 'N';
}

function shift(
  state: PowertrainState,
  to: string,
  pedals: Pedals,
  speedMps: number,
): { state: PowertrainState; events: PowertrainEvent[] } {
  const refuse = (reason: 'clutch' | 'brake' | 'moving' | 'invalid') => ({
    state,
    events: [{ type: 'shift-refused' as const, to, reason }],
  });
  if (state.kind === 'manual') {
    if (!MANUAL_GEARS.includes(to)) return refuse('invalid');
    if (pedals.clutch < CLUTCH_PRESSED) return refuse('clutch');
    if (to === 'R' && speedMps > SHIFT_MOVING_MPS) return refuse('moving');
    return { state: { ...state, manualGear: to as ManualGear }, events: [{ type: 'gear-engaged', gear: to }] };
  }
  if (!LEVER_POSITIONS.includes(to)) return refuse('invalid');
  if (state.lever === 'P' && to !== 'P' && pedals.brake < BRAKE_FOR_SHIFT) return refuse('brake');
  if ((to === 'P' && Math.abs(speedMps) > SHIFT_MOVING_MPS) || (to === 'R' && speedMps > SHIFT_MOVING_MPS))
    return refuse('moving');
  return {
    state: { ...state, lever: to as AutomaticLever, autoGear: 1 },
    events: [{ type: 'gear-engaged', gear: to }],
  };
}

/** Applies a driver command (key, lever, handbrake) given the current pedals and speed. */
export function applyCommand(
  spec: PowertrainSpec,
  state: PowertrainState,
  command: PowertrainCommand,
  pedals: Pedals,
  speedMps: number,
): { state: PowertrainState; events: PowertrainEvent[] } {
  switch (command.type) {
    case 'insert-key':
      return state.key === 'removed'
        ? { state: { ...state, key: 'off' }, events: [{ type: 'key-inserted' }] }
        : { state, events: [] };
    case 'remove-key': {
      const allowed = state.key === 'off' && !state.engineRunning && (state.kind === 'manual' || state.lever === 'P');
      return allowed
        ? { state: { ...state, key: 'removed' }, events: [{ type: 'key-removed' }] }
        : { state, events: [{ type: 'key-refused' }] };
    }
    case 'turn-key': {
      if (state.key === 'removed')
        return { state, events: command.to === 'start' ? [{ type: 'start-refused', reason: 'key' }] : [] };
      if (command.to === 'on') return { state: { ...state, key: 'on' }, events: [] };
      if (command.to === 'off') {
        const stopped = { ...state, key: 'off' as const, engineRunning: false, engineRadS: 0 };
        return { state: stopped, events: state.engineRunning ? [{ type: 'engine-stopped' }] : [] };
      }
      if (state.engineRunning) return { state, events: [{ type: 'start-refused', reason: 'running' }] };
      if (!mayStart(state, pedals))
        return { state: { ...state, key: 'on' }, events: [{ type: 'start-refused', reason: 'in-gear' }] };
      return {
        state: { ...state, key: 'on', engineRunning: true, engineRadS: rpmToRadS(spec.engine.idleRpm) },
        events: [{ type: 'engine-started' }],
      };
    }
    case 'shift':
      return shift(state, command.to, pedals, speedMps);
    case 'handbrake':
      return {
        state: { ...state, handbrake: command.engaged, handbrakeReported: false },
        events: [{ type: 'handbrake', engaged: command.engaged }],
      };
  }
}

export interface PowertrainOutput {
  state: PowertrainState;
  /** Force the driven wheels push with (negative backwards). */
  tractionN: number;
  /** Holding force: handbrake, parking pawl or a stopped engine in gear. */
  holdN: number;
  events: PowertrainEvent[];
}

/** Engine speed after a step with `loadNm` taken by the driveline; never negative. */
function spin(spec: PowertrainSpec, omega: number, throttle: number, loadNm: number, dt: number): number {
  return Math.max(0, omega + ((engineTorqueNm(spec.engine, omega, throttle) - loadNm) / spec.engine.inertiaKgM2) * dt);
}

function manualDrive(spec: PowertrainSpec, state: PowertrainState, pedals: Pedals, speedMps: number, dt: number) {
  const engagement = state.manualGear === 'N' ? 0 : clutchEngagement(pedals.clutch);
  if (engagement === 0 || state.manualGear === 'N') {
    return { omega: spin(spec, state.engineRadS, pedals.throttle, 0, dt), tractionN: 0, dragged: false };
  }
  const ratio = spec.manual.ratios[state.manualGear] * spec.manual.finalDrive;
  const gearboxOmega = (speedMps / spec.wheelRadiusM) * ratio;
  const capacity = engagement * spec.manual.clutchMaxNm;
  const torque = engineTorqueNm(spec.engine, state.engineRadS, pedals.throttle);
  const toWheelsN = (clutchNm: number) => (clutchNm * ratio * spec.efficiency) / spec.wheelRadiusM;
  // Locked clutch: the engine turns with the wheels and its whole torque reaches them.
  if (Math.abs(state.engineRadS - gearboxOmega) < LOCK_EPSILON_RAD_S && Math.abs(torque) <= capacity) {
    return { omega: gearboxOmega, tractionN: toWheelsN(torque), dragged: true };
  }
  // Slipping clutch: it passes its capacity towards the slower side; the engine speed moves towards the gearbox's.
  // When both turn together, the speed difference is noise and the engine torque decides the direction.
  const difference = state.engineRadS - gearboxOmega;
  const slip = Math.abs(difference) < LOCK_EPSILON_RAD_S ? Math.sign(torque) : Math.sign(difference);
  const clutchNm = capacity * slip;
  let omega = spin(spec, state.engineRadS, pedals.throttle, clutchNm, dt);
  // The clutch only pulls the engine towards the gearbox: it never drags it past it. Checked against the slip
  // direction, not the noisy difference, so an engine with torque to spare can still rev above the wheels.
  if (Math.sign(omega - gearboxOmega) === -slip) omega = gearboxOmega;
  return { omega, tractionN: toWheelsN(clutchNm), dragged: engagement > 0.05 };
}

function automaticGear(spec: PowertrainSpec, state: PowertrainState, speedMps: number): 1 | 2 | 3 | 4 {
  const kmh = Math.abs(speedMps) * 3.6;
  let gear = state.autoGear;
  if (gear < 4 && kmh > (spec.automatic.upshiftKmh[gear - 1] as number)) gear = (gear + 1) as 1 | 2 | 3 | 4;
  else if (gear > 1 && kmh < (spec.automatic.downshiftKmh[gear - 2] as number)) gear = (gear - 1) as 1 | 2 | 3 | 4;
  return gear;
}

function automaticDrive(spec: PowertrainSpec, state: PowertrainState, pedals: Pedals, speedMps: number, dt: number) {
  if (state.lever === 'P' || state.lever === 'N') {
    return { omega: spin(spec, state.engineRadS, pedals.throttle, 0, dt), tractionN: 0, autoGear: 1 as const };
  }
  const autoGear = state.lever === 'D' ? automaticGear(spec, state, speedMps) : 1;
  const gearRatio = state.lever === 'R' ? spec.automatic.reverseRatio : (spec.automatic.ratios[autoGear - 1] as number);
  const ratio = gearRatio * spec.automatic.finalDrive;
  const gearboxOmega = (speedMps / spec.wheelRadiusM) * ratio;
  // The converter couples smoothly: it creeps at idle, and holds back (engine braking) when the wheels lead.
  const converterNm = spec.automatic.converterK * state.engineRadS * (state.engineRadS - gearboxOmega);
  const omega = spin(spec, state.engineRadS, pedals.throttle, converterNm, dt);
  return { omega, tractionN: (converterNm * ratio * spec.efficiency) / spec.wheelRadiusM, autoGear };
}

function holdingForce(spec: PowertrainSpec, state: PowertrainState, pedals: Pedals, massKg: number): number {
  const handbrake = state.handbrake ? spec.handbrakeDecelMps2 * massKg : 0;
  const park = state.kind === 'automatic' && state.lever === 'P' ? spec.parkHoldN : 0;
  const gearHeld =
    state.kind === 'manual' &&
    !state.engineRunning &&
    state.manualGear !== 'N' &&
    clutchEngagement(pedals.clutch) > 0.5;
  const engineHold = gearHeld
    ? (spec.stoppedEngineHoldNm *
        Math.abs(spec.manual.ratios[state.manualGear as Exclude<ManualGear, 'N'>] * spec.manual.finalDrive)) /
      spec.wheelRadiusM
    : 0;
  return handbrake + park + engineHold;
}

/** One fixed step of the powertrain for the current pedals and vehicle speed. */
export function stepPowertrain(
  spec: PowertrainSpec,
  state: PowertrainState,
  pedals: Pedals,
  speedMps: number,
  massKg: number,
  dt: number,
): PowertrainOutput {
  const events: PowertrainEvent[] = [];
  let next: PowertrainState = state;
  let tractionN = 0;
  if (state.engineRunning) {
    if (state.kind === 'manual') {
      const drive = manualDrive(spec, state, pedals, speedMps, dt);
      tractionN = drive.tractionN;
      next = { ...next, engineRadS: drive.omega };
      if (drive.dragged && radSToRpm(drive.omega) < spec.engine.stallRpm) {
        next = { ...next, engineRunning: false, engineRadS: 0 };
        tractionN = 0;
        events.push({ type: 'stall' });
      }
    } else {
      const drive = automaticDrive(spec, state, pedals, speedMps, dt);
      tractionN = drive.tractionN;
      next = { ...next, engineRadS: drive.omega, autoGear: drive.autoGear };
    }
  }
  const moving = Math.abs(speedMps) > MOVING_MPS;
  // Once per episode: stopping and moving off again with the handbrake still on is the same episode; releasing or
  // applying the handbrake (applyCommand) starts a new one.
  if (next.handbrake && moving && !next.handbrakeReported) {
    next = { ...next, handbrakeReported: true };
    events.push({ type: 'moved-with-handbrake' });
  }
  return { state: next, tractionN, holdN: holdingForce(spec, next, pedals, massKg), events };
}
