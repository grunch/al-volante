import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import { AttemptSchema } from '../content/schemas.ts';
import type { Attempt } from '../content/schemas.ts';
import { ConceptProgressSchema } from './model.ts';
import type { ConceptProgress } from './model.ts';

export const DB_NAME = 'al-volante';
/** Bump with a new branch in `upgrade` whenever stores or indexes change; never edit an old branch. */
export const DB_VERSION = 3;

/** An unreadable record, moved aside exactly as it was found so a future migration can still recover it. */
export interface QuarantinedRecord {
  store: 'attempts' | 'concepts';
  key: IDBValidKey;
  value: unknown;
}

interface ProgressDB extends DBSchema {
  attempts: { key: string; value: Attempt; indexes: { 'by-started': string; 'by-finished': string } };
  concepts: { key: string; value: ConceptProgress };
  quarantine: { key: number; value: QuarantinedRecord };
}

export interface ProgressSnapshot {
  attempts: Attempt[];
  concepts: ConceptProgress[];
}

export interface LoadResult {
  snapshot: ProgressSnapshot;
  /** Unreadable records set aside in quarantine so far; they are kept, never deleted. */
  quarantined: number;
}

/** Builds the attempt to store from the latest attempt time already stored (undefined when there is none). */
export type AttemptFactory = (latestAttemptAt: string | undefined) => Attempt;

/** Computes a concept's new progress from the value stored right now (undefined when there is none). */
export type ConceptUpdate = (unitId: string, previous: ConceptProgress | undefined, at: string) => ConceptProgress;

export interface RecordResult {
  attempt: Attempt;
  updates: ConceptProgress[];
}

/** When an attempt happened, for ordering: its end, or its start while unfinished. */
export const attemptTime = (attempt: Attempt): string => attempt.finishedAt ?? attempt.startedAt;

function latestOf(times: ReadonlyArray<string | undefined>): string | undefined {
  const parsed = times.filter((time): time is string => time !== undefined).map((time) => Date.parse(time));
  return parsed.length > 0 ? new Date(Math.max(...parsed)).toISOString() : undefined;
}

export interface ProgressStore {
  /** False for the in-memory fallback used when IndexedDB is unavailable (e.g. some private modes). */
  readonly persistent: boolean;
  load(): Promise<LoadResult>;
  /**
   * Stores one attempt and updates its concepts in a single transaction. The attempt is built from the latest stored
   * attempt time and each concept from its stored value, both read inside the transaction: another tab's newer
   * progress is built upon, never overwritten or reordered.
   */
  record(createAttempt: AttemptFactory, unitIds: readonly string[], update: ConceptUpdate): Promise<RecordResult>;
  /** Replaces all progress atomically: either everything is replaced or nothing changes. */
  replaceAll(snapshot: ProgressSnapshot): Promise<void>;
  close(): void;
}

const STORES = ['attempts', 'concepts', 'quarantine'] as const;
type ProgressTransaction = IDBPTransaction<ProgressDB, typeof STORES, 'readwrite'>;
type Track = <T>(request: Promise<T>) => Promise<T>;

/**
 * Runs `work` inside one read-write transaction and waits for the commit. Every request goes through `track`, so a
 * failure anywhere aborts the whole transaction (also when a request throws synchronously, which would otherwise let
 * the earlier requests commit) and no rejection is left unhandled. Either everything is written or nothing is.
 */
async function inTransaction<T>(
  db: IDBPDatabase<ProgressDB>,
  work: (tx: ProgressTransaction, track: Track) => Promise<T>,
): Promise<T> {
  const tx = db.transaction(STORES, 'readwrite');
  const pending: Array<Promise<unknown>> = [];
  const track: Track = (request) => {
    request.catch(() => undefined);
    pending.push(request);
    return request;
  };
  let result: T;
  try {
    result = await work(tx, track);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Already aborted by the failing request.
    }
    await Promise.allSettled([...pending, tx.done]);
    throw error;
  }
  await Promise.all([...pending, tx.done]);
  return result;
}

