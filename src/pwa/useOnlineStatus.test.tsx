import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setConnection } from '../test/connection.ts';
import { useOnlineStatus } from './useOnlineStatus.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useOnlineStatus', () => {
  it('starts from what the browser reports and follows the offline and online events', () => {
    // Arrange
    const { result } = renderHook(() => useOnlineStatus());
    const initial = result.current;

    // Act
    setConnection(false);
    const offline = result.current;
    setConnection(true);

    // Assert
    expect(initial).toBe(true);
    expect(offline).toBe(false);
    expect(result.current).toBe(true);
  });

  it('stops listening when the component unmounts', () => {
    const removed = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    const events = removed.mock.calls.map(([type]) => type);
    expect(events).toEqual(expect.arrayContaining(['online', 'offline']));
  });
});
