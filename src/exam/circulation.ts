import { overlaps } from '../sim/collision.ts';
import type { OrientedBox, Point } from '../sim/collision.ts';
import type { CarState } from '../sim/car.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import type { TrafficSnapshot } from '../sim/scenario.ts';
import { EXAM_CAR, bodyBox } from '../sim/vehicle.ts';
import { intersectionLight } from '../traffic/lights.ts';
import { lookAhead } from '../traffic/lookahead.ts';
import { CROSSWALK_HALF_LENGTH_M, headingDifference, travelDistance } from '../traffic/network.ts';
import { distanceAlong, lateralOnRoad, roadAt } from './circuit.ts';
import { SIGNAL_BEFORE_CORNER_M } from './circuit.ts';
import type { Circuit, CircuitCrossing } from './circuit.ts';
import { imminentContact, judgeEmergency, judgeLane, judgeOvertaking } from './circulationActors.ts';
import { CIRCULATION, across, kmhOf, poseSpeed, remember } from './street.ts';
import type { Frame, Notice, Report, Street } from './street.ts';

export { CIRCULATION, createStreet } from './street.ts';
export type { Notice, Report, Street } from './street.ts';

export interface Verdict {
  street: Street;
  reports: Report[];
  /** The car completed the eight legs and is back on the first one: stage II is done. */
  done: boolean;
  takeover: boolean;
}

/** Notes the cabin's signal lever: when each side was switched on, in time and in lap distance. */
export function noteSignal(street: Street, cockpit: CockpitState, timeS: number, frontS: number | null): Street {
  let next = street;
  for (const side of ['left', 'right'] as const) {
    const on = cockpit.signal === side;
    const since = next.signalSince[side];
    if (on && since === null)
      next = {
        ...next,
        signalSince: { ...next.signalSince, [side]: timeS },
        signalAtS: { ...next.signalAtS, [side]: frontS },
      };
    if (!on && since !== null)
      next = {
        ...next,
        signalSince: { ...next.signalSince, [side]: null },
        signalAtS: { ...next.signalAtS, [side]: null },
      };
  }
  return next;
}

/** A glance at a side mirror (D4): a short turn of the head, within the mirror yaw range, as in the box exit. */
export function noteGlance(street: Street, yaw: number, atS: number): Street {
  return { ...street, lastGlance: { yaw, atS } };
}

/** Exam speed against the road's maximum (decision D2: one episode, the more severe rule only; D3: per leg). */
function judgeSpeed(street: Street, frame: Frame, reports: Report[]): Street {
  const road = roadAt(frame.circuit.lap, frame.centreS);
  const examKmh = road?.examMaxKmh ?? frame.leg.examKmh;
  const postedKmh = road?.postedMaxKmh ?? frame.leg.postedKmh;
  const tolerance = CIRCULATION.speedToleranceKmh;
  const over = frame.kmh > examKmh + tolerance;
  let next = street;
  if (over && next.speedingIn !== frame.legKey)
    next = { ...next, speedingIn: frame.legKey, speedEpisodes: next.speedEpisodes + 1 };
  if (!over && next.speedingIn !== null) next = { ...next, speedingIn: null };
  const episode = `speed-${next.speedEpisodes}`;
  if (postedKmh !== null && frame.kmh > postedKmh + tolerance) {
    if (next.roadMaxEpisode !== next.speedEpisodes) {
      // One episode, the more severe rule only (D2): the exam-speed fault of this episode is withdrawn.
      next = { ...next, roadMaxEpisode: next.speedEpisodes };
      reports.push({ ruleId: 'rule.high.f-exam-speed-exceeded', episode, withdraw: true });
      reports.push({ ruleId: 'rule.eliminatory.l-road-speed-limit-exceeded', episode });
    }
    return next;
  }
  if (over && next.roadMaxEpisode !== next.speedEpisodes)
    reports.push({ ruleId: 'rule.high.f-exam-speed-exceeded', episode });
  return next;
}

