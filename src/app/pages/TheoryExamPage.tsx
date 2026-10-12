import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SEED_LIMIT } from '../../activities/engine.ts';
import { SignGraphic } from '../../activities/ui/SignGraphic.tsx';
import type { Content } from '../../content/validate.ts';
import { useProgress } from '../../progress/ProgressProvider.tsx';
import { createTheoryAttempt } from '../../theory/attempt.ts';
import { composeExam, gradeExam } from '../../theory/exam.ts';
import type { ExamGrade, ExamPaper } from '../../theory/exam.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { SOURCE_SHORT_LABELS, THEORY_COPY, sectionLabel } from '../../i18n/es-AR.ts';

type Stage = 'intro' | 'running' | 'finished';

const randomSeed = () => Math.floor(Math.random() * SEED_LIMIT);
const clock = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const sectionName = (key: string) => {
  const [source = '', ...rest] = key.split('-');
  return sectionLabel(source, rest.join('-'));
};

/** "Sala de examen": a timed mock of the theoretical exam, reproducible by its seed (?semilla=, ?minutos=). */
export function TheoryExamPage() {
  return (
    <>
      <PageTitle>{THEORY_COPY.heading}</PageTitle>
      <ContentGate>{(content) => <TheoryExam content={content} />}</ContentGate>
    </>
  );
}

function TheoryExam({ content }: { content: Content }) {
  const config = content.theoryExam;
  const [params, setParams] = useSearchParams();
  const rawSeed = params.get('semilla') ?? '';
  const validSeed = /^\d{1,10}$/.test(rawSeed) && Number(rawSeed) < SEED_LIMIT;
  const seed = validSeed ? Number(rawSeed) : 0;
  const allowedMinutes = [config.timeMinutes.default, ...config.timeMinutes.alternatives];
  const askedMinutes = Number(params.get('minutos'));
  const minutes = allowedMinutes.includes(askedMinutes) ? askedMinutes : config.timeMinutes.default;

  useEffect(() => {
    if (validSeed) return;
    // Keeps ?minutos= while choosing the seed.
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('semilla', String(randomSeed()));
        return next;
      },
      { replace: true },
    );
  }, [validSeed, setParams]);

  const paper = useMemo(
    () => composeExam(content.activities, content.units, config, seed),
    [content.activities, content.units, config, seed],
  );
  if (!validSeed) return null;
  return (
    <ExamRun
      key={`${seed}:${minutes}`}
      content={content}
      paper={paper}
      minutes={minutes}
      allowedMinutes={allowedMinutes}
      onMinutes={(value) => setParams({ semilla: String(seed), minutos: String(value) })}
      onAnother={() => {
        // The button disappears with the results: the new exam starts from the title, at the top of the page.
        document.getElementById('page-title')?.focus();
        setParams({ semilla: String(randomSeed()), minutos: String(minutes) });
      }}
    />
  );
}

interface ExamRunProps {
  content: Content;
  paper: ExamPaper;
  minutes: number;
  allowedMinutes: number[];
  onMinutes: (minutes: number) => void;
  onAnother: () => void;
}

function ExamRun({ content, paper, minutes, allowedMinutes, onMinutes, onAnother }: ExamRunProps) {
  const config = content.theoryExam;
  const { recordAttempt } = useProgress();
  const [stage, setStage] = useState<Stage>('intro');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<ExamGrade | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saved' | 'failed'>('idle');
  const startedAt = useRef<number>(0);
  const [remainingMs, setRemainingMs] = useState(minutes * 60_000);
  const finish = (outOfTime: boolean) => {
    const result = gradeExam(paper, answers, content.activities, config);
    setGrade(result);
    setTimedOut(outOfTime);
    setStage('finished');
    const startedIso = new Date(startedAt.current).toISOString();
    void recordAttempt((context) =>
      createTheoryAttempt(paper, result, {
        id: context.id,
        contentVersion: context.contentVersion,
        startedAt: startedIso,
        finishedAt: context.at,
        minutes,
        timedOut: outOfTime,
      }),
    ).then((outcome) => setSaved(outcome === 'saved' ? 'saved' : 'failed'));
    document.getElementById('page-title')?.focus();
  };
  // Reads the latest answers when time runs out, without restarting the timer on every answer.
  const timeUp = useEffectEvent(() => finish(true));

  useEffect(() => {
    if (stage !== 'running') return undefined;
    const deadline = startedAt.current + minutes * 60_000;
    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(left);
      if (left > 0) return;
      // Stops before handing in: another tick could run before React re-renders and store the paper twice.
      window.clearInterval(timer);
      timeUp();
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [stage, minutes]);

  if (stage === 'intro') {
    return (
      <section aria-labelledby="theory-intro">
        <h2 id="theory-intro">{THEORY_COPY.introHeading}</h2>
        <p className="lead">
          {THEORY_COPY.introSummary(paper.questions.length, config.passCorrect, config.optionsPerQuestion, minutes)}
        </p>
        <p>{THEORY_COPY.notOfficial}</p>
        <fieldset className="question">
          <legend className="question__prompt">{THEORY_COPY.timeLegend}</legend>
          {allowedMinutes.map((value) => (
            <label key={value} className="option">
              <input type="radio" name="minutes" checked={value === minutes} onChange={() => onMinutes(value)} />
              <span>
                {value === config.timeMinutes.default ? THEORY_COPY.timeDefault(value) : THEORY_COPY.timeShort(value)}
              </span>
            </label>
          ))}
        </fieldset>
        {paper.questions.length < config.questions && (
          <p className="status-message status-message--error" role="alert">
            {THEORY_COPY.shortBank(paper.questions.length, config.questions)}
          </p>
        )}
        <p className="card__actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              startedAt.current = Date.now();
              setRemainingMs(minutes * 60_000);
              setStage('running');
            }}
          >
            {THEORY_COPY.start}
          </button>{' '}
          <button type="button" className="button button--secondary" onClick={onAnother}>
            {THEORY_COPY.another}
          </button>
        </p>
        <details>
          <summary>{THEORY_COPY.sourcesHeading}</summary>
          <ul>
            {config.sources.map((source) => (
              <li key={source.parameter}>
                {source.text}{' '}
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.reference}
                </a>
              </li>
            ))}
          </ul>
          <p>{config.notes}</p>
        </details>
      </section>
    );
  }

  if (stage === 'running') {
    const answered = Object.keys(answers).length;
    const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      finish(false);
    };
    return (
      <form onSubmit={submit} aria-labelledby="theory-running">
        <h2 id="theory-running">{THEORY_COPY.runningHeading}</h2>
        <p className="exam-status">
          <span role="timer" aria-label={THEORY_COPY.timeLeft}>
            {THEORY_COPY.timeLeft}: {clock(remainingMs)}
          </span>{' '}
          · {THEORY_COPY.progress(answered, paper.questions.length)}
        </p>
        <ol className="theory-questions">
          {paper.questions.map((question, index) => {
            const sign = question.signId ? content.signs.find((item) => item.id === question.signId) : undefined;
            return (
              <li key={question.id}>
                <fieldset className="question">
                  <legend className="question__prompt">
                    {index + 1}. {question.prompt}
                  </legend>
                  {sign && (
                    <SignGraphic
                      signId={sign.id}
                      description={`${THEORY_COPY.signLabel}: ${sign.visual}`}
                      hasCrop={sign.box !== undefined}
                    />
                  )}
                  {question.options.map((option) => (
                    <label key={option.id} className="option">
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={answers[question.id] === option.id}
                        onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                      />
                      <span>{option.text}</span>
                    </label>
                  ))}
                </fieldset>
              </li>
            );
          })}
        </ol>
        <p className="card__actions">
          <button type="submit" className="button">
            {THEORY_COPY.handIn}
          </button>
        </p>
      </form>
    );
  }

  if (!grade) return null;
  return <Results content={content} grade={grade} timedOut={timedOut} saved={saved} onAnother={onAnother} />;
}

