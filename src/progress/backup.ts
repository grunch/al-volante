import { z } from 'zod';
import { AttemptSchema } from '../content/schemas.ts';
import { ConceptProgressSchema } from './model.ts';
import type { ProgressSnapshot } from './storage.ts';

export const BACKUP_FORMAT = 'al-volante-progress';
export const CURRENT_BACKUP_VERSION = 1;

const BackupV1Schema = z.strictObject({
  format: z.literal(BACKUP_FORMAT),
  formatVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  contentVersion: z.string().min(1),
  attempts: z.array(AttemptSchema),
  concepts: z.array(ConceptProgressSchema),
});

/**
 * Upgrades a parsed backup from `version` to `version + 1`. Add an entry when the format changes and keep old
 * entries forever, so any older backup can still be restored.
 */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

export type BackupError = 'invalid-json' | 'not-a-backup' | 'unsupported-version' | 'invalid-data';
export type BackupParseResult =
  | { ok: true; snapshot: ProgressSnapshot; contentVersion: string; exportedAt: string; fromVersion: number }
  | { ok: false; error: BackupError; details?: string };

/** Serialises progress into a versioned, self-describing JSON backup. */
export function createBackup(snapshot: ProgressSnapshot, contentVersion: string, exportedAt: string): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      formatVersion: CURRENT_BACKUP_VERSION,
      exportedAt,
      contentVersion,
      attempts: snapshot.attempts,
      concepts: snapshot.concepts,
    },
    null,
    2,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Applies migrations one version at a time; returns null when a step is missing. */
export function migrateBackup(
  data: Record<string, unknown>,
  fromVersion: number,
  toVersion: number,
  migrations: Record<number, (data: Record<string, unknown>) => Record<string, unknown>>,
): Record<string, unknown> | null {
  let current = data;
  for (let version = fromVersion; version < toVersion; version += 1) {
    const migrate = migrations[version];
    if (!migrate) return null;
    current = { ...migrate(current), formatVersion: version + 1 };
  }
  return current;
}

/** Parses, migrates and validates a backup without touching stored progress; callers replace data only on success. */
export function parseBackup(text: string, migrations = MIGRATIONS): BackupParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!isRecord(data) || data.format !== BACKUP_FORMAT || !Number.isInteger(data.formatVersion))
    return { ok: false, error: 'not-a-backup' };
  const fromVersion = data.formatVersion as number;
  if (fromVersion < 1 || fromVersion > CURRENT_BACKUP_VERSION)
    return { ok: false, error: 'unsupported-version', details: String(fromVersion) };

  const current = migrateBackup(data, fromVersion, CURRENT_BACKUP_VERSION, migrations);
  if (!current) return { ok: false, error: 'unsupported-version', details: String(fromVersion) };

  const parsed = BackupV1Schema.safeParse(current);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: 'invalid-data',
      details: issue ? `${issue.path.join('.')}: ${issue.message}` : undefined,
    };
  }
  const { attempts, concepts, contentVersion, exportedAt } = parsed.data;
  if (new Set(attempts.map((attempt) => attempt.id)).size !== attempts.length)
    return { ok: false, error: 'invalid-data', details: 'duplicate attempt id' };
  if (new Set(concepts.map((concept) => concept.unitId)).size !== concepts.length)
    return { ok: false, error: 'invalid-data', details: 'duplicate concept' };
  return { ok: true, snapshot: { attempts, concepts }, contentVersion, exportedAt, fromVersion };
}
