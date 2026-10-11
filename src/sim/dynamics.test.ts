import { describe, expect, it } from 'vitest';
import { SIM_STEP_S } from './fixedStep.ts';
import { DRY_ASPHALT, WET_ASPHALT, stepVehicle } from './dynamics.ts';
import type { DriveInput } from './dynamics.ts';
import { EXAM_CAR, restingVehicle } from './vehicle.ts';
import type { VehicleState } from './vehicle.ts';

const KMH = 1 / 3.6;
const G = 9.81;

function run(state: VehicleState, input: DriveInput, seconds: number, surface = DRY_ASPHALT): VehicleState {
  let current = state;
  for (let t = 0; t < seconds - 1e-9; t += SIM_STEP_S)
    current = stepVehicle(EXAM_CAR, current, input, SIM_STEP_S, surface);
  return current;
}

/** Brakes fully from `kmh` and returns the distance travelled until stopped. */
function brakingDistance(kmh: number, surface = DRY_ASPHALT): number {
  let state: VehicleState = { ...restingVehicle(), speedMps: kmh * KMH };
  const start = state.odometerM;
  for (let i = 0; i < 20 / SIM_STEP_S && state.speedMps > 0; i += 1)
    state = stepVehicle(EXAM_CAR, state, { tractionN: 0, brake: 1, steer: 0 }, SIM_STEP_S, surface);
  return state.odometerM - start;
}

describe('vehicle dynamics', () => {
  it('brakes like the manual table on dry and wet asphalt (manual PDF 70)', () => {
    // Braking distances of the manual: 50 km/h 10 m dry and 20 m wet; 90 km/h 32 m dry.
    expect(brakingDistance(50)).toBeCloseTo(10, 0);
    expect(Math.abs(brakingDistance(50) - 10)).toBeLessThan(0.5);
    expect(Math.abs(brakingDistance(90) - 32)).toBeLessThan(1);
    expect(Math.abs(brakingDistance(50, WET_ASPHALT) - 20)).toBeLessThan(1);
  });

  it('turns around a circle of radius wheelbase / tan(steer) at low speed', () => {
    // Arrange: full lock to the left, rolling at walking pace.
    const steered = run(restingVehicle(), { tractionN: 0, brake: 0, steer: 1 }, 2);
    const rolling: VehicleState = { ...steered, speedMps: 1.5 };

    // Act: a quarter turn at constant speed (no resistance applied while traction balances it).
    const radius = EXAM_CAR.wheelbaseM / Math.tan(EXAM_CAR.maxSteerRad);
    const quarter = (Math.PI / 2) * radius;
    let state = rolling;
    while (state.odometerM - rolling.odometerM < quarter)
      state = stepVehicle(
        EXAM_CAR,
        { ...state, speedMps: 1.5 },
        { tractionN: 0, brake: 0, steer: 1 },
        SIM_STEP_S,
        DRY_ASPHALT,
      );

    // Assert: heading turned 90° to the left and the rear axle moved one radius in x and z.
    expect(state.headingRad - rolling.headingRad).toBeCloseTo(Math.PI / 2, 1);
    expect(state.x - rolling.x).toBeCloseTo(radius, 1);
    expect(state.z - rolling.z).toBeCloseTo(radius, 1);
  });

  it('turns the wheels at a limited rate', () => {
    const afterQuarterSecond = run(restingVehicle(), { tractionN: 0, brake: 0, steer: 1 }, 0.25);
    const afterTwoSeconds = run(restingVehicle(), { tractionN: 0, brake: 0, steer: 1 }, 2);

    expect(afterQuarterSecond.steerRad).toBeCloseTo(0.25 * EXAM_CAR.steerRateRadPerS, 2);
    expect(afterTwoSeconds.steerRad).toBeCloseTo(EXAM_CAR.maxSteerRad, 9);
  });

  it('never turns harder than the tyres allow (understeer at the grip limit)', () => {
    const fast: VehicleState = {
      ...run(restingVehicle(), { tractionN: 0, brake: 0, steer: 1 }, 2),
      speedMps: 50 * KMH,
    };

    const next = stepVehicle(EXAM_CAR, fast, { tractionN: 0, brake: 0, steer: 1 }, SIM_STEP_S, DRY_ASPHALT);
    const yawRate = (next.headingRad - fast.headingRad) / SIM_STEP_S;

    expect(Math.abs(yawRate * fast.speedMps)).toBeLessThanOrEqual(DRY_ASPHALT.grip * G + 1e-6);
  });

  it('accelerates forward and backward with traction, and rolls to a stop without it', () => {
    const forward = run(restingVehicle(), { tractionN: 2000, brake: 0, steer: 0 }, 2);
    const backward = run(restingVehicle(), { tractionN: -1000, brake: 0, steer: 0 }, 2);
    const coasting = run({ ...restingVehicle(), speedMps: 2 }, { tractionN: 0, brake: 0, steer: 0 }, 60);

    expect(forward.speedMps).toBeGreaterThan(2.5);
    expect(forward.z).toBeGreaterThan(2);
    expect(backward.speedMps).toBeLessThan(0);
    expect(backward.z).toBeLessThan(0);
    expect(coasting.speedMps).toBe(0);
  });

  it('stops without reversing when braking, and stays still when traction is below the resistance', () => {
    const braked = run({ ...restingVehicle(), speedMps: 1 }, { tractionN: 0, brake: 1, steer: 0 }, 1);
    const held = run(restingVehicle(), { tractionN: 2000, brake: 1, steer: 0 }, 1);
    const tooWeak = run(restingVehicle(), { tractionN: 50, brake: 0, steer: 0 }, 1);

    expect(braked.speedMps).toBe(0);
    expect(held.speedMps).toBe(0);
    expect(tooWeak.speedMps).toBe(0);
    expect(tooWeak.odometerM).toBe(0);
  });

  it('swings the nose the other way when reversing with the wheels turned left', () => {
    const steered = run(restingVehicle(), { tractionN: 0, brake: 0, steer: 1 }, 2);

    const reversed = run(steered, { tractionN: -1500, brake: 0, steer: 1 }, 2);

    expect(reversed.headingRad).toBeLessThan(steered.headingRad);
  });
});
