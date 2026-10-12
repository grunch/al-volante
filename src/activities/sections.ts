import type { Activity, KnowledgeUnit } from '../content/schemas.ts';

/** `manual` + `ch1` → `manual-ch1`: the key of a source section, as in the activity file names and the URL. */
export const sectionKey = (source: string, section: string) => `${source}-${section}`;

/** Activities grouped by the section of their first unit (the file each one lives in), in catalog order. */
export function activitiesBySection(
  activities: readonly Activity[],
  units: ReadonlyArray<Pick<KnowledgeUnit, 'id' | 'source' | 'section'>>,
): Map<string, Activity[]> {
  const sectionOf = new Map(units.map((unit) => [unit.id, sectionKey(unit.source, unit.section)]));
  const groups = new Map<string, Activity[]>();
  for (const activity of activities) {
    const key = sectionOf.get(activity.unitIds[0] ?? '');
    if (key === undefined) continue;
    groups.set(key, [...(groups.get(key) ?? []), activity]);
  }
  return groups;
}
