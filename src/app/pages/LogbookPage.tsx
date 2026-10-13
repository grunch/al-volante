import { useContentState } from '../../content/ContentProvider.tsx';
import type { Content } from '../../content/validate.ts';
import { drivingLog, progressByGroup, recentErrors, recommendedReview, theoryLog } from '../../progress/logbook.ts';
import { useProgress } from '../../progress/ProgressProvider.tsx';
import { BackupPanel } from '../../progress/ui/BackupPanel.tsx';
import { ConceptProgressSection } from '../../progress/ui/ConceptProgressSection.tsx';
import { DrivingSection } from '../../progress/ui/DrivingSection.tsx';
import { TheorySection } from '../../progress/ui/TheorySection.tsx';
import { ReviewSection } from '../../progress/ui/ReviewSection.tsx';
import { ContentGate } from '../../ui/ContentGate.tsx';
import { PageTitle } from '../../ui/PageTitle.tsx';
import { LOGBOOK_COPY } from '../../i18n/es-AR.ts';

/** "Mi bitácora": recent mistakes, recommended review, per-concept progress and backups (PROPUESTA §2 and §6). */
export function LogbookPage() {
  return (
    <>
      <PageTitle>{LOGBOOK_COPY.heading}</PageTitle>
      <p className="lead">{LOGBOOK_COPY.intro}</p>
      <ContentGate>{(content) => <Logbook content={content} />}</ContentGate>
    </>
  );
}

function Logbook({ content }: { content: Content }) {
  const contentState = useContentState();
  const { state, now, retry, replaceAll, exportSnapshot, unsaved, acknowledgeUnsaved } = useProgress();

  // ContentGate only renders this once content is ready; the check narrows the type.
  if (contentState.status !== 'ready') return null;
  if (state.status === 'loading') return <p role="status">{LOGBOOK_COPY.loading}</p>;
  if (state.status === 'error') {
    return (
      <div className="status-message status-message--error" role="alert">
        <p>{LOGBOOK_COPY.loadError}</p>
        <button type="button" className="button" onClick={retry}>
          {LOGBOOK_COPY.retry}
        </button>
      </div>
    );
  }

  const { attempts, concepts } = state.data;
  const current = now();
  const unitTitles = new Map(content.units.map((unit) => [unit.id, unit.title]));
  return (
    <>
      {!state.persistent && (
        <p className="status-message" role="status">
          {LOGBOOK_COPY.notPersistent}
        </p>
      )}
      {state.quarantined > 0 && (
        <p className="status-message" role="status">
          {LOGBOOK_COPY.quarantined(state.quarantined)}
        </p>
      )}
      {unsaved > 0 && (
        <div className="status-message status-message--error" role="alert">
          <p>{LOGBOOK_COPY.unsaved(unsaved)}</p>
          <button type="button" className="button button--secondary" onClick={acknowledgeUnsaved}>
            {LOGBOOK_COPY.acknowledge}
          </button>
        </div>
      )}
      <ReviewSection
        suggestions={recommendedReview(content.activities, attempts, concepts, current)}
        errors={recentErrors(content.activities, attempts)}
        unitTitles={unitTitles}
      />
      <ConceptProgressSection groups={progressByGroup(content.units, content.activities, concepts, current)} />
      <TheorySection rows={theoryLog(attempts)} />
      <DrivingSection rows={drivingLog(attempts)} />
      <BackupPanel
        rules={content.rules}
        theoryExam={content.theoryExam}
        attemptCount={attempts.length}
        exportSnapshot={exportSnapshot}
        contentVersion={contentState.version}
        now={now}
        replaceAll={replaceAll}
      />
    </>
  );
}
