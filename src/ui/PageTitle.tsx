import { useEffect } from 'react';
import { t } from '../i18n/es-AR.ts';

/** The page's single h1; the layout moves focus here after client-side navigation. */
export function PageTitle({ children, documentTitle }: { children: string; documentTitle?: string }) {
  useEffect(() => {
    const base = t('appTitle');
    const title = documentTitle ?? children;
    document.title = title === base ? base : `${title} · ${base}`;
  }, [children, documentTitle]);
  return (
    <h1 id="page-title" tabIndex={-1}>
      {children}
    </h1>
  );
}
