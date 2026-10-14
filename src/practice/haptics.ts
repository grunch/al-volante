import type { CarEvent } from '../sim/car.ts';

/** Only vehicle events enter this adapter; exam faults and results have no haptic channel. */
export function vibrationFor(event: CarEvent): number | number[] | null {
  switch (event.type) {
    case 'contact':
      return event.impactSpeedMps < 1 ? 30 : 120;
    case 'actor-contact':
      return 120;
    case 'stall':
      return [60, 40, 60];
    case 'shift-refused':
      return 25;
    default:
      return null;
  }
}

export class DrivingHaptics {
  private lastAtMs = -Infinity;
  constructor(private readonly vibrate: (pattern: number | number[]) => unknown) {}
  update(events: readonly CarEvent[], atMs: number) {
    if (atMs - this.lastAtMs < 150) return;
    for (const event of events) {
      const pattern = vibrationFor(event);
      if (pattern !== null) {
        this.vibrate(pattern);
        this.lastAtMs = atMs;
        return;
      }
    }
  }
  stop() {
    this.vibrate(0);
  }
}
