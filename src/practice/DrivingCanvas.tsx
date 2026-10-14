import { useMobileDriving } from './useMobileDriving.ts';
import { MobileIntro, MobileOverlay, MobileSettingsPanel, MobileNotice } from './MobileControls.tsx';
import { useDrivingAudio } from '../audio/useDrivingAudio.ts';
import { AUDIO_COPY } from '../i18n/es-AR.ts';
import { startTransition, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '../ui/usePrefersReducedMotion.ts';
import { HeldInput } from './heldInput.ts';
import { KEY_BINDINGS } from './controls.ts';
import { driveFrame, startDriving } from './drivingLoop.ts';
import { describeEvent, gearLabel } from './telemetry.ts';
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
import { initialPowertrain } from '../sim/powertrain/powertrain.ts';
import { TRACK_COPY } from '../i18n/es-AR.ts';
import { EXAM_SPECS } from '../sim/car.ts';
import type { CarEvent, CarState } from '../sim/car.ts';
import type { TrafficSnapshot } from '../sim/scenario.ts';
import { radSToRpm } from '../sim/powertrain/engine.ts';
import type { PowertrainCommand, TransmissionKind } from '../sim/powertrain/powertrain.ts';
import { interpolateVehicle } from '../sim/vehicle.ts';
import type { VehicleState } from '../sim/vehicle.ts';
import { trafficOf } from '../sim/world.ts';
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
  subtitle?: string;
  loadingText: string;
  unavailableText: string;
  createRenderer?: RendererFactory;
  createScene?: typeof createCockpitScene;
  onTelemetry?: (telemetry: Telemetry) => void;
  /** Incrementing it puts the car back at the start, engine off and key out. */
  resetCount?: number;
  /** Commands applied at the start and on every reset (an exam begins with the key in contact). */
  prepared?: readonly PowertrainCommand[];
  /** Cabin commands applied at the start and on every reset (a practice of stage III arrives belted, lights on). */
  preparedCabin?: readonly CockpitCommand[];
  /** Receives every cabin command and every simulation step, for the exam evaluation (F03-T04). */
  onObservation?: (observation: Observation) => void;
  /**
   * The examiner took the dual controls (F04-T03): the pedals answer to nobody and the car is braked to a stop. A
   * function is read before every simulation step, so a takeover decided in one step brakes from the next one.
   */
  halted?: boolean | (() => boolean);
  /** Told the keys in use when the view loads them and after every change, so a guide can name them. */
  onBindingsChange?: (bindings: Bindings) => void;
  /** Records assistance for this drive even if the primary pointer later changes. */
  onClutchAssistUsed?: () => void;
}

const defaultRendererFactory: RendererFactory = () => new THREE.WebGLRenderer({ antialias: true });
const EMPTY_COMMANDS: readonly PowertrainCommand[] = [];
const EMPTY_CABIN: readonly CockpitCommand[] = [];
const cabinOf = (commands: readonly CockpitCommand[]) => commands.reduce(commandCockpit, initialCockpit());
/** What the examiner's pedals press when they take over: the brake, and the clutch so a manual does not stall. */
const HALT_KEYS: ReadonlySet<string> = new Set([KEY_BINDINGS.brake[0], KEY_BINDINGS.clutch[0]]);

/** Gear changes are routine: the driver hears about everything else. */
const isNotable = (event: CarEvent) => event.type !== 'gear-engaged' && event.type !== 'key-inserted';

/**
 * Drives the car in a 3D view. Driving shortcuts work within the cockpit, except editable fields and native
 * button activation keys; the rest of the page keeps its keyboard. The simulation advances in fixed steps (FPS-independent) and the view interpolates between them.
 */
