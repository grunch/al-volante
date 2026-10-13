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

describe('gradeExam', () => {
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

    expect(grade).toMatchObject({ total: 4, correct: 2, unanswered: 1, passed: false });
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

describe('the shipped bank (integration)', () => {
  it('composes full papers over every section of licence B, each with one right option among three', async () => {
    const result = await loadContent();
    if (!result.ok) throw new Error(result.errors.join('\n'));
    const { activities, units, theoryExam } = result.content;

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
      expect(paper.questions.every((question) => question.options.length === theoryExam.optionsPerQuestion)).toBe(true);
      expect(new Set(paper.questions.map((question) => question.sectionKey))).toEqual(new Set(theoryExam.sections));
      // Every question comes only from licence B material: none of its units is in another section or source.
      for (const question of paper.questions) {
        const activity = activities.find((item) => item.id === question.activityId);
        const keys = (activity?.unitIds ?? []).map((id) => {
          const owner = units.find((item) => item.id === id);
          return `${owner?.source}-${owner?.section}`;
        });
        expect(
          keys.every((key) => theoryExam.sections.includes(key)),
          question.id,
        ).toBe(true);
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
