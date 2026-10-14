import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DrivingCanvas } from './DrivingCanvas.tsx';
import { createFakeRenderer } from '../test/fakeRenderer.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';
import type { GravityReading } from './tilt.ts';

const motion = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  reading: (reading: GravityReading) => {
    void reading;
  },
}));
vi.mock('./motionSensor.ts', () => ({
  MotionSensor: class {
    start = motion.start;
    stop = motion.stop;
    constructor(reading: typeof motion.reading) {
      motion.reading = reading;
    }
  },
}));
let callbacks: FrameRequestCallback[];
let clock: number;
let coarse: boolean;
let mediaChange: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  callbacks = [];
  clock = 0;
  coarse = true;
  mediaChange = undefined;
  motion.start.mockClear();
  motion.stop.mockClear();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => callbacks.push(callback));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return query.includes('pointer: coarse') ? coarse : false;
    },
    addEventListener: (_: string, callback: () => void) => {
      if (query.includes('pointer: coarse')) mediaChange = callback;
    },
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});
function frames(seconds: number, angle = 0) {
  for (let index = 0; index < Math.round(seconds * 60); index++) {
    clock += 1000 / 60;
    motion.reading({
      x: 9.80665 * Math.cos((angle * Math.PI) / 180),
      y: -9.80665 * Math.sin((angle * Math.PI) / 180),
      z: 0,
      atMs: clock,
      screenAngleDeg: 90,
      landscape: true,
    });
    act(() => callbacks.shift()?.(clock));
  }
}
const props = {
  world: PRACTICE_YARD,
  start: PRACTICE_YARD_START,
  transmission: 'manual' as const,
  label: 'Pista',
  loadingText: 'Cargando',
  unavailableText: 'Sin WebGL',
  createRenderer: createFakeRenderer,
};

