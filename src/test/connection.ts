import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Makes the browser report `online` and fires the matching window event, as a lost or regained network does.
 * Undo with `vi.restoreAllMocks()`.
 */
export function setConnection(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
  act(() => {
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
  });
}
