import * as THREE from 'three';
import type { Point } from '../sim/collision.ts';

/** A static local shadow map is shared by the windshield and mirrors; it updates only as the city streams. */
export function createCityRenderer(): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  return renderer;
}

export function createCityLighting(scene: THREE.Scene) {
  const sun = new THREE.DirectionalLight('#fff2db', 3.0);
  const ambient = new THREE.HemisphereLight('#dce9f3', '#8a8172', 1.5);
  sun.name = 'city-sun';
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 240 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.06;
  sun.shadow.bias = -0.0001;
  sun.shadow.autoUpdate = false;
  let lastKey = '';
  scene.add(sun, sun.target, ambient);
  return {
    update(point: Point, changed: boolean) {
      const x = Math.round(point.x / 24) * 24;
      const z = Math.round(point.z / 24) * 24;
      const key = `${x}:${z}`;
      if (key === lastKey && !changed) return;
      lastKey = key;
      sun.position.set(x - 45, 95, z - 30);
      sun.target.position.set(x, 0, z);
      sun.target.updateMatrixWorld();
      sun.shadow.needsUpdate = true;
    },
    dispose() {
      sun.shadow.dispose();
      sun.removeFromParent();
      sun.target.removeFromParent();
      ambient.removeFromParent();
    },
  };
}
