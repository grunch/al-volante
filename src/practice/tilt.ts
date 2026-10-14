/** All angles use degrees; timestamps share performance.now()'s monotonic clock. */
export interface GravityReading {
  x: number;
  y: number;
  z: number;
  atMs: number;
  screenAngleDeg: number;
  landscape: boolean;
}

export const GRAVITY_MPS2 = 9.80665;
export const TILT_EXPIRY_MS = 250;
export const normalizeDegrees = (angle: number) => ((((angle + 180) % 360) + 360) % 360) - 180;
export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function validGravity(reading: GravityReading): boolean {
  return [reading.x, reading.y, reading.z, reading.atMs, reading.screenAngleDeg].every(Number.isFinite);
}

export function screenRollDeg(reading: GravityReading): number {
  return normalizeDegrees((Math.atan2(reading.x, reading.y) * 180) / Math.PI - reading.screenAngleDeg);
}

export function tiltSteer(angleDeg: number, centerDeg: number, fullLockDeg = 75): number {
  const delta = normalizeDegrees(angleDeg - centerDeg);
  return Math.sign(delta) * clamp((Math.abs(delta) - 3) / (fullLockDeg - 3), 0, 1) ** 1.5 || 0;
}

export type TiltStatus = 'waiting' | 'calibrating' | 'active' | 'stale' | 'flat' | 'portrait';

/** Sample-driven calibration and hysteresis, independent of rendering frequency and browser APIs. */
export class TiltInput {
  centerDeg: number | null = null;
  status: TiltStatus = 'waiting';
  private latest: GravityReading | null = null;
  private flat = false;
  private calibrating = true;
  private window: { atMs: number; angle: number }[] = [];

  recenter() {
    this.calibrating = true;
    this.window = [];
  }

  release() {
    this.latest = null;
    this.window = [];
    this.status = 'waiting';
  }

  accept(reading: GravityReading) {
    if (!validGravity(reading) || (this.latest && reading.atMs <= this.latest.atMs)) return;
    if (this.latest && reading.atMs - this.latest.atMs > TILT_EXPIRY_MS) this.window = [];
    this.latest = reading;
    const projection = Math.hypot(reading.x, reading.y);
    this.flat = projection < Math.sin(((this.flat ? 25 : 20) * Math.PI) / 180) * GRAVITY_MPS2;
    if (this.flat || !reading.landscape) {
      this.window = [];
      return;
    }
    if (!this.calibrating) return;
    const angle = screenRollDeg(reading);
    const anchor = this.window[0]?.angle ?? angle;
    this.window.push({ atMs: reading.atMs, angle: anchor + normalizeDegrees(angle - anchor) });
    // Retain one sample at/before the window boundary, so irregular sensor intervals can span 300 ms.
    while (this.window.length > 1 && (this.window[1] as { atMs: number }).atMs <= reading.atMs - 300)
      this.window.shift();
    const angles = this.window.map((sample) => sample.angle);
    if (Math.max(...angles) - Math.min(...angles) > 2) {
      this.window = [{ atMs: reading.atMs, angle }];
    } else if (reading.atMs - (this.window[0] as { atMs: number }).atMs >= 300) {
      this.centerDeg = normalizeDegrees(angles.reduce((a, b) => a + b, 0) / angles.length);
      this.calibrating = false;
      this.window = [];
    }
  }

  sample(atMs: number, fullLockDeg: number): number | null {
    this.status = !this.latest
      ? 'waiting'
      : atMs - this.latest.atMs > TILT_EXPIRY_MS
        ? 'stale'
        : !this.latest.landscape
          ? 'portrait'
          : this.flat
            ? 'flat'
            : this.calibrating
              ? 'calibrating'
              : 'active';
    if (this.status !== 'active' && this.status !== 'calibrating') return null;
    return this.centerDeg === null
      ? 0
      : tiltSteer(screenRollDeg(this.latest as GravityReading), this.centerDeg, fullLockDeg);
  }
}

/** Complementary filter: integrate the z gyro, correcting drift only with plausible acceleration. */
export class MotionFilter {
  private angle: number | null = null;
  private atMs: number | null = null;

  sample(reading: GravityReading, rotationDegPerS: number | null): GravityReading | null {
    if (!validGravity(reading) || (rotationDegPerS !== null && !Number.isFinite(rotationDegPerS))) return null;
    if (this.atMs !== null && reading.atMs <= this.atMs) return null;
    const dt = this.atMs === null ? 0 : (reading.atMs - this.atMs) / 1000;
    const magnitude = Math.hypot(reading.x, reading.y, reading.z);
    const trusted = magnitude >= 0.5 * GRAVITY_MPS2 && magnitude <= 1.5 * GRAVITY_MPS2;
    const angle = (Math.atan2(reading.x, reading.y) * 180) / Math.PI;
    if (this.angle === null || dt > TILT_EXPIRY_MS / 1000) {
      if (!trusted) return null;
      this.angle = angle;
    } else {
      this.angle += (rotationDegPerS ?? 0) * dt;
      if (trusted) this.angle += (dt / (0.25 + dt)) * normalizeDegrees(angle - this.angle);
    }
    this.atMs = reading.atMs;
    const projected = Math.min(Math.hypot(reading.x, reading.y), GRAVITY_MPS2);
    return {
      ...reading,
      x: projected * Math.sin((this.angle * Math.PI) / 180),
      y: projected * Math.cos((this.angle * Math.PI) / 180),
    };
  }
}
