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
        turnIntoNext: { direction: 'left', angleDeg: 90 }, path: [point(1, 0, 0), point(2, 100, 0), point(3, 100, 100)] },
      { leg: 2, street: 'Avenida Dos', officialSteps: [2], status: 'fuente-unica', roadType: 'avenida', examMaxKmh: 45, lengthM: 200,
        turnIntoNext: { direction: 'left', angleDeg: 90 }, path: [point(3, 100, 100), point(4, 0, 100), point(1, 0, 0)] },
    ],
    controls: [{ leg: 2, type: 'traffic_signals', status: 'verificado-fuentes', sources: ['osm', 'gcba'], ...point(4, 0, 100) }],
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

test('rejects turn directions that contradict the computed angle', () => {
  const route = buildRoute();
  route.legs[0].turnIntoNext = { direction: 'right', angleDeg: 90 };

  const errors = validateRoute(route);

  assert.ok(errors.includes('leg 1: turn direction does not match its angle'));
});
