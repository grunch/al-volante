import * as THREE from 'three';
import { decorateActor } from './actorModel.ts';
import { createCarModel, poseCar } from './carModel.ts';
import { disposeScene } from './dispose.ts';
import { SCENE_COLORS } from './colors.ts';
import { bodyBox, forwardOf } from '../sim/vehicle.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { ActorKind, LightState, Scenario, TrafficSnapshot } from '../sim/scenario.ts';
import type { Obstacle, ObstacleKind, World } from '../sim/world.ts';

/** Chase camera: behind and above the car, looking a little ahead of it. */
const CAMERA_BACK_M = 7;
const CAMERA_UP_M = 3.2;
const LOOK_AHEAD_M = 4;
/** Share of the remaining distance the camera covers each frame when motion is allowed. */
const CAMERA_EASE = 0.15;
/** The ground and grid cover the world's obstacles and markings with this margin, at least this big. */
const GROUND_MARGIN_M = 60;
const GROUND_MIN_SIZE_M = 200;

const OBSTACLE_LOOK: Record<ObstacleKind, { heightM: number; color: THREE.ColorRepresentation }> = {
  vehicle: { heightM: 1.5, color: '#74858c' },
  wall: { heightM: 2, color: '#8a8f99' },
  pole: { heightM: 1, color: SCENE_COLORS.roadYellow },
  curb: { heightM: 0.15, color: '#d6d0c4' },
  cone: { heightM: 0.7, color: '#e8742e' },
};

const ACTOR_LOOK: Record<ActorKind, { heightM: number; color: THREE.ColorRepresentation }> = {
  pedestrian: { heightM: 1.7, color: '#2f6fd6' },
  vehicle: { heightM: 1.4, color: '#c94b3b' },
  bus: { heightM: 3, color: '#e0b43a' },
  bicycle: { heightM: 1.1, color: '#3aa37a' },
  emergency: { heightM: 2.3, color: '#f4f1e8' },
};
const LAMP_COLORS: Record<LightState, THREE.ColorRepresentation> = {
  red: '#e03b2e',
  yellow: '#f2c230',
  green: '#2ec46a',
};

export interface TrackScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Shows the car where the simulation has it, the scenario's actors and light, and moves the camera after it. */
  update(vehicle: VehicleState, scenario?: TrafficSnapshot | null): void;
  resize(widthPx: number, heightPx: number): void;
  dispose(): void;
}

function createObstacle(obstacle: Obstacle): THREE.Mesh {
  const { heightM, color } = OBSTACLE_LOOK[obstacle.kind];
  const { box } = obstacle;
  const geometry =
    obstacle.kind === 'pole'
      ? new THREE.CylinderGeometry(box.halfWidthM, box.halfWidthM, heightM, 16)
      : new THREE.BoxGeometry(box.halfWidthM * 2, heightM, box.halfLengthM * 2);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  mesh.name = obstacle.id;
  mesh.position.set(box.centerX, heightM / 2, box.centerZ);
  mesh.rotation.y = box.headingRad;
  return mesh;
}

/** Square extent that covers every obstacle and marking of the world, so a long street keeps its pavement. */
function groundExtent(world: World): { centerX: number; centerZ: number; sizeM: number } {
  const boxes = [...world.obstacles.map((obstacle) => obstacle.box), ...(world.markings ?? [])];
  if (boxes.length === 0) return { centerX: 0, centerZ: 0, sizeM: GROUND_MIN_SIZE_M };
  const reach = (box: OrientedBox) => Math.hypot(box.halfLengthM, box.halfWidthM);
  const minX = Math.min(...boxes.map((box) => box.centerX - reach(box)));
  const maxX = Math.max(...boxes.map((box) => box.centerX + reach(box)));
  const minZ = Math.min(...boxes.map((box) => box.centerZ - reach(box)));
  const maxZ = Math.max(...boxes.map((box) => box.centerZ + reach(box)));
  const sizeM = Math.max(GROUND_MIN_SIZE_M, maxX - minX + 2 * GROUND_MARGIN_M, maxZ - minZ + 2 * GROUND_MARGIN_M);
  return { centerX: (minX + maxX) / 2, centerZ: (minZ + maxZ) / 2, sizeM };
}

/** A faint one-metre grid, so speed and short moves (such as 30 cm) can be judged by eye. */
function createGrid(extent: ReturnType<typeof groundExtent>): THREE.GridHelper {
  const size = Math.round(extent.sizeM);
  const grid = new THREE.GridHelper(size, size, SCENE_COLORS.ivory, SCENE_COLORS.ivory);
  grid.name = 'grid';
  grid.position.set(extent.centerX, 0.005, extent.centerZ);
  const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of materials) {
    material.transparent = true;
    material.opacity = 0.12;
  }
  return grid;
}

