import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/** The plugin's `registerSW` (virtual:pwa-register): returns the function that activates the waiting worker. */
export type RegisterServiceWorker = (options: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

/**
 * The update notice to show: a new version `waiting` for the player's consent, `applying` it after «Actualizar», or
 * already `activated-elsewhere` (the player accepted it in another tab, so this page runs the old code until reloaded).
 */
export type UpdateNotice = 'waiting' | 'applying' | 'activated-elsewhere';

export interface UpdateSnapshot {
  /** The one-time notice that the app finished caching itself and works offline. */
  readonly offlineReady: boolean;
  /** The update notice to show, or null. */
  readonly update: UpdateNotice | null;
}

/** What the store needs from the browser; tests pass a fake. */
export interface ServiceWorkerEnvironment {
  /** True when a service worker already controlled the page at start (an installed app, not the first visit). */
  isControlled(): boolean;
  onControllerChange(listener: () => void): void;
  isOnline(): boolean;
  reload(): void;
}

export interface UpdateStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): UpdateSnapshot;
  /** Registers the service worker; only the first call does anything. */
  start(register: RegisterServiceWorker): void;
  /** «Actualizar»: activates the waiting version and reloads this page once it controls it. */
  applyUpdate(): void;
  /** «Más tarde»: hides the prompt in this page; it comes back on the next load while the version still waits. */
  dismissUpdate(): void;
  dismissOfflineReady(): void;
  /**
   * Defers both notices while a driving or theory exam runs, so nothing invites a reload in the middle of it.
   * Returns the release; the notices reappear when the last hold is released.
   */
  hold(): () => void;
}

/** A tab left open (hash routes never navigate) still learns about new versions. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const browserEnvironment: ServiceWorkerEnvironment = {
  isControlled: () => Boolean(navigator.serviceWorker?.controller),
  onControllerChange: (listener) => navigator.serviceWorker?.addEventListener('controllerchange', listener),
  isOnline: () => navigator.onLine,
  reload: () => window.location.reload(),
};

interface State {
  offlineReady: boolean;
  pending: 'none' | UpdateNotice;
  updateDismissed: boolean;
  holds: number;
}

export function createUpdateStore(environment: ServiceWorkerEnvironment = browserEnvironment): UpdateStore {
  let state: State = { offlineReady: false, pending: 'none', updateDismissed: false, holds: 0 };
  let snapshot: UpdateSnapshot = { offlineReady: false, update: null };
  const listeners = new Set<() => void>();
  let activate: ((reloadPage?: boolean) => Promise<void>) | undefined;
  let reloading = false;

  const setState = (changes: Partial<State>) => {
    state = { ...state, ...changes };
    const free = state.holds === 0;
    const update = free && !state.updateDismissed && state.pending !== 'none' ? state.pending : null;
    const offlineReady = free && state.offlineReady;
    if (update === snapshot.update && offlineReady === snapshot.offlineReady) return;
    snapshot = { offlineReady, update };
    listeners.forEach((listener) => listener());
  };

  const reloadOnce = () => {
    if (reloading) return;
    reloading = true;
    environment.reload();
  };

  const checkPeriodically = (registration: ServiceWorkerRegistration) => {
    setInterval(() => {
      if (!environment.isOnline() || registration.installing) return;
      // A failed check (server down, flaky network) changes nothing; the next one retries.
      registration.update().catch(() => undefined);
    }, UPDATE_CHECK_INTERVAL_MS);
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start(register) {
      if (activate) return;
      let controlled = environment.isControlled();
      environment.onControllerChange(() => {
        // Only the page where the player chose «Actualizar» reloads. Any other tab keeps running, even mid-exam,
        // and offers the reload instead. The first claim of a fresh install is no update at all.
        if (state.pending === 'applying') reloadOnce();
        else if (controlled) setState({ pending: 'activated-elsewhere', updateDismissed: false });
        controlled = true;
      });
      activate = register({
        // Workbox reports an external worker twice ('installed', then 'waiting' 200 ms later): a late report must
        // not undo «Actualizar», or this page would take its own reload for another tab's and never reload.
        onNeedRefresh: () => {
          if (state.pending !== 'applying') setState({ pending: 'waiting', updateDismissed: false });
        },
        onOfflineReady: () => setState({ offlineReady: true }),
        // The controller-change listener above decides; without this callback the plugin would reload every tab.
        onNeedReload: () => undefined,
        onRegisteredSW: (_url, registration) => {
          if (registration) checkPeriodically(registration);
        },
        onRegisterError: (error: unknown) => {
          console.warn('Service worker registration failed; the app keeps working online only', error);
        },
      });
    },
    applyUpdate() {
      if (state.pending === 'activated-elsewhere') return reloadOnce();
      if (state.pending !== 'waiting' || !activate) return;
      setState({ pending: 'applying' });
      activate().catch((error: unknown) => {
        console.warn('Could not activate the new version', error);
        setState({ pending: 'waiting' });
      });
    },
    dismissUpdate: () => setState({ updateDismissed: true }),
    dismissOfflineReady: () => setState({ offlineReady: false }),
    hold() {
      setState({ holds: state.holds + 1 });
      let released = false;
      return () => {
        if (released) return;
        released = true;
        setState({ holds: state.holds - 1 });
      };
    },
  };
}

/** The app's store, started by main.tsx in production builds. */
export const appUpdates = createUpdateStore();
