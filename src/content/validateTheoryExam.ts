import { THEORY_PARAMETERS } from './schemas.ts';
import type { Page, TheoryExamConfig } from './schemas.ts';

/** The mock exam configuration must be coherent and cite a source for every parameter (REGLAS.md §8). */
export function validateTheoryExam(
  config: TheoryExamConfig,
  pages: readonly Pick<Page, 'source' | 'section'>[],
): string[] {
  const errors: string[] = [];
  if (config.passCorrect > config.questions)
    errors.push(`passCorrect ${config.passCorrect} is more than the ${config.questions} questions`);
  if (config.timeMinutes.alternatives.includes(config.timeMinutes.default))
    errors.push('the default time is repeated among the alternatives');
  const sections = new Set(pages.map((page) => `${page.source}-${page.section}`));
  for (const section of config.sections) if (!sections.has(section)) errors.push(`unknown section ${section}`);
  for (const parameter of THEORY_PARAMETERS)
    if (!config.sources.some((source) => source.parameter === parameter)) errors.push(`no source for ${parameter}`);
  return errors;
}
