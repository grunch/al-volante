import type { OrientedBox } from './collision.ts';

/**
 * Physical description of the car. Values are those of a typical compact exam car, not of a specific model: they are
 * a calibrated approximation of the game (see ARQUITECTURA.md, «Simulación»).
 */
export interface VehicleSpec {
  lengthM: number;
  widthM: number;
  wheelbaseM: number;
  /** Rear bumper to rear axle. */
  rearOverhangM: number;
  maxSteerRad: number;
  /** How fast the front wheels turn, lock to lock. */
  steerRateRadPerS: number;
  massKg: number;
  /** Full-braking deceleration on dry asphalt; calibrated on the manual's table (PDF 70). */
  maxBrakeDecelMps2: number;
  rollingResistance: number;
  /** Drag coefficient times frontal area. */
  dragAreaM2: number;
}

export const EXAM_CAR: VehicleSpec = {
  lengthM: 4.3,
  widthM: 1.75,
  wheelbaseM: 2.6,
  rearOverhangM: 0.8,
  // 33° gives a kerb-to-kerb turning circle of about 10.8 m, usual for a compact car.
  maxSteerRad: (33 * Math.PI) / 180,
  steerRateRadPerS: 1,
  massKg: 1150,
  // The manual's braking distances (10 m from 50 km/h, 32 m from 90, 57 m from 120, dry) imply 9.65–9.77 m/s².
  maxBrakeDecelMps2: 9.7,
  rollingResistance: 0.012,
  dragAreaM2: 0.67,
};

/**
 * Position is the centre of the rear axle on the ground plane (x, z). A heading of 0 faces +z, and it grows when the
 * car turns left (towards +x), matching a Three.js rotation about +y. Speed is signed: negative when reversing.
 */
export interface VehicleState {
  x: number;
  z: number;
  headingRad: number;
  speedMps: number;
  /** Front wheel angle; positive turns left. */
  steerRad: number;
  /** Distance travelled in either direction. */
  odometerM: number;
}

export function restingVehicle(pose: Partial<Pick<VehicleState, 'x' | 'z' | 'headingRad'>> = {}): VehicleState {
  return { x: 0, z: 0, headingRad: 0, speedMps: 0, steerRad: 0, odometerM: 0, ...pose };
}

/** Unit vector the car faces. */
export function forwardOf(headingRad: number): { x: number; z: number } {
  return { x: Math.sin(headingRad), z: Math.cos(headingRad) };
}

/** The car body as an oriented box, for collisions and distances. */
export function bodyBox(spec: VehicleSpec, state: VehicleState): OrientedBox {
  const forward = forwardOf(state.headingRad);
  const toCentre = spec.lengthM / 2 - spec.rearOverhangM;
  return {
    centerX: state.x + forward.x * toCentre,
    centerZ: state.z + forward.z * toCentre,
    halfLengthM: spec.lengthM / 2,
    halfWidthM: spec.widthM / 2,
    headingRad: state.headingRad,
  };
}

/** Pose a fraction of the way from one state to the next; speed and steering are those of `to`. */
export function interpolateVehicle(from: VehicleState, to: VehicleState, fraction: number): VehicleState {
  const mix = (a: number, b: number) => a + (b - a) * fraction;
  return {
    ...to,
    x: mix(from.x, to.x),
    z: mix(from.z, to.z),
    headingRad: mix(from.headingRad, to.headingRad),
    odometerM: mix(from.odometerM, to.odometerM),
  };
}
