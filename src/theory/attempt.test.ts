import { describe, expect, it } from 'vitest';
import { AttemptSchema } from '../content/schemas.ts';
import { choiceActivity, theoryExamConfig, unit } from '../content/testing/fixtures.ts';
import { THEORY_SUBJECT, createTheoryAttempt } from './attempt.ts';
import type { TheoryContext } from './attempt.ts';
import { composeExam, gradeExam } from './exam.ts';

const UNITS = [unit({ id: 'manual.ch3.roundabout-priority' })];
const ACTIVITIES = [
  choiceActivity({ id: 'act.one' }),
  choiceActivity({
    id: 'act.two',
    variants: [
      {
        id: 'v1',
        prompt: '¿Otra?',
        options: [
          { id: 'a', text: 'Sí', correct: true, feedback: 'Bien' },
          { id: 'b', text: 'No', correct: false, feedback: 'No' },
        ],
      },
    ],
  }),
];
const CONFIG = theoryExamConfig();
const CONTEXT: TheoryContext = {
  id: 'attempt-1',
  contentVersion: 'deadbeef',
  startedAt: '2026-10-12T10:00:00.000Z',
  finishedAt: '2026-10-12T10:30:00.000Z',
  minutes: 45,
  timedOut: false,
};

describe('createTheoryAttempt (PROPUESTA §8)', () => {
  it('stores the paper, every answer by catalog id and the grade as a valid exam attempt', () => {
    const paper = composeExam(ACTIVITIES, UNITS, CONFIG, 3);
    const [first, second] = paper.questions;
    const rightShown = first!.options[first!.optionIds.indexOf('a')]!.id;
    const grade = gradeExam(paper, { [first!.id]: rightShown }, ACTIVITIES, CONFIG);

    const attempt = createTheoryAttempt(paper, grade, CONTEXT);

    expect(AttemptSchema.safeParse(attempt).success).toBe(true);
    expect(attempt).toMatchObject({
      subjectId: THEORY_SUBJECT,
      mode: 'exam',
      startedAt: CONTEXT.startedAt,
      result: { correct: true, score: 0.5, points: null },
    });
    expect(attempt.events[0]?.payload).toMatchObject({ seed: 3, minutes: 45, questions: [first!.id, second!.id] });
    expect(attempt.events[1]?.payload).toMatchObject({
      answers: { [first!.id]: 'a', [second!.id]: null },
      correct: 1,
      total: 2,
      timedOut: false,
    });
  });

  it('scores an empty paper as zero and never starts after it finished, even if the clock went back', () => {
    const paper = composeExam([], UNITS, CONFIG, 1);
    const grade = gradeExam(paper, {}, [], CONFIG);
    const late = { ...CONTEXT, startedAt: '2026-10-12T11:00:00.000Z', timedOut: true };

    const attempt = createTheoryAttempt(paper, grade, late);

    expect(attempt.result).toEqual({ correct: false, score: 0, points: null });
    expect(attempt.startedAt).toBe(CONTEXT.finishedAt);
    expect(attempt.events[0]?.at).toBe(CONTEXT.finishedAt);
    expect(attempt.events[1]?.payload).toMatchObject({ timedOut: true, total: 0 });
  });
});
