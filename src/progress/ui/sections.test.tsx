import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { GROUP_TITLES } from '../../app/learningPath.ts';
import type { Attempt } from '../../content/schemas.ts';
import { choiceActivity, unit } from '../../content/testing/fixtures.ts';
import { LOGBOOK_COPY, THEORY_COPY, formatDateTime } from '../../i18n/es-AR.ts';
import type { ConceptProgress } from '../model.ts';
import { ConceptProgressSection } from './ConceptProgressSection.tsx';
import { DrivingSection } from './DrivingSection.tsx';
import { ReviewSection } from './ReviewSection.tsx';
import { TheorySection } from './TheorySection.tsx';

const AT = '2026-10-20T12:00:00.000Z';
const inRouter = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: 'x1',
    kind: 'activity',
    subjectId: 'act.speed-street',
    contentVersion: 'deadbeef',
    mode: 'practice',
    startedAt: AT,
    finishedAt: AT,
    events: [],
    faults: [],
    result: { correct: false, score: 0, points: null },
    ...overrides,
  };
}

describe('ReviewSection', () => {
  it('links each suggestion and mistake to its activity, naming due concepts by title or by id', () => {
    // Arrange: one due concept has a title in the content, the other one is gone from it.
    const activity = choiceActivity();
    const unfinished = attempt({ finishedAt: null });

    // Act
    inRouter(
      <ReviewSection
        suggestions={[{ activity, reason: 'due', dueUnitIds: ['manual.ch3.roundabout-priority', 'manual.ch9.gone'] }]}
        errors={[{ activity, attempt: unfinished }]}
        unitTitles={new Map([['manual.ch3.roundabout-priority', 'Rotonda']])}
      />,
    );

    // Assert
    const review = screen.getByRole('region', { name: LOGBOOK_COPY.reviewHeading });
    expect(within(review).getByRole('link', { name: activity.title })).toHaveAttribute(
      'href',
      '/actividad/act.speed-street',
    );
    expect(within(review).getByText(`${LOGBOOK_COPY.reasonDue} Rotonda; manual.ch9.gone`)).toBeInTheDocument();
    const errors = screen.getByRole('region', { name: LOGBOOK_COPY.errorsHeading });
    // Intl separates the time with no-break spaces, which the text matcher reads as plain ones.
    const when = LOGBOOK_COPY.errorOn(formatDateTime(AT)).replace(/\s+/g, ' ');
    expect(within(errors).getByText(when)).toBeInTheDocument();
  });

  it('invites new practice when there is nothing to review or fix', () => {
    inRouter(<ReviewSection suggestions={[]} errors={[]} unitTitles={new Map()} />);

    expect(screen.getByRole('link', { name: LOGBOOK_COPY.reviewTryNew })).toHaveAttribute('href', '/actividades');
    expect(screen.getByText(LOGBOOK_COPY.errorsEmpty)).toBeInTheDocument();
  });

  it('explains a suggestion that comes from a recent mistake', () => {
    inRouter(
      <ReviewSection
        suggestions={[{ activity: choiceActivity(), reason: 'recent-error', dueUnitIds: [] }]}
        errors={[]}
        unitTitles={new Map()}
      />,
    );

    expect(screen.getByText(LOGBOOK_COPY.reasonRecentError)).toBeInTheDocument();
  });
});

describe('TheorySection', () => {
  it('lists each mock exam with its date, score and verdict', () => {
    const rows = [
      { attempt: attempt({ id: 't2' }), correct: 20, total: 40, passed: false, at: AT },
      { attempt: attempt({ id: 't1' }), correct: 36, total: 40, passed: true, at: AT },
    ];

    inRouter(<TheorySection rows={rows} />);

    const items = within(screen.getByTestId('theory-log')).getAllByRole('listitem');
    expect(items.map((item) => item.dataset.result)).toEqual(['disapproved', 'approved']);
    expect(items[1]).toHaveTextContent(THEORY_COPY.logbookRow(36, 40, true));
  });

  it('points to the exam room when there is no mock exam yet', () => {
    inRouter(<TheorySection rows={[]} />);

    expect(screen.getByText(THEORY_COPY.logbookEmpty, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: THEORY_COPY.heading })).toHaveAttribute('href', '/examen/teorico');
  });
});

describe('DrivingSection', () => {
  it('lists each drive with its mode, stages, points and verdict', () => {
    const row = {
      attempt: attempt({ id: 'd1', kind: 'driving' }),
      mode: 'exam' as const,
      completedStages: ['I' as const, 'II' as const],
      points: 9,
      result: 'disapproved' as const,
      at: AT,
    };

    inRouter(<DrivingSection rows={[row]} />);

    const item = within(screen.getByTestId('driving-log')).getByRole('listitem');
    expect(item).toHaveAttribute('data-mode', 'exam');
    expect(item).toHaveTextContent(LOGBOOK_COPY.drivingResults.disapproved);
    expect(item).toHaveTextContent(LOGBOOK_COPY.drivingPoints(9));
  });

  it('points to the practical exam when nothing was driven yet', () => {
    inRouter(<DrivingSection rows={[]} />);

    expect(screen.getByRole('link', { name: LOGBOOK_COPY.drivingLink })).toHaveAttribute('href', '/examen/practico');
  });
});

describe('ConceptProgressSection', () => {
  const progress = (overrides: Partial<ConceptProgress> = {}): ConceptProgress => ({
    unitId: 'manual.ch3.roundabout-priority',
    box: 1,
    attempts: 2,
    correct: 1,
    lastAttemptAt: AT,
    lastCorrect: true,
    dueAt: '2026-10-21T12:00:00.000Z',
    ...overrides,
  });

  it('shows each practised concept with its state and when to review it, and hides empty reference material', () => {
    // Arrange
    const rotonda = unit({ id: 'manual.ch3.roundabout-priority' });
    const groups = [
      {
        groupId: 'campaign-b' as const,
        total: 2,
        withActivities: 1,
        practiced: 1,
        mastered: 0,
        rows: [
          { unit: rotonda, progress: progress(), state: 'practiced' as const, due: true },
          {
            unit: { ...rotonda, id: 'manual.ch3.other', title: 'Otra' },
            progress: progress(),
            state: 'mastered' as const,
            due: false,
          },
        ],
      },
      { groupId: 'reference' as const, total: 3, withActivities: 0, practiced: 0, mastered: 0, rows: [] },
      { groupId: 'complementary' as const, total: 1, withActivities: 1, practiced: 0, mastered: 0, rows: [] },
    ];

    // Act
    inRouter(<ConceptProgressSection groups={groups} />);

    // Assert
    expect(screen.queryByRole('heading', { name: GROUP_TITLES.reference })).not.toBeInTheDocument();
    const campaign = screen.getByRole('region', { name: GROUP_TITLES['campaign-b'] });
    expect(within(campaign).getByRole('link', { name: 'Rotonda' })).toHaveAttribute('href', '/mapa/manual/ch3');
    expect(within(campaign).getByText(LOGBOOK_COPY.dueNow)).toBeInTheDocument();
    expect(within(campaign).getByText(LOGBOOK_COPY.stateLabels.mastered)).toBeInTheDocument();
    const complementary = screen.getByRole('region', { name: GROUP_TITLES.complementary });
    expect(within(complementary).getByText(LOGBOOK_COPY.groupEmpty)).toBeInTheDocument();
  });
});
