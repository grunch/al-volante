import { clearance, overlaps } from './collision.ts';
import type { OrientedBox } from './collision.ts';
import { stepVehicle } from './dynamics.ts';
import type { DriveInput, Surface } from './dynamics.ts';
import { scenarioSource } from './scenario.ts';
import type { Scenario, TrafficSource } from './scenario.ts';
import { bodyBox, interpolateVehicle } from './vehicle.ts';
import type { VehicleSpec, VehicleState } from './vehicle.ts';

/** Bisection rounds to locate an impact inside a step: 2⁻¹² of a step is well under a millimetre at exam speeds. */
const IMPACT_SEARCH_ROUNDS = 12;

export type ObstacleKind = 'wall' | 'pole' | 'curb' | 'cone' | 'vehicle';

export interface Obstacle {
  id: string;
  kind: ObstacleKind;
  box: OrientedBox;
}

export interface World {
  surface: Surface;
  obstacles: readonly Obstacle[];
  /** Painted lines: drawn on the ground, never collided with. */
  markings?: readonly OrientedBox[];
  /** Traffic light and scripted actors, stepped beside the car (F03-T05); none in a closed yard. */
  scenario?: Scenario;
  /** Seeded city traffic (F04-T02); takes precedence over `scenario` when both are set. */
  traffic?: TrafficSource;
}

/** The traffic the driving loop steps beside the car in this world, if any. */
export function trafficOf(world: World): TrafficSource | undefined {
  return world.traffic ?? (world.scenario ? scenarioSource(world.scenario) : undefined);
}

export interface Contact {
  obstacleId: string;
  kind: ObstacleKind;
  /** Speed of the car when it touched, in m/s. */
  impactSpeedMps: number;
}

export interface WorldState {
  vehicle: VehicleState;
  timeS: number;
  /** Contacts that happened during the last step. */
  contacts: readonly Contact[];
}

export function initialWorldState(vehicle: VehicleState): WorldState {
  return { vehicle, timeS: 0, contacts: [] };
}

function hits(spec: VehicleSpec, world: World, vehicle: VehicleState): Obstacle[] {
  const body = bodyBox(spec, vehicle);
  const bodyRadiusM = Math.hypot(body.halfWidthM, body.halfLengthM);
  return world.obstacles.filter((obstacle) => {
    const box = obstacle.box;
    // Conservative circle rejection avoids SAT allocations for distant city sectors.
    const radiusM = bodyRadiusM + Math.hypot(box.halfWidthM, box.halfLengthM);
    const dx = body.centerX - box.centerX,
      dz = body.centerZ - box.centerZ;
    return dx * dx + dz * dz <= radiusM * radiusM && overlaps(body, box);
  });
}

/**
 * Advances the car one fixed step. If the move would push the body into an obstacle, the car stops where it first
 * touches (found by bisection), its speed drops to zero and the contact is reported with the impact speed. A car
 * that starts a step already overlapping (placed there) moves freely, so it can always get out.
 */
export function stepWorld(
  spec: VehicleSpec,
  world: World,
  state: WorldState,
  input: DriveInput,
  dt: number,
): WorldState {
  const next = stepVehicle(spec, state.vehicle, input, dt, world.surface);
  const timeS = state.timeS + dt;
  const touched = hits(spec, world, next);
  if (touched.length === 0 || hits(spec, world, state.vehicle).length > 0)
    return { vehicle: next, timeS, contacts: [] };
  let free = 0;
  let blocked = 1;
  // What the body touches where it is first blocked: an obstacle only the unobstructed step reaches is not hit.
  let touching = touched;
  for (let round = 0; round < IMPACT_SEARCH_ROUNDS; round += 1) {
    const middle = (free + blocked) / 2;
    const atMiddle = hits(spec, world, interpolateVehicle(state.vehicle, next, middle));
    if (atMiddle.length > 0) {
      blocked = middle;
      touching = atMiddle;
    } else free = middle;
  }
  // Speed where the bisection found the contact, not where the step began.
  const impactSpeedMps = Math.abs(state.vehicle.speedMps + (next.speedMps - state.vehicle.speedMps) * free);
  return {
    vehicle: { ...interpolateVehicle(state.vehicle, next, free), speedMps: 0 },
    timeS,
    contacts: touching.map((obstacle) => ({ obstacleId: obstacle.id, kind: obstacle.kind, impactSpeedMps })),
  };
}

/** The closest obstacle and its distance to the car body, for rules about clearances (e.g. 20 cm from the kerb). */
export function nearestObstacle(
  spec: VehicleSpec,
  world: World,
  vehicle: VehicleState,
): { obstacleId: string; distanceM: number } | undefined {
  const body = bodyBox(spec, vehicle);
  return world.obstacles
    .map((obstacle) => ({ obstacleId: obstacle.id, distanceM: clearance(body, obstacle.box) }))
    .sort((a, b) => a.distanceM - b.distanceM)[0];
}
