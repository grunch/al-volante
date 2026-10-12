import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { createTrackScene } from './trackScene.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import { MIRROR_IDS } from '../practice/cockpit.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import { bodyBox } from '../sim/vehicle.ts';
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
  box('dashboard', [1.66, 0.21, 0.58], [0, 0.98, 1.03], '#202c35');
  box('dashboard-trim', [1.6, 0.025, 0.02], [0, 1.02, 0.73], '#74c5be');
  box('hood', [1.66, 0.1, 0.65], [0, 0.93, 1.7], '#2f8f88');
  box('roof', [1.72, 0.06, 2.2], [0, 1.79, -0.1], '#35454d');
  box('rear-shelf', [1.68, 0.12, 0.38], [0, 1.04, -1.52], '#202c35');
  for (const side of [-1, 1]) {
    const pillar = box('windshield-pillar', [0.07, 0.76, 0.07], [side * 0.81, 1.4, 1.1], '#35454d');
    pillar.rotation.x = -0.28;
    box('door', [0.08, 0.37, 1.95], [side * 0.85, 0.84, -0.07], '#202c35');
    box('window-sill', [0.1, 0.045, 1.95], [side * 0.85, 1.045, -0.07], '#74c5be');
    box('rear-pillar', [0.1, 0.72, 0.1], [side * 0.8, 1.4, -1.23], '#35454d');
  }
  const seat = new THREE.Group();
  seat.name = 'driver-seat';
  cabin.add(seat);
  box('seat-back', [0.48, 0.64, 0.15], [0.37, 0.94, -0.4], '#455d65', seat);
  const headrest = box('headrest', [0.29, 0.21, 0.13], [0.37, 1.37, -0.4], '#455d65', seat);
  box('passenger-seat', [0.48, 0.65, 0.16], [-0.4, 0.96, -0.42], '#455d65');
  box('passenger-headrest', [0.29, 0.21, 0.13], [-0.4, 1.4, -0.42], '#455d65');
  const belt = box('seat-belt', [0.055, 0.72, 0.025], [0.37, 0.97, -0.3], '#dfb869', seat);
  belt.rotation.z = -0.55;
  const wheel = new THREE.Group();
  wheel.name = 'steering-wheel';
  wheel.position.set(0.37, 1.0, 0.54);
  cabin.add(wheel);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.025, 12, 48),
    new THREE.MeshStandardMaterial({ color: '#17232a', roughness: 0.5 }),
  );
  wheel.add(rim);
  box('wheel-spoke', [0.35, 0.033, 0.026], [0, 0, 0], '#768b90', wheel);
  box('wheel-spoke-lower', [0.035, 0.19, 0.026], [0, -0.09, 0], '#768b90', wheel);
  box('wheel-hub', [0.12, 0.09, 0.05], [0, 0, -0.025], '#253941', wheel);

  // Analogue needles are live geometry; the accessible digital dashboard is in React.
  const needles: THREE.Group[] = [];
  for (const x of [0.2, 0.51]) {
    const dial = new THREE.Mesh(
      new THREE.CircleGeometry(0.125, 40),
      new THREE.MeshBasicMaterial({ color: '#0b2028', side: THREE.DoubleSide }),
    );
    dial.position.set(x, 1.15, 0.79);
    dial.rotation.y = Math.PI;
    cabin.add(dial);
    for (let i = 0; i < 13; i++) {
      const angle = -2.3 + (i * 4.6) / 12;
      const tick = box(
        'gauge-tick',
        [0.008, 0.02, 0.004],
        [x + Math.sin(angle) * 0.103, 1.15 + Math.cos(angle) * 0.103, 0.782],
        '#bde4dc',
      );
      tick.rotation.z = -angle;
    }
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.15, 0.775);
    cabin.add(pivot);
    box('gauge-needle', [0.009, 0.09, 0.008], [0, 0.035, 0], '#eeab53', pivot);
    needles.push(pivot);
  }
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
  camera.fov = 78;
  camera.updateProjectionMatrix();
  return {
    scene,
    camera,
    mirrors,
    resize: track.resize,
    update(vehicle: VehicleState, state: CockpitState, rpm: number, timeS: number) {
      track.update(vehicle);
      const body = bodyBox(spec, vehicle);
      cabin.position.set(body.centerX, 0, body.centerZ);
      cabin.rotation.y = vehicle.headingRad;
      seat.position.set(0, (state.seatHeight - 0.5) * 0.14, (state.seatDistance - 0.5) * 0.28);
      headrest.position.y = 1.3 + state.headrest * 0.2;
      belt.visible = state.belt;
      // Looking along +z reverses screen x: a left turn rotates the wheel toward +x.
      wheel.rotation.z = -vehicle.steerRad * 14;
      needles.forEach((needle, index) => {
        const fraction = index === 0 ? (Math.abs(vehicle.speedMps) * 3.6) / 120 : rpm / 7000;
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
      camera.position.copy(cabin.localToWorld(new THREE.Vector3(0.37, 1.38 + seat.position.y, 0.03 + seat.position.z)));
      const direction = new THREE.Vector3(
        Math.sin(state.lookYaw),
        Math.sin(state.lookPitch - 0.12),
        Math.cos(state.lookYaw),
      );
      direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), vehicle.headingRad);
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
      track.dispose();
    },
  };
}
