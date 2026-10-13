import type { Activity, SourceRef } from '../content/schemas.ts';
import { createRandom, shuffle } from './random.ts';

type ChoiceActivity = Extract<Activity, { type: 'single-choice' | 'sign-identification' }>;
type OrderingActivity = Extract<Activity, { type: 'ordering' }>;
type DecisionActivity = Extract<Activity, { type: 'decision' }>;
type DecisionVariant = DecisionActivity['variants'][number];

interface PresentationBase {
  activityId: string;
  variantId: string;
  seed: number;
}

/** What the player sees: correctness is never part of a presentation. */
export type Presentation =
  | (PresentationBase & {
      kind: 'choice';
      prompt: string;
      signId: string | null;
      options: Array<{ id: string; text: string }>;
    })
  | (PresentationBase & { kind: 'ordering'; prompt: string; items: Array<{ id: string; text: string }> })
  | (PresentationBase & {
      kind: 'decision';
      start: string;
      nodes: Record<string, { text: string; choices: Array<{ id: string; text: string }> }>;
    });

export type ActivityResponse =
  | { kind: 'choice'; optionId: string }
  | { kind: 'ordering'; order: string[] }
  | { kind: 'decision'; choiceIds: string[] };

export interface Evaluation {
  activityId: string;
  variantId: string;
  correct: boolean;
  /** 0..1; partial credit only for ordering (share of items in the right position). */
  score: number;
  /** Feedback specific to the answer given, in play order. */
  feedback: string[];
  /** The right answer in words, shown after any attempt. */
  correctAnswer: string;
  explanation: string;
  refs: SourceRef[];
}

export type DecisionStep = { next: string } | { outcome: { correct: boolean; feedback: string } };

function variantById<T extends { id: string }>(variants: readonly T[], variantId: string, activityId: string): T {
  const variant = variants.find((item) => item.id === variantId);
  if (!variant) throw new Error(`Unknown variant ${variantId} for ${activityId}`);
  return variant;
}

/**
 * Picks the variant and the presentation order from `seed`; identical seeds give identical presentations. A known
 * `variantId` (the sign catalog links to the variant of each sign) replaces the variant drawn, not the order.
 */
export function presentActivity(activity: Activity, seed: number, variantId?: string): Presentation {
  const random = createRandom(seed);
  const drawn = Math.floor(random() * activity.variants.length);
  const requested = activity.variants.findIndex((variant) => variant.id === variantId);
  const variantIndex = requested === -1 ? drawn : requested;
  const base = { activityId: activity.id, seed };
  switch (activity.type) {
    case 'single-choice':
    case 'sign-identification': {
      const variant = (activity as ChoiceActivity).variants[variantIndex] as ChoiceActivity['variants'][number];
      return {
        ...base,
        kind: 'choice',
        variantId: variant.id,
        prompt: variant.prompt,
        signId: 'signId' in variant ? variant.signId : null,
        options: shuffle(variant.options, random).map(({ id, text }) => ({ id, text })),
      };
    }
    case 'ordering': {
      const variant = activity.variants[variantIndex] as OrderingActivity['variants'][number];
      let items = shuffle(variant.items, random);
      // A presentation that is already solved teaches nothing: rotate it by one.
      if (items.every((item, index) => item.id === variant.items[index]?.id))
        items = [...items.slice(1), items[0] as (typeof items)[number]];
      return {
        ...base,
        kind: 'ordering',
        variantId: variant.id,
        prompt: variant.prompt,
        items: items.map(({ id, text }) => ({ id, text })),
      };
    }
    case 'decision': {
      const variant = activity.variants[variantIndex] as DecisionVariant;
      const nodes = Object.fromEntries(
        Object.entries(variant.nodes).map(([nodeId, node]) => [
          nodeId,
          { text: node.text, choices: shuffle(node.choices, random).map(({ id, text }) => ({ id, text })) },
        ]),
      );
      return { ...base, kind: 'decision', variantId: variant.id, start: variant.start, nodes };
    }
  }
}

/** Resolves one decision choice: either the next node or the final outcome. */
export function decisionStep(
  activity: DecisionActivity,
  variantId: string,
  nodeId: string,
  choiceId: string,
): DecisionStep {
  const variant = variantById(activity.variants, variantId, activity.id);
  const choice = variant.nodes[nodeId]?.choices.find((item) => item.id === choiceId);
  if (!choice) throw new Error(`Unknown choice ${choiceId} at node ${nodeId} of ${activity.id}`);
  if (choice.next !== undefined) return { next: choice.next };
  const outcome = variant.outcomes[choice.outcome ?? ''];
  if (!outcome) throw new Error(`Choice ${choiceId} of ${activity.id} has no outcome`);
  return { outcome };
}

