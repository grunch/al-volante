import { act, renderHook } from '@testing-library/react';
import { useDrivingAudio } from './useDrivingAudio.ts';
import { AUDIO_STORAGE_KEY } from './session.ts';
import { fakeAudio } from '../test/fakeAudio.ts';

describe('audio preferences and focus integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });
  it('persists mute and volume, suspends on focus loss and releases the context on unmount', async () => {
    const { context, calls } = fakeAudio();
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function () {
        return context;
      }),
    );
    const { result, unmount } = renderHook(useDrivingAudio);
    await act(async () => {
      await result.current.session.current?.unlock();
    });
    expect(result.current.status).toBe('running');
    act(() => result.current.change({ muted: true, volume: 0.25 }));
    expect(JSON.parse(localStorage.getItem(AUDIO_STORAGE_KEY)!)).toEqual({ muted: true, volume: 0.25 });
    act(() => window.dispatchEvent(new Event('blur')));
    expect(result.current.status).toBe('waiting');
    expect(calls.suspend).toHaveBeenCalledOnce();
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(calls.suspend).toHaveBeenCalledTimes(2);
    unmount();
    expect(calls.close).toHaveBeenCalledOnce();
    window.dispatchEvent(new Event('blur'));
    expect(calls.suspend).toHaveBeenCalledTimes(2);
  });
  it('reports failed persistence while keeping the selected volume usable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    const { result } = renderHook(useDrivingAudio);
    const setter = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    await act(async () => result.current.change({ muted: true, volume: 0.2 }));
    expect(result.current.settings.volume).toBe(0.2);
    expect(result.current.storageError).toBe(true);
    setter.mockRestore();
    await act(async () => result.current.change({ muted: true, volume: 0.3 }));
    expect(result.current.storageError).toBe(false);
  });
});
