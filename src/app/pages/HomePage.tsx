import { Suspense, lazy, useContext } from 'react';
import { Link } from 'react-router';
import { RendererContext } from '../../scene/RendererContext.ts';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { DRIVING_MODES, slugOfMode } from '../../exam/modes.ts';
import { EXAM_COPY, HOME_SPACES, TRACK_COPY, CITY_COPY, t } from '../../i18n/es-AR.ts';
import type { HomeSpaceId } from '../../i18n/es-AR.ts';

// Three.js is code-split so the rest of the app never waits for the 3D bundle.
const SceneCanvas = lazy(() =>
  import('../../scene/SceneCanvas.tsx').then((module) => ({ default: module.SceneCanvas })),
);

/** Routes of the spaces that already exist; the others are shown as coming soon. */
const SPACE_ROUTES: Partial<Record<HomeSpaceId, string>> = {
  garage: '/garaje',
  city: '/actividades',
  // Route A from the cabin, with an instructor (learn, practice, run) or as a mock exam (exam): F04-T03 to F04-T05.
  route: '/examen/practico',
  exam: '/examen/teorico',
  logbook: '/bitacora',
};

export function HomePage() {
  const createRenderer = useContext(RendererContext);
  return (
    <>
      <PageTitle documentTitle={t('appTitle')}>{t('garageHeading')}</PageTitle>
      <p className="lead">{t('appTagline')}</p>
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
      <p>{t('homeIntro')}</p>
      <p>
        <Link className="button" to="/mapa">
          {t('navMap')}
        </Link>{' '}
        <Link className="button button--secondary" to="/biblioteca">
          {t('navLibrary')}
        </Link>{' '}
      </p>
      <section aria-labelledby="driving-heading" data-testid="home-driving">
        <h2 id="driving-heading">{EXAM_COPY.homeDriving}</h2>
        <p>{EXAM_COPY.homeDrivingIntro}</p>
        <p>
          <Link className="button button--secondary" to="/pista">
            {TRACK_COPY.homeLink}
          </Link>{' '}
          <Link className="button button--secondary" to="/recorrido">
            {CITY_COPY.homeLink}
          </Link>{' '}
          <Link className="button" to="/examen/practico">
            {EXAM_COPY.homeLink}
          </Link>
        </p>
        <ul className="home-modes">
          {DRIVING_MODES.map((mode) => (
            <li key={mode}>
              <Link to={`/examen/practico?modo=${slugOfMode(mode)}`}>{EXAM_COPY.homeModes[mode]}</Link>:{' '}
              {EXAM_COPY.modeHelp[mode]}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="spaces-heading">
        <h2 id="spaces-heading">{t('spacesHeading')}</h2>
        <ul className="card-grid">
          {HOME_SPACES.map((space) => {
            const to = SPACE_ROUTES[space.id];
            return (
              <li key={space.id} className={to ? 'card' : 'card card--soon'}>
                <h3 className="card__title">{to ? <Link to={to}>{space.title}</Link> : space.title}</h3>
                <p>{space.description}</p>
                <p className="badge">{to ? t('available') : t('comingSoon')}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
