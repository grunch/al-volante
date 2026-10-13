import { useState } from 'react';
import { RouterProvider, createHashRouter } from 'react-router';
import type { createMemoryRouter } from 'react-router';
import { ContentProvider } from '../content/ContentProvider.tsx';
import { ProgressProvider } from '../progress/ProgressProvider.tsx';
import { PwaStatus } from '../pwa/PwaStatus.tsx';
import type { ProgressStore } from '../progress/storage.ts';
import type { ContentResult } from '../content/validate.ts';
import { RendererContext } from '../scene/RendererContext.ts';
import type { RendererFactory } from '../scene/SceneCanvas.tsx';
import { routes } from './routes.tsx';

type AppRouter = ReturnType<typeof createHashRouter> | ReturnType<typeof createMemoryRouter>;

interface AppProps {
  /** Tests inject a memory router; the app uses hash URLs so it works on any static host and offline. */
  router?: AppRouter;
  /** Tests inject a fake renderer to avoid WebGL. */
  createRenderer?: RendererFactory;
  /** Tests inject content; the app loads and validates the bundled catalogs. */
  loadContent?: () => Promise<ContentResult>;
  /** Tests inject a progress store and a clock; the app uses IndexedDB and the real time. */
  openProgressStore?: () => Promise<ProgressStore>;
  now?: () => Date;
}

export function App({ router, createRenderer, loadContent, openProgressStore, now }: AppProps) {
  const [appRouter] = useState(() => router ?? createHashRouter(routes));
  return (
    <ContentProvider {...(loadContent ? { load: loadContent } : {})}>
      <ProgressProvider {...(openProgressStore ? { openStore: openProgressStore } : {})} {...(now ? { now } : {})}>
        <RendererContext.Provider value={createRenderer}>
          <RouterProvider router={appRouter} />
          <PwaStatus />
        </RendererContext.Provider>
      </ProgressProvider>
    </ContentProvider>
  );
}
