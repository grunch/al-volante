import type { CarState } from '../sim/car.ts';
import type { CockpitState } from '../practice/cockpit.ts';
import type { ActorPose, TrafficSnapshot } from '../sim/scenario.ts';
import { radSToRpm } from '../sim/powertrain/engine.ts';

export const MAX_TRAFFIC_VOICES = 6;
export type SoundCue = 'start' | 'stop' | 'stall' | 'shift' | 'belt' | 'door' | 'handbrake' | 'tick' | 'wiper';
export interface TrafficVoice {
  id: string;
  gain: number;
  pan: number;
  frequency: number;
  speed: number;
  siren: boolean;
  horn: boolean;
}
export interface SoundMix {
  engineHz: number;
  engineGain: number;
  roadGain: number;
  windGain: number;
  horn: boolean;
  traffic: TrafficVoice[];
  cues: SoundCue[];
}
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));
interface Previous {
  car: CarState;
  cabin: CockpitState;
  poses: ReadonlyMap<string, ActorPose>;
}

/** Read-only presentation: no sound changes simulation state, evaluation or the traffic random sequence. */
export class Soundscape {
  private previous: Previous | null = null;
  private waitingSince = new Map<string, number>();
  private nextHornS = 0;
  private motion = new Map<string, { speed: number; radial: number }>();

  reset(): void {
    this.previous = null;
    this.waitingSince.clear();
    this.motion.clear();
    this.nextHornS = 0;
  }

  sample(car: CarState, cabin: CockpitState, traffic: TrafficSnapshot | null): SoundMix {
    const time = car.world.timeS;
    if (this.previous && (time < this.previous.car.world.timeS || time - this.previous.car.world.timeS > 1))
      this.reset();
    const previous = this.previous;
    const dt = previous ? time - previous.car.world.timeS : 0;
    const speed = Math.abs(car.world.vehicle.speedMps);
    const cues: SoundCue[] = [];
    if (previous) {
      const before = previous.car.powertrain,
        after = car.powertrain;
      if (!before.engineRunning && after.engineRunning) cues.push('start');
      if (before.engineRunning && !after.engineRunning) cues.push(after.key === 'on' ? 'stall' : 'stop');
      if (before.manualGear !== after.manualGear || before.lever !== after.lever || before.autoGear !== after.autoGear)
        cues.push('shift');
      if (before.handbrake !== after.handbrake) cues.push('handbrake');
      if (previous.cabin.belt !== cabin.belt) cues.push('belt');
      if (previous.cabin.door !== cabin.door) cues.push('door');
      if (
        (cabin.hazards || cabin.signal !== 'off') &&
        Math.floor(time * 2) !== Math.floor(previous.car.world.timeS * 2)
      )
        cues.push('tick');
      if (cabin.wipers && Math.floor((time * 5) / Math.PI) !== Math.floor((previous.car.world.timeS * 5) / Math.PI))
        cues.push('wiper');
    }
    const listener = car.world.vehicle;
    const heading = listener.headingRad + cabin.lookYaw;
    const active = (traffic?.poses ?? []).filter((p) => p.active && p.kind !== 'pedestrian' && p.kind !== 'bicycle');
    const present = new Set(active.map((p) => p.id));
    for (const id of this.waitingSince.keys()) if (!present.has(id)) this.waitingSince.delete(id);
    for (const id of this.motion.keys()) if (!present.has(id)) this.motion.delete(id);
    const voices = active
      .map((pose) => {
        const dx = pose.x - listener.x,
          dz = pose.z - listener.z;
        const distance = Math.hypot(dx, dz);
        const old = previous?.poses.get(pose.id);
        const cached = this.motion.get(pose.id);
        const actorSpeed =
          dt === 0
            ? (cached?.speed ?? 0)
            : old?.active
              ? clamp(Math.hypot(pose.x - old.x, pose.z - old.z) / dt, 0, 35)
              : 0;
        const oldDistance =
          old && previous
            ? Math.hypot(old.x - previous.car.world.vehicle.x, old.z - previous.car.world.vehicle.z)
            : distance;
        const radialSpeed =
          dt === 0 ? (cached?.radial ?? 0) : old?.active ? clamp((distance - oldDistance) / dt, -40, 40) : 0;
        this.motion.set(pose.id, { speed: actorSpeed, radial: radialSpeed });
        const left = dx * Math.cos(heading) - dz * Math.sin(heading);
        const ahead = dx * Math.sin(listener.headingRad) + dz * Math.cos(listener.headingRad);
        // Rare queue beeps, tied to an actual stopped vehicle behind us, never an invisible random horn.
        const waiting =
          actorSpeed < 0.3 &&
          speed < 0.3 &&
          distance < 14 &&
          ahead < -4 &&
          Math.abs(dx * Math.cos(listener.headingRad) - dz * Math.sin(listener.headingRad)) < 3;
        if (!waiting) this.waitingSince.delete(pose.id);
        else if (!this.waitingSince.has(pose.id)) this.waitingSince.set(pose.id, time);
        return { pose, distance, actorSpeed, radialSpeed, left, waiting };
      })
      .filter((v) => v.distance < 65)
      .sort((a, b) => a.distance - b.distance || a.pose.id.localeCompare(b.pose.id))
      .slice(0, MAX_TRAFFIC_VOICES);
    const heard = voices.map(({ pose, distance, actorSpeed, radialSpeed, left, waiting }): TrafficVoice => {
      const horn = waiting && time >= this.nextHornS && time - (this.waitingSince.get(pose.id) ?? time) >= 9;
      if (horn) this.nextHornS = time + 18;
      return {
        id: pose.id,
        gain: clamp((1 - distance / 65) ** 2 / (1 + distance * 0.13), 0, 1),
        pan: clamp(-left / Math.max(4, distance), -1, 1),
        frequency:
          (pose.kind === 'bus' ? 31 : 43) * (1 + actorSpeed * 0.045) * clamp(343 / (343 + radialSpeed), 0.88, 1.14),
        speed: actorSpeed,
        siren: pose.kind === 'emergency',
        horn,
      };
    });
    this.previous = { car, cabin, poses: new Map((traffic?.poses ?? []).map((p) => [p.id, p])) };
    return {
      engineHz: clamp(radSToRpm(car.powertrain.engineRadS) / 30, 18, 220),
      engineGain: car.powertrain.engineRunning ? 0.1 + clamp(car.controls.throttle, 0, 1) * 0.1 : 0,
      roadGain: clamp(speed / 22, 0, 1) * 0.13,
      windGain: clamp((speed / 27) ** 2, 0, 1) * 0.06,
      horn: cabin.horn,
      traffic: heard,
      cues,
    };
  }
}
