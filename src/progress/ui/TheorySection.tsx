import { Link } from 'react-router';
import type { TheoryRow } from '../logbook.ts';
import { THEORY_COPY, formatDateTime } from '../../i18n/es-AR.ts';

/** The mock theory exams (F05-T05): date, score and verdict, newest first. */
export function TheorySection({ rows }: { rows: readonly TheoryRow[] }) {
  return (
    <section aria-labelledby="theory-log-heading">
      <h2 id="theory-log-heading">{THEORY_COPY.logbookHeading}</h2>
      {rows.length === 0 ? (
        <p>
          {THEORY_COPY.logbookEmpty} <Link to="/examen/teorico">{THEORY_COPY.heading}</Link>
        </p>
      ) : (
        <ul className="logbook-list" data-testid="theory-log">
          {rows.map((row) => (
            <li key={row.attempt.id} data-result={row.passed ? 'approved' : 'disapproved'}>
              <strong>{formatDateTime(row.at)}</strong>
              <p className="logbook-list__detail">{THEORY_COPY.logbookRow(row.correct, row.total, row.passed)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
