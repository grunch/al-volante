import { afterEach, describe, expect, it, vi } from 'vitest';
import { canonicalIso, canonicalStoredAttempt, localDay } from './dates.ts';

/** Node re-reads TZ on every change, so a test can stand in a given time zone. */
function inTimeZone(zone: string): void {
  vi.stubEnv('TZ', zone);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('canonicalIso', () => {
  it('writes any valid ISO date with milliseconds and Z, so text order is time order', () => {
    expect(canonicalIso('2026-10-11T12:00:00Z')).toBe('2026-10-11T12:00:00.000Z');
    expect(canonicalIso('2026-10-11T12:00:00.5Z')).toBe('2026-10-11T12:00:00.500Z');
  });
});

describe('canonicalStoredAttempt', () => {
  it('rewrites the readable dates of an attempt, its events and its faults, and keeps everything else', () => {
    // Arrange
    const stored = {
      id: 'a1',
      startedAt: '2026-10-11T12:00:00Z',
      finishedAt: null,
      events: [{ at: '2026-10-11T12:00:01Z', type: 'answer', payload: { seed: 1 } }],
      faults: [{ at: '2026-10-11T12:00:02Z', ruleId: 'rule.minor.a-item', points: 1 }],
    };

    // Act
    const canonical = canonicalStoredAttempt(stored);

    // Assert
    expect(canonical).toEqual({
      id: 'a1',
      startedAt: '2026-10-11T12:00:00.000Z',
      finishedAt: null,
      events: [{ at: '2026-10-11T12:00:01.000Z', type: 'answer', payload: { seed: 1 } }],
      faults: [{ at: '2026-10-11T12:00:02.000Z', ruleId: 'rule.minor.a-item', points: 1 }],
    });
    expect(stored.startedAt).toBe('2026-10-11T12:00:00Z');
  });

  it('leaves values it cannot read exactly as they were', () => {
    const odd = { startedAt: 'yesterday', finishedAt: 42, events: 'none', faults: [null, 'x', { at: 'soon' }] };

    expect(canonicalStoredAttempt(odd)).toEqual(odd);
    expect(canonicalStoredAttempt(null)).toBeNull();
    expect(canonicalStoredAttempt('attempt')).toBe('attempt');
  });
});

describe('localDay', () => {
  // 21:42 of 12 October in Buenos Aires is already 13 October in UTC.
  const evening = new Date('2026-10-13T00:42:00.000Z');

  it('names the calendar day where the person is, not the UTC one', () => {
    inTimeZone('America/Argentina/Buenos_Aires');

    expect(localDay(evening)).toBe('2026-10-12');
  });

  it('follows the device time zone on both sides of UTC', () => {
    inTimeZone('Asia/Tokyo');
    expect(localDay(evening)).toBe('2026-10-13');

    inTimeZone('UTC');
    expect(localDay(new Date('2026-01-05T23:59:59.999Z'))).toBe('2026-01-05');
  });
});
