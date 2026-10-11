import { describe, expect, it } from 'vitest';
import { BACKUP_FORMAT, CURRENT_BACKUP_VERSION, createBackup, migrateBackup, parseBackup } from './backup.ts';
import { createAttempt, updateConcept } from './model.ts';

const AT = '2026-10-11T12:00:00.000Z';
const attempt = createAttempt(
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
  { id: 'a1', at: AT, contentVersion: 'deadbeef' },
);
const updates = [updateConcept(undefined, 'manual.ch3.a', true, AT)];
const snapshot = { attempts: [attempt], concepts: updates };
const HOUR = 60 * 60 * 1000;
const later = (ms: number) => new Date(Date.parse(AT) + ms).toISOString();
/** Imports on the device that exported, right at export time. */
const parse = (text: string) => parseBackup(text, new Date(AT));

describe('backup', () => {
  it('round-trips progress through a versioned, self-describing file', () => {
    // Arrange / Act
    const text = createBackup(snapshot, 'deadbeef', AT);
    const parsed = parse(text);

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
    expect(parse('{oops')).toEqual({ ok: false, error: 'invalid-json' });
    expect(parse('[]')).toEqual({ ok: false, error: 'not-a-backup' });
    expect(parse(JSON.stringify({ format: 'other', formatVersion: 1 }))).toEqual({
      ok: false,
      error: 'not-a-backup',
    });
  });

  it('rejects backups from a newer app version or with an impossible version', () => {
    const future = JSON.parse(createBackup(snapshot, 'deadbeef', AT));
    future.formatVersion = CURRENT_BACKUP_VERSION + 1;

    expect(parse(JSON.stringify(future))).toMatchObject({ ok: false, error: 'unsupported-version' });
    expect(parse(JSON.stringify({ ...future, formatVersion: 0 }))).toMatchObject({
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

    expect(parse(JSON.stringify(bad))).toMatchObject({
      ok: false,
      error: 'invalid-data',
      details: expect.stringContaining('concepts.0.box'),
    });
    expect(parse(JSON.stringify(duplicated))).toEqual({
      ok: false,
      error: 'invalid-data',
      details: 'duplicate attempt id',
    });
    expect(parse(JSON.stringify(duplicatedConcepts))).toEqual({
      ok: false,
      error: 'invalid-data',
      details: 'duplicate concept',
    });
  });
});

describe('backup consistency', () => {
  it('rejects concepts with impossible counters before they can replace real progress', () => {
    const forged = JSON.parse(createBackup(snapshot, 'deadbeef', AT));
    forged.concepts[0] = { ...forged.concepts[0], box: 5, attempts: 0, correct: 100 };

    expect(parse(JSON.stringify(forged))).toMatchObject({ ok: false, error: 'invalid-data' });
  });
});

describe('backup dates', () => {
  it('rejects progress dated after the export, even when its intervals are consistent', () => {
    // Arrange: last answer and next review moved together ten years ahead.
    const shifted = JSON.parse(createBackup(snapshot, 'deadbeef', AT));
    shifted.concepts[0] = {
      ...shifted.concepts[0],
      lastAttemptAt: '2036-10-11T12:00:00.000Z',
      dueAt: '2036-10-12T12:00:00.000Z',
    };
    const lateAttempt = JSON.parse(createBackup(snapshot, 'deadbeef', AT));
    lateAttempt.attempts[0].events[0].at = '2036-10-11T12:00:00.000Z';
    const lateFault = JSON.parse(createBackup(snapshot, 'deadbeef', AT));
    lateFault.attempts[0].faults = [{ ruleId: 'rule.minor.a-item', at: '2036-10-11T12:00:00.000Z', points: 1 }];

    // Act / Assert
    expect(parse(JSON.stringify(shifted))).toMatchObject({
      ok: false,
      error: 'invalid-data',
      details: expect.stringContaining('after the export'),
    });
    expect(parse(JSON.stringify(lateAttempt))).toMatchObject({
      ok: false,
      error: 'invalid-data',
      details: expect.stringContaining('after the export'),
    });
    expect(parse(JSON.stringify(lateFault))).toMatchObject({
      ok: false,
      error: 'invalid-data',
      details: expect.stringContaining('after the export'),
    });
  });

  it('tolerates clock differences of up to a day', () => {
    const skewed = { attempts: [], concepts: [updateConcept(undefined, 'manual.ch3.a', true, later(HOUR))] };

    expect(parse(createBackup(skewed, 'deadbeef', AT))).toMatchObject({ ok: true });
    expect(parseBackup(createBackup(snapshot, 'deadbeef', later(HOUR)), new Date(AT))).toMatchObject({ ok: true });
  });

  it('rejects a backup exported after the current time of this device', () => {
    const fromTheFuture = createBackup(snapshot, 'deadbeef', '2036-10-11T12:00:00.000Z');

    expect(parse(fromTheFuture)).toMatchObject({
      ok: false,
      error: 'invalid-data',
      details: expect.stringContaining('exported after'),
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
