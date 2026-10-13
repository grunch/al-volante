import { Link, useParams } from 'react-router';
import { activitiesBySection, sectionKey } from '../../activities/sections.ts';
import type { Activity, Figure, KnowledgeUnit } from '../../content/schemas.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { FigureView } from '../../ui/FigureView.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { CATEGORY_LABELS, sectionLabel, t } from '../../i18n/es-AR.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

/**
 * Lists the knowledge units of one source section with their figures, links to their source pages and, for each
 * unit, the activities that practice it or why it is consultation material.
 */
export function SectionPage() {
  const { source = '', section = '' } = useParams();
  return (
    <ContentGate>
      {(content) => {
        const units = content.units.filter((unit) => unit.source === source && unit.section === section);
        const pages = content.pages.filter((page) => page.source === source && page.section === section);
        const [first] = pages;
        if (!first) return <NotFoundPage />;
        // The range does not rely on the catalog order of the pages.
        const pageNumbers = pages.map((item) => item.page);
        const pageRange = `${Math.min(...pageNumbers)}–${Math.max(...pageNumbers)}`;
        const key = sectionKey(source, section);
        const sectionActivities = activitiesBySection(content.activities, content.units).get(key) ?? [];
        const practicing = (unitId: string) =>
          content.activities.filter((activity) => activity.status === 'reviewed' && activity.unitIds.includes(unitId));
        const figuresOf = (unitId: string) => content.figures.filter((figure) => figure.unitIds.includes(unitId));
        return (
          <>
            <PageTitle>{sectionLabel(source, section)}</PageTitle>
            <p className="card__meta">
              {CATEGORY_LABELS[first.category]} · {t('sectionPages')} {pageRange}
            </p>
            <section aria-labelledby="section-practice">
              <h2 id="section-practice">{t('sectionPractice')}</h2>
              {sectionActivities.length > 0 ? (
                <p>
                  <Link className="button" to={`/actividades?seccion=${key}`}>
                    {sectionActivities.length}{' '}
                    {sectionActivities.length === 1 ? t('sectionPracticeCountOne') : t('sectionPracticeCount')}
                  </Link>
                </p>
              ) : (
                <p>{t('sectionNoActivities')}</p>
              )}
            </section>
            <h2>{t('sectionUnitsHeading')}</h2>
            <ul className="unit-list">
              {units.map((unit) => (
                <UnitItem key={unit.id} unit={unit} activities={practicing(unit.id)} figures={figuresOf(unit.id)} />
              ))}
            </ul>
          </>
        );
      }}
    </ContentGate>
  );
}

function UnitItem({
  unit,
  activities,
  figures,
}: {
  unit: KnowledgeUnit;
  activities: readonly Activity[];
  figures: readonly Figure[];
}) {
  return (
    <li className="unit">
      <h3 className="unit__title">{unit.title}</h3>
      <p>{unit.summary}</p>
      {unit.keyFacts.length > 0 && (
        <ul className="unit__facts">
          {unit.keyFacts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      )}
      {figures.map((figure) => (
        <FigureView key={figure.id} figure={figure} />
      ))}
      <p className="unit__refs">
        {unit.figureBased && <span className="badge">{t('figureBased')}</span>}{' '}
        {unit.pages.map((page) => (
          <Link key={page} to={`/biblioteca/${unit.source}/${page}`} className="ref-link">
            {t('seeSourcePage')} {page}
          </Link>
        ))}
      </p>
      {activities.length > 0 && (
        <p className="unit__practice">
          {t('unitPracticedIn')}:{' '}
          {activities.map((activity, index) => (
            <span key={activity.id}>
              {index > 0 && ' · '}
              <Link to={`/actividad/${activity.id}`}>{activity.title}</Link>
            </span>
          ))}
        </p>
      )}
      {unit.consultationReason !== undefined && (
        <p className="unit__practice">
          <span className="badge">{t('unitConsultation')}</span> {unit.consultationReason}
        </p>
      )}
    </li>
  );
}
