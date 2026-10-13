import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import {
  APPROXIMATE_PARKING_BOX_WIDTH_M,
  PARKING_BOX_LENGTH_M,
  createGarageScene as buildGarageScene,
} from './garageScene.ts';

function createGarageScene(options: { reducedMotion: boolean }) {
  const car = new THREE.Group();
  car.name = 'kait-car';
  car.add(new THREE.Mesh(new THREE.BoxGeometry(1.76, 1.61, 4.3), new THREE.MeshStandardMaterial()));
  return buildGarageScene({ ...options, car });
}

describe('createGarageScene', () => {
  it('builds the studio garage around the supplied Kait model', () => {
    // Arrange / Act
    const garage = createGarageScene({ reducedMotion: false });

    // Assert
    for (const name of ['floor', 'parking-box', 'lights', 'kait-car']) {
      expect(garage.scene.getObjectByName(name), name).toBeDefined();
    }
    const car = garage.scene.getObjectByName('kait-car');
    expect(car?.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(garage.scene.environment).toBeInstanceOf(THREE.DataTexture);
    garage.dispose();
  });

  it('draws a parking box 6 m long outside its painted lines, matching protocol graphic 4', () => {
    const garage = createGarageScene({ reducedMotion: false });
    const box = garage.scene.getObjectByName('parking-box');
    const bounds = new THREE.Box3().setFromObject(box as THREE.Object3D);

    expect(bounds.max.x - bounds.min.x).toBeCloseTo(PARKING_BOX_LENGTH_M, 5);
    expect(PARKING_BOX_LENGTH_M).toBe(6);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(APPROXIMATE_PARKING_BOX_WIDTH_M, 5);
  });

  it('orbits the camera over time when motion is allowed', () => {
    const garage = createGarageScene({ reducedMotion: false });
    const before = garage.camera.position.clone();

    garage.update(10);

    expect(garage.camera.position.distanceTo(before)).toBeGreaterThan(0.5);
  });

  it('keeps the camera still when the user prefers reduced motion', () => {
    const garage = createGarageScene({ reducedMotion: true });
    const before = garage.camera.position.clone();

    garage.update(10);

    expect(garage.camera.position.equals(before)).toBe(true);
  });

  it('updates the camera aspect ratio on resize and ignores empty sizes', () => {
    const garage = createGarageScene({ reducedMotion: false });

    garage.resize(800, 400);
    garage.resize(0, 300);

    expect(garage.camera.aspect).toBe(2);
  });

  it('disposes every geometry and material', () => {
    const garage = createGarageScene({ reducedMotion: false });
    const disposals: Array<ReturnType<typeof vi.spyOn>> = [vi.spyOn(garage.scene.environment!, 'dispose')];
    garage.scene.traverse((object) => {
      if (object instanceof THREE.DirectionalLight) disposals.push(vi.spyOn(object.shadow, 'dispose'));
      if (object instanceof THREE.Mesh) {
        disposals.push(vi.spyOn(object.geometry, 'dispose'));
        disposals.push(vi.spyOn(object.material as THREE.Material, 'dispose'));
      }
    });

    garage.dispose();

    expect(disposals.length).toBeGreaterThan(0);
    for (const spy of disposals) expect(spy).toHaveBeenCalled();
  });
});

it('fits the entire vehicle at narrow aspect ratios and preserves the orbit after resizing', () => {
  const garage = createGarageScene({ reducedMotion: false });
  garage.update(12);
  const angle = Math.atan2(garage.camera.position.x, garage.camera.position.z);
  const wideDistance = garage.camera.position.length();
  garage.resize(280, 300);
  expect(garage.camera.position.length()).toBeGreaterThan(wideDistance);
  expect(Math.atan2(garage.camera.position.x, garage.camera.position.z)).toBeCloseTo(angle);
  const car = garage.scene.getObjectByName('kait-car')!;
  const bounds = new THREE.Box3().setFromObject(car);
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [0, 1.61]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        garage.camera.updateMatrixWorld();
        const point = new THREE.Vector3(x, y, z).project(garage.camera);
        expect(Math.abs(point.x)).toBeLessThan(1);
        expect(Math.abs(point.y)).toBeLessThan(1);
      }
    }
  }
  garage.dispose();
});
