import * as THREE from 'three';
import { createCabinInterior } from './cabinInterior.ts';
import { DriverMotion } from './driverMotion.ts';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createTrackScene } from './trackScene.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import { MIRROR_IDS } from '../practice/cockpit.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import { bodyBox } from '../sim/vehicle.ts';
import type { TrafficSnapshot } from '../sim/scenario.ts';
import type { World } from '../sim/world.ts';

/** All cabin dimensions are visual approximations in metres, not exam tolerances. +x is driver left. */
export function createCockpitScene(world: World, spec: VehicleSpec) {
  const track = createTrackScene(world, spec, { reducedMotion: true });
  const { scene, camera } = track;
  scene.background = new THREE.Color('#b6d2dc');
  scene.fog = new THREE.Fog('#b6d2dc', 65, 170);
  const car = scene.getObjectByName('placeholder-car');
  const exteriorCabin = car?.getObjectByName('cabin');
  if (!exteriorCabin) throw new Error('Vehicle cabin is missing');
  exteriorCabin.visible = false;
  const exteriorBody = car?.getObjectByName('body');
  if (exteriorBody) {
    exteriorBody.scale.y = 0.65;
    exteriorBody.position.y = 0.48;
    if (exteriorBody instanceof THREE.Mesh && exteriorBody.material instanceof THREE.MeshStandardMaterial)
      exteriorBody.material.color.set('#46585a');
  }
  const cabin = new THREE.Group();
  cabin.name = 'cockpit';
  scene.add(cabin);
  const box = (
    name: string,
    size: [number, number, number],
    position: [number, number, number],
    color: string,
    parent: THREE.Object3D = cabin,
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
    );
    mesh.name = name;
    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  };
  const interior = createCabinInterior(cabin);
  const { seat, headrest, belt, wheel, needles } = interior;
  const motion = new DriverMotion();
  let reducedMotion = false;
  const wipers = [0.4, -0.35].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.08, 1.15);
    cabin.add(pivot);
    box('wiper-blade', [0.015, 0.42, 0.015], [0, 0.2, 0], '#17232a', pivot);
    return pivot;
  });
  const headlights = [-0.58, 0.58].map((x) => {
    const light = new THREE.SpotLight('#fff0cf', 0, 35, 0.5, 0.5, 1);
    light.position.set(x, 0.75, 1.98);
    light.target.position.set(x, 0, 22);
    cabin.add(light, light.target);
    return light;
  });
  const lamps = [-1, 1].map((side) => {
    const lamp = box('turn-lamp', [0.13, 0.065, 0.07], [side * 0.8, 1.1, 1.38], '#efb54d');
    return lamp.material;
  });
  const mirrors = MIRROR_IDS.map((id) => {
    const center = id === 'center';
    const width = center ? 0.4 : 0.3;
    const height = center ? 0.15 : 0.2;
    const mount = new THREE.Group();
    mount.name = `mirror-${id}`;
    mount.position.set(
      id === 'left' ? 1.03 : id === 'right' ? -1.03 : -0.05,
      center ? 1.59 : 1.24,
      center ? 1.03 : 0.86,
    );
    cabin.add(mount);
    box('mirror-frame', [width + 0.04, height + 0.04, 0.04], [0, 0, -0.025], '#17232a', mount);
    const mirror = new Reflector(new THREE.PlaneGeometry(width, height), {
      color: 0xffffff,
      textureWidth: 512,
      textureHeight: 256,
      clipBias: 0.003,
      multisample: 0,
    });
    mirror.name = `reflection-${id}`;
    mount.add(mirror);
    return { id, mount, mirror };
  });
  // One scene pass per visible mirror. Suppress recursive mirror-to-mirror rendering.
  for (const { mirror } of mirrors) {
    const reflect = mirror.onBeforeRender.bind(mirror);
    mirror.onBeforeRender = (...args) => {
      const visibility = mirrors.map((entry) => entry.mirror.visible);
      for (const entry of mirrors) if (entry.mirror !== mirror) entry.mirror.visible = false;
      try {
        reflect(...args);
      } finally {
        mirrors.forEach((entry, index) => {
          entry.mirror.visible = visibility[index] ?? false;
        });
      }
    };
  }
  camera.near = 0.04;
  camera.fov = 64;
  camera.updateProjectionMatrix();
  return {
    scene,
    camera,
    mirrors,
    resize: track.resize,
    setReducedMotion(value: boolean) {
      reducedMotion = value;
    },
    update(vehicle: VehicleState, state: CockpitState, rpm: number, timeS: number, scenario?: TrafficSnapshot | null) {
      track.update(vehicle, scenario);
      const body = bodyBox(spec, vehicle);
      cabin.position.set(body.centerX, 0, body.centerZ);
      cabin.rotation.y = vehicle.headingRad;
      seat.position.set(0, (state.seatHeight - 0.5) * 0.14, (state.seatDistance - 0.5) * 0.28);
      headrest.position.y = 1.3 + state.headrest * 0.2;
      belt.visible = state.belt;
      // Looking along +z reverses screen x: a left turn rotates the wheel toward +x.
      wheel.rotation.z = -vehicle.steerRad * 14;
      needles.forEach((needle, index) => {
        const fraction = index === 0 ? (Math.abs(vehicle.speedMps) * 3.6) / 120 : rpm / 6000;
        needle.rotation.z = -2.3 + Math.min(fraction, 1) * 4.6;
      });
      for (const pivot of wipers) pivot.rotation.z = state.wipers ? 0.15 + (Math.sin(timeS * 5) + 1) * 0.7 : 1.47;
      for (const light of headlights)
        light.intensity =
          state.lights === 'high' ? 60 : state.lights === 'low' ? 30 : state.lights === 'position' ? 2 : 0;
      const blink = Math.floor(timeS * 2) % 2 === 0;
      lamps.forEach((material, index) => {
        material.emissive.set(
          blink && (state.hazards || state.signal === (index === 0 ? 'right' : 'left')) ? '#ff9b16' : '#000000',
        );
      });
      for (const { id, mount } of mirrors) {
        const baseYaw = id === 'left' ? 0.2 : id === 'right' ? -0.28 : -0.18;
        const basePitch = id === 'center' ? 0.16 : 0.04;
        mount.rotation.set(basePitch + state.mirrors[id].pitch, Math.PI + baseYaw + state.mirrors[id].yaw, 0, 'YXZ');
      }
      cabin.updateMatrixWorld(true);
      const offset = motion.update(vehicle, timeS, reducedMotion);
      camera.position.copy(
        cabin.localToWorld(
          new THREE.Vector3(0.37 + offset.x, 1.38 + seat.position.y + offset.y, -0.14 + seat.position.z + offset.z),
        ),
      );
      const pitch = state.lookPitch - 0.055 + offset.pitch;
      const direction = new THREE.Vector3(
        Math.sin(state.lookYaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(state.lookYaw) * Math.cos(pitch),
      );
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.headingRad);
      camera.up.set(0, 1, 0).applyAxisAngle(direction, offset.roll);
      camera.lookAt(camera.position.clone().add(direction));
      camera.updateMatrixWorld();
    },
    dispose() {
      // Reflector owns render targets in addition to geometry/material; avoid double-disposing its material.
      for (const { mirror } of mirrors) {
        mirror.removeFromParent();
        mirror.dispose();
        mirror.geometry.dispose();
      }
      interior.dispose();
      track.dispose();
    },
  };
}
