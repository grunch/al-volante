import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { buildCard } from '../../exam/card.ts';
import { FICHA_GROUPS, interrupt, recordFault } from '../../exam/scoring.ts';
import type { FaultReport, Stage } from '../../exam/scoring.ts';
import { createPracticeSession, createSession } from '../../exam/session.ts';
import type { Session, Transition } from '../../exam/session.ts';
import { REAL_BANDS, REAL_RULES } from '../../test/realRules.ts';
import { EXAM_COPY as copy, MOBILE_COPY } from '../../i18n/es-AR.ts';
import { ExamCardView, FaultList } from './ExamCardView.tsx';

const conductOf = (ruleId: string, row = 0) =>
  REAL_RULES.find((rule) => rule.id === ruleId)?.fichaRows[row]?.text ?? ruleId;

const WHOLE_EXAM: readonly Transition[] = [
  { phase: 'familiarisation', atS: 0 },
  { phase: 'unlock', atS: 10 },
  { phase: 'parking', atS: 60 },
  { phase: 'finished', atS: 100 },
];

/** A whole exam with the given faults (one second apart), built by hand as in card.test.ts. */
function exam(
  faults: readonly Omit<FaultReport, 'atS'>[],
  options: {
    phase?: Session['phase'];
    completed?: readonly Stage[];
    transitions?: readonly Transition[];
    interruptBy?: 'examiner' | 'driver-request';
  } = {},
): Session {
  const base = createSession(REAL_RULES, 'automatic', 1, null, REAL_BANDS);
  let ledger = base.ledger;
  faults.forEach((fault, index) => {
    ledger = recordFault(ledger, { ...fault, atS: index + 1 });
  });
  if (options.interruptBy) ledger = interrupt(ledger, 50, options.interruptBy);
  return {
    ...base,
    phase: options.phase ?? 'finished',
    ledger,
    timeS: 100,
    completedStages: options.completed ?? ['I', 'II', 'III'],
    transitions: options.transitions ?? WHOLE_EXAM,
  };
}

function renderCard(session: Session, takeover = false) {
  render(
    <MemoryRouter>
      <ExamCardView card={buildCard(session)} takeover={takeover} />
    </MemoryRouter>,
  );
  return screen.getByTestId('exam-card');
}

