import { pageCountsOf, refErrors } from './refs.ts';
import type { Activity, Source } from './schemas.ts';

type DecisionVariant = Extract<Activity, { type: 'decision' }>['variants'][number];
type ChoiceOption = Extract<Activity, { type: 'single-choice' }>['variants'][number]['options'][number];

/** Authoring rule (CONTENIDO.md): the right option is at most this many characters longer than any wrong one. */
export const MAX_CORRECT_OPTION_EXTRA_CHARS = 10;
/** Wrong options every choice variant offers: the mock theory exam shows the right one and two wrong ones. */
export const MIN_WRONG_OPTIONS = 2;

/** Characters as a reader counts them: code points of the composed (NFC) text, so "é" is one either way. */
const charCount = (text: string) => Array.from(text.normalize('NFC')).length;

export interface ActivityContext {
  manifest: readonly Source[];
  unitIds: ReadonlySet<string>;
  signIds: ReadonlySet<string>;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)));
}

/** A decision graph must start at an existing node, reach every node and outcome, never loop and be winnable. */
function decisionErrors(label: string, variant: DecisionVariant): string[] {
  const errors: string[] = [];
  const nodeIds = Object.keys(variant.nodes);
  if (!variant.nodes[variant.start]) errors.push(`${label}: start node "${variant.start}" does not exist`);
  for (const [nodeId, node] of Object.entries(variant.nodes)) {
    for (const choice of node.choices) {
      const where = `${label}: node "${nodeId}" choice "${choice.id}"`;
      if ((choice.next === undefined) === (choice.outcome === undefined))
        errors.push(`${where} needs exactly one of next or outcome`);
      if (choice.next !== undefined && !variant.nodes[choice.next])
        errors.push(`${where} points to missing node "${choice.next}"`);
      if (choice.outcome !== undefined && !variant.outcomes[choice.outcome])
        errors.push(`${where} points to missing outcome "${choice.outcome}"`);
    }
  }
  // Depth-first walk: detects cycles (the activity must always end) and unreachable nodes.
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (nodeId: string): void => {
    if (state.get(nodeId) === 'done') return;
    if (state.get(nodeId) === 'visiting') {
      errors.push(`${label}: cycle through node "${nodeId}"`);
      return;
    }
    state.set(nodeId, 'visiting');
    for (const choice of variant.nodes[nodeId]?.choices ?? [])
      if (choice.next && variant.nodes[choice.next]) visit(choice.next);
    state.set(nodeId, 'done');
  };
  if (variant.nodes[variant.start]) visit(variant.start);
  for (const nodeId of nodeIds) if (!state.has(nodeId)) errors.push(`${label}: node "${nodeId}" is unreachable`);

  // Only outcomes that some playable path reaches count: a correct outcome nobody can reach makes the scene unwinnable.
  const reached = new Set(
    [...state.keys()].flatMap((nodeId) =>
      (variant.nodes[nodeId]?.choices ?? []).flatMap((choice) => choice.outcome ?? []),
    ),
  );
  if (![...reached].some((outcomeId) => variant.outcomes[outcomeId]?.correct))
    errors.push(`${label}: no correct outcome is reachable from the start`);
  for (const outcomeId of Object.keys(variant.outcomes))
    if (!reached.has(outcomeId)) errors.push(`${label}: outcome "${outcomeId}" is never reached`);
  return errors;
}

/**
 * A choice question has one right option, enough distractors for the mock exam and no right option that gives
 * itself away by being much longer than the wrong ones.
 */
function choiceErrors(label: string, options: readonly ChoiceOption[]): string[] {
  const errors: string[] = [];
  const right = options.filter((option) => option.correct);
  const wrong = options.filter((option) => !option.correct);
  if (right.length !== 1) errors.push(`${label}: needs exactly one correct option (found ${right.length})`);
  if (wrong.length < MIN_WRONG_OPTIONS)
    errors.push(`${label}: needs at least ${MIN_WRONG_OPTIONS} wrong options (found ${wrong.length})`);
  for (const optionId of duplicates(options.map((option) => option.id)))
    errors.push(`${label}: duplicate option ${optionId}`);
  // The length rule compares one right option with the wrong ones; without them the errors above already apply.
  if (right.length !== 1 || wrong.length === 0) return errors;
  const answer = right[0] as ChoiceOption;
  const longestWrong = Math.max(...wrong.map((option) => charCount(option.text)));
  const length = charCount(answer.text);
  const extra = length - longestWrong;
  if (extra > MAX_CORRECT_OPTION_EXTRA_CHARS)
    errors.push(
      `${label}: the correct option "${answer.id}" has ${length} characters, ${extra} more than the longest wrong ` +
        `option (${longestWrong}); at most ${MAX_CORRECT_OPTION_EXTRA_CHARS} more, or its length gives it away`,
    );
  return errors;
}

/** Cross-record checks for activities: concepts, citations, signs and per-type answer consistency. */
export function validateActivities(
  activities: readonly Activity[],
  { manifest, unitIds, signIds }: ActivityContext,
): string[] {
  const errors: string[] = [];
  const pageCounts = pageCountsOf(manifest);
  for (const id of duplicates(activities.map((activity) => activity.id))) errors.push(`${id}: duplicate activity id`);

  for (const activity of activities) {
    const { id } = activity;
    for (const unitId of activity.unitIds) if (!unitIds.has(unitId)) errors.push(`${id}: unknown unit ${unitId}`);
    errors.push(...refErrors(id, activity.refs, pageCounts));
    for (const variantId of duplicates(activity.variants.map((variant) => variant.id)))
      errors.push(`${id}: duplicate variant ${variantId}`);

    for (const variant of activity.variants) {
      const label = `${id}#${variant.id}`;
      if (activity.type === 'single-choice' || activity.type === 'sign-identification') {
        const { options } = variant as Extract<Activity, { type: 'single-choice' }>['variants'][number];
        errors.push(...choiceErrors(label, options));
      }
      if (activity.type === 'sign-identification') {
        const { signId } = variant as Extract<Activity, { type: 'sign-identification' }>['variants'][number];
        if (!signIds.has(signId)) errors.push(`${label}: unknown sign ${signId}`);
      }
      if (activity.type === 'ordering') {
        const { items } = variant as Extract<Activity, { type: 'ordering' }>['variants'][number];
        for (const itemId of duplicates(items.map((item) => item.id)))
          errors.push(`${label}: duplicate item ${itemId}`);
      }
      if (activity.type === 'decision') errors.push(...decisionErrors(label, variant as DecisionVariant));
    }
  }
  return errors;
}

/**
 * Each activity file holds one source section (`manual-ch1` → specs/catalog/activities/manual-ch1.json): an
 * activity belongs to the section of its first unit, so the files stay small and reviewable.
 */
export function activityFileErrors(
  files: ReadonlyMap<string, readonly Activity[]>,
  units: ReadonlyArray<{ id: string; source: string; section: string }>,
): string[] {
  const sectionOf = new Map(units.map((unit) => [unit.id, `${unit.source}-${unit.section}`]));
  const errors: string[] = [];
  for (const [key, activities] of files) {
    for (const activity of activities) {
      const home = sectionOf.get(activity.unitIds[0] ?? '');
      if (home !== undefined && home !== key)
        errors.push(`${activity.id}: is in ${key}.json but its first unit belongs to ${home}.json`);
    }
  }
  return errors;
}
