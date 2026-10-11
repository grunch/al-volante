/** A rectangle on the ground plane, rotated like the car (heading 0 faces +z). */
export interface OrientedBox {
  centerX: number;
  centerZ: number;
  /** Half the extent along the heading. */
  halfLengthM: number;
  /** Half the extent across the heading. */
  halfWidthM: number;
  headingRad: number;
}

export interface Point {
  x: number;
  z: number;
}

/** Overlaps thinner than this (a tenth of a millimetre) count as touching, not intersecting. */
const OVERLAP_EPSILON_M = 1e-4;

function axesOf(box: OrientedBox): [Point, Point] {
  const forward = { x: Math.sin(box.headingRad), z: Math.cos(box.headingRad) };
  return [forward, { x: forward.z, z: -forward.x }];
}

export function cornersOf(box: OrientedBox): Point[] {
  const [forward, side] = axesOf(box);
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([along, across]) => ({
    x: box.centerX + forward.x * box.halfLengthM * (along as number) + side.x * box.halfWidthM * (across as number),
    z: box.centerZ + forward.z * box.halfLengthM * (along as number) + side.z * box.halfWidthM * (across as number),
  }));
}

function project(points: readonly Point[], axis: Point): [number, number] {
  const values = points.map((point) => point.x * axis.x + point.z * axis.z);
  return [Math.min(...values), Math.max(...values)];
}

/** Separating axis test on the four edge normals; boxes that only touch do not overlap. */
export function overlaps(a: OrientedBox, b: OrientedBox): boolean {
  const cornersA = cornersOf(a);
  const cornersB = cornersOf(b);
  return [...axesOf(a), ...axesOf(b)].every((axis) => {
    const [minA, maxA] = project(cornersA, axis);
    const [minB, maxB] = project(cornersB, axis);
    return Math.min(maxA, maxB) - Math.max(minA, minB) > OVERLAP_EPSILON_M;
  });
}

function pointToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared));
  return Math.hypot(point.x - (start.x + t * dx), point.z - (start.z + t * dz));
}

function vertexToEdges(from: readonly Point[], to: readonly Point[]): number {
  return Math.min(
    ...from.flatMap((point) =>
      to.map((start, index) => pointToSegment(point, start, to[(index + 1) % to.length] as Point)),
    ),
  );
}

/** Shortest distance between two boxes; 0 when they overlap. For two convex polygons it is vertex to edge. */
export function clearance(a: OrientedBox, b: OrientedBox): number {
  if (overlaps(a, b)) return 0;
  const cornersA = cornersOf(a);
  const cornersB = cornersOf(b);
  return Math.min(vertexToEdges(cornersA, cornersB), vertexToEdges(cornersB, cornersA));
}
