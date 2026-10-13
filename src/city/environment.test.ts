import * as THREE from 'three';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { overlaps } from '../sim/collision.ts';
import { buildCity, roadBox } from './model.ts';
import { addFrontages, planFrontages } from './frontages.ts';
import { addBayBarriers, planStreetFurniture } from './streetFurniture.ts';
import { disposeSector, instantiate } from './geometry.ts';
import { createCityLighting } from './lighting.ts';
import type { Part } from './geometry.ts';
import { CITY_COLORS } from './palette.ts';

const city = buildCity(RouteSchema.parse(routeData));

describe('reference-based city environment', () => {
  it('keeps displaced lamp posts and heads out of every intersecting road', () => {
    const parts: Part[] = [];
    addFrontages(city, (part) => parts.push(part));
    const lamps = parts.filter((part) => part.color === CITY_COLORS.steel);
    expect(lamps.some((part) => part.shape === 'cylinder')).toBe(true);
    expect(lamps.some((part) => part.shape === 'box')).toBe(true);
    const blocked = lamps.flatMap((part) => {
      const footprint = {
        centerX: part.position[0],
        centerZ: part.position[2],
        halfWidthM: part.size[0] / 2,
        halfLengthM: part.size[2] / 2,
        headingRad: part.heading ?? 0,
      };
      return city.roads.filter((road) => overlaps(footprint, roadBox(road))).map((road) => road.street);
    });
    expect(blocked).toEqual([]);
  });

  it('keeps architecture deterministic and outside road and cycle-track clearance', () => {
    const source = structuredClone(city);
    const frontages = planFrontages(city);
    expect(frontages).toEqual(planFrontages(city));
    expect(city).toEqual(source);
    expect(new Set(frontages.filter((item) => item.road.kind === 'route').map((item) => item.road.leg)).size).toBe(8);
    for (const frontage of frontages) {
      const envelope = {
        ...frontage.footprint,
        halfWidthM: frontage.footprint.halfWidthM + 1.2,
        halfLengthM: frontage.footprint.halfLengthM + 0.15,
      };
      expect(city.roads.some((road) => overlaps(envelope, roadBox(road, 2.1 + (road.cycleTrack ? 2.6 : 0))))).toBe(
        false,
      );
      if (frontage.road.street === 'Av. Cabildo') expect(frontage.side).toBe(frontage.road.kind === 'route' ? -1 : 1);
    }
  });

  it('places transit shelters and street plaques without blocking any traffic lane', () => {
    const furniture = planStreetFurniture(city);
    expect(furniture.labels.map((label) => label.text)).toEqual(
      expect.arrayContaining(['Quesada', 'Iberá', 'Av. Cabildo', 'Manuel Ugarte']),
    );
    const roofs = furniture.parts.filter((part) => part.position[1] === 3.15);
    expect(roofs.length).toBeGreaterThan(10);
    for (const part of furniture.parts) {
      const box = {
        centerX: part.position[0],
        centerZ: part.position[2],
        halfWidthM: part.size[0] / 2,
        halfLengthM: part.size[2] / 2,
        headingRad: part.heading ?? 0,
      };
      expect(city.roads.some((road) => overlaps(box, roadBox(road)))).toBe(false);
    }
  });

  it('leaves out the furniture, plaques and bay barriers of legs the route does not have', () => {
    // Arrange
    const withoutCabildo = { ...city, legs: city.legs.filter((leg) => leg.number !== 2) };
    const { markings, ...unmarked } = city.world;
    const barriers = (from: typeof city) => {
      const parts: Part[] = [];
      addBayBarriers(from, (part) => parts.push(part));
      return parts;
    };

    // Act
    const full = planStreetFurniture(city);
    const partial = planStreetFurniture(withoutCabildo);

    // Assert: no Cabildo shelters, and no plaques at the turn into or out of the missing leg.
    expect(full.labels).toHaveLength(city.legs.length * 2 + 2);
    expect(partial.parts.some((part) => part.position[1] === 3.15)).toBe(false);
    expect(partial.labels).toHaveLength((withoutCabildo.legs.length - 1) * 2);
    expect(barriers(city)).toHaveLength((markings?.length ?? 0) * 9);
    expect(barriers({ ...city, roads: city.roads.filter((road) => road.leg !== 1) })).toEqual([]);
    expect(barriers({ ...city, world: unmarked })).toEqual([]);
  });

  it('batches different facade colors together and preserves instance transforms', () => {
    const group = instantiate([
      { shape: 'box', color: '#ff0000', position: [1, 2, 3], size: [2, 3, 4], tilt: 0.3 },
      { shape: 'box', color: '#00ff00', position: [5, 6, 7], size: [1, 2, 3] },
      { shape: 'box', color: '#444444', position: [0, 0, 0], size: [1, 1, 1], surface: 'pavement' },
    ]);
    expect(group.children).toHaveLength(2);
    const batch = group.children[0] as THREE.InstancedMesh;
    expect(batch.count).toBe(2);
    const color = new THREE.Color();
    batch.getColorAt(0, color);
    expect(color.getHexString()).toBe('ff0000');
    batch.getColorAt(1, color);
    expect(color.getHexString()).toBe('00ff00');
    const matrix = new THREE.Matrix4();
    batch.getMatrixAt(0, matrix);
    const position = new THREE.Vector3(),
      rotation = new THREE.Quaternion(),
      scale = new THREE.Vector3();
    matrix.decompose(position, rotation, scale);
    expect(position.toArray()).toEqual([1, 2, 3]);
    expect(new THREE.Euler().setFromQuaternion(rotation).z).toBeCloseTo(0.3);
    expect(scale.y).toBeCloseTo(3);
    disposeSector(group);
  });

  it('refreshes shadows on movement or streaming and releases its lighting resources', () => {
    const scene = new THREE.Scene();
    const lighting = createCityLighting(scene);
    const sun = scene.getObjectByName('city-sun') as THREE.DirectionalLight;
    const dispose = vi.spyOn(sun.shadow, 'dispose');
    lighting.update({ x: 0, z: 0 }, false);
    expect(sun.shadow.needsUpdate).toBe(true);
    sun.shadow.needsUpdate = false;
    lighting.update({ x: 1, z: 1 }, false);
    expect(sun.shadow.needsUpdate).toBe(false);
    lighting.update({ x: 1, z: 1 }, true);
    expect(sun.shadow.needsUpdate).toBe(true);
    sun.shadow.needsUpdate = false;
    lighting.update({ x: 30, z: 1 }, false);
    expect(sun.target.position.x).toBe(24);
    expect(sun.shadow.needsUpdate).toBe(true);
    lighting.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(0);
  });
});
