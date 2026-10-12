/** `specs/catalog/activities/manual-ch1.json` → `manual-ch1`: the key of an activity file is its section. */
export function activityKeyOf(path: string): string {
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.json$/, '');
}
