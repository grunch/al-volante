import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter } from 'react-router';
import { App } from '../App.tsx';
import { routes } from '../routes.tsx';
import { readyContent, renderApp } from '../../test/renderApp.tsx';
import { TRACK_COPY, esAR } from '../../i18n/es-AR.ts';
import { describeEvent } from '../../practice/telemetry.ts';

// The driving view loads lazily: with other suites running beside it, the first mount can take seconds.
describe('practice yard page', { timeout: 30000 }, () => {
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

  const readout = (label: string) => screen.getByText(label).nextElementSibling;

  /** Opens the yard and waits for the driving loop: lazy markup can precede the effect that listens to the keys. */
  async function openYard() {
    renderApp('/pista');
    const canvas = await screen.findByRole('application', { name: TRACK_COPY.canvasLabel }, { timeout: 15000 });
    await waitFor(() => {
      runFrames(1);
      expect(canvas).toHaveAttribute('data-state', 'ready');
    });
    return canvas;
  }

  it('starts in stage I (key out, engine off, handbrake on) and shows the key and engine as they change', async () => {
    // Arrange
    const canvas = await openYard();
    runFrames(10);
    expect(readout(TRACK_COPY.key)).toHaveTextContent(TRACK_COPY.keyStates.removed);
    expect(readout(TRACK_COPY.handbrake)).toHaveTextContent(TRACK_COPY.handbrakeOn);
    expect(readout(TRACK_COPY.engine)).toHaveTextContent(TRACK_COPY.engineOff);

    // Act: key in contact, then start in neutral.
    fireEvent.keyDown(canvas, { code: 'KeyK' });
    runFrames(10);
    fireEvent.keyDown(canvas, { code: 'KeyK' });
    runFrames(10);

    // Assert
    expect(readout(TRACK_COPY.key)).toHaveTextContent(TRACK_COPY.keyStates.on);
    expect(readout(TRACK_COPY.engine)).toHaveTextContent('rpm');
    expect(screen.getByText(TRACK_COPY.events['engine-started'])).toHaveAttribute('role', 'status');
  });

  it('switches between manual and automatic, with the controls of each, and goes back to the start', async () => {
    const user = userEvent.setup({ advanceTimers: () => undefined });
    await openYard();
    expect(screen.getByText(TRACK_COPY.controls.manual[0])).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: TRACK_COPY.automatic }));
    runFrames(5);

    expect(screen.getByText(TRACK_COPY.controls.automatic[0])).toBeInTheDocument();
    expect(screen.queryByText(TRACK_COPY.controls.manual[0])).not.toBeInTheDocument();
    expect(readout(TRACK_COPY.gear)).toHaveTextContent('P');
    await user.click(screen.getByRole('button', { name: TRACK_COPY.reset }));
    runFrames(2);
    expect(readout(TRACK_COPY.distance)).toHaveTextContent('0,0 m');
  });

  it('says what the handbrake and a refused shift did, as they happen', async () => {
    // Arrange: manual, in neutral, handbrake on.
    const canvas = await openYard();

    // Act / Assert: Space releases the handbrake.
    fireEvent.keyDown(canvas, { code: 'Space' });
    runFrames(5);
    expect(screen.getByText(TRACK_COPY.events.handbrakeOff)).toHaveAttribute('role', 'status');
    expect(readout(TRACK_COPY.handbrake)).toHaveTextContent(TRACK_COPY.handbrakeOff);

    // A gear without the clutch is refused, and the yard says why.
    fireEvent.keyDown(canvas, { code: 'KeyE' });
    runFrames(5);
    expect(screen.getByText(TRACK_COPY.events.shiftClutch)).toHaveAttribute('role', 'status');
    expect(readout(TRACK_COPY.gear)).toHaveTextContent('N');
  });

  it('says the yard is unavailable where WebGL is missing, and keeps the rest of the page', async () => {
    // Arrange: the real renderer factory, which jsdom cannot serve.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const router = createMemoryRouter(routes, { initialEntries: ['/pista'] });

    // Act
    render(<App router={router} loadContent={readyContent()} />);

    // Assert
    await waitFor(
      () => {
        runFrames(1);
        expect(screen.getByText(TRACK_COPY.unavailable)).toBeInTheDocument();
      },
      { timeout: 15000 },
    );
    expect(screen.queryByRole('application', { name: TRACK_COPY.canvasLabel })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: TRACK_COPY.heading })).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('is linked from the home page', async () => {
    renderApp('/');

    const main = within(await screen.findByRole('main'));
    expect(main.getByRole('link', { name: TRACK_COPY.homeLink })).toHaveAttribute('href', '/pista');
    expect(screen.getByRole('heading', { level: 1, name: esAR.garageHeading })).toBeInTheDocument();
  });
});

describe('practice yard feedback for each event', () => {
  const { events } = TRACK_COPY;

  it('names what the car touched', () => {
    expect(describeEvent({ type: 'contact', obstacleId: 'kerb', kind: 'curb', impactSpeedMps: 1 }, 'manual')).toBe(
      TRACK_COPY.contact(TRACK_COPY.obstacleNames.curb),
    );
  });

  it('explains a refused start by its reason and gearbox, and never asks for neutral with the engine running', () => {
    expect(describeEvent({ type: 'start-refused', reason: 'key' }, 'manual')).toBe(events.startKey);
    expect(describeEvent({ type: 'start-refused', reason: 'in-gear' }, 'manual')).toBe(events.startInGearManual);
    expect(describeEvent({ type: 'start-refused', reason: 'in-gear' }, 'automatic')).toBe(events.startInGearAutomatic);
    expect(describeEvent({ type: 'start-refused', reason: 'running' }, 'manual')).toBe(events.startRunning);
    expect(describeEvent({ type: 'start-refused', reason: 'running' }, 'automatic')).toBe(events.startRunning);
  });

  it('explains a refused shift by its reason, and only blames the movement when the car moves', () => {
    expect(describeEvent({ type: 'shift-refused', to: '1', reason: 'clutch' }, 'manual')).toBe(events.shiftClutch);
    expect(describeEvent({ type: 'shift-refused', to: 'R', reason: 'brake' }, 'automatic')).toBe(events.shiftBrake);
    expect(describeEvent({ type: 'shift-refused', to: 'R', reason: 'moving' }, 'manual')).toBe(events.shiftMoving);
    expect(describeEvent({ type: 'shift-refused', to: '6', reason: 'invalid' }, 'manual')).toBe(events.shiftInvalid);
  });

  it('reports the handbrake, the engine and the key, and stays silent on routine events', () => {
    expect(describeEvent({ type: 'handbrake', engaged: true }, 'manual')).toBe(events.handbrakeOn);
    expect(describeEvent({ type: 'handbrake', engaged: false }, 'manual')).toBe(events.handbrakeOff);
    for (const type of [
      'engine-started',
      'engine-stopped',
      'stall',
      'moved-with-handbrake',
      'key-removed',
      'key-refused',
    ] as const)
      expect(describeEvent({ type }, 'manual')).toBe(events[type]);
    expect(describeEvent({ type: 'gear-engaged', gear: '1' }, 'manual')).toBe('');
    expect(describeEvent({ type: 'key-inserted' }, 'manual')).toBe('');
  });
});
