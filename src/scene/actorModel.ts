import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ActorKind } from '../sim/scenario.ts';

/** Original, unbranded silhouettes. All parts fit the actor's existing evaluated width and length. */
export function decorateActor(root: THREE.Mesh, kind: ActorKind, width: number, length: number, height: number) {
  const batches = new Map<string, THREE.BufferGeometry[]>();
  const add = (geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rotationZ = 0) => {
    geometry.rotateZ(rotationZ);
    geometry.translate(x, y - height / 2, z);
    const batch = batches.get(color) ?? [];
    batch.push(geometry);
    batches.set(color, batch);
  };
  const box = (w: number, h: number, l: number, color: string, x: number, y: number, z: number, radius = 0.03) =>
    add(new RoundedBoxGeometry(w, h, l, 1, Math.min(radius, w / 3, h / 3, l / 3)), color, x, y, z);
  if (kind === 'vehicle' || kind === 'emergency' || kind === 'bus') {
    const bus = kind === 'bus';
    const paint = bus ? '#ddd2b8' : kind === 'emergency' ? '#e7e7db' : '#9c443c';
    const tireRadius = bus ? 0.43 : 0.3;
    box(width * 0.98, height * 0.42, length * 0.98, paint, 0, height * 0.4, 0, 0.13);
    box(
      width * 0.85,
      height * 0.4,
      length * (bus ? 0.92 : 0.49),
      '#34444c',
      0,
      height * 0.76,
      bus ? 0 : -length * 0.07,
      0.15,
    );
    box(width * 0.88, 0.09, length * (bus ? 0.94 : 0.42), paint, 0, height - 0.06, bus ? 0 : -length * 0.07, 0.04);
    for (const side of [-1, 1]) {
      for (const z of [-length * 0.31, length * 0.3]) {
        add(
          new THREE.CylinderGeometry(tireRadius, tireRadius, width * 0.12, 16),
          '#222629',
          side * width * 0.43,
          tireRadius,
          z,
          Math.PI / 2,
        );
        add(
          new THREE.CylinderGeometry(tireRadius * 0.63, tireRadius * 0.63, width * 0.125, 12),
          '#969b9b',
          side * width * 0.435,
          tireRadius,
          z,
          Math.PI / 2,
        );
      }
      box(width * 0.03, height * 0.35, 0.07, paint, side * width * 0.43, height * 0.74, -length * 0.04);
      box(width * 0.03, 0.035, 0.14, '#a6a9a6', side * width * 0.485, height * 0.53, -length * 0.11);
      box(width * 0.21, 0.11, 0.035, '#e0dfc6', side * width * 0.32, height * 0.43, length * 0.49);
      box(width * 0.2, 0.13, 0.035, '#b82921', side * width * 0.33, height * 0.48, -length * 0.49);
    }
    box(width * 0.45, 0.12, 0.03, '#222629', 0, height * 0.31, length * 0.49);
    if (bus) {
      for (let z = -length * 0.4; z <= length * 0.4; z += length / 9)
        box(width * 0.87, height * 0.38, 0.05, paint, 0, height * 0.76, z);
      box(width, 0.13, length * 0.98, '#518d8e', 0, height * 0.45, 0);
    } else if (kind === 'emergency') {
      box(width * 0.68, 0.09, 0.2, '#397bbf', 0, height - 0.015, 0);
    }
  } else {
    const cyclist = kind === 'bicycle';
    const headY = cyclist ? 1.43 : 1.56;
    const torsoY = cyclist ? 1.08 : 1.12;
    add(new THREE.SphereGeometry(0.13, 10, 8), '#bb9a80', 0, headY, 0);
    box(Math.min(width * 0.7, 0.4), 0.48, 0.24, cyclist ? '#c6a24d' : '#496c88', 0, torsoY, 0, 0.08);
    for (const side of [-1, 1]) {
      box(0.12, 0.57, 0.14, '#333c46', side * 0.12, cyclist ? 0.68 : 0.55, side * 0.05);
      box(0.12, 0.43, 0.13, '#496c88', side * Math.min(width * 0.38, 0.26), torsoY - 0.04, 0.015);
      box(0.13, 0.12, 0.22, '#222629', side * 0.12, cyclist ? 0.4 : 0.22, 0.035);
    }
    if (cyclist) {
      for (const z of [-length * 0.31, length * 0.31]) {
        const wheel = new THREE.TorusGeometry(0.3, 0.027, 6, 18);
        wheel.rotateY(Math.PI / 2);
        add(wheel, '#222629', 0, 0.33, z);
      }
      box(0.06, 0.08, length * 0.63, '#acada4', 0, 0.55, 0);
      box(width * 0.8, 0.045, 0.065, '#acada4', 0, 1, length * 0.3);
      box(0.055, 0.6, 0.055, '#acada4', 0, 0.65, length * 0.3);
    }
  }
  const materials = Array.isArray(root.material) ? root.material : [root.material];
  materials.forEach((material) => {
    material.visible = false;
  });
  // Vertex colors let tyres, lamps and bodywork share one draw call. Only glass needs a separate finish.
  const finishes = new Map<boolean, THREE.BufferGeometry[]>();
  for (const [color, geometries] of batches) {
    const tint = new THREE.Color(color);
    for (const geometry of geometries) {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      if (flat !== geometry) geometry.dispose();
      const count = flat.getAttribute('position').count;
      const colors = new Float32Array(count * 3);
      for (let index = 0; index < count; index++) tint.toArray(colors, index * 3);
      flat.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const glass = color === '#34444c';
      const batch = finishes.get(glass) ?? [];
      batch.push(flat);
      finishes.set(glass, batch);
    }
  }
  for (const [glass, geometries] of finishes) {
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) throw new Error('Actor geometry could not be merged');
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: glass ? 0.2 : 0.65,
      metalness: glass ? 0.35 : 0.1,
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'actor-bodywork';
    root.add(mesh);
  }
}
