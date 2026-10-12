import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity, distance, sampleLeg } from './model.ts';
import { stepWorld, initialWorldState } from '../sim/world.ts';
import { EXAM_CAR } from '../sim/vehicle.ts';
import { SIM_STEP_S } from '../sim/fixedStep.ts';

it('drives the complete route with the real steering limits and no curb collisions', () => {
  const city = buildCity(RouteSchema.parse(routeData));
  const waypoints = city.legs.flatMap((leg) => {
    const result = [];
    for (let d = 0; d < leg.lengthM; d += 1) result.push(sampleLeg(city, leg.number, d));
    return result;
  });
  const start = sampleLeg(city, 1, 20);
  let state = initialWorldState({ ...start, speedMps: 5 });
  let index = 20;
  const contacts: string[] = [];
  // Pure-pursuit test driver: uses the actual model, not teleports between samples.
  for (let step = 0; step < 44000 && index < waypoints.length + 20; step++) {
    const vehicle = state.vehicle;
    while (distance(vehicle, waypoints[index % waypoints.length]!) < 7) {
      index++;
      if (index >= waypoints.length + 20) break;
    }
    const target = waypoints[index % waypoints.length]!;
    const heading = Math.atan2(target.x - vehicle.x, target.z - vehicle.z);
    const error = Math.atan2(Math.sin(heading - vehicle.headingRad), Math.cos(heading - vehicle.headingRad));
    const wheelAngle = Math.atan((2 * EXAM_CAR.wheelbaseM * Math.sin(error)) / Math.max(1, distance(vehicle, target)));
    state = stepWorld(
      EXAM_CAR,
      city.world,
      state,
      {
        tractionN: Math.max(0, (5 - vehicle.speedMps) * 2000 + 150),
        brake: 0,
        steer: Math.max(-1, Math.min(1, wheelAngle / EXAM_CAR.maxSteerRad)),
      },
      SIM_STEP_S,
    );
    contacts.push(...state.contacts.map((contact) => contact.obstacleId));
    if (contacts.length) break;
  }
  expect(contacts).toEqual([]);
  expect(index).toBeGreaterThanOrEqual(waypoints.length + 20);
  expect(state.vehicle.odometerM).toBeGreaterThan(1400);
}, 15000);
