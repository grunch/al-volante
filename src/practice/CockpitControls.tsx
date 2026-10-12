import { useState } from 'react';
import type { Action, Bindings } from './bindings.ts';
import { ACTIONS } from './bindings.ts';
import type { Adjustment, CockpitCommand, CockpitState, Toggle } from './cockpit.ts';
import { MIRROR_IDS } from './cockpit.ts';
import { COCKPIT_COPY as copy } from '../i18n/es-AR.ts';

interface Props {
  state: CockpitState;
  command: (command: CockpitCommand) => void;
  start: (action: Action, source: string) => void;
  stop: (source: string) => void;
  bindings: Bindings;
  bind: (action: Action, code: string) => boolean;
  restore: () => void;
  storageError: boolean;
  automatic: boolean;
}

/** Pointer capture keeps pedals reliable while a finger slides outside the button. */
function HoldButton({ action, start, stop }: Pick<Props, 'start' | 'stop'> & { action: Action }) {
  return (
    <button
      type="button"
      className="cockpit-hold"
      onClick={(event) => {
        // Semantic activations have no pointer sequence. Pointer clicks already use the hold handlers.
        if (event.detail !== 0) return;
        const source = `click-${action}`;
        start(action, source);
        stop(source);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        start(action, `pointer-${event.pointerId}`);
      }}
      onPointerUp={(event) => stop(`pointer-${event.pointerId}`)}
      onPointerCancel={(event) => stop(`pointer-${event.pointerId}`)}
      onLostPointerCapture={(event) => stop(`pointer-${event.pointerId}`)}
      onKeyDown={(event) => {
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          if (!event.repeat) start(action, `button-${action}`);
        }
      }}
      onKeyUp={(event) => {
        if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault();
          stop(`button-${action}`);
        }
      }}
      onBlur={() => stop(`button-${action}`)}
    >
      {copy.actions[action]}
    </button>
  );
}

export function CockpitControls({
  state,
  command,
  start,
  stop,
  bindings,
  bind,
  restore,
  storageError,
  automatic,
}: Props) {
  const [capture, setCapture] = useState<Action | null>(null);
  const [conflict, setConflict] = useState(false);
  const invoke = (action: Action) => {
    start(action, 'command');
    stop('command');
  };
  return (
    <div className="cockpit-controls">
      <div className="cockpit-drive-row" role="group" aria-label={copy.pedals}>
        {(['left', 'right', 'brake', 'throttle', ...(!automatic ? ['clutch' as const] : [])] as Action[]).map(
          (action) => (
            <HoldButton key={action} action={action} start={start} stop={stop} />
          ),
        )}
        {(['key', 'handbrake', 'gearDown', 'gearUp'] as const).map((action) => (
          <button type="button" key={action} onClick={() => invoke(action)}>
            {copy.actions[action]}
          </button>
        ))}
      </div>
      <div className="cockpit-look-row" role="group" aria-label={copy.look}>
        {(['glanceLeft', 'lookLeft', 'lookCenter', 'lookRight', 'glanceRight', 'lookBack'] as const).map((action) => (
          <button type="button" key={action} onClick={() => invoke(action)}>
            {copy.actions[action]}
          </button>
        ))}
      </div>
      <div className="cockpit-panels">
        <details open>
          <summary>{copy.instruments}</summary>
          <div className="cockpit-switches">
            {(Object.keys(copy.toggles) as Toggle[]).map((control) => (
              <button
                type="button"
                key={control}
                aria-pressed={state[control]}
                onClick={() => command({ type: 'toggle', control })}
              >
                {copy.toggles[control]}
                <span>{state[control] ? copy.on : copy.off}</span>
              </button>
            ))}
            {(['left', 'right'] as const).map((value) => (
              <button
                type="button"
                key={value}
                aria-pressed={state.signal === value}
                onClick={() => command({ type: 'signal', value: state.signal === value ? 'off' : value })}
              >
                {copy.actions[value === 'left' ? 'signalLeft' : 'signalRight']}
              </button>
            ))}
            <HoldButton action="horn" start={start} stop={stop} />
          </div>
          <label className="cockpit-select">
            {copy.lights}
            <select
              value={state.lights}
              onChange={(event) => command({ type: 'lights', value: event.target.value as CockpitState['lights'] })}
            >
              {(Object.keys(copy.lightNames) as CockpitState['lights'][]).map((value) => (
                <option key={value} value={value}>
                  {copy.lightNames[value]}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">{copy.climateNote}</p>
          {state.horn && <p role="status">{copy.hornActive}</p>}
        </details>
        <details>
          <summary>{copy.setup}</summary>
          <p>{copy.preparation}</p>
          <p>
            <a href="#/biblioteca/protocolo/9">{copy.preparationSource}</a>
          </p>
          <p>
            <a href="#/biblioteca/protocolo/20">{copy.postureSource}</a>
          </p>
          {(['seatDistance', 'seatHeight', 'headrest'] as Adjustment[]).map((control) => (
            <label className="cockpit-range" key={control}>
              {copy[control]}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={state[control]}
                onChange={(event) => command({ type: 'adjust', control, value: Number(event.target.value) })}
              />
            </label>
          ))}
          <h3>{copy.mirrors}</h3>
          {MIRROR_IDS.map((mirror) => (
            <fieldset key={mirror}>
              <legend>{copy.mirrorNames[mirror]}</legend>
              {(['yaw', 'pitch'] as const).map((axis) => (
                <label className="cockpit-range" key={axis}>
                  {axis === 'yaw' ? copy.horizontal : copy.vertical}
                  <input
                    aria-label={`${copy.mirrorNames[mirror]}: ${axis === 'yaw' ? copy.horizontal : copy.vertical}`}
                    type="range"
                    min="-0.45"
                    max="0.45"
                    step="0.01"
                    value={state.mirrors[mirror][axis]}
                    onChange={(event) => command({ type: 'mirror', mirror, axis, value: Number(event.target.value) })}
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </details>
        <details>
          <summary>{copy.bindings}</summary>
          <p>{copy.bindingHelp}</p>
          <div className="cockpit-binding-grid">
            {ACTIONS.map((action) => (
              <button
                type="button"
                key={action}
                onClick={() => {
                  setCapture(action);
                  setConflict(false);
                }}
                onBlur={() => setCapture(null)}
                onKeyDown={(event) => {
                  if (capture !== action) return;
                  if (event.code === 'Tab') {
                    setCapture(null);
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.code === 'Escape') {
                    setCapture(null);
                    return;
                  }
                  if (event.ctrlKey || event.metaKey || event.altKey || !bind(action, event.code)) setConflict(true);
                  else {
                    setCapture(null);
                    setConflict(false);
                  }
                }}
              >
                {copy.actions[action]}
                <kbd>{capture === action ? copy.waiting : bindings[action].join(' / ')}</kbd>
              </button>
            ))}
          </div>
          <p role="status">{conflict ? copy.conflict : storageError ? copy.storageError : ''}</p>
          <button type="button" onClick={restore}>
            {copy.restore}
          </button>
        </details>
      </div>
    </div>
  );
}