describe('ExamCardView: the verdict (protocolo PDF 14)', () => {
  it('approves with the points, and times every stage', () => {
    const card = renderCard(exam([{ ruleId: 'rule.minor.c-seat-adjustment', stage: 'I' }]));

    expect(within(card).getByTestId('exam-result')).toHaveAttribute('data-result', 'approved');
    expect(within(card).getByTestId('exam-result')).toHaveTextContent(copy.verdicts.approved(1));
    expect(within(card).getByRole('heading', { level: 3, name: new RegExp(copy.stageTitles.I) })).toHaveTextContent(
      `${copy.stageCompleted} · ${copy.stageDuration(10)}`,
    );
    expect(within(card).getByTestId('exam-card-stage-II')).toHaveTextContent(copy.stageDuration(50));
    expect(within(card).getByTestId('exam-card-subtotal-I')).toHaveTextContent(copy.subtotal(1));
    expect(within(card).getByTestId('exam-card-subtotal-III')).toHaveTextContent(copy.subtotal(0));
    expect(within(card).getByTestId('exam-card-total')).toHaveTextContent(copy.total(1));
  });

  it('disapproves over 7 points, naming the points as the cause', () => {
    const card = renderCard(
      exam([
        { ruleId: 'rule.high.b-reverse-30cm-fail', stage: 'II' },
        { ruleId: 'rule.high.c-forward-30cm-fail', stage: 'II' },
        { ruleId: 'rule.low.d-engine-stall', stage: 'II' },
      ]),
    );

    expect(within(card).getByTestId('exam-result')).toHaveTextContent(copy.verdicts.overPoints(8));
    expect(within(card).getByTestId('exam-card-subtotal-II')).toHaveTextContent(copy.subtotal(8));
  });

  it('names the conduct of an eliminatory fault that does not interrupt', () => {
    const card = renderCard(exam([{ ruleId: 'rule.eliminatory.r-parking-outside-second-band', stage: 'III' }]));

    expect(within(card).getByTestId('exam-result')).toHaveTextContent(
      copy.verdicts.eliminatory(conductOf('rule.eliminatory.r-parking-outside-second-band')),
    );
  });

  it('gives the cause and the rule of an interruption, and says when the examiner braked', () => {
    const transitions: Transition[] = [
      { phase: 'familiarisation', atS: 0 },
      { phase: 'unlock', atS: 10 },
      { phase: 'finished', atS: 40 },
    ];
    const card = renderCard(
      exam([{ ruleId: 'rule.eliminatory.i-reckless-maneuver', stage: 'II', cause: 'examiner' }], {
        completed: ['I'],
        transitions,
      }),
      true,
    );

    expect(within(card).getByTestId('exam-result')).toHaveTextContent(
      `${copy.verdicts.interruption} ${copy.interruptionCauses.examiner} ${copy.interruptedBy(
        conductOf('rule.eliminatory.i-reckless-maneuver'),
      )} ${copy.takeover}`,
    );
    // A stage that never started has no duration; one cut short is incomplete.
    expect(within(card).getByTestId('exam-card-stage-II')).toHaveAttribute('data-completed', 'false');
    expect(within(card).getByTestId('exam-card-stage-III')).not.toHaveTextContent(/\d+ s/);
  });

  it('gives no rule when the driver asked to stop', () => {
    const card = renderCard(exam([], { completed: [], interruptBy: 'driver-request' }));

    const result = within(card).getByTestId('exam-result');
    expect(result).toHaveTextContent(`${copy.verdicts.interruption} ${copy.interruptionCauses['driver-request']}`);
    expect(result).not.toHaveTextContent(copy.interruptedBy(''));
    expect(result).not.toHaveTextContent(copy.takeover);
  });

  it('keeps a practised stage pending and leaves the stages it did not run out of the card', () => {
    const session: Session = {
      ...createPracticeSession(REAL_RULES, 'manual', 1, null, REAL_BANDS, 'I'),
      phase: 'finished',
      completedStages: ['I'],
      transitions: [
        { phase: 'familiarisation', atS: 0 },
        { phase: 'finished', atS: 30 },
      ],
    };

    const card = renderCard(session);

    expect(within(card).getByTestId('exam-result')).toHaveTextContent(copy.verdicts.pending);
    const stageTwo = within(card).getByTestId('exam-card-stage-II');
    expect(stageTwo).toHaveTextContent(copy.stageOutOfScope);
    expect(within(stageTwo).queryByText(copy.noFaults)).not.toBeInTheDocument();
    expect(within(card).queryByTestId('exam-card-subtotal-II')).not.toBeInTheDocument();
    expect(within(card).getByTestId('exam-card-stage-I')).toHaveTextContent(copy.noFaults);
  });
});

