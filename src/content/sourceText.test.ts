import { describe, expect, it } from 'vitest';
import manifest from '../../specs/fuentes/manifest.json';
import manual from '../../specs/fuentes/manual.txt?raw';
import protocolo from '../../specs/fuentes/protocolo.txt?raw';
import recorridos from '../../specs/fuentes/recorridos.txt?raw';
import siniestros from '../../specs/fuentes/siniestros.txt?raw';
import { SOURCE_IDS } from './schemas.ts';
import type { SourceId } from './schemas.ts';
import { loadPageText, splitPages } from './sourceText.ts';

describe('splitPages', () => {
  it('splits pdftotext output at form feeds, page 1 first', () => {
    expect(splitPages('uno\fdos\f')).toEqual(['uno', 'dos', '']);
  });
});

describe('loadPageText (extracted text of the official PDFs)', () => {
  it('has one page of text per physical page of every source in the manifest', async () => {
    const texts: Record<SourceId, string> = { manual, protocolo, recorridos, siniestros };
    for (const source of SOURCE_IDS) {
      // Arrange
      const { pages } = manifest.find((entry) => entry.id === source) as { pages: number };

      // Act
      const beyond = await loadPageText(source, pages + 1);

      // Assert: pdftotext ends every page with a form feed, so only an empty chunk follows the last page.
      expect(splitPages(texts[source]), source).toHaveLength(pages + 1);
      expect(beyond, source).toBe('');
    }
  });

  it('returns the text of a physical page without trailing blank lines', async () => {
    const cover = await loadPageText('recorridos', 1);

    expect(cover).toMatch(/^ÁREAS URBANAS\nPARA EL EXÁMEN PRÁCTICO/);
    expect(cover).not.toMatch(/\s$/);
  });

  it('uses injected loaders, so a page can be read without the bundled text', async () => {
    const loaders = {
      manual: () => Promise.resolve({ default: 'tapa\fpágina dos  \n\n\f' }),
      protocolo: () => Promise.resolve({ default: '' }),
      recorridos: () => Promise.resolve({ default: '' }),
      siniestros: () => Promise.resolve({ default: '' }),
    };

    expect(await loadPageText('manual', 2, loaders)).toBe('página dos');
  });
});
