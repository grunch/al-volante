import type { Source } from './schemas.ts';

/** Physical page count of each source in the manifest. */
export type PageCounts = ReadonlyMap<string, number>;

export function pageCountsOf(manifest: readonly Source[]): PageCounts {
  return new Map(manifest.map((source) => [source.id, source.pages]));
}

/** Every citation must name a source of the manifest and a page inside it. */
export function refErrors(
  label: string,
  refs: ReadonlyArray<{ source: string; page: number }>,
  pages: PageCounts,
): string[] {
  return refs.flatMap((ref) => {
    const total = pages.get(ref.source);
    if (total === undefined) return [`${label}: cites ${ref.source}, which is not in the manifest`];
    return ref.page > total ? [`${label}: reference ${ref.source}:${ref.page} is outside 1..${total}`] : [];
  });
}