describe('ExamCardView: the faults of each stage', () => {
  it('lists each fault with its points, moment, repetition, what it evaluates and every protocol page to read', () => {
    const card = renderCard(exam([{ ruleId: 'rule.minor.c-seat-adjustment', stage: 'I' }]));

    const [item] = within(within(card).getByTestId('exam-card-stage-I')).getAllByRole('listitem');
    expect(item).toHaveTextContent(`${copy.faultPoints(1)} · ${conductOf('rule.minor.c-seat-adjustment')}`);
    expect(item).toHaveTextContent(`(${copy.faultAt(1)})`);
    expect(item).toHaveTextContent(`(${copy.repetition.once})`);
    expect(item).toHaveTextContent(copy.whatIsEvaluated);
    const links = within(item as HTMLElement).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/biblioteca/protocolo/9',
      '/biblioteca/protocolo/15',
      '/biblioteca/protocolo/22',
    ]);
    expect(item).toHaveTextContent(`${copy.protocolPage(9)}, ${copy.protocolPage(15)}, ${copy.protocolPage(22)}`);
  });

  it('marks a fault the examiner escalated to eliminatory', () => {
    const card = renderCard(
      exam([{ ruleId: 'rule.high.e-no-mirror-check-leaving-box', stage: 'II', escalate: true }], {
        completed: ['I'],
      }),
    );

    expect(within(card).getByTestId('exam-card-stage-II')).toHaveTextContent(`(${copy.escalated})`);
  });

  it('writes the conduct of the ficha row the fault is consigned in, not always the first one (D1)', () => {
    const card = renderCard(
      exam([
        { ruleId: 'rule.high.m-no-slowdown-before-maneuver', stage: 'II', episode: 'turn', group: FICHA_GROUPS.turns },
        {
          ruleId: 'rule.high.m-no-slowdown-before-maneuver',
          stage: 'II',
          episode: 'crossing',
          group: FICHA_GROUPS.crossings,
        },
      ]),
    );

    const items = within(within(card).getByTestId('exam-card-stage-II')).getAllByRole('listitem');
    const turnConduct = conductOf('rule.high.m-no-slowdown-before-maneuver', 1);
    const crossingConduct = conductOf('rule.high.m-no-slowdown-before-maneuver', 0);
    expect(items[0]).toHaveTextContent(turnConduct);
    expect(items[0]).not.toHaveTextContent(crossingConduct);
    expect(items[1]).toHaveTextContent(crossingConduct);
  });
});

describe('FaultList', () => {
  const renderList = (session: Session, explain: boolean) =>
    render(
      <MemoryRouter>
        <FaultList session={session} explain={explain} />
      </MemoryRouter>,
    );

  it('says there are no faults yet while driving, and congratulates a clean exam at the end', () => {
    const { unmount } = renderList(exam([], { phase: 'circulation' }), false);
    expect(screen.getByText(copy.noFaults)).toBeInTheDocument();
    unmount();

    renderList(exam([]), true);
    expect(screen.getByText(copy.feedbackClean)).toBeInTheDocument();
  });

  it('lists the faults in order and explains them only when asked', () => {
    const session = exam(
      [
        { ruleId: 'rule.minor.c-seat-adjustment', stage: 'I' },
        { ruleId: 'rule.low.d-engine-stall', stage: 'II' },
      ],
      { phase: 'circulation' },
    );

    const { unmount } = renderList(session, false);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(conductOf('rule.minor.c-seat-adjustment'));
    expect(items[1]).toHaveTextContent(conductOf('rule.low.d-engine-stall'));
    expect(screen.queryByText(copy.whatIsEvaluated, { exact: false })).not.toBeInTheDocument();
    unmount();

    renderList(session, true);
    expect(screen.getAllByText(`${copy.whatIsEvaluated}:`)).toHaveLength(2);
  });

  it('shows the raw id of a fault whose rule the session does not know, instead of failing', () => {
    const session = exam([{ ruleId: 'rule.minor.c-seat-adjustment', stage: 'I' }], { phase: 'circulation' });

    renderList({ ...session, rules: [] }, true);

    expect(screen.getByRole('listitem')).toHaveTextContent('rule.minor.c-seat-adjustment');
  });
});

it('discloses assisted clutch limitations on the mobile exam card with its source', () => {
  render(
    <MemoryRouter>
      <ExamCardView card={buildCard(exam([]))} takeover={false} assistedClutch />
    </MemoryRouter>,
  );
  expect(screen.getByText(MOBILE_COPY.clutchApproximation, { exact: false })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: copy.protocolPage(11) })).toHaveAttribute('href', '/biblioteca/protocolo/11');
});
