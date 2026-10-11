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
    { source: 'manual', page: 1, category: 'common', kind: 'cover', summary: 'Tapa', units: [] },
    { source: 'manual', page: 2, category: 'B', kind: 'instructional', summary: 'Rotonda', units: ['manual.ch3.roundabout-priority'] },
    { source: 'siniestros', page: 1, category: 'guide', kind: 'cover', summary: 'Tapa', units: [] },
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
    { id: 'sign.regulatory.no-entry', page: 2, group: 'Reglamentarias', name: 'Contramano', visual: 'Círculo rojo', status: 'transcrita' },
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
