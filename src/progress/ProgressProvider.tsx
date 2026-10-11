import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityResultContext } from '../activities/ActivityResultContext.ts';
import type { ActivityResult } from '../activities/ActivityResultContext.ts';
import type { Attempt } from '../content/schemas.ts';
import { useContentState } from '../content/ContentProvider.tsx';
import { createAttempt, updateConcept } from './model.ts';
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
      /** Unreadable stored records set aside in quarantine; they are kept untouched. */
      quarantined: number;
      /** The latest attempt could not be saved. */
      saveFailed: boolean;
    };

interface ProgressContextValue {
  state: ProgressState;
  now: () => Date;
  retry: () => void;
  /** Replaces all progress atomically; rejects, leaving progress as it was, when the write fails. */
  replaceAll: (snapshot: ProgressSnapshot) => Promise<void>;
  /** Everything stored right now, other tabs' writes included; what a backup must contain. */
  exportSnapshot: () => Promise<ProgressSnapshot>;
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

/** Tabs of the app announce stored changes on this channel so the others reload. */
export const PROGRESS_CHANNEL = 'al-volante-progress';

/**
 * Loads progress from IndexedDB and records every finished activity. One queue orders loading, answers, refreshes,
 * imports and exports: an answer given while loading is saved once loading ends instead of being dropped. The store
 * computes each concept from its stored value inside the write, and after every write this tab reloads what is
 * stored and tells the other tabs to do the same, so no tab shows, or exports, a stale copy.
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
  /** Shown data; null until loaded, so refreshes never replace an error state. */
  const dataRef = useRef<ProgressData | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const channelRef = useRef<BroadcastChannel | null>(null);

  /** Runs `task` after every queued one; a failing task does not stop the queue. */
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task);
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }, []);

  /** Shows what is stored now, which includes other tabs' writes. */
  const refresh = useCallback(async (store: ProgressStore) => {
    const { snapshot, quarantined } = await store.load();
    if (storeRef.current !== store || !dataRef.current) return;
    const data = toData(snapshot);
    dataRef.current = data;
    setState((previous) => (previous.status === 'ready' ? { ...previous, data, quarantined } : previous));
  }, []);

  const announce = useCallback((store: ProgressStore) => {
    if (store.persistent) channelRef.current?.postMessage('changed');
  }, []);

  useEffect(() => {
    let cancelled = false;
    let store: ProgressStore | null = null;
    // Errors become state, so this never rejects and answers queued behind it still run.
    void enqueue(async () => {
      try {
        const opened = await open();
        // Unmounted while opening (StrictMode runs effects twice): release the connection nobody will use.
        if (cancelled) {
          opened.close();
          return;
        }
        store = opened;
        storeRef.current = opened;
        const { snapshot, quarantined } = await opened.load();
        if (cancelled) return;
        const data = toData(snapshot);
        dataRef.current = data;
        setState({ status: 'ready', data, persistent: opened.persistent, quarantined, saveFailed: false });
      } catch (error) {
        if (cancelled) return;
        console.error('Could not load progress', error);
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) });
      }
    });
    return () => {
      cancelled = true;
      storeRef.current = null;
      dataRef.current = null;
      store?.close();
    };
  }, [open, loadCount, enqueue]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(PROGRESS_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = () => {
      void enqueue(async () => {
        const store = storeRef.current;
        if (store) await refresh(store).catch((error: unknown) => console.error('Could not refresh progress', error));
      });
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [enqueue, refresh]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setLoadCount((count) => count + 1);
  }, []);

  const contentVersion = content.status === 'ready' ? content.version : null;
  const record = useCallback(
    (result: ActivityResult) => {
      notifyParent(result);
      if (contentVersion === null) return;
      void enqueue(async () => {
        const store = storeRef.current;
        // No store means it could not be opened; the logbook shows that error.
        if (!store) return;
        const at = now().toISOString();
        const { correct } = result.evaluation;
        const attempt = createAttempt(
          {
            activityId: result.activity.id,
            unitIds: result.activity.unitIds,
            variantId: result.evaluation.variantId,
            seed: result.presentation.seed,
            response: result.response,
            correct,
            score: result.evaluation.score,
            mode: 'practice',
          },
          { id: createId(), at, contentVersion },
        );
        let updates: ConceptProgress[];
        try {
          updates = await store.record(attempt, result.activity.unitIds, (unitId, previous) =>
            updateConcept(previous, unitId, correct, at),
          );
        } catch (error) {
          console.error('Could not save the attempt', error);
          setState((previous) => (previous.status === 'ready' ? { ...previous, saveFailed: true } : previous));
          return;
        }
        announce(store);
        setState((previous) => (previous.status === 'ready' ? { ...previous, saveFailed: false } : previous));
        try {
          await refresh(store);
        } catch (error) {
          // Saved, but reading back failed: at least show this tab's own answer.
          console.error('Could not refresh progress', error);
          const data = dataRef.current;
          if (storeRef.current !== store || !data) return;
          const next = withAttempt(data, attempt, updates);
          dataRef.current = next;
          setState((previous) => (previous.status === 'ready' ? { ...previous, data: next } : previous));
        }
      });
    },
    [notifyParent, contentVersion, createId, now, enqueue, announce, refresh],
  );

  const replaceAll = useCallback(
    (snapshot: ProgressSnapshot) =>
      enqueue(async () => {
        const store = storeRef.current;
        if (!store) throw new Error('Progress is not loaded');
        await store.replaceAll(snapshot);
        announce(store);
        const next = toData(snapshot);
        dataRef.current = next;
        setState((previous) =>
          previous.status === 'ready' ? { ...previous, data: next, saveFailed: false } : previous,
        );
      }),
    [enqueue, announce],
  );

  const exportSnapshot = useCallback(
    () =>
      enqueue(async () => {
        const store = storeRef.current;
        if (!store) throw new Error('Progress is not loaded');
        return (await store.load()).snapshot;
      }),
    [enqueue],
  );

  const value = useMemo(
    () => ({ state, now, retry, replaceAll, exportSnapshot }),
    [state, now, retry, replaceAll, exportSnapshot],
  );
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
