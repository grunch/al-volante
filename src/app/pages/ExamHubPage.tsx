import { Link, Navigate, useLocation } from 'react-router';
import { DRIVING_MODES, slugOfMode } from '../../exam/modes.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { EXAM_COPY, EXAM_HUB_COPY } from '../../i18n/es-AR.ts';

/** Query parameters of the practical exam: an address with them predates the exam section and opened that exam. */
const PRACTICAL_PARAMS = ['modo', 'etapa'] as const;

/** «Examen»: the choice between the theoretical and the practical exam of licence B. */
export function ExamHubPage() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  // Before the exam section, `#/examen?modo=…` was the practical exam; old links and bookmarks keep working.
  if (PRACTICAL_PARAMS.some((name) => params.has(name)))
    return <Navigate to={{ pathname: '/examen/practico', search }} replace />;
  return (
    <>
      <PageTitle>{EXAM_HUB_COPY.heading}</PageTitle>
      <p className="lead">{EXAM_HUB_COPY.intro}</p>
      <ul className="card-grid card-grid--pair">
        <li className="card">
          <section aria-labelledby="exam-hub-theory">
            <h2 id="exam-hub-theory" className="card__title">
              {EXAM_HUB_COPY.theoryHeading}
            </h2>
            <ContentGate>
              {({ theoryExam }) => (
                <p>
                  {EXAM_HUB_COPY.theorySummary(
                    theoryExam.questions,
                    theoryExam.passCorrect,
                    theoryExam.timeMinutes.default,
                  )}
                </p>
              )}
            </ContentGate>
            <p className="card__actions">
              <Link className="button" to="/examen/teorico">
                {EXAM_HUB_COPY.theoryLink}
              </Link>
            </p>
          </section>
        </li>
        <li className="card">
          <section aria-labelledby="exam-hub-practical">
            <h2 id="exam-hub-practical" className="card__title">
              {EXAM_HUB_COPY.practicalHeading}
            </h2>
            <p>{EXAM_HUB_COPY.practicalSummary}</p>
            <ul className="home-modes">
              {DRIVING_MODES.map((mode) => (
                <li key={mode}>
                  <Link to={`/examen/practico?modo=${slugOfMode(mode)}`}>{EXAM_COPY.homeModes[mode]}</Link>:{' '}
                  {EXAM_COPY.modeHelp[mode]}
                </li>
              ))}
            </ul>
            <p className="card__actions">
              <Link className="button" to="/examen/practico">
                {EXAM_HUB_COPY.practicalLink}
              </Link>
            </p>
          </section>
        </li>
      </ul>
    </>
  );
}
