import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderApp, readyContent, testContent } from '../../test/renderApp.tsx';
import { RouteSchema } from '../../content/schemas.ts';
import routeData from '../../../specs/route/comuna13-a.json';
import { CITY_COPY as copy, TRACK_COPY } from '../../i18n/es-AR.ts';

let callbacks: FrameRequestCallback[];
beforeEach(() => {
  callbacks = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
let now = 100;
const runFrames = (elapsedMs = 0) =>
  act(() => {
    now += elapsedMs;
    const pending = callbacks.splice(0);
    pending.forEach((callback) => callback(now));
  });
const content = () => readyContent({ ...testContent(), route: RouteSchema.parse(routeData) });
// Building the 3D city takes seconds, and longer while other suites run beside this one.
const SCENE_TIMEOUT_MS = 30_000;

it(
  'offers every route entry, both transmissions, source evidence and an accessible metric map',
  { timeout: SCENE_TIMEOUT_MS },
  async () => {
    renderApp('/recorrido', content());
    const selector = await screen.findByRole('combobox', { name: copy.selectLeg });
    expect(screen.getAllByRole('option')).toHaveLength(8);
    expect(screen.getByRole('img', { name: copy.mapLabel })).toBeInTheDocument();
    expect(screen.getByText('1.507 m')).toBeInTheDocument();
    fireEvent.change(selector, { target: { value: '4' } });
    expect(screen.getByText(copy.nextLeft)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: TRACK_COPY.manual }));
    expect(screen.getByRole('radio', { name: TRACK_COPY.manual })).toBeChecked();
    expect(screen.getByText(copy.approximation)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: copy.sourceMap })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
    await screen.findByTestId('city-preview');
    runFrames();
    fireEvent.click(screen.getByRole('button', { name: copy.whole }));
    const view = screen.getByTestId('city-preview');
    await waitFor(() => {
      runFrames();
      expect(view).toHaveAttribute('data-state', 'ready');
      expect(Number(view.dataset.sectors)).toBeGreaterThan(0);
      expect(view.dataset.sectors).toBe(view.dataset.totalSectors);
    });
  },
);

it('keeps the content load error visible instead of constructing an unvalidated scene', async () => {
  renderApp('/recorrido', () => Promise.resolve({ ok: false, errors: ['Invalid route geometry'] }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid route geometry');
  expect(screen.queryByTestId('city-preview')).not.toBeInTheDocument();
});

it('links the explorer from the garage', () => {
  renderApp('/');
  expect(screen.getByRole('link', { name: copy.homeLink })).toHaveAttribute('href', '/recorrido');
});

it(
  'drives with seeded traffic: the seed input is bounded and the cockpit reports active actors',
  { timeout: SCENE_TIMEOUT_MS },
  async () => {
    renderApp('/recorrido', content());
    await screen.findByTestId('city-preview');
    const seed = screen.getByRole('spinbutton', { name: copy.seed });
    expect(seed).toHaveValue(1);
    fireEvent.change(seed, { target: { value: '-3' } });
    expect(seed).toHaveValue(1);
    fireEvent.change(seed, { target: { value: '7' } });
    expect(seed).toHaveValue(7);
    // Clearing the field to type another seed does not apply seed 0; leaving it empty restores the last one.
    fireEvent.change(seed, { target: { value: '' } });
    expect(seed).toHaveValue(null);
    fireEvent.blur(seed);
    expect(seed).toHaveValue(7);
    expect(screen.getByText(copy.seedHelp)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: copy.drive }));
    const view = await screen.findByTestId('driving-canvas');
    await waitFor(() => {
      runFrames(50);
      expect(view).toHaveAttribute('data-state', 'ready');
    });
    // Half a second of simulation activates the actors near the entry.
    for (let frame = 0; frame < 12; frame++) runFrames(50);
    expect(Number(view.dataset.actors)).toBeGreaterThan(0);
    expect(screen.getByText(copy.scope, { exact: false })).toBeInTheDocument();
  },
);

it('says the explorer scores nothing and links the exam that does', async () => {
  renderApp('/recorrido', content());

  const notice = (await screen.findByText(copy.scope, { exact: false })).closest('p') as HTMLElement;

  expect(notice).toHaveTextContent(copy.scope);
  expect(within(notice).getByRole('link', { name: copy.examLink })).toHaveAttribute('href', '/examen');
});

it(
  'switches between the block and the whole circuit, and between exploring and driving with a reset',
  { timeout: SCENE_TIMEOUT_MS },
  async () => {
    // Arrange
    renderApp('/recorrido', content());
    await screen.findByTestId('city-preview');

    // Act / Assert: the whole circuit and back to the block.
    fireEvent.click(screen.getByRole('button', { name: copy.whole }));
    fireEvent.click(screen.getByRole('button', { name: copy.block }));
    expect(screen.getByRole('button', { name: copy.whole })).toBeInTheDocument();

    // Driving offers a reset to the entry point instead of the block toggle.
    fireEvent.click(screen.getByRole('button', { name: copy.drive }));
    expect(screen.getByRole('button', { name: copy.drive })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: copy.whole })).not.toBeInTheDocument();
    const view = await screen.findByTestId('driving-canvas');
    fireEvent.click(screen.getByRole('button', { name: copy.reset }));
    expect(view).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: copy.overview }));
    expect(screen.getByRole('button', { name: copy.overview })).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByTestId('city-preview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: copy.reset })).not.toBeInTheDocument();
  },
);
