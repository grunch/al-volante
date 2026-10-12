import { activityKeyOf } from './activityFiles.ts';
import { validateContent } from './validate.ts';
import type { ContentResult } from './validate.ts';

// One chunk per activity file (one per source section), loaded in parallel with the other catalogs.
const activityModules = import.meta.glob<{ default: unknown }>('../../specs/catalog/activities/*.json');

async function loadActivityFiles(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(activityModules).map(async ([path, load]) => [activityKeyOf(path), (await load()).default] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Loads every catalog lazily (its own chunks, so the shell renders first) and validates it at the boundary.
 * Bundled data is also validated in CI; checking again here keeps a broken build from rendering wrong content.
 */
export async function loadContent(): Promise<ContentResult> {
  const [manifest, pages, units, signs, issues, rules, route, figures, activities] = await Promise.all([
    import('../../specs/fuentes/manifest.json'),
    import('../../specs/catalog/pages.json'),
    import('../../specs/catalog/units.json'),
    import('../../specs/catalog/signs.json'),
    import('../../specs/catalog/issues.json'),
    import('../../specs/catalog/rules.json'),
    import('../../specs/route/comuna13-a.json'),
    import('../../specs/catalog/figures.json'),
    loadActivityFiles(),
  ]);
  return validateContent({
    manifest: manifest.default,
    pages: pages.default,
    units: units.default,
    signs: signs.default,
    issues: issues.default,
    rules: rules.default,
    route: route.default,
    figures: figures.default,
    activities,
  });
}
