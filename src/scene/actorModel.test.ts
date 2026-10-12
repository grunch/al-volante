import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createActor } from './trackScene.ts';
import { disposeScene } from './dispose.ts';

describe('actor models', () => {
  it.each([
    ['vehicle', 4.2, 1.7],
    ['bus', 12, 2.5],
    ['emergency', 5, 2],
    ['pedestrian', 0.6, 0.6],
    ['bicycle', 1.9, 0.7],
  ] as const)(
    'keeps the %s silhouette inside its evaluated footprint and releases all its parts',
    (kind, length, width) => {
      const actor = createActor('sample', kind, length / 2, width / 2);
      const bounds = new THREE.Box3().setFromObject(actor);
      expect(bounds.max.x).toBeLessThanOrEqual(width / 2 + 1e-6);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-width / 2 - 1e-6);
      expect(bounds.max.z).toBeLessThanOrEqual(length / 2 + 1e-6);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-length / 2 - 1e-6);
      expect(actor.children.length).toBeGreaterThan(0);
      const resources = new Set<THREE.Material | THREE.BufferGeometry>();
      actor.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        resources.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          resources.add(material);
      });
      const releases = [...resources].map((resource) => vi.spyOn(resource, 'dispose'));
      disposeScene(actor);
      releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
    },
  );
});
