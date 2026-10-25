import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import routeData from '../../../specs/route/comuna13-a.json';
import { RouteSchema } from '../../content/schemas.ts';
import { DRIVING_MODES, slugOfMode } from '../../exam/modes.ts';
import { REAL_RULES } from '../../test/realRules.ts';
import { readyContent, renderApp, testContent } from '../../test/renderApp.tsx';
import { EXAM_COPY, EXAM_HUB_COPY, THEORY_COPY, t } from '../../i18n/es-AR.ts';

const navigation = () => screen.getByRole('navigation', { name: t('mainNavigation') });

describe('exam section', () => {
  beforeEach(() => {
    // The practical exam schedules frames; none has to run for these checks.
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens from the Examen navigation item and offers both the theoretical and the practical exam', async () => {
    // Arrange
    const user = userEvent.setup();
    renderApp('/', readyContent(testContent()));

    // Act
    await user.click(within(navigation()).getByRole('link', { name: t('navExam') }));

    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: EXAM_HUB_COPY.heading })).toHaveFocus();
    const theory = screen.getByRole('region', { name: EXAM_HUB_COPY.theoryHeading });
    // The fixture configuration: 2 questions, 1 to pass and 45 minutes at most.
    expect(within(theory).getByText(EXAM_HUB_COPY.theorySummary(2, 1, 45))).toBeInTheDocument();
    expect(within(theory).getByRole('link', { name: EXAM_HUB_COPY.theoryLink })).toHaveAttribute(
      'href',
      '/examen/teorico',
    );
    const practical = screen.getByRole('region', { name: EXAM_HUB_COPY.practicalHeading });
    expect(within(practical).getByRole('link', { name: EXAM_HUB_COPY.practicalLink })).toHaveAttribute(
      'href',
      '/examen/practico',
    );
    for (const mode of DRIVING_MODES)
      expect(within(practical).getByRole('link', { name: EXAM_COPY.homeModes[mode] })).toHaveAttribute(
        'href',
        `/examen/practico?modo=${slugOfMode(mode)}`,
      );
  });

  it('keeps Examen as the current navigation item inside the theoretical exam', async () => {
    renderApp('/examen/teorico?semilla=4', readyContent(testContent()));

    expect(await screen.findByRole('heading', { level: 1, name: THEORY_COPY.heading })).toBeInTheDocument();
    expect(within(navigation()).getByRole('link', { name: t('navExam') })).toHaveAttribute('aria-current', 'page');
  });

  it('sends an old address of the practical exam, with its mode and stage, to the practical exam', async () => {
    // Arrange: the practical exam runs on the real rules and the real route.
    const base = testContent();
    const content = { ...base, rules: { ...base.rules, rules: [...REAL_RULES] }, route: RouteSchema.parse(routeData) };

    // Act
    const { router } = renderApp('/examen?modo=practicar&etapa=3', readyContent(content));

    // Assert
    expect(await screen.findByRole('heading', { level: 1, name: EXAM_COPY.heading })).toBeInTheDocument();
    expect(router.state.location).toMatchObject({ pathname: '/examen/practico', search: '?modo=practicar&etapa=3' });
    expect(within(navigation()).getByRole('link', { name: t('navExam') })).toHaveAttribute('aria-current', 'page');
  });

  it('shows the choice, not the practical exam, at the exam address without a mode', async () => {
    const { router } = renderApp('/examen?semilla=7', readyContent(testContent()));

    expect(await screen.findByRole('heading', { level: 1, name: EXAM_HUB_COPY.heading })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/examen');
  });
});
