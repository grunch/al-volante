import { createLedger, interrupt, recordFault, withdrawFault } from './scoring.ts';
import type { Ledger, Stage } from './scoring.ts';
import type { Circuit } from './circuit.ts';
import { createStreet, judgeCirculation, noteGlance } from './circulation.ts';
import { remember } from './street.ts';
import type { Report, Street, Verdict } from './circulation.ts';
import { createRandom, shuffle } from '../activities/random.ts';
import type { Rule } from '../content/schemas.ts';
import { MIRROR_IDS } from '../practice/cockpit.ts';
import type { CockpitCommand, CockpitState, MirrorId } from '../practice/cockpit.ts';
import type { CarEvent, CarState } from '../sim/car.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { TrafficSnapshot } from '../sim/scenario.ts';
import { forwardOf, restingVehicle } from '../sim/vehicle.ts';

/** Game approximations, not protocol values (REGLAS.md §7, V2 and D4). The feedback shows them as such. */
export const GAME_PARAMETERS = {
  /** The protocol only says "more or less than 30 cm" (V2). */
  displacementToleranceCm: 10,
  /** Turning the wheel more than this during the 30 cm manoeuvres counts as moving it. */
  steerHeldRad: 0.03,
  /** A post touched slower than this is a scrape (high d); faster, it is knocked over (eliminatory d). */
  markerKnockSpeedMps: 1,
  /** A glance within this yaw range is a look at a side mirror (D4); turning further is a head turn, a complement only (X6). */
  mirrorGlanceYawRad: { min: 0.25, max: 0.9 },
  /** A kerb touched slower than this is a scrape of the wheel (minor i); faster, the car mounted it (eliminatory d). */
  kerbMountSpeedMps: 1,
  /** Braking during a manual 30 cm manoeuvre is allowed only to immobilise: moving further than this afterwards is not. */
  brakeThenMoveM: 0.05,
  /** Standing still this long ends a 30 cm manoeuvre. */
  settleS: 0.5,
  /** Faster than this, the car has moved off in stage II (belt check, cutoff no longer applies). */
  movedOffMps: 0.2,
  /** Speed limits are judged with this margin, so a reading of 30.4 km/h is not over 30. */
  speedToleranceKmh: 1,
  /** In the first 100 m, above this speed the manual must be in second and the automatic in D. */
  firstMetresGearSpeedKmh: 15,
  /** The car has left the box once it is this far to the left of where it was parked (in the lane). */
  exitLateralM: 2.5,
} as const;

/** The first 100 m after leaving the box (protocolo PDF 11, 31). */
const FIRST_METRES_M = 100;
/** The instructed maximum over the whole first 100 m, whatever the road they end on (protocolo PDF 11, 31). */
const FIRST_METRES_KMH = 30;

/** Rear axle in the middle of the yard's parking box (practiceYard.ts), facing +z with the kerb on the right. */
export const EXAM_START = restingVehicle({ x: -5.15, z: 11.65, headingRad: 0 });

export type Phase =
  | 'familiarisation'
  | 'recognition'
  | 'preparation'
  | 'unlock'
  | 'reverse'
  | 'forward'
  | 'exit'
  | 'firstMetres'
  | 'circulation'
  | 'finished';

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
  | {
      type: 'step';
      car: CarState;
      cockpit: CockpitState;
      events: readonly CarEvent[];
      dt: number;
      scenario?: TrafficSnapshot | null;
    }
  | { type: 'ready' }
  | { type: 'request-stop' };

