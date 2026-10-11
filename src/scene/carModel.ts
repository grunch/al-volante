import * as THREE from 'three';
import { SCENE_COLORS } from './colors.ts';
import { bodyBox } from '../sim/vehicle.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';

const WHEEL_RADIUS_M = 0.32;
const WHEEL_WIDTH_M = 0.22;

/**
 * Placeholder car with the simulated dimensions: origin at the body centre, length along +z, axles where the
 * simulation puts them. The cabin model of F03-T03 replaces the looks, not these proportions.
 */
export function createCarModel(spec: VehicleSpec): THREE.Group {
  const car = new THREE.Group();
  car.name = 'placeholder-car';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(spec.widthM, 0.7, spec.lengthM),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.turquoise, metalness: 0.2, roughness: 0.5 }),
  );
  body.name = 'body';
  body.position.y = 0.65;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(spec.widthM - 0.2, 0.6, spec.lengthM / 2),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.ivory, roughness: 0.3 }),
  );
  cabin.name = 'cabin';
  cabin.position.set(0, 1.3, -0.2);
  car.add(body, cabin);
  const rearAxleZ = -(spec.lengthM / 2 - spec.rearOverhangM);
  const wheelX = spec.widthM / 2 - WHEEL_WIDTH_M / 2;
  for (const [x, z, front] of [
    [wheelX, rearAxleZ + spec.wheelbaseM, true],
    [-wheelX, rearAxleZ + spec.wheelbaseM, true],
    [wheelX, rearAxleZ, false],
    [-wheelX, rearAxleZ, false],
  ] as const) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL_RADIUS_M, WHEEL_RADIUS_M, WHEEL_WIDTH_M, 24),
      new THREE.MeshStandardMaterial({ color: SCENE_COLORS.tire, roughness: 0.9 }),
    );
    wheel.name = 'wheel';
    wheel.userData.front = front;
    // The cylinder axis turns to x; steering then turns it about the vertical.
    wheel.rotation.set(0, 0, Math.PI / 2);
    wheel.position.set(x, WHEEL_RADIUS_M, z);
    car.add(wheel);
  }
  return car;
}

/** Places the model where the simulation says the car is, with the front wheels at the steering angle. */
export function poseCar(car: THREE.Group, spec: VehicleSpec, state: VehicleState): void {
  const body = bodyBox(spec, state);
  car.position.set(body.centerX, 0, body.centerZ);
  car.rotation.y = state.headingRad;
  for (const wheel of car.children) {
    if (wheel.name === 'wheel' && wheel.userData.front === true) wheel.rotation.set(0, state.steerRad, Math.PI / 2);
  }
}
