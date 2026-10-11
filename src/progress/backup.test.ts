import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION, createBackup, migrateBackup, parseBackup } from './backup.ts';
import { recordAnswer } from './model.ts';

const AT = '2026-10-11T12:00:00.000Z';
const { attempt, updates } = recordAnswer(
  {
    activityId: 'act.x',
    unitIds: ['manual.ch3.a'],
    variantId: 'v1',
    seed: 1,
    response: { kind: 'choice', optionId: 'a' },
    correct: true,
    score: 1,
    mode: 'practice',
  },
  new Map(),
  { id: 'a1', at: AT, contentVersion: 'deadbeef' },
);
const snapshot = { attempts: [attempt], concepts: updates };

describe('backup', () => {
  it('round-trips progress through a versioned, self-describing file', () => {
    // Arrange / Act
    const text = createBackup(snapshot, 'deadbeef', AT);
    const parsed = parseBackup(text);

    // Assert
    expect(JSON.parse(text)).toMatchObject({
      format: BACKUP_FORMAT,
      formatVersion: CURRENT_BACKUP_VERSION,
      exportedAt: AT,
      contentVersion: 'deadbeef',
    });
    expect(parsed).toEqual({ ok: true, snapshot, contentVersion: 'deadbeef', exportedAt: AT, fromVersion: 1 });
  });

  it('rejects text that is not JSON or not one of our backups', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, error: 'invalid-json' });
    expect(parseBackup('[]')).toEqual({ ok: false, error: 'not-a-backup' });
    expect(parseBackup(JSON.stringify({ format: 'other', formatVersion: 1 }))).toEqual({
      ok: false,
      error: 'not-a-backup',
    });
  });

  it('rejects backups from a newer app version or with an impossible version', () => {
    const future = JSON.parse(createBackup(snapshot, 'deadbeef', AT));
    future.formatVersion = CURRENT_BACKUP_VERSION + 1;

    expect(parseBackup(JSON.stringify(future))).toMatchObject({ ok: false, error: 'unsupported-version' });
    expect(parseBackup(JSON.stringify({ ...future, formatVersion: 0 }))).toMatchObject({
      ok: false,
      error: 'unsupported-version',
    });
  });

  it('rejects invalid or duplicated records with a useful detail', () => {
    const bad = JSON.parse(createBackup(snapshot, 'deadbeef', AT));
    bad.concepts[0].box = 42;
    const duplicated = JSON.parse(createBackup({ attempts: [attempt, attempt], concepts: updates }, 'deadbeef', AT));
    const duplicatedConcepts = JSON.parse(
      createBackup({ attempts: [attempt], concepts: [...updates, ...updates] }, 'deadbeef', AT),
    );

    expect(parseBackup(JSON.stringify(bad))).toMatchObject({
      ok: false,
      error: 'invalid-data',
      details: expect.stringContaining('concepts.0.box'),
    });
    expect(parseBackup(JSON.stringify(duplicated))).toEqual({
      ok: false,
      error: 'invalid-data',
      details: 'duplicate attempt id',
    });
    expect(parseBackup(JSON.stringify(duplicatedConcepts))).toEqual({
      ok: false,
      error: 'invalid-data',
      details: 'duplicate concept',
    });
  });
});

describe('migrateBackup', () => {
  it('applies each migration in order and stamps the new version', () => {
    const migrations = {
      1: (data: Record<string, unknown>) => ({ ...data, renamed: data.old }),
      2: (data: Record<string, unknown>) => ({ ...data, added: true }),
    };

    expect(migrateBackup({ old: 'x', formatVersion: 1 }, 1, 3, migrations)).toEqual({
      old: 'x',
      renamed: 'x',
      added: true,
      formatVersion: 3,
    });
    expect(migrateBackup({ formatVersion: 1 }, 1, 1, {})).toEqual({ formatVersion: 1 });
  });

  it('returns null when a migration step is missing', () => {
    expect(migrateBackup({ formatVersion: 1 }, 1, 3, { 1: (data) => data })).toBeNull();
  });
});
