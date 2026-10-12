import { DRY_ASPHALT } from '../dynamics.ts';
import type { OrientedBox } from '../collision.ts';
import type { Scenario } from '../scenario.ts';
import { restingVehicle } from '../vehicle.ts';
import type { World } from '../world.ts';

/**
 * Leg 1 of route A (RECORRIDO.md): Quesada, one way, 127 m from the parking box to Av. Cabildo, exam limit
 * 30 km/h (road maximum 40, from OSM), a traffic light at the corner and a right turn onto the avenue (45 km/h for
 * the exam, 60 on the road). Heading 0 runs along Quesada
 * (+z); +x is the driver's left, so the right turn heads towards -x. The street is 10 m wide between kerbs and the
 * avenue 24 m: game approximations, as are the building fronts and the crosswalk; the length, the limits, the
 * light and the turn come from the route data.
 */
const KERB_RIGHT_X = -6.55;
const KERB_LEFT_X = 3.45;
const LANE_CENTER_X = (KERB_RIGHT_X + KERB_LEFT_X) / 2;
const BLOCK_LENGTH_M = 127;
const STOP_LINE_Z = 125;
const CROSSWALK_Z = 128;
const AVENUE_NEAR_Z = 131;
const AVENUE_FAR_Z = 155;
/** The box front is 127 m from the stop line, so the first 100 m end well before the corner. */
const BOX_FRONT_Z = STOP_LINE_Z - BLOCK_LENGTH_M;
const BLOCK_START_Z = BOX_FRONT_Z - 10;

const post = (id: string, x: number, z: number) => ({
  id,
  kind: 'pole' as const,
  box: { centerX: x, centerZ: z, halfLengthM: 0.05, halfWidthM: 0.05, headingRad: 0 },
});
const kerb = (id: string, centerX: number, centerZ: number, halfLengthM: number, halfWidthM = 0.15) => ({
  id,
  kind: 'curb' as const,
  box: { centerX, centerZ, halfLengthM, halfWidthM, headingRad: 0 },
});
const wall = (id: string, centerX: number, centerZ: number, halfLengthM: number, halfWidthM: number) => ({
  id,
  kind: 'wall' as const,
  box: { centerX, centerZ, halfLengthM, halfWidthM, headingRad: 0 },
});
const line = (centerX: number, centerZ: number, halfLengthM: number, halfWidthM: number): OrientedBox => ({
  centerX,
  centerZ,
  halfLengthM,
  halfWidthM,
  headingRad: 0,
});

const streetCenterZ = (BLOCK_START_Z + AVENUE_NEAR_Z) / 2;
const streetHalfLength = (AVENUE_NEAR_Z - BLOCK_START_Z) / 2;
const crosswalk = line(LANE_CENTER_X, CROSSWALK_Z, 1.5, 5);
const intersection = line(LANE_CENTER_X, (AVENUE_NEAR_Z + AVENUE_FAR_Z) / 2, (AVENUE_FAR_Z - AVENUE_NEAR_Z) / 2, 5);

export const FIRST_BLOCK_ZONES = {
  blockLengthM: BLOCK_LENGTH_M,
  stopLineZ: STOP_LINE_Z,
  crosswalk,
  intersection,
  /** The right turn is done once the car is on the avenue, heading -x, past this x. */
  turnDoneX: -30,
  /**
   * Exam limits (REGLAS.md §6: 30 km/h in streets, 45 in avenues) and the roads' own maxima from OSM (RECORRIDO.md
   * §4: 40 for Quesada, 60 for Cabildo), which fix the eliminatory l and are still to be confirmed in F04-T01.
   */
  limits: { examKmh: 30, roadKmh: 40, avenueExamKmh: 45, avenueRoadKmh: 60 },
} as const;

const scenario: Scenario = {
  // Starts on green; a car leaving the box at a normal pace usually reaches the corner on red.
  light: { cycle: { greenS: 10, yellowS: 3, redS: 20, offsetS: 0 }, stopLineZ: STOP_LINE_Z },
  actors: [
    {
      // Steps off the left kerb when the car is 30 m from the stop line and crosses to the right kerb.
      id: 'pedestrian',
      kind: 'pedestrian',
      halfLengthM: 0.25,
      halfWidthM: 0.25,
      from: { x: KERB_LEFT_X + 0.6, z: CROSSWALK_Z },
      to: { x: KERB_RIGHT_X - 0.6, z: CROSSWALK_Z },
      speedMps: 1.2,
      trigger: { carZAtLeast: STOP_LINE_Z - 30 },
    },
    {
      // Cross traffic along the avenue on every red light of Quesada.
      id: 'cross-car',
      kind: 'vehicle',
      halfLengthM: 2.15,
      halfWidthM: 0.875,
      // In the far half of the avenue: the right turn hugs the near kerb, so only going straight meets it.
      from: { x: 60, z: 149 },
      to: { x: -70, z: 149 },
      speedMps: 11,
      trigger: { lightPhase: 'red', everyCycle: true },
    },
  ],
};

export const FIRST_BLOCK: World = {
  surface: DRY_ASPHALT,
  obstacles: [
    // Quesada: kerbs up to the corner, building fronts behind them, and the closed end behind the box.
    kerb('kerb-right', KERB_RIGHT_X, streetCenterZ, streetHalfLength),
    kerb('kerb-left', KERB_LEFT_X, streetCenterZ, streetHalfLength),
    wall('front-right', KERB_RIGHT_X - 6, streetCenterZ, streetHalfLength, 3),
    wall('front-left', KERB_LEFT_X + 6, streetCenterZ, streetHalfLength, 3),
    wall('street-end', LANE_CENTER_X, BLOCK_START_Z - 2, 1, 12),
    // The avenue: far kerb and fronts; near-side fronts on both sides of the corner.
    kerb('avenue-far', 0, AVENUE_FAR_Z + 0.15, 0.15, 90),
    wall('avenue-far-front', 0, AVENUE_FAR_Z + 6, 3, 90),
    wall('avenue-near-west', KERB_RIGHT_X - 50, AVENUE_NEAR_Z - 3, 3, 40),
    wall('avenue-near-east', KERB_LEFT_X + 50, AVENUE_NEAR_Z - 3, 3, 40),
    post('box-front-kerb', -6.3, BOX_FRONT_Z),
    post('box-front-lane', -4, BOX_FRONT_Z),
    post('box-rear-kerb', -6.3, BOX_FRONT_Z - 6),
    post('box-rear-lane', -4, BOX_FRONT_Z - 6),
  ],
  markings: [
    line(-6.3, BOX_FRONT_Z - 3, 3, 0.05),
    line(-4, BOX_FRONT_Z - 3, 3, 0.05),
    line(-5.15, BOX_FRONT_Z - 6 + 0.05, 0.05, 1.15),
    line(-5.15, BOX_FRONT_Z - 0.05, 0.05, 1.15),
    // Stop line and crosswalk stripes.
    line(LANE_CENTER_X, STOP_LINE_Z, 0.2, 5),
    ...[-5.5, -3.5, -1.5, 0.5, 2.5].map((x) => line(x, CROSSWALK_Z, 1.5, 0.4)),
  ],
  scenario,
};

/** Rear axle in the box, facing along Quesada with the kerb on the right (same box as the practice yard). */
export const FIRST_BLOCK_START = restingVehicle({ x: -5.15, z: BOX_FRONT_Z - 6 + 1.65, headingRad: 0 });
