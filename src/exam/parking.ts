import { classifyCurbDistance } from '../content/validateRules.ts';
import type { ParkingBand } from '../content/schemas.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import type { CarState } from '../sim/car.ts';
import { overlaps } from '../sim/collision.ts';
import type { Point } from '../sim/collision.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { EXAM_CAR, bodyBox, forwardOf } from '../sim/vehicle.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { ParkingBay } from './circuit.ts';
import type { Report } from './street.ts';

/**
 * Stage III (F04-T04): parallel parking in the bay, the final position and the descent (protocolo PDF 13, 24–25,
 * 27, 29–30, 33). Pure judges over the bay's frame, fed once per fixed step by `session.ts`, which scores the
 * reports. The limits below that the protocol does not state are game decisions (REGLAS.md §7, D10–D14, and §9).
 */
export const PARKING = {
  /** Hazards on at least this long before stopping in double file (rule.low.i, protocolo PDF 13, 27). */
  hazardsBeforeStopS: 3,
  /** More manoeuvres than these is minor r; more attempts than these, eliminatory q (protocolo PDF 24–25, 33). */
  maxManoeuvres: 3,
  maxAttempts: 2,
  /** The two axles' distances to the kerb may differ up to this (rule.minor.s, protocolo PDF 25). */
  maxAxleDifferenceCm: 30,
  /** The parking zone along the kerb, from the bay's centre: a stop here is the double-file alignment (D11). */
  zoneAlongM: { min: -8, max: 12 },
  zoneLeftMaxM: 5,
  /** The body's centre this far left of the bay's centreline is in the lane (double file), not in the bay (D11). */
  doubleFileLeftM: 1.2,
  /** Closer than this to the bay's centreline, and within its length plus the margin, the car is in the bay (D11). */
  inBayLeftM: 1,
  inBayAlongMarginM: 2,
  /** Faster than this, the car is moving in a direction (a manoeuvre); slower, it is settling. */
  motionMps: 0.05,
  /** The final position is centred when the body's centre is within this of the bay's centre along the kerb (V3). */
  offCentreM: 0.5,
  /** A painted end line overlapped faster than this is hit (eliminatory d); slower, touched (high d) (D13). */
  lineHitSpeedMps: 1,
  /** A head turn beyond this yaw is looking back, which the reverse allows instead of the mirrors (protocolo PDF 29). */
  lookBackYawRad: 2,
} as const;

export interface KerbDistances {
  /** Right side of the car to the kerb's edge at each axle, in centimetres. */
  frontCm: number;
  rearCm: number;
}

export interface Parking {
  /** Metres from the front bumper to the bay's front line while approaching; null once past it or stopped. */
  aheadM: number | null;
  /** The manoeuvre began: the first stop in the parking zone, in double file (protocolo PDF 13). */
  startedAtS: number | null;
  hazardsSinceS: number | null;
  /** Manoeuvres so far: the alignment, then each change of direction once the reverse began (D12). */
  manoeuvres: number;
  /** Attempts: one, plus one each time the car leaves the bay to align in double file again (D12). */
  attempts: number;
  direction: -1 | 0 | 1;
  reversed: boolean;
  wasInBay: boolean;
  /** A mirror glance or a look back since the alignment, in this attempt (high p). */
  looked: boolean;
  mirrorJudged: boolean;
  /** Which end lines the body overlaps now, so each new overlap is reported once. */
  touching: readonly boolean[];
  /** Live distances while stopped in the bay, and the ones measured when the driver said the manoeuvre was done. */
  kerb: KerbDistances | null;
  final: (KerbDistances & { alongM: number }) | null;
  /** The driver said the parking is done; judged at the next step, when the car is known to be stopped. */
  endRequested: boolean;
  /** The descent (phase `leaving`): the left mirror was checked, the door was opened. */
  leftMirrorChecked: boolean;
  doorOpened: boolean;
}

export function createParking(): Parking {
  return {
    aheadM: null,
    startedAtS: null,
    hazardsSinceS: null,
    manoeuvres: 0,
    attempts: 0,
    direction: 0,
    reversed: false,
    wasInBay: false,
    looked: false,
    mirrorJudged: false,
    touching: [],
    kerb: null,
    final: null,
    endRequested: false,
    leftMirrorChecked: false,
    doorOpened: false,
  };
}

/** A point in the bay's frame: metres along the kerb from the bay's centre, and to the left of its centreline. */
export function bayFrame(bay: ParkingBay, point: Point): { alongM: number; leftM: number } {
  const forward = forwardOf(bay.headingRad);
  const dx = point.x - bay.center.x;
  const dz = point.z - bay.center.z;
  return { alongM: dx * forward.x + dz * forward.z, leftM: dx * forward.z - dz * forward.x };
}

