import { describe, expect, it, vi } from 'vitest';
import { ContinuousInput, pedalsAt } from './continuousInput.ts';
import { GRAVITY_MPS2 as G, MotionFilter, TiltInput, screenRollDeg, tiltSteer } from './tilt.ts';
import type { GravityReading } from './tilt.ts';
import { DEFAULT_MOBILE_SETTINGS, isMobileDriving, parseMobileSettings } from './mobileDriving.ts';
import { NEUTRAL_CONTROLS, stepControls } from './controls.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';

export function gravity(angle: number, atMs: number, screenAngleDeg = 90, projected = G): GravityReading {
  const radians = ((angle + screenAngleDeg) * Math.PI) / 180;
  return {
    x: projected * Math.sin(radians),
    y: projected * Math.cos(radians),
    z: Math.sqrt(Math.max(0, G * G - projected * projected)),
    atMs,
    screenAngleDeg,
    landscape: true,
  };
}

function calibrate(input: TiltInput, angle = 0, startMs = 0) {
  for (let t = 0; t <= 300; t += 20) input.accept(gravity(angle, startMs + t));
}

describe('mobile steering geometry and calibration', () => {
  it.each([0, 90, 180, 270])('preserves left/right signs at screen angle %s', (rotation) => {
    expect(screenRollDeg(gravity(30, 0, rotation))).toBeCloseTo(30);
    expect(screenRollDeg(gravity(-30, 0, rotation))).toBeCloseTo(-30);
  });
  it('has a dead zone, a progressive curve and saturated lock in both directions', () => {
    expect(tiltSteer(3, 0)).toBe(0);
    expect(tiltSteer(-2, 0)).toBe(0);
    expect(tiltSteer(39, 0)).toBeCloseTo(0.5 ** 1.5);
    expect(tiltSteer(90, 0)).toBe(1);
    expect(tiltSteer(-90, 0)).toBe(-1);
    expect(tiltSteer(-179, 179)).toBe(0);
    expect(tiltSteer(45, 0, 45)).toBe(1);
  });
  it('never calibrates a moving phone, including after three seconds, and preserves the old center on recenter', () => {
    const input = new TiltInput();
    expect(input.sample(0, 75)).toBeNull();
    for (let t = 0; t < 4000; t += 20) input.accept(gravity((t / 20) % 60, t));
    expect(input.centerDeg).toBeNull();
    expect(input.sample(3980, 75)).toBe(0);
    expect(input.status).toBe('calibrating');
    calibrate(input, 10, 4000);
    expect(input.centerDeg).toBeCloseTo(10);
    input.recenter();
    input.accept(gravity(40, 4320));
    expect(input.sample(4320, 75)).toBeCloseTo(tiltSteer(40, 10));
    calibrate(input, 40, 4340);
    expect(input.centerDeg).toBeCloseTo(40);
    expect(input.sample(4640, 75)).toBeCloseTo(0);
  });
  it('uses circular averaging across the angle boundary', () => {
    const input = new TiltInput();
    for (let t = 0; t <= 320; t += 20) input.accept(gravity(t % 40 ? 179.5 : -179.5, t));
    expect(Math.abs(input.centerDeg!)).toBeCloseTo(180, 0);
  });
  it('requires a continuous valid window, expires at 250 ms and resumes with the same center', () => {
    const input = new TiltInput();
    input.accept(gravity(0, 0));
    input.accept(gravity(0, 300));
    expect(input.centerDeg).toBeNull();
    calibrate(input, 0, 320);
    input.accept(gravity(40, 640));
    expect(input.sample(890, 75)).toBeGreaterThan(0);
    expect(input.sample(891, 75)).toBeNull();
    expect(input.status).toBe('stale');
    input.accept(gravity(40, 900));
    expect(input.sample(900, 75)).toBeGreaterThan(0);
    input.release();
    expect(input.sample(901, 75)).toBeNull();
    expect(input.centerDeg).toBeCloseTo(0);
  });
  it('rejects invalid and out-of-order data, applies flat hysteresis and deactivates in portrait', () => {
    const input = new TiltInput();
    calibrate(input);
    input.accept({ ...gravity(30, 320), x: NaN });
    input.accept(gravity(30, 100));
    expect(input.sample(320, 75)).toBeCloseTo(0);
    input.accept(gravity(20, 340, 90, G * Math.sin((19 * Math.PI) / 180)));
    expect(input.sample(340, 75)).toBeNull();
    expect(input.status).toBe('flat');
    input.accept(gravity(20, 360, 90, G * Math.sin((23 * Math.PI) / 180)));
    expect(input.sample(360, 75)).toBeNull();
    input.accept(gravity(20, 380, 90, G * Math.sin((26 * Math.PI) / 180)));
    expect(input.sample(380, 75)).toBeGreaterThan(0);
    input.accept({ ...gravity(20, 400), landscape: false });
    expect(input.sample(400, 75)).toBeNull();
    expect(input.status).toBe('portrait');
  });
  it('keeps two-degree hand tremor below the exam wheel threshold at every sensitivity', () => {
    for (const lock of [45, 75, 90]) {
      for (let angle = -2; angle <= 2; angle += 0.1)
        expect(Math.abs(tiltSteer(angle, 0, lock) * EXAM_CAR.maxSteerRad)).toBeLessThan(0.03);
    }
  });
});

