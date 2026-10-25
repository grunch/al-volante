import { Link } from 'react-router';
import { activitiesBySection, sectionKey } from '../../activities/sections.ts';
import { slugOfMode, slugOfStage } from '../../exam/modes.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { ACTIVITY_TYPE_LABELS, GARAGE_COPY } from '../../i18n/es-AR.ts';

/** Annex I: private cars, their safety elements and the checks before driving (manual PDF 104–122). */
const INSPECTION_SECTION = sectionKey('manual', 'annex1');

/**
 * "Mi garaje" (PROPUESTA §2): learn the car. The inspection and safety activities of annex I, and the cockpit to
 * set the seat, mirrors and belt (practice yard and stage I of the exam).
 */
export function GaragePage() {
  return (
    <>
      <PageTitle>{GARAGE_COPY.heading}</PageTitle>
      <p className="lead">{GARAGE_COPY.intro}</p>
      <section aria-labelledby="garage-cockpit">
        <h2 id="garage-cockpit">{GARAGE_COPY.cockpitHeading}</h2>
        <p>{GARAGE_COPY.cockpitIntro}</p>
        <p>
          <Link className="button" to={`/examen/practico?modo=${slugOfMode('practice')}&etapa=${slugOfStage('I')}`}>
            {GARAGE_COPY.stageOne}
          </Link>{' '}
          <Link className="button button--secondary" to="/pista">
            {GARAGE_COPY.yard}
          </Link>
        </p>
      </section>
      <section aria-labelledby="garage-inspection">
        <h2 id="garage-inspection">{GARAGE_COPY.inspectionHeading}</h2>
        <p>{GARAGE_COPY.inspectionIntro}</p>
        <ContentGate>
          {(content) => {
            const activities = activitiesBySection(content.activities, content.units).get(INSPECTION_SECTION) ?? [];
            if (activities.length === 0) return <p>{GARAGE_COPY.noActivities}</p>;
            return (
              <>
                <ul className="card-grid">
                  {activities.map((activity) => (
                    <li key={activity.id} className="card">
                      <h3 className="card__title">
                        <Link to={`/actividad/${activity.id}`}>{activity.title}</Link>
                      </h3>
                      <p className="badge">{ACTIVITY_TYPE_LABELS[activity.type]}</p>
                    </li>
                  ))}
                </ul>
                <p className="link-row">
                  <Link to="/mapa/manual/annex1">{GARAGE_COPY.studyAnnex}</Link>
                </p>
              </>
            );
          }}
        </ContentGate>
      </section>
    </>
  );
}
