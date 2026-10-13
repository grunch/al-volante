import * as THREE from 'three';
import { disposeSector, instantiate } from './geometry.ts';
import type { Surface } from './geometry.ts';

/** The material a single part of `surface` gets, compiled against the real standard shader sources. */
function compiled(surface: Surface) {
  const group = instantiate([{ shape: 'box', color: '#808080', position: [0, 0, 0], size: [1, 1, 1], surface }]);
  const mesh = group.children[0] as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  const shader = {
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  } as unknown as THREE.WebGLProgramParametersWithUniforms;
  mesh.material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return { group, material: mesh.material, shader };
}

describe('procedural city surfaces', () => {
  it('projects the pavement and sidewalk grain from world positions, instancing included', () => {
    for (const [surface, scale] of [
      ['pavement', '0.8'],
      ['sidewalk', '0.625'],
    ] as const) {
      // Act
      const { group, material, shader } = compiled(surface);

      // Assert: the anchor of three's vertex chunk was found, so the world projection really reaches the GPU.
      expect(shader.vertexShader).toContain('cityPosition = instanceMatrix * cityPosition;');
      expect(shader.vertexShader).toContain('vCityPosition = (modelMatrix * cityPosition).xyz;');
      expect(shader.vertexShader).toContain(`vMapUv = vCityPosition.xz * ${scale};`);
      expect(shader.vertexShader).toContain(`vBumpMapUv = vCityPosition.xz * ${scale};`);
      expect(shader.vertexShader.match(/#include <project_vertex>/g)).toHaveLength(1);
      expect(shader.fragmentShader.startsWith('varying vec3 vCityPosition;')).toBe(true);
      expect(material.map).toBeInstanceOf(THREE.DataTexture);
      expect(material.bumpMap).toBe(material.map);
      // One program per surface: the cache key keeps the variants apart.
      expect(material.customProgramCacheKey()).toBe(surface);
      disposeSector(group);
    }
  });

  it('adds mortar to brick, weathering to pavement and a reflection band to glass after the base colour', () => {
    const details: Record<string, string> = { brick: 'mortar', pavement: 'weathering', glass: 'reflectionBand' };
    for (const [surface, detail] of Object.entries(details) as [Surface, string][]) {
      const { group, shader } = compiled(surface);
      const fragment = shader.fragmentShader;
      expect(fragment.indexOf(detail)).toBeGreaterThan(fragment.indexOf('#include <color_fragment>'));
      for (const other of Object.values(details).filter((item) => item !== detail))
        expect(fragment).not.toContain(other);
      disposeSector(group);
    }
    // The sidewalk keeps its baked tiles and adds no procedural colour.
    const sidewalk = compiled('sidewalk');
    for (const detail of Object.values(details)) expect(sidewalk.shader.fragmentShader).not.toContain(detail);
    disposeSector(sidewalk.group);
  });

  it('leaves matte surfaces on the stock shader, without textures', () => {
    const group = instantiate([{ shape: 'box', color: '#808080', position: [0, 0, 0], size: [1, 1, 1] }]);
    const material = (group.children[0] as THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>)
      .material;
    expect(material.onBeforeCompile).toBe(THREE.Material.prototype.onBeforeCompile);
    expect(material.map).toBeNull();
    disposeSector(group);
  });
});
