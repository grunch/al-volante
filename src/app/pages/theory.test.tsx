import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { choiceActivity } from '../../content/testing/fixtures.ts';
import type { Content } from '../../content/validate.ts';
import { createMemoryStore } from '../../progress/storage.ts';
import type { ProgressStore } from '../../progress/storage.ts';
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
    const { router } = renderApp('/examen/teorico?semilla=4', readyContent(examContent()), store);

    expect(await screen.findByText(THEORY_COPY.introSummary(2, 1, 2, 45))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: THEORY_COPY.start }));
    await user.click(screen.getByRole('radio', { name: 'Pregunta uno: correcta' }));
    await user.click(screen.getByRole('radio', { name: 'Pregunta dos: incorrecta' }));
    expect(screen.getByText(new RegExp(THEORY_COPY.progress(2, 2)))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: THEORY_COPY.handIn }));

    expect(await screen.findByRole('heading', { level: 2, name: THEORY_COPY.passed })).toBeInTheDocument();
    expect(screen.getByText(THEORY_COPY.score(1, 2, 1))).toBeInTheDocument();
    // 2 questions and 1 to pass: one mistake is the most the exam allows.
    expect(screen.getByText(THEORY_COPY.mistakes(1, 1))).toBeInTheDocument();
    expect(screen.getByRole('table', { name: THEORY_COPY.bySectionHeading })).toBeInTheDocument();
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
    const { router } = renderApp('/examen/teorico?minutos=40', readyContent(examContent()));

    expect(await screen.findByText(THEORY_COPY.introSummary(2, 1, 2, 40))).toBeInTheDocument();
    expect(router.state.location.search).toMatch(/^\?minutos=40&semilla=\d+$/);
  });

  it('numbers the options instead of showing their catalog ids, which could give the answer away', async () => {
    const user = userEvent.setup();
    renderApp('/examen/teorico?semilla=4', readyContent(examContent()));

    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));

    const values = screen.getAllByRole('radio').map((radio) => (radio as HTMLInputElement).value);
    expect(values.every((value) => /^o\d$/.test(value))).toBe(true);
  });

  it('starts another exam with the focus on the page title', async () => {
    const user = userEvent.setup();
    renderApp('/examen/teorico?semilla=4', readyContent(examContent()));
    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));
    await user.click(screen.getByRole('button', { name: THEORY_COPY.handIn }));

    await user.click(await screen.findByRole('button', { name: THEORY_COPY.another }));

    expect(await screen.findByRole('button', { name: THEORY_COPY.start })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
  });

  it('offers the shorter time from the configuration and keeps it in the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/examen/teorico?semilla=4', readyContent(examContent()));

    await user.click(await screen.findByRole('radio', { name: THEORY_COPY.timeShort(40) }));

    expect(router.state.location.search).toBe('?semilla=4&minutos=40');
    expect(screen.getByText(THEORY_COPY.introSummary(2, 1, 2, 40))).toBeInTheDocument();
  });

  it('keeps the focus on the time just chosen, so the keyboard can go on from there', async () => {
    // Arrange
    const user = userEvent.setup();
    renderApp('/examen/teorico?semilla=4', readyContent(examContent()));
    const shorter = await screen.findByRole('radio', { name: THEORY_COPY.timeShort(40) });

    // Act
    await user.click(shorter);

    // Assert: the radio group is not rebuilt under the focus, which would drop it on the document body.
    const chosen = screen.getByRole('radio', { name: THEORY_COPY.timeShort(40) });
    expect(chosen).toBeChecked();
    expect(chosen).toHaveFocus();
  });

  it('keeps the time of an exam already running when the time in the URL changes', async () => {
    // Arrange: a 40-minute exam is running.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { router } = renderApp('/examen/teorico?semilla=4&minutos=40', readyContent(examContent()));
    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));
    await user.click(screen.getByRole('radio', { name: 'Pregunta uno: correcta' }));

    // Act: the back button takes the URL to the default 45 minutes.
    await act(() => router.navigate('/examen/teorico?semilla=4&minutos=45'));
    await act(() => vi.advanceTimersByTimeAsync(40 * 60_000 + 2_000));

    // Assert: the paper is handed in at 40 minutes, with the answer given before the URL changed.
    expect(await screen.findByText(THEORY_COPY.timedOut)).toBeInTheDocument();
    expect(screen.getByText(THEORY_COPY.unanswered(1))).toBeInTheDocument();
  });

  it('hands the paper in by itself when time runs out, counting the unanswered questions as wrong', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const store = createMemoryStore();
    renderApp('/examen/teorico?semilla=4&minutos=40', readyContent(examContent()), store);

    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));
    // Several ticks past the deadline before React re-renders: the paper is still handed in once.
    await act(() => vi.advanceTimersByTimeAsync(40 * 60_000 + 5_000));

    expect(await screen.findByRole('heading', { level: 2, name: THEORY_COPY.failed })).toBeInTheDocument();
    expect(screen.getByText(THEORY_COPY.timedOut)).toBeInTheDocument();
    expect(screen.getByText(THEORY_COPY.unanswered(2))).toBeInTheDocument();
    await waitFor(async () => expect((await store.load()).snapshot.attempts).toHaveLength(1));
  });

  it('offers each configured time without calling one of them the one in force', async () => {
    renderApp('/examen/teorico?semilla=4', readyContent(examContent()));

    const times = await screen.findAllByRole('radio');
    const labels = times.map((radio) => radio.closest('label')?.textContent ?? '');
    expect(labels).toEqual([THEORY_COPY.timeDefault(45), THEORY_COPY.timeShort(40)]);
    expect(labels.join(' ')).not.toMatch(/vigente/);
  });

  it('states the only time and offers no choice when the configuration has a single one', async () => {
    // Arrange: the shipped configuration, 40 minutes at most.
    const content = examContent();
    content.theoryExam = { ...content.theoryExam, timeMinutes: { default: 40, alternatives: [] } };

    // Act
    renderApp('/examen/teorico?semilla=4&minutos=45', readyContent(content));

    // Assert: a time outside the configuration in the URL does not lengthen the exam.
    expect(await screen.findByText(THEORY_COPY.introSummary(2, 1, 2, 40))).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: THEORY_COPY.timeLegend })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });

  it('tells before starting how many mistakes fail the exam', async () => {
    renderApp('/examen/teorico?semilla=4', readyContent(examContent()));

    expect(await screen.findByText(THEORY_COPY.introSummary(2, 1, 2, 45))).toHaveTextContent(
      'con más de 1 error (las preguntas sin responder cuentan como errores) no aprobás',
    );
  });

  it('moves the old address of the exam room to the exam section, keeping its seed and time', async () => {
    const { router } = renderApp('/teorico?semilla=4&minutos=40', readyContent(examContent()));

    expect(await screen.findByText(THEORY_COPY.introSummary(2, 1, 2, 40))).toBeInTheDocument();
    expect(router.state.location).toMatchObject({ pathname: '/examen/teorico', search: '?semilla=4&minutos=40' });
  });

  it('shows the sign of a sign question on the paper and again when reviewing it answered wrong', async () => {
    const user = userEvent.setup();
    const content = examContent();
    const [first] = content.activities;
    content.activities = [
      first as Content['activities'][number],
      {
        id: 'act.sign',
        type: 'sign-identification',
        title: 'Señal',
        unitIds: ['manual.ch3.roundabout-priority'],
        refs: [{ source: 'manual', page: 3 }],
        explanation: 'Explicación.',
        status: 'reviewed',
        variants: [
          {
            id: 'v1',
            prompt: '¿Qué indica esta señal?',
            signId: 'sign.regulatory.stop',
            options: [
              { id: 'a', text: 'Detenerse', correct: true, feedback: 'Bien' },
              { id: 'b', text: 'Seguir', correct: false, feedback: 'No' },
            ],
          },
        ],
      },
    ];
    renderApp('/examen/teorico?semilla=4', readyContent(content));
    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));
    expect(screen.getByRole('img', { name: `${THEORY_COPY.signLabel}: Círculo rojo` })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Seguir' }));
    await user.click(screen.getByRole('button', { name: THEORY_COPY.handIn }));

    // Without the sign, "¿Qué indica esta señal?" next to the right answer says nothing to review.
    const wrong = (await screen.findByRole('heading', { name: THEORY_COPY.wrongHeading }))
      .nextElementSibling as HTMLElement;
    expect(within(wrong).getByText('¿Qué indica esta señal?')).toBeInTheDocument();
    expect(within(wrong).getByRole('img', { name: `${THEORY_COPY.signLabel}: Círculo rojo` })).toBeInTheDocument();
  });

  it('says so when the graded exam cannot be stored, and still shows the result', async () => {
    // Arrange: every write fails, as with a full disk.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const store: ProgressStore = { ...createMemoryStore(), record: () => Promise.reject(new Error('quota exceeded')) };
    renderApp('/examen/teorico?semilla=4', readyContent(examContent()), store);

    // Act
    await user.click(await screen.findByRole('button', { name: THEORY_COPY.start }));
    await user.click(screen.getByRole('button', { name: THEORY_COPY.handIn }));

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(THEORY_COPY.notSaved);
    expect(screen.getByRole('heading', { level: 2, name: THEORY_COPY.failed })).toBeInTheDocument();
    vi.mocked(console.error).mockRestore();
  });

  it('warns that a paper shorter than the exam cannot be passed', async () => {
    renderApp('/examen/teorico?semilla=4', readyContent(testContent()));

    expect(await screen.findByRole('alert')).toHaveTextContent(THEORY_COPY.shortBank(1, 2));
  });
});
