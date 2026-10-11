import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneCanvas } from './SceneCanvas.tsx';
import { createFakeRenderer } from '../test/fakeRenderer.ts';

const props = { label: 'Garaje 3D', loadingText: 'Cargando…', unavailableText: 'Sin WebGL' };

describe('SceneCanvas', () => {
  let frameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => frameCallbacks.push(callback));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function runNextFrame() {
    const callback = frameCallbacks.shift();
    act(() => callback?.(performance.now()));
  }

  it('shows a loading state, then renders frames and reports ready', () => {
    // Arrange
    const renderer = createFakeRenderer();

    // Act
    render(<SceneCanvas {...props} createRenderer={() => renderer} />);
    const container = screen.getByTestId('garage-scene');
    const loadingVisible = screen.queryByText('Cargando…') !== null;
    runNextFrame();

    // Assert
    expect(loadingVisible).toBe(true);
    expect(container).toHaveAttribute('data-state', 'ready');
    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(container).toContainElement(renderer.domElement);
    expect(renderer.domElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('img', { name: 'Garaje 3D' })).toBe(container);
  });

  it('falls back to an accessible message when WebGL cannot start', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <SceneCanvas
        {...props}
        createRenderer={() => {
          throw new Error('WebGL unavailable');
        }}
      />,
    );

    runNextFrame();

    expect(screen.getByTestId('garage-scene')).toHaveAttribute('data-state', 'unavailable');
    expect(screen.getByRole('status')).toHaveTextContent('Sin WebGL');
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

  it('renders a single frame with reduced motion, and again only when the size changes', () => {
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
    runNextFrame();
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
});
