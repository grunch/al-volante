import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PWA_COPY } from '../i18n/es-AR.ts';
import { setConnection } from '../test/connection.ts';
import { fakeServiceWorker } from '../test/fakeServiceWorker.ts';
import { PwaStatus } from './PwaStatus.tsx';
import { createUpdateStore } from './updates.ts';
import type { UpdateStore } from './updates.ts';
import { useUpdateHold } from './useUpdates.ts';

function renderStatus({ controlled = true } = {}) {
  const worker = fakeServiceWorker({ controlled });
  const store = createUpdateStore(worker.environment);
  store.start(worker.register);
  const utils = render(
    <>
      <button type="button">Contenido de la página</button>
      <PwaStatus store={store} />
    </>,
  );
  return { worker, store, ...utils };
}

/** Stands for a running exam page. */
function RunningExam({ store, running }: { store: UpdateStore; running: boolean }) {
  useUpdateHold(running, store);
  return <p>{running ? 'Examen en curso' : 'Examen terminado'}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PwaStatus', () => {
  it('shows nothing while online with nothing to report', () => {
    const { container } = renderStatus();

    expect(container.querySelector('.pwa-status')).toBeEmptyDOMElement();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('announces a lost connection and clears the notice when it comes back', () => {
    renderStatus();

    setConnection(false);
    const offline = screen.getByRole('status');
    const offlineText = offline.textContent;
    setConnection(true);

    expect(offlineText).toBe(PWA_COPY.offline);
    expect(offline).not.toBeInTheDocument();
  });

  it('says once that the app works offline, until the player dismisses it', async () => {
    const user = userEvent.setup();
    const { worker } = renderStatus({ controlled: false });

    act(() => worker.offlineReady());
    const notice = screen.getByRole('status');
    const noticeText = notice.textContent;
    await user.click(screen.getByRole('button', { name: PWA_COPY.gotIt }));

    expect(noticeText).toBe(PWA_COPY.offlineReady);
    expect(notice).not.toBeInTheDocument();
  });

  it('offers a new version without taking the focus, and applies it from the keyboard', async () => {
    // Arrange
    const user = userEvent.setup();
    const { worker } = renderStatus();
    screen.getByRole('button', { name: 'Contenido de la página' }).focus();

    // Act
    act(() => worker.needRefresh());
    const focusAfterNotice = document.activeElement;
    await user.tab();
    const firstStop = document.activeElement?.textContent;
    await user.keyboard('{Enter}');

    // Assert
    expect(screen.getByRole('region', { name: PWA_COPY.updateAvailable })).toBeVisible();
    expect(focusAfterNotice).toHaveTextContent('Contenido de la página');
    expect(firstStop).toBe(PWA_COPY.update);
    await waitFor(() => expect(worker.activate).toHaveBeenCalledTimes(1));
    // The pressed button keeps the focus while the new version activates.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: PWA_COPY.updating }));
    expect(document.activeElement).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('button', { name: PWA_COPY.later })).not.toBeInTheDocument();
    expect(worker.reload).not.toHaveBeenCalled();
    act(() => worker.changeController());
    await waitFor(() => expect(worker.reload).toHaveBeenCalledTimes(1));
  });

  it('hides the prompt on «Más tarde» without activating anything', async () => {
    const user = userEvent.setup();
    const { worker } = renderStatus();
    act(() => worker.needRefresh());

    await user.click(screen.getByRole('button', { name: PWA_COPY.later }));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(worker.activate).not.toHaveBeenCalled();
  });

  it('offers a reload when another tab installed the new version, and reloads only on «Actualizar»', async () => {
    const user = userEvent.setup();
    const { worker } = renderStatus();
    act(() => worker.needRefresh());

    act(() => worker.changeController());
    const text = screen.getByRole('status').textContent;
    const reloadsBeforeClick = worker.reload.mock.calls.length;
    await user.click(screen.getByRole('button', { name: PWA_COPY.update }));

    expect(text).toBe(PWA_COPY.updateActivatedElsewhere);
    expect(reloadsBeforeClick).toBe(0);
    await waitFor(() => expect(worker.reload).toHaveBeenCalledTimes(1));
  });

  it('keeps the prompt away while an exam runs and shows it when the exam ends', () => {
    // Arrange
    const worker = fakeServiceWorker({ controlled: true });
    const store = createUpdateStore(worker.environment);
    store.start(worker.register);
    const page = (running: boolean) => (
      <>
        <RunningExam store={store} running={running} />
        <PwaStatus store={store} />
      </>
    );
    const { rerender } = render(page(true));

    // Act
    act(() => worker.needRefresh());
    act(() => worker.offlineReady());
    const duringExam = screen.queryAllByRole('region');
    rerender(page(false));

    // Assert
    expect(duringExam).toEqual([]);
    expect(screen.getByRole('button', { name: PWA_COPY.update })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: PWA_COPY.gotIt })).toBeInTheDocument();
  });
  it('does not promise that the app keeps working offline before it is ready to', () => {
    renderStatus({ controlled: false });

    setConnection(false);

    expect(screen.getByRole('status')).toHaveTextContent(PWA_COPY.offlineNotReady);
  });

  it('says when offline use could not be prepared, never claims it, and registers again on «Reintentar»', async () => {
    // Arrange
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const { worker } = renderStatus({ controlled: false });

    // Act
    act(() => worker.registerError(new TypeError('Failed to register a ServiceWorker: 404')));
    const failure = screen.getByRole('region', { name: PWA_COPY.registrationFailed });
    setConnection(false);
    const offlineText = screen.getAllByRole('status')[0]?.textContent;
    await user.click(screen.getByRole('button', { name: PWA_COPY.retry }));

    // Assert
    expect(failure).not.toBeInTheDocument();
    expect(offlineText).toBe(PWA_COPY.offlineNotReady);
    expect(worker.register).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(PWA_COPY.offlineReady)).not.toBeInTheDocument();
  });

  it('closes the failure notice on request', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const user = userEvent.setup();
    const { worker } = renderStatus({ controlled: false });
    act(() => worker.registerError(new TypeError('blocked')));

    await user.click(screen.getByRole('button', { name: PWA_COPY.close }));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(worker.register).toHaveBeenCalledTimes(1);
  });
});