/** A motor vehicle moving across the pavement ahead (cyclists are high l, pedestrians have the crosswalks). */
function vehicleInside(street: Street, frame: Frame, boxes: readonly OrientedBox[]): boolean {
  const heading = frame.car.world.vehicle.headingRad;
  return frame.scenario.poses.some((pose) => {
    if (pose.kind !== 'vehicle' && pose.kind !== 'bus') return false;
    if (!across(pose.headingRad, heading)) return false;
    const speed = poseSpeed(street, pose, frame.dt);
    return Math.hypot(speed.x, speed.z) > CIRCULATION.arrivingMinSpeedMps && boxes.some((box) => pose.inside(box));
  });
}

/** Whether a vehicle on an approach from the right is about to reach its line (manual.pdf PDF 64). */
function arrivingFromRight(street: Street, frame: Frame, crossing: CircuitCrossing): boolean {
  const heading = frame.car.world.vehicle.headingRad;
  for (const other of crossing.otherApproaches) {
    const difference = headingDifference(other.headingRad, heading);
    if (difference <= Math.PI / 4 || difference >= (3 * Math.PI) / 4) continue;
    for (const pose of frame.scenario.poses) {
      if (pose.kind !== 'vehicle' && pose.kind !== 'bus') continue;
      if (Math.abs(headingDifference(pose.headingRad, other.headingRad)) > Math.PI / 3) continue;
      if (Math.abs(lateralOnRoad(other.road, pose)) > other.road.widthM / 2 + 1) continue;
      const remaining = other.entryM - travelDistance(other.road, other.reverse, pose) - pose.box.halfLengthM;
      if (remaining < -1 || remaining > CIRCULATION.arrivingM) continue;
      const before = street.poseMemory[pose.id];
      const speed = before ? Math.hypot(pose.x - before.x, pose.z - before.z) / frame.dt : 0;
      if (speed > CIRCULATION.arrivingMinSpeedMps) return true;
    }
  }
  return false;
}

function signalledTurn(street: Street, crossing: CircuitCrossing, frame: Frame, reports: Report[]): void {
  const corner = crossing.corner;
  if (!corner) return;
  const cockpitSignal = frame.cockpit.signal;
  if (cockpitSignal !== corner.turn) {
    reports.push({ ruleId: 'rule.low.g-no-turn-signal', episode: crossing.intersectionId });
    return;
  }
  const since = street.signalAtS[corner.turn];
  if (since !== null && crossing.lineS - since < SIGNAL_BEFORE_CORNER_M)
    reports.push({ ruleId: 'rule.minor.q-turn-lane-late', episode: crossing.intersectionId });
}

/** Everything that happens at a stop line the moment the front bumper crosses it. */
function judgeLineCrossing(street: Street, frame: Frame, crossing: CircuitCrossing, reports: Report[]): Street {
  let next: Street = { ...street, crossed: [...street.crossed, crossing.approachId] };
  const { circuit, scenario } = frame;
  if (crossing.rule === 'signal') {
    const intersection = circuit.traffic.network.intersections.find((item) => item.id === crossing.intersectionId);
    const light = intersection
      ? intersectionLight(circuit.traffic.plan, intersection, crossing.group, scenario.timeS)
      : null;
    if (light === 'red') reports.push({ ruleId: 'rule.eliminatory.k-red-light' });
  } else if (crossing.rule === 'stop') {
    // A STOP demands a full stop before the line and the way clear (protocolo PDF 12; manual.pdf PDF 64).
    if (street.stoppedAt !== crossing.approachId || vehicleInside(street, frame, crossing.conflicts))
      reports.push({ ruleId: 'rule.high.j-stop-or-yield-sign', episode: crossing.intersectionId });
  } else if (vehicleInside(street, frame, crossing.conflicts) || arrivingFromRight(street, frame, crossing)) {
    reports.push({ ruleId: 'rule.high.k-unsignalized-priority', episode: crossing.intersectionId });
  }
  if (crossing.corner) {
    signalledTurn(street, crossing, frame, reports);
    // The turn starts from the lane nearest its side (high n, escalatable; discrepancy X2).
    const road = roadAt(circuit.lap, frame.centreS);
    if (road && road.lanes > 1 && street.laneIndex !== null) {
      const wanted = crossing.corner.turn === 'right' ? 0 : road.lanes - 1;
      if (street.laneIndex !== wanted) {
        reports.push({ ruleId: 'rule.high.n-turn-from-wrong-lane', episode: crossing.intersectionId });
        next = remember(next, 'rule.high.n-turn-from-wrong-lane', crossing.intersectionId, frame.timeS);
      }
    }
    next = {
      ...next,
      cornerPending: {
        intersectionId: crossing.intersectionId,
        center: crossing.center,
        boxHalfM: crossing.boxHalfM,
        leg: crossing.leg,
      },
    };
  }
  return next;
}

