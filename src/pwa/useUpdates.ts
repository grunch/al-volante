import { useEffect, useSyncExternalStore } from 'react';
import { appUpdates } from './updates.ts';
import type { UpdateSnapshot, UpdateStore } from './updates.ts';

/** The notices to show, re-rendering when they change. */
export function useUpdateSnapshot(store: UpdateStore = appUpdates): UpdateSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

/**
 * Defers the update prompt and the offline notice while `active` (a running driving or theory exam): the page never
 * offers, let alone performs, a reload in the middle of an exam.
 */
export function useUpdateHold(active: boolean, store: UpdateStore = appUpdates): void {
  useEffect(() => (active ? store.hold() : undefined), [active, store]);
}

/** Makes activating a new version, and the reload after it, wait until `wait()` settles (progress being saved). */
export function useReloadGuard(wait: () => Promise<unknown>, store: UpdateStore = appUpdates): void {
  useEffect(() => store.guardReload(wait), [wait, store]);
}
