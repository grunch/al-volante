import * as THREE from 'three';
import { createCityRenderer } from './lighting.ts';

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  /** jsdom has no WebGL: a stand-in that keeps the constructor options and the settable renderer state. */
  class WebGLRenderer {
    readonly shadowMap = { enabled: false, type: actual.PCFSoftShadowMap };
    toneMapping: THREE.ToneMapping = actual.NoToneMapping;
    toneMappingExposure = 1;
    constructor(readonly parameters: THREE.WebGLRendererParameters) {}
  }
  return { ...actual, WebGLRenderer };
});

describe('city renderer', () => {
  it('enables the shadow map the cached sun shadows need, with filmic tone mapping and antialiasing', () => {
    const renderer = createCityRenderer() as unknown as THREE.WebGLRenderer & {
      parameters: THREE.WebGLRendererParameters;
    };
    expect(renderer.parameters).toEqual({ antialias: true });
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(renderer.shadowMap.type).toBe(THREE.PCFShadowMap);
    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.toneMappingExposure).toBeCloseTo(1.05, 9);
  });
});
