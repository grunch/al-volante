import { describe, expect, it } from 'vitest';
import { validateActivities } from './validateActivities.ts';
import { choiceActivity, source } from './testing/fixtures.ts';
import type { Activity } from './schemas.ts';

const context = {
  manifest: [source('manual', 200)],
  unitIds: new Set(['manual.ch3.roundabout-priority']),
  signIds: new Set(['sign.regulatory.stop']),
};

type DecisionVariant = Extract<Activity, { type: 'decision' }>['variants'][number];

function decision(
  nodes: DecisionVariant['nodes'],
  outcomes: DecisionVariant['outcomes'] = { good: { correct: true, feedback: 'Bien' } },
) {
  return {
    ...choiceActivity(),
    id: 'act.turn-cyclist',
    type: 'decision' as const,
    variants: [{ id: 'v1', start: 'n1', nodes, outcomes }],
  } satisfies Activity;
}

describe('validateActivities', () => {
  it('accepts consistent activities of every type', () => {
    // Arrange
    const activities: Activity[] = [
      choiceActivity(),
      {
        ...choiceActivity(),
        id: 'act.stop-sign',
        type: 'sign-identification',
        variants: [{ ...choiceActivity().variants[0]!, signId: 'sign.regulatory.stop' }],
      },
      {
        ...choiceActivity(),
        id: 'act.priority-order',
        type: 'ordering',
        variants: [
          {
            id: 'v1',
            prompt: 'Ordená',
            items: [
              { id: 'a', text: 'A', reason: 'r' },
              { id: 'b', text: 'B', reason: 'r' },
            ],
          },
        ],
      },
      decision({
        n1: {
          text: 'Inicio',
          choices: [
            { id: 'c1', text: 'Ceder', outcome: 'good' },
            { id: 'c2', text: 'Mirar', next: 'n2' },
          ],
        },
        n2: {
          text: 'Luego',
          choices: [
            { id: 'c3', text: 'Ceder', outcome: 'good' },
            { id: 'c4', text: 'Seguir', outcome: 'good' },
          ],
        },
      }),
    ];

    // Act
    const errors = validateActivities(activities, context);

    // Assert
    expect(errors).toEqual([]);
  });

  it('reports unknown units, out-of-range citations, duplicate ids and variants', () => {
    const activity = choiceActivity({ unitIds: ['manual.ch9.ghost'], refs: [{ source: 'manual', page: 201 }] });
    activity.variants.push({ ...activity.variants[0]! });

    const errors = validateActivities([activity, choiceActivity()], context);

    expect(errors).toContain('act.speed-street: duplicate activity id');
    expect(errors).toContain('act.speed-street: unknown unit manual.ch9.ghost');
    expect(errors).toContain('act.speed-street: reference manual:201 is outside 1..200');
    expect(errors).toContain('act.speed-street: duplicate variant v1');
  });

  it('rejects citations of sources missing from the manifest', () => {
    const activity = choiceActivity({ refs: [{ source: 'protocolo', page: 8 }] });

    expect(validateActivities([activity], context)).toEqual([
      'act.speed-street: cites protocolo, which is not in the manifest',
    ]);
  });

  it('requires exactly one correct option, unique options and known signs', () => {
    const noCorrect = choiceActivity();
    noCorrect.variants[0]!.options = noCorrect.variants[0]!.options.map((option) => ({
      ...option,
      correct: false,
      id: 'same',
    }));
    const unknownSign: Activity = {
      ...choiceActivity(),
      id: 'act.sign',
      type: 'sign-identification',
      variants: [{ ...choiceActivity().variants[0]!, signId: 'sign.regulatory.ghost' }],
    };

    const errors = validateActivities([noCorrect, unknownSign], context);

    expect(errors).toContain('act.speed-street#v1: needs exactly one correct option (found 0)');
    expect(errors).toContain('act.speed-street#v1: duplicate option same');
    expect(errors).toContain('act.sign#v1: unknown sign sign.regulatory.ghost');
  });

  it('rejects duplicate ordering items', () => {
    const ordering: Activity = {
      ...choiceActivity(),
      id: 'act.order',
      type: 'ordering',
      variants: [
        {
          id: 'v1',
          prompt: 'Ordená',
          items: [
            { id: 'a', text: 'A', reason: 'r' },
            { id: 'a', text: 'B', reason: 'r' },
          ],
        },
      ],
    };

    expect(validateActivities([ordering], context)).toEqual(['act.order#v1: duplicate item a']);
  });

  it('rejects broken decision graphs: missing targets, ambiguous choices, cycles, unreachable nodes and no correct outcome', () => {
    const broken = decision(
      {
        n1: {
          text: 'Inicio',
          choices: [
            { id: 'c1', text: 'Ir', next: 'n2' },
            { id: 'c2', text: 'Ambos', next: 'n2', outcome: 'bad' },
          ],
        },
        n2: {
          text: 'Vuelta',
          choices: [
            { id: 'c3', text: 'Volver', next: 'n1' },
            { id: 'c4', text: 'Fantasma', next: 'ghost' },
          ],
        },
        orphan: {
          text: 'Sola',
          choices: [
            { id: 'c5', text: 'Fin', outcome: 'missing' },
            { id: 'c6', text: 'Fin', outcome: 'bad' },
          ],
        },
      },
      { bad: { correct: false, feedback: 'No' } },
    );

    const errors = validateActivities([broken], context);

    expect(errors).toContain('act.turn-cyclist#v1: node "n1" choice "c2" needs exactly one of next or outcome');
    expect(errors).toContain('act.turn-cyclist#v1: node "n2" choice "c4" points to missing node "ghost"');
    expect(errors).toContain('act.turn-cyclist#v1: node "orphan" choice "c5" points to missing outcome "missing"');
    expect(errors).toContain('act.turn-cyclist#v1: no correct outcome is reachable from the start');
    expect(errors).toContain('act.turn-cyclist#v1: cycle through node "n1"');
    expect(errors).toContain('act.turn-cyclist#v1: node "orphan" is unreachable');
  });

  it('requires a correct outcome reachable from the start and flags outcomes no choice reaches', () => {
    // Arrange: the correct outcome exists but no path leads to it.
    const unwinnable = decision(
      { n1: { text: 'Inicio', choices: [{ id: 'c1', text: 'Mal', outcome: 'bad' }] } },
      { bad: { correct: false, feedback: 'No' }, good: { correct: true, feedback: 'Sí' } },
    );

    // Act
    const errors = validateActivities([unwinnable], context);

    // Assert
    expect(errors).toEqual([
      'act.turn-cyclist#v1: no correct outcome is reachable from the start',
      'act.turn-cyclist#v1: outcome "good" is never reached',
    ]);
  });

  it('reports a missing start node', () => {
    const activity = decision({
      n2: {
        text: 'X',
        choices: [
          { id: 'a', text: 'A', outcome: 'good' },
          { id: 'b', text: 'B', outcome: 'good' },
        ],
      },
    });

    expect(validateActivities([activity], context)).toContain('act.turn-cyclist#v1: start node "n1" does not exist');
  });
});
