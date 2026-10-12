import type { City, Road } from './model.ts';
import { distance, mixPoint, offsetPoint, projectOnRoad, roadBox, sampleLeg } from './model.ts';
import type { OrientedBox, Point } from '../sim/collision.ts';
import { overlaps } from '../sim/collision.ts';
import type { Part, Surface } from './geometry.ts';
import { CITY_COLORS as c } from './palette.ts';

type Style = 'balconies' | 'classic' | 'house' | 'modern';
interface FacadeStyle {
  style: Style;
  floors: number;
  color: string;
  shops: boolean;
  awningColor?: string;
}
export interface Frontage extends FacadeStyle {
  id: string;
  road: Road;
  side: number;
  alongM: number;
  widthM: number;
  depthM: number;
  center: Point;
  footprint: OrientedBox;
}

/** Visual interpretations of the supplied sequence; never surveyed dimensions or cadastral footprints. */
function facadeStyle(road: Road, index: number, side: number): FacadeStyle {
  const avenue = road.street === 'Av. Cabildo';
  const start = road.leg === 1;
  if (start && side === 1)
    return { style: 'balconies', floors: 7 + (index % 3), color: index % 3 === 0 ? c.ivory : c.brick, shops: true };
  if (start && side === -1 && index % 4 !== 0)
    return { style: index % 2 ? 'classic' : 'house', floors: 2, color: index % 2 ? c.facade : c.brick, shops: true };
  const residential = road.leg === 3 || road.leg === 4 || road.leg === 7;
  const styles: readonly Style[] = residential
    ? ['classic', 'balconies', 'house', 'modern', 'balconies']
    : ['balconies', 'modern', 'classic', 'balconies'];
  const value = index + (side === 1 ? 2 : 0);
  const style = styles[value % styles.length] ?? 'balconies';
  const colors = [c.facade, c.brick, c.stone, c.ivory, c.sage];
  return {
    style,
    floors:
      style === 'house' || style === 'classic'
        ? 2
        : avenue
          ? 8 + (value % 5)
          : start
            ? 6 + (value % 5)
            : 4 + (value % 4),
    color: colors[value % colors.length] ?? c.facade,
    shops: avenue || start || (style === 'classic' && index % 2 === 0),
  };
}

/** Join source edges only for architecture, so an OSM vertex does not leave an artificial gap in a block. */
function frontageRoads(city: City): Road[] {
  const roads: Road[] = [];
  for (const road of city.roads.filter((item) => item.kind !== 'busway')) {
    const previous = roads.at(-1);
    if (
      previous &&
      previous.leg === road.leg &&
      previous.kind === road.kind &&
      previous.street === road.street &&
      previous.cycleTrack === road.cycleTrack &&
      previous.widthM === road.widthM &&
      distance(previous.b, road.a) < 0.01 &&
      Math.abs(previous.headingRad - road.headingRad) < 0.09
    ) {
      previous.b = road.b;
      previous.lengthM = distance(previous.a, previous.b);
      previous.headingRad = Math.atan2(previous.b.x - previous.a.x, previous.b.z - previous.a.z);
    } else roads.push({ ...road });
  }
  return roads;
}

