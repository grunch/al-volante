import { describe, expect, it } from 'vitest';
import { MASTERY_BOX, masteryOf, recordAnswer, updateConcept } from './model.ts';
import type { ConceptProgress } from './model.ts';

const DAY = 24 * 60 * 60 * 1000;
const T0 = '2026-10-11T12:00:00.000Z';
const at = (days: number) => new Date(Date.parse(T0) + days * DAY).toISOString();

describe('updateConcept (Leitner)', () => {
  it('starts in box 1, due the next day, on the first answer', () => {
    const progress = updateConcept(undefined, 'u', true, T0);

    expect(progress).toMatchObject({ box: 1, attempts: 1, correct: 1, lastCorrect: true, dueAt: at(1) });
  });

  it('moves up one box per correct answer given when the review is due', () => {
    let progress = updateConcept(undefined, 'u', true, T0);
    progress = updateConcept(progress, 'u', true, at(1));
    progress = updateConcept(progress, 'u', true, at(4));

    expect(progress.box).toBe(3);
    expect(progress.dueAt).toBe(at(4 + 7));
  });

  it('does not advance when answered again before the due date, so cramming cannot fake mastery', () => {
    let progress = updateConcept(undefined, 'u', true, T0);
    for (let i = 0; i < 10; i += 1) progress = updateConcept(progress, 'u', true, T0);

    expect(progress.box).toBe(1);
    expect(progress.attempts).toBe(11);
    expect(progress.dueAt).toBe(at(1));
    expect(masteryOf(progress)).toBe('practiced');
  });

  it('sends a concept back to box 1 after a wrong answer, due again the next day', () => {
    const boxThree: ConceptProgress = {
      unitId: 'u',
      box: 3,
      attempts: 3,
      correct: 3,
      lastAttemptAt: at(4),
      lastCorrect: true,
      dueAt: at(11),
    };

    const progress = updateConcept(boxThree, 'u', false, at(5));

    expect(progress).toMatchObject({ box: 1, correct: 3, attempts: 4, lastCorrect: false, dueAt: at(6) });
  });

  it('restarts the spacing on a correct answer right after a mistake, so mastery needs three spaced correct answers in a row', () => {
    let progress = updateConcept(undefined, 'u', false, T0);
    progress = updateConcept(progress, 'u', true, at(1));
    expect(progress).toMatchObject({ box: 1, dueAt: at(2) });

    progress = updateConcept(progress, 'u', true, at(2));
    progress = updateConcept(progress, 'u', true, at(5));
    expect(progress.box).toBe(MASTERY_BOX);
    expect(masteryOf(progress)).toBe('mastered');
  });

  it('caps at the last box and its 30-day interval', () => {
    const top: ConceptProgress = {
      unitId: 'u',
      box: 5,
      attempts: 9,
      correct: 9,
      lastAttemptAt: T0,
      lastCorrect: true,
      dueAt: T0,
    };

    expect(updateConcept(top, 'u', true, T0)).toMatchObject({ box: 5, dueAt: at(30) });
  });
});

describe('masteryOf', () => {
  it('distinguishes available, practiced and mastered concepts', () => {
    const base: ConceptProgress = {
      unitId: 'u',
      box: 1,
      attempts: 1,
      correct: 1,
      lastAttemptAt: T0,
      lastCorrect: true,
      dueAt: T0,
    };

    expect(masteryOf(undefined)).toBe('available');
    expect(masteryOf(base)).toBe('practiced');
    expect(masteryOf({ ...base, box: MASTERY_BOX })).toBe('mastered');
  });
});

describe('recordAnswer', () => {
  it('builds an Attempt with content version, response and result, and updates every concept once', () => {
    const { attempt, updates } = recordAnswer(
      {
        activityId: 'act.x',
        unitIds: ['a', 'b', 'a'],
        variantId: 'v1',
        seed: 7,
        response: { kind: 'choice', optionId: 'o' },
        correct: false,
        score: 0,
        mode: 'practice',
      },
      new Map(),
      { id: 'id-1', at: T0, contentVersion: 'deadbeef' },
    );

    expect(attempt).toMatchObject({
      id: 'id-1',
      kind: 'activity',
      subjectId: 'act.x',
      contentVersion: 'deadbeef',
      mode: 'practice',
      result: { correct: false, score: 0, points: null },
    });
    expect(attempt.events[0]?.payload).toEqual({
      variantId: 'v1',
      seed: 7,
      response: { kind: 'choice', optionId: 'o' },
      unitIds: ['a', 'b', 'a'],
    });
    expect(updates.map((update) => update.unitId)).toEqual(['a', 'b']);
  });
});
