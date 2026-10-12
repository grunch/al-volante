import * as THREE from 'three';
import type { City } from './model.ts';
import { instantiate, disposeSector } from './geometry.ts';
import { planStreetscape } from './streetscape.ts';
import { createControl } from './signage.ts';
import { sectorKey, SectorSet } from './sectors.ts';
import { createCockpitScene } from '../scene/cockpitScene.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';

/** A resource-owning visual layer. Collision data remains loaded across visual sector changes. */
export function attachCity(scene: THREE.Scene, city: City) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1800, 1800),
    new THREE.MeshStandardMaterial({ color: '#b5bca9', roughness: 1 }),
  );
  ground.name = 'city-ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.012;
  scene.add(ground);
  const plans = planStreetscape(city);
  for (const control of city.controls) {
    const key = sectorKey(control.position);
    if (!plans.has(key)) plans.set(key, { parts: [] });
  }
  const groups = new Map<string, THREE.Group>();
  const load = (key: string) => {
    const plan = plans.get(key);
    if (!plan) throw new Error(`Missing sector ${key}`);
    const group = instantiate(plan.parts);
    group.name = `city-sector-${key}`;
    for (const control of city.controls.filter((item) => sectorKey(item.position) === key))
      group.add(createControl(control));
    groups.set(key, group);
    scene.add(group);
  };
  const unload = (key: string) => {
    const group = groups.get(key);
    if (group) disposeSector(group);
    groups.delete(key);
  };
  const stream = new SectorSet([...plans.keys()], load, unload);
  scene.background = new THREE.Color('#cbdcdd');
  scene.fog = new THREE.Fog('#cbdcdd', 95, 170);
  return {
    stream,
    update(position: Pick<VehicleState, 'x' | 'z'>, whole = false) {
      if (whole) {
        for (const key of plans.keys())
          if (!stream.active.has(key)) {
            load(key);
            stream.active.add(key);
          }
      } else stream.update(position);
      scene.userData.activeSectors = stream.active.size;
      scene.userData.totalSectors = plans.size;
    },
    dispose() {
      stream.dispose();
      ground.removeFromParent();
      ground.geometry.dispose();
      ground.material.dispose();
    },
  };
}

/** Reuses the working cabin and mirrors, replacing only the practice-yard environment. */
export function cityCockpitFactory(city: City): typeof createCockpitScene {
  return (world: World, spec: VehicleSpec) => {
    const cockpit = createCockpitScene({ ...world, obstacles: [], markings: [] }, spec);
    for (const name of ['grid', 'ground']) {
      const object = cockpit.scene.getObjectByName(name);
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.removeFromParent();
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
      }
    }
    const cityView = attachCity(cockpit.scene, city);
    return {
      ...cockpit,
      update(vehicle, state, rpm, timeS, scenario) {
        cityView.update(vehicle);
        cockpit.update(vehicle, state, rpm, timeS, scenario);
      },
      dispose() {
        cityView.dispose();
        cockpit.dispose();
      },
    };
  };
}
