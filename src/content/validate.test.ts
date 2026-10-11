import { describe, expect, it } from 'vitest';
import routeGeoJson from '../../specs/route/comuna13-a.geojson?raw';
import { VERIFICATION_STATUSES } from './schemas.ts';
import { computeContentVersion, validateContent } from './validate.ts';
import type { RawContent } from './validate.ts';
import { loadContent } from './catalog.ts';
import { computeCoverage } from './coverage.ts';
import { catalog, choiceActivity, route, ruleCatalog, source } from './testing/fixtures.ts';

function rawFixture(): RawContent {
  const data = catalog();
  // The route cites recorridos PDF 16, so the manifest needs that source too.
  return {
    ...data,
    manifest: [...data.manifest, source('recorridos', 19)],
    rules: ruleCatalog([]),
    route: route(),
    activities: [choiceActivity()],
  };
}

describe('validateContent', () => {
  it('reports structural errors with the file and the JSON path', () => {
    // Arrange
    const raw = rawFixture();
    raw.units = [{ id: 42 }];

    // Act
    const result = validateContent(raw);

    // Assert
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.startsWith('specs/catalog/units.json[0].id:'))).toBe(true);
  });

  it('prefixes cross-reference errors with the catalog that failed', () => {
    const raw = rawFixture();

    const result = validateContent(raw);

    // The small fixture lacks the 69 annex items, so only rule completeness fails.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.every((error) => error.startsWith('rules: missing annex item'))).toBe(true);
  });

  it('rejects route citations of sources missing from the manifest', () => {
    const raw = { ...rawFixture(), manifest: catalog().manifest };

    const result = validateContent(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('route: sources.route: cites recorridos, which is not in the manifest');
  });

  it('fixes the protocol scoring invariants (protocolo PDF 10 and 14)', () => {
    const variants = [
      { requiresAllStagesCompleted: false },
      { cumulativeAcrossStages: false },
      { maxPointsBeforeCirculation: 8 },
    ];

    for (const patch of variants) {
      const raw = rawFixture();
      const rules = raw.rules as ReturnType<typeof ruleCatalog>;
      raw.rules = { ...rules, scoring: { ...rules.scoring, ...patch } };
      const result = validateContent(raw);
      const field = Object.keys(patch)[0] as string;
      expect(result.ok, field).toBe(false);
      if (result.ok) continue;
      expect(
        result.errors.some((error) => error.includes(`scoring.${field}`)),
        field,
      ).toBe(true);
    }
  });

  it('rejects a rule catalog built from another edition of the protocol than the manifest', () => {
    const raw = rawFixture();
    const rules = raw.rules as ReturnType<typeof ruleCatalog>;
    raw.rules = { ...rules, source: { ...rules.source, edition: '2020-01-01', sha256: 'c'.repeat(64) } };

    const result = validateContent(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain('rules: source edition 2020-01-01 does not match the manifest (2023)');
    expect(result.errors).toContain('rules: source sha256 does not match the manifest');
  });

  it('keeps the route GeoJSON in the same status vocabulary as the catalog', () => {
    const features = (JSON.parse(routeGeoJson) as { features: Array<{ properties?: { status?: string } }> }).features;
    const statuses = features.flatMap((feature) => feature.properties?.status ?? []);

    expect(statuses.length).toBeGreaterThan(0);
    for (const status of statuses) expect(VERIFICATION_STATUSES).toContain(status);
  });

  it('computes a deterministic content version that changes with the content', () => {
    const raw = rawFixture();
    const same = rawFixture();
    const changed = rawFixture();
    changed.activities = [];

    expect(computeContentVersion(raw)).toMatch(/^[0-9a-f]{8}$/);
    expect(computeContentVersion(raw)).toBe(computeContentVersion(same));
    expect(computeContentVersion(raw)).not.toBe(computeContentVersion(changed));
  });
});

describe('real content (integration)', () => {
  it('loads and validates every bundled catalog with the phase 1 totals', async () => {
    const result = await loadContent();

    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { content } = result;
    expect(content.pages).toHaveLength(224);
    expect(content.units).toHaveLength(705);
    expect(content.signs).toHaveLength(355);
    expect(content.issues).toHaveLength(206);
    expect(content.rules.rules).toHaveLength(69);
    expect(content.route.legs).toHaveLength(8);
    expect(content.manifest.map((source) => source.id)).toEqual(['manual', 'protocolo', 'recorridos', 'siniestros']);
  });
});

describe('computeCoverage', () => {
  it('counts pages, units and units with activities per section', () => {
    const data = catalog();

    const rows = computeCoverage({ pages: data.pages, units: data.units, activities: [choiceActivity()] });

    expect(rows).toEqual([
      {
        source: 'manual',
        section: 'front',
        category: 'common',
        pages: 1,
        instructionalPages: 0,
        units: 0,
        figureBasedUnits: 0,
        unitsWithActivities: 0,
      },
      {
        source: 'manual',
        section: 'ch3',
        category: 'B',
        pages: 1,
        instructionalPages: 1,
        units: 1,
        figureBasedUnits: 0,
        unitsWithActivities: 1,
      },
      {
        source: 'siniestros',
        section: 'front',
        category: 'guide',
        pages: 1,
        instructionalPages: 0,
        units: 0,
        figureBasedUnits: 0,
        unitsWithActivities: 0,
      },
    ]);
  });
});
