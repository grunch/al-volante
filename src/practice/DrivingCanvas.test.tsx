import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrivingCanvas } from './DrivingCanvas.tsx';
import type { Telemetry } from './DrivingCanvas.tsx';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';
import { createFakeRenderer } from '../test/fakeRenderer.ts';

const texts = { label: 'Pista 3D', loadingText: 'Cargando…', unavailableText: 'Sin WebGL' };

describe('DrivingCanvas', () => {
  let callbacks: FrameRequestCallback[];
  let clock: number;

  beforeEach(() => {
    callbacks = [];
    clock = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Runs `seconds` of frames at 60 Hz. */
  function runFrames(seconds: number) {
    for (let i = 0; i < Math.round(seconds * 60); i += 1) {
      const callback = callbacks.shift();
      clock += 1000 / 60;
      act(() => callback?.(clock));
    }
  }

  function renderCanvas(props: Partial<Parameters<typeof DrivingCanvas>[0]> = {}) {
    const renderer = createFakeRenderer();
    const utils = render(
      <DrivingCanvas
        world={PRACTICE_YARD}
        spec={EXAM_CAR}
        start={PRACTICE_YARD_START}
        createRenderer={() => renderer}
        {...texts}
        {...props}
      />,
    );
    return { ...utils, renderer, surface: screen.getByTestId('driving-canvas') };
  }

  it('drives forward while the accelerator key is held, and reports telemetry', () => {
    // Arrange
    const telemetry: Telemetry[] = [];
    const { surface, renderer } = renderCanvas({ onTelemetry: (value) => telemetry.push(value) });
    runFrames(0.1);

    // Act
    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    runFrames(2);

    // Assert
    expect(surface).toHaveAttribute('data-state', 'ready');
    expect(Number(surface.dataset.speedKmh)).toBeGreaterThan(5);
    expect(Number(surface.dataset.odometerM)).toBeGreaterThan(1);
    expect(telemetry.at(-1)?.speedKmh).toBeGreaterThan(5);
    expect(renderer.render).toHaveBeenCalled();
  });

  it('brakes to a stop, and only listens to keys while it has focus', () => {
    const { surface } = renderCanvas();
    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    runFrames(2);
    fireEvent.keyUp(surface, { code: 'ArrowUp' });
    fireEvent.keyDown(surface, { code: 'ArrowDown' });
    runFrames(3);

    expect(Number(surface.dataset.speedKmh)).toBe(0);

    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    fireEvent.blur(surface);
    runFrames(1);
    expect(Number(surface.dataset.speedKmh)).toBe(0);
  });

  it('switches to reverse with R and drives backwards', () => {
    const { surface } = renderCanvas();

    fireEvent.keyDown(surface, { code: 'KeyR' });
    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    runFrames(1);

    expect(surface).toHaveAttribute('data-reverse', 'true');
    expect(Number(surface.dataset.speedKmh)).toBeLessThan(0);
  });

  it('reports contacts and goes back to the start when asked', () => {
    // Arrange: start just short of the north wall.
    const telemetry: Telemetry[] = [];
    const start = { ...PRACTICE_YARD_START, z: 34 };
    const { surface, rerender, renderer } = renderCanvas({ start, onTelemetry: (value) => telemetry.push(value) });
    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    runFrames(3);

    // Act
    rerender(
      <DrivingCanvas
        world={PRACTICE_YARD}
        spec={EXAM_CAR}
        start={start}
        createRenderer={() => renderer}
        {...texts}
        resetCount={1}
      />,
    );
    fireEvent.keyUp(surface, { code: 'ArrowUp' });
    runFrames(0.1);

    // Assert
    expect(telemetry.some((value) => value.contact?.obstacleId === 'wall-north')).toBe(true);
    expect(Number(surface.dataset.odometerM)).toBe(0);
  });

  it('falls back to a message when WebGL cannot start', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <DrivingCanvas
        world={PRACTICE_YARD}
        spec={EXAM_CAR}
        start={PRACTICE_YARD_START}
        createRenderer={() => {
          throw new Error('no WebGL');
        }}
        {...texts}
      />,
    );
    runFrames(0.05);

    expect(screen.getByTestId('driving-canvas')).toHaveAttribute('data-state', 'unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('Sin WebGL');
  });
});
