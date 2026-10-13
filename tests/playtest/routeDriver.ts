import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { RouteSchema } from '../../src/content/schemas.ts';
import { buildCity, distance } from '../../src/city/model.ts';
import { buildCircuit, distanceAlong } from '../../src/exam/circuit.ts';
import { createTraffic } from '../../src/traffic/traffic.ts';
import { headingDifference, pointAlong } from '../../src/traffic/network.ts';
import { lookAhead } from '../../src/traffic/lookahead.ts';
import { overlaps } from '../../src/sim/collision.ts';
import { EXAM_CAR, bodyBox } from '../../src/sim/vehicle.ts';
import type { Action } from '../../src/practice/bindings.ts';
import type { BrowserDriver, Reading } from './browserDriver.ts';

const city = buildCity(
  RouteSchema.parse(JSON.parse(readFileSync(new URL('../../specs/route/comuna13-a.json', import.meta.url), 'utf8'))),
);
const circuit = buildCircuit(city, createTraffic(city, 1));
const stopSpeed = (metres: number) => Math.sqrt(2 * 1.4 * Math.max(0, metres - 0.8));
const vehicle = (r: Reading) => ({
  x: r.x,
  z: r.z,
  headingRad: r.heading,
  speedMps: r.speed,
  odometerM: r.odometer,
  steerRad: r.steer * EXAM_CAR.maxSteerRad,
});
const motion = new WeakMap<BrowserDriver, { time: number; speed: number }>();

/** A feedback controller for binary keys, including the same pedal and steering ramps a human uses. */
async function controls(driver: BrowserDriver, read: Reading, speed: number, steer: number) {
  const actions: Action[] = [];
  const before = motion.get(driver);
  const acceleration =
    before && read.time > before.time ? Math.max(0, (read.speed - before.speed) / (read.time - before.time)) : 0;
  motion.set(driver, { time: read.time, speed: read.speed });
  // Anticipate the pedal ramp and clutch coupling instead of waiting until a launch overshoots the target.
  const anticipated = read.speed + (driver.kind === 'manual' ? Math.min(6, acceleration) * 0.25 : 0);
  let throttle = speed > anticipated + 0.15 ? Math.min(0.65, 0.22 + (speed - anticipated) * 0.35) : 0;
  const brake = speed < 0.05 ? 0.8 : speed < anticipated - 0.1 ? Math.min(0.8, (anticipated - speed) * 0.7) : 0;
  let clutch = 0;
  if (driver.kind === 'manual') {
    if ((speed <= anticipated || read.brake > 0.1) && read.speed < (read.gear === '2' ? 3.6 : 2.3)) clutch = 1;
    else if (speed > 0 && read.speed < 1.4) {
      clutch = 0.68;
      throttle = Math.min(0.3, Math.max(0.2, throttle));
    }
    if (read.clutch < clutch - 0.04) actions.push('clutch');
  }
  if (read.throttle < throttle) actions.push('throttle');
  if (read.brake < brake) actions.push('brake');
  if (steer > 0 && read.steer < steer - 0.015) actions.push('left');
  if (steer < 0 && read.steer > steer + 0.015) actions.push('right');
  await driver.hold(actions);
  await driver.tick(0.05);
}

/** Leaves the starting bay using the required reverse/forward gestures and waits for a gap before merging. */
export async function throughBox(driver: BrowserDriver) {
  for (const [gear, phase] of [
    ['R', 'forward'],
    [driver.kind === 'manual' ? '1' : 'D', 'exit'],
  ] as const) {
    await driver.gear(gear);
    if ((await driver.read()).handbrake) await driver.press('handbrake');
    const origin = await driver.read();
    for (;;) {
      const read = await driver.read();
      if (read.odometer > origin.odometer + (driver.kind === 'manual' ? 0.26 : 0.15)) break;
      if (read.time - origin.time > 8 || read.engine !== 'running') throw new Error(`Could not creep in ${gear}`);
      // A manual needs throttle and the biting point even in reverse; releasing the clutch at idle stalls it.
      await controls(driver, { ...read, speed: Math.abs(read.speed) }, 0.6, 0);
    }
    await driver.hold(driver.kind === 'manual' ? ['clutch', 'brake'] : ['brake']);
    await driver.until((r) => r.speed === 0, 5, 'Stop in the bay');
    await driver.tick(0.8);
    expect((await driver.read()).phase).toBe(phase);
    expect((await driver.read()).engine).toBe('running');
  }
  await driver.hold(['brake', ...(driver.kind === 'manual' ? ['clutch' as const] : [])]);
  await driver.until(
    (read) => {
      if (!read.traffic) return false;
      return !read.traffic.poses.some((pose) => {
        if (
          !pose.active ||
          pose.kind === 'pedestrian' ||
          Math.abs(headingDifference(pose.headingRad, read.heading)) > Math.PI / 4
        )
          return false;
        const dx = pose.x - read.x;
        const dz = pose.z - read.z;
        const along = dx * Math.sin(read.heading) + dz * Math.cos(read.heading);
        const left = dx * Math.cos(read.heading) - dz * Math.sin(read.heading);
        return along > -50 && along < 20 && left > -1 && left < 8;
      });
    },
    100,
    'Wait for a gap before merging from the bay',
  );
  await driver.press('signalLeft');
  await driver.press('glanceLeft');
  await driver.press('lookCenter');
  const origin = (await driver.read()).odometer;
  while ((await driver.read()).odometer < origin + 4.6) {
    const read = await driver.read();
    await controls(driver, read, 1.8, 0);
    if (read.time > 120) throw new Error('Could not leave the bay');
  }
}

