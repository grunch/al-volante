import * as THREE from 'three';

/** Clustered leaf sprays with gaps and irregular silhouettes, shared by all instances in a sector. */
export function createFoliageGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [];
  const colors: number[] = [];
  let seed = 73;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 220; i++) {
    const azimuth = random() * Math.PI * 2;
    const vertical = random() * 2 - 1;
    const radius = Math.cbrt(random()) * 0.47;
    const center = new THREE.Vector3(
      Math.sqrt(1 - vertical * vertical) * Math.cos(azimuth) * radius,
      vertical * radius,
      Math.sqrt(1 - vertical * vertical) * Math.sin(azimuth) * radius,
    );
    const rotation = new THREE.Euler(random() * Math.PI, random() * Math.PI, random() * Math.PI);
    const length = 0.028 + random() * 0.035;
    const width = length * 0.55;
    const points = [
      [-width, 0, 0],
      [0, length, 0.012],
      [width, 0, 0],
      [0, -length, 0.008],
    ] as const;
    const shade = 0.85 + random() * 0.3;
    for (const index of [0, 1, 2, 0, 2, 3] as const) {
      const point = points[index];
      const vertex = new THREE.Vector3(point[0], point[1], point[2]).applyEuler(rotation).add(center);
      vertices.push(vertex.x, vertex.y, vertex.z);
      colors.push(shade, shade, shade);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
