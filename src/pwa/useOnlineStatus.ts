import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const isOnline = () => navigator.onLine;

/**
 * Whether the browser reports a network connection. `navigator.onLine` can be true on a network without internet;
 * the app does not depend on it (everything but external links is cached), it only tells the player.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, isOnline);
}
