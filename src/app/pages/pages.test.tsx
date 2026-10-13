import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { readyContent, renderApp, testContent } from '../../test/renderApp.tsx';
import { choiceActivity, page, rule, ruleCatalog, sign, unit } from '../../content/testing/fixtures.ts';
import { ACTIVITY_COPY, GARAGE_COPY, SIGN_COPY, esAR } from '../../i18n/es-AR.ts';
import { familyOf, groupSigns } from './SignsPage.tsx';
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
    expect(within(campaign).getByText('1 unidad · 1 con actividades')).toBeInTheDocument();
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

  it('links each unit to the activities that practice it and the section to its activity list', async () => {
    renderApp('/mapa/manual/ch3');

    expect(await screen.findByRole('link', { name: '1 actividad sobre esta sección' })).toHaveAttribute(
      'href',
      '/actividades?seccion=manual-ch3',
    );
    expect(screen.getByRole('link', { name: 'Velocidad en calle' })).toHaveAttribute(
      'href',
      '/actividad/act.speed-street',
    );
  });

  it('marks consultation units with their reason and shows the figures of each unit', async () => {
    const content = testContent();
    content.units = content.units.map((item) => ({ ...item, consultationReason: 'Teléfonos por verificar.' }));
    content.activities = [];
    content.figures = [
      {
        id: 'fig.manual-p2-roundabout',
        source: 'manual',
        page: 2,
        box: { x: 0, y: 0, width: 1, height: 0.5 },
        alt: 'Rotonda con la prioridad de quien circula dentro.',
        unitIds: ['manual.ch3.roundabout-priority'],
      },
    ];
    renderApp('/mapa/manual/ch3', readyContent(content));

    expect(await screen.findByText(esAR.sectionNoActivities)).toBeInTheDocument();
    expect(screen.getByText(esAR.unitConsultation)).toBeInTheDocument();
    expect(screen.getByText('Teléfonos por verificar.')).toBeInTheDocument();
    const image = screen.getByRole('img', { name: 'Rotonda con la prioridad de quien circula dentro.' });
    expect(image.getAttribute('src')).toMatch(/figures\/manual-p2-roundabout\.png$/);
    expect(screen.getByText('Manual, PDF 2')).toBeInTheDocument();
  });

  it('shows the figures of an activity only with the feedback, after answering', async () => {
    const user = userEvent.setup();
    const content = testContent();
    content.figures = [
      {
        id: 'fig.manual-p2-roundabout',
        source: 'manual',
        page: 2,
        box: { x: 0, y: 0, width: 1, height: 0.5 },
        alt: 'Rotonda con la prioridad de quien circula dentro.',
        unitIds: ['manual.ch3.roundabout-priority'],
      },
    ];
    content.activities = content.activities.map((activity) => ({
      ...activity,
      figureIds: ['fig.manual-p2-roundabout'],
    }));
    renderApp('/actividad/act.speed-street?semilla=1', readyContent(content));

    await user.click(await screen.findByRole('radio', { name: 'A' }));
    expect(screen.queryByRole('img', { name: /Rotonda/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ACTIVITY_COPY.answer }));

    expect(await screen.findByRole('img', { name: /Rotonda/ })).toBeInTheDocument();
  });

  it('counts several units and activities in the plural, and the consultation units apart', async () => {
    // Arrange: three units in ch3, one of them for consultation, practised by two activities.
    const content = testContent();
    content.units = [
      ...content.units,
      unit({ id: 'manual.ch3.second', title: 'Segunda' }),
      unit({ id: 'manual.ch3.third', title: 'Tercera', consultationReason: 'Dato a verificar.' }),
    ];
    content.activities = [
      choiceActivity(),
      choiceActivity({ id: 'act.second', title: 'Segunda actividad', unitIds: ['manual.ch3.second'] }),
    ];

    // Act
    renderApp('/mapa', readyContent(content));

    // Assert
    const campaign = await screen.findByRole('region', { name: esAR.mapCampaignB });
    expect(within(campaign).getByText('3 unidades · 2 con actividades · 1 de consulta')).toBeInTheDocument();
  });

  it('lists the key facts and the figure-based mark of a unit, and spans the pages of its section', async () => {
    const content = testContent();
    content.pages = [
      ...content.pages,
      page({ source: 'manual', page: 3, section: 'ch3', category: 'B', kind: 'instructional', summary: 'Más' }),
    ];
    content.manifest = content.manifest.map((item) => (item.id === 'manual' ? { ...item, pages: 3 } : item));
    content.units = content.units.map((item) => ({
      ...item,
      keyFacts: ['Dentro de la rotonda tiene prioridad quien ya circula.'],
      figureBased: true,
    }));
    content.activities = [choiceActivity(), choiceActivity({ id: 'act.second', title: 'Segunda actividad' })];

    renderApp('/mapa/manual/ch3', readyContent(content));

    expect(await screen.findByText('Dentro de la rotonda tiene prioridad quien ya circula.')).toBeInTheDocument();
    expect(screen.getByText(esAR.figureBased)).toBeInTheDocument();
    expect(screen.getByText(`${esAR.sectionPages} 2–3`, { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2 actividades sobre esta sección' })).toBeInTheDocument();
    const practised = screen.getByText(`${esAR.unitPracticedIn}:`, { exact: false });
    expect(practised).toHaveTextContent('Velocidad en calle · Segunda actividad');
  });

  it('shows not found for a section that does not exist', async () => {
    renderApp('/mapa/manual/ch9');

    expect(await screen.findByRole('heading', { level: 1, name: esAR.notFoundHeading })).toBeInTheDocument();
  });
});

describe('garage', () => {
  it('opens the cockpit practice and lists the inspection activities of annex I', async () => {
    const content = testContent();
    content.pages = [
      ...content.pages,
      page({ source: 'manual', page: 3, section: 'annex1', category: 'B', kind: 'instructional', summary: 'Frenos' }),
    ];
    content.units = [...content.units, unit({ id: 'manual.annex1.brakes', section: 'annex1', pages: [3] })];
    content.activities = [
      ...content.activities,
      choiceActivity({ id: 'act.car-brakes', title: 'Revisar los frenos', unitIds: ['manual.annex1.brakes'] }),
    ];
    renderApp('/garaje', readyContent(content));

    expect(await screen.findByRole('link', { name: 'Revisar los frenos' })).toHaveAttribute(
      'href',
      '/actividad/act.car-brakes',
    );
    expect(screen.queryByRole('link', { name: 'Velocidad en calle' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: GARAGE_COPY.stageOne })).toHaveAttribute(
      'href',
      '/examen?modo=practicar&etapa=1',
    );
    expect(screen.getByRole('link', { name: GARAGE_COPY.yard })).toHaveAttribute('href', '/pista');
  });

  it('says so when annex I has no activities yet', async () => {
    renderApp('/garaje');

    expect(await screen.findByText(GARAGE_COPY.noActivities)).toBeInTheDocument();
  });
});

describe('sign catalog', () => {
  it('groups the signs by family with their image, name, meaning, page and practice link', async () => {
    const content = testContent();
    content.signs = content.signs.map((item) => ({ ...item, box: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 } }));
    content.activities = [
      {
        ...choiceActivity(),
        id: 'act.stop-sign',
        type: 'sign-identification',
        variants: [{ ...choiceActivity().variants[0]!, signId: 'sign.regulatory.stop' }],
      },
    ];
    renderApp('/senales', readyContent(content));

    content.signs = [
      ...content.signs,
      sign({
        id: 'sign.light-signals.red',
        page: 3,
        group: 'Señalamiento luminoso / Significado de las luces',
        name: 'ROJO',
      }),
    ];
    const family = await screen.findByRole('region', { name: 'Reglamentarias' });
    // A family with spaces in its name still names its region (aria-labelledby is a list of ids).
    expect(screen.getByRole('region', { name: 'Señalamiento luminoso' })).toBeInTheDocument();
    expect(within(family).getByText('PARE')).toBeInTheDocument();
    expect(within(family).getByText('Detención obligatoria')).toBeInTheDocument();
    expect(within(family).getByRole('img', { name: 'Círculo rojo' }).getAttribute('src')).toMatch(
      /signs\/regulatory\.stop\.png$/,
    );
    expect(within(family).getByRole('link', { name: `${SIGN_COPY.page} 3` })).toHaveAttribute(
      'href',
      '/biblioteca/manual/3',
    );
    // The activity may practise several signs: the link asks for the variant of this one.
    expect(within(family).getByRole('link', { name: SIGN_COPY.practise })).toHaveAttribute(
      'href',
      '/actividad/act.stop-sign?variante=v1',
    );
  });

  it('opens the variant asked for in the URL and keeps it while choosing a seed', async () => {
    const content = testContent();
    content.activities = [
      choiceActivity({
        id: 'act.two-questions',
        variants: [
          {
            id: 'first',
            prompt: 'Primera pregunta',
            options: [
              { id: 'a', text: 'Sí', correct: true, feedback: 'Bien' },
              { id: 'b', text: 'No', correct: false, feedback: 'No' },
            ],
          },
          {
            id: 'second',
            prompt: 'Segunda pregunta',
            options: [
              { id: 'a', text: 'Sí', correct: true, feedback: 'Bien' },
              { id: 'b', text: 'No', correct: false, feedback: 'No' },
            ],
          },
        ],
      }),
    ];
    const { router } = renderApp('/actividad/act.two-questions?variante=second', readyContent(content));

    expect(await screen.findByText('Segunda pregunta')).toBeInTheDocument();
    expect(router.state.location.search).toMatch(/^\?variante=second&semilla=\d+$/);
  });

  it('groups the signs by family and group in page order, with a heading for each subgroup', () => {
    const signs = [
      sign({ id: 'sign.c', page: 9, group: 'Reglamentarias / De prohibición', name: 'C' }),
      sign({ id: 'sign.a', page: 4, group: 'Reglamentarias / De prohibición / Giros', name: 'A' }),
      sign({ id: 'sign.b', page: 5, group: 'Semáforos', name: 'B' }),
      sign({ id: 'sign.d', page: 2, group: 'Reglamentarias / De prohibición', name: 'D' }),
    ];

    const families = groupSigns(signs);

    expect(families.map(({ family }) => family)).toEqual(['Reglamentarias', 'Semáforos']);
    expect(families[0]?.groups.map(([group, list]) => [group, list.map((item) => item.name)])).toEqual([
      ['Reglamentarias / De prohibición', ['D', 'C']],
      ['Reglamentarias / De prohibición / Giros', ['A']],
    ]);
    expect(familyOf({ group: 'Semáforos' })).toBe('Semáforos');
  });

  it('heads each subgroup without repeating its family, and links each sign to the first reviewed activity', async () => {
    const content = testContent();
    content.signs = [
      sign({ id: 'sign.regulatory.stop', page: 3, group: 'Reglamentarias / De prioridad', name: 'PARE' }),
    ];
    const identify = (id: string, status: 'reviewed' | 'draft') => ({
      ...choiceActivity(),
      id,
      status,
      type: 'sign-identification' as const,
      variants: [{ ...choiceActivity().variants[0]!, signId: 'sign.regulatory.stop' }],
    });
    content.activities = [
      identify('act.draft', 'draft'),
      identify('act.first', 'reviewed'),
      identify('act.second', 'reviewed'),
    ];

    renderApp('/senales', readyContent(content));

    const family = await screen.findByRole('region', { name: 'Reglamentarias' });
    expect(within(family).getByRole('heading', { level: 3, name: 'De prioridad' })).toBeInTheDocument();
    expect(within(family).getByRole('link', { name: SIGN_COPY.practise })).toHaveAttribute(
      'href',
      '/actividad/act.first?variante=v1',
    );
  });

  it('marks signs kept for reference and is linked from the library', async () => {
    const user = userEvent.setup();
    const content = testContent();
    content.signs = content.signs.map((item) => ({ ...item, consultationReason: 'Dibujo incompleto en el PDF.' }));
    renderApp('/biblioteca', readyContent(content));

    await user.click(await screen.findByRole('link', { name: SIGN_COPY.libraryLink }));

    expect(await screen.findByText('Dibujo incompleto en el PDF.')).toBeInTheDocument();
    expect(screen.getByText(SIGN_COPY.consultation)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: SIGN_COPY.practise })).not.toBeInTheDocument();
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

  it('gives the printed page number, and describes a sign without a stated meaning by its drawing', async () => {
    const content = testContent();
    content.pages = content.pages.map((item) =>
      item.source === 'manual' && item.page === 3 ? { ...item, printedPage: 1 } : item,
    );
    content.signs = content.signs.map((item) => ({ ...item, meaning: '' }));

    renderApp('/biblioteca/manual/3', readyContent(content));

    expect(await screen.findByText(`${esAR.printedPageLabel} 1`, { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Círculo rojo', { exact: false })).toHaveTextContent('PARE: Círculo rojo');
  });

  it('shows the page summary and the exam rules on protocol pages', async () => {
    renderApp('/biblioteca/protocolo/32');

    expect(await screen.findByRole('heading', { level: 2, name: esAR.pageSummary })).toBeInTheDocument();
    expect(screen.getByText('Cruza con el semáforo en rojo', { exact: false })).toBeInTheDocument();
  });

  it('shows the ficha row of the page being viewed when a rule spans several pages', async () => {
    // Arrange: one rule with ficha rows on pages 16 and 17 and a citation on page 30.
    const spanning = rule({
      id: 'rule.high.l-yield-to-pedestrians',
      severity: 'high',
      annexItem: 'l',
      points: 3,
      refs: [{ source: 'protocolo', page: 30 }],
      fichaRows: [
        { stage: 'II', group: 'Giros', text: 'Conducta de la página 16', page: 16 },
        { stage: 'II', group: 'Giros', text: 'Conducta de la página 17', page: 17 },
      ],
    });
    const load = readyContent({ ...testContent(), rules: ruleCatalog([spanning]) });

    // Act
    const page17 = renderApp('/biblioteca/protocolo/17', load);
    const rules17 = within(await screen.findByRole('region', { name: esAR.pageRules }));

    // Assert
    expect(rules17.getByText('Conducta de la página 17', { exact: false })).toBeInTheDocument();
    expect(rules17.queryByText('Conducta de la página 16', { exact: false })).not.toBeInTheDocument();
    page17.unmount();

    // A page that only cites the rule falls back to its first ficha row.
    renderApp('/biblioteca/protocolo/30', load);
    expect(await screen.findByText('Conducta de la página 16', { exact: false })).toBeInTheDocument();
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

  it('stays on the page when the page form is sent empty instead of opening a page that does not exist', async () => {
    // Arrange
    const user = userEvent.setup();
    const { router } = renderApp('/biblioteca/manual/2');
    const input = await screen.findByLabelText(esAR.goToPage);

    // Act
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: esAR.go }));

    // Assert
    expect(router.state.location.pathname).toBe('/biblioteca/manual/2');
    expect(screen.queryByRole('heading', { level: 1, name: esAR.notFoundHeading })).not.toBeInTheDocument();
    expect(input).toBeInvalid();
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
