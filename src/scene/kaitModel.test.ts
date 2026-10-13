import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadKaitModel } from './kaitModel.ts';

const parser = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    parseAsync = parser.parse;
  },
}));

describe('loadKaitModel', () => {
  let car: THREE.Group;
  let fetchModel: ReturnType<typeof vi.fn>;
  const bytes = new ArrayBuffer(12);
  beforeEach(() => {
    car = new THREE.Group();
    car.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
    car.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial({ transparent: true })));
    car.add(new THREE.Mesh(new THREE.BoxGeometry(), [new THREE.MeshStandardMaterial()]));
    parser.parse.mockReset().mockResolvedValue({ scene: car });
    fetchModel = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => bytes });
    vi.stubGlobal('fetch', fetchModel);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads the bundled GLB, names the car and configures opaque shadows and transparent glass', async () => {
    const signal = new AbortController().signal;
    const result = await loadKaitModel(signal);
    expect(fetchModel).toHaveBeenCalledWith(expect.stringMatching(/kait\.glb/), { signal });
    expect(parser.parse).toHaveBeenCalledWith(bytes, '');
    expect(result).toBe(car);
    expect(car.name).toBe('kait-car');
    const [body, glass] = car.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
    expect(body!.castShadow).toBe(true);
    expect(body!.receiveShadow).toBe(true);
    expect(glass!.castShadow).toBe(false);
    expect(glass!.material.depthWrite).toBe(false);
  });

  it('reports HTTP errors without trying to parse an error document', async () => {
    fetchModel.mockResolvedValue({ ok: false, status: 404 });
    await expect(loadKaitModel(new AbortController().signal)).rejects.toThrow('HTTP 404');
    expect(parser.parse).not.toHaveBeenCalled();
  });

  it('propagates a malformed asset error', async () => {
    parser.parse.mockRejectedValue(new Error('Invalid GLB'));
    await expect(loadKaitModel(new AbortController().signal)).rejects.toThrow('Invalid GLB');
  });

  it('does not parse data after a cancelled download', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadKaitModel(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(parser.parse).not.toHaveBeenCalled();
  });

  it('disposes geometry and materials when cancellation happens during parsing', async () => {
    const controller = new AbortController();
    const mesh = car.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>;
    const geometry = vi.spyOn(mesh.geometry, 'dispose');
    const material = vi.spyOn(mesh.material, 'dispose');
    parser.parse.mockImplementation(async () => {
      controller.abort();
      return { scene: car };
    });
    await expect(loadKaitModel(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(geometry).toHaveBeenCalledOnce();
    expect(material).toHaveBeenCalledOnce();
  });
});
