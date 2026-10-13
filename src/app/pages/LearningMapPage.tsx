import { Link } from 'react-router';
import { computeCoverage } from '../../content/coverage.ts';
import type { SectionCoverage } from '../../content/coverage.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { CATEGORY_LABELS, sectionLabel, t } from '../../i18n/es-AR.ts';
import { GROUP_TITLES, LEARNING_PATH } from '../learningPath.ts';

export function LearningMapPage() {
  return (
    <>
      <PageTitle>{t('mapHeading')}</PageTitle>
      <p className="lead">{t('mapIntro')}</p>
      <ContentGate>
        {(content) => {
          const coverage = new Map(computeCoverage(content).map((row) => [`${row.source}:${row.section}`, row]));
          return LEARNING_PATH.map((group) => (
            <section key={group.id} aria-labelledby={`group-${group.id}`} className="map-group">
              <h2 id={`group-${group.id}`}>{GROUP_TITLES[group.id]}</h2>
              <ol className={group.id === 'campaign-b' ? 'map-path' : 'card-grid'}>
                {group.sections.map(({ source, section }) => {
                  const row = coverage.get(`${source}:${section}`);
                  return row ? <SectionCard key={`${source}:${section}`} row={row} /> : null;
                })}
              </ol>
            </section>
          ));
        }}
      </ContentGate>
    </>
  );
}

function SectionCard({ row }: { row: SectionCoverage }) {
  return (
    <li className="card">
      <h3 className="card__title">
        <Link to={`/mapa/${row.source}/${row.section}`}>{sectionLabel(row.source, row.section)}</Link>
      </h3>
      <p className="card__meta">{CATEGORY_LABELS[row.category]}</p>
      <p>
        {row.units} {row.units === 1 ? t('unitsCountOne') : t('unitsCount')} · {row.unitsWithActivities}{' '}
        {t('unitsWithActivities')}
        {row.consultationUnits > 0 && ` · ${row.consultationUnits} ${t('unitsForConsultation')}`}
      </p>
    </li>
  );
}
