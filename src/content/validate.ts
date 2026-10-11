import type { z } from 'zod';
import { pageCountsOf } from './refs.ts';
import {
  ActivityCatalogSchema,
  IssueSchema,
  KnowledgeUnitSchema,
  ManifestSchema,
  PageSchema,
  RouteSchema,
  RuleCatalogSchema,
  SignSchema,
} from './schemas.ts';
import type { Activity, Issue, KnowledgeUnit, Page, Route, RuleCatalog, Sign, Source } from './schemas.ts';
import { validateActivities } from './validateActivities.ts';
import { validateCatalog } from './validateCatalog.ts';
import { validateRoute } from './validateRoute.ts';
import { validateRules } from './validateRules.ts';

/** Parsed JSON files as read from disk or bundled by Vite, before any validation. */
export interface RawContent {
  manifest: unknown;
  pages: unknown;
  units: unknown;
  signs: unknown;
  issues: unknown;
  rules: unknown;
  route: unknown;
  activities: unknown;
}

export interface Content {
  manifest: Source[];
  pages: Page[];
  units: KnowledgeUnit[];
  signs: Sign[];
  issues: Issue[];
  rules: RuleCatalog;
  route: Route;
  activities: Activity[];
}

export type ContentResult = { ok: true; content: Content; version: string } | { ok: false; errors: string[] };

/** File names used in error messages, so a failure points at the file to fix. */
const FILES: Record<keyof RawContent, string> = {
  manifest: 'specs/fuentes/manifest.json',
  pages: 'specs/catalog/pages.json',
  units: 'specs/catalog/units.json',
  signs: 'specs/catalog/signs.json',
  issues: 'specs/catalog/issues.json',
  rules: 'specs/catalog/rules.json',
  route: 'specs/route/comuna13-a.json',
  activities: 'specs/catalog/activities.json',
};

function parse<T>(schema: z.ZodType<T>, value: unknown, file: string, errors: string[]): T | undefined {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    const path = issue.path.map((part) => (typeof part === 'number' ? `[${part}]` : `.${String(part)}`)).join('');
    errors.push(`${file}${path}: ${issue.message}`);
  }
  return undefined;
}

/** FNV-1a (32-bit) over the canonical JSON of every catalog: a cheap, deterministic content version. */
export function computeContentVersion(raw: RawContent): string {
  let hash = 0x811c9dc5;
  for (const key of Object.keys(FILES) as Array<keyof RawContent>) {
    const text = `${key}:${JSON.stringify(raw[key])}`;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

/** Validates structure first, then cross-record references; returns typed content only when everything holds. */
export function validateContent(raw: RawContent): ContentResult {
  const errors: string[] = [];
  const manifest = parse(ManifestSchema, raw.manifest, FILES.manifest, errors);
  const pages = parse(PageSchema.array(), raw.pages, FILES.pages, errors);
  const units = parse(KnowledgeUnitSchema.array(), raw.units, FILES.units, errors);
  const signs = parse(SignSchema.array(), raw.signs, FILES.signs, errors);
  const issues = parse(IssueSchema.array(), raw.issues, FILES.issues, errors);
  const rules = parse(RuleCatalogSchema, raw.rules, FILES.rules, errors);
  const route = parse(RouteSchema, raw.route, FILES.route, errors);
  const activities = parse(ActivityCatalogSchema, raw.activities, FILES.activities, errors);
  if (!manifest || !pages || !units || !signs || !issues || !rules || !route || !activities)
    return { ok: false, errors };

  const pageCounts = pageCountsOf(manifest);
  const protocolPages = pageCounts.get('protocolo') ?? 0;
  errors.push(
    ...validateCatalog({ manifest, pages, units, signs, issues }).map((error) => `catalog: ${error}`),
    ...validateRules(rules, protocolPages).map((error) => `rules: ${error}`),
    ...validateRoute(route, pageCounts).map((error) => `route: ${error}`),
    ...validateActivities(activities, {
      manifest,
      unitIds: new Set(units.map((unit) => unit.id)),
      signIds: new Set(signs.map((sign) => sign.id)),
    }).map((error) => `activities: ${error}`),
  );
  const protocol = manifest.find((source) => source.id === 'protocolo');
  if (protocol && rules.source.edition !== protocol.edition)
    errors.push(`rules: source edition ${rules.source.edition} does not match the manifest (${protocol.edition})`);
  if (protocol && rules.source.sha256 !== protocol.sha256)
    errors.push('rules: source sha256 does not match the manifest');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    content: { manifest, pages, units, signs, issues, rules, route, activities },
    version: computeContentVersion(raw),
  };
}
