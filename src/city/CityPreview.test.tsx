import { act, render, screen } from '@testing-library/react';
import type * as THREE from 'three';
import routeData from '../../specs/route/comuna13-a.json';
import { RouteSchema } from '../content/schemas.ts';
import { buildCity } from './model.ts';
import { CityPreview } from './CityPreview.tsx';
import { createFakeRenderer } from '../test/fakeRenderer.ts';
import { CITY_COPY as copy } from '../i18n/es-AR.ts';

const city = buildCity(RouteSchema.parse(routeData));
let frame: FrameRequestCallback | undefined;
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', undefined);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('exposes a readable failure when WebGL is unavailable', () => {
  render(
    <CityPreview
      city={city}
      leg={1}
      whole={false}
      createRenderer={() => {
        throw new Error('Unavailable WebGL');
      }}
    />,
  );
  act(() => frame?.(0));
  expect(screen.getByRole('status')).toHaveTextContent(copy.unavailable);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('renders a static preview, redraws on resize and releases resources on unmount', () => {
  const renderer = createFakeRenderer();
  const { unmount } = render(<CityPreview city={city} leg={1} whole={false} createRenderer={() => renderer} />);
  act(() => frame?.(0));
  expect(renderer.render).toHaveBeenCalledOnce();
  const [scene] = renderer.render.mock.calls[0]!;
  expect(scene.children.length).toBeGreaterThan(3);
  act(() => window.dispatchEvent(new Event('resize')));
  expect(renderer.render).toHaveBeenCalledTimes(2);
  unmount();
  expect(renderer.dispose).toHaveBeenCalledOnce();
  expect(scene.children.every((child) => !child.name.startsWith('city-'))).toBe(true);
  expect(renderer.domElement.isConnected).toBe(false);
});

it('announces the loading status and becomes an image only once the view is ready', () => {
  render(<CityPreview city={city} leg={1} whole={false} createRenderer={() => createFakeRenderer()} />);
  expect(screen.getByRole('status')).toHaveTextContent(copy.loading);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  act(() => frame?.(0));
  expect(screen.getByRole('img', { name: copy.canvasLabel })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('goes back to loading while it rebuilds for another leg, and is an image again once drawn', () => {
  const view = render(<CityPreview city={city} leg={1} whole={false} createRenderer={() => createFakeRenderer()} />);
  act(() => frame?.(0));
  expect(screen.getByRole('img', { name: copy.canvasLabel })).toBeInTheDocument();
  view.rerender(<CityPreview city={city} leg={2} whole={false} createRenderer={() => createFakeRenderer()} />);
  expect(screen.getByRole('status')).toHaveTextContent(copy.loading);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  act(() => frame?.(0));
  expect(screen.getByRole('img', { name: copy.canvasLabel })).toBeInTheDocument();
});

it('frames the whole route from above, without fog, with every sector loaded', () => {
  // Arrange
  const renderer = createFakeRenderer();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(450);

  // Act
  render(<CityPreview city={city} leg={3} whole createRenderer={() => renderer} />);
  act(() => frame?.(0));

  // Assert
  const [scene, camera] = renderer.render.mock.calls[0]! as [THREE.Scene, THREE.PerspectiveCamera];
  const points = city.roads.flatMap((road) => [road.a, road.b]);
  const xs = points.map((point) => point.x);
  const zs = points.map((point) => point.z);
  expect(camera.position.x).toBeCloseTo((Math.min(...xs) + Math.max(...xs)) / 2, 6);
  expect(camera.position.z).toBeCloseTo((Math.min(...zs) + Math.max(...zs)) / 2 + 0.1, 6);
  expect(camera.aspect).toBe(2);
  // Both extents (with a 35 m margin each side) fit the 48° view at that height.
  const halfViewM = camera.position.y * Math.tan((24 * Math.PI) / 180);
  expect(halfViewM * 2).toBeGreaterThanOrEqual(Math.max(...zs) - Math.min(...zs) + 70 - 1e-6);
  expect(halfViewM * 2 * camera.aspect).toBeGreaterThanOrEqual(Math.max(...xs) - Math.min(...xs) + 70 - 1e-6);
  expect(camera.near).toBe(5);
  expect(scene.fog).toBeNull();
  const container = screen.getByTestId('city-preview');
  expect(container.dataset.sectors).toBe(container.dataset.totalSectors);
  expect(renderer.setSize).toHaveBeenCalledWith(900, 450, false);
});

it('follows the container through ResizeObserver and disconnects it on unmount', () => {
  // Arrange
  const renderer = createFakeRenderer();
  let notify: (() => void) | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
  const { unmount } = render(<CityPreview city={city} leg={1} whole={false} createRenderer={() => renderer} />);
  act(() => frame?.(0));

  // Act
  width.mockReturnValue(800);
  act(() => notify?.());
  unmount();

  // Assert
  expect(renderer.setSize).toHaveBeenLastCalledWith(800, 300, false);
  expect(renderer.render).toHaveBeenCalledTimes(2);
  expect(disconnect).toHaveBeenCalledOnce();
});

it('keeps the pixel ratio within its fill-rate budget, and at one when the browser reports none', () => {
  for (const [reported, used] of [
    [3, 1.5],
    [1.25, 1.25],
    [0, 1],
  ] as const) {
    vi.stubGlobal('devicePixelRatio', reported);
    const renderer = createFakeRenderer();
    const { unmount } = render(<CityPreview city={city} leg={1} whole={false} createRenderer={() => renderer} />);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(used);
    unmount();
  }
});
