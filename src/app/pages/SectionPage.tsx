import { Link, useParams } from 'react-router';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { CATEGORY_LABELS, sectionLabel, t } from '../../i18n/es-AR.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

/** Lists the knowledge units of one source section with links to their source pages. */
export function SectionPage() {
  const { source = '', section = '' } = useParams();
  return (
    <ContentGate>
      {(content) => {
        const units = content.units.filter((unit) => unit.source === source && unit.section === section);
        const pages = content.pages.filter((page) => page.source === source && page.section === section);
        if (pages.length === 0) return <NotFoundPage />;
        const first = pages[0];
        const last = pages[pages.length - 1];
        return (
          <>
            <PageTitle>{sectionLabel(source, section)}</PageTitle>
            <p className="card__meta">
              {first ? CATEGORY_LABELS[first.category] : ''} · {t('sectionPages')}{' '}
              {first && last ? `${first.page}–${last.page}` : ''}
            </p>
            <h2>{t('sectionUnitsHeading')}</h2>
            <ul className="unit-list">
              {units.map((unit) => (
                <li key={unit.id} className="unit">
                  <h3 className="unit__title">{unit.title}</h3>
                  <p>{unit.summary}</p>
                  {unit.keyFacts.length > 0 && (
                    <ul className="unit__facts">
                      {unit.keyFacts.map((fact) => (
                        <li key={fact}>{fact}</li>
                      ))}
                    </ul>
                  )}
                  <p className="unit__refs">
                    {unit.figureBased && <span className="badge">{t('figureBased')}</span>}{' '}
                    {unit.pages.map((page) => (
                      <Link key={page} to={`/biblioteca/${unit.source}/${page}`} className="ref-link">
                        {t('seeSourcePage')} {page}
                      </Link>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </>
        );
      }}
    </ContentGate>
  );
}
