import * as THREE from 'three';

/** Palette shared with the UI tokens in src/ui/theme.css. */
export const SCENE_COLORS = {
  night: 0x13233a,
  ivory: 0xf7f2e8,
  turquoise: 0x1fa79b,
  roadYellow: 0xf2c230,
  concrete: 0x8a8f96,
  tire: 0x1d1d1f,
} as const;

/** Seconds per full camera orbit; slow enough to read as ambient motion. */
const ORBIT_PERIOD_S = 40;
const ORBIT_RADIUS_M = 6.5;
const CAMERA_HEIGHT_M = 2.2;

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
}

/**
 * Builds a stylised garage with a placeholder practice car (dimensions in meters, roughly a compact sedan).
 * The detailed cabin arrives in F03-T03; this scene only proves the rendering pipeline.
 */
export function createGarageScene({ reducedMotion }: GarageSceneOptions): GarageScene {
  const scene = new THREE.Scene();
  scene.name = 'garage';
  scene.background = new THREE.Color(SCENE_COLORS.night);

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  scene.add(createLights(), createFloor(), createParkingBox(), createPlaceholderCar());
  placeCamera(camera, 0);

  return {
    scene,
    camera,
    update(elapsedSeconds) {
      if (reducedMotion) return;
      placeCamera(camera, (elapsedSeconds / ORBIT_PERIOD_S) * Math.PI * 2);
    },
    resize(widthPx, heightPx) {
      if (widthPx <= 0 || heightPx <= 0) return;
      camera.aspect = widthPx / heightPx;
      camera.updateProjectionMatrix();
    },
    dispose() {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) material.dispose();
        }
      });
    },
  };
}

function placeCamera(camera: THREE.PerspectiveCamera, angleRad: number): void {
  // Start at a three-quarter front view and orbit around the car.
  const angle = angleRad + Math.PI / 5;
  camera.position.set(Math.sin(angle) * ORBIT_RADIUS_M, CAMERA_HEIGHT_M, Math.cos(angle) * ORBIT_RADIUS_M);
  camera.lookAt(0, 0.6, 0);
}

function createLights(): THREE.Group {
  const lights = new THREE.Group();
  lights.name = 'lights';
  lights.add(new THREE.HemisphereLight(SCENE_COLORS.ivory, SCENE_COLORS.night, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(4, 6, 3);
  lights.add(key);
  return lights;
}

function createFloor(): THREE.Mesh {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.concrete, roughness: 0.95 }),
  );
  floor.name = 'floor';
  floor.rotation.x = -Math.PI / 2;
  return floor;
}

/** Yellow painted outline of a 6 m parking box, echoing protocol graphic 4 (protocolo PDF 21). */
function createParkingBox(): THREE.Group {
  const box = new THREE.Group();
  box.name = 'parking-box';
  const material = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.roadYellow });
  const lengthM = 6;
  const widthM = 2.4;
  const lineM = 0.1;
  const sides: Array<[number, number, number, number]> = [
    [lengthM, lineM, 0, -widthM / 2],
    [lengthM, lineM, 0, widthM / 2],
    [lineM, widthM, -lengthM / 2, 0],
    [lineM, widthM, lengthM / 2, 0],
  ];
  for (const [sx, sz, x, z] of sides) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), material);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, 0.005, z);
    box.add(line);
  }
  return box;
}

function createPlaceholderCar(): THREE.Group {
  const car = new THREE.Group();
  car.name = 'placeholder-car';
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(4.3, 0.7, 1.75),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.turquoise, metalness: 0.2, roughness: 0.5 }),
  );
  body.name = 'body';
  body.position.y = 0.65;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.6, 1.55),
    new THREE.MeshStandardMaterial({ color: SCENE_COLORS.ivory, roughness: 0.3 }),
  );
  cabin.name = 'cabin';
  cabin.position.set(-0.2, 1.3, 0);
  car.add(body, cabin);
  for (const [x, z] of [
    [1.35, 0.85],
    [1.35, -0.85],
    [-1.35, 0.85],
    [-1.35, -0.85],
  ] as const) {
    const wheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.22, 24),
      new THREE.MeshStandardMaterial({ color: SCENE_COLORS.tire, roughness: 0.9 }),
    );
    wheel.name = 'wheel';
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.32, z);
    car.add(wheel);
  }
  return car;
}
