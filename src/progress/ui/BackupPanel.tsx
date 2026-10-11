import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { createBackup, parseBackup } from '../backup.ts';
import type { BackupParseResult } from '../backup.ts';
import { downloadText } from '../download.ts';
import type { ProgressSnapshot } from '../storage.ts';
import { LOGBOOK_COPY, formatDateTime } from '../../i18n/es-AR.ts';

/** Larger files cannot be real backups (thousands of attempts weigh a few MB); refuse them before reading. */
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

type ParsedBackup = Extract<BackupParseResult, { ok: true }>;
type ImportError = keyof typeof LOGBOOK_COPY.importErrors;

interface BackupPanelProps {
  snapshot: ProgressSnapshot;
  contentVersion: string;
  now: () => Date;
  replaceAll: (snapshot: ProgressSnapshot) => Promise<void>;
}

/** Export, and import with an explicit confirmation; a rejected or failed import never touches current progress. */
export function BackupPanel({ snapshot, contentVersion, now, replaceAll }: BackupPanelProps) {
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const exportBackup = () => {
    const at = now().toISOString();
    downloadText(`al-volante-progreso-${at.slice(0, 10)}.json`, createBackup(snapshot, contentVersion, at));
  };

  const reject = (error: ImportError) => {
    setPending(null);
    setMessage({ kind: 'error', text: `${LOGBOOK_COPY.importErrors[error]} ${LOGBOOK_COPY.unchanged}` });
  };

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setMessage(null);
    if (file.size > MAX_BACKUP_BYTES) return reject('too-large');
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      console.error('Could not read the backup file', error);
      return reject('unreadable');
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) return reject(parsed.error);
    setPending(parsed);
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await replaceAll(pending.snapshot);
      setPending(null);
      setMessage({ kind: 'success', text: LOGBOOK_COPY.importDone });
    } catch (error) {
      console.error('Could not import the backup', error);
      setMessage({ kind: 'error', text: LOGBOOK_COPY.importWriteFailed });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="backup-heading">
      <h2 id="backup-heading">{LOGBOOK_COPY.backupHeading}</h2>
      <p>{LOGBOOK_COPY.backupHelp}</p>
      <p>
        <button type="button" className="button" onClick={exportBackup}>
          {LOGBOOK_COPY.exportButton}
        </button>
      </p>
      <p>
        <label className="file-field">
          <span>{LOGBOOK_COPY.importLabel}</span>
          <input type="file" accept="application/json,.json" onChange={(event) => void chooseFile(event)} />
        </label>
      </p>
      {pending && (
        <div className="confirm-box" role="group" aria-label={LOGBOOK_COPY.importLabel}>
          <p>
            {LOGBOOK_COPY.importSummary(
              formatDateTime(pending.exportedAt),
              pending.snapshot.attempts.length,
              pending.snapshot.concepts.length,
            )}{' '}
            <strong>{LOGBOOK_COPY.importWarning(snapshot.attempts.length)}</strong>
          </p>
          <button type="button" className="button" disabled={busy} onClick={() => void confirm()}>
            {LOGBOOK_COPY.importConfirm}
          </button>{' '}
          <button type="button" className="button button--secondary" disabled={busy} onClick={() => setPending(null)}>
            {LOGBOOK_COPY.importCancel}
          </button>
        </div>
      )}
      {message && (
        <p
          className={`status-message status-message--${message.kind}`}
          role={message.kind === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
