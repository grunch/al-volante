import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { openDB } from 'idb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DB_NAME, DB_VERSION, createMemoryStore, openProgressStore } from './storage.ts';
import type { ConceptUpdate, ProgressSnapshot, ProgressStore } from './storage.ts';
import { createAttempt, updateConcept } from './model.ts';

const DAY = 24 * 60 * 60 * 1000;
const T0 = '2026-10-11T12:00:00.000Z';
const at = (days: number) => new Date(Date.parse(T0) + days * DAY).toISOString();

function sampleAttempt(id: string, correct = true, when = T0) {
  return createAttempt(
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
    { id, at: when, contentVersion: 'deadbeef' },
  );
}

const answer =
  (correct: boolean): ConceptUpdate =>
  (unitId, previous, at) =>
    updateConcept(previous, unitId, correct, at);

/** Records one answer and returns the updated concepts. */
async function practise(store: ProgressStore, id: string, correct = true, when = T0) {
  const { updates } = await store.record(() => sampleAttempt(id, correct, when), ['manual.ch3.a'], answer(correct));
  return updates;
}

describe('IndexedDB progress store', () => {
  beforeEach(() => {
    // A fresh, empty IndexedDB for every test.
    globalThis.indexedDB = new IDBFactory();
  });

  it('keeps progress across a restart (closing and reopening the database)', async () => {
    // Arrange
    const first = await openProgressStore();

    // Act
    const updates = await practise(first, 'a1');
    first.close();
    const reopened = await openProgressStore();
    const { snapshot, quarantined } = await reopened.load();

    // Assert
    expect(reopened.persistent).toBe(true);
    expect(quarantined).toBe(0);
    expect(snapshot.attempts).toEqual([sampleAttempt('a1')]);
    expect(snapshot.concepts).toEqual(updates);
    expect(updates).toMatchObject([{ unitId: 'manual.ch3.a', box: 1, attempts: 1 }]);
  });

  it('updates each concept from the stored value, so a second tab never overwrites newer progress', async () => {
    // Two connections stand for two tabs; neither knows what the other wrote.
    const tabA = await openProgressStore();
    const tabB = await openProgressStore();

    await practise(tabA, 'a1', true, at(0));
    const [fromB] = await practise(tabB, 'b1', true, at(1));

    expect(fromB).toMatchObject({ box: 2, attempts: 2, correct: 2 });
    expect((await tabA.load()).snapshot.concepts).toEqual([fromB]);
  });

  it('moves unreadable records to a quarantine store unchanged, and keeps counting them', async () => {
    // Arrange
    const store = await openProgressStore();
    await practise(store, 'a1');
    const raw = await openDB(DB_NAME);
    await raw.put('attempts', { id: 'broken', kind: 'activity' });
    await raw.put('concepts', { unitId: 'manual.ch3.b', box: 99 });

    // Act
    const first = await store.load();
    const second = await store.load();

    // Assert
    expect(first.quarantined).toBe(2);
    expect(second.quarantined).toBe(2);
    expect(first.snapshot.attempts.map((item) => item.id)).toEqual(['a1']);
    expect(await raw.get('attempts', 'broken')).toBeUndefined();
    expect(await raw.getAll('quarantine')).toEqual([
      { store: 'attempts', key: 'broken', value: { id: 'broken', kind: 'activity' } },
      { store: 'concepts', key: 'manual.ch3.b', value: { unitId: 'manual.ch3.b', box: 99 } },
    ]);
    raw.close();
  });

  it('hands the attempt factory the latest stored attempt time, whichever connection wrote it', async () => {
    // Arrange: one tab stores an attempt an hour ahead; the other has never read it.
    const tabA = await openProgressStore();
    const tabB = await openProgressStore();
    await practise(tabA, 'a1', true, at(1 / 24));
    let seen: string | undefined = 'not called';

    // Act
    await tabB.record(
      (latest) => {
        seen = latest;
        return sampleAttempt('b1', true, at(1 / 24 + 0.001));
      },
      ['manual.ch3.a'],
      answer(true),
    );

    // Assert
    expect(seen).toBe(at(1 / 24));
  });

  it('gives the first attempt no previous time', async () => {
    const store = await openProgressStore();
    let seen: string | undefined = 'not called';

    await store.record((latest) => ((seen = latest), sampleAttempt('a1')), ['manual.ch3.a'], answer(true));

    expect(seen).toBeUndefined();
  });

  it('quarantines an unreadable concept before practising it again instead of overwriting it', async () => {
    const store = await openProgressStore();
    const raw = await openDB(DB_NAME);
    await raw.put('concepts', { unitId: 'manual.ch3.a', box: 'tres' });

    const [fresh] = await practise(store, 'a1');

    expect(fresh).toMatchObject({ box: 1, attempts: 1 });
    expect(await raw.getAll('quarantine')).toEqual([
      { store: 'concepts', key: 'manual.ch3.a', value: { unitId: 'manual.ch3.a', box: 'tres' } },
    ]);
    raw.close();
  });

  it('refuses to store a concept the schema rejects, leaving everything as it was', async () => {
    const store = await openProgressStore();
    await practise(store, 'a1');
    const broken: ConceptUpdate = (unitId, previous, at) => ({
      ...updateConcept(previous, unitId, true, at),
      correct: 99,
    });

    await expect(store.record(() => sampleAttempt('a2'), ['manual.ch3.a'], broken)).rejects.toThrow();
    const { snapshot, quarantined } = await store.load();

    expect(snapshot.attempts.map((item) => item.id)).toEqual(['a1']);
    expect(snapshot.concepts[0]).toMatchObject({ attempts: 1 });
    expect(quarantined).toBe(0);
  });

  it('replaces everything atomically and leaves old data intact when the replacement fails', async () => {
    const store = await openProgressStore();
    await practise(store, 'a1');
    const replacement = {
      attempts: [sampleAttempt('b1', false)],
      concepts: [updateConcept(undefined, 'manual.ch3.a', false, T0)],
    };

    // A record without the key path makes IndexedDB reject the write midway through the transaction.
    const broken = {
      attempts: [...replacement.attempts, { noId: true }],
      concepts: replacement.concepts,
    } as unknown as ProgressSnapshot;
    await expect(store.replaceAll(broken)).rejects.toThrow();
    const afterFailure = await store.load();
    await store.replaceAll(replacement);
    const afterSuccess = await store.load();

    expect(afterFailure.snapshot.attempts.map((item) => item.id)).toEqual(['a1']);
    expect(afterSuccess.snapshot.attempts.map((item) => item.id)).toEqual(['b1']);
    expect(afterSuccess.snapshot.concepts[0]?.lastCorrect).toBe(false);
  });

  it('rewrites version 2 dates canonically while upgrading, so the new indexes order them by time', async () => {
    // Arrange: a version 2 database holding an older attempt without milliseconds and a newer one with them.
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(database) {
        database.createObjectStore('attempts', { keyPath: 'id' });
        database.createObjectStore('concepts', { keyPath: 'unitId' });
        database.createObjectStore('quarantine', { autoIncrement: true });
      },
    });
    const older = {
      ...sampleAttempt('older'),
      startedAt: '2026-10-11T12:00:00Z',
      finishedAt: '2026-10-11T12:00:00Z',
      events: [],
    };
    const newer = {
      ...sampleAttempt('newer'),
      startedAt: '2026-10-11T12:00:00.500Z',
      finishedAt: '2026-10-11T12:00:00.500Z',
      events: [],
    };
    await v2.put('attempts', older);
    await v2.put('attempts', newer);
    v2.close();

    // Act
    const store = await openProgressStore();
    let seen: string | undefined;
    await store.record(
      (latest) => ((seen = latest), sampleAttempt('next', true, at(1))),
      ['manual.ch3.a'],
      answer(true),
    );
    const { snapshot } = await store.load();

    // Assert: as text, '12:00:00Z' sorts after '12:00:00.500Z'; once rewritten, the newer attempt is the latest.
    expect(seen).toBe('2026-10-11T12:00:00.500Z');
    expect(snapshot.attempts.find((attempt) => attempt.id === 'older')?.startedAt).toBe('2026-10-11T12:00:00.000Z');
  });

  it('upgrades without touching unreadable attempts, so quarantine keeps them exactly as they were', async () => {
    // Arrange: a version 2 database with an unreadable attempt that still has a valid ISO date.
    const v2 = await openDB(DB_NAME, 2, {
      upgrade(database) {
        database.createObjectStore('attempts', { keyPath: 'id' });
        database.createObjectStore('concepts', { keyPath: 'unitId' });
        database.createObjectStore('quarantine', { autoIncrement: true });
      },
    });
    const broken = { id: 'broken', kind: 'activity', startedAt: '2026-10-11T12:00:00Z' };
    await v2.put('attempts', broken);
    v2.close();

    // Act
    const store = await openProgressStore();
    const { quarantined } = await store.load();

    // Assert
    expect(quarantined).toBe(1);
    const raw = await openDB(DB_NAME);
    expect(await raw.getAll('quarantine')).toEqual([{ store: 'attempts', key: 'broken', value: broken }]);
    raw.close();
  });

  it('upgrades a version 1 database without losing its progress', async () => {
    // Arrange: the version 1 layout had no quarantine store.
    const v1 = await openDB(DB_NAME, 1, {
      upgrade(database) {
        database.createObjectStore('attempts', { keyPath: 'id' });
        database.createObjectStore('concepts', { keyPath: 'unitId' });
      },
    });
    await v1.put('attempts', sampleAttempt('old'));
    v1.close();

    // Act
    const store = await openProgressStore();
    const { snapshot, quarantined } = await store.load();

    // Assert
    expect(DB_VERSION).toBe(3);
    expect(snapshot.attempts.map((item) => item.id)).toEqual(['old']);
    expect(quarantined).toBe(0);
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

  it('records from the stored value, loads and replaces progress in memory', async () => {
    const store = createMemoryStore();

    await practise(store, 'a1', true, at(0));
    const [second] = await practise(store, 'a2', true, at(1));
    let seen: string | undefined;
    await store.record((latest) => ((seen = latest), sampleAttempt('a3', true, at(2))), ['manual.ch3.a'], answer(true));
    const loaded = await store.load();
    await store.replaceAll({ attempts: [sampleAttempt('b1')], concepts: [] });
    const replaced = await store.load();

    expect(second).toMatchObject({ box: 2, attempts: 2 });
    expect(seen).toBe(at(1));
    expect(loaded.snapshot.attempts).toHaveLength(3);
    expect(replaced.snapshot.attempts.map((item) => item.id)).toEqual(['b1']);
    expect(replaced.snapshot.concepts).toEqual([]);
  });
});