interface Manoeuvre {
  startX: number;
  startZ: number;
  headingRad: number;
  moved: boolean;
  violated: boolean;
  stoppedS: number;
  /** Displacement when the brake was first pressed while moving (manual), to tell a final stop from regulating. */
  brakedAtM: number | null;
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
  /** The circuit after the box (F04-T03); null in the closed yard, where the exam ends on leaving the box. */
  circuit: Circuit | null;
  measurements: {
    reverseCm: number | null;
    forwardCm: number | null;
    exitManoeuvres: number;
    firstMetresTopKmh: number | null;
  };
  /** Stage II on the street: progress, context and the memory every circulation rule needs (circulation.ts). */
  street: Street;
  queue: readonly RecognitionTarget[];
  /** Stage I adjustments made since the recognition began; all three mirrors must be checked (protocolo PDF 9). */
  adjusted: { seat: boolean; headrest: boolean; mirrors: readonly MirrorId[] };
  pedalsDown: { throttle: boolean; brake: boolean; clutch: boolean };
  /** Gear or lever position last engaged, to tell a shift towards the asked gear from one away from it. */
  lastGear: string;
  engineStarts: number;
  handbrakeEpisodes: number;
  /** The car moved in stage II, so the cutoff before circulation no longer applies. */
  movedOff: boolean;
  manoeuvre: Manoeuvre | null;
  exit: {
    looked: boolean;
    direction: number;
    movedOffChecked: boolean;
    /** Where the car stood when the exit began, to measure how far into the lane it has moved. */
    origin: { x: number; z: number; headingRad: number } | null;
  };
}

const PEDALS = ['throttle', 'brake', 'clutch'] as const;
const STAGE_TWO_PHASES: readonly Phase[] = ['unlock', 'reverse', 'forward', 'exit', 'firstMetres', 'circulation'];
const STREET_PHASES: readonly Phase[] = ['firstMetres', 'circulation'];
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

/** Every position of the box, in the order the lever reaches them. */
const BOX_SEQUENCE: Record<TransmissionKind, readonly string[]> = {
  manual: ['R', 'N', '1', '2', '3', '4', '5'],
  automatic: ['P', 'R', 'N', 'D'],
};

/** The gearbox is run through whole and back to N or P (protocolo PDF 9), one neighbour at a time. */
const GEAR_ROUND: Record<TransmissionKind, readonly string[]> = {
  manual: ['1', '2', '3', '4', '5', '4', '3', '2', '1', 'N', 'R', 'N'],
  automatic: ['R', 'N', 'D', 'N', 'R', 'P'],
};

/** Pedals, lights and instruments in a seeded random order; the gearbox round keeps its order, as one block. */
function recognitionQueue(kind: TransmissionKind, seed: number): RecognitionTarget[] {
  const random = createRandom(seed);
  const pedals: RecognitionTarget[] = kind === 'manual' ? ['clutch', 'brake', 'throttle'] : ['brake', 'throttle'];
  const others = shuffle([...pedals, ...LIGHT_TARGETS, ...INSTRUMENT_TARGETS], random);
  const gears: RecognitionTarget[] = GEAR_ROUND[kind].map((gear) => `gear-${gear}` as const);
  const at = Math.floor(random() * (others.length + 1));
  return [...others.slice(0, at), ...gears, ...others.slice(at)];
}

export function createSession(
  rules: readonly Rule[],
  kind: TransmissionKind,
  seed: number,
  circuit: Circuit | null = null,
): Session {
  return {
    rules,
    kind,
    circuit,
    seed,
    phase: 'familiarisation',
    prompt: { kind: 'say', message: 'familiarisation' },
    ledger: createLedger(rules),
    completedStages: [],
    timeS: 0,
    measurements: { reverseCm: null, forwardCm: null, exitManoeuvres: 0, firstMetresTopKmh: null },
    street: createStreet(circuit),
    queue: recognitionQueue(kind, seed),
    adjusted: { seat: false, headrest: false, mirrors: [] },
    pedalsDown: { throttle: false, brake: false, clutch: false },
    lastGear: kind === 'manual' ? 'N' : 'P',
    engineStarts: 0,
    handbrakeEpisodes: 0,
    movedOff: false,
    manoeuvre: null,
    exit: { looked: false, direction: 0, movedOffChecked: false, origin: null },
  };
}

const enter = (session: Session, phase: Phase): Session => ({
  ...session,
  phase,
  prompt: { kind: 'say', message: phase },
});
const finish = (session: Session): Session => (session.phase === 'finished' ? session : enter(session, 'finished'));
const inStageTwo = (session: Session) => STAGE_TWO_PHASES.includes(session.phase);

