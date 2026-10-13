import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import routeData from '../../../specs/route/comuna13-a.json';
import { RouteSchema } from '../../content/schemas.ts';
import { choiceActivity } from '../../content/testing/fixtures.ts';
import { appUpdates } from '../../pwa/updates.ts';
import { fakeServiceWorker } from '../../test/fakeServiceWorker.ts';
import { REAL_RULES } from '../../test/realRules.ts';
import { readyContent, renderApp, testContent } from '../../test/renderApp.tsx';
import { PWA_COPY, THEORY_COPY, t } from '../../i18n/es-AR.ts';

// The app's own update store, as main.tsx starts it in production, with the plugin replaced by a fake.
const worker = fakeServiceWorker({ controlled: true });

beforeAll(() => {
  appUpdates.start(worker.register);
});

beforeEach(() => {
  // The driving view schedules frames; none has to run for these checks.
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Leaves no prompt behind for the next test.
  appUpdates.dismissUpdate();
});

const updateButton = () => screen.queryByRole('button', { name: PWA_COPY.update });

describe('update prompt during exams', { timeout: 30000 }, () => {
  it('waits for the theory paper to be handed in', async () => {
    // Arrange
    const user = userEvent.setup();
    const content = testContent();
    const variant = (prompt: string) => ({
      id: 'v1',
      prompt,
      options: [
        { id: 'a', text: `${prompt}: correcta`, correct: true, feedback: 'Bien' },
        { id: 'b', text: `${prompt}: incorrecta`, correct: false, feedback: 'No' },
      ],
    });
    content.activities = [
      choiceActivity({ id: 'act.one', title: 'Uno', variants: [variant('Pregunta uno')] }),
      choiceActivity({ id: 'act.two', title: 'Dos', variants: [variant('Pregunta dos')] }),
    ];
    renderApp('/teorico?semilla=4', readyContent(content));
    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));

    // Act
    act(() => worker.needRefresh());
    const duringExam = updateButton();
    await user.click(screen.getByRole('button', { name: THEORY_COPY.handIn }));

    // Assert
    expect(duringExam).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: PWA_COPY.update })).toBeInTheDocument();
    expect(worker.reload).not.toHaveBeenCalled();
  });

  it('waits while a drive is under way and appears once the player leaves the exam', async () => {
    // Arrange
    const base = testContent();
    const content = { ...base, rules: { ...base.rules, rules: [...REAL_RULES] }, route: RouteSchema.parse(routeData) };
    const { router } = renderApp('/examen', readyContent(content));
    await screen.findByTestId('exam-mode', {}, { timeout: 15000 });

    // Act
    act(() => worker.needRefresh());
    const duringDrive = updateButton();
    await act(() => router.navigate('/'));

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: t('garageHeading') })).toBeInTheDocument();
    expect(duringDrive).not.toBeInTheDocument();
    await waitFor(() => expect(updateButton()).toBeInTheDocument());
    expect(worker.reload).not.toHaveBeenCalled();
  });
});
