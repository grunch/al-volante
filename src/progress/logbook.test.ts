import { describe, expect, it } from 'vitest';
import { choiceActivity, unit } from '../content/testing/fixtures.ts';
import type { Activity, Attempt } from '../content/schemas.ts';
import { drivingLog, progressByGroup, recentErrors, recommendedReview } from './logbook.ts';
import { MASTERY_BOX, createAttempt } from './model.ts';
import type { ConceptProgress } from './model.ts';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

function concept(unitId: string, overrides: Partial<ConceptProgress> = {}): ConceptProgress {
  return {
    unitId,
    box: 1,
    attempts: 1,
    correct: 1,
    lastAttemptAt: daysAgo(2),
    lastCorrect: true,
    dueAt: daysAgo(1),
    ...overrides,
  };
}

function attempt(activityId: string, correct: boolean, at: string, id = `${activityId}-${at}`): Attempt {
  return createAttempt(
    {
      activityId,
      unitIds: [],
      variantId: 'v',
      seed: 0,
      response: { kind: 'choice', optionId: 'a' },
      correct,
      score: correct ? 1 : 0,
      mode: 'practice',
    },
    { id, at, contentVersion: 'deadbeef' },
  );
}

const activity = (id: string, unitIds: string[]): Activity => ({ ...choiceActivity(), id, unitIds });

describe('progressByGroup', () => {
  const units = [
    unit({ id: 'manual.ch3.a', source: 'manual', section: 'ch3' }),
    unit({ id: 'manual.ch3.b', source: 'manual', section: 'ch3' }),
    unit({ id: 'manual.ch3.c', source: 'manual', section: 'ch3' }),
    unit({ id: 'manual.annex2.a', source: 'manual', section: 'annex2', category: 'D' }),
  ];

  it('measures campaign B apart from complementary material', () => {
    // Arrange
    const concepts = new Map([
      ['manual.ch3.a', concept('manual.ch3.a', { box: MASTERY_BOX, dueAt: daysAgo(-5) })],
      ['manual.ch3.b', concept('manual.ch3.b')],
    ]);

    // Act
    const groups = progressByGroup(units, [activity('act.x', ['manual.ch3.a', 'manual.ch3.b'])], concepts, NOW);

    // Assert
    const campaign = groups.find((group) => group.groupId === 'campaign-b');
    const complementary = groups.find((group) => group.groupId === 'complementary');
    expect(campaign).toMatchObject({ total: 3, withActivities: 2, practiced: 1, mastered: 1 });
    expect(campaign?.rows.map((row) => [row.unit.id, row.state, row.due])).toEqual([
      ['manual.ch3.b', 'practiced', true],
      ['manual.ch3.a', 'mastered', false],
    ]);
    expect(complementary).toMatchObject({ total: 1, withActivities: 0, practiced: 0, mastered: 0, rows: [] });
  });
});

describe('recentErrors', () => {
  it('lists activities whose latest attempt failed, newest first, skipping retried and removed activities', () => {
    const activities = [activity('act.a', []), activity('act.b', []), activity('act.c', [])];
    const attempts = [
      attempt('act.a', false, daysAgo(3)),
      attempt('act.a', true, daysAgo(2)),
      attempt('act.b', false, daysAgo(4)),
      attempt('act.c', false, daysAgo(1)),
      attempt('act.removed', false, daysAgo(0)),
    ];

    expect(recentErrors(activities, attempts).map((error) => error.activity.id)).toEqual(['act.c', 'act.b']);
    expect(recentErrors(activities, attempts, 1)).toHaveLength(1);
  });
});

describe('recommendedReview', () => {
  it('proposes recent mistakes first, then one activity per due concept, failed concepts first', () => {
    // Arrange
    const activities = [
      activity('act.a', ['u1']),
      activity('act.b', ['u2', 'u3']),
      activity('act.c', ['u4']),
      activity('act.d', ['u5']),
    ];
    const attempts = [attempt('act.a', false, daysAgo(1))];
    const concepts = new Map([
      ['u1', concept('u1', { lastCorrect: false })],
      ['u2', concept('u2', { dueAt: daysAgo(3) })],
      ['u3', concept('u3', { dueAt: daysAgo(1) })],
      ['u4', concept('u4', { lastCorrect: false, dueAt: daysAgo(0) })],
      ['u5', concept('u5', { dueAt: daysAgo(-2) })],
    ]);

    // Act
    const session = recommendedReview(activities, attempts, concepts, NOW);

    // Assert
    expect(session.map((item) => [item.activity.id, item.reason, item.dueUnitIds])).toEqual([
      ['act.a', 'recent-error', []],
      ['act.c', 'due', ['u4']],
      ['act.b', 'due', ['u2', 'u3']],
    ]);
  });

  it('is empty without mistakes or due concepts, and respects the session size', () => {
    const activities = [activity('act.a', ['u1']), activity('act.b', ['u2'])];
    const due = new Map([
      ['u1', concept('u1')],
      ['u2', concept('u2')],
    ]);

    expect(recommendedReview(activities, [], new Map(), NOW)).toEqual([]);
    expect(recommendedReview(activities, [], due, NOW, 1)).toHaveLength(1);
  });
});

describe('drivingLog (F04-T05)', () => {
  const drive = (id: string, at: string, mode: Attempt['mode'], finished: Record<string, unknown> | null): Attempt => ({
    id,
    kind: 'driving',
    subjectId: 'route.comuna13-a',
    contentVersion: 'deadbeef',
    mode,
    startedAt: at,
    finishedAt: at,
    events: finished ? [{ at, type: 'finished', payload: finished }] : [],
    faults: [],
    result: { correct: null, score: null, points: 3 },
  });

  it('lists the drives newest first with their mode, completed stages, points and verdict, skipping activities', () => {
    const approved = drive('a', daysAgo(2), 'exam', {
      result: 'approved',
      points: 3,
      completedStages: ['I', 'II', 'III'],
    });
    const practice = drive('b', daysAgo(1), 'practice', { result: 'pending', points: 3, completedStages: ['III'] });
    const rows = drivingLog([attempt('act.x', true, daysAgo(3)), approved, practice]);

    expect(rows.map((row) => row.attempt.id)).toEqual(['b', 'a']);
    expect(rows[1]).toMatchObject({ mode: 'exam', completedStages: ['I', 'II', 'III'], points: 3, result: 'approved' });
    expect(rows[0]).toMatchObject({ mode: 'practice', completedStages: ['III'], points: 3, result: 'pending' });
  });

  it('reads a drive whose events are missing or malformed from its result alone', () => {
    const bare = { ...drive('c', daysAgo(1), 'run', null), result: { correct: false, score: null, points: 9 } };
    const odd = drive('d', daysAgo(2), 'run', { result: 'maybe', points: 'many', completedStages: 'all' });

    const rows = drivingLog([bare, odd]);

    expect(rows[0]).toMatchObject({ mode: 'run', completedStages: [], points: 9, result: 'disapproved' });
    expect(rows[1]).toMatchObject({ mode: 'run', completedStages: [], points: 3, result: 'pending' });
  });
});
