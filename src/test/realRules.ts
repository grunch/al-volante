import rulesJson from '../../specs/catalog/rules.json';
import { RuleCatalogSchema } from '../content/schemas.ts';
import type { Rule } from '../content/schemas.ts';

/** The real, validated rule catalog, for tests of the exam evaluation (fixtures are too small for it). */
export const REAL_RULES: readonly Rule[] = RuleCatalogSchema.parse(rulesJson).rules;
