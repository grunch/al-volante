import { activityKeyOf } from '../activityFiles.ts';
import { ActivityCatalogSchema } from '../schemas.ts';
import type { Activity } from '../schemas.ts';

const files = import.meta.glob<unknown>('../../../specs/catalog/activities/*.json', { eager: true, import: 'default' });

/** The real activity files, parsed and keyed by section, for tests that exercise the shipped catalog. */
export const catalogActivityFiles: ReadonlyMap<string, Activity[]> = new Map(
  Object.entries(files)
    .map(([path, json]) => [activityKeyOf(path), ActivityCatalogSchema.parse(json)] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);

/** Every activity of the shipped catalog, in file order. */
export const catalogActivities: Activity[] = [...catalogActivityFiles.values()].flat();
