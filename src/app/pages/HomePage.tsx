import { Suspense, lazy, useContext } from 'react';
import { Link } from 'react-router';
import { RendererContext } from '../../scene/RendererContext.ts';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { t } from '../../i18n/es-AR.ts';

// Three.js is code-split so the rest of the app never waits for the 3D bundle.
const SceneCanvas = lazy(() =>
  import('../../scene/SceneCanvas.tsx').then((module) => ({ default: module.SceneCanvas })),
);

/** The six spaces of PROPUESTA §2; `to` is set only for spaces that already exist. */
const SPACES: Array<{ title: string; description: string; to?: string }> = [
  { title: 'Mi garaje', description: 'Explorá el auto, la postura, los espejos y los elementos de seguridad.' },
  { title: 'La ciudad te pregunta', description: 'Resolvé escenas de prioridades, señales, luces y estacionamiento.' },
  { title: 'Laboratorio vial', description: 'Compará distancias de reacción y frenado, lluvia y puntos ciegos.' },
  { title: 'Ruta 13', description: 'Conducí el recorrido A de Núñez desde el interior del auto.' },
  { title: 'Sala de examen', description: 'Simulacros del teórico equilibrados por tema.' },
  {
    title: 'Biblioteca',
    description: 'El material oficial, página por página, con su texto y su PDF.',
    to: '/biblioteca',
  },
];

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
        </Link>
      </p>
      <section aria-labelledby="spaces-heading">
        <h2 id="spaces-heading">{t('spacesHeading')}</h2>
        <ul className="card-grid">
          {SPACES.map((space) => (
            <li key={space.title} className={space.to ? 'card' : 'card card--soon'}>
              <h3 className="card__title">{space.to ? <Link to={space.to}>{space.title}</Link> : space.title}</h3>
              <p>{space.description}</p>
              <p className="badge">{space.to ? t('available') : t('comingSoon')}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
