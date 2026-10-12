import * as THREE from 'three';
import { readBlenderSurface } from '../scene/blenderAssets.ts';

/** Original Blender-baked grain and tile joints, filtered for the driver's grazing viewing angle. */
export function createSurfaceTexture(sidewalk: boolean): THREE.DataTexture {
  const { size, height } = readBlenderSurface(sidewalk ? 'sidewalk' : 'asphalt');
  const pixels = new Uint8Array(size * size * 4);
  for (let i = 0; i < height.length; i++) {
    const value = height[i] ?? 0;
    pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = value;
    pixels[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = 8;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
