import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import * as THREE from 'three';
import { HeldInput } from './heldInput.ts';
import { KEY_BINDINGS } from './controls.ts';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { gearLabel } from './telemetry.ts';
import type { Telemetry } from './telemetry.ts';
import { createCockpitScene } from '../scene/cockpitScene.ts';
import { CockpitControls } from './CockpitControls.tsx';
import { commandCockpit, initialCockpit } from './cockpit.ts';
import type { CockpitCommand } from './cockpit.ts';
import {
  DEFAULT_BINDINGS,
  BINDINGS_STORAGE_KEY,
  HOLD_ACTIONS,
  DRIVE_COMMANDS,
  actionForCode,
  drivingKeys,
  parseBindings,
  rebind,
} from './bindings.ts';
import type { Action, Bindings } from './bindings.ts';
import type { Observation } from '../exam/session.ts';
import { COCKPIT_COPY as copy } from '../i18n/es-AR.ts';
import type { RendererFactory, SceneRenderer } from '../scene/SceneCanvas.tsx';
import { EXAM_SPECS } from '../sim/car.ts';
import type { CarEvent, CarState } from '../sim/car.ts';
import { radSToRpm } from '../sim/powertrain/engine.ts';
import type { PowertrainCommand, TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { interpolateVehicle } from '../sim/vehicle.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import type { World } from '../sim/world.ts';

/** How often the page gets telemetry for its readouts; the canvas itself updates every frame. */
const TELEMETRY_INTERVAL_S = 0.1;
/** Frames longer than this (a background tab, a breakpoint) count as this long. */
const MAX_FRAME_S = 0.25;
const MAX_PIXEL_RATIO = 2;
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
  /** Commands applied at the start and on every reset (an exam begins with the key in contact). */
  prepared?: readonly PowertrainCommand[];
  /** Receives every cabin command and every simulation step, for the exam evaluation (F03-T04). */
  onObservation?: (observation: Observation) => void;
}

