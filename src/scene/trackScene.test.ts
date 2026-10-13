import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCarModel, poseCar } from './carModel.ts';
import { createTrackScene } from './trackScene.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';
import { FIRST_BLOCK, FIRST_BLOCK_START, FIRST_BLOCK_ZONES } from '../sim/tracks/firstBlock.ts';
import { createScenarioState, stepScenario } from '../sim/scenario.ts';
import { EXAM_CAR, bodyBox, restingVehicle } from '../sim/vehicle.ts';

describe('car model', () => {
  it('matches the simulated car: length along +z, axles one wheelbase apart', () => {
    const car = createCarModel(EXAM_CAR);
    const bounds = new THREE.Box3().setFromObject(car);
    const wheels = car.children.filter((child) => child.name === 'wheel');
    const axles = [...new Set(wheels.map((wheel) => wheel.position.z.toFixed(3)))].map(Number);

    expect(bounds.max.z - bounds.min.z).toBeCloseTo(EXAM_CAR.lengthM, 3);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(EXAM_CAR.widthM, 3);
    expect(wheels).toHaveLength(4);
    expect(Math.abs((axles[0] ?? 0) - (axles[1] ?? 0))).toBeCloseTo(EXAM_CAR.wheelbaseM, 3);
  });

  it('is posed at the body centre with the simulated heading, and steers the front wheels', () => {
    const car = createCarModel(EXAM_CAR);
    const state = { ...restingVehicle({ x: 3, z: -2, headingRad: 0.7 }), steerRad: 0.3 };

    poseCar(car, EXAM_CAR, state);

    const body = bodyBox(EXAM_CAR, state);
    expect(car.position.x).toBeCloseTo(body.centerX, 9);
    expect(car.position.z).toBeCloseTo(body.centerZ, 9);
    expect(car.rotation.y).toBeCloseTo(0.7, 9);
    const front = car.children.filter((child) => child.name === 'wheel' && child.userData.front === true);
    expect(front).toHaveLength(2);
    for (const wheel of front) expect(wheel.rotation.y).toBeCloseTo(0.3, 9);
  });
});

describe('track scene', () => {
  it('draws every obstacle of the world and the car', () => {
    const track = createTrackScene(PRACTICE_YARD, EXAM_CAR, { reducedMotion: true });

    for (const obstacle of PRACTICE_YARD.obstacles)
      expect(track.scene.getObjectByName(obstacle.id), obstacle.id).toBeDefined();
    expect(track.scene.getObjectByName('placeholder-car')).toBeDefined();
    track.dispose();
  });

  it('paints a one-metre grid and the world markings on the ground, without making them obstacles', () => {
    const track = createTrackScene(PRACTICE_YARD, EXAM_CAR, { reducedMotion: true });

    expect(track.scene.getObjectByName('grid')).toBeDefined();
    expect(PRACTICE_YARD.markings?.length).toBe(4);
    for (const index of PRACTICE_YARD.markings?.keys() ?? [])
      expect(track.scene.getObjectByName(`marking-${index}`)).toBeDefined();
    track.dispose();
  });

  it('follows the car with the camera, behind it and looking ahead', () => {
    const track = createTrackScene(PRACTICE_YARD, EXAM_CAR, { reducedMotion: true });

    track.update(PRACTICE_YARD_START);
    const atStart = track.camera.position.clone();
    track.update({ ...PRACTICE_YARD_START, z: 10 });

    expect(atStart.z).toBeLessThan(0);
    expect(atStart.y).toBeGreaterThan(1.5);
    expect(track.camera.position.z - atStart.z).toBeCloseTo(10, 6);
    track.dispose();
  });

  it('eases the camera towards the car when motion is allowed', () => {
    const track = createTrackScene(PRACTICE_YARD, EXAM_CAR, { reducedMotion: false });

    track.update(PRACTICE_YARD_START);
    const before = track.camera.position.z;
    track.update({ ...PRACTICE_YARD_START, z: 10 });

    expect(track.camera.position.z - before).toBeGreaterThan(0);
    expect(track.camera.position.z - before).toBeLessThan(10);
    track.dispose();
  });
});

