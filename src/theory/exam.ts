import { createRandom, shuffle } from '../activities/random.ts';
import { activitiesBySection } from '../activities/sections.ts';
import type { Activity, KnowledgeUnit, SourceRef, TheoryExamConfig } from '../content/schemas.ts';

type ChoiceActivity = Extract<Activity, { type: 'single-choice' | 'sign-identification' }>;
type ChoiceVariant = ChoiceActivity['variants'][number];

/** One question as the player sees it: never which option is right. */
export interface ExamQuestion {
  /** `<activityId>#<variantId>`: stable, so a paper can be graded and stored. */
  id: string;
  activityId: string;
  variantId: string;
  sectionKey: string;
  prompt: string;
  signId: string | null;
  /** Numbered `o1`, `o2`… in display order: catalog ids could give the answer away ('a' is usually right). */
  options: Array<{ id: string; text: string }>;
  /** The catalog id of each option, in display order; for grading and storage, never rendered. */
  optionIds: string[];
}

export interface ExamPaper {
  seed: number;
  configVersion: string;
  questions: ExamQuestion[];
}

interface Candidate {
  activity: ChoiceActivity;
  variant: ChoiceVariant;
  sectionKey: string;
}

/** Choice questions of the configured sections that can offer the configured number of options. */
function candidatesBySection(
  activities: readonly Activity[],
  units: readonly Pick<KnowledgeUnit, 'id' | 'source' | 'section'>[],
  config: TheoryExamConfig,
): Map<string, Candidate[]> {
  const bySection = activitiesBySection(
    activities.filter((activity) => activity.status === 'reviewed'),
    units,
  );
  const pools = new Map<string, Candidate[]>();
  for (const sectionKey of config.sections) {
    const pool: Candidate[] = [];
    for (const activity of bySection.get(sectionKey) ?? []) {
      if (activity.type !== 'single-choice' && activity.type !== 'sign-identification') continue;
      for (const variant of activity.variants as ChoiceVariant[]) {
        const wrong = variant.options.filter((option) => !option.correct).length;
        if (wrong >= config.optionsPerQuestion - 1) pool.push({ activity, variant, sectionKey });
      }
    }
    pools.set(sectionKey, pool);
  }
  return pools;
}

/**
 * Questions per section, balanced by topic: proportional to the units each section teaches (largest remainder,
 * heavier sections first on ties), never more than a section can offer, and every section with questions
 * represented while there are enough to go round.
 */
export function allocate(
  weights: ReadonlyMap<string, number>,
  capacity: ReadonlyMap<string, number>,
  total: number,
): Map<string, number> {
  const keys = [...weights.keys()].filter((key) => (capacity.get(key) ?? 0) > 0);
  const quota = new Map(keys.map((key) => [key, 0]));
  const room = (key: string) => (capacity.get(key) ?? 0) - (quota.get(key) ?? 0);
  const add = (key: string, count: number) => quota.set(key, (quota.get(key) ?? 0) + count);
  let remaining = Math.min(
    total,
    keys.reduce((sum, key) => sum + (capacity.get(key) ?? 0), 0),
  );
  while (remaining > 0) {
    const open = keys.filter((key) => room(key) > 0);
    const weightSum = open.reduce((sum, key) => sum + (weights.get(key) ?? 0), 0);
    if (open.length === 0) break;
    const shares = open.map((key) => ({
      key,
      exact: weightSum === 0 ? remaining / open.length : (remaining * (weights.get(key) ?? 0)) / weightSum,
    }));
    let given = 0;
    for (const share of shares) {
      const whole = Math.min(room(share.key), Math.floor(share.exact));
      add(share.key, whole);
      given += whole;
    }
    const byRemainder = shares
      .filter((share) => room(share.key) > 0)
      .sort(
        (a, b) =>
          b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) ||
          (weights.get(b.key) ?? 0) - (weights.get(a.key) ?? 0) ||
          a.key.localeCompare(b.key),
      );
    for (const share of byRemainder) {
      if (given >= remaining) break;
      add(share.key, 1);
      given += 1;
    }
    if (given === 0) break;
    remaining -= given;
  }
  // Every topic in the paper: a section left at zero takes one question from the section with the most.
  for (const key of keys) {
    if ((quota.get(key) ?? 0) > 0) continue;
    const donor = [...keys].sort((a, b) => (quota.get(b) ?? 0) - (quota.get(a) ?? 0))[0];
    if (donor === undefined || (quota.get(donor) ?? 0) <= 1) break;
    add(donor, -1);
    add(key, 1);
  }
  return quota;
}

/** Picks `count` candidates, one variant per activity first, then more variants if the section is short. */
function pick(pool: readonly Candidate[], count: number, random: () => number): Candidate[] {
  const shuffled = shuffle(pool, random);
  const seen = new Set<string>();
  const first: Candidate[] = [];
  const rest: Candidate[] = [];
  for (const candidate of shuffled) {
    if (seen.has(candidate.activity.id)) rest.push(candidate);
    else {
      seen.add(candidate.activity.id);
      first.push(candidate);
    }
  }
  return [...first, ...rest].slice(0, count);
}

