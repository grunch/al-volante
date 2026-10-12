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

export interface CoverageAudit {
  units: { total: number; practiced: number; consultation: number; untreated: string[] };
  signs: { total: number; practiced: number; consultation: number; untreated: string[]; withoutCrop: string[] };
  /** Physical pages of each audited source with no classification in pages.json. */
  unclassifiedPages: Array<{ source: string; page: number }>;
}

const TREATED = new Set(['implemented', 'tested']);

/**
 * The global audit of phase 5 (F05-T05): every unit and sign treated (by activity or as consultation), every sign
 * cropped and every page of the audited sources classified. Empty gaps mean full coverage.
 */
export function auditCoverage({
  manifest,
  pages,
  units,
  signs,
}: Pick<Content, 'manifest' | 'pages' | 'units' | 'signs'>): CoverageAudit {
  const consulted = <T extends { consultationReason?: string | undefined }>(items: readonly T[]) =>
    items.filter((item) => item.consultationReason !== undefined).length;
  const classified = new Set(pages.map((page) => `${page.source}:${page.page}`));
  const audited = new Set(pages.map((page) => page.source));
  return {
    units: {
      total: units.length,
      practiced: units.filter((unit) => unit.status === 'tested').length,
      consultation: consulted(units),
      untreated: units.filter((unit) => !TREATED.has(unit.status)).map((unit) => unit.id),
    },
    signs: {
      total: signs.length,
      practiced: signs.filter((sign) => sign.status === 'tested').length,
      consultation: consulted(signs),
      untreated: signs.filter((sign) => !TREATED.has(sign.status)).map((sign) => sign.id),
      withoutCrop: signs.filter((sign) => sign.box === undefined).map((sign) => sign.id),
    },
    unclassifiedPages: manifest
      .filter((source) => audited.has(source.id))
      .flatMap((source) =>
        Array.from({ length: source.pages }, (_, index) => ({ source: source.id, page: index + 1 })).filter(
          ({ page }) => !classified.has(`${source.id}:${page}`),
        ),
      ),
  };
}
