import type { ReactNode } from 'react';
import { PWA_COPY } from '../i18n/es-AR.ts';
import { useOnlineStatus } from './useOnlineStatus.ts';

/**
 * A link that leaves the app (official PDFs, government pages) in a new tab. It is the only content the app cannot
 * keep offline, so without a connection the link says that it needs one.
 */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const online = useOnlineStatus();
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      {!online && (
        <>
          {' '}
          <span className="external-link__offline">{PWA_COPY.needsConnection}</span>
        </>
      )}
    </a>
  );
}
