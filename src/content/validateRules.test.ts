import { describe, expect, it } from 'vitest';
import { EXPECTED_ANNEX_ITEMS, classifyCurbDistance, validateParkingBands, validateRules } from './validateRules.ts';
import { rule, ruleCatalog } from './testing/fixtures.ts';
import type { ParkingBand, Rule, Severity } from './schemas.ts';

const PROTOCOL_PAGES = 42;
const POINTS: Record<Severity, number> = { minor: 1, low: 2, high: 3, eliminatory: 8 };

function fullAnnex(): Rule[] {
  return (Object.entries(EXPECTED_ANNEX_ITEMS) as Array<[Severity, string]>).flatMap(([severity, letters]) =>
    [...letters].map((letter) =>
      rule({ id: `rule.${severity}.${letter}-item`, severity, annexItem: letter, points: POINTS[severity] }),
    ),
  );
}

describe('validateRules', () => {
  it('accepts the complete annex II set (69 items)', () => {
    // Arrange
    const rules = fullAnnex();

    // Act
    const errors = validateRules(ruleCatalog(rules), PROTOCOL_PAGES);

    // Assert
    expect(rules).toHaveLength(69);
    expect(errors).toEqual([]);
  });

  it('reports a missing annex item and every item when the catalog is empty', () => {
    const missing = validateRules(ruleCatalog(fullAnnex().filter((r) => r.id !== 'rule.minor.y-item')), PROTOCOL_PAGES);
    const empty = validateRules(ruleCatalog([]), PROTOCOL_PAGES);

    expect(missing).toEqual(['missing annex item minor.y']);
    expect(empty).toHaveLength(69);
  });

  it('rejects items outside the annex, duplicates, wrong points and ids that do not match', () => {
    const rules = [
      rule({ id: 'rule.minor.z-extra', severity: 'minor', annexItem: 'z', points: 1 }),
      rule({ id: 'rule.minor.i-curb', severity: 'minor', annexItem: 'i', points: 2 }),
      rule({ id: 'rule.minor.i-curb-copy', severity: 'minor', annexItem: 'i', points: 1 }),
      rule({ id: 'rule.high.e-mirrors', severity: 'high', annexItem: 'f', points: 3 }),
    ];

    const errors = validateRules(ruleCatalog(rules), PROTOCOL_PAGES, { requireFullAnnex: false });

    expect(errors).toContain('rule.minor.z-extra: unexpected annex item minor.z');
    expect(errors).toContain('rule.minor.i-curb: points must be 1');
    expect(errors).toContain('rule.minor.i-curb-copy: duplicate annex item minor.i');
    expect(errors).toContain('rule.high.e-mirrors: id does not match severity/annex item');
  });

  it('rejects interruption on non-eliminatory faults and pages outside the protocol', () => {
    const rules = [
      rule({
        id: 'rule.minor.i-curb',
        severity: 'minor',
        annexItem: 'i',
        points: 1,
        interrupts: true,
        refs: [{ source: 'protocolo', page: 43 }],
      }),
    ];

    const errors = validateRules(ruleCatalog(rules), PROTOCOL_PAGES, { requireFullAnnex: false });

    expect(errors).toContain('rule.minor.i-curb: only eliminatory faults can interrupt the exam');
    expect(errors).toContain('rule.minor.i-curb: page 43 is outside the protocol (1..42)');
  });

  it('rejects scoring citations outside the protocol', () => {
    const base = ruleCatalog([]);
    const catalog = { ...base, scoring: { ...base.scoring, refs: [{ source: 'protocolo' as const, page: 99 }] } };

    expect(validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false })).toEqual([
      'scoring: page 99 is outside the protocol (1..42)',
    ]);
  });

  it('rejects parking bands pointing to unknown rules', () => {
    const catalog = ruleCatalog([]);
    catalog.parkingBands[0] = { ...catalog.parkingBands[0]!, rule: 'rule.minor.t-ghost' };

    expect(validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false })).toEqual([
      'parking band too-close: unknown rule rule.minor.t-ghost',
    ]);
  });
});

describe('parking bands', () => {
  const bands = ruleCatalog([]).parkingBands;

  it('classifies curb distances at every boundary, including exactly 50 cm (decision V1)', () => {
    const cases: Array<[number, string]> = [
      [0, 'too-close'],
      [14.9, 'too-close'],
      [15, 'correct'],
      [25, 'correct'],
      [25.1, 'second-line'],
      [50, 'second-line'],
      [50.1, 'outside'],
    ];

    for (const [cm, expected] of cases) expect(classifyCurbDistance(bands, cm)?.band, `${cm} cm`).toBe(expected);
    expect(validateParkingBands(bands)).toEqual([]);
  });

  it('rejects a band with two alternative limits on the same side', () => {
    const replace = (name: string, patch: Partial<ParkingBand>) =>
      bands.map((band) => (band.band === name ? { ...band, ...patch } : band));

    // With lt 25 and lte 20, 20–25 cm would fall in no band while the boundary check sees only one limit.
    expect(validateParkingBands(replace('correct', { lt: 25, lte: 20 }))).toContain(
      'parking band correct has both lt and lte',
    );
    expect(validateParkingBands(replace('second-line', { gte: 25 }))).toContain(
      'parking band second-line has both gt and gte',
    );
  });

  it('reports gaps, overlaps, a bad start, an open end and missing bands', () => {
    const replace = (name: string, patch: Partial<ParkingBand>) =>
      bands.map((band) => (band.band === name ? { ...band, ...patch } : band));

    expect(validateParkingBands(replace('second-line', { lte: 49 }))).toEqual([
      'parking bands leave a gap or overlap between second-line and outside',
    ]);
    expect(validateParkingBands(replace('correct', { lte: 26 }))).toEqual([
      'parking bands leave a gap or overlap between correct and second-line',
    ]);
    expect(validateParkingBands(replace('too-close', { gt: 0 }))).toContain(
      'parking bands must start at 0 cm inclusive',
    );
    expect(validateParkingBands(replace('outside', { lt: 100 }))).toContain('parking bands must extend to infinity');
    expect(validateParkingBands([])).toEqual(['parking bands are missing']);
  });
});
