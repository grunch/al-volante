import { describe, expect, it } from 'vitest';
import { REAL_BANDS, REAL_RULES } from '../test/realRules.ts';
import { Driver, IDLE } from '../test/examDriver.ts';
import { buildCard, fichaRowOf, STAGES } from './card.ts';
import { FICHA_GROUPS, interrupt, recordFault, ruleById } from './scoring.ts';
import type { FaultReport, Stage } from './scoring.ts';
import { createPracticeSession, createSession, stageOf } from './session.ts';
import type { Session, Transition } from './session.ts';

/** A finished whole exam with the given faults, phase log and completed stages, built by hand. */
function finished(
  faults: readonly Omit<FaultReport, 'atS'>[],
  options: { completed?: readonly Stage[]; transitions?: readonly Transition[]; interruptAtS?: number } = {},
): Session {
  const base = createSession(REAL_RULES, 'automatic', 1, null, REAL_BANDS);
  let ledger = base.ledger;
  faults.forEach((fault, index) => {
    ledger = recordFault(ledger, { ...fault, atS: index + 1 });
  });
  if (options.interruptAtS !== undefined) ledger = interrupt(ledger, options.interruptAtS, 'examiner');
  return {
    ...base,
    phase: 'finished',
    ledger,
    timeS: 100,
    completedStages: options.completed ?? ['I', 'II', 'III'],
    transitions: options.transitions ?? [
      { phase: 'familiarisation', atS: 0 },
      { phase: 'unlock', atS: 10 },
      { phase: 'parking', atS: 60 },
      { phase: 'finished', atS: 100 },
    ],
  };
}

