import { describe, expect, it } from 'vitest';
import { validateFigures } from './validateFigures.ts';
import { choiceActivity, source, unit } from './testing/fixtures.ts';
import type { Figure } from './schemas.ts';

const UNIT_ID = 'manual.ch3.roundabout-priority';

function figure(overrides: Partial<Figure> = {}): Figure {
  return {
    id: 'fig.manual-p2-roundabout',
    source: 'manual',
    page: 2,
    box: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
    alt: 'Rotonda con flechas.',
    unitIds: [UNIT_ID],
    ...overrides,
  };
}

const context = (activities = [choiceActivity({ figureIds: ['fig.manual-p2-roundabout'] })]) => ({
  manifest: [source('manual', 200)],
  units: [unit({ id: UNIT_ID })],
  activities,
});

describe('validateFigures', () => {
  it('accepts a crop inside its page, illustrating units of that page, cited by the activity that shows it', () => {
    expect(validateFigures([figure()], context())).toEqual([]);
  });

  it('rejects duplicate ids, pages outside the source and crops that leave the page', () => {
    const errors = validateFigures(
      [figure(), figure({ page: 900, box: { x: 0.5, y: 0.5, width: 0.6, height: 0.6 } })],
      context([]),
    );

    expect(errors).toEqual([
      'fig.manual-p2-roundabout: duplicate figure id',
      'fig.manual-p2-roundabout: reference manual:900 is outside 1..200',
      'fig.manual-p2-roundabout: box goes beyond the page',
      `fig.manual-p2-roundabout: unit ${UNIT_ID} is not on manual:900`,
    ]);
  });

  it('rejects unknown units, unknown figures and activities that do not cite the figure page', () => {
    const errors = validateFigures(
      [figure({ unitIds: ['manual.ch3.nothing'] })],
      context([
        choiceActivity({ figureIds: ['fig.manual-p2-roundabout'], refs: [{ source: 'manual', page: 3 }] }),
        choiceActivity({ id: 'act.other', figureIds: ['fig.missing'] }),
      ]),
    );

    expect(errors).toEqual([
      'fig.manual-p2-roundabout: unknown unit manual.ch3.nothing',
      'act.speed-street: shows fig.manual-p2-roundabout but does not cite manual:2',
      'act.other: unknown figure fig.missing',
    ]);
  });
});
