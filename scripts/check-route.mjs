#!/usr/bin/env node
// Validates the driving route data in specs/route against its declared projection and the official sequence.
// Usage: node scripts/check-route.mjs [routeJsonFile]
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const STATUSES = ['verificado-fuentes', 'fuente-unica', 'discrepancia', 'aproximacion', 'relevado'];
const POSITION_TOLERANCE_M = 0.5;
const LENGTH_TOLERANCE_M = 1;
const EXAM_MAX_KMH = { calle: 30, avenida: 45 };
const TURN_DIRECTIONS = ['left', 'right'];
const TURN_ANGLE_TOLERANCE_DEG = 5;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasFiniteCoordinates(item) {
  return ['lat', 'lon', 'x', 'y'].every((key) => isFiniteNumber(item?.[key]));
}

/** Signed turn angle in degrees between the last segment of `path` and the first segment of `nextPath` (left > 0). */
export function turnAngleDeg(path, nextPath) {
  const [a, b] = path.slice(-2);
  const [c, d] = nextPath.slice(0, 2);
  const delta = Math.atan2(d.y - c.y, d.x - c.x) - Math.atan2(b.y - a.y, b.x - a.x);
  return (((delta * 180) / Math.PI + 540) % 360) - 180;
}

function segmentErrors(leg, label) {
  const segments = [...(leg.segments ?? [])].sort((a, b) => a.fromIndex - b.fromIndex);
  const lastIndex = leg.path.length - 1;
  const contiguous = segments.length > 0 && segments[0].fromIndex === 0 && segments.at(-1).toIndex === lastIndex
    && segments.every((segment, i) => segment.toIndex > segment.fromIndex && (i === 0 || segment.fromIndex === segments[i - 1].toIndex));
  if (!contiguous) return [`${label}: segments must cover the path contiguously from point 0 to ${lastIndex}`];
  const withTrack = segments.filter((segment) => segment.cycleTrackLeft === true).length;
  const summary = withTrack === 0 ? 'none' : withTrack === segments.length ? 'full' : 'partial';
  return leg.cycleTrack === summary ? [] : [`${label}: cycleTrack "${leg.cycleTrack}" does not match its segments ("${summary}")`];
}

/** Projects WGS84 coordinates to the route's local metric frame (x east, y north). */
export function project(projection, lat, lon) {
  return {
    x: (lon - projection.originLon) * projection.metersPerDegLon,
    y: (lat - projection.originLat) * projection.metersPerDegLat,
  };
}

function normalize(street) {
  return street.replace(/^(Av\.|Avenida)\s*/i, '').trim().toLowerCase();
}

/**
 * Returns a list of human-readable errors; an empty list means the route is valid.
 * @param {object} route parsed specs/route/<id>.json
 */
