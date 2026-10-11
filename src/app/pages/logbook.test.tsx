import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App.tsx';
import { routes } from '../routes.tsx';
import { loadContent } from '../../content/catalog.ts';
import { createBackup } from '../../progress/backup.ts';
import { MASTERY_BOX } from '../../progress/model.ts';
import type { ConceptProgress } from '../../progress/model.ts';
import { createMemoryStore } from '../../progress/storage.ts';
import type { ProgressSnapshot, ProgressStore } from '../../progress/storage.ts';
import { MAX_BACKUP_BYTES } from '../../progress/ui/BackupPanel.tsx';
import { createFakeRenderer } from '../../test/fakeRenderer.ts';
import { LOGBOOK_COPY, esAR } from '../../i18n/es-AR.ts';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();
const now = () => NOW;

function concept(unitId: string, overrides: Partial<ConceptProgress> = {}): ConceptProgress {
  return {
    unitId,
    box: 1,
    attempts: 1,
    correct: 1,
    lastAttemptAt: daysFromNow(-2),
    lastCorrect: true,
    dueAt: daysFromNow(-1),
    ...overrides,
  };
}

function renderAt(path: string, openProgressStore?: () => Promise<ProgressStore>) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const utils = render(
    <App
      router={router}
      createRenderer={createFakeRenderer}
      loadContent={loadContent}
      now={now}
      {...(openProgressStore ? { openProgressStore } : {})}
    />,
  );
  return { ...utils, router };
}

const withStore = (store: ProgressStore) => () => Promise.resolve(store);

async function playTurnWithPedestrian(correct: boolean) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /30 m antes enciendo la luz de giro/ }));
  await user.click(
    screen.getByRole('button', {
      name: correct ? 'Freno y le cedo el paso, aunque tenga verde' : 'Paso primero: tengo verde',
    }),
  );
  await screen.findByRole('heading', { name: correct ? '¡Correcto!' : 'No es correcto' });
  await user.click(
    within(screen.getByRole('navigation', { name: esAR.mainNavigation })).getByRole('link', { name: esAR.navLogbook }),
  );
  await screen.findByRole('heading', { level: 1, name: LOGBOOK_COPY.heading });
  return user;
}

const campaignB = () => screen.getByRole('region', { name: 'Campaña licencia B' });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logbook with IndexedDB', () => {
  it('records an answered activity and keeps it after restarting the app', async () => {
    // Arrange / Act
    const first = renderAt('/actividad/act.turn-with-pedestrian?semilla=0');
    await playTurnWithPedestrian(true);

    // Assert
    const concept = await within(campaignB()).findByRole('link', {
      name: 'Ceder el paso a peatones al girar con luz verde',
    });
    expect(concept.parentElement).toHaveTextContent('Practicado');
    expect(within(campaignB()).getByText('Giros: pasos en todos los casos')).toBeInTheDocument();
    expect(screen.queryByText(LOGBOOK_COPY.notPersistent)).not.toBeInTheDocument();

    first.unmount();
    renderAt('/bitacora');
    expect(
      await within(await screen.findByRole('region', { name: 'Campaña licencia B' })).findByText(
        'Ceder el paso a peatones al girar con luz verde',
      ),
    ).toBeInTheDocument();
  });
});

describe('logbook contents', () => {
  it('recommends retrying a failed activity and lists it as a recent error', async () => {
    renderAt('/actividad/act.turn-with-pedestrian?semilla=0', withStore(createMemoryStore()));
    await playTurnWithPedestrian(false);

    const review = await screen.findByRole('region', { name: LOGBOOK_COPY.reviewHeading });
    expect(within(review).getByRole('link', { name: 'Doblar con gente cruzando' })).toHaveAttribute(
      'href',
      '/actividad/act.turn-with-pedestrian',
    );
    expect(within(review).getByText(LOGBOOK_COPY.reasonRecentError)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: LOGBOOK_COPY.errorsHeading })).getByRole('link', {
        name: 'Doblar con gente cruzando',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(LOGBOOK_COPY.notPersistent)).toBeInTheDocument();
  });

  it('shows mastered concepts, due reviews and campaign B apart from complementary material', async () => {
    const store = createMemoryStore({
      attempts: [],
      concepts: [
        concept('manual.ch3.traffic-light-colors', {
          box: MASTERY_BOX,
          attempts: 4,
          correct: 3,
          dueAt: daysFromNow(10),
        }),
        concept('manual.ch3.stop-vs-yield'),
      ],
    });
    renderAt('/bitacora', withStore(store));

    const review = await screen.findByRole('region', { name: LOGBOOK_COPY.reviewHeading });
    expect(within(review).getByRole('link', { name: 'Señales reglamentarias' })).toBeInTheDocument();
    expect(
      within(review).getByText(`${LOGBOOK_COPY.reasonDue} Pare y Ceda el Paso: pérdida de prioridad`),
    ).toBeInTheDocument();
    const mastered = within(campaignB()).getByRole('link', {
      name: 'Intersecciones semaforizadas: significado de cada luz',
    }).parentElement;
    expect(mastered).toHaveTextContent('Dominado');
    expect(mastered).toHaveTextContent('Aciertos: 3 de 4');
    expect(within(campaignB()).getByText(LOGBOOK_COPY.dueNow)).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Material complementario' })).getByText(LOGBOOK_COPY.groupEmpty),
    ).toBeInTheDocument();
  });

  it('reports unreadable stored records without hiding the rest', async () => {
    const memory = createMemoryStore({ attempts: [], concepts: [concept('manual.ch3.stop-vs-yield')] });
    const store: ProgressStore = {
      ...memory,
      persistent: true,
      load: async () => ({ ...(await memory.load()), quarantined: 2 }),
    };
    renderAt('/bitacora', withStore(store));

    expect(await screen.findByText(LOGBOOK_COPY.quarantined(2))).toBeInTheDocument();
    expect(within(campaignB()).getByText('Pare y Ceda el Paso: pérdida de prioridad')).toBeInTheDocument();
  });

  it('shows a load error with a retry, and keeps answers given meanwhile', async () => {
    // Arrange: the first load fails; the store itself works.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = createMemoryStore();
    const store: ProgressStore = {
      ...memory,
      load: vi
        .fn<ProgressStore['load']>()
        .mockRejectedValueOnce(new Error('boom'))
        .mockImplementation(() => memory.load()),
    };
    renderAt('/actividad/act.turn-with-pedestrian?semilla=0', withStore(store));

    // Act: answer while progress is in the error state, then retry from the logbook.
    const user = await playTurnWithPedestrian(true);
    await user.click(await screen.findByRole('button', { name: LOGBOOK_COPY.retry }));

    // Assert
    expect(await within(campaignB()).findByText('Ceder el paso a peatones al girar con luz verde')).toBeInTheDocument();
  });

  it('tells the user when an attempt could not be saved, keeping the previous progress', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store: ProgressStore = {
      ...createMemoryStore(),
      record: () => Promise.reject(new Error('QuotaExceededError')),
    };
    renderAt('/actividad/act.turn-with-pedestrian?semilla=0', withStore(store));
    await playTurnWithPedestrian(true);

    expect(await screen.findByText(LOGBOOK_COPY.saveFailed)).toBeInTheDocument();
    expect(within(campaignB()).getByText(LOGBOOK_COPY.groupEmpty)).toBeInTheDocument();
  });
});

