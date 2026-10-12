import { Suspense, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { buildCity } from '../../city/model.ts';
import type { Content } from '../../content/validate.ts';
import { buildCard } from '../../exam/card.ts';
import { buildCircuit } from '../../exam/circuit.ts';
import type { Circuit } from '../../exam/circuit.ts';
import { guideSteps } from '../../exam/guide.ts';
import type { Notice } from '../../exam/circulation.ts';
import {
  DRIVING_MODES,
  STAGES,
  aidsOf,
  isPersisted,
  modeFromSlug,
  preparedFor,
  slugOfMode,
  slugOfStage,
  stageFromSlug,
  startPoseFor,
} from '../../exam/modes.ts';
import type { Aid, DrivingMode } from '../../exam/modes.ts';
import type { Stage } from '../../exam/scoring.ts';
import { createPracticeSession, createSession, observe } from '../../exam/session.ts';
import type { Observation, Session } from '../../exam/session.ts';
import { DEFAULT_BINDINGS } from '../../practice/bindings.ts';
import type { Bindings } from '../../practice/bindings.ts';
import { keyNames } from '../../practice/keyLabels.ts';
import { createDrivingAttempt } from '../../progress/model.ts';
import { useProgress } from '../../progress/ProgressProvider.tsx';
import { RendererContext } from '../../scene/RendererContext.ts';
import type { TransmissionKind } from '../../sim/powertrain/powertrain.ts';
import { createTraffic, trafficSourceOf } from '../../traffic/traffic.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { EXAM_COPY as copy, formatNumber } from '../../i18n/es-AR.ts';
import { DRIVING_GUIDE_COPY as guideCopy } from '../../i18n/drivingGuide.ts';
import { ExamCardView, FaultItem, FaultList } from './ExamCardView.tsx';
import { ExamGuide } from './ExamGuide.tsx';

// Three.js stays in its own chunk, as on the home page.
const ExamDrive = lazy(() => import('../../city/ExamDrive.tsx').then((module) => ({ default: module.ExamDrive })));

/** Seed 1 is the documented default scenario (recognition order and traffic); any positive integer replays its own. */
const DEFAULT_SEED = 1;
const MAX_SEED = 999999;
/** Without a mode in the URL, the page runs the three stages with the aids of practice. */
const DEFAULT_MODE: DrivingMode = 'run';
const DEFAULT_STAGE: Stage = 'I';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

function noticeText(notice: Notice | null): string {
  if (!notice) return copy.nothingAhead;
  const text = copy.notices[notice.kind](notice.distanceM);
  return notice.light ? `${text} ${copy.lightStates[notice.light]}.` : text;
}

/** What the examiner says aloud: the prompt of the phase, the next turn and the parking notice (every mode). */
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
  const { instruction, parkingAheadM } = session.street;
  const turn =
    (prompt.message === 'firstMetres' || prompt.message === 'circulation') && instruction
      ? ` ${copy.instruction(instruction.turn, instruction.street)}`
      : '';
  // The parking is announced 100 m before the bay, while still circulating (protocolo PDF 24).
  const notice =
    prompt.message === 'circulation' && parkingAheadM !== null ? ` ${copy.parkingNotice(parkingAheadM)}` : '';
  return `${copy.phases[prompt.message]}${detail}${turn}${notice}`;
}

/** What the driver still has to do before opening the door, read from the car and the cabin at the last step. */
function descentText(session: Session, kind: TransmissionKind): string {
  const { parking } = session;
  const steps = [
    kind === 'manual' ? copy.descentSteps.neutral : copy.descentSteps.park,
    copy.descentSteps.handbrake,
    copy.descentSteps.lightsOff,
    copy.descentSteps.engineOff,
    copy.descentSteps.keyOut,
    `${copy.descentSteps.mirror}${parking.leftMirrorChecked ? ' ✓' : ''}`,
  ];
  return steps.join(' · ');
}

/** Guided learning: what the current phase checks, and the last fault explained as it happens. */
function LearnPanel({ session }: { session: Session }) {
  const hints = copy.learnHints[session.phase];
  const last = session.ledger.faults.at(-1);
  const rule = last ? session.rules.find((candidate) => candidate.id === last.ruleId) : undefined;
  return (
    <section className="exam-learn" data-testid="exam-hints" aria-live="polite">
      <p>
        <b>{copy.learnChecks}:</b> {hints.checks}
      </p>
      {last && rule && (
        <div data-testid="exam-last-fault">
          <b>{copy.lastFault}:</b> <FaultItem item={{ fault: last, rule }} explain />
        </div>
      )}
    </section>
  );
}

