import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import kaitUrl from '../assets/blender/kait.glb?url';
import { disposeScene } from './dispose.ts';

/** Loads the self-contained Blender asset; each mount owns its GPU resources. */
export async function loadKaitModel(signal: AbortSignal): Promise<THREE.Group> {
  const response = await fetch(kaitUrl, { signal });
  if (!response.ok) throw new Error(`Kait model request failed: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  const { scene } = await new GLTFLoader().parseAsync(bytes, '');
  // Parsing cannot be cancelled, so a late result must release its resources itself.
  if (signal.aborted) {
    disposeScene(scene);
    signal.throwIfAborted();
  }
  scene.name = 'kait-car';
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      object.castShadow = materials.every((material) => !material.transparent);
      object.receiveShadow = true;
      for (const material of materials) {
        if (material.transparent) material.depthWrite = false;
      }
    }
  });
  return scene;
}
