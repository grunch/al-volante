import { describe, expect, it } from 'vitest';
import { REAL_RULES } from '../test/realRules.ts';
import { createLedger, interrupt, recordFault, resultOf, ruleById, withdrawFault } from './scoring.ts';
import type { Ledger } from './scoring.ts';

const ledger = () => createLedger(REAL_RULES);
const points = (state: Ledger) => state.faults.reduce((sum, fault) => sum + fault.points, 0);

describe('fault ledger (REGLAS.md §4–§5)', () => {
  it('scores a fault with the points of its rule', () => {
    const after = recordFault(ledger(), { ruleId: 'rule.minor.a-lights-recognition', atS: 1 });

    expect(after.faults).toEqual([
      { ruleId: 'rule.minor.a-lights-recognition', points: 1, atS: 1, escalated: false, episode: undefined },
    ]);
    expect(after.points).toBe(1);
  });

  it('counts a once-only rule a single time no matter how many errors', () => {
    let state = ledger();
    state = recordFault(state, { ruleId: 'rule.minor.a-lights-recognition', atS: 1 });
    state = recordFault(state, { ruleId: 'rule.minor.a-lights-recognition', atS: 2 });
    state = recordFault(state, { ruleId: 'rule.high.b-reverse-30cm-fail', atS: 3 });
    state = recordFault(state, { ruleId: 'rule.high.b-reverse-30cm-fail', atS: 4 });

    expect(state.faults.map((fault) => fault.ruleId)).toEqual([
      'rule.minor.a-lights-recognition',
      'rule.high.b-reverse-30cm-fail',
    ]);
  });

  it('counts a per-occurrence rule every time', () => {
    let state = ledger();
    state = recordFault(state, { ruleId: 'rule.low.d-engine-stall', atS: 1 });
    state = recordFault(state, { ruleId: 'rule.low.d-engine-stall', atS: 2 });

    expect(points(state)).toBe(4);
  });

  it('counts per-episode and unspecified rules once per episode (decision D3)', () => {
    let state = ledger();
    state = recordFault(state, { ruleId: 'rule.minor.f-handbrake-on-start', atS: 1, episode: 'a' });
    state = recordFault(state, { ruleId: 'rule.minor.f-handbrake-on-start', atS: 2, episode: 'a' });
    state = recordFault(state, { ruleId: 'rule.minor.f-handbrake-on-start', atS: 3, episode: 'b' });
    state = recordFault(state, { ruleId: 'rule.minor.k-unnecessary-stop', atS: 4, episode: 'block-1' });
    state = recordFault(state, { ruleId: 'rule.minor.k-unnecessary-stop', atS: 5, episode: 'block-1' });

    expect(state.faults.map((fault) => fault.episode)).toEqual(['a', 'b', 'block-1']);
  });

  it('interrupts the exam on an eliminatory fault that interrupts, and keeps going on one that does not', () => {
    const interrupted = recordFault(ledger(), { ruleId: 'rule.eliminatory.c-no-seatbelt', atS: 1 });
    const reported = recordFault(ledger(), { ruleId: 'rule.eliminatory.l-road-speed-limit-exceeded', atS: 1 });

    expect(interrupted.interruption).toEqual({ ruleId: 'rule.eliminatory.c-no-seatbelt', atS: 1, cause: 'fault' });
    expect(reported.interruption).toBeNull();
    expect(resultOf(reported, ['I', 'II', 'III'])).toBe('disapproved');
  });

  it('escalates a high fault to an eliminatory one when the examiner has to intervene', () => {
    const state = recordFault(ledger(), { ruleId: 'rule.high.e-no-mirror-check-leaving-box', atS: 1, escalate: true });

    expect(state.faults[0]).toMatchObject({ points: 8, escalated: true });
    expect(state.interruption?.cause).toBe('fault');
    expect(() => recordFault(ledger(), { ruleId: 'rule.minor.a-lights-recognition', atS: 1, escalate: true })).toThrow(
      /cannot escalate/,
    );
  });

  it('raises an already scored episode to its escalation instead of adding a second fault', () => {
    let state = recordFault(ledger(), {
      ruleId: 'rule.high.l-yield-to-pedestrians-cyclists',
      atS: 1,
      episode: 'crosswalk',
    });
    state = recordFault(state, {
      ruleId: 'rule.high.l-yield-to-pedestrians-cyclists',
      atS: 2,
      episode: 'crosswalk',
      escalate: true,
    });

    expect(state.faults).toHaveLength(1);
    expect(state.faults[0]).toMatchObject({ points: 8, escalated: true, atS: 1 });
    expect(state.points).toBe(8);
    expect(state.interruption?.cause).toBe('fault');
  });

  it('withdraws a fault of an episode that a more severe rule now covers (decision D2)', () => {
    let state = recordFault(ledger(), { ruleId: 'rule.high.f-exam-speed-exceeded', atS: 1, episode: 'speed-1' });
    state = withdrawFault(state, 'rule.high.f-exam-speed-exceeded', 'speed-1');
    state = recordFault(state, { ruleId: 'rule.eliminatory.l-road-speed-limit-exceeded', atS: 2 });

    expect(state.faults.map((fault) => fault.ruleId)).toEqual(['rule.eliminatory.l-road-speed-limit-exceeded']);
    expect(state.points).toBe(8);
    expect(withdrawFault(state, 'rule.minor.a-lights-recognition', undefined)).toBe(state);
  });

  it('rejects unknown rules instead of scoring them', () => {
    expect(() => recordFault(ledger(), { ruleId: 'rule.minor.z-made-up', atS: 0 })).toThrow(/unknown rule/);
    expect(ruleById(REAL_RULES, 'rule.minor.a-lights-recognition').points).toBe(1);
  });

  it('approves only when the three stages are completed with 7 points or less', () => {
    let state = ledger();
    for (let i = 0; i < 7; i += 1)
      state = recordFault(state, { ruleId: 'rule.minor.i-curb-scrape', atS: i, episode: String(i) });

    expect(resultOf(state, ['I', 'II', 'III'])).toBe('approved');
    expect(resultOf(state, ['I', 'II'])).toBe('pending');
    expect(resultOf(recordFault(state, { ruleId: 'rule.minor.i-curb-scrape', atS: 9 }), ['I', 'II', 'III'])).toBe(
      'disapproved',
    );
  });

  it('records a cutoff or a request as an interruption without a rule, only once', () => {
    const first = interrupt(ledger(), 5, 'cutoff');
    const again = interrupt(first, 9, 'driver-request');

    expect(first.interruption).toEqual({ ruleId: null, atS: 5, cause: 'cutoff' });
    expect(again.interruption).toEqual(first.interruption);
    expect(resultOf(first, ['I', 'II', 'III'])).toBe('disapproved');
  });
});
