import { describe, expect, it } from 'vitest';
import { rule, ruleCatalog } from './testing/fixtures.ts';
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

    expect(attemptErrors(activity, rules)).toEqual(['d1: activity attempts cannot have driving faults']);
  });
});
