import { describe, expect, it } from 'vitest';
import { SIMPLE_MAX_TRACTION_N, simpleDriveInput } from './simpleDrive.ts';

describe('simple drive (until the powertrain of F03-T02)', () => {
  it('turns the throttle into traction forwards, or backwards in reverse', () => {
    expect(simpleDriveInput({ throttle: 0.5, brake: 0, steer: 0.2, reverse: false })).toEqual({
      tractionN: SIMPLE_MAX_TRACTION_N / 2,
      brake: 0,
      steer: 0.2,
    });
    expect(simpleDriveInput({ throttle: 1, brake: 0.3, steer: 0, reverse: true })).toEqual({
      tractionN: -SIMPLE_MAX_TRACTION_N,
      brake: 0.3,
      steer: 0,
    });
  });

  it('clamps pedals and steering to their ranges', () => {
    expect(simpleDriveInput({ throttle: 2, brake: -1, steer: 3, reverse: false })).toEqual({
      tractionN: SIMPLE_MAX_TRACTION_N,
      brake: 0,
      steer: 1,
    });
  });
});
