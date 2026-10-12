import type { City } from './model.ts';
import { offsetPoint, projectOnRoad, roadBox, sampleLeg } from './model.ts';
import { overlaps } from '../sim/collision.ts';
import type { Point } from '../sim/collision.ts';
import type { Part } from './geometry.ts';
import { CITY_COLORS as c } from './palette.ts';

export interface StreetLabel {
  text: string;
  position: [number, number, number];
  heading: number;
  widthM: number;
  heightM: number;
  background: string;
}
export interface FurniturePlan {
  parts: Part[];
  labels: StreetLabel[];
}

/** Furniture dimensions and setbacks are visual estimates; the simulation's roads and rules remain authoritative. */
export function planStreetFurniture(city: City): FurniturePlan {
  const parts: Part[] = [];
  const labels: StreetLabel[] = [];
  const box = (
    point: Point,
    heading: number,
    width: number,
    height: number,
    length: number,
    color: string,
    y = height / 2,
  ) => parts.push({ shape: 'box', color, position: [point.x, y, point.z], size: [width, height, length], heading });
  const clearOfRoad = (point: Point, heading: number, width: number, length: number) =>
    !city.roads.some((road) =>
      overlaps(
        { centerX: point.x, centerZ: point.z, halfWidthM: width / 2, halfLengthM: length / 2, headingRad: heading },
        roadBox(road, 0.12),
      ),
    );
  // Thin islands, black railings and long shelters are the defining Cabildo reference, not extra traffic lanes.
  const cabildo = city.legs.find((leg) => leg.number === 2);
  if (cabildo) {
    for (let along = 16; along < cabildo.lengthM - 12; along += 4) {
      const pose = sampleLeg(city, 2, along);
      const island = offsetPoint(pose, pose.headingRad, 4.65);
      if (!clearOfRoad(island, pose.headingRad, 1.8, 3.8)) continue;
      box(island, pose.headingRad, 1.8, 0.19, 3.8, c.sidewalk);
      const rail = offsetPoint(pose, pose.headingRad, 4);
      for (const y of [0.45, 0.85, 1.15]) box(rail, pose.headingRad, 0.065, 0.06, 3.8, c.railing, y);
      box(rail, pose.headingRad, 0.1, 1.2, 0.1, c.railing, 0.7);
    }
    for (const [from, to, name] of [
      [24, 86, 'Quesada'],
      [161, 215, 'Iberá'],
    ] as const) {
      for (let along = from; along < to; along += 6) {
        const pose = sampleLeg(city, 2, along);
        const center = offsetPoint(pose, pose.headingRad, 4.65);
        if (!clearOfRoad(center, pose.headingRad, 1.8, 5.8)) continue;
        box(center, pose.headingRad, 1.8, 0.17, 5.8, c.charcoal, 3.15);
        box(center, pose.headingRad, 0.15, 3.05, 0.15, c.railing, 1.65);
        const back = offsetPoint(center, pose.headingRad, -0.7);
        box(back, pose.headingRad, 0.07, 2, 5.25, c.balconyGlass, 1.6);
        box(back, pose.headingRad, 0.09, 0.35, 5.3, c.ochre, 2.82);
        const bench = offsetPoint(center, pose.headingRad, 0.1);
        box(bench, pose.headingRad, 0.45, 0.13, 2, c.stone, 0.6);
        if (along === from)
          labels.push({
            text: name,
            position: [back.x, 2.84, back.z],
            heading: pose.headingRad - Math.PI / 2,
            widthM: 3.4,
            heightM: 0.28,
            background: c.ochre,
          });
      }
    }
  }
  // Both street names at each turn: small physical plaques, visible in all modes, without a route arrow or hint.
  for (const leg of city.legs) {
    const next = city.legs.find((item) => item.number === (leg.number % 8) + 1);
    const road = city.roads.filter((item) => item.leg === leg.number).at(-1);
    if (!road || !next) continue;
    const pose = sampleLeg(city, leg.number, leg.lengthM - 13);
    const point = offsetPoint(pose, pose.headingRad, -road.widthM / 2 - 1);
    if (!clearOfRoad(point, pose.headingRad, 0.2, 0.2)) continue;
    box(point, pose.headingRad, 0.09, 3.3, 0.09, c.railing);
    labels.push({
      text: leg.street,
      position: [point.x, 3.15, point.z],
      heading: pose.headingRad + Math.PI,
      widthM: 2.5,
      heightM: 0.4,
      background: c.charcoal,
    });
    labels.push({
      text: next.street,
      position: [point.x, 2.69, point.z],
      heading: pose.headingRad + Math.PI,
      widthM: 2.5,
      heightM: 0.4,
      background: c.charcoal,
    });
  }
  return { parts, labels };
}

/** The barriers stand at the already evaluated bay ends, never at guessed photograph coordinates. */
export function addBayBarriers(city: City, add: (part: Part) => void): void {
  const road = city.roads.find((item) => item.leg === 1);
  if (!road) return;
  for (const marking of city.world.markings ?? []) {
    const center = { x: marking.centerX, z: marking.centerZ };
    const projection = projectOnRoad(center, road);
    const point = offsetPoint(projection.point, road.headingRad, -road.widthM / 2 + 0.65);
    const part = (left: number, y: number, width: number, height: number, depth: number) => {
      const p = offsetPoint(point, road.headingRad, left);
      add({
        shape: 'box',
        color: c.trim,
        position: [p.x, y, p.z],
        size: [width, height, depth],
        heading: road.headingRad,
      });
    };
    for (const y of [0.24, 1.06]) part(0, y, 1.2, 0.13, 0.13);
    for (const x of [-0.53, -0.27, 0, 0.27, 0.53]) part(x, 0.65, 0.075, 0.8, 0.1);
    for (const x of [-0.53, 0.53]) part(x, 0.13, 0.16, 0.1, 0.5);
  }
}
