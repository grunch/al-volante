import type { Point } from '../sim/collision.ts';
import { overlaps } from '../sim/collision.ts';
import type { Obstacle } from '../sim/world.ts';
import type { Road } from './model.ts';
import { distance, mixPoint, offsetPoint, roadBox } from './model.ts';

/** Photo-inspired parking, only where the modeled single through lane stays clear.
 * Positions are approximate scenery; this is not a claim about legal parking permissions. */
export function planStreetParking(roads: readonly Road[], reserved: readonly Point[]): Obstacle[] {
  const parked: Obstacle[] = [];
  for (const road of roads) {
    if (road.kind !== 'route' || road.lanes !== 1) continue;
    for (const side of [-1, 1]) {
      if (side === 1 && road.cycleTrack) continue;
      for (let along = 22 + (side === 1 ? 4 : 0); along < road.lengthM - 18; along += 9.5) {
        const point = offsetPoint(
          mixPoint(road.a, road.b, along / road.lengthM),
          road.headingRad,
          side * (road.widthM / 2 - 1.12),
        );
        const box = {
          centerX: point.x,
          centerZ: point.z,
          halfWidthM: 0.97,
          halfLengthM: 2.15,
          headingRad: road.headingRad,
        };
        if (
          reserved.some((p) => distance(p, point) < 28) ||
          roads.some((other) => other.id !== road.id && overlaps(box, roadBox(other, 9))) ||
          parked.some((other) => overlaps(box, other.box))
        )
          continue;
        parked.push({ id: `parked-${road.id}-${side}-${along}`, kind: 'vehicle', box });
      }
    }
  }
  return parked;
}
