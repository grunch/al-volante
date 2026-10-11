import * as THREE from 'three';
import { createCarModel, poseCar } from './carModel.ts';
import { disposeScene } from './dispose.ts';
import { SCENE_COLORS } from './colors.ts';
import { bodyBox, forwardOf } from '../sim/vehicle.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { Obstacle, ObstacleKind, World } from '../sim/world.ts';

/** Chase camera: behind and above the car, looking a little ahead of it. */
const CAMERA_BACK_M = 7;
const CAMERA_UP_M = 3.2;
const LOOK_AHEAD_M = 4;
/** Share of the remaining distance the camera covers each frame when motion is allowed. */
const CAMERA_EASE = 0.15;
const GROUND_SIZE_M = 200;

const OBSTACLE_LOOK: Record<ObstacleKind, { heightM: number; color: THREE.ColorRepresentation }> = {
  wall: { heightM: 2, color: '#8a8f99' },
  pole: { heightM: 1, color: SCENE_COLORS.roadYellow },
  curb: { heightM: 0.15, color: '#d6d0c4' },
  cone: { heightM: 0.7, color: '#e8742e' },
};

export interface TrackScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Shows the car where the simulation has it and moves the camera after it. */
  update(vehicle: VehicleState): void;
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

/** A faint one-metre grid, so speed and short moves (such as 30 cm) can be judged by eye. */
function createGrid(): THREE.GridHelper {
  const grid = new THREE.GridHelper(GROUND_SIZE_M, GROUND_SIZE_M, SCENE_COLORS.ivory, SCENE_COLORS.ivory);
  grid.name = 'grid';
  grid.position.y = 0.005;
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

function createGround(): THREE.Mesh {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE_M, GROUND_SIZE_M),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.concrete, roughness: 0.95 }),
  );
  ground.name = 'ground';
  ground.rotation.x = -Math.PI / 2;
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
  scene.add(new THREE.HemisphereLight(SCENE_COLORS.ivory, SCENE_COLORS.night, 1.2), sun, createGround());
  for (const obstacle of world.obstacles) scene.add(createObstacle(obstacle));
  (world.markings ?? []).forEach((marking, index) => scene.add(createMarking(marking, index)));
  scene.add(createGrid());
  const car = createCarModel(spec);
  scene.add(car);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 300);
  let placed = false;

  return {
    scene,
    camera,
    update(vehicle) {
      poseCar(car, spec, vehicle);
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
