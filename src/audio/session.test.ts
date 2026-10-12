import { AudioSession, DEFAULT_AUDIO, parseAudioSettings } from './session.ts';
import { fakeAudio } from '../test/fakeAudio.ts';
import { initialCarState } from '../sim/car.ts';
import { restingVehicle } from '../sim/vehicle.ts';
import { initialCockpit } from '../practice/cockpit.ts';

describe('audio lifetime and preferences', () => {
  it.each([null, 'broken', 'null', '{}', '{"muted":false,"volume":2}', '{"muted":1,"volume":0.5}'])(
    'validates stored preferences: %s',
    (raw) => expect(parseAudioSettings(raw)).toEqual(DEFAULT_AUDIO),
  );
  it('accepts silent and full-scale settings without inventing new fields', () => {
    for (const volume of [0, 1])
      expect(parseAudioSettings(JSON.stringify({ volume, muted: true, other: 3 }))).toEqual({ volume, muted: true });
  });
  it('creates no context until a gesture, reuses it, and stops after blur and unmount', async () => {
    const { context, calls } = fakeAudio(),
      factory = vi.fn(() => context),
      status = vi.fn();
    const session = new AudioSession(status, factory);
    session.update(initialCarState(restingVehicle(), 'manual'), initialCockpit(), null);
    expect(factory).not.toHaveBeenCalled();
    session.configure({ muted: true, volume: 0.5 });
    await session.unlock();
    expect(factory).not.toHaveBeenCalled();
    session.configure(DEFAULT_AUDIO);
    await session.unlock();
    await session.unlock();
    expect(factory).toHaveBeenCalledOnce();
    expect(calls.resume).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith('running');
    session.suspend();
    expect(calls.suspend).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith('waiting');
    await session.unlock();
    expect(calls.resume).toHaveBeenCalledTimes(2);
    session.dispose();
    session.dispose();
    session.suspend();
    await session.unlock();
    expect(calls.close).toHaveBeenCalledOnce();
  });
  it('never revives a suspended or disposed session when a pending resume resolves', async () => {
    const { context, calls } = fakeAudio(),
      status = vi.fn();
    let resolve!: () => void;
    calls.resume.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const session = new AudioSession(status, () => context);
    const pending = session.unlock();
    await session.unlock();
    session.suspend();
    session.dispose();
    resolve();
    await pending;
    expect(status).not.toHaveBeenCalledWith('running');
  });
  it('reports an unsupported or rejected context and allows a later gesture to retry', async () => {
    const { context, calls } = fakeAudio(),
      status = vi.fn();
    calls.resume.mockRejectedValueOnce(new Error('Blocked'));
    const session = new AudioSession(status, () => context);
    await session.unlock();
    expect(status).toHaveBeenLastCalledWith('unavailable');
    await session.unlock();
    expect(status).toHaveBeenLastCalledWith('running');
    session.dispose();
    const unavailable = new AudioSession(status, () => {
      throw new Error('Unsupported');
    });
    await unavailable.unlock();
    expect(status).toHaveBeenLastCalledWith('unavailable');
    unavailable.dispose();
  });
  it('closes an incompletely built graph and suppresses late suspension failures after disposal', async () => {
    const failed = fakeAudio(),
      good = fakeAudio(),
      status = vi.fn();
    vi.spyOn(failed.context, 'createGain').mockImplementationOnce(() => {
      throw new Error('Audio graph unavailable');
    });
    const factory = vi.fn().mockReturnValueOnce(failed.context).mockReturnValue(good.context);
    const session = new AudioSession(status, factory);
    await session.unlock();
    expect(failed.calls.close).toHaveBeenCalledOnce();
    expect(status).toHaveBeenLastCalledWith('unavailable');
    await session.unlock();
    expect(status).toHaveBeenLastCalledWith('running');
    good.calls.suspend.mockRejectedValueOnce(new Error('Closed'));
    session.suspend();
    session.dispose();
    status.mockClear();
    await Promise.resolve();
    expect(status).not.toHaveBeenCalled();
  });
});
