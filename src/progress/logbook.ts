import { LEARNING_PATH } from '../app/learningPath.ts';
import type { PathGroup } from '../app/learningPath.ts';
import type { Activity, Attempt, KnowledgeUnit } from '../content/schemas.ts';
import { masteryOf } from './model.ts';
import type { ConceptProgress } from './model.ts';

/** How many activities the recommended review session proposes. */
export const REVIEW_SESSION_SIZE = 5;
/** How many recent mistakes the logbook lists. */
export const RECENT_ERRORS_LIMIT = 5;

export interface ConceptRow {
  unit: KnowledgeUnit;
  progress: ConceptProgress;
  state: 'practiced' | 'mastered';
  due: boolean;
}

export interface GroupProgress {
  groupId: PathGroup['id'];
  /** Concepts of the group's sections in the content. */
  total: number;
  /** Concepts that at least one activity trains today. */
  withActivities: number;
  practiced: number;
  mastered: number;
  /** Concepts with progress, due reviews first, then by next review. */
  rows: ConceptRow[];
}

const isDue = (progress: ConceptProgress, now: Date) => Date.parse(progress.dueAt) <= now.getTime();

/** Progress per learning-path group, so campaign B is measured apart from complementary material (PROPUESTA §6). */
export function progressByGroup(
  units: readonly KnowledgeUnit[],
  activities: readonly Activity[],
  concepts: ReadonlyMap<string, ConceptProgress>,
  now: Date,
): GroupProgress[] {
  const groupOf = new Map(
    LEARNING_PATH.flatMap((group) =>
      group.sections.map((section) => [`${section.source}:${section.section}`, group.id] as const),
    ),
  );
  const trained = new Set(activities.flatMap((activity) => activity.unitIds));
  return LEARNING_PATH.map((group) => {
    const groupUnits = units.filter((unit) => groupOf.get(`${unit.source}:${unit.section}`) === group.id);
    const rows: ConceptRow[] = groupUnits
      .flatMap((unit) => {
        const progress = concepts.get(unit.id);
        if (!progress) return [];
        const state = masteryOf(progress) === 'mastered' ? ('mastered' as const) : ('practiced' as const);
        return [{ unit, progress, state, due: isDue(progress, now) }];
      })
      .sort((a, b) => Number(b.due) - Number(a.due) || Date.parse(a.progress.dueAt) - Date.parse(b.progress.dueAt));
    return {
      groupId: group.id,
      total: groupUnits.length,
      withActivities: groupUnits.filter((unit) => trained.has(unit.id)).length,
      practiced: rows.filter((row) => row.state === 'practiced').length,
      mastered: rows.filter((row) => row.state === 'mastered').length,
      rows,
    };
  });
}

const attemptTime = (attempt: Attempt) => Date.parse(attempt.finishedAt ?? attempt.startedAt);

/** The latest attempt of each activity, newest first. */
function latestPerActivity(attempts: readonly Attempt[]): Attempt[] {
  const seen = new Set<string>();
  return [...attempts]
    .filter((attempt) => attempt.kind === 'activity')
    .sort((a, b) => attemptTime(b) - attemptTime(a))
    .filter((attempt) => {
      if (seen.has(attempt.subjectId)) return false;
      seen.add(attempt.subjectId);
      return true;
    });
}

export interface RecentError {
  activity: Activity;
  attempt: Attempt;
}

/** Activities whose latest attempt was wrong, newest first; activities no longer in the content are left out. */
export function recentErrors(
  activities: readonly Activity[],
  attempts: readonly Attempt[],
  limit = RECENT_ERRORS_LIMIT,
): RecentError[] {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  return latestPerActivity(attempts)
    .filter((attempt) => attempt.result.correct === false)
    .flatMap((attempt) => {
      const activity = byId.get(attempt.subjectId);
      return activity ? [{ activity, attempt }] : [];
    })
    .slice(0, limit);
}

export interface ReviewSuggestion {
  activity: Activity;
  reason: 'recent-error' | 'due';
  /** Due concepts this activity reviews (empty for a recent error). */
  dueUnitIds: string[];
}

/**
 * Recommended session: recent mistakes first, then one activity per due concept (failed concepts and the most
 * overdue first). Each activity appears once.
 */
export function recommendedReview(
  activities: readonly Activity[],
  attempts: readonly Attempt[],
  concepts: ReadonlyMap<string, ConceptProgress>,
  now: Date,
  limit = REVIEW_SESSION_SIZE,
): ReviewSuggestion[] {
  const suggestions: ReviewSuggestion[] = recentErrors(activities, attempts, limit).map(({ activity }) => ({
    activity,
    reason: 'recent-error',
    dueUnitIds: [],
  }));
  const chosen = new Set(suggestions.map((suggestion) => suggestion.activity.id));
  const due = [...concepts.values()]
    .filter((progress) => isDue(progress, now))
    .sort((a, b) => Number(a.lastCorrect) - Number(b.lastCorrect) || Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const covered = new Set<string>();
  for (const progress of due) {
    if (covered.has(progress.unitId)) continue;
    const activity = activities.find((item) => !chosen.has(item.id) && item.unitIds.includes(progress.unitId));
    if (!activity) continue;
    const dueUnitIds = due
      .map((item) => item.unitId)
      .filter((unitId) => activity.unitIds.includes(unitId) && !covered.has(unitId));
    for (const unitId of dueUnitIds) covered.add(unitId);
    chosen.add(activity.id);
    suggestions.push({ activity, reason: 'due', dueUnitIds });
  }
  return suggestions.slice(0, limit);
}
