import { describe, expect, it } from 'vitest';
import { validateTreatment } from './validateTreatment.ts';
import { choiceActivity, sign, unit } from './testing/fixtures.ts';
import type { Activity, KnowledgeUnit } from './schemas.ts';

const UNIT_ID = 'manual.ch3.roundabout-priority';

function check(
  units: KnowledgeUnit[],
  activities: Activity[] = [choiceActivity()],
  signs = [sign({ id: 'sign.x.y' })],
) {
  return validateTreatment({ units, signs, activities });
}

describe('validateTreatment', () => {
  it('accepts tested units practiced by activities and consultation units marked implemented', () => {
    const units = [
      unit({ id: UNIT_ID, status: 'tested' }),
      unit({ id: 'manual.ch3.contacts', status: 'implemented', consultationReason: 'Teléfonos por verificar.' }),
      unit({ id: 'manual.ch3.pending', status: 'transcribed' }),
    ];

    expect(check(units)).toEqual([]);
  });

  it('rejects activities on units that are not implemented yet', () => {
    expect(check([unit({ id: UNIT_ID, status: 'reviewed' })])).toEqual([
      `${UNIT_ID}: covered by an activity but its status is reviewed`,
    ]);
  });

  it('rejects implemented units without treatment and tested units without activities', () => {
    const errors = check(
      [unit({ id: 'manual.ch3.a', status: 'implemented' }), unit({ id: 'manual.ch3.b', status: 'tested' })],
      [],
    );

    expect(errors).toEqual([
      'manual.ch3.a: status implemented needs an activity or a consultation reason',
      'manual.ch3.b: status tested needs an activity or a consultation reason',
      'manual.ch3.b: only activities can make a unit tested',
    ]);
  });

  it('rejects consultation on units nobody reviewed', () => {
    const errors = check([unit({ id: 'manual.ch3.a', status: 'transcribed', consultationReason: 'Datos.' })], []);

    expect(errors).toEqual(['manual.ch3.a: consultation needs a reviewed unit (status transcribed)']);
  });

  it('ignores draft activities when deciding what is covered', () => {
    const errors = check([unit({ id: UNIT_ID, status: 'tested' })], [choiceActivity({ status: 'draft' })]);

    expect(errors).toEqual([
      `${UNIT_ID}: status tested needs an activity or a consultation reason`,
      `${UNIT_ID}: only activities can make a unit tested`,
    ]);
  });

  it('requires the feedback to cite a page of every unit it practices', () => {
    const activity = choiceActivity({ refs: [{ source: 'manual', page: 9 }] });

    expect(check([unit({ id: UNIT_ID, status: 'tested', pages: [2, 3] })], [activity])).toEqual([
      `act.speed-street: cites no page of ${UNIT_ID} (manual 2, 3)`,
    ]);
  });

  it('keeps sign statuses in step with sign-identification activities', () => {
    const signActivity: Activity = {
      ...choiceActivity(),
      id: 'act.stop',
      type: 'sign-identification',
      variants: [{ ...choiceActivity().variants[0]!, signId: 'sign.x.used' }],
    };
    const units = [unit({ id: UNIT_ID, status: 'tested' })];
    const signs = [sign({ id: 'sign.x.used' }), sign({ id: 'sign.x.orphan', status: 'tested' })];

    expect(check(units, [signActivity], signs)).toEqual([
      'sign.x.used: used by an activity but its status is transcribed',
      'sign.x.orphan: status tested needs a sign-identification activity',
    ]);
  });
});