/** Crossings: full stops, slowing down, line crossings, blocking and stops over the line. */
function judgeCrossings(street: Street, frame: Frame, reports: Report[]): Street {
  const { circuit, stopped } = frame;
  let next = street;
  let nearest: { crossing: CircuitCrossing; distanceM: number } | null = null;
  for (const crossing of circuit.crossings) {
    const distanceM = distanceAlong(circuit, frame.frontS, crossing.lineS);
    if (distanceM >= -0.5 && (!nearest || distanceM < nearest.distanceM)) nearest = { crossing, distanceM };
    const previous =
      street.previousFrontS === null ? null : distanceAlong(circuit, street.previousFrontS, crossing.lineS);
    if (previous !== null && previous >= 0 && distanceM < 0 && !street.crossed.includes(crossing.approachId))
      next = judgeLineCrossing(next, frame, crossing, reports);
  }
  if (nearest) {
    const { crossing, distanceM } = nearest;
    if (
      crossing.rule === 'stop' &&
      stopped &&
      distanceM <= CIRCULATION.stopZoneM &&
      next.stoppedAt !== crossing.approachId
    )
      next = { ...next, stoppedAt: crossing.approachId };
    // Gradual slowing before a turn or an unsignalised crossing (high m); a STOP already demands the full stop.
    const slowing = crossing.rule === 'priority' || (crossing.corner !== null && crossing.rule === 'signal');
    if (slowing && distanceM >= 0 && distanceM <= CIRCULATION.approachM && frame.kmh > CIRCULATION.approachKmh)
      reports.push({ ruleId: 'rule.high.m-no-slowdown-before-maneuver', episode: crossing.intersectionId });
  }
  // Standing on the crossed street (high i): the last line crossed, while the body is still on its carriageway.
  // Waiting for a pedestrian on the crosswalk just ahead is yielding, not blocking.
  const lastId = next.crossed.at(-1);
  const last = lastId ? circuit.crossings.find((item) => item.approachId === lastId) : undefined;
  const inside = last ? last.pavements.some((box) => overlaps(frame.body, box)) : false;
  const yielding = circuit.crosswalks.some((crosswalk) => {
    const distanceM = distanceAlong(circuit, frame.frontS, crosswalk.startS);
    return (
      distanceM > -1 &&
      distanceM <= CIRCULATION.yieldingM &&
      frame.scenario.poses.some((pose) => pose.kind === 'pedestrian' && pose.active && pose.inside(crosswalk.box))
    );
  });
  const blockedS = stopped && inside && !yielding ? next.blockedS + frame.dt : 0;
  next = { ...next, blockedS };
  if (last && blockedS >= CIRCULATION.blockIntersectionS)
    reports.push({ ruleId: 'rule.high.i-block-intersection', episode: last.intersectionId });
  // Stopping with the front bumper past the line, or on a crosswalk, once per stop (high h). The front decides:
  // crosswalks of consecutive controls sit closer than a car length in places, and the tail is not judged.
  if (frame.justStopped) {
    const overLine = circuit.crossings.some((crossing) => {
      const past = -distanceAlong(circuit, frame.frontS, crossing.lineS);
      return past > CIRCULATION.overLineM && past <= CIRCULATION.crosswalkEndM;
    });
    const onCrosswalk = circuit.crosswalks.some((crosswalk) => {
      const into = -distanceAlong(circuit, frame.frontS, crosswalk.startS);
      return into > CIRCULATION.overLineM && into <= 2 * CROSSWALK_HALF_LENGTH_M;
    });
    if (overLine || onCrosswalk)
      reports.push({ ruleId: 'rule.high.h-stop-over-line-or-crosswalk', episode: `stop-${next.stops}` });
  }
  return next;
}

