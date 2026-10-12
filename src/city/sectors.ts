import type { Point } from '../sim/collision.ts';

export const SECTOR_SIZE_M = 128;
/** Fog ends at 170 m; the extra radius covers geometry that extends beyond its owning tile. */
export const LOAD_RADIUS_M = 220;
const UNLOAD_RADIUS_M = 270;
export const sectorKey = (point: Point): string =>
  `${Math.floor(point.x / SECTOR_SIZE_M)}:${Math.floor(point.z / SECTOR_SIZE_M)}`;
export function sectorDistance(key: string, point: Point): number {
  const [x, z] = key.split(':').map(Number);
  if (x === undefined || z === undefined || !Number.isFinite(x) || !Number.isFinite(z))
    throw new Error('Invalid sector key');
  return Math.hypot(
    Math.max(x * SECTOR_SIZE_M - point.x, 0, point.x - (x + 1) * SECTOR_SIZE_M),
    Math.max(z * SECTOR_SIZE_M - point.z, 0, point.z - (z + 1) * SECTOR_SIZE_M),
  );
}

/** Owns lifecycle only. Visual sectors can disappear without changing the simulation world. */
export class SectorSet {
  readonly active = new Set<string>();
  constructor(
    private readonly keys: readonly string[],
    private readonly load: (key: string) => void,
    private readonly unload: (key: string) => void,
  ) {}
  update(position: Point): void {
    for (const key of this.keys) {
      const distanceM = sectorDistance(key, position);
      if (distanceM <= LOAD_RADIUS_M && !this.active.has(key)) {
        this.load(key);
        this.active.add(key);
      } else if (distanceM > UNLOAD_RADIUS_M && this.active.has(key)) {
        this.unload(key);
        this.active.delete(key);
      }
    }
  }
  dispose(): void {
    for (const key of this.active) this.unload(key);
    this.active.clear();
  }
}