/** With 8 points or more before circulating, the exam is interrupted (protocolo PDF 10). */
function cutoff(session: Session): Session {
  if (!inStageTwo(session) || session.movedOff || session.ledger.points < 8) return session;
  return finish({ ...session, ledger: interrupt(session.ledger, session.timeS, 'cutoff') });
}

/** Scores a fault; an interruption ends the exam, except during the recognition round, which is judged whole. */
function fault(
  session: Session,
  ruleId: string,
  episode?: string,
  escalate = false,
  cause?: 'fault' | 'examiner',
): Session {
  const ledger = recordFault(session.ledger, { ruleId, atS: session.timeS, episode, escalate, cause });
  const next: Session = { ...session, ledger };
  if (ledger.interruption && session.phase !== 'recognition') return finish(next);
  return cutoff(next);
}

/**
 * The examiner takes the dual controls (protocolo PDF 7): a recent fault that escalates is raised to eliminatory
 * (high e, l, n, o); with none to raise, the manoeuvre itself is reckless (eliminatory i). The exam is interrupted.
 */
function takeover(session: Session): Session {
  const marked: Session = { ...session, street: { ...session.street, takeover: true } };
  const pending = marked.street.escalatable.at(-1);
  const judged = pending
    ? fault(marked, pending.ruleId, pending.episode, true)
    : fault(marked, 'rule.eliminatory.i-reckless-maneuver', undefined, false, 'examiner');
  return judged.phase === 'finished' ? judged : finish(judged);
}

/**
 * Applies what the circulation judge reported, in order, until an interruption ends the exam; with `all`, every
 * report of the step is recorded even after one interrupts (the examiner took over in that same step).
 */
