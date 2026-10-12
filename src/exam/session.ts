import { createLedger, interrupt, recordFault, withdrawFault } from './scoring.ts';
import type { Ledger, Stage } from './scoring.ts';
import { createRandom, shuffle } from '../activities/random.ts';
import type { Rule } from '../content/schemas.ts';
import { MIRROR_IDS } from '../practice/cockpit.ts';
import type { CockpitCommand, CockpitState, MirrorId } from '../practice/cockpit.ts';
import type { CarEvent, CarState } from '../sim/car.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import type { ScenarioState } from '../sim/scenario.ts';
import type { OrientedBox } from '../sim/collision.ts';
import { overlaps } from '../sim/collision.ts';
import { EXAM_CAR, bodyBox, forwardOf, restingVehicle } from '../sim/vehicle.ts';

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
  /** Standing inside the intersection this long with the light red counts as blocking it. */
  blockIntersectionS: 2,
  /** The right turn is done once the heading has swung at least this far (about 70°). */
  turnDoneHeadingRad: -1.2,
  /** Metres before the corner by which the turn must be signalled (protocolo PDF 12, 24). */
  signalBeforeCornerM: 30,
} as const;

/** The street after the box: zones and limits of the first block (firstBlock.ts); absent in the closed yard. */
export interface Course {
  stopLineZ: number;
  crosswalk: OrientedBox;
  intersection: OrientedBox;
  turnDoneX: number;
  /** Exam limits (REGLAS.md §6) and the roads' own maxima, which fix the eliminatory l (decision D2). */
  limits: { examKmh: number; roadKmh: number; avenueExamKmh: number; avenueRoadKmh: number };
}

/** The first 100 m after leaving the box (protocolo PDF 11, 31). */
const FIRST_METRES_M = 100;

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
  | 'approach'
  | 'turn'
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
      scenario?: ScenarioState | null;
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
  course: Course | null;
  measurements: {
    reverseCm: number | null;
    forwardCm: number | null;
    exitManoeuvres: number;
    firstMetresTopKmh: number | null;
  };
  street: {
    odometerStartM: number | null;
    signalledAtZ: number | null;
    crossedStopLine: boolean;
    blockedS: number;
    stops: number;
    wasStopped: boolean;
    /** Over the exam limit right now, and how many such episodes there were: correcting it ends one (D3). */
    speeding: boolean;
    speedEpisodes: number;
    /** The speed episode that already scored the road maximum: no exam-speed fault in it (D2). */
    roadMaxEpisode: number | null;
  };
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
  exit: { looked: boolean; direction: number; movedOffChecked: boolean };
}

