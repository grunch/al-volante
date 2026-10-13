import type { City } from '../../city/model.ts';
import type { Notice } from '../../exam/circulation.ts';
import type { Aid } from '../../exam/modes.ts';
import type { Session } from '../../exam/session.ts';
import type { TransmissionKind } from '../../sim/powertrain/powertrain.ts';
import { EXAM_COPY as copy, formatNumber } from '../../i18n/es-AR.ts';
import { FaultItem } from './ExamCardView.tsx';

/*
 * What the exam page reads out of the session (F04-T03 to F04-T05): what the examiner says, the guided learning
 * panel and the HUD, whose readings are the aids each mode shows or hides (decision D15).
 */

/** What lies ahead on the street: the next control, its distance and, at a signal, its light. */
export function noticeText(notice: Notice | null): string {
  if (!notice) return copy.nothingAhead;
  const text = copy.notices[notice.kind](notice.distanceM);
  return notice.light ? `${text} ${copy.lightStates[notice.light]}.` : text;
}

/** What the examiner says aloud: the prompt of the phase, the next turn and the parking notice (every mode). */
export function examinerSays(session: Session, kind: TransmissionKind): string {
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
export function descentText(session: Session, kind: TransmissionKind): string {
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
export function LearnPanel({ session }: { session: Session }) {
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

/** The readings of the HUD: the leg and the next turn always; the rest only where the mode shows that aid. */
export function ExamHud({
  session,
  aids,
  legs,
  transmission,
}: {
  session: Session;
  aids: ReadonlySet<Aid>;
  legs: City['legs'];
  transmission: TransmissionKind;
}) {
  const { ledger, street, parking } = session;
  const finished = session.phase === 'finished';
  const show = (aid: Aid) => aids.has(aid);
  const cm = (value: number | null) => (value === null ? copy.pendingMeasure : `${formatNumber(value, 0)} cm`);
  const kerb = parking.final ?? parking.kerb;
  const parkingText =
    session.phase === 'parking' && parking.startedAtS === null && parking.aheadM !== null
      ? copy.bayAhead(parking.aheadM)
      : copy.parkingCountersOf(parking.manoeuvres, parking.attempts);
  const currentLeg = legs.find((leg) => leg.number === street.leg);
  return (
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
          <dd data-testid="exam-kerb">{kerb ? copy.kerbDistanceOf(kerb.frontCm, kerb.rearCm) : copy.pendingMeasure}</dd>
        </div>
      )}
      {show('descentChecklist') && session.phase === 'leaving' && (
        <div>
          <dt>{copy.descentChecklist}</dt>
          <dd data-testid="exam-descent">{descentText(session, transmission)}</dd>
        </div>
      )}
    </dl>
  );
}
