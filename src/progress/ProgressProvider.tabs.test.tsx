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
function Tab({ name, now }: { name: string; now?: () => Date }) {
  return (
    <section aria-label={name}>
      <ProgressProvider {...(now ? { now } : {})}>
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

function renderTabs(clocks: { a?: () => Date; b?: () => Date } = {}) {
  render(
    <ContentProvider load={readyContent()}>
      <Tab name="A" {...(clocks.a ? { now: clocks.a } : {})} />
      <Tab name="B" {...(clocks.b ? { now: clocks.b } : {})} />
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

  it('keeps a later answer last even when its tab clock is behind another tab', async () => {
    // Arrange: no tab messages; tab A runs an hour ahead of tab B.
    vi.stubGlobal('BroadcastChannel', undefined);
    const base = Date.parse('2026-10-20T12:00:00.000Z');
    const user = userEvent.setup();
    const { a, b } = renderTabs({ a: () => new Date(base + 60 * 60 * 1000), b: () => new Date(base) });
    await a.findByText('attempts: 0');
    await b.findByText('attempts: 0');

    // Act: A answers first, then B, which never loaded A's answer.
    await user.click(a.getByRole('button', { name: 'answer' }));
    await a.findByText('attempts: 1');
    await user.click(b.getByRole('button', { name: 'answer' }));
    await b.findByText('attempts: 2');
    await user.click(b.getByRole('button', { name: 'export' }));

    // Assert: B's answer is dated after A's, so it stays the newest.
    await b.findByText('exported: 2');
    const stored = await (await import('./storage.ts')).openProgressStore().then((store) => store.load());
    const [first, second] = [...stored.snapshot.attempts].sort(
      (x, y) => Date.parse(x.finishedAt ?? '') - Date.parse(y.finishedAt ?? ''),
    );
    expect(Date.parse(second?.finishedAt ?? '')).toBeGreaterThan(Date.parse(first?.finishedAt ?? ''));
    expect(Date.parse(first?.finishedAt ?? '')).toBe(base + 60 * 60 * 1000);
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
