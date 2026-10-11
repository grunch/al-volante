// Validates every content catalog (structure + cross-references) and prints a coverage summary.
// Usage: node scripts/validate-content.ts   (Node ≥ 24 runs TypeScript natively by stripping types)
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeCoverage } from '../src/content/coverage.ts';
import { validateContent } from '../src/content/validate.ts';
import type { RawContent } from '../src/content/validate.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string): unknown => JSON.parse(readFileSync(join(root, path), 'utf8'));

const raw: RawContent = {
  manifest: read('specs/fuentes/manifest.json'),
  pages: read('specs/catalog/pages.json'),
  units: read('specs/catalog/units.json'),
  signs: read('specs/catalog/signs.json'),
  issues: read('specs/catalog/issues.json'),
  rules: read('specs/catalog/rules.json'),
  route: read('specs/route/comuna13-a.json'),
  activities: read('specs/catalog/activities.json'),
};

const result = validateContent(raw);
if (!result.ok) {
  console.error(`Content has ${result.errors.length} error(s):`);
  for (const error of result.errors) console.error(`- ${error}`);
  process.exit(1);
}

const { content, version } = result;
console.log(
  `Content OK (version ${version}): ${content.pages.length} pages, ${content.units.length} units, ${content.signs.length} signs, ` +
    `${content.issues.length} issues, ${content.rules.rules.length} rules, ${content.route.legs.length} route legs, ` +
    `${content.activities.length} activities.`,
);
for (const row of computeCoverage(content)) {
  console.log(
    `  ${row.source}/${row.section} [${row.category}]: ${row.units} units, ${row.unitsWithActivities} with activities`,
  );
}
