import { describe, expect, it } from 'vitest';
import { loadContent } from '../content/catalog.ts';
import { choiceActivity, theoryExamConfig, unit } from '../content/testing/fixtures.ts';
import type { Activity } from '../content/schemas.ts';
import { allocate, composeExam, gradeExam } from './exam.ts';
import type { ExamQuestion } from './exam.ts';

const three = (id: string) => [
  { id: 'a', text: `${id} A`, correct: true, feedback: 'Bien' },
  { id: 'b', text: `${id} B`, correct: false, feedback: 'No, B' },
  { id: 'c', text: `${id} C`, correct: false, feedback: 'No, C' },
  { id: 'd', text: `${id} D`, correct: false, feedback: 'No, D' },
];

/** The id the player sees for a catalog option of a question (option ids are positions on the paper). */
function shownId(question: ExamQuestion, optionId: string): string {
  return question.options[question.optionIds.indexOf(optionId)]?.id ?? 'missing';
}

/** Two sections: ch3 with 3 units and 4 activities, ch1 with 1 unit and 2 activities, two variants each. */
function bank(): { activities: Activity[]; units: ReturnType<typeof unit>[] } {
  const units = [
    unit({ id: 'manual.ch3.a', section: 'ch3' }),
    unit({ id: 'manual.ch3.b', section: 'ch3' }),
    unit({ id: 'manual.ch3.c', section: 'ch3' }),
    unit({ id: 'manual.ch1.a', section: 'ch1' }),
  ];
  const make = (id: string, unitId: string): Activity =>
    choiceActivity({
      id,
      unitIds: [unitId],
      variants: [
        { id: 'v1', prompt: `${id} 1`, options: three(`${id}.1`) },
        { id: 'v2', prompt: `${id} 2`, options: three(`${id}.2`) },
      ],
    });
  const activities = [
    make('act.ch3-one', 'manual.ch3.a'),
    make('act.ch3-two', 'manual.ch3.b'),
    make('act.ch3-three', 'manual.ch3.c'),
    make('act.ch3-four', 'manual.ch3.a'),
    make('act.ch1-one', 'manual.ch1.a'),
    make('act.ch1-two', 'manual.ch1.a'),
  ];
  return { activities, units };
}

const config = theoryExamConfig({
  questions: 4,
  passCorrect: 3,
  optionsPerQuestion: 3,
  sections: ['manual-ch3', 'manual-ch1'],
});

describe('allocate', () => {
  it('splits by weight with the largest remainders and at least one per section', () => {
    const weights = new Map([
      ['a', 3],
      ['b', 1],
    ]);
    const capacity = new Map([
      ['a', 10],
      ['b', 10],
    ]);

    expect(Object.fromEntries(allocate(weights, capacity, 4))).toEqual({ a: 3, b: 1 });
    // 7.5 and 2.5: the tie on the remainder goes to the heavier section.
    expect(Object.fromEntries(allocate(weights, capacity, 10))).toEqual({ a: 8, b: 2 });
  });

  it('never asks a section for more than it has, and gives the rest to the others', () => {
    const weights = new Map([
      ['a', 9],
      ['b', 1],
      ['c', 1],
    ]);
    const capacity = new Map([
      ['a', 2],
      ['b', 10],
      ['c', 0],
    ]);

    expect(Object.fromEntries(allocate(weights, capacity, 6))).toEqual({ a: 2, b: 4 });
  });
});