export function planFrontages(city: City): Frontage[] {
  const frontages: Frontage[] = [];
  for (const road of frontageRoads(city)) {
    for (const side of [-1, 1]) {
      // Cabildo's two inside edges face the transit corridor, not a row of buildings.
      if (
        road.street === 'Av. Cabildo' &&
        ((road.kind === 'route' && side === 1) || (road.kind === 'context' && side === -1))
      )
        continue;
      let index = 0;
      for (let startM = 10; startM < road.lengthM - 10; index++) {
        const widthM = [11, 14, 9, 12.5, 10][index % 5] ?? 11;
        const alongM = startM + widthM / 2;
        startM += widthM + 0.35;
        if (startM > road.lengthM - 8) break;
        const depthM = 11 + (index % 3);
        const bikeWidth = road.cycleTrack && side === 1 ? 2.6 : 0;
        const center = offsetPoint(
          mixPoint(road.a, road.b, alongM / road.lengthM),
          road.headingRad,
          side * (road.widthM / 2 + bikeWidth + 3.9 + depthM / 2),
        );
        const footprint = {
          centerX: center.x,
          centerZ: center.z,
          halfWidthM: depthM / 2,
          halfLengthM: widthM / 2,
          headingRad: road.headingRad,
        };
        // Balconies extend up to 1.15 m from this footprint; reserve the full swept envelope at every road.
        const envelope = {
          ...footprint,
          halfWidthM: footprint.halfWidthM + 1.2,
          halfLengthM: footprint.halfLengthM + 0.15,
        };
        if (
          city.roads.some((other) => overlaps(envelope, roadBox(other, 2.1 + (other.cycleTrack ? 2.6 : 0)))) ||
          frontages.some((other) => overlaps(footprint, other.footprint))
        )
          continue;
        frontages.push({
          id: `${road.id}-${side}-${index}`,
          road,
          side,
          alongM,
          widthM,
          depthM,
          center,
          footprint,
          ...facadeStyle(road, index, side),
        });
      }
    }
  }
  // Recognizable low-rise corners, placed approximately on the existing street model.
  const corner = (legNumber: number, leftM: number, aheadM: number, style: FacadeStyle) => {
    const leg = city.legs.find((item) => item.number === legNumber);
    if (!leg) return;
    const pose = sampleLeg(city, legNumber, leg.lengthM);
    const target = offsetPoint(pose, pose.headingRad, leftM, aheadM);
    const nearest = frontages.reduce<Frontage | undefined>(
      (best, item) => (!best || distance(item.center, target) < distance(best.center, target) ? item : best),
      undefined,
    );
    if (nearest && distance(nearest.center, target) < 32) Object.assign(nearest, style);
  };
  corner(3, 0, 18, { style: 'house', floors: 2, color: c.ivory, shops: false });
  corner(6, -18, 12, { style: 'classic', floors: 2, color: c.awning, shops: true, awningColor: c.trim });
  corner(8, 0, 18, { style: 'house', floors: 2, color: c.facade, shops: false });
  return frontages;
}

type AddPart = (part: Part) => void;

/** Local facade coordinates: x points out toward the street and z runs along the frontage. */
function facadeBuilder(frontage: Frontage, add: AddPart) {
  const { center, side, road, depthM } = frontage;
  const face = offsetPoint(center, road.headingRad, (-side * depthM) / 2);
  return (
    x: number,
    y: number,
    z: number,
    depth: number,
    height: number,
    width: number,
    color: string,
    surface: Surface = 'matte',
    tilt = 0,
  ) => {
    const point = offsetPoint(face, road.headingRad, -side * x, z);
    add({
      shape: 'box',
      color,
      position: [point.x, y, point.z],
      size: [depth, height, width],
      heading: road.headingRad,
      ...(tilt ? { tilt } : {}),
      surface,
    });
  };
}

