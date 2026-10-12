import '../../city/city.css';
import { lazy, Suspense, useContext, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { Route } from '../../content/schemas.ts';
import { buildCity } from '../../city/model.ts';
import { RouteMap } from '../../city/RouteMap.tsx';
import { RendererContext } from '../../scene/RendererContext.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { CITY_COPY as copy, TRACK_COPY, formatNumber } from '../../i18n/es-AR.ts';
import type { TransmissionKind } from '../../sim/powertrain/powertrain.ts';

const CityPreview = lazy(() =>
  import('../../city/CityPreview.tsx').then((module) => ({ default: module.CityPreview })),
);
const CityDrive = lazy(() => import('../../city/CityDrive.tsx').then((module) => ({ default: module.CityDrive })));

/** Seed 1 is the documented default scenario; any non-negative integer replays its own traffic. */
const DEFAULT_SEED = 1;
const MAX_SEED = 999999;

function CityExplorer({ route }: { route: Route }) {
  const city = useMemo(() => buildCity(route), [route]);
  const createRenderer = useContext(RendererContext);
  const [leg, setLeg] = useState(1);
  const [mode, setMode] = useState<'overview' | 'drive'>('overview');
  const [whole, setWhole] = useState(false);
  const [transmission, setTransmission] = useState<TransmissionKind>('automatic');
  const [resetCount, setResetCount] = useState(0);
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const selected = city.legs.find((item) => item.number === leg);
  return (
    <>
      <div className="city-layout">
        <aside className="city-sidebar" aria-label={copy.route}>
          <RouteMap city={city} selected={leg} />
          <dl className="city-stats">
            <div>
              <dt>{copy.length}</dt>
              <dd>{formatNumber(route.loopLengthM, 0)} m</dd>
            </div>
            <div>
              <dt>{copy.legs}</dt>
              <dd>{city.legs.length}</dd>
            </div>
          </dl>
          <label htmlFor="city-leg">{copy.selectLeg}</label>
          <select id="city-leg" value={leg} onChange={(event) => setLeg(Number(event.target.value))}>
            {city.legs.map((item) => (
              <option key={item.number} value={item.number}>
                {copy.leg(item.number, item.street)}
              </option>
            ))}
          </select>
          <p>{selected?.turn === 'left' ? copy.nextLeft : copy.nextRight}</p>
          <label htmlFor="city-seed">{copy.seed}</label>
          <input
            id="city-seed"
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_SEED}
            step={1}
            value={seed}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (Number.isInteger(value) && value >= 0 && value <= MAX_SEED) setSeed(value);
            }}
          />
          <p className="city-hint">{copy.seedHelp}</p>
          <fieldset className="choice">
            <legend>{TRACK_COPY.transmission}</legend>
            {(['automatic', 'manual'] as const).map((kind) => (
              <label key={kind}>
                <input
                  type="radio"
                  name="city-transmission"
                  checked={transmission === kind}
                  onChange={() => setTransmission(kind)}
                />{' '}
                {TRACK_COPY[kind]}
              </label>
            ))}
          </fieldset>
        </aside>
        <section className="city-stage" aria-label={copy.canvasLabel}>
          <div className="city-actions">
            <button className="button" aria-pressed={mode === 'overview'} onClick={() => setMode('overview')}>
              {copy.overview}
            </button>
            <button className="button" aria-pressed={mode === 'drive'} onClick={() => setMode('drive')}>
              {copy.drive}
            </button>
            {mode === 'overview' ? (
              <button className="button button--secondary" onClick={() => setWhole((value) => !value)}>
                {whole ? copy.block : copy.whole}
              </button>
            ) : (
              <button className="button button--secondary" onClick={() => setResetCount((value) => value + 1)}>
                {copy.reset}
              </button>
            )}
          </div>
          <Suspense fallback={<p role="status">{copy.loading}</p>}>
            {mode === 'overview' ? (
              <CityPreview
                key={`${leg}-${whole}`}
                city={city}
                leg={leg}
                whole={whole}
                createRenderer={createRenderer}
              />
            ) : (
              <CityDrive
                key={`${leg}-${transmission}`}
                city={city}
                leg={leg}
                transmission={transmission}
                resetCount={resetCount}
                seed={seed}
                createRenderer={createRenderer}
              />
            )}
          </Suspense>
        </section>
      </div>
      <p className="city-notice">{copy.scope}</p>
      <details className="city-sources">
        <summary>{copy.sources}</summary>
        <p>{copy.approximation}</p>
        <p>{copy.pending}</p>
        <p>
          <Link to="/biblioteca/recorridos/16">{copy.official}</Link> ·{' '}
          <Link to="/biblioteca/protocolo/39">{copy.protocol}</Link>
        </p>
        <ul>
          {city.controls
            .filter((control) => control.road.leg === leg)
            .map((control) => (
              <li key={control.id}>
                {copy.controlNames[control.type]} · {copy.statusNames[control.status]}
              </li>
            ))}
        </ul>
      </details>
      <p className="city-attribution">
        {copy.attribution} <a href="https://www.openstreetmap.org/copyright">{copy.sourceMap}</a> ·{' '}
        <a href={route.sources.gcba.dataset}>{copy.sourceSignals}</a>
      </p>
    </>
  );
}

export function CityPage() {
  return (
    <>
      <p className="city-eyebrow">{copy.eyebrow}</p>
      <PageTitle>{copy.heading}</PageTitle>
      <p className="lead">{copy.intro}</p>
      <ContentGate>{(content) => <CityExplorer route={content.route} />}</ContentGate>
    </>
  );
}
