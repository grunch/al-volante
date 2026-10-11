import { describe, expect, it } from 'vitest';
import { computeContentVersion, validateContent } from './validate.ts';
import type { RawContent } from './validate.ts';
import { loadContent } from './catalog.ts';
import { computeCoverage } from './coverage.ts';
import { catalog, choiceActivity, route, ruleCatalog } from './testing/fixtures.ts';

function rawFixture(): RawContent {
  const data = catalog();
  return { ...data, rules: ruleCatalog([]), route: route(), activities: [choiceActivity()] };
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
