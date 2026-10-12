import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { loadPageText } from '../../content/sourceText.ts';
import type { Rule, Source, SourceId } from '../../content/schemas.ts';
import type { Content } from '../../content/validate.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import {
  CATEGORY_LABELS,
  ISSUE_TYPE_LABELS,
  PAGE_KIND_LABELS,
  SEVERITY_LABELS,
  SIGN_COPY,
  sectionLabel,
  t,
} from '../../i18n/es-AR.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

/** One physical page of an official source: its catalog data, extracted text and the original PDF. */
export function SourcePage() {
  const params = useParams();
  return (
    <ContentGate>
      {(content) => {
        const source = content.manifest.find((item) => item.id === params.source);
        const page = Number(params.page);
        if (!source) return <NotFoundPage />;
        if (!Number.isInteger(page) || page < 1 || page > source.pages) {
          return (
            <>
              <PageTitle>{source.title}</PageTitle>
              <p role="alert">{t('invalidPage')}</p>
              <PageNavigation source={source} page={1} />
            </>
          );
        }
        return <SourcePageView key={`${source.id}:${page}`} content={content} source={source} page={page} />;
      }}
    </ContentGate>
  );
}

/**
 * The ficha row printed on this page; a rule can span several pages. Pages that only cite the rule (its `refs`)
 * fall back to the first row.
 */
function fichaTextForPage(rule: Rule, page: number): string {
  const rows = rule.fichaRows.filter((row) => row.page === page);
  return (rows.length > 0 ? rows : rule.fichaRows.slice(0, 1)).map((row) => row.text).join('; ');
}

function SourcePageView({ content, source, page }: { content: Content; source: Source; page: number }) {
  const catalogPage = content.pages.find((item) => item.source === source.id && item.page === page);
  const units = content.units.filter((unit) => unit.source === source.id && unit.pages.includes(page));
  const signs = source.id === 'manual' ? content.signs.filter((sign) => sign.page === page) : [];
  const issues = content.issues.filter((issue) => issue.source === source.id && issue.page === page);
  const rules =
    source.id === 'protocolo'
      ? content.rules.rules.filter(
          (rule) => rule.refs.some((ref) => ref.page === page) || rule.fichaRows.some((row) => row.page === page),
        )
      : [];

  return (
    <>
      <PageTitle
        documentTitle={`${source.title}, ${t('pageLabel').toLowerCase()} ${page}`}
      >{`${t('pageLabel')} ${page} · ${source.title}`}</PageTitle>
      <PageNavigation source={source} page={page} />
      {/* Every page of every source is classified since F05-T04 (validateCatalog). */}
      {catalogPage && (
        <section aria-labelledby="page-summary">
          <h2 id="page-summary">{t('pageSummary')}</h2>
          <p className="card__meta">
            {sectionLabel(source.id, catalogPage.section)} · {CATEGORY_LABELS[catalogPage.category]} ·{' '}
            {PAGE_KIND_LABELS[catalogPage.kind]}
            {catalogPage.printedPage !== null && ` · ${t('printedPageLabel')} ${catalogPage.printedPage}`}
          </p>
          <p>{catalogPage.summary}</p>
        </section>
      )}
      {units.length > 0 && (
        <section aria-labelledby="page-units">
          <h2 id="page-units">{t('pageUnits')}</h2>
          <ul className="unit-list">
            {units.map((unit) => (
              <li key={unit.id} className="unit">
                <h3 className="unit__title">
                  <Link to={`/mapa/${unit.source}/${unit.section}`}>{unit.title}</Link>
                </h3>
                <p>{unit.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {catalogPage && catalogPage.figures.length > 0 && (
        <section aria-labelledby="page-figures">
          <h2 id="page-figures">{t('pageFigures')}</h2>
          <ul>
            {catalogPage.figures.map((figure) => (
              <li key={figure.description}>{figure.description}</li>
            ))}
          </ul>
        </section>
      )}
      {signs.length > 0 && (
        <section aria-labelledby="page-signs">
          <h2 id="page-signs">{t('pageSigns')}</h2>
          <ul>
            {signs.map((sign) => (
              <li key={sign.id}>
                <strong>{sign.name}</strong>: {sign.meaning || sign.visual}
              </li>
            ))}
          </ul>
          <p>
            <Link to="/senales">{SIGN_COPY.libraryLink}</Link>
          </p>
        </section>
      )}
      {rules.length > 0 && (
        <section aria-labelledby="page-rules">
          <h2 id="page-rules">{t('pageRules')}</h2>
          <ul>
            {rules.map((rule) => (
              <li key={rule.id}>
                <strong>
                  {SEVERITY_LABELS[rule.severity]} ({rule.points})
                </strong>
                : {fichaTextForPage(rule, page)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {issues.length > 0 && (
        <section aria-labelledby="page-issues">
          <h2 id="page-issues">{t('pageIssues')}</h2>
          <ul>
            {issues.map((issue) => (
              <li key={issue.description}>
                <strong>{ISSUE_TYPE_LABELS[issue.type]}</strong>: {issue.description}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ExtractedText source={source.id} page={page} />
      <p>
        <a href={`${source.provenance.url}#page=${page}`} target="_blank" rel="noopener noreferrer">
          {t('officialPdfAtPage')}
        </a>
      </p>
    </>
  );
}

function PageNavigation({ source, page }: { source: Source; page: number }) {
  const navigate = useNavigate();
  const [target, setTarget] = useState(String(page));
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate(`/biblioteca/${source.id}/${target}`);
  };
  return (
    <nav className="page-nav" aria-label={`${t('pageLabel')} ${page}`}>
      {page > 1 && <Link to={`/biblioteca/${source.id}/${page - 1}`}>← {t('previousPage')}</Link>}
      <form className="page-nav__form" onSubmit={onSubmit}>
        <label htmlFor="page-jump">{t('goToPage')}</label>
        <input
          id="page-jump"
          type="number"
          min={1}
          max={source.pages}
          value={target}
          onChange={(event) => setTarget(event.target.value)}
        />
        <button type="submit" className="button button--small">
          {t('go')}
        </button>
      </form>
      {page < source.pages && <Link to={`/biblioteca/${source.id}/${page + 1}`}>{t('nextPage')} →</Link>}
    </nav>
  );
}

type TextState = { kind: 'loading' } | { kind: 'ready'; text: string } | { kind: 'error' };

function ExtractedText({ source, page }: { source: SourceId; page: number }) {
  const [state, setState] = useState<TextState>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    loadPageText(source, page).then(
      (text) => {
        if (!cancelled) setState({ kind: 'ready', text });
      },
      (error: unknown) => {
        console.warn('Could not load extracted text', error);
        if (!cancelled) setState({ kind: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [source, page]);
  return (
    <section aria-labelledby="page-text">
      <h2 id="page-text">{t('extractedText')}</h2>
      {state.kind === 'loading' && <p role="status">{t('extractedTextLoading')}</p>}
      {state.kind === 'error' && <p role="alert">{t('extractedTextError')}</p>}
      {state.kind === 'ready' &&
        (state.text.trim() === '' ? (
          <p>{t('extractedTextEmpty')}</p>
        ) : (
          <pre className="extracted-text" tabIndex={0}>
            {state.text}
          </pre>
        ))}
    </section>
  );
}
