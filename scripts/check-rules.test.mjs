// Run with: node --test 'scripts/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPECTED_ANNEX_ITEMS, classifyCurbDistance, validateParkingBands, validateRules } from './check-rules.mjs';

const PROTOCOL_PAGES = 42;

const BANDS = [
  { band: 'too-close', lt: 15, rule: 'rule.minor.t-parking-too-close-to-curb' },
  { band: 'correct', gte: 15, lte: 25, rule: null },
  { band: 'second-line', gt: 25, lte: 50, rule: 'rule.minor.u-parking-on-second-band' },
  { band: 'outside', gt: 50, rule: 'rule.eliminatory.r-parking-outside-second-band' },
];

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
  const errors = validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false });

  // Assert
  assert.deepEqual(errors, []);
});

test('rejects points that do not match the severity and scoring thresholds other than 7/8', () => {
  const catalog = buildCatalog();
  catalog.rules[0].points = 2;
  catalog.scoring.passMaxPoints = 8;

  const errors = validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false });

  assert.ok(errors.includes('rule.minor.i-curb-scrape: points must be 1'));
  assert.ok(errors.includes('scoring must pass with <= 7 and fail with >= 8 points'));
});

test('rejects interruption on non-eliminatory faults and malformed escalations', () => {
  const catalog = buildCatalog();
  catalog.rules[0].interrupts = true;
  catalog.rules[1].escalation.interrupts = false;

  const errors = validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false });

  assert.ok(errors.includes('rule.minor.i-curb-scrape: only eliminatory faults can interrupt the exam'));
  assert.ok(
    errors.includes(
      'rule.high.e-no-mirror-check-leaving-box: escalation must be an interrupting eliminatory fault with a condition',
    ),
  );
});

test('rejects duplicate annex items, unknown repetition policies and out-of-range pages', () => {
  const catalog = buildCatalog();
  catalog.rules.push({
    ...catalog.rules[0],
    id: 'rule.minor.i-curb-scrape-copy',
    repetition: 'sometimes',
    refs: [{ source: 'protocolo', page: 43 }],
  });

  const errors = validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false });

  assert.ok(errors.includes('rule.minor.i-curb-scrape-copy: duplicate annex item minor.i'));
  assert.ok(errors.includes('rule.minor.i-curb-scrape-copy: invalid repetition "sometimes"'));
  assert.ok(errors.includes('rule.minor.i-curb-scrape-copy: invalid reference protocolo:43'));
});

test('rejects rules without scoring sheet rows or with an id that does not match the annex item', () => {
  const catalog = buildCatalog();
  catalog.rules[0].fichaRows = [];
  catalog.rules[1].annexItem = 'f';

  const errors = validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false });

  assert.ok(errors.includes('rule.minor.i-curb-scrape: must map to at least one scoring sheet row'));
  assert.ok(errors.includes('rule.high.e-no-mirror-check-leaving-box: id does not match severity/annex item'));
});

test('requires every annex II item when the catalog claims to be complete', () => {
  // Arrange: a full catalog with one rule removed.
  const rules = Object.entries(EXPECTED_ANNEX_ITEMS).flatMap(([severity, letters]) =>
    [...letters].map((letter) => ({
      id: `rule.${severity}.${letter}-item`,
      severity,
      points: { minor: 1, low: 2, high: 3, eliminatory: 8 }[severity],
      annexItem: letter,
      fichaRows: [{ stage: 'II', group: 'G', text: 'T', page: 16 }],
      condition: 'C',
      repetition: 'once',
      interrupts: false,
      escalation: null,
      refs: [{ source: 'protocolo', page: 22 }],
    })),
  );
  const catalog = { ...buildCatalog(), rules: rules.filter((rule) => rule.id !== 'rule.minor.y-item') };

  // Act
  const errors = validateRules(catalog, PROTOCOL_PAGES);

  // Assert
  assert.equal(rules.length, 69);
  assert.deepEqual(errors, ['missing annex item minor.y']);
});

test('rejects an empty rule catalog that claims to be complete', () => {
  const catalog = { ...buildCatalog(), rules: [] };

  const errors = validateRules(catalog, PROTOCOL_PAGES);

  assert.ok(errors.includes('missing annex item eliminatory.r'));
  assert.equal(errors.length, 69);
});

test('classifies curb distances at every boundary, including exactly 50 cm', () => {
  const cases = [
    [14.9, 'too-close'],
    [15, 'correct'],
    [25, 'correct'],
    [25.1, 'second-line'],
    [50, 'second-line'],
    [50.1, 'outside'],
    [0, 'too-close'],
  ];

  for (const [cm, expected] of cases) {
    assert.equal(classifyCurbDistance(BANDS, cm).band, expected, `${cm} cm`);
  }
  assert.deepEqual(validateParkingBands(BANDS), []);
});

test('reports gaps and overlaps between curb distance bands', () => {
  const gap = BANDS.map((band) => (band.band === 'second-line' ? { ...band, lte: 49 } : band));
  const overlap = BANDS.map((band) => (band.band === 'correct' ? { ...band, lte: 26 } : band));

  assert.deepEqual(validateParkingBands(gap), ['parking bands leave a gap or overlap between second-line and outside']);
  assert.deepEqual(validateParkingBands(overlap), [
    'parking bands leave a gap or overlap between correct and second-line',
  ]);
});

test('rejects annex items outside the protocol set', () => {
  const catalog = buildCatalog();
  catalog.rules.push({ ...catalog.rules[0], id: 'rule.minor.z-extra', annexItem: 'z' });

  const errors = validateRules(catalog, PROTOCOL_PAGES, { requireFullAnnex: false });

  assert.ok(errors.includes('rule.minor.z-extra: unexpected annex item minor.z'));
});
