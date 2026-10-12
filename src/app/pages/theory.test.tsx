import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choiceActivity } from '../../content/testing/fixtures.ts';
import type { Content } from '../../content/validate.ts';
import { createMemoryStore } from '../../progress/storage.ts';
import { readyContent, renderApp, testContent } from '../../test/renderApp.tsx';
import { THEORY_COPY } from '../../i18n/es-AR.ts';

/** Two ch3 questions with two options each, as the fixture configuration asks; pass with one right. */
function examContent(): Content {
  const content = testContent();
  const variant = (id: string, prompt: string) => ({
    id,
    prompt,
    options: [
      { id: 'a', text: `${prompt}: correcta`, correct: true, feedback: 'Bien' },
      { id: 'b', text: `${prompt}: incorrecta`, correct: false, feedback: 'No' },
    ],
  });
  content.activities = [
    choiceActivity({ id: 'act.one', title: 'Uno', variants: [variant('v1', 'Pregunta uno')] }),
    choiceActivity({ id: 'act.two', title: 'Dos', variants: [variant('v1', 'Pregunta dos')] }),
  ];
  return content;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('theory mock exam page', () => {
  it('composes a reproducible paper, grades it with a diagnosis and stores it in the logbook', async () => {
    const user = userEvent.setup();
    const store = createMemoryStore();
    const { router } = renderApp('/teorico?semilla=4', readyContent(examContent()), store);

    expect(await screen.findByText(THEORY_COPY.introSummary(2, 1, 2, 45))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: THEORY_COPY.start }));
    await user.click(screen.getByRole('radio', { name: 'Pregunta uno: correcta' }));
    await user.click(screen.getByRole('radio', { name: 'Pregunta dos: incorrecta' }));
    expect(screen.getByText(new RegExp(THEORY_COPY.progress(2, 2)))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: THEORY_COPY.handIn }));

    expect(await screen.findByRole('heading', { level: 2, name: THEORY_COPY.passed })).toBeInTheDocument();
    expect(screen.getByText(THEORY_COPY.score(1, 2, 1))).toBeInTheDocument();
    const wrong = screen.getByRole('heading', { name: THEORY_COPY.wrongHeading }).nextElementSibling as HTMLElement;
    expect(within(wrong).getByText('Pregunta dos')).toBeInTheDocument();
    expect(within(wrong).getByRole('link', { name: THEORY_COPY.practise })).toHaveAttribute(
      'href',
      '/actividad/act.two',
    );
    expect(screen.getByRole('link', { name: 'Rotonda' })).toHaveAttribute('href', '/mapa/manual/ch3');

    await waitFor(async () => expect((await store.load()).snapshot.attempts).toHaveLength(1));
    const [attempt] = (await store.load()).snapshot.attempts;
    expect(attempt).toMatchObject({ subjectId: 'theory.mock', mode: 'exam', result: { correct: true, score: 0.5 } });
    await act(() => router.navigate('/bitacora'));
    expect(await screen.findByText(THEORY_COPY.logbookRow(1, 2, true))).toBeInTheDocument();
  });

  it('keeps the chosen time when it repairs a missing seed', async () => {
    const { router } = renderApp('/teorico?minutos=40', readyContent(examContent()));

    expect(await screen.findByText(THEORY_COPY.introSummary(2, 1, 2, 40))).toBeInTheDocument();
    expect(router.state.location.search).toMatch(/^\?minutos=40&semilla=\d+$/);
  });

  it('numbers the options instead of showing their catalog ids, which could give the answer away', async () => {
    const user = userEvent.setup();
    renderApp('/teorico?semilla=4', readyContent(examContent()));

    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));

    const values = screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value);
    expect(values.every((value) => /^o\d$/.test(value))).toBe(true);
  });

  it('starts another exam with the focus on the page title', async () => {
    const user = userEvent.setup();
    renderApp('/teorico?semilla=4', readyContent(examContent()));
    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));
    await user.click(screen.getByRole('button', { name: THEORY_COPY.handIn }));

    await user.click(await screen.findByRole('button', { name: THEORY_COPY.another }));

    expect(await screen.findByRole('button', { name: THEORY_COPY.start })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('offers the shorter time from the configuration and keeps it in the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/teorico?semilla=4', readyContent(examContent()));

    await user.click(await screen.findByRole('radio', { name: THEORY_COPY.timeShort(40) }));

    expect(router.state.location.search).toBe('?semilla=4&minutos=40');
    expect(screen.getByText(THEORY_COPY.introSummary(2, 1, 2, 40))).toBeInTheDocument();
  });

  it('hands the paper in by itself when time runs out, counting the unanswered questions as wrong', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp('/teorico?semilla=4&minutos=40', readyContent(examContent()));

    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));
    await act(() => vi.advanceTimersByTimeAsync(40 * 60_000 + 1_000));

    expect(await screen.findByRole('heading', { level: 2, name: THEORY_COPY.failed })).toBeInTheDocument();
    expect(screen.getByText(THEORY_COPY.timedOut)).toBeInTheDocument();
    expect(screen.getByText(THEORY_COPY.unanswered(2))).toBeInTheDocument();
  });

  it('warns that a paper shorter than the exam cannot be passed', async () => {
    renderApp('/teorico?semilla=4', readyContent(testContent()));

    expect(await screen.findByRole('alert')).toHaveTextContent(THEORY_COPY.shortBank(1, 2));
  });
});
