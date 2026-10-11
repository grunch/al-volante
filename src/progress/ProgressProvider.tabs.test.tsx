import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActivityResultContext } from '../activities/ActivityResultContext.ts';
import type { ActivityResult } from '../activities/ActivityResultContext.ts';
import { evaluateResponse, presentActivity } from '../activities/engine.ts';
import { ContentProvider } from '../content/ContentProvider.tsx';
import { choiceActivity } from '../content/testing/fixtures.ts';
import { readyContent } from '../test/renderApp.tsx';
import { ProgressProvider, useProgress } from './ProgressProvider.tsx';

function answerResult(): ActivityResult {
  const activity = choiceActivity();
  const presentation = presentActivity(activity, 0);
  const optionId = presentation.kind === 'choice' ? (presentation.options[0]?.id ?? '') : '';
  const response = { kind: 'choice' as const, optionId };
  return { activity, presentation, response, evaluation: evaluateResponse(activity, presentation.variantId, response) };
}

/** One browser tab: its own provider and IndexedDB connection, a button to answer and one to export. */
function Tab({ name }: { name: string }) {
  return (
    <section aria-label={name}>
      <ProgressProvider>
        <TabBody />
      </ProgressProvider>
    </section>
  );
}

function TabBody() {
  const record = useContext(ActivityResultContext);
  const { state, exportSnapshot } = useProgress();
  const [exported, setExported] = useState<number | null>(null);
  return (
    <>
      <p>{state.status === 'ready' ? `attempts: ${state.data.attempts.length}` : state.status}</p>
      <button type="button" onClick={() => record(answerResult())}>
        answer
      </button>
      <button
        type="button"
        onClick={() => void exportSnapshot().then((snapshot) => setExported(snapshot.attempts.length))}
      >
        export
      </button>
      {exported !== null && <p>exported: {exported}</p>}
    </>
  );
}

function renderTabs() {
  render(
    <ContentProvider load={readyContent()}>
      <Tab name="A" />
      <Tab name="B" />
    </ContentProvider>,
  );
  return { a: within(screen.getByRole('region', { name: 'A' })), b: within(screen.getByRole('region', { name: 'B' })) };
}

describe('progress across tabs', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes every tab after another one saves an answer', async () => {
    // Arrange
    const user = userEvent.setup();
    const { a, b } = renderTabs();
    await a.findByText('attempts: 0');
    await b.findByText('attempts: 0');

    // Act / Assert
    await user.click(a.getByRole('button', { name: 'answer' }));
    expect(await a.findByText('attempts: 1')).toBeInTheDocument();
    expect(await b.findByText('attempts: 1')).toBeInTheDocument();

    await user.click(b.getByRole('button', { name: 'answer' }));
    expect(await b.findByText('attempts: 2')).toBeInTheDocument();
    expect(await a.findByText('attempts: 2')).toBeInTheDocument();
  });

  it('exports everything stored, and catches up on its own next save, even without tab messages', async () => {
    // Arrange: no BroadcastChannel, so tab B is never told about tab A's answer.
    vi.stubGlobal('BroadcastChannel', undefined);
    const user = userEvent.setup();
    const { a, b } = renderTabs();
    await a.findByText('attempts: 0');
    await b.findByText('attempts: 0');
    await user.click(a.getByRole('button', { name: 'answer' }));
    await a.findByText('attempts: 1');

    // Act
    await user.click(b.getByRole('button', { name: 'export' }));

    // Assert
    expect(await b.findByText('exported: 1')).toBeInTheDocument();
    expect(b.getByText('attempts: 0')).toBeInTheDocument();
    await act(async () => user.click(b.getByRole('button', { name: 'answer' })));
    expect(await b.findByText('attempts: 2')).toBeInTheDocument();
  });
});
