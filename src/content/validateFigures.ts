import { pageCountsOf, refErrors } from './refs.ts';
import type { Activity, Figure, KnowledgeUnit, Source } from './schemas.ts';

export interface FigureContext {
  manifest: readonly Source[];
  units: readonly KnowledgeUnit[];
  activities: readonly Activity[];
}

/**
 * Figures crop a page of an official PDF: the crop stays inside the page, every unit it illustrates is on that page,
 * and an activity that shows a figure cites its page.
 */
export function validateFigures(figures: readonly Figure[], { manifest, units, activities }: FigureContext): string[] {
  const errors: string[] = [];
  const pageCounts = pageCountsOf(manifest);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const figureById = new Map<string, Figure>();
  for (const figure of figures) {
    const { id, box } = figure;
    if (figureById.has(id)) errors.push(`${id}: duplicate figure id`);
    figureById.set(id, figure);
    errors.push(...refErrors(id, [figure], pageCounts));
    // A tiny tolerance absorbs rounding in hand-measured boxes without letting a crop leave the page.
    if (box.x + box.width > 1.0001 || box.y + box.height > 1.0001) errors.push(`${id}: box goes beyond the page`);
    for (const unitId of figure.unitIds) {
      const unit = unitById.get(unitId);
      if (!unit) errors.push(`${id}: unknown unit ${unitId}`);
      else if (unit.source !== figure.source || !unit.pages.includes(figure.page))
        errors.push(`${id}: unit ${unitId} is not on ${figure.source}:${figure.page}`);
    }
  }
  for (const activity of activities) {
    for (const figureId of activity.figureIds ?? []) {
      const figure = figureById.get(figureId);
      if (!figure) errors.push(`${activity.id}: unknown figure ${figureId}`);
      else if (!activity.refs.some((ref) => ref.source === figure.source && ref.page === figure.page))
        errors.push(`${activity.id}: shows ${figureId} but does not cite ${figure.source}:${figure.page}`);
    }
  }
  return errors;
}
