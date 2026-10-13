import { registerSW } from 'virtual:pwa-register';
import { appUpdates } from './updates.ts';
import type { UpdateStore } from './updates.ts';

/**
 * Registers the generated service worker (vite-plugin-pwa) in production builds. The development server and the
 * tests run without one, so stale caches never hide code changes.
 */
export function startServiceWorker(store: UpdateStore = appUpdates, production = import.meta.env.PROD): void {
  if (!production || !('serviceWorker' in navigator)) return;
  store.start(registerSW);
}