export function DrivingCanvas({
  world,
  start,
  transmission,
  label,
  subtitle = copy.subtitle,
  loadingText,
  unavailableText,
  createRenderer = defaultRendererFactory,
  createScene = createCockpitScene,
  onTelemetry,
  resetCount = 0,
  prepared = EMPTY_COMMANDS,
  preparedCabin = EMPTY_CABIN,
  onObservation,
  halted = false,
  onBindingsChange,
  onClutchAssistUsed,
}: DrivingCanvasProps) {
  const {
    session: audioRef,
    settings: audioSettings,
    status: audioStatus,
    storageError: audioStorageError,
    change: changeAudio,
  } = useDrivingAudio();
  const { session: mobileRef, snapshot: mobile } = useMobileDriving();
  const [mobilePedalResetCount, setMobilePedalResetCount] = useState(0);
  const directCommandsRef = useRef<PowertrainCommand[]>([]);
  const shellRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [displayError, setDisplayError] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);
  const containerRef = useRef<HTMLDivElement>(null);
  const heldRef = useRef(new HeldInput());
  useEffect(() => {
    // The modal must be unmounted before focus can return, including when fullscreen is unavailable.
    if (mobile?.started) containerRef.current?.focus();
  }, [mobile?.started]);
  useEffect(() => {
    if (mobile?.started && transmission === 'manual') onClutchAssistUsed?.();
  }, [mobile?.started, transmission, resetCount, onClutchAssistUsed]);
  useEffect(() => {
    const onFullscreen = () => {
      setFullscreen(document.fullscreenElement === shellRef.current);
      mobileRef.current?.fullscreen(document.fullscreenElement === shellRef.current);
      containerRef.current?.focus();
    };
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, [mobileRef]);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === shellRef.current) await document.exitFullscreen();
      else if (shellRef.current?.requestFullscreen) await shellRef.current.requestFullscreen();
      else throw new Error('Fullscreen is unavailable');
      setDisplayError(false);
    } catch {
      setDisplayError(true);
    }
  };
  const [cockpit, setCockpit] = useState(() => cabinOf(preparedCabin));
  const cockpitRef = useRef(cockpit);
  const [bindings, setBindings] = useState<Bindings>(() => {
    try {
      return parseBindings(localStorage.getItem(BINDINGS_STORAGE_KEY));
    } catch {
      return DEFAULT_BINDINGS;
    }
  });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    onBindingsChange?.(bindings);
  }, [bindings, onBindingsChange]);
  const [readout, setReadout] = useState({
    speed: 0,
    rpm: 0,
    gear: transmission === 'manual' ? 'N' : 'P',
    powertrain: initialPowertrain(transmission),
    lastEvent: null as CarEvent | null,
  });
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
    directCommandsRef.current.length = 0;
    mobileRef.current?.release();
    setMobilePedalResetCount((count) => count + 1);
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
        // A glance at a side mirror: a short turn of the head, which the exam counts as checking the mirror.
        case 'glanceLeft':
          command({ type: 'look', yaw: 0.5, pitch: 0 });
          break;
        case 'glanceRight':
          command({ type: 'look', yaw: -0.5, pitch: 0 });
          break;
        case 'belt':
        case 'hazards':
        case 'wipers':
        case 'door':
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
  const haltedRef = useRef(halted);
  const [state, setState] = useState<DrivingState>('loading');

  useEffect(() => {
    resetRef.current = resetCount;
    telemetryRef.current = onTelemetry;
    observationRef.current = onObservation;
    haltedRef.current = halted;
  }, [resetCount, onTelemetry, onObservation, halted]);

  useEffect(() => {
    const container = containerRef.current;
    const audioSession = audioRef.current;
    const mobileSession = mobileRef.current;
    if (!container) return;
    let renderer: SceneRenderer;
    try {
      renderer = createRenderer();
    } catch (error) {
      console.warn('WebGL renderer could not be created', error);
      const pending = requestAnimationFrame(() => setState('unavailable'));
      return () => cancelAnimationFrame(pending);
    }
    const track = createScene(world, EXAM_SPECS.vehicle);
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
      directCommandsRef.current.length = 0;
      mobileRef.current?.release();
      setMobilePedalResetCount((count) => count + 1);
      driving.pendingShift = null;
      driving.pendingAutomaticShift = null;
      dragRef.current = null;
      cockpitRef.current = commandCockpit(cockpitRef.current, { type: 'horn', value: false });
      setCockpit(cockpitRef.current);
    };
    window.addEventListener('blur', releaseKeys);
    document.addEventListener('visibilitychange', releaseKeys);

    const isHalted = () => {
      const halted = haltedRef.current;
      return typeof halted === 'function' ? halted() : halted;
    };
    const observeStep = (
      car: CarState,
      stepEvents: readonly CarEvent[],
      dt: number,
      scenario: TrafficSnapshot | null,
    ) => observationRef.current?.({ type: 'step', car, cockpit: cockpitRef.current, events: stepEvents, dt, scenario });
    const fresh = () => {
      const frame = startDriving(start, transmission, prepared, EXAM_SPECS, trafficOf(world));
      if (prepared.length > 0) observeStep(frame.stepper.state, frame.events, 0, frame.scenario);
      return frame;
    };
    // Each new loop is a new session (another seed, start, gearbox or preparation): it starts from the prepared cabin.
    // A seed change also bumps the reset counter, but `appliedReset` below already holds the new value.
    cockpitRef.current = cabinOf(preparedCabin);
    setCockpit(cockpitRef.current);
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
        // The cabin goes back first: `fresh` reports the prepared commands with the cabin of the new session.
        releaseKeys();
        cockpitRef.current = cabinOf(preparedCabin);
        setCockpit(cockpitRef.current);
        driving = fresh();
        audioSession?.reset();
        lastEvent = null;
      }
      let hornSampled = false;
      const pressed = pendingRef.current.splice(0);
      driving = driveFrame(
        world,
        driving,
        () => {
          const actions = heldRef.current.sample();
          hornSampled ||= actions.has('horn');
          // The dual controls: brake and clutch down, whatever the driver presses.
          if (isHalted()) return HALT_KEYS;
          return drivingKeys(actions);
        },
        isHalted() ? [] : pressed,
        frameS,
        EXAM_SPECS,
        observeStep,
        {
          frameEndMs: now,
          ...(mobileRef.current
            ? {
                continuous: (atMs: number) => mobileRef.current?.sample(atMs) ?? {},
                assistClutch: mobileRef.current.snapshot.started,
              }
            : {}),
          commands: directCommandsRef.current.splice(0),
          blocked: isHalted,
        },
      );
      startTransition(() => mobileRef.current?.update(now, driving.events));
      // Keep a short horn press visible for the frame that consumes it.
      const horn = hornSampled || heldRef.current.peek().has('horn');
      if (horn !== cockpitRef.current.horn) {
        cockpitRef.current = commandCockpit(cockpitRef.current, { type: 'horn', value: horn });
        setCockpit(cockpitRef.current);
      }
      const { stepper, events } = driving;
      const car = stepper.state;
      const rpm = radSToRpm(car.powertrain.engineRadS);
      audioSession?.update(car, cockpitRef.current, driving.scenario);
      track.setReducedMotion(reducedMotionRef.current);
      track.update(
        interpolateVehicle(stepper.previous.world.vehicle, car.world.vehicle, driving.alpha),
        cockpitRef.current,
        rpm,
        stepper.previous.world.timeS + (car.world.timeS - stepper.previous.world.timeS) * driving.alpha,
        driving.scenario,
      );
      renderer.render(track.scene, track.camera);
      container.dataset.speedKmh = (car.world.vehicle.speedMps * 3.6).toFixed(1);
      container.dataset.odometerM = car.world.vehicle.odometerM.toFixed(2);
      container.dataset.timeS = car.world.timeS.toFixed(4);
      container.dataset.rpm = rpm.toFixed(0);
      container.dataset.gear = gearLabel(car.powertrain);
      container.dataset.engine = car.powertrain.engineRunning ? 'running' : 'off';
      container.dataset.headingRad = car.world.vehicle.headingRad.toFixed(6);
      container.dataset.steer = driving.controls.steer.toFixed(4);
      const tiltStatus = mobileRef.current?.snapshot.status;
      const steeringHeld = heldRef.current.peek().has('left') || heldRef.current.peek().has('right');
      container.dataset.steeringSource =
        !steeringHeld && (tiltStatus === 'active' || tiltStatus === 'calibrating') ? 'tilt' : 'buttons';
      container.dataset.clutch = driving.controls.clutch.toFixed(4);
      container.dataset.brake = driving.controls.brake.toFixed(4);
      container.dataset.throttle = driving.controls.throttle.toFixed(4);
      container.dataset.handbrake = String(car.powertrain.handbrake);
      container.dataset.key = car.powertrain.key;
      container.dataset.positionX = car.world.vehicle.x.toFixed(2);
      container.dataset.positionZ = car.world.vehicle.z.toFixed(2);
      container.dataset.sectors = String(track.scene.userData.activeSectors ?? 0);
      container.dataset.actors = String(driving.scenario?.poses.filter((pose) => pose.active).length ?? 0);
      const notable = events.filter(isNotable).at(-1);
      if (notable) lastEvent = notable;
      sinceTelemetryS += frameS;
      if (notable || sinceTelemetryS >= TELEMETRY_INTERVAL_S) {
        sinceTelemetryS = 0;
        // Read-only observations for the development playtest driver. Production never publishes actor snapshots.
        if (import.meta.env.DEV && driving.scenario) {
          container.dataset.traffic = JSON.stringify({
            timeS: driving.scenario.timeS,
            light: driving.scenario.light,
            lights: driving.scenario.lights,
            poses: driving.scenario.poses,
            contacts: driving.scenario.contacts,
          });
        }
        // Readouts are low priority: as urgent updates, arriving every frame, they would keep interrupting a
        // navigation (React Router renders it in a transition) and the page could never leave the drive.
        startTransition(() => {
          setReadout({
            speed: Math.abs(car.world.vehicle.speedMps * 3.6),
            rpm,
            gear: gearLabel(car.powertrain),
            powertrain: car.powertrain,
            lastEvent,
          });
          telemetryRef.current?.({
            speedKmh: car.world.vehicle.speedMps * 3.6,
            odometerM: car.world.vehicle.odometerM,
            rpm,
            powertrain: car.powertrain,
            lastEvent,
          });
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
      mobileSession?.release();
      audioSession?.reset();
      track.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [createRenderer, createScene, world, start, transmission, prepared, preparedCabin, audioRef, mobileRef]);

  const isEditable = (target: EventTarget) =>
    target instanceof HTMLElement && Boolean(target.closest('input, select, textarea, [contenteditable="true"]'));
  const ownsShortcut = (event: KeyboardEvent<HTMLElement>) =>
    !isEditable(event.target) &&
    !(
      event.target instanceof HTMLElement &&
      event.target.closest('button, summary, a') &&
      (event.code === 'Space' || event.code === 'Enter')
    );
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (mobile && !mobile.started) return;
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || !ownsShortcut(event)) return;
    const action = actionForCode(bindings, event.code);
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) startAction(action, `key-${event.code}`);
  };

  return (
    <section
      ref={shellRef}
      className={`cockpit-shell${mobile ? ' cockpit-mobile' : ''}`}
      aria-label={copy.title}
      onKeyDown={onKeyDown}
      onKeyUp={(event) => {
        if (ownsShortcut(event) && actionForCode(bindings, event.code)) event.preventDefault();
        stopAction(`key-${event.code}`);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) release();
      }}
      onFocusCapture={(event) => {
        if (isEditable(event.target)) release();
      }}
      onClickCapture={() => void audioRef.current?.unlock()}
      onPointerDownCapture={() => void audioRef.current?.unlock()}
      onKeyDownCapture={() => void audioRef.current?.unlock()}
    >
      {mobile && !mobile.started && state === 'ready' && (
        <MobileIntro
          start={(buttons) => {
            if (buttons) mobileRef.current?.change({ ...mobile.settings, tiltEnabled: false });
            mobileRef.current?.start();
            void toggleFullscreen();
            containerRef.current?.focus();
          }}
        />
      )}
      <div className="cockpit-heading">
        <span>{subtitle}</span>
        <strong>{cockpit.belt ? copy.beltOn : copy.beltOff}</strong>
      </div>
      <div className="cockpit-view-options">
        <p className="cockpit-help">{copy.help}</p>
        <button type="button" onClick={() => containerRef.current?.focus()}>
          {copy.focusDriving}
        </button>
        <button type="button" onClick={() => void toggleFullscreen()} aria-pressed={fullscreen}>
          {fullscreen ? copy.exitFullscreen : copy.fullscreen}
        </button>
      </div>
      {mobile?.started && <MobileNotice snapshot={mobile} />}
      <div className="cockpit-audio" role="group" aria-label={AUDIO_COPY.title}>
        <button
          type="button"
          aria-pressed={audioSettings.muted}
          onClick={() => changeAudio({ ...audioSettings, muted: !audioSettings.muted })}
        >
          {audioSettings.muted ? AUDIO_COPY.unmute : AUDIO_COPY.mute}
        </button>
        <label>
          {AUDIO_COPY.volume}
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={Math.round(audioSettings.volume * 100)}
            onChange={(event) => changeAudio({ ...audioSettings, volume: Number(event.target.value) / 100 })}
          />
        </label>
        <span role="status">{audioSettings.muted ? AUDIO_COPY.muted : AUDIO_COPY[audioStatus]}</span>
        {audioStorageError && <span role="status">{AUDIO_COPY.storageError}</span>}
      </div>
      {displayError && (
        <p className="cockpit-help" role="status">
          {copy.fullscreenUnavailable}
        </p>
      )}
      <div className="cockpit-viewport">
        {state === 'ready' && mobile?.started && (
          <MobileOverlay
            key={`${transmission}:${resetCount}`}
            automatic={transmission === 'automatic'}
            gear={transmission === 'automatic' ? readout.powertrain.lever : readout.gear}
            tiltActive={mobile.status === 'active' || mobile.status === 'calibrating'}
            recenter={mobile.settings.tiltEnabled ? () => mobileRef.current?.recenter() : undefined}
            send={(reading) => mobileRef.current?.pedals(reading)}
            shift={(command) => directCommandsRef.current.push(command)}
            start={startAction}
            stop={stopAction}
            pedalResetCount={mobilePedalResetCount}
          />
        )}
        <div
          className="scene-canvas driving-canvas"
          ref={containerRef}
          data-state={state}
          data-testid="driving-canvas"
          data-look-yaw={cockpit.lookYaw}
          tabIndex={0}
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
        <div className="cockpit-help cockpit-status">
          <p data-testid="driving-status">
            {TRACK_COPY.engine}: {readout.powertrain.engineRunning ? copy.engineRunning : TRACK_COPY.engineOff}
            {' · '}
            {TRACK_COPY.key}: {TRACK_COPY.keyStates[readout.powertrain.key]}
            {' · '}
            {TRACK_COPY.handbrake}: {readout.powertrain.handbrake ? TRACK_COPY.handbrakeOn : TRACK_COPY.handbrakeOff}
          </p>
          <p role="status" data-testid="driving-feedback">
            {readout.lastEvent ? describeEvent(readout.lastEvent, transmission) : ''}
          </p>
        </div>
      )}
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
          mobile={mobile !== null}
          mobileSettings={
            mobile ? (
              <MobileSettingsPanel snapshot={mobile} change={(settings) => mobileRef.current?.change(settings)} />
            ) : null
          }
          automatic={transmission === 'automatic'}
        />
      )}
    </section>
  );
}
