import * as THREE from 'three';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity, sampleLeg } from './model.ts';
import { attachCity, cityCockpitFactory } from './scene.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';
import { initialCockpit } from '../practice/cockpit.ts';

const city = buildCity(RouteSchema.parse(routeData));

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => vi.restoreAllMocks());

describe('streamed city renderer', () => {
  it('renders all source controls, batches buildings and releases every GPU resource', () => {
    const scene = new THREE.Scene();
    const view = attachCity(scene, city);
    view.update(city.start.pose, true);
    expect(scene.userData.activeSectors).toBe(scene.userData.totalSectors);
    for (const control of city.controls)
      expect(scene.getObjectByName(control.id)?.userData.status).toBe(control.status);
    let meshes = 0,
      instances = 0;
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshes++;
      if (object instanceof THREE.InstancedMesh) instances += object.count;
      resources.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        resources.add(material);
        if (material instanceof THREE.MeshBasicMaterial && material.map) resources.add(material.map);
      }
    });
    expect(instances).toBeGreaterThan(1000);
    expect(meshes).toBeLessThan(instances / 3);
    const spies = [...resources].map((resource) => vi.spyOn(resource, 'dispose'));
    view.dispose();
    expect(scene.children).toHaveLength(0);
    for (const spy of spies) expect(spy).toHaveBeenCalledOnce();
  });

  it('unloads, reloads and restores sectors while preserving collision data', () => {
    const scene = new THREE.Scene();
    const obstacles = city.world.obstacles;
    const view = attachCity(scene, city);
    view.update(sampleLeg(city, 3, 150));
    const first = [...view.stream.active];
    view.update(sampleLeg(city, 7, 50));
    expect([...view.stream.active]).not.toEqual(first);
    expect(city.world.obstacles).toBe(obstacles);
    view.update(sampleLeg(city, 3, 150));
    expect(first.every((key) => view.stream.active.has(key))).toBe(true);
    view.dispose();
  });

  it('places the cabin at the metric route entry and keeps the city visible to all mirrors', () => {
    const cockpit = cityCockpitFactory(city)(city.world, EXAM_CAR);
    cockpit.update(city.start.pose, initialCockpit(), 850, 0);
    expect(cockpit.scene.getObjectByName('grid')).toBeUndefined();
    expect(cockpit.scene.getObjectByName('city-ground')).toBeDefined();
    expect(cockpit.scene.userData.activeSectors).toBeGreaterThan(0);
    const mirrors: THREE.Object3D[] = [];
    cockpit.scene.traverse((object) => {
      if ('isReflector' in object) mirrors.push(object);
    });
    expect(mirrors).toHaveLength(3);
    expect(
      cockpit.camera.position.distanceTo(new THREE.Vector3(city.start.pose.x, 1.4, city.start.pose.z)),
    ).toBeLessThan(3);
    cockpit.dispose();
  });
});