function applyReports(session: Session, reports: readonly Report[], all = false): Session {
  let next = session;
  for (const report of reports) {
    if (next.phase === 'finished' && !all) return next;
    if (report.withdraw) {
      next = { ...next, ledger: withdrawFault(next.ledger, report.ruleId, report.episode) };
      continue;
    }
    next = fault(next, report.ruleId, report.episode);
  }
  return next;
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

/** A gear on the way to the asked one is not an answer yet; a gear further away from it is a wrong one. */
function judgeGear(session: Session, engaged: string): Session {
  const target = session.queue[0];
  const next: Session = { ...session, lastGear: engaged };
  if (target === undefined || !target.startsWith('gear-')) return next;
  const sequence = BOX_SEQUENCE[session.kind];
  const distance = (gear: string) => Math.abs(sequence.indexOf(gear) - sequence.indexOf(target.slice(5)));
  if (engaged === target.slice(5)) return nextPrompt(next);
  return distance(engaged) > distance(session.lastGear) ? nextPrompt(fault(next, FAMILY_RULES.gears)) : next;
}

/** The answer a cabin command gives, if any: switching something off answers nothing. */
function cockpitAnswer(command: CockpitCommand, after: CockpitState): RecognitionTarget | null {
  switch (command.type) {
    case 'lights':
      return command.value === 'off' ? null : command.value;
    case 'signal':
      return command.value === 'off' ? null : command.value === 'left' ? 'signal-left' : 'signal-right';
    case 'toggle':
      if (command.control === 'belt' || command.control === 'heating' || !after[command.control]) return null;
      return command.control;
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
  if (command.type === 'mirror' && !next.adjusted.mirrors.includes(command.mirror))
    next = { ...next, adjusted: { ...next.adjusted, mirrors: [...next.adjusted.mirrors, command.mirror] } };
  if (next.phase === 'recognition') {
    const answered = cockpitAnswer(command, after);
    return answered ? judgeRecognition(next, answered) : next;
  }
  // Taking the belt off during the exam eliminates (eliminatory c).
  if (inStageTwo(next) && next.movedOff && command.type === 'toggle' && command.control === 'belt' && !after.belt)
    return fault(next, 'rule.eliminatory.c-no-seatbelt');
  const yaw = Math.abs(after.lookYaw);
  const { min, max } = GAME_PARAMETERS.mirrorGlanceYawRad;
  const glance = command.type === 'look' && yaw >= min && yaw <= max;
  if (next.phase === 'exit' && glance) return { ...next, exit: { ...next.exit, looked: true } };
  if (STREET_PHASES.includes(next.phase) && glance)
    return { ...next, street: noteGlance(next.street, after.lookYaw, next.timeS) };
  return next;
}

function onReady(session: Session): Session {
  switch (session.phase) {
    case 'familiarisation': {
      // The page puts the car back as stage I requires (engine off, key in contact); pedals start up.
      const reset: Session = {
        ...session,
        pedalsDown: { throttle: false, brake: false, clutch: false },
        lastGear: session.kind === 'manual' ? 'N' : 'P',
        // The cabin is put back too, so adjustments made while familiarising are gone with it.
        adjusted: { seat: false, headrest: false, mirrors: [] },
      };
      const first = reset.queue[0];
      return first
        ? { ...reset, phase: 'recognition', prompt: { kind: 'recognise', target: first } }
        : enter(reset, 'preparation');
    }
    case 'preparation': {
      let next = session;
      if (!next.adjusted.seat) next = fault(next, 'rule.minor.c-seat-adjustment');
      if (!next.adjusted.headrest) next = fault(next, 'rule.minor.d-headrest-adjustment');
      if (next.adjusted.mirrors.length < MIRROR_IDS.length) next = fault(next, 'rule.high.a-mirrors-not-checked');
      return cutoff(enter({ ...next, completedStages: [...next.completedStages, 'I'] }, 'unlock'));
    }
    default:
      return session;
  }
}

function startManoeuvre(car: CarState): Manoeuvre {
  const { x, z, headingRad } = car.world.vehicle;
  return { startX: x, startZ: z, headingRad, moved: false, violated: false, stoppedS: 0, brakedAtM: null };
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
  let brakedAtM = manoeuvre.brakedAtM;
  if (moving || manoeuvre.moved) {
    if (Math.abs(vehicle.steerRad) > GAME_PARAMETERS.steerHeldRad) violated = true;
    // Clutch only (manual) or brake only (automatic): no accelerator in either.
    if (car.controls.throttle > 0.05) violated = true;
    // Manual: the brake only immobilises at the end (PDF 11); where it was first pressed is checked at the end.
    if (session.kind === 'manual' && moving && car.controls.brake > 0.05 && brakedAtM === null)
      brakedAtM = displacement;
    // The wrong direction, or a second manoeuvre after the first (forward: in one manoeuvre).
    if (reverse ? vehicle.speedMps > 0.01 : vehicle.speedMps < -0.01) violated = true;
    // Reverse in R; forward in first (manual) or D (automatic), protocolo PDF 11.
    const gear = car.powertrain.kind === 'manual' ? car.powertrain.manualGear : car.powertrain.lever;
    const expected = reverse ? 'R' : car.powertrain.kind === 'manual' ? '1' : 'D';
    if (moving && gear !== expected) violated = true;
  }
  const moved = manoeuvre.moved || Math.abs(displacement) > 0.01;
  const stoppedS = moving ? 0 : manoeuvre.stoppedS + dt;
  const next: Session = { ...session, manoeuvre: { ...manoeuvre, moved, violated, stoppedS, brakedAtM } };
  if (!moved || stoppedS < GAME_PARAMETERS.settleS) return next;
  const cm = (reverse ? -displacement : displacement) * 100;
  const regulatedWithBrake = brakedAtM !== null && Math.abs(displacement - brakedAtM) > GAME_PARAMETERS.brakeThenMoveM;
  const failed = violated || regulatedWithBrake || Math.abs(cm - 30) > GAME_PARAMETERS.displacementToleranceCm;
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

/** How far to the left of where the exit began the car now stands (in the frame of the parked car). */
function exitLateralM(session: Session, car: CarState): number {
  const origin = session.exit.origin;
  if (!origin) return 0;
  const { x, z } = car.world.vehicle;
  return (x - origin.x) * Math.cos(origin.headingRad) - (z - origin.z) * Math.sin(origin.headingRad);
}

/** Leaving the box: signal and mirrors at move-off, manoeuvre count, and the car clear of the box. */
function onExitStep(session: Session, car: CarState, cockpit: CockpitState): Session {
  const speed = car.world.vehicle.speedMps;
  const direction = Math.abs(speed) > 0.05 ? Math.sign(speed) : 0;
  let next = session;
  if (!next.exit.origin) {
    const { x, z, headingRad } = car.world.vehicle;
    next = { ...next, exit: { ...next.exit, origin: { x, z, headingRad } } };
  }
  if (direction !== 0 && direction !== next.exit.direction)
    next = {
      ...next,
      exit: { ...next.exit, direction },
      measurements: { ...next.measurements, exitManoeuvres: next.measurements.exitManoeuvres + 1 },
    };
  if (direction !== 0 && !next.exit.movedOffChecked) {
    next = { ...next, exit: { ...next.exit, movedOffChecked: true } };
    if (cockpit.signal !== 'left') next = fault(next, 'rule.minor.j-no-signal-leaving-box');
    if (next.phase !== 'finished' && !next.exit.looked) {
      // High e escalates (protocolo PDF 7): a takeover while leaving the box raises it instead of a reckless i.
      const street = remember(next.street, 'rule.high.e-no-mirror-check-leaving-box', 'exit', next.timeS);
      next = fault({ ...next, street }, 'rule.high.e-no-mirror-check-leaving-box', 'exit');
    }
  }
  // Clear of the box: in the lane, a car's width or more to the left of where it was parked.
  if (next.phase !== 'finished' && exitLateralM(next, car) >= GAME_PARAMETERS.exitLateralM) {
    if (!next.circuit) return finish(next);
    return enter({ ...next, street: { ...next.street, odometerStartM: car.world.vehicle.odometerM } }, 'firstMetres');
  }
  return next;
}

const kmhOf = (car: CarState) => Math.abs(car.world.vehicle.speedMps) * 3.6;

/** First 100 m: at most 30 km/h in second (manual) or D (automatic); otherwise the instruction is not followed. */
function onFirstMetresStep(session: Session, car: CarState): Session {
  const kmh = kmhOf(car);
  const { powertrain } = car;
  const topKmh = Math.max(session.measurements.firstMetresTopKmh ?? 0, kmh);
  let next: Session = { ...session, measurements: { ...session.measurements, firstMetresTopKmh: topKmh } };
  const wrongGear =
    kmh > GAME_PARAMETERS.firstMetresGearSpeedKmh &&
    (powertrain.kind === 'manual' ? powertrain.manualGear !== '2' : powertrain.lever !== 'D');
  if (kmh > FIRST_METRES_KMH + GAME_PARAMETERS.speedToleranceKmh || wrongGear)
    next = fault(next, 'rule.eliminatory.g-first-block-instruction');
  if (next.phase === 'finished') return next;
  const start = next.street.odometerStartM ?? car.world.vehicle.odometerM;
  return car.world.vehicle.odometerM - start >= FIRST_METRES_M ? enter(next, 'circulation') : next;
}

/** Stage II on the circuit: every circulation rule, the examiner's takeover and the end of the lap. */
function onCirculationStep(
  session: Session,
  car: CarState,
  cockpit: CockpitState,
  scenario: TrafficSnapshot | null,
  circuit: Circuit,
  dt: number,
): Session {
  const firstMetres = session.phase === 'firstMetres';
  const verdict = judgeCirculation(session.street, circuit, car, cockpit, scenario, dt, session.timeS, firstMetres);
  let next: Session = { ...session, street: verdict.street };
  if (firstMetres) next = onFirstMetresStep(next, car);
  if (next.phase === 'finished') return next;
  return settleCirculation(next, verdict);
}

/**
 * Applies one step's verdict. When the examiner takes the dual controls in that step, the takeover is applied even
 * if a fault of the same step already interrupted (crossing on red towards a car): every fault is recorded, the
 * escalation or the reckless manoeuvre is added, and the interruption is the examiner's (protocolo PDF 7).
 */
export function settleCirculation(session: Session, verdict: Pick<Verdict, 'reports' | 'takeover' | 'done'>): Session {
  if (verdict.takeover) {
    const taken = takeover(applyReports(session, verdict.reports, true));
    const interruption = taken.ledger.interruption;
    if (interruption?.cause !== 'fault' || interruption.atS !== taken.timeS) return taken;
    return { ...taken, ledger: { ...taken.ledger, interruption: { ...interruption, cause: 'examiner' } } };
  }
  const next = applyReports(session, verdict.reports);
  if (next.phase === 'finished') return next;
  // Back on the first leg after the eighth: stage II is complete. Stage III (parking) is F04-T04.
  if (verdict.done) return finish({ ...next, completedStages: [...next.completedStages, 'II'] });
  return next;
}

function onEvent(session: Session, event: CarEvent): Session {
  if (session.phase === 'recognition') return event.type === 'gear-engaged' ? judgeGear(session, event.gear) : session;
  if (event.type === 'gear-engaged') return { ...session, lastGear: event.gear };
  if (!inStageTwo(session)) return session;
  switch (event.type) {
    case 'start-refused':
      if (event.reason === 'in-gear') return fault(session, 'rule.minor.e-neutral-check-before-start');
      if (event.reason === 'running')
        return fault(session, 'rule.minor.h-start-while-running', `run-${session.engineStarts}`);
      return session;
    case 'engine-started': {
      let next: Session = { ...session, engineStarts: session.engineStarts + 1 };
      // Starting in gear with the clutch down works, but neutral was not checked (protocolo PDF 10).
      if (next.phase === 'unlock' && !['N', 'P'].includes(next.lastGear))
        next = fault(next, 'rule.minor.e-neutral-check-before-start');
      if (next.phase !== 'unlock') return next;
      return enter(next, 'reverse');
    }
    case 'handbrake':
      return { ...session, handbrakeEpisodes: session.handbrakeEpisodes + 1 };
    case 'moved-with-handbrake':
      return fault(session, 'rule.minor.f-handbrake-on-start', `handbrake-${session.handbrakeEpisodes}`);
    case 'stall':
      return fault(session, 'rule.low.d-engine-stall');
    case 'contact':
      // The collision engine only knows the body touched: speed tells a scrape from a hit (game approximation).
      if (event.kind === 'pole')
        return fault(
          session,
          event.impactSpeedMps >= GAME_PARAMETERS.markerKnockSpeedMps
            ? 'rule.eliminatory.d-curb-mount-or-marker-hit'
            : 'rule.high.d-box-marker-touch',
        );
      if (event.kind === 'curb')
        return fault(
          session,
          event.impactSpeedMps >= GAME_PARAMETERS.kerbMountSpeedMps
            ? 'rule.eliminatory.d-curb-mount-or-marker-hit'
            : 'rule.minor.i-curb-scrape',
        );
      return session;
    case 'actor-contact': {
      // Hitting a pedestrian or a cyclist: the examiner intervenes (escalated high l, on the episode already
      // scored when one exists). Hitting a vehicle: a reckless manoeuvre.
      const onFoot = event.actor === 'pedestrian' || event.actor === 'bicycle';
      const pending = session.street.escalatable.findLast(
        (item) => item.ruleId === 'rule.high.l-yield-to-pedestrians-cyclists',
      );
      const marked: Session = { ...session, street: { ...session.street, takeover: true } };
      return onFoot
        ? fault(marked, 'rule.high.l-yield-to-pedestrians-cyclists', pending?.episode ?? 'contact', true)
        : fault(marked, 'rule.eliminatory.i-reckless-maneuver', undefined, false, 'examiner');
    }
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
  scenario?: TrafficSnapshot | null,
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
  if (next.circuit && STREET_PHASES.includes(next.phase))
    return onCirculationStep(next, car, cockpit, scenario ?? null, next.circuit, dt);
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
      return onStep(
        session,
        observation.car,
        observation.cockpit,
        observation.events,
        observation.dt,
        observation.scenario,
      );
  }
}
