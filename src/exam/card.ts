import type { Rule } from '../content/schemas.ts';
import { resultOf, ruleById } from './scoring.ts';
import type { ExamResult, Fault, Interruption, Stage } from './scoring.ts';
import type { Phase, Session, StageScope } from './session.ts';

/**
 * The card ("ficha") of an exam, one section per stage (protocolo PDF 15–17): which stages ran and were completed,
 * the faults scored in each with their rule, the subtotal, and the verdict of PDF 14. Pure: built from the session.
 */

export const STAGES: readonly Stage[] = ['I', 'II', 'III'];

export interface CardFault {
  fault: Fault;
  rule: Rule;
}

export interface StageCard {
  stage: Stage;
  /** Whether the session runs this stage at all (a practice of one stage leaves the others out). */
  inScope: boolean;
  completed: boolean;
  /** Simulation time the stage began and ended (its last phase left), when it did. */
  startedAtS: number | null;
  endedAtS: number | null;
  faults: readonly CardFault[];
  points: number;
}

export type Verdict =
  | { kind: 'approved'; points: number }
  | { kind: 'disapproved'; cause: 'interruption'; interruption: Interruption; rule: Rule | null }
  | { kind: 'disapproved'; cause: 'eliminatory'; rule: Rule }
  | { kind: 'disapproved'; cause: 'over-points'; points: number }
  | { kind: 'pending'; points: number };

export interface ExamCard {
  stages: readonly StageCard[];
  points: number;
  result: ExamResult;
  verdict: Verdict;
  /** The session reached `finished`; an unfinished session has a pending verdict whatever its points. */
  finished: boolean;
}

/** The phase that opens each stage; stage I opens with the familiarisation (not judged, but part of the session). */
const STAGE_OPENERS: Record<Stage, readonly Phase[]> = {
  I: ['familiarisation', 'recognition', 'preparation'],
  II: ['unlock', 'reverse', 'forward', 'exit', 'firstMetres', 'circulation'],
  III: ['parking', 'leaving'],
};

const inScope = (stage: Stage, scope: StageScope) =>
  STAGES.indexOf(stage) >= STAGES.indexOf(scope.from) && STAGES.indexOf(stage) <= STAGES.indexOf(scope.to);

/** When a stage began: the first transition into one of its phases. */
function startOf(session: Session, stage: Stage): number | null {
  const first = session.transitions.find((item) => STAGE_OPENERS[stage].includes(item.phase));
  return first ? first.atS : null;
}

/** When a stage ended: the first transition after its start into a later stage or into `finished`. */
function endOf(session: Session, stage: Stage, startedAtS: number): number | null {
  const later = STAGES.slice(STAGES.indexOf(stage) + 1).flatMap((next) => STAGE_OPENERS[next]);
  const index = session.transitions.findIndex((item) => STAGE_OPENERS[stage].includes(item.phase));
  const end = session.transitions
    .slice(index + 1)
    .find((item) => item.phase === 'finished' || later.includes(item.phase));
  return end ? Math.max(startedAtS, end.atS) : null;
}

function stageCard(session: Session, stage: Stage): StageCard {
  const scoped = inScope(stage, session.scope);
  const startedAtS = scoped ? startOf(session, stage) : null;
  const faults = session.ledger.faults
    .filter((fault) => fault.stage === stage)
    .map((fault) => ({ fault, rule: ruleById(session.rules, fault.ruleId) }));
  return {
    stage,
    inScope: scoped,
    completed: session.completedStages.includes(stage),
    startedAtS,
    endedAtS: startedAtS === null ? null : endOf(session, stage, startedAtS),
    faults,
    points: faults.reduce((sum, item) => sum + item.fault.points, 0),
  };
}

const isEliminatory = (item: CardFault) => item.rule.severity === 'eliminatory' || item.fault.escalated;

/** The verdict of PDF 14: approved with the three stages and 7 points or less; otherwise, why not. */
function verdictOf(session: Session, stages: readonly StageCard[], result: ExamResult, points: number): Verdict {
  if (result === 'approved') return { kind: 'approved', points };
  if (result === 'pending') return { kind: 'pending', points };
  const { interruption } = session.ledger;
  if (interruption) {
    const rule = interruption.ruleId ? ruleById(session.rules, interruption.ruleId) : null;
    return { kind: 'disapproved', cause: 'interruption', interruption, rule };
  }
  const eliminatory = stages.flatMap((stage) => stage.faults).find(isEliminatory);
  if (eliminatory) return { kind: 'disapproved', cause: 'eliminatory', rule: eliminatory.rule };
  return { kind: 'disapproved', cause: 'over-points', points };
}

export function buildCard(session: Session): ExamCard {
  const stages = STAGES.map((stage) => stageCard(session, stage));
  const points = session.ledger.points;
  const finished = session.phase === 'finished';
  // An exam still running has no verdict yet, even with 8 points: the points are told at the end (PDF 14).
  const result: ExamResult = finished ? resultOf(session.ledger, session.completedStages) : 'pending';
  return { stages, points, result, verdict: verdictOf(session, stages, result, points), finished };
}
