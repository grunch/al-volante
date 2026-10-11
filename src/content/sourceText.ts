import type { SourceId } from './schemas.ts';

// Extracted text, one chunk per source, loaded only when a page of that source is opened.
const LOADERS: Record<SourceId, () => Promise<{ default: string }>> = {
  manual: () => import('../../specs/fuentes/manual.txt?raw'),
  protocolo: () => import('../../specs/fuentes/protocolo.txt?raw'),
  recorridos: () => import('../../specs/fuentes/recorridos.txt?raw'),
  siniestros: () => import('../../specs/fuentes/siniestros.txt?raw'),
};

/** Splits pdftotext output into physical pages (form feed separated); index 0 is PDF page 1. */
export function splitPages(text: string): string[] {
  return text.split('\f');
}

/** Returns the extracted text of a physical PDF page, trimmed of trailing whitespace. */
export async function loadPageText(source: SourceId, page: number, loaders = LOADERS): Promise<string> {
  const { default: text } = await loaders[source]();
  return (splitPages(text)[page - 1] ?? '').replace(/\s+$/, '');
}
