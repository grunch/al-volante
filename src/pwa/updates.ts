import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

/** The plugin's `registerSW` (virtual:pwa-register): returns the function that activates the waiting worker. */
export type RegisterServiceWorker = (options: RegisterSWOptions) => (reloadPage?: boolean) => Promise<void>;

/**
 * The update notice to show: a new version `waiting` for the player's consent, `applying` it after «Actualizar», or
 * already `activated-elsewhere` (the player accepted it in another tab, so this page runs the old code until reloaded).
 */
export type UpdateNotice = 'waiting' | 'applying' | 'activated-elsewhere';

/**
 * Whether this page works offline: `ready` once a service worker controls it, `failed` when the registration failed
 * and none does, `pending` before that (installing, the development server, tests or browsers without workers).
 */
export type OfflineSupport = 'pending' | 'ready' | 'failed';

export interface UpdateSnapshot {
  /** The one-time notice that the app finished caching itself and works offline. */
  readonly offlineReady: boolean;
  /** The update notice to show, or null. */
  readonly update: UpdateNotice | null;
  readonly offline: OfflineSupport;
  /** The notice that offline use could not be prepared, with «Reintentar». */
  readonly registrationFailed: boolean;
}

/** What the store needs from the browser; tests pass a fake. */
export interface ServiceWorkerEnvironment {
  /** True when a service worker controls the page (an installed app, not the first visit). */
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
  /** «Reintentar» after a failed registration. */
  retryRegistration(): void;
  dismissRegistrationFailure(): void;
  /**
   * «Actualizar»: once every guarded write has settled, activates the waiting version, and reloads this page once it
   * controls it (again after the guarded writes).
   */
  applyUpdate(): void;
  /** «Más tarde»: hides the prompt for this version; a newer one, or the next load, shows it again. */
  dismissUpdate(): void;
  dismissOfflineReady(): void;
  /**
   * Defers the notices while a driving or theory exam runs, so nothing invites a reload in the middle of it.
   * Returns the release; the notices reappear when the last hold is released.
   */
  hold(): () => void;
  /**
   * Work a reload must not cut, such as progress still being written to IndexedDB: activation and reload wait until
   * `wait()` settles, also when it rejects. Returns the unregistration.
   */
  guardReload(wait: () => Promise<unknown>): () => void;
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
  offline: OfflineSupport;
  failureDismissed: boolean;
  holds: number;
}

function snapshotOf(state: State): UpdateSnapshot {
  const free = state.holds === 0;
  return {
    offlineReady: free && state.offlineReady && state.offline === 'ready',
    update: free && !state.updateDismissed && state.pending !== 'none' ? state.pending : null,
    offline: state.offline,
    registrationFailed: free && state.offline === 'failed' && !state.failureDismissed,
  };
}

const sameSnapshot = (a: UpdateSnapshot, b: UpdateSnapshot) =>
  a.offlineReady === b.offlineReady &&
  a.update === b.update &&
  a.offline === b.offline &&
  a.registrationFailed === b.registrationFailed;

