import { entryPose } from '../city/model.ts';
import type { City } from '../city/model.ts';
import type { Attempt } from '../content/schemas.ts';
import type { PowertrainCommand } from '../sim/powertrain/powertrain.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { Stage } from './scoring.ts';

/**
 * The driving modes of the exam page (F04-T05): what each one shows and persists. The modes are the attempt modes of
 * the content contract (PROPUESTA §8) minus `review`, which is the logbook. Which aids each mode shows is decision
 * D15 of REGLAS.md §7: what the examiner says aloud stays in every mode; what the driver must know by themselves is
 * an aid, hidden in the real exam.
 */
export const DRIVING_MODES = ['learn', 'practice', 'run', 'exam'] as const satisfies readonly Attempt['mode'][];
export type DrivingMode = (typeof DRIVING_MODES)[number];

/** Mode names in the URL (`#/examen?modo=rendir`), in the language of the game. */
const MODE_SLUGS: Record<DrivingMode, string> = {
  learn: 'aprender',
  practice: 'practicar',
  run: 'recorrer',
  exam: 'rendir',
};
const STAGE_SLUGS: Record<Stage, string> = { I: '1', II: '2', III: '3' };
export const STAGES: readonly Stage[] = ['I', 'II', 'III'];

export const slugOfMode = (mode: DrivingMode): string => MODE_SLUGS[mode];
export const slugOfStage = (stage: Stage): string => STAGE_SLUGS[stage];

export function modeFromSlug(slug: string | null): DrivingMode | null {
  return DRIVING_MODES.find((mode) => MODE_SLUGS[mode] === slug) ?? null;
}

export function stageFromSlug(slug: string | null): Stage | null {
  return STAGES.find((stage) => STAGE_SLUGS[stage] === slug) ?? null;
}

/**
 * The aids of the HUD (D15). `hints` and `explanations` are the guided learning: what each prompt checks and the
 * fault explained the moment it happens. The rest are readings the real examiner never gives: live points and
 * faults, the control ahead with its light and distance, the speed limits, the measurements of the box, the
 * traffic light readout, the manoeuvre and attempt counters, the distance to the kerb and the descent checklist.
 */
export const HUD_AIDS = [
  'points',
  'faults',
  'notice',
  'limits',
  'measurements',
  'light',
  'parkingCounters',
  'kerbDistance',
  'descentChecklist',
  'hints',
  'explanations',
] as const;
export type Aid = (typeof HUD_AIDS)[number];

const GUIDANCE: readonly Aid[] = ['hints', 'explanations'];
const DRIVING_AIDS: readonly Aid[] = HUD_AIDS.filter((aid) => !GUIDANCE.includes(aid));

const AIDS: Record<DrivingMode, ReadonlySet<Aid>> = {
  learn: new Set(HUD_AIDS),
  practice: new Set(DRIVING_AIDS),
  run: new Set(DRIVING_AIDS),
  exam: new Set(),
};

export const aidsOf = (mode: DrivingMode): ReadonlySet<Aid> => AIDS[mode];

/** Guided learning is not a recorded attempt; the other modes go to the logbook when they end. */
export const isPersisted = (mode: DrivingMode): boolean => mode !== 'learn';

/** Where the car starts: the box of leg 1, or the entry of the last leg when practising stage III alone. */
export function startPoseFor(city: City, stage: Stage | null): VehicleState {
  if (stage !== 'III') return city.start.pose;
  const last = city.legs.at(-1);
  if (!last) throw new Error('the city has no legs');
  return entryPose(city, last.number);
}

/** Stage I starts with the key in contact (protocolo PDF 9); a practice of stage III arrives with the engine running. */
const KEY_IN: readonly PowertrainCommand[] = [{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }];
const ENGINE_RUNNING: readonly PowertrainCommand[] = [...KEY_IN, { type: 'turn-key', to: 'start' }];

export function preparedFor(stage: Stage | null): readonly PowertrainCommand[] {
  return stage === 'III' ? ENGINE_RUNNING : KEY_IN;
}
