import { describe, expect, it } from 'vitest';
import { evaluateResponse, presentActivity } from '../activities/engine.ts';
import type { Activity } from './schemas.ts';
import { catalogActivities } from './testing/catalogActivities.ts';

// Plays every variant of every shipped activity through the engine, right and wrong. Passing this suite is what
// makes the units an activity practices `tested` (validateTreatment, CONTENIDO.md).

type DecisionVariant = Extract<Activity, { type: 'decision' }>['variants'][number];

/** How far to look for a seed that shows a given variant; the engine picks variants uniformly from the seed. */
const SEED_SEARCH = 5000;

function seedFor(activity: Activity, variantId: string): number | undefined {
  for (let seed = 0; seed < SEED_SEARCH; seed += 1)
    if (presentActivity(activity, seed).variantId === variantId) return seed;
  return undefined;
}

/** Every choice path from the start to an outcome. */
function decisionPaths(variant: DecisionVariant): Array<{ choiceIds: string[]; outcome: string }> {
  const paths: Array<{ choiceIds: string[]; outcome: string }> = [];
  const walk = (nodeId: string, choiceIds: string[]) => {
    for (const choice of variant.nodes[nodeId]?.choices ?? []) {
      if (choice.outcome !== undefined) paths.push({ choiceIds: [...choiceIds, choice.id], outcome: choice.outcome });
      else if (choice.next !== undefined) walk(choice.next, [...choiceIds, choice.id]);
    }
  };
  walk(variant.start, []);
  return paths;
}

describe('catalog playthrough', () => {
  it('has activities to play', () => {
    expect(catalogActivities.length).toBeGreaterThan(0);
  });

  for (const activity of catalogActivities) {
    describe(activity.id, () => {
      it('shows every variant for some seed, without revealing the answer', () => {
        for (const variant of activity.variants) {
          const seed = seedFor(activity, variant.id);
          expect(seed, `${activity.id}#${variant.id} is never presented`).toBeDefined();
          const shown = JSON.stringify(presentActivity(activity, seed ?? 0));
          expect(shown).not.toMatch(/"(correct|feedback|reason|outcome|next)"/);
        }
      });

      it('scores the right answer as correct and every wrong one as incorrect, with feedback', () => {
        for (const variant of activity.variants) {
          const label = `${activity.id}#${variant.id}`;
          if (activity.type === 'single-choice' || activity.type === 'sign-identification') {
            const { options } = variant as (typeof activity.variants)[number];
            expect(new Set(options.map((option) => option.text.trim().toLowerCase())).size, label).toBe(options.length);
            for (const option of options) {
              const result = evaluateResponse(activity, variant.id, { kind: 'choice', optionId: option.id });
              expect(result.correct, `${label} option ${option.id}`).toBe(option.correct);
              expect(result.feedback[0]?.trim().length, `${label} option ${option.id} feedback`).toBeGreaterThan(0);
              expect(result.refs.length).toBeGreaterThan(0);
            }
          } else if (activity.type === 'ordering') {
            const { items } = variant as (typeof activity.variants)[number];
            const right = items.map((item) => item.id);
            expect(evaluateResponse(activity, variant.id, { kind: 'ordering', order: right }).correct, label).toBe(
              true,
            );
            const reversed = [...right].reverse();
            expect(evaluateResponse(activity, variant.id, { kind: 'ordering', order: reversed }).correct, label).toBe(
              false,
            );
          } else {
            const decision = variant as DecisionVariant;
            const paths = decisionPaths(decision);
            expect(
              paths.some((path) => decision.outcomes[path.outcome]?.correct),
              label,
            ).toBe(true);
            for (const path of paths) {
              const result = evaluateResponse(activity, variant.id, { kind: 'decision', choiceIds: path.choiceIds });
              expect(result.correct, `${label} path ${path.choiceIds.join('>')}`).toBe(
                decision.outcomes[path.outcome]?.correct,
              );
            }
          }
        }
      });
    });
  }
});
