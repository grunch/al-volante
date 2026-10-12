import { figureFile } from '../content/figures.ts';
import type { Figure } from '../content/schemas.ts';
import { SOURCE_SHORT_LABELS } from '../i18n/es-AR.ts';

/** A crop of an official PDF page, with its description as alternative text and its page as caption. */
export function FigureView({ figure }: { figure: Figure }) {
  return (
    <figure className="source-figure">
      <img src={`${import.meta.env.BASE_URL}${figureFile(figure.id)}`} alt={figure.alt} loading="lazy" />
      <figcaption>
        {SOURCE_SHORT_LABELS[figure.source]}, PDF {figure.page}
      </figcaption>
    </figure>
  );
}