const PEDALS = ['throttle', 'brake', 'clutch'] as const;
const STAGE_TWO_PHASES: readonly Phase[] = ['unlock', 'reverse', 'forward', 'exit', 'firstMetres', 'approach', 'turn'];
const STREET_PHASES: readonly Phase[] = ['firstMetres', 'approach', 'turn'];
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
  course: Course | null = null,
): Session {
  return {
    rules,
    kind,
    course,
    seed,
    phase: 'familiarisation',
    prompt: { kind: 'say', message: 'familiarisation' },
    ledger: createLedger(rules),
    completedStages: [],
    timeS: 0,
    measurements: { reverseCm: null, forwardCm: null, exitManoeuvres: 0, firstMetresTopKmh: null },
    street: {
      odometerStartM: null,
      signalledAtZ: null,
      crossedStopLine: false,
      blockedS: 0,
      stops: 0,
      wasStopped: false,
      speeding: false,
      speedEpisodes: 0,
      roadMaxEpisode: null,
    },
    queue: recognitionQueue(kind, seed),
    adjusted: { seat: false, headrest: false, mirrors: [] },
    pedalsDown: { throttle: false, brake: false, clutch: false },
    lastGear: kind === 'manual' ? 'N' : 'P',
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
function fault(session: Session, ruleId: string, episode?: string, escalate = false): Session {
  const ledger = recordFault(session.ledger, { ruleId, atS: session.timeS, episode, escalate });
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
  if (next.phase === 'exit' && command.type === 'look' && yaw >= min && yaw <= max)
    return { ...next, exit: { ...next.exit, looked: true } };
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
  if (next.phase !== 'finished' && car.world.vehicle.x > -2.5) {
    if (!next.course) return finish(next);
    return enter({ ...next, street: { ...next.street, odometerStartM: car.world.vehicle.odometerM } }, 'firstMetres');
  }
  return next;
}

const kmhOf = (car: CarState) => Math.abs(car.world.vehicle.speedMps) * 3.6;

/** Exam speed against the road's maximum (decision D2: one episode, the more severe rule only). */
function judgeSpeed(session: Session, car: CarState, roadKmh: number, examKmh: number): Session {
  const kmh = kmhOf(car);
  const tolerance = GAME_PARAMETERS.speedToleranceKmh;
  const over = kmh > examKmh + tolerance;
  let next = session;
  if (over && !next.street.speeding)
    next = { ...next, street: { ...next.street, speeding: true, speedEpisodes: next.street.speedEpisodes + 1 } };
  if (!over && next.street.speeding) next = { ...next, street: { ...next.street, speeding: false } };
  const episode = `speed-${next.street.speedEpisodes}`;
  if (kmh > roadKmh + tolerance) {
    // One episode, the more severe rule only (D2): the exam-speed fault of this episode is withdrawn, and not
    // scored again while the episode goes on below the road maximum.
    const ledger = withdrawFault(next.ledger, 'rule.high.f-exam-speed-exceeded', episode);
    const marked: Session = { ...next, ledger, street: { ...next.street, roadMaxEpisode: next.street.speedEpisodes } };
    return fault(marked, 'rule.eliminatory.l-road-speed-limit-exceeded');
  }
  if (over && next.street.roadMaxEpisode !== next.street.speedEpisodes)
    return fault(next, 'rule.high.f-exam-speed-exceeded', episode);
  return next;
}

/** First 100 m: at most 30 km/h in second (manual) or D (automatic); otherwise the instruction is not followed. */
function onFirstMetresStep(session: Session, car: CarState, course: Course): Session {
  const kmh = kmhOf(car);
  const { powertrain } = car;
  const topKmh = Math.max(session.measurements.firstMetresTopKmh ?? 0, kmh);
  let next: Session = { ...session, measurements: { ...session.measurements, firstMetresTopKmh: topKmh } };
  const wrongGear =
    kmh > GAME_PARAMETERS.firstMetresGearSpeedKmh &&
    (powertrain.kind === 'manual' ? powertrain.manualGear !== '2' : powertrain.lever !== 'D');
  if (kmh > course.limits.examKmh + GAME_PARAMETERS.speedToleranceKmh || wrongGear)
    next = fault(next, 'rule.eliminatory.g-first-block-instruction');
  if (next.phase === 'finished') return next;
  const start = next.street.odometerStartM ?? car.world.vehicle.odometerM;
  return car.world.vehicle.odometerM - start >= FIRST_METRES_M ? enter(next, 'approach') : next;
}

/** Where the current right-signal episode began; switching it off or to the left forgets it. */
function noteSignal(session: Session, car: CarState, cockpit: CockpitState): Session {
  const { signalledAtZ } = session.street;
  if (cockpit.signal !== 'right')
    return signalledAtZ === null ? session : { ...session, street: { ...session.street, signalledAtZ: null } };
  if (signalledAtZ !== null) return session;
  return { ...session, street: { ...session.street, signalledAtZ: car.world.vehicle.z } };
}

/** Up to the corner: the light, the stop line, the crosswalk, blocking the intersection and the turn signal. */
function onApproachStep(
  session: Session,
  car: CarState,
  cockpit: CockpitState,
  scenario: ScenarioState | null,
  course: Course,
  dt: number,
): Session {
  let next = judgeSpeed(session, car, course.limits.roadKmh, course.limits.examKmh);
  if (next.phase === 'finished') return next;
  const vehicle = car.world.vehicle;
  const body = bodyBox(EXAM_CAR, vehicle);
  const frontZ = body.centerZ + body.halfLengthM;
  const stopped = vehicle.speedMps === 0;
  const light = scenario?.light ?? 'green';
  next = noteSignal(next, car, cockpit);
  // Stopping past the line or on the crosswalk, once per stop.
  if (stopped && !next.street.wasStopped) {
    next = { ...next, street: { ...next.street, wasStopped: true, stops: next.street.stops + 1 } };
    if (frontZ > course.stopLineZ + 0.1)
      next = fault(next, 'rule.high.h-stop-over-line-or-crosswalk', `stop-${next.street.stops}`);
  } else if (!stopped && next.street.wasStopped) next = { ...next, street: { ...next.street, wasStopped: false } };
  if (next.phase === 'finished') return next;
  // Entering the crosswalk while a pedestrian is on it.
  const pedestrianOnCrosswalk = scenario?.poses.some(
    (pose) => pose.kind === 'pedestrian' && pose.active && pose.inside(course.crosswalk),
  );
  if (pedestrianOnCrosswalk && !stopped && overlaps(body, course.crosswalk))
    next = fault(next, 'rule.high.l-yield-to-pedestrians-cyclists', 'crosswalk');
  if (next.phase === 'finished') return next;
  // Standing inside the intersection with the light red.
  const blockedS = stopped && light === 'red' && overlaps(body, course.intersection) ? next.street.blockedS + dt : 0;
  next = { ...next, street: { ...next.street, blockedS } };
  if (blockedS >= GAME_PARAMETERS.blockIntersectionS)
    next = fault(next, 'rule.high.i-block-intersection', 'intersection');
  if (next.phase === 'finished') return next;
  // Crossing the stop line: the red light, and the signal that should have been on 30 m before the corner.
  if (!next.street.crossedStopLine && frontZ >= course.stopLineZ) {
    next = { ...next, street: { ...next.street, crossedStopLine: true } };
    if (light === 'red') next = fault(next, 'rule.eliminatory.k-red-light');
    if (next.phase === 'finished') return next;
    const signalledAt = next.street.signalledAtZ;
    if (signalledAt === null) next = fault(next, 'rule.low.g-no-turn-signal');
    else if (course.stopLineZ - signalledAt < GAME_PARAMETERS.signalBeforeCornerM)
      next = fault(next, 'rule.minor.q-turn-lane-late');
    if (next.phase === 'finished') return next;
  }
  // Into the intersection: the turn begins.
  const nearEdgeZ = course.intersection.centerZ - course.intersection.halfLengthM;
  return frontZ >= nearEdgeZ ? enter(next, 'turn') : next;
}

/** The right turn onto the avenue: done past the corner heading -x; going straight ignores the examiner. */
function onTurnStep(session: Session, car: CarState, course: Course): Session {
  const vehicle = car.world.vehicle;
  const turned = vehicle.headingRad <= GAME_PARAMETERS.turnDoneHeadingRad;
  const { limits } = course;
  let next = judgeSpeed(
    session,
    car,
    turned ? limits.avenueRoadKmh : limits.roadKmh,
    turned ? limits.avenueExamKmh : limits.examKmh,
  );
  if (next.phase === 'finished') return next;
  // Past the middle of the avenue still heading along the street: the car did not turn.
  if (vehicle.z > course.intersection.centerZ + 2 && vehicle.headingRad > -0.5)
    next = fault(next, 'rule.eliminatory.f-examiner-safety-instruction-ignored');
  if (next.phase === 'finished') return next;
  return turned && vehicle.x <= course.turnDoneX ? finish(next) : next;
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
    case 'actor-contact':
      // Hitting a pedestrian: the examiner intervenes (escalated high l). Hitting a vehicle: a reckless manoeuvre.
      return event.actor === 'pedestrian'
        ? fault(session, 'rule.high.l-yield-to-pedestrians-cyclists', 'crosswalk', true)
        : fault(session, 'rule.eliminatory.i-reckless-maneuver');
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
  scenario?: ScenarioState | null,
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
  if (next.course && STREET_PHASES.includes(next.phase)) {
    if (next.phase === 'firstMetres') {
      // The corner rules also watch a car that reaches the line within its first 100 m.
      const judged = onFirstMetresStep(noteSignal(next, car, cockpit), car, next.course);
      return judged.phase === 'firstMetres' ? judged : judged;
    }
    if (next.phase === 'approach') return onApproachStep(next, car, cockpit, scenario ?? null, next.course, dt);
    return onTurnStep(next, car, next.course);
  }
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