describe('motion complementary filter', () => {
  it('uses gyro for fast changes and gravity for drift without correcting on a shake', () => {
    const filter = new MotionFilter();
    expect(filter.sample({ ...gravity(0, 0), x: 100 }, null)).toBeNull();
    expect(screenRollDeg(filter.sample(gravity(0, 0), null)!)).toBeCloseTo(0);
    const shaken = { ...gravity(40, 100), z: 30 };
    expect(screenRollDeg(filter.sample(shaken, 100)!)).toBeCloseTo(10);
    expect(screenRollDeg(filter.sample(gravity(40, 200), 100)!)).toBeCloseTo(20 + (20 * 0.1) / 0.35);
    expect(filter.sample(gravity(20, 190), 0)).toBeNull();
    expect(filter.sample(gravity(20, 201), Infinity)).toBeNull();
    expect(filter.sample({ ...gravity(20, 201), z: NaN }, 0)).toBeNull();
    expect(screenRollDeg(filter.sample(gravity(40, 600), null)!)).toBeCloseTo(40);
  });
});

describe('continuous controls and settings', () => {
  it('maps direct taps and positions beyond the pedal strip with a neutral band', () => {
    expect(pedalsAt(-1)).toEqual({ throttle: 1, brake: 0 });
    expect(pedalsAt(2)).toEqual({ throttle: 0, brake: 1 });
    for (const position of [0.425, 0.5, 0.575]) expect(pedalsAt(position)).toEqual({ throttle: 0, brake: 0 });
    expect(pedalsAt(0.2125).throttle).toBeCloseTo(0.5);
    expect(pedalsAt(0.7875).brake).toBeCloseTo(0.5);
  });
  it('consumes readings at each fixed-step time and releases all queued values', () => {
    const input = new ContinuousInput();
    input.pushPedals({ atMs: 20, throttle: 0.6, brake: 0 });
    input.pushPedals({ atMs: 10, throttle: 1, brake: 0 });
    input.pushPedals({ atMs: NaN, throttle: 0, brake: 0 });
    input.pushPedals({ atMs: 22, throttle: NaN, brake: 0 });
    input.pushPedals({ atMs: 22, throttle: 1, brake: 1 });
    expect(input.sample(19).throttle).toBe(0);
    expect(input.sample(20).throttle).toBe(0.6);
    input.pushPedals({ atMs: 30, throttle: 0, brake: 0 });
    expect(input.sample(30).throttle).toBe(0);
    input.pushGravity({ ...gravity(10, 0), x: NaN });
    for (let t = 0; t <= 300; t += 20) input.pushGravity(gravity(0, t));
    input.pushGravity(gravity(40, 320));
    expect(input.sample(320).steer).toBeGreaterThan(0);
    expect(input.sample(320, false).steer).toBeNull();
    input.release();
    expect(input.sample(330)).toEqual({ steer: null, throttle: 0, brake: 0 });
  });
  it('ramps analog pedals at five per second, clamps values and lets held steering override tilt', () => {
    const controls = stepControls(NEUTRAL_CONTROLS, new Set(), 0.1, 20, {
      throttle: 2,
      brake: -1,
      steer: 0.8,
      clutch: 0.9,
    });
    expect(controls).toEqual({ throttle: 0.5, brake: 0, steer: 0.8, clutch: 0.9 });
    expect(stepControls(controls, new Set(), 0.1, 0, { throttle: 0 }).throttle).toBe(0);
    const held = stepControls(NEUTRAL_CONTROLS, new Set(['ArrowRight', 'ArrowUp', 'ArrowDown']), 0.1, 20, {
      steer: 1,
      throttle: 0,
      brake: 0,
    });
    expect(held.steer).toBeLessThan(0);
    expect(held.throttle).toBeCloseTo(0.15);
    expect(held.brake).toBeCloseTo(0.15);
    expect(stepControls(NEUTRAL_CONTROLS, new Set(), 0.1, 0, { steer: Infinity, throttle: NaN })).toEqual(
      NEUTRAL_CONTROLS,
    );
    expect(stepControls({ ...NEUTRAL_CONTROLS, steer: 1 }, new Set(), 0.1).steer).toBeLessThan(1);
  });
  it('validates the complete stored settings object and uses only the primary pointer for detection', () => {
    for (const raw of [
      null,
      'broken',
      'null',
      '1',
      '{}',
      '{"tiltEnabled":true,"fullLockDeg":44,"vibration":true}',
      '{"tiltEnabled":false,"fullLockDeg":91,"vibration":true}',
    ])
      expect(parseMobileSettings(raw)).toEqual(DEFAULT_MOBILE_SETTINGS);
    const saved = { tiltEnabled: false, fullLockDeg: 45, vibration: false };
    expect(parseMobileSettings(JSON.stringify(saved))).toEqual(saved);
    vi.stubGlobal('matchMedia', undefined);
    expect(isMobileDriving()).toBe(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    expect(isMobileDriving()).toBe(false);
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true })),
    );
    expect(isMobileDriving()).toBe(true);
    vi.unstubAllGlobals();
  });
});
