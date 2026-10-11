// Run with: node --test 'scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from './check-catalog.mjs';

function buildCatalog() {
  const manifest = [
    { id: 'manual', pages: 2 },
    { id: 'siniestros', pages: 1 },
  ];
  const pages = [
    { source: 'manual', page: 1, section: 'front', category: 'common', kind: 'cover', summary: 'Tapa', units: [] },
    {
      source: 'manual',
      page: 2,
      section: 'ch3',
      category: 'B',
      kind: 'instructional',
      summary: 'Rotonda',
      units: ['manual.ch3.roundabout-priority'],
    },
    { source: 'siniestros', page: 1, section: 'front', category: 'guide', kind: 'cover', summary: 'Tapa', units: [] },
  ];
  const units = [
    {
      id: 'manual.ch3.roundabout-priority',
      source: 'manual',
      section: 'ch3',
      pages: [2],
      title: 'Rotonda',
      category: 'B',
      type: 'rule',
      summary: 'Prioridad en rotonda.',
      status: 'transcrita',
    },
  ];
  const signs = [];
  return { manifest, pages, units, signs };
}

test('accepts a complete and consistent catalog', () => {
  // Arrange
  const catalog = buildCatalog();

  // Act
  const errors = validateCatalog(catalog);

  // Assert
  assert.deepEqual(errors, []);
});

test('reports pages that are not classified', () => {
  const catalog = buildCatalog();
  catalog.pages = catalog.pages.filter((page) => !(page.source === 'siniestros' && page.page === 1));

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('siniestros:1: page not classified'));
});

test('reports pages classified twice and pages outside the source range', () => {
  const catalog = buildCatalog();
  catalog.pages.push({ ...catalog.pages[0] });
  catalog.pages.push({ source: 'manual', page: 3, category: 'B', kind: 'blank', summary: 'x', units: [] });

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('manual:1: page classified more than once'));
  assert.ok(errors.includes('manual:3: page out of range 1..2'));
});

test('reports orphan references in both directions', () => {
  const catalog = buildCatalog();
  catalog.pages[0].units = ['manual.front.ghost-unit'];
  catalog.pages[1].units = [];

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('manual:1: lists unknown unit manual.front.ghost-unit'));
  assert.ok(errors.includes('manual.ch3.roundabout-priority: page manual:2 does not list this unit'));
  assert.ok(errors.includes('manual:2: instructional page without units or signs'));
});

test('accepts an instructional page covered only by signs', () => {
  const catalog = buildCatalog();
  catalog.pages[1].units = [];
  catalog.units = [];
  catalog.signs = [
    {
      id: 'sign.regulatory.no-entry',
      page: 2,
      group: 'Reglamentarias',
      name: 'Contramano',
      visual: 'Círculo rojo',
      status: 'transcrita',
    },
  ];

  const errors = validateCatalog(catalog);

  assert.deepEqual(errors, []);
});

test('reports duplicate ids, invalid enums and ids that do not match their section', () => {
  const catalog = buildCatalog();
  catalog.units.push({ ...catalog.units[0], type: 'trivia', status: 'done' });
  catalog.units.push({ ...catalog.units[0], id: 'manual.ch1.roundabout-priority', type: 'rule' });
  catalog.pages[1].units.push('manual.ch1.roundabout-priority');

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('manual.ch3.roundabout-priority: duplicate unit id'));
  assert.ok(errors.includes('manual.ch3.roundabout-priority: invalid type "trivia"'));
  assert.ok(errors.includes('manual.ch3.roundabout-priority: invalid status "done"'));
  assert.ok(errors.includes('manual.ch1.roundabout-priority: id does not match source/section'));
});

test('reports invalid and duplicate sign ids and signs on unknown pages', () => {
  const catalog = buildCatalog();
  const sign = { id: 'sign.regulatory.no-entry', page: 2, group: 'G', name: 'N', visual: 'V', status: 'transcrita' };
  catalog.signs = [sign, { ...sign }, { ...sign, id: 'Señal', page: 9 }];

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('sign.regulatory.no-entry: duplicate sign id'));
  assert.ok(errors.includes('Señal: invalid sign id'));
  assert.ok(errors.includes('Señal: references unclassified page manual:9'));
});

test('reports units whose section or category differ from the pages they reference', () => {
  const catalog = buildCatalog();
  catalog.units[0] = { ...catalog.units[0], id: 'manual.ch5.roundabout-priority', section: 'ch5', category: 'D' };
  catalog.pages[1].units = ['manual.ch5.roundabout-priority'];

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('manual.ch5.roundabout-priority: section "ch5" differs from page manual:2 ("ch3")'));
  assert.ok(errors.includes('manual.ch5.roundabout-priority: category "D" differs from page manual:2 ("B")'));
});

test('reports pages that list a unit which does not reference them back', () => {
  const catalog = buildCatalog();
  catalog.pages[0].units = ['manual.ch3.roundabout-priority'];

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('manual:1: lists unit manual.ch3.roundabout-priority, which does not reference this page'));
});

test('reports wrongly typed values instead of throwing', () => {
  const catalog = buildCatalog();
  catalog.units.push({ ...catalog.units[0], id: 42 });
  catalog.pages[2].units = 7;

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('42: unit id must be a string'));
  assert.ok(errors.includes('siniestros:1: units must be an array'));
});

test('validates source issues: source, page range, type and description', () => {
  const catalog = buildCatalog();
  catalog.issues = [
    { source: 'manual', page: 2, type: 'discrepancy', description: 'ok' },
    { source: 'manual', page: 9, type: 'discrepancy', description: 'x' },
    { source: 'otro', page: 1, type: 'typo', description: 'x' },
    { source: 'siniestros', page: 1, type: 'rumor', description: '' },
  ];

  const errors = validateCatalog(catalog);

  assert.ok(errors.includes('issue 1: page manual:9 is not classified'));
  assert.ok(errors.includes('issue 2: unknown source "otro"'));
  assert.ok(errors.includes('issue 3: invalid type "rumor"'));
  assert.ok(errors.includes('issue 3: missing description'));
  assert.equal(errors.length, 4);
});
