import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { App } from './App.tsx';
import { renderApp } from '../test/renderApp.tsx';
import { HOME_SPACES, esAR, t } from '../i18n/es-AR.ts';

describe('layout and home', () => {
  it('renders the garage home with navigation, skip link and the six spaces', async () => {
    // Arrange / Act
    renderApp('/');

    // Assert
    expect(screen.getByRole('heading', { level: 1, name: 'Mi garaje' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: esAR.mainNavigation });
    expect(within(nav).getByRole('link', { name: esAR.navHome })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: esAR.skipToContent })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: esAR.garageSceneLabel })).toBeInTheDocument();
    const spaces = screen.getByRole('region', { name: esAR.spacesHeading });
    // The six spaces of PROPUESTA §2, in its order; the library is a separate screen, linked under the intro.
    expect(
      within(spaces)
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(HOME_SPACES.map((space) => space.title));
    expect(HOME_SPACES.map((space) => space.title)).toEqual([
      'Mi garaje',
      'La ciudad te pregunta',
      'Laboratorio vial',
      'Ruta 13',
      'Sala de examen',
      'Mi bitácora',
    ]);
    // Only the road lab and Ruta 13 are still to come.
    expect(within(spaces).getAllByText(esAR.comingSoon)).toHaveLength(2);
    expect(within(spaces).getByRole('link', { name: 'Sala de examen' })).toHaveAttribute('href', '/teorico');
    expect(within(spaces).getByRole('link', { name: 'Mi garaje' })).toHaveAttribute('href', '/garaje');
    expect(within(spaces).getByRole('link', { name: 'La ciudad te pregunta' })).toHaveAttribute('href', '/actividades');
    expect(within(spaces).getByRole('link', { name: 'Mi bitácora' })).toHaveAttribute('href', '/bitacora');
    expect(within(screen.getByRole('main')).getByRole('link', { name: esAR.navLibrary })).toHaveAttribute(
      'href',
      '/biblioteca',
    );
    expect(document.title).toBe(esAR.appTitle);
  });

  it('moves focus to the main landmark with the skip link', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(screen.getByRole('link', { name: esAR.skipToContent }));

    expect(screen.getByRole('main')).toHaveFocus();
  });

  it('moves focus to the new page title and updates the document title after navigation', async () => {
    const user = userEvent.setup();
    renderApp('/');

    await user.click(
      within(screen.getByRole('navigation', { name: esAR.mainNavigation })).getByRole('link', {
        name: esAR.navLibrary,
      }),
    );

    const title = await screen.findByRole('heading', { level: 1, name: esAR.libraryHeading });
    await waitFor(() => expect(title).toHaveFocus());
    expect(document.title).toBe(`${esAR.libraryHeading} · ${esAR.appTitle}`);
  });

  it('shows a not-found page for unknown routes', () => {
    renderApp('/no-existe');

    expect(screen.getByRole('heading', { level: 1, name: esAR.notFoundHeading })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: esAR.backHome })).toHaveAttribute('href', '/');
  });

  it('creates its own hash router when none is injected', async () => {
    render(
      <App
        loadContent={() => new Promise(() => undefined)}
        createRenderer={() => ({
          domElement: document.createElement('canvas'),
          setPixelRatio() {},
          setSize() {},
          render() {},
          dispose() {},
        })}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Mi garaje' })).toBeInTheDocument();
    await screen.findByRole('img', { name: esAR.garageSceneLabel });
  });
});

describe('content states', () => {
  it('shows an accessible loading state while content loads', () => {
    renderApp('/mapa', () => new Promise(() => undefined));

    expect(screen.getByRole('status')).toHaveTextContent(esAR.contentLoading);
  });

  it('shows validation errors and retries loading', async () => {
    const user = userEvent.setup();
    const load = vi.fn().mockResolvedValue({ ok: false, errors: ['specs/catalog/units.json[0].id: invalid'] });
    renderApp('/mapa', load);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(esAR.contentError);
    expect(within(alert).getByText('specs/catalog/units.json[0].id: invalid')).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: esAR.retry }));

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('reports a rejected load as an error', async () => {
    renderApp('/biblioteca', () => Promise.reject(new Error('network down')));

    expect(await screen.findByRole('alert')).toHaveTextContent('network down');
  });
});

describe('t', () => {
  it('returns the Rioplatense Spanish copy for a key', () => {
    expect(t('garageHeading')).toBe('Mi garaje');
  });
});

describe('real WebGL fallback', () => {
  it('degrades gracefully where WebGL is missing (jsdom)', async () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frames.push(callback));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(<App loadContent={() => new Promise(() => undefined)} />);
    await screen.findByRole('img', { name: esAR.garageSceneLabel });
    act(() => frames.shift()?.(0));

    expect(screen.getByText(esAR.garageSceneUnavailable)).toBeInTheDocument();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
});
