import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import routeData from '../../../specs/route/comuna13-a.json';
import { RouteSchema } from '../../content/schemas.ts';
import { readyContent, renderApp, testContent } from '../../test/renderApp.tsx';
import { REAL_RULES } from '../../test/realRules.ts';
import { EXAM_COPY } from '../../i18n/es-AR.ts';

/** The fixture content with the real rule catalog and the real route: the exam runs on the city (F04-T03). */
const content = () => {
  const base = testContent();
  return { ...base, rules: { ...base.rules, rules: [...REAL_RULES] }, route: RouteSchema.parse(routeData) };
};

// The exam view loads lazily: with the long simulations running beside it, the first mount can take seconds.
describe('exam page', { timeout: 30000 }, () => {
  let callbacks: FrameRequestCallback[];
  let clock: number;

  beforeEach(() => {
    callbacks = [];
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  const runFrames = (frames: number) => {
    for (let i = 0; i < frames; i += 1) {
      const callback = callbacks.shift();
      clock += 1000 / 60;
      act(() => callback?.(clock));
    }
  };

  async function openExam() {
    renderApp('/examen', readyContent(content()));
    const canvas = await screen.findByRole('application', { name: EXAM_COPY.canvasLabel }, { timeout: 15000 });
    // Lazy markup can precede the passive effect that schedules the driving loop.
    await waitFor(() => {
      runFrames(10);
      expect(canvas).toHaveAttribute('data-state', 'ready');
      expect(canvas).toHaveAttribute('data-engine', 'off');
    });
    return canvas;
  }

  it('starts with the key in contact, runs the familiarisation and asks the first recognition question', async () => {
    // Arrange
    const canvas = await openExam();
    expect(canvas).toHaveAttribute('data-engine', 'off');
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'familiarisation');

    // Act
    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.ready }));

    // Assert
    const says = screen.getByTestId('examiner-says');
    expect(says).toHaveAttribute('data-phase', 'recognition');
    expect(Object.values(EXAM_COPY.prompts)).toContain(says.textContent);
    expect(screen.getByTestId('exam-points')).toHaveTextContent('0');
  });

  it('scores a wrong answer during the recognition and lists the fault with its points', async () => {
    const canvas = await openExam();
    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.ready }));
    // The recognition starts by putting the car back, which releases every held key: wait for that frame.
    runFrames(5);
    const says = screen.getByTestId('examiner-says');
    const asked = says.textContent;
    const pedal = (
      [EXAM_COPY.prompts.clutch, EXAM_COPY.prompts.brake, EXAM_COPY.prompts.throttle] as string[]
    ).includes(asked ?? '');
    const gear = asked?.startsWith('Poné') ?? false;

    // Act: a wrong answer of the same family as the first question (the fault is judged per family).
    if (pedal) {
      const wrongPedal = asked === EXAM_COPY.prompts.brake ? 'ArrowUp' : 'ArrowDown';
      fireEvent.keyDown(canvas, { code: wrongPedal });
      runFrames(60);
      fireEvent.keyUp(canvas, { code: wrongPedal });
    } else if (gear) {
      fireEvent.keyDown(canvas, { code: 'ShiftLeft' });
      runFrames(30);
      fireEvent.keyDown(canvas, { code: asked === EXAM_COPY.prompts['gear-1'] ? 'KeyQ' : 'KeyE' });
      runFrames(5);
    } else {
      // A light or an instrument: answer with the opposite family's "wrong" member of the same family.
      const lights: string[] = [
        EXAM_COPY.prompts.position,
        EXAM_COPY.prompts.low,
        EXAM_COPY.prompts.high,
        EXAM_COPY.prompts['signal-left'],
        EXAM_COPY.prompts['signal-right'],
        EXAM_COPY.prompts.hazards,
      ];
      const code = lights.includes(asked ?? '')
        ? asked === EXAM_COPY.prompts.hazards
          ? 'KeyZ'
          : 'KeyV'
        : asked === EXAM_COPY.prompts.wipers
          ? 'KeyH'
          : 'KeyF';
      fireEvent.keyDown(canvas, { code });
      runFrames(5);
    }

    // Assert
    const points = Number(screen.getByTestId('exam-points').textContent);
    expect(points).toBeGreaterThan(0);
    expect(screen.getByText(new RegExp(EXAM_COPY.faultPoints(points)))).toBeInTheDocument();
  });

  it('puts the car back with the engine off when the recognition starts, whatever happened while familiarising', async () => {
    const canvas = await openExam();
    // Manual in neutral: K turns the key to start.
    fireEvent.keyDown(canvas, { code: 'KeyK' });
    runFrames(5);
    expect(canvas).toHaveAttribute('data-engine', 'running');

    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.ready }));
    runFrames(5);

    expect(canvas).toHaveAttribute('data-engine', 'off');
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'recognition');
  });

  it('asking to stop interrupts and disapproves, and restarting clears everything', async () => {
    await openExam();

    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.requestStop }));
    runFrames(5);

    expect(screen.getByTestId('exam-result')).toHaveTextContent(EXAM_COPY.results.disapproved);
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'finished');
    expect(screen.getByText(EXAM_COPY.feedbackClean)).toBeInTheDocument();
    // In the box there is no signal ahead: no light is shown, never a default green.
    expect(screen.getByTestId('exam-light')).toHaveTextContent(EXAM_COPY.noSignalAhead);

    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.restart }));
    runFrames(5);

    expect(screen.queryByTestId('exam-result')).not.toBeInTheDocument();
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'familiarisation');
  });

  it('runs on the city: shows the leg, the first turn instruction, the limits of the road and the traffic seed', async () => {
    await openExam();

    expect(screen.getByTestId('exam-leg')).toHaveTextContent(EXAM_COPY.leg(1, 'Quesada'));
    expect(screen.getByTestId('exam-instruction')).toHaveTextContent(EXAM_COPY.instruction('right', 'Av. Cabildo'));
    expect(screen.getByTestId('exam-limits')).toHaveTextContent(EXAM_COPY.limitsOf(30, 40));
    expect(screen.getByTestId('exam-notice')).toHaveTextContent(EXAM_COPY.nothingAhead);
    const seed = screen.getByRole('spinbutton', { name: EXAM_COPY.seed });
    expect(seed).toHaveValue(1);

    fireEvent.change(seed, { target: { value: '5' } });
    runFrames(5);

    expect(seed).toHaveValue(5);
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'familiarisation');
    expect(screen.getByTestId('exam-points')).toHaveTextContent('0');
  });

  it('is linked from the home page', async () => {
    renderApp('/');

    expect(await screen.findByRole('link', { name: EXAM_COPY.homeLink })).toHaveAttribute('href', '/examen');
  });
});
