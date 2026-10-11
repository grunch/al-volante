/**
 * The one ISO format the app stores (toISOString: milliseconds and Z). IndexedDB compares index keys as text, which
 * matches time order only when every date uses the same format.
 */
export function canonicalIso(iso: string): string {
  return new Date(iso).toISOString();
}

const isValidIso = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value));

/** Same attempt with its readable dates rewritten canonically. Callers apply it only to attempts that pass the schema. */
export function canonicalStoredAttempt(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return value;
  const record = value as Record<string, unknown>;
  const fix = (field: unknown) => (isValidIso(field) ? canonicalIso(field) : field);
  const fixList = (list: unknown) =>
    Array.isArray(list)
      ? list.map((item: unknown) =>
          typeof item === 'object' && item !== null
            ? { ...(item as Record<string, unknown>), at: fix((item as Record<string, unknown>).at) }
            : item,
        )
      : list;
  return {
    ...record,
    startedAt: fix(record.startedAt),
    finishedAt: fix(record.finishedAt),
    events: fixList(record.events),
    faults: fixList(record.faults),
  };
}
