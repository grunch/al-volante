import { describe, expect, it } from 'vitest';
import { validateCatalog } from './validateCatalog.ts';
import { catalog, page, sign, unit } from './testing/fixtures.ts';

describe('validateCatalog', () => {
  it('accepts a complete and consistent catalog', () => {
    // Arrange
    const data = catalog();

    // Act
    const errors = validateCatalog(data);

    // Assert
    expect(errors).toEqual([]);
  });

  it('reports pages that are not classified, classified twice or outside the source', () => {
    const data = catalog();
    data.pages = data.pages.filter((p) => p.source !== 'siniestros');
    data.pages.push({ ...data.pages[0]! }, page({ source: 'manual', page: 3, kind: 'blank' }));

    const errors = validateCatalog(data);

    expect(errors).toContain('siniestros:1: page not classified');
    expect(errors).toContain('manual:1: page classified more than once');
    expect(errors).toContain('manual:3: page out of range 1..2');
  });

  it('reports orphan references in both directions and instructional pages without content', () => {
    const data = catalog();
    data.pages[0]!.units = ['manual.front.ghost-unit'];
    data.pages[1]!.units = [];

    const errors = validateCatalog(data);

    expect(errors).toContain('manual:1: lists unknown unit manual.front.ghost-unit');
    expect(errors).toContain('manual.ch3.roundabout-priority: page manual:2 does not list this unit');
    expect(errors).toContain('manual:2: instructional page without units or signs');
  });

  it('reports pages that list a unit which does not reference them back', () => {
    const data = catalog();
    data.pages[0]!.units = ['manual.ch3.roundabout-priority'];

    expect(validateCatalog(data)).toContain(
      'manual:1: lists unit manual.ch3.roundabout-priority, which does not reference this page',
    );
  });

  it('accepts an instructional page covered only by signs', () => {
    const data = catalog();
    data.pages[1]!.units = [];
    data.units = [];
    data.signs = [sign({ id: 'sign.regulatory.no-entry', page: 2 })];

    expect(validateCatalog(data)).toEqual([]);
  });

  it('reports duplicate unit ids and ids that do not match their source and section', () => {
    const data = catalog();
    data.units.push({ ...data.units[0]! }, unit({ id: 'manual.ch1.roundabout-priority' }));
    data.pages[1]!.units.push('manual.ch1.roundabout-priority');

    const errors = validateCatalog(data);

    expect(errors).toContain('manual.ch3.roundabout-priority: duplicate unit id');
    expect(errors).toContain('manual.ch1.roundabout-priority: id does not match source/section');
  });

  it('reports units whose section or category differ from the pages they reference', () => {
    const data = catalog();
    data.units[0] = unit({ id: 'manual.ch5.roundabout-priority', section: 'ch5', category: 'D' });
    data.pages[1]!.units = ['manual.ch5.roundabout-priority'];

    const errors = validateCatalog(data);

    expect(errors).toContain('manual.ch5.roundabout-priority: section "ch5" differs from page manual:2 ("ch3")');
    expect(errors).toContain('manual.ch5.roundabout-priority: category "D" differs from page manual:2 ("B")');
  });

  it('reports units referencing pages that are not classified and a missing audited source', () => {
    const data = catalog();
    data.units[0]!.pages = [2, 7];
    data.manifest = data.manifest.filter((s) => s.id !== 'siniestros');

    const errors = validateCatalog(data);

    expect(errors).toContain('manual.ch3.roundabout-priority: references unclassified page manual:7');
    expect(errors).toContain('manifest is missing audited source "siniestros"');
  });

  it('reports duplicate signs and signs on unknown pages', () => {
    const data = catalog();
    data.signs = [
      sign({ id: 'sign.regulatory.no-entry' }),
      sign({ id: 'sign.regulatory.no-entry' }),
      sign({ id: 'sign.regulatory.stop', page: 9 }),
    ];

    const errors = validateCatalog(data);

    expect(errors).toContain('sign.regulatory.no-entry: duplicate sign id');
    expect(errors).toContain('sign.regulatory.stop: references unclassified page manual:9');
  });

  it('reports issues on unclassified pages and accepts general issues without a page', () => {
    const data = catalog();
    data.issues = [
      { source: 'manual', page: 9, type: 'typo', description: 'x' },
      { source: 'manual', page: null, type: 'typo', description: 'general' },
    ];

    expect(validateCatalog(data)).toEqual(['issue 0: page manual:9 is not classified']);
  });
});
