import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrivingHaptics, vibrationFor } from './haptics.ts';
import { MobileScreen } from './mobileScreen.ts';
import type { CarEvent } from '../sim/car.ts';

const contact = (impactSpeedMps: number): CarEvent => ({
  type: 'contact',
  kind: 'curb',
  obstacleId: 'kerb',
  impactSpeedMps,
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('physical haptics', () => {
  it('maps physical events, limits patterns to 150 ms and stops on release', () => {
    expect(vibrationFor(contact(0.9))).toBe(30);
    expect(vibrationFor(contact(1))).toBe(120);
    expect(vibrationFor({ type: 'actor-contact', actor: 'pedestrian' })).toBe(120);
    expect(vibrationFor({ type: 'stall' })).toEqual([60, 40, 60]);
    expect(vibrationFor({ type: 'shift-refused', to: 'R', reason: 'moving' })).toBe(25);
    expect(vibrationFor({ type: 'engine-started' })).toBeNull();
    const vibrate = vi.fn();
    const haptics = new DrivingHaptics(vibrate);
    haptics.update([{ type: 'engine-started' }], 0);
    expect(vibrate).not.toHaveBeenCalled();
    haptics.update([contact(1), { type: 'stall' }], 0);
    haptics.update([contact(1)], 149);
    expect(vibrate).toHaveBeenCalledTimes(1);
    haptics.update([{ type: 'stall' }], 150);
    expect(vibrate).toHaveBeenLastCalledWith([60, 40, 60]);
    haptics.stop();
    expect(vibrate).toHaveBeenLastCalledWith(0);
  });
});

function wakeLock() {
  const lock = Object.assign(new EventTarget(), { release: vi.fn().mockResolvedValue(undefined) });
  const request = vi.fn().mockResolvedValue(lock);
  vi.stubGlobal('navigator', { wakeLock: { request } });
  return { lock, request };
}

describe('mobile screen lifecycle', () => {
  it('acquires once, releases, handles system release and reacquires when requested again', async () => {
    const { lock, request } = wakeLock();
    const error = vi.fn();
    const screen = new MobileScreen(error);
    await screen.keepAwake(true);
    await screen.keepAwake(true);
    expect(request).toHaveBeenCalledTimes(1);
    lock.dispatchEvent(new Event('release'));
    expect(error).toHaveBeenLastCalledWith(true);
    await screen.keepAwake(true);
    expect(request).toHaveBeenCalledTimes(2);
    await screen.keepAwake(false);
    expect(lock.release).toHaveBeenCalledOnce();
    lock.dispatchEvent(new Event('release'));
    expect(error).toHaveBeenLastCalledWith(false);
    screen.dispose();
  });
  it('releases a wake request that resolves after disposal and ignores its late error', async () => {
    const { lock, request } = wakeLock();
    let finish!: (value: typeof lock) => void;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const error = vi.fn();
    const screen = new MobileScreen(error);
    const pending = screen.keepAwake(true);
    screen.dispose();
    finish(lock);
    await pending;
    expect(lock.release).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
    let fail!: (error: Error) => void;
    request.mockImplementation(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    const rejected = screen.keepAwake(true);
    screen.dispose();
    fail(new Error('Unavailable'));
    await rejected;
    expect(error).not.toHaveBeenCalled();
  });
  it('reports missing or rejected wake locks without blocking, including a failed release', async () => {
    vi.stubGlobal('navigator', {});
    const error = vi.fn();
    const screen = new MobileScreen(error);
    await screen.keepAwake(true);
    expect(error).toHaveBeenLastCalledWith(true);
    await screen.keepAwake(false);
    const { lock, request } = wakeLock();
    request.mockRejectedValueOnce(new Error('Denied'));
    await screen.keepAwake(true);
    expect(error).toHaveBeenLastCalledWith(true);
    await screen.keepAwake(false);
    await screen.keepAwake(true);
    lock.release.mockRejectedValueOnce(new Error('Already released'));
    screen.dispose();
    await Promise.resolve();
  });
  it('locks only when fullscreen is reported and unlocks even if a request completes late', async () => {
    let finish!: () => void;
    const lock = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const unlock = vi.fn();
    vi.stubGlobal('screen', { orientation: { lock, unlock } });
    const screen = new MobileScreen(vi.fn());
    const pending = screen.fullscreen(true);
    expect(lock).toHaveBeenCalledWith('landscape');
    screen.dispose();
    expect(unlock).toHaveBeenCalledOnce();
    finish();
    await pending;
    expect(unlock).toHaveBeenCalledTimes(2);
    lock.mockRejectedValueOnce(new Error('Not supported'));
    await screen.fullscreen(true);
    await screen.fullscreen(false);
    vi.stubGlobal('screen', {});
    await screen.fullscreen(true);
    await screen.fullscreen(false);
  });
});
