import { describe, expect, it } from 'vitest';
import { page, theoryExamConfig } from './testing/fixtures.ts';
import { validateTheoryExam } from './validateTheoryExam.ts';

const pages = [page({ source: 'manual', page: 2, section: 'ch3' })];

describe('validateTheoryExam', () => {
  it('accepts a coherent configuration with a source for every parameter', () => {
    expect(validateTheoryExam(theoryExamConfig(), pages)).toEqual([]);
  });

  it('rejects an impossible threshold, a repeated time, unknown sections and missing sources', () => {
    const config = theoryExamConfig({
      passCorrect: 5,
      timeMinutes: { default: 45, alternatives: [45] },
      sections: ['manual-ch3', 'manual-ch9'],
    });
    config.sources = config.sources.filter((source) => source.parameter !== 'time');

    expect(validateTheoryExam(config, pages)).toEqual([
      'passCorrect 5 is more than the 2 questions',
      'the default time is repeated among the alternatives',
      'unknown section manual-ch9',
      'no source for time',
    ]);
  });

  it('rejects an alternative time longer than the default, which is the most the exam lasts', () => {
    const config = theoryExamConfig({ timeMinutes: { default: 40, alternatives: [30, 45] } });

    expect(validateTheoryExam(config, pages)).toEqual(['the alternative time 45 is longer than the default 40']);
  });
});
