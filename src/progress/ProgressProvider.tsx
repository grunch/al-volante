import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityResultContext } from '../activities/ActivityResultContext.ts';
import type { ActivityResult } from '../activities/ActivityResultContext.ts';
import type { Attempt } from '../content/schemas.ts';
import { useContentState } from '../content/ContentProvider.tsx';
import { recordAnswer } from './model.ts';
import type { ConceptProgress } from './model.ts';
import { openProgressStore } from './storage.ts';
import type { ProgressSnapshot, ProgressStore } from './storage.ts';

export interface ProgressData {
  attempts: readonly Attempt[];
  concepts: ReadonlyMap<string, ConceptProgress>;
}

export type ProgressState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      data: ProgressData;
      /** False when the browser cannot store data (IndexedDB unavailable): progress lasts until the tab closes. */
      persistent: boolean;
      /** Stored records that could not be read; they stay in the database untouched. */
      skipped: number;
      /** The latest attempt could not be saved. */
      saveFailed: boolean;
    };

interface ProgressContextValue {
  state: ProgressState;
  now: () => Date;
  retry: () => void;
  /** Replaces all progress atomically; rejects, leaving progress as it was, when the write fails. */
  replaceAll: (snapshot: ProgressSnapshot) => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

interface ProgressProviderProps {
  children: ReactNode;
  /** Injected in tests; read once on mount. */
  openStore?: () => Promise<ProgressStore>;
  now?: () => Date;
  createId?: () => string;
}

const defaultNow = () => new Date();

function defaultId(): string {
  // randomUUID only exists in secure contexts (https, localhost); fall back elsewhere.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function toData(snapshot: ProgressSnapshot): ProgressData {
  return {
    attempts: snapshot.attempts,
    concepts: new Map(snapshot.concepts.map((concept) => [concept.unitId, concept])),
  };
}

function withAttempt(data: ProgressData, attempt: Attempt, updates: readonly ConceptProgress[]): ProgressData {
  return {
    attempts: [...data.attempts, attempt],
    concepts: new Map([...data.concepts, ...updates.map((update) => [update.unitId, update] as const)]),
  };
}

/**
 * Loads progress from IndexedDB and records every finished activity. Writes are queued so each answer builds on the
 * previous one. While progress is not loaded nothing is written: updating concepts from an empty state would
 * overwrite the stored ones.
 */
export function ProgressProvider({
  children,
  openStore = openProgressStore,
  now = defaultNow,
  createId = defaultId,
}: ProgressProviderProps) {
  const content = useContentState();
  const notifyParent = useContext(ActivityResultContext);
  const [open] = useState(() => openStore);
  const [state, setState] = useState<ProgressState>({ status: 'loading' });
  const [loadCount, setLoadCount] = useState(0);
  const storeRef = useRef<ProgressStore | null>(null);
  const dataRef = useRef<ProgressData | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    let store: ProgressStore | null = null;
    void (async () => {
      try {
        const opened = await open();
        // Unmounted while opening (StrictMode runs effects twice): release the connection nobody will use.
        if (cancelled) {
          opened.close();
          return;
        }
        store = opened;
        const { snapshot, skipped } = await store.load();
        if (cancelled) return;
        const data = toData(snapshot);
        storeRef.current = store;
        dataRef.current = data;
        setState({ status: 'ready', data, persistent: store.persistent, skipped, saveFailed: false });
      } catch (error) {
        if (cancelled) return;
        console.error('Could not load progress', error);
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
      storeRef.current = null;
      dataRef.current = null;
      store?.close();
    };
  }, [open, loadCount]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setLoadCount((count) => count + 1);
  }, []);

  const contentVersion = content.status === 'ready' ? content.version : null;
  const record = useCallback(
    (result: ActivityResult) => {
      notifyParent(result);
      if (contentVersion === null) return;
      queueRef.current = queueRef.current.then(async () => {
        const store = storeRef.current;
        const data = dataRef.current;
        if (!store || !data) return;
        const { attempt, updates } = recordAnswer(
          {
            activityId: result.activity.id,
            unitIds: result.activity.unitIds,
            variantId: result.evaluation.variantId,
            seed: result.presentation.seed,
            response: result.response,
            correct: result.evaluation.correct,
            score: result.evaluation.score,
            mode: 'practice',
          },
          data.concepts,
          { id: createId(), at: now().toISOString(), contentVersion },
        );
        try {
          await store.record(attempt, updates);
        } catch (error) {
          console.error('Could not save the attempt', error);
          setState((previous) => (previous.status === 'ready' ? { ...previous, saveFailed: true } : previous));
          return;
        }
        if (storeRef.current !== store) return;
        const next = withAttempt(data, attempt, updates);
        dataRef.current = next;
        setState((previous) =>
          previous.status === 'ready' ? { ...previous, data: next, saveFailed: false } : previous,
        );
      });
    },
    [notifyParent, contentVersion, createId, now],
  );

  const replaceAll = useCallback((snapshot: ProgressSnapshot) => {
    const run = queueRef.current.then(async () => {
      const store = storeRef.current;
      if (!store) throw new Error('Progress is not loaded');
      await store.replaceAll(snapshot);
      const next = toData(snapshot);
      dataRef.current = next;
      // Replacing clears the store, unreadable records included.
      setState((previous) =>
        previous.status === 'ready' ? { ...previous, data: next, skipped: 0, saveFailed: false } : previous,
      );
    });
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const value = useMemo(() => ({ state, now, retry, replaceAll }), [state, now, retry, replaceAll]);
  return (
    <ProgressContext.Provider value={value}>
      <ActivityResultContext.Provider value={record}>{children}</ActivityResultContext.Provider>
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('useProgress must be used inside <ProgressProvider>');
  return value;
}
