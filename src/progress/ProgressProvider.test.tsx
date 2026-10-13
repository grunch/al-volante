import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityResultContext } from '../activities/ActivityResultContext.ts';
import type { ActivityResult, SaveOutcome } from '../activities/ActivityResultContext.ts';
import { evaluateResponse, presentActivity } from '../activities/engine.ts';
import { ContentProvider, useContentState } from '../content/ContentProvider.tsx';
import { choiceActivity } from '../content/testing/fixtures.ts';
import type { ContentResult } from '../content/validate.ts';
import { readyContent } from '../test/renderApp.tsx';
import { createAttempt } from './model.ts';
import { PROGRESS_CHANNEL, ProgressProvider, useProgress } from './ProgressProvider.tsx';
import type { AttemptContext } from './ProgressProvider.tsx';
import { createMemoryStore } from './storage.ts';
import type { LoadResult, ProgressStore } from './storage.ts';

function answerResult(): ActivityResult {
  const activity = choiceActivity();
  const presentation = presentActivity(activity, 0);
  const response = {
    kind: 'choice' as const,
    optionId: presentation.kind === 'choice' ? (presentation.options[0]?.id ?? '') : '',
  };
  return { activity, presentation, response, evaluation: evaluateResponse(activity, presentation.variantId, response) };
}

const NOW = '2026-10-20T12:00:00.000Z';

/** A stored answer, as createAttempt builds it. */
function answerAttempt(id = 'a1', at = NOW) {
  return createAttempt(
    {
      activityId: 'act.speed-street',
      unitIds: ['manual.ch3.roundabout-priority'],
      variantId: 'v1',
      seed: 0,
      response: { kind: 'choice', optionId: 'a' },
      correct: true,
      score: 1,
      mode: 'practice',
    },
    { id, at, contentVersion: 'deadbeef' },
  );
}

/** Answers once, as soon as content is ready, whatever the state of progress. */
function AnswerOnce() {
  const record = useContext(ActivityResultContext);
  const content = useContentState();
  const answered = useRef(false);
  useEffect(() => {
    if (content.status !== 'ready' || answered.current) return;
    answered.current = true;
    record(answerResult());
  }, [content, record]);
  return null;
}

function Attempts() {
  const { state } = useProgress();
  return <p>{state.status === 'ready' ? `attempts: ${state.data.attempts.length}` : state.status}</p>;
}

function Status() {
  return <p>{useProgress().state.status}</p>;
}

