import * as THREE from 'three';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity, sampleLeg } from './model.ts';
import { attachCity, cityCockpitFactory } from './scene.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';
import { initialCockpit } from '../practice/cockpit.ts';
import { createTrafficSource } from '../traffic/traffic.ts';

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

  it('draws the traffic actors by kind and lights the lamp of each signal from the traffic state', () => {
    const scene = new THREE.Scene();
    const view = attachCity(scene, city);
    const source = createTrafficSource(city, 1);
    const pose = sampleLeg(city, 1, 100);
    view.update(pose);
    let state = source.create();
    for (let step = 1; step <= 240; step++)
      state = source.step(state, bodyBox(EXAM_CAR, pose), step * SIM_STEP_S, SIM_STEP_S);
    view.updateTraffic(state);
    expect(state.poses.length).toBeGreaterThan(0);
    expect(scene.userData.activeActors).toBe(state.poses.filter((item) => item.active).length);
    for (const actor of state.poses) {
      const mesh = scene.getObjectByName(`actor-${actor.id}`);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh?.position.x).toBeCloseTo(actor.x, 6);
      expect(mesh?.position.z).toBeCloseTo(actor.z, 6);
      expect(mesh?.visible).toBe(actor.active);
    }
    const kinds = new Set(state.poses.map((item) => item.kind));
    expect(kinds.has('vehicle')).toBe(true);
    const litLens = (controlId: string) => {
      const head = scene.getObjectByName(controlId);
      expect(head).toBeDefined();
      return (['red', 'yellow', 'green'] as const).filter((lamp) => {
        const lens = head?.getObjectByName(`lens-${lamp}`);
        return (
          lens instanceof THREE.Mesh && (lens.material as THREE.MeshBasicMaterial).color.getHexString() !== '1d282b'
        );
      });
    };
    expect(litLens('control-0')).toEqual([state.lights['control-0']]);
    // Actors away from the car disappear from the poses and their meshes hide; the lamps go off without traffic.
    view.updateTraffic(null);
    for (const actor of state.poses) expect(scene.getObjectByName(`actor-${actor.id}`)?.visible).toBe(false);
    expect(litLens('control-0')).toEqual([]);
    expect(scene.userData.activeActors).toBe(0);
    view.dispose();
    expect(scene.getObjectByName('traffic')).toBeUndefined();
  });
});
