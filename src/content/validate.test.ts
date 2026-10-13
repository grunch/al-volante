import { describe, expect, it } from 'vitest';
import routeGeoJson from '../../specs/route/comuna13-a.geojson?raw';
import { VERIFICATION_STATUSES } from './schemas.ts';
import { computeContentVersion, validateContent } from './validate.ts';
import type { RawContent } from './validate.ts';
import { loadContent } from './catalog.ts';
import { auditCoverage, auditGaps, computeCoverage } from './coverage.ts';
import { catalog, choiceActivity, route, ruleCatalog, source, theoryExamConfig } from './testing/fixtures.ts';

function rawFixture(): RawContent {
  const data = catalog();
  return {
    ...data,
    // The activity practices the only unit, so the unit is tested (validateTreatment).
    units: data.units.map((unit) => ({ ...unit, status: 'tested' })),
    rules: ruleCatalog([]),
    route: route(),
    figures: [],
    theoryExam: theoryExamConfig(),
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

  it('prefixes the errors of every cross-reference check with the catalog that has to change', () => {
    // Arrange: one problem per catalog.
    const raw = rawFixture();
    raw.units = catalog().units; // practised by the activity, but only transcribed
    raw.issues = [{ source: 'manual', page: 99, type: 'typo', description: 'Errata' }];
    raw.figures = [
      {
        id: 'fig.manual-p2-ghost',
        source: 'manual',
        page: 2,
        box: { x: 0, y: 0, width: 1, height: 1 },
        alt: 'Figura',
        unitIds: ['manual.ch3.ghost'],
      },
    ];
    raw.theoryExam = theoryExamConfig({ sections: ['manual-ch9'] });
    raw.activities = {
      'manual-ch3': [choiceActivity({ unitIds: ['manual.ch3.roundabout-priority', 'manual.ch3.ghost'] })],
    };

    // Act
    const result = validateContent(raw);

    // Assert
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        'catalog: issue 0: page manual:99 is not classified',
        'activities: act.speed-street: unknown unit manual.ch3.ghost',
        'figures: fig.manual-p2-ghost: unknown unit manual.ch3.ghost',
        'treatment: manual.ch3.roundabout-priority: covered by an activity but its status is transcribed',
        'theory exam: unknown section manual-ch9',
      ]),
    );
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
    const raw = { ...rawFixture(), manifest: catalog().manifest.filter((source) => source.id !== 'recorridos') };

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
    // F05-T04 classifies the 42 pages of the protocol and the 19 of the circuits, with 48 new units.
    expect(content.pages).toHaveLength(285);
    expect(content.units).toHaveLength(753);
    expect(content.signs).toHaveLength(355);
    // 206 observations from F01-T02, plus those found in phase 5: 8 (F05-T01), 12 (T02), 3 (T03) and 14 (T04).
    expect(content.issues).toHaveLength(243);
    expect(content.rules.rules).toHaveLength(69);
    expect(content.route.legs).toHaveLength(8);
    expect(content.manifest.map((source) => source.id)).toEqual(['manual', 'protocolo', 'recorridos', 'siniestros']);
  });
});

describe('global coverage audit (integration)', () => {
  it('treats every unit and sign (by activity or as consultation), crops every sign and classifies every page', async () => {
    const result = await loadContent();

    if (!result.ok) throw new Error(result.errors.join('\n'));
    const audit = auditCoverage(result.content);
    expect(audit.units.untreated).toEqual([]);
    expect(audit.signs.untreated).toEqual([]);
    expect(audit.signs.withoutCrop).toEqual([]);
    expect(audit.unclassifiedPages).toEqual([]);
  });
});

describe('auditCoverage', () => {
  it('lists untreated units and signs, signs without a crop and unclassified pages', () => {
    const data = catalog();
    const audit = auditCoverage({
      manifest: [source('manual', 3), source('siniestros', 1)],
      pages: data.pages,
      units: [...data.units, { ...data.units[0]!, id: 'manual.ch3.done', status: 'tested' }],
      signs: [
        {
          id: 'sign.x.a',
          page: 2,
          group: 'G',
          name: 'A',
          meaning: '',
          visual: 'v',
          printedCode: null,
          status: 'tested',
          notes: '',
          box: { x: 0, y: 0, width: 0.1, height: 0.1 },
        },
        {
          id: 'sign.x.b',
          page: 2,
          group: 'G',
          name: 'B',
          meaning: '',
          visual: 'v',
          printedCode: null,
          status: 'transcribed',
          notes: '',
        },
      ],
    });

    expect(audit.units).toEqual({
      total: 2,
      practiced: 1,
      consultation: 0,
      untreated: ['manual.ch3.roundabout-priority'],
    });
    expect(audit.signs).toMatchObject({ total: 2, practiced: 1, untreated: ['sign.x.b'], withoutCrop: ['sign.x.b'] });
    expect(audit.unclassifiedPages).toEqual([{ source: 'manual', page: 3 }]);
  });
});

describe('auditCoverage of a source without classified pages', () => {
  it('reports every page of an audited source in the manifest that has no page records', () => {
    const data = catalog();
    const pages = data.pages.filter((page) => page.source !== 'recorridos');

    const audit = auditCoverage({ manifest: data.manifest, pages, units: data.units, signs: [] });

    expect(audit.unclassifiedPages).toHaveLength(19);
    expect(audit.unclassifiedPages[0]).toEqual({ source: 'recorridos', page: 1 });
  });
});

describe('auditGaps', () => {
  it('describes each gap of an audit, and nothing when coverage is complete', () => {
    const complete = {
      units: { total: 1, practiced: 1, consultation: 0, untreated: [] },
      signs: { total: 1, practiced: 1, consultation: 0, untreated: [], withoutCrop: [] },
      unclassifiedPages: [],
    };

    expect(auditGaps(complete)).toEqual([]);
    expect(
      auditGaps({
        units: { ...complete.units, untreated: ['manual.ch3.a'] },
        signs: { ...complete.signs, untreated: ['sign.x.b'], withoutCrop: ['sign.x.b'] },
        unclassifiedPages: [{ source: 'manual', page: 3 }],
      }),
    ).toEqual([
      'untreated units: manual.ch3.a',
      'untreated signs: sign.x.b',
      'signs without a crop: sign.x.b',
      'unclassified pages: manual:3',
    ]);
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

  it('counts figure-based units and leaves out units of a section with no classified page', () => {
    const data = catalog();
    const units = [
      { ...data.units[0]!, figureBased: true },
      { ...data.units[0]!, id: 'manual.ch9.orphan', section: 'ch9' },
    ];

    const rows = computeCoverage({ pages: data.pages, units, activities: [] });

    expect(rows.find((row) => row.section === 'ch3')).toMatchObject({ units: 1, figureBasedUnits: 1 });
    expect(rows.some((row) => row.section === 'ch9')).toBe(false);
  });

  it('counts pages, units and units with activities per section', () => {
    const data = catalog();
    const pages = data.pages.filter((page) => page.category !== 'exam');

    const rows = computeCoverage({ pages, units: data.units, activities: [choiceActivity()] });

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
