import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCockpitScene } from './cockpitScene.ts';
import { COCKPIT_COPY } from '../i18n/es-AR.ts';
import { initialCockpit, commandCockpit } from '../practice/cockpit.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';

describe('cockpit scene', () => {
  it('adjusts only the vehicle body when an obstacle shares its name', () => {
    const obstacle = { ...PRACTICE_YARD.obstacles[0]!, id: 'body' };
    const view = createCockpitScene({ ...PRACTICE_YARD, obstacles: [obstacle] }, EXAM_CAR);
    const body = view.scene.getObjectByName('placeholder-car')!.getObjectByName('body')!;
    expect(body.scale.y).toBe(0.65);
    expect(body.position.y).toBe(0.48);
    expect(view.scene.getObjectByName('body')!.scale.y).toBe(1);
    view.dispose();
  });

  it('moves the driver eye with seat adjustment, heading and observation', () => {
    const view = createCockpitScene(PRACTICE_YARD, EXAM_CAR);
    const cabin = initialCockpit();
    view.update(PRACTICE_YARD_START, cabin, 0, 0);
    const eye = view.camera.position.clone();
    view.update(PRACTICE_YARD_START, { ...cabin, seatHeight: 1, seatDistance: 1 }, 0, 0);
    expect(view.camera.position.y - eye.y).toBeCloseTo(0.07);
    expect(view.camera.position.z - eye.z).toBeCloseTo(0.14);
    view.update(PRACTICE_YARD_START, { ...cabin, lookYaw: 1.3 }, 0, 0);
    expect(view.camera.getWorldDirection(new THREE.Vector3()).x).toBeGreaterThan(0.9);
    view.update({ ...PRACTICE_YARD_START, headingRad: Math.PI / 2 }, cabin, 0, 0);
    expect(view.camera.getWorldDirection(new THREE.Vector3()).x).toBeGreaterThan(0.9);
    view.resize(800, 600);
    expect(view.camera.aspect).toBeCloseTo(4 / 3);
    view.dispose();
  });

  it('animates steering, belt, wipers and headlights from actual state', () => {
    const view = createCockpitScene(PRACTICE_YARD, EXAM_CAR);
    const cabin = { ...initialCockpit(), belt: true, wipers: true, lights: 'high' as const, hazards: true };
    view.update({ ...PRACTICE_YARD_START, steerRad: 0.2, speedMps: 10 }, cabin, 3000, 0.2);
    expect(view.scene.getObjectByName('steering-wheel')!.rotation.z).toBeCloseTo(-2.8);
    expect(view.scene.getObjectByName('seat-belt')!.visible).toBe(true);
    const lights: THREE.SpotLight[] = [];
    view.scene.traverse((object) => {
      if (object instanceof THREE.SpotLight) lights.push(object);
    });
    expect(lights.map((light) => light.intensity)).toEqual([60, 60]);
    view.update(PRACTICE_YARD_START, initialCockpit(), 0, 1);
    expect(view.scene.getObjectByName('seat-belt')!.visible).toBe(false);
    expect(lights.every((light) => light.intensity === 0)).toBe(true);
    view.dispose();
  });

  it('uses three live reflectors in the same world and releases their render targets', () => {
    const view = createCockpitScene(PRACTICE_YARD, EXAM_CAR);
    const cabin = initialCockpit();
    view.update(PRACTICE_YARD_START, cabin, 0, 0);
    expect(view.mirrors).toHaveLength(3);
    const releases = view.mirrors.map(({ mirror }) => vi.spyOn(mirror.getRenderTarget(), 'dispose'));
    for (const { mirror } of view.mirrors) {
      expect(mirror.getRenderTarget().width).toBe(512);
      expect(view.scene.getObjectByName(mirror.name)).toBe(mirror);
    }
    const left = view.mirrors.find((entry) => entry.id === 'left')!;
    const rotation = left.mount.rotation.y;
    view.update(
      PRACTICE_YARD_START,
      commandCockpit(cabin, { type: 'mirror', mirror: 'left', axis: 'yaw', value: 0.2 }),
      0,
      0,
    );
    expect(left.mount.rotation.y - rotation).toBeCloseTo(0.2);
    view.dispose();
    releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
  });
  it('releases instrument textures and disables camera inertia without resetting seat or observation', () => {
    const view = createCockpitScene(PRACTICE_YARD, EXAM_CAR);
    const cabin = { ...initialCockpit(), seatHeight: 0.8, lookYaw: 0.5 };
    const textures = new Set<THREE.Texture>();
    view.scene.traverse((object) => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial && object.material.map)
        textures.add(object.material.map);
    });
    expect(textures.size).toBe(2);
    const releases = [...textures].map((texture) => vi.spyOn(texture, 'dispose'));
    view.update(PRACTICE_YARD_START, cabin, 0, 0);
    const eye = view.camera.position.clone();
    view.update({ ...PRACTICE_YARD_START, speedMps: 1 }, cabin, 1200, 0.1);
    expect(view.camera.position.distanceTo(eye)).toBeGreaterThan(0);
    view.setReducedMotion(true);
    view.update({ ...PRACTICE_YARD_START, speedMps: 2 }, cabin, 1500, 0.2);
    expect(view.camera.position.distanceTo(eye)).toBeLessThan(1e-9);
    expect(view.camera.getWorldDirection(new THREE.Vector3()).x).toBeCloseTo(Math.sin(0.5) * Math.cos(0.055));
    view.dispose();
    releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
  });
  it('renders moving world actors into each mirror without recursive reflections', () => {
    const view = createCockpitScene(PRACTICE_YARD, EXAM_CAR);
    const actor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    actor.name = 'moving-test-actor';
    view.scene.add(actor);
    view.update(PRACTICE_YARD_START, initialCockpit(), 0, 0);
    const positions: number[] = [];
    const renderer = {
      getRenderTarget: () => null,
      setRenderTarget: vi.fn(),
      xr: { enabled: false },
      shadowMap: { autoUpdate: true },
      state: { buffers: { depth: { setMask: vi.fn() } } },
      autoClear: true,
      render: (scene: THREE.Scene, camera: THREE.Camera) => {
        expect(scene).toBe(view.scene);
        expect(camera).not.toBe(view.camera);
        expect(view.mirrors.every((entry) => !entry.mirror.visible)).toBe(true);
        positions.push(scene.getObjectByName('moving-test-actor')!.position.x);
      },
    } as unknown as THREE.WebGLRenderer;
    for (const x of [2, 4]) {
      actor.position.x = x;
      view.scene.updateMatrixWorld(true);
      for (const { mirror } of view.mirrors) {
        mirror.onBeforeRender(
          renderer,
          view.scene,
          view.camera,
          mirror.geometry,
          Array.isArray(mirror.material) ? mirror.material[0]! : mirror.material,
          null!,
        );
      }
    }
    expect(positions).toEqual([2, 2, 2, 4, 4, 4]);
    expect(view.mirrors.every((entry) => entry.mirror.visible)).toBe(true);
    view.dispose();
  });

  it('points the speedometer and rev counter needles at the values printed on their dials', () => {
    // Arrange: a 2D context that records where each dial number is printed.
    const printed: { dial: number; text: string; x: number; y: number }[] = [];
    const red: number[] = [];
    let dial = -1;
    const context = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: () => {
        dial += 1;
      },
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => {
        if (context.strokeStyle === '#db715e') red.push(dial);
      },
      fillText: (text: string, x: number, y: number) => printed.push({ dial, text, x, y }),
    };
    // The dials draw only where the browser has a 2D canvas.
    vi.stubGlobal('CanvasRenderingContext2D', vi.fn());
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const view = createCockpitScene(PRACTICE_YARD, EXAM_CAR);
    const [speedometer, revCounter] = view.scene
      .getObjectsByProperty('name', 'gauge-needle')
      .map((needle) => needle.parent!);
    const angleOf = (dialIndex: number, text: string) => {
      const label = printed.find((item) => item.dial === dialIndex && item.text === text)!;
      return Math.atan2(label.x - 128, 128 - label.y);
    };

    // Assert: 0–120 km/h every 10, 0–6 ×1000 rpm with the last 4 ticks in red, and each needle on its value.
    expect(printed.filter((item) => item.dial === 0).map((item) => item.text)).toEqual([
      ...Array.from({ length: 13 }, (_, index) => String(index * 10)),
      COCKPIT_COPY.speed,
    ]);
    expect(printed.filter((item) => item.dial === 1).map((item) => item.text)).toEqual([
      ...Array.from({ length: 7 }, (_, index) => String(index)),
      COCKPIT_COPY.instrumentRpmScale,
    ]);
    expect(red).toEqual([1, 1, 1, 1]);
    for (const [kmh, rpm] of [
      [0, 0],
      [30, 1000],
      [60, 3000],
      [110, 5000],
    ] as const) {
      view.update({ ...PRACTICE_YARD_START, speedMps: kmh / 3.6 }, initialCockpit(), rpm, 0);
      expect(speedometer!.rotation.z).toBeCloseTo(angleOf(0, String(kmh)), 6);
      expect(revCounter!.rotation.z).toBeCloseTo(angleOf(1, String(rpm / 1000)), 6);
    }
    // Beyond the scale the needles rest on its end, whatever the direction of travel.
    view.update({ ...PRACTICE_YARD_START, speedMps: -50 }, initialCockpit(), 9000, 0);
    expect(speedometer!.rotation.z).toBeCloseTo(angleOf(0, '120'), 6);
    expect(revCounter!.rotation.z).toBeCloseTo(angleOf(1, '6'), 6);
    view.dispose();
    getContext.mockRestore();
    vi.unstubAllGlobals();
  });

  it('dims the headlights by light mode and blinks only the signalled side, half a second on', () => {
    // Arrange
    const view = createCockpitScene(PRACTICE_YARD, EXAM_CAR);
    const spots: THREE.SpotLight[] = [];
    view.scene.traverse((object) => {
      if (object instanceof THREE.SpotLight) spots.push(object);
    });
    const lamps = view.scene.getObjectsByProperty('name', 'turn-lamp') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >[];
    const left = lamps.find((lamp) => lamp.position.x > 0)!;
    const right = lamps.find((lamp) => lamp.position.x < 0)!;
    const lit = () => [left, right].map((lamp) => lamp.material.emissive.getHexString() !== '000000');

    // Act / Assert
    view.update(PRACTICE_YARD_START, { ...initialCockpit(), lights: 'position' }, 0, 0);
    expect(spots.map((spot) => spot.intensity)).toEqual([2, 2]);
    view.update(PRACTICE_YARD_START, { ...initialCockpit(), lights: 'low', signal: 'left' }, 0, 0.2);
    expect(spots.map((spot) => spot.intensity)).toEqual([30, 30]);
    expect(lit()).toEqual([true, false]);
    view.update(PRACTICE_YARD_START, { ...initialCockpit(), signal: 'left' }, 0, 0.7);
    expect(lit()).toEqual([false, false]);
    view.update(PRACTICE_YARD_START, { ...initialCockpit(), signal: 'right' }, 0, 1.1);
    expect(lit()).toEqual([false, true]);
    view.dispose();
  });
});
