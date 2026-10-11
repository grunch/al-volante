import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { loadContent } from './catalog.ts';
import type { Content, ContentResult } from './validate.ts';

export type ContentState =
  | { status: 'loading' }
  | { status: 'error'; errors: string[]; retry: () => void }
  | { status: 'ready'; content: Content; version: string };

const ContentContext = createContext<ContentState | null>(null);

interface ContentProviderProps {
  children: ReactNode;
  /** Injected in tests; production loads and validates the bundled catalogs. */
  load?: () => Promise<ContentResult>;
}

/** Loads the validated content once and shares it; exposes loading and error states with a retry. */
export function ContentProvider({ children, load = loadContent }: ContentProviderProps) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ContentResult | { failure: string } | null>(null);
  const retry = useCallback(() => {
    setResult(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().then(
      (loaded) => {
        if (!cancelled) setResult(loaded);
      },
      (error: unknown) => {
        if (!cancelled) setResult({ failure: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [load, attempt]);

  let state: ContentState;
  if (result === null) state = { status: 'loading' };
  else if ('failure' in result) state = { status: 'error', errors: [result.failure], retry };
  else if (!result.ok) state = { status: 'error', errors: result.errors, retry };
  else state = { status: 'ready', content: result.content, version: result.version };

  return <ContentContext.Provider value={state}>{children}</ContentContext.Provider>;
}

export function useContentState(): ContentState {
  const state = useContext(ContentContext);
  if (!state) throw new Error('useContentState must be used inside <ContentProvider>');
  return state;
}
