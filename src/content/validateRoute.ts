import type { Route, RouteLeg } from './schemas.ts';
import { refErrors } from './refs.ts';
import type { PageCounts } from './refs.ts';

const POSITION_TOLERANCE_M = 0.5;
const LENGTH_TOLERANCE_M = 1;
const TURN_ANGLE_TOLERANCE_DEG = 5;
/** Exam speed caps per road type (protocolo PDF 8, 10). */
const EXAM_MAX_KMH = { street: 30, avenue: 45 } as const;

type Projection = Route['projection'];
interface Point {
  x: number;
  y: number;
}

/** Projects WGS84 coordinates to the route's local metric frame (x east, y north). */
export function project(projection: Projection, lat: number, lon: number): Point {
  return {
    x: (lon - projection.originLon) * projection.metersPerDegLon,
    y: (lat - projection.originLat) * projection.metersPerDegLat,
  };
}

/** Signed turn angle in degrees between the last segment of `path` and the first segment of `nextPath` (left > 0). */
export function turnAngleDeg(path: readonly Point[], nextPath: readonly Point[]): number {
  const [a, b] = path.slice(-2) as [Point, Point];
  const [c, d] = nextPath.slice(0, 2) as [Point, Point];
  const delta = Math.atan2(d.y - c.y, d.x - c.x) - Math.atan2(b.y - a.y, b.x - a.x);
  return (((delta * 180) / Math.PI + 540) % 360) - 180;
}

function normalizeStreet(street: string): string {
  return street
    .replace(/^(Av\.|Avenida)\s*/i, '')
    .trim()
    .toLowerCase();
}

function segmentErrors(leg: RouteLeg, label: string): string[] {
  const segments = [...leg.segments].sort((a, b) => a.fromIndex - b.fromIndex);
  const lastIndex = leg.path.length - 1;
  const contiguous =
    segments[0]?.fromIndex === 0 &&
    segments[segments.length - 1]?.toIndex === lastIndex &&
    segments.every(
      (segment, i) =>
        segment.toIndex > segment.fromIndex && (i === 0 || segment.fromIndex === segments[i - 1]?.toIndex),
    );
  if (!contiguous) return [`${label}: segments must cover the path contiguously from point 0 to ${lastIndex}`];
  const withTrack = segments.filter((segment) => segment.cycleTrackLeft).length;
  const summary = withTrack === 0 ? 'none' : withTrack === segments.length ? 'full' : 'partial';
  return leg.cycleTrack === summary
    ? []
    : [`${label}: cycleTrack "${leg.cycleTrack}" does not match its segments ("${summary}")`];
}

function legErrors(route: Route, leg: RouteLeg, next: RouteLeg): { errors: string[]; lengthM: number } {
  const label = `leg ${leg.leg}`;
  const errors: string[] = [];
  for (const step of leg.officialSteps) {
    if (normalizeStreet(route.officialSequence[step - 1] ?? '') !== normalizeStreet(leg.street)) {
      errors.push(`${label}: street "${leg.street}" does not match official step ${step}`);
    }
  }
  errors.push(...segmentErrors(leg, label));
  let lengthM = 0;
  leg.path.forEach((point, index) => {
    const expected = project(route.projection, point.lat, point.lon);
    if (Math.hypot(expected.x - point.x, expected.y - point.y) > POSITION_TOLERANCE_M) {
      errors.push(`${label}: point ${index} local coordinates do not match its lat/lon`);
    }
    const previous = leg.path[index - 1];
    if (previous) lengthM += Math.hypot(point.x - previous.x, point.y - previous.y);
  });
  if (Math.abs(lengthM - leg.lengthM) > LENGTH_TOLERANCE_M)
    errors.push(`${label}: lengthM ${leg.lengthM} differs from path length ${lengthM.toFixed(1)}`);
  if (leg.path[leg.path.length - 1]?.osmNode !== next.path[0]?.osmNode)
    errors.push(`${label}: does not connect to leg ${next.leg}`);
  const cap = EXAM_MAX_KMH[leg.roadType];
  if (leg.examMaxKmh > cap) errors.push(`${label}: examMaxKmh must be in (0, ${cap}] for ${leg.roadType}`);
  const actual = turnAngleDeg(leg.path, next.path);
  const actualDirection = actual > 0 ? 'left' : 'right';
  const turn = leg.turnIntoNext;
  if (turn.direction !== actualDirection || Math.abs(turn.angleDeg - actual) > TURN_ANGLE_TOLERANCE_DEG) {
    errors.push(
      `${label}: declared turn ${turn.direction} (${Math.round(turn.angleDeg)}°) does not match geometry ${actualDirection} (${Math.round(actual)}°)`,
    );
  }
  return { errors, lengthM };
}

/** Cross-record checks for a driving route (RECORRIDO.md): official sequence, continuity, projection and controls. */
export function validateRoute(route: Route, pages: PageCounts): string[] {
  const errors: string[] = [...refErrors('sources.route', route.sources.route, pages)];
  const coveredSteps = route.legs.flatMap((leg) => leg.officialSteps).sort((a, b) => a - b);
  const expectedSteps = route.officialSequence.map((_, index) => index + 1);
  if (coveredSteps.join(',') !== expectedSteps.join(','))
    errors.push(`legs must cover official steps ${expectedSteps.join(',')} exactly once`);

  let total = 0;
  route.legs.forEach((leg, index) => {
    const next = route.legs[(index + 1) % route.legs.length] as RouteLeg;
    const result = legErrors(route, leg, next);
    errors.push(...result.errors);
    total += result.lengthM;
  });
  if (Math.abs(total - route.loopLengthM) > LENGTH_TOLERANCE_M)
    errors.push(`loopLengthM ${route.loopLengthM} differs from legs total ${total.toFixed(1)}`);

  const legNumbers = new Set(route.legs.map((leg) => leg.leg));
  const seenControls = new Map<string, number>();
  route.controls.forEach((control, index) => {
    const label = `control ${index} (${control.type})`;
    for (const legNumber of control.legs) {
      if (!legNumbers.has(legNumber)) errors.push(`${label}: unknown leg ${legNumber}`);
    }
    // One physical control per location: a control shared by two legs lists both in `legs`.
    const key = `${control.type}|${control.osmNode ?? `${control.lat},${control.lon}`}`;
    const previous = seenControls.get(key);
    if (previous !== undefined) errors.push(`${label}: duplicates control ${previous}`);
    else seenControls.set(key, index);
    if (control.status === 'sources-verified' && control.sources.length < 2)
      errors.push(`${label}: verified controls need two sources`);
    const expected = project(route.projection, control.lat, control.lon);
    if (Math.hypot(expected.x - control.x, expected.y - control.y) > POSITION_TOLERANCE_M) {
      errors.push(`${label}: local coordinates do not match its lat/lon`);
    }
  });
  if (!legNumbers.has(route.start.leg)) errors.push(`start: unknown leg ${route.start.leg}`);
  return errors;
}
