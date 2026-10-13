// @vitest-environment node
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { expect, it } from 'vitest';
import { disposeScene } from './dispose.ts';
import report from '../assets/blender/kait-report.json';

it('loads the real Blender asset within its transfer, triangle and primitive budgets', async () => {
  const bytes = readFileSync('src/assets/blender/kait.glb');
  expect(bytes.byteLength).toBeLessThanOrEqual(report.limits.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(report.asset_sha256);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const { scene } = await new GLTFLoader().parseAsync(buffer, '');
  let triangles = 0;
  let primitives = 0;
  const materials = new Set<string>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position!.count) / 3;
      primitives++;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material.name);
        expect((material as THREE.MeshStandardMaterial).map).toBeNull();
      }
    }
  });
  expect(triangles).toBe(report.triangles);
  expect(triangles).toBeLessThanOrEqual(report.limits.triangles);
  expect(primitives).toBeLessThanOrEqual(30);
  expect(materials).toContain('Pearl white multilayer paint');
  expect(materials).toContain('Tire rubber');
  expect(materials).toContain('Lightly tinted laminated glass');
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  expect(size.x).toBeCloseTo(2.16, 1);
  expect(size.y).toBeCloseTo(1.627, 1);
  expect(size.z).toBeCloseTo(4.408, 1);
  disposeScene(scene);
});
