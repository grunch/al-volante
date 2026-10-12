import * as THREE from 'three';
import { ASSET_NAMES, createBlenderModel, readBlenderSurface } from './blenderAssets.ts';
import { disposeScene } from './dispose.ts';
import { createActor } from './trackScene.ts';

describe('Blender street assets', () => {
  it.each(ASSET_NAMES)('loads finite, indexed %s geometry with normals and independent resources', (name) => {
    const first = createBlenderModel(name);
    const second = createBlenderModel(name);
    let triangles = 0;
    first.children.forEach((child, i) => {
      expect(child).toBeInstanceOf(THREE.Mesh);
      const mesh = child as THREE.Mesh;
      const counterpart = second.children[i] as THREE.Mesh;
      expect(mesh.geometry).not.toBe(counterpart.geometry);
      expect(mesh.material).not.toBe(counterpart.material);
      const position = mesh.geometry.getAttribute('position');
      const normal = mesh.geometry.getAttribute('normal');
      expect(mesh.geometry.getAttribute('color').count).toBe(position.count);
      expect(normal.count).toBe(position.count);
      for (let vertex = 0; vertex < normal.count; vertex++) {
        expect(Math.hypot(normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex))).toBeCloseTo(1, 3);
      }
      triangles += mesh.geometry.index!.count / 3;
      const release = vi.spyOn(counterpart.geometry, 'dispose');
      expect(release).not.toHaveBeenCalled();
    });
    const bounds = new THREE.Box3().setFromObject(first);
    expect(bounds.isEmpty()).toBe(false);
    expect(
      Number.isFinite(bounds.min.x + bounds.min.y + bounds.min.z + bounds.max.x + bounds.max.y + bounds.max.z),
    ).toBe(true);
    expect(triangles).toBeLessThan(6000);
    disposeScene(first);
    second.children.forEach((child) => expect((child as THREE.Mesh).geometry.dispose).not.toHaveBeenCalled());
    disposeScene(second);
  });

  it('preserves human proportions for cyclists while keeping the bicycle inside its evaluated footprint', () => {
    const cyclist = createActor('rider', 'bicycle', 0.95, 0.35);
    const model = cyclist.getObjectByName('blender-bicycle')!;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(size.y).toBeGreaterThan(1.65);
    expect(size.y).toBeLessThanOrEqual(1.78 + 1e-6);
    expect(size.x).toBeLessThanOrEqual(0.7);
    expect(size.z).toBeLessThanOrEqual(1.9);
    expect(model.scale.x).toBe(model.scale.y);
    expect(model.scale.z).toBe(model.scale.y);
    disposeScene(cyclist);
  });

  it('keeps dynamic actors out of the cached static shadow map', () => {
    const actor = createActor('moving', 'vehicle', 2.1, 0.85);
    actor.traverse((object) => expect(object.castShadow).toBe(false));
    disposeScene(actor);
  });

  it.each(['asphalt', 'sidewalk'] as const)('loads repeatable %s height fields with actual surface detail', (name) => {
    const first = readBlenderSurface(name);
    const second = readBlenderSurface(name);
    expect(first.height).toEqual(second.height);
    expect(first.height).not.toBe(second.height);
    expect(first.height.length).toBe(first.size ** 2);
    expect(new Set(first.height).size).toBeGreaterThan(40);
  });
});
