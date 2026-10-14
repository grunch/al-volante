type LockableOrientation = ScreenOrientation & { lock?: (orientation: 'landscape') => Promise<void> };

/** Owns asynchronous browser locks, including requests that finish after teardown. */
export class MobileScreen {
  private enabled = false;
  private generation = 0;
  private wake: WakeLockSentinel | null = null;
  private full = false;
  private orientationGeneration = 0;
  constructor(private readonly unavailable: (value: boolean) => void) {}

  async keepAwake(enabled: boolean) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    const generation = ++this.generation;
    const old = this.wake;
    this.wake = null;
    if (old) void old.release().catch(() => {});
    if (!enabled) return;
    try {
      if (!navigator.wakeLock) throw new Error('Screen wake lock is unavailable');
      const lock = await navigator.wakeLock.request('screen');
      if (generation !== this.generation) {
        await lock.release();
        return;
      }
      this.wake = lock;
      this.unavailable(false);
      lock.addEventListener(
        'release',
        () => {
          if (this.wake !== lock) return;
          this.wake = null;
          this.enabled = false;
          this.unavailable(true);
        },
        { once: true },
      );
    } catch {
      if (generation === this.generation) this.unavailable(true);
    }
  }

  async fullscreen(active: boolean) {
    this.full = active;
    const generation = ++this.orientationGeneration;
    const orientation = screen.orientation as LockableOrientation | undefined;
    if (!active) {
      orientation?.unlock?.();
      return;
    }
    try {
      await orientation?.lock?.('landscape');
      if (generation !== this.orientationGeneration && !this.full) orientation?.unlock?.();
    } catch {
      // The portrait notice remains the fallback when the platform cannot lock orientation.
    }
  }

  dispose() {
    void this.keepAwake(false);
    if (this.full) void this.fullscreen(false);
  }
}
