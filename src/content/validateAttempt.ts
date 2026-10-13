import { z } from 'zod';
import { THEORY_SUBJECT } from '../theory/attempt.ts';
import type { Attempt, Rule, RuleCatalog, TheoryExamConfig } from './schemas.ts';

/** Repetition policies under which a rule can appear only once in an attempt (REGLAS.md). */
const COUNTED_ONCE: ReadonlySet<Rule['repetition']> = new Set(['once', 'single-check']);

/** The pass rule of the mock theory exam, to check the verdict of imported mock exams of the same configuration. */
export type TheoryPassRule = Pick<TheoryExamConfig, 'version' | 'questions' | 'passCorrect'>;

/**
 * Checks an attempt against the exam rules: every fault cites a known rule with that rule's points, a scored result
 * adds up its faults, and activity attempts carry no driving faults. Used before trusting attempts from a backup.
 * With the theory configuration, a mock exam of that configuration version must also pass exactly when it should.
 */
export function attemptErrors(attempt: Attempt, rules: RuleCatalog, theoryExam?: TheoryPassRule): string[] {
  const errors: string[] = [];
  const byId = new Map(rules.rules.map((rule) => [rule.id, rule]));
  if (attempt.kind === 'activity')
    errors.push(
      ...(attempt.subjectId === THEORY_SUBJECT ? theoryErrors(attempt, theoryExam) : activityErrors(attempt)),
    );
  const seen = new Set<string>();
  attempt.faults.forEach((fault, index) => {
    const rule = byId.get(fault.ruleId);
    if (!rule) {
      errors.push(`${attempt.id}: fault ${index} cites unknown rule ${fault.ruleId}`);
      return;
    }
    // A high fault escalates to an eliminatory one when the examiner has to intervene (protocolo PDF 7).
    const allowed = [rule.points, ...(rule.escalation ? [rule.escalation.points] : [])];
    if (!allowed.includes(fault.points))
      errors.push(
        `${attempt.id}: fault ${index} gives ${fault.points} points, but ${rule.id} is worth ${allowed.join(' or ')}`,
      );
    if (seen.has(rule.id) && COUNTED_ONCE.has(rule.repetition))
      errors.push(`${attempt.id}: fault ${index} repeats ${rule.id}, which counts once`);
    seen.add(rule.id);
  });
  const total = attempt.faults.reduce((sum, fault) => sum + fault.points, 0);
  if (attempt.result.points !== null && attempt.result.points !== total)
    errors.push(`${attempt.id}: result points ${attempt.result.points} do not match the faults (${total})`);
  return errors;
}

/** The grade a mock theory exam keeps in its `finished` event (createTheoryAttempt). */
export const TheoryGradeSchema = z.object({
  correct: z.int().nonnegative(),
  total: z.int().nonnegative(),
  passed: z.boolean(),
});

/**
 * What a handed-in mock theory exam looks like (createTheoryAttempt): finished, one grade and a result that follows
 * it (passing does not need a full score), no faults or points. It is an activity attempt with no single answer.
 */
const TheoryStartSchema = z.object({ configVersion: z.string() });

function theoryErrors(attempt: Attempt, theoryExam: TheoryPassRule | undefined): string[] {
  const errors: string[] = [];
  const { correct, score, points } = attempt.result;
  if (attempt.faults.length > 0) errors.push(`${attempt.id}: mock exams cannot have driving faults`);
  if (attempt.finishedAt === null) errors.push(`${attempt.id}: a mock exam is finished when it is handed in`);
  if (points !== null) errors.push(`${attempt.id}: mock exams have no exam points`);
  const grades = attempt.events.filter((event) => event.type === 'finished');
  if (grades.length !== 1)
    return [...errors, `${attempt.id}: a mock exam has exactly one grade (found ${grades.length})`];
  const grade = TheoryGradeSchema.safeParse((grades[0] as Attempt['events'][number]).payload);
  if (!grade.success || grade.data.correct > grade.data.total)
    return [...errors, `${attempt.id}: the grade of the mock exam is unreadable`];
  const { total, passed } = grade.data;
  if (correct !== passed || score !== (total === 0 ? 0 : grade.data.correct / total))
    errors.push(`${attempt.id}: the result does not match the grade of the mock exam`);
  // The verdict is data from outside: under the current configuration it must follow its threshold (gradeExam). An
  // attempt of another configuration version keeps its own verdict, since its threshold is not known here.
  const start = TheoryStartSchema.safeParse(attempt.events.find((event) => event.type === 'start')?.payload);
  if (theoryExam && start.success && start.data.configVersion === theoryExam.version) {
    const shouldPass = total >= theoryExam.questions && grade.data.correct >= theoryExam.passCorrect;
    if (passed !== shouldPass)
      errors.push(
        `${attempt.id}: ${grade.data.correct} of ${total} ${shouldPass ? 'passes' : 'does not pass'} the mock exam ` +
          `(${theoryExam.passCorrect} of ${theoryExam.questions} needed), but the grade says otherwise`,
      );
  }
  return errors;
}

/** What an answered activity always looks like (createAttempt): finished, one answer, a coherent score, no faults. */
function activityErrors(attempt: Attempt): string[] {
  const errors: string[] = [];
  const { correct, score, points } = attempt.result;
  if (attempt.faults.length > 0) errors.push(`${attempt.id}: activity attempts cannot have driving faults`);
  if (attempt.finishedAt === null) errors.push(`${attempt.id}: an activity attempt is finished when it is answered`);
  const answers = attempt.events.filter((event) => event.type === 'answer').length;
  if (answers !== 1) errors.push(`${attempt.id}: an activity attempt has exactly one answer (found ${answers})`);
  if (correct === null || score === null)
    errors.push(`${attempt.id}: an activity attempt records correctness and score`);
  else if (correct !== (score === 1)) errors.push(`${attempt.id}: correct must match a full score`);
  if (points !== null) errors.push(`${attempt.id}: activity attempts have no exam points`);
  return errors;
}
