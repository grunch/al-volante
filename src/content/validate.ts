import type { z } from 'zod';
import { pageCountsOf } from './refs.ts';
import {
  ActivityCatalogSchema,
  FigureCatalogSchema,
  IssueSchema,
  KnowledgeUnitSchema,
  ManifestSchema,
  PageSchema,
  RouteSchema,
  RuleCatalogSchema,
  SignSchema,
} from './schemas.ts';
import type { Activity, Figure, Issue, KnowledgeUnit, Page, Route, RuleCatalog, Sign, Source } from './schemas.ts';
import { activityFileErrors, validateActivities } from './validateActivities.ts';
import { validateCatalog } from './validateCatalog.ts';
import { validateFigures } from './validateFigures.ts';
import { validateRoute } from './validateRoute.ts';
import { validateRules } from './validateRules.ts';
import { validateTreatment } from './validateTreatment.ts';

/** Parsed JSON files as read from disk or bundled by Vite, before any validation. */
export interface RawContent {
  manifest: unknown;
  pages: unknown;
  units: unknown;
  signs: unknown;
  issues: unknown;
  rules: unknown;
  route: unknown;
  figures: unknown;
  /** One file per source section, keyed by `<source>-<section>` (specs/catalog/activities/<key>.json). */
  activities: Readonly<Record<string, unknown>>;
}

export interface Content {
  manifest: Source[];
  pages: Page[];
  units: KnowledgeUnit[];
  signs: Sign[];
  issues: Issue[];
  rules: RuleCatalog;
  route: Route;
  figures: Figure[];
  activities: Activity[];
}

export type ContentResult = { ok: true; content: Content; version: string } | { ok: false; errors: string[] };

/** File names used in error messages, so a failure points at the file to fix. */
const FILES: Record<Exclude<keyof RawContent, 'activities'>, string> = {
  manifest: 'specs/fuentes/manifest.json',
  pages: 'specs/catalog/pages.json',
  units: 'specs/catalog/units.json',
  signs: 'specs/catalog/signs.json',
  issues: 'specs/catalog/issues.json',
  rules: 'specs/catalog/rules.json',
  route: 'specs/route/comuna13-a.json',
  figures: 'specs/catalog/figures.json',
};

export const ACTIVITY_DIRECTORY = 'specs/catalog/activities';
export const activityFile = (key: string) => `${ACTIVITY_DIRECTORY}/${key}.json`;

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
  // Activity files hash in name order, so the version does not depend on how the loader listed them.
  const activityTexts = Object.keys(raw.activities)
    .sort()
    .map((key) => `activities/${key}:${JSON.stringify(raw.activities[key])}`);
  const texts = [
    ...(Object.keys(FILES) as Array<keyof typeof FILES>).map((key) => `${key}:${JSON.stringify(raw[key])}`),
    ...activityTexts,
  ];
  for (const text of texts) {
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, '0');
}

/** Parses every activity file; returns the files that parsed, keyed like the input. */
function parseActivityFiles(raw: RawContent['activities'], errors: string[]): Map<string, Activity[]> | undefined {
  const files = new Map<string, Activity[]>();
  let ok = true;
  for (const key of Object.keys(raw).sort()) {
    const activities = parse(ActivityCatalogSchema, raw[key], activityFile(key), errors);
    if (activities) files.set(key, activities);
    else ok = false;
  }
  return ok ? files : undefined;
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
  const figures = parse(FigureCatalogSchema, raw.figures, FILES.figures, errors);
  const activityFiles = parseActivityFiles(raw.activities, errors);
  if (!manifest || !pages || !units || !signs || !issues || !rules || !route || !figures || !activityFiles)
    return { ok: false, errors };
  const activities = [...activityFiles.values()].flat();

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
    ...activityFileErrors(activityFiles, units).map((error) => `activities: ${error}`),
    ...validateFigures(figures, { manifest, units, activities, signs }).map((error) => `figures: ${error}`),
    ...validateTreatment({ units, signs, activities }).map((error) => `treatment: ${error}`),
  );
  const protocol = manifest.find((source) => source.id === 'protocolo');
  if (protocol && rules.source.edition !== protocol.edition)
    errors.push(`rules: source edition ${rules.source.edition} does not match the manifest (${protocol.edition})`);
  if (protocol && rules.source.sha256 !== protocol.sha256)
    errors.push('rules: source sha256 does not match the manifest');
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    content: { manifest, pages, units, signs, issues, rules, route, figures, activities },
    version: computeContentVersion(raw),
  };
}
