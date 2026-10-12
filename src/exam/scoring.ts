import type { Rule } from '../content/schemas.ts';

/**
 * One scored fault. `atS` is simulation time; `episode` tells repeated episodes of the same rule apart; `stage` is
 * the stage of the exam it was scored in (the ficha is laid out per stage, protocolo PDF 15–17). The stage is
 * recorded with the fault, not derived from its time: a stage can end at the very instant a fault is scored.
 */
export interface Fault {
  ruleId: string;
  points: number;
  atS: number;
  stage: Stage;
  episode: string | undefined;
  /** A high fault raised to an eliminatory one because the examiner had to intervene (protocolo PDF 7). */
  escalated: boolean;
}

export type InterruptionCause = 'fault' | 'cutoff' | 'driver-request' | 'examiner';

export interface Interruption {
  ruleId: string | null;
  atS: number;
  cause: InterruptionCause;
}

export interface Ledger {
  rules: readonly Rule[];
  faults: readonly Fault[];
  points: number;
  interruption: Interruption | null;
}

export type Stage = 'I' | 'II' | 'III';
export type ExamResult = 'approved' | 'disapproved' | 'pending';

/** The protocol approves with 7 points or less once the three stages are done (protocolo PDF 14). */
export const PASS_MAX_POINTS = 7;

export function createLedger(rules: readonly Rule[]): Ledger {
  return { rules, faults: [], points: 0, interruption: null };
}

export function ruleById(rules: readonly Rule[], ruleId: string): Rule {
  const rule = rules.find((candidate) => candidate.id === ruleId);
  if (!rule) throw new Error(`unknown rule ${ruleId}`);
  return rule;
}

export interface FaultReport {
  ruleId: string;
  atS: number;
  stage: Stage;
  episode?: string;
  /** The examiner used the dual controls: the rule's escalation applies and the interruption is theirs. */
  escalate?: boolean;
  /** The interruption this fault causes is the examiner's takeover, not the fault itself (protocolo PDF 7). */
  cause?: Extract<InterruptionCause, 'fault' | 'examiner'>;
}

/**
 * Whether a rule already recorded counts again (REGLAS.md §5): once and single-check rules never repeat;
 * per-occurrence rules always do; per-episode and unspecified rules repeat only in a different episode (decision D3).
 */
function repeats(rule: Rule, previous: readonly Fault[], episode: string | undefined): boolean {
  if (previous.length === 0) return true;
  switch (rule.repetition) {
    case 'once':
    case 'single-check':
      return false;
    case 'per-occurrence':
      return true;
    case 'per-episode':
    case 'unspecified':
      return previous.every((fault) => fault.episode !== episode);
  }
}

/** Records a fault according to its rule's repetition policy, points, escalation and interruption. */
export function recordFault(ledger: Ledger, report: FaultReport): Ledger {
  const rule = ruleById(ledger.rules, report.ruleId);
  if (report.escalate && !rule.escalation) throw new Error(`${rule.id} cannot escalate`);
  const previous = ledger.faults.filter((fault) => fault.ruleId === rule.id);
  const escalated = report.escalate === true;
  // The same episode already scored without escalation (entering a crosswalk, then hitting the pedestrian on it):
  // the examiner's intervention raises that fault instead of adding a second one.
  const toRaise = escalated
    ? previous.find((fault) => fault.episode === report.episode && !fault.escalated)
    : undefined;
  // An escalation is, by definition, the examiner's intervention with the dual controls (protocolo PDF 7).
  const cause: InterruptionCause = report.cause ?? (escalated ? 'examiner' : 'fault');
  if (toRaise) {
    const points = rule.escalation?.points ?? rule.points;
    return {
      ...ledger,
      faults: ledger.faults.map((fault) => (fault === toRaise ? { ...fault, points, escalated: true } : fault)),
      points: ledger.points - toRaise.points + points,
      interruption: ledger.interruption ?? { ruleId: rule.id, atS: report.atS, cause },
    };
  }
  if (!repeats(rule, previous, report.episode)) return ledger;
  const fault: Fault = {
    ruleId: rule.id,
    points: escalated ? (rule.escalation?.points ?? rule.points) : rule.points,
    atS: report.atS,
    stage: report.stage,
    episode: report.episode,
    escalated,
  };
  const interrupts = escalated || rule.interrupts || report.cause === 'examiner';
  return {
    ...ledger,
    faults: [...ledger.faults, fault],
    points: ledger.points + fault.points,
    interruption: ledger.interruption ?? (interrupts ? { ruleId: rule.id, atS: report.atS, cause } : null),
  };
}

/** An interruption that is not a fault: the cutoff before circulation, the driver's request or the examiner. */
export function interrupt(ledger: Ledger, atS: number, cause: Exclude<InterruptionCause, 'fault'>): Ledger {
  return ledger.interruption ? ledger : { ...ledger, interruption: { ruleId: null, atS, cause } };
}

/** Approved only with the three stages completed and 7 points or less; interrupted or over 7, disapproved. */
export function resultOf(ledger: Ledger, completedStages: readonly Stage[]): ExamResult {
  if (ledger.interruption || ledger.points > PASS_MAX_POINTS) return 'disapproved';
  const complete = (['I', 'II', 'III'] as const).every((stage) => completedStages.includes(stage));
  return complete ? 'approved' : 'pending';
}

/** Withdraws a fault scored in an episode that a more severe rule now covers (decision D2). */
export function withdrawFault(ledger: Ledger, ruleId: string, episode: string | undefined): Ledger {
  const withdrawn = ledger.faults.find((fault) => fault.ruleId === ruleId && fault.episode === episode);
  if (!withdrawn) return ledger;
  return {
    ...ledger,
    faults: ledger.faults.filter((fault) => fault !== withdrawn),
    points: ledger.points - withdrawn.points,
  };
}