describe('backup', () => {
  const stored: ProgressSnapshot = { attempts: [], concepts: [concept('manual.ch3.stop-vs-yield')] };
  const backupFile = (snapshot: ProgressSnapshot) =>
    new File([createBackup(snapshot, 'deadbeef', daysFromNow(-3))], 'respaldo.json', { type: 'application/json' });

  afterEach(() => {
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('downloads a versioned backup of the current progress', async () => {
    // Arrange
    const blobs: Blob[] = [];
    const names: string[] = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: Blob) => (blobs.push(blob), 'blob:backup'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const user = userEvent.setup();
    renderAt('/bitacora', withStore(createMemoryStore(stored)));

    // Act
    await user.click(await screen.findByRole('button', { name: LOGBOOK_COPY.exportButton }));

    // Assert
    expect(names).toEqual(['al-volante-progreso-2026-10-20.json']);
    const backup = JSON.parse(await blobs[0]!.text());
    expect(backup).toMatchObject({
      format: 'al-volante-progress',
      formatVersion: 1,
      exportedAt: NOW.toISOString(),
      concepts: stored.concepts,
    });
    expect(backup.contentVersion).toMatch(/^[0-9a-f]{8}$/);
  });

  it('restores a backup after confirmation, replacing the current progress', async () => {
    const user = userEvent.setup();
    renderAt('/bitacora', withStore(createMemoryStore(stored)));
    const restored: ProgressSnapshot = {
      attempts: [],
      concepts: [concept('manual.ch3.traffic-light-colors'), concept('manual.ch3.turn-general-steps')],
    };

    await user.upload(await screen.findByLabelText(LOGBOOK_COPY.importLabel), backupFile(restored));
    expect(screen.getByText(/0 intentos y 2 conceptos/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.importConfirm }));

    expect(await screen.findByText(LOGBOOK_COPY.importDone)).toBeInTheDocument();
    expect(within(campaignB()).getByText('Intersecciones semaforizadas: significado de cada luz')).toBeInTheDocument();
    expect(within(campaignB()).queryByText('Pare y Ceda el Paso: pérdida de prioridad')).not.toBeInTheDocument();
  });

  it('keeps the current progress when the import is cancelled, invalid, too large or cannot be written', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store: ProgressStore = {
      ...createMemoryStore(stored),
      replaceAll: () => Promise.reject(new Error('AbortError')),
    };
    const user = userEvent.setup();
    renderAt('/bitacora', withStore(store));
    const input = await screen.findByLabelText(LOGBOOK_COPY.importLabel);

    await user.upload(input, backupFile({ attempts: [], concepts: [] }));
    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.importCancel }));
    expect(screen.queryByRole('button', { name: LOGBOOK_COPY.importConfirm })).not.toBeInTheDocument();

    await user.upload(input, new File(['{oops'], 'roto.json', { type: 'application/json' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      `${LOGBOOK_COPY.importErrors['invalid-json']} ${LOGBOOK_COPY.unchanged}`,
    );

    const huge = new File(['{}'], 'enorme.json', { type: 'application/json' });
    Object.defineProperty(huge, 'size', { value: MAX_BACKUP_BYTES + 1 });
    await user.upload(input, huge);
    expect(screen.getByRole('alert')).toHaveTextContent(LOGBOOK_COPY.importErrors['too-large']);

    const unreadable = new File(['{}'], 'ilegible.json', { type: 'application/json' });
    Object.defineProperty(unreadable, 'text', { value: () => Promise.reject(new Error('NotReadableError')) });
    await user.upload(input, unreadable);
    expect(screen.getByRole('alert')).toHaveTextContent(LOGBOOK_COPY.importErrors.unreadable);

    await user.upload(input, backupFile({ attempts: [], concepts: [] }));
    await user.click(screen.getByRole('button', { name: LOGBOOK_COPY.importConfirm }));
    expect(await screen.findByText(LOGBOOK_COPY.importWriteFailed)).toBeInTheDocument();

    expect(within(campaignB()).getByText('Pare y Ceda el Paso: pérdida de prioridad')).toBeInTheDocument();
  });
});
