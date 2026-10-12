import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrivingCanvas } from './DrivingCanvas.tsx';
import type { Telemetry } from './telemetry.ts';
import type { Observation } from '../exam/session.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { createFakeRenderer } from '../test/fakeRenderer.ts';

const texts = { label: 'Pista 3D', loadingText: 'Cargando…', unavailableText: 'Sin WebGL' };

describe('DrivingCanvas', () => {
  let callbacks: FrameRequestCallback[];
  let clock: number;

  beforeEach(() => {
    callbacks = [];
    clock = 0;
    localStorage.clear();
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

  function renderCanvas(
    transmission: TransmissionKind,
    extra: { start?: typeof PRACTICE_YARD_START; onTelemetry?: (value: Telemetry) => void } = {},
  ) {
    const renderer = createFakeRenderer();
    const props = {
      world: PRACTICE_YARD,
      start: extra.start ?? PRACTICE_YARD_START,
      transmission,
      createRenderer: () => renderer,
      ...texts,
    };
    const utils = render(
      <DrivingCanvas {...props} {...(extra.onTelemetry ? { onTelemetry: extra.onTelemetry } : {})} />,
    );
    const surface = screen.getByTestId('driving-canvas');
    runFrames(0.05);
    const press = (code: string) => {
      fireEvent.keyDown(surface, { code });
      runFrames(0.05);
    };
    return { ...utils, renderer, surface, press, props };
  }

  it('enters and exits fullscreen without restarting the driving session and reports unsupported browsers', async () => {
    const { surface, press } = renderCanvas('automatic');
    press('KeyK');
    press('KeyK');
    const shell = screen.getByRole('region', { name: 'Al volante' });
    const enter = vi.fn(async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: shell });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    const leave = vi.fn(async () => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null });
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    Object.defineProperty(shell, 'requestFullscreen', { configurable: true, value: enter });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: leave });
    try {
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' })));
      expect(enter).toHaveBeenCalledOnce();
      expect(surface).toHaveFocus();
      runFrames(0.1);
      expect(surface).toHaveAttribute('data-engine', 'running');
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Salir de pantalla completa' })));
      expect(leave).toHaveBeenCalledOnce();
      Object.defineProperty(shell, 'requestFullscreen', { value: undefined });
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa' })));
      expect(screen.getByText(/Este navegador no pudo abrir la pantalla completa/)).toHaveAttribute('role', 'status');
    } finally {
      Reflect.deleteProperty(document, 'fullscreenElement');
      Reflect.deleteProperty(document, 'exitFullscreen');
    }
  });

  it('starts the automatic, selects D and creeps forward when the brake is released', () => {
    // Arrange
    const telemetry: Telemetry[] = [];
    const { surface, press } = renderCanvas('automatic', { onTelemetry: (value) => telemetry.push(value) });

    // Act: key in contact and start, brake held while the lever goes P → R → N → D, handbrake off, brake released.
    press('KeyK');
    press('KeyK');
    fireEvent.keyDown(surface, { code: 'ArrowDown' });
    runFrames(0.5);
    press('KeyE');
    press('KeyE');
    press('KeyE');
    press('Space');
    fireEvent.keyUp(surface, { code: 'ArrowDown' });
    runFrames(3);

    // Assert
    expect(surface).toHaveAttribute('data-engine', 'running');
    expect(surface).toHaveAttribute('data-gear', 'D1');
    expect(Number(surface.dataset.odometerM)).toBeGreaterThan(0.5);
    expect(telemetry.some((value) => value.lastEvent?.type === 'engine-started')).toBe(true);
  });

  it('stalls the manual when the clutch comes up in first without throttle, and reports it', () => {
    const telemetry: Telemetry[] = [];
    const { surface, press } = renderCanvas('manual', { onTelemetry: (value) => telemetry.push(value) });

    // The clutch takes a quarter of a second to reach the floor; gears only go in once it is down.
    fireEvent.keyDown(surface, { code: 'ShiftLeft' });
    runFrames(0.3);
    press('KeyK');
    press('KeyK');
    press('KeyE');
    press('Space');
    fireEvent.keyUp(surface, { code: 'ShiftLeft' });
    runFrames(3);

    expect(surface).toHaveAttribute('data-engine', 'off');
    expect(telemetry.at(-1)?.lastEvent?.type).toBe('stall');
  });

  it('pulls the manual away with throttle while the clutch comes up', () => {
    const { surface, press } = renderCanvas('manual');

    // The clutch takes a quarter of a second to reach the floor; gears only go in once it is down.
    fireEvent.keyDown(surface, { code: 'ShiftLeft' });
    runFrames(0.3);
    press('KeyK');
    press('KeyK');
    press('KeyE');
    press('Space');
    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    fireEvent.keyUp(surface, { code: 'ShiftLeft' });
    runFrames(3);

    expect(surface).toHaveAttribute('data-engine', 'running');
    expect(surface).toHaveAttribute('data-gear', '1');
    expect(Number(surface.dataset.odometerM)).toBeGreaterThan(1);
  });

  it('refuses a gear without the clutch, and releases every key when the view loses focus', () => {
    const telemetry: Telemetry[] = [];
    const { surface, press } = renderCanvas('manual', { onTelemetry: (value) => telemetry.push(value) });

    press('KeyE');
    expect(telemetry.at(-1)?.lastEvent).toMatchObject({ type: 'shift-refused', reason: 'clutch' });

    fireEvent.keyDown(surface, { code: 'ShiftLeft' });
    fireEvent.blur(surface);
    runFrames(0.1);
    press('KeyE');
    expect(surface).toHaveAttribute('data-gear', 'N');
  });

  it('reports contacts and goes back to the start, key out, when asked', () => {
    // Arrange: automatic, a few metres short of the north wall.
    const telemetry: Telemetry[] = [];
    const start = { ...PRACTICE_YARD_START, z: 34 };
    const { surface, press, rerender, props } = renderCanvas('automatic', {
      start,
      onTelemetry: (value) => telemetry.push(value),
    });
    press('KeyK');
    press('KeyK');
    fireEvent.keyDown(surface, { code: 'ArrowDown' });
    runFrames(0.5);
    press('KeyE');
    press('KeyE');
    press('KeyE');
    press('Space');
    fireEvent.keyUp(surface, { code: 'ArrowDown' });
    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    runFrames(4);

    // Act
    rerender(<DrivingCanvas {...props} resetCount={1} />);
    fireEvent.keyUp(surface, { code: 'ArrowUp' });
    runFrames(0.1);

    // Assert
    expect(telemetry.some((value) => value.lastEvent?.type === 'contact')).toBe(true);
    expect(Number(surface.dataset.odometerM)).toBe(0);
    expect(surface).toHaveAttribute('data-engine', 'off');
  });

  it('releases every key when the window loses focus, so the car never keeps accelerating unattended', () => {
    // Arrange: automatic in D, accelerating.
    const { surface, press } = renderCanvas('automatic');
    press('KeyK');
    press('KeyK');
    fireEvent.keyDown(surface, { code: 'ArrowDown' });
    runFrames(0.5);
    press('KeyE');
    press('KeyE');
    press('KeyE');
    press('Space');
    fireEvent.keyUp(surface, { code: 'ArrowDown' });
    fireEvent.keyDown(surface, { code: 'ArrowUp' });
    runFrames(2);
    expect(Number(surface.dataset.speedKmh)).toBeGreaterThan(10);

    // Act: the accelerator takes a third of a second to come up once the keys are released.
    fireEvent.blur(window);
    runFrames(0.5);
    const released = Number(surface.dataset.speedKmh);
    runFrames(2);

    // Assert: from then on only engine braking and rolling act, so the car slows down.
    expect(Number(surface.dataset.speedKmh)).toBeLessThan(released);
  });

  it('falls back to a message when WebGL cannot start', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <DrivingCanvas
        world={PRACTICE_YARD}
        start={PRACTICE_YARD_START}
        transmission="manual"
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
  it('operates cabin switches and returns observations to the front', () => {
    const { surface, press } = renderCanvas('manual');
    press('KeyC');
    expect(screen.getByText('Cinturón abrochado')).toBeVisible();
    press('KeyJ');
    expect(surface).toHaveAttribute('data-look-yaw', '1.3');
    press('KeyL');
    expect(surface).toHaveAttribute('data-look-yaw', '-1.3');
    press('KeyB');
    expect(surface).toHaveAttribute('data-look-yaw', '2.35');
    press('KeyI');
    expect(surface).toHaveAttribute('data-look-yaw', '0');
    press('KeyH');
    expect(screen.getByText(/Bocina activada/)).toBeVisible();
    fireEvent.blur(window);
    expect(screen.queryByText(/Bocina activada/)).not.toBeInTheDocument();
    for (const code of ['KeyO', 'KeyZ', 'KeyX', 'KeyV', 'KeyF']) press(code);
    expect(screen.getByRole('button', { name: /Balizas/, pressed: true })).toHaveAttribute('aria-pressed', 'true');
  });

  it('applies the examiner’s brake from the step after the takeover, without waiting for a render', () => {
    // Arrange: the takeover is decided by the observer itself, as the exam page does with its session ref.
    let takenOver = false;
    const brakes: number[] = [];
    let lastSpeed = -1;
    let takenAt = -1;
    const onObservation = (observation: Observation) => {
      if (observation.type !== 'step' || observation.dt === 0) return;
      brakes.push(observation.car.controls.brake);
      lastSpeed = observation.car.world.vehicle.speedMps;
      if (!takenOver && observation.car.world.vehicle.speedMps > 0.3) {
        takenOver = true;
        takenAt = brakes.length - 1;
      }
    };
    render(
      <DrivingCanvas
        world={PRACTICE_YARD}
        start={PRACTICE_YARD_START}
        transmission="automatic"
        createRenderer={() => createFakeRenderer()}
        onObservation={onObservation}
        halted={() => takenOver}
        {...texts}
      />,
    );
    const surface = screen.getByTestId('driving-canvas');
    runFrames(0.05);
    const press = (code: string) => {
      fireEvent.keyDown(surface, { code });
      runFrames(0.05);
    };

    // Act: start, D, brake released; the car creeps until the observer takes over within the same frame.
    press('KeyK');
    press('KeyK');
    fireEvent.keyDown(surface, { code: 'ArrowDown' });
    runFrames(0.5);
    press('KeyE');
    press('KeyE');
    press('KeyE');
    press('Space');
    fireEvent.keyUp(surface, { code: 'ArrowDown' });
    runFrames(3);

    // Assert: the brake rises on the very next simulation step and the car ends stopped.
    expect(takenAt).toBeGreaterThan(0);
    expect(brakes[takenAt]).toBe(0);
    expect(brakes[takenAt + 1]).toBeGreaterThan(0);
    expect(lastSpeed).toBe(0);
  });

  it('allows keyboard pedals outside the canvas and releases them on blur', () => {
    const { surface } = renderCanvas('manual');
    const key = screen.getByRole('button', { name: 'Accionar llave' });
    fireEvent.click(key);
    runFrames(0.1);
    fireEvent.click(key);
    runFrames(0.1);
    const throttle = screen.getByRole('button', { name: 'Acelerar' });
    fireEvent.keyDown(throttle, { code: 'Space' });
    runFrames(1);
    const rpm = Number(surface.dataset.rpm);
    expect(rpm).toBeGreaterThan(1000);
    fireEvent.blur(throttle);
    runFrames(2);
    expect(Number(surface.dataset.rpm)).toBeLessThan(rpm);
  });
  it('renders a horn tap released between frames and clears it on the following frame', () => {
    renderCanvas('manual');
    vi.stubGlobal('PointerEvent', MouseEvent);
    const horn = screen.getByRole('button', { name: 'Bocina' });
    horn.setPointerCapture = vi.fn();

    fireEvent.pointerDown(horn, { button: 0 });
    fireEvent.pointerUp(horn, { button: 0 });
    runFrames(1 / 60);

    expect(screen.getByText(/Bocina activada/)).toBeVisible();
    runFrames(1 / 60);
    expect(screen.queryByText(/Bocina activada/)).not.toBeInTheDocument();
  });

  it('discards an unsampled tap when the window loses focus', () => {
    const { surface } = renderCanvas('manual');
    fireEvent.keyDown(surface, { code: 'KeyH' });
    fireEvent.keyUp(surface, { code: 'KeyH' });
    fireEvent.blur(window);
    runFrames(1 / 60);
    expect(screen.queryByText(/Bocina activada/)).not.toBeInTheDocument();
  });
  it('accepts a semantic click without pointer or keyboard events', () => {
    renderCanvas('manual');
    const horn = screen.getByRole('button', { name: 'Bocina' });

    fireEvent.click(horn, { detail: 0 });
    runFrames(1 / 60);

    expect(screen.getByText(/Bocina activada/)).toBeVisible();
    runFrames(1 / 60);
    expect(screen.queryByText(/Bocina activada/)).not.toBeInTheDocument();
  });

  it('does not add a pulse for the click following a pointer activation', () => {
    renderCanvas('manual');
    vi.stubGlobal('PointerEvent', MouseEvent);
    const horn = screen.getByRole('button', { name: 'Bocina' });
    horn.setPointerCapture = vi.fn();
    fireEvent.pointerDown(horn, { button: 0 });
    runFrames(1 / 60);
    expect(screen.getByText(/Bocina activada/)).toBeVisible();

    fireEvent.pointerUp(horn, { button: 0 });
    fireEvent.click(horn, { detail: 1 });
    runFrames(1 / 60);

    expect(screen.queryByText(/Bocina activada/)).not.toBeInTheDocument();
  });
});
