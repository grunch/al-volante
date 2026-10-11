import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createGarageScene } from './garageScene.ts';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion.ts';

/** Subset of THREE.WebGLRenderer the canvas needs; lets tests inject a fake without WebGL. */
export interface SceneRenderer {
  readonly domElement: HTMLCanvasElement;
  setPixelRatio(ratio: number): void;
  setSize(widthPx: number, heightPx: number, updateStyle?: boolean): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  dispose(): void;
}

export type RendererFactory = () => SceneRenderer;

export type SceneState = 'loading' | 'ready' | 'unavailable';

/** Caps device pixel ratio to keep the fill-rate budget predictable on high-DPI screens. */
const MAX_PIXEL_RATIO = 2;

const defaultRendererFactory: RendererFactory = () => new THREE.WebGLRenderer({ antialias: true });

interface SceneCanvasProps {
  label: string;
  loadingText: string;
  unavailableText: string;
  createRenderer?: RendererFactory;
}

/** Mounts the garage scene, animates it and reports its lifecycle through `data-state`. */
export function SceneCanvas({
  label,
  loadingText,
  unavailableText,
  createRenderer = defaultRendererFactory,
}: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<SceneState>('loading');
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: SceneRenderer;
    try {
      renderer = createRenderer();
    } catch (error) {
      console.warn('WebGL renderer could not be created', error);
      // Report asynchronously, like 'ready', so the effect never triggers a synchronous re-render.
      const pending = requestAnimationFrame(() => setState('unavailable'));
      return () => cancelAnimationFrame(pending);
    }

    const garage = createGarageScene({ reducedMotion });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);

    let frame = 0;
    let firstFrame = true;
    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      garage.resize(width, height);
      // Without the animation loop, a resized canvas needs an explicit redraw.
      if (reducedMotion && !firstFrame) renderer.render(garage.scene, garage.camera);
    };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    if (!observer) window.addEventListener('resize', resize);

    const start = performance.now();
    const loop = (now: number) => {
      garage.update((now - start) / 1000);
      renderer.render(garage.scene, garage.camera);
      if (firstFrame) {
        firstFrame = false;
        setState('ready');
      }
      // A still scene needs a single frame; keeping the loop would only spend GPU and battery.
      if (!reducedMotion) frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      garage.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [createRenderer, reducedMotion]);

  return (
    <div
      className="scene-canvas"
      ref={containerRef}
      role="img"
      aria-label={label}
      data-state={state}
      data-testid="garage-scene"
    >
      {state === 'loading' && <p className="scene-canvas__status">{loadingText}</p>}
      {state === 'unavailable' && (
        <p className="scene-canvas__status" role="status">
          {unavailableText}
        </p>
      )}
    </div>
  );
}
