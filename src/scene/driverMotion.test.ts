import { describe, expect, it } from 'vitest';
import { DriverMotion } from './driverMotion.ts';
import { PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';

describe('driver motion', () => {
  const start = { ...PRACTICE_YARD_START, speedMps: 5 };

  it('leans back under acceleration and forward under braking without changing the vehicle', () => {
    const view = new DriverMotion();
    view.update(start, 0);
    const accelerated = { ...start, speedMps: 5.5 };
    const snapshot = { ...accelerated };
    const offset = { ...view.update(accelerated, 0.1) };
    expect(offset.pitch).toBeGreaterThan(0);
    expect(offset.z).toBeLessThan(0);
    expect(accelerated).toEqual(snapshot);
    const braking = view.update({ ...start, speedMps: 4.5 }, 0.2);
    expect(braking.pitch).toBeLessThan(0);
    expect(Math.abs(braking.pitch)).toBeLessThan(0.032);
  });

  it('uses signed lateral acceleration, including reverse, and remains still at rest', () => {
    const view = new DriverMotion();
    view.update(start, 0);
    expect(view.update({ ...start, headingRad: start.headingRad + 0.05 }, 0.1).x).toBeLessThan(0);
    const reverse = new DriverMotion();
    reverse.update({ ...start, speedMps: -5 }, 0);
    expect(reverse.update({ ...start, speedMps: -5, headingRad: start.headingRad + 0.05 }, 0.1).x).toBeGreaterThan(0);
    const parked = new DriverMotion();
    for (let i = 0; i < 120; i++)
      expect(parked.update(PRACTICE_YARD_START, i / 60)).toEqual({ x: 0, y: 0, z: 0, pitch: 0, roll: 0 });
  });

  it('clears offsets on reset, teleport, suspension and a live reduced-motion change', () => {
    for (const mode of ['reset', 'teleport', 'suspend', 'reduced'] as const) {
      const view = new DriverMotion();
      view.update(start, 0);
      expect(view.update({ ...start, speedMps: 6 }, 0.1).pitch).toBeGreaterThan(0);
      const result = view.update(
        { ...start, x: start.x + (mode === 'teleport' ? 50 : 0) },
        mode === 'reset' ? 0 : mode === 'suspend' ? 3 : 0.2,
        mode === 'reduced',
      );
      expect(result).toEqual({ x: 0, y: 0, z: 0, pitch: 0, roll: 0 });
    }
  });
});
