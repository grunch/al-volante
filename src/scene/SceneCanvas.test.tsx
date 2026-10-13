import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneCanvas } from './SceneCanvas.tsx';
import { createFakeRenderer } from '../test/fakeRenderer.ts';
import type { FakeRenderer } from '../test/fakeRenderer.ts';
import * as THREE from 'three';
import { loadKaitModel } from './kaitModel.ts';

/** The renderers built by the default factory; jsdom has no WebGL, so `THREE.WebGLRenderer` records instead. */
const webgl = vi.hoisted(() => ({ built: [] as { parameters: unknown; renderer: FakeRenderer }[] }));
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>();
  const { createFakeRenderer: fake } = await import('../test/fakeRenderer.ts');
  return {
    ...actual,
    WebGLRenderer: function WebGLRenderer(parameters: unknown) {
      const renderer = Object.assign(fake(), { shadowMap: {} });
      webgl.built.push({ parameters, renderer });
      return renderer;
    },
  };
});

vi.mock('./kaitModel.ts', () => ({ loadKaitModel: vi.fn() }));

const props = { label: 'Garaje 3D', loadingText: 'Cargando…', unavailableText: 'Sin WebGL' };

describe('SceneCanvas', () => {
  let frameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    vi.mocked(loadKaitModel).mockResolvedValue(new THREE.Group());
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frameCallbacks.push(callback));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function runNextFrame() {
    await act(async () => {
      await Promise.resolve();
    });
    const callback = frameCallbacks.shift();
    act(() => callback?.(performance.now()));
  }

  it('shows a loading state, then renders frames and reports ready', async () => {
    // Arrange
    const renderer = createFakeRenderer();

    // Act
    render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    const container = screen.getByTestId('garage-scene');
    const loadingVisible = screen.queryByText('Cargando…') !== null;
    await runNextFrame();

    // Assert
    expect(loadingVisible).toBe(true);
    expect(container).toHaveAttribute('data-state', 'ready');
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(container).toContainElement(renderer.domElement);
    expect(renderer.domElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: 'Garaje 3D' })).toBe(container);
  });

  it('falls back to an accessible message when WebGL cannot start', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <SceneCanvas
        {...props}
        createRenderer={() => {
          throw new Error('WebGL unavailable');
        }}
      />,
    );

    await runNextFrame();

    expect(screen.getByTestId('garage-scene')).toHaveAttribute('data-state', 'unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('Sin WebGL');
    // The message must not sit inside an ARIA image, whose descendants screen readers treat as decorative.
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('status').closest('[role="img"]')).toBeNull();
  });

  it('sizes the renderer to its container', () => {
    const renderer = createFakeRenderer();
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(360);

    render(<SceneCanvas {...props} createRenderer={() => renderer} />);

    expect(renderer.setSize).toHaveBeenCalledWith(640, 360, false);
    vi.restoreAllMocks();
  });

  it('follows container size changes through ResizeObserver when available', () => {
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
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);
    const { unmount } = render(<SceneCanvas {...props} createRenderer={() => renderer} />);

    width.mockReturnValue(500);
    act(() => notify?.());
    unmount();

    expect(renderer.setSize).toHaveBeenLastCalledWith(500, 200, false);
    expect(disconnect).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it('renders a single frame with reduced motion, and again only when the size changes', async () => {
    // Arrange
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const renderer = createFakeRenderer();
    let notify: (() => void) | undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(200);

    // Act
    render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    await runNextFrame();
    const framesAfterFirst = frameCallbacks.length;
    act(() => notify?.());

    // Assert
    expect(screen.getByTestId('garage-scene')).toHaveAttribute('data-state', 'ready');
    expect(framesAfterFirst).toBe(0);
    expect(renderer.render).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('stops the loop and releases the renderer on unmount', () => {
    const renderer = createFakeRenderer();
    const { unmount } = render(<SceneCanvas {...props} createRenderer={() => renderer} />);

    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(renderer.dispose).toHaveBeenCalled();
    expect(renderer.domElement.isConnected).toBe(false);
  });

  it('creates an antialiased WebGL renderer by default, at most at twice the CSS pixel density', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const { unmount } = render(<SceneCanvas {...props} />);
    const { parameters, renderer } = webgl.built.at(-1)!;
    expect(parameters).toEqual({ antialias: true });
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    unmount();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it('assumes one device pixel per CSS pixel when the browser reports none', () => {
    vi.stubGlobal('devicePixelRatio', 0);
    render(<SceneCanvas {...props} />);
    expect(webgl.built.at(-1)!.renderer.setPixelRatio).toHaveBeenCalledWith(1);
  });

  it('waits for the model instead of displaying the old placeholder car', async () => {
    let finish!: (model: THREE.Group) => void;
    vi.mocked(loadKaitModel).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const renderer = createFakeRenderer();
    render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    await runNextFrame();
    expect(renderer.render).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    await act(async () => finish(new THREE.Group()));
    await runNextFrame();
    expect(screen.getByTestId('garage-scene')).toHaveAttribute('data-state', 'ready');
  });

  it('reports a failed asset load accessibly and releases the canvas only once', async () => {
    vi.mocked(loadKaitModel).mockRejectedValue(new Error('Model unavailable'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const renderer = createFakeRenderer();
    const { unmount } = render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    await runNextFrame();
    expect(screen.getByRole('status')).toHaveTextContent('Sin WebGL');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(renderer.domElement.isConnected).toBe(false);
    unmount();
    expect(renderer.dispose).toHaveBeenCalledOnce();
  });

  it('aborts a pending load and disposes a model that resolves after unmount', async () => {
    let finish!: (model: THREE.Group) => void;
    vi.mocked(loadKaitModel).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const car = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    car.add(new THREE.Mesh(geometry, material));
    const dispose = vi.spyOn(geometry, 'dispose');
    const renderer = createFakeRenderer();
    const { unmount } = render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    await runNextFrame();
    const signal = vi.mocked(loadKaitModel).mock.calls.at(-1)![0];
    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => finish(car));
    expect(dispose).toHaveBeenCalledOnce();
    expect(renderer.render).not.toHaveBeenCalled();
  });

  it('ignores the rejection of a cancelled load', async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(loadKaitModel).mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { unmount } = render(<SceneCanvas {...props} createRenderer={createFakeRenderer} />);
    await runNextFrame();
    unmount();
    await act(async () => reject(new DOMException('Cancelled', 'AbortError')));
    expect(warning).not.toHaveBeenCalled();
  });

  it('pauses when hidden and resumes when visible', async () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const renderer = createFakeRenderer();
    render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    await runNextFrame();
    expect(renderer.render).not.toHaveBeenCalled();
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    hidden.mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await runNextFrame();
    expect(renderer.render).toHaveBeenCalledOnce();
  });

  it('does not render a stale animation callback after unmount', async () => {
    const renderer = createFakeRenderer();
    const { unmount } = render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    await runNextFrame();
    const before = renderer.render.mock.calls.length;
    unmount();
    await runNextFrame();
    expect(renderer.render).toHaveBeenCalledTimes(before);
  });

  it('does not restart a reduced-motion scene when the tab becomes visible', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    const renderer = createFakeRenderer();
    render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    await runNextFrame();
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await runNextFrame();
    expect(renderer.render).toHaveBeenCalledOnce();
  });
});
