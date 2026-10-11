import { act, fireEvent, screen } from '@testing-library/react';
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

  it('explains the controls, shows speed and distance, and goes back to the start', async () => {
    // Arrange
    renderApp('/pista');
    const canvas = await screen.findByRole('application', { name: TRACK_COPY.canvasLabel });

    // Act
    fireEvent.keyDown(canvas, { code: 'ArrowUp' });
    runFrames(120);

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: TRACK_COPY.heading })).toBeInTheDocument();
    expect(screen.getByText(TRACK_COPY.controls[1])).toBeInTheDocument();
    expect(screen.getByText(TRACK_COPY.speed).nextElementSibling?.textContent).not.toBe('0 km/h');
    fireEvent.click(screen.getByRole('button', { name: TRACK_COPY.reset }));
    runFrames(2);
    expect(screen.getByText(TRACK_COPY.distance).nextElementSibling).toHaveTextContent('0,0 m');
  });

  it('is linked from the home page', async () => {
    renderApp('/');

    expect(await screen.findByRole('link', { name: TRACK_COPY.homeLink })).toHaveAttribute('href', '/pista');
    expect(screen.getByRole('heading', { level: 1, name: esAR.garageHeading })).toBeInTheDocument();
  });
});
