import * as THREE from 'three';

export type Shape = 'box' | 'sphere' | 'cylinder';
export type Surface = 'matte' | 'glass' | 'brick' | 'pavement';
export interface Part {
  shape: Shape;
  color: string;
  position: [number, number, number];
  size: [number, number, number];
  heading?: number;
  tilt?: number;
  surface?: Surface;
}

/** Per-instance color keeps facade variety from multiplying draw calls. */
export function instantiate(parts: readonly Part[]): THREE.Group {
  const root = new THREE.Group();
  const batches = new Map<string, Part[]>();
  for (const part of parts) {
    const key = `${part.shape}:${part.surface ?? 'matte'}`;
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
    const mesh = new THREE.InstancedMesh(geometry, createMaterial(first.surface ?? 'matte'), batch.length);
    mesh.name = `batch-${first.shape}-${first.surface ?? 'matte'}`;
    batch.forEach((part, index) => {
      transform.position.set(...part.position);
      transform.scale.set(...part.size);
      transform.rotation.set(0, part.heading ?? 0, part.tilt ?? 0, 'YXZ');
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
      mesh.setColorAt(index, new THREE.Color(part.color));
    });
    mesh.castShadow = first.surface !== 'pavement';
    mesh.receiveShadow = first.surface === 'pavement';
    mesh.computeBoundingSphere();
    root.add(mesh);
  }
  return root;
}

/** Original procedural grain and mortar: no downloaded imagery, textures or per-frame allocations. */
function createMaterial(surface: Surface): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    roughness: surface === 'glass' ? 0.28 : 0.9,
    metalness: surface === 'glass' ? 0.25 : 0,
  });
  if (surface === 'brick') {
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
        #include <project_vertex>
      `,
      );
      shader.fragmentShader = 'varying vec3 vCityPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        float grain = fract(sin(dot(floor(vCityPosition * 90.0), vec3(12.9898, 78.233, 45.164))) * 43758.5453);
        diffuseColor.rgb *= 0.93 + 0.14 * grain;
        float row = fract(vCityPosition.y / 0.24);
        float mortar = 1.0 - smoothstep(0.03, 0.08, min(row, 1.0-row));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.38, 0.34, 0.29), mortar * 0.38);
      `,
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
      if (material instanceof THREE.MeshBasicMaterial) material.map?.dispose();
      material.dispose();
    }
    if (object instanceof THREE.InstancedMesh) object.dispose();
  });
}
