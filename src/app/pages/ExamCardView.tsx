import { Link } from 'react-router';
import type { Rule } from '../../content/schemas.ts';
import { fichaRowOf } from '../../exam/card.ts';
import type { CardFault, ExamCard, StageCard, Verdict } from '../../exam/card.ts';
import type { Fault } from '../../exam/scoring.ts';
import type { Session } from '../../exam/session.ts';
import { EXAM_COPY as copy, MOBILE_COPY } from '../../i18n/es-AR.ts';

/** Where to read the rule in the protocol: one link per cited page. */
export function RuleLinks({ rule }: { rule: Rule }) {
  return (
    <>
      {rule.refs.map((ref, position) => (
        <span key={ref.page}>
          {position > 0 && ', '}
          <Link to={`/biblioteca/${ref.source}/${ref.page}`}>{copy.protocolPage(ref.page)}</Link>
        </span>
      ))}
    </>
  );
}

/** The ficha text of a fault: the row of the stage and context it was consigned in (decision D1). */
const fichaText = (rule: Rule, fault: Fault | null) =>
  fault ? fichaRowOf(rule, fault).text : (rule.fichaRows[0]?.text ?? rule.id);

/** One fault with its ficha text, points and, when explaining, what the protocol evaluates and where to read it. */
export function FaultItem({ item, explain, when }: { item: CardFault; explain: boolean; when?: boolean }) {
  const { fault, rule } = item;
  const text = fichaText(rule, fault);
  return (
    <>
      <strong>{copy.faultPoints(fault.points)}</strong> · {text}
      {when && <small> ({copy.faultAt(fault.atS)})</small>}
      <small> ({copy.repetition[rule.repetition]})</small>
      {fault.escalated && <small> ({copy.escalated})</small>}
      {explain && (
        <p className="exam-feedback">
          <b>{copy.whatIsEvaluated}:</b> {rule.condition} <b>{copy.readMore}:</b> <RuleLinks rule={rule} />
        </p>
      )}
    </>
  );
}

/** The faults of a running session, in order; explained when the mode or the end of the exam asks for it. */
export function FaultList({ session, explain }: { session: Session; explain: boolean }) {
  const { faults } = session.ledger;
  const finished = session.phase === 'finished';
  if (faults.length === 0) return <p>{finished ? copy.feedbackClean : copy.noFaults}</p>;
  return (
    <ol className="exam-faults">
      {faults.map((fault, index) => {
        const rule = session.rules.find((candidate) => candidate.id === fault.ruleId);
        if (!rule) return <li key={`${fault.ruleId}-${index}`}>{fault.ruleId}</li>;
        return (
          <li key={`${fault.ruleId}-${index}`}>
            <FaultItem item={{ fault, rule }} explain={explain} />
          </li>
        );
      })}
    </ol>
  );
}

function verdictText(verdict: Verdict): string {
  switch (verdict.kind) {
    case 'approved':
      return copy.verdicts.approved(verdict.points);
    case 'pending':
      return copy.verdicts.pending;
    case 'disapproved':
      if (verdict.cause === 'over-points') return copy.verdicts.overPoints(verdict.points);
      if (verdict.cause === 'eliminatory') return copy.verdicts.eliminatory(fichaText(verdict.rule, verdict.fault));
      return `${copy.verdicts.interruption} ${copy.interruptionCauses[verdict.interruption.cause]}${
        verdict.rule ? ` ${copy.interruptedBy(fichaText(verdict.rule, verdict.fault))}` : ''
      }`;
  }
}

function stageStatus(stage: StageCard): string {
  if (!stage.inScope) return copy.stageOutOfScope;
  return stage.completed ? copy.stageCompleted : copy.stageIncomplete;
}

function StageSection({ stage }: { stage: StageCard }) {
  const duration =
    stage.startedAtS !== null && stage.endedAtS !== null ? copy.stageDuration(stage.endedAtS - stage.startedAtS) : null;
  return (
    <section
      className="exam-stage"
      data-testid={`exam-card-stage-${stage.stage}`}
      data-completed={String(stage.completed)}
      aria-labelledby={`exam-stage-${stage.stage}`}
    >
      <h3 id={`exam-stage-${stage.stage}`}>
        {copy.stageTitles[stage.stage]} · {stageStatus(stage)}
        {duration && <small> · {duration}</small>}
      </h3>
      {stage.inScope &&
        (stage.faults.length === 0 ? (
          <p>{copy.noFaults}</p>
        ) : (
          <ol className="exam-faults">
            {stage.faults.map((item, index) => (
              <li key={`${item.rule.id}-${index}`}>
                <FaultItem item={item} explain when />
              </li>
            ))}
          </ol>
        ))}
      {stage.inScope && <p data-testid={`exam-card-subtotal-${stage.stage}`}>{copy.subtotal(stage.points)}</p>}
    </section>
  );
}

/** The card per stage shown when the session ends (F04-T05): stages, faults, subtotals, total and verdict. */
export function ExamCardView({
  card,
  takeover,
  assistedClutch = false,
}: {
  card: ExamCard;
  takeover: boolean;
  assistedClutch?: boolean;
}) {
  return (
    <section className="exam-card" data-testid="exam-card" aria-labelledby="exam-card-heading">
      <h2 id="exam-card-heading">{copy.card}</h2>
      <p>{copy.cardIntro}</p>
      <p role="status" data-testid="exam-result" data-result={card.result}>
        {verdictText(card.verdict)}
        {takeover ? ` ${copy.takeover}` : ''}
      </p>
      {card.stages.map((stage) => (
        <StageSection key={stage.stage} stage={stage} />
      ))}
      <p data-testid="exam-card-total">
        <strong>{copy.total(card.points)}</strong>
      </p>
      <h3>{copy.approximationsHeading}</h3>
      {assistedClutch && (
        <p>
          <small>
            {MOBILE_COPY.clutchApproximation} <Link to="/biblioteca/protocolo/11">{copy.protocolPage(11)}</Link>
          </small>
        </p>
      )}
      <p>
        <small>{copy.approximations}</small>
      </p>
    </section>
  );
}
