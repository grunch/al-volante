import type { Activity, ContentStatusSchema, KnowledgeUnit, Sign } from './schemas.ts';
import type { z } from 'zod';

type Status = z.infer<typeof ContentStatusSchema>;

export interface TreatmentData {
  units: readonly KnowledgeUnit[];
  signs: readonly Sign[];
  activities: readonly Activity[];
}

const RANK: Record<Status, number> = { pending: 0, transcribed: 1, reviewed: 2, implemented: 3, tested: 4 };
const atLeast = (status: Status, minimum: Status) => RANK[status] >= RANK[minimum];

/**
 * Keeps each unit's status honest about its treatment (CONTENIDO.md):
 * - `reviewed`: checked against the image of its page;
 * - `implemented`: reviewed and covered, by a reviewed activity or as consultation material (`consultationReason`);
 * - `tested`: covered by reviewed activities, which the catalog playthrough test answers right and wrong.
 * Signs follow the same scale through sign-identification activities. Draft activities cover nothing.
 */
export function validateTreatment({ units, signs, activities }: TreatmentData): string[] {
  const errors: string[] = [];
  const reviewed = activities.filter((activity) => activity.status === 'reviewed');
  const practicedUnits = new Set(reviewed.flatMap((activity) => activity.unitIds));
  const practicedSigns = new Set(
    reviewed.flatMap((activity) =>
      activity.type === 'sign-identification' ? activity.variants.map((variant) => variant.signId) : [],
    ),
  );

  for (const unit of units) {
    const practiced = practicedUnits.has(unit.id);
    const consulted = unit.consultationReason !== undefined;
    if (practiced && !atLeast(unit.status, 'implemented'))
      errors.push(`${unit.id}: covered by an activity but its status is ${unit.status}`);
    if (atLeast(unit.status, 'implemented') && !practiced && !consulted)
      errors.push(`${unit.id}: status ${unit.status} needs an activity or a consultation reason`);
    if (unit.status === 'tested' && !practiced) errors.push(`${unit.id}: only activities can make a unit tested`);
    if (consulted && !atLeast(unit.status, 'reviewed'))
      errors.push(`${unit.id}: consultation needs a reviewed unit (status ${unit.status})`);
  }

  for (const sign of signs) {
    const practiced = practicedSigns.has(sign.id);
    if (practiced && !atLeast(sign.status, 'implemented'))
      errors.push(`${sign.id}: used by an activity but its status is ${sign.status}`);
    if (atLeast(sign.status, 'implemented') && !practiced)
      errors.push(`${sign.id}: status ${sign.status} needs a sign-identification activity`);
  }

  // Traceability: the feedback cites, for every concept practiced, at least one page where the source teaches it.
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  for (const activity of activities) {
    for (const unitId of activity.unitIds) {
      const unit = unitById.get(unitId);
      if (unit && !activity.refs.some((ref) => ref.source === unit.source && unit.pages.includes(ref.page)))
        errors.push(`${activity.id}: cites no page of ${unitId} (${unit.source} ${unit.pages.join(', ')})`);
    }
  }
  return errors;
}