describe('ProgressProvider', () => {
  it('closes every store it opens, including the one opened by the discarded StrictMode effect', async () => {
    // Arrange
    const stores = [createMemoryStore(), createMemoryStore()].map((store) => ({ ...store, close: vi.fn() }));
    let opened = 0;
    const openStore = () => Promise.resolve(stores[opened++]!);

    // Act
    const { findByText, unmount } = render(
      <StrictMode>
        <ContentProvider load={readyContent()}>
          <ProgressProvider openStore={openStore}>
            <Status />
          </ProgressProvider>
        </ContentProvider>
      </StrictMode>,
    );
    await findByText('ready');
    unmount();

    // Assert
    expect(opened).toBe(2);
    for (const store of stores) expect(store.close).toHaveBeenCalledTimes(1);
  });

  it('keeps an answer given while progress is still loading and saves it once loading ends', async () => {
    // Arrange: loading stays pending until the test releases it.
    const memory = createMemoryStore();
    let finishLoading: (result: LoadResult) => void = () => undefined;
    // Only the first load stays pending; reading back after the write uses the real data.
    const firstLoad = new Promise<LoadResult>((resolve) => (finishLoading = resolve));
    const store = {
      ...memory,
      load: vi
        .fn<() => Promise<LoadResult>>()
        .mockReturnValueOnce(firstLoad)
        .mockImplementation(() => memory.load()),
    };
    const record = vi.spyOn(store, 'record');

    // Act
    render(
      <ContentProvider load={readyContent()}>
        <ProgressProvider openStore={() => Promise.resolve(store)}>
          <AnswerOnce />
          <Attempts />
        </ProgressProvider>
      </ContentProvider>,
    );
    await screen.findByText('loading');
    expect(record).not.toHaveBeenCalled();
    await act(async () => finishLoading({ snapshot: { attempts: [], concepts: [] }, quarantined: 0 }));

    // Assert
    expect(await screen.findByText('attempts: 1')).toBeInTheDocument();
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('requires the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Status />)).toThrow('useProgress must be used inside <ProgressProvider>');
  });
});

type ProgressValue = ReturnType<typeof useProgress>;

/** Renders the provider around a probe that hands out the latest context value and the result recorder. */
function renderProbe(
  openStore: () => Promise<ProgressStore>,
  options: { content?: () => Promise<ContentResult> } = {},
) {
  const latest: { progress: ProgressValue | null; record: ((result: ActivityResult) => Promise<SaveOutcome>) | null } =
    { progress: null, record: null };
  function Probe() {
    const progress = useProgress();
    const record = useContext(ActivityResultContext);
    // During the commit, so the value is current as soon as the text a test waits for is on screen.
    useLayoutEffect(() => {
      latest.progress = progress;
      latest.record = record;
    });
    const content = useContentState().status;
    const { state, unsaved } = progress;
    // Answers are recorded only with the content version, so tests wait for both loads.
    return (
      <p>
        {state.status === 'ready' ? `attempts: ${state.data.attempts.length}` : state.status} · unsaved: {unsaved} ·
        content: {content}
      </p>
    );
  }
  const view = render(
    <ContentProvider load={options.content ?? readyContent()}>
      <ProgressProvider openStore={openStore} createId={() => 'fixed-id'} now={() => new Date(NOW)}>
        <Probe />
      </ProgressProvider>
    </ContentProvider>,
  );
  const progress = () => latest.progress as ProgressValue;
  const record = (result: ActivityResult) =>
    (latest.record as (result: ActivityResult) => Promise<SaveOutcome>)(result);
  return { ...view, progress, record };
}

describe('ProgressProvider failures', () => {
  it('counts an answer that could not be saved until the person acknowledges it', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store: ProgressStore = {
      ...createMemoryStore(),
      record: () => Promise.reject(new Error('QuotaExceededError')),
    };
    const { progress, record } = renderProbe(() => Promise.resolve(store));
    await screen.findByText(/attempts: 0 .*content: ready/);

    // Act
    const outcome = await act(() => record(answerResult()));

    // Assert
    expect(outcome).toBe('failed');
    expect(screen.getByText(/unsaved: 1/)).toBeInTheDocument();
    act(() => progress().acknowledgeUnsaved());
    expect(screen.getByText(/unsaved: 0/)).toBeInTheDocument();
  });

  it('still shows its own answer when the write worked but reading it back failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = createMemoryStore();
    const store: ProgressStore = {
      ...memory,
      load: vi
        .fn<ProgressStore['load']>()
        .mockImplementationOnce(() => memory.load())
        .mockRejectedValue(new Error('NotReadableError')),
    };
    const { record } = renderProbe(() => Promise.resolve(store));
    await screen.findByText(/attempts: 0 .*content: ready/);

    const outcome = await act(() => record(answerResult()));

    expect(outcome).toBe('saved');
    expect(screen.getByText(/attempts: 1/)).toBeInTheDocument();
    expect((await memory.load()).snapshot.attempts).toHaveLength(1);
  });

  it('records nothing and refuses to import or export when the store could not be opened', async () => {
    // Arrange: a rejection that is not an Error still becomes a readable message.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { progress, record } = renderProbe(() => Promise.reject('SecurityError'));
    await screen.findByText(/error .*content: ready/);

    // Act / Assert
    expect(progress().state).toEqual({ status: 'error', message: 'SecurityError' });
    await expect(record(answerResult())).resolves.toBe('not-recorded');
    await expect(progress().recordAttempt(() => answerAttempt())).resolves.toBe('not-recorded');
    await expect(progress().replaceAll({ attempts: [], concepts: [] })).rejects.toThrow('Progress is not loaded');
    await expect(progress().exportSnapshot()).rejects.toThrow('Progress is not loaded');
  });

  it('records nothing while the content, and so its version, is not loaded', async () => {
    const store = createMemoryStore();
    const record = vi.spyOn(store, 'record');
    const { progress, record: answer } = renderProbe(() => Promise.resolve(store), {
      content: () => new Promise<ContentResult>(() => undefined),
    });
    await screen.findByText(/attempts: 0 .*content: loading/);

    await expect(answer(answerResult())).resolves.toBe('not-recorded');
    await expect(progress().recordAttempt(() => answerAttempt())).resolves.toBe('not-recorded');
    expect(record).not.toHaveBeenCalled();
  });

  it('retries loading after an error and shows what is stored', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = createMemoryStore({ attempts: [answerAttempt()], concepts: [] });
    const close = vi.fn();
    const failing: ProgressStore = { ...memory, close, load: () => Promise.reject(new Error('busy')) };
    const opens = [failing, memory];
    const { progress } = renderProbe(() => Promise.resolve(opens.shift() as ProgressStore));
    await screen.findByText(/error .*content: ready/);

    act(() => progress().retry());

    expect(await screen.findByText(/attempts: 1/)).toBeInTheDocument();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('keeps showing what it had when reloading after another tab saved fails', async () => {
    // Arrange
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const memory = createMemoryStore({ attempts: [answerAttempt()], concepts: [] });
    const store: ProgressStore = {
      ...memory,
      load: vi
        .fn<ProgressStore['load']>()
        .mockImplementationOnce(() => memory.load())
        .mockRejectedValue(new Error('NotReadableError')),
    };
    renderProbe(() => Promise.resolve(store));
    await screen.findByText(/attempts: 1 .*content: ready/);
    const otherTab = new BroadcastChannel(PROGRESS_CHANNEL);

    // Act
    otherTab.postMessage('changed');

    // Assert
    await waitFor(() => expect(error).toHaveBeenCalledWith('Could not refresh progress', expect.any(Error)));
    expect(screen.getByText(/attempts: 1/)).toBeInTheDocument();
    otherTab.close();
  });

  it('closes a store that finishes loading after the provider is gone, without touching its state', async () => {
    // Arrange
    let finishLoading: ((result: LoadResult) => void) | null = null;
    const close = vi.fn();
    const store: ProgressStore = {
      ...createMemoryStore(),
      close,
      load: () => new Promise<LoadResult>((resolve) => (finishLoading = resolve)),
    };
    const error = vi.spyOn(console, 'error');
    const { unmount } = renderProbe(() => Promise.resolve(store));
    await waitFor(() => expect(finishLoading).not.toBeNull());

    // Act
    unmount();
    await act(async () => finishLoading?.({ snapshot: { attempts: [], concepts: [] }, quarantined: 0 }));

    // Assert
    expect(close).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});

describe('ProgressProvider after unmount', () => {
  it('neither logs nor shows an error for a load that fails after the provider is gone', async () => {
    // Arrange: the store opens, then its first read fails once the provider has unmounted.
    let failLoading: ((error: Error) => void) | null = null;
    const store: ProgressStore = {
      ...createMemoryStore(),
      load: () => new Promise<LoadResult>((_resolve, reject) => (failLoading = reject)),
    };
    const error = vi.spyOn(console, 'error');
    const { unmount } = renderProbe(() => Promise.resolve(store));
    await waitFor(() => expect(failLoading).not.toBeNull());

    // Act
    unmount();
    await act(async () => failLoading?.(new Error('AbortError')));

    // Assert
    expect(error).not.toHaveBeenCalled();
  });
});

describe('ProgressProvider attempts without concepts', () => {
  it('stores a drive or a mock exam with the stored time and its own id, training no concept', async () => {
    // Arrange: an attempt already stored an hour ahead of this clock.
    const ahead = '2026-10-20T13:00:00.000Z';
    const store = createMemoryStore({ attempts: [answerAttempt('old', ahead)], concepts: [] });
    const { progress } = renderProbe(() => Promise.resolve(store));
    await screen.findByText(/attempts: 1 .*content: ready/);
    const contexts: AttemptContext[] = [];

    // Act
    const outcome = await act(() =>
      progress().recordAttempt((context) => {
        contexts.push(context);
        return answerAttempt(context.id, context.at);
      }),
    );

    // Assert
    expect(outcome).toBe('saved');
    expect(contexts).toEqual([{ id: 'fixed-id', at: '2026-10-20T13:00:00.001Z', contentVersion: 'deadbeef' }]);
    expect((await store.load()).snapshot.concepts).toEqual([]);
    expect(screen.getByText(/attempts: 2/)).toBeInTheDocument();
  });
});

describe('ProgressProvider attempt ids', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('still names attempts outside a secure context, where crypto.randomUUID does not exist', async () => {
    // Arrange: plain http on a local network has crypto without randomUUID.
    vi.stubGlobal('crypto', {});
    const store = createMemoryStore();

    // Act
    render(
      <ContentProvider load={readyContent()}>
        <ProgressProvider openStore={() => Promise.resolve(store)}>
          <AnswerOnce />
          <Attempts />
        </ProgressProvider>
      </ContentProvider>,
    );
    await screen.findByText('attempts: 1');

    // Assert
    const [stored] = (await store.load()).snapshot.attempts;
    expect(stored?.id).toMatch(/^[0-9a-z]+-[0-9a-z]+$/);
  });
});
