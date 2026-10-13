import { describe, expect, it } from 'vitest';
import { SIM_STEP_S } from './fixedStep.ts';
import { DRY_ASPHALT } from './dynamics.ts';
import type { DriveInput } from './dynamics.ts';
import { EXAM_CAR, bodyBox, restingVehicle } from './vehicle.ts';
import { createScenarioState } from './scenario.ts';
import type { Scenario, TrafficSource } from './scenario.ts';
import { initialWorldState, nearestObstacle, stepWorld, trafficOf } from './world.ts';
import type { World, WorldState } from './world.ts';

/** A wall whose near face is the plane z = 10 m. */
const world: World = {
  surface: DRY_ASPHALT,
  obstacles: [
    { id: 'wall', kind: 'wall', box: { centerX: 0, centerZ: 10.5, halfLengthM: 0.5, halfWidthM: 10, headingRad: 0 } },
    { id: 'pole', kind: 'pole', box: { centerX: 2, centerZ: 5, halfLengthM: 0.05, halfWidthM: 0.05, headingRad: 0 } },
  ],
};

function drive(state: WorldState, input: DriveInput, seconds: number): { state: WorldState; contacts: string[] } {
  let current = state;
  const contacts: string[] = [];
  for (let t = 0; t < seconds - 1e-9; t += SIM_STEP_S) {
    current = stepWorld(EXAM_CAR, world, current, input, SIM_STEP_S);
    contacts.push(...current.contacts.map((contact) => contact.obstacleId));
  }
  return { state: current, contacts };
}

const frontOf = (state: WorldState) => {
  const body = bodyBox(EXAM_CAR, state.vehicle);
  return body.centerZ + body.halfLengthM;
};

describe('world step', () => {
  it('stops the car at the wall it drives into, within a centimetre, and reports the impact', () => {
    // Arrange
    const start = initialWorldState(restingVehicle());

    // Act
    const { state, contacts } = drive(start, { tractionN: 1500, brake: 0, steer: 0 }, 10);

    // Assert
    expect(contacts).toContain('wall');
    // Touching allows the 0.1 mm contact tolerance of the collision test.
    expect(frontOf(state)).toBeLessThanOrEqual(10 + 1e-4 + 1e-9);
    expect(frontOf(state)).toBeGreaterThan(10 - 0.01);
    expect(state.vehicle.speedMps).toBe(0);
  });

  it('reports the impact speed, and lets the car reverse away from the wall', () => {
    const start = initialWorldState(restingVehicle());
    let state = start;
    let impact = 0;
    for (let i = 0; i < 1200 && impact === 0; i += 1) {
      state = stepWorld(EXAM_CAR, world, state, { tractionN: 1500, brake: 0, steer: 0 }, SIM_STEP_S);
      impact = state.contacts[0]?.impactSpeedMps ?? 0;
    }

    const away = drive(state, { tractionN: -1500, brake: 0, steer: 0 }, 1).state;

    expect(impact).toBeGreaterThan(3);
    expect(frontOf(away)).toBeLessThan(frontOf(state) - 0.3);
  });

  it('reports the speed at the instant of contact, not at the start of the step', () => {
    // Arrange: braking hard with the bumper 1 cm from the wall, at 2 m/s; the step crosses the wall.
    const body = bodyBox(EXAM_CAR, restingVehicle());
    const gapZ = 10 - 0.01 - (body.centerZ + body.halfLengthM);
    const start = initialWorldState({ ...restingVehicle({ z: gapZ }), speedMps: 2 });

    // Act
    const next = stepWorld(EXAM_CAR, world, start, { tractionN: 0, brake: 1, steer: 0 }, SIM_STEP_S);

    // Assert: slower than when the step began, faster than where the step would have ended.
    const unobstructedEnd = 2 - EXAM_CAR.maxBrakeDecelMps2 * SIM_STEP_S;
    expect(next.contacts[0]?.impactSpeedMps).toBeLessThan(2);
    expect(next.contacts[0]?.impactSpeedMps).toBeGreaterThan(unobstructedEnd - 0.05);
  });

  it('reports only what the car touches where it stops, not an obstacle just behind it', () => {
    // Arrange: a kerb right behind a 10 cm post, and a car at 50 km/h whose next step (11.6 cm) would reach both.
    const postAndKerb: World = {
      surface: DRY_ASPHALT,
      obstacles: [
        {
          id: 'post',
          kind: 'pole',
          box: { centerX: 0, centerZ: 10.05, halfLengthM: 0.05, halfWidthM: 0.05, headingRad: 0 },
        },
        {
          id: 'kerb',
          kind: 'curb',
          box: { centerX: 0, centerZ: 10.25, halfLengthM: 0.15, halfWidthM: 5, headingRad: 0 },
        },
      ],
    };
    const body = bodyBox(EXAM_CAR, restingVehicle());
    const gapZ = 10 - 0.01 - (body.centerZ + body.halfLengthM);
    const start = initialWorldState({ ...restingVehicle({ z: gapZ }), speedMps: 50 / 3.6 });

    // Act
    const next = stepWorld(EXAM_CAR, postAndKerb, start, { tractionN: 0, brake: 0, steer: 0 }, SIM_STEP_S);

    // Assert: the car stops at the post; the kerb behind it was never reached.
    expect(frontOf(next)).toBeLessThan(10.1);
    expect(next.contacts.map((contact) => contact.obstacleId)).toEqual(['post']);
  });

  it('passes beside a pole without touching it, and measures how close it was', () => {
    // The car's right side is at x = -0.875 + 0 ... the pole stands at x = 2, so the gap is 2 - 0.875 - 0.05.
    const start = initialWorldState(restingVehicle({ z: -2 }));

    const { contacts, state } = drive(start, { tractionN: 0, brake: 0, steer: 0 }, 0);
    const nearest = nearestObstacle(EXAM_CAR, world, { ...state.vehicle, z: 3 });

    expect(contacts).toEqual([]);
    expect(nearest?.obstacleId).toBe('pole');
    expect(nearest?.distanceM).toBeCloseTo(2 - 0.875 - 0.05, 6);
  });

  it('keeps time and clears contacts on the next free step', () => {
    const start = initialWorldState(restingVehicle());

    const next = stepWorld(EXAM_CAR, world, start, { tractionN: 0, brake: 0, steer: 0 }, SIM_STEP_S);

    expect(next.timeS).toBeCloseTo(SIM_STEP_S, 12);
    expect(next.contacts).toEqual([]);
  });

  it('steps no traffic in a closed yard, the scripted scenario in a scenario world, and seeded traffic first', () => {
    // Arrange
    const scenario: Scenario = {
      light: { cycle: { greenS: 5, yellowS: 2, redS: 5, offsetS: 0 }, stopLineZ: 9 },
      actors: [],
    };
    const seeded: TrafficSource = { create: () => createScenarioState(scenario), step: (state) => state };

    // Act
    const none = trafficOf(world);
    const scripted = trafficOf({ ...world, scenario });
    const both = trafficOf({ ...world, scenario, traffic: seeded });

    // Assert
    expect(none).toBeUndefined();
    expect(scripted?.create()).toMatchObject({ light: 'green', poses: [] });
    expect(both).toBe(seeded);
  });
});
