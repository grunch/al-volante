import { createLedger, interrupt, recordFault } from './scoring.ts';
import type { Ledger, Stage } from './scoring.ts';
import { createRandom, shuffle } from '../activities/random.ts';
import type { Rule } from '../content/schemas.ts';
import type { CockpitCommand, CockpitState } from '../practice/cockpit.ts';
import type { CarEvent, CarState } from '../sim/car.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { forwardOf, restingVehicle } from '../sim/vehicle.ts';

/** Game approximations, not protocol values (REGLAS.md §7, V2 and D4). The feedback shows them as such. */
export const GAME_PARAMETERS = {
  /** The protocol only says "more or less than 30 cm" (V2). */
  displacementToleranceCm: 10,
  /** Turning the wheel more than this during the 30 cm manoeuvres counts as moving it. */
  steerHeldRad: 0.03,
  /** A post touched slower than this is a scrape (high d); faster, it is knocked over (eliminatory d). */
  markerKnockSpeedMps: 1,
  /** Turning the head at least this far counts as checking the mirrors before leaving the box (D4). */
  mirrorCheckYawRad: 0.5,
  /** Standing still this long ends a 30 cm manoeuvre. */
  settleS: 0.5,
  /** Faster than this, the car has moved off in stage II (belt check, cutoff no longer applies). */
  movedOffMps: 0.2,
} as const;

/** Rear axle in the middle of the yard's parking box (practiceYard.ts), facing +z with the kerb on the right. */
export const EXAM_START = restingVehicle({ x: -5.15, z: 11.65, headingRad: 0 });

export type Phase =
  'familiarisation' | 'recognition' | 'preparation' | 'unlock' | 'reverse' | 'forward' | 'exit' | 'finished';

/** What the examiner asks to recognise: a pedal, a gear, a light or an instrument (protocolo PDF 9). */
export type RecognitionTarget =
  | 'clutch'
  | 'brake'
  | 'throttle'
  | `gear-${string}`
  | 'position'
  | 'low'
  | 'high'
  | 'signal-left'
  | 'signal-right'
  | 'hazards'
  | 'wipers'
  | 'defogger'
  | 'horn'
  | 'rearHeater'
  | 'airConditioning';

export type Prompt = { kind: 'recognise'; target: RecognitionTarget } | { kind: 'say'; message: Phase };

export type Observation =
  | { type: 'cockpit'; command: CockpitCommand; before: CockpitState; after: CockpitState }
  | { type: 'step'; car: CarState; cockpit: CockpitState; events: readonly CarEvent[]; dt: number }
  | { type: 'ready' }
  | { type: 'request-stop' };

interface Manoeuvre {
  startX: number;
  startZ: number;
  headingRad: number;
  moved: boolean;
  violated: boolean;
  stoppedS: number;
}

export interface Session {
  rules: readonly Rule[];
  kind: TransmissionKind;
  seed: number;
  phase: Phase;
  prompt: Prompt;
  ledger: Ledger;
  completedStages: readonly Stage[];
  timeS: number;
  measurements: { reverseCm: number | null; forwardCm: number | null; exitManoeuvres: number };
  queue: readonly RecognitionTarget[];
  adjusted: { seat: boolean; headrest: boolean; mirrors: boolean };
  pedalsDown: { throttle: boolean; brake: boolean; clutch: boolean };
  engineStarts: number;
  handbrakeEpisodes: number;
  /** The car moved in stage II, so the cutoff before circulation no longer applies. */
  movedOff: boolean;
  manoeuvre: Manoeuvre | null;
  exit: { looked: boolean; direction: number; movedOffChecked: boolean };
}

const PEDALS = ['throttle', 'brake', 'clutch'] as const;
const STAGE_TWO_PHASES: readonly Phase[] = ['unlock', 'reverse', 'forward', 'exit'];
const LIGHT_TARGETS: readonly RecognitionTarget[] = [
  'position',
  'low',
  'high',
  'signal-left',
  'signal-right',
  'hazards',
];
const INSTRUMENT_TARGETS: readonly RecognitionTarget[] = [
  'wipers',
  'defogger',
  'horn',
  'rearHeater',
  'airConditioning',
];

type Family = 'pedals' | 'gears' | 'lights' | 'instruments';

const FAMILY_RULES: Record<Family, string> = {
  pedals: 'rule.eliminatory.a-pedals-not-recognized',
  gears: 'rule.eliminatory.b-gearbox-not-handled',
  lights: 'rule.minor.a-lights-recognition',
  instruments: 'rule.minor.b-instruments-recognition',
};

