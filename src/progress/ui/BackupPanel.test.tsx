import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { rule, ruleCatalog } from '../../content/testing/fixtures.ts';
import { LOGBOOK_COPY } from '../../i18n/es-AR.ts';
import { createBackup } from '../backup.ts';
import { updateConcept } from '../model.ts';
import type { ProgressSnapshot } from '../storage.ts';
import { BackupPanel, MAX_BACKUP_BYTES } from './BackupPanel.tsx';

const AT = '2026-10-11T12:00:00.000Z';
const rules = ruleCatalog([rule({ id: 'rule.minor.a-item', severity: 'minor', annexItem: 'a', points: 1 })]);
const stored: ProgressSnapshot = { attempts: [], concepts: [updateConcept(undefined, 'manual.ch3.a', true, AT)] };

function renderPanel(overrides: Partial<Parameters<typeof BackupPanel>[0]> = {}) {
  const props = {
    rules,
    attemptCount: 3,
    exportSnapshot: vi.fn(() => Promise.resolve(stored)),
    contentVersion: 'deadbeef',
    now: () => new Date(AT),
    replaceAll: vi.fn<(snapshot: ProgressSnapshot) => Promise<void>>(() => Promise.resolve()),
    ...overrides,
  };
  render(<BackupPanel {...props} />);
  return { ...props, user: userEvent.setup(), input: screen.getByLabelText(LOGBOOK_COPY.importLabel) };
}

const backupFile = (text = createBackup(stored, 'deadbeef', AT)) =>
  new File([text], 'respaldo.json', { type: 'application/json' });

/** Captures what the download link would save instead of navigating. */
function captureDownloads() {
  const saved: Array<{ name: string; blob: Blob }> = [];
  let blob: Blob | null = null;
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (value: Blob) => ((blob = value), 'blob:backup'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    if (blob) saved.push({ name: this.download, blob });
  });
  return saved;
}

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('BackupPanel export', () => {
  it('names the file after the local day of the export, which can differ from the UTC one', async () => {
    // Arrange: 21:42 of 12 October in Buenos Aires is 00:42 of 13 October in UTC.
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires');
    const saved = captureDownloads();
    const { user } = renderPanel({ now: () => new Date('2026-10-13T00:42:00.000Z') });

    // Act
    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.exportButton }));

    // Assert
    await waitFor(() => expect(saved.map((file) => file.name)).toEqual(['al-volante-progreso-2026-10-12.json']));
    expect(JSON.parse(await saved[0]!.blob.text())).toMatchObject({
      exportedAt: '2026-10-13T00:42:00.000Z',
      contentVersion: 'deadbeef',
      concepts: stored.concepts,
    });
  });

  it('says so when the stored progress cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user } = renderPanel({ exportSnapshot: () => Promise.reject(new Error('NotReadableError')) });

    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.exportButton }));

    expect(await screen.findByRole('alert')).toHaveTextContent(LOGBOOK_COPY.exportFailed);
  });
});

describe('BackupPanel import', () => {
  it('asks for confirmation, then replaces the progress with the backup', async () => {
    // Arrange
    const { user, input, replaceAll } = renderPanel();

    // Act
    await user.upload(input, backupFile());
    expect(screen.getByText(LOGBOOK_COPY.importWarning(3))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.importConfirm }));

    // Assert
    expect(await screen.findByRole('status')).toHaveTextContent(LOGBOOK_COPY.importDone);
    expect(replaceAll).toHaveBeenCalledWith(stored);
    expect(screen.queryByRole('button', { name: LOGBOOK_COPY.importConfirm })).not.toBeInTheDocument();
  });

  it('keeps the current progress when the person cancels', async () => {
    const { user, input, replaceAll } = renderPanel();

    await user.upload(input, backupFile());
    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.importCancel }));

    expect(screen.queryByRole('button', { name: LOGBOOK_COPY.importConfirm })).not.toBeInTheDocument();
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it('keeps the confirmation open and says nothing changed when the write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user, input } = renderPanel({ replaceAll: () => Promise.reject(new Error('QuotaExceededError')) });

    await user.upload(input, backupFile());
    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.importConfirm }));

    expect(await screen.findByRole('alert')).toHaveTextContent(LOGBOOK_COPY.importWriteFailed);
    expect(screen.getByRole('button', { name: LOGBOOK_COPY.importConfirm })).toBeEnabled();
  });

  it('rejects a file that is not a valid backup without touching progress', async () => {
    const { user, input, replaceAll } = renderPanel();

    await user.upload(input, backupFile('{oops'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `${LOGBOOK_COPY.importErrors['invalid-json']} ${LOGBOOK_COPY.unchanged}`,
    );
    expect(replaceAll).not.toHaveBeenCalled();
  });

  it('refuses files above the size limit without reading them', async () => {
    // Arrange: a small file that reports a size over the limit.
    const { user, input } = renderPanel();
    const huge = backupFile();
    Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 });
    const read = vi.spyOn(huge, 'text');

    // Act
    await user.upload(input, huge);

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(LOGBOOK_COPY.importErrors['too-large']);
    expect(read).not.toHaveBeenCalled();
  });

  it('reports a file the browser cannot read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user, input } = renderPanel();
    const broken = backupFile();
    vi.spyOn(broken, 'text').mockRejectedValue(new Error('NotReadableError'));

    await user.upload(input, broken);

    expect(await screen.findByRole('alert')).toHaveTextContent(LOGBOOK_COPY.importErrors.unreadable);
  });

  it('does nothing when the file picker closes without a file', () => {
    const { input } = renderPanel();

    fireEvent.change(input, { target: { files: [] } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: LOGBOOK_COPY.importConfirm })).not.toBeInTheDocument();
  });
});
