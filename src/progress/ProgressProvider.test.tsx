import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ContentProvider } from '../content/ContentProvider.tsx';
import { readyContent } from '../test/renderApp.tsx';
import { ProgressProvider, useProgress } from './ProgressProvider.tsx';
import { createMemoryStore } from './storage.ts';

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

  it('requires the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Status />)).toThrow('useProgress must be used inside <ProgressProvider>');
  });
});
