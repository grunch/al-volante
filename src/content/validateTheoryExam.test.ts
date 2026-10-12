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
});
