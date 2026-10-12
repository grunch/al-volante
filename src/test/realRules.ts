import rulesJson from '../../specs/catalog/rules.json';
import { RuleCatalogSchema } from '../content/schemas.ts';
import type { ParkingBand, Rule } from '../content/schemas.ts';

/** The real, validated rule catalog, for tests of the exam evaluation (fixtures are too small for it). */
const catalog = RuleCatalogSchema.parse(rulesJson);
export const REAL_RULES: readonly Rule[] = catalog.rules;
export const REAL_BANDS: readonly ParkingBand[] = catalog.parkingBands;
export const REAL_RULE_CATALOG = catalog;
