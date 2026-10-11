import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import * as THREE from 'three';
import { KEY_BINDINGS } from './controls.ts';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { createTrackScene } from '../scene/trackScene.ts';
import type { RendererFactory, SceneRenderer } from '../scene/SceneCanvas.tsx';
import { interpolateVehicle } from '../sim/vehicle.ts';
import type { VehicleSpec, VehicleState } from '../sim/vehicle.ts';
import type { Contact, World } from '../sim/world.ts';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion.ts';

/** How often the page gets telemetry for its readouts; the canvas itself updates every frame. */
const TELEMETRY_INTERVAL_S = 0.1;
/** Frames longer than this (a background tab, a breakpoint) count as this long. */
const MAX_FRAME_S = 0.25;
const MAX_PIXEL_RATIO = 2;
const BOUND_KEYS: ReadonlySet<string> = new Set(Object.values(KEY_BINDINGS).flat());

export interface Telemetry {
  speedKmh: number;
  odometerM: number;
  reverse: boolean;
  /** Latest contact with an obstacle, if any. */
  contact: Contact | null;
}

export type DrivingState = 'loading' | 'ready' | 'unavailable';

interface DrivingCanvasProps {
  world: World;
  spec: VehicleSpec;
  start: VehicleState;
  label: string;
  loadingText: string;
  unavailableText: string;
  createRenderer?: RendererFactory;
  onTelemetry?: (telemetry: Telemetry) => void;
  /** Incrementing it puts the car back at the start. */
  resetCount?: number;
}

const defaultRendererFactory: RendererFactory = () => new THREE.WebGLRenderer({ antialias: true });

/**
 * Drives the simulation in a 3D view. Keys are read only while the view has focus, so the rest of the page keeps its
 * keyboard. The simulation advances in fixed steps (FPS-independent) and the view interpolates between them.
 */
export function DrivingCanvas({
  world,
  spec,
  start,
  label,
  loadingText,
  unavailableText,
  createRenderer = defaultRendererFactory,
  onTelemetry,
  resetCount = 0,
}: DrivingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
  const reverseRef = useRef(false);
  const resetRef = useRef(resetCount);
  const telemetryRef = useRef(onTelemetry);
  const [state, setState] = useState<DrivingState>('loading');
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    resetRef.current = resetCount;
    telemetryRef.current = onTelemetry;
  }, [resetCount, onTelemetry]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: SceneRenderer;
    try {
      renderer = createRenderer();
    } catch (error) {
      console.warn('WebGL renderer could not be created', error);
      const pending = requestAnimationFrame(() => setState('unavailable'));
      return () => cancelAnimationFrame(pending);
    }
    const track = createTrackScene(world, spec, { reducedMotion });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    const resize = () => {
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      track.resize(container.clientWidth, container.clientHeight);
    };
    resize();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    // Switching tab or app may not blur the view itself, and the key-up never arrives: release everything.
    const releaseKeys = () => keysRef.current.clear();
    window.addEventListener('blur', releaseKeys);
    document.addEventListener('visibilitychange', releaseKeys);

    let driving = startDriving(start);
    let appliedReset = resetRef.current;
    let lastTime: number | null = null;
    let sinceTelemetryS = TELEMETRY_INTERVAL_S;
    let contact: Contact | null = null;
    let frame = 0;
    let first = true;

    const loop = (now: number) => {
      const frameS = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_FRAME_S);
      lastTime = now;
      if (appliedReset !== resetRef.current) {
        appliedReset = resetRef.current;
        driving = startDriving(start);
        reverseRef.current = false;
        contact = null;
      }
      driving = driveFrame(spec, world, driving, keysRef.current, reverseRef.current, frameS);
      const { stepper, controls } = driving;
      const vehicle = stepper.state.vehicle;
      track.update(interpolateVehicle(stepper.previous.vehicle, vehicle, driving.alpha));
      renderer.render(track.scene, track.camera);
      container.dataset.speedKmh = (vehicle.speedMps * 3.6).toFixed(1);
      container.dataset.odometerM = vehicle.odometerM.toFixed(2);
      container.dataset.timeS = stepper.state.timeS.toFixed(4);
      container.dataset.reverse = String(controls.reverse);
      if (driving.contact) contact = driving.contact;
      sinceTelemetryS += frameS;
      if (driving.contact || sinceTelemetryS >= TELEMETRY_INTERVAL_S) {
        sinceTelemetryS = 0;
        telemetryRef.current?.({
          speedKmh: vehicle.speedMps * 3.6,
          odometerM: vehicle.odometerM,
          reverse: controls.reverse,
          contact,
        });
      }
      if (first) {
        first = false;
        setState('ready');
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('blur', releaseKeys);
      document.removeEventListener('visibilitychange', releaseKeys);
      track.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [createRenderer, world, spec, start, reducedMotion]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!BOUND_KEYS.has(event.code)) return;
    event.preventDefault();
    if ((KEY_BINDINGS.reverse as readonly string[]).includes(event.code)) {
      if (!event.repeat) reverseRef.current = !reverseRef.current;
      return;
    }
    keysRef.current.add(event.code);
  };

  const onKeyUp = (event: KeyboardEvent<HTMLDivElement>) => {
    keysRef.current.delete(event.code);
  };

  return (
    <div
      className="scene-canvas driving-canvas"
      ref={containerRef}
      data-state={state}
      data-testid="driving-canvas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      // Letting go of the view releases every key, so the car never keeps accelerating unattended.
      onBlur={() => keysRef.current.clear()}
      {...(state === 'unavailable' ? {} : { role: 'application', 'aria-label': label })}
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