function Exam({ content }: { content: Content }) {
  const rules = content.rules.rules;
  const createRenderer = useContext(RendererContext);
  const { now, recordAttempt } = useProgress();
  const [params, setParams] = useSearchParams();
  const mode = modeFromSlug(params.get('modo')) ?? DEFAULT_MODE;
  const stage: Stage | null = mode === 'practice' ? (stageFromSlug(params.get('etapa')) ?? DEFAULT_STAGE) : null;
  const aids = aidsOf(mode);
  const [transmission, setTransmission] = useState<TransmissionKind>('manual');
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [resetCount, setResetCount] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // The keys the driver bound in the cabin, so the guide names the ones that work.
  const [bindings, setBindings] = useState<Bindings>(DEFAULT_BINDINGS);
  const keys = useMemo(() => keyNames(bindings), [bindings]);
  // The city, its seeded traffic and the circuit the examiner reads; the seed recreates the traffic.
  const city = useMemo(() => buildCity(content.route), [content.route]);
  const source = useMemo(() => trafficSourceOf(createTraffic(city, seed)), [city, seed]);
  const circuit = useMemo(() => buildCircuit(city, source.traffic), [city, source]);
  const world = useMemo(() => ({ ...city.world, traffic: source }), [city, source]);
  const start = useMemo(() => startPoseFor(city, stage), [city, stage]);
  const prepared = useMemo(() => preparedFor(stage), [stage]);
  const bands = content.rules.parkingBands;
  const newSession = useCallback(
    (kind: TransmissionKind, nextSeed: number, nextCircuit: Circuit, nextStage: Stage | null) =>
      nextStage
        ? createPracticeSession(rules, kind, nextSeed, nextCircuit, bands, nextStage)
        : createSession(rules, kind, nextSeed, nextCircuit, bands),
    [rules, bands],
  );
  const [session, setSession] = useState<Session>(() => newSession('manual', DEFAULT_SEED, circuit, stage));
  // The latest session, updated 120 times a second by the steps without re-rendering each time.
  const sessionRef = useRef<Session>(session);
  const modeRef = useRef(mode);
  const startedAtRef = useRef(now().toISOString());
  // Bumped by every restart: a save still running for an earlier session must not report on the new one.
  const sessionIdRef = useRef(0);
  const subjectId = `route.${content.route.id}`;

  const begin = useCallback(
    (kind: TransmissionKind, nextSeed: number, nextStage: Stage | null) => {
      const nextCircuit = nextSeed === seed ? circuit : buildCircuit(city, createTraffic(city, nextSeed));
      sessionRef.current = newSession(kind, nextSeed, nextCircuit, nextStage);
      sessionIdRef.current += 1;
      startedAtRef.current = now().toISOString();
      setSaveState('idle');
      setSession(sessionRef.current);
      setTransmission(kind);
      setSeed(nextSeed);
      setResetCount((count) => count + 1);
    },
    [seed, circuit, city, newSession, now],
  );

  // A mode or stage chosen in the URL (the home page, the back button) restarts the exam in it.
  const sessionKey = `${mode}-${stage ?? ''}`;
  const appliedKeyRef = useRef(sessionKey);
  useEffect(() => {
    modeRef.current = mode;
    if (appliedKeyRef.current === sessionKey) return;
    appliedKeyRef.current = sessionKey;
    begin(transmission, seed, stage);
  }, [sessionKey, mode, stage, begin, transmission, seed]);

  /** Stores the finished session as a driving attempt (runs, exams and practices; not the guided learning). */
  const save = useCallback(
    (finished: Session, finishedMode: DrivingMode) => {
      setSaveState('saving');
      const sessionId = sessionIdRef.current;
      const startedAt = startedAtRef.current;
      void recordAttempt((context) =>
        createDrivingAttempt(
          { session: finished, mode: finishedMode, subjectId },
          { id: context.id, contentVersion: context.contentVersion, startedAt, finishedAt: context.at },
        ),
      ).then((outcome) => {
        if (sessionIdRef.current === sessionId) setSaveState(outcome === 'saved' ? 'saved' : 'failed');
      });
    },
    [recordAttempt, subjectId],
  );

  const onObservation = useCallback(
    (observation: Observation) => {
      const before = sessionRef.current.phase;
      sessionRef.current = observe(sessionRef.current, observation);
      const after = sessionRef.current;
      // The recognition starts as stage I requires: engine off, key in contact, car in the box (protocolo PDF 9).
      if (before === 'familiarisation' && after.phase === 'recognition') setResetCount((count) => count + 1);
      if (before !== 'finished' && after.phase === 'finished' && isPersisted(modeRef.current))
        save(after, modeRef.current);
      // Steps come 120 times a second: the page refreshes with the telemetry; commands refresh at once.
      if (observation.type !== 'step' || after.phase === 'finished') setSession(after);
    },
    [save],
  );
  // Read by the simulation before every step: the examiner's brake does not wait for the next render.
  const isHalted = useCallback(() => sessionRef.current.street.takeover, []);
  const onTelemetry = useCallback(() => {
    setSession(sessionRef.current);
  }, []);

  const chooseMode = (nextMode: DrivingMode, nextStage: Stage | null) => {
    const next: Record<string, string> = { modo: slugOfMode(nextMode) };
    if (nextMode === 'practice') next.etapa = slugOfStage(nextStage ?? DEFAULT_STAGE);
    setParams(next);
  };

  const { ledger, street } = session;
  const finished = session.phase === 'finished';
  const card = finished ? buildCard(session) : null;
  const show = (aid: Aid) => aids.has(aid);
  const cm = (value: number | null) => (value === null ? copy.pendingMeasure : `${formatNumber(value, 0)} cm`);
  const { parking } = session;
  const kerb = parking.final ?? parking.kerb;
  const parkingText =
    session.phase === 'parking' && parking.startedAtS === null && parking.aheadM !== null
      ? copy.bayAhead(parking.aheadM)
      : copy.parkingCountersOf(parking.manoeuvres, parking.attempts);
  const currentLeg = city.legs.find((leg) => leg.number === street.leg);
  const step = session.phase === 'finished' ? null : session.phase;
  return (
    <>
      <fieldset className="choice" data-testid="exam-mode">
        <legend>{copy.mode}</legend>
        {DRIVING_MODES.map((candidate) => (
          <label key={candidate} title={copy.modeHelp[candidate]}>
            <input
              type="radio"
              name="exam-mode"
              value={candidate}
              checked={mode === candidate}
              onChange={() => chooseMode(candidate, stage)}
            />{' '}
            {copy.modes[candidate]}
          </label>
        ))}
        <p className="exam-mode__help">{copy.modeHelp[mode]}</p>
        {mode === 'practice' && (
          <>
            <label>
              {copy.stage}{' '}
              <select
                value={slugOfStage(stage ?? DEFAULT_STAGE)}
                onChange={(event) => chooseMode('practice', stageFromSlug(event.target.value) ?? DEFAULT_STAGE)}
              >
                {STAGES.map((candidate) => (
                  <option key={candidate} value={slugOfStage(candidate)}>
                    {copy.stageTitles[candidate]}
                  </option>
                ))}
              </select>
            </label>
            <p className="exam-mode__help" data-testid="exam-stage-help">
              {copy.practiceStart[stage ?? DEFAULT_STAGE]}
            </p>
          </>
        )}
      </fieldset>
      <fieldset className="choice">
        <legend>{copy.transmission}</legend>
        {(['manual', 'automatic'] as const).map((kind) => (
          <label key={kind}>
            <input
              type="radio"
              name="exam-transmission"
              value={kind}
              checked={transmission === kind}
              onChange={() => begin(kind, seed, stage)}
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
              if (Number.isInteger(next) && next > 0 && next <= MAX_SEED) begin(transmission, next, stage);
            }}
          />
        </label>
      </fieldset>
      <section className="exam-examiner" aria-live="polite">
        <h2>{copy.examiner}</h2>
        <p data-testid="examiner-says" data-phase={session.phase} data-mode={mode}>
          {examinerSays(session, transmission)}
        </p>
        {show('steps') && step && (
          <p data-testid="exam-how">
            <b>{guideCopy.now}:</b> {guideCopy.steps[step].how(keys, transmission)}
          </p>
        )}
        <p>
          {(session.phase === 'familiarisation' || session.phase === 'preparation') && (
            <button type="button" className="button" onClick={() => onObservation({ type: 'ready' })}>
              {copy.ready}
            </button>
          )}
          {session.phase === 'parking' && (
            <button
              type="button"
              className="button"
              title={copy.parkingDoneHint}
              onClick={() => onObservation({ type: 'ready' })}
            >
              {copy.parkingDone}
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
          <button type="button" className="button button--secondary" onClick={() => begin(transmission, seed, stage)}>
            {copy.restart}
          </button>
        </p>
      </section>
      <ExamGuide
        keys={keys}
        kind={transmission}
        steps={guideSteps(session.scope)}
        current={step}
        showSteps={show('steps')}
      />
      {show('hints') && <LearnPanel session={session} />}
      <Suspense fallback={<p className="scene-canvas__status">{copy.loading}</p>}>
        <ExamDrive
          key={`${transmission}-${sessionKey}`}
          city={city}
          world={world}
          transmission={transmission}
          start={start}
          prepared={prepared}
          resetCount={resetCount}
          onObservation={onObservation}
          onTelemetry={onTelemetry}
          halted={isHalted}
          onBindingsChange={setBindings}
          {...(createRenderer ? { createRenderer } : {})}
        />
      </Suspense>
      <dl className="hud" data-testid="exam-hud" data-aids={[...aids].join(' ')}>
        {(show('points') || finished) && (
          <div>
            <dt>{copy.points}</dt>
            <dd data-testid="exam-points">{ledger.points}</dd>
          </div>
        )}
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
        {show('notice') && (
          <div>
            <dt>{copy.notice}</dt>
            <dd data-testid="exam-notice">{noticeText(street.notice)}</dd>
          </div>
        )}
        {show('limits') && (
          <div>
            <dt>{copy.limits}</dt>
            <dd data-testid="exam-limits">
              {street.road ? copy.limitsOf(street.road.examKmh, street.road.postedKmh) : copy.pendingMeasure}
            </dd>
          </div>
        )}
        {show('measurements') && (
          <>
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
          </>
        )}
        {show('light') && (
          <div>
            <dt>{copy.light}</dt>
            {/* Only a signal ahead has a light to show: elsewhere the traffic reports green by default. */}
            <dd data-testid="exam-light">
              {street.notice?.kind === 'signal' && street.notice.light
                ? copy.lightStates[street.notice.light]
                : copy.noSignalAhead}
            </dd>
          </div>
        )}
        {show('parkingCounters') && (
          <div>
            <dt>{copy.parkingCounters}</dt>
            <dd data-testid="exam-parking">{parkingText}</dd>
          </div>
        )}
        {show('kerbDistance') && (
          <div>
            <dt>{copy.kerbDistance}</dt>
            <dd data-testid="exam-kerb">
              {kerb ? copy.kerbDistanceOf(kerb.frontCm, kerb.rearCm) : copy.pendingMeasure}
            </dd>
          </div>
        )}
        {show('descentChecklist') && session.phase === 'leaving' && (
          <div>
            <dt>{copy.descentChecklist}</dt>
            <dd data-testid="exam-descent">{descentText(session, transmission)}</dd>
          </div>
        )}
      </dl>
      {mode === 'exam' && !finished && <p data-testid="exam-no-aids">{copy.examNoAids}</p>}
      {card && <ExamCardView card={card} takeover={street.takeover} />}
      {finished && (
        <p role="status" data-testid="exam-saved" data-save={saveState}>
          {isPersisted(mode)
            ? saveState === 'saved'
              ? copy.saved
              : saveState === 'failed'
                ? copy.saveFailed
                : ''
            : copy.notSaved}
        </p>
      )}
      {(show('faults') || finished) && (
        <>
          <h2>{finished ? copy.feedback : copy.faults}</h2>
          {finished && <p>{copy.feedbackIntro}</p>}
          <FaultList session={session} explain={finished || show('explanations')} />
        </>
      )}
      {!finished && (
        <p>
          <small>{copy.approximations}</small>
        </p>
      )}
      <p>
        <small>{copy.source}</small>
      </p>
    </>
  );
}

/**
 * The practical exam with the virtual examiner: stage I and the box (F03-T04), the first block (F03-T05), the
 * whole circulation of route A with its traffic (F04-T03), the parking with the descent (F04-T04) and the modes
 * learn, practice, run and exam with the card per stage (F04-T05).
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