const readConcept = (value: unknown): ConceptProgress | undefined => {
  const parsed = ConceptProgressSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

class IndexedDbStore implements ProgressStore {
  readonly persistent = true;
  private readonly db: IDBPDatabase<ProgressDB>;

  constructor(db: IDBPDatabase<ProgressDB>) {
    this.db = db;
  }

  close(): void {
    this.db.close();
  }

  /** Reads everything and, in the same transaction, moves records that fail validation to quarantine. */
  load(): Promise<LoadResult> {
    return inTransaction(this.db, async (tx, track) => {
      const attemptStore = tx.objectStore('attempts');
      const conceptStore = tx.objectStore('concepts');
      const quarantine = tx.objectStore('quarantine');
      const [attemptKeys, attemptValues, conceptKeys, conceptValues] = await Promise.all([
        track(attemptStore.getAllKeys()),
        track(attemptStore.getAll()),
        track(conceptStore.getAllKeys()),
        track(conceptStore.getAll()),
      ]);
      const attempts: Attempt[] = [];
      attemptValues.forEach((value: unknown, index) => {
        const parsed = AttemptSchema.safeParse(value);
        if (parsed.success) return void attempts.push(parsed.data);
        const key = attemptKeys[index] as string;
        track(quarantine.add({ store: 'attempts', key, value }));
        track(attemptStore.delete(key));
      });
      const concepts: ConceptProgress[] = [];
      conceptValues.forEach((value: unknown, index) => {
        const concept = readConcept(value);
        if (concept) return void concepts.push(concept);
        const key = conceptKeys[index] as string;
        track(quarantine.add({ store: 'concepts', key, value }));
        track(conceptStore.delete(key));
      });
      const quarantined = await track(quarantine.count());
      return { snapshot: { attempts, concepts }, quarantined };
    });
  }

  record(createAttempt: AttemptFactory, unitIds: readonly string[], update: ConceptUpdate): Promise<RecordResult> {
    return inTransaction(this.db, async (tx, track) => {
      const attemptStore = tx.objectStore('attempts');
      const conceptStore = tx.objectStore('concepts');
      const [latestStart, latestEnd] = await Promise.all([
        track(attemptStore.index('by-started').openKeyCursor(null, 'prev')),
        track(attemptStore.index('by-finished').openKeyCursor(null, 'prev')),
      ]);
      const attempt = AttemptSchema.parse(createAttempt(latestOf([latestStart?.key, latestEnd?.key])));
      const at = attemptTime(attempt);
      const ids = [...new Set(unitIds)];
      const stored: unknown[] = await Promise.all(ids.map((unitId) => track(conceptStore.get(unitId))));
      const updates = ids.map((unitId, index) => {
        const value = stored[index];
        const previous = readConcept(value);
        // Written by another tab or version after this tab loaded: set aside before replacing it.
        if (value !== undefined && !previous)
          track(tx.objectStore('quarantine').add({ store: 'concepts', key: unitId, value }));
        // Never write what a later load would have to quarantine: an invalid result aborts the whole write.
        return ConceptProgressSchema.parse(update(unitId, previous, at));
      });
      track(attemptStore.put(attempt));
      for (const concept of updates) track(conceptStore.put(concept));
      return { attempt, updates };
    });
  }

  replaceAll(snapshot: ProgressSnapshot): Promise<void> {
    return inTransaction(this.db, async (tx, track) => {
      const attempts = tx.objectStore('attempts');
      const concepts = tx.objectStore('concepts');
      track(attempts.clear());
      track(concepts.clear());
      for (const attempt of snapshot.attempts) track(attempts.put(attempt));
      for (const concept of snapshot.concepts) track(concepts.put(concept));
    });
  }
}

/** Keeps progress for the current tab only; used when IndexedDB cannot be opened. */
export function createMemoryStore(initial: ProgressSnapshot = { attempts: [], concepts: [] }): ProgressStore {
  let attempts = new Map(initial.attempts.map((attempt) => [attempt.id, attempt]));
  let concepts = new Map(initial.concepts.map((concept) => [concept.unitId, concept]));
  return {
    persistent: false,
    async load() {
      return { snapshot: { attempts: [...attempts.values()], concepts: [...concepts.values()] }, quarantined: 0 };
    },
    async record(createAttempt, unitIds, update) {
      const attempt = createAttempt(latestOf([...attempts.values()].map(attemptTime)));
      const at = attemptTime(attempt);
      const updates = [...new Set(unitIds)].map((unitId) => update(unitId, concepts.get(unitId), at));
      attempts = new Map([...attempts, [attempt.id, attempt]]);
      concepts = new Map([...concepts, ...updates.map((concept) => [concept.unitId, concept] as const)]);
      return { attempt, updates };
    },
    async replaceAll(snapshot) {
      attempts = new Map(snapshot.attempts.map((attempt) => [attempt.id, attempt]));
      concepts = new Map(snapshot.concepts.map((concept) => [concept.unitId, concept]));
    },
    close() {
      // Nothing to release.
    },
  };
}

/** Opens the IndexedDB store, falling back to memory (and saying so via `persistent`) when that fails. */
export async function openProgressStore(): Promise<ProgressStore> {
  if (typeof indexedDB === 'undefined') return createMemoryStore();
  try {
    const db = await openDB<ProgressDB>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion, _newVersion, transaction) {
        // One branch per schema version, applied in order, so any older database upgrades step by step.
        if (oldVersion < 1) {
          database.createObjectStore('attempts', { keyPath: 'id' });
          database.createObjectStore('concepts', { keyPath: 'unitId' });
        }
        if (oldVersion < 2) database.createObjectStore('quarantine', { autoIncrement: true });
        if (oldVersion < 3) {
          // Lets a write find the latest attempt time without reading every attempt.
          const attempts = transaction.objectStore('attempts');
          attempts.createIndex('by-started', 'startedAt');
          attempts.createIndex('by-finished', 'finishedAt');
        }
      },
    });
    return new IndexedDbStore(db);
  } catch (error) {
    console.warn('IndexedDB unavailable; progress will not persist', error);
    return createMemoryStore();
  }
}
