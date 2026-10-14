import { afterEach, describe, expect, it, vi } from 'vitest';
import { MotionSensor } from './motionSensor.ts';
import type { GravitySensorLike } from './motionSensor.ts';
import { screenRollDeg } from './tilt.ts';

class FakeSensor extends EventTarget implements GravitySensorLike {
  x: number | null = 9.8;
  y: number | null = 0;
  z: number | null = 0;
  timestamp: number | null = 100;
  start = vi.fn();
  stop = vi.fn();
}
const originalMotion = window.DeviceMotionEvent ?? Event;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function environment() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  const received = vi.fn();
  const error = vi.fn();
  return { received, error, adapter: new MotionSensor(received, error) };
}

function motion(gravity: Partial<DeviceMotionEventAcceleration> | null, gamma: number | null = 0) {
  const event = new Event('devicemotion');
  Object.defineProperties(event, {
    accelerationIncludingGravity: { value: gravity },
    rotationRate: { value: { alpha: 0, beta: 0, gamma } },
  });
  window.dispatchEvent(event);
}

describe('browser motion adapter', () => {
  it('integrates the local Z rate and ignores rotation about the screen axes', async () => {
    vi.stubGlobal('GravitySensor', undefined);
    const { adapter, received } = environment();
    await adapter.start();
    for (const atMs of [0, 100]) {
      const event = new Event('devicemotion');
      Object.defineProperties(event, {
        timeStamp: { value: atMs },
        accelerationIncludingGravity: { value: { x: 9.80665, y: 0, z: atMs ? 30 : 0 } },
        rotationRate: { value: { alpha: -200, beta: 300, gamma: 100 } },
      });
      window.dispatchEvent(event);
    }
    expect(screenRollDeg(received.mock.calls[1]![0]) - screenRollDeg(received.mock.calls[0]![0])).toBeCloseTo(10);
    adapter.stop();
  });
  it('prefers GravitySensor at 60 Hz and removes its listeners on stop', async () => {
    const sensor = new FakeSensor();
    const Constructor = vi.fn(function () {
      return sensor;
    });
    vi.stubGlobal('GravitySensor', Constructor);
    const { adapter, received, error } = environment();
    await adapter.start();
    expect(Constructor).toHaveBeenCalledWith({ frequency: 60 });
    sensor.dispatchEvent(new Event('reading'));
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ x: 9.8, atMs: 100, landscape: true }));
    sensor.x = null;
    sensor.dispatchEvent(new Event('reading'));
    expect(received).toHaveBeenCalledTimes(1);
    adapter.stop();
    expect(sensor.stop).toHaveBeenCalledOnce();
    sensor.x = 9.8;
    sensor.dispatchEvent(new Event('reading'));
    expect(received).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
  it('reports sensor errors without hiding them and ignores late events', async () => {
    const sensor = new FakeSensor();
    vi.stubGlobal(
      'GravitySensor',
      vi.fn(function () {
        return sensor;
      }),
    );
    const { adapter, received, error } = environment();
    await adapter.start();
    sensor.dispatchEvent(new Event('error'));
    sensor.dispatchEvent(new Event('reading'));
    expect(error).toHaveBeenCalledOnce();
    expect(received).not.toHaveBeenCalled();
  });
  it.each(['constructor', 'start', 'absent'])('falls back to motion when gravity is %s', async (failure) => {
    const sensor = new FakeSensor();
    if (failure === 'start')
      sensor.start.mockImplementation(() => {
        throw new Error('Unavailable');
      });
    vi.stubGlobal(
      'GravitySensor',
      failure === 'absent'
        ? undefined
        : vi.fn(function () {
            if (failure === 'constructor') throw new Error('Unavailable');
            return sensor;
          }),
    );
    const { adapter, received } = environment();
    await adapter.start();
    motion(null);
    motion({ x: null, y: 0, z: 0 });
    motion({ x: NaN, y: 0, z: 0 });
    expect(received).not.toHaveBeenCalled();
    motion({ x: 9.8, y: 0, z: 0 }, null);
    expect(received).toHaveBeenCalledOnce();
    adapter.stop();
    motion({ x: 9.8, y: 0, z: 0 });
    expect(received).toHaveBeenCalledOnce();
  });
  it.each(['denied', 'reject', 'granted'])('requests permission during start and handles %s', async (result) => {
    const { adapter, error } = environment();
    vi.stubGlobal(
      'DeviceMotionEvent',
      Object.assign(class extends originalMotion {}, {
        requestPermission:
          result === 'reject' ? vi.fn().mockRejectedValue(new Error('Denied')) : vi.fn().mockResolvedValue(result),
      }),
    );
    await adapter.start();
    expect(window.DeviceMotionEvent).toHaveProperty('requestPermission');
    expect(error).toHaveBeenCalledTimes(result === 'granted' ? 0 : 1);
    adapter.stop();
  });
  it('does not start or report errors after disposal while permission is pending', async () => {
    let resolve!: (result: string) => void;
    vi.stubGlobal('DeviceMotionEvent', {
      requestPermission: () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    });
    const { adapter, error } = environment();
    const pending = adapter.start();
    adapter.stop();
    resolve('granted');
    await pending;
    expect(error).not.toHaveBeenCalled();
    const again = adapter.start();
    adapter.stop();
    resolve('denied');
    await again;
    expect(error).not.toHaveBeenCalled();
  });
});
