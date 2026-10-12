import type { GuideStep } from '../../exam/guide.ts';
import type { KeyNames } from '../../practice/keyLabels.ts';
import type { TransmissionKind } from '../../sim/powertrain/powertrain.ts';
import { DRIVING_GUIDE_COPY as copy } from '../../i18n/drivingGuide.ts';

/**
 * How to drive the exam (F04-T05-FIX01): the keys of the cabin in every mode, since they belong to the game and not
 * to the exam, and the step-by-step procedure with the current step marked where the mode shows aids (D15).
 */
export function ExamGuide({
  keys,
  kind,
  steps,
  current,
  showSteps,
}: {
  keys: KeyNames;
  kind: TransmissionKind;
  /** The steps of the stages the session covers (guide.ts). */
  steps: readonly GuideStep[];
  current: GuideStep | null;
  showSteps: boolean;
}) {
  return (
    <details className="exam-guide" data-testid="exam-guide">
      <summary>{copy.heading}</summary>
      <h3>{copy.controlsHeading}</h3>
      <ul data-testid="exam-guide-controls">
        {copy.controls(keys, kind).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {showSteps ? (
        <>
          <h3>{copy.stepsHeading}</h3>
          <ol data-testid="exam-guide-steps">
            {steps.map((step) => (
              <li key={step} aria-current={step === current ? 'step' : undefined}>
                <b>{copy.steps[step].title}.</b> {copy.steps[step].how(keys, kind)}
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p>{copy.stepsHidden}</p>
      )}
    </details>
  );
}
