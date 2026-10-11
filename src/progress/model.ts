import { z } from 'zod';
import type { ActivityResponse } from '../activities/engine.ts';
import type { Attempt } from '../content/schemas.ts';

/** Leitner boxes: box n is reviewed after LEITNER_INTERVALS_DAYS[n - 1] days. */
export const LEITNER_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_BOX = LEITNER_INTERVALS_DAYS.length;
/** A concept counts as mastered from this box on: it needs correct answers spread over several days. */
export const MASTERY_BOX = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ConceptProgressSchema = z
  .strictObject({
    unitId: z.string().min(1),
    box: z.int().min(1).max(MAX_BOX),
    attempts: z.int().nonnegative(),
    correct: z.int().nonnegative(),
    lastAttemptAt: z.iso.datetime(),
    lastCorrect: z.boolean(),
    dueAt: z.iso.datetime(),
  })
  .check((ctx) => {
    // Cross-field invariants of updateConcept: a backup or a stored record that breaks them cannot be real progress.
    const { box, attempts, correct, lastCorrect, lastAttemptAt, dueAt } = ctx.value;
    const fail = (message: string) => ctx.issues.push({ code: 'custom', message, input: ctx.value });
    if (attempts < 1) fail('a concept with progress has at least one attempt');
    if (correct > attempts) fail('correct answers cannot exceed attempts');
    if (lastCorrect && correct < 1) fail('a correct last answer needs a correct answer');
    if (!lastCorrect && (box !== 1 || correct > attempts - 1)) fail('after a wrong answer the concept is in box 1');
    if (box > 1 && correct < box) fail('box n needs at least n correct answers');
    if (Date.parse(dueAt) <= Date.parse(lastAttemptAt)) fail('the next review comes after the last answer');
  });

export type ConceptProgress = z.infer<typeof ConceptProgressSchema>;

export type MasteryState = 'available' | 'practiced' | 'mastered';

export function masteryOf(progress: ConceptProgress | undefined): MasteryState {
  if (!progress) return 'available';
  return progress.box >= MASTERY_BOX ? 'mastered' : 'practiced';
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

/**
 * Applies one answer to a concept (Leitner boxes). A wrong answer sends it back to box 1, and so does the first
 * correct answer after a mistake: the spacing starts again from that recall. A correct answer moves it up one box
 * only when the previous answer was also correct and its review was due; answering again earlier changes nothing,
 * so mastery needs MASTERY_BOX correct answers in a row, spaced by the box intervals.
 */
export function updateConcept(
  previous: ConceptProgress | undefined,
  unitId: string,
  correct: boolean,
  at: string,
): ConceptProgress {
  const restart = !correct || !previous || !previous.lastCorrect;
  const due = previous !== undefined && Date.parse(at) >= Date.parse(previous.dueAt);
  let box = 1;
  let dueAt = addDays(at, LEITNER_INTERVALS_DAYS[0]);
  if (!restart && previous) {
    box = due ? Math.min(previous.box + 1, MAX_BOX) : previous.box;
    dueAt = due ? addDays(at, LEITNER_INTERVALS_DAYS[box - 1] as number) : previous.dueAt;
  }
  return {
    unitId,
    box,
    attempts: (previous?.attempts ?? 0) + 1,
    correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
    lastAttemptAt: at,
    lastCorrect: correct,
    dueAt,
  };
}

export interface ActivityAnswer {
  activityId: string;
  unitIds: readonly string[];
  variantId: string;
  seed: number;
  response: ActivityResponse;
  correct: boolean;
  score: number;
  mode: Attempt['mode'];
}

/** Builds the stored attempt (the Attempt contract of PROPUESTA §8) for one answer. */
export function createAttempt(
  answer: ActivityAnswer,
  context: { id: string; at: string; contentVersion: string },
): Attempt {
  return {
    id: context.id,
    kind: 'activity',
    subjectId: answer.activityId,
    contentVersion: context.contentVersion,
    mode: answer.mode,
    startedAt: context.at,
    finishedAt: context.at,
    events: [
      {
        at: context.at,
        type: 'answer',
        payload: {
          variantId: answer.variantId,
          seed: answer.seed,
          response: answer.response,
          unitIds: [...answer.unitIds],
        },
      },
    ],
    faults: [],
    result: { correct: answer.correct, score: answer.score, points: null },
  };
}