function familyOf(target: RecognitionTarget): Family {
  if ((PEDALS as readonly string[]).includes(target)) return 'pedals';
  if (target.startsWith('gear-')) return 'gears';
  return LIGHT_TARGETS.includes(target) ? 'lights' : 'instruments';
}

function recognitionQueue(kind: TransmissionKind, seed: number): RecognitionTarget[] {
  const pedals: RecognitionTarget[] = kind === 'manual' ? ['clutch', 'brake', 'throttle'] : ['brake', 'throttle'];
  const gears: RecognitionTarget[] =
    kind === 'manual' ? ['gear-1', 'gear-R', 'gear-N'] : ['gear-P', 'gear-R', 'gear-N', 'gear-D'];
  return shuffle([...pedals, ...gears, ...LIGHT_TARGETS, ...INSTRUMENT_TARGETS], createRandom(seed));
}

export function createSession(rules: readonly Rule[], kind: TransmissionKind, seed: number): Session {
  return {
    rules,
    kind,
    seed,
    phase: 'familiarisation',
    prompt: { kind: 'say', message: 'familiarisation' },
    ledger: createLedger(rules),
    completedStages: [],
    timeS: 0,
    measurements: { reverseCm: null, forwardCm: null, exitManoeuvres: 0 },
    queue: recognitionQueue(kind, seed),
    adjusted: { seat: false, headrest: false, mirrors: false },
    pedalsDown: { throttle: false, brake: false, clutch: false },
    engineStarts: 0,
    handbrakeEpisodes: 0,
    movedOff: false,
    manoeuvre: null,
    exit: { looked: false, direction: 0, movedOffChecked: false },
  };
}

const enter = (session: Session, phase: Phase): Session => ({
  ...session,
  phase,
  prompt: { kind: 'say', message: phase },
});
const finish = (session: Session): Session => enter(session, 'finished');
const inStageTwo = (session: Session) => STAGE_TWO_PHASES.includes(session.phase);

/** With 8 points or more before circulating, the exam is interrupted (protocolo PDF 10). */
function cutoff(session: Session): Session {
  if (!inStageTwo(session) || session.movedOff || session.ledger.points < 8) return session;
  return finish({ ...session, ledger: interrupt(session.ledger, session.timeS, 'cutoff') });
}

/** Scores a fault; an interruption ends the exam, except during the recognition round, which is judged whole. */
function fault(session: Session, ruleId: string, episode?: string): Session {
  const ledger = recordFault(session.ledger, { ruleId, atS: session.timeS, episode });
  const next: Session = { ...session, ledger };
  if (ledger.interruption && session.phase !== 'recognition') return finish(next);
  return cutoff(next);
}

function nextPrompt(session: Session): Session {
  const [, ...rest] = session.queue;
  const next: Session = { ...session, queue: rest };
  if (rest[0]) return { ...next, prompt: { kind: 'recognise', target: rest[0] } };
  // The round is judged whole: an eliminatory answer interrupts once the examiner has asked everything.
  return next.ledger.interruption ? finish(next) : enter(next, 'preparation');
}

/** An answer of another family (a pedal while a light was asked) is ignored; a wrong one of the same family scores. */
function judgeRecognition(session: Session, answered: RecognitionTarget): Session {
  const target = session.queue[0];
  if (target === undefined || answered === target) return nextPrompt(session);
  if (familyOf(answered) !== familyOf(target)) return session;
  return nextPrompt(fault(session, FAMILY_RULES[familyOf(target)]));
}

function cockpitAnswer(command: CockpitCommand): RecognitionTarget | null {
  switch (command.type) {
    case 'lights':
      return command.value === 'off' ? null : command.value;
    case 'signal':
      return command.value === 'off' ? null : command.value === 'left' ? 'signal-left' : 'signal-right';
    case 'toggle':
      return command.control === 'belt' || command.control === 'heating' ? null : command.control;
    case 'horn':
      return command.value ? 'horn' : null;
    default:
      return null;
  }
}

