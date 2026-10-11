import { describe, expect, it } from 'vitest';
import { startDriving, driveFrame } from './drivingLoop.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';

function drive(hz: number, seconds: number) {
  let frame = startDriving(PRACTICE_YARD_START);
  const keys = new Set(['ArrowUp', 'ArrowLeft']);
  for (let i = 0; i < Math.round(seconds * hz); i += 1)
    frame = driveFrame(EXAM_CAR, PRACTICE_YARD, frame, keys, false, 1 / hz);
  return frame;
}

describe('driving frame loop', () => {
  it('gives exactly the same car at 30 and 120 frames per second, pedal and wheel ramps included', () => {
    // Both rates run the same number of fixed steps, so any frame-rate dependence would show as a difference.
    const at30 = drive(30, 2);
    const at120 = drive(120, 2);

    expect(at30.stepper.state.timeS).toBeCloseTo(at120.stepper.state.timeS, 9);
    expect(at30.stepper.state.vehicle).toEqual(at120.stepper.state.vehicle);
    expect(at30.controls).toEqual(at120.controls);
    expect(at30.stepper.state.vehicle.odometerM).toBeGreaterThan(1);
  });

  it('reports the first contact of the frame and drives backwards in reverse', () => {
    let frame = startDriving({ ...PRACTICE_YARD_START, z: 34 });
    let contact = null;
    for (let i = 0; i < 300 && !contact; i += 1) {
      frame = driveFrame(EXAM_CAR, PRACTICE_YARD, frame, new Set(['ArrowUp']), false, 1 / 60);
      contact = frame.contact;
    }
    const reversing = driveFrame(
      EXAM_CAR,
      PRACTICE_YARD,
      startDriving(PRACTICE_YARD_START),
      new Set(['ArrowUp']),
      true,
      0.5,
    );

    expect(contact?.obstacleId).toBe('wall-north');
    expect(reversing.stepper.state.vehicle.speedMps).toBeLessThan(0);
  });
});
