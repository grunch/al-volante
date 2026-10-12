import * as THREE from 'three';

/** Releases the GPU resources of every drawable in a scene: meshes, lines (grid helpers included) and points. */
export function disposeScene(scene: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const released = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      if (!geometries.has(object.geometry)) object.geometry.dispose();
      geometries.add(object.geometry);
      const materials: THREE.Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!released.has(material)) material.dispose();
        released.add(material);
      }
    }
  });
}
