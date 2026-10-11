// Run with: node --test 'scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, validateRoute } from './check-route.mjs';

const projection = { originLat: -34.55, originLon: -58.46, metersPerDegLon: 91700, metersPerDegLat: 110540 };

function point(osmNode, x, y) {
  return { osmNode, x, y, lat: projection.originLat + y / projection.metersPerDegLat, lon: projection.originLon + x / projection.metersPerDegLon };
}

function buildRoute() {
  // A 100 m square loop: two streets, both legal, closing on itself.
  return {
    projection,
    officialSequence: ['Uno', 'Av. Dos', 'Uno'],
    loopLengthM: 400,
    start: { status: 'aproximacion' },
    legs: [
      { leg: 1, street: 'Uno', officialSteps: [3, 1], status: 'fuente-unica', roadType: 'calle', examMaxKmh: 30, lengthM: 200,
        turnIntoNext: { direction: 'left', angleDeg: 90 }, path: [point(1, 0, 0), point(2, 100, 0), point(3, 100, 100)],
        cycleTrack: 'partial', segments: [{ osmWay: 10, fromIndex: 0, toIndex: 1, cycleTrackLeft: true }, { osmWay: 11, fromIndex: 1, toIndex: 2, cycleTrackLeft: false }] },
      { leg: 2, street: 'Avenida Dos', officialSteps: [2], status: 'fuente-unica', roadType: 'avenida', examMaxKmh: 45, lengthM: 200,
        turnIntoNext: { direction: 'left', angleDeg: 90 }, path: [point(3, 100, 100), point(4, 0, 100), point(1, 0, 0)],
        cycleTrack: 'none', segments: [{ osmWay: 20, fromIndex: 0, toIndex: 2, cycleTrackLeft: false }] },
    ],
    controls: [{ legs: [2], type: 'traffic_signals', status: 'verificado-fuentes', sources: ['osm', 'gcba'], ...point(4, 0, 100) }],
  };
}

test('accepts a closed, consistent route', () => {
  // Arrange
  const route = buildRoute();

  // Act
  const errors = validateRoute(route);

  // Assert
  assert.deepEqual(errors, []);
});

test('projects coordinates back to the origin at zero', () => {
  const origin = project(projection, projection.originLat, projection.originLon);

  assert.equal(origin.x, 0);
  assert.equal(origin.y, 0);
});

test('reports broken continuity, wrong lengths and moved points', () => {
  const route = buildRoute();
  route.legs[1].path[2] = point(9, 0, 0);
  route.legs[0].lengthM = 150;
  route.legs[0].path[1].x += 5;

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 2: does not connect to leg 1'));
  assert.ok(errors.some((error) => error.startsWith('leg 1: lengthM 150 differs')));
  assert.ok(errors.includes('leg 1: point 1 local coordinates do not match its lat/lon'));
});

test('reports streets that do not follow the official sequence and missing steps', () => {
  const route = buildRoute();
  route.legs[1].street = 'Tres';
  route.legs[0].officialSteps = [1];

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 2: street "Tres" does not match official step 2'));
  assert.ok(errors.includes('legs must cover official steps 1,2,3 exactly once'));
});

test('rejects exam limits above 30 km/h on streets and 45 km/h on avenues', () => {
  const route = buildRoute();
  route.legs[0].examMaxKmh = 40;
  route.legs[1].examMaxKmh = 60;

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 1: examMaxKmh must be in (0, 30] for calle'));
  assert.ok(errors.includes('leg 2: examMaxKmh must be in (0, 45] for avenida'));
});

test('requires two sources for verified controls and valid statuses', () => {
  const route = buildRoute();
  route.controls[0].sources = ['osm'];
  route.legs[0].status = 'seguro';

  const errors = validateRoute(route);

  assert.ok(errors.includes('control 0 (traffic_signals): verified controls need two sources'));
  assert.ok(errors.includes('leg 1: invalid status "seguro"'));
});

test('rejects declared turns that contradict the geometry of adjacent legs', () => {
  const route = buildRoute();
  route.legs[0].turnIntoNext = { direction: 'right', angleDeg: -90 };
  route.legs[1].turnIntoNext = { direction: 'straight', angleDeg: 90 };

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 1: declared turn right (-90°) does not match geometry left (90°)'));
  assert.ok(errors.includes('leg 2: invalid turn direction "straight"'));
});

test('rejects missing or non-finite coordinates in points and controls', () => {
  const route = buildRoute();
  delete route.legs[0].path[1].lat;
  route.controls[0].x = Number.NaN;

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 1: point 1 has missing or non-finite coordinates'));
  assert.ok(errors.includes('control 0 (traffic_signals): missing or non-finite coordinates'));
});

test('requires segments that cover each leg and a matching cycle track summary', () => {
  const route = buildRoute();
  route.legs[0].segments = [{ osmWay: 10, fromIndex: 0, toIndex: 1, cycleTrackLeft: true }];
  route.legs[1].cycleTrack = 'full';

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 1: segments must cover the path contiguously from point 0 to 2'));
  assert.ok(errors.includes('leg 2: cycleTrack "full" does not match its segments ("none")'));
});

test('rejects missing or non-finite scalar metrics and projection factors', () => {
  const missingLength = buildRoute();
  delete missingLength.legs[0].lengthM;
  delete missingLength.loopLengthM;
  delete missingLength.legs[1].turnIntoNext.angleDeg;

  const missingProjection = buildRoute();
  missingProjection.projection = { ...projection, metersPerDegLat: undefined };

  const errors = validateRoute(missingLength);

  assert.ok(errors.includes('leg 1: lengthM must be a finite number'));
  assert.ok(errors.includes('loopLengthM must be a finite number'));
  assert.ok(errors.includes('leg 2: turnIntoNext.angleDeg must be a finite number'));
  assert.deepEqual(validateRoute(missingProjection), ['projection.metersPerDegLat must be a finite number']);
});

test('rejects a missing official sequence and invalid official steps', () => {
  const route = buildRoute();
  delete route.officialSequence;
  route.legs[0].officialSteps = [0];
  delete route.legs[1].officialSteps;

  const errors = validateRoute(route);

  assert.ok(errors.includes('officialSequence must be a non-empty list of street names'));
  assert.ok(errors.includes('leg 1: officialSteps must be a non-empty list of positive integers'));
  assert.ok(errors.includes('leg 2: officialSteps must be a non-empty list of positive integers'));
});

test('reports an invalid next path without throwing', () => {
  const route = buildRoute();
  delete route.legs[1].path;

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 2: path needs at least two points'));
  assert.ok(!errors.some((error) => error.includes('does not connect')));
});

test('rejects duplicated controls and controls without valid legs', () => {
  const route = buildRoute();
  route.controls.push({ ...route.controls[0], legs: [1, 2] });
  route.controls.push({ ...route.controls[0], osmNode: 99, x: 50, legs: [7] });
  route.controls[2] = { ...route.controls[2], ...point(99, 50, 0) };

  const errors = validateRoute(route);

  assert.ok(errors.includes('control 1 (traffic_signals): duplicates control 0'));
  assert.ok(errors.includes('control 2 (traffic_signals): unknown leg 7'));
});
