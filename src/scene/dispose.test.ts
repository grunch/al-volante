import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeScene } from './dispose.ts';

describe('disposeScene', () => {
  it('releases meshes, lines (such as the grid helper) and points, with every material', () => {
    // Arrange
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [
      new THREE.MeshBasicMaterial(),
      new THREE.MeshBasicMaterial(),
    ]);
    const grid = new THREE.GridHelper(10, 10);
    const points = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial());
    scene.add(mesh, grid, points);
    const disposed = [
      mesh.geometry,
      ...mesh.material,
      grid.geometry,
      ...[grid.material].flat(),
      points.geometry,
      points.material,
    ].map((resource) => vi.spyOn(resource, 'dispose'));

    // Act
    disposeScene(scene);

    // Assert
    for (const spy of disposed) expect(spy).toHaveBeenCalledTimes(1);
  });

  it('releases a geometry or material shared by several drawables only once', () => {
    // Arrange
    const scene = new THREE.Scene();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshBasicMaterial();
    scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, [material, material]));
    const releases = [vi.spyOn(geometry, 'dispose'), vi.spyOn(material, 'dispose')];

    // Act
    disposeScene(scene);

    // Assert
    for (const release of releases) expect(release).toHaveBeenCalledOnce();
  });
});
