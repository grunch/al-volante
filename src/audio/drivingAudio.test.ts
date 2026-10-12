import { createDrivingAudio, makeNoise } from './drivingAudio.ts';
import { fakeAudio } from '../test/fakeAudio.ts';
import type { SoundMix } from './soundscape.ts';

const mix: SoundMix = {
  engineHz: 35,
  engineGain: 0.2,
  roadGain: 0.1,
  windGain: 0.03,
  horn: true,
  traffic: [{ id: 'passing', gain: 0.7, pan: -0.5, frequency: 65, speed: 12, siren: true, horn: true }],
  cues: ['start', 'stop', 'stall', 'door', 'wiper', 'tick', 'shift', 'belt', 'handbrake'],
};
describe('bounded Web Audio synthesis', () => {
  it('generates repeatable, non-silent, finite noise with bounded amplitude', () => {
    const { context } = fakeAudio();
    const a = makeNoise(context).getChannelData(0),
      b = makeNoise(context).getChannelData(0);
    expect(a.length).toBe(16000);
    expect(a).toEqual(b);
    expect(a.some((v) => Math.abs(v) > 0.1)).toBe(true);
    expect(a.every((v) => Number.isFinite(v) && Math.abs(v) < 1)).toBe(true);
  });
  it('bounds transients and releases all nodes, including scheduled effects, on repeated disposal', () => {
    const { context, nodes } = fakeAudio();
    const audio = createDrivingAudio(context);
    const continuous = nodes.length;
    audio.volume(0.45);
    audio.update(mix);
    audio.update(mix);
    audio.update(mix);
    expect(nodes.length).toBeLessThanOrEqual(continuous + 12 * 3);
    expect(nodes.some((n) => n.pan.setTargetAtTime.mock.calls.some((c) => c[0] === -0.5))).toBe(true);
    audio.reset();
    expect(nodes.slice(continuous).every((n) => n.disconnect.mock.calls.length > 0)).toBe(true);
    audio.update(mix);
    audio.dispose();
    audio.dispose();
    audio.update(mix);
    audio.volume(1);
    audio.reset();
    expect(nodes.every((n) => n.disconnect.mock.calls.length === 1)).toBe(true);
    expect(nodes.filter((n) => n.start.mock.calls.length).every((n) => n.stop.mock.calls.length > 0)).toBe(true);
  });
  it('clamps volume, fades missing voices and cleans a normally ended transient', () => {
    const { context, nodes } = fakeAudio();
    const audio = createDrivingAudio(context);
    for (const v of [-1, NaN, 2]) audio.volume(v);
    expect(nodes[0]!.gain.setTargetAtTime.mock.calls.map((c) => c[0])).toEqual([0, 0, 1]);
    const count = nodes.length;
    audio.update({ ...mix, traffic: [], cues: ['tick'] });
    nodes[count]!.onended?.();
    expect(nodes[count]!.disconnect).toHaveBeenCalledOnce();
    audio.dispose();
  });
});
