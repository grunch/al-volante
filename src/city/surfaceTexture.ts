import * as THREE from 'three';

/** Small, tileable, original texture. Seeded grain remains fixed in world space while the driver moves. */
export function createSurfaceTexture(sidewalk: boolean): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  let seed = 1871;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const random = seed / 4294967296;
      const joint = sidewalk && (x % 32 < 2 || y % 32 < 2);
      const tile = sidewalk ? (Math.floor(x / 32) + Math.floor(y / 32) * 3) % 5 : 0;
      const value = joint ? 115 : Math.round((sidewalk ? 224 - tile * 5 : 195) + random * (sidewalk ? 20 : 60));
      const at = (y * size + x) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = value;
      pixels[at + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
