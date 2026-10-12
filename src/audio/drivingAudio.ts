import { MAX_TRAFFIC_VOICES } from './soundscape.ts';
import type { SoundCue, SoundMix } from './soundscape.ts';

/** Original synthesis, not recordings: deterministic combustion pulses and filtered rolling noise. */
export function makeNoise(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 713,
    smooth = 0;
  for (let i = 0; i < data.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    smooth = smooth * 0.82 + ((seed / 4294967296) * 2 - 1) * 0.18;
    data[i] = smooth;
  }
  return buffer;
}

/** Owns one bounded audio graph. The caller creates it only after a user gesture. */
export function createDrivingAudio(context: BaseAudioContext) {
  const nodes: AudioNode[] = [];
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  const shots = new Map<OscillatorNode, () => void>();
  const master = context.createGain();
  nodes.push(master);
  const limiter = context.createDynamicsCompressor();
  nodes.push(limiter);
  limiter.threshold.value = -12;
  limiter.knee.value = 18;
  limiter.ratio.value = 5;
  master.gain.value = 0;
  master.connect(limiter);
  limiter.connect(context.destination);
  const noise = makeNoise(context);
  const wave = context.createPeriodicWave(
    new Float32Array(9),
    new Float32Array([0, 1, 0.65, 0.25, 0.2, 0.1, 0.08, 0.04, 0.02]),
  );
  const gain = () => {
    const node = context.createGain();
    node.gain.value = 0;
    nodes.push(node);
    return node;
  };
  const tone = (frequency: number, target: AudioNode, engine = false) => {
    const node = context.createOscillator();
    node.frequency.value = frequency;
    if (engine) node.setPeriodicWave(wave);
    else node.type = 'triangle';
    node.connect(target);
    node.start();
    sources.push(node);
    nodes.push(node);
    return node;
  };
  const noiseLayer = (frequency: number, type: BiquadFilterType, destination: AudioNode) => {
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;
    const level = gain();
    filter.connect(level);
    level.connect(destination);
    const source = context.createBufferSource();
    source.buffer = noise;
    source.loop = true;
    source.connect(filter);
    source.start();
    sources.push(source);
    nodes.push(source, filter);
    return level;
  };
  const engine = gain();
  engine.connect(master);
  const engineTone = tone(25, engine, true);
  const road = noiseLayer(1200, 'lowpass', master),
    wind = noiseLayer(380, 'lowpass', master);
  const horn = gain();
  horn.connect(master);
  tone(350, horn);
  tone(440, horn);
  const traffic = Array.from({ length: MAX_TRAFFIC_VOICES }, () => {
    const panner = context.createStereoPanner();
    nodes.push(panner);
    panner.connect(master);
    const level = gain();
    level.connect(panner);
    const oscillator = tone(40, level, true);
    const rolling = noiseLayer(1600, 'lowpass', panner);
    const siren = gain();
    siren.connect(panner);
    const alarm = tone(650, siren);
    return { panner, level, oscillator, rolling, siren, alarm };
  });
  let disposed = false;
  const set = (param: AudioParam, value: number, smooth = 0.035) =>
    param.setTargetAtTime(value, context.currentTime, smooth);
  const shot = (frequency: number, duration: number, volume: number, endFrequency = frequency, pan = 0) => {
    if (shots.size >= 12 || disposed) return;
    const node = context.createOscillator(),
      envelope = context.createGain(),
      panner = context.createStereoPanner();
    const at = context.currentTime;
    node.type = 'triangle';
    node.frequency.setValueAtTime(frequency, at);
    node.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(volume, at + Math.min(0.02, duration / 4));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    panner.pan.value = pan;
    node.connect(envelope);
    envelope.connect(panner);
    panner.connect(master);
    const clean = () => {
      node.onended = null;
      node.disconnect();
      envelope.disconnect();
      panner.disconnect();
      shots.delete(node);
    };
    shots.set(node, clean);
    node.onended = clean;
    node.start(at);
    node.stop(at + duration + 0.02);
  };
  const cue = (value: SoundCue) => {
    if (value === 'start') {
      shot(38, 0.65, 0.28, 105);
      shot(170, 0.38, 0.08, 65);
    } else if (value === 'stop' || value === 'stall') shot(70, 0.4, 0.18, 20);
    else if (value === 'door') shot(100, 0.15, 0.2, 35);
    else if (value === 'wiper') shot(180, 0.14, 0.025, 95);
    else shot(value === 'tick' ? 1150 : 600, value === 'tick' ? 0.025 : 0.055, 0.065, 160);
  };
  return {
    update(mix: SoundMix) {
      if (disposed) return;
      set(engineTone.frequency, mix.engineHz);
      set(engine.gain, mix.engineGain);
      set(road.gain, mix.roadGain);
      set(wind.gain, mix.windGain);
      set(horn.gain, mix.horn ? 0.11 : 0, 0.012);
      traffic.forEach((voice, i) => {
        const source = mix.traffic[i];
        set(voice.level.gain, source ? source.gain * 0.14 : 0);
        set(voice.rolling.gain, source ? source.gain * Math.min(1, source.speed / 18) * 0.22 : 0);
        set(voice.siren.gain, source?.siren ? source.gain * 0.13 : 0);
        if (source) {
          set(voice.panner.pan, source.pan);
          set(voice.oscillator.frequency, source.frequency);
          set(voice.alarm.frequency, 720 + Math.sin(context.currentTime * 4) * 210);
          if (source.horn) {
            shot(330, 0.24, source.gain * 0.1, 330, source.pan);
            shot(420, 0.24, source.gain * 0.07, 420, source.pan);
          }
        }
      });
      mix.cues.forEach(cue);
    },
    volume(value: number) {
      if (!disposed) set(master.gain, Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0);
    },
    reset() {
      if (disposed) return;
      for (const [node, clean] of shots) {
        node.stop();
        clean();
      }
      set(horn.gain, 0, 0.005);
      set(engine.gain, 0, 0.005);
      set(road.gain, 0, 0.005);
      set(wind.gain, 0, 0.005);
      for (const voice of traffic) {
        set(voice.level.gain, 0, 0.005);
        set(voice.rolling.gain, 0, 0.005);
        set(voice.siren.gain, 0, 0.005);
      }
    },
    dispose() {
      if (disposed) return;
      this.reset();
      disposed = true;
      for (const source of sources) source.stop();
      for (const node of nodes) node.disconnect();
    },
  };
}
