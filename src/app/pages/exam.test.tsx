import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import routeData from '../../../specs/route/comuna13-a.json';
import { RouteSchema } from '../../content/schemas.ts';
import { DRIVING_MODES, slugOfMode } from '../../exam/modes.ts';
import { createSession } from '../../exam/session.ts';
import { createDrivingAttempt } from '../../progress/model.ts';
import { createMemoryStore } from '../../progress/storage.ts';
import type { ProgressStore } from '../../progress/storage.ts';
import { readyContent, renderApp, testContent } from '../../test/renderApp.tsx';
import { REAL_RULES } from '../../test/realRules.ts';
import { CITY_COPY, EXAM_COPY, LOGBOOK_COPY, TRACK_COPY } from '../../i18n/es-AR.ts';

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

describe('exam modes, card and logbook (F04-T05)', () => {
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

  async function openExam(path: string, store?: ProgressStore) {
    renderApp(path, readyContent(content()), store);
    const canvas = await screen.findByRole('application', { name: EXAM_COPY.canvasLabel });
    await waitFor(() => {
      runFrames(10);
      expect(canvas).toHaveAttribute('data-state', 'ready');
    });
    return canvas;
  }

  it('offers the four modes, runs the three stages by default, and changes mode through the URL', async () => {
    await openExam('/examen');
    const picker = screen.getByRole('group', { name: EXAM_COPY.mode });
    expect(
      within(picker)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(DRIVING_MODES);
    expect(within(picker).getByRole('radio', { name: EXAM_COPY.modes.run })).toBeChecked();
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-mode', 'run');
    expect(screen.queryByTestId('exam-hints')).not.toBeInTheDocument();

    await userEvent.click(within(picker).getByRole('radio', { name: EXAM_COPY.modes.learn }));
    runFrames(5);

    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-mode', 'learn');
    expect(screen.getByTestId('exam-hints')).toHaveTextContent(EXAM_COPY.learnHints.familiarisation.hint);
  });

  it('hides every aid in the exam mode and keeps only what the examiner says', async () => {
    await openExam('/examen?modo=rendir');

    expect(screen.getByRole('radio', { name: EXAM_COPY.modes.exam })).toBeChecked();
    expect(screen.getByTestId('exam-hud')).toHaveAttribute('data-aids', '');
    expect(screen.getByTestId('exam-no-aids')).toHaveTextContent(EXAM_COPY.examNoAids);
    for (const aid of ['exam-points', 'exam-notice', 'exam-limits', 'exam-light', 'exam-parking', 'exam-kerb'])
      expect(screen.queryByTestId(aid)).not.toBeInTheDocument();
    expect(screen.queryByText(EXAM_COPY.faults)).not.toBeInTheDocument();
    expect(screen.queryByText(EXAM_COPY.reverseCm)).not.toBeInTheDocument();
    // What the examiner says stays: the phase prompt and the next turn.
    expect(screen.getByTestId('examiner-says')).toHaveTextContent(EXAM_COPY.phases.familiarisation);
    expect(screen.getByTestId('exam-instruction')).toHaveTextContent(EXAM_COPY.instruction('right', 'Av. Cabildo'));
    expect(screen.getByTestId('exam-leg')).toHaveTextContent(EXAM_COPY.leg(1, 'Quesada'));
  });

  it('shows the card per stage at the end and stores the attempt in the logbook', async () => {
    const store = createMemoryStore();
    await openExam('/examen?modo=rendir', store);

    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.requestStop }));
    runFrames(5);

    const card = screen.getByTestId('exam-card');
    expect(within(card).getByTestId('exam-result')).toHaveAttribute('data-result', 'disapproved');
    expect(within(card).getByTestId('exam-result')).toHaveTextContent(EXAM_COPY.verdicts.interruption);
    expect(within(card).getByTestId('exam-card-stage-I')).toHaveAttribute('data-completed', 'false');
    expect(within(card).getByTestId('exam-card-stage-I')).toHaveTextContent(EXAM_COPY.stageIncomplete);
    expect(within(card).getByTestId('exam-card-stage-II')).toHaveTextContent(EXAM_COPY.stageIncomplete);
    expect(within(card).getByTestId('exam-card-stage-III')).toHaveTextContent(EXAM_COPY.stageIncomplete);
    expect(within(card).getByTestId('exam-card-total')).toHaveTextContent(EXAM_COPY.total(0));
    expect(within(card).getByText(EXAM_COPY.approximationsHeading)).toBeInTheDocument();
    // The points appear once the exam is over, even in the exam mode.
    expect(screen.getByTestId('exam-points')).toHaveTextContent('0');
    await waitFor(() => expect(screen.getByTestId('exam-saved')).toHaveAttribute('data-save', 'saved'));

    const { snapshot } = await store.load();
    expect(snapshot.attempts).toHaveLength(1);
    expect(snapshot.attempts[0]).toMatchObject({
      kind: 'driving',
      mode: 'exam',
      subjectId: 'route.comuna13-a',
      result: { correct: false, points: 0 },
    });
    expect(snapshot.attempts[0]?.events.find((event) => event.type === 'interruption')?.payload).toEqual({
      cause: 'driver-request',
      ruleId: null,
    });
  });

  it('does not store the guided learning, and says so', async () => {
    const store = createMemoryStore();
    await openExam('/examen?modo=aprender', store);

    await userEvent.click(screen.getByRole('button', { name: EXAM_COPY.requestStop }));
    runFrames(5);

    expect(screen.getByTestId('exam-saved')).toHaveTextContent(EXAM_COPY.notSaved);
    expect((await store.load()).snapshot.attempts).toHaveLength(0);
  });

  it('practises stage III from leg 8 with the engine running, and stage I by default', async () => {
    const canvas = await openExam('/examen?modo=practicar&etapa=3');

    expect(screen.getByRole('radio', { name: EXAM_COPY.modes.practice })).toBeChecked();
    expect(screen.getByRole('combobox', { name: EXAM_COPY.stage })).toHaveValue('3');
    expect(screen.getByTestId('exam-stage-help')).toHaveTextContent(EXAM_COPY.practiceStart.III);
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'circulation');
    expect(screen.getByTestId('exam-leg')).toHaveTextContent(EXAM_COPY.leg(8, 'Vuelta de Obligado'));
    expect(canvas).toHaveAttribute('data-engine', 'running');

    fireEvent.change(screen.getByRole('combobox', { name: EXAM_COPY.stage }), { target: { value: '1' } });
    runFrames(5);

    expect(screen.getByTestId('exam-stage-help')).toHaveTextContent(EXAM_COPY.practiceStart.I);
    expect(screen.getByTestId('examiner-says')).toHaveAttribute('data-phase', 'familiarisation');
  });

  it('lists the stored drives in the logbook', async () => {
    const drive = createDrivingAttempt(
      {
        session: {
          ...createSession(REAL_RULES, 'manual', 1, null, []),
          phase: 'finished',
          timeS: 300,
          completedStages: ['I', 'II', 'III'],
          transitions: [
            { phase: 'familiarisation', atS: 0 },
            { phase: 'unlock', atS: 30 },
            { phase: 'parking', atS: 250 },
            { phase: 'finished', atS: 300 },
          ],
        },
        mode: 'run',
        subjectId: 'route.comuna13-a',
      },
      {
        id: 'drive-1',
        contentVersion: 'deadbeef',
        startedAt: '2026-10-12T10:00:00.000Z',
        finishedAt: '2026-10-12T10:05:00.000Z',
      },
    );
    renderApp('/bitacora', readyContent(content()), createMemoryStore({ attempts: [drive], concepts: [] }));

    const log = await screen.findByTestId('driving-log');
    const row = within(log).getByRole('listitem');
    expect(row).toHaveAttribute('data-mode', 'run');
    expect(row).toHaveAttribute('data-result', 'approved');
    expect(row).toHaveTextContent(LOGBOOK_COPY.drivingStages(['I', 'II', 'III']));
    expect(row).toHaveTextContent(LOGBOOK_COPY.drivingPoints(0));
    expect(row).toHaveTextContent(LOGBOOK_COPY.drivingResults.approved);
  });

  it('links the four modes from the home page', async () => {
    renderApp('/');

    const section = await screen.findByTestId('home-driving');
    for (const mode of DRIVING_MODES)
      expect(within(section).getByRole('link', { name: EXAM_COPY.homeModes[mode] })).toHaveAttribute(
        'href',
        `/examen?modo=${slugOfMode(mode)}`,
      );
    expect(within(section).getByRole('link', { name: TRACK_COPY.homeLink })).toHaveAttribute('href', '/pista');
    expect(within(section).getByRole('link', { name: CITY_COPY.homeLink })).toHaveAttribute('href', '/recorrido');
  });
});
