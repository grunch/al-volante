import type { CarControls, CarSpecs, CarState } from '../sim/car.ts';
import { clutchEngagement, radSToRpm } from '../sim/powertrain/engine.ts';
import { clamp } from './tilt.ts';

/** Invert the existing clutch curve; the assistant never supplies traction directly. */
function pedalForCapacity(fraction: number): number {
  let low = 0.3;
  let high = 0.75;
  for (let index = 0; index < 24; index++) {
    const middle = (low + high) / 2;
    if (clutchEngagement(middle) > fraction) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

/** Deterministic pedal assistant. A requested shift takes priority even during engine-off recognition. */
export function assistedClutch(
  previous: number,
  car: CarState,
  controls: CarControls,
  shiftPending: boolean,
  dt: number,
  specs: CarSpecs,
): number {
  const powertrain = car.powertrain;
  if (shiftPending) return Math.min(1, previous + 4 * dt);
  if (!powertrain.engineRunning || powertrain.manualGear === 'N') return 0;
  const speed = Math.abs(car.world.vehicle.speedMps);
  if (powertrain.handbrake || (controls.brake > 0 && speed < 1)) return 1;
  const rpm = radSToRpm(powertrain.engineRadS);
  const lowGear = powertrain.manualGear === '1' || powertrain.manualGear === 'R';
  let target: number;
  if (lowGear && controls.throttle <= 0.05 && controls.brake === 0 && speed < 0.6) {
    // Match rolling resistance plus a bounded proportional correction towards 0.3 m/s.
    const direction = powertrain.manualGear === 'R' ? -1 : 1;
    const along = car.world.vehicle.speedMps * direction;
    const acceleration = clamp((0.3 - along) * 3, 0, 0.9);
    const forceN = specs.vehicle.massKg * (specs.vehicle.rollingResistance * 9.81 + acceleration);
    const ratio = Math.abs(specs.powertrain.manual.ratios[powertrain.manualGear] * specs.powertrain.manual.finalDrive);
    const torqueNm = (forceN * specs.powertrain.wheelRadiusM) / (ratio * specs.powertrain.efficiency);
    target = pedalForCapacity(clamp(torqueNm / specs.powertrain.manual.clutchMaxNm, 0, 1));
  } else if (controls.throttle > 0.05) {
    const ratio = Math.abs(specs.powertrain.manual.ratios[powertrain.manualGear] * specs.powertrain.manual.finalDrive);
    const gearboxRpm = radSToRpm((speed / specs.powertrain.wheelRadiusM) * ratio);
    // Stay inside the powertrain's 2 rad/s lock tolerance (~19 rpm) before fully coupling.
    // A wider tolerance can alternate traction and engine braking instead of completing the launch.
    target =
      gearboxRpm > 1000 && Math.abs(rpm - gearboxRpm) < 15 ? 0 : clamp(0.7 - Math.max(0, rpm - 1300) / 2500, 0, 0.7);
  } else {
    target = rpm < 1000 ? 1 : 0;
  }
  return target > previous ? Math.min(target, previous + 4 * dt) : Math.max(target, previous - 2.5 * dt);
}
