import type { CarEvent } from '../sim/car.ts';
import { ContinuousInput } from './continuousInput.ts';
import type { PedalReading } from './continuousInput.ts';
import { DrivingHaptics } from './haptics.ts';
import { DEFAULT_MOBILE_SETTINGS, MOBILE_SETTINGS_KEY, parseMobileSettings } from './mobileDriving.ts';
import type { MobileSettings } from './mobileDriving.ts';
import { MobileScreen } from './mobileScreen.ts';
import { MotionSensor } from './motionSensor.ts';
import { validGravity } from './tilt.ts';
import type { TiltStatus } from './tilt.ts';

export interface MobileSnapshot {
  started: boolean;
  settings: MobileSettings;
  status: TiltStatus | 'off' | 'unavailable';
  storageError: boolean;
  wakeError: boolean;
  vibrationAvailable: boolean;
}

/** Session orchestration stays outside React and never mutates the car or exam. */
export class MobileSession {
  readonly input = new ContinuousInput();
  private sensor: MotionSensor;
  private screen: MobileScreen;
  private haptics: DrivingHaptics | null;
  private suspended = false;
  private failed = false;
  private startedAtMs = 0;
  private lastReadingMs: number | null = null;
  private disposed = false;
  snapshot: MobileSnapshot;

  constructor(private readonly changed: (snapshot: MobileSnapshot) => void) {
    let settings = DEFAULT_MOBILE_SETTINGS;
    try {
      settings = parseMobileSettings(localStorage.getItem(MOBILE_SETTINGS_KEY));
    } catch {
      /* Memory defaults remain usable. */
    }
    this.snapshot = {
      started: false,
      settings,
      status: 'waiting',
      storageError: false,
      wakeError: false,
      vibrationAvailable: typeof navigator.vibrate === 'function',
    };
    this.haptics = this.snapshot.vibrationAvailable
      ? new DrivingHaptics((pattern) => navigator.vibrate(pattern))
      : null;
    this.screen = new MobileScreen((wakeError) => this.publish({ wakeError }));
    this.sensor = new MotionSensor(
      (reading) => {
        if (this.disposed || this.suspended || !this.snapshot.settings.tiltEnabled || !validGravity(reading)) return;
        this.lastReadingMs = reading.atMs;
        this.input.pushGravity(reading);
      },
      () => {
        this.failed = true;
        this.input.release();
        this.publish({ status: 'unavailable' });
      },
    );
  }

  private publish(change: Partial<MobileSnapshot>) {
    if (
      this.disposed ||
      Object.entries(change).every(([key, value]) => this.snapshot[key as keyof MobileSnapshot] === value)
    )
      return;
    this.snapshot = { ...this.snapshot, ...change };
    this.changed(this.snapshot);
  }

  start(atMs = performance.now()) {
    this.publish({ started: true });
    this.suspended = false;
    this.failed = false;
    this.startedAtMs = atMs;
    this.lastReadingMs = null;
    if (this.snapshot.settings.tiltEnabled) void this.sensor.start();
  }

  change(settings: MobileSettings) {
    const previous = this.snapshot.settings;
    this.publish({ settings });
    try {
      localStorage.setItem(MOBILE_SETTINGS_KEY, JSON.stringify(settings));
      this.publish({ storageError: false });
    } catch {
      this.publish({ storageError: true });
    }
    if (!settings.vibration) this.haptics?.stop();
    if (previous.tiltEnabled !== settings.tiltEnabled) {
      this.sensor.stop();
      this.input.release();
      void this.screen.keepAwake(false);
      if (settings.tiltEnabled && this.snapshot.started && !this.suspended) this.start();
      this.publish({ status: settings.tiltEnabled ? 'waiting' : 'off' });
    }
  }

  pedals(reading: PedalReading) {
    if (this.snapshot.started && !this.suspended) this.input.pushPedals(reading);
  }
  recenter() {
    this.input.tilt.recenter();
  }
  release() {
    this.input.release();
  }
  sample(atMs: number) {
    return this.input.sample(
      atMs,
      this.snapshot.started && !this.suspended && !this.failed && this.snapshot.settings.tiltEnabled,
      this.snapshot.settings.fullLockDeg,
    );
  }
  update(atMs: number, events: readonly CarEvent[]) {
    if (!this.snapshot.started || this.suspended) return;
    const { settings } = this.snapshot;
    const status = !settings.tiltEnabled
      ? 'off'
      : this.failed || (this.lastReadingMs === null && atMs - this.startedAtMs >= 1000)
        ? 'unavailable'
        : this.input.tilt.status;
    this.publish({ status });
    void this.screen.keepAwake(
      settings.tiltEnabled && !this.failed && this.lastReadingMs !== null && atMs - this.lastReadingMs <= 250,
    );
    if (settings.vibration) this.haptics?.update(events, atMs);
  }
  fullscreen(active: boolean) {
    void this.screen.fullscreen(active);
  }
  suspend() {
    this.suspended = true;
    this.sensor.stop();
    this.input.release();
    this.haptics?.stop();
    void this.screen.keepAwake(false);
    this.publish({ status: 'waiting' });
  }
  resume() {
    if (this.snapshot.started && this.suspended) this.start();
  }
  dispose() {
    this.disposed = true;
    this.suspend();
    this.screen.dispose();
  }
}