/** Pedestrians on the crosswalks, signalled crossings on red, cyclists on the pavement ahead. */
function judgeCrosswalks(street: Street, frame: Frame, reports: Report[]): Street {
  const { circuit, scenario } = frame;
  let next = street;
  let hurried = false;
  for (const crosswalk of circuit.crosswalks) {
    const distanceM = distanceAlong(circuit, frame.frontS, crosswalk.startS);
    if (distanceM < -10 || distanceM > CIRCULATION.precautionM) continue;
    const occupied = scenario.poses.some(
      (pose) => pose.kind === 'pedestrian' && pose.active && pose.inside(crosswalk.box),
    );
    // Precautionary speed (minor o): still fast and not braking with someone on the crosswalk ahead.
    if (
      occupied &&
      distanceM >= 0 &&
      frame.kmh > CIRCULATION.approachKmh &&
      frame.car.controls.brake < CIRCULATION.precautionBrake
    ) {
      hurried = true;
      if (next.precautionS + frame.dt >= CIRCULATION.precautionS)
        reports.push({ ruleId: 'rule.minor.o-precautionary-speed', episode: crosswalk.id });
    }
    if (occupied && !frame.stopped && overlaps(frame.body, crosswalk.box)) {
      reports.push({ ruleId: 'rule.high.l-yield-to-pedestrians-cyclists', episode: crosswalk.id });
      next = remember(next, 'rule.high.l-yield-to-pedestrians-cyclists', crosswalk.id, frame.timeS);
    }
    const previous =
      street.previousFrontS === null ? null : distanceAlong(circuit, street.previousFrontS, crosswalk.startS);
    const light = crosswalk.controlId ? scenario.lights[crosswalk.controlId] : undefined;
    if (
      previous !== null &&
      previous >= 0 &&
      distanceM < 0 &&
      light === 'red' &&
      !street.crossed.includes(crosswalk.id)
    ) {
      next = { ...next, crossed: [...next.crossed, crosswalk.id] };
      reports.push({ ruleId: 'rule.eliminatory.k-red-light' });
    }
  }
  next = { ...next, precautionS: hurried ? next.precautionS + frame.dt : 0 };
  // A cyclist crossing the pavement the car is entering (high l, escalatable).
  const lastId = next.crossed.at(-1);
  const last = lastId ? circuit.crossings.find((item) => item.approachId === lastId) : undefined;
  if (last && !frame.stopped) {
    const entering = last.conflicts.filter((box) => overlaps(frame.body, box));
    const heading = frame.car.world.vehicle.headingRad;
    // A cyclist riding across the car's path, not one riding along the cycle track beside it.
    const cyclist = scenario.poses.some(
      (pose) => pose.kind === 'bicycle' && across(pose.headingRad, heading) && entering.some((box) => pose.inside(box)),
    );
    if (cyclist) {
      reports.push({ ruleId: 'rule.high.l-yield-to-pedestrians-cyclists', episode: last.intersectionId });
      next = remember(next, 'rule.high.l-yield-to-pedestrians-cyclists', last.intersectionId, frame.timeS);
    }
  }
  return next;
}

