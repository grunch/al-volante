import { describe, expect, it } from 'vitest';
import { project, turnAngleDeg, validateRoute } from './validateRoute.ts';
import { route, routePoint } from './testing/fixtures.ts';

describe('validateRoute', () => {
  it('accepts a closed, consistent route', () => {
    // Arrange
    const data = route();

    // Act
    const errors = validateRoute(data);

    // Assert
    expect(errors).toEqual([]);
  });

  it('projects the origin to zero and computes signed turn angles (left > 0)', () => {
    const data = route();

    expect(project(data.projection, data.projection.originLat, data.projection.originLon)).toEqual({ x: 0, y: 0 });
    expect(
      turnAngleDeg(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
      ),
    ).toBeCloseTo(90);
  });

  it('reports broken continuity, wrong lengths and points that do not match their lat/lon', () => {
    const data = route();
    data.legs[1]!.path[2] = routePoint(9, 0, 0);
    data.legs[0]!.lengthM = 150;
    data.legs[0]!.path[1]!.x += 5;

    const errors = validateRoute(data);

    expect(errors).toContain('leg 2: does not connect to leg 1');
    expect(errors.some((error) => error.startsWith('leg 1: lengthM 150 differs'))).toBe(true);
    expect(errors).toContain('leg 1: point 1 local coordinates do not match its lat/lon');
  });

  it('reports streets out of the official sequence and uncovered steps', () => {
    const data = route();
    data.legs[1]!.street = 'Tres';
    data.legs[0]!.officialSteps = [1];

    const errors = validateRoute(data);

    expect(errors).toContain('leg 2: street "Tres" does not match official step 2');
    expect(errors).toContain('legs must cover official steps 1,2,3 exactly once');
  });

  it('rejects exam limits above 30 km/h on streets and 45 km/h on avenues', () => {
    const data = route();
    data.legs[0]!.examMaxKmh = 40;
    data.legs[1]!.examMaxKmh = 60;

    const errors = validateRoute(data);

    expect(errors).toContain('leg 1: examMaxKmh must be in (0, 30] for calle');
    expect(errors).toContain('leg 2: examMaxKmh must be in (0, 45] for avenida');
  });

  it('rejects declared turns that contradict the geometry and a wrong loop length', () => {
    const data = route();
    data.legs[0]!.turnIntoNext = { direction: 'right', angleDeg: -90, nextStreet: 'Avenida Dos' };
    data.loopLengthM = 380;

    const errors = validateRoute(data);

    expect(errors).toContain('leg 1: declared turn right (-90°) does not match geometry left (90°)');
    expect(errors.some((error) => error.startsWith('loopLengthM 380 differs'))).toBe(true);
  });

  it('requires segments that cover each leg and a matching cycle track summary', () => {
    const data = route();
    data.legs[0]!.segments = [
      { osmWay: 10, fromIndex: 0, toIndex: 1, cycleTrackLeft: true, maxspeedOsm: null, lanesOsm: null },
    ];
    data.legs[1]!.cycleTrack = 'full';

    const errors = validateRoute(data);

    expect(errors).toContain('leg 1: segments must cover the path contiguously from point 0 to 2');
    expect(errors).toContain('leg 2: cycleTrack "full" does not match its segments ("none")');
  });

  it('rejects duplicated controls, unknown legs, unverified sources, moved controls and an unknown start leg', () => {
    const data = route();
    const first = data.controls[0]!;
    data.controls.push({ ...first, legs: [1, 2] }, { ...first, ...routePoint(99, 50, 0), legs: [7], sources: ['osm'] });
    data.controls[2]!.x += 3;
    data.start.leg = 5;

    const errors = validateRoute(data);

    expect(errors).toContain('control 1 (traffic_signals): duplicates control 0');
    expect(errors).toContain('control 2 (traffic_signals): unknown leg 7');
    expect(errors).toContain('control 2 (traffic_signals): verified controls need two sources');
    expect(errors).toContain('control 2 (traffic_signals): local coordinates do not match its lat/lon');
    expect(errors).toContain('start: unknown leg 5');
  });
});
