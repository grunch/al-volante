import { Suspense, lazy } from 'react';
import type { RendererFactory } from '../scene/SceneCanvas.tsx';
import { t } from '../i18n/es-AR.ts';

// Three.js is code-split so the rest of the app never waits for the 3D bundle.
const SceneCanvas = lazy(() => import('../scene/SceneCanvas.tsx').then((module) => ({ default: module.SceneCanvas })));

interface AppProps {
  /** Injected in tests to avoid WebGL; production uses THREE.WebGLRenderer. */
  createRenderer?: RendererFactory;
}

export function App({ createRenderer }: AppProps) {
  return (
    <>
      <a className="skip-link" href="#main">
        {t('skipToContent')}
      </a>
      <header className="app-header">
        <h1 className="app-header__title">{t('appTitle')}</h1>
        <p className="app-header__tagline">{t('appTagline')}</p>
      </header>
      <main id="main" className="app-main" tabIndex={-1}>
        <section aria-labelledby="garage-heading" className="garage">
          <h2 id="garage-heading">{t('garageHeading')}</h2>
          <Suspense
            fallback={
              <div className="scene-canvas" data-state="loading" data-testid="garage-scene">
                <p className="scene-canvas__status">{t('garageSceneLoading')}</p>
              </div>
            }
          >
            <SceneCanvas
              label={t('garageSceneLabel')}
              loadingText={t('garageSceneLoading')}
              unavailableText={t('garageSceneUnavailable')}
              {...(createRenderer ? { createRenderer } : {})}
            />
          </Suspense>
          <p className="garage__status">{t('buildStatus')}</p>
        </section>
      </main>
      <footer className="app-footer">
        <p>{t('footerSources')}</p>
      </footer>
    </>
  );
}
