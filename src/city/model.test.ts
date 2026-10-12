import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { bodyBox, EXAM_CAR } from '../sim/vehicle.ts';
import { overlaps } from '../sim/collision.ts';
import { buildCity, entryPose, sampleLeg, toWorld } from './model.ts';

const route = RouteSchema.parse(routeData);

describe('metric city derived from the validated route', () => {
  it('preserves every source point, closes all eight legs and keeps east and north unmirrored', () => {
    const city = buildCity(route);
    expect(toWorld({ x: 12, y: 34 })).toEqual({ x: 12, z: -34 });
    for (const leg of city.legs) {
      const source = route.legs.find((item) => item.leg === leg.number)!;
      expect(leg.path).toEqual(source.path.map(toWorld));
      const next = city.legs[leg.number % city.legs.length]!;
      expect(leg.path.at(-1)).toEqual(next.path[0]);
      expect(leg.lengthM).toBeCloseTo(source.lengthM, 0);
    }
    expect(city.legs.reduce((sum, leg) => sum + leg.lengthM, 0)).toBeCloseTo(1506.8, 0);
    expect(city.legs[4]!.lengthM).toBeCloseTo(66.2, 0);
  });

  it('keeps segment-specific bike lanes, lane evidence and road speed separate from exam caps', () => {
    const city = buildCity(route);
    const cuba = city.roads.filter((road) => road.leg === 6);
    expect(cuba.filter((road) => road.cycleTrack).every((road) => road.postedMaxKmh === 30)).toBe(true);
    expect(cuba.filter((road) => !road.cycleTrack).every((road) => road.postedMaxKmh === 40)).toBe(true);
    expect(city.roads.find((road) => road.leg === 2)).toMatchObject({ lanes: 2, postedMaxKmh: 60, examMaxKmh: 45 });
    expect(city.roads.find((road) => road.leg === 1)).toMatchObject({
      lanesStatus: 'approximation',
      widthStatus: 'approximation',
    });
  });

  it('retains all control evidence, including the official Cabildo–Guayra discrepancy', () => {
    const city = buildCity(route);
    expect(city.controls).toHaveLength(14);
    city.controls.forEach((control, index) => {
      expect(control.sourcePosition).toEqual(toWorld(route.controls[index]!));
      expect(control.status).toBe(route.controls[index]!.status);
    });
    expect(city.controls.find((control) => control.gcbaId === 'B-CR-00064')?.status).toBe('discrepancy');
    const stop = city.controls.find((control) => control.type === 'stop')!;
    const delta = { x: stop.position.x - stop.sourcePosition.x, z: stop.position.z - stop.sourcePosition.z };
    expect(delta.x * Math.sin(stop.road.headingRad) + delta.z * Math.cos(stop.road.headingRad)).toBeCloseTo(0);
  });

  it('keeps the full driving centerline and every entry pose clear of curb collisions', () => {
    const city = buildCity(route);
    for (const leg of city.legs) {
      for (let distance = 0; distance < leg.lengthM; distance += 2) {
        const body = bodyBox(EXAM_CAR, sampleLeg(city, leg.number, distance));
        expect(
          city.world.obstacles.filter((obstacle) => overlaps(body, obstacle.box)),
          `${leg.number}:${distance}`,
        ).toEqual([]);
      }
    }
    expect(city.world.obstacles.length).toBeGreaterThan(100);
    expect(city.start.status).toBe('approximation');
    expect(city.world.obstacles.some((obstacle) => overlaps(bodyBox(EXAM_CAR, city.start.pose), obstacle.box))).toBe(
      false,
    );
  });

  it('preserves turn handedness and rejects invalid entry selections', () => {
    const city = buildCity(route);
    city.legs.forEach((leg, index) => {
      const incoming = sampleLeg(city, leg.number, leg.lengthM).headingRad;
      const outgoing = sampleLeg(city, city.legs[(index + 1) % city.legs.length]!.number, 0).headingRad;
      const angle = Math.atan2(Math.sin(outgoing - incoming), Math.cos(outgoing - incoming));
      expect(angle > 0 ? 'left' : 'right').toBe(route.legs[index]!.turnIntoNext.direction);
    });
    expect(() => sampleLeg(city, 9, 0)).toThrow('Unknown leg');
    expect(() => sampleLeg(city, 1, NaN)).toThrow('Invalid distance');
  });

  it('enters multi-lane streets in the right lane and marks a bay with exactly 6 m outer length', () => {
    const city = buildCity(route);
    for (const leg of city.legs) {
      const entry = entryPose(city, leg.number);
      expect(city.world.obstacles.some((item) => overlaps(bodyBox(EXAM_CAR, entry), item.box))).toBe(false);
    }
    const center = sampleLeg(city, 2, 18),
      right = entryPose(city, 2);
    expect(
      (right.x - center.x) * Math.cos(center.headingRad) - (right.z - center.z) * Math.sin(center.headingRad),
    ).toBeCloseTo(-1.75);
    const [first, last] = city.world.markings!;
    expect(
      Math.hypot(first!.centerX - last!.centerX, first!.centerZ - last!.centerZ) +
        first!.halfLengthM +
        last!.halfLengthM,
    ).toBeCloseTo(6);
  });
});
