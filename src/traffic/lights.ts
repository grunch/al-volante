import type { LightCycle, LightState } from '../sim/scenario.ts';
import { lightAt } from '../sim/scenario.ts';
import type { Crosswalk, Intersection, Network } from './network.ts';

/**
 * Fixed-time signal plans. Every signalled intersection runs the same green/yellow/red cycle for its main street
 * (group 0) with a seeded offset; the crossing street (group 1) gets the complementary phase with an all-red
 * second before its green and a yellow before the main street's green. The durations are a game approximation.
 */
export const SIGNAL_CYCLE = { greenS: 14, yellowS: 3, redS: 19 } as const;
/** Clearance between the main street's red and the crossing street's green. */
const ALL_RED_S = 1;
export const CYCLE_PERIOD_S = SIGNAL_CYCLE.greenS + SIGNAL_CYCLE.yellowS + SIGNAL_CYCLE.redS;

export interface SignalPlan {
  /** Cycle per signalled intersection id, for its group 0. */
  cycles: Readonly<Record<string, LightCycle>>;
}

export function createSignalPlan(network: Network, random: () => number): SignalPlan {
  const cycles: Record<string, LightCycle> = {};
  for (const intersection of network.intersections)
    if (intersection.kind === 'signal')
      cycles[intersection.id] = { ...SIGNAL_CYCLE, offsetS: Math.floor(random() * CYCLE_PERIOD_S) };
  return { cycles };
}

/** Phase time inside the cycle, in [0, period). */
function phaseS(cycle: LightCycle, timeS: number): number {
  return (((timeS + cycle.offsetS) % CYCLE_PERIOD_S) + CYCLE_PERIOD_S) % CYCLE_PERIOD_S;
}

export function groupLight(cycle: LightCycle, group: 0 | 1, timeS: number): LightState {
  if (group === 0) return lightAt(cycle, timeS);
  const phase = phaseS(cycle, timeS);
  const greenStart = cycle.greenS + cycle.yellowS + ALL_RED_S;
  if (phase < greenStart) return 'red';
  return phase < CYCLE_PERIOD_S - SIGNAL_CYCLE.yellowS ? 'green' : 'yellow';
}

/** Seconds of red still ahead for a group, or 0 when it is not red. */
export function redRemainingS(cycle: LightCycle, group: 0 | 1, timeS: number): number {
  if (groupLight(cycle, group, timeS) !== 'red') return 0;
  const phase = phaseS(cycle, timeS);
  if (group === 0) return CYCLE_PERIOD_S - phase;
  return cycle.greenS + cycle.yellowS + ALL_RED_S - phase;
}

export function intersectionLight(
  plan: SignalPlan,
  intersection: Pick<Intersection, 'id' | 'kind'>,
  group: 0 | 1,
  timeS: number,
): LightState | null {
  const cycle = plan.cycles[intersection.id];
  return cycle ? groupLight(cycle, group, timeS) : null;
}

/** The vehicle light of a crosswalk's road: that of its host intersection's group; null where no light applies. */
export function crosswalkLight(plan: SignalPlan, crosswalk: Crosswalk, timeS: number): LightState | null {
  if (!crosswalk.intersectionId) return null;
  const cycle = plan.cycles[crosswalk.intersectionId];
  return cycle ? groupLight(cycle, crosswalk.group, timeS) : null;
}

/** Light state per control id: signals report their main street, signalled crossings their own road. */
export function controlLights(plan: SignalPlan, network: Network, timeS: number): Record<string, LightState> {
  const lights: Record<string, LightState> = {};
  for (const intersection of network.intersections) {
    const cycle = plan.cycles[intersection.id];
    if (cycle && intersection.control) lights[intersection.control.id] = groupLight(cycle, 0, timeS);
  }
  for (const crosswalk of network.crosswalks) {
    const light = crosswalk.controlId ? crosswalkLight(plan, crosswalk, timeS) : null;
    if (crosswalk.controlId && light) lights[crosswalk.controlId] = light;
  }
  return lights;
}