/** Distance from the right side of the car to the kerb's edge at the rear and the front axle (protocolo PDF 21). */
export function kerbDistancesCm(bay: ParkingBay, vehicle: VehicleState): KerbDistances {
  const forward = forwardOf(vehicle.headingRad);
  const left = { x: forward.z, z: -forward.x };
  const halfWidth = EXAM_CAR.widthM / 2;
  const rightOf = (axle: Point): Point => ({ x: axle.x - left.x * halfWidth, z: axle.z - left.z * halfWidth });
  const rear = { x: vehicle.x, z: vehicle.z };
  const front = { x: vehicle.x + forward.x * EXAM_CAR.wheelbaseM, z: vehicle.z + forward.z * EXAM_CAR.wheelbaseM };
  // Rounded to a thousandth of a centimetre, so floating-point noise never moves a band boundary (V1).
  const toKerbCm = (point: Point) => Math.round((bayFrame(bay, point).leftM - bay.kerbLeftM) * 1e5) / 1e3;
  return { frontCm: toKerbCm(rightOf(front)), rearCm: toKerbCm(rightOf(rear)) };
}

export interface ParkingVerdict {
  parking: Parking;
  reports: Report[];
}

/** Notes a look during the manoeuvre: a side-mirror glance (D4) or a look back counts as checking (high p). */
export function noteParkingLook(parking: Parking, yaw: number, mirrorRange: { min: number; max: number }): Parking {
  const glance = Math.abs(yaw) >= mirrorRange.min && Math.abs(yaw) <= mirrorRange.max;
  const back = Math.abs(yaw) >= PARKING.lookBackYawRad;
  return parking.startedAtS !== null && (glance || back) ? { ...parking, looked: true } : parking;
}

/** Notes a look before opening the door: only the left mirror counts (rule.low.j; discrepancy X7). */
export function noteDescentLook(parking: Parking, yaw: number, mirrorRange: { min: number; max: number }): Parking {
  return yaw >= mirrorRange.min && yaw <= mirrorRange.max ? { ...parking, leftMirrorChecked: true } : parking;
}

/** One fixed step of the parking manoeuvre: hazards, manoeuvres, attempts, the mirror check and the end lines. */
export function judgeParkingStep(
  parking: Parking,
  bay: ParkingBay,
  car: CarState,
  cockpit: CockpitState,
  timeS: number,
): ParkingVerdict {
  const vehicle = car.world.vehicle;
  const body = bodyBox(EXAM_CAR, vehicle);
  const centre = bayFrame(bay, { x: body.centerX, z: body.centerZ });
  const speed = vehicle.speedMps;
  const stopped = speed === 0;
  const direction: -1 | 0 | 1 = Math.abs(speed) > PARKING.motionMps ? (speed > 0 ? 1 : -1) : 0;
  const reports: Report[] = [];
  let next: Parking = { ...parking, hazardsSinceS: cockpit.hazards ? (parking.hazardsSinceS ?? timeS) : null };
  const inZone =
    centre.alongM >= PARKING.zoneAlongM.min &&
    centre.alongM <= PARKING.zoneAlongM.max &&
    centre.leftM <= PARKING.zoneLeftMaxM;
  const inBay =
    Math.abs(centre.leftM) < PARKING.inBayLeftM &&
    Math.abs(centre.alongM) < bay.halfLengthM + PARKING.inBayAlongMarginM;
  const doubleFile = inZone && centre.leftM >= PARKING.doubleFileLeftM;
  const frontAheadM = bay.halfLengthM - (centre.alongM + body.halfLengthM);
  next = { ...next, aheadM: next.startedAtS === null && frontAheadM > 0 ? frontAheadM : null };
  if (next.startedAtS === null && stopped && inZone) {
    // The alignment stop in double file: the hazards had to be on for 3 s before it (rule.low.i).
    next = { ...next, startedAtS: timeS, manoeuvres: 1, attempts: 1, direction: 0 };
    const since = next.hazardsSinceS;
    if (since === null || timeS - since < PARKING.hazardsBeforeStopS)
      reports.push({ ruleId: 'rule.low.i-no-hazards-before-parking' });
  }
  if (next.startedAtS !== null) {
    if (direction !== 0 && direction !== next.direction) {
      // Moving forward before the first reverse is still aligning; from the reverse on, each change is a manoeuvre.
      const counts = direction === -1 || next.reversed;
      const manoeuvres = counts ? next.manoeuvres + 1 : next.manoeuvres;
      // The reverse ended: the mirrors or the head had to check behind during it (high p).
      if (next.direction === -1 && !next.mirrorJudged) {
        next = { ...next, mirrorJudged: true };
        if (!next.looked)
          reports.push({ ruleId: 'rule.high.p-no-mirror-check-parking', episode: `attempt-${next.attempts}` });
      }
      next = { ...next, direction, manoeuvres, reversed: next.reversed || direction === -1 };
      if (manoeuvres === PARKING.maxManoeuvres + 1)
        reports.push({ ruleId: 'rule.minor.r-parking-over-three-maneuvers' });
    }
    if (inBay && !next.wasInBay) next = { ...next, wasInBay: true };
    if (next.wasInBay && doubleFile) {
      // Out of the bay and aligned in the lane again: another attempt (rule.eliminatory.q).
      const attempts = next.attempts + 1;
      next = { ...next, attempts, wasInBay: false, looked: false, mirrorJudged: false };
      if (attempts > PARKING.maxAttempts) reports.push({ ruleId: 'rule.eliminatory.q-parking-over-two-attempts' });
    }
  }
  // The painted end lines stand for the bay's markers: a new overlap is a touch, or a hit at speed (D13).
  const touching = bay.lines.map((line, index) => {
    const over = overlaps(body, line);
    if (over && !parking.touching[index])
      reports.push({
        ruleId:
          Math.abs(speed) >= PARKING.lineHitSpeedMps
            ? 'rule.eliminatory.d-curb-mount-or-marker-hit'
            : 'rule.high.d-box-marker-touch',
        episode: `line-${index}-${timeS.toFixed(3)}`,
      });
    return over;
  });
  const kerb = stopped && inBay ? kerbDistancesCm(bay, vehicle) : null;
  return { parking: { ...next, touching, kerb }, reports };
}

