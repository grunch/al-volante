import { describe, expect, it } from 'vitest';
import { driveFrame, startDriving } from './drivingLoop.ts';
import type { DrivingFrame } from './drivingLoop.ts';
import * as FIRST from '../sim/tracks/firstBlock.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../sim/tracks/practiceYard.ts';

/** Automatic, engine running, in D with the handbrake off: K K, then E E E with the brake held, then Space. */
function readyInD(start = PRACTICE_YARD_START): DrivingFrame {
  let frame = startDriving(start, 'automatic');
  frame = driveFrame(PRACTICE_YARD, frame, new Set(), ['KeyK', 'KeyK'], 0);
  // Frames advance at most 0.1 s each, so the brake is held over real 60 Hz frames.
  for (let i = 0; i < 30; i += 1) frame = driveFrame(PRACTICE_YARD, frame, new Set(['ArrowDown']), [], 1 / 60);
  frame = driveFrame(PRACTICE_YARD, frame, new Set(['ArrowDown']), ['KeyE', 'KeyE', 'KeyE', 'Space'], 0);
  return frame;
}

function drive(hz: number, seconds: number) {
  let frame = readyInD();
  const keys = new Set(['ArrowUp', 'ArrowLeft']);
  for (let i = 0; i < Math.round(seconds * hz); i += 1) frame = driveFrame(PRACTICE_YARD, frame, keys, [], 1 / hz);
  return frame;
}

describe('driving frame loop', () => {
  it('applies command keys before the steps of the frame', () => {
    const frame = readyInD();

    expect(frame.stepper.state.powertrain).toMatchObject({ engineRunning: true, lever: 'D', handbrake: false });
    expect(frame.events.map((event) => event.type)).toEqual([
      'gear-engaged',
      'gear-engaged',
      'gear-engaged',
      'handbrake',
    ]);
  });

  it('gives exactly the same car at 30 and 120 frames per second, pedal and wheel ramps included', () => {
    // Both rates run the same number of fixed steps, so any frame-rate dependence would show as a difference.
    const at30 = drive(30, 2);
    const at120 = drive(120, 2);

    expect(at30.stepper.state.world.timeS).toBeCloseTo(at120.stepper.state.world.timeS, 9);
    expect(at30.stepper.state.world.vehicle).toEqual(at120.stepper.state.world.vehicle);
    expect(at30.stepper.state.powertrain).toEqual(at120.stepper.state.powertrain);
    expect(at30.controls).toEqual(at120.controls);
    expect(at30.stepper.state.world.vehicle.odometerM).toBeGreaterThan(1);
  });

  it('reports contacts among the events of the frame', () => {
    let frame = readyInD({ ...PRACTICE_YARD_START, z: 34 });
    const contacts: string[] = [];
    for (let i = 0; i < 400 && contacts.length === 0; i += 1) {
      frame = driveFrame(PRACTICE_YARD, frame, new Set(['ArrowUp']), [], 1 / 60);
      contacts.push(...frame.events.flatMap((event) => (event.type === 'contact' ? [event.obstacleId] : [])));
    }

    expect(contacts).toContain('wall-north');
  });
});

describe('driving frame observer', () => {
  it('applies the prepared commands before any step, and reports every command and step', () => {
    const prepared = startDriving(PRACTICE_YARD_START, 'manual', [
      { type: 'insert-key' },
      { type: 'turn-key', to: 'on' },
    ]);
    expect(prepared.stepper.state.powertrain.key).toBe('on');
    expect(prepared.events.map((event) => event.type)).toEqual(['key-inserted']);

    const seen: number[] = [];
    driveFrame(PRACTICE_YARD, prepared, new Set(), ['Space'], 2 / 120, undefined, (_, events, dt) =>
      seen.push(dt === 0 ? events.length : -1),
    );

    // One command (the handbrake event), then two fixed steps.
    expect(seen).toEqual([1, -1, -1]);
  });
});

describe('driving frame scenario', () => {
  it('steps the world scenario beside the car and reports touching an actor as an event', () => {
    const { FIRST_BLOCK, FIRST_BLOCK_START, FIRST_BLOCK_ZONES } = FIRST;
    // Place the car on the crosswalk and send the pedestrian across it.
    const start = { ...FIRST_BLOCK_START, x: -1.5, z: FIRST_BLOCK_ZONES.crosswalk.centerZ - 1.7 };
    let frame = startDriving(start, 'automatic', [], undefined, FIRST_BLOCK.scenario);
    expect(frame.scenario?.light).toBe('green');
    const touched: string[] = [];
    for (let i = 0; i < 600 && touched.length === 0; i += 1) {
      frame = driveFrame(FIRST_BLOCK, frame, new Set(), [], 1 / 60);
      touched.push(...frame.events.flatMap((event) => (event.type === 'actor-contact' ? [event.actor] : [])));
    }

    expect(touched).toEqual(['pedestrian']);
    expect(frame.scenario?.poses.find((pose) => pose.id === 'pedestrian')?.active).toBe(true);
  });
});
