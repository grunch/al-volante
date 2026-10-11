import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, createMemoryStore, openProgressStore } from './storage.ts';
import type { ProgressSnapshot } from './storage.ts';
import { recordAnswer } from './model.ts';

const AT = '2026-10-11T12:00:00.000Z';

function sampleRecord(id: string, correct = true) {
  return recordAnswer(
    {
      activityId: 'act.x',
      unitIds: ['manual.ch3.a'],
      variantId: 'v1',
      seed: 1,
      response: { kind: 'choice', optionId: 'a' },
      correct,
      score: correct ? 1 : 0,
      mode: 'practice',
    },
    new Map(),
    { id, at: AT, contentVersion: 'deadbeef' },
  );
}

describe('IndexedDB progress store', () => {
  beforeEach(() => {
    // A fresh, empty IndexedDB for every test.
    globalThis.indexedDB = new IDBFactory();
  });

  it('keeps progress across a restart (closing and reopening the database)', async () => {
    // Arrange
    const first = await openProgressStore();
    const { attempt, updates } = sampleRecord('a1');

    // Act
    await first.record(attempt, updates);
    const reopened = await openProgressStore();
    const { snapshot, skipped } = await reopened.load();

    // Assert
    expect(reopened.persistent).toBe(true);
    expect(skipped).toBe(0);
    expect(snapshot.attempts).toEqual([attempt]);
    expect(snapshot.concepts).toEqual(updates);
  });

  it('reports corrupt records without deleting them', async () => {
    const store = await openProgressStore();
    const { attempt, updates } = sampleRecord('a1');
    await store.record(attempt, updates);
    const raw = await openDB(DB_NAME);
    await raw.put('attempts', { id: 'broken', kind: 'activity' });
    await raw.put('concepts', { unitId: 'manual.ch3.b', box: 99 });

    const { snapshot, skipped } = await store.load();

    expect(skipped).toBe(2);
    expect(snapshot.attempts.map((item) => item.id)).toEqual(['a1']);
    expect(await raw.get('attempts', 'broken')).toEqual({ id: 'broken', kind: 'activity' });
    raw.close();
  });

  it('replaces everything atomically and leaves old data intact when the replacement fails', async () => {
    const store = await openProgressStore();
    const original = sampleRecord('a1');
    await store.record(original.attempt, original.updates);
    const replacement = sampleRecord('b1', false);

    // A record without the key path makes IndexedDB reject the write midway through the transaction.
    const broken = {
      attempts: [replacement.attempt, { noId: true }],
      concepts: replacement.updates,
    } as unknown as ProgressSnapshot;
    await expect(store.replaceAll(broken)).rejects.toThrow();
    const afterFailure = await store.load();
    await store.replaceAll({ attempts: [replacement.attempt], concepts: replacement.updates });
    const afterSuccess = await store.load();

    expect(afterFailure.snapshot.attempts.map((item) => item.id)).toEqual(['a1']);
    expect(afterSuccess.snapshot.attempts.map((item) => item.id)).toEqual(['b1']);
    expect(afterSuccess.snapshot.concepts[0]?.lastCorrect).toBe(false);
  });
});

describe('fallback without IndexedDB', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses a non-persistent memory store when IndexedDB does not exist', async () => {
    vi.stubGlobal('indexedDB', undefined);

    const store = await openProgressStore();

    expect(store.persistent).toBe(false);
  });

  it('uses a memory store when opening IndexedDB fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new Error('SecurityError');
      },
    });

    const store = await openProgressStore();

    expect(store.persistent).toBe(false);
  });

  it('records, loads and replaces progress in memory', async () => {
    const store = createMemoryStore();
    const first = sampleRecord('a1');
    const second = sampleRecord('b1');

    await store.record(first.attempt, first.updates);
    const loaded = await store.load();
    await store.replaceAll({ attempts: [second.attempt], concepts: [] });
    const replaced = await store.load();

    expect(loaded.snapshot.attempts).toHaveLength(1);
    expect(replaced.snapshot.attempts.map((item) => item.id)).toEqual(['b1']);
    expect(replaced.snapshot.concepts).toEqual([]);
  });
});
