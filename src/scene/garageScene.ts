import * as THREE from 'three';
import { SCENE_COLORS } from './colors.ts';
import { disposeScene } from './dispose.ts';
import { createGarageEnvironment } from './garageEnvironment.ts';

export { SCENE_COLORS } from './colors.ts';

/** Seconds per full camera orbit; slow enough to read as ambient motion. */
const ORBIT_PERIOD_S = 70;
const ORBIT_RADIUS_M = 5.8;
const CAMERA_HEIGHT_M = 2.15;

export interface GarageScene {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  /** Advances ambient animation to `elapsedSeconds`; a no-op when motion is reduced. */
  update(elapsedSeconds: number): void;
  resize(widthPx: number, heightPx: number): void;
  dispose(): void;
}

export interface GarageSceneOptions {
  reducedMotion: boolean;
  car: THREE.Group;
}

/** Presents the Blender Kait in a softly lit garage, independently of the simulated vehicle. */
export function createGarageScene({ reducedMotion, car }: GarageSceneOptions): GarageScene {
  const scene = new THREE.Scene();
  scene.name = 'garage';
  scene.background = new THREE.Color('#182734');
  scene.fog = new THREE.Fog('#182734', 12, 28);
  const environment = createGarageEnvironment();
  scene.environment = environment;
  scene.environmentIntensity = 1.0;

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  car.rotation.y = Math.PI / 2;
  const lights = createLights();
  scene.add(lights, createFloor(), createParkingBox(), car);
  let orbitAngle = 0;
  placeCamera(camera, orbitAngle);

  return {
    scene,
    camera,
    update(elapsedSeconds) {
      if (reducedMotion) return;
      orbitAngle = (elapsedSeconds / ORBIT_PERIOD_S) * Math.PI * 2;
      placeCamera(camera, orbitAngle);
    },
    resize(widthPx, heightPx) {
      if (widthPx <= 0 || heightPx <= 0) return;
      camera.aspect = widthPx / heightPx;
      camera.updateProjectionMatrix();
      placeCamera(camera, orbitAngle);
    },
    dispose() {
      disposeScene(scene);
      environment.dispose();
      for (const light of lights.children) {
        if (light instanceof THREE.DirectionalLight) light.shadow.dispose();
      }
    },
  };
}

function placeCamera(camera: THREE.PerspectiveCamera, angleRad: number): void {
  // Start at a three-quarter front view and orbit around the car.
  const angle = angleRad + Math.PI / 5;
  // Keep the full car visible even when the responsive container becomes nearly square.
  const radius = ORBIT_RADIUS_M * Math.max(1, 1.4 / camera.aspect);
  camera.position.set(Math.sin(angle) * radius, CAMERA_HEIGHT_M, Math.cos(angle) * radius);
  camera.lookAt(0, 0.75, 0);
}

function createLights(): THREE.Group {
  const lights = new THREE.Group();
  lights.name = 'lights';
  lights.add(new THREE.HemisphereLight(0xd9e9ff, 0x27313c, 1.0));
  const key = new THREE.DirectionalLight(0xfff3e0, 2.1);
  key.position.set(3, 6, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 15;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0001;
  key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0x8ec7e8, 2);
  rim.position.set(-4, 3, -4);
  lights.add(key, rim);
  return lights;
}

function createFloor(): THREE.Mesh {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: '#394957', roughness: 0.8 }),
  );
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.006;
  floor.receiveShadow = true;
  return floor;
}

/** Parking box length from protocol graphic 4 (protocolo PDF 21), measured outside the painted lines. */
export const PARKING_BOX_LENGTH_M = 6;
/**
 * Not in the sources: graphic 4 gives the length but not the width (REGLAS.md, V5). A visual approximation only;
 * never use it to evaluate a manoeuvre.
 */
export const APPROXIMATE_PARKING_BOX_WIDTH_M = 2.4;
/** Painted line thickness; also a visual choice, not a sourced value. */
const PAINTED_LINE_M = 0.1;

/** Yellow painted outline of the parking box; its outer edges match the box size. */
function createParkingBox(): THREE.Group {
  const box = new THREE.Group();
  box.name = 'parking-box';
  const material = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.roadYellow });
  const lengthM = PARKING_BOX_LENGTH_M;
  const widthM = APPROXIMATE_PARKING_BOX_WIDTH_M;
  const lineM = PAINTED_LINE_M;
  // Lines are centred half a line inside the outline so the outer edges measure exactly length × width.
  const sides: Array<[number, number, number, number]> = [
    [lengthM, lineM, 0, -(widthM - lineM) / 2],
    [lengthM, lineM, 0, (widthM - lineM) / 2],
    [lineM, widthM, -(lengthM - lineM) / 2, 0],
    [lineM, widthM, (lengthM - lineM) / 2, 0],
  ];
  for (const [sx, sz, x, z] of sides) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.005, z);
    box.add(line);
  }
  return box;
}
