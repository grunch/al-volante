import * as THREE from 'three';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { overlaps } from '../sim/collision.ts';
import { bodyBox, EXAM_CAR, restingVehicle } from '../sim/vehicle.ts';
import { initialWorldState, stepWorld } from '../sim/world.ts';
import { buildCity, roadBox, offsetPoint } from './model.ts';
import { neighborhoodDetails } from './neighborhoodDetails.ts';
import { planStreetParking } from './streetParking.ts';
import { disposeSector, instantiate, updateDetail } from './geometry.ts';
import { createBlenderModel } from '../scene/blenderAssets.ts';
import { disposeScene } from '../scene/dispose.ts';

const city = buildCity(RouteSchema.parse(routeData));
describe('photo-inspired street immersion', () => {
  it('keeps parked cars clear of every through lane, cycle track, intersection and reserved starting area', () => {
    const parked = city.world.obstacles.filter((o) => o.kind === 'vehicle');
    expect(parked.length).toBeGreaterThan(30);
    for (const car of parked) {
      const road = city.roads.find((r) => car.id.startsWith(`parked-${r.id}-`))!;
      expect(road.lanes).toBe(1);
      expect(road.kind).toBe('route');
      expect(overlaps(car.box, { ...roadBox(road), halfWidthM: 1.65 })).toBe(false);
      expect(city.roads.some((other) => other.id !== road.id && overlaps(car.box, roadBox(other, 8)))).toBe(false);
      expect(Math.hypot(car.box.centerX - city.start.pose.x, car.box.centerZ - city.start.pose.z)).toBeGreaterThan(28);
      if (road.cycleTrack) {
        const cycle = offsetPoint(road.a, road.headingRad, road.widthM / 2 + 1.3);
        expect(
          overlaps(car.box, {
            ...roadBox(road),
            centerX: cycle.x + (road.b.x - road.a.x) / 2,
            centerZ: cycle.z + (road.b.z - road.a.z) / 2,
            halfWidthM: 1.3,
          }),
        ).toBe(false);
      }
    }
    expect(planStreetParking([], [])).toEqual([]);
    expect(planStreetParking(city.roads, [city.start.pose])).toEqual(planStreetParking(city.roads, [city.start.pose]));
  });

  it('gives parked vehicles physical contact and matches the Blender body bounds', () => {
    const parked = city.world.obstacles.find((o) => o.kind === 'vehicle')!;
    const model = createBlenderModel('car');
    const bounds = new THREE.Box3().setFromObject(model);
    expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x))).toBeLessThan(parked.box.halfWidthM);
    expect(Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z))).toBeLessThan(parked.box.halfLengthM);
    disposeScene(model);
    const target = { x: parked.box.centerX, z: parked.box.centerZ };
    const start = offsetPoint(target, parked.box.headingRad, 0, -8);
    let state = initialWorldState({ ...restingVehicle({ ...start, headingRad: parked.box.headingRad }), speedMps: 5 });
    const contacts = [];
    for (let i = 0; i < 180; i++) {
      state = stepWorld(
        EXAM_CAR,
        { ...city.world, obstacles: [parked] },
        state,
        { tractionN: 0, brake: 0, steer: 0, holdN: 0 },
        1 / 120,
      );
      contacts.push(...state.contacts);
    }
    expect(contacts.some((c) => c.kind === 'vehicle')).toBe(true);
    expect(overlaps(bodyBox(EXAM_CAR, state.vehicle), parked.box)).toBe(false);
  });

  it('places useful sidewalk detail outside roads and keeps generic shop labels in Spanish', () => {
    const detail = neighborhoodDetails(city);
    expect(detail).toEqual(neighborhoodDetails(city));
    expect(detail.labels.length).toBeGreaterThan(4);
    expect(detail.labels.length).toBeLessThanOrEqual(8);
    for (const model of ['container', 'scooter', 'bikeRack'])
      expect(detail.parts.some((p) => p.model === model)).toBe(true);
    for (const part of detail.parts.filter((p) => p.model && p.model !== 'car')) {
      const box = {
        centerX: part.position[0],
        centerZ: part.position[2],
        halfWidthM: 0.9,
        halfLengthM: 1.2,
        headingRad: part.heading ?? 0,
      };
      expect(city.roads.some((r) => overlaps(box, roadBox(r, r.cycleTrack ? 2.6 : 0.25)))).toBe(false);
    }
    expect(detail.parts.filter((p) => p.model === 'car')).toHaveLength(
      city.world.obstacles.filter((o) => o.kind === 'vehicle').length,
    );
  });

  it('swaps packed near/far instances without losing transforms, colors or resources', () => {
    const group = instantiate([
      { shape: 'box', model: 'car', position: [0, 0, 0], size: [1, 1, 1], color: '#ff0000' },
      { shape: 'box', model: 'car', position: [100, 0, 0], size: [1, 1, 1], color: '#00ff00' },
      { shape: 'box', position: [0, 0, 0], size: [1, 1, 1], color: '#ffffff', detailDistanceM: 10 },
    ]);
    const meshes = group.children as THREE.InstancedMesh[];
    const renderedTriangles = () =>
      meshes.filter((m) => m.visible).reduce((sum, m) => sum + (m.count * m.geometry.index!.count) / 3, 0);
    const before = renderedTriangles();
    expect(updateDetail(group, { x: 0, z: 0 })).toBe(true);
    expect(renderedTriangles()).toBeLessThan(before * 0.65);
    expect(updateDetail(group, { x: 1, z: 1 })).toBe(false);
    const version = meshes[0]!.instanceMatrix.version;
    expect(updateDetail(group, { x: 3, z: 0 })).toBe(false);
    expect(meshes[0]!.instanceMatrix.version).toBe(version);
    const low = meshes.find((m) => m.name.includes('carLow'))!;
    expect(low.count).toBe(1);
    const transform = new THREE.Matrix4(),
      color = new THREE.Color();
    low.getMatrixAt(0, transform);
    expect(transform.elements[12]).toBe(100);
    low.getColorAt(0, color);
    expect(color.getHexString()).toBe('00ff00');
    updateDetail(group, { x: 100, z: 0 });
    low.getMatrixAt(0, transform);
    expect(transform.elements[12]).toBe(0);
    expect(meshes.find((m) => m.name === 'batch-box-matte')!.visible).toBe(false);
    const disposals = meshes.map((m) => vi.spyOn(m.geometry, 'dispose'));
    disposeSector(group);
    disposals.forEach((spy) => expect(spy).toHaveBeenCalledOnce());
    expect(updateDetail(new THREE.Group(), { x: 0, z: 0 })).toBe(false);
  });
});
