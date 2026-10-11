import { Suspense, lazy, useContext, useState } from 'react';
import type { Telemetry } from '../../practice/DrivingCanvas.tsx';
import { RendererContext } from '../../scene/RendererContext.ts';
import { PRACTICE_YARD, PRACTICE_YARD_START } from '../../sim/tracks/practiceYard.ts';
import { EXAM_CAR } from '../../sim/vehicle.ts';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { TRACK_COPY, formatNumber } from '../../i18n/es-AR.ts';

// Three.js stays in its own chunk, as on the home page.
const DrivingCanvas = lazy(() =>
  import('../../practice/DrivingCanvas.tsx').then((module) => ({ default: module.DrivingCanvas })),
);

const STILL: Telemetry = { speedKmh: 0, odometerM: 0, reverse: false, contact: null };

/** Practice yard: tries the driving simulation (F03-T01) before the cabin and gearbox arrive. */
export function TrackPage() {
  const createRenderer = useContext(RendererContext);
  const [telemetry, setTelemetry] = useState<Telemetry>(STILL);
  const [resetCount, setResetCount] = useState(0);
  const reset = () => {
    setTelemetry(STILL);
    setResetCount((count) => count + 1);
  };
  return (
    <>
      <PageTitle>{TRACK_COPY.heading}</PageTitle>
      <p className="lead">{TRACK_COPY.intro}</p>
      <h2>{TRACK_COPY.controlsHeading}</h2>
      <ul>
        {TRACK_COPY.controls.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <Suspense fallback={<p className="scene-canvas__status">{TRACK_COPY.loading}</p>}>
        <DrivingCanvas
          world={PRACTICE_YARD}
          spec={EXAM_CAR}
          start={PRACTICE_YARD_START}
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
          <dt>{TRACK_COPY.direction}</dt>
          <dd>{telemetry.reverse ? TRACK_COPY.backward : TRACK_COPY.forward}</dd>
        </div>
      </dl>
      <p role="status">
        {telemetry.contact ? TRACK_COPY.contact(TRACK_COPY.obstacleNames[telemetry.contact.kind]) : ''}
      </p>
      <p>
        <button type="button" className="button" onClick={reset}>
          {TRACK_COPY.reset}
        </button>
      </p>
    </>
  );
}