/** Following distance, minimum speed, unnecessary stops and the horn. */
function judgeFlow(street: Street, frame: Frame, reports: Report[], firstMetres: boolean): Street {
  const { view, circuit } = frame;
  let next = street;
  const leader = view.leader;
  const leaderSpeed = leader ? poseSpeed(street, leader.pose, frame.dt) : null;
  const leaderMoving = leaderSpeed ? Math.hypot(leaderSpeed.x, leaderSpeed.z) > CIRCULATION.leaderMovingMps : false;
  const tailgating =
    leader !== null &&
    leaderMoving &&
    frame.speedMps > CIRCULATION.tailgatingMinSpeedMps &&
    leader.gapM / frame.speedMps < CIRCULATION.headwayS;
  const tailgatingS = tailgating ? next.tailgatingS + frame.dt : 0;
  next = { ...next, tailgatingS };
  if (tailgatingS >= CIRCULATION.tailgatingS)
    reports.push({ ruleId: 'rule.high.g-following-distance', episode: frame.legKey });
  const nextCrossingM = Math.min(
    ...circuit.crossings
      .map((crossing) => distanceAlong(circuit, frame.frontS, crossing.lineS))
      .filter((d) => d >= -0.5),
    Infinity,
  );
  const occupiedM = Math.min(
    ...circuit.crosswalks
      .filter((crosswalk) =>
        frame.scenario.poses.some((pose) => pose.kind === 'pedestrian' && pose.active && pose.inside(crosswalk.box)),
      )
      .map((crosswalk) => distanceAlong(circuit, frame.frontS, crosswalk.startS))
      .filter((d) => d >= -0.5),
    Infinity,
  );
  const signalM = view.signal && view.signal.light !== 'green' ? view.signal.distanceM : Infinity;
  const leaderM = leader ? leader.gapM : Infinity;
  const emergencyNear = frame.scenario.poses.some((pose) => pose.kind === 'emergency');
  // Under the minimum speed with the way clear (minor l): a game threshold, see REGLAS.md §9.
  const wayClear =
    nextCrossingM > CIRCULATION.clearAheadM && occupiedM > CIRCULATION.clearAheadM && leaderM > CIRCULATION.clearAheadM;
  const slow = !firstMetres && wayClear && !emergencyNear && frame.speedMps > 0.3 && frame.kmh < CIRCULATION.minimumKmh;
  const slowS = slow ? next.slowS + frame.dt : 0;
  next = { ...next, slowS };
  if (slowS >= CIRCULATION.slowS) reports.push({ ruleId: 'rule.minor.l-below-minimum-speed', episode: frame.legKey });
  // An unnecessary stop (minor k): nothing to stop for within the clear distances.
  if (frame.stopped) {
    const stoppedS = next.stoppedS + frame.dt;
    next = { ...next, stoppedS };
    const nothingAhead =
      nextCrossingM > CIRCULATION.clearCrossingM &&
      leaderM > CIRCULATION.clearLeaderM &&
      occupiedM > CIRCULATION.clearCrosswalkM &&
      signalM > CIRCULATION.clearSignalM &&
      !emergencyNear;
    if (!next.stopJudged && stoppedS >= CIRCULATION.unnecessaryStopS) {
      next = { ...next, stopJudged: true };
      if (nothingAhead) reports.push({ ruleId: 'rule.minor.k-unnecessary-stop', episode: `stop-${next.stops}` });
    }
  } else if (next.stoppedS > 0 || next.stopJudged) next = { ...next, stoppedS: 0, stopJudged: false };
  // The horn (minor m): a press with nobody close ahead is unjustified.
  const horn = frame.cockpit.horn;
  if (horn && !next.hornWas) {
    const count = next.hornEpisodes + 1;
    next = { ...next, hornEpisodes: count };
    const pedestrianNear = frame.scenario.poses.some(
      (pose) =>
        pose.kind === 'pedestrian' &&
        Math.hypot(pose.x - frame.center.x, pose.z - frame.center.z) <= CIRCULATION.hornConflictM,
    );
    if (leaderM > CIRCULATION.hornConflictM && occupiedM > CIRCULATION.hornConflictM && !pedestrianNear)
      reports.push({ ruleId: 'rule.minor.m-horn-misuse', episode: `horn-${count}` });
  }
  return { ...next, hornWas: horn };
}

