import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createGarageScene } from './garageScene.ts';
import type { GarageScene } from './garageScene.ts';
import { loadKaitModel } from './kaitModel.ts';
import { disposeScene } from './dispose.ts';
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

const defaultRendererFactory: RendererFactory = () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Only the camera moves: the parked car's shadow can be reused between frames.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  return renderer;
};

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

    const abort = new AbortController();
    let garage: GarageScene | undefined;
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
      garage?.resize(width, height);
      // Without the animation loop, a resized canvas needs an explicit redraw.
      if (reducedMotion && !firstFrame && garage) renderer.render(garage.scene, garage.camera);
    };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    if (!observer) window.addEventListener('resize', resize);

    let start = 0;
    const loop = (now: number) => {
      if (!garage || document.hidden || abort.signal.aborted) return;
      garage.update((now - start) / 1000);
      renderer.render(garage.scene, garage.camera);
      if (firstFrame) {
        firstFrame = false;
        setState('ready');
      }
      // A still scene needs a single frame; keeping the loop would only spend GPU and battery.
      if (!reducedMotion) frame = requestAnimationFrame(loop);
    };
    const onVisibilityChange = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden && garage && (!reducedMotion || firstFrame)) frame = requestAnimationFrame(loop);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    async function initialize() {
      // A preference change starts a new scene and returns to the accessible loading state.
      await Promise.resolve();
      if (abort.signal.aborted) return;
      setState('loading');
      try {
        const car = await loadKaitModel(abort.signal);
        if (abort.signal.aborted) {
          disposeScene(car);
          return;
        }
        garage = createGarageScene({ reducedMotion, car });
        resize();
        start = performance.now();
        frame = requestAnimationFrame(loop);
      } catch (error) {
        if (abort.signal.aborted) return;
        console.warn('Kait garage could not be loaded', error);
        setState('unavailable');
        release();
      }
    }
    void initialize();

    let released = false;
    function release() {
      if (released) return;
      released = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      garage?.dispose();
      garage = undefined;
      renderer.dispose();
      renderer.domElement.remove();
    }

    return () => {
      abort.abort();
      release();
    };
  }, [createRenderer, reducedMotion]);

  return (
    <div
      className="scene-canvas"
      ref={containerRef}
      // Only the finished view is an image: an ARIA image hides its descendants, so while loading (or without WebGL)
      // the status message must stay exposed to screen readers.
      {...(state === 'ready' ? { role: 'img', 'aria-label': label } : {})}
      data-state={state}
      data-testid="garage-scene"
    >
      {state === 'loading' && (
        <p className="scene-canvas__status" role="status">
          {loadingText}
        </p>
      )}
      {state === 'unavailable' && (
        <p className="scene-canvas__status" role="status">
          {unavailableText}
        </p>
      )}
    </div>
  );
}
