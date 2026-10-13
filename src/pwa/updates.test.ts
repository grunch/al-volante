import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeServiceWorker } from '../test/fakeServiceWorker.ts';
import { UPDATE_CHECK_INTERVAL_MS, appUpdates, createUpdateStore } from './updates.ts';

function startedStore(options: { controlled?: boolean } = {}) {
  const worker = fakeServiceWorker(options);
  const store = createUpdateStore(worker.environment);
  store.start(worker.register);
  return { worker, store };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('offline-ready notice', () => {
  it('appears once the first install has cached the app and goes away when dismissed', () => {
    // Arrange
    const { worker, store } = startedStore();
    const initial = store.getSnapshot();

    // Act
    worker.offlineReady();
    const ready = store.getSnapshot();
    store.dismissOfflineReady();

    // Assert
    expect(initial).toEqual({ offlineReady: false, update: null });
    expect(ready).toEqual({ offlineReady: true, update: null });
    expect(store.getSnapshot()).toEqual({ offlineReady: false, update: null });
  });

  it('treats the first claim of a fresh install as no update: nothing to offer and no reload', () => {
    const { worker, store } = startedStore({ controlled: false });

    worker.changeController();

    expect(store.getSnapshot().update).toBeNull();
    expect(worker.reload).not.toHaveBeenCalled();
  });
});

describe('update prompt', () => {
  it('waits for the player: a new version is only offered, never activated on its own', () => {
    const { worker, store } = startedStore({ controlled: true });

    worker.needRefresh();
    worker.needReload();

    expect(store.getSnapshot().update).toBe('waiting');
    expect(worker.activate).not.toHaveBeenCalled();
    expect(worker.reload).not.toHaveBeenCalled();
  });

  it('activates the waiting version on «Actualizar» and reloads once, when it controls the page', () => {
    const { worker, store } = startedStore({ controlled: true });
    worker.needRefresh();

    store.applyUpdate();
    const applying = store.getSnapshot().update;
    const reloadsBeforeControl = worker.reload.mock.calls.length;
    worker.changeController();
    worker.changeController();

    expect(applying).toBe('applying');
    expect(worker.activate).toHaveBeenCalledTimes(1);
    expect(reloadsBeforeControl).toBe(0);
    expect(worker.reload).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the same waiting version is reported again right after «Actualizar»', () => {
    // Arrange: Workbox reports an external worker on 'installed' and again on 'waiting', 200 ms later.
    const { worker, store } = startedStore({ controlled: true });
    worker.needRefresh();
    store.applyUpdate();

    // Act
    worker.needRefresh();
    const afterLateReport = store.getSnapshot().update;
    worker.changeController();

    // Assert
    expect(afterLateReport).toBe('applying');
    expect(worker.reload).toHaveBeenCalledTimes(1);
  });

  it('hides the prompt on «Más tarde» until the version is offered again (the next load)', () => {
    const { worker, store } = startedStore({ controlled: true });
    worker.needRefresh();

    store.dismissUpdate();
    const dismissed = store.getSnapshot().update;
    worker.needRefresh();

    expect(dismissed).toBeNull();
    expect(store.getSnapshot().update).toBe('waiting');
  });

  it('does not reload a tab when the update was accepted in another one, but offers the reload', () => {
    const { worker, store } = startedStore({ controlled: true });
    worker.needRefresh();
    store.dismissUpdate();

    worker.changeController();
    const offered = store.getSnapshot().update;
    store.applyUpdate();

    expect(offered).toBe('activated-elsewhere');
    expect(worker.activate).not.toHaveBeenCalled();
    expect(worker.reload).toHaveBeenCalledTimes(1);
  });

  it('ignores «Actualizar» when no version is waiting', () => {
    const { worker, store } = startedStore({ controlled: true });

    store.applyUpdate();

    expect(worker.activate).not.toHaveBeenCalled();
    expect(store.getSnapshot().update).toBeNull();
  });

  it('ignores «Actualizar» before the service worker is registered', () => {
    const worker = fakeServiceWorker();
    const store = createUpdateStore(worker.environment);

    store.applyUpdate();

    expect(store.getSnapshot().update).toBeNull();
  });

  it('offers the update again when the activation fails, and says why in the console', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { worker, store } = startedStore({ controlled: true });
    const failure = new Error('no waiting worker');
    worker.activate.mockRejectedValueOnce(failure);
    worker.needRefresh();

    store.applyUpdate();
    await vi.waitFor(() => expect(store.getSnapshot().update).toBe('waiting'));

    expect(warn).toHaveBeenCalledWith('Could not activate the new version', failure);
    expect(worker.reload).not.toHaveBeenCalled();
  });
});