function evaluateChoice(activity: ChoiceActivity, variantId: string, optionId: string) {
  const variant = variantById(activity.variants, variantId, activity.id);
  const selected = variant.options.find((option) => option.id === optionId);
  if (!selected) throw new Error(`Unknown option ${optionId} for ${activity.id}`);
  const right = variant.options.find((option) => option.correct) as (typeof variant.options)[number];
  return {
    correct: selected.correct,
    score: selected.correct ? 1 : 0,
    feedback: [selected.feedback],
    correctAnswer: right.text,
  };
}

function evaluateOrdering(activity: OrderingActivity, variantId: string, order: string[]) {
  const variant = variantById(activity.variants, variantId, activity.id);
  const expected = variant.items.map((item) => item.id);
  // Compared id by id: joining them would let ids that contain commas pass as a different set.
  const sortedExpected = [...expected].sort();
  const sameItems = order.length === expected.length && [...order].sort().every((id, i) => id === sortedExpected[i]);
  if (!sameItems) {
    throw new Error(`Ordering response for ${activity.id} must contain each item exactly once`);
  }
  const placed = order.filter((id, index) => id === expected[index]).length;
  return {
    correct: placed === expected.length,
    score: placed / expected.length,
    feedback: variant.items.map((item, index) => `${index + 1}. ${item.text}: ${item.reason}`),
    correctAnswer: variant.items.map((item) => item.text).join(' → '),
  };
}

function evaluateDecision(activity: DecisionActivity, variantId: string, choiceIds: string[]) {
  const variant = variantById(activity.variants, variantId, activity.id);
  let nodeId = variant.start;
  for (const [index, choiceId] of choiceIds.entries()) {
    const step = decisionStep(activity, variantId, nodeId, choiceId);
    if ('next' in step) {
      nodeId = step.next;
      continue;
    }
    if (index !== choiceIds.length - 1) throw new Error(`Decision path for ${activity.id} continues after an outcome`);
    const best = Object.values(variant.outcomes).find((outcome) => outcome.correct) as { feedback: string };
    return {
      correct: step.outcome.correct,
      score: step.outcome.correct ? 1 : 0,
      feedback: [step.outcome.feedback],
      correctAnswer: best.feedback,
    };
  }
  throw new Error(`Decision path for ${activity.id} ends before an outcome`);
}

/** Scores a response against the activity data; throws on responses the UI could never produce. */
export function evaluateResponse(activity: Activity, variantId: string, response: ActivityResponse): Evaluation {
  let result: Pick<Evaluation, 'correct' | 'score' | 'feedback' | 'correctAnswer'>;
  if ((activity.type === 'single-choice' || activity.type === 'sign-identification') && response.kind === 'choice') {
    result = evaluateChoice(activity, variantId, response.optionId);
  } else if (activity.type === 'ordering' && response.kind === 'ordering') {
    result = evaluateOrdering(activity, variantId, response.order);
  } else if (activity.type === 'decision' && response.kind === 'decision') {
    result = evaluateDecision(activity, variantId, response.choiceIds);
  } else {
    throw new Error(`Response kind ${response.kind} does not match activity type ${activity.type}`);
  }
  return { activityId: activity.id, variantId, ...result, explanation: activity.explanation, refs: activity.refs };
}

/** Seeds live in [0, SEED_LIMIT): they fit in the URL and in the 32-bit PRNG state. */
export const SEED_LIMIT = 2 ** 31;
/** How far `nextDistinctSeed` looks before giving up on finding another presentation. */
const DISTINCT_SEED_SEARCH = 64;

const presentationKey = (activity: Activity, seed: number) =>
  JSON.stringify({ ...presentActivity(activity, seed), seed: 0 });

/**
 * The next seed whose presentation really differs from the current one (`variantId` when it was requested): another
 * variant when the activity has several, otherwise at least another order. Falls back to seed + 1 when every nearby
 * seed looks the same.
 */
export function nextDistinctSeed(activity: Activity, seed: number, variantId?: string): number {
  const candidates = Array.from({ length: DISTINCT_SEED_SEARCH }, (_, index) => (seed + index + 1) % SEED_LIMIT);
  const current = presentActivity(activity, seed, variantId);
  const otherVariant = candidates.find(
    (candidate) => presentActivity(activity, candidate).variantId !== current.variantId,
  );
  if (otherVariant !== undefined) return otherVariant;
  const currentKey = presentationKey(activity, seed);
  const otherOrder = candidates.find((candidate) => presentationKey(activity, candidate) !== currentKey);
  return otherOrder ?? (seed + 1) % SEED_LIMIT;
}
