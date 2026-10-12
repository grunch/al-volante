import { overlaps } from '../sim/collision.ts';
import type { OrientedBox } from '../sim/collision.ts';
import { headingDifference, laneOffsetM } from '../traffic/network.ts';
import { distanceAlong, lateralOnRoad, roadAt } from './circuit.ts';
import { CIRCULATION, poseSpeed, remember } from './street.ts';
import type { Frame, Report, Street } from './street.ts';

/**
 * Lanes, overtaking, the ambulance and the examiner's takeover: the judges of stage II that watch the lane and the
 * actors beside the car (F04-T03). Pure functions over the street state, like the rest of `circulation.ts`.
 */
/** Lane keeping, lane changes with their mirror glance and signal, exclusive lanes, the solid line, wrong way. */
export function judgeLane(street: Street, frame: Frame, reports: Report[]): Street {
  const { circuit, car, body } = frame;
  const road = roadAt(circuit.lap, frame.centreS);
  const heading = car.world.vehicle.headingRad;
  let next = street;
  if (!road) return { ...next, offLaneS: 0, forbiddenS: 0, solidLineS: 0, wrongWayS: 0 };
  const aligned = Math.abs(headingDifference(heading, road.headingRad)) < CIRCULATION.alignedRad;
  const lateral = lateralOnRoad(road, frame.center);
  const lanes = Math.max(1, road.lanes);
  const laneWidth = road.widthM / lanes;
  const index = Math.max(0, Math.min(lanes - 1, Math.floor((lateral + road.widthM / 2) / laneWidth)));
  const laneCenter = laneOffsetM(road, index, lanes);
  const nearCorner = circuit.crossings.some((crossing) => {
    const distanceM = distanceAlong(circuit, frame.frontS, crossing.lineS);
    return crossing.corner !== null && distanceM > -CIRCULATION.pastCornerM && distanceM < CIRCULATION.approachM;
  });
  // Lane index: set on entering a road and while settling after the corner; a change while aligned on a
  // multi-lane road is then a lane change.
  const settled = next.laneEnteredS !== null && frame.centreS - next.laneEnteredS >= CIRCULATION.laneSettleM;
  if (next.laneRoadId !== road.id)
    next = { ...next, laneRoadId: road.id, laneEnteredS: frame.centreS, laneIndex: index };
  else if (!settled || !aligned) next = { ...next, laneIndex: index };
  else if (next.laneIndex !== null && index !== next.laneIndex) {
    const towardsLeft = index > next.laneIndex;
    const count = next.laneChanges + 1;
    next = { ...next, laneIndex: index, laneChanges: count };
    const glance = next.lastGlance;
    const glanced =
      glance !== null &&
      frame.timeS - glance.atS <= CIRCULATION.glanceBeforeLaneChangeS &&
      (towardsLeft ? glance.yaw > 0 : glance.yaw < 0);
    if (!glanced) {
      reports.push({ ruleId: 'rule.high.o-no-mirror-check-lane-change', episode: `lane-change-${count}` });
      next = remember(next, 'rule.high.o-no-mirror-check-lane-change', `lane-change-${count}`, frame.timeS);
    }
    const since = next.signalSince[towardsLeft ? 'left' : 'right'];
    if (since === null || frame.timeS - since < CIRCULATION.signalBeforeLaneChangeS)
      reports.push({ ruleId: 'rule.low.h-no-lane-change-signal', episode: `lane-change-${count}` });
  }
  // Outside the own lane (minor p), judged along the block, not while turning into or out of it.
  const outside = Math.abs(lateral - laneCenter) + body.halfWidthM > laneWidth / 2 + CIRCULATION.laneMarginM;
  const moving = frame.speedMps > 0.5;
  const offLaneS = aligned && settled && moving && !nearCorner && outside ? next.offLaneS + frame.dt : 0;
  next = { ...next, offLaneS };
  if (offLaneS >= CIRCULATION.offLaneS) reports.push({ ruleId: 'rule.minor.p-lane-keeping', episode: frame.legKey });
  // Exclusive lanes: the cycle track to the left of the road, the busway (eliminatory j).
  const leftEdge = lateral + body.halfWidthM - road.widthM / 2;
  const onCycleTrack = road.cycleTrack && leftEdge > CIRCULATION.laneMarginM;
  const onBusway = circuit.busways.some((busway) => overlaps(body, busway));
  const forbiddenS = aligned && (onCycleTrack || onBusway) ? next.forbiddenS + frame.dt : 0;
  next = { ...next, forbiddenS };
  if (forbiddenS >= CIRCULATION.forbiddenLaneS)
    reports.push({ ruleId: 'rule.eliminatory.j-forbidden-road-lane-direction', episode: frame.legKey });
  // The continuous line beside the busway (eliminatory o; X3).
  const solidLineS =
    aligned && circuit.solidLineLeft.has(road.id) && leftEdge > CIRCULATION.laneMarginM
      ? next.solidLineS + frame.dt
      : 0;
  next = { ...next, solidLineS };
  if (solidLineS >= CIRCULATION.solidLineS)
    reports.push({ ruleId: 'rule.eliminatory.o-solid-line-crossed', episode: frame.legKey });
  // Against the one-way direction of the road (eliminatory j).
  const wrongWay =
    Math.abs(headingDifference(heading, road.headingRad)) > CIRCULATION.wrongWayRad &&
    car.world.vehicle.speedMps > CIRCULATION.wrongWayMinSpeedMps;
  const wrongWayS = wrongWay ? next.wrongWayS + frame.dt : 0;
  next = { ...next, wrongWayS };
  if (wrongWayS >= CIRCULATION.forbiddenLaneS)
    reports.push({ ruleId: 'rule.eliminatory.j-forbidden-road-lane-direction', episode: `${frame.legKey}-wrong-way` });
  return next;
}

