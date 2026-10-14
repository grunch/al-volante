import type { ContinuousControls } from './controls.ts';
import { TiltInput, clamp, validGravity } from './tilt.ts';
import type { GravityReading } from './tilt.ts';

export interface PedalReading {
  atMs: number;
  throttle: number;
  brake: number;
}

export function pedalsAt(position: number): Pick<PedalReading, 'throttle' | 'brake'> {
  const point = clamp(position, 0, 1);
  return { throttle: clamp((0.425 - point) / 0.425, 0, 1), brake: clamp((point - 0.575) / 0.425, 0, 1) };
}

/** Consume each reading exactly once, keeping only the latest value and future readings. */
class Timeline<T extends { atMs: number }> {
  private readings: T[] = [];
  private lastAtMs = -Infinity;
  push(value: T) {
    if (!Number.isFinite(value.atMs) || value.atMs < this.lastAtMs) return;
    this.lastAtMs = value.atMs;
    this.readings.push(value);
  }
  consume(atMs: number, accept: (reading: T) => void) {
    let count = 0;
    while (count < this.readings.length && (this.readings[count] as T).atMs <= atMs + 1e-6) {
      accept(this.readings[count] as T);
      count++;
    }
    this.readings.splice(0, count);
  }
  clear() {
    this.readings = [];
    this.lastAtMs = -Infinity;
  }
}

export class ContinuousInput {
  readonly tilt = new TiltInput();
  private gravity = new Timeline<GravityReading>();
  private pedals = new Timeline<PedalReading>();
  private pedalValue: PedalReading = { atMs: 0, throttle: 0, brake: 0 };

  pushGravity(reading: GravityReading) {
    if (validGravity(reading)) this.gravity.push(reading);
  }
  pushPedals(reading: PedalReading) {
    if (![reading.throttle, reading.brake].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) return;
    if (reading.throttle > 0 && reading.brake > 0) return;
    this.pedals.push(reading);
  }
  sample(atMs: number, tiltEnabled = true, fullLockDeg = 75): ContinuousControls {
    this.gravity.consume(atMs, (reading) => this.tilt.accept(reading));
    this.pedals.consume(atMs, (reading) => {
      this.pedalValue = reading;
    });
    return {
      steer: tiltEnabled ? this.tilt.sample(atMs, fullLockDeg) : null,
      throttle: this.pedalValue.throttle,
      brake: this.pedalValue.brake,
    };
  }
  release() {
    this.gravity.clear();
    this.pedals.clear();
    this.tilt.release();
    this.pedalValue = { atMs: 0, throttle: 0, brake: 0 };
  }
}
