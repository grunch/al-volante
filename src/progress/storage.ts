import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase, IDBPTransaction } from 'idb';
import { AttemptSchema } from '../content/schemas.ts';
import type { Attempt } from '../content/schemas.ts';
import { ConceptProgressSchema } from './model.ts';
import type { ConceptProgress } from './model.ts';

export const DB_NAME = 'al-volante';
/** Bump with a new branch in `upgrade` whenever stores or indexes change; never edit an old branch. */
export const DB_VERSION = 1;

interface ProgressDB extends DBSchema {
  attempts: { key: string; value: Attempt };
  concepts: { key: string; value: ConceptProgress };
}

export interface ProgressSnapshot {
  attempts: Attempt[];
  concepts: ConceptProgress[];
}

export interface LoadResult {
  snapshot: ProgressSnapshot;
  /** Stored records that failed validation; they are reported and kept, never deleted. */
  skipped: number;
}

export interface ProgressStore {
  /** False for the in-memory fallback used when IndexedDB is unavailable (e.g. some private modes). */
  readonly persistent: boolean;
  load(): Promise<LoadResult>;
  /** Stores one attempt and its concept updates atomically. */
  record(attempt: Attempt, updates: readonly ConceptProgress[]): Promise<void>;
  /** Replaces all progress atomically: either everything is replaced or nothing changes. */
  replaceAll(snapshot: ProgressSnapshot): Promise<void>;
  close(): void;
}

function validRecords<T>(
  records: readonly unknown[],
  parse: (value: unknown) => { success: boolean; data?: T },
): { valid: T[]; skipped: number } {
  const valid: T[] = [];
  let skipped = 0;
  for (const record of records) {
    const result = parse(record);
    if (result.success) valid.push(result.data as T);
    else skipped += 1;
  }
  return { valid, skipped };
}

class IndexedDbStore implements ProgressStore {
  readonly persistent = true;
  private readonly db: IDBPDatabase<ProgressDB>;

  constructor(db: IDBPDatabase<ProgressDB>) {
    this.db = db;
  }

  async load(): Promise<LoadResult> {
    const [attempts, concepts] = await Promise.all([this.db.getAll('attempts'), this.db.getAll('concepts')]);
    const validAttempts = validRecords(attempts, (value) => AttemptSchema.safeParse(value));
    const validConcepts = validRecords(concepts, (value) => ConceptProgressSchema.safeParse(value));
    return {
      snapshot: { attempts: validAttempts.valid, concepts: validConcepts.valid },
      skipped: validAttempts.skipped + validConcepts.skipped,
    };
  }

  close(): void {
    this.db.close();
  }

  async record(attempt: Attempt, updates: readonly ConceptProgress[]): Promise<void> {
    const tx = this.db.transaction(['attempts', 'concepts'], 'readwrite');
    await writeAtomically(tx, (requests) => {
      requests.push(tx.objectStore('attempts').put(attempt));
      for (const update of updates) requests.push(tx.objectStore('concepts').put(update));
    });
  }

  async replaceAll(snapshot: ProgressSnapshot): Promise<void> {
    const tx = this.db.transaction(['attempts', 'concepts'], 'readwrite');
    await writeAtomically(tx, (requests) => {
      const attempts = tx.objectStore('attempts');
      const concepts = tx.objectStore('concepts');
      requests.push(attempts.clear(), concepts.clear());
      for (const attempt of snapshot.attempts) requests.push(attempts.put(attempt));
      for (const concept of snapshot.concepts) requests.push(concepts.put(concept));
    });
  }
}

type WriteTransaction = IDBPTransaction<ProgressDB, ['attempts', 'concepts'], 'readwrite'>;

/**
 * Issues every write of one transaction and waits for the commit. A request that fails asynchronously aborts the
 * transaction by itself; one that throws synchronously (e.g. a record without its key) would let the earlier requests
 * commit, so the transaction is aborted explicitly. Either way nothing is written.
 */
async function writeAtomically(
  tx: WriteTransaction,
  issue: (requests: Array<Promise<unknown>>) => void,
): Promise<void> {
  const requests: Array<Promise<unknown>> = [];
  try {
    issue(requests);
  } catch (error) {
    tx.abort();
    await Promise.allSettled([...requests, tx.done]);
    throw error;
  }
  await Promise.all([...requests, tx.done]);
}

/** Keeps progress for the current tab only; used when IndexedDB cannot be opened. */
export function createMemoryStore(initial: ProgressSnapshot = { attempts: [], concepts: [] }): ProgressStore {
  let attempts = new Map(initial.attempts.map((attempt) => [attempt.id, attempt]));
  let concepts = new Map(initial.concepts.map((concept) => [concept.unitId, concept]));
  return {
    persistent: false,
    async load() {
      return { snapshot: { attempts: [...attempts.values()], concepts: [...concepts.values()] }, skipped: 0 };
    },
    async record(attempt, updates) {
      attempts.set(attempt.id, attempt);
      for (const update of updates) concepts.set(update.unitId, update);
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
      upgrade(database, oldVersion) {
        // One branch per schema version, applied in order, so any older database upgrades step by step.
        if (oldVersion < 1) {
          database.createObjectStore('attempts', { keyPath: 'id' });
          database.createObjectStore('concepts', { keyPath: 'unitId' });
        }
      },
    });
    return new IndexedDbStore(db);
  } catch (error) {
    console.warn('IndexedDB unavailable; progress will not persist', error);
    return createMemoryStore();
  }
}
