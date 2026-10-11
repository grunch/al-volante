import { describe, expect, it } from 'vitest';
import { rule, ruleCatalog } from './testing/fixtures.ts';
import { AttemptSchema } from './schemas.ts';
import type { Attempt } from './schemas.ts';
import { attemptErrors } from './validateAttempt.ts';

const AT = '2026-10-11T12:00:00.000Z';
const rules = ruleCatalog([
  rule({ id: 'rule.minor.a-item', severity: 'minor', annexItem: 'a', points: 1, repetition: 'per-occurrence' }),
  rule({
    id: 'rule.high.l-item',
    severity: 'high',
    annexItem: 'l',
    points: 3,
    repetition: 'once',
    escalation: { condition: 'El examinador interviene', severity: 'eliminatory', points: 8, interrupts: true },
  }),
  rule({ id: 'rule.low.b-item', severity: 'low', annexItem: 'b', points: 2, repetition: 'single-check' }),
]);

function driving(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'd1',
    kind: 'driving',
    subjectId: 'route.comuna13-a',
    contentVersion: 'deadbeef',
    mode: 'exam',
    startedAt: AT,
    finishedAt: AT,
    events: [],
    faults: [
      { ruleId: 'rule.minor.a-item', at: AT, points: 1 },
      { ruleId: 'rule.high.l-item', at: AT, points: 3 },
    ],
    result: { correct: null, score: null, points: 4 },
    ...overrides,
  };
}

describe('attemptErrors', () => {
  it('accepts faults of known rules with their points and a matching total', () => {
    expect(attemptErrors(driving(), rules)).toEqual([]);
  });

  it('rejects unknown rules, points that differ from the rule and a total that does not add up', () => {
    // Arrange
    const attempt = driving({
      faults: [
        { ruleId: 'rule.minor.z-ghost', at: AT, points: 1 },
        { ruleId: 'rule.high.l-item', at: AT, points: 5 },
      ],
      result: { correct: null, score: null, points: 3 },
    });

    // Act
    const errors = attemptErrors(attempt, rules);

    // Assert
    expect(errors).toEqual([
      'd1: fault 0 cites unknown rule rule.minor.z-ghost',
      'd1: fault 1 gives 5 points, but rule.high.l-item is worth 3 or 8',
      'd1: result points 3 do not match the faults (6)',
    ]);
  });

  it('accepts the 8 points of an escalated fault (protocolo PDF 7)', () => {
    const escalated = driving({
      faults: [{ ruleId: 'rule.high.l-item', at: AT, points: 8 }],
      result: { correct: null, score: null, points: 8 },
    });

    expect(attemptErrors(escalated, rules)).toEqual([]);
  });

  it('rejects repeated faults of rules counted once or checked once, but allows per-occurrence repeats', () => {
    // Arrange
    const repeated = driving({
      faults: [
        { ruleId: 'rule.minor.a-item', at: AT, points: 1 },
        { ruleId: 'rule.minor.a-item', at: AT, points: 1 },
        { ruleId: 'rule.high.l-item', at: AT, points: 3 },
        { ruleId: 'rule.high.l-item', at: AT, points: 3 },
        { ruleId: 'rule.low.b-item', at: AT, points: 2 },
        { ruleId: 'rule.low.b-item', at: AT, points: 2 },
      ],
      result: { correct: null, score: null, points: 12 },
    });

    // Act / Assert
    expect(attemptErrors(repeated, rules)).toEqual([
      'd1: fault 3 repeats rule.high.l-item, which counts once',
      'd1: fault 5 repeats rule.low.b-item, which counts once',
    ]);
  });

  it('rejects driving faults on an activity attempt', () => {
    const activity = driving({
      kind: 'activity',
      subjectId: 'act.x',
      result: { correct: true, score: 1, points: null },
    });

    expect(attemptErrors(activity, rules)).toContain('d1: activity attempts cannot have driving faults');
  });
});

describe('AttemptSchema chronology', () => {
  const later = (minutes: number) => new Date(Date.parse(AT) + minutes * 60_000).toISOString();

  it('accepts events and faults inside the attempt, and an unfinished attempt', () => {
    const inside = driving({
      finishedAt: later(10),
      events: [{ at: later(5), type: 'turn', payload: {} }],
      faults: [],
      result: { correct: null, score: null, points: 0 },
    });

    expect(AttemptSchema.safeParse(inside).success).toBe(true);
    expect(AttemptSchema.safeParse({ ...inside, finishedAt: null }).success).toBe(true);
  });

  it('rejects an attempt that ends before it starts, or with events or faults outside it', () => {
    const cases: Record<string, Partial<Attempt>> = {
      'finished before it started': { finishedAt: later(-1) },
      'an event before the start': { events: [{ at: later(-1), type: 'turn', payload: {} }] },
      'a fault after the end': {
        finishedAt: later(10),
        faults: [{ ruleId: 'rule.minor.a-item', at: later(11), points: 1 }],
        result: { correct: null, score: null, points: 1 },
      },
    };

    for (const [name, patch] of Object.entries(cases)) {
      expect(AttemptSchema.safeParse(driving(patch)).success, name).toBe(false);
    }
  });
});

describe('activity attempt invariants', () => {
  /** What createAttempt stores for one answer. */
  function activity(overrides: Partial<Attempt> = {}): Attempt {
    return {
      id: 'a1',
      kind: 'activity',
      subjectId: 'act.x',
      contentVersion: 'deadbeef',
      mode: 'practice',
      startedAt: AT,
      finishedAt: AT,
      events: [{ at: AT, type: 'answer', payload: {} }],
      faults: [],
      result: { correct: false, score: 0.5, points: null },
      ...overrides,
    };
  }

  it('accepts a finished answer with a coherent result', () => {
    expect(attemptErrors(activity(), rules)).toEqual([]);
    expect(attemptErrors(activity({ result: { correct: true, score: 1, points: null } }), rules)).toEqual([]);
  });

  it('rejects unfinished or answerless attempts and incoherent results', () => {
    const cases: Record<string, Partial<Attempt>> = {
      unfinished: { finishedAt: null },
      'no answer event': { events: [] },
      'two answer events': {
        events: [
          { at: AT, type: 'answer', payload: {} },
          { at: AT, type: 'answer', payload: {} },
        ],
      },
      'no correctness': { result: { correct: null, score: 0, points: null } },
      'no score': { result: { correct: false, score: null, points: null } },
      'exam points': { result: { correct: false, score: 0, points: 0 } },
      'correct without full score': { result: { correct: true, score: 0.5, points: null } },
      'full score marked wrong': { result: { correct: false, score: 1, points: null } },
    };

    for (const [name, patch] of Object.entries(cases)) {
      expect(attemptErrors(activity(patch), rules).length, name).toBeGreaterThan(0);
    }
  });
});