/** The ambulance behind: make way before it passes (eliminatory n). */
export function judgeEmergency(street: Street, frame: Frame, reports: Report[]): Street {
  const ambulance = frame.scenario.poses.find((pose) => pose.kind === 'emergency');
  const state = street.emergency;
  if (state.judged) return street;
  if (!ambulance) {
    // It was behind and is gone without passing: it found its own way because the car never made room.
    if (state.seen && !state.yielded && state.stuckS >= CIRCULATION.emergencyStuckS) {
      reports.push({ ruleId: 'rule.eliminatory.n-emergency-vehicle-not-yielded' });
      return { ...street, emergency: { ...state, judged: true } };
    }
    return state.seen ? { ...street, emergency: { ...state, judged: true } } : street;
  }
  const forward = { x: Math.sin(frame.car.world.vehicle.headingRad), z: Math.cos(frame.car.world.vehicle.headingRad) };
  const along = (ambulance.x - frame.center.x) * forward.x + (ambulance.z - frame.center.z) * forward.z;
  const passed = along > frame.body.halfLengthM + ambulance.box.halfLengthM;
  if (passed) {
    if (!state.yielded) reports.push({ ruleId: 'rule.eliminatory.n-emergency-vehicle-not-yielded' });
    return { ...street, emergency: { ...state, judged: true } };
  }
  const road = roadAt(frame.circuit.lap, frame.centreS);
  const pulledRight = road
    ? lateralOnRoad(road, frame.center) <=
      laneOffsetM(road, 0, Math.max(1, road.lanes)) - CIRCULATION.emergencyPullRightM
    : false;
  const yielded = state.yielded || frame.kmh <= CIRCULATION.emergencyYieldKmh || pulledRight;
  const speed = poseSpeed(street, ambulance, frame.dt);
  const stuck = along < 0 && along > -20 && Math.hypot(speed.x, speed.z) < 0.5;
  return { ...street, emergency: { ...state, seen: true, yielded, stuckS: stuck ? state.stuckS + frame.dt : 0 } };
}