function addFacade(frontage: Frontage, neighbors: readonly Frontage[], add: AddPart): void {
  const { floors, widthM: width, depthM, style, color, shops } = frontage;
  const box = facadeBuilder(frontage, add);
  const asset = (model: 'window' | 'aircon', x: number, y: number, z: number, size: [number, number, number]) => {
    const face = offsetPoint(frontage.center, frontage.road.headingRad, (-frontage.side * depthM) / 2);
    const point = offsetPoint(face, frontage.road.headingRad, -frontage.side * x, z);
    add({
      shape: 'box',
      model,
      position: [point.x, y, point.z],
      size,
      color: '#ffffff',
      heading: frontage.road.headingRad + (frontage.side === 1 ? Math.PI : 0),
    });
  };
  const height = floors * 2.95 + 0.6;
  const masonry = color === c.brick ? 'brick' : 'matte';
  box(-depthM / 2, height / 2, 0, depthM, height, width, color, masonry);
  box(-depthM / 2, height + 0.12, 0, depthM + 0.25, 0.24, width + 0.2, c.trim);
  box(0.06, 0.35, 0, 0.14, 0.7, width, c.stone);
  // Roof parapets, lift rooms and water tanks break up the skyline without importing assets.
  box(-depthM / 2, height + 0.65, -width * 0.25, 3.2, 1.1, 3, c.stone);
  if (floors > 4) {
    const tank = offsetPoint(frontage.center, frontage.road.headingRad, 0, width * 0.22);
    add({ shape: 'cylinder', color: c.stone, position: [tank.x, height + 1.15, tank.z], size: [1.7, 2, 1.7] });
  }
  const columns = Math.max(2, Math.floor(width / 3));
  const columnWidth = (width - 1.6) / columns;
  for (let floor = 1; floor < floors; floor++) {
    const level = floor * 2.95 + 0.7;
    if (style === 'balconies' || style === 'modern') {
      box(0.48, level - 0.25, 0, 1.12, 0.18, width - 0.55, c.trim);
      if (style === 'modern') box(1.03, level + 0.28, 0, 0.065, 0.95, width - 0.65, c.balconyGlass, 'glass');
      else for (const y of [0, 0.39, 0.78]) box(1.06, level + y, 0, 0.045, 0.035, width - 0.55, c.railing);
      box(1.08, level + 0.78, 0, 0.07, 0.055, width - 0.55, c.railing);
      for (let z = -width / 2 + 0.55; z < width / 2; z += floor < 3 ? 0.27 : 0.65)
        box(1.09, level + 0.25, z, 0.025, 1, 0.025, c.railing);
      // Narrow side returns leave a recess instead of a flat painted window.
      for (const z of [-width / 2 + 0.3, width / 2 - 0.3]) box(0.45, level + 0.9, z, 1.1, 2.2, 0.18, color, masonry);
      if (floor % 3 === 1) {
        box(0.77, level + 0.05, -width * 0.27, 0.36, 0.28, 1.6, c.terracotta);
        box(0.77, level + 0.26, -width * 0.27, 0.43, 0.3, 1.75, c.foliage);
      }
    } else {
      box(0.12, level - 0.3, 0, 0.3, 0.16, width + 0.16, c.trim);
    }
    for (let col = 0; col < columns; col++) {
      const z = -width / 2 + 0.8 + (col + 0.5) * columnWidth;
      const opening = columnWidth * 0.78;
      if (floor < 3) asset('window', 0.045, level + 0.9, z, [1, 1, opening / 1.4]);
      else {
        box(0.04, level + 0.9, z, 0.09, 2, opening, c.glass, 'glass');
        box(0.1, level + 0.9, z, 0.06, 2, 0.065, c.trim);
        box(0.1, level + 1.88, z, 0.09, 0.08, opening + 0.12, c.trim);
      }
      if ((floor + col) % 4 === 0) box(0.14, level + 1.53, z, 0.11, 0.7, opening, c.shutter);
      if (floor === 1 && col === 0) asset('aircon', 0.24, level + 1.3, z + opening / 2 + 0.32, [0.9, 0.9, 0.9]);
    }
  }
  for (const end of [-1, 1]) {
    // Party walls between contiguous buildings are hidden; only expose windows at actual gaps or corners.
    if (
      neighbors.some(
        (other) =>
          other !== frontage &&
          other.road.id === frontage.road.id &&
          other.side === frontage.side &&
          (other.alongM - frontage.alongM) * end > 0 &&
          Math.abs(other.alongM - frontage.alongM) < (other.widthM + width) / 2 + 0.5,
      )
    )
      continue;
    for (let floor = 0; floor < floors; floor++) {
      for (let column = 0; column < 3; column++) {
        const x = -1.9 - column * 3;
        const y = floor * 2.95 + 1.65;
        box(x, y, end * (width / 2 + 0.03), 1.25, 1.65, 0.08, c.glass, 'glass');
        box(x, y - 0.84, end * (width / 2 + 0.09), 1.45, 0.12, 0.24, c.trim);
      }
    }
  }
  // Street level mixes shutters, shop windows, entrances and garages, as in the reference sequence.
  box(0.06, 1.45, -width * 0.34, 0.1, 2.5, 1.35, c.door);
  box(0.13, 1.43, -width * 0.34 + 0.48, 0.1, 0.35, 0.045, c.trim);
  if (shops) {
    box(0.06, 1.45, width * 0.1, 0.1, 2.5, width * 0.59, c.glass, 'glass');
    for (const z of [-0.14, 0.23]) box(0.13, 1.45, width * z, 0.1, 2.5, 0.08, c.railing);
    const awning =
      frontage.awningColor ?? (frontage.road.leg === 2 ? c.charcoal : frontage.road.leg === 1 ? c.ochre : c.awning);
    box(0.3, 2.9, width * 0.1, 0.65, 0.45, width * 0.63, awning);
    box(0.7, 2.65, width * 0.1, 1.4, 0.12, width * 0.64, awning);
  } else {
    box(0.07, 1.37, width * 0.13, 0.12, 2.45, width * 0.53, c.shutter);
    for (let y = 0.3; y < 2.5; y += 0.22) box(0.14, y, width * 0.13, 0.02, 0.025, width * 0.53, c.railing);
  }
  if (style === 'classic') {
    for (const z of [-width / 2 + 0.32, width / 2 - 0.32]) box(0.15, height / 2, z, 0.33, height, 0.38, c.trim);
    box(0.22, height - 0.35, 0, 0.5, 0.28, width + 0.3, c.trim);
  }
  if (style === 'house') {
    for (const sign of [-1, 1])
      box(
        -depthM / 2 + (sign * depthM) / 4,
        height + 0.7,
        0,
        depthM / 2 + 0.3,
        0.18,
        width + 0.5,
        c.terracotta,
        'matte',
        frontage.side * sign * 0.24,
      );
  }
}