/** The speed bump of leg 6 (minor n) and the loss of control (eliminatory h). */
function judgeHandling(street: Street, frame: Frame, reports: Report[]): Street {
  const { circuit, car } = frame;
  let next = street;
  for (const bump of circuit.bumps) {
    if (next.bumpsPassed.includes(bump.id)) continue;
    const distanceM = distanceAlong(circuit, frame.frontS, bump.s);
    const previous = street.previousFrontS === null ? null : distanceAlong(circuit, street.previousFrontS, bump.s);
    if (previous === null || previous < 0 || distanceM >= 0) continue;
    next = { ...next, bumpsPassed: [...next.bumpsPassed, bump.id] };
    if (frame.kmh > CIRCULATION.bumpKmh)
      reports.push({ ruleId: 'rule.minor.n-speed-bump-imprudent', episode: bump.id });
  }
  // Kinematic bicycle: lateral acceleration v² · tan(steer) / wheelbase, beyond the tyres' grip for a moment.
  const lateralAccel = (frame.speedMps ** 2 * Math.abs(Math.tan(car.world.vehicle.steerRad))) / EXAM_CAR.wheelbaseM;
  const lateralAccelS = lateralAccel > CIRCULATION.lateralAccelMps2 ? next.lateralAccelS + frame.dt : 0;
  next = { ...next, lateralAccelS };
  if (lateralAccelS >= CIRCULATION.lateralAccelS) reports.push({ ruleId: 'rule.eliminatory.h-loss-of-control' });
  return next;
}

/** Leg progress: entering the next leg announces its turn; back on leg 1 after leg 8 ends stage II. */
function judgeProgress(street: Street, frame: Frame, reports: Report[]): { street: Street; done: boolean } {
  const { circuit } = frame;
  let next = street;
  const road = roadAt(circuit.lap, frame.centreS);
  let done = false;
  if (road && road.leg !== null && road.leg !== next.leg) {
    const leg = circuit.legs.find((item) => item.number === road.leg);
    if (leg) {
      const legsEntered = next.legsEntered + 1;
      next = {
        ...next,
        leg: leg.number,
        legsEntered,
        instruction: { turn: leg.turn, street: leg.nextStreet },
        cornerPending: null,
        speedingIn: null,
        stoppedAt: null,
      };
      done = leg.number === 1 && legsEntered >= circuit.legs.length;
    }
  }
  if (road && road.leg !== null) {
    const leg = circuit.legs.find((item) => item.number === road.leg);
    next = {
      ...next,
      road: { street: road.street, examKmh: road.examMaxKmh ?? leg?.examKmh ?? 30, postedKmh: road.postedMaxKmh },
    };
  }
  // Beyond the corner's crossing, along the car's own heading, without reaching the next leg: the car went
  // straight on (or turned the wrong way) where the examiner said to turn.
  const pending = next.cornerPending;
  if (pending && pending.leg === next.leg) {
    const heading = frame.car.world.vehicle.headingRad;
    const along =
      (frame.center.x - pending.center.x) * Math.sin(heading) + (frame.center.z - pending.center.z) * Math.cos(heading);
    if (along > pending.boxHalfM + CIRCULATION.pastCornerM) {
      reports.push({ ruleId: 'rule.eliminatory.f-examiner-safety-instruction-ignored' });
      next = { ...next, cornerPending: null };
    }
  }
  return { street: next, done };
}

function noticeOf(frame: Frame): Notice | null {
  const { circuit, view } = frame;
  if (frame.scenario.poses.some((pose) => pose.kind === 'emergency'))
    return { kind: 'emergency', distanceM: 0, light: null };
  let best: Notice | null = null;
  const consider = (candidate: Notice) => {
    if (candidate.distanceM < 0 || candidate.distanceM > CIRCULATION.noticeM) return;
    if (!best || candidate.distanceM < best.distanceM) best = candidate;
  };
  for (const crossing of circuit.crossings) {
    const distanceM = distanceAlong(circuit, frame.frontS, crossing.lineS);
    const light =
      crossing.rule === 'signal' && view.signal?.intersectionId === crossing.intersectionId ? view.signal.light : null;
    consider({ kind: crossing.rule, distanceM, light });
  }
  for (const bump of circuit.bumps)
    consider({ kind: 'bump', distanceM: distanceAlong(circuit, frame.frontS, bump.s), light: null });
  return best;
}

/**
 * Judges one fixed step of circulation. `firstMetres` skips the speed rules (the first 100 m are eliminatory g,
 * decision D1) and the minimum speed.
 */
