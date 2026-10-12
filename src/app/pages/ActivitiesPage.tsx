import { Link, useSearchParams } from 'react-router';
import { activitiesBySection, sectionKey } from '../../activities/sections.ts';
import type { Activity } from '../../content/schemas.ts';
import type { Content } from '../../content/validate.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { ACTIVITY_COPY, ACTIVITY_TYPE_LABELS, SOURCE_SHORT_LABELS, sectionLabel } from '../../i18n/es-AR.ts';
import { GROUP_TITLES, LEARNING_PATH } from '../learningPath.ts';

/**
 * "La ciudad te pregunta": the sections of the learning path with their activities (`?seccion=` opens one).
 * Hundreds of activities do not fit one list, so the overview links each section and the section lists its cards.
 */
export function ActivitiesPage() {
  const [params] = useSearchParams();
  const selected = params.get('seccion');
  return (
    <ContentGate>
      {(content) => {
        const groups = activitiesBySection(content.activities, content.units);
        const activities = selected === null ? undefined : groups.get(selected);
        if (selected !== null && activities) return <SectionActivities sectionId={selected} activities={activities} />;
        return <Overview content={content} groups={groups} unknownSection={selected !== null} />;
      }}
    </ContentGate>
  );
}

function Overview({
  content,
  groups,
  unknownSection,
}: {
  content: Content;
  groups: ReadonlyMap<string, Activity[]>;
  unknownSection: boolean;
}) {
  return (
    <>
      <PageTitle>{ACTIVITY_COPY.heading}</PageTitle>
      <p className="lead">{ACTIVITY_COPY.intro}</p>
      {unknownSection && (
        <p className="status-message status-message--error" role="alert">
          {ACTIVITY_COPY.unknownSection}
        </p>
      )}
      {LEARNING_PATH.map((group) => {
        const sections = group.sections.filter(({ source, section }) => groups.has(sectionKey(source, section)));
        if (sections.length === 0) return null;
        return (
          <section key={group.id} aria-labelledby={`activities-${group.id}`} className="map-group">
            <h2 id={`activities-${group.id}`}>{GROUP_TITLES[group.id]}</h2>
            <ul className="card-grid">
              {sections.map(({ source, section }) => {
                const key = sectionKey(source, section);
                const count = groups.get(key)?.length ?? 0;
                const units = content.units.filter((unit) => unit.source === source && unit.section === section);
                return (
                  <li key={key} className="card">
                    <h3 className="card__title">
                      <Link to={`/actividades?seccion=${key}`}>{sectionLabel(source, section)}</Link>
                    </h3>
                    <p className="card__meta">
                      {count} {count === 1 ? ACTIVITY_COPY.activityOne : ACTIVITY_COPY.activityMany} · {units.length}{' '}
                      {ACTIVITY_COPY.unitsInSection}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function SectionActivities({ sectionId, activities }: { sectionId: string; activities: readonly Activity[] }) {
  const [source = '', ...rest] = sectionId.split('-');
  const section = rest.join('-');
  return (
    <>
      <PageTitle>{sectionLabel(source, section)}</PageTitle>
      <p className="lead">{ACTIVITY_COPY.sectionIntro}</p>
      <p>
        <Link to="/actividades">{ACTIVITY_COPY.allSections}</Link> ·{' '}
        <Link to={`/mapa/${source}/${section}`}>{ACTIVITY_COPY.studySection}</Link>
      </p>
      <ul className="card-grid">
        {activities.map((activity) => (
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
    </>
  );
}
