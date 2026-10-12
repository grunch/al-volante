import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS, rebind } from './bindings.ts';
import { keyLabel, keyNames } from './keyLabels.ts';

describe('key labels for the driving guide', () => {
  it('reads letters and digits as themselves, and names arrows, Shift and Space', () => {
    expect(keyLabel('KeyK')).toBe('K');
    expect(keyLabel('Digit7')).toBe('7');
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel('ArrowDown')).toBe('↓');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('ArrowRight')).toBe('→');
    expect(keyLabel('ShiftLeft')).toBe('Shift');
    expect(keyLabel('ShiftRight')).toBe('Shift');
    expect(keyLabel('Space')).toBe('Espacio');
  });

  it('refuses a code the bindings never accept instead of showing it raw', () => {
    expect(() => keyLabel('Tab')).toThrow(/Tab/);
    expect(() => keyLabel('KeyAA')).toThrow(/KeyAA/);
  });

  it('names every action with its default keys, both Shift keys read once', () => {
    const keys = keyNames(DEFAULT_BINDINGS);

    expect(keys.throttle).toBe('↑ o W');
    expect(keys.left).toBe('← o A');
    expect(keys.clutch).toBe('Shift');
    expect(keys.handbrake).toBe('Espacio');
    expect(keys.glanceLeft).toBe('U');
    expect(keys.lookCenter).toBe('I');
  });

  it('follows the keys the driver chose', () => {
    const rebound = rebind(DEFAULT_BINDINGS, 'glanceLeft', 'Digit1');
    expect(rebound).not.toBeNull();

    expect(keyNames(rebound ?? DEFAULT_BINDINGS).glanceLeft).toBe('1');
  });
});
