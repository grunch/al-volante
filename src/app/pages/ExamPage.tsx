import { Suspense, lazy, useCallback, useContext, useRef, useState } from 'react';
import type { Rule } from '../../content/schemas.ts';
import type { Content } from '../../content/validate.ts';
import { resultOf } from '../../exam/scoring.ts';
import { EXAM_START, createSession, observe } from '../../exam/session.ts';
import type { Observation, Session } from '../../exam/session.ts';
import { RendererContext } from '../../scene/RendererContext.ts';
import type { PowertrainCommand, TransmissionKind } from '../../sim/powertrain/powertrain.ts';
import { PRACTICE_YARD } from '../../sim/tracks/practiceYard.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { EXAM_COPY as copy, formatNumber } from '../../i18n/es-AR.ts';

// Three.js stays in its own chunk, as on the home page.
const DrivingCanvas = lazy(() =>
  import('../../practice/DrivingCanvas.tsx').then((module) => ({ default: module.DrivingCanvas })),
);

/** Stage I starts with the key in contact and the engine off (protocolo PDF 9). */
const EXAM_PREPARED: readonly PowertrainCommand[] = [{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }];
const DEFAULT_SEED = 1;

function examinerSays(session: Session, kind: TransmissionKind): string {
  const { prompt } = session;
  if (prompt.kind === 'recognise') {
    const text = copy.prompts[prompt.target as keyof typeof copy.prompts] ?? prompt.target;
    if (!prompt.target.startsWith('gear-')) return text;
    return `${text} ${kind === 'manual' ? copy.gearHintManual : copy.gearHintAutomatic}`;
  }
  const detail =
    prompt.message === 'reverse' || prompt.message === 'forward'
      ? ` ${copy.phases[`${prompt.message}${kind === 'manual' ? 'Manual' : 'Automatic'}`]}`
      : '';
  return `${copy.phases[prompt.message]}${detail}`;
}

function FaultList({ session, rules }: { session: Session; rules: readonly Rule[] }) {
  const { faults } = session.ledger;
  if (faults.length === 0) return <p>{copy.noFaults}</p>;
  return (
    <ol className="exam-faults">
      {faults.map((fault, index) => {
        const rule = rules.find((candidate) => candidate.id === fault.ruleId);
        const text = rule?.fichaRows[0]?.text ?? fault.ruleId;
        return (
          <li key={`${fault.ruleId}-${index}`}>
            <strong>{copy.faultPoints(fault.points)}</strong> · {text}
            {rule && <small> ({copy.repetition[rule.repetition]})</small>}
            {fault.escalated && <small> ({copy.escalated})</small>}
          </li>
        );
      })}
    </ol>
  );
}

