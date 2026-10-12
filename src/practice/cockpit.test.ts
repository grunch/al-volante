import { describe, expect, it } from 'vitest';
import { commandCockpit, initialCockpit, MIRROR_IDS } from './cockpit.ts';
import { actionForCode, DEFAULT_BINDINGS, drivingKeys, parseBindings, rebind } from './bindings.ts';

describe('cabin state', () => {
  it('keeps adjustments finite, bounded and immutable', () => {
    const initial = initialCockpit();
    const raised = commandCockpit(initial, { type: 'adjust', control: 'seatHeight', value: 2 });
    expect(raised.seatHeight).toBe(1);
    expect(initial.seatHeight).toBe(0.5);
    expect(commandCockpit(initial, { type: 'adjust', control: 'headrest', value: NaN })).toBe(initial);
    expect(commandCockpit(initial, { type: 'look', yaw: Infinity, pitch: 0 })).toBe(initial);
    expect(commandCockpit(initial, { type: 'look', yaw: -5, pitch: 2 })).toMatchObject({
      lookYaw: -2.35,
      lookPitch: 0.55,
    });
    for (const mirror of MIRROR_IDS) {
      const adjusted = commandCockpit(initial, { type: 'mirror', mirror, axis: 'yaw', value: -2 });
      expect(adjusted.mirrors[mirror].yaw).toBe(-0.45);
      expect(initial.mirrors[mirror].yaw).toBe(0);
      expect(commandCockpit(initial, { type: 'mirror', mirror, axis: 'pitch', value: NaN })).toBe(initial);
    }
  });

  it('operates belt, lamps, horn and equipment without changing drivetrain state', () => {
    let state = initialCockpit();
    for (const control of ['belt', 'hazards', 'wipers', 'defogger', 'rearHeater', 'airConditioning'] as const) {
      state = commandCockpit(state, { type: 'toggle', control });
      expect(state[control]).toBe(true);
    }
    state = commandCockpit(state, { type: 'lights', value: 'low' });
    state = commandCockpit(state, { type: 'signal', value: 'left' });
    state = commandCockpit(state, { type: 'horn', value: true });
    expect(state).toMatchObject({ lights: 'low', signal: 'left', horn: true });
  });
});

describe('configurable bindings', () => {
  it('round trips valid bindings and refuses reserved or duplicate assignments', () => {
    const next = rebind(DEFAULT_BINDINGS, 'throttle', 'Digit1')!;
    expect(parseBindings(JSON.stringify(next))).toEqual(next);
    expect(actionForCode(next, 'Digit1')).toBe('throttle');
    expect(actionForCode(next, 'ArrowUp')).toBeUndefined();
    expect(rebind(next, 'brake', 'Digit1')).toBeNull();
    expect(rebind(next, 'brake', 'Tab')).toBeNull();
    expect(drivingKeys(['throttle', 'clutch', 'belt'])).toEqual(new Set(['ArrowUp', 'ShiftLeft']));
  });

  it.each([
    '{',
    'null',
    '[]',
    '{}',
    JSON.stringify({ ...DEFAULT_BINDINGS, brake: ['ArrowUp'] }),
    JSON.stringify({ ...DEFAULT_BINDINGS, key: [] }),
  ])('restores defaults for damaged storage: %s', (raw) => {
    expect(parseBindings(raw)).toEqual(DEFAULT_BINDINGS);
  });
});
