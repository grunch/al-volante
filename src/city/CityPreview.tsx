import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { City } from './model.ts';
import { sampleLeg, offsetPoint } from './model.ts';
import { attachCity } from './scene.ts';
import type { RendererFactory, SceneRenderer } from '../scene/SceneCanvas.tsx';
import { CITY_COPY as copy } from '../i18n/es-AR.ts';

const defaultFactory: RendererFactory = () => new THREE.WebGLRenderer({ antialias: true });
export function CityPreview({
  city,
  leg,
  whole,
  createRenderer = defaultFactory,
}: {
  city: City;
  leg: number;
  whole: boolean;
  createRenderer?: RendererFactory;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState('loading');
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let renderer: SceneRenderer;
    try {
      renderer = createRenderer();
    } catch {
      const frame = requestAnimationFrame(() => setState('unavailable'));
      return () => cancelAnimationFrame(frame);
    }
    const scene = new THREE.Scene();
    const cityView = attachCity(scene, city);
    const sun = new THREE.DirectionalLight('#fff1d4', 2.4);
    sun.position.set(-60, 100, -20);
    scene.add(sun, new THREE.HemisphereLight('#e7f3f4', '#989386', 2));
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1500);
    const length = city.legs.find((item) => item.number === leg)?.lengthM ?? 0;
    const focus = sampleLeg(city, leg, Math.min(length / 2, 55));
    cityView.update(focus, whole);
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    const resize = () => {
      const width = container.clientWidth || 800,
        height = container.clientHeight || 520;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      if (whole) {
        // Keep enough depth precision for road paint when viewing the whole kilometre-scale scene.
        camera.near = 5;
        const points = city.roads.flatMap((road) => [road.a, road.b]);
        const minX = Math.min(...points.map((p) => p.x)),
          maxX = Math.max(...points.map((p) => p.x));
        const minZ = Math.min(...points.map((p) => p.z)),
          maxZ = Math.max(...points.map((p) => p.z));
        const x = (minX + maxX) / 2,
          z = (minZ + maxZ) / 2;
        const elevation =
          Math.max((maxX - minX + 70) / camera.aspect, maxZ - minZ + 70) / (2 * Math.tan((24 * Math.PI) / 180));
        camera.position.set(x, elevation, z + 0.1);
        camera.lookAt(x, 0, z);
        scene.fog = null;
      } else {
        camera.near = 0.5;
        const eye = offsetPoint(focus, focus.headingRad, -28, -35);
        camera.position.set(eye.x, 35, eye.z);
        camera.lookAt(focus.x, 0, focus.z);
      }
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      container.dataset.sectors = String(cityView.stream.active.size);
      container.dataset.totalSectors = String(scene.userData.totalSectors);
    };
    const frame = requestAnimationFrame(() => {
      resize();
      setState('ready');
    });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    if (!observer) window.addEventListener('resize', resize);
    return () => {
      // A rebuild (another leg, the whole route, another renderer) is loading again until its first frame.
      setState('loading');
      cancelAnimationFrame(frame);
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resize);
      cityView.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [city, leg, whole, createRenderer]);
  return (
    <div
      ref={ref}
      className="city-preview"
      data-testid="city-preview"
      data-state={state}
      // Only the finished view is an image: while loading, the live status must stay exposed to screen readers.
      {...(state === 'ready' ? { role: 'img', 'aria-label': copy.canvasLabel } : {})}
    >
      {state !== 'ready' && <p role="status">{state === 'unavailable' ? copy.unavailable : copy.loading}</p>}
    </div>
  );
}
