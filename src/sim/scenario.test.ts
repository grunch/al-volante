import { describe, expect, it } from 'vitest';
import type { OrientedBox } from './collision.ts';
import { createScenarioState, lightAt, stepScenario } from './scenario.ts';
import type { Scenario } from './scenario.ts';

const cycle = { greenS: 10, yellowS: 3, redS: 12, offsetS: 0 };

/** A pedestrian crossing from the left kerb (+x) to the right one, triggered when the car reaches z = 20. */
const scenario: Scenario = {
  light: { cycle, stopLineZ: 50 },
  actors: [
    {
      id: 'pedestrian',
      kind: 'pedestrian',
      halfLengthM: 0.25,
      halfWidthM: 0.25,
      from: { x: 5, z: 55 },
      to: { x: -5, z: 55 },
      speedMps: 1,
      trigger: { carZAtLeast: 20 },
    },
    {
      id: 'bus',
      kind: 'vehicle',
      halfLengthM: 2,
      halfWidthM: 1,
      from: { x: 40, z: 60 },
      to: { x: -40, z: 60 },
      speedMps: 8,
      trigger: { lightPhase: 'red', everyCycle: true },
    },
  ],
};

const carAt = (x: number, z: number): OrientedBox => ({
  centerX: x,
  centerZ: z,
  halfLengthM: 2.15,
  halfWidthM: 0.875,
  headingRad: 0,
});

const poseOf = (state: ReturnType<typeof createScenarioState>, id: string) =>
  state.poses.find((pose) => pose.id === id);

describe('traffic light', () => {
  it('cycles green, yellow and red from the cycle offset', () => {
    expect(lightAt(cycle, 0)).toBe('green');
    expect(lightAt(cycle, 9.99)).toBe('green');
    expect(lightAt(cycle, 10)).toBe('yellow');
    expect(lightAt(cycle, 13)).toBe('red');
    expect(lightAt(cycle, 24.99)).toBe('red');
    expect(lightAt(cycle, 25)).toBe('green');
    expect(lightAt({ ...cycle, offsetS: 13 }, 0)).toBe('red');
  });
});

describe('scripted actors', () => {
  it('keeps a triggered actor waiting until the car reaches its trigger, then walks it along its path', () => {
    let state = createScenarioState(scenario);
    state = stepScenario(scenario, state, carAt(0, 10), 1);
    expect(poseOf(state, 'pedestrian')).toMatchObject({ x: 5, z: 55, active: false });

    state = stepScenario(scenario, state, carAt(0, 20), 2);
    state = stepScenario(scenario, state, carAt(0, 20), 5);

    expect(poseOf(state, 'pedestrian')).toMatchObject({ x: 2, z: 55, active: true });
  });

  it('parks an actor at its destination once it arrives, and never restarts a one-off actor', () => {
    let state = createScenarioState(scenario);
    state = stepScenario(scenario, state, carAt(0, 20), 1);
    state = stepScenario(scenario, state, carAt(0, 20), 30);
    state = stepScenario(scenario, state, carAt(0, 5), 31);

    expect(poseOf(state, 'pedestrian')).toMatchObject({ x: -5, z: 55, active: false });
  });

  it('sends a cycle-bound actor across on every red light and keeps it out of the way otherwise', () => {
    let state = createScenarioState(scenario);
    state = stepScenario(scenario, state, carAt(0, 0), 5);
    expect(poseOf(state, 'bus')?.active).toBe(false);

    state = stepScenario(scenario, state, carAt(0, 0), 13);
    state = stepScenario(scenario, state, carAt(0, 0), 18);
    expect(poseOf(state, 'bus')).toMatchObject({ x: 0, z: 60, active: true });

    state = stepScenario(scenario, state, carAt(0, 0), 25 + 13);
    state = stepScenario(scenario, state, carAt(0, 0), 25 + 18);
    expect(poseOf(state, 'bus')).toMatchObject({ x: 0, z: 60, active: true });
  });

  it('reports a contact with an active actor the car body overlaps, once per overlap episode', () => {
    let state = createScenarioState(scenario);
    state = stepScenario(scenario, state, carAt(0, 20), 1);
    state = stepScenario(scenario, state, carAt(0, 20), 5); // pedestrian at x = 2
    state = stepScenario(scenario, state, carAt(2, 55), 5.1);
    expect(state.contacts).toEqual(['pedestrian']);

    state = stepScenario(scenario, state, carAt(2, 55), 5.2);
    expect(state.contacts).toEqual([]);
    expect(state.light).toBe('green');
  });

  it('tells whether an actor is inside a zone, for rules about crossings', () => {
    let state = createScenarioState(scenario);
    state = stepScenario(scenario, state, carAt(0, 20), 1);
    state = stepScenario(scenario, state, carAt(0, 20), 4); // pedestrian at x = 3, on the road

    const road: OrientedBox = { centerX: 0, centerZ: 55, halfLengthM: 2, halfWidthM: 5, headingRad: 0 };
    expect(poseOf(state, 'pedestrian')?.inside(road)).toBe(true);
    expect(poseOf(state, 'bus')?.inside(road)).toBe(false);
  });
});
