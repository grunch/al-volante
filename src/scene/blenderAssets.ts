import * as THREE from 'three';
import { z } from 'zod';
import packedKit from '../assets/blender/city-kit.json?raw';

export const ASSET_NAMES = [
  'car',
  'bus',
  'emergency',
  'pedestrian',
  'bicycle',
  'tree',
  'treeSparse',
  'signal',
  'window',
  'aircon',
  'drain',
  'manhole',
  'treeLow',
  'treeSparseLow',
  'carLow',
  'windowLow',
  'container',
  'scooter',
  'bikeRack',
] as const;
export type BlenderAssetName = (typeof ASSET_NAMES)[number];
const FinishSchema = z.enum(['matte', 'metal', 'paint', 'glass', 'foliage']);
const PackedMeshSchema = z.object({
  finish: FinishSchema,
  position: z.string(),
  normal: z.string(),
  color: z.string(),
  index: z.string(),
});
const KitSchema = z.object({
  version: z.literal(1),
  generator: z.string(),
  models: z.record(z.enum(ASSET_NAMES), z.array(PackedMeshSchema).min(1)),
  surfaces: z.record(z.enum(['asphalt', 'sidewalk']), z.object({ size: z.literal(256), height: z.string() })),
});
const kit = KitSchema.parse(JSON.parse(packedKit));
type Finish = z.infer<typeof FinishSchema>;
interface DecodedMesh {
  finish: Finish;
  position: Float32Array;
  normal: Int16Array;
  color: Uint8Array;
  index: Uint16Array;
}
const decoded = new Map<BlenderAssetName, DecodedMesh[]>();

/** Decode a base64 catalog field into a new buffer for typed-array views. */
function bytes(value: string): ArrayBuffer {
  const binary = atob(value);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return array.buffer;
}

/** Cache immutable CPU data only. Each scene owns and releases its GPU geometry and materials. */
function decode(name: BlenderAssetName): DecodedMesh[] {
  const cached = decoded.get(name);
  if (cached) return cached;
  const meshes = kit.models[name].map((part) => {
    const position = new Float32Array(bytes(part.position));
    const normal = new Int16Array(bytes(part.normal));
    const color = new Uint8Array(bytes(part.color));
    const index = new Uint16Array(bytes(part.index));
    if (
      position.length === 0 ||
      position.length % 3 !== 0 ||
      normal.length !== position.length ||
      color.length !== position.length ||
      index.length % 3 !== 0 ||
      position.some((value) => !Number.isFinite(value)) ||
      index.some((value) => value >= position.length / 3)
    )
      throw new Error(`Invalid Blender geometry: ${name}`);
    return { finish: part.finish, position, normal, color, index };
  });
  decoded.set(name, meshes);
  return meshes;
}

/** Create a vertex-colored material with the exported finish and foliage shading settings. */
function material(finish: Finish): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: finish === 'glass' ? 0.18 : finish === 'metal' ? 0.3 : finish === 'paint' ? 0.32 : 0.86,
    metalness: finish === 'metal' ? 0.65 : finish === 'glass' ? 0.35 : finish === 'paint' ? 0.22 : 0,
    side: finish === 'foliage' ? THREE.DoubleSide : THREE.FrontSide,
    emissive: finish === 'foliage' ? '#394725' : '#000000',
    emissiveIntensity: finish === 'foliage' ? 0.1 : 0,
  });
}

/** The runtime consumes Blender's evaluated bevels, weighted normals and linear vertex colours. */
export function createBlenderMeshes(
  name: BlenderAssetName,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] {
  return decode(name).map((data) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.position.slice(), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normal.slice(), 3, true));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.color.slice(), 3, true));
    geometry.setIndex(new THREE.BufferAttribute(data.index.slice(), 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material(data.finish));
    mesh.name = `blender-${name}-${data.finish}`;
    mesh.castShadow = data.finish !== 'glass';
    mesh.receiveShadow = data.finish !== 'foliage';
    return mesh;
  });
}

/** Group an asset's meshes with fresh geometry and materials owned and disposed by the caller. */
export function createBlenderModel(name: BlenderAssetName): THREE.Group {
  const group = new THREE.Group();
  group.name = `blender-${name}`;
  group.add(...createBlenderMeshes(name));
  return group;
}

/** Blender-baked height fields are bundled with the models, so there is no late texture pop-in. */
export function readBlenderSurface(name: 'asphalt' | 'sidewalk'): { size: number; height: Uint8Array } {
  const source = kit.surfaces[name];
  const height = new Uint8Array(bytes(source.height));
  if (height.length !== source.size * source.size) throw new Error(`Invalid Blender surface: ${name}`);
  return { size: source.size, height };
}
