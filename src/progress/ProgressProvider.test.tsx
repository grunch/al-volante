import { act, render, screen } from '@testing-library/react';
import { StrictMode, useContext, useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ActivityResultContext } from '../activities/ActivityResultContext.ts';
import type { ActivityResult } from '../activities/ActivityResultContext.ts';
import { evaluateResponse, presentActivity } from '../activities/engine.ts';
import { ContentProvider, useContentState } from '../content/ContentProvider.tsx';
import { choiceActivity } from '../content/testing/fixtures.ts';
import { readyContent } from '../test/renderApp.tsx';
import { ProgressProvider, useProgress } from './ProgressProvider.tsx';
import { createMemoryStore } from './storage.ts';
import type { LoadResult } from './storage.ts';

function answerResult(): ActivityResult {
  const activity = choiceActivity();
  const presentation = presentActivity(activity, 0);
  const response = {
    kind: 'choice' as const,
    optionId: presentation.kind === 'choice' ? (presentation.options[0]?.id ?? '') : '',
  };
  return { activity, presentation, response, evaluation: evaluateResponse(activity, presentation.variantId, response) };
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
    const store = { ...memory, load: () => new Promise<LoadResult>((resolve) => (finishLoading = resolve)) };
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
