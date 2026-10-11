// Run with: node --test 'scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRules } from './check-rules.mjs';

const PROTOCOL_PAGES = 42;

function buildCatalog() {
  return {
    source: { id: 'protocolo' },
    scoring: { pointsBySeverity: { minor: 1, low: 2, high: 3, eliminatory: 8 }, passMaxPoints: 7, failMinPoints: 8 },
    rules: [
      {
        id: 'rule.minor.i-curb-scrape',
        severity: 'minor',
        points: 1,
        annexItem: 'i',
        fichaRows: [{ stage: 'II', group: 'Maniobrabilidad', text: 'Roza el cordón con la rueda', page: 15 }],
        condition: 'Roza el cordón.',
        repetition: 'per-occurrence',
        interrupts: false,
        escalation: null,
        refs: [{ source: 'protocolo', page: 23 }],
      },
      {
        id: 'rule.high.e-no-mirror-check-leaving-box',
        severity: 'high',
        points: 3,
        annexItem: 'e',
        fichaRows: [{ stage: 'II', group: 'Maniobrabilidad', text: 'No chequea los espejos', page: 15 }],
        condition: 'No chequea los espejos al salir.',
        repetition: 'single-check',
        interrupts: false,
        escalation: { condition: 'Interviene el doble comando.', severity: 'eliminatory', points: 8, interrupts: true },
        refs: [{ source: 'protocolo', page: 28 }],
      },
    ],
  };
}

test('accepts a consistent rule catalog', () => {
  // Arrange
  const catalog = buildCatalog();

  // Act
  const errors = validateRules(catalog, PROTOCOL_PAGES);

  // Assert
  assert.deepEqual(errors, []);
});

test('rejects points that do not match the severity and scoring thresholds other than 7/8', () => {
  const catalog = buildCatalog();
  catalog.rules[0].points = 2;
  catalog.scoring.passMaxPoints = 8;

  const errors = validateRules(catalog, PROTOCOL_PAGES);

  assert.ok(errors.includes('rule.minor.i-curb-scrape: points must be 1'));
  assert.ok(errors.includes('scoring must pass with <= 7 and fail with >= 8 points'));
});

test('rejects interruption on non-eliminatory faults and malformed escalations', () => {
  const catalog = buildCatalog();
  catalog.rules[0].interrupts = true;
  catalog.rules[1].escalation.interrupts = false;

  const errors = validateRules(catalog, PROTOCOL_PAGES);

  assert.ok(errors.includes('rule.minor.i-curb-scrape: only eliminatory faults can interrupt the exam'));
  assert.ok(errors.includes('rule.high.e-no-mirror-check-leaving-box: escalation must be an interrupting eliminatory fault with a condition'));
});

test('rejects duplicate annex items, unknown repetition policies and out-of-range pages', () => {
  const catalog = buildCatalog();
  catalog.rules.push({ ...catalog.rules[0], id: 'rule.minor.i-curb-scrape-copy', repetition: 'sometimes', refs: [{ source: 'protocolo', page: 43 }] });

  const errors = validateRules(catalog, PROTOCOL_PAGES);

  assert.ok(errors.includes('rule.minor.i-curb-scrape-copy: duplicate annex item minor.i'));
  assert.ok(errors.includes('rule.minor.i-curb-scrape-copy: invalid repetition "sometimes"'));
  assert.ok(errors.includes('rule.minor.i-curb-scrape-copy: invalid reference protocolo:43'));
});

test('rejects rules without scoring sheet rows or with an id that does not match the annex item', () => {
  const catalog = buildCatalog();
  catalog.rules[0].fichaRows = [];
  catalog.rules[1].annexItem = 'f';

  const errors = validateRules(catalog, PROTOCOL_PAGES);

  assert.ok(errors.includes('rule.minor.i-curb-scrape: must map to at least one scoring sheet row'));
  assert.ok(errors.includes('rule.high.e-no-mirror-check-leaving-box: id does not match severity/annex item'));
});