export function validateRoute(route) {
  const errors = [];
  const { legs = [], controls = [], projection, officialSequence = [] } = route;
  if (!projection) return ['missing projection'];
  if (legs.length === 0) return ['route has no legs'];

  const coveredSteps = legs.flatMap((leg) => leg.officialSteps ?? []).sort((a, b) => a - b);
  const expectedSteps = officialSequence.map((_, index) => index + 1);
  if (coveredSteps.join(',') !== expectedSteps.join(',')) errors.push(`legs must cover official steps ${expectedSteps.join(',')} exactly once`);

  let total = 0;
  const geometryOk = legs.map((leg) => Array.isArray(leg.path) && leg.path.length >= 2 && leg.path.every(hasFiniteCoordinates));
  legs.forEach((leg, index) => {
    const label = `leg ${leg.leg}`;
    for (const step of leg.officialSteps ?? []) {
      if (normalize(officialSequence[step - 1] ?? '') !== normalize(leg.street)) errors.push(`${label}: street "${leg.street}" does not match official step ${step}`);
    }
    if (!STATUSES.includes(leg.status)) errors.push(`${label}: invalid status "${leg.status}"`);
    if (!Array.isArray(leg.path) || leg.path.length < 2) {
      errors.push(`${label}: path needs at least two points`);
      return;
    }
    const badPoints = leg.path.map((point, pointIndex) => (hasFiniteCoordinates(point) ? null : pointIndex)).filter((i) => i !== null);
    for (const pointIndex of badPoints) errors.push(`${label}: point ${pointIndex} has missing or non-finite coordinates`);
    if (badPoints.length > 0) return;
    errors.push(...segmentErrors(leg, label));
    let length = 0;
    leg.path.forEach((point, pointIndex) => {
      const expected = project(projection, point.lat, point.lon);
      if (Math.hypot(expected.x - point.x, expected.y - point.y) > POSITION_TOLERANCE_M) errors.push(`${label}: point ${pointIndex} local coordinates do not match its lat/lon`);
      if (pointIndex > 0) {
        const previous = leg.path[pointIndex - 1];
        length += Math.hypot(point.x - previous.x, point.y - previous.y);
      }
    });
    total += length;
    if (Math.abs(length - leg.lengthM) > LENGTH_TOLERANCE_M) errors.push(`${label}: lengthM ${leg.lengthM} differs from path length ${length.toFixed(1)}`);
    const next = legs[(index + 1) % legs.length];
    if (leg.path.at(-1).osmNode !== next.path[0].osmNode) errors.push(`${label}: does not connect to leg ${next.leg}`);
    const cap = EXAM_MAX_KMH[leg.roadType];
    if (cap === undefined) errors.push(`${label}: invalid roadType "${leg.roadType}"`);
    else if (!(leg.examMaxKmh > 0 && leg.examMaxKmh <= cap)) errors.push(`${label}: examMaxKmh must be in (0, ${cap}] for ${leg.roadType}`);
    const turn = leg.turnIntoNext;
    if (!TURN_DIRECTIONS.includes(turn?.direction)) {
      errors.push(`${label}: invalid turn direction "${turn?.direction}"`);
    } else if (geometryOk[(index + 1) % legs.length]) {
      const actual = turnAngleDeg(leg.path, next.path);
      const actualDirection = actual > 0 ? 'left' : 'right';
      if (turn.direction !== actualDirection || Math.abs(turn.angleDeg - actual) > TURN_ANGLE_TOLERANCE_DEG) {
        errors.push(`${label}: declared turn ${turn.direction} (${Math.round(turn.angleDeg)}°) does not match geometry ${actualDirection} (${Math.round(actual)}°)`);
      }
    }
  });
  if (Math.abs(total - route.loopLengthM) > LENGTH_TOLERANCE_M) errors.push(`loopLengthM ${route.loopLengthM} differs from legs total ${total.toFixed(1)}`);

  const legNumbers = new Set(legs.map((leg) => leg.leg));
  controls.forEach((control, index) => {
    const label = `control ${index} (${control.type})`;
    if (!legNumbers.has(control.leg)) errors.push(`${label}: unknown leg ${control.leg}`);
    if (!STATUSES.includes(control.status)) errors.push(`${label}: invalid status "${control.status}"`);
    if (control.status === 'verificado-fuentes' && (control.sources ?? []).length < 2) errors.push(`${label}: verified controls need two sources`);
    if (!hasFiniteCoordinates(control)) {
      errors.push(`${label}: missing or non-finite coordinates`);
      return;
    }
    const expected = project(projection, control.lat, control.lon);
    if (Math.hypot(expected.x - control.x, expected.y - control.y) > POSITION_TOLERANCE_M) errors.push(`${label}: local coordinates do not match its lat/lon`);
  });
  if (!STATUSES.includes(route.start?.status)) errors.push('start: invalid or missing status');
  return errors;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const file = resolve(process.argv[2] ?? join(root, 'specs/route/comuna13-a.json'));
  const route = JSON.parse(readFileSync(file, 'utf8'));
  const errors = validateRoute(route);
  if (errors.length > 0) {
    console.error(`Route has ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Route OK: ${route.legs.length} legs, ${route.loopLengthM} m loop, ${route.controls.length} controls.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
