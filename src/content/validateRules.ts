import { SEVERITY_POINTS } from './schemas.ts';
import type { ParkingBand, RuleCatalog, Severity } from './schemas.ts';

/** Annex II items of the protocol (protocolo PDF 22–33): leves a–y, def. bajas a–j, def. altas a–p, eliminatorias a–r. */
export const EXPECTED_ANNEX_ITEMS: Record<Severity, string> = {
  minor: 'abcdefghijklmnopqrstuvwxy',
  low: 'abcdefghij',
  high: 'abcdefghijklmnop',
  eliminatory: 'abcdefghijklmnopqr',
};

function lowerBound(band: ParkingBand): number {
  return band.gt ?? band.gte ?? 0;
}

function upperBound(band: ParkingBand): number {
  return band.lt ?? band.lte ?? Infinity;
}

/** Returns the curb distance band that contains `cm`, or undefined when no band does. */
export function classifyCurbDistance(bands: readonly ParkingBand[], cm: number): ParkingBand | undefined {
  return bands.find(
    (band) =>
      (band.gt === undefined || cm > band.gt) &&
      (band.gte === undefined || cm >= band.gte) &&
      (band.lt === undefined || cm < band.lt) &&
      (band.lte === undefined || cm <= band.lte),
  );
}

/** Checks that the bands cover [0, ∞) exactly once: each boundary closed on one side and open on the other. */
export function validateParkingBands(bands: readonly ParkingBand[]): string[] {
  const errors: string[] = [];
  const sorted = [...bands].sort((a, b) => lowerBound(a) - lowerBound(b));
  const first = sorted[0];
  if (!first) return ['parking bands are missing'];
  if (lowerBound(first) !== 0 || first.gt !== undefined) errors.push('parking bands must start at 0 cm inclusive');
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1] as ParkingBand;
    const current = sorted[i] as ParkingBand;
    const sharedBoundary = upperBound(previous) === lowerBound(current);
    const consistent =
      (previous.lte !== undefined && current.gt !== undefined) ||
      (previous.lt !== undefined && current.gte !== undefined);
    if (!sharedBoundary || !consistent)
      errors.push(`parking bands leave a gap or overlap between ${previous.band} and ${current.band}`);
  }
  if (upperBound(sorted[sorted.length - 1] as ParkingBand) !== Infinity)
    errors.push('parking bands must extend to infinity');
  return errors;
}

export interface RuleValidationOptions {
  /** Small fixtures may opt out of requiring the full annex II set. */
  requireFullAnnex?: boolean;
}

/** Cross-record checks for the exam rule catalog (REGLAS.md). */
export function validateRules(
  catalog: RuleCatalog,
  protocolPages: number,
  { requireFullAnnex = true }: RuleValidationOptions = {},
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const annexItems = new Set<string>();

  for (const rule of catalog.rules) {
    const { id } = rule;
    if (ids.has(id)) errors.push(`${id}: duplicate rule id`);
    ids.add(id);
    const itemKey = `${rule.severity}.${rule.annexItem}`;
    if (annexItems.has(itemKey)) errors.push(`${id}: duplicate annex item ${itemKey}`);
    annexItems.add(itemKey);
    if (!EXPECTED_ANNEX_ITEMS[rule.severity].includes(rule.annexItem))
      errors.push(`${id}: unexpected annex item ${itemKey}`);
    if (!id.startsWith(`rule.${rule.severity}.${rule.annexItem}-`))
      errors.push(`${id}: id does not match severity/annex item`);
    if (rule.points !== SEVERITY_POINTS[rule.severity])
      errors.push(`${id}: points must be ${SEVERITY_POINTS[rule.severity]}`);
    if (rule.interrupts && rule.severity !== 'eliminatory')
      errors.push(`${id}: only eliminatory faults can interrupt the exam`);
    for (const ref of [...rule.refs, ...rule.fichaRows.map((row) => ({ page: row.page }))]) {
      if (ref.page > protocolPages)
        errors.push(`${id}: page ${ref.page} is outside the protocol (1..${protocolPages})`);
    }
  }

  if (requireFullAnnex) {
    for (const [severity, letters] of Object.entries(EXPECTED_ANNEX_ITEMS)) {
      for (const letter of letters) {
        if (!annexItems.has(`${severity}.${letter}`)) errors.push(`missing annex item ${severity}.${letter}`);
      }
    }
  }

  errors.push(...validateParkingBands(catalog.parkingBands));
  for (const band of catalog.parkingBands) {
    if (band.rule !== null && !ids.has(band.rule)) errors.push(`parking band ${band.band}: unknown rule ${band.rule}`);
  }
  return errors;
}
