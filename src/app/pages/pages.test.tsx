import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/renderApp.tsx';
import { esAR } from '../../i18n/es-AR.ts';
import { loadPageText, splitPages } from '../../content/sourceText.ts';
import type * as SourceTextModule from '../../content/sourceText.ts';

describe('learning map', () => {
  it('lists campaign B sections in study order, apart from complementary material', async () => {
    // Arrange / Act
    renderApp('/mapa');

    // Assert
    const campaign = await screen.findByRole('region', { name: esAR.mapCampaignB });
    const links = within(campaign)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(links).toEqual(['Cap. 3 · Normas básicas de conducción', 'Anexo IV · Señales viales']);
    expect(within(campaign).getByText('1 unidades · 1 con actividades')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: esAR.mapComplementary })).toBeInTheDocument();
  });

  it('opens a section with its units and links to their source pages', async () => {
    const user = userEvent.setup();
    renderApp('/mapa');

    await user.click(await screen.findByRole('link', { name: 'Cap. 3 · Normas básicas de conducción' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Cap. 3 · Normas básicas de conducción' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Rotonda' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `${esAR.seeSourcePage} 2` })).toHaveAttribute(
      'href',
      '/biblioteca/manual/2',
    );
  });

  it('shows not found for a section that does not exist', async () => {
    renderApp('/mapa/manual/ch9');

    expect(await screen.findByRole('heading', { level: 1, name: esAR.notFoundHeading })).toBeInTheDocument();
  });
});

describe('library', () => {
  it('lists every source with edition, page count, page browser and official PDF', async () => {
    renderApp('/biblioteca');

    await screen.findByRole('heading', { level: 2, name: 'manual' });
    const cards = within(screen.getByRole('main')).getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    const manual = cards[0]!;
    expect(within(manual).getByText(`${esAR.edition}: 2023 · 3 ${esAR.pagesLabel}`)).toBeInTheDocument();
    expect(within(manual).getByRole('link', { name: esAR.browseSource })).toHaveAttribute(
      'href',
      '/biblioteca/manual/1',
    );
    expect(within(manual).getByRole('link', { name: esAR.officialPdf })).toHaveAttribute(
      'href',
      'https://example.org/source.pdf',
    );
  });

  it('shows a catalogued page with summary, units, issues, extracted text and the PDF at that page', async () => {
    renderApp('/biblioteca/manual/2');

    expect(await screen.findByRole('heading', { level: 1, name: 'Página 2 · manual' })).toBeInTheDocument();
    expect(screen.getByText('Rotonda', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rotonda' })).toHaveAttribute('href', '/mapa/manual/ch3');
    expect(screen.getByText('Dato a verificar', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: esAR.officialPdfAtPage })).toHaveAttribute(
      'href',
      'https://example.org/source.pdf#page=2',
    );
    expect(await screen.findByRole('heading', { name: esAR.extractedText })).toBeInTheDocument();
    expect(await screen.findByText(/Este manual fue diseñado/, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('shows figures and signs of a page', async () => {
    renderApp('/biblioteca/manual/3');

    expect(await screen.findByText('Cuadro de señales')).toBeInTheDocument();
    expect(screen.getByText('PARE')).toBeInTheDocument();
  });

  it('shows exam rules on protocol pages, which have no page catalog', async () => {
    renderApp('/biblioteca/protocolo/32');

    expect(await screen.findByText(esAR.pageNotCatalogued)).toBeInTheDocument();
    expect(screen.getByText('Cruza con el semáforo en rojo', { exact: false })).toBeInTheDocument();
  });

  it('moves between pages with the previous/next links and the page form', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/biblioteca/manual/2');

    await user.click(await screen.findByRole('link', { name: `${esAR.nextPage} →` }));
    expect(router.state.location.pathname).toBe('/biblioteca/manual/3');
    await user.click(screen.getByRole('link', { name: `← ${esAR.previousPage}` }));
    expect(router.state.location.pathname).toBe('/biblioteca/manual/2');
    const input = screen.getByLabelText(esAR.goToPage);
    await user.clear(input);
    await user.type(input, '1');
    await user.click(screen.getByRole('button', { name: esAR.go }));

    expect(router.state.location.pathname).toBe('/biblioteca/manual/1');
    expect(screen.queryByRole('link', { name: `← ${esAR.previousPage}` })).not.toBeInTheDocument();
  });

  it('rejects pages outside the source and unknown sources', async () => {
    renderApp('/biblioteca/manual/99');
    expect(await screen.findByRole('alert')).toHaveTextContent(esAR.invalidPage);
  });

  it('shows not found for an unknown source', async () => {
    renderApp('/biblioteca/otro/1');
    expect(await screen.findByRole('heading', { level: 1, name: esAR.notFoundHeading })).toBeInTheDocument();
  });
});

describe('source text', () => {
  it('splits extracted text by form feed and returns the requested page', async () => {
    const loaders = {
      manual: () => Promise.resolve({ default: 'uno\fdos  \n\ftres' }),
      protocolo: () => Promise.resolve({ default: '' }),
      recorridos: () => Promise.resolve({ default: '' }),
      siniestros: () => Promise.resolve({ default: '' }),
    };

    expect(splitPages('a\fb')).toEqual(['a', 'b']);
    expect(await loadPageText('manual', 2, loaders)).toBe('dos');
    expect(await loadPageText('manual', 9, loaders)).toBe('');
  });

  it('shows an error instead of an empty page when the text cannot be loaded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.doMock('../../content/sourceText.ts', async (importOriginal) => ({
      ...(await importOriginal<typeof SourceTextModule>()),
      loadPageText: () => Promise.reject(new Error('chunk failed')),
    }));
    vi.resetModules();
    const { renderApp: renderFresh } = await import('../../test/renderApp.tsx');

    renderFresh('/biblioteca/manual/2');

    expect(await screen.findByText(esAR.extractedTextError)).toBeInTheDocument();
    vi.doUnmock('../../content/sourceText.ts');
    vi.restoreAllMocks();
  });
});