function Exam({ content }: { content: Content }) {
  const rules = content.rules.rules;
  const createRenderer = useContext(RendererContext);
  const [transmission, setTransmission] = useState<TransmissionKind>('manual');
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [resetCount, setResetCount] = useState(0);
  const [session, setSession] = useState<Session>(() => createSession(rules, 'manual', DEFAULT_SEED));
  // The latest session, updated 120 times a second by the steps without re-rendering each time.
  const sessionRef = useRef<Session>(session);

  const begin = (kind: TransmissionKind, nextSeed: number) => {
    sessionRef.current = createSession(rules, kind, nextSeed);
    setSession(sessionRef.current);
    setTransmission(kind);
    setSeed(nextSeed);
    setResetCount((count) => count + 1);
  };
  const onObservation = useCallback((observation: Observation) => {
    const before = sessionRef.current.phase;
    sessionRef.current = observe(sessionRef.current, observation);
    // The recognition starts as stage I requires: engine off, key in contact, car in the box (protocolo PDF 9).
    if (before === 'familiarisation' && sessionRef.current.phase === 'recognition') setResetCount((count) => count + 1);
    // Steps come 120 times a second: the page refreshes with the telemetry; commands refresh at once.
    if (observation.type !== 'step') setSession(sessionRef.current);
  }, []);
  const onTelemetry = useCallback(() => setSession(sessionRef.current), []);

  const { ledger } = session;
  const finished = session.phase === 'finished';
  const result = finished ? resultOf(ledger, session.completedStages) : null;
  const cm = (value: number | null) => (value === null ? copy.pendingMeasure : `${formatNumber(value, 0)} cm`);
  return (
    <>
      <fieldset className="choice">
        <legend>{copy.transmission}</legend>
        {(['manual', 'automatic'] as const).map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="exam-transmission"
              value={kind}
              checked={transmission === kind}
              onChange={() => begin(kind, seed)}
            />{' '}
            {copy[kind]}
          </label>
        ))}
        <label>
          {copy.seed}{' '}
          <input
            type="number"
            min={1}
            value={seed}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(next) && next > 0) begin(transmission, next);
            }}
          />
        </label>
      </fieldset>
      <section className="exam-examiner" aria-live="polite">
        <h2>{copy.examiner}</h2>
        <p data-testid="examiner-says" data-phase={session.phase}>
          {examinerSays(session, transmission)}
        </p>
        <p>
          {(session.phase === 'familiarisation' || session.phase === 'preparation') && (
            <button type="button" className="button" onClick={() => onObservation({ type: 'ready' })}>
              {copy.ready}
            </button>
          )}{' '}
          {!finished && (
            <button
              type="button"
              className="button button--secondary"
              onClick={() => onObservation({ type: 'request-stop' })}
            >
              {copy.requestStop}
            </button>
          )}{' '}
          <button type="button" className="button button--secondary" onClick={() => begin(transmission, seed)}>
            {copy.restart}
          </button>
        </p>
      </section>
      <Suspense fallback={<p className="scene-canvas__status">{copy.loading}</p>}>
        <DrivingCanvas
          key={transmission}
          world={PRACTICE_YARD}
          start={EXAM_START}
          transmission={transmission}
          label={copy.canvasLabel}
          loadingText={copy.loading}
          unavailableText={copy.unavailable}
          prepared={EXAM_PREPARED}
          resetCount={resetCount}
          onObservation={onObservation}
          onTelemetry={onTelemetry}
          {...(createRenderer ? { createRenderer } : {})}
        />
      </Suspense>
      <dl className="hud">
        <div>
          <dt>{copy.points}</dt>
          <dd data-testid="exam-points">{ledger.points}</dd>
        </div>
        <div>
          <dt>{copy.reverseCm}</dt>
          <dd>{cm(session.measurements.reverseCm)}</dd>
        </div>
        <div>
          <dt>{copy.forwardCm}</dt>
          <dd>{cm(session.measurements.forwardCm)}</dd>
        </div>
        <div>
          <dt>{copy.exitManoeuvres}</dt>
          <dd>{session.measurements.exitManoeuvres}</dd>
        </div>
      </dl>
      {finished && (
        <p role="status" data-testid="exam-result">
          {ledger.interruption
            ? `${copy.interrupted} ${copy.interruptionCauses[ledger.interruption.cause]} ${copy.results.disapproved}.`
            : result === 'disapproved'
              ? `${copy.results.disapproved}: ${copy.overPoints}`
              : copy.results.pending}
        </p>
      )}
      <h2>{copy.faults}</h2>
      <FaultList session={session} rules={rules} />
      <p>
        <small>{copy.approximations}</small>
      </p>
      <p>
        <small>{copy.source}</small>
      </p>
    </>
  );
}

/** The practical exam, stage I and the box, with the virtual examiner (F03-T04). */
export function ExamPage() {
  return (
    <>
      <PageTitle>{copy.heading}</PageTitle>
      <p className="lead">{copy.intro}</p>
      <ContentGate>{(content) => <Exam content={content} />}</ContentGate>
    </>
  );
}
