import { Link } from 'react-router';
import { GROUP_TITLES } from '../../app/learningPath.ts';
import type { GroupProgress } from '../logbook.ts';
import { LOGBOOK_COPY, formatDate } from '../../i18n/es-AR.ts';

/** Per-concept progress, one block per learning-path group; consultation material only appears once practiced. */
export function ConceptProgressSection({ groups }: { groups: readonly GroupProgress[] }) {
  const shown = groups.filter((group) => group.groupId !== 'reference' || group.rows.length > 0);
  return (
    <section aria-labelledby="concepts-heading">
      <h2 id="concepts-heading">{LOGBOOK_COPY.conceptsHeading}</h2>
      <p>{LOGBOOK_COPY.masteryHelp}</p>
      {shown.map((group) => (
        <section key={group.groupId} aria-labelledby={`progress-${group.groupId}`} className="progress-group">
          <h3 id={`progress-${group.groupId}`}>{GROUP_TITLES[group.groupId]}</h3>
          <p>{LOGBOOK_COPY.groupSummary(group.total, group.withActivities)}</p>
          <dl className="progress-counts">
            <div>
              <dt>{LOGBOOK_COPY.practicedCount}</dt>
              <dd>{group.practiced}</dd>
            </div>
            <div>
              <dt>{LOGBOOK_COPY.masteredCount}</dt>
              <dd>{group.mastered}</dd>
            </div>
          </dl>
          {group.rows.length === 0 ? (
            <p>{LOGBOOK_COPY.groupEmpty}</p>
          ) : (
            <ul className="logbook-list">
              {group.rows.map(({ unit, progress, state, due }) => (
                <li key={unit.id}>
                  <Link to={`/mapa/${unit.source}/${unit.section}`}>{unit.title}</Link>{' '}
                  <span className={`badge badge--${state}`}>{LOGBOOK_COPY.stateLabels[state]}</span>
                  <p className="logbook-list__detail">
                    {LOGBOOK_COPY.conceptStats(progress.correct, progress.attempts)} ·{' '}
                    {due ? <strong>{LOGBOOK_COPY.dueNow}</strong> : LOGBOOK_COPY.nextReview(formatDate(progress.dueAt))}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </section>
  );
}
