import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import * as THREE from 'three';
import { KEY_BINDINGS } from './controls.ts';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { gearLabel } from './telemetry.ts';
import type { Telemetry } from './telemetry.ts';
import { createTrackScene } from '../scene/trackScene.ts';
import type { RendererFactory, SceneRenderer } from '../scene/SceneCanvas.tsx';
import { EXAM_SPECS } from '../sim/car.ts';
import type { CarEvent } from '../sim/car.ts';
import { radSToRpm } from '../sim/powertrain/engine.ts';
import type { TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { interpolateVehicle } from '../sim/vehicle.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion.ts';

/** How often the page gets telemetry for its readouts; the canvas itself updates every frame. */
const TELEMETRY_INTERVAL_S = 0.1;
/** Frames longer than this (a background tab, a breakpoint) count as this long. */
const MAX_FRAME_S = 0.25;
const MAX_PIXEL_RATIO = 2;
const BOUND_KEYS: ReadonlySet<string> = new Set(Object.values(KEY_BINDINGS).flat());
const COMMAND_KEYS: ReadonlySet<string> = new Set([
  ...KEY_BINDINGS.key,
  ...KEY_BINDINGS.handbrake,
  ...KEY_BINDINGS.gearUp,
  ...KEY_BINDINGS.gearDown,
]);

export type DrivingState = 'loading' | 'ready' | 'unavailable';

interface DrivingCanvasProps {
  world: World;
  start: VehicleState;
  transmission: TransmissionKind;
  label: string;
  loadingText: string;
  unavailableText: string;
  createRenderer?: RendererFactory;
  onTelemetry?: (telemetry: Telemetry) => void;
  /** Incrementing it puts the car back at the start, engine off and key out. */
  resetCount?: number;
}

const defaultRendererFactory: RendererFactory = () => new THREE.WebGLRenderer({ antialias: true });

/** Gear changes are routine: the driver hears about everything else. */
const isNotable = (event: CarEvent) => event.type !== 'gear-engaged' && event.type !== 'key-inserted';

/**
 * Drives the car in a 3D view. Keys are read only while the view has focus, so the rest of the page keeps its
 * keyboard. The simulation advances in fixed steps (FPS-independent) and the view interpolates between them.
 */
export function DrivingCanvas({
  world,
  start,
  transmission,
  label,
  loadingText,
  unavailableText,
  createRenderer = defaultRendererFactory,
  onTelemetry,
  resetCount = 0,
}: DrivingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef(new Set<string>());
  const pendingRef = useRef<string[]>([]);
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
    const track = createTrackScene(world, EXAM_SPECS.vehicle, { reducedMotion });
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

    let driving = startDriving(start, transmission);
    let appliedReset = resetRef.current;
    let lastTime: number | null = null;
    let sinceTelemetryS = TELEMETRY_INTERVAL_S;
    let lastEvent: CarEvent | null = null;
    let frame = 0;
    let first = true;

    const loop = (now: number) => {
      const frameS = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, MAX_FRAME_S);
      lastTime = now;
      if (appliedReset !== resetRef.current) {
        appliedReset = resetRef.current;
        driving = startDriving(start, transmission);
        lastEvent = null;
      }
      driving = driveFrame(world, driving, keysRef.current, pendingRef.current.splice(0), frameS);
      const { stepper, events } = driving;
      const car = stepper.state;
      track.update(interpolateVehicle(stepper.previous.world.vehicle, car.world.vehicle, driving.alpha));
      renderer.render(track.scene, track.camera);
      const rpm = radSToRpm(car.powertrain.engineRadS);
      container.dataset.speedKmh = (car.world.vehicle.speedMps * 3.6).toFixed(1);
      container.dataset.odometerM = car.world.vehicle.odometerM.toFixed(2);
      container.dataset.timeS = car.world.timeS.toFixed(4);
      container.dataset.rpm = rpm.toFixed(0);
      container.dataset.gear = gearLabel(car.powertrain);
      container.dataset.engine = car.powertrain.engineRunning ? 'running' : 'off';
      const notable = events.filter(isNotable).at(-1);
      if (notable) lastEvent = notable;
      sinceTelemetryS += frameS;
      if (notable || sinceTelemetryS >= TELEMETRY_INTERVAL_S) {
        sinceTelemetryS = 0;
        telemetryRef.current?.({
          speedKmh: car.world.vehicle.speedMps * 3.6,
          odometerM: car.world.vehicle.odometerM,
          rpm,
          powertrain: car.powertrain,
          lastEvent,
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
  }, [createRenderer, world, start, transmission, reducedMotion]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!BOUND_KEYS.has(event.code)) return;
    event.preventDefault();
    if (COMMAND_KEYS.has(event.code)) {
      if (!event.repeat) pendingRef.current.push(event.code);
      return;
    }
    keysRef.current.add(event.code);
  };

  return (
    <div
      className="scene-canvas driving-canvas"
      ref={containerRef}
      data-state={state}
      data-testid="driving-canvas"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => keysRef.current.delete(event.code)}
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
