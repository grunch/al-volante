import { describe, expect, it } from 'vitest';
import { ConceptProgressSchema, MASTERY_BOX, createAttempt, masteryOf, updateConcept } from './model.ts';
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

  it('never moves the last answer back in time when the clock goes back, so the state stays valid', () => {
    // Arrange: progress imported from a device one hour ahead (within the backup clock tolerance).
    const ahead = updateConcept(undefined, 'u', true, at(1 / 24));

    // Act: answered again on this device, whose clock reads one hour earlier, before the review is due.
    const progress = updateConcept(ahead, 'u', true, T0);

    // Assert
    expect(progress).toMatchObject({ box: 1, attempts: 2, lastAttemptAt: ahead.lastAttemptAt, dueAt: ahead.dueAt });
    expect(ConceptProgressSchema.safeParse(progress).success).toBe(true);
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

describe('ConceptProgressSchema', () => {
  it('accepts states reached by answering again before the review is due', () => {
    let progress = updateConcept(undefined, 'u', true, T0);
    progress = updateConcept(progress, 'u', true, at(1));
    progress = updateConcept(progress, 'u', true, at(2));

    expect(progress).toMatchObject({ box: 2, dueAt: at(4) });
    expect(ConceptProgressSchema.safeParse(progress).success).toBe(true);
  });

  it('accepts every state updateConcept produces', () => {
    let progress: ConceptProgress | undefined;
    [true, true, false, true, true, true, true, true, true, true].forEach((correct, step) => {
      progress = updateConcept(progress, 'u', correct, at(step * 4));
      expect(ConceptProgressSchema.safeParse(progress).success, `step ${step}`).toBe(true);
    });
  });

  it('rejects counters and states that no sequence of answers can produce', () => {
    // Arrange: one correct first answer, then impossible variations of it.
    const valid = updateConcept(undefined, 'u', true, T0);
    const impossible: Record<string, Partial<ConceptProgress>> = {
      'more correct answers than attempts': { correct: 2 },
      'no attempts': { attempts: 0, correct: 0 },
      'a box above the correct answers': { box: 3, attempts: 3, correct: 2 },
      'a wrong last answer outside box 1': { box: 2, attempts: 3, correct: 2, lastCorrect: false },
      'a correct last answer without correct answers': { correct: 0 },
      'a review due before the last answer': { dueAt: T0 },
      'a review further away than the box interval': { dueAt: at(5) },
      'a wrong answer reviewed years later': { box: 1, attempts: 2, correct: 1, lastCorrect: false, dueAt: at(3650) },
    };

    // Act / Assert
    for (const [name, patch] of Object.entries(impossible)) {
      expect(ConceptProgressSchema.safeParse({ ...valid, ...patch }).success, name).toBe(false);
    }
  });
});

describe('createAttempt', () => {
  it('builds an Attempt with content version, response and result', () => {
    const attempt = createAttempt(
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
  });
});
