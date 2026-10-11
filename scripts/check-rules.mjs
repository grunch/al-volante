#!/usr/bin/env node
// Validates the exam rule catalog in specs/catalog/rules.json against the protocol source.
// Usage: node scripts/check-rules.mjs [rulesFile]
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SEVERITY_POINTS = { minor: 1, low: 2, high: 3, eliminatory: 8 };
export const REPETITION_POLICIES = ['once', 'per-occurrence', 'per-episode', 'single-check', 'unspecified'];
export const STAGES = ['I', 'II', 'III'];
const RULE_ID = /^rule\.(minor|low|high|eliminatory)\.[a-z]-[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Returns a list of human-readable errors; an empty list means the rule catalog is valid.
 * @param {{ source: {id: string}, scoring: object, rules: object[] }} catalog
 * @param {number} protocolPages page count of the protocol PDF from the manifest
 */
export function validateRules({ source, scoring, rules }, protocolPages) {
  const errors = [];
  if (source?.id !== 'protocolo') errors.push('source.id must be "protocolo"');
  if (scoring?.passMaxPoints !== 7 || scoring?.failMinPoints !== 8) errors.push('scoring must pass with <= 7 and fail with >= 8 points');
  for (const [severity, points] of Object.entries(SEVERITY_POINTS)) {
    if (scoring?.pointsBySeverity?.[severity] !== points) errors.push(`scoring.pointsBySeverity.${severity} must be ${points}`);
  }

  const ids = new Set();
  const annexItems = new Set();
  for (const rule of rules) {
    const id = rule.id ?? '<missing id>';
    if (!RULE_ID.test(id)) errors.push(`${id}: invalid rule id`);
    if (ids.has(id)) errors.push(`${id}: duplicate rule id`);
    ids.add(id);
    const itemKey = `${rule.severity}.${rule.annexItem}`;
    if (annexItems.has(itemKey)) errors.push(`${id}: duplicate annex item ${itemKey}`);
    annexItems.add(itemKey);
    if (!id.startsWith(`rule.${rule.severity}.${rule.annexItem}-`)) errors.push(`${id}: id does not match severity/annex item`);
    if (SEVERITY_POINTS[rule.severity] === undefined) errors.push(`${id}: invalid severity "${rule.severity}"`);
    else if (rule.points !== SEVERITY_POINTS[rule.severity]) errors.push(`${id}: points must be ${SEVERITY_POINTS[rule.severity]}`);
    if (!REPETITION_POLICIES.includes(rule.repetition)) errors.push(`${id}: invalid repetition "${rule.repetition}"`);
    if (rule.interrupts && rule.severity !== 'eliminatory') errors.push(`${id}: only eliminatory faults can interrupt the exam`);
    if (rule.escalation) {
      const { severity, points, interrupts, condition } = rule.escalation;
      if (severity !== 'eliminatory' || points !== 8 || interrupts !== true || !condition) errors.push(`${id}: escalation must be an interrupting eliminatory fault with a condition`);
    }
    if (!rule.condition) errors.push(`${id}: missing condition`);
    if (!Array.isArray(rule.fichaRows) || rule.fichaRows.length === 0) errors.push(`${id}: must map to at least one scoring sheet row`);
    for (const row of rule.fichaRows ?? []) {
      if (!STAGES.includes(row.stage) || !row.group || !row.text) errors.push(`${id}: invalid scoring sheet row`);
    }
    if (!Array.isArray(rule.refs) || rule.refs.length === 0) errors.push(`${id}: must cite at least one page`);
    for (const ref of rule.refs ?? []) {
      if (ref.source !== 'protocolo' || !Number.isInteger(ref.page) || ref.page < 1 || ref.page > protocolPages) {
        errors.push(`${id}: invalid reference ${ref.source}:${ref.page}`);
      }
    }
  }
  return errors;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const rulesFile = resolve(process.argv[2] ?? join(root, 'specs/catalog/rules.json'));
  const manifest = JSON.parse(readFileSync(join(root, 'specs/fuentes/manifest.json'), 'utf8'));
  const protocolPages = manifest.find((entry) => entry.id === 'protocolo')?.pages ?? 0;
  const catalog = JSON.parse(readFileSync(rulesFile, 'utf8'));
  const errors = validateRules(catalog, protocolPages);
  if (errors.length > 0) {
    console.error(`Rule catalog has ${errors.length} error(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  const interrupting = catalog.rules.filter((rule) => rule.interrupts).length;
  console.log(`Rules OK: ${catalog.rules.length} rules, ${interrupting} interrupting eliminatory faults.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
