import { Suspense, lazy, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { buildCity } from '../../city/model.ts';
import type { Rule } from '../../content/schemas.ts';
import type { Content } from '../../content/validate.ts';
import { buildCircuit } from '../../exam/circuit.ts';
import type { Notice } from '../../exam/circulation.ts';
import { resultOf } from '../../exam/scoring.ts';
import { createSession, observe } from '../../exam/session.ts';
import type { Observation, Session } from '../../exam/session.ts';
import { RendererContext } from '../../scene/RendererContext.ts';
import type { PowertrainCommand, TransmissionKind } from '../../sim/powertrain/powertrain.ts';
import { createTraffic, trafficSourceOf } from '../../traffic/traffic.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { EXAM_COPY as copy, formatNumber } from '../../i18n/es-AR.ts';

// Three.js stays in its own chunk, as on the home page.
const ExamDrive = lazy(() => import('../../city/ExamDrive.tsx').then((module) => ({ default: module.ExamDrive })));

/** Stage I starts with the key in contact and the engine off (protocolo PDF 9). */
const EXAM_PREPARED: readonly PowertrainCommand[] = [{ type: 'insert-key' }, { type: 'turn-key', to: 'on' }];
/** Seed 1 is the documented default scenario (recognition order and traffic); any positive integer replays its own. */
const DEFAULT_SEED = 1;
const MAX_SEED = 999999;

function noticeText(notice: Notice | null): string {
  if (!notice) return copy.nothingAhead;
  const text = copy.notices[notice.kind](notice.distanceM);
  return notice.light ? `${text} ${copy.lightStates[notice.light]}.` : text;
}

function examinerSays(session: Session, kind: TransmissionKind): string {
  const { prompt } = session;
  if (prompt.kind === 'recognise') {
    const text = copy.prompts[prompt.target as keyof typeof copy.prompts] ?? prompt.target;
    if (!prompt.target.startsWith('gear-')) return text;
    return `${text} ${kind === 'manual' ? copy.gearHintManual : copy.gearHintAutomatic}`;
  }
  const detail =
    prompt.message === 'reverse' || prompt.message === 'forward' || prompt.message === 'firstMetres'
      ? ` ${copy.phases[`${prompt.message}${kind === 'manual' ? 'Manual' : 'Automatic'}`]}`
      : '';
  const { instruction } = session.street;
  const turn =
    (prompt.message === 'firstMetres' || prompt.message === 'circulation') && instruction
      ? ` ${copy.instruction(instruction.turn, instruction.street)}`
      : '';
  return `${copy.phases[prompt.message]}${detail}${turn}`;
}

function FaultList({ session, rules, feedback }: { session: Session; rules: readonly Rule[]; feedback: boolean }) {
  const { faults } = session.ledger;
  if (faults.length === 0) return <p>{feedback ? copy.feedbackClean : copy.noFaults}</p>;
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
            {feedback && rule && (
              <p className="exam-feedback">
                <b>{copy.whatIsEvaluated}:</b> {rule.condition} <b>{copy.readMore}:</b>{' '}
                {rule.refs.map((ref, position) => (
                  <span key={ref.page}>
                    {position > 0 && ', '}
                    <Link to={`/biblioteca/${ref.source}/${ref.page}`}>{copy.protocolPage(ref.page)}</Link>
                  </span>
                ))}
              </p>
            )}
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
  // The city, its seeded traffic and the circuit the examiner reads; the seed recreates the traffic.
  const city = useMemo(() => buildCity(content.route), [content.route]);
  const source = useMemo(() => trafficSourceOf(createTraffic(city, seed)), [city, seed]);
  const circuit = useMemo(() => buildCircuit(city, source.traffic), [city, source]);
  const world = useMemo(() => ({ ...city.world, traffic: source }), [city, source]);
  const [session, setSession] = useState<Session>(() => createSession(rules, 'manual', DEFAULT_SEED, circuit));
  // The latest session, updated 120 times a second by the steps without re-rendering each time.
  const sessionRef = useRef<Session>(session);

  const begin = (kind: TransmissionKind, nextSeed: number) => {
    const nextCircuit = nextSeed === seed ? circuit : buildCircuit(city, createTraffic(city, nextSeed));
    sessionRef.current = createSession(rules, kind, nextSeed, nextCircuit);
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
  // Read by the simulation before every step: the examiner's brake does not wait for the next render.
  const isHalted = useCallback(() => sessionRef.current.street.takeover, []);
  const onTelemetry = useCallback(() => {
    setSession(sessionRef.current);
  }, []);

  const { ledger, street } = session;
  const finished = session.phase === 'finished';
  const result = finished ? resultOf(ledger, session.completedStages) : null;
  const cm = (value: number | null) => (value === null ? copy.pendingMeasure : `${formatNumber(value, 0)} cm`);
  const interruptingRule = ledger.interruption?.ruleId
    ? rules.find((rule) => rule.id === ledger.interruption?.ruleId)
    : undefined;
  const currentLeg = city.legs.find((leg) => leg.number === street.leg);
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
            max={MAX_SEED}
            step={1}
            value={seed}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isInteger(next) && next > 0 && next <= MAX_SEED) begin(transmission, next);
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
        <ExamDrive
          key={transmission}
          city={city}
          world={world}
          transmission={transmission}
          prepared={EXAM_PREPARED}
          resetCount={resetCount}
          onObservation={onObservation}
          onTelemetry={onTelemetry}
          halted={isHalted}
          {...(createRenderer ? { createRenderer } : {})}
        />
      </Suspense>
      <dl className="hud">
        <div>
          <dt>{copy.points}</dt>
          <dd data-testid="exam-points">{ledger.points}</dd>
        </div>
        <div>
          <dt>{copy.currentLeg}</dt>
          <dd data-testid="exam-leg">
            {currentLeg ? copy.leg(currentLeg.number, currentLeg.street) : copy.pendingMeasure}
          </dd>
        </div>
        <div>
          <dt>{copy.nextInstruction}</dt>
          <dd data-testid="exam-instruction">
            {street.instruction
              ? copy.instruction(street.instruction.turn, street.instruction.street)
              : copy.pendingMeasure}
          </dd>
        </div>
        <div>
          <dt>{copy.notice}</dt>
          <dd data-testid="exam-notice">{noticeText(street.notice)}</dd>
        </div>
        <div>
          <dt>{copy.limits}</dt>
          <dd data-testid="exam-limits">
            {street.road ? copy.limitsOf(street.road.examKmh, street.road.postedKmh) : copy.pendingMeasure}
          </dd>
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
        <div>
          <dt>{copy.firstMetresTopKmh}</dt>
          <dd>
            {session.measurements.firstMetresTopKmh === null
              ? copy.pendingMeasure
              : `${formatNumber(session.measurements.firstMetresTopKmh, 0)} km/h`}
          </dd>
        </div>
        <div>
          <dt>{copy.light}</dt>
          {/* Only a signal ahead has a light to show: elsewhere the traffic reports green by default. */}
          <dd data-testid="exam-light">
            {street.notice?.kind === 'signal' && street.notice.light
              ? copy.lightStates[street.notice.light]
              : copy.noSignalAhead}
          </dd>
        </div>
      </dl>
      {finished && (
        <p role="status" data-testid="exam-result">
          {ledger.interruption
            ? `${copy.interrupted} ${copy.interruptionCauses[ledger.interruption.cause]} ${
                interruptingRule
                  ? `${copy.interruptedBy(interruptingRule.fichaRows[0]?.text ?? interruptingRule.id)} `
                  : ''
              }${street.takeover ? `${copy.takeover} ` : ''}${copy.results.disapproved}.`
            : result === 'disapproved'
              ? `${copy.results.disapproved}: ${copy.overPoints}`
              : copy.results.pending}
        </p>
      )}
      <h2>{finished ? copy.feedback : copy.faults}</h2>
      {finished && <p>{copy.feedbackIntro}</p>}
      <FaultList session={session} rules={rules} feedback={finished} />
      <p>
        <small>{copy.approximations}</small>
      </p>
      <p>
        <small>{copy.source}</small>
      </p>
    </>
  );
}

/**
 * The practical exam with the virtual examiner: stage I and the box (F03-T04), the first block (F03-T05) and the
 * whole circulation of route A with its traffic (F04-T03). Stage III, parking, is F04-T04.
 */
export function ExamPage() {
  return (
    <>
      <PageTitle>{copy.heading}</PageTitle>
      <p className="lead">{copy.intro}</p>
      <ContentGate>{(content) => <Exam content={content} />}</ContentGate>
    </>
  );
}
