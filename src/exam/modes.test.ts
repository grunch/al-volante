import { describe, expect, it } from 'vitest';
import { ATTEMPT_MODES } from '../content/schemas.ts';
import { CITY } from '../test/circuitDriver.ts';
import { REAL_BANDS, REAL_RULES } from '../test/realRules.ts';
import { entryPose } from '../city/model.ts';
import {
  DRIVING_MODES,
  HUD_AIDS,
  aidsOf,
  isPersisted,
  modeFromSlug,
  preparedFor,
  slugOfMode,
  slugOfStage,
  stageFromSlug,
  startPoseFor,
} from './modes.ts';
import { createPracticeSession } from './session.ts';

describe('driving modes (F04-T05, REGLAS.md D15)', () => {
  it('are the attempt modes of the content contract, except the review one', () => {
    for (const mode of DRIVING_MODES) expect(ATTEMPT_MODES).toContain(mode);
    expect(DRIVING_MODES).not.toContain('review');
  });

  it('maps every mode and stage to a Spanish slug and back, rejecting anything else', () => {
    for (const mode of DRIVING_MODES) expect(modeFromSlug(slugOfMode(mode))).toBe(mode);
    expect(modeFromSlug('rendir')).toBe('exam');
    expect(modeFromSlug(null)).toBeNull();
    expect(modeFromSlug('examen')).toBeNull();
    for (const stage of ['I', 'II', 'III'] as const) expect(stageFromSlug(slugOfStage(stage))).toBe(stage);
    expect(stageFromSlug('4')).toBeNull();
    expect(stageFromSlug(null)).toBeNull();
  });

  it('shows every aid while learning, the HUD aids while practising and running, and none in the real exam', () => {
    expect([...aidsOf('learn')].sort()).toEqual([...HUD_AIDS].sort());
    const driving = HUD_AIDS.filter((aid) => aid !== 'hints' && aid !== 'explanations');
    expect([...aidsOf('practice')].sort()).toEqual([...driving].sort());
    expect([...aidsOf('run')].sort()).toEqual([...driving].sort());
    expect(aidsOf('exam').size).toBe(0);
  });

  it('persists runs, exams and practices, not the guided learning', () => {
    expect(isPersisted('learn')).toBe(false);
    expect(isPersisted('practice')).toBe(true);
    expect(isPersisted('run')).toBe(true);
    expect(isPersisted('exam')).toBe(true);
  });

  it('starts stage III on the last leg with the engine running, and everything else in the box with the key in', () => {
    expect(startPoseFor(CITY, 'III')).toEqual(entryPose(CITY, 8));
    expect(startPoseFor(CITY, 'II')).toEqual(CITY.start.pose);
    expect(startPoseFor(CITY, null)).toEqual(CITY.start.pose);
    expect(preparedFor('III').map((command) => command.type)).toEqual(['insert-key', 'turn-key', 'turn-key']);
    expect(preparedFor('I').map((command) => command.type)).toEqual(['insert-key', 'turn-key']);
    expect(preparedFor(null)).toEqual(preparedFor('I'));
  });

  it('creates a practice of stage III on the last leg, before the parking notice, with the result pending', () => {
    const session = createPracticeSession(REAL_RULES, 'automatic', 1, null, REAL_BANDS, 'I');
    expect(session.scope).toEqual({ from: 'I', to: 'I' });
    expect(session.phase).toBe('familiarisation');
    expect(() => createPracticeSession(REAL_RULES, 'automatic', 1, null, REAL_BANDS, 'III')).toThrow(/circuit/);
  });
});