describe('allocate: edge cases', () => {
  it('shares equally when no section has units to weigh it', () => {
    const none = new Map([
      ['a', 0],
      ['b', 0],
    ]);
    const capacity = new Map([
      ['a', 10],
      ['b', 10],
    ]);

    expect(Object.fromEntries(allocate(none, capacity, 4))).toEqual({ a: 2, b: 2 });
  });

  it('gives a section left at zero one question of the largest, while the largest keeps one', () => {
    const weights = new Map([
      ['a', 100],
      ['b', 1],
      ['c', 1],
    ]);
    const capacity = new Map([
      ['a', 10],
      ['b', 10],
      ['c', 10],
    ]);

    // Two questions for three sections: the heavy one gives one away and keeps the other.
    expect(Object.fromEntries(allocate(weights, capacity, 2))).toEqual({ a: 1, b: 1, c: 0 });
  });

  it('asks for no more than all the sections can offer together', () => {
    const weights = new Map([
      ['a', 1],
      ['b', 1],
      ['missing', 1],
    ]);
    const capacity = new Map([
      ['a', 2],
      ['b', 1],
    ]);

    expect(Object.fromEntries(allocate(weights, capacity, 10))).toEqual({ a: 2, b: 1 });
  });
});

describe('composeExam', () => {
  it('is reproducible: the same seed gives the same paper, another seed another one', () => {
    const { activities, units } = bank();

    const paper = composeExam(activities, units, config, 7);

    expect(composeExam(activities, units, config, 7)).toEqual(paper);
    expect(composeExam(activities, units, config, 8)).not.toEqual(paper);
  });

  it('balances the sections by units, one variant per activity, with three options and only one right', () => {
    const { activities, units } = bank();

    const paper = composeExam(activities, units, config, 3);

    expect(paper.questions).toHaveLength(4);
    expect(paper.questions.filter((question) => question.sectionKey === 'manual-ch3')).toHaveLength(3);
    expect(new Set(paper.questions.map((question) => question.activityId)).size).toBe(4);
    for (const question of paper.questions) {
      expect(question.options).toHaveLength(3);
      // What the player sees carries no correctness: only ids and texts.
      for (const option of question.options) expect(Object.keys(option).sort()).toEqual(['id', 'text']);
      // Catalog ids give the answer away ('a' is usually right): the paper numbers the options instead.
      expect(question.options.map((option) => option.id)).toEqual(['o1', 'o2', 'o3']);
      expect(question.optionIds.filter((id) => id === 'a')).toHaveLength(1);
    }
  });

  it('leaves out variants that cannot offer enough options', () => {
    const { activities, units } = bank();
    const short = activities.map((activity) =>
      activity.type === 'single-choice'
        ? { ...activity, variants: activity.variants.map((v) => ({ ...v, options: v.options.slice(0, 2) })) }
        : activity,
    );

    expect(composeExam(short, units, config, 1).questions).toHaveLength(0);
  });

  it('leaves out activities that also practise units outside the exam sections', () => {
    const { activities, units } = bank();
    const guide = unit({ id: 'siniestros.s1.witness-duty', source: 'siniestros', section: 's1' });
    // The activity lives in ch1 (its first unit), but some of its variants may come from the guide.
    const mixed = activities.map((activity) =>
      activity.id === 'act.ch1-two' ? { ...activity, unitIds: [...activity.unitIds, guide.id] } : activity,
    );

    const paper = composeExam(mixed, [...units, guide], config, 3);

    expect(paper.questions.map((question) => question.activityId)).not.toContain('act.ch1-two');
    expect(paper.questions.some((question) => question.activityId === 'act.ch1-one')).toBe(true);
  });
});

