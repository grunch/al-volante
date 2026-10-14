import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MobileIntro, MobileNotice, MobileOverlay, MobileSettingsPanel, PedalStrip } from './MobileControls.tsx';
import { DEFAULT_MOBILE_SETTINGS } from './mobileDriving.ts';
import type { MobileSnapshot } from './mobileSession.ts';
import { MOBILE_COPY } from '../i18n/es-AR.ts';

const snapshot: MobileSnapshot = {
  started: true,
  settings: DEFAULT_MOBILE_SETTINGS,
  status: 'active',
  storageError: false,
  wakeError: false,
  vibrationAvailable: true,
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
});

it('focuses the introduction, handles cancellation and offers both starting paths', () => {
  const start = vi.fn();
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  render(<MobileIntro start={start} />);
  expect(screen.getByRole('button', { name: 'Empezar' })).toHaveFocus();
  const cancel = new Event('cancel', { cancelable: true });
  screen.getByRole('dialog').dispatchEvent(cancel);
  expect(cancel.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Manejar con botones' }));
  expect(start.mock.calls).toEqual([[false], [true]]);
});

it('shows live sensor states, portrait fallback and wake failures', () => {
  const { rerender } = render(<MobileNotice snapshot={snapshot} />);
  expect(screen.getByRole('status')).toHaveTextContent(MOBILE_COPY.portrait);
  for (const status of ['flat', 'calibrating', 'stale', 'unavailable', 'waiting', 'off'] as const) {
    rerender(<MobileNotice snapshot={{ ...snapshot, status, wakeError: true }} />);
    expect(screen.getByRole('status')).toHaveTextContent(MOBILE_COPY.wakeError);
    if (status !== 'off')
      expect(screen.getByRole('status')).toHaveTextContent(
        status === 'stale' ? MOBILE_COPY.unavailable : MOBILE_COPY[status],
      );
  }
});

it('changes validated settings, labels sensitivity and exposes unavailable vibration and persistence errors', () => {
  const change = vi.fn();
  const { rerender } = render(<MobileSettingsPanel snapshot={snapshot} change={change} />);
  fireEvent.click(screen.getByText(MOBILE_COPY.settings));
  fireEvent.click(screen.getByRole('checkbox', { name: MOBILE_COPY.tiltEnabled }));
  expect(change).toHaveBeenLastCalledWith({ ...DEFAULT_MOBILE_SETTINGS, tiltEnabled: false });
  fireEvent.change(screen.getByRole('slider'), { target: { value: '45' } });
  expect(change).toHaveBeenLastCalledWith({ ...DEFAULT_MOBILE_SETTINGS, fullLockDeg: 45 });
  fireEvent.click(screen.getByRole('checkbox', { name: MOBILE_COPY.vibration }));
  expect(change).toHaveBeenLastCalledWith({ ...DEFAULT_MOBILE_SETTINGS, vibration: false });
  rerender(
    <MobileSettingsPanel snapshot={{ ...snapshot, storageError: true, vibrationAvailable: false }} change={change} />,
  );
  expect(screen.getByRole('checkbox', { name: MOBILE_COPY.vibration })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent(MOBILE_COPY.storageError);
});

it('maps direct taps, dragging outside and simultaneous pointers, releasing every path to neutral', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  const send = vi.fn();
  const { unmount } = render(<PedalStrip send={send} />);
  const strip = screen.getByTestId('mobile-pedals');
  strip.setPointerCapture = vi.fn();
  vi.spyOn(strip, 'getBoundingClientRect').mockReturnValue({
    top: 100,
    left: 0,
    width: 72,
    height: 200,
    bottom: 300,
    right: 72,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  });
  const pointer = (type: string, id: number, y: number, button = 0) => {
    const event = new MouseEvent(type, { bubbles: true, clientY: y, button });
    Object.defineProperty(event, 'pointerId', { value: id });
    fireEvent(strip, event);
  };
  pointer('pointerdown', 1, 100, 2);
  pointer('pointermove', 1, 100);
  expect(send).not.toHaveBeenCalled();
  pointer('pointerdown', 1, 100);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 1, brake: 0 }));
  pointer('pointermove', 1, 400);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0, brake: 1 }));
  pointer('pointerdown', 2, 200);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0, brake: 0 }));
  pointer('pointerup', 2, 200);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0, brake: 1 }));
  pointer('pointercancel', 1, 300);
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0, brake: 0 }));
  pointer('lostpointercapture', 1, 300);
  pointer('pointerdown', 3, 100);
  act(() => window.dispatchEvent(new Event('blur')));
  pointer('pointermove', 3, 100);
  unmount();
});

it('selects every manual and automatic position, highlights the current one and keeps steering alternatives', () => {
  const shift = vi.fn();
  const props = { send: vi.fn(), shift, start: vi.fn(), stop: vi.fn(), tiltActive: false };
  const { rerender } = render(<MobileOverlay {...props} automatic={false} gear="N" />);
  for (const gear of ['1', '3', '5', 'N', '2', '4', 'R']) {
    fireEvent.click(screen.getByRole('button', { name: `Elegir ${gear}` }));
    expect(shift).toHaveBeenLastCalledWith({ type: 'shift', to: gear });
  }
  expect(screen.getByRole('button', { name: 'Elegir N' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('group', { name: MOBILE_COPY.steering })).toBeInTheDocument();
  rerender(<MobileOverlay {...props} automatic gear="D" tiltActive />);
  expect(screen.queryByRole('group', { name: MOBILE_COPY.steering })).not.toBeInTheDocument();
  for (const gear of ['P', 'R', 'N', 'D']) fireEvent.click(screen.getByRole('button', { name: `Elegir ${gear}` }));
  expect(screen.getByRole('button', { name: 'Elegir D' })).toHaveAttribute('aria-pressed', 'true');
});

it('toggles sustained pedals through semantic activation without simultaneously pressing both', () => {
  const send = vi.fn();
  render(<PedalStrip send={send} />);
  const throttle = screen.getByRole('button', { name: MOBILE_COPY.throttle });
  const brake = screen.getByRole('button', { name: MOBILE_COPY.brake });
  expect(throttle).toHaveAccessibleDescription(MOBILE_COPY.pedalActivationHelp);
  expect(brake).toHaveAccessibleDescription(MOBILE_COPY.pedalActivationHelp);
  fireEvent.click(throttle, { detail: 0 });
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 1, brake: 0 }));
  expect(throttle).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(brake, { detail: 0 });
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0, brake: 1 }));
  expect(throttle).toHaveAttribute('aria-pressed', 'false');
  expect(brake).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(brake, { detail: 0 });
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0, brake: 0 }));
  fireEvent.click(throttle, { detail: 0 });
  fireEvent.click(throttle, { detail: 0 });
  expect(send).toHaveBeenLastCalledWith(expect.objectContaining({ throttle: 0, brake: 0 }));
  send.mockClear();
  fireEvent.click(throttle, { detail: 1 });
  fireEvent.click(brake, { detail: 1 });
  expect(send).not.toHaveBeenCalled();
  for (const button of [throttle, brake]) {
    expect(fireEvent.keyDown(button, { code: 'Enter', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(button, { code: 'Space', repeat: true })).toBe(false);
    expect(fireEvent.keyDown(button, { code: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(button, { code: 'Tab', repeat: true })).toBe(true);
  }
});
