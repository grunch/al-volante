import * as THREE from 'three';
import { createSurfaceTexture } from './surfaceTexture.ts';
import { createBlenderMeshes } from '../scene/blenderAssets.ts';
import type { BlenderAssetName } from '../scene/blenderAssets.ts';

export type Shape = 'box' | 'cylinder';
export type Surface = 'matte' | 'glass' | 'brick' | 'pavement' | 'sidewalk';
export interface Part {
  shape: Shape;
  model?: BlenderAssetName;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
  heading?: number;
  tilt?: number;
  surface?: Surface;
  detailDistanceM?: number;
}

interface DetailBatch {
  parts: readonly Part[];
  near: THREE.InstancedMesh[];
  far: THREE.InstancedMesh[];
  distanceM: number;
  mask: boolean[] | null;
}
const details = new WeakMap<THREE.Group, { batches: DetailBatch[]; x: number; z: number }>();
const DISTANT_MODELS: Partial<Record<BlenderAssetName, BlenderAssetName>> = {
  tree: 'treeLow',
  treeSparse: 'treeSparseLow',
  car: 'carLow',
  window: 'windowLow',
};
const DETAIL_DISTANCE: Partial<Record<BlenderAssetName, number>> = {
  tree: 58,
  treeSparse: 58,
  car: 48,
  window: 38,
  aircon: 38,
  drain: 35,
  manhole: 48,
};