describe('composeExam: what enters the paper', () => {
  it('takes only reviewed single-choice and sign questions, and a second variant only when a section runs short', () => {
    const { units } = bank();
    const [ch3] = units;
    const two = choiceActivity({
      id: 'act.two-variants',
      unitIds: [ch3!.id],
      variants: [
        { id: 'v1', prompt: 'Uno', options: three('two.1') },
        { id: 'v2', prompt: 'Dos', options: three('two.2') },
      ],
    });
    const draft = { ...choiceActivity({ id: 'act.draft', unitIds: [ch3!.id] }), status: 'draft' as const };
    const ordering: Activity = {
      id: 'act.ordering',
      type: 'ordering',
      title: 'Orden',
      unitIds: [ch3!.id],
      refs: [{ source: 'manual', page: 2 }],
      explanation: 'Explicación.',
      status: 'reviewed',
      variants: [
        {
          id: 'v1',
          prompt: 'Ordená',
          items: [
            { id: 'a', text: 'A', reason: 'Primero' },
            { id: 'b', text: 'B', reason: 'Después' },
          ],
        },
      ],
    };
    const sectionConfig = { ...config, questions: 2, sections: ['manual-ch3'] };

    const paper = composeExam([draft, ordering, two], units, sectionConfig, 1);

    expect(paper.questions.map((question) => question.id).sort()).toEqual([
      'act.two-variants#v1',
      'act.two-variants#v2',
    ]);
  });

  it('carries the sign of a sign question to the paper, and none for a single-choice one', () => {
    const { activities, units } = bank();
    const sign: Activity = {
      id: 'act.sign',
      type: 'sign-identification',
      title: 'Señal',
      unitIds: ['manual.ch1.a'],
      refs: [{ source: 'manual', page: 2 }],
      explanation: 'Explicación.',
      status: 'reviewed',
      variants: [
        { id: 'v1', prompt: '¿Qué indica esta señal?', signId: 'sign.regulatory.stop', options: three('sign') },
      ],
    };
    const signConfig = { ...config, questions: 2, sections: ['manual-ch1'] };

    const paper = composeExam([...activities.filter((item) => item.id === 'act.ch1-one'), sign], units, signConfig, 2);

    expect(Object.fromEntries(paper.questions.map((question) => [question.activityId, question.signId]))).toEqual({
      'act.ch1-one': null,
      'act.sign': 'sign.regulatory.stop',
    });
  });

  it('leaves out an activity that practises a unit the catalog does not have', () => {
    const { activities, units } = bank();
    const orphan = activities.map((activity) =>
      activity.id === 'act.ch1-two' ? { ...activity, unitIds: [...activity.unitIds, 'manual.ch9.gone'] } : activity,
    );

    const paper = composeExam(orphan, units, config, 3);

    expect(paper.questions.map((question) => question.activityId)).not.toContain('act.ch1-two');
  });
});