export function judgeCirculation(
  street: Street,
  circuit: Circuit,
  car: CarState,
  cockpit: CockpitState,
  scenario: TrafficSnapshot | null,
  dt: number,
  timeS: number,
  firstMetres: boolean,
): Verdict {
  const snapshot: TrafficSnapshot = scenario ?? { timeS, light: 'green', lights: {}, poses: [], contacts: [] };
  const vehicle = car.world.vehicle;
  const body = bodyBox(EXAM_CAR, vehicle);
  const center = { x: body.centerX, z: body.centerZ };
  const view = lookAhead(circuit.traffic, snapshot, body, CIRCULATION.onRouteM);
  const reports: Report[] = [];
  const speedMps = Math.abs(vehicle.speedMps);
  const stopped = vehicle.speedMps === 0;
  const justStopped = stopped && !street.wasStopped;
  let next: Street = street;
  if (justStopped) next = { ...next, wasStopped: true, stops: next.stops + 1 };
  else if (!stopped && street.wasStopped) next = { ...next, wasStopped: false };
  next = noteSignal(next, cockpit, timeS, view.routeS === null ? null : view.routeS + body.halfLengthM);
  if (view.routeS === null) {
    // Off the route while moving: the examiner's instruction was not followed (eliminatory f).
    const offRouteS = speedMps > 0.5 ? next.offRouteS + dt : next.offRouteS;
    next = { ...next, offRouteS, notice: null };
    if (offRouteS >= CIRCULATION.offRouteS)
      reports.push({ ruleId: 'rule.eliminatory.f-examiner-safety-instruction-ignored' });
    return { street: forget(next, snapshot), reports, done: false, takeover: false };
  }
  const centreS = view.routeS;
  const frontS = centreS + body.halfLengthM;
  const leg = circuit.legs.find((item) => item.number === next.leg) ?? circuit.legs[0];
  if (!leg) throw new Error('A circuit needs at least one leg');
  const frame: Frame = {
    circuit,
    car,
    cockpit,
    scenario: snapshot,
    dt,
    timeS,
    body,
    center,
    speedMps,
    kmh: kmhOf(car),
    stopped,
    justStopped,
    centreS,
    frontS,
    leg,
    legKey: `leg-${leg.number}`,
    view,
  };
  next = { ...next, offRouteS: 0 };
  const progress = judgeProgress(next, frame, reports);
  next = progress.street;
  // The rules below judge in the context of the leg the car is on now, which the progress may have just changed.
  const current = circuit.legs.find((item) => item.number === next.leg) ?? leg;
  frame.leg = current;
  frame.legKey = `leg-${current.number}`;
  if (!firstMetres) next = judgeSpeed(next, frame, reports);
  next = judgeCrossings(next, frame, reports);
  next = judgeCrosswalks(next, frame, reports);
  next = judgeLane(next, frame, reports);
  next = judgeFlow(next, frame, reports, firstMetres);
  next = judgeHandling(next, frame, reports);
  next = judgeEmergency(next, frame, reports);
  next = judgeOvertaking(next, frame, reports);
  const takeover = imminentContact(next, frame);
  const fresh = dedupe(next.reported, reports);
  next = {
    ...forget(next, snapshot),
    previousFrontS: frontS,
    notice: noticeOf(frame),
    takeover: next.takeover || takeover,
    escalatable: next.escalatable.filter((item) => timeS - item.atS <= CIRCULATION.escalatableS),
    reported: fresh.reported,
  };
  return { street: next, reports: fresh.reports, done: progress.done, takeover };
}

/** Keeps only reports not made before for the same rule and episode; withdrawals always pass. */
function dedupe(reported: readonly string[], reports: readonly Report[]): { reported: string[]; reports: Report[] } {
  const seen = [...reported];
  const fresh: Report[] = [];
  for (const report of reports) {
    const key = `${report.ruleId}|${report.episode ?? ''}`;
    if (report.withdraw) {
      fresh.push(report);
      continue;
    }
    if (seen.includes(key)) continue;
    seen.push(key);
    fresh.push(report);
  }
  return { reported: seen, reports: fresh };
}

/** Remembers where every actor was, to estimate their speeds next step. */
function forget(street: Street, snapshot: TrafficSnapshot): Street {
  const poseMemory: Record<string, Point> = {};
  for (const pose of snapshot.poses) poseMemory[pose.id] = { x: pose.x, z: pose.z };
  return { ...street, poseMemory };
}