/** Overtaking on the right, or on the left through a crossing or a crosswalk (eliminatory p). */
export function judgeOvertaking(street: Street, frame: Frame, reports: Report[]): Street {
  const { circuit, body } = frame;
  const heading = frame.car.world.vehicle.headingRad;
  const forward = { x: Math.sin(heading), z: Math.cos(heading) };
  const left = { x: Math.cos(heading), z: -Math.sin(heading) };
  // Only vehicles still being passed stay in the memory; the rest are forgotten by leaving them out.
  const passing: Record<string, 'behind' | 'left' | 'right'> = {};
  for (const pose of frame.scenario.poses) {
    if (pose.kind !== 'vehicle' && pose.kind !== 'bus') continue;
    const aligned = Math.abs(headingDifference(pose.headingRad, heading)) < 0.5;
    const dx = pose.x - frame.center.x,
      dz = pose.z - frame.center.z;
    const along = dx * forward.x + dz * forward.z;
    const lateral = dx * left.x + dz * left.z;
    const phase = street.passing[pose.id];
    if (!aligned || Math.abs(lateral) > CIRCULATION.besideMaxM || Math.abs(along) > 40) continue;
    if (along > CIRCULATION.aheadM) {
      if (Math.abs(lateral) < CIRCULATION.besideMinM) passing[pose.id] = 'behind';
      else if (phase) passing[pose.id] = lateral > 0 ? 'left' : 'right';
      continue;
    }
    if (along < -CIRCULATION.aheadM) {
      if (!phase) continue;
      const inCrossing =
        circuit.crossings.some((crossing) => crossing.conflicts.some((box) => overlaps(body, box))) ||
        circuit.crosswalks.some((crosswalk) => overlaps(body, crosswalk.box));
      if (phase === 'left' || (phase === 'right' && inCrossing))
        reports.push({ ruleId: 'rule.eliminatory.p-illegal-overtaking' });
      continue;
    }
    if (phase === 'behind' && Math.abs(lateral) >= CIRCULATION.besideMinM)
      passing[pose.id] = lateral > 0 ? 'left' : 'right';
    else if (phase) passing[pose.id] = phase;
  }
  return { ...street, passing };
}

/** The dual controls: an actor straight ahead that the car can no longer avoid by braking. */
export function imminentContact(street: Street, frame: Frame): boolean {
  if (frame.speedMps <= 0) return false;
  const heading = frame.car.world.vehicle.headingRad;
  const forward = { x: Math.sin(heading), z: Math.cos(heading) };
  const left = { x: Math.cos(heading), z: -Math.sin(heading) };
  for (const pose of frame.scenario.poses) {
    if (!pose.active) continue;
    const dx = pose.x - frame.body.centerX,
      dz = pose.z - frame.body.centerZ;
    const along = dx * forward.x + dz * forward.z;
    const lateral = Math.abs(dx * left.x + dz * left.z);
    const reach = Math.hypot(pose.box.halfLengthM, pose.box.halfWidthM);
    if (along <= 0 || along > 30 || lateral > frame.body.halfWidthM + reach) continue;
    const speed = poseSpeed(street, pose, frame.dt);
    const closing = frame.speedMps - (speed.x * forward.x + speed.z * forward.z);
    if (closing < CIRCULATION.takeoverClosingMps) continue;
    const ahead: OrientedBox = {
      ...frame.body,
      centerX: frame.body.centerX + forward.x * along,
      centerZ: frame.body.centerZ + forward.z * along,
    };
    if (!overlaps(ahead, pose.box)) continue;
    const gap = Math.max(0.05, along - frame.body.halfLengthM - reach);
    if ((closing * closing) / (2 * gap) > CIRCULATION.takeoverDecelMps2) return true;
  }
  return false;
}
