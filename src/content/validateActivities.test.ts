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

  describe('choice options', () => {
    /** A one-variant activity whose right option and wrong options have the given texts. */
    function withOptions(right: string, wrong: readonly string[], type: 'single-choice' | 'sign-identification') {
      const options = [
        { id: 'right', text: right, correct: true, feedback: 'Bien' },
        ...wrong.map((text, index) => ({ id: `wrong-${index}`, text, correct: false, feedback: 'No' })),
      ];
      const base = choiceActivity();
      if (type === 'single-choice') return { ...base, variants: [{ id: 'v7', prompt: '¿Cuál?', options }] };
      return {
        ...base,
        id: 'act.stop-sign',
        type,
        variants: [{ id: 'v7', prompt: '¿Cuál?', options, signId: 'sign.regulatory.stop' }],
      } satisfies Activity;
    }

    it('accepts a right option exactly 10 characters longer than the longest wrong option', () => {
      // Arrange: 15 characters against a longest wrong option of 5.
      const activity = withOptions('a'.repeat(15), ['b'.repeat(5), 'c'.repeat(3)], 'single-choice');

      // Act
      const errors = validateActivities([activity], context);

      // Assert
      expect(errors).toEqual([]);
    });

    it('rejects a right option 11 characters longer, naming the activity, the variant and the lengths', () => {
      const activity = withOptions('a'.repeat(16), ['b'.repeat(5), 'c'.repeat(3)], 'single-choice');

      const errors = validateActivities([activity], context);

      expect(errors).toEqual([
        'act.speed-street#v7: the correct option "right" has 16 characters, 11 more than the longest wrong option ' +
          '(5); at most 10 more, or its length gives it away',
      ]);
    });

    it('applies the length rule to sign identification variants too', () => {
      const activity = withOptions('a'.repeat(20), ['b'.repeat(5), 'c'.repeat(5)], 'sign-identification');

      expect(validateActivities([activity], context)).toEqual([
        'act.stop-sign#v7: the correct option "right" has 20 characters, 15 more than the longest wrong option (5); ' +
          'at most 10 more, or its length gives it away',
      ]);
    });

    it('counts what a reader sees as one character, also for accents written as combining marks', () => {
      // Arrange: "é" decomposed (e + U+0301) is two UTF-16 units but one character; 15 characters against 5.
      const decomposed = `${'é'.repeat(5)}${'a'.repeat(10)}`;
      const activity = withOptions(decomposed, ['b'.repeat(5), 'c'.repeat(5)], 'single-choice');

      expect(validateActivities([activity], context)).toEqual([]);
    });

    it('requires at least two wrong options, as the mock theory exam shows two distractors', () => {
      const single = withOptions('Sí', ['No'], 'single-choice');
      const sign = withOptions('PARE', ['Ceda el paso'], 'sign-identification');

      expect(validateActivities([single, sign], context)).toEqual([
        'act.speed-street#v7: needs at least 2 wrong options (found 1)',
        'act.stop-sign#v7: needs at least 2 wrong options (found 1)',
      ]);
    });

    it('reports only the missing distractors when every option is right', () => {
      const activity = choiceActivity();
      activity.variants[0]!.options = [
        { id: 'a', text: 'Una respuesta muy larga', correct: true, feedback: 'Bien' },
        { id: 'b', text: 'Otra', correct: true, feedback: 'Bien' },
      ];

      expect(validateActivities([activity], context)).toEqual([
        'act.speed-street#v1: needs exactly one correct option (found 2)',
        'act.speed-street#v1: needs at least 2 wrong options (found 0)',
      ]);
    });
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
