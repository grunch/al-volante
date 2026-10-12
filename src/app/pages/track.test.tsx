import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/renderApp.tsx';
import { TRACK_COPY, esAR } from '../../i18n/es-AR.ts';

describe('practice yard page', () => {
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

  it('starts in stage I (key out, engine off, handbrake on) and shows the key and engine as they change', async () => {
    // Arrange
    renderApp('/pista');
    const canvas = await screen.findByRole('application', { name: TRACK_COPY.canvasLabel });
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
    renderApp('/pista');
    await screen.findByRole('application', { name: TRACK_COPY.canvasLabel });
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

  it('is linked from the home page', async () => {
    renderApp('/');

    const main = within(await screen.findByRole('main'));
    expect(main.getByRole('link', { name: TRACK_COPY.homeLink })).toHaveAttribute('href', '/pista');
    expect(screen.getByRole('heading', { level: 1, name: esAR.garageHeading })).toBeInTheDocument();
  });
});
