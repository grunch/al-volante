import { Link } from 'react-router';
import type { Evaluation } from '../engine.ts';
import { ACTIVITY_COPY, SOURCE_SHORT_LABELS } from '../../i18n/es-AR.ts';

/** Result first in words (never colour alone), then the specific feedback, the right answer and the cited pages. */
export function FeedbackPanel({ evaluation }: { evaluation: Evaluation }) {
  const verdict = evaluation.correct
    ? ACTIVITY_COPY.correct
    : evaluation.score > 0
      ? ACTIVITY_COPY.partial
      : ACTIVITY_COPY.incorrect;
  return (
    <section
      className={`feedback ${evaluation.correct ? 'feedback--correct' : 'feedback--incorrect'}`}
      aria-labelledby="feedback-verdict"
    >
      <h2 id="feedback-verdict" className="feedback__verdict">
        <span aria-hidden="true">{evaluation.correct ? '✓ ' : '✗ '}</span>
        {verdict}
        {!evaluation.correct &&
          evaluation.score > 0 &&
          ` (${ACTIVITY_COPY.scoreLabel}: ${Math.round(evaluation.score * 100)} %)`}
      </h2>
      <ul>
        {evaluation.feedback.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {!evaluation.correct && (
        <p>
          <strong>{ACTIVITY_COPY.correctAnswer}:</strong> {evaluation.correctAnswer}
        </p>
      )}
      <h3>{ACTIVITY_COPY.explanation}</h3>
      <p>{evaluation.explanation}</p>
      <h3>{ACTIVITY_COPY.sources}</h3>
      <ul className="inline-list">
        {evaluation.refs.map((ref) => (
          <li key={`${ref.source}-${ref.page}`}>
            <Link to={`/biblioteca/${ref.source}/${ref.page}`}>
              {SOURCE_SHORT_LABELS[ref.source]}, PDF {ref.page}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
