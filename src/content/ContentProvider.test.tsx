import { act, render, screen } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { readyContent, testContent } from '../test/renderApp.tsx';
import { ContentProvider, useContentState } from './ContentProvider.tsx';
import type { ContentState } from './ContentProvider.tsx';
import type { ContentResult } from './validate.ts';

/** Shows the state and hands out the latest one, so a test can press retry. */
function renderProvider(load: () => Promise<ContentResult>) {
  const latest: { state: ContentState | null } = { state: null };
  function Probe() {
    const state = useContentState();
    // During the commit, so the state is current as soon as its text is on screen.
    useLayoutEffect(() => {
      latest.state = state;
    });
    return <p>{state.status === 'error' ? `error: ${state.errors.join(' | ')}` : state.status}</p>;
  }
  const view = render(
    <ContentProvider load={load}>
      <Probe />
    </ContentProvider>,
  );
  return { ...view, state: () => latest.state as ContentState };
}

describe('ContentProvider', () => {
  it('shares the validated content and its version once loaded', async () => {
    const { state } = renderProvider(readyContent());

    expect(await screen.findByText('ready')).toBeInTheDocument();
    expect(state()).toEqual({ status: 'ready', content: testContent(), version: 'deadbeef' });
  });

  it('shows validation errors and loads again on retry', async () => {
    // Arrange: the first load finds broken content, the second one the fixed content.
    const load = vi
      .fn<() => Promise<ContentResult>>()
      .mockResolvedValueOnce({ ok: false, errors: ['specs/catalog/units.json[0].id: Invalid', 'rules: x'] })
      .mockImplementation(readyContent());
    const { state } = renderProvider(load);
    await screen.findByText('error: specs/catalog/units.json[0].id: Invalid | rules: x');

    // Act
    const current = state();
    act(() => {
      if (current.status === 'error') current.retry();
    });

    // Assert
    expect(await screen.findByText('ready')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('turns a failed load, such as a chunk that did not arrive, into a readable error', async () => {
    renderProvider(() => Promise.reject(new Error('Failed to fetch dynamically imported module')));

    expect(await screen.findByText('error: Failed to fetch dynamically imported module')).toBeInTheDocument();
  });

  it('reports a rejection that is not an Error by its text', async () => {
    renderProvider(() => Promise.reject('offline'));

    expect(await screen.findByText('error: offline')).toBeInTheDocument();
  });

  it('ignores a load that finishes after the provider is gone', async () => {
    // Arrange
    let finish: (result: ContentResult) => void = () => undefined;
    const error = vi.spyOn(console, 'error');
    const { unmount } = renderProvider(() => new Promise<ContentResult>((resolve) => (finish = resolve)));

    // Act
    unmount();
    await act(async () => finish({ ok: false, errors: ['late'] }));

    // Assert
    expect(error).not.toHaveBeenCalled();
  });

  it('requires the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    function Orphan() {
      return <p>{useContentState().status}</p>;
    }

    expect(() => render(<Orphan />)).toThrow('useContentState must be used inside <ContentProvider>');
  });
});
