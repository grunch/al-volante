import { validateContent } from './validate.ts';
import type { ContentResult } from './validate.ts';

/**
 * Loads every catalog lazily (its own chunks, so the shell renders first) and validates it at the boundary.
 * Bundled data is also validated in CI; checking again here keeps a broken build from rendering wrong content.
 */
export async function loadContent(): Promise<ContentResult> {
  const [manifest, pages, units, signs, issues, rules, route, activities] = await Promise.all([
    import('../../specs/fuentes/manifest.json'),
    import('../../specs/catalog/pages.json'),
    import('../../specs/catalog/units.json'),
    import('../../specs/catalog/signs.json'),
    import('../../specs/catalog/issues.json'),
    import('../../specs/catalog/rules.json'),
    import('../../specs/route/comuna13-a.json'),
    import('../../specs/catalog/activities.json'),
  ]);
  return validateContent({
    manifest: manifest.default,
    pages: pages.default,
    units: units.default,
    signs: signs.default,
    issues: issues.default,
    rules: rules.default,
    route: route.default,
    activities: activities.default,
  });
}
