import { PWA_COPY } from '../i18n/es-AR.ts';
import { useProgress } from '../progress/ProgressProvider.tsx';
import { appUpdates } from './updates.ts';
import type { UpdateStore } from './updates.ts';
import { useOnlineStatus } from './useOnlineStatus.ts';
import { useReloadGuard, useUpdateSnapshot } from './useUpdates.ts';
import './pwa.css';

/**
 * Non-blocking notices of the installable app, fixed at the bottom of the screen: the offline indicator, the one-time
 * «works offline» notice and the update prompt. Each message is a polite status (announced without moving the focus);
 * the buttons follow the page in the tab order. Nothing here reloads the page unless the player chooses «Actualizar».
 */
export function PwaStatus({ store = appUpdates }: { store?: UpdateStore }) {
  const online = useOnlineStatus();
  const { offlineReady, update, offline, registrationFailed } = useUpdateSnapshot(store);
  return (
    <div className="pwa-status">
      {!online && (
        <p className="pwa-status__offline" role="status">
          {/* Only a page a service worker controls is sure to keep working without a connection. */}
          {offline === 'ready' ? PWA_COPY.offline : PWA_COPY.offlineNotReady}
        </p>
      )}
      {registrationFailed && (
        <section className="pwa-toast" aria-labelledby="pwa-registration-failed">
          <p id="pwa-registration-failed" className="pwa-toast__text" role="status">
            {PWA_COPY.registrationFailed}
          </p>
          <p className="pwa-toast__actions">
            <button type="button" className="button" onClick={store.retryRegistration}>
              {PWA_COPY.retry}
            </button>
            <button type="button" className="button button--secondary" onClick={store.dismissRegistrationFailure}>
              {PWA_COPY.close}
            </button>
          </p>
        </section>
      )}
      {offlineReady && (
        <section className="pwa-toast" aria-labelledby="pwa-offline-ready">
          <p id="pwa-offline-ready" className="pwa-toast__text" role="status">
            {PWA_COPY.offlineReady}
          </p>
          <p className="pwa-toast__actions">
            <button type="button" className="button button--secondary" onClick={store.dismissOfflineReady}>
              {PWA_COPY.gotIt}
            </button>
          </p>
        </section>
      )}
      {update && (
        <section className="pwa-toast" aria-labelledby="pwa-update">
          <p id="pwa-update" className="pwa-toast__text" role="status">
            {update === 'activated-elsewhere' ? PWA_COPY.updateActivatedElsewhere : PWA_COPY.updateAvailable}
          </p>
          <p className="pwa-toast__actions">
            <button type="button" className="button" onClick={store.applyUpdate} aria-disabled={update === 'applying'}>
              {update === 'applying' ? PWA_COPY.updating : PWA_COPY.update}
            </button>
            {update !== 'applying' && (
              <button type="button" className="button button--secondary" onClick={store.dismissUpdate}>
                {PWA_COPY.later}
              </button>
            )}
          </p>
        </section>
      )}
    </div>
  );
}

/**
 * The app's notices, inside ProgressProvider: a new version activates, and the page reloads, only once the progress
 * queued for saving (the attempt of an exam that just ended) is written, so no reload aborts that IndexedDB write.
 */
export function AppPwaStatus() {
  const { whenIdle } = useProgress();
  useReloadGuard(whenIdle);
  return <PwaStatus />;
}
