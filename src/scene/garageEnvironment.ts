import * as THREE from 'three';

/** A small procedural studio panorama supplies soft reflections without another network asset. */
export function createGarageEnvironment(): THREE.DataTexture {
  const width = 128;
  const height = 64;
  const pixels = new Float32Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;
      const ceiling = Math.max(0, 1 - Math.abs(v - 0.23) * 4);
      const softbox =
        Math.exp(-(((u - 0.18) / 0.055) ** 2) - ((v - 0.4) / 0.17) ** 4) +
        Math.exp(-(((u - 0.71) / 0.08) ** 2) - ((v - 0.35) / 0.16) ** 4);
      const brightness = 0.1 + ceiling * 0.35 + softbox * 2.7;
      const offset = (y * width + x) * 4;
      pixels.set([brightness * 0.92, brightness * 0.97, brightness, 1], offset);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}
