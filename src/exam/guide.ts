import { STAGES } from './modes.ts';
import type { Stage } from './scoring.ts';
import type { Phase, StageScope } from './session.ts';

/** A step of the driving guide (F04-T05-FIX01): every phase of the exam but its end. */
export type GuideStep = Exclude<Phase, 'finished'>;

/** The phases of each stage, in the order the examiner asks for them (protocolo PDF 9–13). */
const STAGE_STEPS: Record<Stage, readonly GuideStep[]> = {
  I: ['familiarisation', 'recognition', 'preparation'],
  II: ['unlock', 'reverse', 'forward', 'exit', 'firstMetres', 'circulation'],
  III: ['parking', 'leaving'],
};

/**
 * The steps of the stages a session covers, in order. A practice of stage III starts driving on the last leg, before
 * the parking notice (modes.ts), so its guide begins with the circulation.
 */
export function guideSteps(scope: StageScope): readonly GuideStep[] {
  const stages = STAGES.slice(STAGES.indexOf(scope.from), STAGES.indexOf(scope.to) + 1);
  const steps = stages.flatMap((stage) => STAGE_STEPS[stage]);
  return scope.from === 'III' ? ['circulation', ...steps] : steps;
}

/** Every step of the whole exam. */
export const GUIDE_STEPS: readonly GuideStep[] = guideSteps({ from: 'I', to: 'III' });
