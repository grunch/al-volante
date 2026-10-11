import type { VehicleSpec, VehicleState } from './vehicle.ts';

const G_MPS2 = 9.81;
const AIR_DENSITY_KGPM3 = 1.2;

/** Road surface: grip scales the tyre forces (braking, traction and cornering). */
export interface Surface {
  name: string;
  grip: number;
}

export const DRY_ASPHALT: Surface = { name: 'dry-asphalt', grip: 1 };
/** Half the grip: the manual doubles braking distances on wet asphalt (PDF 70). */
export const WET_ASPHALT: Surface = { name: 'wet-asphalt', grip: 0.5 };

export interface DriveInput {
  /** Force the driven wheels push with; negative pushes backwards. The powertrain (F03-T02) provides it. */
  tractionN: number;
  /** Brake pedal, 0 to 1. */
  brake: number;
  /** Steering wheel, -1 (full right) to 1 (full left). */
  steer: number;
  /** Extra force holding the car (handbrake, parking pawl, a stopped engine in gear), in newtons. */
  holdN?: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function nextSteer(spec: VehicleSpec, state: VehicleState, input: DriveInput, dt: number): number {
  const target = clamp(input.steer, -1, 1) * spec.maxSteerRad;
  const maxChange = spec.steerRateRadPerS * dt;
  return state.steerRad + clamp(target - state.steerRad, -maxChange, maxChange);
}

/** New signed speed: traction against brake, rolling and air resistance; resistance stops the car, never reverses it. */
function nextSpeed(spec: VehicleSpec, state: VehicleState, input: DriveInput, dt: number, surface: Surface): number {
  const massKg = spec.massKg;
  const gripN = surface.grip * massKg * G_MPS2;
  const tractionN = clamp(input.tractionN, -gripN, gripN);
  // Brakes and holds act through the tyres, so together they cannot exceed the grip.
  const brakeN = Math.min(
    gripN,
    clamp(input.brake, 0, 1) * spec.maxBrakeDecelMps2 * surface.grip * massKg + Math.max(0, input.holdN ?? 0),
  );
  const rollingN = spec.rollingResistance * massKg * G_MPS2;
  const speed = state.speedMps;
  if (speed === 0) {
    // Static: the car only moves when traction overcomes what holds it.
    const holdN = brakeN + rollingN;
    if (Math.abs(tractionN) <= holdN) return 0;
    return ((tractionN - Math.sign(tractionN) * holdN) / massKg) * dt;
  }
  const direction = Math.sign(speed);
  const dragN = 0.5 * AIR_DENSITY_KGPM3 * spec.dragAreaM2 * speed * speed;
  const next = speed + ((tractionN - direction * (brakeN + rollingN + dragN)) / massKg) * dt;
  return Math.sign(next) === direction ? next : 0;
}

/**
 * One fixed step of a kinematic bicycle model, suited to the low speeds of the exam: the rear axle follows the
 * heading and the car yaws at speed · tan(steer) / wheelbase. Cornering is capped at the tyres' grip, so at speed
 * the car understeers instead of turning tighter than physics allows.
 */
export function stepVehicle(
  spec: VehicleSpec,
  state: VehicleState,
  input: DriveInput,
  dt: number,
  surface: Surface,
): VehicleState {
  const steerRad = nextSteer(spec, state, input, dt);
  const speedMps = nextSpeed(spec, state, input, dt, surface);
  const averageSpeed = (state.speedMps + speedMps) / 2;
  const distance = averageSpeed * dt;
  const fastest = Math.max(Math.abs(state.speedMps), Math.abs(speedMps));
  const gripTan = fastest > 0 ? (surface.grip * G_MPS2 * spec.wheelbaseM) / (fastest * fastest) : Infinity;
  const tanSteer = clamp(Math.tan(steerRad), -gripTan, gripTan);
  const yaw = (distance * tanSteer) / spec.wheelbaseM;
  const midHeading = state.headingRad + yaw / 2;
  return {
    x: state.x + distance * Math.sin(midHeading),
    z: state.z + distance * Math.cos(midHeading),
    headingRad: state.headingRad + yaw,
    speedMps,
    steerRad,
    odometerM: state.odometerM + Math.abs(distance),
  };
}