/** Rules of the bands each axle ends in (`parkingBands` of rules.json; V1 for exactly 50 cm). */
function bandRules(bands: readonly ParkingBand[], kerb: KerbDistances): string[] {
  const rules: string[] = [];
  for (const cm of [kerb.frontCm, kerb.rearCm]) {
    const band = classifyCurbDistance(bands, cm);
    if (!band) throw new Error(`no parking band covers ${cm} cm`);
    if (band.rule && !rules.includes(band.rule)) rules.push(band.rule);
  }
  return rules;
}

/**
 * The final position, when the driver says the manoeuvre is done with the car stopped: the band of each axle
 * (minor t, minor u, eliminatory r), tilted or off-centre (minor s), and the mirror check of a reverse not judged yet.
 */
export function judgeFinalPosition(
  parking: Parking,
  bay: ParkingBay,
  car: CarState,
  bands: readonly ParkingBand[],
): ParkingVerdict {
  const vehicle = car.world.vehicle;
  const body = bodyBox(EXAM_CAR, vehicle);
  const centre = bayFrame(bay, { x: body.centerX, z: body.centerZ });
  const kerb = kerbDistancesCm(bay, vehicle);
  const reports: Report[] = bandRules(bands, kerb).map((ruleId) => ({ ruleId }));
  const tilted = Math.abs(kerb.frontCm - kerb.rearCm) > PARKING.maxAxleDifferenceCm;
  const offCentre = Math.abs(Math.round(centre.alongM * 1000) / 1000) > PARKING.offCentreM;
  if (tilted || offCentre) reports.push({ ruleId: 'rule.minor.s-parking-off-center-or-tilted' });
  // Rounded to the millimetre, like the distances, so a position on the boundary is judged as such (V3).
  const alongM = Math.round(centre.alongM * 1000) / 1000;
  let next: Parking = { ...parking, kerb, final: { ...kerb, alongM }, endRequested: false };
  if (next.reversed && !next.mirrorJudged) {
    next = { ...next, mirrorJudged: true };
    if (!next.looked)
      reports.push({ ruleId: 'rule.high.p-no-mirror-check-parking', episode: `attempt-${next.attempts}` });
  }
  return { parking: next, reports };
}

/**
 * The descent, judged once when the door opens (protocolo PDF 13, 25, 27): gearbox in N (manual) or P (automatic),
 * handbrake on, low beams off, engine off with the key out (the steering locks with it, D14), and the left mirror
 * checked before opening (rule.low.j; X7: turning the head does not replace it).
 */
export function judgeDescent(parking: Parking, car: CarState, cockpit: CockpitState, kind: TransmissionKind): Report[] {
  const reports: Report[] = [];
  const { powertrain } = car;
  const gear = powertrain.kind === 'manual' ? powertrain.manualGear : powertrain.lever;
  if (gear !== (kind === 'manual' ? 'N' : 'P')) reports.push({ ruleId: 'rule.minor.w-not-neutral-or-park-at-end' });
  if (!powertrain.handbrake) reports.push({ ruleId: 'rule.minor.x-handbrake-not-applied-at-end' });
  if (cockpit.lights === 'low' || cockpit.lights === 'high') reports.push({ ruleId: 'rule.minor.v-low-beams-not-off' });
  if (powertrain.engineRunning || powertrain.key !== 'removed')
    reports.push({ ruleId: 'rule.minor.y-engine-key-steering-lock' });
  if (!parking.leftMirrorChecked) reports.push({ ruleId: 'rule.low.j-no-traffic-check-before-exit' });
  return reports;
}
