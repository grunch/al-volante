import type { Activity, Source } from './schemas.ts';

type DecisionVariant = Extract<Activity, { type: 'decision' }>['variants'][number];

export interface ActivityContext {
  manifest: readonly Source[];
  unitIds: ReadonlySet<string>;
  signIds: ReadonlySet<string>;
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => (seen.has(value) ? true : (seen.add(value), false)));
}

/** A decision graph must start at an existing node, reach every node, never loop and offer a correct outcome. */
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
  if (!Object.values(variant.outcomes).some((outcome) => outcome.correct)) errors.push(`${label}: no correct outcome`);

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
  return errors;
}

/** Cross-record checks for activities: concepts, citations, signs and per-type answer consistency. */
export function validateActivities(
  activities: readonly Activity[],
  { manifest, unitIds, signIds }: ActivityContext,
): string[] {
  const errors: string[] = [];
  const pageCounts = new Map(manifest.map((source) => [source.id, source.pages]));
  for (const id of duplicates(activities.map((activity) => activity.id))) errors.push(`${id}: duplicate activity id`);

  for (const activity of activities) {
    const { id } = activity;
    for (const unitId of activity.unitIds) if (!unitIds.has(unitId)) errors.push(`${id}: unknown unit ${unitId}`);
    for (const ref of activity.refs) {
      const total = pageCounts.get(ref.source) ?? 0;
      if (ref.page > total) errors.push(`${id}: reference ${ref.source}:${ref.page} is outside 1..${total}`);
    }
    for (const variantId of duplicates(activity.variants.map((variant) => variant.id)))
      errors.push(`${id}: duplicate variant ${variantId}`);

    for (const variant of activity.variants) {
      const label = `${id}#${variant.id}`;
      if (activity.type === 'single-choice' || activity.type === 'sign-identification') {
        const { options } = variant as Extract<Activity, { type: 'single-choice' }>['variants'][number];
        const correct = options.filter((option) => option.correct).length;
        if (correct !== 1) errors.push(`${label}: needs exactly one correct option (found ${correct})`);
        for (const optionId of duplicates(options.map((option) => option.id)))
          errors.push(`${label}: duplicate option ${optionId}`);
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
