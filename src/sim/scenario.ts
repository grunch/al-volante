import { overlaps } from './collision.ts';
import type { OrientedBox } from './collision.ts';

export type LightState = 'green' | 'yellow' | 'red';

/** A fixed-time cycle for the car's direction; the cross street has the complementary green. */
export interface LightCycle {
  greenS: number;
  yellowS: number;
  redS: number;
  /** Where in the cycle time 0 falls. */
  offsetS: number;
}

export interface TrafficLight {
  cycle: LightCycle;
  /** The car must stop before this z when the light is red (the stop line of its lane). */
  stopLineZ: number;
}

export type ActorKind = 'pedestrian' | 'vehicle';

/**
 * A scripted actor moves in a straight line from `from` to `to` at a constant speed. It starts when its trigger
 * fires: when the car reaches a z (a pedestrian stepping off the kerb as the car approaches) or on a light phase
 * (cross traffic on its own green). Actors are kinematic: they do not react to the car.
 */
export interface Actor {
  id: string;
  kind: ActorKind;
  halfLengthM: number;
  halfWidthM: number;
  from: { x: number; z: number };
  to: { x: number; z: number };
  speedMps: number;
  trigger: { carZAtLeast: number } | { lightPhase: LightState; everyCycle: boolean };
}

export interface Scenario {
  light: TrafficLight;
  actors: readonly Actor[];
}

export interface ActorPose {
  id: string;
  kind: ActorKind;
  x: number;
  z: number;
  headingRad: number;
  /** Moving along its path; a parked actor waits at `from` or rests at `to`. */
  active: boolean;
  box: OrientedBox;
  inside(zone: OrientedBox): boolean;
}

export interface ScenarioState {
  timeS: number;
  light: LightState;
  poses: readonly ActorPose[];
  /** When each actor last started, or null if it never did. */
  started: Readonly<Record<string, number | null>>;
  /** Actors the car body overlaps, so a contact is reported once per overlap episode. */
  touching: readonly string[];
  /** Actors the car body started overlapping during this step. */
  contacts: readonly ActorKind[];
}

export function lightAt(cycle: LightCycle, timeS: number): LightState {
  const period = cycle.greenS + cycle.yellowS + cycle.redS;
  const phase = (((timeS + cycle.offsetS) % period) + period) % period;
  if (phase < cycle.greenS) return 'green';
  return phase < cycle.greenS + cycle.yellowS ? 'yellow' : 'red';
}

const pathLength = (actor: Actor) => Math.hypot(actor.to.x - actor.from.x, actor.to.z - actor.from.z);

function poseOf(actor: Actor, startedS: number | null, timeS: number): ActorPose {
  const dx = actor.to.x - actor.from.x;
  const dz = actor.to.z - actor.from.z;
  const lengthM = pathLength(actor);
  const travelled = startedS === null ? 0 : Math.min(lengthM, Math.max(0, (timeS - startedS) * actor.speedMps));
  const fraction = lengthM === 0 ? 1 : travelled / lengthM;
  const x = actor.from.x + dx * fraction;
  const z = actor.from.z + dz * fraction;
  const headingRad = Math.atan2(dx, dz);
  const box: OrientedBox = {
    centerX: x,
    centerZ: z,
    halfLengthM: actor.halfLengthM,
    halfWidthM: actor.halfWidthM,
    headingRad,
  };
  return {
    id: actor.id,
    kind: actor.kind,
    x,
    z,
    headingRad,
    active: startedS !== null && travelled < lengthM,
    box,
    inside: (zone) => overlaps(box, zone),
  };
}

export function createScenarioState(scenario: Scenario): ScenarioState {
  return {
    timeS: 0,
    light: lightAt(scenario.light.cycle, 0),
    poses: scenario.actors.map((actor) => poseOf(actor, null, 0)),
    started: Object.fromEntries(scenario.actors.map((actor) => [actor.id, null])),
    touching: [],
    contacts: [],
  };
}

function shouldStart(
  actor: Actor,
  startedS: number | null,
  carBody: OrientedBox,
  light: LightState,
  timeS: number,
): boolean {
  if ('carZAtLeast' in actor.trigger) return startedS === null && carBody.centerZ >= actor.trigger.carZAtLeast;
  if (light !== actor.trigger.lightPhase) return false;
  if (startedS === null) return true;
  // Once per cycle: start again only after the previous run is over, on a later phase of that kind.
  return actor.trigger.everyCycle && timeS - startedS > pathLength(actor) / actor.speedMps;
}

/** Advances the light and the actors to `timeS`, and reports actors the car body just started to overlap. */
export function stepScenario(
  scenario: Scenario,
  state: ScenarioState,
  carBody: OrientedBox,
  timeS: number,
): ScenarioState {
  const light = lightAt(scenario.light.cycle, timeS);
  const started = { ...state.started };
  const poses = scenario.actors.map((actor) => {
    const previous = started[actor.id] ?? null;
    if (shouldStart(actor, previous, carBody, light, timeS)) started[actor.id] = timeS;
    return poseOf(actor, started[actor.id] ?? null, timeS);
  });
  const overlapping = poses.filter((pose) => pose.active && overlaps(pose.box, carBody));
  const contacts = overlapping.filter((pose) => !state.touching.includes(pose.id)).map((pose) => pose.kind);
  return { timeS, light, poses, started, touching: overlapping.map((pose) => pose.id), contacts };
}
