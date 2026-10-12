import { act, render, screen } from '@testing-library/react';
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
