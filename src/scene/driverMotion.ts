import type { VehicleState } from '../sim/vehicle.ts';

export interface DriverOffset {
  x: number;
  y: number;
  z: number;
  pitch: number;
  roll: number;
}

const rest = (): DriverOffset => ({ x: 0, y: 0, z: 0, pitch: 0, roll: 0 });
const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** Small, damped visual cues from actual acceleration. Never changes vehicle physics or observation commands. */
export class DriverMotion {
  private previous: { vehicle: VehicleState; timeS: number } | null = null;
  private offset = rest();

  update(vehicle: VehicleState, timeS: number, reducedMotion = false): DriverOffset {
    const previous = this.previous;
    this.previous = { vehicle: { ...vehicle }, timeS };
    const dt = previous ? timeS - previous.timeS : 0;
    // Resets, teleports and long suspended frames must not become a violent camera impulse.
    if (
      reducedMotion ||
      !previous ||
      dt < 0 ||
      dt > 0.3 ||
      Math.hypot(vehicle.x - previous.vehicle.x, vehicle.z - previous.vehicle.z) > 8
    ) {
      this.offset = rest();
      return this.offset;
    }
    if (dt === 0) return this.offset;
    const forward = clamp((vehicle.speedMps - previous.vehicle.speedMps) / dt, 8);
    const headingDelta = Math.atan2(
      Math.sin(vehicle.headingRad - previous.vehicle.headingRad),
      Math.cos(vehicle.headingRad - previous.vehicle.headingRad),
    );
    const lateral = clamp((vehicle.speedMps * headingDelta) / dt, 8);
    const road = Math.min(Math.abs(vehicle.speedMps) / 8, 1);
    const target: DriverOffset = {
      x: -lateral * 0.003,
      y: road * (Math.sin(vehicle.odometerM * 2.1) + Math.sin(vehicle.odometerM * 5.7) * 0.3) * 0.002,
      z: -forward * 0.004,
      pitch: forward * 0.004,
      roll: -lateral * 0.003,
    };
    const blend = 1 - Math.exp(-dt / 0.16);
    for (const key of ['x', 'y', 'z', 'pitch', 'roll'] as const)
      this.offset[key] += (target[key] - this.offset[key]) * blend;
    return this.offset;
  }
}
