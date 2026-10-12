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
    // The activity practices the only unit, so the unit is tested (validateTreatment).
    units: data.units.map((unit) => ({ ...unit, status: 'tested' })),
    manifest: [...data.manifest, source('recorridos', 19)],
    rules: ruleCatalog([]),
    route: route(),
    figures: [],
    activities: { 'manual-ch3': [choiceActivity()] },
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

  it('reports activity errors with the file of their section', () => {
    const raw = rawFixture();
    raw.activities = { 'manual-ch3': [{ id: 'act.broken' }], 'manual-ch1': [choiceActivity({ id: 'act.misplaced' })] };

    const result = validateContent(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.startsWith('specs/catalog/activities/manual-ch3.json[0].'))).toBe(true);
  });

  it('keeps each activity in the file of its first unit section', () => {
    const raw = rawFixture();
    raw.activities = { 'manual-ch1': [choiceActivity()] };

    const result = validateContent(raw);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContain(
      'activities: act.speed-street: is in manual-ch1.json but its first unit belongs to manual-ch3.json',
    );
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
    changed.activities = {};
    const reordered = rawFixture();
    reordered.activities = { 'manual-ch1': [], 'manual-ch3': [choiceActivity()] };
    const listedBackwards = rawFixture();
    listedBackwards.activities = { 'manual-ch3': [choiceActivity()], 'manual-ch1': [] };

    expect(computeContentVersion(raw)).toMatch(/^[0-9a-f]{8}$/);
    expect(computeContentVersion(raw)).toBe(computeContentVersion(same));
    expect(computeContentVersion(raw)).not.toBe(computeContentVersion(changed));
    // The loader may list files in any order: the version only depends on their names and contents.
    expect(computeContentVersion(reordered)).toBe(computeContentVersion(listedBackwards));
  });
});

describe('real content (integration)', () => {
  it('loads and validates every bundled catalog with the phase 1 totals and the observations added since', async () => {
    const result = await loadContent();

    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { content } = result;
    expect(content.pages).toHaveLength(224);
    expect(content.units).toHaveLength(705);
    expect(content.signs).toHaveLength(355);
    // 206 observations from F01-T02, plus 8 found while reviewing units in F05-T01 and 12 in F05-T02.
    expect(content.issues).toHaveLength(226);
    expect(content.rules.rules).toHaveLength(69);
    expect(content.route.legs).toHaveLength(8);
    expect(content.manifest.map((source) => source.id)).toEqual(['manual', 'protocolo', 'recorridos', 'siniestros']);
  });
});

/** Sections whose units phase 5 has already reviewed and treated (CONTENIDO.md, coverage by task). */
const TREATED_SECTIONS = [
  'manual-front',
  'manual-glossary',
  'manual-intro',
  'manual-ch1',
  'manual-ch2',
  'manual-ch3',
  'manual-annex4',
  'siniestros-intro',
  'siniestros-s1',
  'siniestros-s2',
  'siniestros-s3',
];

describe('content coverage (integration)', () => {
  it('treats every unit of the finished sections, by activity or as consultation', async () => {
    const result = await loadContent();

    if (!result.ok) throw new Error(result.errors.join('\n'));
    const untreated = result.content.units
      .filter((unit) => TREATED_SECTIONS.includes(`${unit.source}-${unit.section}`))
      .filter((unit) => unit.status !== 'implemented' && unit.status !== 'tested')
      .map((unit) => unit.id);
    expect(untreated).toEqual([]);
  });
});

/** Pages whose signs phase 5 has not reached yet (chapter 4, F05-T03). */
const SIGN_PAGES_PENDING = [91];

describe('sign coverage (integration)', () => {
  it('crops and treats every sign of the finished pages, by activity or as consultation', async () => {
    const result = await loadContent();

    if (!result.ok) throw new Error(result.errors.join('\n'));
    const finished = result.content.signs.filter((sign) => !SIGN_PAGES_PENDING.includes(sign.page));
    expect(finished.filter((sign) => !sign.box).map((sign) => sign.id)).toEqual([]);
    expect(
      finished.filter((sign) => sign.status !== 'implemented' && sign.status !== 'tested').map((sign) => sign.id),
    ).toEqual([]);
  });
});

describe('computeCoverage', () => {
  it('counts consultation and reviewed units, and ignores draft activities', () => {
    const data = catalog();
    const units = data.units.map((unit) => ({ ...unit, status: 'reviewed' as const, consultationReason: 'Datos.' }));

    const rows = computeCoverage({
      pages: data.pages,
      units,
      activities: [choiceActivity({ status: 'draft' })],
    });

    expect(rows[1]).toMatchObject({ unitsWithActivities: 0, consultationUnits: 1, reviewedUnits: 1 });
  });

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
        consultationUnits: 0,
        reviewedUnits: 0,
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
        consultationUnits: 0,
        reviewedUnits: 0,
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
        consultationUnits: 0,
        reviewedUnits: 0,
      },
    ]);
  });
});
