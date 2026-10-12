import * as THREE from 'three';

export type Shape = 'box' | 'sphere' | 'cylinder';
export interface Part {
  shape: Shape;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
  heading?: number;
}

/** A sector batches repeated architecture into one instanced draw per shape/material. */
export function instantiate(parts: readonly Part[]): THREE.Group {
  const root = new THREE.Group();
  const batches = new Map<string, Part[]>();
  for (const part of parts) {
    const key = `${part.shape}:${part.color}`;
    const batch = batches.get(key) ?? [];
    batch.push(part);
    batches.set(key, batch);
  }
  const transform = new THREE.Object3D();
  for (const batch of batches.values()) {
    const first = batch[0];
    if (!first) continue;
    const geometry =
      first.shape === 'box'
        ? new THREE.BoxGeometry(1, 1, 1)
        : first.shape === 'sphere'
          ? new THREE.IcosahedronGeometry(0.5, 1)
          : new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    const mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: first.color, roughness: 0.88 }),
      batch.length,
    );
    mesh.name = `batch-${first.shape}-${first.color}`;
    batch.forEach((part, index) => {
      transform.position.set(...part.position);
      transform.scale.set(...part.size);
      transform.rotation.set(0, part.heading ?? 0, 0);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  return root;
}

export function disposeSector(root: THREE.Group): void {
  root.removeFromParent();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
      material.dispose();
    }
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
}
