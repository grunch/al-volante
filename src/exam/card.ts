import type { Rule } from '../content/schemas.ts';
import { resultOf, ruleById } from './scoring.ts';
import type { ExamResult, Fault, Interruption, Stage } from './scoring.ts';
import { stageOf } from './session.ts';
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
  | { kind: 'disapproved'; cause: 'interruption'; interruption: Interruption; rule: Rule | null; fault: Fault | null }
  | { kind: 'disapproved'; cause: 'eliminatory'; rule: Rule; fault: Fault }
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

const inScope = (stage: Stage, scope: StageScope) =>
  STAGES.indexOf(stage) >= STAGES.indexOf(scope.from) && STAGES.indexOf(stage) <= STAGES.indexOf(scope.to);

export type FichaRow = Rule['fichaRows'][number];

/**
 * The ficha row a fault is consigned in (decision D1): a row of the stage it was scored in and, when the judge told
 * it, of the group of its context (a turn or a crossing). A conduct the ficha lists only in another stage takes the
 * row of that stage: the unlock checks (minor e and f, «Desbloqueo del vehículo», PDF 10 and 15) are stage I although
 * the game asks for them when the engine starts and the car first moves.
 */
export function fichaRowOf(rule: Rule, fault: Pick<Fault, 'stage' | 'group'>): FichaRow {
  const ofStage = rule.fichaRows.filter((row) => row.stage === fault.stage);
  const rows = ofStage.length > 0 ? ofStage : rule.fichaRows;
  const row = rows.find((candidate) => candidate.group === fault.group) ?? rows[0];
  if (!row) throw new Error(`${rule.id} has no ficha row`);
  return row;
}

/** The stage of the card a fault goes in: its ficha row's, unless the session did not run that stage (a practice). */
function cardStageOf(session: Session, fault: Fault): Stage {
  const { stage } = fichaRowOf(ruleById(session.rules, fault.ruleId), fault);
  return inScope(stage, session.scope) ? stage : fault.stage;
}

/** The stage of a recorded transition, by the session's own mapping (`finished` closes the last one). */
const transitionStage = (session: Session, phase: Phase): Stage | null =>
  phase === 'finished' ? null : stageOf(phase, session.scope);

/** When a stage began: the first transition into one of its phases. */
function startOf(session: Session, stage: Stage): number | null {
  const first = session.transitions.find((item) => transitionStage(session, item.phase) === stage);
  return first ? first.atS : null;
}

/** When a stage ended: the first transition after its start into a later stage or into `finished`. */
function endOf(session: Session, stage: Stage, startedAtS: number): number | null {
  const index = session.transitions.findIndex((item) => transitionStage(session, item.phase) === stage);
  const end = session.transitions.slice(index + 1).find((item) => {
    const next = transitionStage(session, item.phase);
    return next === null || STAGES.indexOf(next) > STAGES.indexOf(stage);
  });
  return end ? Math.max(startedAtS, end.atS) : null;
}

function stageCard(session: Session, stage: Stage): StageCard {
  const scoped = inScope(stage, session.scope);
  const startedAtS = scoped ? startOf(session, stage) : null;
  const faults = session.ledger.faults
    .filter((fault) => cardStageOf(session, fault) === stage)
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

/**
 * The fault that interrupted, for the ficha row of its context (D1): the one the examiner escalated, which a raise
 * leaves at the time it was first scored (scoring.ts), otherwise the one of its rule scored at the interruption.
 * A fault of the same rule in another episode, scored before or after it, is not it.
 */
function interruptingFault(faults: readonly Fault[], interruption: Interruption): Fault | null {
  const ofRule = faults.filter((item) => item.ruleId === interruption.ruleId);
  return ofRule.find((item) => item.escalated) ?? ofRule.find((item) => item.atS === interruption.atS) ?? null;
}

/** The verdict of PDF 14: approved with the three stages and 7 points or less; otherwise, why not. */
function verdictOf(session: Session, stages: readonly StageCard[], result: ExamResult, points: number): Verdict {
  if (result === 'approved') return { kind: 'approved', points };
  if (result === 'pending') return { kind: 'pending', points };
  const { interruption } = session.ledger;
  if (interruption) {
    const rule = interruption.ruleId ? ruleById(session.rules, interruption.ruleId) : null;
    const fault = interruptingFault(session.ledger.faults, interruption);
    return { kind: 'disapproved', cause: 'interruption', interruption, rule, fault };
  }
  const eliminatory = stages.flatMap((stage) => stage.faults).find(isEliminatory);
  if (eliminatory)
    return { kind: 'disapproved', cause: 'eliminatory', rule: eliminatory.rule, fault: eliminatory.fault };
  return { kind: 'disapproved', cause: 'over-points', points };
}

export function buildCard(session: Session): ExamCard {
  const stages = STAGES.map((stage) => stageCard(session, stage));
  const points = session.ledger.points;
  const finished = session.phase === 'finished';
  // An exam still running has no verdict yet, even with 8 points: the points are told at the end (PDF 14). A practice
  // of one stage never approves nor disapproves an exam (D15), whatever ended it.
  const whole = session.scope.from === 'I' && session.scope.to === 'III';
  const result: ExamResult = finished && whole ? resultOf(session.ledger, session.completedStages) : 'pending';
  return { stages, points, result, verdict: verdictOf(session, stages, result, points), finished };
}