/** Follows the real route while yielding to the rendered actors and lights observed in development telemetry. */
export async function driveRoute(driver: BrowserDriver) {
  const visited = new Set<number>();
  let clearedStop = '';
  let stoppedSince = 0;
  let turnSignal: 'left' | 'right' | null = 'left';
  let previous = await driver.read();
  const actorMotion = new Map<string, { x: number; z: number; time: number; speed: number }>();
  let lastProgressTime = previous.time;
  let lastProgress = previous.odometer;
  for (let count = 0; count < 30000; count++) {
    const r = await driver.read();
    if (r.phase === 'parking') {
      await driver.hold(['brake', ...(driver.kind === 'manual' ? ['clutch' as const] : [])]);
      const stopped = await driver.until((read) => read.speed === 0, 5, 'Stop after completing the route');
      expect(stopped.phase).toBe('parking');
      expect(stopped.engine).toBe('running');
      await driver.capture('route-completed');
      expect([...visited].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      expect(stopped.odometer).toBeGreaterThan(1400);
      return;
    }
    if (r.phase === 'finished') throw new Error(`Exam interrupted at ${r.leg}: ${r.feedback}`);
    if (r.engine !== 'running') throw new Error(`Unexpected stalled engine at ${r.leg}`);
    if (!r.traffic) throw new Error('Development traffic observations are missing');
    const snapshot = r.traffic;
    for (const pose of snapshot.poses) {
      const last = actorMotion.get(pose.id);
      if (last?.time === snapshot.timeS) continue;
      actorMotion.set(pose.id, {
        x: pose.x,
        z: pose.z,
        time: snapshot.timeS,
        // Repeated 50 ms car readings must not turn the 100 ms traffic observations into zero/double speeds.
        speed: last ? distance(pose, last) / (snapshot.timeS - last.time) : 4,
      });
    }
    if (r.odometer > lastProgress + 1) {
      lastProgress = r.odometer;
      lastProgressTime = r.time;
    }
    if (r.time - lastProgressTime > 100) throw new Error(`No progress for 100 seconds at ${r.leg}`);
    const leg = Number(r.leg.match(/Tramo (\d+)/)?.[1]);
    if (!visited.has(leg)) {
      visited.add(leg);
      await driver.capture(`leg-${leg}`);
    }
    const body = bodyBox(EXAM_CAR, vehicle(r));
    const view = lookAhead(circuit.traffic, r.traffic, body);
    if (view.routeS === null) throw new Error(`Left route at ${r.x}, ${r.z}`);
    const frontS = view.routeS + body.halfLengthM;
    const ahead = pointAlong(circuit.lap, frontS + 6);
    const error = headingDifference(Math.atan2(ahead.point.x - r.x, ahead.point.z - r.z), r.heading);
    const wheel = Math.atan((2 * EXAM_CAR.wheelbaseM * Math.sin(error)) / Math.max(1, distance(r, ahead.point)));
    const steer = Math.max(-1, Math.min(1, wheel / EXAM_CAR.maxSteerRad));
    let speed = 5.5;
    if (Math.abs(steer) > 0.2) speed = Math.min(speed, 3.2);
    if (view.signal && view.signal.light !== 'green') speed = Math.min(speed, stopSpeed(view.signal.distanceM));
    const corner = circuit.crossings
      .map((crossing) => ({ crossing, distance: distanceAlong(circuit, frontS, crossing.lineS) }))
      .filter((item) => item.distance > -1)
      .sort((a, b) => a.distance - b.distance)[0];
    if (r.speed === 0) {
      if (previous.speed !== 0) stoppedSince = r.time;
    } else stoppedSince = r.time;
    if (corner) {
      const { crossing, distance: toCrossing } = corner;
      const crossingOccupied = r.traffic.poses.some(
        (p) =>
          p.active &&
          p.kind !== 'emergency' &&
          Math.abs(headingDifference(p.headingRad, r.heading)) > Math.PI / 4 &&
          crossing.conflicts.some((b) => overlaps(p.box, b)),
      );
      const arriving = r.traffic.poses.some((p) => {
        if (!p.active || p.kind === 'pedestrian' || p.kind === 'emergency') return false;
        const angle = headingDifference(p.headingRad, r.heading);
        return angle > Math.PI / 4 && angle < (3 * Math.PI) / 4 && distance(p, crossing.center) < 22;
      });
      const cyclist = r.traffic.poses.some((p) => {
        if (!p.active || p.kind !== 'bicycle') return false;
        const velocity = actorMotion.get(p.id)?.speed ?? 4;
        return [0, 0.5, 1, 1.5, 2, 2.5, 3, 4].some((t) =>
          crossing.conflicts.some((b) =>
            overlaps(
              {
                ...p.box,
                centerX: p.x + Math.sin(p.headingRad) * velocity * t,
                centerZ: p.z + Math.cos(p.headingRad) * velocity * t,
              },
              b,
            ),
          ),
        );
      });
      if (crossing.rule === 'stop' && clearedStop !== crossing.approachId) {
        speed = Math.min(speed, stopSpeed(toCrossing));
        if (
          r.speed === 0 &&
          toCrossing < 3 &&
          r.time - stoppedSince > 1.3 &&
          !crossingOccupied &&
          !arriving &&
          !cyclist
        )
          clearedStop = crossing.approachId;
      } else if (crossing.rule !== 'signal' && (crossingOccupied || cyclist || (toCrossing >= 0 && arriving)))
        speed = Math.min(speed, stopSpeed(toCrossing - 1));
      if ((crossing.corner || crossing.rule !== 'signal') && toCrossing < 25) speed = Math.min(speed, 3.2);
      const exitPedestrian = circuit.crosswalks.some((w) => {
        const d = distanceAlong(circuit, frontS, w.startS);
        return (
          d > toCrossing &&
          d < toCrossing + 25 &&
          snapshot.poses.some(
            (p) =>
              p.active && p.kind === 'pedestrian' && overlaps(p.box, { ...w.box, halfWidthM: w.box.halfWidthM + 2 }),
          )
        );
      });
      if (toCrossing >= 0 && exitPedestrian) speed = Math.min(speed, stopSpeed(toCrossing));
      const wantedSignal = crossing.corner && toCrossing < 45 ? crossing.corner.turn : null;
      if (wantedSignal !== turnSignal) {
        await driver.hold([]);
        if (turnSignal) await driver.press(turnSignal === 'left' ? 'signalLeft' : 'signalRight');
        if (wantedSignal) {
          await driver.press(wantedSignal === 'left' ? 'signalLeft' : 'signalRight');
          await driver.press(wantedSignal === 'left' ? 'glanceLeft' : 'glanceRight');
          await driver.press('lookCenter');
        }
        turnSignal = wantedSignal;
      }
    }
    const nextCrosswalk = circuit.crosswalks.find((w) => w.id === view.crosswalk?.crosswalkId);
    const approachingPedestrian =
      nextCrosswalk &&
      snapshot.poses.some(
        (p) =>
          p.active &&
          p.kind === 'pedestrian' &&
          overlaps(p.box, { ...nextCrosswalk.box, halfWidthM: nextCrosswalk.box.halfWidthM + 2 }),
      );
    if (view.crosswalk && (view.crosswalk.occupied || approachingPedestrian)) {
      const front = {
        x: body.centerX + Math.sin(r.heading) * body.halfLengthM,
        z: body.centerZ + Math.cos(r.heading) * body.halfLengthM,
      };
      const straight = nextCrosswalk
        ? distance(front, { x: nextCrosswalk.box.centerX, z: nextCrosswalk.box.centerZ }) -
          nextCrosswalk.box.halfLengthM
        : Infinity;
      speed = Math.min(speed, stopSpeed(Math.min(view.crosswalk.distanceM, straight) - 2.5));
    }
    if (view.leader)
      speed = Math.min(speed, stopSpeed(view.leader.gapM - 3), Math.max(0, (view.leader.gapM - 3) / 2.5));
    for (const bump of circuit.bumps) {
      const d = distanceAlong(circuit, frontS, bump.s);
      if (d > -2 && d < 18) speed = Math.min(speed, 4);
    }
    if (driver.kind === 'manual') {
      // Finish braking before downshifting; the clutch-only gear gesture must not release the brake at a crossing.
      if (r.speed < 2.8 && speed > r.speed + 0.4 && r.gear === '2') await driver.gear('1');
      else if (r.speed > 3.4 && speed > 4.5 && r.gear === '1') await driver.gear('2');
    }
    await controls(driver, await driver.read(), speed, steer);
    previous = r;
  }
  throw new Error('Route did not complete within the bounded playtest');
}
