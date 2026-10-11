import { AUDITED_SOURCE_IDS } from './schemas.ts';
import type { Issue, KnowledgeUnit, Page, Sign, Source } from './schemas.ts';

export interface CatalogData {
  manifest: readonly Source[];
  pages: readonly Page[];
  units: readonly KnowledgeUnit[];
  signs: readonly Sign[];
  issues: readonly Issue[];
}

/**
 * Cross-record checks for the phase 1 catalog (COBERTURA.md): every audited page classified exactly once,
 * bidirectional page ↔ unit references, section/category inheritance, unique ids and valid issue pages.
 */
export function validateCatalog({ manifest, pages, units, signs, issues }: CatalogData): string[] {
  const errors: string[] = [];
  const pageCounts = new Map(manifest.map((source) => [source.id, source.pages]));
  const pageIndex = new Map<string, Page>();
  const signPages = new Set(signs.map((sign) => sign.page));

  for (const sourceId of AUDITED_SOURCE_IDS) {
    if (!pageCounts.has(sourceId)) errors.push(`manifest is missing audited source "${sourceId}"`);
  }

  for (const page of pages) {
    const key = `${page.source}:${page.page}`;
    const total = pageCounts.get(page.source) ?? 0;
    if (page.page > total) errors.push(`${key}: page out of range 1..${total}`);
    if (pageIndex.has(key)) errors.push(`${key}: page classified more than once`);
    pageIndex.set(key, page);
    const hasSigns = page.source === 'manual' && signPages.has(page.page);
    if (page.kind === 'instructional' && page.units.length === 0 && !hasSigns) {
      errors.push(`${key}: instructional page without units or signs`);
    }
  }

  for (const sourceId of AUDITED_SOURCE_IDS) {
    for (let n = 1; n <= (pageCounts.get(sourceId) ?? 0); n += 1) {
      if (!pageIndex.has(`${sourceId}:${n}`)) errors.push(`${sourceId}:${n}: page not classified`);
    }
  }

  const unitById = new Map<string, KnowledgeUnit>();
  for (const unit of units) {
    const { id } = unit;
    if (unitById.has(id)) errors.push(`${id}: duplicate unit id`);
    unitById.set(id, unit);
    if (!id.startsWith(`${unit.source}.${unit.section}.`)) errors.push(`${id}: id does not match source/section`);
    for (const n of unit.pages) {
      const page = pageIndex.get(`${unit.source}:${n}`);
      if (!page) {
        errors.push(`${id}: references unclassified page ${unit.source}:${n}`);
        continue;
      }
      if (!page.units.includes(id)) errors.push(`${id}: page ${unit.source}:${n} does not list this unit`);
      // Keeps the B/complementary split honest: a unit inherits section and category from its pages.
      if (page.section !== unit.section)
        errors.push(`${id}: section "${unit.section}" differs from page ${unit.source}:${n} ("${page.section}")`);
      if (page.category !== unit.category)
        errors.push(`${id}: category "${unit.category}" differs from page ${unit.source}:${n} ("${page.category}")`);
    }
  }

  for (const page of pages) {
    const key = `${page.source}:${page.page}`;
    for (const id of page.units) {
      const unit = unitById.get(id);
      if (!unit) errors.push(`${key}: lists unknown unit ${id}`);
      else if (unit.source !== page.source || !unit.pages.includes(page.page)) {
        errors.push(`${key}: lists unit ${id}, which does not reference this page`);
      }
    }
  }

  const signIds = new Set<string>();
  for (const sign of signs) {
    if (signIds.has(sign.id)) errors.push(`${sign.id}: duplicate sign id`);
    signIds.add(sign.id);
    if (!pageIndex.has(`manual:${sign.page}`))
      errors.push(`${sign.id}: references unclassified page manual:${sign.page}`);
  }

  issues.forEach((issue, index) => {
    if (issue.page !== null && !pageIndex.has(`${issue.source}:${issue.page}`)) {
      errors.push(`issue ${index}: page ${issue.source}:${issue.page} is not classified`);
    }
  });

  return errors;
}
