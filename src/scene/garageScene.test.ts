import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createGarageScene } from './garageScene.ts';

describe('createGarageScene', () => {
  it('builds the floor, parking box, lights and placeholder car', () => {
    // Arrange / Act
    const garage = createGarageScene({ reducedMotion: false });

    // Assert
    for (const name of ['floor', 'parking-box', 'lights', 'placeholder-car']) {
      expect(garage.scene.getObjectByName(name), name).toBeDefined();
    }
    const car = garage.scene.getObjectByName('placeholder-car');
    expect(car?.children.filter((child) => child.name === 'wheel')).toHaveLength(4);
  });

  it('draws a 6 m parking box, matching protocol graphic 4', () => {
    const garage = createGarageScene({ reducedMotion: false });
    const box = garage.scene.getObjectByName('parking-box');
    const bounds = new THREE.Box3().setFromObject(box as THREE.Object3D);

    expect(bounds.max.x - bounds.min.x).toBeCloseTo(6.1, 5);
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
    const disposals: Array<ReturnType<typeof vi.spyOn>> = [];
    garage.scene.traverse((object) => {
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
