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

/** `vehicle` is a car; buses and bicycles arrive with the city traffic (F04-T02). */
export type ActorKind = 'pedestrian' | 'vehicle' | 'bus' | 'bicycle';

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

/**
 * What any traffic exposes after each step: the examiner reads the lights and poses, the driving loop reports the
 * contacts. The scripted scenario below and the seeded city traffic (`src/traffic/`) both produce it.
 */
export interface TrafficSnapshot {
  timeS: number;
  /** The light the car faces next in its direction of travel; green where none applies. */
  light: LightState;
  /** Light state per control id, for the lamps of the scene and for rules about a given crossing. */
  lights: Readonly<Record<string, LightState>>;
  poses: readonly ActorPose[];
  /** Actors the car body started overlapping during this step. */
  contacts: readonly ActorKind[];
}

/** A traffic implementation the driving loop can step beside the car, one fixed step at a time. */
export interface TrafficSource<S extends TrafficSnapshot = TrafficSnapshot> {
  create(): S;
  step(state: S, carBody: OrientedBox, timeS: number, dt: number): S;
}

/** The scripted scenario's one light, keyed for `lights`. */
export const SCENARIO_LIGHT_ID = 'scenario-light';

export interface ScenarioState extends TrafficSnapshot {
  /** When each actor last started, or null if it never did. */
  started: Readonly<Record<string, number | null>>;
  /** The light cycle each cycle-bound actor last ran in, so it runs once per cycle. */
  startedCycle: Readonly<Record<string, number | null>>;
  /** Actors the car body overlaps, so a contact is reported once per overlap episode. */
  touching: readonly string[];
}

const periodOf = (cycle: LightCycle) => cycle.greenS + cycle.yellowS + cycle.redS;

export function lightAt(cycle: LightCycle, timeS: number): LightState {
  const period = periodOf(cycle);
  const phase = (((timeS + cycle.offsetS) % period) + period) % period;
  if (phase < cycle.greenS) return 'green';
  return phase < cycle.greenS + cycle.yellowS ? 'yellow' : 'red';
}

/** Which repetition of the cycle `timeS` falls in, so a cycle-bound actor runs at most once per cycle. */
export function cycleIndexAt(cycle: LightCycle, timeS: number): number {
  return Math.floor((timeS + cycle.offsetS) / periodOf(cycle));
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
  const light = lightAt(scenario.light.cycle, 0);
  return {
    timeS: 0,
    light,
    lights: { [SCENARIO_LIGHT_ID]: light },
    poses: scenario.actors.map((actor) => poseOf(actor, null, 0)),
    started: Object.fromEntries(scenario.actors.map((actor) => [actor.id, null])),
    startedCycle: Object.fromEntries(scenario.actors.map((actor) => [actor.id, null])),
    touching: [],
    contacts: [],
  };
}

function shouldStart(
  actor: Actor,
  startedS: number | null,
  startedCycle: number | null,
  carBody: OrientedBox,
  light: LightState,
  cycle: number,
): boolean {
  if ('carZAtLeast' in actor.trigger) return startedS === null && carBody.centerZ >= actor.trigger.carZAtLeast;
  if (light !== actor.trigger.lightPhase) return false;
  if (startedS === null) return true;
  // Once per cycle: a new run needs a later cycle of the light, never the same phase it already ran in.
  return actor.trigger.everyCycle && startedCycle !== cycle;
}

/** Advances the light and the actors to `timeS`, and reports actors the car body just started to overlap. */
export function stepScenario(
  scenario: Scenario,
  state: ScenarioState,
  carBody: OrientedBox,
  timeS: number,
): ScenarioState {
  const light = lightAt(scenario.light.cycle, timeS);
  const cycle = cycleIndexAt(scenario.light.cycle, timeS);
  const started = { ...state.started };
  const startedCycle = { ...state.startedCycle };
  const poses = scenario.actors.map((actor) => {
    const previous = started[actor.id] ?? null;
    if (shouldStart(actor, previous, startedCycle[actor.id] ?? null, carBody, light, cycle)) {
      started[actor.id] = timeS;
      startedCycle[actor.id] = cycle;
    }
    return poseOf(actor, started[actor.id] ?? null, timeS);
  });
  const overlapping = poses.filter((pose) => pose.active && overlaps(pose.box, carBody));
  const contacts = overlapping.filter((pose) => !state.touching.includes(pose.id)).map((pose) => pose.kind);
  return {
    timeS,
    light,
    lights: { [SCENARIO_LIGHT_ID]: light },
    poses,
    started,
    startedCycle,
    touching: overlapping.map((pose) => pose.id),
    contacts,
  };
}

/** The scripted scenario as a traffic source for the driving loop. */
export function scenarioSource(scenario: Scenario): TrafficSource<ScenarioState> {
  return {
    create: () => createScenarioState(scenario),
    step: (state, carBody, timeS) => stepScenario(scenario, state, carBody, timeS),
  };
}
