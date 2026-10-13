import { Suspense, lazy, useContext, useState } from 'react';
import { gearLabel } from '../../practice/telemetry.ts';
import type { Telemetry } from '../../practice/telemetry.ts';
import { RendererContext } from '../../scene/RendererContext.ts';
import type { CarEvent } from '../../sim/car.ts';
import { initialPowertrain } from '../../sim/powertrain/powertrain.ts';
import type { TransmissionKind } from '../../sim/powertrain/powertrain.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../../sim/tracks/practiceYard.ts';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { TRACK_COPY, formatNumber } from '../../i18n/es-AR.ts';

// Three.js stays in its own chunk, as on the home page.
const DrivingCanvas = lazy(() =>
  import('../../practice/DrivingCanvas.tsx').then((module) => ({ default: module.DrivingCanvas })),
);

const still = (kind: TransmissionKind): Telemetry => ({
  speedKmh: 0,
  odometerM: 0,
  rpm: 0,
  powertrain: initialPowertrain(kind),
  lastEvent: null,
});

/** Plain-language feedback for each simulation event. */
export function describeEvent(event: CarEvent, kind: TransmissionKind): string {
  const events = TRACK_COPY.events;
  switch (event.type) {
    case 'contact':
      return TRACK_COPY.contact(TRACK_COPY.obstacleNames[event.kind]);
    case 'start-refused':
      if (event.reason === 'key') return events.startKey;
      if (event.reason === 'running') return events.startRunning;
      return kind === 'manual' ? events.startInGearManual : events.startInGearAutomatic;
    case 'shift-refused': {
      const refusals: Record<typeof event.reason, string> = {
        clutch: events.shiftClutch,
        brake: events.shiftBrake,
        moving: events.shiftMoving,
        invalid: events.shiftInvalid,
      };
      return refusals[event.reason];
    }
    case 'handbrake':
      return event.engaged ? events.handbrakeOn : events.handbrakeOff;
    case 'engine-started':
    case 'engine-stopped':
    case 'stall':
    case 'moved-with-handbrake':
    case 'key-removed':
    case 'key-refused':
      return events[event.type];
    default:
      return '';
  }
}

/** Practice yard: drives the simulation (F03-T01) with the gearbox, key and handbrake (F03-T02). */
export function TrackPage() {
  const createRenderer = useContext(RendererContext);
  const [transmission, setTransmission] = useState<TransmissionKind>('manual');
  const [telemetry, setTelemetry] = useState<Telemetry>(still('manual'));
  const [resetCount, setResetCount] = useState(0);
  const choose = (kind: TransmissionKind) => {
    setTransmission(kind);
    setTelemetry(still(kind));
  };
  const reset = () => {
    setTelemetry(still(transmission));
    setResetCount((count) => count + 1);
  };
  const { powertrain } = telemetry;
  return (
    <>
      <PageTitle>{TRACK_COPY.heading}</PageTitle>
      <p className="lead">{TRACK_COPY.intro}</p>
      <fieldset className="choice">
        <legend>{TRACK_COPY.transmission}</legend>
        {(['manual', 'automatic'] as const).map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="transmission"
              value={kind}
              checked={transmission === kind}
              onChange={() => choose(kind)}
            />{' '}
            {TRACK_COPY[kind]}
          </label>
        ))}
      </fieldset>
      <h2>{TRACK_COPY.controlsHeading}</h2>
      <ul>
        {[...TRACK_COPY.controls.common, ...TRACK_COPY.controls[transmission]].map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Suspense fallback={<p className="scene-canvas__status">{TRACK_COPY.loading}</p>}>
        <DrivingCanvas
          key={transmission}
          world={PRACTICE_YARD}
          start={PRACTICE_YARD_START}
          transmission={transmission}
          label={TRACK_COPY.canvasLabel}
          loadingText={TRACK_COPY.loading}
          unavailableText={TRACK_COPY.unavailable}
          onTelemetry={setTelemetry}
          resetCount={resetCount}
          {...(createRenderer ? { createRenderer } : {})}
        />
      </Suspense>
      <dl className="hud">
        <div>
          <dt>{TRACK_COPY.speed}</dt>
          <dd>{formatNumber(Math.abs(telemetry.speedKmh), 0)} km/h</dd>
        </div>
        <div>
          <dt>{TRACK_COPY.distance}</dt>
          <dd>{formatNumber(telemetry.odometerM, 1)} m</dd>
        </div>
        <div>
          <dt>{TRACK_COPY.engine}</dt>
          <dd>{powertrain.engineRunning ? `${formatNumber(telemetry.rpm, 0)} rpm` : TRACK_COPY.engineOff}</dd>
        </div>
        <div>
          <dt>{TRACK_COPY.gear}</dt>
          <dd>{gearLabel(powertrain)}</dd>
        </div>
        <div>
          <dt>{TRACK_COPY.handbrake}</dt>
          <dd>{powertrain.handbrake ? TRACK_COPY.handbrakeOn : TRACK_COPY.handbrakeOff}</dd>
        </div>
        <div>
          <dt>{TRACK_COPY.key}</dt>
          <dd>{TRACK_COPY.keyStates[powertrain.key]}</dd>
        </div>
      </dl>
      <p role="status">{telemetry.lastEvent ? describeEvent(telemetry.lastEvent, transmission) : ''}</p>
      <p>
        <button type="button" className="button" onClick={reset}>
          {TRACK_COPY.reset}
        </button>
      </p>
    </>
  );
}
