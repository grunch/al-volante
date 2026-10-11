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
const UNIT_ID = /^(manual|siniestros)\.[a-z0-9]+\.[a-z0-9]+(-[a-z0-9]+)*$/;
const SIGN_ID = /^sign\.[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

/**
 * Returns a list of human-readable errors; an empty list means the catalog is valid.
 * @param {{ manifest: Array<{id: string, pages: number}>, pages: object[], units: object[], signs: object[] }} catalog
 */
export function validateCatalog({ manifest, pages, units, signs }) {
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
  for (const unit of units) {
    const id = unit.id ?? '<missing id>';
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
    for (const id of page.units ?? []) {
      if (!unitIds.has(id)) errors.push(`${page.source}:${page.page}: lists unknown unit ${id}`);
    }
  }

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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const catalogDir = resolve(process.argv[2] ?? join(root, 'specs/catalog'));
  const catalog = {
    manifest: readJson(join(root, 'specs/fuentes/manifest.json')),
    pages: readJson(join(catalogDir, 'pages.json')),
    units: readJson(join(catalogDir, 'units.json')),
    signs: readJson(join(catalogDir, 'signs.json')),
  };
  const errors = validateCatalog(catalog);
  if (errors.length > 0) {
    console.error(`Catalog has ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Catalog OK: ${catalog.pages.length} pages, ${catalog.units.length} units, ${catalog.signs.length} signs.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
