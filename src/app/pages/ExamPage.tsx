import { Suspense, lazy, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { buildCity } from '../../city/model.ts';
import type { Content } from '../../content/validate.ts';
import { buildCard } from '../../exam/card.ts';
import { buildCircuit } from '../../exam/circuit.ts';
import type { Circuit } from '../../exam/circuit.ts';
import { guideSteps } from '../../exam/guide.ts';
import {
  DRIVING_MODES,
  STAGES,
  aidsOf,
  isPersisted,
  modeFromSlug,
  preparedCabinFor,
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
import { EXAM_COPY as copy } from '../../i18n/es-AR.ts';
import { DRIVING_GUIDE_COPY as guideCopy } from '../../i18n/drivingGuide.ts';
import { ExamCardView, FaultList } from './ExamCardView.tsx';
import { ExamGuide } from './ExamGuide.tsx';
import { ExamHud, LearnPanel, examinerSays } from './ExamHud.tsx';

// Three.js stays in its own chunk, as on the home page.
const ExamDrive = lazy(() => import('../../city/ExamDrive.tsx').then((module) => ({ default: module.ExamDrive })));

/** Seed 1 is the documented default scenario (recognition order and traffic); any positive integer replays its own. */
const DEFAULT_SEED = 1;
const MAX_SEED = 999999;
/** Without a mode in the URL, the page runs the three stages with the aids of practice. */
const DEFAULT_MODE: DrivingMode = 'run';
const DEFAULT_STAGE: Stage = 'I';

type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

function Exam({ content }: { content: Content }) {
  const rules = content.rules.rules;
  const createRenderer = useContext(RendererContext);
  const { now, recordAttempt } = useProgress();
  const [params, setParams] = useSearchParams();
  const mode = modeFromSlug(params.get('modo')) ?? DEFAULT_MODE;
  // The stage the practice runs: read in every mode, so the stage picker and the mode radios need no fallback.
  const practiceStage: Stage = stageFromSlug(params.get('etapa')) ?? DEFAULT_STAGE;
  const stage: Stage | null = mode === 'practice' ? practiceStage : null;
  const aids = aidsOf(mode);
  const [transmission, setTransmission] = useState<TransmissionKind>('manual');
  const [seed, setSeed] = useState(DEFAULT_SEED);
  // What the seed field shows while editing: it may be empty, but only a valid seed restarts the exam.
  const [seedText, setSeedText] = useState(String(DEFAULT_SEED));
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
  const preparedCabin = useMemo(() => preparedCabinFor(stage), [stage]);
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

  const chooseMode = (nextMode: DrivingMode, nextStage: Stage) => {
    const next: Record<string, string> = { modo: slugOfMode(nextMode) };
    if (nextMode === 'practice') next.etapa = slugOfStage(nextStage);
    setParams(next);
  };

  const { street } = session;
  const finished = session.phase === 'finished';
  const card = finished ? buildCard(session) : null;
  const show = (aid: Aid) => aids.has(aid);
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
              onChange={() => chooseMode(candidate, practiceStage)}
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
                value={slugOfStage(practiceStage)}
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
              {copy.practiceStart[practiceStage]}
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
            value={seedText}
            onChange={(event) => {
              const text = event.target.value;
              if (text.trim() === '') {
                setSeedText('');
                return;
              }
              const next = Number(text);
              if (!Number.isInteger(next) || next < 1 || next > MAX_SEED) return;
              setSeedText(text);
              begin(transmission, next, stage);
            }}
            onBlur={() => setSeedText(String(seed))}
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
          preparedCabin={preparedCabin}
          resetCount={resetCount}
          onObservation={onObservation}
          onTelemetry={onTelemetry}
          halted={isHalted}
          onBindingsChange={setBindings}
          {...(createRenderer ? { createRenderer } : {})}
        />
      </Suspense>
      <ExamHud session={session} aids={aids} legs={city.legs} transmission={transmission} />
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
