import type { City, Road } from './model.ts';
import { distance, mixPoint, offsetPoint, projectOnRoad, roadBox } from './model.ts';
import { overlaps } from '../sim/collision.ts';
import type { Point } from '../sim/collision.ts';
import type { Part } from './geometry.ts';
import { CITY_COLORS as c } from './palette.ts';
import { sectorKey } from './sectors.ts';

export interface SectorPlan {
  parts: Part[];
}
export type CityPlan = Map<string, SectorPlan>;

/** Deterministic, original architecture. All dimensions here are environmental approximations. */
export function planStreetscape(city: City): CityPlan {
  const sectors: CityPlan = new Map();
  const add = (part: Part) => {
    const key = sectorKey({ x: part.position[0], z: part.position[2] });
    const sector = sectors.get(key) ?? { parts: [] };
    sector.parts.push(part);
    sectors.set(key, sector);
  };
  const box = (
    point: Point,
    width: number,
    height: number,
    length: number,
    color: string,
    heading: number,
    y = height / 2,
  ) => add({ shape: 'box', color, position: [point.x, y, point.z], size: [width, height, length], heading });
  const onOtherRoad = (point: Point, road: Road, margin = 0) =>
    city.roads.some(
      (other) => other.id !== road.id && projectOnRoad(point, other).distanceM < other.widthM / 2 + margin,
    );

  for (const road of city.roads) {
    const count = Math.ceil(road.lengthM / 16);
    const length = road.lengthM / count;
    for (let i = 0; i < count; i++) {
      const center = mixPoint(road.a, road.b, (i + 0.5) / count);
      box(
        center,
        road.widthM,
        0.035,
        length + 0.03,
        road.kind === 'busway' ? c.busway : c.asphalt,
        road.headingRad,
        0.015,
      );
      if (road.cycleTrack) {
        const bike = offsetPoint(center, road.headingRad, road.widthM / 2 + 1.3);
        box(bike, 2.6, 0.015, length + 0.03, c.cycle, road.headingRad, 0.04);
        if (!onOtherRoad(bike, road, 3)) {
          box(bike, 0.08, 0.012, 2, c.paint, road.headingRad, 0.056);
          box(offsetPoint(center, road.headingRad, road.widthM / 2 + 0.15), 0.18, 0.12, 1.5, c.curb, road.headingRad);
        }
      }
      if (road.lanes > 1 && !onOtherRoad(center, road, 5)) box(center, 0.1, 0.012, 3, c.paint, road.headingRad, 0.042);
      // White arrows describe the one-way source roads; context streets have no inferred traffic direction.
      if (road.kind === 'route' && i % 3 === 1 && !onOtherRoad(center, road, 10)) {
        const lane = offsetPoint(center, road.headingRad, road.lanes > 1 ? -road.widthM / 4 : 0);
        box(lane, 0.14, 0.014, 2.4, c.paint, road.headingRad, 0.05);
        for (const side of [-1, 1])
          box(
            offsetPoint(lane, road.headingRad, side * 0.35, 0.8),
            0.13,
            0.014,
            1.1,
            c.paint,
            road.headingRad - side * 0.7,
            0.05,
          );
      }
    }
    // Model the visual vocabulary on each frontage, then repeat it along the complete metric graph.
    if (road.kind !== 'busway')
      for (const side of [-1, 1]) {
        for (let along = 14; along < road.lengthM - 7; along += 19) {
          const center = mixPoint(road.a, road.b, along / road.lengthM);
          const bikeWidth = road.cycleTrack && side === 1 ? 2.6 : 0;
          const facadeCenter = offsetPoint(center, road.headingRad, side * (road.widthM / 2 + bikeWidth + 7));
          const footprint = {
            centerX: facadeCenter.x,
            centerZ: facadeCenter.z,
            halfWidthM: 4,
            halfLengthM: 8.4,
            headingRad: road.headingRad,
          };
          if (city.roads.some((other) => overlaps(footprint, roadBox(other, 2.9 + (other.cycleTrack ? 2.6 : 0)))))
            continue;
          const variation = Math.abs(Math.round(center.x * 13 + center.z * 7));
          const floors = 2 + (variation % 4);
          const height = floors * 2.8;
          const colors = [c.facade, c.brick, c.sage];
          box(facadeCenter, 8, height, 16.8, colors[variation % colors.length] ?? c.facade, road.headingRad);
          const face = offsetPoint(facadeCenter, road.headingRad, -side * 4.04);
          box(
            offsetPoint(face, road.headingRad, -side * 0.15),
            0.32,
            0.25,
            17.2,
            c.trim,
            road.headingRad,
            height - 0.1,
          );
          for (let floor = 1; floor < floors; floor++)
            for (const column of [-5.6, -1.9, 1.9, 5.6]) {
              const window = offsetPoint(face, road.headingRad, 0, column);
              box(window, 0.1, 1.5, 1.6, c.glass, road.headingRad, floor * 2.8 + 1);
              box(
                offsetPoint(window, road.headingRad, -side * 0.08),
                0.23,
                0.12,
                1.9,
                c.trim,
                road.headingRad,
                floor * 2.8 + 0.2,
              );
            }
          box(face, 0.12, 2.1, 9, c.glass, road.headingRad, 1.1);
          box(offsetPoint(face, road.headingRad, -side * 0.55), 1.2, 0.15, 10, c.awning, road.headingRad, 2.4);
          const tree = offsetPoint(center, road.headingRad, side * (road.widthM / 2 + bikeWidth + 1.7), 7);
          if (!onOtherRoad(tree, road, 3)) {
            add({ shape: 'cylinder', color: c.trunk, position: [tree.x, 1.5, tree.z], size: [0.25, 3, 0.25] });
            add({
              shape: 'sphere',
              color: variation % 2 ? c.foliage : c.foliageLight,
              position: [tree.x, 4.2, tree.z],
              size: [3.8, 3.5, 3.8],
            });
            box(tree, 1.1, 0.04, 1.1, c.trunk, road.headingRad, 0.18);
          }
        }
      }
  }
  for (const obstacle of city.world.obstacles) {
    const { box: curb } = obstacle;
    const center = { x: curb.centerX, z: curb.centerZ };
    box(center, curb.halfWidthM * 2, 0.15, curb.halfLengthM * 2, c.curb, curb.headingRad);
    // Determine the exterior side from the nearest road surface.
    const nearest = city.roads.reduce((a, b) =>
      projectOnRoad(center, a).distanceM < projectOnRoad(center, b).distanceM ? a : b,
    );
    const roadPoint = projectOnRoad(center, nearest).point;
    const left = offsetPoint(center, curb.headingRad, 1.35);
    const right = offsetPoint(center, curb.headingRad, -1.35);
    const sidewalk = distance(left, roadPoint) > distance(right, roadPoint) ? left : right;
    const footprint = { ...curb, centerX: sidewalk.x, centerZ: sidewalk.z, halfWidthM: 1.25 };
    if (!city.roads.some((road) => overlaps(footprint, roadBox(road))))
      box(sidewalk, 2.5, 0.12, curb.halfLengthM * 2 + 0.01, c.sidewalk, curb.headingRad);
  }
  for (const marking of city.world.markings ?? []) {
    box(
      { x: marking.centerX, z: marking.centerZ },
      marking.halfWidthM * 2,
      0.012,
      marking.halfLengthM * 2,
      c.paint,
      marking.headingRad,
      0.06,
    );
  }
  for (const control of city.controls) {
    const { road } = control;
    if (control.type === 'traffic-calming-hump') {
      box(control.sourcePosition, road.widthM - 0.5, 0.08, 1.5, c.asphalt, road.headingRad, 0.065);
    } else if (control.type === 'crossing-traffic_signals') {
      const center = projectOnRoad(control.sourcePosition, road).point;
      for (let left = -road.widthM / 2 + 0.6; left < road.widthM / 2; left += 1.1)
        box(offsetPoint(center, road.headingRad, left), 0.55, 0.015, 3, c.paint, road.headingRad, 0.057);
    } else if (control.type === 'stop' || control.type === 'traffic_signals') {
      const center = offsetPoint(control.position, road.headingRad, road.widthM / 2 + 0.6, -1);
      box(center, road.widthM - 0.6, 0.014, 0.3, c.paint, road.headingRad, 0.055);
    }
  }
  return sectors;
}
