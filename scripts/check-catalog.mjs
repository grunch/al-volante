#!/usr/bin/env node
// Validates the phase 1 content catalog in specs/catalog against the source manifest.
// Usage: node scripts/check-catalog.mjs [catalogDir]
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUDITED_SOURCES = ['manual', 'siniestros'];
export const CATEGORIES = ['B', 'common', 'D', 'C-E', 'guide'];
export const PAGE_KINDS = ['instructional', 'chapter-cover', 'closing-quote', 'toc', 'cover', 'credits', 'blank', 'other'];
export const UNIT_TYPES = ['definition', 'rule', 'procedure', 'fact', 'recommendation', 'concept', 'table', 'contact', 'sign-group'];
export const STATUSES = ['pendiente', 'transcrita', 'revisada', 'implementada', 'probada'];
export const ISSUE_TYPES = ['discrepancy', 'illegible', 'typo', 'outdated', 'ambiguous', 'extraction'];
const UNIT_ID = /^(manual|siniestros)\.[a-z0-9]+\.[a-z0-9]+(-[a-z0-9]+)*$/;
const SIGN_ID = /^sign\.[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

/**
 * Returns a list of human-readable errors; an empty list means the catalog is valid.
 * @param {{ manifest: Array<{id: string, pages: number}>, pages: object[], units: object[], signs: object[], issues?: object[] }} catalog
 */
export function validateCatalog({ manifest, pages, units, signs, issues = [] }) {
  const errors = [];
  const pageCounts = new Map(manifest.map((source) => [source.id, source.pages]));
  const pageIndex = new Map();
  const signPages = new Set(signs.map((sign) => sign.page));

  for (const sourceId of AUDITED_SOURCES) {
    if (!pageCounts.has(sourceId)) errors.push(`manifest is missing audited source "${sourceId}"`);
  }

  for (const page of pages) {
    const key = `${page.source}:${page.page}`;
    const total = pageCounts.get(page.source);
    if (!AUDITED_SOURCES.includes(page.source)) errors.push(`${key}: unknown source`);
    else if (!Number.isInteger(page.page) || page.page < 1 || page.page > total) errors.push(`${key}: page out of range 1..${total}`);
    if (pageIndex.has(key)) errors.push(`${key}: page classified more than once`);
    pageIndex.set(key, page);
    if (!CATEGORIES.includes(page.category)) errors.push(`${key}: invalid category "${page.category}"`);
    if (!PAGE_KINDS.includes(page.kind)) errors.push(`${key}: invalid kind "${page.kind}"`);
    if (!page.summary) errors.push(`${key}: missing summary`);
    if (!Array.isArray(page.units)) {
      errors.push(`${key}: units must be an array`);
      continue;
    }
    const hasSigns = page.source === 'manual' && signPages.has(page.page);
    if (page.kind === 'instructional' && page.units.length === 0 && !hasSigns) {
      errors.push(`${key}: instructional page without units or signs`);
    }
  }

  for (const sourceId of AUDITED_SOURCES) {
    for (let n = 1; n <= (pageCounts.get(sourceId) ?? 0); n += 1) {
      if (!pageIndex.has(`${sourceId}:${n}`)) errors.push(`${sourceId}:${n}: page not classified`);
    }
  }

  const unitIds = new Set();
  const unitById = new Map();
  for (const unit of units) {
    if (unit.id !== undefined && typeof unit.id !== 'string') {
      errors.push(`${unit.id}: unit id must be a string`);
      continue;
    }
    const id = unit.id ?? '<missing id>';
    unitById.set(id, unit);
    if (!UNIT_ID.test(id)) errors.push(`${id}: invalid unit id`);
    if (unitIds.has(id)) errors.push(`${id}: duplicate unit id`);
    unitIds.add(id);
    if (!id.startsWith(`${unit.source}.${unit.section}.`)) errors.push(`${id}: id does not match source/section`);
    if (!CATEGORIES.includes(unit.category)) errors.push(`${id}: invalid category "${unit.category}"`);
    if (!UNIT_TYPES.includes(unit.type)) errors.push(`${id}: invalid type "${unit.type}"`);
    if (!STATUSES.includes(unit.status)) errors.push(`${id}: invalid status "${unit.status}"`);
    if (!unit.title || !unit.summary) errors.push(`${id}: missing title or summary`);
    if (!Array.isArray(unit.pages) || unit.pages.length === 0) {
      errors.push(`${id}: must reference at least one page`);
      continue;
    }
    for (const n of unit.pages) {
      const page = pageIndex.get(`${unit.source}:${n}`);
      if (!page) {
        errors.push(`${id}: references unclassified page ${unit.source}:${n}`);
        continue;
      }
      if (!page.units?.includes(id)) errors.push(`${id}: page ${unit.source}:${n} does not list this unit`);
      // Keeps the B/complementary split honest: a unit inherits section and category from its pages.
      if (page.section !== unit.section) errors.push(`${id}: section "${unit.section}" differs from page ${unit.source}:${n} ("${page.section}")`);
      if (page.category !== unit.category) errors.push(`${id}: category "${unit.category}" differs from page ${unit.source}:${n} ("${page.category}")`);
    }
  }

  for (const page of pages) {
    if (!Array.isArray(page.units)) continue;
    const key = `${page.source}:${page.page}`;
    for (const id of page.units) {
      const unit = unitById.get(id);
      if (!unitIds.has(id)) errors.push(`${key}: lists unknown unit ${id}`);
      else if (unit.source !== page.source || !unit.pages?.includes(page.page)) errors.push(`${key}: lists unit ${id}, which does not reference this page`);
    }
  }

  issues.forEach((issue, index) => {
    const label = `issue ${index}`;
    if (!AUDITED_SOURCES.includes(issue.source)) errors.push(`${label}: unknown source "${issue.source}"`);
    else if (issue.page !== null && issue.page !== undefined && !pageIndex.has(`${issue.source}:${issue.page}`)) errors.push(`${label}: page ${issue.source}:${issue.page} is not classified`);
    if (!ISSUE_TYPES.includes(issue.type)) errors.push(`${label}: invalid type "${issue.type}"`);
    if (typeof issue.description !== 'string' || issue.description.trim() === '') errors.push(`${label}: missing description`);
  });

  const signIds = new Set();
  for (const sign of signs) {
    const id = sign.id ?? '<missing id>';
    if (!SIGN_ID.test(id)) errors.push(`${id}: invalid sign id`);
    if (signIds.has(id)) errors.push(`${id}: duplicate sign id`);
    signIds.add(id);
    if (!pageIndex.has(`manual:${sign.page}`)) errors.push(`${id}: references unclassified page manual:${sign.page}`);
    if (!sign.name || !sign.group || !sign.visual) errors.push(`${id}: missing name, group or visual`);
    if (!STATUSES.includes(sign.status)) errors.push(`${id}: invalid status "${sign.status}"`);
  }

  return errors;
}

/** Reads and parses a UTF-8 JSON file. */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** CLI entry point: validates the catalog directory and exits with code 1 on errors. */
function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const catalogDir = resolve(process.argv[2] ?? join(root, 'specs/catalog'));
  const catalog = {
    manifest: readJson(join(root, 'specs/fuentes/manifest.json')),
    pages: readJson(join(catalogDir, 'pages.json')),
    units: readJson(join(catalogDir, 'units.json')),
    signs: readJson(join(catalogDir, 'signs.json')),
    issues: readJson(join(catalogDir, 'issues.json')),
  };
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    console.error(`Catalog has ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Catalog OK: ${catalog.pages.length} pages, ${catalog.units.length} units, ${catalog.signs.length} signs, ${catalog.issues.length} issues.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
