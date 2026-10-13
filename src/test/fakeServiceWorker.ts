import { vi } from 'vitest';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import type { RegisterServiceWorker, ServiceWorkerEnvironment } from '../pwa/updates.ts';

/**
 * Stands in for the browser and for vite-plugin-pwa's `registerSW`: the test fires the plugin callbacks and the
 * controller changes itself, and reads what the store asked for (activation, reloads).
 */
export function fakeServiceWorker({ controlled = false } = {}) {
  let options: RegisterSWOptions | undefined;
  let online = true;
  const controllerListeners: Array<() => void> = [];
  const activate = vi.fn<(reloadPage?: boolean) => Promise<void>>(() => Promise.resolve());
  const reload = vi.fn();
  const register = vi.fn<RegisterServiceWorker>((registerOptions) => {
    options = registerOptions;
    return activate;
  });
  const environment: ServiceWorkerEnvironment = {
    isControlled: () => controlled,
    onControllerChange: (listener) => controllerListeners.push(listener),
    isOnline: () => online,
    reload,
  };
  const registered = (): RegisterSWOptions => {
    if (!options) throw new Error('The store has not registered the service worker yet');
    return options;
  };
  return {
    environment,
    register,
    activate,
    reload,
    /** The plugin found a new version waiting (or one left waiting by an earlier visit). */
    needRefresh: () => registered().onNeedRefresh?.(),
    /** The first install finished caching the app. */
    offlineReady: () => registered().onOfflineReady?.(),
    /** The plugin would reload: a new worker took control after an update. */
    needReload: () => registered().onNeedReload?.(),
    registered: (registration?: ServiceWorkerRegistration) => registered().onRegisteredSW?.('./sw.js', registration),
    registerError: (error: unknown) => registered().onRegisterError?.(error),
    /** A new worker took control of the page (`controllerchange`). */
    changeController: () => controllerListeners.forEach((listener) => listener()),
    setOnline: (value: boolean) => {
      online = value;
    },
  };
}
