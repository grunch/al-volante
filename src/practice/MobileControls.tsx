import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { MOBILE_COPY as copy } from '../i18n/es-AR.ts';
import type { PowertrainCommand } from '../sim/powertrain/powertrain.ts';
import type { Action } from './bindings.ts';
import { CommandButton, HoldButton } from './CockpitControls.tsx';
import { pedalsAt } from './continuousInput.ts';
import type { PedalReading } from './continuousInput.ts';
import type { MobileSnapshot } from './mobileSession.ts';
import type { MobileSettings } from './mobileDriving.ts';

export function MobileIntro({ start }: { start: (buttons: boolean) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    dialog.current?.showModal?.();
    button.current?.focus();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="mobile-intro"
      aria-labelledby="mobile-intro-title"
      onCancel={(event) => event.preventDefault()}
    >
      <h2 id="mobile-intro-title">{copy.title}</h2>
      <p>{copy.intro}</p>
      <button ref={button} type="button" onClick={() => start(false)}>
        {copy.start}
      </button>
      <button type="button" onClick={() => start(true)}>
        {copy.buttons}
      </button>
    </dialog>
  );
}

export function PedalStrip({ send }: { send: (reading: PedalReading) => void }) {
  const pointers = useRef(new Map<number, number>());
  const [level, setLevel] = useState(0);
  const sendPosition = (position: number | null, atMs: number) => {
    const pedals = position === null ? { throttle: 0, brake: 0 } : pedalsAt(position);
    setLevel(pedals.throttle - pedals.brake);
    send({ atMs, ...pedals });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = (event.clientY - bounds.top) / bounds.height;
    pointers.current.delete(event.pointerId);
    pointers.current.set(event.pointerId, position);
    sendPosition(position, event.timeStamp);
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.delete(event.pointerId)) return;
    sendPosition([...pointers.current.values()].at(-1) ?? null, event.timeStamp);
  };
  useEffect(() => {
    const clear = () => {
      pointers.current.clear();
      setLevel(0);
    };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', clear);
    };
  }, []);
  return (
    <div
      className="mobile-pedals"
      data-testid="mobile-pedals"
      role="group"
      aria-label={copy.pedals}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => {
        if (pointers.current.has(event.pointerId)) move(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <span>{copy.throttle}</span>
      <span
        className="mobile-pedal-level"
        aria-hidden="true"
        style={{ height: `${Math.abs(level) * 42.5}%`, top: level > 0 ? `${42.5 - level * 42.5}%` : '57.5%' }}
      />
      <span className="mobile-pedal-neutral" aria-hidden="true" />
      <span>{copy.brake}</span>
    </div>
  );
}

export function MobileOverlay({
  automatic,
  gear,
  tiltActive,
  recenter,
  send,
  shift,
  start,
  stop,
}: {
  automatic: boolean;
  gear: string;
  tiltActive: boolean;
  recenter?: (() => void) | undefined;
  send: (reading: PedalReading) => void;
  shift: (command: PowertrainCommand) => void;
  start: (action: Action, source: string) => void;
  stop: (source: string) => void;
}) {
  const positions = automatic ? (['P', 'R', 'N', 'D'] as const) : (['1', '3', '5', 'N', '2', '4', 'R'] as const);
  return (
    <div className="mobile-overlay" data-testid="mobile-overlay">
      <PedalStrip send={send} />
      {recenter && (
        <button type="button" className="mobile-recenter" onClick={recenter}>
          {copy.recenter}
        </button>
      )}
      <div className="mobile-right-controls">
        <div
          className={`mobile-gears ${automatic ? 'mobile-gears-auto' : 'mobile-gears-manual'}`}
          role="group"
          aria-label={copy.gears}
        >
          {positions.map((to) => (
            <CommandButton
              key={to}
              className={to === 'N' ? 'mobile-neutral' : ''}
              aria-label={copy.gear(to)}
              aria-pressed={gear === to}
              activate={() => shift({ type: 'shift', to })}
            >
              {to}
            </CommandButton>
          ))}
        </div>
        {!tiltActive && (
          <div className="mobile-steering" role="group" aria-label={copy.steering}>
            <HoldButton action="left" start={start} stop={stop}>
              ←
            </HoldButton>
            <HoldButton action="right" start={start} stop={stop}>
              →
            </HoldButton>
          </div>
        )}
      </div>
    </div>
  );
}

export function MobileSettingsPanel({
  snapshot,
  change,
}: {
  snapshot: MobileSnapshot;
  change: (settings: MobileSettings) => void;
}) {
  const { settings } = snapshot;
  return (
    <details className="mobile-settings">
      <summary>{copy.settings}</summary>
      <label>
        <input
          type="checkbox"
          checked={settings.tiltEnabled}
          onChange={(event) => change({ ...settings, tiltEnabled: event.target.checked })}
        />
        {copy.tiltEnabled}
      </label>
      <label>
        {copy.sensitivity}: {settings.fullLockDeg}°
        <input
          type="range"
          min="45"
          max="90"
          step="1"
          value={settings.fullLockDeg}
          onChange={(event) => change({ ...settings, fullLockDeg: Number(event.target.value) })}
        />
      </label>
      <p>{copy.sensitivityHint}</p>
      <label>
        <input
          type="checkbox"
          checked={settings.vibration}
          disabled={!snapshot.vibrationAvailable}
          onChange={(event) => change({ ...settings, vibration: event.target.checked })}
        />
        {copy.vibration}
      </label>
      {!snapshot.vibrationAvailable && <p>{copy.vibrationUnavailable}</p>}
      <p>{copy.approximation}</p>
      <p>{copy.clutchHelp}</p>
      {snapshot.storageError && <p role="status">{copy.storageError}</p>}
    </details>
  );
}

export function MobileNotice({ snapshot }: { snapshot: MobileSnapshot }) {
  const status = snapshot.status;
  return (
    <div className="mobile-notices" role="status">
      <span className="mobile-portrait-notice">{copy.portrait}</span>
      <span>
        {status === 'flat'
          ? copy.flat
          : status === 'calibrating'
            ? copy.calibrating
            : status === 'stale' || status === 'unavailable'
              ? copy.unavailable
              : status === 'waiting'
                ? copy.waiting
                : ''}
      </span>
      {snapshot.wakeError && <span>{copy.wakeError}</span>}
    </div>
  );
}
