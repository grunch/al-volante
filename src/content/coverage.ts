import type { Category } from './schemas.ts';
import type { Content } from './validate.ts';

export interface SectionCoverage {
  source: 'manual' | 'siniestros';
  section: string;
  category: Category;
  pages: number;
  instructionalPages: number;
  units: number;
  figureBasedUnits: number;
  /** Units referenced by at least one activity; the rest only have reading material for now. */
  unitsWithActivities: number;
}

/** Content coverage per source section, in document order; traceable to pages, units and activities. */
export function computeCoverage({
  pages,
  units,
  activities,
}: Pick<Content, 'pages' | 'units' | 'activities'>): SectionCoverage[] {
  const practiced = new Set(activities.flatMap((activity) => activity.unitIds));
  const sections = new Map<string, SectionCoverage>();
  for (const page of pages) {
    const key = `${page.source}:${page.section}`;
    const entry = sections.get(key) ?? {
      source: page.source,
      section: page.section,
      category: page.category,
      pages: 0,
      instructionalPages: 0,
      units: 0,
      figureBasedUnits: 0,
      unitsWithActivities: 0,
    };
    entry.pages += 1;
    if (page.kind === 'instructional') entry.instructionalPages += 1;
    sections.set(key, entry);
  }
  for (const unit of units) {
    const entry = sections.get(`${unit.source}:${unit.section}`);
    if (!entry) continue;
    entry.units += 1;
    if (unit.figureBased) entry.figureBasedUnits += 1;
    if (practiced.has(unit.id)) entry.unitsWithActivities += 1;
  }
  return [...sections.values()];
}