function Results({
  content,
  grade,
  timedOut,
  saved,
  onAnother,
}: {
  content: Content;
  grade: ExamGrade;
  timedOut: boolean;
  saved: 'idle' | 'saved' | 'failed';
  onAnother: () => void;
}) {
  const config = content.theoryExam;
  const unitById = new Map(content.units.map((unit) => [unit.id, unit]));
  const wrong = grade.results.filter((result) => !result.correct);
  return (
    <section aria-labelledby="theory-result">
      <h2 id="theory-result">{grade.passed ? THEORY_COPY.passed : THEORY_COPY.failed}</h2>
      <p className="lead">{THEORY_COPY.score(grade.correct, grade.total, config.passCorrect)}</p>
      {timedOut && <p role="status">{THEORY_COPY.timedOut}</p>}
      {grade.unanswered > 0 && <p>{THEORY_COPY.unanswered(grade.unanswered)}</p>}
      {saved === 'failed' && (
        <p className="status-message status-message--error" role="alert">
          {THEORY_COPY.notSaved}
        </p>
      )}
      <h3 id="theory-by-section">{THEORY_COPY.bySectionHeading}</h3>
      <table aria-labelledby="theory-by-section">
        <thead>
          <tr>
            <th scope="col">{THEORY_COPY.sectionColumn}</th>
            <th scope="col">{THEORY_COPY.correctColumn}</th>
          </tr>
        </thead>
        <tbody>
          {grade.bySection.map((row) => (
            <tr key={row.sectionKey}>
              <th scope="row">{sectionName(row.sectionKey)}</th>
              <td>
                {row.correct} / {row.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {grade.toReview.length > 0 && (
        <>
          <h3>{THEORY_COPY.reviewHeading}</h3>
          <ul>
            {grade.toReview.map(({ unitId }) => {
              const unit = unitById.get(unitId);
              if (!unit) return null;
              return (
                <li key={unitId}>
                  <Link to={`/mapa/${unit.source}/${unit.section}`}>{unit.title}</Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {wrong.length > 0 && (
        <>
          <h3>{THEORY_COPY.wrongHeading}</h3>
          <ol className="theory-review">
            {wrong.map((result) => (
              <li key={result.question.id}>
                <p className="question__prompt">{result.question.prompt}</p>
                <p>
                  {result.chosenId === null
                    ? THEORY_COPY.notAnswered
                    : `${THEORY_COPY.yourAnswer}: ${result.question.options.find((option) => option.id === result.chosenId)?.text ?? ''}`}
                </p>
                <p>
                  <strong>{THEORY_COPY.rightAnswer}:</strong> {result.correctText}
                </p>
                <p>{result.explanation}</p>
                <p className="card__meta">
                  {result.refs.map((ref) => (
                    <Link
                      key={`${ref.source}-${ref.page}`}
                      to={`/biblioteca/${ref.source}/${ref.page}`}
                      className="ref-link"
                    >
                      {SOURCE_SHORT_LABELS[ref.source]}, PDF {ref.page}
                    </Link>
                  ))}{' '}
                  <Link to={`/actividad/${result.question.activityId}`}>{THEORY_COPY.practise}</Link>
                </p>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="card__actions">
        <button type="button" className="button" onClick={onAnother}>
          {THEORY_COPY.another}
        </button>
      </p>
    </section>
  );
}
