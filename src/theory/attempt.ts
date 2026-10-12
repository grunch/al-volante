import type { Attempt } from '../content/schemas.ts';
import type { ExamGrade, ExamPaper } from './exam.ts';

/** The subject of every mock exam attempt; the configuration version travels in the events. */
export const THEORY_SUBJECT = 'theory.mock';

export interface TheoryContext {
  id: string;
  contentVersion: string;
  /** Wall-clock start and end of the exam; the end is the stored (monotonic) time. */
  startedAt: string;
  finishedAt: string;
  minutes: number;
  /** Whether time ran out before the player handed the paper in. */
  timedOut: boolean;
}

/**
 * Builds the stored attempt of a mock exam (the Attempt contract of PROPUESTA §8, `kind: 'activity'`, mode exam):
 * the paper (seed, configuration, question ids), every answer and the grade. Mock exams do not train concepts.
 */
export function createTheoryAttempt(paper: ExamPaper, grade: ExamGrade, context: TheoryContext): Attempt {
  const endMs = Date.parse(context.finishedAt);
  const startedAt = new Date(Math.min(Date.parse(context.startedAt), endMs)).toISOString();
  return {
    id: context.id,
    kind: 'activity',
    subjectId: THEORY_SUBJECT,
    contentVersion: context.contentVersion,
    mode: 'exam',
    startedAt,
    finishedAt: context.finishedAt,
    events: [
      {
        at: startedAt,
        type: 'start',
        payload: {
          seed: paper.seed,
          configVersion: paper.configVersion,
          minutes: context.minutes,
          questions: paper.questions.map((question) => question.id),
        },
      },
      {
        at: context.finishedAt,
        type: 'finished',
        payload: {
          answers: Object.fromEntries(grade.results.map((result) => [result.question.id, result.chosenOptionId])),
          correct: grade.correct,
          total: grade.total,
          passed: grade.passed,
          timedOut: context.timedOut,
        },
      },
    ],
    faults: [],
    result: { correct: grade.passed, score: grade.total === 0 ? 0 : grade.correct / grade.total, points: null },
  };
}
