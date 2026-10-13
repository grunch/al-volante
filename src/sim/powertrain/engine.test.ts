import { describe, expect, it } from 'vitest';
import { EXAM_ENGINE, clutchEngagement, combustionTorqueNm, engineTorqueNm, rpmToRadS } from './engine.ts';

describe('engine', () => {
  it('follows its torque curve at full throttle and gives nothing at zero throttle above idle', () => {
    expect(combustionTorqueNm(EXAM_ENGINE, rpmToRadS(3500), 1)).toBeCloseTo(130, 6);
    expect(engineTorqueNm(EXAM_ENGINE, rpmToRadS(3500), 1)).toBeLessThan(130);
    expect(engineTorqueNm(EXAM_ENGINE, rpmToRadS(2000), 0)).toBeLessThan(0);
  });

  it('holds idle on its own: below idle it adds torque, capped', () => {
    const atIdle = engineTorqueNm(EXAM_ENGINE, rpmToRadS(EXAM_ENGINE.idleRpm), 0);
    const belowIdle = engineTorqueNm(EXAM_ENGINE, rpmToRadS(600), 0);

    expect(Math.abs(atIdle)).toBeLessThan(1);
    expect(belowIdle).toBeGreaterThan(10);
    expect(belowIdle).toBeLessThanOrEqual(EXAM_ENGINE.idleTorqueMaxNm);
  });

  it('cuts fuel at the rev limiter', () => {
    expect(engineTorqueNm(EXAM_ENGINE, rpmToRadS(EXAM_ENGINE.maxRpm + 10), 1)).toBeLessThan(0);
  });

  it('keeps the full-throttle torque flat beyond the last point of its table', () => {
    const shortCurve = {
      ...EXAM_ENGINE,
      torqueCurve: [
        [1000, 90],
        [3000, 120],
      ] as const,
    };

    expect(combustionTorqueNm(shortCurve, rpmToRadS(4500), 1)).toBe(120);
    expect(combustionTorqueNm(shortCurve, rpmToRadS(2000), 1)).toBeCloseTo(105, 9);
  });
});

describe('clutch engagement', () => {
  it('is free with the pedal pressed, bites near the top and grips fully when released', () => {
    expect(clutchEngagement(1)).toBe(0);
    expect(clutchEngagement(0.8)).toBe(0);
    expect(clutchEngagement(0.7)).toBeGreaterThan(0);
    expect(clutchEngagement(0.7)).toBeLessThan(0.15);
    expect(clutchEngagement(0.2)).toBe(1);
  });
});