function onCockpit(session: Session, command: CockpitCommand, after: CockpitState): Session {
  let next = session;
  if (command.type === 'adjust')
    next = { ...next, adjusted: { ...next.adjusted, [command.control === 'headrest' ? 'headrest' : 'seat']: true } };
  if (command.type === 'mirror') next = { ...next, adjusted: { ...next.adjusted, mirrors: true } };
  if (next.phase === 'recognition') {
    const answered = cockpitAnswer(command);
    return answered ? judgeRecognition(next, answered) : next;
  }
  // Taking the belt off during the exam eliminates (eliminatory c).
  if (inStageTwo(next) && next.movedOff && command.type === 'toggle' && command.control === 'belt' && !after.belt)
    return fault(next, 'rule.eliminatory.c-no-seatbelt');
  if (next.phase === 'exit' && command.type === 'look' && Math.abs(after.lookYaw) >= GAME_PARAMETERS.mirrorCheckYawRad)
    return { ...next, exit: { ...next.exit, looked: true } };
  return next;
}

function onReady(session: Session): Session {
  switch (session.phase) {
    case 'familiarisation': {
      const first = session.queue[0];
      return first
        ? { ...session, phase: 'recognition', prompt: { kind: 'recognise', target: first } }
        : enter(session, 'preparation');
    }
    case 'preparation': {
      let next = session;
      if (!next.adjusted.seat) next = fault(next, 'rule.minor.c-seat-adjustment');
      if (!next.adjusted.headrest) next = fault(next, 'rule.minor.d-headrest-adjustment');
      if (!next.adjusted.mirrors) next = fault(next, 'rule.high.a-mirrors-not-checked');
      return cutoff(enter({ ...next, completedStages: [...next.completedStages, 'I'] }, 'unlock'));
    }
    default:
      return session;
  }
}

function startManoeuvre(car: CarState): Manoeuvre {
  const { x, z, headingRad } = car.world.vehicle;
  return { startX: x, startZ: z, headingRad, moved: false, violated: false, stoppedS: 0 };
}

/** Signed distance along the heading the manoeuvre started with. */
function displacementM(manoeuvre: Manoeuvre, car: CarState): number {
  const forward = forwardOf(manoeuvre.headingRad);
  const { x, z } = car.world.vehicle;
  return (x - manoeuvre.startX) * forward.x + (z - manoeuvre.startZ) * forward.z;
}

/** The 30 cm manoeuvres: measured along the initial heading, judged once the car has moved and settled. */
function onManoeuvreStep(session: Session, car: CarState, dt: number): Session {
  const reverse = session.phase === 'reverse';
  const manoeuvre = session.manoeuvre ?? startManoeuvre(car);
  const vehicle = car.world.vehicle;
  const displacement = displacementM(manoeuvre, car);
  const moving = vehicle.speedMps !== 0;
  let violated = manoeuvre.violated;
  if (moving || manoeuvre.moved) {
    if (Math.abs(vehicle.steerRad) > GAME_PARAMETERS.steerHeldRad) violated = true;
    // Clutch only (manual) or brake only (automatic): no accelerator in either.
    if (car.controls.throttle > 0.05) violated = true;
    // The wrong direction, or a second manoeuvre after the first (forward: in one manoeuvre).
    if (reverse ? vehicle.speedMps > 0.01 : vehicle.speedMps < -0.01) violated = true;
  }
  const moved = manoeuvre.moved || Math.abs(displacement) > 0.01;
  const stoppedS = moving ? 0 : manoeuvre.stoppedS + dt;
  const next: Session = { ...session, manoeuvre: { ...manoeuvre, moved, violated, stoppedS } };
  if (!moved || stoppedS < GAME_PARAMETERS.settleS) return next;
  const cm = (reverse ? -displacement : displacement) * 100;
  const failed = violated || Math.abs(cm - 30) > GAME_PARAMETERS.displacementToleranceCm;
  const measured: Session = {
    ...next,
    manoeuvre: null,
    measurements: { ...next.measurements, [reverse ? 'reverseCm' : 'forwardCm']: cm },
  };
  const judged = failed
    ? fault(measured, reverse ? 'rule.high.b-reverse-30cm-fail' : 'rule.high.c-forward-30cm-fail')
    : measured;
  return judged.phase === 'finished' ? judged : enter(judged, reverse ? 'forward' : 'exit');
}

