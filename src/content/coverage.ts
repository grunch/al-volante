import type { AuditedSourceId, Category } from './schemas.ts';
import type { Content } from './validate.ts';

export interface SectionCoverage {
  source: AuditedSourceId;
  section: string;
  category: Category;
  pages: number;
  instructionalPages: number;
  units: number;
  figureBasedUnits: number;
  /** Units referenced by at least one reviewed activity. */
  unitsWithActivities: number;
  /** Units studied as reference material on purpose (`consultationReason`), not evaluated. */
  consultationUnits: number;
  /** Units already checked against the image of their page (status `reviewed` or later). */
  reviewedUnits: number;
}

const REVIEWED = new Set(['reviewed', 'implemented', 'tested']);

/** Content coverage per source section, in document order; traceable to pages, units and activities. */
export function computeCoverage({
  pages,
  units,
  activities,
}: Pick<Content, 'pages' | 'units' | 'activities'>): SectionCoverage[] {
  const practiced = new Set(
    activities.filter((activity) => activity.status === 'reviewed').flatMap((activity) => activity.unitIds),
  );
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
      consultationUnits: 0,
      reviewedUnits: 0,
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
    if (unit.consultationReason !== undefined) entry.consultationUnits += 1;
    if (REVIEWED.has(unit.status)) entry.reviewedUnits += 1;
  }
  return [...sections.values()];
}
