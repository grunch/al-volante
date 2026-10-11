import { Link } from 'react-router';
import type { KnowledgeUnit } from '../../content/schemas.ts';
import type { RecentError, ReviewSuggestion } from '../logbook.ts';
import { LOGBOOK_COPY, formatDateTime } from '../../i18n/es-AR.ts';

interface ReviewSectionProps {
  suggestions: readonly ReviewSuggestion[];
  errors: readonly RecentError[];
  unitTitles: ReadonlyMap<string, KnowledgeUnit['title']>;
}

/** The recommended session and the recent mistakes, each with a direct way back to the activity. */
export function ReviewSection({ suggestions, errors, unitTitles }: ReviewSectionProps) {
  return (
    <>
      <section aria-labelledby="review-heading">
        <h2 id="review-heading">{LOGBOOK_COPY.reviewHeading}</h2>
        {suggestions.length === 0 ? (
          <p>
            {LOGBOOK_COPY.reviewEmpty} <Link to="/actividades">{LOGBOOK_COPY.reviewTryNew}</Link>
          </p>
        ) : (
          <ol className="logbook-list">
            {suggestions.map(({ activity, reason, dueUnitIds }) => (
              <li key={activity.id}>
                <Link to={`/actividad/${activity.id}`}>{activity.title}</Link>
                <p className="logbook-list__detail">
                  {reason === 'recent-error'
                    ? LOGBOOK_COPY.reasonRecentError
                    : `${LOGBOOK_COPY.reasonDue} ${dueUnitIds.map((unitId) => unitTitles.get(unitId) ?? unitId).join('; ')}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section aria-labelledby="errors-heading">
        <h2 id="errors-heading">{LOGBOOK_COPY.errorsHeading}</h2>
        {errors.length === 0 ? (
          <p>{LOGBOOK_COPY.errorsEmpty}</p>
        ) : (
          <ul className="logbook-list">
            {errors.map(({ activity, attempt }) => (
              <li key={activity.id}>
                <Link to={`/actividad/${activity.id}`}>{activity.title}</Link>
                <p className="logbook-list__detail">
                  {LOGBOOK_COPY.errorOn(formatDateTime(attempt.finishedAt ?? attempt.startedAt))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