function fill(meshes: readonly THREE.InstancedMesh[], parts: readonly Part[]): void {
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  for (const mesh of meshes) {
    mesh.count = parts.length;
    mesh.visible = parts.length > 0;
    parts.forEach((part, index) => {
      transform.position.set(...part.position);
      transform.scale.set(...part.size);
      transform.rotation.set(0, part.heading ?? 0, part.tilt ?? 0, 'YXZ');
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, color.set(part.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
}

/** Pack only visible instances: distant trees/windows never submit their detailed triangles. */
export function updateDetail(root: THREE.Group, position: { x: number; z: number }): boolean {
  const state = details.get(root);
  if (!state || Math.hypot(position.x - state.x, position.z - state.z) < 3) return false;
  state.x = position.x;
  state.z = position.z;
  let changed = false;
  for (const batch of state.batches) {
    const mask = batch.parts.map((part, index) => {
      const distance = Math.hypot(part.position[0] - position.x, part.position[2] - position.z);
      // Hysteresis keeps trees stable when the driver rocks around a detail threshold.
      const margin = batch.mask === null ? 0 : batch.mask[index] ? 3 : -3;
      return distance <= batch.distanceM + margin;
    });
    if (batch.mask && mask.every((value, index) => value === batch.mask?.[index])) continue;
    batch.mask = mask;
    fill(
      batch.near,
      batch.parts.filter((_, index) => mask[index]),
    );
    fill(
      batch.far,
      batch.parts.filter((_, index) => !mask[index]),
    );
    changed = true;
  }
  return changed;
}

/** Per-instance color and distance detail keep dense streets bounded in draw calls and triangles. */
export function instantiate(parts: readonly Part[]): THREE.Group {
  const root = new THREE.Group();
  const batches = new Map<string, Part[]>();
  const dynamic: DetailBatch[] = [];
  for (const part of parts) {
    const key = `${part.model ?? part.shape}:${part.surface ?? 'matte'}:${part.detailDistanceM ?? ''}`;
    const batch = batches.get(key) ?? [];
    batch.push(part);
    batches.set(key, batch);
  }
  const modelMeshes = (model: BlenderAssetName, capacity: number) =>
    createBlenderMeshes(model).map((template) => {
      const mesh = new THREE.InstancedMesh(template.geometry, template.material, capacity);
      mesh.name = `batch-${template.name}`;
      mesh.castShadow = template.castShadow;
      mesh.receiveShadow = template.receiveShadow;
      root.add(mesh);
      return mesh;
    });
  for (const batch of batches.values()) {
    const first = batch[0];
    if (!first) continue;
    let near: THREE.InstancedMesh[];
    if (first.model) near = modelMeshes(first.model, batch.length);
    else {
      const geometry =
        first.shape === 'box' ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
      const mesh = new THREE.InstancedMesh(geometry, createMaterial(first.surface ?? 'matte'), batch.length);
      mesh.name = `batch-${first.shape}-${first.surface ?? 'matte'}`;
      mesh.castShadow = first.surface !== 'pavement' && first.surface !== 'sidewalk';
      mesh.receiveShadow = true;
      root.add(mesh);
      near = [mesh];
    }
    fill(near, batch);
    const distanceM = first.detailDistanceM ?? (first.model ? DETAIL_DISTANCE[first.model] : undefined);
    if (distanceM !== undefined) {
      const farModel = first.model ? DISTANT_MODELS[first.model] : undefined;
      const far = farModel ? modelMeshes(farModel, batch.length) : [];
      fill(far, []);
      dynamic.push({ parts: batch, near, far, distanceM, mask: null });
    }
  }
  details.set(root, { batches: dynamic, x: Infinity, z: Infinity });
  return root;
}

/** Original procedural grain and mortar: no downloaded imagery, textures or per-frame allocations. */
function createMaterial(surface: Surface): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: surface === 'glass' ? 0.28 : 0.9,
    metalness: surface === 'glass' ? 0.4 : 0,
  });
  if (surface === 'pavement' || surface === 'sidewalk') {
    material.map = createSurfaceTexture(surface === 'sidewalk');
    material.bumpMap = material.map;
    material.bumpScale = surface === 'sidewalk' ? 0.012 : 0.003;
  }
  if (surface === 'brick' || surface === 'pavement' || surface === 'sidewalk' || surface === 'glass') {
    material.customProgramCacheKey = () => surface;
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec3 vCityPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        vec4 cityPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cityPosition = instanceMatrix * cityPosition;
        #endif
        vCityPosition = (modelMatrix * cityPosition).xyz;
        #ifdef USE_MAP
          vMapUv = vCityPosition.xz * ${surface === 'sidewalk' ? '0.625' : '0.8'};
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = vCityPosition.xz * ${surface === 'sidewalk' ? '0.625' : '0.8'};
        #endif
        #include <project_vertex>
      `,
      );
      shader.fragmentShader = 'varying vec3 vCityPosition;\n' + shader.fragmentShader;
      const detail =
        surface === 'brick'
          ? `
        float row = fract(vCityPosition.y / 0.085);
        float brick = fract((vCityPosition.x + vCityPosition.z) / 0.245 + mod(floor(vCityPosition.y / 0.085), 2.0) * 0.5);
        float edge = min(min(row, 1.0-row), min(brick, 1.0-brick));
        float aa = max(fwidth(edge), 0.018);
        float mortar = 1.0 - smoothstep(0.025, 0.025 + aa, edge);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.34, 0.29), mortar * 0.38);
      `
          : surface === 'pavement'
            ? `
        float weathering = sin(vCityPosition.x * 1.7 + sin(vCityPosition.z * 0.8)) * sin(vCityPosition.z * 2.3);
        diffuseColor.rgb *= 0.94 + weathering * 0.06;
      `
            : surface === 'glass'
              ? `
        float reflectionBand = smoothstep(0.15, 0.85, fract(vCityPosition.y * 0.11 + vCityPosition.x * 0.018 + vCityPosition.z * 0.025));
        diffuseColor.rgb = mix(diffuseColor.rgb * 0.65, vec3(0.37, 0.46, 0.5), reflectionBand * 0.55);
      `
              : '';
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n' + detail,
      );
    };
  }
  return material;
}

export function disposeSector(root: THREE.Group): void {
  root.removeFromParent();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial)
        material.map?.dispose();
      material.dispose();
    }
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
}
