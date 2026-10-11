import { Link } from 'react-router';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { ACTIVITY_COPY, ACTIVITY_TYPE_LABELS, SOURCE_SHORT_LABELS } from '../../i18n/es-AR.ts';

/** "La ciudad te pregunta": the activity list (a representative sample in phase 2). */
export function ActivitiesPage() {
  return (
    <>
      <PageTitle>{ACTIVITY_COPY.heading}</PageTitle>
      <p className="lead">{ACTIVITY_COPY.intro}</p>
      <ContentGate>
        {(content) => (
          <ul className="card-grid">
            {content.activities.map((activity) => (
              <li key={activity.id} className="card">
                <h2 className="card__title">
                  <Link to={`/actividad/${activity.id}`}>{activity.title}</Link>
                </h2>
                <p className="badge">{ACTIVITY_TYPE_LABELS[activity.type]}</p>
                <p className="card__meta">
                  {activity.refs.map((ref) => `${SOURCE_SHORT_LABELS[ref.source]} PDF ${ref.page}`).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </ContentGate>
    </>
  );
}
