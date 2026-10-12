import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCockpitScene } from './cockpitScene.ts';
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
});