const defaultRendererFactory: RendererFactory = () => new THREE.WebGLRenderer({ antialias: true });
const EMPTY_COMMANDS: readonly PowertrainCommand[] = [];

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
  prepared = EMPTY_COMMANDS,
  onObservation,
}: DrivingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef(new HeldInput());
  const [cockpit, setCockpit] = useState(initialCockpit);
  const cockpitRef = useRef(cockpit);
  const [bindings, setBindings] = useState<Bindings>(() => {
    try {
      return parseBindings(localStorage.getItem(BINDINGS_STORAGE_KEY));
    } catch {
      return DEFAULT_BINDINGS;
    }
  });
  const [storageError, setStorageError] = useState(false);
  const [readout, setReadout] = useState({ speed: 0, rpm: 0, gear: transmission === 'manual' ? 'N' : 'P' });
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const command = (value: CockpitCommand) => {
    const before = cockpitRef.current;
    cockpitRef.current = commandCockpit(before, value);
    setCockpit(cockpitRef.current);
    observationRef.current?.({ type: 'cockpit', command: value, before, after: cockpitRef.current });
  };
  const release = () => {
    heldRef.current.clear();
    pendingRef.current.length = 0;
    dragRef.current = null;
    command({ type: 'horn', value: false });
  };
  const startAction = (action: Action, source: string) => {
    if (HOLD_ACTIONS.has(action)) {
      heldRef.current.press(source, action);
      if (action === 'horn') command({ type: 'horn', value: true });
    } else if (DRIVE_COMMANDS.has(action)) {
      pendingRef.current.push(KEY_BINDINGS[action as keyof typeof KEY_BINDINGS][0]);
    } else {
      const current = cockpitRef.current;
      switch (action) {
        case 'lookLeft':
          command({ type: 'look', yaw: 1.3, pitch: 0 });
          break;
        case 'lookRight':
          command({ type: 'look', yaw: -1.3, pitch: 0 });
          break;
        case 'lookBack':
          command({ type: 'look', yaw: 2.35, pitch: 0 });
          break;
        case 'lookCenter':
          command({ type: 'look', yaw: 0, pitch: 0 });
          break;
        case 'belt':
        case 'hazards':
        case 'wipers':
          command({ type: 'toggle', control: action });
          break;
        case 'lights': {
          const sequence = ['off', 'position', 'low', 'high'] as const;
          command({
            type: 'lights',
            value: sequence[(sequence.indexOf(current.lights) + 1) % sequence.length] ?? 'off',
          });
          break;
        }
        case 'signalLeft':
        case 'signalRight': {
          const value = action === 'signalLeft' ? 'left' : 'right';
          command({ type: 'signal', value: current.signal === value ? 'off' : value });
          break;
        }
      }
    }
  };
  const stopAction = (source: string) => {
    heldRef.current.release(source);
    if (!heldRef.current.peek().has('horn') && cockpitRef.current.horn) command({ type: 'horn', value: false });
  };
  const saveBindings = (next: Bindings) => {
    release();
    setBindings(next);
    try {
      localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  };
  const pendingRef = useRef<string[]>([]);
  const resetRef = useRef(resetCount);
  const telemetryRef = useRef(onTelemetry);
  const observationRef = useRef(onObservation);
  const [state, setState] = useState<DrivingState>('loading');

  useEffect(() => {
    resetRef.current = resetCount;
    telemetryRef.current = onTelemetry;
    observationRef.current = onObservation;
  }, [resetCount, onTelemetry, onObservation]);

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
    const track = createCockpitScene(world, EXAM_SPECS.vehicle);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    const resize = () => {
      if (container.clientWidth === 0 || container.clientHeight === 0) return;
      renderer.setSize(container.clientWidth, container.clientHeight, false);
      track.resize(container.clientWidth, container.clientHeight);
    };
    resize();
    if (typeof ResizeObserver !== 'function') window.addEventListener('resize', resize);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    observer?.observe(container);
    // Switching tab or app may not blur the view itself, and the key-up never arrives: release everything.
    const releaseKeys = () => {
      heldRef.current.clear();
      pendingRef.current.length = 0;
      dragRef.current = null;
      cockpitRef.current = commandCockpit(cockpitRef.current, { type: 'horn', value: false });
      setCockpit(cockpitRef.current);
    };
    window.addEventListener('blur', releaseKeys);
    document.addEventListener('visibilitychange', releaseKeys);

    const observeStep = (car: CarState, stepEvents: readonly CarEvent[], dt: number) =>
      observationRef.current?.({ type: 'step', car, cockpit: cockpitRef.current, events: stepEvents, dt });
    const fresh = () => {
      const frame = startDriving(start, transmission, prepared);
      if (prepared.length > 0) observeStep(frame.stepper.state, frame.events, 0);
      return frame;
    };
    let driving = fresh();
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
        driving = fresh();
        lastEvent = null;
        releaseKeys();
        cockpitRef.current = initialCockpit();
        setCockpit(cockpitRef.current);
      }
      let hornSampled = false;
      driving = driveFrame(
        world,
        driving,
        () => {
          const actions = heldRef.current.sample();
          hornSampled ||= actions.has('horn');
          return drivingKeys(actions);
        },
        pendingRef.current.splice(0),
        frameS,
        EXAM_SPECS,
        observeStep,
      );
      // Keep a short horn press visible for the frame that consumes it.
      const horn = hornSampled || heldRef.current.peek().has('horn');
      if (horn !== cockpitRef.current.horn) {
        cockpitRef.current = commandCockpit(cockpitRef.current, { type: 'horn', value: horn });
        setCockpit(cockpitRef.current);
      }
      const { stepper, events } = driving;
      const car = stepper.state;
      const rpm = radSToRpm(car.powertrain.engineRadS);
      track.update(
        interpolateVehicle(stepper.previous.world.vehicle, car.world.vehicle, driving.alpha),
        cockpitRef.current,
        rpm,
        car.world.timeS,
      );
      renderer.render(track.scene, track.camera);
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
        setReadout({ speed: Math.abs(car.world.vehicle.speedMps * 3.6), rpm, gear: gearLabel(car.powertrain) });
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
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', releaseKeys);
      document.removeEventListener('visibilitychange', releaseKeys);
      track.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [createRenderer, world, start, transmission, prepared]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    const action = actionForCode(bindings, event.code);
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) startAction(action, `key-${event.code}`);
  };

  return (
    <section className="cockpit-shell" aria-label={copy.title}>
      <div className="cockpit-heading">
        <span>{copy.subtitle}</span>
        <strong>{cockpit.belt ? copy.beltOn : copy.beltOff}</strong>
      </div>
      <p className="cockpit-help">{copy.help}</p>
      <div className="cockpit-viewport">
        <div
          className="scene-canvas driving-canvas"
          ref={containerRef}
          data-state={state}
          data-testid="driving-canvas"
          data-look-yaw={cockpit.lookYaw}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onKeyUp={(event) => {
            if (actionForCode(bindings, event.code)) event.preventDefault();
            stopAction(`key-${event.code}`);
          }}
          onBlur={release}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.id !== event.pointerId) return;
            command({
              type: 'look',
              yaw: cockpitRef.current.lookYaw - (event.clientX - drag.x) * 0.006,
              pitch: cockpitRef.current.lookPitch + (event.clientY - drag.y) * 0.006,
            });
            dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onLostPointerCapture={() => {
            dragRef.current = null;
          }}
          {...(state === 'unavailable' ? {} : { role: 'application', 'aria-label': label })}
        >
          {state === 'loading' && <p className="scene-canvas__status">{loadingText}</p>}
          {state === 'unavailable' && (
            <p className="scene-canvas__status" role="status">
              {unavailableText}
            </p>
          )}
        </div>
        {state === 'ready' && (
          <div className="cockpit-digital" aria-label={copy.title}>
            <span>
              <b>{readout.speed.toFixed(0)}</b> {copy.speed}
            </span>
            <strong>{readout.gear}</strong>
            <span>
              {readout.rpm.toFixed(0)} {copy.rpm}
            </span>
            <span className="cockpit-indicator">{copy.lightNames[cockpit.lights]}</span>
            <span className="cockpit-indicator">
              {cockpit.hazards
                ? copy.toggles.hazards
                : cockpit.signal === 'left'
                  ? '←'
                  : cockpit.signal === 'right'
                    ? '→'
                    : ''}
            </span>
          </div>
        )}
      </div>
      {state === 'ready' && (
        <CockpitControls
          state={cockpit}
          command={command}
          start={startAction}
          stop={stopAction}
          bindings={bindings}
          bind={(action, code) => {
            const next = rebind(bindings, action, code);
            if (!next) return false;
            saveBindings(next);
            return true;
          }}
          restore={() => saveBindings(DEFAULT_BINDINGS)}
          storageError={storageError}
          automatic={transmission === 'automatic'}
        />
      )}
    </section>
  );
}