/**
 * A reproducible mock exam: the same seed and content always give the same paper. Each question keeps the right
 * option and `optionsPerQuestion - 1` wrong ones, in a shuffled order.
 */
export function composeExam(
  activities: readonly Activity[],
  units: readonly Pick<KnowledgeUnit, 'id' | 'source' | 'section'>[],
  config: TheoryExamConfig,
  seed: number,
): ExamPaper {
  const random = createRandom(seed);
  const pools = candidatesBySection(activities, units, config);
  const weights = new Map(
    config.sections.map((key) => [key, units.filter((unit) => `${unit.source}-${unit.section}` === key).length]),
  );
  const capacity = new Map([...pools].map(([key, pool]) => [key, pool.length]));
  const quota = allocate(weights, capacity, config.questions);
  const chosen = config.sections.flatMap((key) => pick(pools.get(key) ?? [], quota.get(key) ?? 0, random));
  const questions = shuffle(chosen, random).map(({ activity, variant, sectionKey }) => {
    const right = variant.options.find((option) => option.correct) as ChoiceVariant['options'][number];
    const wrong = shuffle(
      variant.options.filter((option) => !option.correct),
      random,
    ).slice(0, config.optionsPerQuestion - 1);
    const shown = shuffle([right, ...wrong], random);
    return {
      id: `${activity.id}#${variant.id}`,
      activityId: activity.id,
      variantId: variant.id,
      sectionKey,
      prompt: variant.prompt,
      signId: 'signId' in variant ? variant.signId : null,
      options: shown.map(({ text }, index) => ({ id: `o${index + 1}`, text })),
      optionIds: shown.map(({ id }) => id),
    };
  });
  return { seed, configVersion: config.version, questions };
}

export interface QuestionResult {
  question: ExamQuestion;
  /** The option chosen, as shown on the paper (`o1`…), or null when unanswered. */
  chosenId: string | null;
  /** The catalog id of the chosen option. */
  chosenOptionId: string | null;
  correct: boolean;
  correctText: string;
  /** Feedback of the chosen option, or null when unanswered. */
  feedback: string | null;
  explanation: string;
  refs: SourceRef[];
  unitIds: string[];
}

export interface ExamGrade {
  total: number;
  correct: number;
  unanswered: number;
  passed: boolean;
  bySection: Array<{ sectionKey: string; total: number; correct: number }>;
  /** Concepts of the questions answered wrong (or not at all), most missed first: what to review. */
  toReview: Array<{ unitId: string; missed: number }>;
  results: QuestionResult[];
}

/** Grades a paper against the activity data; an unanswered question counts as wrong, as in the real exam. */
export function gradeExam(
  paper: ExamPaper,
  answers: Readonly<Record<string, string | undefined>>,
  activities: readonly Activity[],
  config: TheoryExamConfig,
): ExamGrade {
  const byId = new Map(activities.map((activity) => [activity.id, activity]));
  const results = paper.questions.map((question): QuestionResult => {
    const activity = byId.get(question.activityId) as ChoiceActivity | undefined;
    const variant = activity?.variants.find((item) => item.id === question.variantId);
    if (!activity || !variant) throw new Error(`Question ${question.id} is not in the content`);
    const chosenId = answers[question.id] ?? null;
    const chosenOptionId = question.optionIds[question.options.findIndex((option) => option.id === chosenId)] ?? null;
    const chosen = variant.options.find((option) => option.id === chosenOptionId);
    const right = variant.options.find((option) => option.correct) as ChoiceVariant['options'][number];
    return {
      question,
      chosenId: chosen ? chosenId : null,
      chosenOptionId: chosen ? chosenOptionId : null,
      correct: chosen?.correct ?? false,
      correctText: right.text,
      feedback: chosen?.feedback ?? null,
      explanation: activity.explanation,
      refs: activity.refs,
      unitIds: [...activity.unitIds],
    };
  });
  const correct = results.filter((result) => result.correct).length;
  const sections = new Map<string, { total: number; correct: number }>();
  for (const result of results) {
    const entry = sections.get(result.question.sectionKey) ?? { total: 0, correct: 0 };
    sections.set(result.question.sectionKey, {
      total: entry.total + 1,
      correct: entry.correct + (result.correct ? 1 : 0),
    });
  }
  const missed = new Map<string, number>();
  for (const result of results)
    if (!result.correct) for (const unitId of result.unitIds) missed.set(unitId, (missed.get(unitId) ?? 0) + 1);
  return {
    total: results.length,
    correct,
    unanswered: results.filter((result) => result.chosenId === null).length,
    passed: results.length >= config.questions && correct >= config.passCorrect,
    bySection: config.sections
      .filter((key) => sections.has(key))
      .map((key) => ({ sectionKey: key, ...(sections.get(key) as { total: number; correct: number }) })),
    toReview: [...missed]
      .map(([unitId, count]) => ({ unitId, missed: count }))
      .sort((a, b) => b.missed - a.missed || a.unitId.localeCompare(b.unitId)),
    results,
  };
}
