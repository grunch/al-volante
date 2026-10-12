import { boxInsidePage } from './figures.ts';
import { pageCountsOf, refErrors } from './refs.ts';
import type { Activity, Figure, KnowledgeUnit, Sign, Source } from './schemas.ts';

export interface FigureContext {
  manifest: readonly Source[];
  units: readonly KnowledgeUnit[];
  activities: readonly Activity[];
  /** Signs carry their own crop (F05-T02); identification activities show it. */
  signs?: readonly Sign[];
}

/**
 * Figures crop a page of an official PDF: the crop stays inside the page, every unit it illustrates is on that page,
 * and an activity that shows a figure cites its page.
 */
export function validateFigures(
  figures: readonly Figure[],
  { manifest, units, activities, signs = [] }: FigureContext,
): string[] {
  const errors: string[] = [];
  const pageCounts = pageCountsOf(manifest);
  const unitById = new Map(units.map((unit) => [unit.id, unit]));
  const figureById = new Map<string, Figure>();
  for (const figure of figures) {
    const { id, box } = figure;
    if (figureById.has(id)) errors.push(`${id}: duplicate figure id`);
    figureById.set(id, figure);
    errors.push(...refErrors(id, [figure], pageCounts));
    if (!boxInsidePage(box)) errors.push(`${id}: box goes beyond the page`);
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
  for (const sign of signs)
    if (sign.box && !boxInsidePage(sign.box)) errors.push(`${sign.id}: box goes beyond the page`);
  // An identification question needs the picture of the sign: its crop.
  const boxed = new Set(signs.filter((sign) => sign.box).map((sign) => sign.id));
  for (const activity of activities) {
    if (activity.type !== 'sign-identification') continue;
    for (const variant of activity.variants)
      if (!boxed.has(variant.signId)) errors.push(`${activity.id}#${variant.id}: sign ${variant.signId} has no crop`);
  }
  return errors;
}