describe('gradeExam', () => {
  it('refuses a paper whose question is no longer in the content', () => {
    const { activities, units } = bank();
    const paper = composeExam(activities, units, config, 5);

    expect(() => gradeExam(paper, {}, activities.slice(1, 2), config)).toThrow(/is not in the content/);
  });

  it('lists only the sections that had questions, in the order of the configuration', () => {
    const { activities, units } = bank();
    const paper = composeExam(activities, units, { ...config, sections: ['manual-ch3'] }, 5);

    const grade = gradeExam(paper, {}, activities, { ...config, sections: ['manual-ch1', 'manual-ch3'] });

    expect(grade.bySection.map((row) => row.sectionKey)).toEqual(['manual-ch3']);
  });

  it('passes from the threshold, counts unanswered as wrong and points to the concepts to review', () => {
    const { activities, units } = bank();
    const paper = composeExam(activities, units, config, 5);
    const [first, second, third] = paper.questions;
    // A wrong option that is on the paper: each question shows two of its three wrong options.
    const wrongId = third!.optionIds.find((id) => id !== 'a') as string;
    const answers = {
      [first!.id]: shownId(first!, 'a'),
      [second!.id]: shownId(second!, 'a'),
      [third!.id]: shownId(third!, wrongId),
    };

    const grade = gradeExam(paper, answers, activities, config);

    expect(grade).toMatchObject({ total: 4, correct: 2, unanswered: 1, mistakes: 2, passed: false });
    expect(grade.bySection.reduce((sum, row) => sum + row.total, 0)).toBe(4);
    expect(grade.toReview.reduce((sum, row) => sum + row.missed, 0)).toBe(2);
    expect(grade.results[2]).toMatchObject({
      chosenOptionId: wrongId,
      correct: false,
      feedback: `No, ${wrongId.toUpperCase()}`,
    });
    expect(grade.results[3]).toMatchObject({ chosenId: null, chosenOptionId: null, correct: false, feedback: null });

    const all = Object.fromEntries(paper.questions.map((question) => [question.id, shownId(question, 'a')]));
    expect(gradeExam(paper, all, activities, config)).toMatchObject({ correct: 4, passed: true, toReview: [] });
  });

  it('passes with as many mistakes as the threshold allows and fails with one more', () => {
    const { activities, units } = bank();
    const paper = composeExam(activities, units, config, 5);
    const right = Object.fromEntries(paper.questions.map((question) => [question.id, shownId(question, 'a')]));
    const [first, second] = paper.questions;

    // 4 questions and 3 to pass: one mistake is allowed, an unanswered question is one too.
    const oneMistake = { ...right, [first!.id]: undefined };
    const twoMistakes = { ...oneMistake, [second!.id]: undefined };

    expect(gradeExam(paper, oneMistake, activities, config)).toMatchObject({ mistakes: 1, passed: true });
    expect(gradeExam(paper, twoMistakes, activities, config)).toMatchObject({ mistakes: 2, passed: false });
  });

  it('counts an answer that is not on the paper as unanswered', () => {
    const { activities, units } = bank();
    const paper = composeExam(activities, units, config, 5);
    const [first] = paper.questions;

    const grade = gradeExam(paper, { [first!.id]: 'a' }, activities, config);

    expect(grade.results[0]).toMatchObject({ chosenId: null, chosenOptionId: null, correct: false });
    expect(grade.unanswered).toBe(paper.questions.length);
  });

  it('cannot pass a paper shorter than the configured exam', () => {
    const { activities, units } = bank();
    const paper = composeExam(activities, units, { ...config, questions: 2, passCorrect: 1 }, 5);
    const all = Object.fromEntries(paper.questions.map((question) => [question.id, shownId(question, 'a')]));

    expect(gradeExam(paper, all, activities, config).passed).toBe(false);
  });
});

/** Categories of the professional licences: passenger (D) and cargo (C-E) transport. */
const PROFESSIONAL = new Set(['D', 'C-E']);