/** Clustered crowns and branching trunks form a canopy above, not across, the driver's sightline. */
function addTree(point: Point, heading: number, variation: number, canopy: boolean, add: AddPart): void {
  const scale = (canopy ? 1.12 : 0.91) + (variation % 3) * 0.05;
  add({
    shape: 'box',
    model: variation % 4 === 0 ? 'treeSparse' : 'tree',
    color: '#ffffff',
    position: [point.x, 0.14, point.z],
    size: [scale, scale, scale],
    heading: heading + variation * 1.7,
  });
  add({ shape: 'box', color: c.soil, position: [point.x, 0.16, point.z], size: [1.15, 0.04, 1.15], heading });
}

export function addFrontages(city: City, add: AddPart): void {
  const frontages = planFrontages(city);
  for (const frontage of frontages) addFacade(frontage, frontages, add);
  for (const road of frontageRoads(city)) {
    for (const side of [-1, 1]) {
      if (
        road.street === 'Av. Cabildo' &&
        ((road.kind === 'route' && side === 1) || (road.kind === 'context' && side === -1))
      )
        continue;
      for (let along = 18, index = 0; along < road.lengthM - 10; along += 17, index++) {
        const center = mixPoint(road.a, road.b, along / road.lengthM);
        const bike = road.cycleTrack && side === 1 ? 2.6 : 0;
        const point = offsetPoint(center, road.headingRad, side * (road.widthM / 2 + bike + 1.5));
        if (
          city.roads.some(
            (other) => other.id !== road.id && projectOnRoad(point, other).distanceM < other.widthM / 2 + 0.8,
          )
        )
          continue;
        addTree(point, road.headingRad, index, road.leg === 6 || road.leg === 8, add);
        if (index % 2 === 0) {
          const lamp = offsetPoint(point, road.headingRad, 0, 4);
          // The longitudinal offset can put a lamp in a crossing even when its tree has clearance.
          if (city.roads.some((other) => projectOnRoad(lamp, other).distanceM < other.widthM / 2 + 0.8)) continue;
          add({ shape: 'cylinder', color: c.steel, position: [lamp.x, 3.3, lamp.z], size: [0.11, 6.6, 0.11] });
          const head = offsetPoint(lamp, road.headingRad, -side * 0.42);
          add({
            shape: 'box',
            color: c.steel,
            position: [head.x, 6.55, head.z],
            size: [1, 0.14, 0.27],
            heading: road.headingRad,
          });
        }
      }
    }
  }
}
