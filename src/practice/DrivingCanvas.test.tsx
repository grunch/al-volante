import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DrivingCanvas } from './DrivingCanvas.tsx';
import { BINDINGS_STORAGE_KEY, DEFAULT_BINDINGS } from './bindings.ts';
import type { Bindings } from './bindings.ts';
import type { Telemetry } from './telemetry.ts';
import type { CockpitCommand } from './cockpit.ts';
import { AUDIO_STORAGE_KEY } from '../audio/session.ts';
import type { Observation } from '../exam/session.ts';
import { FIRST_BLOCK, FIRST_BLOCK_START } from '../sim/tracks/firstBlock.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { fakeAudio } from '../test/fakeAudio.ts';
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

  function renderCanvas(transmission: TransmissionKind, extra: Partial<ComponentProps<typeof DrivingCanvas>> = {}) {
    const renderer = createFakeRenderer();
    const props = {
      world: PRACTICE_YARD,
      start: PRACTICE_YARD_START,
      transmission,
      createRenderer: () => renderer,
      ...texts,
      ...extra,
    };
    const utils = render(<DrivingCanvas {...props} />);
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
    expect(screen.getByText('Sin WebGL')).toHaveAttribute('role', 'status');
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

  it('reports the prepared commands before the first step, with the restored cabin after a reset', () => {
    // Arrange: the exam's prepared key, and a belt fastened before the reset.
    const observations: Observation[] = [];
    const prepared = [{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }] as const;
    const { press, rerender, props } = renderCanvas('manual', {
      prepared,
      onObservation: (observation) => observations.push(observation),
    });
    const first = observations[0];
    press('KeyC');
    observations.length = 0;

    // Act
    rerender(<DrivingCanvas {...props} resetCount={1} />);
    runFrames(1 / 60);

    // Assert: the prepared key is reported at once, and after the reset with the cabin as it now is.
    expect(first).toMatchObject({ type: 'step', dt: 0, events: [{ type: 'key-inserted' }] });
    expect(first?.type === 'step' && first.car.powertrain.key).toBe('on');
    const afterReset = observations[0];
    expect(afterReset).toMatchObject({ type: 'step', dt: 0, events: [{ type: 'key-inserted' }] });
    expect(afterReset?.type === 'step' && afterReset.cockpit.belt).toBe(false);
  });

  it('starts and resets with the prepared cabin, and reports it with the prepared commands', () => {
    // Arrange: a stage practised on its own arrives belted with the low beams on.
    const observations: Observation[] = [];
    const preparedCabin = [
      { type: 'toggle', control: 'belt' },
      { type: 'lights', value: 'low' },
    ] as const;
    const { press, rerender, props } = renderCanvas('manual', {
      prepared: [{ type: 'insert-key' }],
      preparedCabin,
      onObservation: (observation) => observations.push(observation),
    });
    press('KeyC');
    observations.length = 0;

    // Act
    rerender(<DrivingCanvas {...props} resetCount={1} />);
    runFrames(1 / 60);

    // Assert
    const afterReset = observations[0];
    expect(afterReset?.type === 'step' && afterReset.cockpit).toMatchObject({ belt: true, lights: 'low' });
    expect(screen.getByText('Cinturón abrochado')).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Iluminación' })).toHaveValue('low');
  });

  it('starts a new world (another seed) from the prepared cabin, not from the cabin of the previous session', () => {
    // Arrange: the driver unbuckles; then the page changes the seed, which brings a new world and a reset together.
    const observations: Observation[] = [];
    const preparedCabin = [
      { type: 'toggle', control: 'belt' },
      { type: 'lights', value: 'low' },
    ] as const;
    const { press, rerender, props } = renderCanvas('manual', {
      prepared: [{ type: 'insert-key' }],
      preparedCabin,
      onObservation: (observation) => observations.push(observation),
    });
    press('KeyC');
    observations.length = 0;

    // Act
    rerender(<DrivingCanvas {...props} world={{ ...props.world }} resetCount={1} />);
    runFrames(1 / 60);

    // Assert
    const first = observations[0];
    expect(first?.type === 'step' && first.cockpit).toMatchObject({ belt: true, lights: 'low' });
    expect(screen.getByText('Cinturón abrochado')).toBeVisible();
  });

  it('leaves shortcuts with Ctrl, Alt or Meta and unbound keys to the browser', () => {
    // Arrange
    const telemetry: Telemetry[] = [];
    const { surface, press } = renderCanvas('manual', { onTelemetry: (value) => telemetry.push(value) });

    // Act
    const ignored = [
      fireEvent.keyDown(surface, { code: 'KeyK', ctrlKey: true }),
      fireEvent.keyDown(surface, { code: 'KeyK', altKey: true }),
      fireEvent.keyDown(surface, { code: 'KeyK', metaKey: true }),
      fireEvent.keyDown(surface, { code: 'KeyT' }),
    ];
    runFrames(0.2);
    const keyBefore = telemetry.at(-1)?.powertrain.key;
    press('KeyK');
    runFrames(0.2);

    // Assert: none was prevented nor reached the car; the bare key works.
    expect(ignored).toEqual([true, true, true, true]);
    expect(keyBefore).toBe('removed');
    expect(telemetry.at(-1)?.powertrain.key).toBe('on');
  });

  it('ignores auto-repeated presses, so holding the key button does not run the whole key cycle', () => {
    // Arrange
    const telemetry: Telemetry[] = [];
    const { surface } = renderCanvas('manual', { onTelemetry: (value) => telemetry.push(value) });

    // Act: one press held long enough for the keyboard to repeat it.
    fireEvent.keyDown(surface, { code: 'KeyK' });
    const repeated = [1, 2, 3].map(() => fireEvent.keyDown(surface, { code: 'KeyK', repeat: true }));
    const releasedBound = fireEvent.keyUp(surface, { code: 'KeyK' });
    const releasedUnbound = fireEvent.keyUp(surface, { code: 'KeyT' });
    runFrames(0.2);

    // Assert: the repeats are swallowed and only the first press acted (key in contact, engine still off).
    expect(repeated).toEqual([false, false, false]);
    expect(releasedBound).toBe(false);
    expect(releasedUnbound).toBe(true);
    expect(telemetry.at(-1)?.powertrain).toMatchObject({ key: 'on', engineRunning: false });
  });

  it('glances at the mirrors, cycles the lights and switches a turn signal off with its own key', () => {
    const { surface, press } = renderCanvas('manual');
    const lights = screen.getByRole('combobox', { name: 'Iluminación' });
    const leftSignal = screen.getByRole('button', { name: 'Giro izquierdo' });

    press('KeyU');
    expect(surface).toHaveAttribute('data-look-yaw', '0.5');
    press('KeyP');
    expect(surface).toHaveAttribute('data-look-yaw', '-0.5');
    const cycle: string[] = [];
    for (let i = 0; i < 4; i += 1) {
      press('KeyO');
      cycle.push((lights as HTMLSelectElement).value);
    }
    expect(cycle).toEqual(['position', 'low', 'high', 'off']);
    press('KeyZ');
    expect(leftSignal).toHaveAttribute('aria-pressed', 'true');
    press('KeyZ');
    expect(leftSignal).toHaveAttribute('aria-pressed', 'false');
  });

  it('looks around while the primary pointer drags on the windscreen, and stops when it lets go', () => {
    // Arrange: pointers with ids, which jsdom does not provide.
    class FakePointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    vi.stubGlobal('PointerEvent', FakePointerEvent);
    const looks: CockpitCommand[] = [];
    const { surface } = renderCanvas('manual', {
      onObservation: (observation) => {
        if (observation.type === 'cockpit' && observation.command.type === 'look') looks.push(observation.command);
      },
    });
    surface.setPointerCapture = vi.fn();
    const drag = (end: () => void) => {
      fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
      end();
      fireEvent.pointerMove(surface, { pointerId: 1, clientX: 300, clientY: 100 });
    };

    // Act
    fireEvent.pointerDown(surface, { button: 2, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 300, clientY: 100 });
    fireEvent.pointerDown(surface, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(surface, { pointerId: 2, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 150, clientY: 130 });
    fireEvent.pointerUp(surface, { pointerId: 1 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 300, clientY: 100 });
    drag(() => fireEvent.pointerCancel(surface, { pointerId: 1 }));
    drag(() => fireEvent.lostPointerCapture(surface, { pointerId: 1 }));

    // Assert: only the primary pointer's own moves turn the head (50 px right and 30 px down).
    expect(surface).toHaveFocus();
    expect(surface.setPointerCapture).toHaveBeenCalledTimes(3);
    expect(looks).toHaveLength(1);
    expect(looks[0]).toMatchObject({ type: 'look' });
    const [look] = looks as Extract<CockpitCommand, { type: 'look' }>[];
    expect(look?.yaw).toBeCloseTo(-0.3, 6);
    expect(look?.pitch).toBeCloseTo(0.18, 6);
    expect(surface).toHaveAttribute('data-look-yaw', String(look?.yaw));
  });

  it('sizes the renderer to the view at no more than twice the pixel ratio, following ResizeObserver', () => {
    // Arrange
    let notify: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
    vi.stubGlobal('devicePixelRatio', 3);
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);

    // Act
    const { renderer, unmount } = renderCanvas('manual');
    width.mockReturnValue(800);
    act(() => notify?.());
    unmount();

    // Assert
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize.mock.calls).toEqual([
      [640, 360, false],
      [800, 360, false],
    ]);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it('follows window resizes without ResizeObserver, skipping a view that has no size yet', () => {
    // Arrange
    vi.stubGlobal('ResizeObserver', undefined);
    vi.stubGlobal('devicePixelRatio', 0);
    const { renderer, unmount } = renderCanvas('manual');
    const unsized = renderer.setSize.mock.calls.length;

    // Act
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(320);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
    act(() => window.dispatchEvent(new Event('resize')));
    unmount();
    window.dispatchEvent(new Event('resize'));

    // Assert: a missing pixel ratio counts as 1, and the listener goes with the view.
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(1);
    expect(unsized).toBe(0);
    expect(renderer.setSize.mock.calls).toEqual([[320, 240, false]]);
  });

  it('shows the moving actors of a world with traffic', () => {
    // The pedestrian steps off the kerb once the car is 30 m from the stop line.
    renderCanvas('automatic', { world: FIRST_BLOCK, start: { ...FIRST_BLOCK_START, z: 100 } });

    expect(screen.getByTestId('driving-canvas')).toHaveAttribute('data-actors', '1');
  });

  it('falls back to the unavailable message when the default WebGL renderer cannot start', () => {
    // jsdom has no WebGL: the real renderer cannot get a context.
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<DrivingCanvas world={PRACTICE_YARD} start={PRACTICE_YARD_START} transmission="manual" {...texts} />);
    runFrames(0.05);

    expect(screen.getByTestId('driving-canvas')).toHaveAttribute('data-state', 'unavailable');
    expect(console.warn).toHaveBeenCalledWith('WebGL renderer could not be created', expect.any(Error));
  });
});

