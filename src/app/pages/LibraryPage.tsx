import { Link } from 'react-router';
import { ExternalLink } from '../../pwa/ExternalLink.tsx';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { SIGN_COPY, t } from '../../i18n/es-AR.ts';

/** The official sources behind every explanation, with edition, provenance and a page browser. */
export function LibraryPage() {
  return (
    <>
      <PageTitle>{t('libraryHeading')}</PageTitle>
      <p className="lead">{t('libraryIntro')}</p>
      <p>
        <Link className="button button--secondary" to="/senales">
          {SIGN_COPY.libraryLink}
        </Link>{' '}
        {SIGN_COPY.libraryLinkHint}
      </p>
      <ContentGate>
        {(content) => (
          <ul className="card-grid">
            {content.manifest.map((source) => (
              <li key={source.id} className="card">
                <h2 className="card__title">{source.title}</h2>
                <p className="card__meta">
                  {t('edition')}: {source.edition} · {source.pages} {t('pagesLabel')}
                </p>
                <p className="card__actions">
                  <Link className="button" to={`/biblioteca/${source.id}/1`}>
                    {t('browseSource')}
                  </Link>{' '}
                  <ExternalLink href={source.provenance.url}>{t('officialPdf')}</ExternalLink>
                </p>
              </li>
            ))}
          </ul>
        )}
      </ContentGate>
    </>
  );
}
