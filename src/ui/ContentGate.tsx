import type { ReactNode } from 'react';
import { useContentState } from '../content/ContentProvider.tsx';
import type { Content } from '../content/validate.ts';
import { t } from '../i18n/es-AR.ts';

/** Renders its children only with validated content; otherwise an accessible loading or error state. */
export function ContentGate({ children }: { children: (content: Content) => ReactNode }) {
  const state = useContentState();
  if (state.status === 'loading') {
    return (
      <p className="status-message" role="status">
        {t('contentLoading')}
      </p>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="status-message status-message--error" role="alert">
        <p>{t('contentError')}</p>
        <details>
          <summary>{t('contentErrorDetails')}</summary>
          <ul>
            {state.errors.slice(0, 20).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </details>
        <button type="button" className="button" onClick={state.retry}>
          {t('retry')}
        </button>
      </div>
    );
  }
  return <>{children(state.content)}</>;
}