describe('buildCard (protocolo PDF 14–17)', () => {
  it('approves a clean exam with 0 points and the three stages completed', () => {
    const card = buildCard(finished([]));

    expect(card.result).toBe('approved');
    expect(card.verdict).toEqual({ kind: 'approved', points: 0 });
    expect(card.points).toBe(0);
    expect(card.stages.map((stage) => stage.stage)).toEqual(STAGES);
    expect(card.stages.every((stage) => stage.completed && stage.inScope)).toBe(true);
    expect(card.stages.map((stage) => [stage.startedAtS, stage.endedAtS])).toEqual([
      [0, 10],
      [10, 60],
      [60, 100],
    ]);
  });

  it('approves with exactly 7 points, split by stage, and sums the subtotals', () => {
    const card = buildCard(
      finished([
        { ruleId: 'rule.minor.c-seat-adjustment', stage: 'I' },
        { ruleId: 'rule.high.b-reverse-30cm-fail', stage: 'II' },
        { ruleId: 'rule.low.d-engine-stall', stage: 'II' },
        { ruleId: 'rule.minor.u-parking-on-second-band', stage: 'III' },
      ]),
    );

    expect(card.points).toBe(7);
    expect(card.verdict).toEqual({ kind: 'approved', points: 7 });
    expect(card.stages.map((stage) => stage.points)).toEqual([1, 5, 1]);
    expect(card.stages[1]?.faults.map((item) => item.rule.id)).toEqual([
      'rule.high.b-reverse-30cm-fail',
      'rule.low.d-engine-stall',
    ]);
  });

  it('disapproves with 8 points and no interruption, naming the points as the cause', () => {
    const card = buildCard(
      finished([
        { ruleId: 'rule.high.b-reverse-30cm-fail', stage: 'II' },
        { ruleId: 'rule.high.c-forward-30cm-fail', stage: 'II' },
        { ruleId: 'rule.low.d-engine-stall', stage: 'II' },
      ]),
    );

    expect(card.points).toBe(8);
    expect(card.result).toBe('disapproved');
    expect(card.verdict).toEqual({ kind: 'disapproved', cause: 'over-points', points: 8 });
    expect(card.stages.every((stage) => stage.completed)).toBe(true);
  });

  it('disapproves on an eliminatory fault that does not interrupt (r: outside the second band)', () => {
    const card = buildCard(finished([{ ruleId: 'rule.eliminatory.r-parking-outside-second-band', stage: 'III' }]));

    expect(card.verdict).toMatchObject({ kind: 'disapproved', cause: 'eliminatory' });
    expect(card.verdict.kind === 'disapproved' && card.verdict.cause === 'eliminatory' && card.verdict.rule.id).toBe(
      'rule.eliminatory.r-parking-outside-second-band',
    );
    expect(card.stages[2]?.completed).toBe(true);
  });

  it('reports the interruption by the examiner, with its rule, and the stages left incomplete', () => {
    const card = buildCard(
      finished([{ ruleId: 'rule.eliminatory.i-reckless-maneuver', stage: 'II', cause: 'examiner' }], {
        completed: ['I'],
        transitions: [
          { phase: 'familiarisation', atS: 0 },
          { phase: 'unlock', atS: 10 },
          { phase: 'finished', atS: 40 },
        ],
      }),
    );

    expect(card.verdict).toMatchObject({ kind: 'disapproved', cause: 'interruption' });
    if (card.verdict.kind !== 'disapproved' || card.verdict.cause !== 'interruption')
      throw new Error('no interruption');
    expect(card.verdict.interruption.cause).toBe('examiner');
    expect(card.verdict.rule?.id).toBe('rule.eliminatory.i-reckless-maneuver');
    expect(card.stages.map((stage) => [stage.completed, stage.startedAtS, stage.endedAtS])).toEqual([
      [true, 0, 10],
      [false, 10, 40],
      [false, null, null],
    ]);
  });

  it('reports the cutoff before circulating with no rule nor fault of its own (PDF 10)', () => {
    const base = finished([{ ruleId: 'rule.high.a-mirrors-not-checked', stage: 'I' }], { completed: ['I'] });
    const card = buildCard({ ...base, ledger: interrupt(base.ledger, 20, 'cutoff') });

    expect(card.verdict).toMatchObject({ kind: 'disapproved', cause: 'interruption', rule: null, fault: null });
  });

  it('reports an interruption by an eliminatory fault (q: third attempt) as such', () => {
    const card = buildCard(
      finished([{ ruleId: 'rule.eliminatory.q-parking-over-two-attempts', stage: 'III' }], { completed: ['I', 'II'] }),
    );

    expect(card.verdict).toMatchObject({ kind: 'disapproved', cause: 'interruption' });
    if (card.verdict.kind !== 'disapproved' || card.verdict.cause !== 'interruption')
      throw new Error('no interruption');
    expect(card.verdict.interruption.cause).toBe('fault');
    expect(card.stages[2]?.completed).toBe(false);
  });

  it('keeps the result pending for a single practised stage, with the other stages out of scope', () => {
    const session: Session = {
      ...createPracticeSession(REAL_RULES, 'manual', 1, null, REAL_BANDS, 'I'),
      phase: 'finished',
      completedStages: ['I'],
      transitions: [
        { phase: 'familiarisation', atS: 0 },
        { phase: 'finished', atS: 30 },
      ],
    };

    const card = buildCard(session);

    expect(card.result).toBe('pending');
    expect(card.verdict).toEqual({ kind: 'pending', points: 0 });
    expect(card.stages.map((stage) => [stage.inScope, stage.completed, stage.startedAtS, stage.endedAtS])).toEqual([
      [true, true, 0, 30],
      [false, false, null, null],
      [false, false, null, null],
    ]);
  });

  it('keeps a practice pending even when it ends interrupted or over 7 points (D15)', () => {
    const practice = createPracticeSession(REAL_RULES, 'manual', 1, null, REAL_BANDS, 'II');
    let ledger = recordFault(practice.ledger, { ruleId: 'rule.eliminatory.k-red-light', atS: 5, stage: 'II' });
    ledger = interrupt(ledger, 5, 'examiner');
    const card = buildCard({ ...practice, phase: 'finished', ledger, timeS: 5 });

    expect(card.points).toBe(8);
    expect(card.result).toBe('pending');
    expect(card.verdict.kind).toBe('pending');
  });

  it('counts the last leg driven in a stage III practice as part of stage III', () => {
    const practice = createPracticeSession(REAL_RULES, 'manual', 1, null, REAL_BANDS, 'I');
    const session: Session = {
      ...practice,
      scope: { from: 'III', to: 'III' },
      phase: 'finished',
      completedStages: ['III'],
      transitions: [
        { phase: 'circulation', atS: 0 },
        { phase: 'parking', atS: 40 },
        { phase: 'finished', atS: 90 },
      ],
    };

    const card = buildCard(session);

    expect(card.stages.map((stage) => [stage.inScope, stage.startedAtS, stage.endedAtS])).toEqual([
      [false, null, null],
      [false, null, null],
      [true, 0, 90],
    ]);
  });

  it('attributes the phases before a practice’s first stage to that stage', () => {
    expect(stageOf('circulation', { from: 'III', to: 'III' })).toBe('III');
    expect(stageOf('circulation', { from: 'I', to: 'III' })).toBe('II');
    expect(stageOf('recognition', { from: 'II', to: 'II' })).toBe('II');
    expect(stageOf('parking', { from: 'I', to: 'III' })).toBe('III');
  });

  it('logs the move to the recognition among the phase transitions', () => {
    const driver = new Driver('automatic');
    driver.ready();
    expect(driver.session.transitions.map((item) => item.phase)).toEqual(['familiarisation', 'recognition']);
  });

  it('shows the unlock checks of stage I (neutral, handbrake) under stage I, as the ficha lists them (PDF 15)', () => {
    // The game asks for them when the engine starts and the car first moves, which is already stage II.
    const card = buildCard(
      finished([
        { ruleId: 'rule.minor.e-neutral-check-before-start', stage: 'II' },
        { ruleId: 'rule.minor.f-handbrake-on-start', stage: 'II', episode: 'handbrake-0' },
        { ruleId: 'rule.low.d-engine-stall', stage: 'II' },
      ]),
    );

    expect(card.stages[0]?.faults.map((item) => item.rule.id)).toEqual([
      'rule.minor.e-neutral-check-before-start',
      'rule.minor.f-handbrake-on-start',
    ]);
    expect(card.stages[1]?.faults.map((item) => item.rule.id)).toEqual(['rule.low.d-engine-stall']);
    expect(card.stages.map((stage) => stage.points)).toEqual([2, 2, 0]);
  });

  it('consigns a conduct with two rows in the row of its context, a turn or a crossing (D1, PDF 16–17)', () => {
    const slowdown = ruleById(REAL_RULES, 'rule.high.m-no-slowdown-before-maneuver');

    expect(fichaRowOf(slowdown, { stage: 'II', group: FICHA_GROUPS.turns }).text).toBe(
      'No reduce la velocidad para efectuar la maniobra con seguridad',
    );
    expect(fichaRowOf(slowdown, { stage: 'II', group: FICHA_GROUPS.crossings }).text).toBe(
      'No reduce la velocidad para efectuar el cruce con seguridad en esquinas no semaforizadas',
    );
    // A judge that cannot tell the context leaves the first row of the stage.
    expect(fichaRowOf(slowdown, { stage: 'II' }).group).toBe(FICHA_GROUPS.crossings);
  });

  it('names the fault of the verdict in the row of its context: a pedestrian hit while turning', () => {
    const card = buildCard(
      finished(
        [
          {
            ruleId: 'rule.high.l-yield-to-pedestrians-cyclists',
            stage: 'II',
            episode: 'crosswalk',
            group: FICHA_GROUPS.turns,
            escalate: true,
          },
        ],
        { completed: ['I'] },
      ),
    );

    if (card.verdict.kind !== 'disapproved' || card.verdict.cause !== 'interruption' || !card.verdict.rule)
      throw new Error('no interruption');
    expect(fichaRowOf(card.verdict.rule, card.verdict.fault ?? { stage: 'II' }).text).toBe(
      'No cede el paso a peatones y/o ciclistas al girar',
    );
  });

  it('names the fault the examiner raised in the verdict, not a later fault of the same rule in another row', () => {
    // Arrange: a pedestrian not yielded to at a crossing (t = 1), another one while turning (t = 2), then the
    // examiner takes over for the first episode, still escalatable: that fault is raised in place (t = 3).
    const yieldRule = 'rule.high.l-yield-to-pedestrians-cyclists';
    const session = finished(
      [
        { ruleId: yieldRule, stage: 'II', episode: 'crosswalk-a', group: FICHA_GROUPS.crossings },
        { ruleId: yieldRule, stage: 'II', episode: 'crosswalk-b', group: FICHA_GROUPS.turns },
        { ruleId: yieldRule, stage: 'II', episode: 'crosswalk-a', escalate: true },
      ],
      { completed: ['I'] },
    );
    expect(session.ledger.interruption).toEqual({ ruleId: yieldRule, atS: 3, cause: 'examiner' });

    // Act
    const card = buildCard(session);

    // Assert: the raised fault of the crossing, which keeps the time it was first scored.
    if (card.verdict.kind !== 'disapproved' || card.verdict.cause !== 'interruption' || !card.verdict.rule)
      throw new Error('no interruption');
    expect(card.verdict.fault).toMatchObject({ episode: 'crosswalk-a', escalated: true, atS: 1 });
    expect(fichaRowOf(card.verdict.rule, card.verdict.fault ?? { stage: 'II' }).text).toBe(
      'No cede el paso a peatones y a ciclistas que se encuentren cruzando',
    );
  });

  it('names the eliminatory fault scored at the interruption, not a later fault of the same rule', () => {
    // Arrange: a hand-made ledger where the same rule was scored again after the fault that interrupted.
    const base = finished([{ ruleId: 'rule.eliminatory.k-red-light', stage: 'II', group: FICHA_GROUPS.crossings }], {
      completed: ['I'],
    });
    const [first] = base.ledger.faults;
    if (!first) throw new Error('no fault');
    const session: Session = {
      ...base,
      ledger: { ...base.ledger, faults: [first, { ...first, atS: 2, group: undefined }] },
    };

    // Act
    const card = buildCard(session);

    // Assert
    if (card.verdict.kind !== 'disapproved' || card.verdict.cause !== 'interruption')
      throw new Error('no interruption');
    expect(card.verdict.fault).toBe(first);
  });

  it('keeps the unlock checks in stage II when a practice of stage II leaves stage I off the card', () => {
    const practice = createPracticeSession(REAL_RULES, 'manual', 1, null, REAL_BANDS, 'II');
    const ledger = recordFault(practice.ledger, {
      ruleId: 'rule.minor.e-neutral-check-before-start',
      atS: 1,
      stage: 'II',
    });

    const card = buildCard({ ...practice, phase: 'finished', ledger, timeS: 5 });

    expect(card.stages[0]?.faults).toEqual([]);
    expect(card.stages[1]?.faults.map((item) => item.rule.id)).toEqual(['rule.minor.e-neutral-check-before-start']);
    expect(card.stages[1]?.points).toBe(1);
  });

  it('assigns the faults scored at the instant stage I ends to stage I, and the next one where the ficha lists it', () => {
    const driver = new Driver('manual');
    driver.ready();
    driver.recognise();
    // Belt and lights only: the seat, the headrest and the mirrors are left alone, so three faults of stage I.
    driver.cabin({ type: 'toggle', control: 'belt' });
    driver.cabin({ type: 'lights', value: 'low' });
    driver.ready();
    // Stage II: starting in first with the clutch down works, but neutral was not checked (minor e).
    driver.hold({ ...IDLE, clutch: 1 }, (_, t) => t > 0.1);
    driver.drive({ type: 'shift', to: '1' }, { type: 'turn-key', to: 'start' });

    const card = buildCard(driver.session);
    const unlock = driver.session.transitions.find((item) => item.phase === 'unlock');

    expect(driver.faults).toEqual([
      'rule.minor.c-seat-adjustment',
      'rule.minor.d-headrest-adjustment',
      'rule.high.a-mirrors-not-checked',
      'rule.minor.e-neutral-check-before-start',
    ]);
    // The three faults of stage I share the simulation time of the transition to stage II: time alone cannot split them.
    expect(driver.session.ledger.faults.slice(0, 3).every((fault) => fault.atS === unlock?.atS)).toBe(true);
    // Neutral is checked when the engine starts, in stage II for the game; the ficha lists it in stage I (PDF 15).
    expect(driver.session.ledger.faults[3]?.stage).toBe('II');
    expect(card.stages[0]?.faults.map((item) => item.rule.id)).toEqual(driver.faults);
    expect(card.stages[1]?.faults).toEqual([]);
    expect(card.stages[0]?.points).toBe(6);
    expect(card.stages[1]?.points).toBe(0);
    expect(card.finished).toBe(false);
    expect(card.verdict).toEqual({ kind: 'pending', points: 6 });
  });
});
