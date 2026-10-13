import { initialCarState } from '../sim/car.ts';
import type { CarState } from '../sim/car.ts';
import { restingVehicle } from '../sim/vehicle.ts';
import { initialCockpit } from '../practice/cockpit.ts';
import type { ActorPose, TrafficSnapshot } from '../sim/scenario.ts';
import { Soundscape, MAX_TRAFFIC_VOICES } from './soundscape.ts';

const carAt = (timeS: number, speedMps = 0): CarState => {
  const car = initialCarState(restingVehicle(), 'manual');
  return { ...car, world: { ...car.world, timeS, vehicle: { ...car.world.vehicle, speedMps } } };
};
const pose = (id: string, x: number, z: number, kind: ActorPose['kind'] = 'vehicle'): ActorPose => ({
  id,
  x,
  z,
  kind,
  headingRad: 0,
  active: true,
  inside: () => false,
  box: { centerX: x, centerZ: z, halfLengthM: 2, halfWidthM: 1, headingRad: 0 },
});
const traffic = (...poses: ActorPose[]): TrafficSnapshot => ({
  timeS: 0,
  light: 'green',
  lights: {},
  contacts: [],
  poses,
});

describe('driving soundscape', () => {
  it('derives ignition, stall, gear and cabin cues once without changing simulation state', () => {
    const sound = new Soundscape(),
      car = carAt(0),
      cabin = initialCockpit();
    const original = structuredClone({ car, cabin });
    expect(sound.sample(car, cabin, null).cues).toEqual([]);
    const running = carAt(0.1);
    running.powertrain = {
      ...running.powertrain,
      engineRunning: true,
      engineRadS: 100,
      key: 'on',
      manualGear: '1',
      handbrake: false,
    };
    const closed = { ...cabin, belt: !cabin.belt, door: !cabin.door, horn: true };
    const mix = sound.sample(running, closed, null);
    expect(mix.cues).toEqual(expect.arrayContaining(['start', 'shift', 'handbrake', 'belt', 'door']));
    expect(mix.horn).toBe(true);
    expect(mix.engineGain).toBeGreaterThan(0);
    expect(sound.sample(running, closed, null).cues).toEqual([]);
    const stalled = carAt(0.2);
    stalled.powertrain = { ...stalled.powertrain, key: 'on' };
    expect(sound.sample(stalled, closed, null).cues).toContain('stall');
    expect({ car, cabin }).toEqual(original);
  });

  it('follows RPM and throttle, adds rolling noise in reverse and bounds extreme inputs', () => {
    const sound = new Soundscape(),
      car = carAt(0, -10);
    car.powertrain = { ...car.powertrain, engineRunning: true, engineRadS: 150 };
    const slow = sound.sample(car, initialCockpit(), null);
    const fast = carAt(0.1, 80);
    fast.powertrain = { ...car.powertrain, engineRadS: 10000 };
    fast.controls = { ...fast.controls, throttle: 5 };
    const mix = sound.sample(fast, initialCockpit(), null);
    expect(slow.roadGain).toBeGreaterThan(0);
    expect(mix.engineHz).toBeGreaterThan(slow.engineHz);
    expect(mix.engineHz).toBe(220);
    expect(mix.engineGain).toBe(0.2);
    expect(mix.roadGain).toBe(0.13);
    expect(mix.windGain).toBe(0.06);
  });

  it('pans actual passing vehicles, applies Doppler and removes inaudible actors', () => {
    const sound = new Soundscape(),
      cabin = initialCockpit();
    sound.sample(carAt(0), cabin, traffic(pose('passing', 3, -10)));
    const approach = sound.sample(carAt(0.5), cabin, traffic(pose('passing', 3, -5))).traffic[0]!;
    const recede = sound.sample(carAt(1), cabin, traffic(pose('passing', 3, 5))).traffic[0]!;
    const distant = sound.sample(carAt(1.5), cabin, traffic(pose('passing', 3, 15))).traffic[0]!;
    expect(approach.pan).toBeLessThan(0);
    expect(approach.frequency / (1 + approach.speed * 0.045)).toBeGreaterThan(
      distant.frequency / (1 + distant.speed * 0.045),
    );
    expect(recede.gain).toBeGreaterThan(distant.gain);
    expect(
      sound.sample(carAt(2), { ...cabin, lookYaw: Math.PI }, traffic(pose('passing', 3, 15))).traffic[0]!.pan,
    ).toBeGreaterThan(0);
    expect(
      sound.sample(
        carAt(2.5),
        cabin,
        traffic(pose('far', 0, 66), pose('walker', 0, 1, 'pedestrian'), pose('bike', 0, 2, 'bicycle'), {
          ...pose('hidden', 0, 3),
          active: false,
        }),
      ).traffic,
    ).toEqual([]);
  });

  it('keeps vehicle sound stable above the physics refresh rate and captures cabin changes between ticks', () => {
    const sound = new Soundscape(),
      cabin = initialCockpit();
    sound.sample(carAt(0), cabin, traffic(pose('car', 3, 10)));
    const car = carAt(0.1),
      snapshot = traffic(pose('car', 3, 11));
    const first = sound.sample(car, cabin, snapshot);
    const repeated = sound.sample(car, { ...cabin, belt: true }, snapshot);
    expect(repeated.traffic).toEqual(first.traffic);
    expect(repeated.cues).toContain('belt');
    expect(sound.sample(car, { ...cabin, belt: true }, snapshot).cues).toEqual([]);
  });

  it('limits simultaneous traffic voices with stable distance ordering and emergency sirens', () => {
    const sound = new Soundscape();
    const actors = Array.from({ length: 20 }, (_, i) => pose(`actor-${i}`, 0, i + 1, i === 0 ? 'emergency' : 'bus'));
    const mix = sound.sample(carAt(0), initialCockpit(), traffic(...actors.reverse()));
    expect(mix.traffic).toHaveLength(MAX_TRAFFIC_VOICES);
    expect(mix.traffic[0]).toMatchObject({ id: 'actor-0', siren: true });
    expect(mix.traffic[1]!.siren).toBe(false);
  });

  it('sounds a rare queue horn only from a stopped car behind, independently of head direction', () => {
    const sound = new Soundscape(),
      cabin = { ...initialCockpit(), lookYaw: Math.PI / 2 };
    const snapshot = traffic(pose('behind', 0, -8), pose('ahead', 0, 8));
    const heard: number[] = [];
    for (let t = 0; t <= 30; t += 0.5) {
      const mix = sound.sample(carAt(t), cabin, snapshot);
      for (const voice of mix.traffic)
        if (voice.horn) {
          expect(voice.id).toBe('behind');
          heard.push(t);
        }
    }
    expect(heard).toEqual([9, 27]);
    sound.sample(carAt(30.5), cabin, traffic());
    expect(sound.sample(carAt(31), cabin, snapshot).traffic.every((v) => !v.horn)).toBe(true);
  });

  it('does not replay stale cues after reset, a time rewind or a suspension gap', () => {
    const sound = new Soundscape(),
      cabin = initialCockpit();
    sound.sample(carAt(5), cabin, null);
    const running = carAt(1);
    running.powertrain = { ...running.powertrain, engineRunning: true };
    expect(sound.sample(running, cabin, null).cues).toEqual([]);
    expect(sound.sample(carAt(9), cabin, null).cues).toEqual([]);
    sound.reset();
    expect(sound.sample(running, cabin, null).cues).toEqual([]);
    expect(sound.sample(carAt(1.1), cabin, null).cues).toContain('stop');
  });

  it('times indicators and wipers from simulation time, with no duplicate cue on frozen frames', () => {
    const sound = new Soundscape(),
      cabin = { ...initialCockpit(), hazards: true, wipers: true };
    sound.sample(carAt(0.45), cabin, null);
    expect(sound.sample(carAt(0.65), cabin, null).cues).toEqual(['tick', 'wiper']);
    expect(sound.sample(carAt(0.65), cabin, null).cues).toEqual([]);
  });

  it('never hands a non-finite value to the audio graph', () => {
    const car = carAt(0, Number.NaN);
    car.powertrain = { ...car.powertrain, engineRunning: true, engineRadS: Number.NaN };
    car.controls = { ...car.controls, throttle: Number.NaN };

    const mix = new Soundscape().sample(car, initialCockpit(), null);

    expect(mix).toMatchObject({ engineHz: 18, engineGain: 0.1, roadGain: 0, windGain: 0 });
  });
});
