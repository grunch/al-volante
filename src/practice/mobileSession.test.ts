import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GravityReading } from './tilt.ts';
import { DEFAULT_MOBILE_SETTINGS, MOBILE_SETTINGS_KEY } from './mobileDriving.ts';
import { MobileSession } from './mobileSession.ts';

const sensor = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  reading: (reading: GravityReading) => {
    void reading;
  },
  error: () => {},
}));
vi.mock('./motionSensor.ts', () => ({
  MotionSensor: class {
    start = sensor.start;
    stop = sensor.stop;
    constructor(reading: typeof sensor.reading, error: typeof sensor.error) {
      sensor.reading = reading;
      sensor.error = error;
    }
  },
}));
const reading = (atMs: number, angle = 0): GravityReading => ({
  x: 9.80665 * Math.cos((angle * Math.PI) / 180),
  y: -9.80665 * Math.sin((angle * Math.PI) / 180),
  z: 0,
  atMs,
  screenAngleDeg: 90,
  landscape: true,
});

beforeEach(() => {
  localStorage.clear();
  sensor.start.mockClear();
  sensor.stop.mockClear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('mobile session orchestration', () => {
  it('starts only on gesture, calibrates, expires and restores readings while retaining its center', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(Object.assign(new EventTarget(), { release: vi.fn().mockResolvedValue(undefined) }));
    vi.stubGlobal('navigator', { wakeLock: { request }, vibrate: vi.fn() });
    const changed = vi.fn();
    const session = new MobileSession(changed);
    session.update(0, []);
    session.pedals({ atMs: 0, throttle: 1, brake: 0 });
    expect(session.sample(0).throttle).toBe(0);
    expect(sensor.start).not.toHaveBeenCalled();
    session.start(0);
    sensor.reading({ ...reading(0), x: NaN });
    session.update(1000, []);
    expect(session.snapshot.status).toBe('unavailable');
    for (let t = 1000; t <= 1320; t += 20) {
      sensor.reading(reading(t));
      session.sample(t);
    }
    session.update(1320, []);
    expect(session.snapshot.status).toBe('active');
    expect(request).toHaveBeenCalledWith('screen');
    await Promise.resolve();
    expect(session.snapshot.wakeError).toBe(false);
    sensor.reading(reading(1340, 40));
    expect(session.sample(1340).steer).toBeGreaterThan(0);
    session.pedals({ atMs: 1340, throttle: 1, brake: 0 });
    expect(session.sample(1340).throttle).toBe(1);
    session.sample(1600);
    session.update(1600, []);
    expect(session.snapshot.status).toBe('stale');
    sensor.reading(reading(1620, 40));
    session.sample(1620);
    session.update(1620, []);
    expect(session.snapshot.status).toBe('active');
    session.recenter();
    expect(session.sample(1620).steer).toBeGreaterThan(0);
    session.release();
    expect(session.sample(1640).throttle).toBe(0);
    session.suspend();
    sensor.reading(reading(1660, 40));
    session.pedals({ atMs: 1660, throttle: 1, brake: 0 });
    expect(session.sample(1660)).toMatchObject({ steer: null, throttle: 0 });
    session.update(1660, [{ type: 'stall' }]);
    session.resume();
    expect(sensor.start).toHaveBeenCalledTimes(2);
    session.fullscreen(false);
    session.dispose();
    sensor.reading(reading(1680));
    expect(session.sample(1680).steer).toBeNull();
  });
  it('retains settings in memory after storage errors and toggles sensors and haptics', async () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const session = new MobileSession(vi.fn());
    session.start(0);
    session.update(0, [{ type: 'stall' }]);
    expect(vibrate).toHaveBeenLastCalledWith([60, 40, 60]);
    session.change({ ...DEFAULT_MOBILE_SETTINGS, tiltEnabled: false, vibration: false });
    expect(vibrate).toHaveBeenLastCalledWith(0);
    sensor.reading(reading(1));
    session.sample(1);
    session.update(1, []);
    expect(session.snapshot.status).toBe('off');
    expect(JSON.parse(localStorage.getItem(MOBILE_SETTINGS_KEY)!)).toMatchObject({ tiltEnabled: false });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('Quota');
    });
    session.change({ ...DEFAULT_MOBILE_SETTINGS, fullLockDeg: 45 });
    expect(session.snapshot).toMatchObject({ storageError: true, settings: { fullLockDeg: 45 } });
    expect(sensor.start).toHaveBeenCalledTimes(2);
    sensor.error();
    expect(session.snapshot.status).toBe('unavailable');
    session.update(100, []);
    session.dispose();
    const changed = vi.fn();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('Blocked');
    });
    vi.stubGlobal('navigator', {});
    const noStorage = new MobileSession(changed);
    noStorage.resume();
    noStorage.change({ ...DEFAULT_MOBILE_SETTINGS, tiltEnabled: false, vibration: false });
    noStorage.start(0);
    noStorage.update(1, []);
    noStorage.change(DEFAULT_MOBILE_SETTINGS);
    sensor.reading(reading(10));
    noStorage.sample(10);
    noStorage.update(10, []);
    await Promise.resolve();
    expect(noStorage.snapshot.wakeError).toBe(true);
    noStorage.dispose();
  });
});