/** Leaving the box: signal and mirrors at move-off, manoeuvre count, and the car clear of the box. */
function onExitStep(session: Session, car: CarState, cockpit: CockpitState): Session {
  const speed = car.world.vehicle.speedMps;
  const direction = Math.abs(speed) > 0.05 ? Math.sign(speed) : 0;
  let next = session;
  if (direction !== 0 && direction !== next.exit.direction)
    next = {
      ...next,
      exit: { ...next.exit, direction },
      measurements: { ...next.measurements, exitManoeuvres: next.measurements.exitManoeuvres + 1 },
    };
  if (direction !== 0 && !next.exit.movedOffChecked) {
    next = { ...next, exit: { ...next.exit, movedOffChecked: true } };
    if (cockpit.signal !== 'left') next = fault(next, 'rule.minor.j-no-signal-leaving-box');
    if (next.phase !== 'finished' && !next.exit.looked) next = fault(next, 'rule.high.e-no-mirror-check-leaving-box');
  }
  // Clear of the box: past the lane-side posts (x = -4) with the whole body.
  if (next.phase !== 'finished' && car.world.vehicle.x > -2.5) return finish(next);
  return next;
}

function onEvent(session: Session, event: CarEvent): Session {
  if (session.phase === 'recognition')
    return event.type === 'gear-engaged' ? judgeRecognition(session, `gear-${event.gear}`) : session;
  if (!inStageTwo(session)) return session;
  switch (event.type) {
    case 'start-refused':
      if (event.reason === 'in-gear') return fault(session, 'rule.minor.e-neutral-check-before-start');
      if (event.reason === 'running')
        return fault(session, 'rule.minor.h-start-while-running', `run-${session.engineStarts}`);
      return session;
    case 'engine-started': {
      const next = { ...session, engineStarts: session.engineStarts + 1 };
      return next.phase === 'unlock' ? enter(next, 'reverse') : next;
    }
    case 'handbrake':
      return { ...session, handbrakeEpisodes: session.handbrakeEpisodes + 1 };
    case 'moved-with-handbrake':
      return fault(session, 'rule.minor.f-handbrake-on-start', `handbrake-${session.handbrakeEpisodes}`);
    case 'stall':
      return fault(session, 'rule.low.d-engine-stall');
    case 'contact':
      if (
        event.kind === 'curb' ||
        (event.kind === 'pole' && event.impactSpeedMps >= GAME_PARAMETERS.markerKnockSpeedMps)
      )
        return fault(session, 'rule.eliminatory.d-curb-mount-or-marker-hit');
      return event.kind === 'pole' ? fault(session, 'rule.high.d-box-marker-touch') : session;
    default:
      return session;
  }
}

/** A pedal counts when it goes down; which one went down answers the examiner's question. */
function onPedals(session: Session, car: CarState): Session {
  let next = session;
  for (const pedal of PEDALS) {
    const down = car.controls[pedal] >= 0.5;
    if (down === next.pedalsDown[pedal]) continue;
    next = { ...next, pedalsDown: { ...next.pedalsDown, [pedal]: down } };
    if (down && next.phase === 'recognition') next = judgeRecognition(next, pedal);
  }
  return next;
}

function onStep(
  session: Session,
  car: CarState,
  cockpit: CockpitState,
  events: readonly CarEvent[],
  dt: number,
): Session {
  let next = onPedals({ ...session, timeS: session.timeS + dt }, car);
  for (const event of events) {
    if (next.phase === 'finished') return next;
    next = onEvent(next, event);
  }
  if (next.phase === 'finished') return next;
  if (
    inStageTwo(next) &&
    next.phase !== 'unlock' &&
    !next.movedOff &&
    Math.abs(car.world.vehicle.speedMps) > GAME_PARAMETERS.movedOffMps
  ) {
    next = { ...next, movedOff: true };
    if (!cockpit.belt) next = fault(next, 'rule.eliminatory.c-no-seatbelt');
    if (next.phase === 'finished') return next;
  }
  if (next.phase === 'reverse' || next.phase === 'forward') return onManoeuvreStep(next, car, dt);
  if (next.phase === 'exit') return onExitStep(next, car, cockpit);
  return next;
}

/** Advances the exam with what just happened. Pure: the same observations always give the same session. */
export function observe(session: Session, observation: Observation): Session {
  if (session.phase === 'finished') return session;
  switch (observation.type) {
    case 'cockpit':
      return onCockpit(session, observation.command, observation.after);
    case 'ready':
      return onReady(session);
    case 'request-stop':
      return finish({ ...session, ledger: interrupt(session.ledger, session.timeS, 'driver-request') });
    case 'step':
      return onStep(session, observation.car, observation.cockpit, observation.events, observation.dt);
  }
}
