import { useContext, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ActivityResultContext } from '../../activities/ActivityResultContext.ts';
import {
  SEED_LIMIT,
  decisionStep,
  evaluateResponse,
  nextDistinctSeed,
  presentActivity,
} from '../../activities/engine.ts';
import type { ActivityResponse, Evaluation } from '../../activities/engine.ts';
import { ChoiceQuestion } from '../../activities/ui/ChoiceQuestion.tsx';
import { DecisionQuestion } from '../../activities/ui/DecisionQuestion.tsx';
import { FeedbackPanel } from '../../activities/ui/FeedbackPanel.tsx';
import { OrderingQuestion } from '../../activities/ui/OrderingQuestion.tsx';
import { SignGraphic } from '../../activities/ui/SignGraphic.tsx';
import type { Activity } from '../../content/schemas.ts';
import type { Content } from '../../content/validate.ts';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { ACTIVITY_COPY, ACTIVITY_TYPE_LABELS } from '../../i18n/es-AR.ts';
import { NotFoundPage } from './NotFoundPage.tsx';

function randomSeed(): number {
  return Math.floor(Math.random() * SEED_LIMIT);
}

/** Keyboard and screen reader users land on the title again when the question is replaced under them. */
function focusTitle(): void {
  document.getElementById('page-title')?.focus();
}

/** Plays one activity. The seed lives in the URL (?semilla=) so a variant can be reproduced or shared. */
export function ActivityPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  // Only plain digits count: Number(null) and Number('') would silently become seed 0.
  const rawSeed = params.get('semilla') ?? '';
  const validSeed = /^\d{1,10}$/.test(rawSeed) && Number(rawSeed) < SEED_LIMIT;
  const seed = validSeed ? Number(rawSeed) : 0;

  useEffect(() => {
    if (!validSeed) setParams({ semilla: String(randomSeed()) }, { replace: true });
  }, [validSeed, setParams]);

  return (
    <ContentGate>
      {(content) => {
        const activity = content.activities.find((item) => item.id === id);
        if (!activity) return <NotFoundPage />;
        // The title stays mounted while the seed is normalised or changed, so the layout's focus stays on it.
        return (
          <>
            <PageTitle>{activity.title}</PageTitle>
            {validSeed && (
              <ActivityPlayer
                key={`${activity.id}:${seed}`}
                activity={activity}
                content={content}
                seed={seed}
                onAnotherVariant={() => {
                  focusTitle();
                  setParams({ semilla: String(nextDistinctSeed(activity, seed)) });
                }}
              />
            )}
          </>
        );
      }}
    </ContentGate>
  );
}

interface ActivityPlayerProps {
  activity: Activity;
  content: Content;
  seed: number;
  onAnotherVariant: () => void;
}

function ActivityPlayer({ activity, content, seed, onAnotherVariant }: ActivityPlayerProps) {
  const record = useContext(ActivityResultContext);
  const [presentation] = useState(() => presentActivity(activity, seed));
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);

  const answer = (response: ActivityResponse) => {
    const result = evaluateResponse(activity, presentation.variantId, response);
    setEvaluation(result);
    record({ activity, presentation, response, evaluation: result });
  };

  const sign =
    presentation.kind === 'choice' && presentation.signId
      ? content.signs.find((item) => item.id === presentation.signId)
      : undefined;

  return (
    <>
      <p className="badge">{ACTIVITY_TYPE_LABELS[activity.type]}</p>
      {sign && (
        <figure className="sign-figure">
          <SignGraphic signId={sign.id} description={`${ACTIVITY_COPY.signToIdentify}: ${sign.visual}`} />
        </figure>
      )}
      {presentation.kind === 'choice' && (
        <ChoiceQuestion
          presentation={presentation}
          answered={evaluation !== null}
          onAnswer={(optionId) => answer({ kind: 'choice', optionId })}
        />
      )}
      {presentation.kind === 'ordering' && (
        <OrderingQuestion
          presentation={presentation}
          answered={evaluation !== null}
          onAnswer={(order) => answer({ kind: 'ordering', order })}
        />
      )}
      {presentation.kind === 'decision' && activity.type === 'decision' && (
        <DecisionQuestion
          presentation={presentation}
          answered={evaluation !== null}
          resolve={(nodeId, choiceId) => {
            const step = decisionStep(activity, presentation.variantId, nodeId, choiceId);
            return 'next' in step ? step.next : null;
          }}
          onAnswer={(choiceIds) => answer({ kind: 'decision', choiceIds })}
        />
      )}
      <div aria-live="polite">{evaluation && <FeedbackPanel evaluation={evaluation} />}</div>
      <p className="card__actions">
        {evaluation && (
          <button type="button" className="button" onClick={onAnotherVariant}>
            {ACTIVITY_COPY.anotherVariant}
          </button>
        )}{' '}
        <Link to="/actividades">{ACTIVITY_COPY.backToList}</Link>
      </p>
    </>
  );
}