function createMarking(marking: OrientedBox, index: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(marking.halfWidthM * 2, marking.halfLengthM * 2),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.roadYellow }),
  );
  mesh.name = `marking-${index}`;
  mesh.rotation.set(-Math.PI / 2, 0, marking.headingRad);
  mesh.position.set(marking.centerX, 0.01, marking.centerZ);
  return mesh;
}

/** Recognizable actors retain their evaluated footprints and ids; the outer mesh anchors the visual model. */
export function createActor(id: string, kind: ActorKind, halfLengthM: number, halfWidthM: number): THREE.Mesh {
  const { heightM, color } = ACTOR_LOOK[kind];
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidthM * 2, heightM, halfLengthM * 2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  mesh.name = `actor-${id}`;
  mesh.position.y = heightM / 2;
  decorateActor(mesh, kind, halfWidthM * 2, halfLengthM * 2, heightM);
  return mesh;
}

/** A traffic light on the right of the lane at the stop line: a pole and three lamps, lit by `setLight`. */
function createTrafficLight(scenario: Scenario): { group: THREE.Group; setLight(state: LightState): void } {
  const group = new THREE.Group();
  group.name = 'traffic-light';
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4, 12),
    new THREE.MeshStandardMaterial({ color: '#3b3f46' }),
  );
  pole.position.y = 2;
  group.add(pole);
  const lamps = (['red', 'yellow', 'green'] as const).map((state, index) => {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#222', emissive: LAMP_COLORS[state], emissiveIntensity: 0 }),
    );
    lamp.name = `lamp-${state}`;
    lamp.position.set(0, 4 - index * 0.4, 0.1);
    group.add(lamp);
    return { state, material: lamp.material };
  });
  group.position.set(-7.2, 0, scenario.light.stopLineZ + 1);
  return {
    group,
    setLight(state) {
      for (const lamp of lamps) lamp.material.emissiveIntensity = lamp.state === state ? 2 : 0;
    },
  };
}

function createGround(extent: ReturnType<typeof groundExtent>): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(extent.sizeM, extent.sizeM),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.concrete, roughness: 0.95 }),
  );
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(extent.centerX, 0, extent.centerZ);
  return ground;
}

/** The world of a simulation drawn in 3D, with a chase camera on the car. */
export function createTrackScene(
  world: World,
  spec: VehicleSpec,
  { reducedMotion }: { reducedMotion: boolean },
): TrackScene {
  const scene = new THREE.Scene();
  scene.name = 'track';
  scene.background = new THREE.Color(SCENE_COLORS.night);
  const sun = new THREE.DirectionalLight(SCENE_COLORS.ivory, 2);
  sun.position.set(10, 20, 5);
  const extent = groundExtent(world);
  scene.add(new THREE.HemisphereLight(SCENE_COLORS.ivory, SCENE_COLORS.night, 1.2), sun, createGround(extent));
  for (const obstacle of world.obstacles) scene.add(createObstacle(obstacle));
  (world.markings ?? []).forEach((marking, index) => scene.add(createMarking(marking, index)));
  scene.add(createGrid(extent));
  const car = createCarModel(spec);
  scene.add(car);
  const actors = new Map<string, THREE.Mesh>();
  let trafficLight: ReturnType<typeof createTrafficLight> | null = null;
  if (world.scenario) {
    for (const actor of world.scenario.actors) {
      const mesh = createActor(actor.id, actor.kind, actor.halfLengthM, actor.halfWidthM);
      mesh.position.set(actor.from.x, mesh.position.y, actor.from.z);
      actors.set(actor.id, mesh);
      scene.add(mesh);
    }
    trafficLight = createTrafficLight(world.scenario);
    trafficLight.setLight('green');
    scene.add(trafficLight.group);
  }
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 300);
  let placed = false;

  return {
    scene,
    camera,
    update(vehicle, scenario) {
      poseCar(car, spec, vehicle);
      if (scenario) {
        for (const pose of scenario.poses) {
          const mesh = actors.get(pose.id);
          if (!mesh) continue;
          mesh.position.set(pose.x, mesh.position.y, pose.z);
          mesh.rotation.y = pose.headingRad;
        }
        trafficLight?.setLight(scenario.light);
      }
      const body = bodyBox(spec, vehicle);
      const forward = forwardOf(vehicle.headingRad);
      const target = new THREE.Vector3(
        body.centerX - forward.x * CAMERA_BACK_M,
        CAMERA_UP_M,
        body.centerZ - forward.z * CAMERA_BACK_M,
      );
      // Easing smooths the chase; with reduced motion, or on the first frame, the camera simply snaps into place.
      if (reducedMotion || !placed) camera.position.copy(target);
      else camera.position.lerp(target, CAMERA_EASE);
      placed = true;
      camera.lookAt(body.centerX + forward.x * LOOK_AHEAD_M, 0.8, body.centerZ + forward.z * LOOK_AHEAD_M);
    },
    resize(widthPx, heightPx) {
      if (widthPx <= 0 || heightPx <= 0) return;
      camera.aspect = widthPx / heightPx;
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposeScene(scene);
    },
  };
}
