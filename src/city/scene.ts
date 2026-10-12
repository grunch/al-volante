import * as THREE from 'three';
import type { City } from './model.ts';
import { instantiate, disposeSector } from './geometry.ts';
import { planStreetscape } from './streetscape.ts';
import { createControl, lightControl } from './signage.ts';
import { sectorKey, SectorSet } from './sectors.ts';
import { createCockpitScene } from '../scene/cockpitScene.ts';
import { createActor } from '../scene/trackScene.ts';
import type { TrafficSnapshot } from '../sim/scenario.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';

/** Actor meshes, one per actor id seen, hidden while the actor is away and lit lamps per control. */
export function attachTraffic(scene: THREE.Scene, signals: ReadonlyMap<string, THREE.Object3D>) {
  const actors = new Map<string, THREE.Mesh>();
  const group = new THREE.Group();
  group.name = 'traffic';
  scene.add(group);
  return {
    update(snapshot: TrafficSnapshot | null) {
      for (const mesh of actors.values()) mesh.visible = false;
      for (const pose of snapshot?.poses ?? []) {
        let mesh = actors.get(pose.id);
        if (!mesh) {
          mesh = createActor(pose.id, pose.kind, pose.box.halfLengthM, pose.box.halfWidthM);
          actors.set(pose.id, mesh);
          group.add(mesh);
        }
        mesh.visible = pose.active;
        mesh.position.set(pose.x, mesh.position.y, pose.z);
        mesh.rotation.y = pose.headingRad;
      }
      for (const [controlId, object] of signals) lightControl(object, snapshot?.lights[controlId] ?? null);
      scene.userData.activeActors = snapshot ? snapshot.poses.filter((pose) => pose.active).length : 0;
    },
    dispose() {
      for (const mesh of actors.values()) {
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      }
      actors.clear();
      group.removeFromParent();
    },
  };
}

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
  /** Signal heads currently loaded, by control id, so the traffic state can light them. */
  const signals = new Map<string, THREE.Object3D>();
  const load = (key: string) => {
    const plan = plans.get(key);
    if (!plan) throw new Error(`Missing sector ${key}`);
    const group = instantiate(plan.parts);
    group.name = `city-sector-${key}`;
    for (const control of city.controls.filter((item) => sectorKey(item.position) === key)) {
      const head = createControl(control);
      group.add(head);
      if (control.type === 'traffic_signals') signals.set(control.id, head);
    }
    groups.set(key, group);
    scene.add(group);
  };
  const unload = (key: string) => {
    const group = groups.get(key);
    if (group) disposeSector(group);
    groups.delete(key);
    for (const control of city.controls) if (sectorKey(control.position) === key) signals.delete(control.id);
  };
  const stream = new SectorSet([...plans.keys()], load, unload);
  const traffic = attachTraffic(scene, signals);
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
    /** Poses the actors and lights the lamps from the last traffic step. */
    updateTraffic(snapshot: TrafficSnapshot | null) {
      traffic.update(snapshot);
    },
    dispose() {
      traffic.dispose();
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
        cityView.updateTraffic(scenario ?? null);
        cockpit.update(vehicle, state, rpm, timeS, scenario);
      },
      dispose() {
        cityView.dispose();
        cockpit.dispose();
      },
    };
  };
}
