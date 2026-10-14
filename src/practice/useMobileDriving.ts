import { useEffect, useRef, useState } from 'react';
import { isMobileDriving, MOBILE_QUERY } from './mobileDriving.ts';
import { MobileSession } from './mobileSession.ts';
import type { MobileSnapshot } from './mobileSession.ts';

export function useMobileDriving() {
  const [enabled, setEnabled] = useState(isMobileDriving);
  const [snapshot, setSnapshot] = useState<MobileSnapshot | null>(null);
  const session = useRef<MobileSession | null>(null);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(MOBILE_QUERY);
    const change = () => setEnabled(query.matches);
    query.addEventListener('change', change);
    return () => query.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const mobile = new MobileSession(setSnapshot);
    session.current = mobile;
    let live = true;
    queueMicrotask(() => {
      if (live) setSnapshot(mobile.snapshot);
    });
    const suspend = () => mobile.suspend();
    const resume = () => {
      if (!document.hidden) mobile.resume();
    };
    const visibility = () => (document.hidden ? suspend() : resume());
    window.addEventListener('blur', suspend);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', suspend);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visibility);
      live = false;
      mobile.dispose();
      session.current = null;
    };
  }, [enabled]);
  return { session, snapshot: enabled ? snapshot : null };
}