it('connects the sensor independently of pedal focus, calibrates and releases on reset, visibility and window focus', async () => {
  const assisted = vi.fn();
  const view = render(<DrivingCanvas {...props} onClutchAssistUsed={assisted} />);
  await act(async () => {});
  frames(0.05);
  const canvas = screen.getByTestId('driving-canvas');
  fireEvent.keyDown(canvas, { code: 'KeyK' });
  frames(0.05);
  expect(canvas).toHaveAttribute('data-key', 'removed');
  expect(assisted).not.toHaveBeenCalled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Empezar' })));
  expect(assisted).toHaveBeenCalledOnce();
  expect(canvas).toHaveFocus();
  frames(0.5);
  expect(canvas).toHaveAttribute('data-steering-source', 'tilt');
  fireEvent.focus(screen.getByRole('button', { name: 'Embrague' }));
  frames(0.5, 40);
  expect(Number(canvas.dataset.steer)).toBeGreaterThan(0.2);
  fireEvent.click(screen.getByRole('button', { name: 'Centrar volante' }));
  frames(0.5, 40);
  expect(Number(canvas.dataset.steer)).toBeCloseTo(0);
  fireEvent.click(screen.getByRole('button', { name: 'Accionar llave' }));
  frames(0.1, 40);
  fireEvent.click(screen.getByRole('button', { name: 'Accionar llave' }));
  frames(0.1, 40);
  fireEvent.click(screen.getByRole('button', { name: 'Elegir 1' }));
  frames(0.5, 40);
  expect(canvas).toHaveAttribute('data-gear', '1');
  expect(canvas).toHaveAttribute('data-engine', 'running');
  const strip = screen.getByTestId('mobile-pedals');
  strip.setPointerCapture = vi.fn();
  vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 72,
    bottom: 200,
    width: 72,
    height: 200,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const pointer = (type: string) => {
    const event = new MouseEvent(type, { bubbles: true, clientY: 0, button: 0 });
    Object.defineProperties(event, { pointerId: { value: 1 }, timeStamp: { value: clock } });
    fireEvent(screen.getByTestId('mobile-pedals'), event);
  };
  pointer('pointerdown');
  frames(0.3, 40);
  expect(Number(canvas.dataset.throttle)).toBe(1);
  view.rerender(<DrivingCanvas {...props} resetCount={1} />);
  frames(0.1, 40);
  pointer('pointermove');
  frames(0.1, 40);
  expect(Number(canvas.dataset.throttle)).toBe(0);
  expect(canvas).toHaveAttribute('data-gear', 'N');
  act(() => window.dispatchEvent(new Event('blur')));
  frames(0.1, 50);
  expect(canvas).toHaveAttribute('data-steering-source', 'buttons');
  act(() => window.dispatchEvent(new Event('focus')));
  frames(0.4, 40);
  expect(canvas).toHaveAttribute('data-steering-source', 'tilt');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  frames(0.1, 50);
  expect(canvas).toHaveAttribute('data-steering-source', 'buttons');
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  frames(0.4, 40);
  fireEvent.click(screen.getByText('Controles del celular'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Volante por inclinación' }));
  frames(0.1, 50);
  expect(canvas).toHaveAttribute('data-steering-source', 'buttons');
  expect(screen.getByRole('group', { name: 'Volante con botones' })).toBeInTheDocument();
  view.unmount();
  expect(motion.stop).toHaveBeenCalled();
});

it('starts with buttons and drops the mobile session when the primary pointer changes', async () => {
  const assisted = vi.fn();
  const view = render(<DrivingCanvas {...props} transmission="automatic" onClutchAssistUsed={assisted} />);
  await act(async () => {});
  frames(0.05);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Manejar con botones' })));
  frames(0.1);
  expect(motion.start).not.toHaveBeenCalled();
  expect(assisted).not.toHaveBeenCalled();
  expect(screen.getByTestId('driving-canvas')).toHaveAttribute('data-steering-source', 'buttons');
  const pedals = within(screen.getByRole('group', { name: 'Pedalera y caja' }));
  const duplicatedControls = ['Volante a la izquierda', 'Volante a la derecha', 'Frenar', 'Acelerar'];
  for (const name of duplicatedControls) expect(pedals.queryByRole('button', { name })).not.toBeInTheDocument();
  expect(screen.getByTestId('mobile-pedals')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Volante con botones' })).toBeInTheDocument();
  coarse = false;
  act(() => mediaChange?.());
  expect(screen.queryByTestId('mobile-overlay')).not.toBeInTheDocument();
  for (const name of duplicatedControls) expect(pedals.getByRole('button', { name })).toBeInTheDocument();
  coarse = true;
  await act(async () => mediaChange?.());
  expect(screen.getByRole('button', { name: 'Empezar' })).toBeInTheDocument();
  view.unmount();
});

it('releases semantic pedals and their pressed state when controls reset or focus leaves driving', async () => {
  const view = render(<DrivingCanvas {...props} />);
  await act(async () => {});
  frames(0.05);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Manejar con botones' })));
  const canvas = screen.getByTestId('driving-canvas');
  const throttle = () => screen.getByRole('button', { name: 'Acelerar ↑' });
  const press = () => {
    const event = new MouseEvent('click', { bubbles: true, detail: 0 });
    Object.defineProperty(event, 'timeStamp', { value: clock });
    fireEvent(throttle(), event);
    frames(0.3);
    expect(canvas).toHaveAttribute('data-throttle', '1.0000');
  };
  press();
  fireEvent.blur(throttle(), { relatedTarget: document.body });
  frames(0.3);
  expect(throttle()).toHaveAttribute('aria-pressed', 'false');
  expect(canvas).toHaveAttribute('data-throttle', '0.0000');
  press();
  act(() => window.dispatchEvent(new Event('blur')));
  frames(0.3);
  expect(throttle()).toHaveAttribute('aria-pressed', 'false');
  expect(canvas).toHaveAttribute('data-throttle', '0.0000');
  act(() => window.dispatchEvent(new Event('focus')));
  press();
  view.rerender(<DrivingCanvas {...props} resetCount={1} />);
  frames(0.1);
  expect(throttle()).toHaveAttribute('aria-pressed', 'false');
  expect(canvas).toHaveAttribute('data-throttle', '0.0000');
});