describe('DrivingCanvas audio and key settings', () => {
  let callbacks: FrameRequestCallback[];

  beforeEach(() => {
    callbacks = [];
    localStorage.clear();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderReady(extra: Partial<ComponentProps<typeof DrivingCanvas>> = {}) {
    const utils = render(
      <DrivingCanvas
        world={PRACTICE_YARD}
        start={PRACTICE_YARD_START}
        transmission="manual"
        createRenderer={() => createFakeRenderer()}
        {...texts}
        {...extra}
      />,
    );
    act(() => callbacks.shift()?.(0));
    return utils;
  }

  it('mutes, unmutes and sets the volume, starting the sound with the gesture and saving the choice', async () => {
    // Arrange
    const { context, calls, nodes } = fakeAudio();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return context;
      }),
    );
    renderReady();
    const sound = screen.getByRole('group', { name: 'Sonido de conducción' });
    const masterVolume = () => nodes[0]?.gain.setTargetAtTime.mock.lastCall?.[0];

    // Act and assert: the first click is the gesture that starts the audio, silent while muted.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Silenciar' })));
    expect(screen.getByRole('button', { name: 'Activar sonido' })).toHaveAttribute('aria-pressed', 'true');
    expect(sound).toHaveTextContent('Audio silenciado.');
    expect(masterVolume()).toBe(0);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Activar sonido' })));
    expect(masterVolume()).toBe(0.45);
    await act(async () =>
      fireEvent.change(screen.getByRole('slider', { name: 'Volumen' }), { target: { value: '70' } }),
    );
    expect(masterVolume()).toBe(0.7);
    expect(calls.resume).toHaveBeenCalledOnce();
    expect(sound).toHaveTextContent('Audio de motor y tránsito activo.');
    expect(screen.getByRole('slider', { name: 'Volumen' })).toHaveValue('70');
    expect(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY) ?? 'null')).toEqual({ muted: false, volume: 0.7 });
  });

  it('keeps the chosen volume when it cannot be saved, and says so', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    renderReady();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Silenciar' })));

    expect(screen.getByText('El volumen funciona, pero no se pudo guardar la preferencia.')).toHaveAttribute(
      'role',
      'status',
    );
  });

  it('rebinds a command from the panel, drives with the new key, saves it and tells the page', () => {
    // Arrange
    const seen: Bindings[] = [];
    renderReady({ onBindingsChange: (bindings) => seen.push(bindings) });
    const surface = screen.getByTestId('driving-canvas');
    fireEvent.click(screen.getByText('Configurar teclado'));
    const keyBinding = screen.getByRole('button', { name: /^Accionar llave\s?K$/ });

    // Act: bind Digit1, then a conflicting key on another command.
    fireEvent.click(keyBinding);
    fireEvent.keyDown(keyBinding, { code: 'Digit1' });
    const doorBinding = screen.getByRole('button', { name: /^Abrir la puerta y bajar\s?G$/ });
    fireEvent.click(doorBinding);
    fireEvent.keyDown(doorBinding, { code: 'Digit1' });
    fireEvent.keyDown(surface, { code: 'Digit1' });
    fireEvent.keyDown(surface, { code: 'Digit1' });
    act(() => callbacks.shift()?.(1000 / 60));

    // Assert
    const saved = JSON.parse(localStorage.getItem(BINDINGS_STORAGE_KEY) ?? 'null') as Bindings;
    expect(saved.key).toEqual(['Digit1']);
    expect(seen.at(0)).toEqual(DEFAULT_BINDINGS);
    expect(seen.at(-1)?.key).toEqual(['Digit1']);
    expect(screen.getByText('Esa tecla está ocupada o reservada. Probá otra.')).toBeInTheDocument();
    expect(surface).toHaveAttribute('data-engine', 'running');
  });

  it('restores the default keys from the panel', () => {
    localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_BINDINGS, key: ['Digit1'] }));
    renderReady();
    fireEvent.click(screen.getByText('Configurar teclado'));
    expect(screen.getByRole('button', { name: /^Accionar llave\s?1$/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar teclas' }));

    expect(screen.getByRole('button', { name: /^Accionar llave\s?K$/ })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(BINDINGS_STORAGE_KEY) ?? 'null')).toEqual(DEFAULT_BINDINGS);
  });

  it('drives with the default keys when the saved ones cannot be read or saved', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    renderReady();
    fireEvent.click(screen.getByText('Configurar teclado'));
    const keyBinding = screen.getByRole('button', { name: /^Accionar llave\s?K$/ });

    fireEvent.click(keyBinding);
    fireEvent.keyDown(keyBinding, { code: 'Digit1' });

    expect(screen.getByRole('button', { name: /^Accionar llave\s?1$/ })).toBeInTheDocument();
    expect(
      screen.getByText('No se pudo guardar el teclado en este navegador. Los cambios funcionan durante esta sesión.'),
    ).toHaveAttribute('role', 'status');
  });
});
