import { Link } from 'react-router';
import type { DrivingRow } from '../logbook.ts';
import { LOGBOOK_COPY, formatDateTime } from '../../i18n/es-AR.ts';

/** The drives of the exam page (F04-T05): date, mode, completed stages, points and verdict, newest first. */
export function DrivingSection({ rows }: { rows: readonly DrivingRow[] }) {
  return (
    <section aria-labelledby="driving-heading">
      <h2 id="driving-heading">{LOGBOOK_COPY.drivingHeading}</h2>
      {rows.length === 0 ? (
        <p>
          {LOGBOOK_COPY.drivingEmpty} <Link to="/examen">{LOGBOOK_COPY.drivingLink}</Link>
        </p>
      ) : (
        <ul className="logbook-list" data-testid="driving-log">
          {rows.map((row) => (
            <li key={row.attempt.id} data-mode={row.mode} data-result={row.result}>
              <strong>{LOGBOOK_COPY.drivingModes[row.mode]}</strong> · {formatDateTime(row.at)}
              <p className="logbook-list__detail">
                {LOGBOOK_COPY.drivingStages(row.completedStages)} · {LOGBOOK_COPY.drivingPoints(row.points)} ·{' '}
                {LOGBOOK_COPY.drivingResults[row.result]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
