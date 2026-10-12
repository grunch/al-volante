import { describe, expect, it } from 'vitest';
import { DEFAULT_BINDINGS } from '../practice/bindings.ts';
import { keyNames } from '../practice/keyLabels.ts';
import { DRIVING_GUIDE_COPY } from '../i18n/drivingGuide.ts';
import { GUIDE_STEPS, guideSteps } from './guide.ts';

const KEYS = keyNames(DEFAULT_BINDINGS);
const KINDS = ['manual', 'automatic'] as const;

describe('driving guide steps (F04-T05-FIX01)', () => {
  it('follows the whole exam in the order the examiner asks for it', () => {
    expect(guideSteps({ from: 'I', to: 'III' })).toEqual([
      'familiarisation',
      'recognition',
      'preparation',
      'unlock',
      'reverse',
      'forward',
      'exit',
      'firstMetres',
      'circulation',
      'parking',
      'leaving',
    ]);
    expect(guideSteps({ from: 'I', to: 'III' })).toEqual(GUIDE_STEPS);
  });

  it('keeps only the stage being practised; stage III starts driving on the last leg', () => {
    expect(guideSteps({ from: 'I', to: 'I' })).toEqual(['familiarisation', 'recognition', 'preparation']);
    expect(guideSteps({ from: 'II', to: 'II' })).toEqual([
      'unlock',
      'reverse',
      'forward',
      'exit',
      'firstMetres',
      'circulation',
    ]);
    expect(guideSteps({ from: 'III', to: 'III' })).toEqual(['circulation', 'parking', 'leaving']);
  });
});

describe('driving guide copy', () => {
  it('has a title and an instruction for every step and both gearboxes', () => {
    for (const step of GUIDE_STEPS)
      for (const kind of KINDS) {
        expect(DRIVING_GUIDE_COPY.steps[step].title).not.toBe('');
        expect(DRIVING_GUIDE_COPY.steps[step].how(KEYS, kind).length).toBeGreaterThan(40);
      }
  });

  it('checks a mirror with the glance keys, never with a full head turn (D4, X6)', () => {
    // A head turn is outside the mirror yaw range: telling the driver to use it would score a missed mirror.
    for (const step of ['exit', 'circulation', 'leaving'] as const)
      for (const kind of KINDS) {
        const how = DRIVING_GUIDE_COPY.steps[step].how(KEYS, kind);
        expect(how).toContain(`(${KEYS.glanceLeft}`);
        expect(how).not.toContain(KEYS.lookLeft);
      }
  });

  it('asks for the clutch only with the manual gearbox', () => {
    for (const step of GUIDE_STEPS)
      expect(DRIVING_GUIDE_COPY.steps[step].how(KEYS, 'automatic')).not.toContain(KEYS.clutch);
    expect(DRIVING_GUIDE_COPY.controls(KEYS, 'automatic').join(' ')).not.toContain(KEYS.clutch);
    expect(DRIVING_GUIDE_COPY.steps.reverse.how(KEYS, 'manual')).toContain(KEYS.clutch);
  });

  it('writes the keys the driver chose into the instructions', () => {
    const custom = { ...KEYS, hazards: '9' };

    expect(DRIVING_GUIDE_COPY.steps.parking.how(custom, 'manual')).toContain('(9)');
    expect(DRIVING_GUIDE_COPY.controls(custom, 'manual').join(' ')).toContain('9');
  });
});
