import { offsetPoint } from '../city/model.ts';
import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import type { ActorPose } from '../sim/scenario.ts';
import { aheadOnLap } from './lookahead.ts';
import { locateOnPath, pointAlong } from './network.ts';
import type { Network, Path } from './network.ts';

/**
 * The ambulance on duty of the circuit (F04-T03): one seeded emergency vehicle that appears behind the car once it
 * has entered leg 3 (Guayra), comes up the route at its own speed, sirens on, and overtakes along the left of the
 * lane. The driver must let it through (protocolo PDF 12, eliminatory n). Everything numeric here is a game
 * approximation: the leg, the distance behind, the speed, the lateral offset and the patience before it gives up.
 */
export const EMERGENCY = {
  /** Length and width of the ambulance body. */
  lengthM: 5,
  widthM: 2,
  /** Appears when the car is this far into leg 3, this far behind it. */
  triggerLeg: 3,
  triggerIntoLegM: 20,
  behindM: 90,
  /** Its own speed on the route (50 km/h): faster than the exam limit, as an emergency vehicle may be. */
  speedMps: 14,
  /** It overtakes along a line this far to the left of the route lane. */
  offsetLeftM: 2.4,
  /** It stops when anything stands closer than this straight ahead of it. */
  standoffM: 6,
  /** After waiting this long behind a car that does not make way, it finds its own way (despawns). */
  patienceS: 6,
  /** It vanishes once this far ahead of the car. */
  goneAheadM: 150,
} as const;

/** Lateral tolerance when locating the car on the lap for the trigger. */
const CAR_ON_ROUTE_M = 6;

export interface EmergencyPlan {
  /** Lap distance at which the ambulance is triggered. */
  triggerS: number;
}

export interface EmergencyState {
  /** Distance along the lap; null before it appears and after it is gone. */
  s: number | null;
  speedMps: number;
  waitingS: number;
  /** It ran once already: a lap has one ambulance. */
  done: boolean;
}

export function planEmergency(network: Network): EmergencyPlan | null {
  const lap = network.paths.find((path) => path.id === 'lap');
  const segment = lap?.segments.find((item) => item.lane.road.leg === EMERGENCY.triggerLeg);
  return segment ? { triggerS: segment.startS + EMERGENCY.triggerIntoLegM } : null;
}

export const createEmergencyState = (): EmergencyState => ({ s: null, speedMps: 0, waitingS: 0, done: false });

export function emergencyBox(lap: Path, s: number): OrientedBox {
  const { point, headingRad } = pointAlong(lap, s);
  const center = offsetPoint(point, headingRad, EMERGENCY.offsetLeftM);
  return {
    centerX: center.x,
    centerZ: center.z,
    halfLengthM: EMERGENCY.lengthM / 2,
    halfWidthM: EMERGENCY.widthM / 2,
    headingRad,
  };
}

/** Bumper gap from `self` to a box straight ahead of it (within its own width), or null when beside or behind. */
export function gapAhead(self: OrientedBox, other: OrientedBox, reachM: number): number | null {
  const forward = { x: Math.sin(self.headingRad), z: Math.cos(self.headingRad) };
  const left = { x: Math.cos(self.headingRad), z: -Math.sin(self.headingRad) };
  const dx = other.centerX - self.centerX,
    dz = other.centerZ - self.centerZ;
  const along = dx * forward.x + dz * forward.z;
  const lateral = Math.abs(dx * left.x + dz * left.z);
  const reach = Math.hypot(other.halfLengthM, other.halfWidthM);
  if (along <= 0 || along > reachM || lateral > self.halfWidthM + reach) return null;
  const probe: OrientedBox = {
    ...self,
    centerX: self.centerX + forward.x * along,
    centerZ: self.centerZ + forward.z * along,
  };
  // Only what the ambulance would actually run into counts, not a box that merely shares its lateral band.
  if (!overlaps(probe, other) && !overlaps({ ...probe, halfWidthM: self.halfWidthM + 0.3 }, other)) return null;
  return Math.max(0, along - self.halfLengthM - reach);
}

/** Advances the ambulance one step beside the car; `obstacles` are the posed vehicles it will not drive through. */
export function stepEmergency(
  lap: Path,
  plan: EmergencyPlan,
  state: EmergencyState,
  carBody: OrientedBox,
  obstacles: readonly OrientedBox[],
  dt: number,
): EmergencyState {
  if (state.done) return state;
  const located = locateOnPath(lap, { x: carBody.centerX, z: carBody.centerZ }, CAR_ON_ROUTE_M);
  if (state.s === null) {
    if (!located || aheadOnLap(lap, plan.triggerS, located.s) < 0 || aheadOnLap(lap, plan.triggerS, located.s) > 40)
      return state;
    return { ...state, s: (((located.s - EMERGENCY.behindM) % lap.lengthM) + lap.lengthM) % lap.lengthM, speedMps: 0 };
  }
  const self = emergencyBox(lap, state.s);
  const blocked = [carBody, ...obstacles].some((box) => {
    const gap = gapAhead(self, box, EMERGENCY.standoffM + EMERGENCY.lengthM);
    return gap !== null && gap < EMERGENCY.standoffM;
  });
  const speedMps = blocked ? 0 : EMERGENCY.speedMps;
  const waitingS = blocked ? state.waitingS + dt : 0;
  const s = (state.s + speedMps * dt) % lap.lengthM;
  const gone =
    waitingS >= EMERGENCY.patienceS || (located !== null && aheadOnLap(lap, located.s, s) > EMERGENCY.goneAheadM);
  if (gone) return { s: null, speedMps: 0, waitingS: 0, done: true };
  return { ...state, s, speedMps, waitingS };
}

export function emergencyPose(lap: Path, state: EmergencyState): ActorPose | null {
  if (state.s === null) return null;
  const box = emergencyBox(lap, state.s);
  return {
    id: 'emergency-0',
    kind: 'emergency',
    x: box.centerX,
    z: box.centerZ,
    headingRad: box.headingRad,
    active: true,
    box,
    inside: (zone) => overlaps(box, zone),
  };
}