describe('exam holds', () => {
  it('defer both notices while an exam runs and bring them back when the last hold is released', () => {
    const { worker, store } = startedStore({ controlled: true });
    const releaseDrive = store.hold();
    const releaseTheory = store.hold();

    worker.offlineReady();
    worker.needRefresh();
    const held = store.getSnapshot();
    releaseDrive();
    releaseDrive();
    const stillHeld = store.getSnapshot();
    releaseTheory();

    expect(held).toEqual({ offlineReady: false, update: null });
    expect(stillHeld).toEqual({ offlineReady: false, update: null });
    expect(store.getSnapshot()).toEqual({ offlineReady: true, update: 'waiting' });
  });

  it('keep a tab mid-exam running when another tab applies the update', () => {
    const { worker, store } = startedStore({ controlled: true });
    worker.needRefresh();
    const release = store.hold();

    worker.changeController();
    const duringExam = store.getSnapshot().update;
    release();

    expect(duringExam).toBeNull();
    expect(worker.reload).not.toHaveBeenCalled();
    expect(store.getSnapshot().update).toBe('activated-elsewhere');
  });
});

describe('subscriptions', () => {
  it('notifies on every visible change only, and stops after unsubscribing', () => {
    const { worker, store } = startedStore({ controlled: true });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    worker.needRefresh();
    worker.needRefresh();
    unsubscribe();
    store.dismissUpdate();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('registration', () => {
  it('registers only once, however many times it is started', () => {
    const { worker, store } = startedStore();

    store.start(worker.register);

    expect(worker.register).toHaveBeenCalledTimes(1);
  });

  it('warns that the app works online only when the registration fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { worker } = startedStore();
    const failure = new TypeError('blocked');

    worker.registerError(failure);

    expect(warn).toHaveBeenCalledWith('Service worker registration failed; the app keeps working online only', failure);
  });

  it('checks for a new version every hour while online, skipping checks offline or during an install', async () => {
    vi.useFakeTimers();
    const { worker } = startedStore({ controlled: true });
    const update = vi.fn(() => Promise.reject(new Error('server down')));
    const registration = { installing: null, update } as unknown as ServiceWorkerRegistration;
    worker.registered(registration);
    worker.registered(undefined);

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    worker.setOnline(false);
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    worker.setOnline(true);
    Object.assign(registration, { installing: {} });
    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);

    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('browser environment', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('follows the real service worker container: controller at start and controller changes', () => {
    // Arrange
    const container = Object.assign(new EventTarget(), { controller: {} });
    Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true });
    const worker = fakeServiceWorker();
    const store = createUpdateStore();
    store.start(worker.register);
    worker.needRefresh();

    // Act
    container.dispatchEvent(new Event('controllerchange'));

    // Assert
    expect(store.getSnapshot().update).toBe('activated-elsewhere');
  });

  it('reads the connection from the browser before each periodic check', async () => {
    vi.useFakeTimers();
    const worker = fakeServiceWorker();
    const store = createUpdateStore();
    store.start(worker.register);
    const update = vi.fn(() => Promise.resolve());
    worker.registered({ installing: null, update } as unknown as ServiceWorkerRegistration);

    await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);

    expect(navigator.onLine).toBe(true);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('starts uncontrolled where the browser has no service workers', () => {
    const worker = fakeServiceWorker();

    appUpdates.start(worker.register);
    worker.offlineReady();

    expect(appUpdates.getSnapshot()).toEqual({ offlineReady: true, update: null });
  });
});