describe('the shipped bank (integration)', () => {
  it('follows the exam the player asked for: 40 questions, 34 right to pass and at most 40 minutes', async () => {
    const result = await loadContent();
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { questions, passCorrect, optionsPerQuestion, timeMinutes } = result.content.theoryExam;

    expect({ questions, passCorrect, optionsPerQuestion }).toEqual({
      questions: 40,
      passCorrect: 34,
      optionsPerQuestion: 3,
    });
    // More than 6 mistakes (wrong or unanswered) fail the exam.
    expect(questions - passCorrect).toBe(6);
    expect(Math.max(timeMinutes.default, ...timeMinutes.alternatives)).toBe(40);
  });

  it('draws on every section of the four sources for cars, leaving out the passenger and cargo annexes', async () => {
    const result = await loadContent();
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { units, theoryExam } = result.content;

    // Licence B is for cars: the professional material (annex II, passengers, D; annex III, cargo, C-E) is not asked.
    const forCars = new Set(
      units.filter((item) => !PROFESSIONAL.has(item.category)).map((item) => `${item.source}-${item.section}`),
    );
    expect(new Set(theoryExam.sections)).toEqual(forCars);
    expect(theoryExam.sections).not.toContain('manual-annex2');
    expect(theoryExam.sections).not.toContain('manual-annex3');
    expect(new Set(units.map((item) => item.source))).toEqual(
      new Set(['manual', 'siniestros', 'protocolo', 'recorridos']),
    );
  });

  it('composes full papers over every section with questions, each with one right option among three', async () => {
    const result = await loadContent();
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { activities, units, theoryExam } = result.content;
    // The sections that can ask something: a reviewed choice question offering enough wrong options.
    const sectionOf = new Map(units.map((item) => [item.id, `${item.source}-${item.section}`]));
    const asking = new Set(
      activities
        .filter((activity) => activity.status === 'reviewed')
        .filter((activity) => activity.type === 'single-choice' || activity.type === 'sign-identification')
        .filter((activity) =>
          activity.variants.some(
            (variant) =>
              'options' in variant &&
              variant.options.filter((option) => !option.correct).length >= theoryExam.optionsPerQuestion - 1,
          ),
        )
        .map((activity) => sectionOf.get(activity.unitIds[0] ?? ''))
        .filter((key) => key !== undefined && theoryExam.sections.includes(key)),
    );
    expect(asking.size).toBeGreaterThan(8);

    for (const seed of [0, 1, 2, 3, 4]) {
      const paper = composeExam(activities, units, theoryExam, seed);
      const right = Object.fromEntries(
        paper.questions.map((question) => {
          const activity = activities.find((item) => item.id === question.activityId);
          const variant = activity?.variants.find((item) => item.id === question.variantId);
          const options = variant && 'options' in variant ? variant.options : [];
          const shown = question.optionIds.map((id) => options.find((option) => option.id === id));
          expect(
            shown.filter((option) => option?.correct),
            question.id,
          ).toHaveLength(1);
          return [question.id, question.options[shown.findIndex((option) => option?.correct)]?.id];
        }),
      );

      expect(paper.questions).toHaveLength(theoryExam.questions);
      expect(new Set(paper.questions.map((question) => question.id)).size).toBe(theoryExam.questions);
      expect(paper.questions.every((question) => question.options.length === theoryExam.optionsPerQuestion)).toBe(true);
      expect(new Set(paper.questions.map((question) => question.sectionKey))).toEqual(asking);
      for (const question of paper.questions) {
        const activity = activities.find((item) => item.id === question.activityId);
        const categories = (activity?.unitIds ?? []).map((id) => units.find((item) => item.id === id)?.category);
        expect(
          categories.some((category) => category === undefined || PROFESSIONAL.has(category)),
          question.id,
        ).toBe(false);
      }
      expect(gradeExam(paper, right, activities, theoryExam)).toMatchObject({
        correct: theoryExam.questions,
        passed: true,
      });
    }
  });
});

describe('options shown on a paper', () => {
  it('always shows a wrong option long enough that the right one does not give itself away', () => {
    // Arrange: the right option keeps the rule only against the longest wrong one (30 vs 24 characters); the other
    // two are so short that showing both would leave the right one 26 characters longer than any shown option.
    const units = [unit({ id: 'manual.ch3.a', section: 'ch3' })];
    const activities = [
      choiceActivity({
        id: 'act.length',
        unitIds: ['manual.ch3.a'],
        variants: [
          {
            id: 'v1',
            prompt: '¿Cuál?',
            options: [
              { id: 'a', text: 'La respuesta correcta y larguísima', correct: true, feedback: 'Bien' },
              { id: 'b', text: 'Corta', correct: false, feedback: 'No' },
              { id: 'c', text: 'Breve', correct: false, feedback: 'No' },
              { id: 'd', text: 'Un distractor bastante largo', correct: false, feedback: 'No' },
            ],
          },
        ],
      }),
    ];
    const oneQuestion = theoryExamConfig({
      questions: 1,
      passCorrect: 1,
      optionsPerQuestion: 3,
      sections: ['manual-ch3'],
    });

    // Act
    const shownSets = Array.from({ length: 60 }, (_, index) =>
      composeExam(activities, units, oneQuestion, index + 1),
    ).map((paper) => paper.questions[0]?.optionIds ?? []);

    // Assert: every paper keeps the long distractor, and the short ones still alternate.
    expect(shownSets.every((ids) => ids.length === 3 && ids.includes('a') && ids.includes('d'))).toBe(true);
    expect(new Set(shownSets.map((ids) => ids.filter((id) => id === 'b' || id === 'c').join()))).toEqual(
      new Set(['b', 'c']),
    );
  });
});
