import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readyContent, renderApp, testContent } from '../../test/renderApp.tsx';
import { REAL_RULES } from '../../test/realRules.ts';
import { EXAM_COPY } from '../../i18n/es-AR.ts';

/** The fixture content with the real rule catalog: the exam scores real rule ids. */
const content = () => {
  const base = testContent();
  return { ...base, rules: { ...base.rules, rules: [...REAL_RULES] } };
};

describe('exam page', () => {
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
    const canvas = await screen.findByRole('application', { name: EXAM_COPY.canvasLabel });
    runFrames(10);
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

  it('asking to stop interrupts and disapproves, and restarting clears everything', async () => {
    await openExam();

    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.requestStop }));
    runFrames(5);

    expect(screen.getByTestId('exam-result')).toHaveTextContent(EXAM_COPY.results.disapproved);
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'finished');

    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.restart }));
    runFrames(5);

    expect(screen.queryByTestId('exam-result')).not.toBeInTheDocument();
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'familiarisation');
  });

  it('is linked from the home page', async () => {
    renderApp('/');

    expect(await screen.findByRole('link', { name: EXAM_COPY.homeLink })).toHaveAttribute('href', '/examen');
  });
});
