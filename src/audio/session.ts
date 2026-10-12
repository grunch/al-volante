import { createDrivingAudio } from './drivingAudio.ts';
import { Soundscape } from './soundscape.ts';
import type { CarState } from '../sim/car.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import type { TrafficSnapshot } from '../sim/scenario.ts';

export interface AudioSettings {
  muted: boolean;
  volume: number;
}
export type AudioStatus = 'waiting' | 'running' | 'unavailable';
export const AUDIO_STORAGE_KEY = 'al-volante.audio.v1';
export const DEFAULT_AUDIO: AudioSettings = { muted: false, volume: 0.45 };
export function parseAudioSettings(raw: string | null): AudioSettings {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (
      value &&
      typeof value === 'object' &&
      'muted' in value &&
      typeof value.muted === 'boolean' &&
      'volume' in value &&
      typeof value.volume === 'number' &&
      Number.isFinite(value.volume) &&
      value.volume >= 0 &&
      value.volume <= 1
    )
      return { muted: value.muted, volume: value.volume };
  } catch {
    /* Invalid preferences must not prevent driving. */
  }
  return { ...DEFAULT_AUDIO };
}

/** Gesture-gated lifetime, independent of the physics loop and its render rate. */
export class AudioSession {
  private context: AudioContext | null = null;
  private graph: ReturnType<typeof createDrivingAudio> | null = null;
  private soundscape = new Soundscape();
  private active = false;
  private disposed = false;
  private generation = 0;
  private resuming = false;
  private settings = { ...DEFAULT_AUDIO };
  constructor(
    private status: (value: AudioStatus) => void,
    private factory = () => new AudioContext(),
  ) {}

  configure(settings: AudioSettings): void {
    this.settings = { ...settings };
    this.graph?.volume(this.active && !settings.muted ? settings.volume : 0);
  }
  async unlock(): Promise<void> {
    if (this.disposed || this.resuming || this.settings.muted || this.active) return;
    const generation = ++this.generation;
    this.resuming = true;
    try {
      if (!this.context) {
        this.context = this.factory();
        this.graph = createDrivingAudio(this.context);
      }
      await this.context.resume();
      if (this.disposed || generation !== this.generation) return;
      this.active = true;
      this.graph?.volume(this.settings.muted ? 0 : this.settings.volume);
      this.status('running');
    } catch {
      if (!this.graph && this.context) {
        void this.context.close().catch(() => {
          /* A failed graph must not retain an audio device. */
        });
        this.context = null;
      }
      if (!this.disposed && generation === this.generation) this.status('unavailable');
    } finally {
      this.resuming = false;
    }
  }
  update(car: CarState, cabin: CockpitState, traffic: TrafficSnapshot | null): void {
    // Keep the baseline current even before unlock; no stale start/door cues on resuming.
    const mix = this.soundscape.sample(car, cabin, traffic);
    if (this.active && !this.disposed) this.graph?.update(mix);
  }
  reset(): void {
    this.soundscape.reset();
    this.graph?.reset();
  }
  suspend(): void {
    if (this.disposed) return;
    this.generation++;
    this.active = false;
    this.graph?.volume(0);
    this.reset();
    const generation = this.generation;
    void this.context?.suspend().catch(() => {
      if (!this.disposed && generation === this.generation) this.status('unavailable');
    });
    this.status('waiting');
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.graph?.dispose();
    void this.context?.close().catch(() => {
      /* The context is already unreachable and disconnected. */
    });
    this.graph = null;
    this.context = null;
  }
}