describe('track scene ground', () => {
  it('covers the whole first block, crossing included, instead of a fixed square around the origin', () => {
    const view = createTrackScene(FIRST_BLOCK, EXAM_CAR, { reducedMotion: true });
    const ground = view.scene.getObjectByName('ground') as THREE.Mesh;
    const bounds = new THREE.Box3().setFromObject(ground);
    const grid = view.scene.getObjectByName('grid');

    expect(bounds.max.z).toBeGreaterThan(FIRST_BLOCK_ZONES.intersection.centerZ + 30);
    expect(bounds.min.z).toBeLessThan(FIRST_BLOCK_START.z - 10);
    expect(grid?.position.z).toBeCloseTo(ground.position.z, 6);
    view.dispose();
  });
});

describe('track scene scenario', () => {
  it('draws the scenario actors and a traffic light, and moves them with the scenario state', () => {
    const view = createTrackScene(FIRST_BLOCK, EXAM_CAR, { reducedMotion: true });
    const pedestrian = view.scene.getObjectByName('actor-pedestrian');
    const light = view.scene.getObjectByName('traffic-light');
    expect(pedestrian).toBeDefined();
    expect(light?.position.z).toBeCloseTo(FIRST_BLOCK_ZONES.stopLineZ + 1, 6);

    let state = createScenarioState(FIRST_BLOCK.scenario!);
    state = stepScenario(FIRST_BLOCK.scenario!, state, bodyBox(EXAM_CAR, { ...FIRST_BLOCK_START, z: 100 }), 14);
    state = stepScenario(FIRST_BLOCK.scenario!, state, bodyBox(EXAM_CAR, { ...FIRST_BLOCK_START, z: 100 }), 15);
    view.update({ ...FIRST_BLOCK_START, z: 100 }, state);

    const red = view.scene.getObjectByName('lamp-red') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const green = view.scene.getObjectByName('lamp-green') as THREE.Mesh<
      THREE.BufferGeometry,
      THREE.MeshStandardMaterial
    >;
    expect(state.light).toBe('red');
    expect(red.material.emissiveIntensity).toBeGreaterThan(0);
    expect(green.material.emissiveIntensity).toBe(0);
    expect(pedestrian?.position.x).toBeLessThan(FIRST_BLOCK.scenario!.actors[0]!.from.x);
    view.dispose();
  });

  it('poses only the actors it drew and keeps its aspect through a collapsed resize', () => {
    // Arrange
    const view = createTrackScene(FIRST_BLOCK, EXAM_CAR, { reducedMotion: true });
    view.resize(1600, 900);
    const state = createScenarioState(FIRST_BLOCK.scenario!);
    const [known] = state.poses;
    const stranger = { ...known!, id: 'stranger', x: 3, z: 4 };

    // Act
    view.update(FIRST_BLOCK_START, { ...state, poses: [stranger, { ...known!, x: 1, z: 2, headingRad: 0.5 }] });
    view.resize(0, 900);
    view.resize(1600, 0);

    // Assert
    expect(view.scene.getObjectByName('actor-stranger')).toBeUndefined();
    const drawn = view.scene.getObjectByName(`actor-${known!.id}`)!;
    expect([drawn.position.x, drawn.position.z, drawn.rotation.y]).toEqual([1, 2, 0.5]);
    expect(view.camera.aspect).toBeCloseTo(16 / 9, 9);
    view.dispose();
  });
});

describe('track scene without markings', () => {
  it('grounds a world that has obstacles only, sized to them', () => {
    const { markings, ...bare } = PRACTICE_YARD;
    const view = createTrackScene(bare, EXAM_CAR, { reducedMotion: true });
    expect(markings?.length).toBeGreaterThan(0);
    expect(view.scene.getObjectByName('marking-0')).toBeUndefined();
    const ground = view.scene.getObjectByName('ground') as THREE.Mesh<THREE.PlaneGeometry>;
    expect(ground.geometry.parameters.width).toBeGreaterThanOrEqual(200);
    view.dispose();
  });
});