export function createUpdateStore(environment: ServiceWorkerEnvironment = browserEnvironment): UpdateStore {
  let state: State = {
    offlineReady: false,
    pending: 'none',
    updateDismissed: false,
    offline: 'pending',
    failureDismissed: false,
    holds: 0,
  };
  let snapshot = snapshotOf(state);
  const listeners = new Set<() => void>();
  const guards = new Set<() => Promise<unknown>>();
  let register: RegisterServiceWorker | undefined;
  let activate: ((reloadPage?: boolean) => Promise<void>) | undefined;
  let registration: ServiceWorkerRegistration | undefined;
  /** The waiting worker the player put off with «Más tarde». */
  let dismissedWorker: ServiceWorker | null = null;
  let checking = false;
  let reloading = false;

  const setState = (changes: Partial<State>) => {
    state = { ...state, ...changes };
    const next = snapshotOf(state);
    if (sameSnapshot(next, snapshot)) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  /** Settles every guarded write; never rejects, so a failed save cannot block the update forever. */
  const settleGuards = () => Promise.allSettled([...guards].map((wait) => Promise.resolve().then(wait)));

  const reloadWhenSafe = () => {
    if (reloading) return;
    reloading = true;
    // A reload aborts the IndexedDB transactions in flight: the attempt of an exam that just ended is stored first.
    void settleGuards().then(() => {
      if (state.holds === 0) return environment.reload();
      // An exam started meanwhile is never cut: the page offers the reload once it is over.
      reloading = false;
      setState({ pending: 'activated-elsewhere', updateDismissed: false });
    });
  };

  const checkPeriodically = (registered: ServiceWorkerRegistration) => {
    if (checking) return;
    checking = true;
    setInterval(() => {
      if (!environment.isOnline() || registered.installing) return;
      // A failed check (server down, flaky network) changes nothing; the next one retries.
      registered.update().catch(() => undefined);
    }, UPDATE_CHECK_INTERVAL_MS);
  };

  const registerWorker = (registerSW: RegisterServiceWorker) => {
    activate = registerSW({
      onNeedRefresh: () => {
        // A late report must not undo «Actualizar», or this page would take its own reload for another tab's.
        if (state.pending === 'applying') return;
        // Workbox reports an external worker twice ('installed', then 'waiting' 200 ms later): only a different
        // waiting worker, a newer version, undoes «Más tarde».
        const waiting = registration?.waiting ?? null;
        if (state.updateDismissed && waiting !== null && waiting === dismissedWorker) return;
        setState({ pending: 'waiting', updateDismissed: false });
      },
      onOfflineReady: () => setState({ offlineReady: true, offline: 'ready' }),
      // The controller-change listener decides; without this callback the plugin would reload every tab.
      onNeedReload: () => undefined,
      onRegisteredSW: (_url, registered) => {
        if (!registered) return;
        registration = registered;
        checkPeriodically(registered);
      },
      onRegisterError: (error: unknown) => {
        console.warn('Service worker registration failed; the app keeps working online only', error);
        // A worker installed on an earlier visit still serves this page offline; otherwise nothing does.
        if (!environment.isControlled()) setState({ offline: 'failed', offlineReady: false, failureDismissed: false });
      },
    });
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start(registerSW) {
      if (register) return;
      register = registerSW;
      let controlled = environment.isControlled();
      if (controlled) setState({ offline: 'ready' });
      environment.onControllerChange(() => {
        // Only the page where the player chose «Actualizar» reloads. Any other tab keeps running, even mid-exam,
        // and offers the reload instead. The first claim of a fresh install is no update at all.
        if (state.pending === 'applying') reloadWhenSafe();
        else if (controlled) setState({ pending: 'activated-elsewhere', updateDismissed: false });
        controlled = true;
        setState({ offline: 'ready' });
      });
      registerWorker(registerSW);
    },
    retryRegistration() {
      if (state.offline !== 'failed' || !register) return;
      setState({ offline: 'pending', failureDismissed: false });
      registerWorker(register);
    },
    dismissRegistrationFailure: () => setState({ failureDismissed: true }),
    applyUpdate() {
      if (state.pending === 'activated-elsewhere') return reloadWhenSafe();
      const activateWaiting = activate;
      if (state.pending !== 'waiting' || !activateWaiting) return;
      setState({ pending: 'applying' });
      // The attempt of an exam that just ended may still be saving: the new version takes over after it.
      settleGuards()
        .then(() => {
          // A drive or mock exam started while the save was settling: the new version waits for a new «Actualizar».
          if (state.holds > 0) {
            setState({ pending: 'waiting', updateDismissed: false });
            return;
          }
          return activateWaiting();
        })
        .catch((error: unknown) => {
          console.warn('Could not activate the new version', error);
          setState({ pending: 'waiting' });
        });
    },
    dismissUpdate() {
      dismissedWorker = registration?.waiting ?? null;
      setState({ updateDismissed: true });
    },
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
    guardReload(wait) {
      guards.add(wait);
      return () => {
        guards.delete(wait);
      };
    },
  };
}

/** The app's store, started by main.tsx in production builds. */
export const appUpdates = createUpdateStore();
