import { MotionFilter } from './tilt.ts';
import type { GravityReading } from './tilt.ts';

export interface GravitySensorLike extends EventTarget {
  x: number | null;
  y: number | null;
  z: number | null;
  timestamp: number | null;
  start(): void;
  stop(): void;
}
type SensorWindow = Window & {
  GravitySensor?: new (options: { frequency: number }) => GravitySensorLike;
  DeviceMotionEvent?: typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
  orientation?: number;
};

/** Browser-only adapter. Call start inside a user gesture; stop invalidates pending permission requests. */
export class MotionSensor {
  private generation = 0;
  private cleanup: (() => void) | null = null;
  constructor(
    private readonly reading: (reading: GravityReading) => void,
    private readonly error: () => void,
    private readonly host: SensorWindow = window,
  ) {}

  private orientation() {
    return {
      screenAngleDeg: this.host.screen.orientation?.angle ?? this.host.orientation ?? 0,
      landscape: this.host.matchMedia('(orientation: landscape)').matches,
    };
  }

  async start() {
    this.stop();
    const generation = this.generation;
    try {
      const permission = this.host.DeviceMotionEvent?.requestPermission;
      if (permission && (await permission.call(this.host.DeviceMotionEvent)) !== 'granted') {
        if (generation === this.generation) this.error();
        return;
      }
      if (generation !== this.generation) return;
      if (this.host.GravitySensor) {
        try {
          const sensor = new this.host.GravitySensor({ frequency: 60 });
          const read = () => {
            if (sensor.x === null || sensor.y === null || sensor.z === null || sensor.timestamp === null) return;
            this.reading({ x: sensor.x, y: sensor.y, z: sensor.z, atMs: sensor.timestamp, ...this.orientation() });
          };
          const fail = () => {
            this.stop();
            this.error();
          };
          sensor.addEventListener('reading', read);
          sensor.addEventListener('error', fail);
          this.cleanup = () => {
            sensor.removeEventListener('reading', read);
            sensor.removeEventListener('error', fail);
            sensor.stop();
          };
          sensor.start();
          return;
        } catch {
          // An unsupported constructor/start can fall back; asynchronous permission/read errors stay visible.
          this.cleanup?.();
          this.cleanup = null;
        }
      }
      const filter = new MotionFilter();
      const read = (event: DeviceMotionEvent) => {
        const gravity = event.accelerationIncludingGravity;
        if (gravity?.x == null || gravity.y == null || gravity.z == null) return;
        const sample = filter.sample(
          { x: gravity.x, y: gravity.y, z: gravity.z, atMs: event.timeStamp, ...this.orientation() },
          // DeviceMotion rotationRate names the local X/Y/Z rates alpha/beta/gamma.
          event.rotationRate?.gamma ?? null,
        );
        if (sample) this.reading(sample);
      };
      this.host.addEventListener('devicemotion', read);
      this.cleanup = () => this.host.removeEventListener('devicemotion', read);
    } catch {
      if (generation === this.generation) this.error();
    }
  }

  stop() {
    this.generation++;
    this.cleanup?.();
    this.cleanup = null;
  }
}
