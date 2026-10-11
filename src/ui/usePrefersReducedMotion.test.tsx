import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePrefersReducedMotion } from './usePrefersReducedMotion.ts';

function mockMatchMedia(initial: boolean) {
  let listener: (() => void) | undefined;
  const media = {
    matches: initial,
    addEventListener: vi.fn((_type: string, callback: () => void) => {
      listener = callback;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
  return {
    media,
    change(next: boolean) {
      media.matches = next;
      listener?.();
    },
  };
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the initial preference and follows changes', () => {
    const control = mockMatchMedia(true);

    const { result, unmount } = renderHook(() => usePrefersReducedMotion());
    const initial = result.current;
    act(() => control.change(false));

    expect(initial).toBe(true);
    expect(result.current).toBe(false);
    unmount();
    expect(control.media.removeEventListener).toHaveBeenCalled();
  });

  it('defaults to full motion when matchMedia is not available', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(false);
  });
});
